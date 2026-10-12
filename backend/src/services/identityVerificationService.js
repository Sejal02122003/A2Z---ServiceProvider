import crypto from 'crypto'
import { User } from '../models/User.js'
import { IdentityVerification } from '../models/IdentityVerification.js'
import { IdentityAuditLog, IDENTITY_AUDIT_ACTIONS } from '../models/IdentityAuditLog.js'
import {
  ALLOWED_IDENTITY_TRANSITIONS,
  IDENTITY_PROVIDERS,
  IDENTITY_STATUS,
  NAME_MATCH_CONFIDENCE,
} from '../constants/identityConstants.js'
import { KYC_STATUS, USER_ROLES } from '../constants/roles.js'
import { calculateNameSimilarity, normalizeName, validateName } from '../utils/nameNormalization.js'

// Cache processed webhook event IDs to prevent replay attacks (in-memory with 24h TTL)
const processedWebhookEvents = new Map()
const WEBHOOK_TTL_MS = 24 * 60 * 60 * 1000

function cleanupWebhookCache() {
  const cutoff = Date.now() - WEBHOOK_TTL_MS
  for (const [id, ts] of processedWebhookEvents.entries()) {
    if (ts < cutoff) processedWebhookEvents.delete(id)
  }
}
setInterval(cleanupWebhookCache, 60 * 60 * 1000).unref()

/**
 * Checks whether transitioning from currentStatus to targetStatus is permitted.
 */
export function isValidStateTransition(currentStatus, targetStatus) {
  if (currentStatus === targetStatus) return true
  const allowed = ALLOWED_IDENTITY_TRANSITIONS[currentStatus] || []
  return allowed.includes(targetStatus)
}

/**
 * Records an immutable entry in the Identity Audit Log.
 */
export async function logIdentityAudit({
  userId,
  verificationId,
  action,
  previousStatus,
  newStatus,
  performedBy,
  actorRole = 'SYSTEM',
  reason,
  metadata,
}) {
  try {
    return await IdentityAuditLog.create({
      userId,
      verificationId,
      action,
      previousStatus,
      newStatus,
      performedBy,
      actorRole,
      reason,
      metadata,
      timestamp: new Date(),
    })
  } catch (err) {
    console.error('[IDENTITY_AUDIT_ERROR] Failed to record audit log:', err)
    return null
  }
}

/**
 * Evaluates duplicate signals and name similarity supporting risks.
 * Note: A matching name is NEVER by itself treated as proof of impersonation.
 */
export async function evaluateIdentityRiskSignals({ submittedName, phone, email, userId }) {
  const riskFlags = []
  let riskScore = 0

  const normalized = normalizeName(submittedName)

  // 1. Check existing accounts sharing the same normalized name
  const sameNameCount = await User.countDocuments({
    _id: { $ne: userId },
    fullName: { $regex: new RegExp(`^${submittedName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
  })

  if (sameNameCount > 0) {
    // Record as supporting telemetry only
    riskFlags.push('SHARED_NAME_SIGNAL')
    // We add a minimal non-blocking risk score
    riskScore += Math.min(10, sameNameCount * 2)
  }

  // 2. Check duplicate phone or email attempts
  if (phone) {
    const existingPhone = await User.findOne({ phone, _id: { $ne: userId } })
    if (existingPhone) {
      riskFlags.push('DUPLICATE_PHONE_DETECTED')
      riskScore += 50
    }
  }

  if (email) {
    const existingEmail = await User.findOne({ email, _id: { $ne: userId } })
    if (existingEmail) {
      riskFlags.push('DUPLICATE_EMAIL_DETECTED')
      riskScore += 50
    }
  }

  return { riskScore, riskFlags }
}

/**
 * Submits or initiates an identity verification record.
 */
export async function submitIdentityVerification({
  user,
  submittedName,
  verifiedLegalName,
  documentType = 'other',
  documentNumberMasked,
  documentUrls = [],
  provider = IDENTITY_PROVIDERS.MANUAL,
  providerReference,
  actorRole = 'USER',
}) {
  const cleanNameCheck = validateName(submittedName)
  if (!cleanNameCheck.isValid) {
    throw new Error(cleanNameCheck.reason)
  }

  const currentStatus = user.identityStatus || IDENTITY_STATUS.UNVERIFIED

  // Risk signals
  const risk = await evaluateIdentityRiskSignals({
    submittedName: cleanNameCheck.cleanName,
    phone: user.phone,
    email: user.email,
    userId: user._id,
  })

  // Name comparison between display name and verified legal name (if provided by document/provider)
  let nameComparison = {
    score: 0,
    confidence: NAME_MATCH_CONFIDENCE.LOW,
    isMatch: false,
    reasons: ['No verified legal name available yet for automated matching'],
  }

  if (verifiedLegalName) {
    nameComparison = calculateNameSimilarity(cleanNameCheck.cleanName, verifiedLegalName)
  }

  let nextStatus = IDENTITY_STATUS.PENDING_IDENTITY_VERIFICATION
  if (verifiedLegalName && !nameComparison.isMatch && nameComparison.score < 50) {
    nextStatus = IDENTITY_STATUS.MANUAL_REVIEW
    risk.riskFlags.push('NAME_DISCREPANCY_FLAG')
    risk.riskScore += 25
  }

  if (!isValidStateTransition(currentStatus, nextStatus)) {
    throw new Error(`Cannot transition identity status from ${currentStatus} to ${nextStatus}`)
  }

  // Create verification record
  const verification = await IdentityVerification.create({
    userId: user._id,
    role: user.role,
    submittedName: cleanNameCheck.cleanName,
    normalizedName: normalizeName(cleanNameCheck.cleanName),
    verifiedLegalName: verifiedLegalName ? verifiedLegalName.trim() : undefined,
    status: nextStatus,
    provider,
    providerReference,
    documentType,
    documentNumberMasked,
    documentUrls,
    nameMatchScore: nameComparison.score,
    nameMatchConfidence: nameComparison.confidence,
    riskScore: risk.riskScore,
    riskFlags: risk.riskFlags,
    submittedAt: new Date(),
  })

  // Update User
  user.identityStatus = nextStatus
  user.identityVerificationRef = verification._id
  user.identityRiskScore = risk.riskScore
  user.identityRiskFlags = risk.riskFlags
  if (verifiedLegalName && nameComparison.isMatch) {
    user.verifiedLegalName = verifiedLegalName.trim()
  }
  await user.save()

  // Audit log
  await logIdentityAudit({
    userId: user._id,
    verificationId: verification._id,
    action: IDENTITY_AUDIT_ACTIONS.IDENTITY_SUBMITTED,
    previousStatus: currentStatus,
    newStatus: nextStatus,
    performedBy: user._id,
    actorRole,
    reason: `Identity verification submitted via ${provider}. Name similarity: ${nameComparison.score}% (${nameComparison.confidence})`,
    metadata: {
      nameMatchScore: nameComparison.score,
      confidence: nameComparison.confidence,
      riskScore: risk.riskScore,
    },
  })

  return { verification, nameComparison }
}

/**
 * Admin decision: approve, reject, or request correction
 */
export async function reviewIdentityVerificationAdmin({
  verificationId,
  adminUser,
  decision,
  reason,
  verifiedLegalName,
}) {
  const verification = await IdentityVerification.findById(verificationId).populate('userId')
  if (!verification) {
    throw new Error('Verification record not found')
  }

  const user = verification.userId
  if (!user) {
    throw new Error('Associated user account not found')
  }

  const currentStatus = verification.status
  let nextStatus

  if (decision === 'approve') {
    nextStatus = IDENTITY_STATUS.VERIFIED
  } else if (decision === 'reject') {
    nextStatus = IDENTITY_STATUS.REJECTED
  } else if (decision === 'request_correction') {
    nextStatus = IDENTITY_STATUS.MANUAL_REVIEW
  } else {
    throw new Error("Invalid review decision. Must be 'approve', 'reject', or 'request_correction'.")
  }

  if (!isValidStateTransition(currentStatus, nextStatus)) {
    throw new Error(`Cannot transition identity status from ${currentStatus} to ${nextStatus}`)
  }

  verification.status = nextStatus
  verification.reviewedBy = adminUser._id
  verification.reviewedAt = new Date()

  if (decision === 'approve') {
    verification.verifiedAt = new Date()
    if (verifiedLegalName) {
      verification.verifiedLegalName = verifiedLegalName.trim()
    }
    user.identityStatus = IDENTITY_STATUS.VERIFIED
    user.verifiedLegalName = verification.verifiedLegalName || user.fullName

    // Sync with Vendor KYC and Vendor Trial if role is Labour/Contractor
    if (user.role === USER_ROLES.LABOUR || user.role === USER_ROLES.CONTRACTOR) {
      const pKey = user.role === USER_ROLES.CONTRACTOR ? 'contractorProfile' : 'labourProfile'
      if (user[pKey]) {
        user[pKey].kycStatus = KYC_STATUS.VERIFIED
      }
      try {
        const { startVendorTrial } = await import('./trialEvaluationService.js')
        await startVendorTrial(user._id, {
          performedBy: adminUser._id,
          actorRole: 'ADMIN',
          reason: 'Admin approved identity verification and KYC',
        })
      } catch (trialErr) {
        console.error('[TRIAL_START_WARN] Error auto-starting vendor trial:', trialErr)
      }
    }
  } else if (decision === 'reject') {
    verification.rejectionReason = reason || 'Verification documents could not be validated'
    user.identityStatus = IDENTITY_STATUS.REJECTED

    if (user.role === USER_ROLES.LABOUR || user.role === USER_ROLES.CONTRACTOR) {
      const pKey = user.role === USER_ROLES.CONTRACTOR ? 'contractorProfile' : 'labourProfile'
      if (user[pKey]) {
        user[pKey].kycStatus = KYC_STATUS.FAILED
        user[pKey].kycReviewNote = reason || 'Identity verification rejected'
      }
    }
  } else if (decision === 'request_correction') {
    verification.reviewNotes = reason || 'Discrepancy in details — correction requested'
    user.identityStatus = IDENTITY_STATUS.MANUAL_REVIEW
  }

  await verification.save()
  await user.save()

  await logIdentityAudit({
    userId: user._id,
    verificationId: verification._id,
    action:
      decision === 'approve'
        ? IDENTITY_AUDIT_ACTIONS.ADMIN_APPROVED
        : decision === 'reject'
          ? IDENTITY_AUDIT_ACTIONS.ADMIN_REJECTED
          : IDENTITY_AUDIT_ACTIONS.DETAILS_CORRECTED,
    previousStatus: currentStatus,
    newStatus: nextStatus,
    performedBy: adminUser._id,
    actorRole: 'ADMIN',
    reason: reason || `Admin decision: ${decision}`,
    metadata: {
      verifiedLegalName: verification.verifiedLegalName,
    },
  })

  return { verification, user }
}

/**
 * Suspend an account for impersonation, fraud, or policy violations
 */
export async function suspendUserIdentity({ userId, adminUser, reason }) {
  const user = await User.findById(userId)
  if (!user) throw new Error('User not found')

  const currentStatus = user.identityStatus || IDENTITY_STATUS.UNVERIFIED
  const nextStatus = IDENTITY_STATUS.SUSPENDED

  if (!isValidStateTransition(currentStatus, nextStatus)) {
    throw new Error(`Cannot suspend account with current status ${currentStatus}`)
  }

  user.identityStatus = nextStatus
  user.isActive = false // Restrict platform access
  await user.save()

  if (user.identityVerificationRef) {
    await IdentityVerification.findByIdAndUpdate(user.identityVerificationRef, {
      status: nextStatus,
      rejectionReason: reason || 'Account suspended by admin for verification/impersonation policy review',
    })
  }

  await logIdentityAudit({
    userId: user._id,
    verificationId: user.identityVerificationRef,
    action: IDENTITY_AUDIT_ACTIONS.ADMIN_SUSPENDED,
    previousStatus: currentStatus,
    newStatus: nextStatus,
    performedBy: adminUser._id,
    actorRole: 'ADMIN',
    reason: reason || 'Account suspended by admin for policy violation',
  })

  return user
}

/**
 * Restore an account after successful review
 */
export async function restoreUserIdentity({ userId, adminUser, reason }) {
  const user = await User.findById(userId)
  if (!user) throw new Error('User not found')

  const currentStatus = user.identityStatus
  if (currentStatus !== IDENTITY_STATUS.SUSPENDED) {
    throw new Error('Only suspended accounts can be restored')
  }

  const nextStatus = user.isPhoneVerified ? IDENTITY_STATUS.CONTACT_VERIFIED : IDENTITY_STATUS.UNVERIFIED
  user.identityStatus = nextStatus
  user.isActive = true
  await user.save()

  if (user.identityVerificationRef) {
    await IdentityVerification.findByIdAndUpdate(user.identityVerificationRef, {
      status: nextStatus,
      reviewNotes: reason || 'Restored by admin after review',
    })
  }

  await logIdentityAudit({
    userId: user._id,
    verificationId: user.identityVerificationRef,
    action: IDENTITY_AUDIT_ACTIONS.ADMIN_RESTORED,
    previousStatus: currentStatus,
    newStatus: nextStatus,
    performedBy: adminUser._id,
    actorRole: 'ADMIN',
    reason: reason || 'Account restored by admin after review',
  })

  return user
}

/**
 * Verify Webhook Signature for external identity verification provider
 */
export function verifyProviderWebhookSignature(rawBody, signature, secret) {
  if (!signature || !secret) return false
  try {
    const hmac = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
    return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(signature))
  } catch {
    return false
  }
}

/**
 * Handle incoming provider webhooks with replay protection & idempotency
 */
export async function handleProviderWebhook({ eventId, signature, rawBody, payload }) {
  // 1. Replay attack prevention
  if (eventId && processedWebhookEvents.has(eventId)) {
    return { ok: true, duplicate: true, message: 'Event already processed' }
  }

  // 2. Signature verification
  const secret = process.env.IDENTITY_WEBHOOK_SECRET
  if (secret) {
    const validSig = verifyProviderWebhookSignature(rawBody, signature, secret)
    if (!validSig) {
      throw new Error('Invalid webhook signature')
    }
  }

  const { referenceId, status, verifiedLegalName, riskScore, failureReason } = payload

  const verification = await IdentityVerification.findOne({
    $or: [{ _id: referenceId }, { providerReference: referenceId }],
  }).populate('userId')

  if (!verification) {
    throw new Error('Verification reference not found')
  }

  if (eventId) {
    processedWebhookEvents.set(eventId, Date.now())
  }

  const currentStatus = verification.status
  let nextStatus = currentStatus

  if (status === 'SUCCESS' || status === 'VERIFIED') {
    nextStatus = IDENTITY_STATUS.VERIFIED
    verification.verifiedAt = new Date()
    if (verifiedLegalName) verification.verifiedLegalName = verifiedLegalName
  } else if (status === 'MANUAL_REVIEW' || status === 'CONFLICT') {
    nextStatus = IDENTITY_STATUS.MANUAL_REVIEW
  } else if (status === 'FAILED' || status === 'REJECTED') {
    nextStatus = IDENTITY_STATUS.REJECTED
    verification.rejectionReason = failureReason || 'Provider rejected verification'
  }

  if (isValidStateTransition(currentStatus, nextStatus)) {
    verification.status = nextStatus
    if (riskScore != null) verification.riskScore = riskScore
    await verification.save()

    const user = verification.userId
    if (user) {
      user.identityStatus = nextStatus
      if (verifiedLegalName) user.verifiedLegalName = verifiedLegalName
      if (nextStatus === IDENTITY_STATUS.VERIFIED && (user.role === USER_ROLES.LABOUR || user.role === USER_ROLES.CONTRACTOR)) {
        const pKey = user.role === USER_ROLES.CONTRACTOR ? 'contractorProfile' : 'labourProfile'
        if (user[pKey]) user[pKey].kycStatus = KYC_STATUS.VERIFIED
      }
      await user.save()
    }

    await logIdentityAudit({
      userId: verification.userId?._id,
      verificationId: verification._id,
      action: IDENTITY_AUDIT_ACTIONS.PROVIDER_WEBHOOK_RECEIVED,
      previousStatus: currentStatus,
      newStatus: nextStatus,
      actorRole: 'PROVIDER',
      reason: `Provider callback: status=${status}`,
      metadata: payload,
    })
  }

  return { ok: true, verification }
}
