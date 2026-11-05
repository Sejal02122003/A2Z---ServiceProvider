import { Router } from 'express'
import { protect, restrictTo } from '../middleware/auth.js'
import { USER_ROLES } from '../constants/roles.js'
import * as controller from '../controllers/adminWalletEligibilityController.js'

const router = Router()

router.use(protect, restrictTo(USER_ROLES.ADMIN))

router.get('/settings', controller.getSettings)
router.put('/settings', controller.updateSettings)
router.get('/providers', controller.getProvidersReport)
router.get('/transactions', controller.getEligibilityTransactions)

export default router
