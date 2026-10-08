import mongoose from 'mongoose'

export const TRIAL_AUDIT_ACTIONS = {
  TRIAL_STARTED: 'TRIAL_STARTED',
  TRIAL_COMPLETED: 'TRIAL_COMPLETED',
  RATING_RECEIVED: 'RATING_RECEIVED',
  TRIAL_PASSED: 'TRIAL_PASSED',
  TRIAL_FAILED: 'TRIAL_FAILED',
  WARNING_ISSUED: 'WARNING_ISSUED',
  FINAL_FAILURE: 'FINAL_FAILURE',
  FINAL_CHANCE_REQUESTED: 'FINAL_CHANCE_REQUESTED',
  PAYMENT_CREATED: 'PAYMENT_CREATED',
  PAYMENT_SUCCESS: 'PAYMENT_SUCCESS',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  FINAL_CHANCE_ACTIVATED: 'FINAL_CHANCE_ACTIVATED',
  FINAL_CHANCE_FAILED: 'FINAL_CHANCE_FAILED',
  FINAL_CHANCE_PASSED: 'FINAL_CHANCE_PASSED',
  VENDOR_CONFIRMED: 'VENDOR_CONFIRMED',
  VENDOR_REJECTED: 'VENDOR_REJECTED',
  VENDOR_BLOCKED: 'VENDOR_BLOCKED',
  VENDOR_UNBLOCKED: 'VENDOR_UNBLOCKED',
  TRIAL_PAUSED: 'TRIAL_PAUSED',
  TRIAL_RESUMED: 'TRIAL_RESUMED',
  TRIAL_EXTENDED: 'TRIAL_EXTENDED',
  ADMIN_REVIEW_REQUESTED: 'ADMIN_REVIEW_REQUESTED',
  ADMIN_OVERRIDE: 'ADMIN_OVERRIDE',
  PENALTY_WAIVED: 'PENALTY_WAIVED',
}

const trialAuditLogSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    trialId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VendorTrial',
      index: true,
    },
    action: {
      type: String,
      required: true,
      enum: Object.values(TRIAL_AUDIT_ACTIONS),
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
      enum: ['ADMIN', 'VENDOR', 'CUSTOMER', 'SYSTEM'],
      default: 'SYSTEM',
    },
    reason: {
      type: String,
      trim: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
    },
    trialEvaluationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TrialEvaluation',
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PaymentTransaction',
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

export const TrialAuditLog = mongoose.model('TrialAuditLog', trialAuditLogSchema)
