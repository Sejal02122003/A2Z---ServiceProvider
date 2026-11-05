import { Router } from 'express'
import { protect, restrictTo } from '../middleware/auth.js'
import { USER_ROLES } from '../constants/roles.js'
import * as controller from '../controllers/providerWalletEligibilityController.js'

const router = Router()

router.use(protect, restrictTo(USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR))

router.get('/eligibility', controller.getMyEligibility)
router.get('/eligibility/check', controller.checkBookingEligibility)

export default router
