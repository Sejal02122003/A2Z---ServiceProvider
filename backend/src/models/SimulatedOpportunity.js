import mongoose from 'mongoose'

const vendorResponseSchema = new mongoose.Schema(
  {
    vendorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    response: {
      type: String,
      enum: ['VIEWED', 'REJECTED'],
      required: true,
    },
    respondedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
)

const simulatedOpportunitySchema = new mongoose.Schema(
  {
    bookingType: {
      type: String,
      enum: ['SIMULATED'],
      default: 'SIMULATED',
      required: true,
      index: true,
    },
    isSimulated: {
      type: Boolean,
      default: true,
      required: true,
      index: true,
    },
    serviceCategory: {
      type: String,
      trim: true,
      required: true,
    },
    serviceType: {
      type: String,
      trim: true,
      required: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LabourCategory',
    },
    subcategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LabourSubcategory',
    },
    location: {
      address: { type: String, trim: true },
      city: { type: String, trim: true },
      latitude: { type: Number },
      longitude: { type: Number },
    },
    serviceDate: {
      type: Date,
    },
    serviceTime: {
      type: String,
      trim: true,
    },
    estimatedAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      enum: ['OPEN', 'ACCEPTED', 'EXPIRED', 'CANCELLED'],
      default: 'OPEN',
      required: true,
      index: true,
    },
    priority: {
      type: String,
      enum: ['NORMAL', 'HIGH', 'URGENT'],
      default: 'NORMAL',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    acceptedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    acceptedAt: {
      type: Date,
      default: null,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    targetVendorCount: {
      type: Number,
      default: 10,
    },
    notifiedVendors: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    vendorResponses: [vendorResponseSchema],
  },
  {
    timestamps: true,
    collection: 'simulated_opportunities',
  }
)

simulatedOpportunitySchema.index({ notifiedVendors: 1, status: 1 })

export const SimulatedOpportunity = mongoose.model(
  'SimulatedOpportunity',
  simulatedOpportunitySchema
)
