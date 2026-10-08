import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import {
  getTrialConfig,
  updateTrialConfig,
  startVendorTrial,
  requestFinalChance,
  verifyAndActivateFinalChance,
  confirmVendor,
  rejectVendor,
  blockVendor,
  unblockVendor,
  requestAdditionalReview,
  grantAdditionalTrial,
  waivePenaltyAndActivateFinalChance,
  pauseTrial,
  resumeTrial,
  getVendorTrialOverview,
  getAdminTrialStats,
  migrateExistingVendors,
} from '../services/trialEvaluationService.js'
import { VendorTrial, VENDOR_TRIAL_STATUS } from '../models/VendorTrial.js'
import { User } from '../models/User.js'
import { TrialEvaluation } from '../models/TrialEvaluation.js'
import { VendorWarning } from '../models/VendorWarning.js'

// ==================== ADMIN CONTROLLERS ====================

/**
 * GET /api/v1/admin/trial-settings
 */
export const getAdminTrialSettings = asyncHandler(async (req, res) => {
  const config = await getTrialConfig()
  return sendSuccess(res, { data: { settings: config } })
})

/**
 * PUT /api/v1/admin/trial-settings
 */
export const updateAdminTrialSettings = asyncHandler(async (req, res) => {
  const config = await updateTrialConfig(req.body, req.user)
  return sendSuccess(res, {
    message: 'Trial settings updated successfully',
    data: { settings: config },
  })
})

/**
 * GET /api/v1/admin/vendor-trials/stats
 */
export const getAdminTrialDashboardStats = asyncHandler(async (req, res) => {
  const stats = await getAdminTrialStats()
  return sendSuccess(res, { data: { stats } })
})

/**
 * GET /api/v1/admin/vendor-trials
 */
export const getAdminVendorTrials = asyncHandler(async (req, res) => {
  const { status, search, page = 1, limit = 20 } = req.query

  const query = {}
  if (status && status !== 'all') {
    query.status = status
  }

  const pg = Math.max(1, Number(page) || 1)
  const lim = Math.min(100, Math.max(1, Number(limit) || 20))
  const skip = (pg - 1) * lim

  let vendorMatch = {}
  if (search && search.trim()) {
    const s = search.trim()
    const regex = new RegExp(s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    const matchingUsers = await User.find({
      $or: [{ fullName: regex }, { phone: regex }, { email: regex }],
    }).select('_id')
    query.vendorId = { $in: matchingUsers.map((u) => u._id) }
  }

  const [trials, total] = await Promise.all([
    VendorTrial.find(query)
      .populate('vendorId', 'fullName phone email profileImageUrl role labourProfile vendorStatus isActive')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(lim)
      .lean(),
    VendorTrial.countDocuments(query),
  ])

  return sendSuccess(res, {
    data: {
      trials,
      total,
      page: pg,
      limit: lim,
      pages: Math.max(1, Math.ceil(total / lim)),
    },
  })
})

/**
 * GET /api/v1/admin/vendor-trials/pending-confirmations
 * Requirement 47: Admin review screen for all vendors who have completed trial or need confirmation review
 */
export const getAdminPendingConfirmations = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query

  const query = {
    status: {
      $in: [
        VENDOR_TRIAL_STATUS.PENDING_ADMIN_CONFIRMATION,
        VENDOR_TRIAL_STATUS.ADMIN_REVIEW_REQUIRED,
        VENDOR_TRIAL_STATUS.TRIAL_COMPLETED,
      ],
    },
  }

  const pg = Math.max(1, Number(page) || 1)
  const lim = Math.min(100, Math.max(1, Number(limit) || 20))
  const skip = (pg - 1) * lim

  const [trials, total] = await Promise.all([
    VendorTrial.find(query)
      .populate('vendorId', 'fullName phone email profileImageUrl role labourProfile vendorStatus isActive createdAt')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(lim)
      .lean(),
    VendorTrial.countDocuments(query),
  ])

  // Attach enriched statistics for each pending vendor (Requirement 47)
  const enriched = await Promise.all(
    trials.map(async (trial) => {
      const vendorId = trial.vendorId?._id || trial.vendorId
      const [evaluations, warnings] = await Promise.all([
        TrialEvaluation.find({ vendorId }).sort({ evaluatedAt: -1 }).lean(),
        VendorWarning.find({ vendorId }).lean(),
      ])

      const ratings = evaluations.map((e) => e.rating)
      const avg = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : null
      const lowest = ratings.length > 0 ? Math.min(...ratings) : null
      const highest = ratings.length > 0 ? Math.max(...ratings) : null

      // Trial Duration in Days
      let durationDays = null
      if (trial.startedAt) {
        const end = trial.completedAt || new Date()
        durationDays = Math.max(1, Math.ceil((new Date(end) - new Date(trial.startedAt)) / (1000 * 60 * 60 * 24)))
      }

      return {
        ...trial,
        vendorSummary: {
          vendorName: trial.vendorId?.fullName || 'Unnamed Vendor',
          vendorId: String(vendorId),
          phone: trial.vendorId?.phone,
          verificationStatus: trial.vendorId?.labourProfile?.kycStatus || 'verified',
          trialStatus: trial.status,
          trialCount: trial.configuredTrialCount + (trial.adminGrantedAdditionalTrials || 0),
          passedTrials: trial.passedTrialCount || 0,
          failedTrials: trial.failedTrialCount || 0,
          averageRating: avg,
          lowestRating: lowest,
          highestRating: highest,
          servicesCompleted: trial.completedTrialCount || 0,
          warningsReceived: warnings.length,
          finalChanceUsed: Boolean(trial.finalChanceUsed),
          penaltyPaid: Boolean(trial.finalChancePenaltyPaid),
          userReviewsCount: evaluations.length,
          recentReviews: evaluations.slice(0, 5),
          trialDurationDays: durationDays,
          adminNotes: trial.confirmationNotes || trial.reviewReason || '',
        },
      }
    })
  )

  return sendSuccess(res, {
    data: {
      pendingConfirmations: enriched,
      total,
      page: pg,
      limit: lim,
      pages: Math.max(1, Math.ceil(total / lim)),
    },
  })
})

/**
 * GET /api/v1/admin/vendor-trials/:vendorId
 */
export const getAdminVendorTrialDetail = asyncHandler(async (req, res) => {
  const { vendorId } = req.params
  const overview = await getVendorTrialOverview(vendorId)
  return sendSuccess(res, { data: overview })
})

/**
 * POST /api/v1/admin/vendor-trials/:vendorId/confirm
 * Requirement 49
 */
export const adminConfirmVendor = asyncHandler(async (req, res) => {
  const { vendorId } = req.params
  const { notes } = req.body
  const result = await confirmVendor(vendorId, req.user, notes)
  return sendSuccess(res, {
    message: 'Vendor confirmed successfully as an active service provider',
    data: result,
  })
})

/**
 * POST /api/v1/admin/vendor-trials/:vendorId/reject
 * Requirement 50
 */
export const adminRejectVendor = asyncHandler(async (req, res) => {
  const { vendorId } = req.params
  const { reason } = req.body
  const result = await rejectVendor(vendorId, req.user, reason)
  return sendSuccess(res, {
    message: 'Vendor rejected successfully',
    data: result,
  })
})

/**
 * POST /api/v1/admin/vendor-trials/:vendorId/block
 * Requirement 51
 */
export const adminBlockVendor = asyncHandler(async (req, res) => {
  const { vendorId } = req.params
  const { reason } = req.body
  const result = await blockVendor(vendorId, req.user, reason)
  return sendSuccess(res, {
    message: 'Vendor blocked successfully',
    data: result,
  })
})

/**
 * POST /api/v1/admin/vendor-trials/:vendorId/unblock
 */
export const adminUnblockVendor = asyncHandler(async (req, res) => {
  const { vendorId } = req.params
  const { reason } = req.body
  const result = await unblockVendor(vendorId, req.user, reason)
  return sendSuccess(res, {
    message: 'Vendor unblocked successfully',
    data: result,
  })
})

/**
 * POST /api/v1/admin/vendor-trials/:vendorId/pause
 * Requirement 24
 */
export const adminPauseTrial = asyncHandler(async (req, res) => {
  const { vendorId } = req.params
  const { reason } = req.body
  const trial = await pauseTrial(vendorId, req.user, reason)
  return sendSuccess(res, {
    message: 'Trial paused successfully',
    data: { trial },
  })
})

/**
 * POST /api/v1/admin/vendor-trials/:vendorId/resume
 * Requirement 24
 */
export const adminResumeTrial = asyncHandler(async (req, res) => {
  const { vendorId } = req.params
  const trial = await resumeTrial(vendorId, req.user)
  return sendSuccess(res, {
    message: 'Trial resumed successfully',
    data: { trial },
  })
})

/**
 * POST /api/v1/admin/vendor-trials/:vendorId/extend
 * Requirement 53: Grant additional trial
 */
export const adminExtendTrial = asyncHandler(async (req, res) => {
  const { vendorId } = req.params
  const { additionalCount, reason } = req.body
  const trial = await grantAdditionalTrial(vendorId, req.user, { additionalCount, reason })
  return sendSuccess(res, {
    message: `Granted ${additionalCount || 1} additional trial service(s)`,
    data: { trial },
  })
})

/**
 * POST /api/v1/admin/vendor-trials/:vendorId/request-review
 * Requirement 52
 */
export const adminRequestReview = asyncHandler(async (req, res) => {
  const { vendorId } = req.params
  const { reason } = req.body
  const trial = await requestAdditionalReview(vendorId, req.user, reason)
  return sendSuccess(res, {
    message: 'Additional admin review requested for vendor',
    data: { trial },
  })
})

/**
 * POST /api/v1/admin/vendor-trials/:vendorId/waive-penalty
 */
export const adminWaivePenalty = asyncHandler(async (req, res) => {
  const { vendorId } = req.params
  const { reason } = req.body
  const result = await waivePenaltyAndActivateFinalChance(vendorId, req.user, reason)
  return sendSuccess(res, {
    message: 'Penalty waived and final chance activated successfully',
    data: result,
  })
})

/**
 * POST /api/v1/admin/vendor-trials/migrate-existing
 * Requirement 41
 */
export const adminMigrateVendors = asyncHandler(async (req, res) => {
  const result = await migrateExistingVendors(req.user)
  return sendSuccess(res, {
    message: `Migrated ${result.migratedCount} existing verified vendors to CONFIRMED`,
    data: result,
  })
})

// ==================== VENDOR CONTROLLERS ====================

/**
 * GET /api/v1/vendor/trial
 * Authenticated vendor fetches their trial status
 */
export const getVendorMyTrial = asyncHandler(async (req, res) => {
  const vendorId = req.user._id
  const overview = await getVendorTrialOverview(vendorId)
  return sendSuccess(res, { data: overview })
})

/**
 * GET /api/v1/vendor/trial/history
 */
export const getVendorTrialHistory = asyncHandler(async (req, res) => {
  const vendorId = req.user._id
  const [evaluations, warnings] = await Promise.all([
    TrialEvaluation.find({ vendorId })
      .populate('serviceId', 'name')
      .populate('bookingId', 'scheduledAt address')
      .sort({ evaluatedAt: -1 })
      .lean(),
    VendorWarning.find({ vendorId }).sort({ issuedAt: -1 }).lean(),
  ])

  return sendSuccess(res, { data: { evaluations, warnings } })
})

/**
 * POST /api/v1/vendor/trial/final-chance/request
 * Requirement 14
 */
export const vendorRequestFinalChance = asyncHandler(async (req, res) => {
  const vendorId = req.user._id
  const result = await requestFinalChance(vendorId)
  return sendSuccess(res, {
    message: 'Final chance requested. Please complete the penalty payment to activate.',
    data: result,
  })
})

/**
 * POST /api/v1/vendor/trial/final-chance/verify-payment
 * Requirement 17
 */
export const vendorVerifyPenaltyPayment = asyncHandler(async (req, res) => {
  const vendorId = req.user._id
  const { razorpayOrderId, razorpayPaymentId, razorpaySignature, finalChanceRequestId } = req.body

  const result = await verifyAndActivateFinalChance({
    vendorId,
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
    finalChanceRequestId,
  })

  return sendSuccess(res, {
    message: 'Payment verified and final chance activated successfully',
    data: result,
  })
})
