import mongoose from 'mongoose'

const auditLogSchema = new mongoose.Schema(
  {
    version: {
      type: Number,
      required: true,
    },
    qrImageUrl: {
      type: String,
      required: true,
    },
    storageIdentifier: {
      type: String,
      required: true,
    },
    displayName: {
      type: String,
      required: true,
    },
    upiId: {
      type: String,
      default: '',
    },
    instructions: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      enum: ['CREATED', 'UPDATED', 'ACTIVATED', 'DEACTIVATED', 'REPLACED_QR'],
      default: 'UPDATED',
    },
    reason: {
      type: String,
      default: '',
    },
    changedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
)

const adminPaymentConfigSchema = new mongoose.Schema(
  {
    paymentMethod: {
      type: String,
      enum: ['UPI_QR', 'BANK_TRANSFER'],
      default: 'UPI_QR',
      required: true,
      index: true,
    },
    paymentPurpose: {
      type: String,
      enum: ['ALL', 'WALLET_TOPUP', 'WALLET_CLEARANCE', 'SUBSCRIPTION', 'TRIAL_PENALTY', 'BOOKING_COMMISSION'],
      default: 'ALL',
      required: true,
      index: true,
    },
    displayName: {
      type: String,
      required: [true, 'Display name is required'],
      trim: true,
      maxLength: 120,
    },
    upiId: {
      type: String,
      trim: true,
      default: '',
      maxLength: 100,
    },
    qrImageUrl: {
      type: String,
      required: [true, 'QR code image URL is required'],
      trim: true,
    },
    storageIdentifier: {
      type: String,
      required: [true, 'Storage identifier (public ID) is required'],
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
    version: {
      type: Number,
      default: 1,
      min: 1,
      index: true,
    },
    instructions: {
      type: String,
      trim: true,
      default: 'Scan this QR code using any UPI app (Google Pay, PhonePe, Paytm, BHIM, etc.). After making the payment, enter the 12-digit UTR / Reference Number below and upload the payment receipt for instant verification.',
      maxLength: 1000,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    auditLog: [auditLogSchema],
  },
  { timestamps: true }
)

// Ensure efficient querying of active configuration
adminPaymentConfigSchema.index({ paymentMethod: 1, paymentPurpose: 1, isActive: 1 })

/**
 * Static method to fetch currently active QR configuration for a given purpose.
 * Falls back to 'ALL' if no purpose-specific active config is found.
 */
adminPaymentConfigSchema.statics.getActiveConfig = async function (purpose = 'ALL') {
  if (purpose && purpose !== 'ALL') {
    const specific = await this.findOne({
      paymentMethod: 'UPI_QR',
      paymentPurpose: purpose,
      isActive: true,
    })
      .sort({ version: -1 })
      .populate('updatedBy', 'fullName email')
    if (specific) return specific
  }

  return this.findOne({
    paymentMethod: 'UPI_QR',
    paymentPurpose: 'ALL',
    isActive: true,
  })
    .sort({ version: -1 })
    .populate('updatedBy', 'fullName email')
}

export const AdminPaymentConfig = mongoose.model('AdminPaymentConfig', adminPaymentConfigSchema)
