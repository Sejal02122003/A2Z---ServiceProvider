import { Router } from 'express'
import { protect, optionalAuth } from '../middleware/auth.js'
import * as notificationController from '../controllers/notificationController.js'
import * as fcmTokenController from '../controllers/fcmTokenController.js'

const router = Router()

// FCM Device Token management (supports Bearer auth or userId/phone in payload)
router.post('/token', optionalAuth, notificationController.saveFcmToken)
router.post('/remove-token', optionalAuth, notificationController.removeFcmToken)

// In-app notifications feed & operations (Strict user session required)
router.use(protect)

router.get('/', notificationController.getMyNotifications)
router.get('/unread-count', notificationController.getUnreadNotificationCount)
router.patch('/:id/read', notificationController.markNotificationRead)
router.post('/read-all', notificationController.markAllNotificationsRead)
router.delete('/:id', notificationController.deleteNotification)
router.delete('/', notificationController.clearAllNotifications)
router.post('/test', fcmTokenController.testNotification)

export default router

