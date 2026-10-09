import mongoose from 'mongoose'
import { BookingReminder, REMINDER_STATUS, REMINDER_TYPE, RECIPIENT_ROLE } from '../models/BookingReminder.js'
import { BookingReminderSetting } from '../models/BookingReminderSetting.js'
import { InAppNotification } from '../models/InAppNotification.js'
import { Booking } from '../models/Booking.js'
import { User } from '../models/User.js'
import { LabourService } from '../models/LabourService.js'
import { parseISTDateTime } from '../utils/dateHelper.js'
import { sendNotificationToUser } from '../utils/pushNotificationHelper.js'

/**
 * =========================================================================
 * 1. SETTINGS & CONFIGURATION
 * =========================================================================
 */

export async function getReminderSettings() {
  let settings = await BookingReminderSetting.findOne({ configKey: 'master_reminder_config' })
  if (!settings) {
    settings = await BookingReminderSetting.create({
      configKey: 'master_reminder_config',
      enabled: true,
      customerRemindersEnabled: true,
      vendorRemindersEnabled: true,
      intervals: {
        twentyFourHour: {
          enabled: true,
          hoursBefore: 24,
          titleTemplate: 'Your A2Z Service Is Tomorrow 📅',
          bodyTemplate: 'Reminder: Your {serviceName} appointment is scheduled for tomorrow at {appointmentTime}. Open A2Z to view details.',
        },
        oneHour: {
          enabled: true,
          hoursBefore: 1,
          titleTemplate: 'Your A2Z Service Starts in 1 Hour ⏰',
          bodyTemplate: 'Reminder: Your {serviceName} appointment is scheduled for {appointmentTime}. Your service partner will arrive shortly.',
        },
        atAppointment: {
          enabled: false,
          hoursBefore: 0,
          titleTemplate: 'Your A2Z Service Appointment Time 🚀',
          bodyTemplate: 'Your {serviceName} appointment at {appointmentTime} is starting now.',
        },
      },
      timeZone: 'Asia/Kolkata',
      batchSize: 50,
      leaseDurationSeconds: 120,
      maxAttempts: 3,
    })
  }
  return settings
}

export async function updateReminderSettings(data, adminUser) {
  const update = {}
  if (data.enabled !== undefined) update.enabled = Boolean(data.enabled)
  if (data.customerRemindersEnabled !== undefined) update.customerRemindersEnabled = Boolean(data.customerRemindersEnabled)
  if (data.vendorRemindersEnabled !== undefined) update.vendorRemindersEnabled = Boolean(data.vendorRemindersEnabled)
  if (data.timeZone) update.timeZone = data.timeZone
  if (data.batchSize) update.batchSize = Math.max(1, Math.min(200, Number(data.batchSize)))
  if (data.leaseDurationSeconds) update.leaseDurationSeconds = Math.max(30, Math.min(600, Number(data.leaseDurationSeconds)))
  if (data.maxAttempts) update.maxAttempts = Math.max(1, Math.min(10, Number(data.maxAttempts)))

  if (data.intervals) {
    if (data.intervals.twentyFourHour) {
      update['intervals.twentyFourHour'] = {
        enabled: Boolean(data.intervals.twentyFourHour.enabled),
        hoursBefore: Number(data.intervals.twentyFourHour.hoursBefore ?? 24),
        titleTemplate: data.intervals.twentyFourHour.titleTemplate || 'Your A2Z Service Is Tomorrow 📅',
        bodyTemplate: data.intervals.twentyFourHour.bodyTemplate || 'Reminder: Your {serviceName} appointment is scheduled for tomorrow at {appointmentTime}. Open A2Z to view details.',
      }
    }
    if (data.intervals.oneHour) {
      update['intervals.oneHour'] = {
        enabled: Boolean(data.intervals.oneHour.enabled),
        hoursBefore: Number(data.intervals.oneHour.hoursBefore ?? 1),
        titleTemplate: data.intervals.oneHour.titleTemplate || 'Your A2Z Service Starts in 1 Hour ⏰',
        bodyTemplate: data.intervals.oneHour.bodyTemplate || 'Reminder: Your {serviceName} appointment is scheduled for {appointmentTime}. Your service partner will arrive shortly.',
      }
    }
    if (data.intervals.atAppointment) {
      update['intervals.atAppointment'] = {
        enabled: Boolean(data.intervals.atAppointment.enabled),
        hoursBefore: Number(data.intervals.atAppointment.hoursBefore ?? 0),
        titleTemplate: data.intervals.atAppointment.titleTemplate || 'Your A2Z Service Appointment Time 🚀',
        bodyTemplate: data.intervals.atAppointment.bodyTemplate || 'Your {serviceName} appointment at {appointmentTime} is starting now.',
      }
    }
  }

  if (adminUser?._id) update.updatedBy = adminUser._id

  const settings = await BookingReminderSetting.findOneAndUpdate(
    { configKey: 'master_reminder_config' },
    { $set: update },
    { new: true, upsert: true }
  )

  return settings
}

/**
 * =========================================================================
 * 2. DATE & TIME RESOLUTION
 * =========================================================================
 */

/**
 * Accurately calculates the UTC appointment Date for a booking
 */
export function calculateBookingAppointmentTime(booking) {
  if (!booking) return null

  // If scheduledAt is specified with a timeSlot string
  if (booking.scheduledAt) {
    const dateStr = typeof booking.scheduledAt === 'string'
      ? booking.scheduledAt
      : booking.scheduledAt.toISOString().split('T')[0]
    
    if (booking.timeSlot) {
      return parseISTDateTime(dateStr, booking.timeSlot)
    }
    return new Date(booking.scheduledAt)
  }

  // If instant booking, appointment time is creation time or now
  if (booking.createdAt) {
    return new Date(booking.createdAt)
  }

  return new Date()
}

/**
 * Format a Date for human readable notification display in IST
 */
export function formatAppointmentDateTimeIST(date) {
  if (!date || isNaN(new Date(date).getTime())) return 'Scheduled Time'
  const d = new Date(date)
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/**
 * =========================================================================
 * 3. REMINDER SCHEDULING & LIFECYCLE MANAGEMENT
 * =========================================================================
 */

/**
 * Schedule all eligible reminder jobs for a confirmed or accepted booking
 */
export async function scheduleRemindersForBooking(bookingId) {
  const booking = await Booking.findById(bookingId)
    .populate('serviceId', 'name')
    .populate('userId', 'fullName phone email')
    .populate('laborId', 'fullName phone email')
    .populate('assignments.labourId', 'fullName phone email')

  if (!booking) {
    console.warn(`[REMINDER_ENGINE] Booking not found: ${bookingId}`)
    return { success: false, reason: 'BOOKING_NOT_FOUND' }
  }

  // Check booking eligibility (must not be cancelled, refunded or completed)
  const terminalStatuses = ['CANCELLED', 'REFUNDED', 'COMPLETED', 'FAILED']
  if (terminalStatuses.includes(booking.status)) {
    console.log(`[REMINDER_ENGINE] Booking #${bookingId} is in terminal status (${booking.status}). Skipping reminder scheduling.`)
    return { success: false, reason: 'BOOKING_INELIGIBLE_STATUS' }
  }

  const appointmentTime = calculateBookingAppointmentTime(booking)
  if (!appointmentTime || isNaN(appointmentTime.getTime())) {
    console.warn(`[REMINDER_ENGINE] Could not resolve appointment time for booking #${bookingId}`)
    return { success: false, reason: 'INVALID_APPOINTMENT_TIME' }
  }

  const now = new Date()
  // If the appointment is already past, skip creating future reminders
  if (appointmentTime <= now) {
    console.log(`[REMINDER_ENGINE] Appointment time for booking #${bookingId} is in the past. Skipping.`)
    return { success: false, reason: 'APPOINTMENT_IN_PAST' }
  }

  const settings = await getReminderSettings()
  if (!settings.enabled) {
    console.log(`[REMINDER_ENGINE] Booking reminders globally disabled in settings. Skipping.`)
    return { success: false, reason: 'GLOBAL_REMINDERS_DISABLED' }
  }

  const serviceName = booking.serviceId?.name || 'Home Service'
  const customerName = booking.userId?.fullName || 'Customer'
  const locationText = booking.address?.locationText || ''
  const appointmentFormatted = formatAppointmentDateTimeIST(appointmentTime)

  const metadata = {
    customerName,
    serviceName,
    timeSlot: booking.timeSlot || 'Scheduled Time',
    appointmentDateFormatted: appointmentFormatted,
    locationText,
    bookingType: booking.type || 'SCHEDULED',
  }

  const intervalsToEvaluate = [
    {
      key: REMINDER_TYPE.TWENTY_FOUR_HOURS,
      config: settings.intervals.twentyFourHour,
      hoursBefore: 24,
    },
    {
      key: REMINDER_TYPE.ONE_HOUR,
      config: settings.intervals.oneHour,
      hoursBefore: 1,
    },
    {
      key: REMINDER_TYPE.AT_APPOINTMENT,
      config: settings.intervals.atAppointment,
      hoursBefore: 0,
    },
  ]

  const createdReminders = []

  // 1. Customer Reminders
  if (settings.customerRemindersEnabled && booking.userId?._id) {
    for (const item of intervalsToEvaluate) {
      if (!item.config?.enabled) continue

      const scheduledAt = new Date(appointmentTime.getTime() - item.hoursBefore * 3600 * 1000)

      // Skip reminder times that are already in the past
      if (scheduledAt <= now) {
        continue
      }

      const dedupeKey = `${booking._id}_${booking.userId._id}_${item.key}`

      try {
        const reminder = await BookingReminder.findOneAndUpdate(
          { dedupeKey },
          {
            $set: {
              bookingId: booking._id,
              recipientId: booking.userId._id,
              recipientRole: RECIPIENT_ROLE.CUSTOMER,
              reminderType: item.key,
              scheduledAt,
              appointmentTime,
              status: REMINDER_STATUS.PENDING,
              maxAttempts: settings.maxAttempts || 3,
              metadata,
            },
          },
          { upsert: true, new: true }
        )
        createdReminders.push(reminder)
      } catch (err) {
        // Safe dedupe key collision handling
        if (err.code !== 11000) {
          console.error(`[REMINDER_ENGINE] Error upserting customer reminder:`, err)
        }
      }
    }
  }

  // 2. Vendor Reminders (Only for assigned/accepted bookings)
  const isVendorAssigned = ['ACCEPTED', 'ASSIGNED', 'EN_ROUTE', 'STARTED'].includes(booking.status)
  if (settings.vendorRemindersEnabled && isVendorAssigned) {
    const assignedVendorIds = new Set()

    if (booking.laborId?._id) assignedVendorIds.add(String(booking.laborId._id))
    if (booking.acceptedLabourId) assignedVendorIds.add(String(booking.acceptedLabourId))
    if (booking.assignments && booking.assignments.length > 0) {
      booking.assignments.forEach((a) => {
        const lid = a.labourId?._id || a.labourId
        if (lid) assignedVendorIds.add(String(lid))
      })
    }

    for (const vendorIdStr of assignedVendorIds) {
      const vObjectId = new mongoose.Types.ObjectId(vendorIdStr)
      const vendorUser = await User.findById(vObjectId).select('fullName role')
      const vendorRole = vendorUser?.role === 'contractor' ? RECIPIENT_ROLE.CONTRACTOR : RECIPIENT_ROLE.LABOUR

      const vendorMetadata = {
        ...metadata,
        vendorName: vendorUser?.fullName || 'Partner',
      }

      for (const item of intervalsToEvaluate) {
        if (!item.config?.enabled) continue

        const scheduledAt = new Date(appointmentTime.getTime() - item.hoursBefore * 3600 * 1000)

        // Skip intervals in the past
        if (scheduledAt <= now) continue

        const dedupeKey = `${booking._id}_${vObjectId}_${item.key}`

        try {
          const reminder = await BookingReminder.findOneAndUpdate(
            { dedupeKey },
            {
              $set: {
                bookingId: booking._id,
                recipientId: vObjectId,
                recipientRole: vendorRole,
                reminderType: item.key,
                scheduledAt,
                appointmentTime,
                status: REMINDER_STATUS.PENDING,
                maxAttempts: settings.maxAttempts || 3,
                metadata: vendorMetadata,
              },
            },
            { upsert: true, new: true }
          )
          createdReminders.push(reminder)
        } catch (err) {
          if (err.code !== 11000) {
            console.error(`[REMINDER_ENGINE] Error upserting vendor reminder:`, err)
          }
        }
      }
    }
  }

  console.log(`[REMINDER_ENGINE] Scheduled ${createdReminders.length} reminder jobs for booking #${booking._id}`)
  return { success: true, count: createdReminders.length, reminders: createdReminders }
}

/**
 * Cancel pending reminders when a booking is cancelled, refunded or completed
 */
export async function cancelRemindersForBooking(bookingId, reason = 'Booking cancelled or completed') {
  const result = await BookingReminder.updateMany(
    {
      bookingId,
      status: { $in: [REMINDER_STATUS.PENDING, REMINDER_STATUS.PROCESSING] },
    },
    {
      $set: {
        status: REMINDER_STATUS.CANCELLED,
        lastError: reason,
      },
    }
  )

  console.log(`[REMINDER_ENGINE] Cancelled ${result.modifiedCount} pending reminders for booking #${bookingId} (${reason})`)
  return result
}

/**
 * Reschedule reminders when a booking's date or time is modified
 */
export async function rescheduleRemindersForBooking(bookingId) {
  // Cancel existing pending reminders
  await cancelRemindersForBooking(bookingId, 'Booking rescheduled to new date/time')
  // Re-schedule with new timing
  return scheduleRemindersForBooking(bookingId)
}

/**
 * Handle vendor reassignment: cancel old vendor's reminders and schedule new vendor's reminders
 */
export async function handleVendorReassignment(bookingId, newVendorId, oldVendorId = null) {
  if (oldVendorId) {
    await BookingReminder.updateMany(
      {
        bookingId,
        recipientId: oldVendorId,
        status: REMINDER_STATUS.PENDING,
      },
      {
        $set: {
          status: REMINDER_STATUS.CANCELLED,
          lastError: 'Vendor reassigned to another partner',
        },
      }
    )
  }

  if (newVendorId) {
    await Booking.findByIdAndUpdate(bookingId, {
      $set: { laborId: newVendorId, acceptedLabourId: newVendorId },
    })
  }

  return scheduleRemindersForBooking(bookingId)
}

/**
 * =========================================================================
 * 4. WORKER: JOB PROCESSING & RELIABILITY
 * =========================================================================
 */

/**
 * Recover stale leases stranded by worker restarts or unexpected crashes
 */
export async function recoverStaleLeases() {
  const now = new Date()
  const result = await BookingReminder.updateMany(
    {
      status: REMINDER_STATUS.PROCESSING,
      leaseExpiresAt: { $lt: now },
    },
    {
      $set: {
        status: REMINDER_STATUS.PENDING,
        lastError: 'Lease expired. Reclaimed for processing.',
      },
    }
  )

  if (result.modifiedCount > 0) {
    console.log(`[REMINDER_ENGINE] Reclaimed ${result.modifiedCount} stale reminder leases.`)
  }
  return result.modifiedCount
}

/**
 * Process due reminders in batches atomically
 */
export async function processDueReminders() {
  const settings = await getReminderSettings()
  if (!settings.enabled) {
    return { processed: 0, sent: 0, failed: 0, message: 'Reminders disabled' }
  }

  // Recover any expired leases first
  await recoverStaleLeases()

  const now = new Date()
  const batchSize = settings.batchSize || 50
  const leaseDurationSeconds = settings.leaseDurationSeconds || 120

  let processedCount = 0
  let sentCount = 0
  let failedCount = 0

  for (let i = 0; i < batchSize; i++) {
    // Atomically claim the next due pending reminder with lease lock
    const reminder = await BookingReminder.findOneAndUpdate(
      {
        status: REMINDER_STATUS.PENDING,
        scheduledAt: { $lte: now },
        $or: [
          { leaseExpiresAt: { $exists: false } },
          { leaseExpiresAt: { $lte: now } },
        ],
      },
      {
        $set: {
          status: REMINDER_STATUS.PROCESSING,
          processingStartedAt: now,
          leaseExpiresAt: new Date(now.getTime() + leaseDurationSeconds * 1000),
        },
        $inc: { attempts: 1 },
      },
      { new: true }
    )

    // No more due reminders in this cycle
    if (!reminder) break

    processedCount++

    try {
      // 1. Verify live booking status & eligibility
      const booking = await Booking.findById(reminder.bookingId)
        .populate('serviceId', 'name')
        .populate('userId', 'fullName phone')
        .populate('laborId', 'fullName phone')

      if (!booking) {
        reminder.status = REMINDER_STATUS.CANCELLED
        reminder.lastError = 'Associated booking no longer exists'
        await reminder.save()
        continue
      }

      const terminalStatuses = ['CANCELLED', 'REFUNDED', 'COMPLETED', 'FAILED']
      if (terminalStatuses.includes(booking.status)) {
        reminder.status = REMINDER_STATUS.CANCELLED
        reminder.lastError = `Booking reached terminal status: ${booking.status}`
        await reminder.save()
        continue
      }

      // If reminder is for vendor, ensure recipient is still assigned
      if (reminder.recipientRole !== RECIPIENT_ROLE.CUSTOMER) {
        const assignedIds = [
          String(booking.laborId?._id || booking.laborId || ''),
          String(booking.acceptedLabourId || ''),
          ...(booking.acceptedLabourIds || []).map(String),
          ...(booking.assignments || []).map((a) => String(a.labourId?._id || a.labourId || '')),
        ]

        if (!assignedIds.includes(String(reminder.recipientId))) {
          reminder.status = REMINDER_STATUS.CANCELLED
          reminder.lastError = 'Vendor is no longer assigned to this booking'
          await reminder.save()
          continue
        }
      }

      // 2. Format title and body based on interval template
      const serviceName = booking.serviceId?.name || reminder.metadata?.serviceName || 'Home Service'
      const apptFormatted = formatAppointmentDateTimeIST(reminder.appointmentTime)
      const locationText = booking.address?.locationText || reminder.metadata?.locationText || ''

      let title = 'Upcoming A2Z Service Reminder'
      let body = `Your ${serviceName} appointment is scheduled for ${apptFormatted}.`

      if (reminder.recipientRole === RECIPIENT_ROLE.CUSTOMER) {
        if (reminder.reminderType === REMINDER_TYPE.TWENTY_FOUR_HOURS) {
          title = settings.intervals.twentyFourHour?.titleTemplate || 'Your A2Z Service Is Tomorrow 📅'
          body = (settings.intervals.twentyFourHour?.bodyTemplate || 'Reminder: Your {serviceName} appointment is scheduled for tomorrow at {appointmentTime}. Open A2Z to view details.')
            .replace('{serviceName}', serviceName)
            .replace('{appointmentTime}', apptFormatted)
        } else if (reminder.reminderType === REMINDER_TYPE.ONE_HOUR) {
          title = settings.intervals.oneHour?.titleTemplate || 'Your A2Z Service Starts in 1 Hour ⏰'
          body = (settings.intervals.oneHour?.bodyTemplate || 'Reminder: Your {serviceName} appointment is scheduled for {appointmentTime}. Your service partner will arrive shortly.')
            .replace('{serviceName}', serviceName)
            .replace('{appointmentTime}', apptFormatted)
        } else {
          title = settings.intervals.atAppointment?.titleTemplate || 'Your A2Z Service Appointment Time 🚀'
          body = (settings.intervals.atAppointment?.bodyTemplate || 'Your {serviceName} appointment at {appointmentTime} is starting now.')
            .replace('{serviceName}', serviceName)
            .replace('{appointmentTime}', apptFormatted)
        }
      } else {
        // Vendor Template
        if (reminder.reminderType === REMINDER_TYPE.TWENTY_FOUR_HOURS) {
          title = 'Upcoming Customer Job Tomorrow 🛠️'
          body = `Reminder: You have a scheduled ${serviceName} job tomorrow at ${apptFormatted} at ${locationText}.`
        } else if (reminder.reminderType === REMINDER_TYPE.ONE_HOUR) {
          title = 'Job Starts in 1 Hour ⏰'
          body = `Reminder: Your ${serviceName} appointment is scheduled in 1 hour at ${apptFormatted}. Please prepare to head towards the customer site.`
        } else {
          title = 'Job Appointment Time 🚀'
          body = `Your assigned ${serviceName} job at ${locationText} is starting now.`
        }
      }

      // 3. Dispatch Push Notification via Firebase
      const payload = {
        title,
        body,
        data: {
          type: 'BOOKING_REMINDER',
          bookingId: String(reminder.bookingId),
          reminderType: reminder.reminderType,
          appointmentTime: String(reminder.appointmentTime),
          link: `/app/active-job/${reminder.bookingId}`,
        },
      }

      let fcmResponse = null
      try {
        fcmResponse = await sendNotificationToUser(reminder.recipientId, payload)
      } catch (fcmErr) {
        console.warn(`[REMINDER_ENGINE] FCM dispatch warning for user ${reminder.recipientId}:`, fcmErr.message)
      }

      // 4. Create In-App Notification record for user's notification feed
      let inAppRecord = null
      try {
        inAppRecord = await InAppNotification.create({
          userId: reminder.recipientId,
          title,
          body,
          type: 'BOOKING_REMINDER',
          bookingId: reminder.bookingId,
          metadata: {
            reminderType: reminder.reminderType,
            appointmentTime: reminder.appointmentTime,
          },
        })
      } catch (inAppErr) {
        console.error(`[REMINDER_ENGINE] In-app notification creation error:`, inAppErr)
      }

      // 5. Update reminder record to SENT
      reminder.status = REMINDER_STATUS.SENT
      reminder.sentAt = new Date()
      reminder.deliveryDetails = {
        fcmMessageId: fcmResponse?.responses?.[0]?.messageId || 'SENT',
        successCount: fcmResponse?.successCount || 1,
        failureCount: fcmResponse?.failureCount || 0,
        inAppNotificationId: inAppRecord?._id,
      }
      reminder.lastError = undefined
      await reminder.save()

      sentCount++
      console.log(`[REMINDER_ENGINE] ✅ Sent reminder (${reminder.reminderType}) for booking #${reminder.bookingId} to recipient ${reminder.recipientId}`)
    } catch (err) {
      console.error(`[REMINDER_ENGINE] Error processing reminder #${reminder._id}:`, err)
      failedCount++

      const maxAttempts = reminder.maxAttempts || settings.maxAttempts || 3
      if (reminder.attempts >= maxAttempts) {
        reminder.status = REMINDER_STATUS.FAILED
        reminder.lastError = `Max retry attempts reached (${maxAttempts}): ${err.message}`
      } else {
        // Transient error — backoff by exponential delay
        const delayMinutes = Math.pow(2, reminder.attempts)
        reminder.status = REMINDER_STATUS.PENDING
        reminder.scheduledAt = new Date(Date.now() + delayMinutes * 60 * 1000)
        reminder.lastError = `Attempt ${reminder.attempts} failed: ${err.message}. Retrying in ${delayMinutes}m.`
      }
      await reminder.save()
    }
  }

  return { processed: processedCount, sent: sentCount, failed: failedCount }
}

/**
 * Manually retry a failed reminder
 */
export async function retryReminderManually(reminderId, adminUser) {
  const reminder = await BookingReminder.findById(reminderId)
  if (!reminder) throw new Error('Reminder not found')

  reminder.status = REMINDER_STATUS.PENDING
  reminder.scheduledAt = new Date() // Due immediately
  reminder.attempts = 0
  reminder.lastError = `Manual retry initiated by admin ${adminUser?.fullName || adminUser?._id}`
  await reminder.save()

  return processDueReminders()
}

/**
 * Get overview stats for admin dashboard
 */
export async function getReminderOverviewStats() {
  const now = new Date()
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const [
    totalReminders,
    pendingReminders,
    sentTotal,
    sentToday,
    failedTotal,
    cancelledTotal,
    settings,
  ] = await Promise.all([
    BookingReminder.countDocuments(),
    BookingReminder.countDocuments({ status: REMINDER_STATUS.PENDING }),
    BookingReminder.countDocuments({ status: REMINDER_STATUS.SENT }),
    BookingReminder.countDocuments({ status: REMINDER_STATUS.SENT, sentAt: { $gte: startOfToday } }),
    BookingReminder.countDocuments({ status: REMINDER_STATUS.FAILED }),
    BookingReminder.countDocuments({ status: REMINDER_STATUS.CANCELLED }),
    getReminderSettings(),
  ])

  return {
    totalReminders,
    pendingReminders,
    sentTotal,
    sentToday,
    failedTotal,
    cancelledTotal,
    settings,
  }
}
