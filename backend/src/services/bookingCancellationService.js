import { BookingCancellationSetting } from '../models/BookingCancellationSetting.js'
import {
  BookingCancellationRecord,
  CANCELLATION_STATUS,
  TIMING_CLASSIFICATION,
  CANCELLATION_PENALTY_STATUS,
  APPROVAL_STATUS,
} from '../models/BookingCancellationRecord.js'
import { Booking } from '../models/Booking.js'
import { Wallet } from '../models/Wallet.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
import { InAppNotification } from '../models/InAppNotification.js'
import { User } from '../models/User.js'
import { sendNotificationToUser } from '../utils/pushNotificationHelper.js'
import { parseISTDateTime } from '../utils/dateHelper.js'

/**
 * 1. Get or create Master Booking Cancellation Settings
 */
export async function getBookingCancellationSettings() {
  let settings = await BookingCancellationSetting.findOne({
    configKey: 'master_cancellation_config',
  })
  if (!settings) {
    settings = await BookingCancellationSetting.create({
      configKey: 'master_cancellation_config',
    })
  }
  return settings
}

/**
 * 2. Update Booking Cancellation Settings
 */
export async function updateBookingCancellationSettings(data, adminUser) {
  let settings = await BookingCancellationSetting.findOne({
    configKey: 'master_cancellation_config',
  })
  if (!settings) {
    settings = new BookingCancellationSetting({
      configKey: 'master_cancellation_config',
    })
  }

  const allowedFields = [
    'enabled',
    'cutoffHours',
    'penaltyType',
    'fixedPenaltyAmount',
    'percentagePenaltyRate',
    'lateCancellationAction',
    'requireReason',
    'allowedReasons',
    'customerCancellationEnabled',
    'customerCutoffMinutes',
    'customerCancellationFee',
    'customerAllowedReasons',
    'customerWarningEnabled',
    'customerWarningThreshold',
    'customerRestrictionThreshold',
    'customerRollingWindowDays',
    'customerRestrictionMode',
    'customerRestrictionDurationDays',
    'customerPushNotificationsEnabled',
    'customerWarningMessage',
    'customerRestrictionMessage',
  ]

  // Positive integer validations
  if (data.customerWarningThreshold !== undefined) {
    const val = Number(data.customerWarningThreshold)
    if (!Number.isInteger(val) || val < 1) {
      throw new Error('Warning threshold must be a positive integer (minimum 1)')
    }
  }
  if (data.customerRestrictionThreshold !== undefined) {
    const val = Number(data.customerRestrictionThreshold)
    if (!Number.isInteger(val) || val < 1) {
      throw new Error('Restriction threshold must be a positive integer (minimum 1)')
    }
  }
  if (data.customerRollingWindowDays !== undefined) {
    const val = Number(data.customerRollingWindowDays)
    if (!Number.isInteger(val) || val < 1) {
      throw new Error('Rolling window days must be a positive integer (minimum 1)')
    }
  }
  if (data.customerRestrictionDurationDays !== undefined) {
    const val = Number(data.customerRestrictionDurationDays)
    if (!Number.isInteger(val) || val < 1) {
      throw new Error('Restriction duration days must be a positive integer (minimum 1)')
    }
  }
  if (data.customerRestrictionMode !== undefined) {
    if (!['WARNING_ONLY', 'TEMPORARY_RESTRICTION', 'MANUAL_REVIEW'].includes(data.customerRestrictionMode)) {
      throw new Error('Invalid restriction mode. Allowed: WARNING_ONLY, TEMPORARY_RESTRICTION, MANUAL_REVIEW')
    }
  }

  // Ensure restriction threshold is not lower than warning threshold
  const effectiveWarning =
    data.customerWarningThreshold !== undefined
      ? Number(data.customerWarningThreshold)
      : Number(settings.customerWarningThreshold || 3)
  const effectiveRestriction =
    data.customerRestrictionThreshold !== undefined
      ? Number(data.customerRestrictionThreshold)
      : Number(settings.customerRestrictionThreshold || 5)

  if (effectiveRestriction < effectiveWarning) {
    throw new Error('Restriction threshold cannot be lower than warning threshold')
  }

  allowedFields.forEach((field) => {
    if (data[field] !== undefined) {
      settings[field] = data[field]
    }
  })

  if (adminUser?._id) {
    settings.updatedBy = adminUser._id
  }

  await settings.save()
  return settings
}

/**
 * 3. Check Cancellation Eligibility & Compute Penalty
 */
export async function getCancellationEligibility(bookingId, userId, overrideTime = null) {
  const settings = await getBookingCancellationSettings()
  const booking = await Booking.findById(bookingId)
  if (!booking) {
    return { isEligible: false, reason: 'Booking not found' }
  }

  // Check ownership / assignment if userId is provided
  if (userId) {
    const isAssignedVendor =
      String(booking.laborId?._id || booking.laborId || '') === String(userId) ||
      String(booking.acceptedLabourId?._id || booking.acceptedLabourId || '') === String(userId) ||
      (booking.assignments &&
        booking.assignments.some((a) => String(a.labourId?._id || a.labourId || '') === String(userId)))

    if (!isAssignedVendor) {
      return { isEligible: false, reason: 'You are not the assigned vendor for this booking' }
    }
  }

  // Check booking lifecycle status
  const uncancelableStatuses = ['STARTED', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'FAILED']
  if (uncancelableStatuses.includes(booking.status)) {
    return {
      isEligible: false,
      currentStatus: booking.status,
      reason:
        booking.status === 'STARTED'
          ? 'Service has already started and is in progress. Ordinary cancellation is not permitted.'
          : `Booking is already ${booking.status.toLowerCase()}.`,
    }
  }

  if (booking.status === 'CANCELLATION_REQUESTED') {
    return {
      isEligible: false,
      currentStatus: booking.status,
      reason: 'A cancellation request is already pending admin review.',
    }
  }

  // Calculate Service Start DateTime
  let serviceStartDateTime = null
  if (booking.scheduledAt && !isNaN(new Date(booking.scheduledAt).getTime())) {
    serviceStartDateTime = new Date(booking.scheduledAt)
  } else if (booking.date) {
    serviceStartDateTime = parseISTDateTime(booking.date, booking.timeSlot)
  } else {
    serviceStartDateTime = new Date(booking.createdAt || Date.now())
  }
  const now = overrideTime ? new Date(overrideTime) : new Date()
  const timeRemainingMs = serviceStartDateTime.getTime() - now.getTime()
  const timeRemainingMinutes = Math.floor(timeRemainingMs / (60 * 1000))
  const timeRemainingHours = Number((timeRemainingMs / (3600 * 1000)).toFixed(2))

  const cutoffHours = Number(settings.cutoffHours || 2)
  const cutoffMs = cutoffHours * 3600 * 1000

  // 1. If start time has already passed
  if (timeRemainingMs <= 0) {
    return {
      isEligible: false,
      isExpired: true,
      timingClassification: TIMING_CLASSIFICATION.EXPIRED,
      serviceStartDateTime,
      timeRemainingMinutes,
      timeRemainingHours,
      cutoffHours,
      reason: 'Service scheduled start time has already passed. Ordinary cancellation is blocked.',
    }
  }

  // 2. If policy is disabled OR cancellation is at least cutoffHours away (Standard Cancellation)
  if (!settings.enabled || timeRemainingMs >= cutoffMs) {
    return {
      isEligible: true,
      isLate: false,
      timingClassification: TIMING_CLASSIFICATION.STANDARD,
      action: 'ALLOW',
      requiresApproval: false,
      isBlocked: false,
      penaltyType: 'NONE',
      penaltyAmount: 0,
      penaltyRateOrAmount: 0,
      cutoffHours,
      timeRemainingMinutes,
      timeRemainingHours,
      serviceStartDateTime,
      message: `Standard cancellation allowed without penalty (${timeRemainingHours}h before service).`,
    }
  }

  // 3. Cancellation is within cutoff (< cutoffHours) -> Late Cancellation
  const baseAmount = Number(
    booking.laborShare || booking.totalAmount || booking.basePrice || 0
  )
  let calculatedPenalty = 0

  if (settings.penaltyType === 'FIXED') {
    calculatedPenalty = Math.max(0, Number(settings.fixedPenaltyAmount || 200))
  } else if (settings.penaltyType === 'PERCENTAGE') {
    const rate = Math.max(0, Math.min(100, Number(settings.percentagePenaltyRate || 20)))
    calculatedPenalty = Math.round((rate / 100) * baseAmount)
  }

  const lateAction = settings.lateCancellationAction || 'PENALIZE'

  if (lateAction === 'BLOCK') {
    return {
      isEligible: false,
      isLate: true,
      isBlocked: true,
      timingClassification: TIMING_CLASSIFICATION.LATE,
      action: 'BLOCK',
      requiresApproval: false,
      penaltyType: settings.penaltyType,
      penaltyAmount: calculatedPenalty,
      cutoffHours,
      timeRemainingMinutes,
      timeRemainingHours,
      serviceStartDateTime,
      reason: `Late cancellation within ${cutoffHours} hours of service is blocked by platform policy.`,
    }
  }

  if (lateAction === 'REQUIRE_APPROVAL') {
    return {
      isEligible: true,
      isLate: true,
      isBlocked: false,
      requiresApproval: true,
      timingClassification: TIMING_CLASSIFICATION.LATE,
      action: 'REQUIRE_APPROVAL',
      penaltyType: settings.penaltyType,
      penaltyAmount: calculatedPenalty,
      penaltyRateOrAmount:
        settings.penaltyType === 'PERCENTAGE'
          ? settings.percentagePenaltyRate
          : settings.fixedPenaltyAmount,
      cutoffHours,
      timeRemainingMinutes,
      timeRemainingHours,
      serviceStartDateTime,
      message: `Cancellation within ${cutoffHours} hours requires Admin Approval. If approved, a penalty of ₹${calculatedPenalty} will apply.`,
    }
  }

  // Default: PENALIZE
  return {
    isEligible: true,
    isLate: true,
    isBlocked: false,
    requiresApproval: false,
    timingClassification: TIMING_CLASSIFICATION.LATE,
    action: 'PENALIZE',
    penaltyType: settings.penaltyType,
    penaltyAmount: calculatedPenalty,
    penaltyRateOrAmount:
      settings.penaltyType === 'PERCENTAGE'
        ? settings.percentagePenaltyRate
        : settings.fixedPenaltyAmount,
    cutoffHours,
    timeRemainingMinutes,
    timeRemainingHours,
    serviceStartDateTime,
    message: `Late cancellation within ${cutoffHours} hours of service start. A penalty of ₹${calculatedPenalty} will be deducted.`,
  }
}

/**
 * 4. Process Vendor Booking Cancellation
 */
export async function processVendorCancellation({
  bookingId,
  vendorId,
  reason,
  reasonCategory,
  isExempt = false,
  isForceAdmin = false,
  overrideTime = null,
}) {
  const eligibility = await getCancellationEligibility(bookingId, vendorId, overrideTime)

  if (!eligibility.isEligible && !isForceAdmin) {
    throw new Error(eligibility.reason || 'Booking is not eligible for cancellation')
  }

  const booking = await Booking.findById(bookingId)
  if (!booking) throw new Error('Booking not found')

  const shortCode = String(booking._id).slice(-6).toUpperCase()
  const customerId = booking.userId
  const previousStatus = booking.status
  const dedupeKey = `cancellation_${booking._id}_${vendorId}`

  // Check if a record already exists
  let record = await BookingCancellationRecord.findOne({ dedupeKey })
  if (record && record.cancellationStatus === CANCELLATION_STATUS.CANCELLED) {
    return { success: true, status: 'CANCELLED', alreadyCancelled: true, record }
  }

  const now = overrideTime ? new Date(overrideTime) : new Date()

  // -------------------------------------------------------------
  // Scenario A: Late Cancellation Requires Admin Approval
  // -------------------------------------------------------------
  if (eligibility.requiresApproval && !isForceAdmin) {
    booking.status = 'CANCELLATION_REQUESTED'
    booking.cancellationReason = reason || 'Late cancellation requested by vendor'
    await booking.save()

    record = await BookingCancellationRecord.findOneAndUpdate(
      { dedupeKey },
      {
        bookingId: booking._id,
        vendorId,
        customerId,
        previousBookingStatus: previousStatus,
        cancellationStatus: CANCELLATION_STATUS.PENDING_APPROVAL,
        timingClassification: eligibility.timingClassification,
        serviceStartDateTime: eligibility.serviceStartDateTime,
        requestedAt: now,
        timeRemainingMinutes: eligibility.timeRemainingMinutes,
        cutoffHoursSnapshot: eligibility.cutoffHours,
        reason: reason || 'Vendor requested late cancellation',
        reasonCategory: reasonCategory || 'Emergency',
        penaltyType: eligibility.penaltyType,
        penaltyRateOrAmount: eligibility.penaltyRateOrAmount,
        assessedPenaltyAmount: eligibility.penaltyAmount,
        penaltyStatus: CANCELLATION_PENALTY_STATUS.PENDING,
        approvalStatus: APPROVAL_STATUS.PENDING,
        dedupeKey,
      },
      { upsert: true, new: true }
    )

    booking.cancellationRecordId = record._id
    await booking.save()

    // Send notifications to Customer & Admin
    try {
      if (customerId) {
        sendNotificationToUser(customerId, {
          title: 'Booking Cancellation Requested',
          body: `Service professional requested cancellation for booking #${shortCode}. Admin review is in progress.`,
          data: { type: 'booking_cancellation_requested', bookingId: String(booking._id) },
        })
      }

      sendNotificationToUser(vendorId, {
        title: 'Cancellation Request Submitted',
        body: `Your cancellation request for booking #${shortCode} has been sent for admin review.`,
        data: { type: 'cancellation_request_submitted', bookingId: String(booking._id) },
      })
    } catch (e) {
      console.warn('[Notification Warning]', e.message)
    }

    return {
      success: true,
      status: 'CANCELLATION_REQUESTED',
      requiresApproval: true,
      penaltyAmount: eligibility.penaltyAmount,
      record,
    }
  }

  // -------------------------------------------------------------
  // Scenario B: Immediate Cancellation (Standard or Penalized)
  // -------------------------------------------------------------
  booking.status = 'CANCELLED'
  booking.cancelledBy = 'LABOUR'
  booking.cancelledAt = now
  booking.cancellationReason = reason || 'Worker cancellation'

  if (booking.assignments && booking.assignments.length > 0) {
    booking.assignments.forEach((a) => {
      const lid = typeof a.labourId === 'object' ? a.labourId._id : a.labourId
      if (String(lid) === String(vendorId)) {
        a.status = 'CANCELLED'
        a.cancellationReason = reason || 'Worker cancellation'
      }
    })
  }

  let deductedAmount = 0
  let penaltyStatus = CANCELLATION_PENALTY_STATUS.NOT_APPLICABLE
  let transactionId = null

  const penaltyToApply = isExempt ? 0 : eligibility.penaltyAmount || 0

  if (penaltyToApply > 0) {
    penaltyStatus = CANCELLATION_PENALTY_STATUS.PENDING

    // Atomically execute wallet deduction
    try {
      let wallet = await Wallet.findOne({ userId: vendorId })
      if (!wallet) {
        wallet = await Wallet.create({ userId: vendorId, selfBalance: 0, adminBalance: 0 })
      }

      const balanceBefore = Number(wallet.selfBalance || 0)
      const balanceAfter = balanceBefore - penaltyToApply

      wallet.selfBalance = balanceAfter
      await wallet.save()

      const tx = await WalletTransaction.create({
        walletId: wallet._id,
        userId: vendorId,
        type: 'DEBIT',
        amount: penaltyToApply,
        balanceBefore,
        balanceAfter,
        description: `Late Cancellation Penalty for booking #${shortCode} (${reason || 'Late cancellation'})`,
        context: 'PENALTY',
        referenceType: 'BOOKING',
        referenceId: booking._id,
      })

      deductedAmount = penaltyToApply
      penaltyStatus = CANCELLATION_PENALTY_STATUS.RECOVERED
      transactionId = tx._id
      booking.penaltyDeducted = penaltyToApply
    } catch (err) {
      console.error('[Cancellation Penalty Deduction Error]', err)
    }
  }

  record = await BookingCancellationRecord.findOneAndUpdate(
    { dedupeKey },
    {
      bookingId: booking._id,
      vendorId,
      customerId,
      previousBookingStatus: previousStatus,
      cancellationStatus: CANCELLATION_STATUS.CANCELLED,
      timingClassification: eligibility.timingClassification,
      serviceStartDateTime: eligibility.serviceStartDateTime,
      requestedAt: now,
      completedAt: now,
      timeRemainingMinutes: eligibility.timeRemainingMinutes,
      cutoffHoursSnapshot: eligibility.cutoffHours,
      reason: reason || 'Worker cancellation',
      reasonCategory: reasonCategory || 'Emergency',
      penaltyType: isExempt ? 'NONE' : eligibility.penaltyType,
      penaltyRateOrAmount: eligibility.penaltyRateOrAmount,
      assessedPenaltyAmount: penaltyToApply,
      penaltyStatus,
      deductedAmount,
      walletTransactionId: transactionId,
      approvalStatus: APPROVAL_STATUS.NOT_REQUIRED,
      dedupeKey,
    },
    { upsert: true, new: true }
  )

  booking.cancellationRecordId = record._id
  await booking.save()

  // Refund customer wallet discount if booking had one
  if (booking.walletDiscount?.applied && booking.walletDiscount?.amount > 0) {
    import('./userWalletService.js')
      .then(({ refundWalletForBooking }) => {
        refundWalletForBooking({
          userId: customerId,
          bookingId: booking._id,
          amount: booking.walletDiscount.amount,
          reason: `Refund for cancelled booking #${shortCode}`,
        }).catch((err) => console.error('Customer refund error on cancellation:', err))
      })
      .catch((err) => console.error(err))
  }

  // Release cash booking charges reservation if cash booking
  if (booking.paymentMethod === 'CASH') {
    const expectedCharges = (booking.platformFee || 0) + (booking.taxes || 0) + (booking.commissionAmount || 0)
    if (vendorId && expectedCharges > 0) {
      import('./labourWalletService.js')
        .then(({ releaseCashBookingCharges }) => {
          releaseCashBookingCharges({ labourId: vendorId, bookingId: booking._id, amount: expectedCharges })
            .catch((err) => console.error('Error releasing reservation on cancellation:', err))
        })
        .catch(() => {})
    }
  }

  // Cancel scheduled reminders for booking
  import('./bookingReminderService.js')
    .then(({ cancelRemindersForBooking }) => {
      cancelRemindersForBooking(
        booking._id,
        `Booking cancelled by vendor: ${reason || 'Cancelled'}`
      ).catch(console.error)
    })
    .catch((err) => console.error(err))

  // Emit socket update
  import('../socket.js')
    .then(({ emitToUser }) => {
      if (customerId) {
        emitToUser(customerId, 'BOOKING_STATUS_UPDATE', {
          bookingId: booking._id,
          status: 'CANCELLED',
          cancelledBy: 'LABOUR',
          cancellationReason: reason,
          penaltyDeducted: deductedAmount,
        })
      }
      emitToUser(vendorId, 'BOOKING_STATUS_UPDATE', {
        bookingId: booking._id,
        status: 'CANCELLED',
        cancelledBy: 'LABOUR',
        cancellationReason: reason,
        penaltyDeducted: deductedAmount,
      })
    })
    .catch((err) => console.error(err))

  // Push notifications
  try {
    if (customerId) {
      sendNotificationToUser(customerId, {
        title: 'Booking Cancelled',
        body: `Your booking #${shortCode} was cancelled: ${reason || 'Cancelled by provider'}`,
        data: { type: 'booking_cancelled', bookingId: String(booking._id) },
      })
    }

    sendNotificationToUser(vendorId, {
      title: deductedAmount > 0 ? 'Late Cancellation Penalty Applied' : 'Booking Cancelled',
      body:
        deductedAmount > 0
          ? `Late cancellation penalty of ₹${deductedAmount} deducted for cancelling booking #${shortCode}`
          : `Booking #${shortCode} cancelled successfully.`,
      data: { type: 'booking_cancelled', bookingId: String(booking._id) },
    })
  } catch (e) {
    console.warn('[Notification Error]', e.message)
  }

  return {
    success: true,
    status: 'CANCELLED',
    timingClassification: eligibility.timingClassification,
    penaltyDeducted: deductedAmount,
    record,
  }
}

/**
 * 5. Admin Approves Late Cancellation Request
 */
export async function approveCancellationRequest({ recordId, adminUser, adminNotes = '' }) {
  const record = await BookingCancellationRecord.findById(recordId)
  if (!record) throw new Error('Cancellation record not found')

  if (record.cancellationStatus !== CANCELLATION_STATUS.PENDING_APPROVAL) {
    throw new Error(`Record is not pending approval (status: ${record.cancellationStatus})`)
  }

  const booking = await Booking.findById(record.bookingId)
  if (!booking) throw new Error('Booking not found')

  const shortCode = String(booking._id).slice(-6).toUpperCase()

  // Mark booking as cancelled
  booking.status = 'CANCELLED'
  booking.cancelledBy = 'LABOUR'
  booking.cancelledAt = new Date()
  booking.cancellationReason = record.reason || 'Late cancellation approved by admin'

  if (booking.assignments && booking.assignments.length > 0) {
    booking.assignments.forEach((a) => {
      const lid = typeof a.labourId === 'object' ? a.labourId._id : a.labourId
      if (String(lid) === String(record.vendorId)) {
        a.status = 'CANCELLED'
        a.cancellationReason = record.reason
      }
    })
  }

  // Deduct assessed penalty if > 0
  let deductedAmount = 0
  let penaltyStatus = CANCELLATION_PENALTY_STATUS.NOT_APPLICABLE
  let txId = null

  if (record.assessedPenaltyAmount > 0) {
    try {
      let wallet = await Wallet.findOne({ userId: record.vendorId })
      if (!wallet) {
        wallet = await Wallet.create({ userId: record.vendorId, selfBalance: 0, adminBalance: 0 })
      }

      const balanceBefore = Number(wallet.selfBalance || 0)
      const balanceAfter = balanceBefore - record.assessedPenaltyAmount

      wallet.selfBalance = balanceAfter
      await wallet.save()

      const tx = await WalletTransaction.create({
        walletId: wallet._id,
        userId: record.vendorId,
        type: 'DEBIT',
        amount: record.assessedPenaltyAmount,
        balanceBefore,
        balanceAfter,
        description: `Late Cancellation Penalty for booking #${shortCode} (Admin Approved)`,
        context: 'PENALTY',
        referenceType: 'BOOKING',
        referenceId: booking._id,
      })

      deductedAmount = record.assessedPenaltyAmount
      penaltyStatus = CANCELLATION_PENALTY_STATUS.RECOVERED
      txId = tx._id
      booking.penaltyDeducted = deductedAmount
    } catch (e) {
      console.error('[Approval Deduction Error]', e)
    }
  }

  record.cancellationStatus = CANCELLATION_STATUS.APPROVED
  record.approvalStatus = APPROVAL_STATUS.APPROVED
  record.approvedBy = adminUser?._id
  record.approvedAt = new Date()
  record.completedAt = new Date()
  record.adminNotes = adminNotes || 'Cancellation approved by admin'
  record.deductedAmount = deductedAmount
  record.penaltyStatus = penaltyStatus
  record.walletTransactionId = txId
  await record.save()

  await booking.save()

  // Refund customer wallet if needed
  if (booking.walletDiscount?.applied && booking.walletDiscount?.amount > 0) {
    import('./userWalletService.js').then(({ refundWalletForBooking }) => {
      refundWalletForBooking({
        userId: record.customerId,
        bookingId: booking._id,
        amount: booking.walletDiscount.amount,
        reason: `Refund for cancelled booking #${shortCode}`,
      }).catch(console.error)
    })
  }

  // Notifications
  try {
    if (record.customerId) {
      sendNotificationToUser(record.customerId, {
        title: 'Booking Cancelled',
        body: `Booking #${shortCode} cancellation has been approved and confirmed by admin.`,
        data: { type: 'booking_cancelled', bookingId: String(booking._id) },
      })
    }

    sendNotificationToUser(record.vendorId, {
      title: 'Cancellation Request Approved',
      body:
        deductedAmount > 0
          ? `Your cancellation for booking #${shortCode} was approved. Penalty of ₹${deductedAmount} applied.`
          : `Your cancellation for booking #${shortCode} was approved.`,
      data: { type: 'cancellation_approved', bookingId: String(booking._id) },
    })
  } catch (e) {
    console.warn(e)
  }

  return record
}

/**
 * 6. Admin Rejects Late Cancellation Request
 */
export async function rejectCancellationRequest({ recordId, adminUser, rejectionReason = '' }) {
  const record = await BookingCancellationRecord.findById(recordId)
  if (!record) throw new Error('Cancellation record not found')

  if (record.cancellationStatus !== CANCELLATION_STATUS.PENDING_APPROVAL) {
    throw new Error(`Record is not pending approval (status: ${record.cancellationStatus})`)
  }

  const booking = await Booking.findById(record.bookingId)
  if (!booking) throw new Error('Booking not found')

  const shortCode = String(booking._id).slice(-6).toUpperCase()

  // Restore previous booking status
  booking.status = record.previousBookingStatus || 'ACCEPTED'
  await booking.save()

  record.cancellationStatus = CANCELLATION_STATUS.REJECTED
  record.approvalStatus = APPROVAL_STATUS.REJECTED
  record.approvedBy = adminUser?._id
  record.approvedAt = new Date()
  record.adminNotes = rejectionReason || 'Cancellation request rejected by admin'
  await record.save()

  try {
    sendNotificationToUser(record.vendorId, {
      title: 'Cancellation Request Rejected',
      body: `Your cancellation request for booking #${shortCode} was rejected: ${rejectionReason || 'Please proceed with the service assignment.'}`,
      data: { type: 'cancellation_rejected', bookingId: String(booking._id) },
    })
  } catch (e) {
    console.warn(e)
  }

  return record
}

/**
 * 7. Admin Waives Late Cancellation Penalty
 */
export async function waiveCancellationPenalty({ recordId, adminUser, waiverReason }) {
  if (!waiverReason || !waiverReason.trim()) {
    throw new Error('Mandatory waiver reason is required')
  }

  const record = await BookingCancellationRecord.findById(recordId)
  if (!record) throw new Error('Cancellation record not found')

  if (record.penaltyStatus === CANCELLATION_PENALTY_STATUS.WAIVED) {
    return { success: true, message: 'Penalty is already waived', record }
  }

  const shortCode = String(record.bookingId).slice(-6).toUpperCase()

  // If penalty was already deducted, issue compensating refund
  if (record.deductedAmount > 0) {
    const wallet = await Wallet.findOne({ userId: record.vendorId })
    if (wallet) {
      const balanceBefore = Number(wallet.selfBalance || 0)
      const balanceAfter = balanceBefore + record.deductedAmount

      wallet.selfBalance = balanceAfter
      await wallet.save()

      await WalletTransaction.create({
        walletId: wallet._id,
        userId: record.vendorId,
        type: 'CREDIT',
        amount: record.deductedAmount,
        balanceBefore,
        balanceAfter,
        description: `Compensating Refund: Waived late cancellation penalty for booking #${shortCode}`,
        context: 'REFUND',
        referenceType: 'BOOKING',
        referenceId: record.bookingId,
      })
    }
  }

  record.penaltyStatus = CANCELLATION_PENALTY_STATUS.WAIVED
  record.waiverReason = waiverReason.trim()
  record.waivedBy = adminUser?._id
  record.waivedAt = new Date()
  await record.save()

  try {
    sendNotificationToUser(record.vendorId, {
      title: 'Cancellation Penalty Waived',
      body: `Late cancellation penalty of ₹${record.deductedAmount || record.assessedPenaltyAmount} for booking #${shortCode} has been waived and refunded.`,
      data: { type: 'penalty_waived', bookingId: String(record.bookingId) },
    })
  } catch (e) {
    console.warn(e)
  }

  return { success: true, record }
}

/**
 * 8. Admin: Overview Statistics
 */
export async function getAdminCancellationOverviewStats() {
  const [
    totalRecords,
    standardCount,
    lateCount,
    pendingApprovalCount,
    totalPenaltiesResult,
    waivedCount,
  ] = await Promise.all([
    BookingCancellationRecord.countDocuments(),
    BookingCancellationRecord.countDocuments({
      timingClassification: TIMING_CLASSIFICATION.STANDARD,
    }),
    BookingCancellationRecord.countDocuments({
      timingClassification: TIMING_CLASSIFICATION.LATE,
    }),
    BookingCancellationRecord.countDocuments({
      approvalStatus: APPROVAL_STATUS.PENDING,
    }),
    BookingCancellationRecord.aggregate([
      { $match: { penaltyStatus: CANCELLATION_PENALTY_STATUS.RECOVERED } },
      { $group: { _id: null, total: { $sum: '$deductedAmount' } } },
    ]),
    BookingCancellationRecord.countDocuments({
      penaltyStatus: CANCELLATION_PENALTY_STATUS.WAIVED,
    }),
  ])

  const totalPenaltiesDeducted =
    totalPenaltiesResult.length > 0 ? totalPenaltiesResult[0].total : 0

  return {
    totalRecords,
    standardCount,
    lateCount,
    pendingApprovalCount,
    totalPenaltiesDeducted,
    waivedCount,
  }
}

/**
 * 9. Admin: Search & Filter Cancellation Records
 */
export async function getAdminCancellationRecords({
  page = 1,
  limit = 20,
  timingClassification,
  cancellationStatus,
  approvalStatus,
  penaltyStatus,
  vendorId,
  search,
  startDate,
  endDate,
}) {
  const query = {}

  if (timingClassification && timingClassification !== 'ALL') {
    query.timingClassification = timingClassification
  }
  if (cancellationStatus && cancellationStatus !== 'ALL') {
    query.cancellationStatus = cancellationStatus
  }
  if (approvalStatus && approvalStatus !== 'ALL') {
    query.approvalStatus = approvalStatus
  }
  if (penaltyStatus && penaltyStatus !== 'ALL') {
    query.penaltyStatus = penaltyStatus
  }
  if (vendorId) {
    query.vendorId = vendorId
  }

  if (startDate || endDate) {
    query.requestedAt = {}
    if (startDate) query.requestedAt.$gte = new Date(startDate)
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      query.requestedAt.$lte = end
    }
  }

  const p = Math.max(1, parseInt(page, 10))
  const l = Math.max(1, parseInt(limit, 10))
  const skip = (p - 1) * l

  const [records, total] = await Promise.all([
    BookingCancellationRecord.find(query)
      .populate('vendorId', 'fullName name phone email role')
      .populate('customerId', 'fullName name phone email')
      .populate('approvedBy', 'fullName name')
      .populate('waivedBy', 'fullName name')
      .populate('bookingId')
      .sort({ requestedAt: -1 })
      .skip(skip)
      .limit(l)
      .lean(),
    BookingCancellationRecord.countDocuments(query),
  ])

  return {
    records,
    pagination: {
      total,
      page: p,
      limit: l,
      pages: Math.ceil(total / l),
    },
  }
}

/**
 * 10. Check Customer Cancellation Eligibility & Retrieve Policy Rules
 */
export async function getCustomerCancellationEligibility(bookingId, customerId, overrideTime = null) {
  const settings = await getBookingCancellationSettings()
  const booking = await Booking.findById(bookingId)
  if (!booking) {
    return {
      isEligible: false,
      code: 'BOOKING_NOT_FOUND',
      reason: 'Booking not found',
    }
  }

  // 1. Ownership validation
  if (customerId && String(booking.userId?._id || booking.userId) !== String(customerId)) {
    return {
      isEligible: false,
      code: 'UNAUTHORIZED',
      reason: 'You are not authorized to cancel this booking',
    }
  }

  // 2. Lifecycle status check
  const nonCancellableStatuses = ['EN_ROUTE', 'STARTED', 'COMPLETED', 'CANCELLED', 'REFUNDED', 'FAILED']
  if (nonCancellableStatuses.includes(booking.status)) {
    let reasonText = `Booking is already ${booking.status.toLowerCase()}.`
    let code = 'STATUS_INELIGIBLE'
    if (booking.status === 'EN_ROUTE') {
      reasonText = 'Service partner is already on the way. Ordinary cancellation is not permitted. Please contact support.'
      code = 'EN_ROUTE_BLOCKED'
    } else if (booking.status === 'STARTED') {
      reasonText = 'Service has already started and is in progress. Ordinary cancellation is not permitted.'
      code = 'STARTED_BLOCKED'
    } else if (booking.status === 'COMPLETED') {
      reasonText = 'Completed bookings cannot be cancelled.'
      code = 'ALREADY_COMPLETED'
    } else if (booking.status === 'CANCELLED') {
      reasonText = 'This booking has already been cancelled.'
      code = 'ALREADY_CANCELLED'
    }

    return {
      isEligible: false,
      code,
      currentStatus: booking.status,
      reason: reasonText,
    }
  }

  // 3. Admin policy master switch check
  if (settings.customerCancellationEnabled === false) {
    return {
      isEligible: false,
      code: 'POLICY_DISABLED',
      reason: 'Customer cancellation is currently disabled by platform policy.',
    }
  }

  // 4. Calculate Service Start DateTime
  let serviceStartDateTime = null
  if (booking.scheduledAt && !isNaN(new Date(booking.scheduledAt).getTime())) {
    serviceStartDateTime = new Date(booking.scheduledAt)
  } else if (booking.date) {
    serviceStartDateTime = parseISTDateTime(booking.date, booking.timeSlot)
  } else {
    serviceStartDateTime = new Date(booking.createdAt || Date.now())
  }

  const now = overrideTime ? new Date(overrideTime) : new Date()
  const timeRemainingMs = serviceStartDateTime.getTime() - now.getTime()
  const timeRemainingMinutes = Math.floor(timeRemainingMs / (60 * 1000))
  const cutoffMinutes = Number(settings.customerCutoffMinutes !== undefined ? settings.customerCutoffMinutes : 60)

  // 5. Cutoff boundary check for SCHEDULED bookings
  if (booking.type === 'SCHEDULED') {
    if (timeRemainingMs <= 0) {
      return {
        isEligible: false,
        code: 'SERVICE_TIME_PASSED',
        isExpired: true,
        serviceStartDateTime,
        timeRemainingMinutes,
        reason: 'Scheduled service start time has already passed. Cancellation is no longer available.',
      }
    }

    if (cutoffMinutes > 0 && timeRemainingMinutes < cutoffMinutes) {
      return {
        isEligible: false,
        code: 'CUTOFF_EXCEEDED',
        isCutoffExceeded: true,
        cutoffMinutes,
        timeRemainingMinutes,
        serviceStartDateTime,
        reason: `Cancellations must be made at least ${cutoffMinutes} minutes before the scheduled start time (${timeRemainingMinutes}m remaining). Please contact support.`,
      }
    }
  }

  // 6. Compute Fee & Disclosures (Default fee is ₹0 - never charge customer vendor penalties)
  const cancellationFee = Math.max(0, Number(settings.customerCancellationFee || 0))
  const allowedReasons = settings.customerAllowedReasons && settings.customerAllowedReasons.length > 0
    ? settings.customerAllowedReasons
    : [
        'Booked by mistake',
        'Wrong date or time',
        'Service no longer required',
        'Vendor response delay',
        'Found another service provider',
        'Other',
      ]

  const isPaid = (booking.paymentStatus || '').toUpperCase() === 'PAID'
  let refundNote = 'No payment was collected for this booking.'
  if (booking.paymentMethod === 'ONLINE') {
    if (isPaid) {
      const estimatedRefund = Math.max(0, (booking.totalAmount || 0) - cancellationFee)
      refundNote = `Estimated refund of ₹${estimatedRefund} will be initiated to your source payment method under platform refund policy.`
    } else {
      refundNote = 'Online payment was not completed yet. No amount will be charged.'
    }
  }

  const customerPolicy = await evaluateCustomerCancellationPolicy(customerId, overrideTime)

  return {
    isEligible: true,
    code: 'ELIGIBLE',
    bookingId: booking._id,
    currentStatus: booking.status,
    bookingType: booking.type,
    serviceStartDateTime,
    timeRemainingMinutes,
    cutoffMinutes,
    cancellationFee,
    allowedReasons,
    paymentMethod: booking.paymentMethod,
    paymentStatus: booking.paymentStatus,
    totalAmount: booking.totalAmount || 0,
    refundNote,
    customerPolicy,
  }
}

/**
 * 11. Process Customer Booking Cancellation
 */
export async function processCustomerCancellation({
  bookingId,
  customerId,
  reason,
  reasonNote = '',
  overrideTime = null,
}) {
  if (!bookingId) {
    throw new Error('Booking ID is required')
  }
  if (!customerId) {
    throw new Error('Customer ID is required')
  }

  // 1. Validate reason
  const trimmedReason = (reason || '').trim()
  const trimmedNote = (reasonNote || '').trim()

  const validStandardReasons = [
    'Booked by mistake',
    'Wrong date or time',
    'Service no longer required',
    'Vendor response delay',
    'Found another service provider',
    'Other',
  ]

  const matchedReason = validStandardReasons.find(
    (r) => r.toLowerCase() === trimmedReason.toLowerCase()
  )

  if (!matchedReason) {
    throw new Error(
      `Invalid cancellation reason. Allowed reasons: ${validStandardReasons.join(', ')}`
    )
  }

  if (matchedReason === 'Other' && !trimmedNote) {
    throw new Error('Please provide an additional description when selecting "Other" as cancellation reason.')
  }

  const finalReasonText = matchedReason === 'Other' ? `Other: ${trimmedNote}` : matchedReason

  // 2. Authoritative eligibility check
  const eligibility = await getCustomerCancellationEligibility(bookingId, customerId, overrideTime)
  if (!eligibility.isEligible) {
    if (eligibility.code === 'ALREADY_CANCELLED') {
      const existing = await Booking.findById(bookingId)
      const existingRecord = await BookingCancellationRecord.findOne({
        bookingId: existing?._id || bookingId,
        cancelledByRole: 'CUSTOMER',
      })
      return {
        success: true,
        status: 'CANCELLED',
        alreadyCancelled: true,
        message: 'This booking has already been cancelled',
        booking: existing,
        record: existingRecord,
      }
    }
    throw new Error(eligibility.reason || 'Booking is not eligible for cancellation')
  }

  const now = overrideTime ? new Date(overrideTime) : new Date()

  // 3. Atomic conditional update to prevent race conditions
  const allowedStatuses = ['CREATED', 'BROADCASTING', 'ACCEPTED', 'ASSIGNED']
  const booking = await Booking.findOneAndUpdate(
    {
      _id: bookingId,
      userId: customerId,
      status: { $in: allowedStatuses },
    },
    {
      $set: {
        status: 'CANCELLED',
        cancelledBy: 'CUSTOMER',
        cancelledAt: now,
        cancellationReason: finalReasonText,
      },
    },
    { new: true }
  )

  if (!booking) {
    // Check if it was already cancelled (idempotent duplicate request handling)
    const currentBooking = await Booking.findById(bookingId)
    if (!currentBooking) {
      throw new Error('Booking not found')
    }
    if (String(currentBooking.userId) !== String(customerId)) {
      throw new Error('You are not authorized to cancel this booking')
    }
    if (currentBooking.status === 'CANCELLED') {
      const existingRecord = await BookingCancellationRecord.findOne({
        bookingId: currentBooking._id,
        dedupeKey: `customer_cancellation_${currentBooking._id}`,
      })
      return {
        success: true,
        status: 'CANCELLED',
        alreadyCancelled: true,
        message: 'Booking has already been cancelled',
        booking: currentBooking,
        record: existingRecord,
      }
    }

    throw new Error(
      `Cannot cancel booking because its status was concurrently updated to ${currentBooking.status}`
    )
  }

  const shortCode = String(booking._id).slice(-6).toUpperCase()
  const previousStatus = eligibility.currentStatus || 'ACCEPTED'
  const dedupeKey = `customer_cancellation_${booking._id}`

  // 4. Update assignments if multi-worker booking
  if (booking.assignments && booking.assignments.length > 0) {
    booking.assignments.forEach((a) => {
      a.status = 'CANCELLED'
      a.cancellationReason = finalReasonText
    })
    await booking.save()
  }

  // 5. Determine refund details safely
  const isPaid = (booking.paymentStatus || '').toUpperCase() === 'PAID'
  let refundStatus = 'NOT_APPLICABLE'
  let refundAmount = 0
  let refundReference = undefined

  if (booking.paymentMethod === 'ONLINE' && isPaid) {
    refundStatus = 'PENDING_REVIEW'
    refundAmount = Math.max(0, (booking.totalAmount || 0) - (eligibility.cancellationFee || 0))
    refundReference = `REFUND_PENDING_${shortCode}`
  }

  // 6. Create or update Cancellation Record for audit
  const assignedVendorId =
    booking.laborId ||
    booking.acceptedLabourId ||
    (booking.assignments?.[0]?.labourId) ||
    undefined

  const record = await BookingCancellationRecord.findOneAndUpdate(
    { dedupeKey },
    {
      bookingId: booking._id,
      customerId,
      vendorId: assignedVendorId,
      cancelledByRole: 'CUSTOMER',
      previousBookingStatus: previousStatus,
      cancellationStatus: CANCELLATION_STATUS.CANCELLED,
      timingClassification: TIMING_CLASSIFICATION.STANDARD,
      serviceStartDateTime: eligibility.serviceStartDateTime,
      requestedAt: now,
      completedAt: now,
      timeRemainingMinutes: eligibility.timeRemainingMinutes,
      cutoffHoursSnapshot: Number((eligibility.cutoffMinutes / 60).toFixed(2)),
      reason: matchedReason,
      reasonCategory: matchedReason,
      adminNotes: trimmedNote || '',
      customerFeeSnapshot: eligibility.cancellationFee,
      penaltyType: 'NONE',
      penaltyRateOrAmount: 0,
      assessedPenaltyAmount: 0,
      penaltyStatus: CANCELLATION_PENALTY_STATUS.NOT_APPLICABLE,
      deductedAmount: 0,
      approvalStatus: APPROVAL_STATUS.NOT_REQUIRED,
      refundStatus,
      refundAmount,
      refundReference,
      dedupeKey,
      createdAt: now,
    },
    { upsert: true, new: true }
  )

  booking.cancellationRecordId = record._id
  await booking.save()

  // 7. Wallet & financial safety
  // A. Customer wallet discount refund if applied
  if (booking.walletDiscount?.applied && booking.walletDiscount?.amount > 0) {
    import('./userWalletService.js')
      .then(({ refundWalletForBooking }) => {
        refundWalletForBooking({
          userId: customerId,
          bookingId: booking._id,
          amount: booking.walletDiscount.amount,
          reason: `Refund for customer cancelled booking #${shortCode}`,
        }).catch((err) => console.error('[Customer Wallet Refund Error]', err?.message))
      })
      .catch((err) => console.error(err))
  }

  // B. Release held cash booking charges on assigned labourer
  if (booking.paymentMethod === 'CASH') {
    const expectedCharges =
      (booking.platformFee || 0) + (booking.taxes || 0) + (booking.commissionAmount || 0)
    if (assignedVendorId && expectedCharges > 0) {
      import('./labourWalletService.js')
        .then(({ releaseCashBookingCharges }) => {
          const vid = typeof assignedVendorId === 'object' ? assignedVendorId._id : assignedVendorId
          releaseCashBookingCharges({
            labourId: vid,
            bookingId: booking._id,
            amount: expectedCharges,
          }).catch((err) => console.error('[Cash Hold Release Warning]', err?.message))
        })
        .catch(() => {})
    }
  }

  // C. Cancel scheduled reminders
  import('./bookingReminderService.js')
    .then(({ cancelRemindersForBooking }) => {
      cancelRemindersForBooking(
        booking._id,
        `Booking cancelled by customer: ${finalReasonText}`
      ).catch(console.error)
    })
    .catch((err) => console.error(err))

  // 8. Repeat Customer Cancellation Policy Evaluation & Enforcement
  const repeatSettings = await getBookingCancellationSettings()
  const windowDays = Number(repeatSettings.customerRollingWindowDays || 30)
  const currentCount = await countEligibleCustomerCancellations(customerId, windowDays, now)

  let warningTriggered = false
  let restrictionTriggered = false
  let actionTaken = 'NONE'

  if (repeatSettings.customerWarningEnabled) {
    const customer = await User.findById(customerId)
    if (customer) {
      if (!customer.customerCancellationRestriction) {
        customer.customerCancellationRestriction = {
          isRestricted: false,
          warningCount: 0,
          history: [],
        }
      }

      if (currentCount >= repeatSettings.customerRestrictionThreshold) {
        if (repeatSettings.customerRestrictionMode === 'TEMPORARY_RESTRICTION') {
          const durationDays = Number(repeatSettings.customerRestrictionDurationDays || 7)
          const restrictedUntil = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000)

          customer.customerCancellationRestriction.isRestricted = true
          customer.customerCancellationRestriction.restrictedAt = now
          customer.customerCancellationRestriction.restrictedUntil = restrictedUntil
          customer.customerCancellationRestriction.restrictionReason =
            repeatSettings.customerRestrictionMessage || 'Temporary restriction applied due to repeated booking cancellations.'
          customer.customerCancellationRestriction.restrictedBy = 'SYSTEM_POLICY'
          customer.customerCancellationRestriction.history.push({
            action: 'RESTRICTED',
            reason: `Reached cancellation threshold (${currentCount}/${repeatSettings.customerRestrictionThreshold}) within ${windowDays} days`,
            restrictedUntil,
            performedBy: 'SYSTEM_POLICY',
            timestamp: now,
          })
          await customer.save()

          try {
            await InAppNotification.create({
              userId: customerId,
              title: 'Account Restriction Notice',
              body:
                repeatSettings.customerRestrictionMessage ||
                'Your booking access has been temporarily restricted due to repeated cancellations under our cancellation policy.',
              type: 'CUSTOMER_BOOKING_RESTRICTION_APPLIED',
              bookingId: booking._id,
            })
            if (repeatSettings.customerPushNotificationsEnabled) {
              sendNotificationToUser(customerId, {
                title: 'Account Restriction Notice',
                body:
                  repeatSettings.customerRestrictionMessage ||
                  'Your booking access has been temporarily restricted due to repeated cancellations under our cancellation policy.',
                data: {
                  type: 'CUSTOMER_BOOKING_RESTRICTION_APPLIED',
                  restrictedUntil: restrictedUntil.toISOString(),
                },
              })
            }
          } catch (notifErr) {
            console.warn('[Restriction Notification Warning]', notifErr?.message)
          }

          restrictionTriggered = true
          actionTaken = 'TEMPORARY_RESTRICTION'
        } else if (repeatSettings.customerRestrictionMode === 'MANUAL_REVIEW') {
          customer.customerCancellationRestriction.history.push({
            action: 'FLAGGED_FOR_REVIEW',
            reason: `Reached cancellation threshold (${currentCount}/${repeatSettings.customerRestrictionThreshold}) for manual admin review`,
            performedBy: 'SYSTEM_POLICY',
            timestamp: now,
          })
          await customer.save()
          restrictionTriggered = true
          actionTaken = 'MANUAL_REVIEW'
        } else {
          actionTaken = 'WARNING_ONLY'
        }
      } else if (currentCount >= repeatSettings.customerWarningThreshold) {
        const lastWarnThreshold = customer.customerCancellationRestriction.lastWarningThreshold || 0
        if (lastWarnThreshold !== currentCount) {
          customer.customerCancellationRestriction.warningCount =
            (customer.customerCancellationRestriction.warningCount || 0) + 1
          customer.customerCancellationRestriction.lastWarningAt = now
          customer.customerCancellationRestriction.lastWarningThreshold = currentCount
          customer.customerCancellationRestriction.history.push({
            action: 'WARNED',
            reason: `Warning threshold reached (${currentCount}/${repeatSettings.customerWarningThreshold}) within ${windowDays} days`,
            performedBy: 'SYSTEM_POLICY',
            timestamp: now,
          })
          await customer.save()

          try {
            await InAppNotification.create({
              userId: customerId,
              title: 'Cancellation Warning',
              body:
                repeatSettings.customerWarningMessage ||
                'You have cancelled multiple bookings recently. Repeated cancellations may lead to temporary restrictions on your A2Z account.',
              type: 'CUSTOMER_CANCELLATION_WARNING',
              bookingId: booking._id,
            })
            if (repeatSettings.customerPushNotificationsEnabled) {
              sendNotificationToUser(customerId, {
                title: 'Cancellation Warning',
                body:
                  repeatSettings.customerWarningMessage ||
                  'You have cancelled multiple bookings recently. Repeated cancellations may lead to temporary restrictions on your A2Z account.',
                data: {
                  type: 'CUSTOMER_CANCELLATION_WARNING',
                  count: String(currentCount),
                },
              })
            }
          } catch (notifErr) {
            console.warn('[Warning Notification Warning]', notifErr?.message)
          }

          warningTriggered = true
          actionTaken = 'WARNED'
        }
      }
    }
  }

  // Record policy snapshot
  record.policyEvaluationSnapshot = {
    eligibleCount: currentCount,
    rollingWindowDays: windowDays,
    warningThreshold: repeatSettings.customerWarningThreshold,
    restrictionThreshold: repeatSettings.customerRestrictionThreshold,
    warningTriggered,
    restrictionTriggered,
    restrictionMode: repeatSettings.customerRestrictionMode,
    actionTaken,
  }
  record.isCountedForPolicy = true
  await record.save()

  // 9. In-App Notification for booking cancellation confirmation
  try {
    let cancelNotificationBody = `Your booking #${shortCode} has been cancelled successfully.`
    if (warningTriggered) {
      cancelNotificationBody += ` Note: ${repeatSettings.customerWarningMessage}`
    } else if (restrictionTriggered && repeatSettings.customerRestrictionMode === 'TEMPORARY_RESTRICTION') {
      cancelNotificationBody += ` Note: ${repeatSettings.customerRestrictionMessage}`
    }

    await InAppNotification.create({
      userId: customerId,
      title: 'Booking Cancelled',
      body: cancelNotificationBody,
      type: 'BOOKING_CANCELLED',
      bookingId: booking._id,
    })
  } catch (err) {
    console.warn('[InAppNotification Warning]', err?.message)
  }

  // 10. Real-time Socket & Push Notifications
  import('../socket.js')
    .then(({ emitToUser, getIo, getIO }) => {
      emitToUser(customerId, 'BOOKING_STATUS_UPDATE', {
        bookingId: booking._id,
        status: 'CANCELLED',
        cancelledBy: 'CUSTOMER',
        cancellationReason: finalReasonText,
      })

      const vendorIdsToNotify = new Set()
      if (assignedVendorId) {
        const vid = typeof assignedVendorId === 'object' ? assignedVendorId._id : assignedVendorId
        if (vid) vendorIdsToNotify.add(String(vid))
      }
      if (booking.laborId) {
        const vid = typeof booking.laborId === 'object' ? booking.laborId._id : booking.laborId
        if (vid) vendorIdsToNotify.add(String(vid))
      }
      if (booking.acceptedLabourId) {
        const vid = typeof booking.acceptedLabourId === 'object' ? booking.acceptedLabourId._id : booking.acceptedLabourId
        if (vid) vendorIdsToNotify.add(String(vid))
      }
      if (Array.isArray(booking.assignments)) {
        booking.assignments.forEach((a) => {
          const lId = a.labourId ? (typeof a.labourId === 'object' ? a.labourId._id : a.labourId) : null
          if (lId) vendorIdsToNotify.add(String(lId))
        })
      }

      for (const vid of vendorIdsToNotify) {
        emitToUser(vid, 'BOOKING_STATUS_UPDATE', {
          bookingId: booking._id,
          status: 'CANCELLED',
          cancelledBy: 'CUSTOMER',
          cancellationReason: finalReasonText,
        })
        emitToUser(vid, 'BOOKING_CANCELLED', {
          bookingId: booking._id,
          status: 'CANCELLED',
          cancelledBy: 'CUSTOMER',
          cancellationReason: finalReasonText,
        })
      }

      try {
        const ioGetter = getIo || getIO
        const io = ioGetter ? ioGetter() : null
        if (io) {
          io.emit('BOOKING_STATUS_UPDATE', {
            bookingId: String(booking._id),
            status: 'CANCELLED',
            cancelledBy: 'CUSTOMER',
            cancellationReason: finalReasonText,
          })
          io.emit('BOOKING_CANCELLED', {
            bookingId: String(booking._id),
            status: 'CANCELLED',
            cancelledBy: 'CUSTOMER',
            cancellationReason: finalReasonText,
          })
          if (previousStatus === 'BROADCASTING') {
            io.emit('BOOKING_EXPIRED', { bookingId: String(booking._id) })
          }
        }
      } catch (ioErr) {
        console.warn('[Socket Broadcast Warning]', ioErr?.message)
      }
    })
    .catch((err) => console.error('[Socket Warning]', err))

  try {
    sendNotificationToUser(customerId, {
      title: 'Booking Cancelled',
      body: `Your booking #${shortCode} was cancelled successfully.`,
      data: { type: 'booking_cancelled', bookingId: String(booking._id) },
    })

    if (assignedVendorId) {
      const vid = typeof assignedVendorId === 'object' ? assignedVendorId._id : assignedVendorId
      sendNotificationToUser(vid, {
        title: 'Booking Cancelled by Customer',
        body: `Customer has cancelled booking #${shortCode}: ${matchedReason}`,
        data: { type: 'booking_cancelled', bookingId: String(booking._id) },
      })
    }
  } catch (err) {
    console.warn('[Push Notification Warning]', err?.message)
  }

  return {
    success: true,
    status: 'CANCELLED',
    message: 'Booking cancelled successfully',
    booking,
    record,
    refund: {
      status: refundStatus,
      amount: refundAmount,
      reference: refundReference,
      note: eligibility.refundNote,
    },
    customerPolicy: {
      policyEnabled: repeatSettings.customerWarningEnabled,
      eligibleCount: currentCount,
      warningThreshold: repeatSettings.customerWarningThreshold,
      restrictionThreshold: repeatSettings.customerRestrictionThreshold,
      warningTriggered,
      restrictionTriggered,
      actionTaken,
      warningMessage: warningTriggered ? repeatSettings.customerWarningMessage : null,
      restrictionMessage:
        restrictionTriggered && repeatSettings.customerRestrictionMode === 'TEMPORARY_RESTRICTION'
          ? repeatSettings.customerRestrictionMessage
          : null,
    },
  }
}

/**
 * 12. Count Eligible Customer Cancellations within Rolling Window
 * Each booking contributes at most ONE eligible cancellation count.
 */
export async function countEligibleCustomerCancellations(customerId, windowDays = 30, beforeDate = new Date()) {
  if (!customerId) return 0
  const refDate = new Date(beforeDate)
  const endDate = new Date(refDate.getTime() + 60 * 1000)
  const startDate = new Date(refDate.getTime() - Number(windowDays || 30) * 24 * 60 * 60 * 1000)

  // Use distinct bookingId to ensure database-level idempotency and deduplication
  const distinctBookings = await BookingCancellationRecord.distinct('bookingId', {
    customerId,
    cancelledByRole: 'CUSTOMER',
    cancellationStatus: CANCELLATION_STATUS.CANCELLED,
    isCountedForPolicy: { $ne: false },
    createdAt: { $gte: startDate, $lte: endDate },
  })

  return distinctBookings.length
}

/**
 * 13. Dynamic Customer Booking Restriction Check with Inline Expiry
 */
export async function checkCustomerBookingRestriction(customerId) {
  if (!customerId) return { isRestricted: false, restriction: null }
  const user = await User.findById(customerId).select('customerCancellationRestriction fullName phone email')
  if (!user || !user.customerCancellationRestriction?.isRestricted) {
    return { isRestricted: false, restriction: null }
  }

  const restriction = user.customerCancellationRestriction
  const now = new Date()

  // Dynamic automatic expiration check: if restrictedUntil is set and in the past, auto-lift
  if (restriction.restrictedUntil && now >= new Date(restriction.restrictedUntil)) {
    restriction.isRestricted = false
    restriction.history.push({
      action: 'UNRESTRICTED',
      reason: 'Temporary restriction period expired automatically',
      restrictedUntil: restriction.restrictedUntil,
      performedBy: 'SYSTEM_POLICY',
      timestamp: now,
    })
    await user.save()

    // Dispatch notification that access has been restored
    try {
      await InAppNotification.create({
        userId: user._id,
        title: 'Booking Access Restored',
        body: 'Your temporary booking restriction has expired. You can now book services on A2Z again.',
        type: 'CUSTOMER_BOOKING_ACCESS_RESTORED',
      })
      sendNotificationToUser(user._id, {
        title: 'Booking Access Restored',
        body: 'Your temporary booking restriction has expired. You can now book services on A2Z again.',
        data: { type: 'CUSTOMER_BOOKING_ACCESS_RESTORED' },
      })
    } catch (notifErr) {
      console.warn('[Access Restoration Notification Warning]', notifErr?.message)
    }

    return { isRestricted: false, restriction: null }
  }

  return {
    isRestricted: true,
    restriction: {
      reason: restriction.restrictionReason,
      restrictedAt: restriction.restrictedAt,
      restrictedUntil: restriction.restrictedUntil,
      restrictedBy: restriction.restrictedBy,
      adminNote: restriction.adminNote,
    },
  }
}

/**
 * 14. Evaluate Customer Cancellation Policy Status
 */
export async function evaluateCustomerCancellationPolicy(customerId, overrideTime = null) {
  const settings = await getBookingCancellationSettings()
  const now = overrideTime ? new Date(overrideTime) : new Date()

  const windowDays = Number(settings.customerRollingWindowDays || 30)
  const warningThreshold = Number(settings.customerWarningThreshold || 3)
  const restrictionThreshold = Number(settings.customerRestrictionThreshold || 5)
  const restrictionMode = settings.customerRestrictionMode || 'WARNING_ONLY'
  const policyEnabled = Boolean(settings.customerWarningEnabled !== false)

  const count = await countEligibleCustomerCancellations(customerId, windowDays, now)
  const restrictionCheck = await checkCustomerBookingRestriction(customerId)

  const approachingThreshold = policyEnabled && count >= Math.max(1, warningThreshold - 1) && count < warningThreshold
  const warningActive = policyEnabled && count >= warningThreshold
  const restrictionEligible = policyEnabled && count >= restrictionThreshold

  return {
    policyEnabled,
    eligibleCount: count,
    windowDays,
    warningThreshold,
    restrictionThreshold,
    approachingThreshold,
    warningActive,
    restrictionEligible,
    restrictionMode,
    isRestricted: restrictionCheck.isRestricted,
    restriction: restrictionCheck.restriction,
    warningMessage: settings.customerWarningMessage,
    restrictionMessage: settings.customerRestrictionMessage,
  }
}

/**
 * 15. Admin: List Customers with Cancellation Records & Stats
 */
export async function getAdminCustomerCancellations({
  page = 1,
  limit = 20,
  search = '',
  filter = 'ALL',
}) {
  const settings = await getBookingCancellationSettings()
  const windowDays = Number(settings.customerRollingWindowDays || 30)

  // Find all customer IDs who have cancellation records
  const distinctCustomerIds = await BookingCancellationRecord.distinct('customerId', {
    cancelledByRole: 'CUSTOMER',
    cancellationStatus: CANCELLATION_STATUS.CANCELLED,
  })

  let userQuery = {
    _id: { $in: distinctCustomerIds },
  }

  if (search) {
    userQuery.$or = [
      { fullName: { $regex: search, $options: 'i' } },
      { name: { $regex: search, $options: 'i' } },
      { phone: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ]
  }

  if (filter === 'RESTRICTED') {
    userQuery['customerCancellationRestriction.isRestricted'] = true
  } else if (filter === 'WARNED') {
    userQuery['customerCancellationRestriction.warningCount'] = { $gt: 0 }
  }

  const users = await User.find(userQuery).select(
    'fullName name phone email customerCancellationRestriction createdAt'
  )

  const enrichedList = await Promise.all(
    users.map(async (u) => {
      const activeCount = await countEligibleCustomerCancellations(u._id, windowDays)
      const lastRecord = await BookingCancellationRecord.findOne({
        customerId: u._id,
        cancelledByRole: 'CUSTOMER',
      })
        .sort({ createdAt: -1 })
        .populate('bookingId', 'bookingCode serviceName scheduledAt totalAmount')

      const isRestricted = Boolean(
        u.customerCancellationRestriction?.isRestricted &&
          (!u.customerCancellationRestriction.restrictedUntil ||
            new Date() < new Date(u.customerCancellationRestriction.restrictedUntil))
      )

      return {
        customer: {
          _id: u._id,
          name: u.fullName || u.name || 'Customer',
          phone: u.phone,
          email: u.email,
        },
        activeCount,
        windowDays,
        warningThreshold: settings.customerWarningThreshold,
        restrictionThreshold: settings.customerRestrictionThreshold,
        warningCount: u.customerCancellationRestriction?.warningCount || 0,
        lastWarningAt: u.customerCancellationRestriction?.lastWarningAt,
        isRestricted,
        restrictedAt: u.customerCancellationRestriction?.restrictedAt,
        restrictedUntil: u.customerCancellationRestriction?.restrictedUntil,
        restrictionReason: u.customerCancellationRestriction?.restrictionReason,
        restrictedBy: u.customerCancellationRestriction?.restrictedBy,
        lastCancellation: lastRecord,
      }
    })
  )

  let filtered = enrichedList
  if (filter === 'HIGH_CANCELLATIONS') {
    filtered = enrichedList.filter((item) => item.activeCount >= settings.customerWarningThreshold)
  }

  const p = Math.max(1, parseInt(page, 10) || 1)
  const l = Math.max(1, parseInt(limit, 10) || 20)
  const total = filtered.length
  const paginated = filtered.slice((p - 1) * l, p * l)

  return {
    items: paginated,
    pagination: {
      page: p,
      limit: l,
      total,
      pages: Math.ceil(total / l),
    },
    policy: {
      warningThreshold: settings.customerWarningThreshold,
      restrictionThreshold: settings.customerRestrictionThreshold,
      windowDays,
      restrictionMode: settings.customerRestrictionMode,
    },
  }
}

/**
 * 16. Admin: Get Detailed Customer Cancellation History & Policy Info
 */
export async function getAdminCustomerCancellationHistory(customerId) {
  const customer = await User.findById(customerId).select(
    'fullName name phone email customerCancellationRestriction'
  )
  if (!customer) {
    throw new Error('Customer not found')
  }

  const settings = await getBookingCancellationSettings()
  const windowDays = Number(settings.customerRollingWindowDays || 30)
  const activeCount = await countEligibleCustomerCancellations(customerId, windowDays)

  const records = await BookingCancellationRecord.find({
    customerId,
    cancelledByRole: 'CUSTOMER',
  })
    .sort({ createdAt: -1 })
    .populate('bookingId', 'bookingCode serviceName scheduledAt totalAmount paymentMethod status')

  const restrictionCheck = await checkCustomerBookingRestriction(customerId)

  return {
    customer: {
      _id: customer._id,
      name: customer.fullName || customer.name || 'Customer',
      phone: customer.phone,
      email: customer.email,
    },
    activeCount,
    windowDays,
    warningThreshold: settings.customerWarningThreshold,
    restrictionThreshold: settings.customerRestrictionThreshold,
    restrictionMode: settings.customerRestrictionMode,
    isRestricted: restrictionCheck.isRestricted,
    restriction: restrictionCheck.restriction,
    restrictionHistory: customer.customerCancellationRestriction?.history || [],
    records,
  }
}

/**
 * 17. Admin: Manually Apply Customer Restriction
 */
export async function adminApplyCustomerRestriction(
  customerId,
  { durationDays, reason, adminNote },
  adminUser
) {
  const customer = await User.findById(customerId)
  if (!customer) {
    throw new Error('Customer not found')
  }

  const now = new Date()
  let restrictedUntil = null
  if (durationDays && Number(durationDays) > 0) {
    restrictedUntil = new Date(now.getTime() + Number(durationDays) * 24 * 60 * 60 * 1000)
  }

  if (!customer.customerCancellationRestriction) {
    customer.customerCancellationRestriction = { history: [] }
  }

  customer.customerCancellationRestriction.isRestricted = true
  customer.customerCancellationRestriction.restrictedAt = now
  customer.customerCancellationRestriction.restrictedUntil = restrictedUntil
  customer.customerCancellationRestriction.restrictionReason =
    reason || 'Manually restricted by administrator due to repeat cancellations'
  customer.customerCancellationRestriction.restrictedBy = 'ADMIN'
  customer.customerCancellationRestriction.adminNote = adminNote || ''
  customer.customerCancellationRestriction.history.push({
    action: 'RESTRICTED',
    reason: reason || 'Manual admin restriction',
    restrictedUntil,
    performedBy: 'ADMIN',
    adminUserId: adminUser?._id,
    timestamp: now,
  })

  await customer.save()

  // Notification
  try {
    await InAppNotification.create({
      userId: customer._id,
      title: 'Account Restriction Notice',
      body: reason || 'Your booking access has been restricted by platform administration.',
      type: 'CUSTOMER_BOOKING_RESTRICTION_APPLIED',
    })
    sendNotificationToUser(customer._id, {
      title: 'Account Restriction Notice',
      body: reason || 'Your booking access has been restricted by platform administration.',
      data: {
        type: 'CUSTOMER_BOOKING_RESTRICTION_APPLIED',
        restrictedUntil: restrictedUntil ? restrictedUntil.toISOString() : 'INDEFINITE',
      },
    })
  } catch (err) {
    console.warn('[Admin Restriction Notification Warning]', err?.message)
  }

  return {
    success: true,
    message: 'Customer restricted successfully',
    customer: {
      _id: customer._id,
      restriction: customer.customerCancellationRestriction,
    },
  }
}

/**
 * 18. Admin: Manually Lift Customer Restriction
 */
export async function adminLiftCustomerRestriction(customerId, { reason, adminNote }, adminUser) {
  const customer = await User.findById(customerId)
  if (!customer) {
    throw new Error('Customer not found')
  }

  const now = new Date()
  if (!customer.customerCancellationRestriction) {
    customer.customerCancellationRestriction = { history: [] }
  }

  customer.customerCancellationRestriction.isRestricted = false
  customer.customerCancellationRestriction.restrictedUntil = null
  customer.customerCancellationRestriction.adminNote = adminNote || ''
  customer.customerCancellationRestriction.history.push({
    action: 'UNRESTRICTED',
    reason: reason || 'Manual restriction lift by administrator',
    performedBy: 'ADMIN',
    adminUserId: adminUser?._id,
    timestamp: now,
  })

  await customer.save()

  // Notification
  try {
    await InAppNotification.create({
      userId: customer._id,
      title: 'Booking Access Restored',
      body: 'Your booking access has been restored by platform administration. You can now place new bookings.',
      type: 'CUSTOMER_BOOKING_RESTRICTION_LIFTED',
    })
    sendNotificationToUser(customer._id, {
      title: 'Booking Access Restored',
      body: 'Your booking access has been restored by platform administration. You can now place new bookings.',
      data: { type: 'CUSTOMER_BOOKING_RESTRICTION_LIFTED' },
    })
  } catch (err) {
    console.warn('[Admin Lift Restriction Notification Warning]', err?.message)
  }

  return {
    success: true,
    message: 'Customer restriction lifted successfully',
    customer: {
      _id: customer._id,
      restriction: customer.customerCancellationRestriction,
    },
  }
}


