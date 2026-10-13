import { Router } from 'express'
import { protect } from '../middleware/auth.js'
import * as notificationController from '../controllers/notificationController.js'
import * as fcmTokenController from '../controllers/fcmTokenController.js'

const router = Router()

router.use(protect)

// In-app notifications feed & operations
router.get('/', notificationController.getMyNotifications)
router.get('/unread-count', notificationController.getUnreadNotificationCount)
router.patch('/:id/read', notificationController.markNotificationRead)
router.post('/read-all', notificationController.markAllNotificationsRead)

// FCM Device Token management
router.post('/token', notificationController.saveFcmToken)
router.post('/remove-token', notificationController.removeFcmToken)
router.post('/test', fcmTokenController.testNotification)

export default router

