import mongoose from 'mongoose'

export const REMINDER_STATUS = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  SENT: 'SENT',
  FAILED: 'FAILED',
  CANCELLED: 'CANCELLED',
}

export const REMINDER_TYPE = {
  TWENTY_FOUR_HOURS: '24_HOURS',
  ONE_HOUR: '1_HOUR',
  AT_APPOINTMENT: 'AT_APPOINTMENT',
  CUSTOM: 'CUSTOM',
}

export const RECIPIENT_ROLE = {
  CUSTOMER: 'CUSTOMER',
  LABOUR: 'LABOUR',
  CONTRACTOR: 'CONTRACTOR',
}

const bookingReminderSchema = new mongoose.Schema(
  {
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      required: true,
      index: true,
    },
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    recipientRole: {
      type: String,
      enum: Object.values(RECIPIENT_ROLE),
      required: true,
    },
    reminderType: {
      type: String,
      enum: Object.values(REMINDER_TYPE),
      required: true,
    },
    scheduledAt: {
      type: Date,
      required: true,
      index: true,
    },
    appointmentTime: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: Object.values(REMINDER_STATUS),
      default: REMINDER_STATUS.PENDING,
      index: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 3,
    },
    lastError: {
      type: String,
      trim: true,
    },
    sentAt: {
      type: Date,
    },
    processingStartedAt: {
      type: Date,
    },
    leaseExpiresAt: {
      type: Date,
      index: true,
    },
    dedupeKey: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    metadata: {
      customerName: String,
      vendorName: String,
      serviceName: String,
      timeSlot: String,
      appointmentDateFormatted: String,
      locationText: String,
      bookingType: String,
    },
    deliveryDetails: {
      fcmMessageId: String,
      tokensTargeted: Number,
      successCount: Number,
      failureCount: Number,
      inAppNotificationId: mongoose.Schema.Types.ObjectId,
    },
  },
  { timestamps: true }
)

// Efficient compound index for polling due pending jobs
bookingReminderSchema.index({ status: 1, scheduledAt: 1 })
// Index for finding existing reminders for a booking
bookingReminderSchema.index({ bookingId: 1, recipientId: 1, status: 1 })
// Index for recovering stale worker leases
bookingReminderSchema.index({ status: 1, leaseExpiresAt: 1 })

export const BookingReminder = mongoose.model('BookingReminder', bookingReminderSchema)
