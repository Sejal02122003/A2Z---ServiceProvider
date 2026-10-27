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
  getCustomerPolicyStatusController,
  getAdminCustomerCancellationsController,
  getAdminCustomerHistoryController,
  adminRestrictCustomerController,
  adminUnrestrictCustomerController,
  recordAdminBouncePenaltyController,
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
// CUSTOMER CANCELLATION ENDPOINTS
// -------------------------------------------------------------
router.get(
  '/customer/policy-status',
  restrictTo(USER_ROLES.CUSTOMER, USER_ROLES.CONTRACTOR),
  getCustomerPolicyStatusController
)
router.get(
  '/customer/bookings/:bookingId/eligibility',
  restrictTo(USER_ROLES.CUSTOMER, USER_ROLES.CONTRACTOR),
  async (req, res, next) => {
    const { getCustomerCancellationEligibilityController } = await import('../controllers/bookingController.js')
    req.params.id = req.params.bookingId
    return getCustomerCancellationEligibilityController(req, res, next)
  }
)
router.post(
  '/customer/bookings/:bookingId/cancel',
  restrictTo(USER_ROLES.CUSTOMER, USER_ROLES.CONTRACTOR),
  async (req, res, next) => {
    const { cancelCustomerBooking } = await import('../controllers/bookingController.js')
    req.params.id = req.params.bookingId
    return cancelCustomerBooking(req, res, next)
  }
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
router.get('/admin/customer-cancellations', getAdminCustomerCancellationsController)
router.get('/admin/customers/:id/history', getAdminCustomerHistoryController)
router.post('/admin/customers/:id/restrict', adminRestrictCustomerController)
router.post('/admin/customers/:id/unrestrict', adminUnrestrictCustomerController)
router.post('/admin/bookings/:bookingId/bounce', recordAdminBouncePenaltyController)

export default router
