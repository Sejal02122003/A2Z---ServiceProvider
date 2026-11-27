import { InAppNotification, NOTIFICATION_TYPES } from '../models/InAppNotification.js'
import { sendNotificationToUser } from '../utils/pushNotificationHelper.js'
import { findAdminRecipients } from './adminRecipients.js'

/**
 * Notify all active admins when a Service Provider submits an approval / KYC verification request
 */
export async function notifyAdminProviderApprovalRequest({
  provider,
  documentType = 'Aadhaar / PAN',
  documentUrls = [],
  action = 'PROVIDER_APPROVAL_REQUEST',
}) {
  try {
    const providerName = provider.fullName || provider.phone || 'Service Partner'
    const providerPhone = provider.phone || ''
    const title = `Service Provider Approval Request: ${providerName}`
    const body = `${providerName} (${providerPhone}) submitted ${documentType} documents for admin verification & approval.`
    const link = '/admin/identity-verifications'

    // 1. Fetch all active admins
    const admins = await findAdminRecipients(link)
    if (!admins.length) {
      console.warn('[Admin Notification] No active admins found in database.')
    }

    // 2. Insert InAppNotification and dispatch FCM push for each admin
    const promises = admins.map(async (admin) => {
      try {
        await InAppNotification.create({
          userId: admin._id,
          title,
          body,
          type: NOTIFICATION_TYPES.SYSTEM,
          metadata: {
            action,
            partnerId: String(provider._id),
            phone: providerPhone,
            documentType,
            link,
          },
          read: false,
        })

        // FCM push to admin
        await sendNotificationToUser(admin._id, {
          title,
          body,
          data: {
            type: action,
            partnerId: String(provider._id),
            phone: providerPhone,
            link,
          },
        }).catch((pushErr) => {
          console.warn(`[FCM Admin Push Warning for admin ${admin._id}]:`, pushErr?.message)
        })
      } catch (err) {
        console.warn(`[InAppNotification Error for admin ${admin._id}]:`, err?.message)
      }
    })
    await Promise.allSettled(promises)

    // 3. Emit real-time Socket.IO alert to "admins" room and global broadcast
    try {
      const { emitToAdmins } = await import('../socket.js')
      const payload = {
        partnerId: provider._id,
        partnerName: providerName,
        phone: providerPhone,
        documentType,
        documentUrls,
        submittedAt: new Date().toISOString(),
        title,
        body,
        link,
      }
      emitToAdmins('PROVIDER_APPROVAL_REQUEST', payload)
      console.log(`[FLOW: NOTIFY_ADMIN] Dispatched PROVIDER_APPROVAL_REQUEST for partner ${provider._id} to ${admins.length} admins`)
    } catch (socketErr) {
      console.warn('[Socket Warning] Could not emit PROVIDER_APPROVAL_REQUEST:', socketErr?.message)
    }
  } catch (err) {
    console.error('[notifyAdminProviderApprovalRequest Error]:', err)
  }
}

/**
 * Notify all active admins when a Service Provider submits an offline Welcome Kit payment slip
 */
export async function notifyAdminWelcomeKitPaymentSubmitted({
  provider,
  amount = 999,
  paymentReceiptUrl = '',
}) {
  try {
    const providerName = provider.fullName || provider.phone || 'Service Partner'
    const providerPhone = provider.phone || ''
    const title = `Welcome Kit Payment Slip: ${providerName}`
    const body = `${providerName} (${providerPhone}) submitted payment receipt of ₹${amount} for Welcome Kit verification.`
    const link = '/admin/labour'

    const admins = await findAdminRecipients(link)
    const promises = admins.map(async (admin) => {
      try {
        await InAppNotification.create({
          userId: admin._id,
          title,
          body,
          type: NOTIFICATION_TYPES.SYSTEM,
          metadata: {
            action: 'WELCOME_KIT_PAYMENT_SUBMITTED',
            partnerId: String(provider._id),
            phone: providerPhone,
            paymentReceiptUrl,
            link,
          },
          read: false,
        })

        await sendNotificationToUser(admin._id, {
          title,
          body,
          data: {
            type: 'PROVIDER_PAYMENT_SUBMITTED',
            partnerId: String(provider._id),
            phone: providerPhone,
            amount: String(amount),
            link,
          },
        }).catch(() => {})
      } catch (err) {
        console.warn(`[InAppNotification Error for admin ${admin._id}]:`, err?.message)
      }
    })
    await Promise.allSettled(promises)

    try {
      const { emitToAdmins } = await import('../socket.js')
      const payload = {
        userName: providerName,
        phone: providerPhone,
        amount,
        paymentReceiptUrl,
        link,
        title,
        body,
        createdAt: new Date().toISOString(),
      }
      emitToAdmins('PROVIDER_PAYMENT_SUBMITTED', payload)
    } catch (socketErr) {
      console.warn('[Socket Warning] Could not emit PROVIDER_PAYMENT_SUBMITTED:', socketErr?.message)
    }
  } catch (err) {
    console.error('[notifyAdminWelcomeKitPaymentSubmitted Error]:', err)
  }
}
