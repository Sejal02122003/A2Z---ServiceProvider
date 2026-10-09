import mongoose from 'mongoose'

export const PENALTY_TYPE = {
  LATE_FEE: 'LATE_FEE',
  BOUNCE_PENALTY: 'BOUNCE_PENALTY',
}

export const PENALTY_STATUS = {
  DETECTED: 'DETECTED',
  PENDING_REVIEW: 'PENDING_REVIEW',
  APPROVED: 'APPROVED',
  APPLIED: 'APPLIED',
  DISPUTED: 'DISPUTED',
  WAIVED: 'WAIVED',
  REJECTED: 'REJECTED',
  REVERSED: 'REVERSED',
}

const disputeSchema = new mongoose.Schema(
  {
    isDisputed: {
      type: Boolean,
      default: false,
    },
    submittedAt: Date,
    reason: {
      type: String,
      trim: true,
    },
    evidenceUrls: [String],
    status: {
      type: String,
      enum: ['PENDING', 'ACCEPTED', 'REJECTED'],
      default: 'PENDING',
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reviewedAt: Date,
    adminNotes: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
)

const waiverSchema = new mongoose.Schema(
  {
    isWaived: {
      type: Boolean,
      default: false,
    },
    waivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    waivedAt: Date,
    reason: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
)

const reversalSchema = new mongoose.Schema(
  {
    isReversed: {
      type: Boolean,
      default: false,
    },
    reversedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    reversedAt: Date,
    reason: {
      type: String,
      trim: true,
    },
    refundTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WalletTransaction',
    },
  },
  { _id: false }
)

const vendorPenaltySchema = new mongoose.Schema(
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
    penaltyType: {
      type: String,
      enum: Object.values(PENALTY_TYPE),
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(PENALTY_STATUS),
      default: PENALTY_STATUS.DETECTED,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    deductedAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    unpaidAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    incidentTime: {
      type: Date,
      default: Date.now,
    },
    delayMinutes: {
      type: Number,
      default: 0,
    },
    gracePeriodMinutes: {
      type: Number,
      default: 15,
    },
    scheduledAppointmentTime: {
      type: Date,
    },
    actualArrivalTime: {
      type: Date,
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    evidence: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    dispute: {
      type: disputeSchema,
      default: () => ({}),
    },
    waiver: {
      type: waiverSchema,
      default: () => ({}),
    },
    reversal: {
      type: reversalSchema,
      default: () => ({}),
    },
    walletTransactionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'WalletTransaction',
    },
    dedupeKey: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    actionAudit: [
      {
        action: String,
        performedBy: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
        performedAt: {
          type: Date,
          default: Date.now,
        },
        notes: String,
      },
    ],
  },
  { timestamps: true }
)

vendorPenaltySchema.index({ status: 1, createdAt: -1 })
vendorPenaltySchema.index({ vendorId: 1, status: 1 })
vendorPenaltySchema.index({ bookingId: 1, penaltyType: 1 })

export const VendorPenalty = mongoose.model('VendorPenalty', vendorPenaltySchema)
