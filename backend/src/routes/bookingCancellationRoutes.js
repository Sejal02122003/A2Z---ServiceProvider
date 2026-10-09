import express from 'express'
import {
  getAdminSettings,
  updateAdminSettings,
  getAdminOverview,
  getAdminRecords,
  getAdminRecordById,
  approveCancellationRequestController,
  rejectCancellationRequestController,
  waivePenaltyController,
  getVendorEligibility,
  submitVendorCancellation,
} from '../controllers/bookingCancellationController.js'
import { protect, restrictTo } from '../middleware/auth.js'
import { USER_ROLES } from '../constants/roles.js'

const router = express.Router()

router.use(protect)

// -------------------------------------------------------------
// VENDOR / PARTNER CANCELLATION ENDPOINTS
// -------------------------------------------------------------
router.get(
  '/vendor/bookings/:bookingId/eligibility',
  restrictTo(USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR),
  getVendorEligibility
)
router.post(
  '/vendor/bookings/:bookingId/cancel',
  restrictTo(USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR),
  submitVendorCancellation
)

// -------------------------------------------------------------
// ADMIN MANAGEMENT ENDPOINTS
// -------------------------------------------------------------
router.use('/admin', restrictTo(USER_ROLES.ADMIN))

router.get('/admin/overview', getAdminOverview)
router.get('/admin/settings', getAdminSettings)
router.put('/admin/settings', updateAdminSettings)
router.get('/admin/records', getAdminRecords)
router.get('/admin/records/:id', getAdminRecordById)
router.post('/admin/records/:id/approve', approveCancellationRequestController)
router.post('/admin/records/:id/reject', rejectCancellationRequestController)
router.post('/admin/records/:id/waive', waivePenaltyController)

export default router
