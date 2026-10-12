import mongoose from 'mongoose'

export const IDENTITY_AUDIT_ACTIONS = {
  REGISTRATION_ATTEMPT: 'REGISTRATION_ATTEMPT',
  CONTACT_VERIFIED: 'CONTACT_VERIFIED',
  IDENTITY_SUBMITTED: 'IDENTITY_SUBMITTED',
  PROVIDER_WEBHOOK_RECEIVED: 'PROVIDER_WEBHOOK_RECEIVED',
  NAME_MISMATCH_DETECTED: 'NAME_MISMATCH_DETECTED',
  MANUAL_REVIEW_FLAGGED: 'MANUAL_REVIEW_FLAGGED',
  ADMIN_APPROVED: 'ADMIN_APPROVED',
  ADMIN_REJECTED: 'ADMIN_REJECTED',
  ADMIN_SUSPENDED: 'ADMIN_SUSPENDED',
  ADMIN_RESTORED: 'ADMIN_RESTORED',
  APPEAL_SUBMITTED: 'APPEAL_SUBMITTED',
  DETAILS_CORRECTED: 'DETAILS_CORRECTED',
}

const identityAuditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    verificationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'IdentityVerification',
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: Object.values(IDENTITY_AUDIT_ACTIONS),
      index: true,
    },
    previousStatus: {
      type: String,
    },
    newStatus: {
      type: String,
    },
    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    actorRole: {
      type: String,
      enum: ['SYSTEM', 'USER', 'ADMIN', 'PROVIDER'],
      default: 'SYSTEM',
    },
    reason: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  { timestamps: true }
)

export const IdentityAuditLog = mongoose.model(
  'IdentityAuditLog',
  identityAuditLogSchema
)
