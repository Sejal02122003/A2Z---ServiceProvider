import mongoose from 'mongoose'

const walletReservationSchema = new mongoose.Schema(
  {
    providerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
    },
    estimatedBookingAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    commissionPercentageSnapshot: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
    },
    estimatedCommissionAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    minimumBalanceSnapshot: {
      type: Number,
      required: true,
      min: 0,
    },
    reservedAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['RESERVED', 'SETTLED', 'RELEASED'],
      default: 'RESERVED',
      index: true,
    },
    settledAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    releasedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    settledAt: {
      type: Date,
    },
    releasedAt: {
      type: Date,
    },
    releaseReason: {
      type: String,
      trim: true,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
)

// Compound index for querying a provider's reservations
walletReservationSchema.index({ providerId: 1, status: 1, createdAt: -1 })

// Prevent duplicate active reservations for the same booking
walletReservationSchema.index(
  { bookingId: 1 },
  { unique: true, partialFilterExpression: { status: 'RESERVED' } }
)

export const WalletReservation = mongoose.model(
  'WalletReservation',
  walletReservationSchema
)
