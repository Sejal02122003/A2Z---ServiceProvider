import mongoose from 'mongoose'

const labourServiceSchema = new mongoose.Schema(
  {
    subcategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LabourSubcategory',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    basePrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    estimatedDurationMins: {
      type: Number,
      default: 60,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    iconUrl: {
      type: String,
      trim: true,
    },
    hourlyPrice: {
      type: Number,
      default: 0,
      min: 0,
    },
    minHours: {
      type: Number,
      default: 1,
      min: 0.5, // supports 30-min bookings
    },
    maxHours: {
      type: Number,
      default: 24,
      min: 1,
    },
    discountType: {
      type: String,
      enum: ['FIXED', 'PERCENTAGE'],
      default: 'PERCENTAGE',
    },
    discountValue: {
      type: Number,
      default: 0,
      min: 0,
    },
    offerBadge: {
      type: String,
      trim: true,
      default: '',
    },
    offerDescription: {
      type: String,
      trim: true,
      default: '',
    },
    isAllZones: {
      type: Boolean,
      default: true,
    },
    zones: [
      {
        zone: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Zone',
        },
        price: {
          type: Number,
          default: 0,
        }
      }
    ],
  },
  { timestamps: true }
)

// Ensure service names are unique within a subcategory
labourServiceSchema.index({ subcategoryId: 1, name: 1 }, { unique: true })

export const LabourService = mongoose.model('LabourService', labourServiceSchema)
