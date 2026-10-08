import mongoose from 'mongoose'

export const FINAL_CHANCE_STATUS = {
  PENDING: 'PENDING',
  PAYMENT_PENDING: 'PAYMENT_PENDING',
  PAYMENT_PROCESSING: 'PAYMENT_PROCESSING',
  PAID: 'PAID',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PAYMENT_EXPIRED: 'PAYMENT_EXPIRED',
  CANCELLED: 'CANCELLED',
  ACTIVATED: 'ACTIVATED',
  WAIVED: 'WAIVED',
}

const finalChanceRequestSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    trialId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'VendorTrial',
      required: true,
      index: true,
    },
    penaltyAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: Object.values(FINAL_CHANCE_STATUS),
      default: FINAL_CHANCE_STATUS.PAYMENT_PENDING,
      index: true,
    },
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'PaymentTransaction',
    },
    razorpayOrderId: {
      type: String,
    },
    razorpayPaymentId: {
      type: String,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    paidAt: {
      type: Date,
    },
    activatedAt: {
      type: Date,
    },
    waivedAt: {
      type: Date,
    },
    waivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    waiveReason: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
)

export const FinalChanceRequest = mongoose.model('FinalChanceRequest', finalChanceRequestSchema)
