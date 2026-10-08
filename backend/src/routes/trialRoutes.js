import { Router } from 'express'
import { protect, restrictTo } from '../middleware/auth.js'
import { USER_ROLES } from '../constants/roles.js'
import {
  getAdminTrialSettings,
  updateAdminTrialSettings,
  getAdminTrialDashboardStats,
  getAdminVendorTrials,
  getAdminPendingConfirmations,
  getAdminVendorTrialDetail,
  adminConfirmVendor,
  adminRejectVendor,
  adminBlockVendor,
  adminUnblockVendor,
  adminPauseTrial,
  adminResumeTrial,
  adminExtendTrial,
  adminRequestReview,
  adminWaivePenalty,
  adminMigrateVendors,
  getVendorMyTrial,
  getVendorTrialHistory,
  vendorRequestFinalChance,
  vendorVerifyPenaltyPayment,
} from '../controllers/trialController.js'

const router = Router()

// ==================== VENDOR ROUTES ====================
router.get('/vendor/trial', protect, restrictTo(USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR), getVendorMyTrial)
router.get('/vendor/trial/history', protect, restrictTo(USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR), getVendorTrialHistory)
router.post('/vendor/trial/final-chance/request', protect, restrictTo(USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR), vendorRequestFinalChance)
router.post('/vendor/trial/final-chance/verify-payment', protect, restrictTo(USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR), vendorVerifyPenaltyPayment)

// ==================== ADMIN ROUTES ====================
router.get('/admin/trial-settings', protect, restrictTo(USER_ROLES.ADMIN), getAdminTrialSettings)
router.put('/admin/trial-settings', protect, restrictTo(USER_ROLES.ADMIN), updateAdminTrialSettings)

router.get('/admin/vendor-trials/stats', protect, restrictTo(USER_ROLES.ADMIN), getAdminTrialDashboardStats)
router.get('/admin/vendor-trials/pending-confirmations', protect, restrictTo(USER_ROLES.ADMIN), getAdminPendingConfirmations)
router.get('/admin/vendor-trials', protect, restrictTo(USER_ROLES.ADMIN), getAdminVendorTrials)
router.get('/admin/vendor-trials/:vendorId', protect, restrictTo(USER_ROLES.ADMIN), getAdminVendorTrialDetail)

router.post('/admin/vendor-trials/:vendorId/confirm', protect, restrictTo(USER_ROLES.ADMIN), adminConfirmVendor)
router.post('/admin/vendor-trials/:vendorId/reject', protect, restrictTo(USER_ROLES.ADMIN), adminRejectVendor)
router.post('/admin/vendor-trials/:vendorId/block', protect, restrictTo(USER_ROLES.ADMIN), adminBlockVendor)
router.post('/admin/vendor-trials/:vendorId/unblock', protect, restrictTo(USER_ROLES.ADMIN), adminUnblockVendor)
router.post('/admin/vendor-trials/:vendorId/pause', protect, restrictTo(USER_ROLES.ADMIN), adminPauseTrial)
router.post('/admin/vendor-trials/:vendorId/resume', protect, restrictTo(USER_ROLES.ADMIN), adminResumeTrial)
router.post('/admin/vendor-trials/:vendorId/extend', protect, restrictTo(USER_ROLES.ADMIN), adminExtendTrial)
router.post('/admin/vendor-trials/:vendorId/request-review', protect, restrictTo(USER_ROLES.ADMIN), adminRequestReview)
router.post('/admin/vendor-trials/:vendorId/waive-penalty', protect, restrictTo(USER_ROLES.ADMIN), adminWaivePenalty)
router.post('/admin/vendor-trials/migrate-existing', protect, restrictTo(USER_ROLES.ADMIN), adminMigrateVendors)

export default router
