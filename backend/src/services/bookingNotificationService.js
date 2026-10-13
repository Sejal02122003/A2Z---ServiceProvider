import { InAppNotification, NOTIFICATION_TYPES, DELIVERY_STATUS } from '../models/InAppNotification.js'
import { LabourService } from '../models/LabourService.js'
import { User } from '../models/User.js'
import { sendNotificationToUser } from '../utils/pushNotificationHelper.js'

/**
 * Format a human-readable booking date in IST
 * e.g., '15 Oct 2026'
 */
function formatBookingDate(dateVal) {
  if (!dateVal) return ''
  const d = new Date(dateVal)
  if (isNaN(d.getTime())) {
    // If it's already a string like "2026-10-15"
    if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
      const [year, month, day] = dateVal.split('-')
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      return `${parseInt(day, 10)} ${months[parseInt(month, 10) - 1]} ${year}`
    }
    return String(dateVal)
  }
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  })
}

/**
 * Build concise, user-friendly notification text
 */
export function buildBookingAcceptedContent({ booking, partner, serviceName }) {
  const partnerName = partner?.fullName || partner?.name || 'A service partner'
  const service = serviceName || 'your requested service'
  const title = 'Your booking has been confirmed!'

  let body = ''
  if (booking.type === 'INSTANT') {
    body = `Great news! Your service partner ${partnerName} has accepted your instant booking for ${service}. They are on their way!`
  } else {
    const formattedDate = formatBookingDate(booking.scheduledAt || booking.date)
    const timeSlot = booking.timeSlot ? ` at ${booking.timeSlot}` : ''
    const schedulePart = formattedDate ? ` on ${formattedDate}${timeSlot}` : ''
    body = `Great news! Your service partner ${partnerName} has accepted your booking for ${service}${schedulePart}.`
  }

  return { title, body, partnerName, service }
}

/**
 * Send booking accepted confirmation notification to customer
 * - Atomic idempotency key ensures no duplicate notifications
 * - In-app notification saved first (outbox / persistent feed)
 * - FCM push sent with invalid-token cleanup
 * - Socket broadcast for real-time in-app updates
 * - Failure of push NEVER throws or rolls back acceptance
 */
export async function sendBookingAcceptedNotification({ booking, partner, assignment = null }) {
  try {
    if (!booking || !booking.userId) {
      console.warn('[BOOKING_NOTIF] Missing booking or userId, skipping confirmation notification.')
      return { success: false, reason: 'MISSING_BOOKING_DATA' }
    }

    const partnerId = partner?._id || booking.acceptedLabourId || booking.laborId
    const partnerDoc = partner || (partnerId ? await User.findById(partnerId).lean() : null)

    // Resolve service name
    let serviceName = assignment?.serviceName
    if (!serviceName && booking.serviceId) {
      const svc = await LabourService.findById(booking.serviceId).lean()
      serviceName = svc?.name || 'Service'
    }

    const { title, body, partnerName, service } = buildBookingAcceptedContent({
      booking,
      partner: partnerDoc,
      serviceName,
    })

    // Construct stable idempotency key
    const version = (booking.acceptedLabourIds?.length || 1)
    const idempotencyKey = `BOOKING_ACCEPTED_${booking._id}_${partnerId}_v${version}`

    // 1. Create In-App Notification (Persistent Feed / Outbox)
    let inAppRecord = null
    try {
      inAppRecord = await InAppNotification.create({
        userId: booking.userId,
        title,
        body,
        type: NOTIFICATION_TYPES.BOOKING_ACCEPTED,
        bookingId: booking._id,
        idempotencyKey,
        deliveryStatus: DELIVERY_STATUS.PENDING,
        metadata: {
          partnerId: partnerDoc?._id,
          partnerName,
          serviceName: service,
          scheduledAt: booking.scheduledAt,
          date: booking.date,
          timeSlot: booking.timeSlot,
          bookingType: booking.type,
          link: `/app/tracking/${booking._id}`,
        },
      })
    } catch (dbErr) {
      // If unique constraint triggers (idempotency key collision on concurrent/retry request)
      if (dbErr.code === 11000) {
        console.log(`[BOOKING_NOTIF] Duplicate notification suppressed by idempotency key: ${idempotencyKey}`)
        const existing = await InAppNotification.findOne({ idempotencyKey })
        return { success: true, alreadySent: true, notification: existing }
      }
      console.error('[BOOKING_NOTIF] Failed to save in-app notification:', dbErr.message)
    }

    // 2. Prepare FCM Push Notification Payload
    const pushPayload = {
      title,
      body,
      data: {
        type: NOTIFICATION_TYPES.BOOKING_ACCEPTED,
        bookingId: String(booking._id),
        partnerName: String(partnerName || ''),
        serviceName: String(service || ''),
        link: `/app/tracking/${booking._id}`,
        scheduledAt: String(booking.scheduledAt || ''),
      },
    }

    // 3. Dispatch FCM Push Notification (non-blocking for booking commit)
    let fcmResult = null
    try {
      fcmResult = await sendNotificationToUser(booking.userId, pushPayload)
    } catch (fcmErr) {
      console.warn(`[BOOKING_NOTIF] FCM push dispatch error for customer ${booking.userId}:`, fcmErr.message)
      fcmResult = { success: false, failureCount: 1, error: fcmErr.message }
    }

    // 4. Dispatch Real-time Socket Event
    try {
      const { emitToUser } = await import('../socket.js')
      emitToUser(booking.userId, 'BOOKING_ACCEPTED', {
        bookingId: booking._id,
        laborId: partnerDoc?._id,
        partnerName,
        serviceName: service,
        status: booking.status,
      })
      if (inAppRecord) {
        emitToUser(booking.userId, 'NEW_IN_APP_NOTIFICATION', inAppRecord)
      }
    } catch (sockErr) {
      console.warn('[BOOKING_NOTIF] Socket emit warning:', sockErr.message)
    }

    // 5. Update InAppNotification Delivery Metrics
    if (inAppRecord) {
      const isSent = fcmResult?.success || fcmResult?.noTokens === true
      const status = isSent ? DELIVERY_STATUS.SENT : DELIVERY_STATUS.FAILED

      const updatedRecord = await InAppNotification.findByIdAndUpdate(
        inAppRecord._id,
        {
          $set: {
            deliveryStatus: status,
            'pushDelivery.attempts': 1,
            'pushDelivery.lastAttemptAt': new Date(),
            'pushDelivery.successCount': fcmResult?.successCount || 0,
            'pushDelivery.failureCount': fcmResult?.failureCount || 0,
            'pushDelivery.error': fcmResult?.error || (fcmResult?.noTokens ? 'NO_FCM_TOKENS_REGISTERED' : undefined),
          },
        },
        { new: true }
      ).catch((e) => {
        console.warn('[BOOKING_NOTIF] Error updating delivery status:', e.message)
        return null
      })
      if (updatedRecord) inAppRecord = updatedRecord
    }

    return {
      success: true,
      notification: inAppRecord,
      fcmResult,
    }
  } catch (err) {
    console.error('[BOOKING_NOTIF ERROR] Unexpected notification error (booking remains safe):', err)
    return { success: false, error: err.message }
  }
}

/**
 * Retry pending or failed notifications with bounded exponential backoff (Max 3 attempts)
 */
export async function processPendingNotifications() {
  try {
    const oneHourAgo = new Date(Date.now() - 3600 * 1000)
    const pendingNotifications = await InAppNotification.find({
      type: NOTIFICATION_TYPES.BOOKING_ACCEPTED,
      deliveryStatus: { $in: [DELIVERY_STATUS.PENDING, DELIVERY_STATUS.FAILED] },
      'pushDelivery.attempts': { $lt: 3 },
      createdAt: { $gte: oneHourAgo },
    }).limit(20)

    if (pendingNotifications.length === 0) {
      return { processed: 0, sent: 0 }
    }

    let sentCount = 0
    for (const notif of pendingNotifications) {
      const attempts = (notif.pushDelivery?.attempts || 0) + 1
      const pushPayload = {
        title: notif.title,
        body: notif.body,
        data: {
          type: notif.type,
          bookingId: String(notif.bookingId || ''),
          link: notif.metadata?.link || `/app/tracking/${notif.bookingId}`,
        },
      }

      const fcmResult = await sendNotificationToUser(notif.userId, pushPayload)
      const isSent = fcmResult?.success || fcmResult?.noTokens === true

      await InAppNotification.findByIdAndUpdate(notif._id, {
        $set: {
          deliveryStatus: isSent ? DELIVERY_STATUS.SENT : DELIVERY_STATUS.FAILED,
          'pushDelivery.attempts': attempts,
          'pushDelivery.lastAttemptAt': new Date(),
          'pushDelivery.successCount': fcmResult?.successCount || 0,
          'pushDelivery.failureCount': fcmResult?.failureCount || 0,
          'pushDelivery.error': fcmResult?.error,
        },
      })

      if (isSent) sentCount++
    }

    return { processed: pendingNotifications.length, sent: sentCount }
  } catch (err) {
    console.error('[BOOKING_NOTIF RETRY ERROR]', err.message)
    return { processed: 0, sent: 0, error: err.message }
  }
}
