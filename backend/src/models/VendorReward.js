import mongoose from 'mongoose'

export const VENDOR_REWARD_STATUS = {
  IN_PROGRESS: 'IN_PROGRESS',
  QUALIFIED: 'QUALIFIED',
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  CREDITED: 'CREDITED',
  REJECTED: 'REJECTED',
  REVERSED: 'REVERSED',
  EXPIRED: 'EXPIRED',
}

const vendorRewardSchema = new mongoose.Schema(
  {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RewardCampaign',
      required: true,
      index: true,
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    evaluationPeriod: {
      type: String,
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ['PERFORMANCE', 'BUSINESS'],
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(VENDOR_REWARD_STATUS),
      default: VENDOR_REWARD_STATUS.IN_PROGRESS,
      index: true,
    },

    // REAL-TIME PROGRESS TRACKING
    currentProgress: {
      completedBookings: { type: Number, default: 0 },
      totalRevenue: { type: Number, default: 0 },
      averageRating: { type: Number, default: 0 },
      reviewsCount: { type: Number, default: 0 },
      cancellationRate: { type: Number, default: 0 },
      onTimeRate: { type: Number, default: 0 },
      newCustomersCount: { type: Number, default: 0 },
      repeatCustomersCount: { type: Number, default: 0 },
      currentValue: { type: Number, default: 0 },
      targetRequired: { type: Number, default: 0 },
      achievedPercentage: { type: Number, default: 0 },
      unit: { type: String, default: 'bookings' },
      remainingRequired: { type: Number, default: 0 },
      lastCalculatedAt: { type: Date, default: Date.now },
    },

    // QUALIFICATION EVIDENCE SNAPSHOTS
    qualificationEvidence: {
      qualifiedAt: Date,
      criteriaSnapshots: { type: mongoose.Schema.Types.Mixed },
      qualifyingBookingIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Booking' }],
      qualifyingReviewIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Review' }],
      qualifyingTier: Number,
      qualifyingTierLabel: String,
      notes: String,
    },

    rewardAmount: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
    rewardType: {
      type: String,
      default: 'FIXED',
    },

    // APPROVAL WORKFLOW
    approvalMode: {
      type: String,
      enum: ['AUTOMATIC', 'MANUAL'],
      default: 'AUTOMATIC',
    },
    approvalDetails: {
      reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      reviewedAt: Date,
      action: { type: String, enum: ['APPROVED', 'REJECTED', 'NONE'], default: 'NONE' },
      reason: { type: String, trim: true },
      notes: { type: String, trim: true },
    },

    // WALLET FINANCIAL TRANSACTION
    creditDetails: {
      walletId: { type: mongoose.Schema.Types.ObjectId, ref: 'Wallet' },
      walletTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'WalletTransaction' },
      creditedAt: Date,
      idempotencyKey: { type: String, sparse: true, index: true },
      reversalTransactionId: { type: mongoose.Schema.Types.ObjectId, ref: 'WalletTransaction' },
      reversedAt: Date,
      reversedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      reversalReason: { type: String, trim: true },
    },
  },
  { timestamps: true }
)

// Ensure one record per vendor per campaign per evaluation period (Idempotency guarantee)
vendorRewardSchema.index({ campaignId: 1, vendorId: 1, evaluationPeriod: 1 }, { unique: true })
vendorRewardSchema.index({ vendorId: 1, status: 1 })
vendorRewardSchema.index({ status: 1, createdAt: -1 })

export const VendorReward = mongoose.model('VendorReward', vendorRewardSchema)
