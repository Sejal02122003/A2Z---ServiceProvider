import { Router } from 'express'
import { protect, optionalAuth } from '../middleware/auth.js'
import * as fcmTokenController from '../controllers/fcmTokenController.js'

const router = Router()

// Saving and removing tokens can accept Bearer auth OR explicit userId/phone in payload
router.post('/save', optionalAuth, fcmTokenController.saveToken)
router.post('/mobile/save', optionalAuth, fcmTokenController.saveToken)
router.delete('/remove', optionalAuth, fcmTokenController.removeToken)

// Test dispatch requires full authentication
router.post('/test', protect, fcmTokenController.testNotification)

export default router
