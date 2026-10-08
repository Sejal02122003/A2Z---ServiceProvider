import mongoose from 'mongoose'

const trialConfigurationSchema = new mongoose.Schema(
  {
    configKey: {
      type: String,
      required: true,
      unique: true,
      default: 'default_trial_config',
      index: true,
    },
    freeTrialCount: {
      type: Number,
      required: true,
      default: 5,
      min: 1,
    },
    passingRatingThreshold: {
      type: Number,
      required: true,
      default: 4,
      min: 1,
      max: 5,
    },
    warningRatingThreshold: {
      type: Number,
      required: true,
      default: 3,
      min: 1,
      max: 5,
    },
    finalChanceEnabled: {
      type: Boolean,
      default: true,
    },
    finalChancePenaltyAmount: {
      type: Number,
      required: true,
      default: 500,
      min: 0,
    },
    ratingWindowHours: {
      type: Number,
      default: 48,
      min: 1,
    },
    adminApprovalRequired: {
      type: Boolean,
      default: true,
    },
    finalFailureAutoBlock: {
      type: Boolean,
      default: false,
    },
    evaluationMode: {
      type: String,
      enum: ['INDIVIDUAL_TRIAL_RATING', 'AVERAGE_RATING'],
      default: 'INDIVIDUAL_TRIAL_RATING',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
)

export const TrialConfiguration = mongoose.model('TrialConfiguration', trialConfigurationSchema)
