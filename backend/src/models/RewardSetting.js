import mongoose from 'mongoose'

const rewardSettingSchema = new mongoose.Schema(
  {
    configKey: {
      type: String,
      default: 'master_reward_config',
      unique: true,
      index: true,
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    autoReconciliationEnabled: {
      type: Boolean,
      default: true,
    },
    reconciliationIntervalMinutes: {
      type: Number,
      default: 60,
      min: 5,
    },
    globalRewardPause: {
      type: Boolean,
      default: false,
    },
    maxGlobalBudgetPerMonth: {
      type: Number,
      default: 500000,
      min: 0,
    },
    defaultApprovalMode: {
      type: String,
      enum: ['AUTOMATIC', 'MANUAL'],
      default: 'AUTOMATIC',
    },
    notifyOnMilestonePct: {
      type: [Number],
      default: [50, 75, 100],
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
)

export const RewardSetting = mongoose.model('RewardSetting', rewardSettingSchema)
