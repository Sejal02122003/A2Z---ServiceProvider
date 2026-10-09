import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { BookingReminder, REMINDER_STATUS } from '../models/BookingReminder.js'
import { InAppNotification } from '../models/InAppNotification.js'
import {
  getReminderSettings,
  updateReminderSettings,
  getReminderOverviewStats,
  retryReminderManually,
  processDueReminders,
} from '../services/bookingReminderService.js'

/**
 * =========================================================================
 * ADMIN CONTROLLERS
 * =========================================================================
 */

// @desc    Get Master Reminder Configuration Settings
// @route   GET /api/v1/reminders/admin/settings
// @access  Private (Admin)
export const getSettings = asyncHandler(async (req, res) => {
  const settings = await getReminderSettings()
  return sendSuccess(res, { data: { settings } })
})

// @desc    Update Master Reminder Configuration Settings
// @route   PATCH /api/v1/reminders/admin/settings
// @access  Private (Admin)
export const updateSettings = asyncHandler(async (req, res) => {
  const settings = await updateReminderSettings(req.body, req.user)
  return sendSuccess(res, {
    message: 'Reminder configuration updated successfully',
    data: { settings },
  })
})

// @desc    Get Reminder Overview Dashboard Statistics
// @route   GET /api/v1/reminders/admin/overview
// @access  Private (Admin)
export const getOverview = asyncHandler(async (req, res) => {
  const stats = await getReminderOverviewStats()
  return sendSuccess(res, { data: { stats } })
})

// @desc    Get List of Upcoming / Pending Reminders
// @route   GET /api/v1/reminders/admin/upcoming
// @access  Private (Admin)
export const getUpcomingReminders = asyncHandler(async (req, res) => {
  const { page = 1, limit = 15, recipientRole, reminderType, search } = req.query
  const skip = (Number(page) - 1) * Number(limit)

  const query = {
    status: { $in: [REMINDER_STATUS.PENDING, REMINDER_STATUS.PROCESSING] },
  }

  if (recipientRole && recipientRole !== 'ALL') {
    query.recipientRole = recipientRole
  }
  if (reminderType && reminderType !== 'ALL') {
    query.reminderType = reminderType
  }

  if (search) {
    const s = String(search).trim()
    query.$or = [
      { 'metadata.customerName': { $regex: s, $options: 'i' } },
      { 'metadata.vendorName': { $regex: s, $options: 'i' } },
      { 'metadata.serviceName': { $regex: s, $options: 'i' } },
      { dedupeKey: { $regex: s, $options: 'i' } },
    ]
  }

  const total = await BookingReminder.countDocuments(query)
  const reminders = await BookingReminder.find(query)
    .populate('bookingId', 'status type scheduledAt timeSlot address totalAmount')
    .populate('recipientId', 'fullName phone email role profileImageUrl')
    .sort({ scheduledAt: 1 })
    .skip(skip)
    .limit(Number(limit))
    .lean()

  return sendSuccess(res, {
    data: {
      reminders,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)) || 1,
      },
    },
  })
})

// @desc    Get Full Reminder History / Audit Log
// @route   GET /api/v1/reminders/admin/history
// @access  Private (Admin)
export const getReminderHistory = asyncHandler(async (req, res) => {
  const { page = 1, limit = 15, status, recipientRole, reminderType, search } = req.query
  const skip = (Number(page) - 1) * Number(limit)

  const query = {}

  if (status && status !== 'ALL') {
    query.status = status
  }
  if (recipientRole && recipientRole !== 'ALL') {
    query.recipientRole = recipientRole
  }
  if (reminderType && reminderType !== 'ALL') {
    query.reminderType = reminderType
  }

  if (search) {
    const s = String(search).trim()
    query.$or = [
      { 'metadata.customerName': { $regex: s, $options: 'i' } },
      { 'metadata.vendorName': { $regex: s, $options: 'i' } },
      { 'metadata.serviceName': { $regex: s, $options: 'i' } },
      { lastError: { $regex: s, $options: 'i' } },
    ]
  }

  const total = await BookingReminder.countDocuments(query)
  const reminders = await BookingReminder.find(query)
    .populate('bookingId', 'status type scheduledAt timeSlot address totalAmount')
    .populate('recipientId', 'fullName phone email role profileImageUrl')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean()

  return sendSuccess(res, {
    data: {
      reminders,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)) || 1,
      },
    },
  })
})

// @desc    Manually retry an eligible failed reminder
// @route   POST /api/v1/reminders/admin/retry/:id
// @access  Private (Admin)
export const retryReminder = asyncHandler(async (req, res) => {
  const { id } = req.params
  const result = await retryReminderManually(id, req.user)
  return sendSuccess(res, {
    message: 'Reminder retry executed successfully',
    data: { result },
  })
})

// @desc    Trigger an on-demand worker cycle to process all due reminders immediately
// @route   POST /api/v1/reminders/admin/trigger-cycle
// @access  Private (Admin)
export const triggerWorkerCycle = asyncHandler(async (req, res) => {
  const result = await processDueReminders()
  return sendSuccess(res, {
    message: `Worker cycle executed: ${result.processed} processed, ${result.sent} sent, ${result.failed} failed`,
    data: { result },
  })
})

/**
 * =========================================================================
 * RECIPIENT IN-APP NOTIFICATION CONTROLLERS
 * =========================================================================
 */

// @desc    Get Current Authenticated User's In-App Notifications
// @route   GET /api/v1/reminders/my-notifications
// @access  Private (Customer / Labour / Contractor)
export const getMyNotifications = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, unreadOnly = false } = req.query
  const userId = req.user._id
  const skip = (Number(page) - 1) * Number(limit)

  const query = { userId }
  if (String(unreadOnly) === 'true') {
    query.read = false
  }

  const [total, unreadCount, notifications] = await Promise.all([
    InAppNotification.countDocuments(query),
    InAppNotification.countDocuments({ userId, read: false }),
    InAppNotification.find(query)
      .populate('bookingId', 'status scheduledAt timeSlot address type')
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

// @desc    Mark a single in-app notification as read
// @route   PATCH /api/v1/reminders/my-notifications/:id/read
// @access  Private (Customer / Labour / Contractor)
export const markNotificationRead = asyncHandler(async (req, res) => {
  const { id } = req.params
  const userId = req.user._id

  const notification = await InAppNotification.findOneAndUpdate(
    { _id: id, userId },
    { $set: { read: true, readAt: new Date() } },
    { new: true }
  )

  if (!notification) {
    return sendError(res, { message: 'Notification not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  return sendSuccess(res, { data: { notification } })
})

// @desc    Mark all in-app notifications as read
// @route   POST /api/v1/reminders/my-notifications/read-all
// @access  Private (Customer / Labour / Contractor)
export const markAllNotificationsRead = asyncHandler(async (req, res) => {
  const userId = req.user._id

  await InAppNotification.updateMany(
    { userId, read: false },
    { $set: { read: true, readAt: new Date() } }
  )

  return sendSuccess(res, { message: 'All notifications marked as read' })
})
