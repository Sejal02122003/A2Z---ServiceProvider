import mongoose from 'mongoose'
import { Booking } from '../models/Booking.js'
import { BookingCancellationSetting } from '../models/BookingCancellationSetting.js'
import {
  BookingCancellationCycle,
  POLICY_CYCLE_STATUS,
} from '../models/BookingCancellationCycle.js'
import {
  BookingCancellationPenalty,
  PENALTY_PAYMENT_STATUS,
  PENALTY_STATUS,
} from '../models/BookingCancellationPenalty.js'
import { PaymentTransaction } from '../models/PaymentTransaction.js'
import { InAppNotification, NOTIFICATION_TYPES } from '../models/InAppNotification.js'
import { createOrder, verifyPaymentSignature } from './paymentService.js'
import { parseISTDateTime } from '../utils/dateHelper.js'

/**
 * 1. Helper to retrieve settings
 */
export async function getCancellationSettings() {
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
 * 2. Calculate cancellation penalty dynamically based on admin configuration
 */
export function calculatePenaltyAmount({ booking, settings, itemId = null, overrideTime = null }) {
  if (!settings.customerPenaltyEnabled) {
    return {
      penaltyApplicable: false,
      reason: 'Customer cancellation penalty is currently disabled by admin policy.',
      calculatedPenaltyAmount: 0,
      penaltyCalculationType: settings.customerPenaltyType || 'PERCENTAGE',
      configuredPenaltyValue: settings.customerPenaltyValue || 0,
    }
  }

  // Check effective date if set
  if (settings.customerPenaltyEffectiveDate) {
    const effectiveTime = new Date(settings.customerPenaltyEffectiveDate).getTime()
    const nowTime = overrideTime ? new Date(overrideTime).getTime() : Date.now()
    if (nowTime < effectiveTime) {
      return {
        penaltyApplicable: false,
        reason: 'Cancellation penalty policy is not yet effective.',
        calculatedPenaltyAmount: 0,
        penaltyCalculationType: settings.customerPenaltyType || 'PERCENTAGE',
        configuredPenaltyValue: settings.customerPenaltyValue || 0,
      }
    }
  }

  // Determine applicable base amount
  let applicableAmount = 0
  if (itemId && booking.multiServiceBooking?.isMultiService && Array.isArray(booking.multiServiceBooking.items)) {
    const item = booking.multiServiceBooking.items.find((it) => String(it._id) === String(itemId))
    applicableAmount = Number(item?.itemTotal || item?.unitPrice || 0)
  } else {
    applicableAmount = Number(booking.totalAmount || booking.basePrice || 0)
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
  const cutoffMinutes = Number(settings.customerCutoffMinutes ?? 60)

  // Condition evaluation
  const condition = settings.customerPenaltyCondition || 'WITHIN_CUTOFF'
  let conditionMet = false
  let conditionReason = ''

  if (condition === 'WITHIN_CUTOFF') {
    if (timeRemainingMinutes < cutoffMinutes || timeRemainingMs <= 0) {
      conditionMet = true
      conditionReason = `Cancellation requested within ${cutoffMinutes}m cutoff (${timeRemainingMinutes}m remaining).`
    } else {
      conditionReason = `Cancellation requested before cutoff (${timeRemainingMinutes}m remaining >= ${cutoffMinutes}m cutoff).`
    }
  } else if (condition === 'AFTER_ASSIGNMENT') {
    const isAssigned = Boolean(
      booking.laborId ||
        booking.acceptedLabourId ||
        (Array.isArray(booking.assignments) && booking.assignments.some((a) => a.labourId))
    )
    if (isAssigned) {
      conditionMet = true
      conditionReason = 'Service partner is already accepted and assigned to this booking.'
    } else {
      conditionReason = 'No service partner is assigned yet.'
    }
  } else if (condition === 'ALWAYS') {
    conditionMet = true
    conditionReason = 'Cancellation penalty applies to all customer cancellation requests.'
  }

  if (!conditionMet) {
    return {
      penaltyApplicable: false,
      reason: conditionReason,
      calculatedPenaltyAmount: 0,
      penaltyCalculationType: settings.customerPenaltyType || 'PERCENTAGE',
      configuredPenaltyValue: settings.customerPenaltyValue || 0,
      applicableAmount,
      timeRemainingMinutes,
      cutoffMinutes,
    }
  }

  // Compute penalty
  const calculationType = settings.customerPenaltyType || 'PERCENTAGE'
  const configuredValue = Number(settings.customerPenaltyValue ?? 25)
  let penalty = 0

  if (calculationType === 'PERCENTAGE') {
    const rate = Math.max(0, Math.min(100, configuredValue))
    penalty = Math.round((rate / 100) * applicableAmount)
  } else {
    penalty = Math.max(0, configuredValue)
  }

  // Apply Min / Max limits
  let minLimitApplied = false
  let maxLimitApplied = false
  const minLimit = Number(settings.customerMinPenaltyAmount || 0)
  const maxLimit = Number(settings.customerMaxPenaltyAmount || 0)

  if (minLimit > 0 && penalty < minLimit) {
    penalty = minLimit
    minLimitApplied = true
  }
  if (maxLimit > 0 && penalty > maxLimit) {
    penalty = maxLimit
    maxLimitApplied = true
  }

  // Calculate billing breakdown
  const isPaid = (booking.paymentStatus || '').toUpperCase() === 'PAID'
  const previouslyPaidAmount = booking.paymentMethod === 'ONLINE' && isPaid ? (booking.totalAmount || 0) : 0
  const originalBookingAmount = Number(booking.totalAmount || 0)
  const totalBookingValue = originalBookingAmount + penalty
  const additionalAmountPayable = penalty
  const totalOutstandingAmount = penalty

  return {
    penaltyApplicable: true,
    conditionMet: true,
    conditionReason,
    penaltyCalculationType: calculationType,
    configuredPenaltyValue: configuredValue,
    calculatedPenaltyAmount: penalty,
    minLimitApplied,
    maxLimitApplied,
    applicableAmount,
    timeRemainingMinutes,
    cutoffMinutes,
    billingSummary: {
      originalBookingAmount,
      previouslyPaidAmount,
      cancellationPenalty: penalty,
      totalBookingValue,
      additionalAmountPayable,
      totalOutstandingAmount,
      currency: 'INR',
    },
  }
}

/**
 * 3. Get or create active Cancellation Policy Cycle for a booking
 */
export async function getOrCreateCurrentPolicyCycle({ bookingId, customerId }) {
  let cycle = await BookingCancellationCycle.findOne({
    bookingId,
    cycleStatus: { $in: [POLICY_CYCLE_STATUS.ACTIVE, POLICY_CYCLE_STATUS.PENALTY_PENDING] },
  }).sort({ cycleNumber: -1 })

  if (!cycle) {
    const totalCycles = await BookingCancellationCycle.countDocuments({ bookingId })
    const cycleNumber = totalCycles + 1
    const cycleId = `CYC_${String(bookingId).slice(-6).toUpperCase()}_${cycleNumber}_${Date.now()}`

    cycle = await BookingCancellationCycle.create({
      cycleId,
      bookingId,
      customerId,
      cycleNumber,
      cycleStatus: POLICY_CYCLE_STATUS.ACTIVE,
      cycleStartTimestamp: new Date(),
    })
  }

  // Sync to Booking document if needed
  await Booking.updateOne(
    { _id: bookingId },
    {
      $set: {
        'cancellationPolicyCycle.currentCycleNumber': cycle.cycleNumber,
        'cancellationPolicyCycle.currentCycleId': cycle.cycleId,
        'cancellationPolicyCycle.cycleStatus': cycle.cycleStatus,
      },
    }
  )

  return cycle
}

/**
 * 4. Create or fetch pending penalty record and sync booking bill line item
 */
export async function prepareCancellationPenaltyRecord({
  booking,
  customerId,
  settings,
  itemId = null,
  reason = '',
  reasonNote = '',
  overrideTime = null,
}) {
  const calc = calculatePenaltyAmount({ booking, settings, itemId, overrideTime })
  if (!calc.penaltyApplicable) {
    return { penaltyApplicable: false, calculation: calc }
  }

  const cycle = await getOrCreateCurrentPolicyCycle({ bookingId: booking._id, customerId })
  const attemptId = `ATT_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`

  // Check if an unpaid penalty already exists for this booking & cycle
  let penalty = await BookingCancellationPenalty.findOne({
    bookingId: booking._id,
    policyCycleNumber: cycle.cycleNumber,
    paymentStatus: { $in: [PENALTY_PAYMENT_STATUS.PENDING, PENALTY_PAYMENT_STATUS.PROCESSING] },
  })

  if (!penalty) {
    const penaltyId = `PEN_${String(booking._id).slice(-6).toUpperCase()}_${cycle.cycleNumber}_${Date.now()}`
    penalty = await BookingCancellationPenalty.create({
      penaltyId,
      bookingId: booking._id,
      customerId,
      cancellationAttemptId: attemptId,
      policyCycleId: cycle.cycleId,
      policyCycleNumber: cycle.cycleNumber,
      policyId: settings._id,
      originalApplicableBookingAmount: calc.billingSummary.originalBookingAmount,
      previouslyPaidAmount: calc.billingSummary.previouslyPaidAmount,
      penaltyCalculationType: calc.penaltyCalculationType,
      configuredPenaltyValue: calc.configuredPenaltyValue,
      calculatedPenaltyAmount: calc.calculatedPenaltyAmount,
      minLimitApplied: calc.minLimitApplied,
      maxLimitApplied: calc.maxLimitApplied,
      outstandingAmount: calc.calculatedPenaltyAmount,
      paymentStatus: PENALTY_PAYMENT_STATUS.PENDING,
      penaltyStatus: PENALTY_STATUS.PENDING,
      lineItemDescription: `Cancellation Penalty Fee (Cycle #${cycle.cycleNumber})`,
      metadata: {
        reason,
        reasonNote,
        itemId,
      },
    })

    // Record attempt inside cycle
    cycle.cancellationAttempts.push({
      attemptId,
      requestedAt: new Date(),
      reason,
      reasonNote,
      status: 'PENALTY_PENDING',
      penaltyApplicable: true,
      assessedPenaltyAmount: calc.calculatedPenaltyAmount,
      penaltyRecordId: penalty._id,
    })
    cycle.cycleStatus = POLICY_CYCLE_STATUS.PENALTY_PENDING
    await cycle.save()

    // Add penalty line item to Booking bill
    const existingLineIdx = (booking.cancellationBilling?.penaltyLineItems || []).findIndex(
      (it) => it.penaltyId === penalty.penaltyId
    )

    const newLineItem = {
      penaltyId: penalty.penaltyId,
      cycleNumber: cycle.cycleNumber,
      cycleId: cycle.cycleId,
      description: penalty.lineItemDescription,
      amount: penalty.calculatedPenaltyAmount,
      calculationType: penalty.penaltyCalculationType,
      configuredValue: penalty.configuredPenaltyValue,
      paymentStatus: 'PENDING',
      assessedAt: new Date(),
    }

    if (existingLineIdx === -1) {
      if (!booking.cancellationBilling) {
        booking.cancellationBilling = {
          originalBookingAmount: calc.billingSummary.originalBookingAmount,
          previouslyPaidAmount: calc.billingSummary.previouslyPaidAmount,
          totalPenaltyCharged: 0,
          totalPenaltyPaid: 0,
          additionalAmountPayable: 0,
          totalOutstandingAmount: 0,
          penaltyLineItems: [],
        }
      }
      booking.cancellationBilling.penaltyLineItems.push(newLineItem)
      booking.cancellationBilling.originalBookingAmount = calc.billingSummary.originalBookingAmount
      booking.cancellationBilling.previouslyPaidAmount = calc.billingSummary.previouslyPaidAmount
      booking.cancellationBilling.totalPenaltyCharged =
        (booking.cancellationBilling.totalPenaltyCharged || 0) + penalty.calculatedPenaltyAmount
      booking.cancellationBilling.additionalAmountPayable =
        (booking.cancellationBilling.totalPenaltyCharged || 0) - (booking.cancellationBilling.totalPenaltyPaid || 0)
      booking.cancellationBilling.totalOutstandingAmount = booking.cancellationBilling.additionalAmountPayable
      await booking.save()
    }
  }

  return {
    penaltyApplicable: true,
    penalty,
    cycle,
    attemptId,
    calculation: calc,
    billingSummary: calc.billingSummary,
  }
}

/**
 * 5. Initiate payment for cancellation penalty via payment gateway
 */
export async function initiateCancellationPenaltyPayment({ bookingId, customerId, penaltyId = null }) {
  const booking = await Booking.findById(bookingId)
  if (!booking) {
    throw new Error('Booking not found')
  }

  if (String(booking.userId) !== String(customerId)) {
    throw new Error('Unauthorized to pay penalty for this booking')
  }

  let penaltyQuery = {
    bookingId: booking._id,
    paymentStatus: { $in: [PENALTY_PAYMENT_STATUS.PENDING, PENALTY_PAYMENT_STATUS.FAILED] },
  }
  if (penaltyId) {
    penaltyQuery = { ...penaltyQuery, penaltyId }
  }

  const penalty = await BookingCancellationPenalty.findOne(penaltyQuery).sort({ createdAt: -1 })
  if (!penalty) {
    throw new Error('No pending cancellation penalty found for this booking')
  }

  if (penalty.calculatedPenaltyAmount <= 0) {
    throw new Error('Penalty amount must be greater than zero')
  }

  const receipt = `RCPT_PEN_${String(penalty.penaltyId).slice(-6)}_${Date.now().toString().slice(-4)}`
  const order = await createOrder(penalty.calculatedPenaltyAmount, 'INR', receipt)

  // Record PaymentTransaction
  const pTx = await PaymentTransaction.create({
    userId: customerId,
    bookingId: booking._id,
    cancellationPenaltyId: penalty._id,
    policyCycleId: penalty.policyCycleId,
    razorpayOrderId: order.id,
    amount: penalty.calculatedPenaltyAmount,
    currency: 'INR',
    purpose: 'CANCELLATION_PENALTY',
    status: 'CREATED',
  })

  // Update penalty record references
  penalty.razorpayOrderId = order.id
  penalty.paymentReference = order.id
  penalty.paymentStatus = PENALTY_PAYMENT_STATUS.PROCESSING
  await penalty.save()

  return {
    order,
    paymentTransactionId: pTx._id,
    penalty: {
      penaltyId: penalty.penaltyId,
      policyCycleNumber: penalty.policyCycleNumber,
      amount: penalty.calculatedPenaltyAmount,
      description: penalty.lineItemDescription,
    },
    billingSummary: {
      originalBookingAmount: penalty.originalApplicableBookingAmount,
      previouslyPaidAmount: penalty.previouslyPaidAmount,
      cancellationPenalty: penalty.calculatedPenaltyAmount,
      totalBookingValue: penalty.originalApplicableBookingAmount + penalty.calculatedPenaltyAmount,
      additionalAmountPayable: penalty.calculatedPenaltyAmount,
    },
  }
}

/**
 * 6. Verify payment and automatically restart cancellation policy
 *    IMPORTANT: Booking remains active and is NOT cancelled!
 */
export async function verifyAndRestartCancellationPolicy({
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
  userId,
}) {
  if (!razorpayOrderId) {
    throw new Error('Razorpay order ID is required')
  }

  const pTx = await PaymentTransaction.findOne({ razorpayOrderId })
  if (!pTx) {
    throw new Error('Payment transaction not found for order')
  }

  // Idempotency check: If already captured and processed
  if (pTx.status === 'CAPTURED') {
    const existingPenalty = await BookingCancellationPenalty.findOne({
      $or: [{ _id: pTx.cancellationPenaltyId }, { razorpayOrderId }],
    })
    const existingBooking = await Booking.findById(pTx.bookingId)
    const activeCycle = await BookingCancellationCycle.findOne({
      bookingId: pTx.bookingId,
      cycleStatus: POLICY_CYCLE_STATUS.ACTIVE,
    }).sort({ cycleNumber: -1 })

    return {
      success: true,
      alreadyProcessed: true,
      message: 'Cancellation penalty payment has already been verified and policy restarted.',
      booking: existingBooking,
      penalty: existingPenalty,
      cycle: activeCycle,
    }
  }

  // Verify Signature
  const isValid = verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature)
  if (!isValid) {
    pTx.status = 'FAILED'
    await pTx.save()

    await BookingCancellationPenalty.updateOne(
      { razorpayOrderId },
      { $set: { paymentStatus: PENALTY_PAYMENT_STATUS.FAILED } }
    )
    throw new Error('Payment verification signature check failed')
  }

  // Update PaymentTransaction
  pTx.razorpayPaymentId = razorpayPaymentId || `pay_mock_${Date.now()}`
  pTx.razorpaySignature = razorpaySignature || 'sig_verified'
  pTx.status = 'CAPTURED'
  await pTx.save()

  // Find Penalty Record
  const penalty = await BookingCancellationPenalty.findOne({
    $or: [{ _id: pTx.cancellationPenaltyId }, { razorpayOrderId }],
  })
  if (!penalty) {
    throw new Error('Associated cancellation penalty record not found')
  }

  // Find Booking
  const booking = await Booking.findById(penalty.bookingId)
  if (!booking) {
    throw new Error('Booking associated with penalty not found')
  }

  const settings = await getCancellationSettings()

  // 1. Mark current penalty as PAID
  penalty.paymentStatus = PENALTY_PAYMENT_STATUS.PAID
  penalty.penaltyStatus = PENALTY_STATUS.PAID
  penalty.amountPaid = pTx.amount
  penalty.outstandingAmount = 0
  penalty.paidAt = new Date()
  penalty.razorpayPaymentId = pTx.razorpayPaymentId
  penalty.razorpaySignature = pTx.razorpaySignature
  await penalty.save()

  // 2. Mark current cancellation attempt as completed for penalty payment
  const currentCycle = await BookingCancellationCycle.findOne({
    bookingId: booking._id,
    cycleNumber: penalty.policyCycleNumber,
  })

  if (currentCycle) {
    currentCycle.cycleStatus = POLICY_CYCLE_STATUS.COMPLETED
    currentCycle.cycleEndTimestamp = new Date()
    if (Array.isArray(currentCycle.cancellationAttempts)) {
      currentCycle.cancellationAttempts.forEach((a) => {
        if (
          String(a.attemptId) === String(penalty.cancellationAttemptId) ||
          String(a.penaltyRecordId) === String(penalty._id)
        ) {
          a.status = 'POLICY_RESTARTED'
        }
      })
    }
    await currentCycle.save()
  }

  // 3. Create NEW Cancellation Policy Cycle (Automatic Restart)
  const nextCycleNumber = (currentCycle?.cycleNumber || 1) + 1
  const restartTimerMinutes = Number(settings.customerRestartTimerMinutes ?? 60)
  const restartTimestamp = new Date()
  const restartExpiresAt = new Date(restartTimestamp.getTime() + restartTimerMinutes * 60 * 1000)
  const newCycleId = `CYC_${String(booking._id).slice(-6).toUpperCase()}_${nextCycleNumber}_${Date.now()}`

  const newCycle = await BookingCancellationCycle.create({
    cycleId: newCycleId,
    bookingId: booking._id,
    customerId: booking.userId,
    cycleNumber: nextCycleNumber,
    previousCycleId: currentCycle?.cycleId,
    applicablePolicyId: settings._id,
    applicablePolicyVersion: 'v1.0',
    cycleStartTimestamp: restartTimestamp,
    cycleStatus: POLICY_CYCLE_STATUS.ACTIVE,
    restartTimestamp,
    restartTimerMinutes,
    restartExpiresAt,
  })

  // 4. Update Booking document
  if (!booking.cancellationBilling) {
    booking.cancellationBilling = {
      originalBookingAmount: booking.totalAmount || 0,
      previouslyPaidAmount: (booking.paymentMethod === 'ONLINE' && booking.paymentStatus === 'PAID') ? (booking.totalAmount || 0) : 0,
      totalPenaltyCharged: 0,
      totalPenaltyPaid: 0,
      additionalAmountPayable: 0,
      totalOutstandingAmount: 0,
      penaltyLineItems: [],
    }
  }

  const lineItem = booking.cancellationBilling.penaltyLineItems.find(
    (it) => it.penaltyId === penalty.penaltyId
  )
  if (lineItem) {
    lineItem.paymentStatus = 'PAID'
    lineItem.paidAt = new Date()
    lineItem.razorpayOrderId = razorpayOrderId
    lineItem.razorpayPaymentId = pTx.razorpayPaymentId
  }

  booking.cancellationBilling.totalPenaltyPaid =
    (booking.cancellationBilling.totalPenaltyPaid || 0) + penalty.calculatedPenaltyAmount
  booking.cancellationBilling.additionalAmountPayable = Math.max(
    0,
    (booking.cancellationBilling.totalPenaltyCharged || 0) - (booking.cancellationBilling.totalPenaltyPaid || 0)
  )
  booking.cancellationBilling.totalOutstandingAmount = booking.cancellationBilling.additionalAmountPayable

  // Policy Cycle Sync on Booking
  booking.cancellationPolicyCycle = {
    currentCycleNumber: nextCycleNumber,
    currentCycleId: newCycle.cycleId,
    cycleStatus: 'RESTARTED',
    lastRestartedAt: restartTimestamp,
    restartExpiresAt,
    totalCyclesCount: nextCycleNumber,
  }

  // CRITICAL REQUIREMENT: Booking status MUST NOT be cancelled! Keep unchanged and active!
  await booking.save()

  // 5. Create in-app customer notification
  try {
    const notificationMsg = `Your cancellation penalty payment of ₹${penalty.calculatedPenaltyAmount} was successful. Your cancellation policy has restarted (Cycle #${nextCycleNumber}). The booking remains active and you have a fresh cancellation opportunity.`
    await InAppNotification.create({
      userId: booking.userId,
      title: 'Cancellation Policy Restarted',
      body: notificationMsg,
      message: notificationMsg,
      type: NOTIFICATION_TYPES.BOOKING_STATUS || 'BOOKING_STATUS',
      data: {
        bookingId: booking._id,
        policyCycleNumber: nextCycleNumber,
        policyCycleId: newCycle.cycleId,
      },
    })
  } catch (err) {
    console.warn('[Notification create error]:', err?.message)
  }

  // 6. Socket notification emit
  try {
    const { emitToUser } = await import('../socket.js')
    emitToUser(booking.userId, 'BOOKING_CANCELLATION_POLICY_RESTARTED', {
      bookingId: booking._id,
      cycleNumber: nextCycleNumber,
      cycleId: newCycle.cycleId,
      status: booking.status,
      message: 'Cancellation penalty payment successful. Your cancellation policy has been restarted.',
    })
  } catch (err) {
    console.warn('[Socket emit error]:', err?.message)
  }

  return {
    success: true,
    message:
      'Cancellation penalty payment successful. Your cancellation policy has been restarted. You can now initiate another cancellation request according to the updated policy cycle.',
    booking,
    penalty,
    newCycle,
    policyRestarted: true,
  }
}

/**
 * 7. Admin: Get all cancellation penalty records with pagination & filters
 */
export async function getAdminPenaltyRecords({
  page = 1,
  limit = 15,
  paymentStatus = 'ALL',
  penaltyStatus = 'ALL',
  search = '',
}) {
  const query = {}

  if (paymentStatus && paymentStatus !== 'ALL') {
    query.paymentStatus = paymentStatus
  }
  if (penaltyStatus && penaltyStatus !== 'ALL') {
    query.penaltyStatus = penaltyStatus
  }

  const p = Math.max(1, parseInt(page, 10) || 1)
  const l = Math.min(100, Math.max(1, parseInt(limit, 10) || 15))
  const skip = (p - 1) * l

  const [records, total] = await Promise.all([
    BookingCancellationPenalty.find(query)
      .populate('bookingId', 'status type date scheduledAt totalAmount paymentMethod')
      .populate('customerId', 'fullName phone email')
      .populate('waivedBy', 'fullName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(l)
      .lean(),
    BookingCancellationPenalty.countDocuments(query),
  ])

  // Filter by search query in memory if matching customer name/phone or penaltyId
  let filteredRecords = records
  if (search && search.trim()) {
    const s = search.trim().toLowerCase()
    filteredRecords = records.filter((r) => {
      const matchId = String(r.penaltyId || '').toLowerCase().includes(s)
      const matchName = String(r.customerId?.fullName || '').toLowerCase().includes(s)
      const matchPhone = String(r.customerId?.phone || '').toLowerCase().includes(s)
      const matchBooking = String(r.bookingId?._id || '').toLowerCase().includes(s)
      return matchId || matchName || matchPhone || matchBooking
    })
  }

  return {
    records: filteredRecords,
    pagination: {
      page: p,
      limit: l,
      total,
      pages: Math.ceil(total / l) || 1,
    },
  }
}

/**
 * 8. Admin: Get policy cycle history for a booking
 */
export async function getBookingPolicyCycles(bookingId) {
  const cycles = await BookingCancellationCycle.find({ bookingId })
    .sort({ cycleNumber: 1 })
    .lean()

  const penalties = await BookingCancellationPenalty.find({ bookingId })
    .populate('waivedBy', 'fullName')
    .sort({ policyCycleNumber: 1, createdAt: 1 })
    .lean()

  return { cycles, penalties }
}

/**
 * 9. Admin: Waive penalty with reason and audit log
 */
export async function adminWaiveCancellationPenalty({ penaltyId, adminUser, reason }) {
  if (!reason || !reason.trim()) {
    throw new Error('A waiver reason is required for administrative audit logs')
  }

  const penalty = await BookingCancellationPenalty.findOne({
    $or: [{ penaltyId }, { _id: mongoose.isValidObjectId(penaltyId) ? penaltyId : null }],
  })
  if (!penalty) {
    throw new Error('Penalty record not found')
  }

  if (penalty.penaltyStatus === PENALTY_STATUS.WAIVED) {
    return { success: true, message: 'Penalty is already waived', penalty }
  }

  penalty.penaltyStatus = PENALTY_STATUS.WAIVED
  penalty.waiverReason = reason.trim()
  penalty.waivedBy = adminUser?._id
  penalty.waivedAt = new Date()
  penalty.outstandingAmount = 0
  await penalty.save()

  // Update Booking line item
  const booking = await Booking.findById(penalty.bookingId)
  if (booking && booking.cancellationBilling) {
    const it = booking.cancellationBilling.penaltyLineItems.find((l) => l.penaltyId === penalty.penaltyId)
    if (it) {
      it.paymentStatus = 'WAIVED'
    }
    booking.cancellationBilling.totalPenaltyCharged = Math.max(
      0,
      (booking.cancellationBilling.totalPenaltyCharged || 0) - penalty.calculatedPenaltyAmount
    )
    booking.cancellationBilling.additionalAmountPayable = Math.max(
      0,
      (booking.cancellationBilling.totalPenaltyCharged || 0) - (booking.cancellationBilling.totalPenaltyPaid || 0)
    )
    booking.cancellationBilling.totalOutstandingAmount = booking.cancellationBilling.additionalAmountPayable
    await booking.save()
  }

  return {
    success: true,
    message: 'Penalty successfully waived',
    penalty,
    booking,
  }
}
