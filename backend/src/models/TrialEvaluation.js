import mongoose from 'mongoose'

const trialEvaluationSchema = new mongoose.Schema(
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
      required: true,
      index: true,
    },
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LabourService',
    },
    subcategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LabourSubcategory',
    },
    reviewerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    trialNumber: {
      type: Number,
      required: true,
    },
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5,
    },
    ratingComment: {
      type: String,
      trim: true,
    },
    result: {
      type: String,
      enum: ['PASSED', 'FAILED', 'PENDING'],
      required: true,
    },
    evaluationType: {
      type: String,
      enum: ['REGULAR_TRIAL', 'WARNING_CHANCE', 'FINAL_CHANCE', 'ADDITIONAL_TRIAL', 'MANUAL_OVERRIDE'],
      default: 'REGULAR_TRIAL',
    },
    configurationSnapshot: {
      passingRatingThreshold: Number,
      warningRatingThreshold: Number,
      configuredTrialCount: Number,
    },
    evaluatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
)

// Idempotency: One booking produces only one evaluation for a vendor
trialEvaluationSchema.index({ bookingId: 1, vendorId: 1 }, { unique: true })

export const TrialEvaluation = mongoose.model('TrialEvaluation', trialEvaluationSchema)
