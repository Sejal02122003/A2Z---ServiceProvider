import mongoose from 'mongoose'

const materialRequestItemSchema = new mongoose.Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    quantityRequired: {
      type: Number,
      required: true,
      default: 1,
      min: 0,
    },
    quantityRequested: {
      type: Number,
      required: true,
      default: 1,
      min: 0,
    },
    quantityApproved: {
      type: Number,
      default: 0,
      min: 0,
    },
    quantityIssued: {
      type: Number,
      default: 0,
      min: 0,
    },
    quantityUsed: {
      type: Number,
      default: 0,
      min: 0,
    },
    quantityReturned: {
      type: Number,
      default: 0,
      min: 0,
    },
    unit: {
      type: String,
      default: 'Piece',
    },
    isMandatory: {
      type: Boolean,
      default: true,
    },
    isAdditional: {
      type: Boolean,
      default: false,
    },
    alternativeIssuedProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
    },
    itemStatus: {
      type: String,
      enum: [
        'AVAILABLE',
        'LOW_STOCK',
        'OUT_OF_STOCK',
        'PARTIALLY_AVAILABLE',
        'WAITING_FOR_STOCK',
        'READY_FOR_ISSUE',
        'PARTIALLY_ISSUED',
        'ISSUED',
        'ALTERNATIVE_ISSUED',
        'USED',
        'RETURNED',
        'REJECTED',
      ],
      default: 'AVAILABLE',
    },
    shortageQuantity: {
      type: Number,
      default: 0,
      min: 0,
    },
    remarks: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { _id: true }
)

const materialRequestSchema = new mongoose.Schema(
  {
    requestId: {
      type: String,
      unique: true,
      index: true,
    },
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
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LabourService',
      required: true,
    },
    status: {
      type: String,
      enum: [
        'REQUESTED',
        'APPROVED',
        'WAITING_FOR_STOCK',
        'READY_FOR_ISSUE',
        'PARTIALLY_ISSUED',
        'ISSUED',
        'IN_USE',
        'COMPLETED',
        'RETURNED',
        'REJECTED',
        'CANCELLED',
      ],
      default: 'REQUESTED',
      index: true,
    },
    items: [materialRequestItemSchema],
    requestRemarks: {
      type: String,
      trim: true,
      default: '',
    },
    adminRemarks: {
      type: String,
      trim: true,
      default: '',
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    approvedAt: {
      type: Date,
    },
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    issuedAt: {
      type: Date,
    },
    completedAt: {
      type: Date,
    },
  },
  { timestamps: true }
)

export function generateRequestId() {
  return `REQ-${Date.now().toString(36).toUpperCase()}-${Math.floor(100 + Math.random() * 900)}`
}

export const MaterialRequest = mongoose.model('MaterialRequest', materialRequestSchema)
