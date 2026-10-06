import mongoose from 'mongoose'

const platformFeeSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['fixed', 'percentage'],
      required: true,
      default: 'fixed',
    },
    value: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    isActive: { type: Boolean, default: true },
  },
  { _id: false }
)

const commissionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['global', 'category', 'service'],
      required: true,
      default: 'global',
    },
    globalPercentage: {
      type: Number,
      min: 0,
      max: 100,
      default: 10,
    },
    // Allows overriding commission per category if needed in future, currently just global is managed here
    isActive: { type: Boolean, default: true },
  },
  { _id: false }
)

const systemSettingSchema = new mongoose.Schema(
  {
    configKey: {
      type: String,
      unique: true,
      required: true,
      index: true,
      default: 'master_config',
    },
    platformFee: {
      type: platformFeeSchema,
      default: () => ({}),
    },

    commission: {
      type: commissionSchema,
      default: () => ({}),
    },
    paymentModes: {
      cashEnabled: { type: Boolean, default: true },
      onlineEnabled: { type: Boolean, default: true }
    },
    labourCashLimit: {
      type: Number,
      min: 0,
      default: 500,
    },
    cancellationPenalty: {
      type: Number,
      min: 0,
      default: 50,
    },
    globalBroadcastRadius: {
      type: Number,
      min: 1,
      default: 10,
    },
    timeSlots: {
      type: [String],
      default: ['08:00 AM', '10:00 AM', '12:00 PM', '02:00 PM', '04:00 PM', '06:00 PM'],
    },
    dailySubscriptionPrice: { type: Number, default: 19 },
    freeTrialDays: { type: Number, default: 3 },
    freeTrialMessage: { type: String, default: 'Welcome! Enjoy your free trial period.' },
    subscriptionStartHour: { type: Number, default: 8 }, // 8 AM
    subscriptionEndHour: { type: Number, default: 20 }, // 8 PM
    maxHourDiscountPercentage: { type: Number, default: 10 },
    isUserSubscriptionEnabled: { type: Boolean, default: false },
    simulatedOpportunitiesEnabled: { type: Boolean, default: true },
    branding: {
      logoUrl: { type: String, default: null },
      faviconUrl: { type: String, default: null },
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
)

export const SystemSetting = mongoose.model('SystemSetting', systemSettingSchema)
