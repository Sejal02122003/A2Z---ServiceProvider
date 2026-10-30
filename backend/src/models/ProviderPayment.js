import mongoose from 'mongoose'

export const PAYMENT_STATUS = {
  PENDING: 'pending',
  SUBMITTED: 'submitted',
  UNDER_REVIEW: 'under_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
}

export const PAYMENT_PURPOSE = {
  WALLET_TOPUP: 'WALLET_TOPUP',
  WALLET_CLEARANCE: 'WALLET_CLEARANCE',
  SUBSCRIPTION: 'SUBSCRIPTION',
  TRIAL_PENALTY: 'TRIAL_PENALTY',
  BOOKING_COMMISSION: 'BOOKING_COMMISSION',
}

const auditTrailItemSchema = new mongoose.Schema(
  {
    fromStatus: {
      type: String,
      default: '',
    },
    toStatus: {
      type: String,
      required: true,
    },
    actor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    role: {
      type: String,
      default: 'provider',
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    note: {
      type: String,
      default: '',
    },
  },
  { _id: false }
)

const providerPaymentSchema = new mongoose.Schema(
  {
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    purpose: {
      type: String,
      enum: Object.values(PAYMENT_PURPOSE),
      default: PAYMENT_PURPOSE.WALLET_TOPUP,
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: [true, 'Payment amount is required'],
      min: [1, 'Payment amount must be at least ₹1'],
    },
    currency: {
      type: String,
      default: 'INR',
    },
    status: {
      type: String,
      enum: Object.values(PAYMENT_STATUS),
      default: PAYMENT_STATUS.PENDING,
      index: true,
    },
    utr: {
      type: String,
      trim: true,
      uppercase: true,
      index: true,
      default: null,
    },
    receiptUrl: {
      type: String,
      trim: true,
      default: '',
    },
    receiptStorageIdentifier: {
      type: String,
      trim: true,
      default: '',
    },
    qrConfigId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AdminPaymentConfig',
    },
    qrConfigVersion: {
      type: Number,
      default: 1,
    },
    qrSnapshot: {
      displayName: String,
      upiId: String,
      qrImageUrl: String,
    },
    notes: {
      type: String,
      trim: true,
      default: '',
      maxLength: 500,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: {
      type: Date,
    },
    rejectionReason: {
      type: String,
      trim: true,
      default: '',
    },
    paymentVerificationDetails: {
      verifiedAmount: Number,
      bankReference: String,
      notes: String,
      verifiedAt: Date,
    },
    financialActionExecuted: {
      type: Boolean,
      default: false,
      index: true,
    },
    financialActionDetails: {
      action: String,
      transactionId: String,
      balanceBefore: Number,
      balanceAfter: Number,
      executedAt: Date,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    auditTrail: [auditTrailItemSchema],
  },
  { timestamps: true }
)

providerPaymentSchema.index({ providerId: 1, createdAt: -1 })
providerPaymentSchema.index({ status: 1, createdAt: -1 })
providerPaymentSchema.index({ utr: 1, status: 1 })

export const ProviderPayment = mongoose.model('ProviderPayment', providerPaymentSchema)
