import mongoose from 'mongoose'

const serviceProductSchema = new mongoose.Schema(
  {
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LabourService',
      required: true,
      index: true,
    },
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      index: true,
    },
    quantityRequired: {
      type: Number,
      required: true,
      min: 0.01,
      default: 1,
    },
    unit: {
      type: String,
      trim: true,
      default: 'Piece',
    },
    isMandatory: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  { timestamps: true }
)

// Ensure unique mapping per active service-product pair
serviceProductSchema.index({ serviceId: 1, productId: 1 }, { unique: true })

export const ServiceProduct = mongoose.model('ServiceProduct', serviceProductSchema)
