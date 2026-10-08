import mongoose from 'mongoose'
import { TrialConfiguration } from '../models/TrialConfiguration.js'
import { VendorTrial, VENDOR_TRIAL_STATUS } from '../models/VendorTrial.js'
import { TrialEvaluation } from '../models/TrialEvaluation.js'
import { VendorWarning } from '../models/VendorWarning.js'
import { FinalChanceRequest, FINAL_CHANCE_STATUS } from '../models/FinalChanceRequest.js'
import { TrialAuditLog, TRIAL_AUDIT_ACTIONS } from '../models/TrialAuditLog.js'
import { User } from '../models/User.js'
import { Booking } from '../models/Booking.js'
import { PaymentTransaction } from '../models/PaymentTransaction.js'
import { createOrder, verifyPaymentSignature } from './paymentService.js'
import { sendNotificationToUser } from '../utils/pushNotificationHelper.js'

/**
 * Fetch or initialize the active global TrialConfiguration
 */
export async function getTrialConfig() {
  let config = await TrialConfiguration.findOne({ configKey: 'default_trial_config' })
  if (!config) {
    config = await TrialConfiguration.create({
      configKey: 'default_trial_config',
      freeTrialCount: 5,
      passingRatingThreshold: 4,
      warningRatingThreshold: 3,
      finalChanceEnabled: true,
      finalChancePenaltyAmount: 500,
      ratingWindowHours: 48,
      adminApprovalRequired: true,
      finalFailureAutoBlock: false,
      evaluationMode: 'INDIVIDUAL_TRIAL_RATING',
    })
  }
  return config
}

/**
 * Update global trial configuration
 */
export async function updateTrialConfig(updates, adminUser) {
  const allowed = [
    'freeTrialCount',
    'passingRatingThreshold',
    'warningRatingThreshold',
    'finalChanceEnabled',
    'finalChancePenaltyAmount',
    'ratingWindowHours',
    'adminApprovalRequired',
    'finalFailureAutoBlock',
    'evaluationMode',
  ]

  const cleanUpdates = {}
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      cleanUpdates[key] = updates[key]
    }
  }

  cleanUpdates.updatedBy = adminUser?._id

  const config = await TrialConfiguration.findOneAndUpdate(
    { configKey: 'default_trial_config' },
    { $set: cleanUpdates },
    { new: true, upsert: true, runValidators: true }
  )

  return config
}

/**
 * Start or initialize trial for a newly verified vendor
 */
export async function startVendorTrial(vendorId, options = {}) {
  const user = await User.findById(vendorId)
  if (!user) {
    throw new Error('Vendor not found')
  }

  // Check if trial record already exists
  let trial = await VendorTrial.findOne({ vendorId })

  if (trial && trial.status !== VENDOR_TRIAL_STATUS.NOT_STARTED && !options.forceRestart) {
    return trial
  }

  const config = await getTrialConfig()

  if (!trial) {
    trial = new VendorTrial({
      vendorId,
      status: VENDOR_TRIAL_STATUS.TRIAL_ACTIVE,
      configuredTrialCount: config.freeTrialCount || 5,
      completedTrialCount: 0,
      passedTrialCount: 0,
      failedTrialCount: 0,
      passingRatingThreshold: config.passingRatingThreshold || 4,
      warningRatingThreshold: config.warningRatingThreshold || 3,
      finalChanceEnabled: config.finalChanceEnabled ?? true,
      finalChancePenaltyAmount: config.finalChancePenaltyAmount || 500,
      ratingWindowHours: config.ratingWindowHours || 48,
      warningIssued: false,
      warningCount: 0,
      warningChanceUsed: false,
      finalChanceUsed: false,
      eligibleForConfirmation: false,
      startedAt: new Date(),
    })
  } else {
    trial.status = VENDOR_TRIAL_STATUS.TRIAL_ACTIVE
    trial.configuredTrialCount = config.freeTrialCount || 5
    trial.completedTrialCount = 0
    trial.passedTrialCount = 0
    trial.failedTrialCount = 0
    trial.passingRatingThreshold = config.passingRatingThreshold || 4
    trial.warningRatingThreshold = config.warningRatingThreshold || 3
    trial.finalChanceEnabled = config.finalChanceEnabled ?? true
    trial.finalChancePenaltyAmount = config.finalChancePenaltyAmount || 500
    trial.ratingWindowHours = config.ratingWindowHours || 48
    trial.warningIssued = false
    trial.warningCount = 0
    trial.warningChanceUsed = false
    trial.finalChanceUsed = false
    trial.eligibleForConfirmation = false
    trial.startedAt = new Date()
  }

  await trial.save()

  // Update user vendorStatus
  user.vendorStatus = VENDOR_TRIAL_STATUS.TRIAL_ACTIVE
  await user.save()

  // Audit log
  await TrialAuditLog.create({
    vendorId,
    trialId: trial._id,
    action: TRIAL_AUDIT_ACTIONS.TRIAL_STARTED,
    previousStatus: VENDOR_TRIAL_STATUS.NOT_STARTED,
    newStatus: VENDOR_TRIAL_STATUS.TRIAL_ACTIVE,
    performedBy: options.performedBy || null,
    actorRole: options.actorRole || 'SYSTEM',
    reason: options.reason || 'Vendor KYC verified, free trial period initialized',
    metadata: {
      configuredTrialCount: trial.configuredTrialCount,
      passingRatingThreshold: trial.passingRatingThreshold,
    },
  })

  // Send Push Notification
  try {
    await sendNotificationToUser(vendorId, {
      title: 'Trial Period Started',
      body: `Welcome! Your trial period is active. You have ${trial.configuredTrialCount} trial services to complete.`,
      data: { type: 'TRIAL_STARTED' },
    })
  } catch (err) {
    console.warn('Failed to send trial start push notification:', err?.message)
  }

  return trial
}

/**
 * Centralized trial rating evaluator
 * Called whenever a user submits a rating for a completed booking
 */
export async function evaluateBookingRating({ bookingId, rating, comment, reviewerId, vendorId: providedVendorId }) {
  const booking = await Booking.findById(bookingId)
  if (!booking) {
    throw new Error('Booking not found')
  }

  const numRating = Math.round(Number(rating))
  if (numRating < 1 || numRating > 5) {
    throw new Error('Rating must be an integer between 1 and 5')
  }

  const vendorId = providedVendorId || booking.laborId || booking.acceptedLabourId
  if (!vendorId) {
    return { isTrialEvaluation: false, reason: 'No vendor assigned to booking' }
  }

  const user = await User.findById(vendorId)
  if (!user) {
    return { isTrialEvaluation: false, reason: 'Vendor user not found' }
  }

  // Requirement 55 & 56: If vendor is CONFIRMED, normal rating does NOT modify trial
  if (user.vendorStatus === VENDOR_TRIAL_STATUS.CONFIRMED) {
    return {
      isTrialEvaluation: false,
      vendorStatus: user.vendorStatus,
      message: 'Vendor is already confirmed. Normal production review recorded.',
    }
  }

  // Also skip if vendor is already BLOCKED or REJECTED
  if (user.vendorStatus === VENDOR_TRIAL_STATUS.BLOCKED || user.vendorStatus === VENDOR_TRIAL_STATUS.REJECTED) {
    return {
      isTrialEvaluation: false,
      vendorStatus: user.vendorStatus,
      message: 'Vendor is not in active trial.',
    }
  }

  // Find active trial
  const trial = await VendorTrial.findOne({ vendorId })
  if (!trial) {
    return {
      isTrialEvaluation: false,
      message: 'No trial record found for vendor.',
    }
  }

  // Trial must be in an evaluatable state
  const evaluatableStates = [
    VENDOR_TRIAL_STATUS.TRIAL_ACTIVE,
    VENDOR_TRIAL_STATUS.WARNING,
    VENDOR_TRIAL_STATUS.FINAL_CHANCE_ACTIVE,
  ]

  if (!evaluatableStates.includes(trial.status)) {
    return {
      isTrialEvaluation: false,
      trialStatus: trial.status,
      message: `Trial is currently in status: ${trial.status}. Cannot evaluate new trial booking.`,
    }
  }

  // Requirement 26 & 38: Idempotency protection against duplicate ratings
  const existingEvaluation = await TrialEvaluation.findOne({ bookingId, vendorId })
  if (existingEvaluation) {
    return {
      isTrialEvaluation: true,
      alreadyEvaluated: true,
      evaluation: existingEvaluation,
      trial,
      message: 'This booking has already been evaluated for the trial.',
    }
  }

  // Evaluate rating against snapshot threshold
  const passingThreshold = trial.passingRatingThreshold || 4
  const isPassed = numRating >= passingThreshold
  const evalResult = isPassed ? 'PASSED' : 'FAILED'
  const trialNumber = trial.completedTrialCount + 1

  // Determine evaluation stage
  let evaluationType = 'REGULAR_TRIAL'
  if (trial.status === VENDOR_TRIAL_STATUS.FINAL_CHANCE_ACTIVE) {
    evaluationType = 'FINAL_CHANCE'
  } else if (trial.status === VENDOR_TRIAL_STATUS.WARNING || (trial.warningIssued && !trial.warningChanceUsed)) {
    evaluationType = 'WARNING_CHANCE'
  }

  // Update counters
  trial.completedTrialCount += 1
  if (isPassed) {
    trial.passedTrialCount += 1
  } else {
    trial.failedTrialCount += 1
  }

  // Create TrialEvaluation record
  const evaluation = await TrialEvaluation.create({
    vendorId,
    trialId: trial._id,
    bookingId,
    serviceId: booking.serviceId || (booking.assignments?.[0]?.serviceId) || null,
    subcategoryId: booking.subcategoryId || null,
    reviewerId,
    trialNumber,
    rating: numRating,
    ratingComment: comment || '',
    result: evalResult,
    evaluationType,
    configurationSnapshot: {
      passingRatingThreshold: trial.passingRatingThreshold,
      warningRatingThreshold: trial.warningRatingThreshold,
      configuredTrialCount: trial.configuredTrialCount,
    },
    evaluatedAt: new Date(),
  })

  // State Machine Transitions
  const prevTrialStatus = trial.status
  let nextTrialStatus = trial.status
  let nextVendorStatus = user.vendorStatus

  const totalAllowedTrials = trial.configuredTrialCount + (trial.adminGrantedAdditionalTrials || 0)

  if (evaluationType === 'FINAL_CHANCE') {
    trial.finalChanceUsed = true
    if (isPassed) {
      // Final chance PASSED -> Eligible for admin confirmation
      nextTrialStatus = VENDOR_TRIAL_STATUS.TRIAL_COMPLETED
      nextVendorStatus = VENDOR_TRIAL_STATUS.PENDING_ADMIN_CONFIRMATION
      trial.eligibleForConfirmation = true
      trial.completedAt = new Date()

      await TrialAuditLog.create({
        vendorId,
        trialId: trial._id,
        action: TRIAL_AUDIT_ACTIONS.FINAL_CHANCE_PASSED,
        previousStatus: prevTrialStatus,
        newStatus: nextTrialStatus,
        bookingId,
        trialEvaluationId: evaluation._id,
        reason: `Final chance trial passed with ${numRating} stars rating`,
      })

      await TrialAuditLog.create({
        vendorId,
        trialId: trial._id,
        action: TRIAL_AUDIT_ACTIONS.TRIAL_COMPLETED,
        previousStatus: prevTrialStatus,
        newStatus: nextTrialStatus,
        bookingId,
        trialEvaluationId: evaluation._id,
        reason: 'Vendor completed trial via final chance and is eligible for admin confirmation',
      })

      sendNotificationToUser(vendorId, {
        title: 'Final Chance Passed!',
        body: 'Congratulations! You passed your final chance trial. Your application is now pending admin confirmation.',
        data: { type: 'FINAL_CHANCE_PASSED' },
      }).catch(() => {})
    } else {
      // Final chance FAILED -> BLOCKED
      nextTrialStatus = VENDOR_TRIAL_STATUS.BLOCKED
      nextVendorStatus = VENDOR_TRIAL_STATUS.BLOCKED
      trial.blockedAt = new Date()
      trial.blockReason = `Failed final chance trial with ${numRating} stars rating`
      user.isActive = false

      await TrialAuditLog.create({
        vendorId,
        trialId: trial._id,
        action: TRIAL_AUDIT_ACTIONS.FINAL_CHANCE_FAILED,
        previousStatus: prevTrialStatus,
        newStatus: nextTrialStatus,
        bookingId,
        trialEvaluationId: evaluation._id,
        reason: `Final chance trial failed with ${numRating} stars rating`,
      })

      await TrialAuditLog.create({
        vendorId,
        trialId: trial._id,
        action: TRIAL_AUDIT_ACTIONS.VENDOR_BLOCKED,
        previousStatus: prevTrialStatus,
        newStatus: nextTrialStatus,
        bookingId,
        trialEvaluationId: evaluation._id,
        reason: 'Vendor blocked after failing final chance',
      })

      sendNotificationToUser(vendorId, {
        title: 'Account Restricted',
        body: 'Your A2Z Service Provider account has been blocked due to trial performance. Please contact support.',
        data: { type: 'VENDOR_BLOCKED' },
      }).catch(() => {})
    }
  } else if (evaluationType === 'WARNING_CHANCE') {
    trial.warningChanceUsed = true
    if (isPassed) {
      // Passed warning chance
      if (trial.completedTrialCount >= totalAllowedTrials) {
        nextTrialStatus = VENDOR_TRIAL_STATUS.TRIAL_COMPLETED
        nextVendorStatus = VENDOR_TRIAL_STATUS.PENDING_ADMIN_CONFIRMATION
        trial.eligibleForConfirmation = true
        trial.completedAt = new Date()

        await TrialAuditLog.create({
          vendorId,
          trialId: trial._id,
          action: TRIAL_AUDIT_ACTIONS.TRIAL_COMPLETED,
          previousStatus: prevTrialStatus,
          newStatus: nextTrialStatus,
          bookingId,
          trialEvaluationId: evaluation._id,
          reason: `Trial completed (${trial.completedTrialCount}/${totalAllowedTrials}) after successful warning recovery`,
        })

        sendNotificationToUser(vendorId, {
          title: 'Trial Completed',
          body: 'You have completed all trial services and are eligible for admin confirmation.',
          data: { type: 'TRIAL_COMPLETED' },
        }).catch(() => {})
      } else {
        nextTrialStatus = VENDOR_TRIAL_STATUS.TRIAL_ACTIVE
        nextVendorStatus = VENDOR_TRIAL_STATUS.TRIAL_ACTIVE

        await TrialAuditLog.create({
          vendorId,
          trialId: trial._id,
          action: TRIAL_AUDIT_ACTIONS.TRIAL_PASSED,
          previousStatus: prevTrialStatus,
          newStatus: nextTrialStatus,
          bookingId,
          trialEvaluationId: evaluation._id,
          reason: `Warning chance passed with ${numRating} stars rating`,
        })

        sendNotificationToUser(vendorId, {
          title: 'Trial Service Passed',
          body: `Good job! Your warning chance passed with ${numRating} stars. Continue your remaining trials.`,
          data: { type: 'TRIAL_PASSED' },
        }).catch(() => {})
      }
    } else {
      // Failed warning chance -> FINAL FAILURE
      nextTrialStatus = VENDOR_TRIAL_STATUS.FINAL_FAILURE
      nextVendorStatus = VENDOR_TRIAL_STATUS.FINAL_FAILURE

      await TrialAuditLog.create({
        vendorId,
        trialId: trial._id,
        action: TRIAL_AUDIT_ACTIONS.FINAL_FAILURE,
        previousStatus: prevTrialStatus,
        newStatus: nextTrialStatus,
        bookingId,
        trialEvaluationId: evaluation._id,
        reason: `Vendor failed the warning opportunity with ${numRating} stars`,
      })

      sendNotificationToUser(vendorId, {
        title: 'Trial Performance Notice',
        body: 'Your trial performance did not meet the standard. You may request one final chance by paying the applicable penalty.',
        data: { type: 'FINAL_FAILURE' },
      }).catch(() => {})
    }
  } else {
    // REGULAR_TRIAL
    if (isPassed) {
      if (trial.completedTrialCount >= totalAllowedTrials) {
        nextTrialStatus = VENDOR_TRIAL_STATUS.TRIAL_COMPLETED
        nextVendorStatus = VENDOR_TRIAL_STATUS.PENDING_ADMIN_CONFIRMATION
        trial.eligibleForConfirmation = true
        trial.completedAt = new Date()

        await TrialAuditLog.create({
          vendorId,
          trialId: trial._id,
          action: TRIAL_AUDIT_ACTIONS.TRIAL_COMPLETED,
          previousStatus: prevTrialStatus,
          newStatus: nextTrialStatus,
          bookingId,
          trialEvaluationId: evaluation._id,
          reason: `Trial successfully completed with all ${totalAllowedTrials} services.`,
        })

        sendNotificationToUser(vendorId, {
          title: 'Trial Completed!',
          body: 'Congratulations! You have completed your trial period and are eligible for admin confirmation.',
          data: { type: 'TRIAL_COMPLETED' },
        }).catch(() => {})
      } else {
        nextTrialStatus = VENDOR_TRIAL_STATUS.TRIAL_ACTIVE
        nextVendorStatus = VENDOR_TRIAL_STATUS.TRIAL_ACTIVE

        await TrialAuditLog.create({
          vendorId,
          trialId: trial._id,
          action: TRIAL_AUDIT_ACTIONS.TRIAL_PASSED,
          previousStatus: prevTrialStatus,
          newStatus: nextTrialStatus,
          bookingId,
          trialEvaluationId: evaluation._id,
          reason: `Trial #${trialNumber} passed with ${numRating} stars`,
        })
      }
    } else {
      // First low-performance rating -> WARNING
      trial.warningIssued = true
      trial.warningCount = (trial.warningCount || 0) + 1
      nextTrialStatus = VENDOR_TRIAL_STATUS.WARNING
      nextVendorStatus = VENDOR_TRIAL_STATUS.WARNING

      const warningMsg = `Your recent service performance is below the required standard. You received a ${numRating}-star rating. You have one more opportunity to improve your performance. Further low ratings may result in account restrictions.`

      await VendorWarning.create({
        vendorId,
        trialId: trial._id,
        bookingId,
        trialEvaluationId: evaluation._id,
        rating: numRating,
        warningNumber: trial.warningCount,
        message: warningMsg,
        issuedAt: new Date(),
        issuedBy: 'SYSTEM',
      })

      await TrialAuditLog.create({
        vendorId,
        trialId: trial._id,
        action: TRIAL_AUDIT_ACTIONS.WARNING_ISSUED,
        previousStatus: prevTrialStatus,
        newStatus: nextTrialStatus,
        bookingId,
        trialEvaluationId: evaluation._id,
        reason: warningMsg,
      })

      sendNotificationToUser(vendorId, {
        title: 'Performance Warning',
        body: warningMsg,
        data: { type: 'WARNING_ISSUED' },
      }).catch(() => {})
    }
  }

  trial.status = nextTrialStatus
  await trial.save()

  user.vendorStatus = nextVendorStatus
  await user.save()

  return {
    isTrialEvaluation: true,
    evaluation,
    trial,
    previousStatus: prevTrialStatus,
    newStatus: nextTrialStatus,
  }
}

/**
 * Vendor requests a final chance after FINAL_FAILURE
 */
export async function requestFinalChance(vendorId) {
  const trial = await VendorTrial.findOne({ vendorId })
  if (!trial) {
    throw new Error('Trial record not found')
  }

  const validStatuses = [
    VENDOR_TRIAL_STATUS.FINAL_FAILURE,
    VENDOR_TRIAL_STATUS.FINAL_CHANCE_PAYMENT_FAILED,
    VENDOR_TRIAL_STATUS.FINAL_CHANCE_PAYMENT_PENDING,
  ]

  if (!validStatuses.includes(trial.status)) {
    throw new Error(`Cannot request final chance from current status: ${trial.status}`)
  }

  if (trial.finalChanceUsed) {
    throw new Error('Final chance has already been used')
  }

  if (trial.finalChanceEnabled === false) {
    throw new Error('Final chance is not enabled by administration')
  }

  // Requirement 16: Snapshot penalty amount
  const penaltyAmount = trial.finalChancePenaltyAmount || 500

  // Check if an existing pending request is present
  let fcRequest = await FinalChanceRequest.findOne({
    vendorId,
    trialId: trial._id,
    status: { $in: [FINAL_CHANCE_STATUS.PENDING, FINAL_CHANCE_STATUS.PAYMENT_PENDING] },
  })

  if (!fcRequest) {
    fcRequest = await FinalChanceRequest.create({
      vendorId,
      trialId: trial._id,
      penaltyAmount,
      status: FINAL_CHANCE_STATUS.PAYMENT_PENDING,
      requestedAt: new Date(),
    })
  }

  // Create Razorpay order if amount > 0
  let razorpayOrder = null
  if (penaltyAmount > 0) {
    try {
      const receiptId = `fc_${vendorId.toString().slice(-4)}_${Date.now().toString().slice(-4)}`
      razorpayOrder = await createOrder(penaltyAmount, 'INR', receiptId)

      fcRequest.razorpayOrderId = razorpayOrder.id
      await fcRequest.save()

      // Record PaymentTransaction
      const pTx = await PaymentTransaction.create({
        userId: vendorId,
        finalChanceRequestId: fcRequest._id,
        razorpayOrderId: razorpayOrder.id,
        amount: penaltyAmount,
        currency: 'INR',
        purpose: 'TRIAL_PENALTY',
        status: 'CREATED',
      })

      fcRequest.paymentId = pTx._id
      await fcRequest.save()
    } catch (err) {
      console.warn('Razorpay order creation for final chance fallback:', err?.message)
    }
  }

  trial.status = VENDOR_TRIAL_STATUS.FINAL_CHANCE_PAYMENT_PENDING
  await trial.save()

  await User.findByIdAndUpdate(vendorId, { vendorStatus: VENDOR_TRIAL_STATUS.FINAL_CHANCE_PAYMENT_PENDING })

  await TrialAuditLog.create({
    vendorId,
    trialId: trial._id,
    action: TRIAL_AUDIT_ACTIONS.FINAL_CHANCE_REQUESTED,
    previousStatus: VENDOR_TRIAL_STATUS.FINAL_FAILURE,
    newStatus: VENDOR_TRIAL_STATUS.FINAL_CHANCE_PAYMENT_PENDING,
    actorRole: 'VENDOR',
    reason: `Vendor requested final chance with penalty ₹${penaltyAmount}`,
    metadata: {
      finalChanceRequestId: fcRequest._id,
      penaltyAmount,
      razorpayOrderId: fcRequest.razorpayOrderId,
    },
  })

  return {
    finalChanceRequest: fcRequest,
    penaltyAmount,
    razorpayOrder,
    trial,
  }
}

/**
 * Verify payment signature and activate the final chance
 */
export async function verifyAndActivateFinalChance({
  vendorId,
  razorpayOrderId,
  razorpayPaymentId,
  razorpaySignature,
  finalChanceRequestId,
}) {
  let fcRequest = null
  if (finalChanceRequestId) {
    fcRequest = await FinalChanceRequest.findById(finalChanceRequestId)
  } else if (razorpayOrderId) {
    fcRequest = await FinalChanceRequest.findOne({ razorpayOrderId })
  }

  if (!fcRequest) {
    throw new Error('Final chance request not found')
  }

  if (String(fcRequest.vendorId) !== String(vendorId)) {
    throw new Error('Unauthorized to activate this request')
  }

  if (fcRequest.status === FINAL_CHANCE_STATUS.ACTIVATED) {
    return { success: true, message: 'Final chance is already active', fcRequest }
  }

  // Verify payment signature
  const isValid = verifyPaymentSignature(razorpayOrderId, razorpayPaymentId, razorpaySignature)
  if (!isValid) {
    fcRequest.status = FINAL_CHANCE_STATUS.PAYMENT_FAILED
    await fcRequest.save()

    const trial = await VendorTrial.findById(fcRequest.trialId)
    if (trial) {
      trial.status = VENDOR_TRIAL_STATUS.FINAL_CHANCE_PAYMENT_FAILED
      await trial.save()
    }

    await TrialAuditLog.create({
      vendorId,
      trialId: fcRequest.trialId,
      action: TRIAL_AUDIT_ACTIONS.PAYMENT_FAILED,
      actorRole: 'VENDOR',
      reason: 'Signature verification failed for penalty payment',
      metadata: { razorpayOrderId, razorpayPaymentId },
    })

    throw new Error('Payment verification failed')
  }

  // Payment successful!
  fcRequest.razorpayPaymentId = razorpayPaymentId
  fcRequest.status = FINAL_CHANCE_STATUS.ACTIVATED
  fcRequest.paidAt = new Date()
  fcRequest.activatedAt = new Date()
  await fcRequest.save()

  // Update PaymentTransaction
  await PaymentTransaction.findOneAndUpdate(
    { razorpayOrderId },
    {
      $set: {
        razorpayPaymentId,
        razorpaySignature,
        status: 'CAPTURED',
      },
    }
  )

  // Activate trial
  const trial = await VendorTrial.findById(fcRequest.trialId)
  if (trial) {
    trial.finalChancePenaltyPaid = true
    trial.status = VENDOR_TRIAL_STATUS.FINAL_CHANCE_ACTIVE
    await trial.save()
  }

  // Update user
  await User.findByIdAndUpdate(vendorId, {
    vendorStatus: VENDOR_TRIAL_STATUS.FINAL_CHANCE_ACTIVE,
    isActive: true,
  })

  // Audit Logs
  await TrialAuditLog.create({
    vendorId,
    trialId: trial?._id,
    action: TRIAL_AUDIT_ACTIONS.PAYMENT_SUCCESS,
    actorRole: 'VENDOR',
    reason: `Penalty payment ₹${fcRequest.penaltyAmount} verified`,
    metadata: { razorpayOrderId, razorpayPaymentId },
  })

  await TrialAuditLog.create({
    vendorId,
    trialId: trial?._id,
    action: TRIAL_AUDIT_ACTIONS.FINAL_CHANCE_ACTIVATED,
    previousStatus: VENDOR_TRIAL_STATUS.FINAL_CHANCE_PAYMENT_PENDING,
    newStatus: VENDOR_TRIAL_STATUS.FINAL_CHANCE_ACTIVE,
    actorRole: 'SYSTEM',
    reason: 'Final chance activated after verified penalty payment',
  })

  // Notification
  sendNotificationToUser(vendorId, {
    title: 'Final Chance Activated',
    body: 'Your final trial opportunity has been activated. Your performance must meet the required rating standard.',
    data: { type: 'FINAL_CHANCE_ACTIVATED' },
  }).catch(() => {})

  return {
    success: true,
    message: 'Final chance activated successfully',
    finalChanceRequest: fcRequest,
    trial,
  }
}

/**
 * Admin: CONFIRM VENDOR (Requirement 49)
 */
export async function confirmVendor(vendorId, adminUser, notes = '') {
  const trial = await VendorTrial.findOne({ vendorId })
  if (!trial) {
    throw new Error('Trial record not found for vendor')
  }

  const prevStatus = trial.status

  trial.status = VENDOR_TRIAL_STATUS.CONFIRMED
  trial.confirmedAt = new Date()
  trial.confirmedBy = adminUser._id
  trial.confirmationNotes = notes || 'Confirmed by administrator'
  await trial.save()

  const user = await User.findByIdAndUpdate(
    vendorId,
    { vendorStatus: VENDOR_TRIAL_STATUS.CONFIRMED, isActive: true },
    { new: true }
  )

  await TrialAuditLog.create({
    vendorId,
    trialId: trial._id,
    action: TRIAL_AUDIT_ACTIONS.VENDOR_CONFIRMED,
    previousStatus: prevStatus,
    newStatus: VENDOR_TRIAL_STATUS.CONFIRMED,
    performedBy: adminUser._id,
    actorRole: 'ADMIN',
    reason: notes || 'Vendor confirmed after admin review',
  })

  sendNotificationToUser(vendorId, {
    title: 'Account Confirmed!',
    body: 'Congratulations! You have successfully completed your trial period and have been confirmed as an A2Z Service Provider.',
    data: { type: 'VENDOR_CONFIRMED' },
  }).catch(() => {})

  return { trial, user }
}

/**
 * Admin: REJECT VENDOR (Requirement 50)
 */
export async function rejectVendor(vendorId, adminUser, reason) {
  if (!reason || !reason.trim()) {
    throw new Error('Rejection reason is required')
  }

  const trial = await VendorTrial.findOne({ vendorId })
  const prevStatus = trial ? trial.status : VENDOR_TRIAL_STATUS.NOT_STARTED

  if (trial) {
    trial.status = VENDOR_TRIAL_STATUS.REJECTED
    trial.rejectedAt = new Date()
    trial.rejectedBy = adminUser._id
    trial.rejectionReason = reason.trim()
    await trial.save()
  }

  const user = await User.findByIdAndUpdate(
    vendorId,
    { vendorStatus: VENDOR_TRIAL_STATUS.REJECTED },
    { new: true }
  )

  await TrialAuditLog.create({
    vendorId,
    trialId: trial?._id,
    action: TRIAL_AUDIT_ACTIONS.VENDOR_REJECTED,
    previousStatus: prevStatus,
    newStatus: VENDOR_TRIAL_STATUS.REJECTED,
    performedBy: adminUser._id,
    actorRole: 'ADMIN',
    reason: reason.trim(),
  })

  sendNotificationToUser(vendorId, {
    title: 'Application Update',
    body: 'Your application has not been approved for final joining. Please contact A2Z support for more information.',
    data: { type: 'VENDOR_REJECTED' },
  }).catch(() => {})

  return { trial, user }
}

/**
 * Admin: BLOCK VENDOR (Requirement 51)
 */
export async function blockVendor(vendorId, adminUser, reason) {
  if (!reason || !reason.trim()) {
    throw new Error('Block reason is required')
  }

  const trial = await VendorTrial.findOne({ vendorId })
  const prevStatus = trial ? trial.status : VENDOR_TRIAL_STATUS.NOT_STARTED

  if (trial) {
    trial.status = VENDOR_TRIAL_STATUS.BLOCKED
    trial.blockedAt = new Date()
    trial.blockedBy = adminUser._id
    trial.blockReason = reason.trim()
    await trial.save()
  }

  const user = await User.findByIdAndUpdate(
    vendorId,
    { vendorStatus: VENDOR_TRIAL_STATUS.BLOCKED, isActive: false },
    { new: true }
  )

  await TrialAuditLog.create({
    vendorId,
    trialId: trial?._id,
    action: TRIAL_AUDIT_ACTIONS.VENDOR_BLOCKED,
    previousStatus: prevStatus,
    newStatus: VENDOR_TRIAL_STATUS.BLOCKED,
    performedBy: adminUser._id,
    actorRole: 'ADMIN',
    reason: reason.trim(),
  })

  sendNotificationToUser(vendorId, {
    title: 'Account Blocked',
    body: 'Your A2Z Service Provider account has been blocked. Please contact A2Z support for further information.',
    data: { type: 'VENDOR_BLOCKED' },
  }).catch(() => {})

  return { trial, user }
}

/**
 * Admin: UNBLOCK VENDOR
 */
export async function unblockVendor(vendorId, adminUser, reason = '') {
  const trial = await VendorTrial.findOne({ vendorId })
  const prevStatus = trial ? trial.status : VENDOR_TRIAL_STATUS.BLOCKED

  let nextStatus = VENDOR_TRIAL_STATUS.TRIAL_ACTIVE
  if (trial) {
    if (trial.completedTrialCount >= (trial.configuredTrialCount + trial.adminGrantedAdditionalTrials)) {
      nextStatus = VENDOR_TRIAL_STATUS.PENDING_ADMIN_CONFIRMATION
    }
    trial.status = nextStatus
    trial.blockedAt = null
    trial.blockedBy = null
    trial.blockReason = null
    await trial.save()
  }

  const user = await User.findByIdAndUpdate(
    vendorId,
    { vendorStatus: nextStatus, isActive: true },
    { new: true }
  )

  await TrialAuditLog.create({
    vendorId,
    trialId: trial?._id,
    action: TRIAL_AUDIT_ACTIONS.VENDOR_UNBLOCKED,
    previousStatus: prevStatus,
    newStatus: nextStatus,
    performedBy: adminUser._id,
    actorRole: 'ADMIN',
    reason: reason.trim() || 'Vendor unblocked by administrator',
  })

  return { trial, user }
}

/**
 * Admin: REQUEST ADDITIONAL REVIEW (Requirement 52)
 */
export async function requestAdditionalReview(vendorId, adminUser, reviewReason) {
  if (!reviewReason || !reviewReason.trim()) {
    throw new Error('Review reason is required')
  }

  const trial = await VendorTrial.findOne({ vendorId })
  if (!trial) {
    throw new Error('Trial record not found')
  }

  const prevStatus = trial.status
  trial.status = VENDOR_TRIAL_STATUS.ADMIN_REVIEW_REQUIRED
  trial.reviewRequestedAt = new Date()
  trial.reviewRequestedBy = adminUser._id
  trial.reviewReason = reviewReason.trim()
  await trial.save()

  await User.findByIdAndUpdate(vendorId, { vendorStatus: VENDOR_TRIAL_STATUS.ADMIN_REVIEW_REQUIRED })

  await TrialAuditLog.create({
    vendorId,
    trialId: trial._id,
    action: TRIAL_AUDIT_ACTIONS.ADMIN_REVIEW_REQUESTED,
    previousStatus: prevStatus,
    newStatus: VENDOR_TRIAL_STATUS.ADMIN_REVIEW_REQUIRED,
    performedBy: adminUser._id,
    actorRole: 'ADMIN',
    reason: reviewReason.trim(),
  })

  return trial
}

/**
 * Admin: GRANT ADDITIONAL TRIAL (Requirement 53)
 */
export async function grantAdditionalTrial(vendorId, adminUser, { additionalCount = 1, reason = '' }) {
  const count = Math.max(1, Number(additionalCount) || 1)

  const trial = await VendorTrial.findOne({ vendorId })
  if (!trial) {
    throw new Error('Trial record not found')
  }

  const prevStatus = trial.status
  trial.adminGrantedAdditionalTrials = (trial.adminGrantedAdditionalTrials || 0) + count
  trial.status = VENDOR_TRIAL_STATUS.TRIAL_ACTIVE
  trial.eligibleForConfirmation = false
  await trial.save()

  await User.findByIdAndUpdate(vendorId, { vendorStatus: VENDOR_TRIAL_STATUS.TRIAL_ACTIVE })

  await TrialAuditLog.create({
    vendorId,
    trialId: trial._id,
    action: TRIAL_AUDIT_ACTIONS.TRIAL_EXTENDED,
    previousStatus: prevStatus,
    newStatus: VENDOR_TRIAL_STATUS.TRIAL_ACTIVE,
    performedBy: adminUser._id,
    actorRole: 'ADMIN',
    reason: reason.trim() || `Granted ${count} additional trial services`,
    metadata: {
      additionalTrialsGranted: count,
      newTotalAllowed: trial.configuredTrialCount + trial.adminGrantedAdditionalTrials,
    },
  })

  sendNotificationToUser(vendorId, {
    title: 'Additional Trial Opportunity',
    body: `Admin has granted you ${count} additional trial service opportunity.`,
    data: { type: 'TRIAL_EXTENDED' },
  }).catch(() => {})

  return trial
}

/**
 * Admin: WAIVE PENALTY AND ACTIVATE FINAL CHANCE (Requirement 23)
 */
export async function waivePenaltyAndActivateFinalChance(vendorId, adminUser, reason = '') {
  const trial = await VendorTrial.findOne({ vendorId })
  if (!trial) {
    throw new Error('Trial record not found')
  }

  let fcRequest = await FinalChanceRequest.findOne({
    vendorId,
    trialId: trial._id,
    status: { $in: [FINAL_CHANCE_STATUS.PENDING, FINAL_CHANCE_STATUS.PAYMENT_PENDING, FINAL_CHANCE_STATUS.PAYMENT_FAILED] },
  })

  if (!fcRequest) {
    fcRequest = await FinalChanceRequest.create({
      vendorId,
      trialId: trial._id,
      penaltyAmount: trial.finalChancePenaltyAmount || 500,
      status: FINAL_CHANCE_STATUS.WAIVED,
      requestedAt: new Date(),
      waivedAt: new Date(),
      waivedBy: adminUser._id,
      waiveReason: reason.trim() || 'Penalty waived by admin policy',
      activatedAt: new Date(),
    })
  } else {
    fcRequest.status = FINAL_CHANCE_STATUS.WAIVED
    fcRequest.waivedAt = new Date()
    fcRequest.waivedBy = adminUser._id
    fcRequest.waiveReason = reason.trim() || 'Penalty waived by admin policy'
    fcRequest.activatedAt = new Date()
    await fcRequest.save()
  }

  const prevStatus = trial.status
  trial.finalChancePenaltyPaid = true
  trial.status = VENDOR_TRIAL_STATUS.FINAL_CHANCE_ACTIVE
  await trial.save()

  await User.findByIdAndUpdate(vendorId, {
    vendorStatus: VENDOR_TRIAL_STATUS.FINAL_CHANCE_ACTIVE,
    isActive: true,
  })

  await TrialAuditLog.create({
    vendorId,
    trialId: trial._id,
    action: TRIAL_AUDIT_ACTIONS.PENALTY_WAIVED,
    previousStatus: prevStatus,
    newStatus: VENDOR_TRIAL_STATUS.FINAL_CHANCE_ACTIVE,
    performedBy: adminUser._id,
    actorRole: 'ADMIN',
    reason: reason.trim() || 'Penalty waived by admin',
    metadata: { finalChanceRequestId: fcRequest._id },
  })

  sendNotificationToUser(vendorId, {
    title: 'Final Chance Activated',
    body: 'Your final trial opportunity penalty has been waived and activated by admin.',
    data: { type: 'FINAL_CHANCE_ACTIVATED' },
  }).catch(() => {})

  return { trial, finalChanceRequest: fcRequest }
}

/**
 * Admin: PAUSE TRIAL (Requirement 24)
 */
export async function pauseTrial(vendorId, adminUser, reason = '') {
  const trial = await VendorTrial.findOne({ vendorId })
  if (!trial) {
    throw new Error('Trial record not found')
  }

  const prevStatus = trial.status
  trial.status = VENDOR_TRIAL_STATUS.TRIAL_PAUSED
  trial.pausedAt = new Date()
  trial.pausedBy = adminUser._id
  trial.pauseReason = reason.trim() || 'Paused by admin'
  await trial.save()

  await User.findByIdAndUpdate(vendorId, { vendorStatus: VENDOR_TRIAL_STATUS.TRIAL_PAUSED })

  await TrialAuditLog.create({
    vendorId,
    trialId: trial._id,
    action: TRIAL_AUDIT_ACTIONS.TRIAL_PAUSED,
    previousStatus: prevStatus,
    newStatus: VENDOR_TRIAL_STATUS.TRIAL_PAUSED,
    performedBy: adminUser._id,
    actorRole: 'ADMIN',
    reason: reason.trim() || 'Trial paused by admin',
  })

  return trial
}

/**
 * Admin: RESUME TRIAL (Requirement 24)
 */
export async function resumeTrial(vendorId, adminUser) {
  const trial = await VendorTrial.findOne({ vendorId })
  if (!trial) {
    throw new Error('Trial record not found')
  }

  const prevStatus = trial.status
  trial.status = VENDOR_TRIAL_STATUS.TRIAL_ACTIVE
  trial.resumedAt = new Date()
  trial.resumedBy = adminUser._id
  await trial.save()

  await User.findByIdAndUpdate(vendorId, { vendorStatus: VENDOR_TRIAL_STATUS.TRIAL_ACTIVE })

  await TrialAuditLog.create({
    vendorId,
    trialId: trial._id,
    action: TRIAL_AUDIT_ACTIONS.TRIAL_RESUMED,
    previousStatus: prevStatus,
    newStatus: VENDOR_TRIAL_STATUS.TRIAL_ACTIVE,
    performedBy: adminUser._id,
    actorRole: 'ADMIN',
    reason: 'Trial resumed by admin',
  })

  return trial
}

/**
 * Get comprehensive trial overview for a specific vendor
 */
export async function getVendorTrialOverview(vendorId) {
  const user = await User.findById(vendorId)
    .select('-passwordHash')
    .populate('labourProfile.categoryIds', 'name')
    .populate('labourProfile.serviceIds', 'name')
    .lean()

  if (!user) {
    throw new Error('Vendor not found')
  }

  let trial = await VendorTrial.findOne({ vendorId }).lean()
  if (!trial) {
    const config = await getTrialConfig()
    trial = {
      vendorId,
      status: user.vendorStatus || VENDOR_TRIAL_STATUS.NOT_STARTED,
      configuredTrialCount: config.freeTrialCount,
      completedTrialCount: 0,
      passedTrialCount: 0,
      failedTrialCount: 0,
      passingRatingThreshold: config.passingRatingThreshold,
      warningRatingThreshold: config.warningRatingThreshold,
      finalChancePenaltyAmount: config.finalChancePenaltyAmount,
      finalChanceEnabled: config.finalChanceEnabled,
      eligibleForConfirmation: false,
    }
  }

  const [evaluations, warnings, finalChanceRequests, auditLogs] = await Promise.all([
    TrialEvaluation.find({ vendorId })
      .populate('reviewerId', 'fullName phone profileImageUrl')
      .populate('bookingId', 'scheduledAt totalAmount address status')
      .populate('serviceId', 'name')
      .sort({ evaluatedAt: -1 })
      .lean(),
    VendorWarning.find({ vendorId }).sort({ issuedAt: -1 }).lean(),
    FinalChanceRequest.find({ vendorId }).sort({ requestedAt: -1 }).lean(),
    TrialAuditLog.find({ vendorId })
      .populate('performedBy', 'fullName email role')
      .sort({ timestamp: -1 })
      .limit(50)
      .lean(),
  ])

  // Calculate rating stats
  const ratings = evaluations.map((e) => e.rating)
  const averageRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : null
  const lowestRating = ratings.length > 0 ? Math.min(...ratings) : null
  const highestRating = ratings.length > 0 ? Math.max(...ratings) : null

  return {
    vendor: user,
    trial,
    stats: {
      configuredTrialCount: trial.configuredTrialCount || 5,
      adminGrantedAdditionalTrials: trial.adminGrantedAdditionalTrials || 0,
      totalAllowed: (trial.configuredTrialCount || 5) + (trial.adminGrantedAdditionalTrials || 0),
      completedTrialCount: trial.completedTrialCount || 0,
      passedTrialCount: trial.passedTrialCount || 0,
      failedTrialCount: trial.failedTrialCount || 0,
      averageRating,
      lowestRating,
      highestRating,
      warningCount: warnings.length,
      finalChanceUsed: Boolean(trial.finalChanceUsed),
      finalChancePenaltyPaid: Boolean(trial.finalChancePenaltyPaid),
      eligibleForConfirmation: Boolean(trial.eligibleForConfirmation),
    },
    evaluations,
    warnings,
    finalChanceRequests,
    auditLogs,
  }
}

/**
 * Get aggregated statistics for Admin Trial Dashboard (Requirement 32)
 */
export async function getAdminTrialStats() {
  const [
    totalTrialVendors,
    activeTrials,
    trialCompleted,
    pendingConfirmation,
    reviewRequired,
    warnings,
    finalFailures,
    finalChanceRequests,
    pendingPenaltyPayments,
    finalChanceActive,
    confirmedVendors,
    blockedVendors,
  ] = await Promise.all([
    VendorTrial.countDocuments({}),
    VendorTrial.countDocuments({ status: VENDOR_TRIAL_STATUS.TRIAL_ACTIVE }),
    VendorTrial.countDocuments({ status: VENDOR_TRIAL_STATUS.TRIAL_COMPLETED }),
    VendorTrial.countDocuments({ status: VENDOR_TRIAL_STATUS.PENDING_ADMIN_CONFIRMATION }),
    VendorTrial.countDocuments({ status: VENDOR_TRIAL_STATUS.ADMIN_REVIEW_REQUIRED }),
    VendorTrial.countDocuments({ status: VENDOR_TRIAL_STATUS.WARNING }),
    VendorTrial.countDocuments({ status: VENDOR_TRIAL_STATUS.FINAL_FAILURE }),
    FinalChanceRequest.countDocuments({}),
    VendorTrial.countDocuments({ status: VENDOR_TRIAL_STATUS.FINAL_CHANCE_PAYMENT_PENDING }),
    VendorTrial.countDocuments({ status: VENDOR_TRIAL_STATUS.FINAL_CHANCE_ACTIVE }),
    User.countDocuments({ vendorStatus: VENDOR_TRIAL_STATUS.CONFIRMED }),
    User.countDocuments({ vendorStatus: VENDOR_TRIAL_STATUS.BLOCKED }),
  ])

  return {
    totalTrialVendors,
    activeTrials,
    trialCompleted,
    pendingConfirmation,
    reviewRequired,
    warnings,
    finalFailures,
    finalChanceRequests,
    pendingPenaltyPayments,
    finalChanceActive,
    confirmedVendors,
    blockedVendors,
  }
}

/**
 * Migration helper for existing vendors (Requirement 41)
 */
export async function migrateExistingVendors(adminUser) {
  // Existing verified vendors who don't have a trial should be set to CONFIRMED
  const verifiedVendorsWithoutTrial = await User.find({
    role: { $in: ['labour', 'contractor'] },
    'labourProfile.kycStatus': 'verified',
    vendorStatus: { $in: ['NOT_STARTED', null] },
  })

  let migratedCount = 0
  for (const v of verifiedVendorsWithoutTrial) {
    v.vendorStatus = VENDOR_TRIAL_STATUS.CONFIRMED
    await v.save()

    let trial = await VendorTrial.findOne({ vendorId: v._id })
    if (!trial) {
      await VendorTrial.create({
        vendorId: v._id,
        status: VENDOR_TRIAL_STATUS.CONFIRMED,
        configuredTrialCount: 5,
        completedTrialCount: 5,
        passedTrialCount: 5,
        failedTrialCount: 0,
        eligibleForConfirmation: true,
        confirmedAt: new Date(),
        confirmedBy: adminUser?._id,
        confirmationNotes: 'Grandfathered existing verified vendor',
      })
    }

    await TrialAuditLog.create({
      vendorId: v._id,
      action: TRIAL_AUDIT_ACTIONS.VENDOR_CONFIRMED,
      previousStatus: 'NOT_STARTED',
      newStatus: 'CONFIRMED',
      performedBy: adminUser?._id,
      actorRole: 'ADMIN',
      reason: 'Grandfathered during system trial migration',
    })

    migratedCount++
  }

  return { migratedCount }
}
