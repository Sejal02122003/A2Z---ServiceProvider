import { Router } from 'express'
import { protect, restrictTo } from '../middleware/auth.js'
import { USER_ROLES } from '../constants/roles.js'
import {
  getAdminOverview,
  getAdminCampaigns,
  createAdminCampaign,
  getAdminCampaignById,
  updateAdminCampaign,
  activateAdminCampaign,
  pauseAdminCampaign,
  endAdminCampaign,
  evaluateAdminCampaign,
  getAdminPendingApprovals,
  approveAdminReward,
  rejectAdminReward,
  reverseAdminReward,
  getAdminVendorProgress,
  getAdminRewardTransactions,
  getAdminRewardReports,
  getAdminRewardSettings,
  updateAdminRewardSettings,
  triggerManualReconciliation,
  getVendorRewardsHub,
} from '../controllers/rewardController.js'

const router = Router()

// ==================== VENDOR ROUTES ====================
router.get(
  '/vendor/rewards/overview',
  protect,
  restrictTo(USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR),
  getVendorRewardsHub
)
router.get(
  '/vendor/rewards',
  protect,
  restrictTo(USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR),
  getVendorRewardsHub
)

// ==================== ADMIN ROUTES ====================
router.get('/admin/rewards/overview', protect, restrictTo(USER_ROLES.ADMIN), getAdminOverview)
router.get('/admin/rewards/campaigns', protect, restrictTo(USER_ROLES.ADMIN), getAdminCampaigns)
router.post('/admin/rewards/campaigns', protect, restrictTo(USER_ROLES.ADMIN), createAdminCampaign)
router.get('/admin/rewards/campaigns/:id', protect, restrictTo(USER_ROLES.ADMIN), getAdminCampaignById)
router.patch('/admin/rewards/campaigns/:id', protect, restrictTo(USER_ROLES.ADMIN), updateAdminCampaign)
router.post('/admin/rewards/campaigns/:id/activate', protect, restrictTo(USER_ROLES.ADMIN), activateAdminCampaign)
router.post('/admin/rewards/campaigns/:id/pause', protect, restrictTo(USER_ROLES.ADMIN), pauseAdminCampaign)
router.post('/admin/rewards/campaigns/:id/end', protect, restrictTo(USER_ROLES.ADMIN), endAdminCampaign)
router.post('/admin/rewards/campaigns/:id/evaluate', protect, restrictTo(USER_ROLES.ADMIN), evaluateAdminCampaign)

router.get('/admin/rewards/pending', protect, restrictTo(USER_ROLES.ADMIN), getAdminPendingApprovals)
router.post('/admin/rewards/:id/approve', protect, restrictTo(USER_ROLES.ADMIN), approveAdminReward)
router.post('/admin/rewards/:id/reject', protect, restrictTo(USER_ROLES.ADMIN), rejectAdminReward)
router.post('/admin/rewards/:id/reverse', protect, restrictTo(USER_ROLES.ADMIN), reverseAdminReward)

router.get('/admin/rewards/vendors', protect, restrictTo(USER_ROLES.ADMIN), getAdminVendorProgress)
router.get('/admin/rewards/transactions', protect, restrictTo(USER_ROLES.ADMIN), getAdminRewardTransactions)
router.get('/admin/rewards/reports', protect, restrictTo(USER_ROLES.ADMIN), getAdminRewardReports)

router.get('/admin/rewards/settings', protect, restrictTo(USER_ROLES.ADMIN), getAdminRewardSettings)
router.put('/admin/rewards/settings', protect, restrictTo(USER_ROLES.ADMIN), updateAdminRewardSettings)
router.post('/admin/rewards/reconcile-now', protect, restrictTo(USER_ROLES.ADMIN), triggerManualReconciliation)

export default router
