import { Router } from 'express'
import { protect, restrictTo } from '../middleware/auth.js'
import { USER_ROLES } from '../constants/roles.js'
import * as broadcast from '../controllers/broadcastController.js'

const router = Router()

router.use(protect)

// Only Labourers/Contractors can interact with broadcasts directly
router.get(
  '/active',
  restrictTo(USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR),
  broadcast.getActiveBroadcast,
)

router.post(
  '/:bookingId/accept',
  restrictTo(USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR),
  broadcast.acceptBroadcast,
)

router.post(
  '/:bookingId/reject',
  restrictTo(USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR),
  broadcast.rejectBroadcast,
)

export default router
