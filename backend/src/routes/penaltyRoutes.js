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
import { authenticateToken, requireAdmin } from '../middleware/auth.js'

const router = express.Router()

// All routes require authentication
router.use(authenticateToken)

// -------------------------------------------------------------
// VENDOR / PARTNER ROUTES
// -------------------------------------------------------------
router.get('/vendor/my-penalties', getVendorPenalties)
router.get('/vendor/my-penalties/:id', getVendorPenaltyById)
router.post('/vendor/my-penalties/:id/dispute', submitVendorDispute)

// -------------------------------------------------------------
// ADMIN ROUTES (Protected by requireAdmin)
// -------------------------------------------------------------
router.use('/admin', requireAdmin)

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
