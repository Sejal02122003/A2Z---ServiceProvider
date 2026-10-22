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
    partnerTrialSlots: [
      {
        id: { type: String, required: true },
        label: { type: String, required: true },
        desc: { type: String, default: '' },
        date: { type: String, default: '' }, // Specific YYYY-MM-DD or empty for all dates
        zoneId: { type: String, default: 'ALL' }, // Specific Zone _id or 'ALL'
        zoneName: { type: String, default: 'All Zones' }, // Human-readable zone name
        centerAddress: { type: String, default: '' }, // Specific Center/Hub address for this slot/zone
        isActive: { type: Boolean, default: true },
      },
    ],
    partnerTrialHubLocations: [
      {
        name: { type: String, required: true },
        address: { type: String, required: true },
        city: { type: String, default: '' },
        isActive: { type: Boolean, default: true },
      },
    ],
    zoneVenues: [
      {
        zoneId: { type: String, required: true },
        zoneName: { type: String, default: '' },
        venueAddress: { type: String, default: '' },
      },
    ],
    defaultHubLocation: {
      type: String,
      default: 'A2Z Partner Training & Evaluation Center, Sector 18, Noida',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
)

export const TrialConfiguration = mongoose.model('TrialConfiguration', trialConfigurationSchema)
