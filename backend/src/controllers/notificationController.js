import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { InAppNotification } from '../models/InAppNotification.js'
import { User } from '../models/User.js'
import { sendNotificationToUser } from '../utils/pushNotificationHelper.js'

/**
 * GET /api/v1/notifications
 * Fetch authenticated user's notifications (Customer, Labour, Contractor)
 * Query params: page, limit, unreadOnly, type
 */
export const getMyNotifications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, unreadOnly = false, type } = req.query
  const userId = req.user._id
  const skip = (Math.max(1, Number(page)) - 1) * Math.max(1, Number(limit))

  const query = { userId }
  if (String(unreadOnly) === 'true') {
    query.read = false
  }
  if (type) {
    query.type = type
  }

  const [total, unreadCount, notifications] = await Promise.all([
    InAppNotification.countDocuments(query),
    InAppNotification.countDocuments({ userId, read: false }),
    InAppNotification.find(query)
      .populate('bookingId', 'status scheduledAt timeSlot date address type')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
  ])

  return sendSuccess(res, {
    data: {
      notifications,
      unreadCount,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)) || 1,
      },
    },
  })
})

/**
 * GET /api/v1/notifications/unread-count
 * Returns total unread notification count for the authenticated user
 */
export const getUnreadNotificationCount = asyncHandler(async (req, res) => {
  const userId = req.user._id
  const unreadCount = await InAppNotification.countDocuments({ userId, read: false })
  return sendSuccess(res, { data: { unreadCount } })
})

/**
 * PATCH /api/v1/notifications/:id/read
 * Mark a single in-app notification as read (Strict recipient ownership)
 */
export const markNotificationRead = asyncHandler(async (req, res) => {
  const { id } = req.params
  const userId = req.user._id

  const notification = await InAppNotification.findOneAndUpdate(
    { _id: id, userId },
    { $set: { read: true, readAt: new Date() } },
    { new: true }
  )

  if (!notification) {
    return sendError(res, {
      message: 'Notification not found or access denied',
      statusCode: HTTP_STATUS.NOT_FOUND,
    })
  }

  return sendSuccess(res, { data: { notification } })
})

/**
 * POST /api/v1/notifications/read-all
 * Mark all notifications for the authenticated user as read
 */
export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  const userId = req.user._id

  await InAppNotification.updateMany(
    { userId, read: false },
    { $set: { read: true, readAt: new Date() } }
  )

  return sendSuccess(res, { message: 'All notifications marked as read' })
})

/**
 * POST /api/v1/notifications/token
 * Save FCM registration token for Web or Mobile
 */
export const saveFcmToken = asyncHandler(async (req, res) => {
  const body = req.body || {}
  const platform = String(body.platform || 'web').toLowerCase()
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
    return sendError(res, {
      message: 'Token is required and must be a valid non-empty string',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'MISSING_TOKEN',
    })
  }

  let userId = req.user?._id
  if (!userId && body.userId) {
    userId = body.userId
  }
  if (!userId && body.phone) {
    const { normalizeIndianPhone } = await import('../utils/phone.js')
    const cleanPhone = normalizeIndianPhone(body.phone) || String(body.phone).replace(/\D/g, '').slice(-10)
    const foundUser = await User.findOne({ phone: cleanPhone })
    if (foundUser) userId = foundUser._id
  }

  if (!userId) {
    return sendError(res, { message: 'Authentication required. Please log in or provide userId/phone.', statusCode: HTTP_STATUS.UNAUTHORIZED })
  }

  const isWeb = platform === 'web'
  const tokenField = isWeb ? 'fcmTokens' : 'fcmTokenMobile'

  const updatedUser = await User.findByIdAndUpdate(
    userId,
    { $addToSet: { [tokenField]: token } },
    { new: true, select: `phone role ${tokenField}` },
  )

  if (!updatedUser) {
    return sendError(res, { message: 'User not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  const tokens = Array.isArray(updatedUser[tokenField]) ? updatedUser[tokenField] : []
  if (tokens.length > 30) {
    const trimmed = tokens.slice(-30)
    await User.findByIdAndUpdate(userId, { $set: { [tokenField]: trimmed } })
  }

  console.log(`[FCM Notification Save] Saved ${platform} token for user ${updatedUser.phone || userId}`)
  return sendSuccess(res, { message: 'FCM token registered successfully' })
})

/**
 * POST /api/v1/notifications/remove-token
 * De-register FCM token on logout
 */
export const removeFcmToken = asyncHandler(async (req, res) => {
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
    return sendSuccess(res, { message: 'FCM token removed successfully' })
  }

  const isWeb = platform === 'web'
  const tokenField = isWeb ? 'fcmTokens' : 'fcmTokenMobile'

  await User.findByIdAndUpdate(userId, {
    $pull: { [tokenField]: token },
  })

  return sendSuccess(res, { message: 'FCM token removed successfully' })
})

/**
 * DELETE /api/v1/notifications/:id
 * Remove a single notification for the authenticated user
 */
export const deleteNotification = asyncHandler(async (req, res) => {
  const { id } = req.params
  const userId = req.user._id

  const notification = await InAppNotification.findOneAndDelete({ _id: id, userId })

  if (!notification) {
    return sendError(res, {
      message: 'Notification not found or access denied',
      statusCode: HTTP_STATUS.NOT_FOUND,
    })
  }

  return sendSuccess(res, { message: 'Notification removed successfully' })
})

/**
 * DELETE /api/v1/notifications
 * Clear all notifications (or read-only notifications) for the authenticated user
 * Query params: readOnly (boolean)
 */
export const clearAllNotifications = asyncHandler(async (req, res) => {
  const { readOnly = false } = req.query
  const userId = req.user._id

  const query = { userId }
  if (String(readOnly) === 'true') {
    query.read = true
  }

  const result = await InAppNotification.deleteMany(query)

  return sendSuccess(res, {
    message: 'Notifications cleared successfully',
    data: { deletedCount: result.deletedCount },
  })
})
