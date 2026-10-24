import mongoose from 'mongoose'

const labourSubcategorySchema = new mongoose.Schema(
  {
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LabourCategory',
      required: true,
      index: true,
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

    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
      index: true,
    },
    iconUrl: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
)

// Ensure subcategory names are unique within a category
labourSubcategorySchema.index({ categoryId: 1, name: 1 }, { unique: true })
labourSubcategorySchema.index({ categoryId: 1, sortOrder: 1, name: 1 })

export const LabourSubcategory = mongoose.model('LabourSubcategory', labourSubcategorySchema)
