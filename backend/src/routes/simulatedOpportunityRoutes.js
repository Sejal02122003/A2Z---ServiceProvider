import { Router } from 'express'
import { protect, restrictTo } from '../middleware/auth.js'
import { USER_ROLES } from '../constants/roles.js'
import {
  getSimulatedSettings,
  updateSimulatedSettings,
  createSimulatedOpportunity,
  getAdminSimulatedOpportunities,
  getAdminSimulatedOpportunityById,
  cancelSimulatedOpportunity,
  getVendorSimulatedOpportunities,
  getVendorSimulatedOpportunityById,
  acceptSimulatedOpportunity,
  rejectSimulatedOpportunity,
} from '../controllers/simulatedOpportunityController.js'

const router = Router()

// --- ADMIN ROUTES ---
router.get(
  '/admin/settings',
  protect,
  restrictTo(USER_ROLES.ADMIN),
  getSimulatedSettings
)

router.patch(
  '/admin/settings',
  protect,
  restrictTo(USER_ROLES.ADMIN),
  updateSimulatedSettings
)

router.post(
  '/admin',
  protect,
  restrictTo(USER_ROLES.ADMIN),
  createSimulatedOpportunity
)

router.get(
  '/admin',
  protect,
  restrictTo(USER_ROLES.ADMIN),
  getAdminSimulatedOpportunities
)

router.get(
  '/admin/:id',
  protect,
  restrictTo(USER_ROLES.ADMIN),
  getAdminSimulatedOpportunityById
)

router.patch(
  '/admin/:id/cancel',
  protect,
  restrictTo(USER_ROLES.ADMIN),
  cancelSimulatedOpportunity
)

// --- VENDOR / WORKFORCE ROUTES ---
router.get(
  '/vendor',
  protect,
  restrictTo(USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR),
  getVendorSimulatedOpportunities
)

router.get(
  '/vendor/:id',
  protect,
  restrictTo(USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR),
  getVendorSimulatedOpportunityById
)

router.post(
  '/vendor/:id/accept',
  protect,
  restrictTo(USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR),
  acceptSimulatedOpportunity
)

router.post(
  '/vendor/:id/reject',
  protect,
  restrictTo(USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR),
  rejectSimulatedOpportunity
)

export default router
