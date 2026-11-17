import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess, sendError, HTTP_STATUS } from '../utils/apiResponse.js'
import { User } from '../models/User.js'
import { sendNotificationToUser } from '../utils/pushNotificationHelper.js'
import { normalizeIndianPhone } from '../utils/phone.js'

export const saveToken = asyncHandler(async (req, res) => {
  const body = req.body || {}
  const platform = String(body.platform || 'web').toLowerCase()
  
  // Extract token from multiple common property names
  const rawToken =
    body.token ??
    body.fcmToken ??
    body.fcm_token ??
    body.deviceToken ??
    body.device_token ??
    body.registrationToken ??
    body.registration_token

  const token =
    typeof rawToken === 'string'
      ? rawToken.trim()
      : rawToken && typeof rawToken === 'object'
      ? String(rawToken.token || rawToken.fcmToken || rawToken.deviceToken || '').trim()
      : ''

  if (!token) {
    console.warn('[FCM Save] Missing token in payload:', Object.keys(body))
    return sendError(res, {
      message: 'Token is required and must be a valid non-empty string',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'MISSING_TOKEN',
    })
  }

  // Resolve user: from authenticated session, or explicit userId/phone in payload
  let userId = req.user?._id
  if (!userId && body.userId) {
    userId = body.userId
  }
  if (!userId && body.phone) {
    const cleanPhone = normalizeIndianPhone(body.phone) || String(body.phone).replace(/\D/g, '').slice(-10)
    const foundUser = await User.findOne({ phone: cleanPhone })
    if (foundUser) userId = foundUser._id
  }

  if (!userId) {
    console.warn('[FCM Save] No authenticated user or valid user identifier provided')
    return sendError(res, {
      message: 'Authentication required. Please log in or provide a valid userId/phone.',
      statusCode: HTTP_STATUS.UNAUTHORIZED,
      code: 'UNAUTHORIZED',
    })
  }

  const userAgent = String(req.headers['user-agent'] || '')
  const isMobileClient = platform === 'mobile' || platform === 'android' || /Android|Mobile|wv/i.test(userAgent)

  // If mobile or Android WebView, save into fcmTokenMobile so native Android push payload is dispatched
  const updateQuery = isMobileClient
    ? { $addToSet: { fcmTokenMobile: token, fcmTokens: token } }
    : { $addToSet: { fcmTokens: token } }

  // Atomically append token into array if not present
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    updateQuery,
    { new: true, select: 'phone role fcmTokens fcmTokenMobile' },
  )

  if (!updatedUser) {
    return sendError(res, { message: 'User not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  // Cap token list at 30 devices per user
  const tokens = Array.isArray(updatedUser[tokenField]) ? updatedUser[tokenField] : []
  if (tokens.length > 30) {
    const trimmed = tokens.slice(-30)
    await User.findByIdAndUpdate(userId, { $set: { [tokenField]: trimmed } })
  }

  console.log(`[FCM Save] Successfully saved ${platform} token for user ${updatedUser.phone || userId} (${updatedUser.role}). Total tokens: ${tokens.length}`)
  return sendSuccess(res, {
    message: 'FCM token saved successfully',
    data: {
      platform,
      totalTokens: Math.min(tokens.length, 30),
      tokenField,
    },
  })
})

export const removeToken = asyncHandler(async (req, res) => {
  const body = req.body || {}
  const platform = String(body.platform || 'web').toLowerCase()
  const rawToken = body.token

  const token =
    typeof rawToken === 'string'
      ? rawToken.trim()
      : rawToken && typeof rawToken.token === 'string'
      ? rawToken.token.trim()
      : ''

  if (!token) {
    return sendError(res, {
      message: 'Token is required and must be a valid non-empty string',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'MISSING_TOKEN',
    })
  }

  const userId = req.user?._id
  if (!userId) {
    return sendSuccess(res, { message: 'FCM token removed' })
  }

  const isWeb = platform === 'web'
  const tokenField = isWeb ? 'fcmTokens' : 'fcmTokenMobile'

  // Atomically pull token from array
  await User.findByIdAndUpdate(userId, {
    $pull: { [tokenField]: token },
  })

  console.log(`[FCM] Invalidation complete: token removed for device logout`)
  return sendSuccess(res, { message: 'FCM token removed' })
})

export const testNotification = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  
  // This will send to all tokens registered for this user
  const result = await sendNotificationToUser(userId, {
    title: 'A2Z Service Hub',
    body: '🔔 Push notification test! Your device is successfully linked to receive alerts outside the app.',
    data: {
      type: 'test',
      link: '/'
    }
  });

  if (!result || !result.success) {
    return sendError(res, {
      message: result?.noTokens
        ? 'No active device tokens found. Please grant notification permission in your browser.'
        : (result?.error || 'Failed to dispatch push notification through FCM'),
      statusCode: HTTP_STATUS.BAD_REQUEST,
      data: result,
    });
  }

  return sendSuccess(res, {
    message: `Test push notification successfully sent (${result.successCount} delivered)`,
    data: result
  });
});
