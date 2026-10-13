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
  const { token, platform = 'web' } = req.body
  if (!token) {
    return sendError(res, {
      message: 'Token is required',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'MISSING_TOKEN',
    })
  }

  const userId = req.user._id
  const user = await User.findById(userId)
  if (!user) {
    return sendError(res, { message: 'User not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  if (platform === 'web') {
    if (!user.fcmTokens) user.fcmTokens = []
    if (!user.fcmTokens.includes(token)) {
      user.fcmTokens.push(token)
      if (user.fcmTokens.length > 10) user.fcmTokens = user.fcmTokens.slice(-10)
    }
  } else {
    if (!user.fcmTokenMobile) user.fcmTokenMobile = []
    if (!user.fcmTokenMobile.includes(token)) {
      user.fcmTokenMobile.push(token)
      if (user.fcmTokenMobile.length > 10) user.fcmTokenMobile = user.fcmTokenMobile.slice(-10)
    }
  }

  await user.save()
  return sendSuccess(res, { message: 'FCM token registered successfully' })
})

/**
 * POST /api/v1/notifications/remove-token
 * De-register FCM token on logout
 */
export const removeFcmToken = asyncHandler(async (req, res) => {
  const { token, platform = 'web' } = req.body
  if (!token) {
    return sendError(res, {
      message: 'Token is required',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'MISSING_TOKEN',
    })
  }

  const userId = req.user._id
  const user = await User.findById(userId)
  if (!user) {
    return sendError(res, { message: 'User not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  if (platform === 'web' && user.fcmTokens) {
    user.fcmTokens = user.fcmTokens.filter((t) => t !== token)
  } else if (platform === 'mobile' && user.fcmTokenMobile) {
    user.fcmTokenMobile = user.fcmTokenMobile.filter((t) => t !== token)
  }

  await user.save()
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
