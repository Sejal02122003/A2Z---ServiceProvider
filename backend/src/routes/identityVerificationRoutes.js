import { Router } from 'express'
import { protect, restrictTo } from '../middleware/auth.js'
import { USER_ROLES } from '../constants/roles.js'
import {
  adminGetVerificationById,
  adminListAuditLogs,
  adminListVerifications,
  adminRestoreUser,
  adminReviewVerification,
  adminSuspendUser,
  appealIdentityDecision,
  getMyIdentityStatus,
  providerWebhookHandler,
  submitMyIdentity,
} from '../controllers/identityVerificationController.js'

export const identityUserRouter = Router()

// Public webhook
identityUserRouter.post('/webhook', providerWebhookHandler)

// User authenticated routes
identityUserRouter.get('/me', protect, getMyIdentityStatus)
identityUserRouter.post('/submit', protect, submitMyIdentity)
identityUserRouter.post('/appeal', protect, appealIdentityDecision)

export const identityAdminRouter = Router()

// Admin routes (all require protect & restrictTo(ADMIN))
identityAdminRouter.use(protect, restrictTo(USER_ROLES.ADMIN))
identityAdminRouter.get('/', adminListVerifications)
identityAdminRouter.get('/audit-logs', adminListAuditLogs)
identityAdminRouter.get('/:id', adminGetVerificationById)
identityAdminRouter.patch('/:id/decision', adminReviewVerification)
identityAdminRouter.post('/:id/suspend', adminSuspendUser)
identityAdminRouter.post('/:id/restore', adminRestoreUser)

export default identityUserRouter
