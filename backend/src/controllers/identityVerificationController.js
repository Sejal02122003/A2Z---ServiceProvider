import { IdentityVerification } from '../models/IdentityVerification.js'
import { IdentityAuditLog } from '../models/IdentityAuditLog.js'
import { User } from '../models/User.js'
import {
  handleProviderWebhook,
  restoreUserIdentity,
  reviewIdentityVerificationAdmin,
  submitIdentityVerification,
  suspendUserIdentity,
} from '../services/identityVerificationService.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { IDENTITY_STATUS, IDENTITY_STATUS_LIST } from '../constants/identityConstants.js'
import { identityVerificationLimiter } from '../utils/rateLimiter.js'
import { validateName } from '../utils/nameNormalization.js'

/**
 * GET /identity-verification/me
 * User checks their own verification status
 */
export const getMyIdentityStatus = asyncHandler(async (req, res) => {
  const user = req.user
  const verification = user.identityVerificationRef
    ? await IdentityVerification.findById(user.identityVerificationRef)
    : await IdentityVerification.findOne({ userId: user._id }).sort({ createdAt: -1 })

  return sendSuccess(res, {
    data: {
      identityStatus: user.identityStatus || IDENTITY_STATUS.UNVERIFIED,
      verifiedLegalName: user.verifiedLegalName || null,
      displayName: user.fullName,
      riskFlags: user.identityRiskFlags || [],
      verification: verification || null,
    },
  })
})

/**
 * POST /identity-verification/submit
 * User submits verification documents or requests verification
 */
export const submitMyIdentity = asyncHandler(async (req, res) => {
  const user = req.user

  // Rate limiting per user
  const limit = identityVerificationLimiter.isAllowed(String(user._id))
  if (!limit.allowed) {
    return sendError(res, {
      message: `Too many verification submissions. Please wait ${limit.retryAfterSeconds} seconds.`,
      statusCode: 429,
      code: 'RATE_LIMITED',
    })
  }

  const {
    submittedName = user.fullName,
    verifiedLegalName,
    documentType,
    documentNumberMasked,
    documentUrls = [],
    provider = 'manual',
  } = req.body

  if (!submittedName || typeof submittedName !== 'string') {
    return sendError(res, {
      message: 'A valid name is required for verification',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_NAME',
    })
  }

  const check = validateName(submittedName)
  if (!check.isValid) {
    return sendError(res, {
      message: check.reason,
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_NAME',
    })
  }

  try {
    const result = await submitIdentityVerification({
      user,
      submittedName: check.cleanName,
      verifiedLegalName,
      documentType,
      documentNumberMasked,
      documentUrls,
      provider,
      actorRole: 'USER',
    })

    return sendSuccess(res, {
      message:
        result.verification.status === IDENTITY_STATUS.MANUAL_REVIEW
          ? 'Your details have been submitted and sent for manual review due to a name discrepancy.'
          : 'Identity verification submitted successfully and is pending review.',
      statusCode: HTTP_STATUS.CREATED,
      data: {
        verification: result.verification,
        nameComparison: result.nameComparison,
      },
    })
  } catch (err) {
    return sendError(res, {
      message: err.message || 'Could not submit identity verification',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'SUBMISSION_FAILED',
    })
  }
})

/**
 * POST /identity-verification/appeal
 * User appeals a rejection or submits a correction
 */
export const appealIdentityDecision = asyncHandler(async (req, res) => {
  const user = req.user
  const { appealNotes, correctedName, documentUrls } = req.body

  const verification = await IdentityVerification.findOne({ userId: user._id }).sort({ createdAt: -1 })
  if (!verification) {
    return sendError(res, {
      message: 'No previous verification record found to appeal',
      statusCode: HTTP_STATUS.NOT_FOUND,
      code: 'NOT_FOUND',
    })
  }

  verification.status = IDENTITY_STATUS.MANUAL_REVIEW
  verification.appealNotes = appealNotes ? String(appealNotes).trim().slice(0, 1000) : 'User submitted appeal'
  if (correctedName) {
    const cCheck = validateName(correctedName)
    if (cCheck.isValid) {
      verification.submittedName = cCheck.cleanName
    }
  }
  if (Array.isArray(documentUrls) && documentUrls.length > 0) {
    verification.documentUrls = [...(verification.documentUrls || []), ...documentUrls]
  }
  await verification.save()

  user.identityStatus = IDENTITY_STATUS.MANUAL_REVIEW
  await user.save()

  const { logIdentityAudit } = await import('../services/identityVerificationService.js')
  const { IDENTITY_AUDIT_ACTIONS } = await import('../models/IdentityAuditLog.js')

  await logIdentityAudit({
    userId: user._id,
    verificationId: verification._id,
    action: IDENTITY_AUDIT_ACTIONS.APPEAL_SUBMITTED,
    previousStatus: IDENTITY_STATUS.REJECTED,
    newStatus: IDENTITY_STATUS.MANUAL_REVIEW,
    performedBy: user._id,
    actorRole: 'USER',
    reason: appealNotes || 'User submitted an appeal for manual review',
  })

  return sendSuccess(res, {
    message: 'Your appeal has been submitted for manual review.',
    data: { verification },
  })
})

/**
 * POST /identity-verification/webhook
 * External provider callback endpoint with HMAC validation & replay protection
 */
export const providerWebhookHandler = asyncHandler(async (req, res) => {
  const eventId = req.headers['x-webhook-id'] || req.body?.eventId
  const signature = req.headers['x-signature'] || req.headers['x-webhook-signature']
  const rawBody = JSON.stringify(req.body)

  try {
    const result = await handleProviderWebhook({
      eventId,
      signature,
      rawBody,
      payload: req.body,
    })
    return sendSuccess(res, {
      message: 'Webhook processed successfully',
      data: result,
    })
  } catch (err) {
    return sendError(res, {
      message: err.message || 'Webhook processing failed',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'WEBHOOK_FAILED',
    })
  }
})

// ================= ADMIN CONTROLLER METHODS ================= //

/**
 * GET /admin/identity-verifications
 * Admin lists identity verifications with search, filters, pagination
 */
export const adminListVerifications = asyncHandler(async (req, res) => {
  const { status, role, search, riskFlag, page = 1, limit = 20 } = req.query

  const filter = {}
  if (status && status !== 'all' && IDENTITY_STATUS_LIST.includes(status)) {
    filter.status = status
  }
  if (role && role !== 'all') {
    filter.role = role
  }
  if (riskFlag && riskFlag !== 'all') {
    filter.riskFlags = riskFlag
  }

  if (search && search.trim()) {
    const term = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    filter.$or = [
      { submittedName: new RegExp(term, 'i') },
      { verifiedLegalName: new RegExp(term, 'i') },
      { documentNumberMasked: new RegExp(term, 'i') },
    ]
  }

  const pg = Math.max(1, Number(page) || 1)
  const lim = Math.min(100, Math.max(1, Number(limit) || 20))
  const skip = (pg - 1) * lim

  const [items, total, stats] = await Promise.all([
    IdentityVerification.find(filter)
      .populate('userId', 'fullName phone email role isActive')
      .populate('reviewedBy', 'fullName email')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(lim)
      .lean(),
    IdentityVerification.countDocuments(filter),
    Promise.all([
      IdentityVerification.countDocuments({ status: IDENTITY_STATUS.PENDING_IDENTITY_VERIFICATION }),
      IdentityVerification.countDocuments({ status: IDENTITY_STATUS.MANUAL_REVIEW }),
      IdentityVerification.countDocuments({ status: IDENTITY_STATUS.VERIFIED }),
      IdentityVerification.countDocuments({ status: IDENTITY_STATUS.REJECTED }),
      IdentityVerification.countDocuments({ status: IDENTITY_STATUS.SUSPENDED }),
      IdentityVerification.countDocuments({}),
    ]),
  ])

  return sendSuccess(res, {
    data: {
      items,
      total,
      page: pg,
      limit: lim,
      pages: Math.max(1, Math.ceil(total / lim)),
      counts: {
        pending: stats[0],
        manualReview: stats[1],
        verified: stats[2],
        rejected: stats[3],
        suspended: stats[4],
        total: stats[5],
      },
    },
  })
})

/**
 * GET /admin/identity-verifications/:id
 * Detailed verification view with full audit log timeline
 */
export const adminGetVerificationById = asyncHandler(async (req, res) => {
  const verification = await IdentityVerification.findById(req.params.id)
    .populate('userId', 'fullName phone email role isActive labourProfile contractorProfile')
    .populate('reviewedBy', 'fullName email')
    .lean()

  if (!verification) {
    return sendError(res, {
      message: 'Verification record not found',
      statusCode: HTTP_STATUS.NOT_FOUND,
      code: 'NOT_FOUND',
    })
  }

  const auditLogs = await IdentityAuditLog.find({
    $or: [{ verificationId: verification._id }, { userId: verification.userId?._id }],
  })
    .populate('performedBy', 'fullName email role')
    .sort({ timestamp: -1 })
    .lean()

  return sendSuccess(res, {
    data: {
      verification,
      auditLogs,
    },
  })
})

/**
 * PATCH /admin/identity-verifications/:id/decision
 * Admin approves, rejects, or requests correction
 */
export const adminReviewVerification = asyncHandler(async (req, res) => {
  const { decision, reason, verifiedLegalName } = req.body

  try {
    const result = await reviewIdentityVerificationAdmin({
      verificationId: req.params.id,
      adminUser: req.user,
      decision,
      reason,
      verifiedLegalName,
    })

    return sendSuccess(res, {
      message: `Identity verification decision recorded: ${decision}`,
      data: result,
    })
  } catch (err) {
    return sendError(res, {
      message: err.message || 'Failed to record verification review decision',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'DECISION_FAILED',
    })
  }
})

/**
 * POST /admin/identity-verifications/:id/suspend
 * Admin suspends account for identity violation / impersonation
 */
export const adminSuspendUser = asyncHandler(async (req, res) => {
  const { reason } = req.body
  const verification = await IdentityVerification.findById(req.params.id)
  if (!verification) {
    return sendError(res, {
      message: 'Verification record not found',
      statusCode: HTTP_STATUS.NOT_FOUND,
      code: 'NOT_FOUND',
    })
  }

  try {
    const user = await suspendUserIdentity({
      userId: verification.userId,
      adminUser: req.user,
      reason,
    })
    return sendSuccess(res, {
      message: 'User account has been suspended',
      data: { user: user.toSafeObject() },
    })
  } catch (err) {
    return sendError(res, {
      message: err.message || 'Failed to suspend account',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'SUSPENSION_FAILED',
    })
  }
})

/**
 * POST /admin/identity-verifications/:id/restore
 * Admin restores a suspended account
 */
export const adminRestoreUser = asyncHandler(async (req, res) => {
  const { reason } = req.body
  const verification = await IdentityVerification.findById(req.params.id)
  if (!verification) {
    return sendError(res, {
      message: 'Verification record not found',
      statusCode: HTTP_STATUS.NOT_FOUND,
      code: 'NOT_FOUND',
    })
  }

  try {
    const user = await restoreUserIdentity({
      userId: verification.userId,
      adminUser: req.user,
      reason,
    })
    return sendSuccess(res, {
      message: 'User account has been restored',
      data: { user: user.toSafeObject() },
    })
  } catch (err) {
    return sendError(res, {
      message: err.message || 'Failed to restore account',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'RESTORE_FAILED',
    })
  }
})

/**
 * GET /admin/identity-verifications/audit-logs
 * Admin views all identity audit logs
 */
export const adminListAuditLogs = asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, action, userId } = req.query
  const filter = {}
  if (action) filter.action = action
  if (userId) filter.userId = userId

  const pg = Math.max(1, Number(page) || 1)
  const lim = Math.min(100, Math.max(1, Number(limit) || 50))
  const skip = (pg - 1) * lim

  const [items, total] = await Promise.all([
    IdentityAuditLog.find(filter)
      .populate('userId', 'fullName phone email role')
      .populate('performedBy', 'fullName email role')
      .sort({ timestamp: -1 })
      .skip(skip)
      .limit(lim)
      .lean(),
    IdentityAuditLog.countDocuments(filter),
  ])

  return sendSuccess(res, {
    data: {
      items,
      total,
      page: pg,
      limit: lim,
      pages: Math.max(1, Math.ceil(total / lim)),
    },
  })
})
