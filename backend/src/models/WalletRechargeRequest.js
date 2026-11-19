import mongoose from 'mongoose'

export const RECHARGE_STATUS = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
}

export const ACCOUNT_TYPES = {
  USER: 'USER',
  WORKER: 'WORKER',
}

const walletRechargeRequestSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    accountType: {
      type: String,
      enum: Object.values(ACCOUNT_TYPES),
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Recharge amount is required'],
      min: [1, 'Recharge amount must be at least ₹1'],
    },
    currency: {
      type: String,
      default: 'INR',
    },
    paymentMode: {
      type: String,
      enum: ['UPI_QR', 'BANK_TRANSFER', 'ONLINE'],
      default: 'UPI_QR',
    },
    utrNumber: {
      type: String,
      required: [true, 'UTR / Transaction ID is required'],
      trim: true,
      uppercase: true,
      index: true,
    },
    paymentScreenshot: {
      type: String,
      required: [true, 'Payment screenshot receipt is required'],
      trim: true,
    },
    paymentScreenshotPublicId: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: Object.values(RECHARGE_STATUS),
      default: RECHARGE_STATUS.PENDING,
      index: true,
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: '',
    },
    adminRemarks: {
      type: String,
      trim: true,
      default: '',
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: {
      type: Date,
    },
    financialActionDetails: {
      transactionId: {
        type: String,
      },
      balanceBefore: {
        type: Number,
      },
      balanceAfter: {
        type: Number,
      },
      executedAt: {
        type: Date,
      },
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
)

// Optimized compound indexes for listing, filtering, and duplicate checking
walletRechargeRequestSchema.index({ userId: 1, createdAt: -1 })
walletRechargeRequestSchema.index({ status: 1, createdAt: -1 })
walletRechargeRequestSchema.index({ accountType: 1, status: 1, createdAt: -1 })
walletRechargeRequestSchema.index({ utrNumber: 1, status: 1 })

export const WalletRechargeRequest = mongoose.model(
  'WalletRechargeRequest',
  walletRechargeRequestSchema
)
