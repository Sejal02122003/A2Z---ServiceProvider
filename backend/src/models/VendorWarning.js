import mongoose from 'mongoose'

const vendorWarningSchema = new mongoose.Schema(
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
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
    },
    trialEvaluationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TrialEvaluation',
    },
    rating: {
      type: Number,
    },
    warningNumber: {
      type: Number,
      default: 1,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    issuedAt: {
      type: Date,
      default: Date.now,
    },
    issuedBy: {
      type: String,
      default: 'SYSTEM',
    },
  },
  { timestamps: true }
)

export const VendorWarning = mongoose.model('VendorWarning', vendorWarningSchema)
