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
  ]

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
