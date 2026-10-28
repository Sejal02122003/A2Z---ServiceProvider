import mongoose from 'mongoose'

const inclusionSchema = new mongoose.Schema(
  {
    serviceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LabourService',
      required: false,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    brand: {
      type: String,
      trim: true,
      default: '',
    },
    quantity: {
      type: Number,
      default: 1,
      min: [1, 'Quantity must be at least 1'],
    },
    duration: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { _id: false }
)

const servicePackageSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Package name is required'],
      trim: true,
      maxlength: 150,
    },
    slug: {
      type: String,
      required: [true, 'Package slug is required'],
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Package description is required'],
      trim: true,
      maxlength: 3000,
    },
    shortDescription: {
      type: String,
      trim: true,
      maxlength: 250,
      default: '',
    },
    images: {
      type: [String],
      default: [],
    },
    imageUrl: {
      type: String,
      trim: true,
      default: '',
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LabourCategory',
      required: [true, 'Category reference is required'],
      index: true,
    },
    subcategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LabourSubcategory',
      index: true,
    },
    inclusions: {
      type: [inclusionSchema],
      validate: {
        validator: function (v) {
          return Array.isArray(v) && v.length > 0
        },
        message: 'A package must contain at least one service inclusion',
      },
    },
    exclusions: {
      type: [String],
      default: [],
    },
    termsAndConditions: {
      type: [String],
      default: [],
    },
    originalPrice: {
      type: Number,
      default: 0,
      min: [0, 'Original price must be >= 0'],
    },
    price: {
      type: Number,
      required: [true, 'Package price is required'],
      min: [0, 'Package price must be >= 0'],
    },
    discountPercentage: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },
    estimatedDurationMins: {
      type: Number,
      default: 60,
      min: [15, 'Estimated duration must be at least 15 minutes'],
    },
    badge: {
      type: String,
      trim: true,
      default: '',
      maxlength: 40,
    },
    status: {
      type: String,
      enum: ['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED'],
      default: 'ACTIVE',
      index: true,
    },
    isAllZones: {
      type: Boolean,
      default: true,
    },
    zones: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Zone',
      },
    ],
    validFrom: {
      type: Date,
    },
    validUntil: {
      type: Date,
    },
    sortOrder: {
      type: Number,
      default: 0,
      index: true,
    },
    bookingCount: {
      type: Number,
      default: 0,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
)

servicePackageSchema.index({ categoryId: 1, status: 1, sortOrder: 1 })
servicePackageSchema.index({ status: 1, isAllZones: 1 })

export const ServicePackage = mongoose.model('ServicePackage', servicePackageSchema)
