import { InAppNotification, NOTIFICATION_TYPES } from '../models/InAppNotification.js'
import { sendNotificationToUser } from '../utils/pushNotificationHelper.js'
import { User } from '../models/User.js'
import { USER_ROLES } from '../constants/roles.js'

/**
 * Dispatch an In-App notification and FCM push notification to a user safely.
 * Non-blocking for primary business transaction.
 */
async function dispatchSafeNotification({ userId, title, body, type = NOTIFICATION_TYPES.SYSTEM, metadata = {}, idempotencyKey = null }) {
  try {
    let inAppRecord = null

    if (idempotencyKey) {
      const existing = await InAppNotification.findOne({ idempotencyKey })
      if (existing) {
        return { skipped: true, reason: 'Duplicate notification suppressed by idempotencyKey' }
      }
    }

    inAppRecord = await InAppNotification.create({
      userId,
      title,
      body,
      type,
      idempotencyKey: idempotencyKey || undefined,
      metadata,
      read: false,
    })

    // Dispatch FCM Push Notification (non-blocking)
    try {
      await sendNotificationToUser(userId, {
        title,
        body,
        data: {
          type,
          ...metadata,
          click_action: '/app/welcome-kit',
        },
      })
    } catch (pushErr) {
      console.warn(`[FCM Notification Warning for user ${userId}]:`, pushErr?.message)
    }

    return { success: true, notificationId: inAppRecord?._id }
  } catch (err) {
    // Suppress duplicate key errors if race condition occurred
    if (err?.code === 11000) {
      return { skipped: true, reason: 'Idempotency conflict handled' }
    }
    console.error(`[WelcomeKit Notification Error for user ${userId}]:`, err?.message)
    return { success: false, error: err?.message }
  }
}

/**
 * Notify all active admins with a system notification
 */
async function notifyAdmins({ title, body, metadata = {}, idempotencyKey = null }) {
  try {
    const admins = await User.find({ role: USER_ROLES.ADMIN, isActive: true }).select('_id').lean()
    const promises = admins.map((admin) =>
      dispatchSafeNotification({
        userId: admin._id,
        title,
        body,
        type: NOTIFICATION_TYPES.SYSTEM,
        metadata,
        idempotencyKey: idempotencyKey ? `${idempotencyKey}_admin_${admin._id}` : null,
      })
    )
    await Promise.allSettled(promises)
  } catch (err) {
    console.error('[Notify Admins Error]:', err?.message)
  }
}

/**
 * Payment Slip Approved
 */
export async function notifyPaymentApproved(providerId) {
  return dispatchSafeNotification({
    userId: providerId,
    title: 'Payment Slip Approved',
    body: 'Your payment slip has been approved successfully. Please submit your welcome kit delivery address to proceed.',
    type: NOTIFICATION_TYPES.SYSTEM,
    metadata: {
      action: 'PAYMENT_SLIP_APPROVED',
      screen: 'WELCOME_KIT_ADDRESS',
    },
    idempotencyKey: `WK_PAY_APPROVE_${providerId}_${new Date().toISOString().slice(0, 10)}`,
  })
}

/**
 * Payment Slip Rejected
 */
export async function notifyPaymentRejected(providerId, reason) {
  const cleanReason = String(reason || 'Payment screenshot could not be verified.').trim()
  return dispatchSafeNotification({
    userId: providerId,
    title: 'Payment Slip Rejected',
    body: `Your payment slip has been rejected. Reason: ${cleanReason}. Please review the reason and resubmit your slip.`,
    type: NOTIFICATION_TYPES.SYSTEM,
    metadata: {
      action: 'PAYMENT_SLIP_REJECTED',
      reason: cleanReason,
      screen: 'WELCOME_KIT_PAYMENT',
    },
    idempotencyKey: `WK_PAY_REJECT_${providerId}_${Date.now()}`,
  })
}

/**
 * Provider submitted address -> notify admin and provider
 */
export async function notifyAddressSubmitted(provider) {
  const providerName = provider.fullName || provider.phone || 'Partner'

  // Provider confirmation
  await dispatchSafeNotification({
    userId: provider._id,
    title: 'Address Submitted',
    body: 'Your welcome kit delivery address has been received and is waiting for review.',
    type: NOTIFICATION_TYPES.SYSTEM,
    metadata: {
      action: 'ADDRESS_SUBMITTED',
      screen: 'WELCOME_KIT_STATUS',
    },
    idempotencyKey: `WK_ADDR_SUBMIT_${provider._id}_${Date.now()}`,
  })

  // Admin alert
  await notifyAdmins({
    title: 'Welcome Kit Address Submitted',
    body: `Service provider ${providerName} has submitted their welcome kit delivery address.`,
    metadata: {
      providerId: String(provider._id),
      providerName,
      action: 'REVIEW_WELCOME_KIT_ADDRESS',
    },
    idempotencyKey: `WK_ADDR_SUBMIT_ADMIN_${provider._id}_${Date.now()}`,
  })
}

/**
 * Admin requested address correction
 */
export async function notifyAddressCorrectionRequested(providerId, reason) {
  const cleanReason = String(reason || 'Please provide complete house number, landmark, and pin code.').trim()
  return dispatchSafeNotification({
    userId: providerId,
    title: 'Welcome Kit Address Correction Requested',
    body: `Please review and update your welcome kit delivery address. Reason: ${cleanReason}`,
    type: NOTIFICATION_TYPES.SYSTEM,
    metadata: {
      action: 'ADDRESS_CORRECTION_REQUESTED',
      reason: cleanReason,
      screen: 'WELCOME_KIT_ADDRESS',
    },
    idempotencyKey: `WK_ADDR_CORRECTION_${providerId}_${Date.now()}`,
  })
}

/**
 * Admin confirmed shipping address & ready for dispatch
 */
export async function notifyAddressConfirmed(providerId) {
  return dispatchSafeNotification({
    userId: providerId,
    title: 'Welcome Kit Address Confirmed',
    body: 'Your welcome kit delivery address has been confirmed. Your kit is being prepared for dispatch.',
    type: NOTIFICATION_TYPES.SYSTEM,
    metadata: {
      action: 'ADDRESS_CONFIRMED',
      screen: 'WELCOME_KIT_STATUS',
    },
    idempotencyKey: `WK_ADDR_CONFIRMED_${providerId}_${new Date().toISOString().slice(0, 10)}`,
  })
}

/**
 * Welcome Kit Dispatched
 */
export async function notifyWelcomeKitDispatched(providerId, dispatchDetails = {}) {
  const { courierCompany, trackingNumber, trackingUrl } = dispatchDetails
  let extraInfo = ''
  if (courierCompany) {
    extraInfo = ` Dispatched via ${courierCompany}.`
    if (trackingNumber) {
      extraInfo += ` AWB: ${trackingNumber}.`
    }
    if (trackingUrl) {
      extraInfo += ` Tracking Link: ${trackingUrl}`
    }
  }

  return dispatchSafeNotification({
    userId: providerId,
    title: 'Welcome Kit Dispatched',
    body: `Your welcome kit has been marked as dispatched.${extraInfo}`,
    type: NOTIFICATION_TYPES.SYSTEM,
    metadata: {
      action: 'WELCOME_KIT_DISPATCHED',
      courierCompany: courierCompany || '',
      trackingNumber: trackingNumber || '',
      trackingUrl: trackingUrl || '',
      screen: 'WELCOME_KIT_STATUS',
    },
    idempotencyKey: `WK_DISPATCHED_${providerId}_${Date.now()}`,
  })
}

/**
 * Welcome Kit Delivered Successfully
 */
export async function notifyWelcomeKitDelivered(provider) {
  const providerId = provider._id || provider
  const providerName = provider.fullName || provider.phone || 'Partner'

  // Provider Notification
  await dispatchSafeNotification({
    userId: providerId,
    title: 'Welcome Kit Delivered Successfully',
    body: 'Your welcome kit has been marked as successfully delivered. Thank you for being part of A2Z Services!',
    type: NOTIFICATION_TYPES.SYSTEM,
    metadata: {
      action: 'WELCOME_KIT_DELIVERED',
      screen: 'WELCOME_KIT_STATUS',
    },
    idempotencyKey: `WK_DELIVERED_${providerId}_${new Date().toISOString().slice(0, 10)}`,
  })

  // Admin Notification
  await notifyAdmins({
    title: 'Welcome Kit Delivery Confirmed',
    body: `Welcome kit delivery has been confirmed for ${providerName}. Profile is fully activated.`,
    metadata: {
      providerId: String(providerId),
      providerName,
      action: 'DELIVERY_CONFIRMED',
    },
    idempotencyKey: `WK_DELIVERED_ADMIN_${providerId}_${new Date().toISOString().slice(0, 10)}`,
  })
}
