import { Router } from 'express'
import { protect, restrictTo } from '../middleware/auth.js'
import { USER_ROLES } from '../constants/roles.js'
import * as reminderController from '../controllers/bookingReminderController.js'

const router = Router()

// All routes require authentication
router.use(protect)

/**
 * Recipient in-app notification routes
 */
router.get('/my-notifications', reminderController.getMyNotifications)
router.patch('/my-notifications/:id/read', reminderController.markNotificationRead)
router.post('/my-notifications/read-all', reminderController.markAllNotificationsRead)

/**
 * Admin management routes (Restricted to ADMIN role)
 */
router.use('/admin', restrictTo(USER_ROLES.ADMIN))

router.get('/admin/overview', reminderController.getOverview)
router.get('/admin/settings', reminderController.getSettings)
router.patch('/admin/settings', reminderController.updateSettings)
router.get('/admin/upcoming', reminderController.getUpcomingReminders)
router.get('/admin/history', reminderController.getReminderHistory)
router.post('/admin/retry/:id', reminderController.retryReminder)
router.post('/admin/trigger-cycle', reminderController.triggerWorkerCycle)

export default router
