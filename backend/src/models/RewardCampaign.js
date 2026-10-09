import mongoose from 'mongoose'

export const REWARD_CATEGORY = {
  PERFORMANCE: 'PERFORMANCE',
  BUSINESS: 'BUSINESS',
}

export const CAMPAIGN_STATUS = {
  DRAFT: 'DRAFT',
  SCHEDULED: 'SCHEDULED',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  ENDED: 'ENDED',
  SETTLED: 'SETTLED',
}

export const APPROVAL_MODE = {
  AUTOMATIC: 'AUTOMATIC',
  MANUAL: 'MANUAL',
}

export const EVALUATION_PERIOD = {
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
  QUARTERLY: 'QUARTERLY',
  CUSTOM: 'CUSTOM',
}

const tierSchema = new mongoose.Schema(
  {
    tierNumber: { type: Number, required: true },
    targetValue: { type: Number, required: true, min: 1 },
    rewardAmount: { type: Number, required: true, min: 0 },
    label: { type: String, trim: true },
  },
  { _id: false }
)

const rewardCampaignSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Campaign name is required'],
      trim: true,
      maxlength: 120,
    },
    code: {
      type: String,
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 50,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    category: {
      type: String,
      enum: Object.values(REWARD_CATEGORY),
      required: [true, 'Reward category is required'],
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(CAMPAIGN_STATUS),
      default: CAMPAIGN_STATUS.DRAFT,
      index: true,
    },
    approvalMode: {
      type: String,
      enum: Object.values(APPROVAL_MODE),
      default: APPROVAL_MODE.AUTOMATIC,
    },
    destination: {
      type: String,
      enum: ['WALLET', 'EXTERNAL_PAYOUT'],
      default: 'WALLET',
    },
    evaluationPeriod: {
      type: String,
      enum: Object.values(EVALUATION_PERIOD),
      default: EVALUATION_PERIOD.MONTHLY,
    },
    startDate: {
      type: Date,
      required: [true, 'Start date is required'],
      index: true,
    },
    endDate: {
      type: Date,
      required: [true, 'End date is required'],
      index: true,
    },
    timeZone: {
      type: String,
      default: 'Asia/Kolkata',
    },
    termsAndConditions: {
      type: String,
      trim: true,
      maxlength: 3000,
    },

    // PERFORMANCE RULES
    performanceRules: {
      conditionLogic: {
        type: String,
        enum: ['ALL', 'ANY'],
        default: 'ALL',
      },
      minAverageRating: { type: Number, min: 1, max: 5 },
      minReviewsCount: { type: Number, min: 1 },
      minCompletedBookings: { type: Number, min: 1 },
      maxCancellationRatePct: { type: Number, min: 0, max: 100 },
      minOnTimeCompletionRatePct: { type: Number, min: 0, max: 100 },
      consecutivePeriodsRequired: { type: Number, default: 1, min: 1 },
      rewardAmount: { type: Number, min: 0 },
    },

    // BUSINESS RULES
    businessRules: {
      targetType: {
        type: String,
        enum: [
          'BOOKING_COUNT',
          'SERVICE_REVENUE',
          'NEW_CUSTOMERS',
          'REPEAT_CUSTOMERS',
          'CATEGORY_TARGET',
          'ZONE_TARGET',
        ],
        default: 'BOOKING_COUNT',
      },
      rewardType: {
        type: String,
        enum: ['FIXED', 'PERCENTAGE', 'TIERED'],
        default: 'FIXED',
      },
      fixedAmount: { type: Number, min: 0 },
      targetThreshold: { type: Number, min: 1 },
      percentage: { type: Number, min: 0, max: 100 },
      percentageBasis: {
        type: String,
        enum: ['TOTAL_REVENUE', 'LABOUR_SHARE', 'BOOKING_TOTAL'],
        default: 'TOTAL_REVENUE',
      },
      maxPercentageCap: { type: Number, min: 0 },
      tierPolicy: {
        type: String,
        enum: ['HIGHEST_TIER_ONLY', 'CUMULATIVE'],
        default: 'HIGHEST_TIER_ONLY',
      },
      tiers: [tierSchema],
    },

    // ELIGIBILITY FILTERS
    eligibility: {
      verifiedOnly: { type: Boolean, default: true },
      categoryIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'LabourCategory' }],
      serviceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'LabourService' }],
      cities: [{ type: String, trim: true }],
      zones: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Zone' }],
      includedVendorIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
      excludedVendorIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    },

    // BUDGET AND CAPS
    budget: {
      totalBudget: {
        type: Number,
        required: [true, 'Campaign budget is required'],
        min: [0, 'Budget cannot be negative'],
      },
      usedBudget: {
        type: Number,
        default: 0,
        min: 0,
      },
      reservedBudget: {
        type: Number,
        default: 0,
        min: 0,
      },
      maxRewardPerVendor: { type: Number, min: 0, default: null },
      maxEligibleVendors: { type: Number, min: 1, default: null },
      totalRewardsIssuedCount: { type: Number, default: 0 },
    },

    // AUDIT & LIFECYCLE
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    activatedAt: Date,
    pausedAt: Date,
    resumedAt: Date,
    endedAt: Date,
    lastEvaluatedAt: Date,
    pauseReason: String,
  },
  { timestamps: true }
)

// Indexing for active campaign lookups and deadline searches
rewardCampaignSchema.index({ status: 1, startDate: 1, endDate: 1 })
rewardCampaignSchema.index({ category: 1, status: 1 })

// Pre-save to auto-generate campaign code if not provided
rewardCampaignSchema.pre('validate', function (next) {
  if (!this.code && this.name) {
    const clean = this.name.toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 24)
    const rand = Math.floor(1000 + Math.random() * 9000)
    this.code = `${this.category === REWARD_CATEGORY.PERFORMANCE ? 'PRF' : 'BIZ'}_${clean}_${rand}`
  }
  next()
})

export const RewardCampaign = mongoose.model('RewardCampaign', rewardCampaignSchema)
