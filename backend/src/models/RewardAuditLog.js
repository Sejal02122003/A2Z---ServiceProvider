import mongoose from 'mongoose'

export const REWARD_AUDIT_ACTION = {
  CAMPAIGN_CREATED: 'CAMPAIGN_CREATED',
  CAMPAIGN_UPDATED: 'CAMPAIGN_UPDATED',
  CAMPAIGN_ACTIVATED: 'CAMPAIGN_ACTIVATED',
  CAMPAIGN_PAUSED: 'CAMPAIGN_PAUSED',
  CAMPAIGN_RESUMED: 'CAMPAIGN_RESUMED',
  CAMPAIGN_ENDED: 'CAMPAIGN_ENDED',
  REWARD_QUALIFIED: 'REWARD_QUALIFIED',
  REWARD_APPROVED: 'REWARD_APPROVED',
  REWARD_REJECTED: 'REWARD_REJECTED',
  REWARD_CREDITED: 'REWARD_CREDITED',
  REWARD_REVERSED: 'REWARD_REVERSED',
  MANUAL_EVALUATION_TRIGGERED: 'MANUAL_EVALUATION_TRIGGERED',
  BUDGET_CAP_EXCEEDED: 'BUDGET_CAP_EXCEEDED',
}

const rewardAuditLogSchema = new mongoose.Schema(
  {
    campaignId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'RewardCampaign',
      index: true,
    },
    vendorRewardId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VendorReward',
      index: true,
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    actorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    actorRole: {
      type: String,
      enum: ['ADMIN', 'SYSTEM', 'VENDOR'],
      default: 'SYSTEM',
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    previousStatus: String,
    newStatus: String,
    amount: Number,
    reason: {
      type: String,
      trim: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  { timestamps: true }
)

rewardAuditLogSchema.index({ createdAt: -1 })

export const RewardAuditLog = mongoose.model('RewardAuditLog', rewardAuditLogSchema)
