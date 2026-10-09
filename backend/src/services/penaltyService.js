import { PenaltySetting } from '../models/PenaltySetting.js'
import { VendorPenalty, PENALTY_STATUS, PENALTY_TYPE } from '../models/VendorPenalty.js'
import { Booking } from '../models/Booking.js'
import { Wallet } from '../models/Wallet.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
import { InAppNotification } from '../models/InAppNotification.js'
import { sendNotificationToUser } from '../utils/pushNotificationHelper.js'
import { parseISTDateTime } from '../utils/dateHelper.js'

/**
 * 1. Get or initialize master penalty settings
 */
export async function getPenaltySettings() {
  let settings = await PenaltySetting.findOne({ configKey: 'master_penalty_config' })
  if (!settings) {
    settings = await PenaltySetting.create({ configKey: 'master_penalty_config' })
  }
  return settings
}

/**
 * 2. Update penalty settings
 */
export async function updatePenaltySettings(data, adminUser) {
  let settings = await PenaltySetting.findOne({ configKey: 'master_penalty_config' })
  if (!settings) {
    settings = new PenaltySetting({ configKey: 'master_penalty_config' })
  }

  const allowedFields = [
    'enabled',
    'defaultGracePeriodMinutes',
    'autoDeductEnabled',
    'maxPenaltyPerBooking',
    'disputeDeadlineHours',
    'noShowVerificationWindowMinutes',
    'precedencePolicy',
    'lateFeeEnabled',
    'lateFeeMode',
    'fixedLateFeeAmount',
    'lateFeeTiers',
    'maxLateFeesPerBooking',
    'bouncePenaltyEnabled',
    'fixedBouncePenaltyAmount',
    'autoDetectNoShowBounce',
  ]

  for (const field of allowedFields) {
    if (data[field] !== undefined) {
      settings[field] = data[field]
    }
  }

  if (adminUser?._id) {
    settings.updatedBy = adminUser._id
  }

  await settings.save()
  return settings
}

/**
 * 3. Calculate late fee according to settings mode
 */
export function calculateLateFeeAmount(delayMinutes, settings) {
  if (!settings || !settings.lateFeeEnabled) return 0

  if (settings.lateFeeMode === 'TIERED' && Array.isArray(settings.lateFeeTiers) && settings.lateFeeTiers.length > 0) {
    // Find matching tier
    for (const tier of settings.lateFeeTiers) {
      const minMatch = delayMinutes >= (tier.minDelayMinutes || 0)
      const maxMatch = tier.maxDelayMinutes == null || delayMinutes <= tier.maxDelayMinutes
      if (minMatch && maxMatch) {
        return Math.min(tier.feeAmount, settings.maxPenaltyPerBooking || 500)
      }
    }
  }

  // Default Fixed mode
  return Math.min(Number(settings.fixedLateFeeAmount || 50), settings.maxPenaltyPerBooking || 500)
}

/**
 * 4. Record Late Fee Incident (Called when vendor checks in / starts job late or detected by cron)
 */
export async function recordLateFeeIncident({ booking, vendorId, arrivalTime = new Date() }) {
  const settings = await getPenaltySettings()
  if (!settings.enabled || !settings.lateFeeEnabled) {
    return { created: false, reason: 'Penalty system or late fee is disabled' }
  }

  const apptTime = parseISTDateTime(booking.scheduledAt, booking.timeSlot)
  if (!apptTime) {
    return { created: false, reason: 'Unable to resolve appointment date/time' }
  }

  const graceMinutes = settings.defaultGracePeriodMinutes ?? 15
  const graceThresholdMs = apptTime.getTime() + graceMinutes * 60 * 1000
  const arrivalMs = new Date(arrivalTime).getTime()

  // Within grace period -> No penalty!
  if (arrivalMs <= graceThresholdMs) {
    return { created: false, reason: 'Arrival within allowed grace period' }
  }

  const delayMinutes = Math.max(1, Math.floor((arrivalMs - apptTime.getTime()) / (60 * 1000)))
  const feeAmount = calculateLateFeeAmount(delayMinutes, settings)
  if (feeAmount <= 0) {
    return { created: false, reason: 'Calculated fee amount is 0' }
  }

  const dedupeKey = `late_${booking._id}_${vendorId}`
  const existing = await VendorPenalty.findOne({ dedupeKey })
  if (existing) {
    return { created: false, penalty: existing, reason: 'Late fee already recorded for this booking' }
  }

  const shortCode = String(booking._id).slice(-6).toUpperCase()
  const initialStatus = settings.autoDeductEnabled ? PENALTY_STATUS.APPROVED : PENALTY_STATUS.PENDING_REVIEW

  const penalty = await VendorPenalty.create({
    bookingId: booking._id,
    vendorId,
    customerId: booking.userId,
    penaltyType: PENALTY_TYPE.LATE_FEE,
    status: initialStatus,
    amount: feeAmount,
    incidentTime: arrivalTime,
    delayMinutes,
    gracePeriodMinutes: graceMinutes,
    scheduledAppointmentTime: apptTime,
    actualArrivalTime: arrivalTime,
    reason: `Late Arrival: Partner arrived ${delayMinutes} mins after scheduled time (Grace period: ${graceMinutes} mins) for booking #${shortCode}`,
    evidence: {
      scheduledAppointmentTime: apptTime,
      actualArrivalTime: arrivalTime,
      delayMinutes,
      gracePeriodMinutes: graceMinutes,
    },
    dedupeKey,
    actionAudit: [
      {
        action: 'INCIDENT_DETECTED',
        notes: `Detected late arrival of ${delayMinutes} mins. Status: ${initialStatus}`,
      },
    ],
  })

  // If auto-deduct is enabled, apply deduction immediately
  if (settings.autoDeductEnabled) {
    await applyPenaltyDeduction(penalty)
  } else {
    // Notify vendor about pending review incident
    await sendPenaltyNotification(penalty, 'PENDING_REVIEW')
  }

  return { created: true, penalty }
}

/**
 * 5. Record Bounce Penalty Incident (Called when partner cancels or no-shows)
 */
export async function recordBounceIncident({ booking, vendorId, reason = '', cancelledBy = 'LABOUR', isExempt = false }) {
  const settings = await getPenaltySettings()
  if (!settings.enabled || !settings.bouncePenaltyEnabled) {
    return { created: false, reason: 'Penalty system or bounce penalty is disabled' }
  }

  if (isExempt) {
    return { created: false, reason: 'Cancellation is exempt from penalty' }
  }

  const shortCode = String(booking._id).slice(-6).toUpperCase()
  const penaltyAmount = Math.min(Number(settings.fixedBouncePenaltyAmount || 100), settings.maxPenaltyPerBooking || 500)
  if (penaltyAmount <= 0) {
    return { created: false, reason: 'Configured bounce penalty amount is 0' }
  }

  const dedupeKey = `bounce_${booking._id}_${vendorId}`
  const existing = await VendorPenalty.findOne({ dedupeKey })
  if (existing) {
    return { created: false, penalty: existing, reason: 'Bounce penalty already recorded for this booking' }
  }

  // Precedence policy check: If late fee exists and precedence is BOUNCE_OVER_LATE, we waive/supercede the late fee
  if (settings.precedencePolicy === 'BOUNCE_OVER_LATE') {
    await VendorPenalty.updateMany(
      { bookingId: booking._id, vendorId, penaltyType: PENALTY_TYPE.LATE_FEE, status: { $in: [PENALTY_STATUS.DETECTED, PENALTY_STATUS.PENDING_REVIEW] } },
      { $set: { status: PENALTY_STATUS.WAIVED, 'waiver.isWaived': true, 'waiver.reason': 'Superceded by bounce penalty' } }
    )
  }

  const initialStatus = settings.autoDeductEnabled ? PENALTY_STATUS.APPROVED : PENALTY_STATUS.PENDING_REVIEW

  const penalty = await VendorPenalty.create({
    bookingId: booking._id,
    vendorId,
    customerId: booking.userId,
    penaltyType: PENALTY_TYPE.BOUNCE_PENALTY,
    status: initialStatus,
    amount: penaltyAmount,
    incidentTime: new Date(),
    reason: `Bounce Penalty: Job cancelled / abandoned after acceptance for booking #${shortCode} (${reason || 'Worker cancellation'})`,
    evidence: {
      cancellationReason: reason,
      cancelledBy,
      bookingStatus: booking.status,
    },
    dedupeKey,
    actionAudit: [
      {
        action: 'BOUNCE_DETECTED',
        notes: `Bounce incident created. Reason: ${reason}. Status: ${initialStatus}`,
      },
    ],
  })

  if (settings.autoDeductEnabled) {
    await applyPenaltyDeduction(penalty)
  } else {
    await sendPenaltyNotification(penalty, 'PENDING_REVIEW')
  }

  return { created: true, penalty }
}

/**
 * 6. Financial Ledger Deduction Execution (Atomic & Immutable)
 */
export async function applyPenaltyDeduction(penalty, adminUser = null) {
  if (penalty.status === PENALTY_STATUS.APPLIED) {
    return { success: false, reason: 'Penalty already applied' }
  }

  const vendorId = penalty.vendorId
  let wallet = await Wallet.findOne({ userId: vendorId })
  if (!wallet) {
    wallet = await Wallet.create({ userId: vendorId })
  }

  const targetAmount = penalty.amount
  const currentBalance = wallet.selfBalance || 0
  const balanceBefore = currentBalance

  // Safely deduct up to available or track unpaid recovery
  const deductedAmount = Math.max(0, Math.min(currentBalance, targetAmount))
  const unpaidAmount = Math.max(0, targetAmount - deductedAmount)
  const balanceAfter = currentBalance - deductedAmount

  wallet.selfBalance = balanceAfter
  await wallet.save()

  const shortCode = String(penalty.bookingId).slice(-6).toUpperCase()

  // Create immutable WalletTransaction entry
  const txn = await WalletTransaction.create({
    walletId: wallet._id,
    userId: vendorId,
    amount: targetAmount,
    type: 'DEBIT',
    targetWallet: 'SELF',
    context: 'PENALTY',
    balanceBefore,
    balanceAfter,
    referenceType: 'BOOKING',
    referenceId: penalty.bookingId,
    description: `${penalty.penaltyType === PENALTY_TYPE.LATE_FEE ? 'Late Fee' : 'Bounce Penalty'} for Job #${shortCode}: ${penalty.reason}`,
  })

  penalty.status = PENALTY_STATUS.APPLIED
  penalty.deductedAmount = deductedAmount
  penalty.unpaidAmount = unpaidAmount
  penalty.walletTransactionId = txn._id

  penalty.actionAudit.push({
    action: 'DEDUCTION_APPLIED',
    performedBy: adminUser?._id || null,
    notes: `Deducted ₹${deductedAmount} (Unpaid: ₹${unpaidAmount}) from wallet. Txn #${txn._id}`,
  })

  await penalty.save()

  // Notify vendor of financial deduction
  await sendPenaltyNotification(penalty, 'APPLIED')

  return { success: true, penalty, txn }
}

/**
 * 7. Admin: Approve Pending Penalty
 */
export async function approvePenalty(penaltyId, adminUser) {
  const penalty = await VendorPenalty.findById(penaltyId)
  if (!penalty) throw new Error('Penalty record not found')

  if (penalty.status === PENALTY_STATUS.APPLIED) {
    throw new Error('Penalty is already applied')
  }

  return await applyPenaltyDeduction(penalty, adminUser)
}

/**
 * 8. Admin: Reject Penalty (Does not charge vendor)
 */
export async function rejectPenalty(penaltyId, adminUser, reason = '') {
  const penalty = await VendorPenalty.findById(penaltyId)
  if (!penalty) throw new Error('Penalty record not found')

  if (penalty.status === PENALTY_STATUS.APPLIED) {
    throw new Error('Cannot reject an already applied penalty. Use Reverse Deduction instead.')
  }

  penalty.status = PENALTY_STATUS.REJECTED
  penalty.actionAudit.push({
    action: 'PENALTY_REJECTED',
    performedBy: adminUser._id,
    notes: reason || 'Admin rejected penalty incident',
  })

  await penalty.save()
  return penalty
}

/**
 * 9. Admin: Waive Penalty (With mandatory reason)
 */
export async function waivePenalty(penaltyId, adminUser, reason) {
  if (!reason || !reason.trim()) {
    throw new Error('Mandatory reason is required to waive a penalty')
  }

  const penalty = await VendorPenalty.findById(penaltyId)
  if (!penalty) throw new Error('Penalty record not found')

  // If already deducted and not yet refunded, reverse it back to vendor wallet!
  if (penalty.deductedAmount > 0 && !penalty.reversal?.isReversed) {
    await reversePenaltyDeduction(penaltyId, adminUser, `Waived by Admin: ${reason}`)
  }

  penalty.status = PENALTY_STATUS.WAIVED
  penalty.waiver = {
    isWaived: true,
    waivedBy: adminUser._id,
    waivedAt: new Date(),
    reason: reason.trim(),
  }

  penalty.actionAudit.push({
    action: 'PENALTY_WAIVED',
    performedBy: adminUser._id,
    notes: `Waived: ${reason}`,
  })

  await penalty.save()
  await sendPenaltyNotification(penalty, 'WAIVED')
  return penalty
}

/**
 * 10. Vendor: Submit Dispute
 */
export async function submitPenaltyDispute(penaltyId, vendorUser, reason, evidenceUrls = []) {
  if (!reason || !reason.trim()) {
    throw new Error('Dispute reason is required')
  }

  const penalty = await VendorPenalty.findOne({ _id: penaltyId, vendorId: vendorUser._id })
  if (!penalty) throw new Error('Penalty record not found for this vendor')

  if (penalty.dispute?.isDisputed) {
    throw new Error('A dispute has already been submitted for this penalty')
  }

  const settings = await getPenaltySettings()
  const deadlineHours = settings.disputeDeadlineHours ?? 72
  const deadlineMs = new Date(penalty.createdAt).getTime() + deadlineHours * 60 * 60 * 1000

  if (Date.now() > deadlineMs) {
    throw new Error(`Dispute deadline of ${deadlineHours} hours has passed`)
  }

  penalty.status = PENALTY_STATUS.DISPUTED
  penalty.dispute = {
    isDisputed: true,
    submittedAt: new Date(),
    reason: reason.trim(),
    evidenceUrls: Array.isArray(evidenceUrls) ? evidenceUrls : [],
    status: 'PENDING',
  }

  penalty.actionAudit.push({
    action: 'DISPUTE_SUBMITTED',
    performedBy: vendorUser._id,
    notes: `Vendor submitted dispute: ${reason}`,
  })

  await penalty.save()
  return penalty
}

/**
 * 11. Admin: Review Vendor Dispute
 */
export async function reviewPenaltyDispute(penaltyId, adminUser, decision, adminNotes = '') {
  const penalty = await VendorPenalty.findById(penaltyId)
  if (!penalty) throw new Error('Penalty record not found')

  if (!penalty.dispute?.isDisputed) {
    throw new Error('This penalty does not have an active dispute')
  }

  if (decision === 'ACCEPT') {
    // Dispute accepted -> Waive penalty and refund if already deducted
    penalty.dispute.status = 'ACCEPTED'
    penalty.dispute.reviewedBy = adminUser._id
    penalty.dispute.reviewedAt = new Date()
    penalty.dispute.adminNotes = adminNotes
    await penalty.save()

    return await waivePenalty(penaltyId, adminUser, `Dispute Accepted: ${adminNotes || 'Valid partner justification'}`)
  } else {
    // Dispute rejected -> Confirm penalty
    penalty.dispute.status = 'REJECTED'
    penalty.dispute.reviewedBy = adminUser._id
    penalty.dispute.reviewedAt = new Date()
    penalty.dispute.adminNotes = adminNotes
    penalty.status = penalty.deductedAmount > 0 ? PENALTY_STATUS.APPLIED : PENALTY_STATUS.APPROVED

    penalty.actionAudit.push({
      action: 'DISPUTE_REJECTED',
      performedBy: adminUser._id,
      notes: `Dispute Rejected: ${adminNotes}`,
    })

    await penalty.save()
    await sendPenaltyNotification(penalty, 'DISPUTE_REJECTED')
    return penalty
  }
}

/**
 * 12. Admin: Reverse Applied Penalty Deduction (Compensating Ledger Entry)
 */
export async function reversePenaltyDeduction(penaltyId, adminUser, reason) {
  if (!reason || !reason.trim()) {
    throw new Error('Mandatory reason is required to reverse a deduction')
  }

  const penalty = await VendorPenalty.findById(penaltyId)
  if (!penalty) throw new Error('Penalty record not found')

  if (penalty.status !== PENALTY_STATUS.APPLIED && penalty.deductedAmount <= 0) {
    throw new Error('No deducted amount found to reverse')
  }

  if (penalty.reversal?.isReversed) {
    throw new Error('Penalty deduction has already been reversed')
  }

  const vendorId = penalty.vendorId
  let wallet = await Wallet.findOne({ userId: vendorId })
  if (!wallet) {
    wallet = await Wallet.create({ userId: vendorId })
  }

  const refundAmount = penalty.deductedAmount
  const balanceBefore = wallet.selfBalance || 0
  const balanceAfter = balanceBefore + refundAmount

  wallet.selfBalance = balanceAfter
  await wallet.save()

  const shortCode = String(penalty.bookingId).slice(-6).toUpperCase()

  // Compensating CREDIT Transaction
  const refundTxn = await WalletTransaction.create({
    walletId: wallet._id,
    userId: vendorId,
    amount: refundAmount,
    type: 'CREDIT',
    targetWallet: 'SELF',
    context: 'REFUND',
    balanceBefore,
    balanceAfter,
    referenceType: 'BOOKING',
    referenceId: penalty.bookingId,
    description: `Penalty Reversal Refund for Job #${shortCode}: ${reason}`,
  })

  penalty.status = PENALTY_STATUS.REVERSED
  penalty.reversal = {
    isReversed: true,
    reversedBy: adminUser._id,
    reversedAt: new Date(),
    reason: reason.trim(),
    refundTransactionId: refundTxn._id,
  }

  penalty.actionAudit.push({
    action: 'DEDUCTION_REVERSED',
    performedBy: adminUser._id,
    notes: `Reversed ₹${refundAmount} back to vendor wallet. Txn #${refundTxn._id}. Reason: ${reason}`,
  })

  await penalty.save()
  await sendPenaltyNotification(penalty, 'REVERSED')

  return { penalty, refundTxn }
}

/**
 * 13. Overview Stats for Admin Dashboard
 */
export async function getPenaltyOverviewStats() {
  const [
    totalCount,
    pendingReviewCount,
    appliedCount,
    disputedCount,
    waivedCount,
    reversedCount,
    lateCount,
    bounceCount,
    settings,
  ] = await Promise.all([
    VendorPenalty.countDocuments(),
    VendorPenalty.countDocuments({ status: PENALTY_STATUS.PENDING_REVIEW }),
    VendorPenalty.countDocuments({ status: PENALTY_STATUS.APPLIED }),
    VendorPenalty.countDocuments({ status: PENALTY_STATUS.DISPUTED }),
    VendorPenalty.countDocuments({ status: PENALTY_STATUS.WAIVED }),
    VendorPenalty.countDocuments({ status: PENALTY_STATUS.REVERSED }),
    VendorPenalty.countDocuments({ penaltyType: PENALTY_TYPE.LATE_FEE }),
    VendorPenalty.countDocuments({ penaltyType: PENALTY_TYPE.BOUNCE_PENALTY }),
    getPenaltySettings(),
  ])

  const deductionsSumResult = await VendorPenalty.aggregate([
    { $match: { status: PENALTY_STATUS.APPLIED } },
    { $group: { _id: null, total: { $sum: '$deductedAmount' } } },
  ])
  const totalDeductedAmount = deductionsSumResult[0]?.total || 0

  return {
    totalCount,
    pendingReviewCount,
    appliedCount,
    disputedCount,
    waivedCount,
    reversedCount,
    lateCount,
    bounceCount,
    totalDeductedAmount,
    settings,
  }
}

/**
 * 14. Scheduler Background Task: Scan Overdue Bookings for Late Arrival / No-Show Bounce
 */
export async function scanOverdueBookingsJob() {
  const settings = await getPenaltySettings()
  if (!settings.enabled) return { scanned: 0, incidentsCreated: 0 }

  const now = new Date()
  const graceMinutes = settings.defaultGracePeriodMinutes ?? 15
  const noShowMinutes = settings.noShowVerificationWindowMinutes ?? 60

  // Find active confirmed bookings where scheduled appointment time has passed
  const activeBookings = await Booking.find({
    status: { $in: ['ACCEPTED', 'ASSIGNED', 'EN_ROUTE'] },
    scheduledAt: { $exists: true, $ne: null },
  })
    .limit(50)
    .lean()

  let incidentsCreated = 0

  for (const b of activeBookings) {
    const apptTime = parseISTDateTime(b.scheduledAt, b.timeSlot)
    if (!apptTime) continue

    const apptMs = apptTime.getTime()
    const nowMs = now.getTime()
    const vendorId = b.laborId || (b.acceptedLabourIds && b.acceptedLabourIds[0])
    if (!vendorId) continue

    // 1. Check No-Show Bounce (Scheduled time + noShowMinutes passed without starting)
    if (settings.bouncePenaltyEnabled && settings.autoDetectNoShowBounce && nowMs >= apptMs + noShowMinutes * 60 * 1000) {
      const res = await recordBounceIncident({
        booking: b,
        vendorId,
        reason: `Automated No-Show Detection: Partner did not arrive within ${noShowMinutes} mins of scheduled time`,
        cancelledBy: 'SYSTEM',
        isExempt: false,
      })
      if (res.created) incidentsCreated++
    }
    // 2. Check Late Fee (Scheduled time + graceMinutes passed without starting)
    else if (settings.lateFeeEnabled && nowMs >= apptMs + graceMinutes * 60 * 1000) {
      const res = await recordLateFeeIncident({
        booking: b,
        vendorId,
        arrivalTime: now,
      })
      if (res.created) incidentsCreated++
    }
  }

  return { scanned: activeBookings.length, incidentsCreated }
}

/**
 * Internal Notification Helper for Penalties
 */
async function sendPenaltyNotification(penalty, eventType) {
  try {
    const vendorId = penalty.vendorId
    const shortCode = String(penalty.bookingId).slice(-6).toUpperCase()

    let title = '⚠️ Policy Notification'
    let body = ''

    if (eventType === 'PENDING_REVIEW') {
      title = penalty.penaltyType === PENALTY_TYPE.LATE_FEE ? '⚠️ Late Arrival Incident Detected' : '⚠️ Booking Bounce Detected'
      body = `An incident was recorded for booking #${shortCode} (₹${penalty.amount}). It is currently under admin review.`
    } else if (eventType === 'APPLIED') {
      title = '💸 Penalty Deduction Applied'
      body = `₹${penalty.deductedAmount} was deducted from your wallet for booking #${shortCode}. Tap to view details or submit a dispute.`
    } else if (eventType === 'WAIVED' || eventType === 'REVERSED') {
      title = '✅ Penalty Waived / Refunded'
      body = `The penalty for booking #${shortCode} has been waived/refunded to your wallet.`
    } else if (eventType === 'DISPUTE_REJECTED') {
      title = '❌ Penalty Dispute Decision'
      body = `Your dispute for booking #${shortCode} was reviewed and rejected by admin.`
    }

    // Save in-app notification
    await InAppNotification.create({
      userId: vendorId,
      bookingId: penalty.bookingId,
      title,
      body,
      type: 'PENALTY_ALERT',
      metadata: {
        penaltyId: String(penalty._id),
        bookingId: String(penalty.bookingId),
        penaltyType: penalty.penaltyType,
        amount: penalty.amount,
      },
    })

    // Dispatch FCM push notification
    sendNotificationToUser(vendorId, {
      title,
      body,
      data: {
        type: 'PENALTY_ALERT',
        penaltyId: String(penalty._id),
        bookingId: String(penalty.bookingId),
        click_action: '/app/labour/penalties',
      },
    }).catch((err) => console.warn('[Penalty Push Notification Warning]', err?.message))
  } catch (err) {
    console.error('[sendPenaltyNotification Error]', err?.message)
  }
}
