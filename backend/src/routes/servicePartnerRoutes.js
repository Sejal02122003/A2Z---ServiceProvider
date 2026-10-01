import { Router } from 'express'
import { body, param } from 'express-validator'
import { protect, restrictTo } from '../middleware/auth.js'
import { validateRequest } from '../middleware/validateRequest.js'
import * as user from '../controllers/userController.js'
import { USER_ROLES } from '../constants/roles.js'

const router = Router()

router.use(protect)
router.use(restrictTo(USER_ROLES.ADMIN))

/**
 * GET /api/service-partners/welcome-kit-stats
 */
router.get('/welcome-kit-stats', user.getPartnerWelcomeKitStats)

/**
 * PATCH /api/service-partners/:partnerId/welcome-kit
 */
router.patch(
  '/:partnerId/welcome-kit',
  [
    param('partnerId').isMongoId().withMessage('partnerId must be a valid MongoDB ObjectId'),
    body('uniformIssued').isBoolean().withMessage('uniformIssued must be a boolean (true or false)'),
    body('idCardIssued').isBoolean().withMessage('idCardIssued must be a boolean (true or false)'),
    body('bagIssued').isBoolean().withMessage('bagIssued must be a boolean (true or false)'),
  ],
  validateRequest,
  user.updatePartnerWelcomeKit,
)

export default router
