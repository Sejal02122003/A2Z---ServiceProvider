import mongoose from 'mongoose'

export const POLICY_CYCLE_STATUS = {
  ACTIVE: 'ACTIVE',
  PENALTY_PENDING: 'PENALTY_PENDING',
  COMPLETED: 'COMPLETED',
  RESTARTED: 'RESTARTED',
  CLOSED: 'CLOSED',
}

const cancellationAttemptSchema = new mongoose.Schema(
  {
    attemptId: {
      type: String,
      required: true,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    reason: {
      type: String,
      trim: true,
    },
    reasonNote: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: [
        'INITIATED',
        'PENALTY_PENDING',
        'PAYMENT_PROCESSING',
        'PAYMENT_FAILED',
        'PENALTY_PAID',
        'POLICY_RESTARTED',
        'CANCELLED',
        'EXPIRED',
      ],
      default: 'INITIATED',
    },
    penaltyApplicable: {
      type: Boolean,
      default: false,
    },
    assessedPenaltyAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    penaltyRecordId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BookingCancellationPenalty',
    },
    paymentReference: {
      type: String,
      trim: true,
    },
  },
  { _id: true, timestamps: true }
)

const bookingCancellationCycleSchema = new mongoose.Schema(
  {
    cycleId: {
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
    cycleNumber: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
    previousCycleId: {
      type: String,
      trim: true,
    },
    applicablePolicyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'BookingCancellationSetting',
    },
    applicablePolicyVersion: {
      type: String,
      default: 'v1.0',
    },
    cycleStartTimestamp: {
      type: Date,
      default: Date.now,
    },
    cycleEndTimestamp: {
      type: Date,
    },
    cycleStatus: {
      type: String,
      enum: Object.values(POLICY_CYCLE_STATUS),
      default: POLICY_CYCLE_STATUS.ACTIVE,
      index: true,
    },
    restartTimestamp: {
      type: Date,
    },
    restartTimerMinutes: {
      type: Number,
      default: 60,
      min: 0,
    },
    restartExpiresAt: {
      type: Date,
    },
    cancellationAttempts: [cancellationAttemptSchema],
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
)

bookingCancellationCycleSchema.index({ bookingId: 1, cycleNumber: 1 }, { unique: true })
bookingCancellationCycleSchema.index({ customerId: 1, createdAt: -1 })

export const BookingCancellationCycle = mongoose.model(
  'BookingCancellationCycle',
  bookingCancellationCycleSchema
)
