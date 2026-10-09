import mongoose from 'mongoose'

export const CANCELLATION_STATUS = {
  PENDING_APPROVAL: 'PENDING_APPROVAL',
  APPROVED: 'APPROVED',
  CANCELLED: 'CANCELLED',
  REJECTED: 'REJECTED',
}

export const TIMING_CLASSIFICATION = {
  STANDARD: 'STANDARD',
  LATE: 'LATE',
  EXPIRED: 'EXPIRED',
}

export const CANCELLATION_PENALTY_STATUS = {
  NOT_APPLICABLE: 'NOT_APPLICABLE',
  PENDING: 'PENDING',
  RECOVERED: 'RECOVERED',
  WAIVED: 'WAIVED',
}

export const APPROVAL_STATUS = {
  NOT_REQUIRED: 'NOT_REQUIRED',
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
}

const bookingCancellationRecordSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true,
    },
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    previousBookingStatus: {
      type: String,
      required: true,
    },
    cancellationStatus: {
      type: String,
      enum: Object.values(CANCELLATION_STATUS),
      default: CANCELLATION_STATUS.CANCELLED,
      index: true,
    },
    timingClassification: {
      type: String,
      enum: Object.values(TIMING_CLASSIFICATION),
      required: true,
      index: true,
    },
    serviceStartDateTime: {
      type: Date,
      required: true,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: {
      type: Date,
    },
    timeRemainingMinutes: {
      type: Number,
      default: 0,
    },
    cutoffHoursSnapshot: {
      type: Number,
      default: 2,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    reasonCategory: {
      type: String,
      trim: true,
    },
    penaltyType: {
      type: String,
      enum: ['FIXED', 'PERCENTAGE', 'NONE'],
      default: 'NONE',
    },
    penaltyRateOrAmount: {
      type: Number,
      default: 0,
    },
    assessedPenaltyAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    penaltyStatus: {
      type: String,
      enum: Object.values(CANCELLATION_PENALTY_STATUS),
      default: CANCELLATION_PENALTY_STATUS.NOT_APPLICABLE,
      index: true,
    },
    deductedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    walletTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WalletTransaction',
    },
    approvalStatus: {
      type: String,
      enum: Object.values(APPROVAL_STATUS),
      default: APPROVAL_STATUS.NOT_REQUIRED,
      index: true,
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedAt: {
      type: Date,
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
    // Deduplication key to prevent multiple records for same booking cancellation attempt
    dedupeKey: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
  },
  { timestamps: true }
)

bookingCancellationRecordSchema.index({ vendorId: 1, createdAt: -1 })
bookingCancellationRecordSchema.index({ cancellationStatus: 1, createdAt: -1 })

export const BookingCancellationRecord = mongoose.model(
  'BookingCancellationRecord',
  bookingCancellationRecordSchema
)
