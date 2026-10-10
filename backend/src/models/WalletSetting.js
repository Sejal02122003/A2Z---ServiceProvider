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
    welcomeBonusAmount: {
      type: Number,
      default: 100,
      min: 0,
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
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
)

export const WalletSetting = mongoose.model('WalletSetting', walletSettingSchema)
