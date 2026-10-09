import mongoose from 'mongoose'

const reminderIntervalSchema = new mongoose.Schema(
  {
    enabled: { type: Boolean, default: true },
    hoursBefore: { type: Number, required: true, min: 0 },
    titleTemplate: { type: String, trim: true },
    bodyTemplate: { type: String, trim: true },
  },
  { _id: false }
)

const bookingReminderSettingSchema = new mongoose.Schema(
  {
    configKey: {
      type: String,
      default: 'master_reminder_config',
      unique: true,
      required: true,
      index: true,
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    customerRemindersEnabled: {
      type: Boolean,
      default: true,
    },
    vendorRemindersEnabled: {
      type: Boolean,
      default: true,
    },
    intervals: {
      twentyFourHour: {
        type: reminderIntervalSchema,
        default: () => ({
          enabled: true,
          hoursBefore: 24,
          titleTemplate: 'Your A2Z Service Is Tomorrow 📅',
          bodyTemplate: 'Reminder: Your {serviceName} appointment is scheduled for tomorrow at {appointmentTime}. Open A2Z for details.',
        }),
      },
      oneHour: {
        type: reminderIntervalSchema,
        default: () => ({
          enabled: true,
          hoursBefore: 1,
          titleTemplate: 'Your A2Z Service Starts in 1 Hour ⏰',
          bodyTemplate: 'Reminder: Your {serviceName} appointment is scheduled for {appointmentTime}. Your service partner will arrive shortly.',
        }),
      },
      atAppointment: {
        type: reminderIntervalSchema,
        default: () => ({
          enabled: false,
          hoursBefore: 0,
          titleTemplate: 'Your A2Z Service Appointment Time 🚀',
          bodyTemplate: 'Your {serviceName} appointment at {appointmentTime} is starting now.',
        }),
      },
    },
    timeZone: {
      type: String,
      default: 'Asia/Kolkata',
    },
    batchSize: {
      type: Number,
      default: 50,
      min: 1,
      max: 200,
    },
    leaseDurationSeconds: {
      type: Number,
      default: 120, // 2 minutes lease for concurrent lock
      min: 30,
      max: 600,
    },
    maxAttempts: {
      type: Number,
      default: 3,
      min: 1,
      max: 10,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
)

export const BookingReminderSetting = mongoose.model('BookingReminderSetting', bookingReminderSettingSchema)
