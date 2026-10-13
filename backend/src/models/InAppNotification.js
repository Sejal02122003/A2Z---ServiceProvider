import mongoose from 'mongoose'

export const NOTIFICATION_TYPES = {
  BOOKING_REMINDER: 'BOOKING_REMINDER',
  BOOKING_ACCEPTED: 'BOOKING_ACCEPTED',
  BOOKING_CANCELLED: 'BOOKING_CANCELLED',
  BOOKING_STATUS: 'BOOKING_STATUS',
  CUSTOMER_CANCELLATION_WARNING: 'CUSTOMER_CANCELLATION_WARNING',
  CUSTOMER_BOOKING_RESTRICTION_APPLIED: 'CUSTOMER_BOOKING_RESTRICTION_APPLIED',
  CUSTOMER_BOOKING_RESTRICTION_LIFTED: 'CUSTOMER_BOOKING_RESTRICTION_LIFTED',
  CUSTOMER_BOOKING_ACCESS_RESTORED: 'CUSTOMER_BOOKING_ACCESS_RESTORED',
  WALLET_CREDIT: 'WALLET_CREDIT',
  WALLET_REVERSAL: 'WALLET_REVERSAL',
  SYSTEM: 'SYSTEM',
}

export const DELIVERY_STATUS = {
  PENDING: 'PENDING',
  SENT: 'SENT',
  FAILED: 'FAILED',
  PARTIAL: 'PARTIAL',
}

const inAppNotificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    body: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      default: NOTIFICATION_TYPES.BOOKING_REMINDER,
      index: true,
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      index: true,
    },
    idempotencyKey: {
      type: String,
      unique: true,
      sparse: true,
      index: true,
    },
    deliveryStatus: {
      type: String,
      enum: Object.values(DELIVERY_STATUS),
      default: DELIVERY_STATUS.SENT,
      index: true,
    },
    pushDelivery: {
      attempts: {
        type: Number,
        default: 0,
      },
      lastAttemptAt: {
        type: Date,
      },
      successCount: {
        type: Number,
        default: 0,
      },
      failureCount: {
        type: Number,
        default: 0,
      },
      error: {
        type: String,
      },
    },
    read: {
      type: Boolean,
      default: false,
      index: true,
    },
    readAt: {
      type: Date,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  { timestamps: true }
)

inAppNotificationSchema.index({ userId: 1, read: 1, createdAt: -1 })
inAppNotificationSchema.index({ deliveryStatus: 1, createdAt: -1 })

export const InAppNotification = mongoose.model('InAppNotification', inAppNotificationSchema)

