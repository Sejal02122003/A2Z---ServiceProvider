import mongoose from 'mongoose'

const walletSettingSchema = new mongoose.Schema(
  {
    configKey: {
      type: String,
      unique: true,
      required: true,
      default: 'master_wallet_config',
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    welcomeBonusEnabled: {
      type: Boolean,
      default: true,
    },
    welcomeBonusAmount: {
      type: Number,
      default: 1000,
      min: 500,
      max: 1500,
    },
    walletDiscountPercentage: {
      type: Number,
      default: 20,
      min: 0,
      max: 100,
    },
    minimumBookingAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    minimumLabourWalletBalance: {
      type: Number,
      default: 0,
      min: 0,
    },
    // Automatic Service-Based Wallet Credit Settings (15% default)
    serviceCreditEnabled: {
      type: Boolean,
      default: true,
    },
    serviceCreditPercentage: {
      type: Number,
      default: 15,
      min: 0,
      max: 100,
    },
    serviceCreditMaxAmount: {
      type: Number,
      default: 0, // 0 = unlimited
      min: 0,
    },
    serviceCreditMinBookingAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    serviceCreditApplicablePaymentMethods: {
      type: [String],
      default: ['ONLINE', 'CASH'],
    },
    serviceCreditVersion: {
      type: Number,
      default: 1,
    },
    auditLog: [
      {
        action: { type: String, default: 'CONFIG_UPDATED' },
        performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        timestamp: { type: Date, default: Date.now },
        oldValues: { type: mongoose.Schema.Types.Mixed },
        newValues: { type: mongoose.Schema.Types.Mixed },
        reason: { type: String },
      },
    ],
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
)

export const WalletSetting = mongoose.model('WalletSetting', walletSettingSchema)
