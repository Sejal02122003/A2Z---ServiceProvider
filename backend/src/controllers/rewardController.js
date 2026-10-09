import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess } from '../utils/apiResponse.js'
import {
  getRewardSettings,
  updateRewardSettings,
  createRewardCampaign,
  updateRewardCampaign,
  activateRewardCampaign,
  pauseRewardCampaign,
  endRewardCampaign,
  getAdminRewardOverviewStats,
  approveVendorReward,
  rejectVendorReward,
  reverseVendorReward,
  reconcileAllActiveCampaigns,
  getVendorRewardsOverview,
  evaluateVendorCampaign,
} from '../services/rewardEvaluationService.js'
import { RewardCampaign, CAMPAIGN_STATUS } from '../models/RewardCampaign.js'
import { VendorReward, VENDOR_REWARD_STATUS } from '../models/VendorReward.js'
import { RewardAuditLog } from '../models/RewardAuditLog.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
import { User } from '../models/User.js'
import { USER_ROLES } from '../constants/roles.js'

// ==================== ADMIN CONTROLLERS ====================

/**
 * GET /api/v1/admin/rewards/overview
 */
export const getAdminOverview = asyncHandler(async (req, res) => {
  const stats = await getAdminRewardOverviewStats()
  return sendSuccess(res, { data: stats })
})

/**
 * GET /api/v1/admin/rewards/campaigns
 */
export const getAdminCampaigns = asyncHandler(async (req, res) => {
  const { category, status, search, page = 1, limit = 20 } = req.query

  const query = {}
  if (category && category !== 'ALL') query.category = category
  if (status && status !== 'ALL') query.status = status

  if (search && search.trim()) {
    const s = search.trim()
    const regex = new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    query.$or = [{ name: regex }, { code: regex }, { description: regex }]
  }

  const pg = Math.max(1, Number(page) || 1)
  const lim = Math.min(100, Math.max(1, Number(limit) || 20))
  const skip = (pg - 1) * lim

  const [campaigns, total] = await Promise.all([
    RewardCampaign.find(query)
      .populate('eligibility.categoryIds', 'name')
      .populate('createdBy', 'fullName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(lim)
      .lean(),
    RewardCampaign.countDocuments(query),
  ])

  // Attach participant stats
  const enriched = await Promise.all(
    campaigns.map(async (camp) => {
      const [participantsCount, qualifiedCount] = await Promise.all([
        VendorReward.countDocuments({ campaignId: camp._id }),
        VendorReward.countDocuments({
          campaignId: camp._id,
          status: { $in: [VENDOR_REWARD_STATUS.QUALIFIED, VENDOR_REWARD_STATUS.PENDING_APPROVAL, VENDOR_REWARD_STATUS.CREDITED] },
        }),
      ])
      return {
        ...camp,
        stats: {
          participantsCount,
          qualifiedCount,
        },
      }
    })
  )

  return sendSuccess(res, {
    data: {
      campaigns: enriched,
      total,
      page: pg,
      limit: lim,
      pages: Math.max(1, Math.ceil(total / lim)),
    },
  })
})

/**
 * POST /api/v1/admin/rewards/campaigns
 */
export const createAdminCampaign = asyncHandler(async (req, res) => {
  const campaign = await createRewardCampaign(req.body, req.user)
  return sendSuccess(res, {
    message: 'Reward campaign created successfully',
    data: { campaign },
  })
})

/**
 * GET /api/v1/admin/rewards/campaigns/:id
 */
export const getAdminCampaignById = asyncHandler(async (req, res) => {
  const { id } = req.params
  const campaign = await RewardCampaign.findById(id)
    .populate('eligibility.categoryIds', 'name')
    .populate('eligibility.serviceIds', 'name')
    .populate('eligibility.zones', 'name city')
    .populate('createdBy', 'fullName email')
    .populate('updatedBy', 'fullName email')
    .lean()

  if (!campaign) throw new Error('Campaign not found')

  const [vendorRewards, auditLogs] = await Promise.all([
    VendorReward.find({ campaignId: id })
      .populate('vendorId', 'fullName phone email profileImageUrl labourProfile')
      .sort({ updatedAt: -1 })
      .lean(),
    RewardAuditLog.find({ campaignId: id })
      .populate('actorId', 'fullName email role')
      .populate('vendorId', 'fullName phone')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(),
  ])

  return sendSuccess(res, {
    data: {
      campaign,
      vendorRewards,
      auditLogs,
    },
  })
})

/**
 * PATCH /api/v1/admin/rewards/campaigns/:id
 */
export const updateAdminCampaign = asyncHandler(async (req, res) => {
  const { id } = req.params
  const campaign = await updateRewardCampaign(id, req.body, req.user)
  return sendSuccess(res, {
    message: 'Campaign updated successfully',
    data: { campaign },
  })
})

/**
 * POST /api/v1/admin/rewards/campaigns/:id/activate
 */
export const activateAdminCampaign = asyncHandler(async (req, res) => {
  const { id } = req.params
  const campaign = await activateRewardCampaign(id, req.user)
  return sendSuccess(res, {
    message: `Campaign activated (${campaign.status}) successfully`,
    data: { campaign },
  })
})

/**
 * POST /api/v1/admin/rewards/campaigns/:id/pause
 */
export const pauseAdminCampaign = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { reason } = req.body
  const campaign = await pauseRewardCampaign(id, req.user, reason)
  return sendSuccess(res, {
    message: 'Campaign paused successfully',
    data: { campaign },
  })
})

/**
 * POST /api/v1/admin/rewards/campaigns/:id/end
 */
export const endAdminCampaign = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { reason } = req.body
  const campaign = await endRewardCampaign(id, req.user, reason)
  return sendSuccess(res, {
    message: 'Campaign ended successfully',
    data: { campaign },
  })
})

/**
 * POST /api/v1/admin/rewards/campaigns/:id/evaluate
 */
export const evaluateAdminCampaign = asyncHandler(async (req, res) => {
  const { id } = req.params
  const campaign = await RewardCampaign.findById(id)
  if (!campaign) throw new Error('Campaign not found')

  const vendors = await User.find({
    role: { $in: [USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR] },
    isActive: true,
  })

  let count = 0
  for (const v of vendors) {
    await evaluateVendorCampaign(campaign, v)
    count++
  }

  campaign.lastEvaluatedAt = new Date()
  await campaign.save()

  return sendSuccess(res, {
    message: `Evaluated ${count} vendors for campaign "${campaign.name}"`,
    data: { evaluatedCount: count },
  })
})

/**
 * GET /api/v1/admin/rewards/pending
 */
export const getAdminPendingApprovals = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query
  const pg = Math.max(1, Number(page) || 1)
  const lim = Math.min(100, Math.max(1, Number(limit) || 20))
  const skip = (pg - 1) * lim

  const query = {
    status: { $in: [VENDOR_REWARD_STATUS.PENDING_APPROVAL, VENDOR_REWARD_STATUS.QUALIFIED] },
  }

  const [pendingRewards, total] = await Promise.all([
    VendorReward.find(query)
      .populate('campaignId', 'name code category budget approvalMode termsAndConditions')
      .populate('vendorId', 'fullName phone email profileImageUrl labourProfile')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(lim)
      .lean(),
    VendorReward.countDocuments(query),
  ])

  return sendSuccess(res, {
    data: {
      pendingRewards,
      total,
      page: pg,
      limit: lim,
      pages: Math.max(1, Math.ceil(total / lim)),
    },
  })
})

/**
 * POST /api/v1/admin/rewards/:id/approve
 */
export const approveAdminReward = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { notes } = req.body
  const result = await approveVendorReward(id, req.user, notes)
  return sendSuccess(res, {
    message: 'Reward approved and credited to vendor wallet successfully',
    data: result,
  })
})

/**
 * POST /api/v1/admin/rewards/:id/reject
 */
export const rejectAdminReward = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { reason } = req.body
  const reward = await rejectVendorReward(id, req.user, reason)
  return sendSuccess(res, {
    message: 'Reward rejected successfully',
    data: { reward },
  })
})

/**
 * POST /api/v1/admin/rewards/:id/reverse
 */
export const reverseAdminReward = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { reason } = req.body
  const result = await reverseVendorReward(id, req.user, reason)
  return sendSuccess(res, {
    message: 'Credited reward reversed and wallet adjusted successfully',
    data: result,
  })
})

/**
 * GET /api/v1/admin/rewards/vendors
 */
export const getAdminVendorProgress = asyncHandler(async (req, res) => {
  const { campaignId, status, search, page = 1, limit = 20 } = req.query

  const query = {}
  if (campaignId && campaignId !== 'ALL') query.campaignId = campaignId
  if (status && status !== 'ALL') query.status = status

  const pg = Math.max(1, Number(page) || 1)
  const lim = Math.min(100, Math.max(1, Number(limit) || 20))
  const skip = (pg - 1) * lim

  if (search && search.trim()) {
    const s = search.trim()
    const regex = new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    const matchingUsers = await User.find({
      $or: [{ fullName: regex }, { phone: regex }, { email: regex }],
    }).select('_id')
    query.vendorId = { $in: matchingUsers.map((u) => u._id) }
  }

  const [vendorRewards, total] = await Promise.all([
    VendorReward.find(query)
      .populate('campaignId', 'name code category budget')
      .populate('vendorId', 'fullName phone email profileImageUrl labourProfile')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(lim)
      .lean(),
    VendorReward.countDocuments(query),
  ])

  return sendSuccess(res, {
    data: {
      vendorRewards,
      total,
      page: pg,
      limit: lim,
      pages: Math.max(1, Math.ceil(total / lim)),
    },
  })
})

/**
 * GET /api/v1/admin/rewards/transactions
 */
export const getAdminRewardTransactions = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query
  const pg = Math.max(1, Number(page) || 1)
  const lim = Math.min(100, Math.max(1, Number(limit) || 20))
  const skip = (pg - 1) * lim

  const query = { context: 'INCENTIVE' }

  const [transactions, total] = await Promise.all([
    WalletTransaction.find(query)
      .populate('userId', 'fullName phone email role')
      .populate('referenceId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(lim)
      .lean(),
    WalletTransaction.countDocuments(query),
  ])

  return sendSuccess(res, {
    data: {
      transactions,
      total,
      page: pg,
      limit: lim,
      pages: Math.max(1, Math.ceil(total / lim)),
    },
  })
})

/**
 * GET /api/v1/admin/rewards/reports
 */
export const getAdminRewardReports = asyncHandler(async (req, res) => {
  const { startDate, endDate, category } = req.query

  const match = {}
  if (category && category !== 'ALL') match.category = category
  if (startDate && endDate) {
    match.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    }
  }

  const [categoryBreakdown, statusBreakdown, auditLogs] = await Promise.all([
    VendorReward.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$category',
          totalRewardsCredited: {
            $sum: { $cond: [{ $eq: ['$status', 'CREDITED'] }, '$rewardAmount', 0] },
          },
          totalCount: { $sum: 1 },
          creditedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'CREDITED'] }, 1, 0] },
          },
        },
      },
    ]),
    VendorReward.aggregate([
      { $match: match },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$rewardAmount' },
        },
      },
    ]),
    RewardAuditLog.find()
      .populate('campaignId', 'name code')
      .populate('vendorId', 'fullName phone')
      .populate('actorId', 'fullName email role')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
  ])

  return sendSuccess(res, {
    data: {
      categoryBreakdown,
      statusBreakdown,
      auditLogs,
    },
  })
})

/**
 * GET /api/v1/admin/rewards/settings
 */
export const getAdminRewardSettings = asyncHandler(async (req, res) => {
  const settings = await getRewardSettings()
  return sendSuccess(res, { data: { settings } })
})

/**
 * PUT /api/v1/admin/rewards/settings
 */
export const updateAdminRewardSettings = asyncHandler(async (req, res) => {
  const settings = await updateRewardSettings(req.body, req.user)
  return sendSuccess(res, {
    message: 'Reward settings updated successfully',
    data: { settings },
  })
})

/**
 * POST /api/v1/admin/rewards/reconcile-now
 */
export const triggerManualReconciliation = asyncHandler(async (req, res) => {
  const result = await reconcileAllActiveCampaigns()
  return sendSuccess(res, {
    message: 'Batch reconciliation triggered successfully',
    data: result,
  })
})

// ==================== VENDOR CONTROLLERS ====================

/**
 * GET /api/v1/vendor/rewards/overview
 */
export const getVendorRewardsHub = asyncHandler(async (req, res) => {
  const overview = await getVendorRewardsOverview(req.user._id)
  return sendSuccess(res, { data: overview })
})
