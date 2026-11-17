import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess, sendError, HTTP_STATUS } from '../utils/apiResponse.js'
import { User } from '../models/User.js'
import { sendNotificationToUser } from '../utils/pushNotificationHelper.js'

export const saveToken = asyncHandler(async (req, res) => {
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
    return sendError(res, { message: 'Authentication required', statusCode: HTTP_STATUS.UNAUTHORIZED })
  }

  const isWeb = platform === 'web'
  const tokenField = isWeb ? 'fcmTokens' : 'fcmTokenMobile'

  // Atomically append token into array if not present (prevents VersionError and full document validation failures)
  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $addToSet: { [tokenField]: token } },
    { new: true, select: `phone role ${tokenField}` },
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

  console.log(`[FCM] Successfully linked ${platform} token to user ${updatedUser.phone || userId} (${updatedUser.role})`)
  return sendSuccess(res, {
    message: 'FCM token saved',
    totalTokens: Math.min(tokens.length, 30),
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
