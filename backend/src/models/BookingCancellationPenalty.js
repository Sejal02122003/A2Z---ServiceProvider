import mongoose from 'mongoose'

export const PENALTY_PAYMENT_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  PAID: 'PAID',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
  REVERSED: 'REVERSED',
}

export const PENALTY_STATUS = {
  PENDING: 'PENDING',
  PAID: 'PAID',
  WAIVED: 'WAIVED',
  CANCELLED: 'CANCELLED',
}

const bookingCancellationPenaltySchema = new mongoose.Schema(
  {
    penaltyId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    cancellationAttemptId: {
      type: String,
      required: true,
      index: true,
    },
    policyCycleId: {
      type: String,
      required: true,
      index: true,
    },
    policyCycleNumber: {
      type: Number,
      required: true,
      default: 1,
    },
    policyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BookingCancellationSetting',
    },
    policyVersion: {
      type: String,
      default: 'v1.0',
    },
    originalApplicableBookingAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    previouslyPaidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    penaltyCalculationType: {
      type: String,
      enum: ['FIXED', 'PERCENTAGE'],
      required: true,
      default: 'PERCENTAGE',
    },
    configuredPenaltyValue: {
      type: Number,
      required: true,
      min: 0,
    },
    calculatedPenaltyAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    minLimitApplied: {
      type: Boolean,
      default: false,
    },
    maxLimitApplied: {
      type: Boolean,
      default: false,
    },
    amountPaid: {
      type: Number,
      default: 0,
      min: 0,
    },
    outstandingAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    paymentReference: {
      type: String,
      trim: true,
      index: true,
    },
    razorpayOrderId: {
      type: String,
      trim: true,
      index: true,
    },
    razorpayPaymentId: {
      type: String,
      trim: true,
      index: true,
    },
    razorpaySignature: {
      type: String,
      trim: true,
    },
    paymentStatus: {
      type: String,
      enum: Object.values(PENALTY_PAYMENT_STATUS),
      default: PENALTY_PAYMENT_STATUS.PENDING,
      index: true,
    },
    penaltyStatus: {
      type: String,
      enum: Object.values(PENALTY_STATUS),
      default: PENALTY_STATUS.PENDING,
      index: true,
    },
    paidAt: {
      type: Date,
    },
    lineItemDescription: {
      type: String,
      trim: true,
      default: 'Cancellation Penalty Fee',
    },
    adminNotes: {
      type: String,
      trim: true,
    },
    waiverReason: {
      type: String,
      trim: true,
    },
    waivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    waivedAt: {
      type: Date,
    },
    refundReason: {
      type: String,
      trim: true,
    },
    refundedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    refundedAt: {
      type: Date,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
)

bookingCancellationPenaltySchema.index({ customerId: 1, createdAt: -1 })
bookingCancellationPenaltySchema.index({ bookingId: 1, policyCycleNumber: 1 })

export const BookingCancellationPenalty = mongoose.model(
  'BookingCancellationPenalty',
  bookingCancellationPenaltySchema
)
