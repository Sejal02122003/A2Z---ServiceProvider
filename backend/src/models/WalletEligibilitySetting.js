import mongoose from 'mongoose'

const walletEligibilitySettingSchema = new mongoose.Schema(
  {
    configKey: {
      type: String,
      unique: true,
      required: true,
      default: 'wallet_eligibility_config',
      index: true,
    },
    minimumWalletBalance: {
      type: Number,
      required: true,
      min: 0,
      default: 300,
    },
    commissionPercentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      default: 25,
    },
    eligibilitySystemEnabled: {
      type: Boolean,
      default: true,
    },
    commissionReservationEnabled: {
      type: Boolean,
      default: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    auditLog: [
      {
        action: { type: String, default: 'CONFIG_UPDATED' },
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        oldValues: { type: mongoose.Schema.Types.Mixed },
        newValues: { type: mongoose.Schema.Types.Mixed },
        reason: { type: String },
        changedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
)

export const WalletEligibilitySetting = mongoose.model(
  'WalletEligibilitySetting',
  walletEligibilitySettingSchema
)
