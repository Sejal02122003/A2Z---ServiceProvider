import express from 'express'
import {
  getAdminSettings,
  updateAdminSettings,
  getAdminOverview,
  getAdminPenalties,
  getAdminPenaltyById,
  approvePenaltyController,
  rejectPenaltyController,
  waivePenaltyController,
  reviewDisputeController,
  reverseDeductionController,
  getVendorPenalties,
  getVendorPenaltyById,
  submitVendorDispute,
} from '../controllers/penaltyController.js'
import { protect, restrictTo } from '../middleware/auth.js'
import { USER_ROLES } from '../constants/roles.js'

const router = express.Router()

// All routes require authentication
router.use(protect)

// -------------------------------------------------------------
// VENDOR / PARTNER ROUTES
// -------------------------------------------------------------
router.get('/vendor/my-penalties', restrictTo(USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR), getVendorPenalties)
router.get('/vendor/my-penalties/:id', restrictTo(USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR), getVendorPenaltyById)
router.post('/vendor/my-penalties/:id/dispute', restrictTo(USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR), submitVendorDispute)

// -------------------------------------------------------------
// ADMIN ROUTES (Protected by restrictTo ADMIN)
// -------------------------------------------------------------
router.use('/admin', restrictTo(USER_ROLES.ADMIN))

router.get('/admin/overview', getAdminOverview)
router.get('/admin/settings', getAdminSettings)
router.put('/admin/settings', updateAdminSettings)
router.get('/admin/penalties', getAdminPenalties)
router.get('/admin/penalties/:id', getAdminPenaltyById)
router.post('/admin/penalties/:id/approve', approvePenaltyController)
router.post('/admin/penalties/:id/reject', rejectPenaltyController)
router.post('/admin/penalties/:id/waive', waivePenaltyController)
router.post('/admin/penalties/:id/review-dispute', reviewDisputeController)
router.post('/admin/penalties/:id/reverse', reverseDeductionController)

export default router
