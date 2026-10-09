import mongoose from 'mongoose'

const penaltyTierSchema = new mongoose.Schema(
  {
    minDelayMinutes: {
      type: Number,
      required: true,
      min: 0,
    },
    maxDelayMinutes: {
      type: Number,
      default: null, // null means and above
    },
    feeAmount: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false }
)

const penaltySettingSchema = new mongoose.Schema(
  {
    configKey: {
      type: String,
      default: 'master_penalty_config',
      unique: true,
      index: true,
    },
    // Global Master Settings
    enabled: {
      type: Boolean,
      default: false, // Disabled by default until admin enables
    },
    defaultGracePeriodMinutes: {
      type: Number,
      default: 15,
      min: 0,
    },
    autoDeductEnabled: {
      type: Boolean,
      default: false, // true = auto deduct on incident, false = creates PENDING_REVIEW
    },
    maxPenaltyPerBooking: {
      type: Number,
      default: 500,
      min: 0,
    },
    disputeDeadlineHours: {
      type: Number,
      default: 72, // 3 days to dispute
      min: 1,
    },
    noShowVerificationWindowMinutes: {
      type: Number,
      default: 60, // Wait 60m past appointment before marking no-show bounce
      min: 15,
    },
    precedencePolicy: {
      type: String,
      enum: ['BOUNCE_OVER_LATE', 'LATE_OVER_BOUNCE', 'ALLOW_BOTH'],
      default: 'BOUNCE_OVER_LATE',
    },

    // Late Fee Specific Settings
    lateFeeEnabled: {
      type: Boolean,
      default: true,
    },
    lateFeeMode: {
      type: String,
      enum: ['FIXED', 'TIERED'],
      default: 'FIXED',
    },
    fixedLateFeeAmount: {
      type: Number,
      default: 50,
      min: 0,
    },
    lateFeeTiers: {
      type: [penaltyTierSchema],
      default: [
        { minDelayMinutes: 15, maxDelayMinutes: 30, feeAmount: 50 },
        { minDelayMinutes: 31, maxDelayMinutes: 60, feeAmount: 100 },
        { minDelayMinutes: 61, maxDelayMinutes: null, feeAmount: 150 },
      ],
    },
    maxLateFeesPerBooking: {
      type: Number,
      default: 1,
    },

    // Bounce Penalty Specific Settings
    bouncePenaltyEnabled: {
      type: Boolean,
      default: true,
    },
    fixedBouncePenaltyAmount: {
      type: Number,
      default: 100,
      min: 0,
    },
    autoDetectNoShowBounce: {
      type: Boolean,
      default: true,
    },

    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
)

export const PenaltySetting = mongoose.model('PenaltySetting', penaltySettingSchema)
