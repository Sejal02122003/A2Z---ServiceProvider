import mongoose from 'mongoose'

export const VENDOR_TRIAL_STATUS = {
  NOT_STARTED: 'NOT_STARTED',
  TRIAL_ACTIVE: 'TRIAL_ACTIVE',
  TRIAL_PAUSED: 'TRIAL_PAUSED',
  WARNING: 'WARNING',
  TRIAL_COMPLETED: 'TRIAL_COMPLETED',
  PENDING_ADMIN_CONFIRMATION: 'PENDING_ADMIN_CONFIRMATION',
  ADMIN_REVIEW_REQUIRED: 'ADMIN_REVIEW_REQUIRED',
  CONFIRMED: 'CONFIRMED',
  FINAL_FAILURE: 'FINAL_FAILURE',
  FINAL_CHANCE_PAYMENT_PENDING: 'FINAL_CHANCE_PAYMENT_PENDING',
  FINAL_CHANCE_PAYMENT_FAILED: 'FINAL_CHANCE_PAYMENT_FAILED',
  FINAL_CHANCE_ACTIVE: 'FINAL_CHANCE_ACTIVE',
  BLOCKED: 'BLOCKED',
  REJECTED: 'REJECTED',
}

const vendorTrialSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(VENDOR_TRIAL_STATUS),
      default: VENDOR_TRIAL_STATUS.NOT_STARTED,
      index: true,
    },
    // Snapshot configuration values
    configuredTrialCount: {
      type: Number,
      required: true,
      default: 5,
    },
    adminGrantedAdditionalTrials: {
      type: Number,
      default: 0,
    },
    completedTrialCount: {
      type: Number,
      default: 0,
    },
    passedTrialCount: {
      type: Number,
      default: 0,
    },
    failedTrialCount: {
      type: Number,
      default: 0,
    },
    passingRatingThreshold: {
      type: Number,
      default: 4,
    },
    warningRatingThreshold: {
      type: Number,
      default: 3,
    },
    warningIssued: {
      type: Boolean,
      default: false,
    },
    warningCount: {
      type: Number,
      default: 0,
    },
    warningChanceUsed: {
      type: Boolean,
      default: false,
    },
    finalChanceEnabled: {
      type: Boolean,
      default: true,
    },
    finalChanceAllowed: {
      type: Boolean,
      default: true,
    },
    finalChanceUsed: {
      type: Boolean,
      default: false,
    },
    finalChancePenaltyAmount: {
      type: Number,
      default: 500,
    },
    finalChancePenaltyPaid: {
      type: Boolean,
      default: false,
    },
    eligibleForConfirmation: {
      type: Boolean,
      default: false,
      index: true,
    },
    // Lifecycle Timestamps & Meta
    startedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
    confirmedAt: {
      type: Date,
    },
    confirmedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    confirmationNotes: {
      type: String,
      trim: true,
    },
    rejectedAt: {
      type: Date,
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    rejectionReason: {
      type: String,
      trim: true,
    },
    blockedAt: {
      type: Date,
    },
    blockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    blockReason: {
      type: String,
      trim: true,
    },
    reviewRequestedAt: {
      type: Date,
    },
    reviewRequestedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewReason: {
      type: String,
      trim: true,
    },
    pausedAt: {
      type: Date,
    },
    pausedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    pauseReason: {
      type: String,
      trim: true,
    },
    resumedAt: {
      type: Date,
    },
    resumedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    ratingWindowHours: {
      type: Number,
      default: 48,
    },
  },
  { timestamps: true }
)

export const VendorTrial = mongoose.model('VendorTrial', vendorTrialSchema)
