import mongoose from 'mongoose'
import { ProviderPayment, PAYMENT_STATUS, PAYMENT_PURPOSE } from '../models/ProviderPayment.js'
import { AdminPaymentConfig } from '../models/AdminPaymentConfig.js'
import { Wallet } from '../models/Wallet.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
import { AdminWallet } from '../models/AdminWallet.js'
import { Booking } from '../models/Booking.js'
import { SubscriptionPlan } from '../models/SubscriptionPlan.js'
import { InAppNotification, NOTIFICATION_TYPES } from '../models/InAppNotification.js'
import { rechargeLabourWallet, getOrCreateLabourWallet } from '../services/labourWalletService.js'
import { uploadBufferToCloudinary, deleteCloudinaryAsset } from '../services/cloudinaryService.js'
import { UPLOAD_FOLDERS } from '../constants/uploadFolders.js'
import { emitToUser, getIo } from '../socket.js'
import { sendNotificationToUser } from '../utils/pushNotificationHelper.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'

const ALLOWED_RECEIPT_MIMES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
])
const MAX_RECEIPT_SIZE = 10 * 1024 * 1024 // 10MB

/**
 * POST /api/v1/provider-payments
 * Initiates a new provider payment record under current active QR configuration.
 */
export const createPayment = asyncHandler(async (req, res) => {
  const { purpose = PAYMENT_PURPOSE.WALLET_TOPUP, amount, metadata = {} } = req.body
  const providerId = req.user._id

  if (!Object.values(PAYMENT_PURPOSE).includes(purpose)) {
    return sendError(res, {
      message: `Invalid payment purpose. Allowed: ${Object.values(PAYMENT_PURPOSE).join(', ')}`,
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_PURPOSE',
    })
  }

  // Authoritative amount validation
  let validatedAmount = Number(amount)
  if (isNaN(validatedAmount) || validatedAmount <= 0) {
    return sendError(res, {
      message: 'Payment amount must be a positive number of at least ₹1',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_AMOUNT',
    })
  }

  if (purpose === PAYMENT_PURPOSE.WALLET_CLEARANCE) {
    const wallet = await Wallet.findOne({ userId: providerId })
    const pendingDues = Math.max(0, Number(wallet?.adminBalance || 0))
    if (pendingDues <= 0) {
      return sendError(res, {
        message: 'You have no outstanding admin balance / commission dues to clear.',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'NO_DUES_TO_CLEAR',
      })
    }
    // Cannot pay more than outstanding dues
    if (validatedAmount > pendingDues) {
      validatedAmount = pendingDues
    }
  } else if (purpose === PAYMENT_PURPOSE.SUBSCRIPTION) {
    if (!metadata.planId) {
      return sendError(res, {
        message: 'planId is required for SUBSCRIPTION payment',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'MISSING_PLAN_ID',
      })
    }
    const plan = await SubscriptionPlan.findById(metadata.planId)
    if (!plan) {
      return sendError(res, {
        message: 'Subscription plan not found',
        statusCode: HTTP_STATUS.NOT_FOUND,
        code: 'PLAN_NOT_FOUND',
      })
    }
    // Authoritative plan price from DB
    validatedAmount = Number(plan.price || validatedAmount)
  }

  // Fetch currently active QR configuration
  const activeConfig = await AdminPaymentConfig.getActiveConfig(purpose)
  if (!activeConfig || !activeConfig.isActive) {
    return sendError(res, {
      message: 'UPI QR payments are currently unavailable or disabled by administration. Please contact support.',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'QR_PAYMENT_DISABLED',
    })
  }

  const payment = new ProviderPayment({
    providerId,
    purpose,
    amount: validatedAmount,
    currency: 'INR',
    status: PAYMENT_STATUS.PENDING,
    qrConfigId: activeConfig._id,
    qrConfigVersion: activeConfig.version,
    qrSnapshot: {
      displayName: activeConfig.displayName,
      upiId: activeConfig.upiId || '',
      qrImageUrl: activeConfig.qrImageUrl,
    },
    metadata,
    auditTrail: [
      {
        toStatus: PAYMENT_STATUS.PENDING,
        actor: providerId,
        role: req.user.role,
        note: `Payment initiated for ${purpose} - ₹${validatedAmount}`,
        timestamp: new Date(),
      },
    ],
  })

  await payment.save()

  return sendSuccess(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: 'Payment record initiated successfully.',
    data: {
      payment,
      qrConfig: {
        displayName: activeConfig.displayName,
        upiId: activeConfig.upiId || '',
        qrImageUrl: activeConfig.qrImageUrl,
        instructions: activeConfig.instructions,
        version: activeConfig.version,
      },
    },
  })
})

/**
 * POST /api/v1/provider-payments/:id/submit
 * Submits the payment UTR / RRN and optional receipt proof for review.
 */
export const submitPayment = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { utr, notes } = req.body
  const providerId = req.user._id

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendError(res, {
      message: 'Invalid payment ID format',
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
  }

  const payment = await ProviderPayment.findById(id)
  if (!payment) {
    return sendError(res, {
      message: 'Payment record not found',
      statusCode: HTTP_STATUS.NOT_FOUND,
    })
  }

  // Verify ownership
  if (payment.providerId.toString() !== providerId.toString()) {
    return sendError(res, {
      message: 'You are not authorized to submit details for this payment',
      statusCode: HTTP_STATUS.FORBIDDEN,
      code: 'FORBIDDEN',
    })
  }

  // State check: Only 'pending' or 'rejected' (resubmission) can be submitted
  if (![PAYMENT_STATUS.PENDING, PAYMENT_STATUS.REJECTED].includes(payment.status)) {
    return sendError(res, {
      message: `Cannot submit payment details in "${payment.status}" status`,
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_STATUS',
    })
  }

  // Validate UTR
  const cleanUtr = String(utr || '').trim().toUpperCase()
  if (!cleanUtr || cleanUtr.length < 6 || cleanUtr.length > 35) {
    return sendError(res, {
      message: 'A valid UTR / Transaction Reference Number (6 to 35 characters) is required',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_UTR',
    })
  }

  // Duplicate UTR check across all active, submitted, or approved payments
  const existingWithUtr = await ProviderPayment.findOne({
    _id: { $ne: payment._id },
    utr: cleanUtr,
    status: { $in: [PAYMENT_STATUS.SUBMITTED, PAYMENT_STATUS.UNDER_REVIEW, PAYMENT_STATUS.APPROVED] },
  })

  if (existingWithUtr) {
    return sendError(res, {
      message: 'This UTR / Transaction Reference Number has already been submitted for another payment.',
      statusCode: HTTP_STATUS.CONFLICT,
      code: 'DUPLICATE_UTR',
    })
  }

  let receiptUrl = req.body.receiptUrl || payment.receiptUrl || ''
  let receiptStorageIdentifier = req.body.receiptStorageIdentifier || payment.receiptStorageIdentifier || ''
  let uploadedReceiptAsset = null

  // Handle uploaded receipt file if provided
  if (req.file) {
    if (!ALLOWED_RECEIPT_MIMES.has(req.file.mimetype)) {
      return sendError(res, {
        message: 'Invalid receipt file type. Supported formats are JPG, PNG, WebP, and PDF.',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'INVALID_FILE_TYPE',
      })
    }

    if (req.file.size > MAX_RECEIPT_SIZE) {
      return sendError(res, {
        message: 'Receipt file must be under 10MB',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'FILE_TOO_LARGE',
      })
    }

    try {
      uploadedReceiptAsset = await uploadBufferToCloudinary({
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        folder: UPLOAD_FOLDERS.PAYMENT_RECEIPTS || 'payment-receipts',
        userId: providerId,
        originalName: req.file.originalname || `receipt-${payment._id}`,
        resourceType: req.file.mimetype === 'application/pdf' ? 'raw' : 'image',
      })
      receiptUrl = uploadedReceiptAsset.url
      receiptStorageIdentifier = uploadedReceiptAsset.publicId
    } catch (uploadErr) {
      return sendError(res, {
        message: `Receipt upload failed: ${uploadErr.message}`,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'UPLOAD_FAILED',
      })
    }
  }

  try {
    const previousStatus = payment.status
    payment.utr = cleanUtr
    payment.receiptUrl = receiptUrl
    payment.receiptStorageIdentifier = receiptStorageIdentifier
    payment.status = PAYMENT_STATUS.SUBMITTED
    if (notes) payment.notes = String(notes).trim()
    payment.rejectionReason = '' // Clear previous rejection reason on resubmission

    payment.auditTrail.push({
      fromStatus: previousStatus,
      toStatus: PAYMENT_STATUS.SUBMITTED,
      actor: providerId,
      role: req.user.role,
      note: `Submitted UTR: ${cleanUtr} with receipt for review`,
      timestamp: new Date(),
    })

    await payment.save()

    // Real-time notification to admins
    try {
      const io = getIo()
      if (io) {
        io.emit('PROVIDER_PAYMENT_SUBMITTED', {
          paymentId: payment._id,
          providerId: payment.providerId,
          amount: payment.amount,
          purpose: payment.purpose,
          utr: payment.utr,
          status: payment.status,
          createdAt: payment.createdAt,
        })
      }
    } catch (socketErr) {
      console.warn('[Socket Warning] Could not emit PROVIDER_PAYMENT_SUBMITTED:', socketErr?.message)
    }

    return sendSuccess(res, {
      message: 'Payment details submitted successfully. Verification is pending with administration.',
      data: { payment },
    })
  } catch (dbErr) {
    if (uploadedReceiptAsset?.publicId) {
      await deleteCloudinaryAsset(uploadedReceiptAsset.publicId)
    }
    throw dbErr
  }
})

/**
 * GET /api/v1/provider-payments/my
 * Fetches authenticated provider's own payment submissions.
 */
export const getMyPayments = asyncHandler(async (req, res) => {
  const providerId = req.user._id
  const { status, purpose, page = 1, limit = 20 } = req.query

  const query = { providerId }
  if (status && status !== 'ALL') query.status = status
  if (purpose && purpose !== 'ALL') query.purpose = purpose

  const pageNum = Math.max(1, parseInt(page, 10) || 1)
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20))
  const skip = (pageNum - 1) * limitNum

  const [payments, total] = await Promise.all([
    ProviderPayment.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    ProviderPayment.countDocuments(query),
  ])

  return sendSuccess(res, {
    data: {
      payments,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    },
  })
})

/**
 * GET /api/v1/provider-payments/:id
 * Fetches details of a specific payment.
 */
export const getPaymentById = asyncHandler(async (req, res) => {
  const { id } = req.params
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendError(res, { message: 'Invalid payment ID', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const payment = await ProviderPayment.findById(id)
    .populate('providerId', 'fullName email phone avatar role')
    .populate('reviewedBy', 'fullName email')

  if (!payment) {
    return sendError(res, { message: 'Payment record not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  // Authorization: either the provider themselves or admin
  const isOwner = payment.providerId?._id?.toString() === req.user._id.toString()
  const isAdmin = req.user.role === 'admin'

  if (!isOwner && !isAdmin) {
    return sendError(res, {
      message: 'You are not authorized to view this payment',
      statusCode: HTTP_STATUS.FORBIDDEN,
    })
  }

  return sendSuccess(res, { data: { payment } })
})

/**
 * GET /api/v1/admin/provider-payments
 * Admin endpoint: List provider payments with rich filtering, search, and metrics.
 */
export const getAdminPayments = asyncHandler(async (req, res) => {
  const {
    status,
    purpose,
    search,
    startDate,
    endDate,
    page = 1,
    limit = 20,
  } = req.query

  const query = {}

  if (status && status !== 'ALL') query.status = status
  if (purpose && purpose !== 'ALL') query.purpose = purpose

  if (startDate || endDate) {
    query.createdAt = {}
    if (startDate) query.createdAt.$gte = new Date(startDate)
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      query.createdAt.$lte = end
    }
  }

  // Provider search by name, phone, or UTR
  if (search && String(search).trim()) {
    const s = String(search).trim()
    const matchingProviders = await mongoose.model('User').find({
      $or: [
        { fullName: { $regex: s, $options: 'i' } },
        { phone: { $regex: s, $options: 'i' } },
        { email: { $regex: s, $options: 'i' } },
      ],
    }).select('_id')

    const providerIds = matchingProviders.map((p) => p._id)

    query.$or = [
      { utr: { $regex: s, $options: 'i' } },
      { providerId: { $in: providerIds } },
    ]
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1)
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20))
  const skip = (pageNum - 1) * limitNum

  const [payments, total, counts] = await Promise.all([
    ProviderPayment.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate('providerId', 'fullName email phone avatar role')
      .populate('reviewedBy', 'fullName email')
      .lean(),
    ProviderPayment.countDocuments(query),
    ProviderPayment.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
    ]),
  ])

  // Process status counts
  const stats = {
    total: 0,
    pendingCount: 0,
    submittedCount: 0,
    underReviewCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    totalApprovedAmount: 0,
  }

  for (const item of counts) {
    stats.total += item.count
    if (item._id === PAYMENT_STATUS.PENDING) stats.pendingCount = item.count
    if (item._id === PAYMENT_STATUS.SUBMITTED) stats.submittedCount = item.count
    if (item._id === PAYMENT_STATUS.UNDER_REVIEW) stats.underReviewCount = item.count
    if (item._id === PAYMENT_STATUS.APPROVED) {
      stats.approvedCount = item.count
      stats.totalApprovedAmount = item.totalAmount
    }
    if (item._id === PAYMENT_STATUS.REJECTED) stats.rejectedCount = item.count
  }

  return sendSuccess(res, {
    data: {
      payments,
      stats,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
      },
    },
  })
})

/**
 * PATCH /api/v1/admin/provider-payments/:id/review
 * Admin review endpoint: Approves or rejects payment with atomic idempotency and financial execution.
 */
export const reviewPayment = asyncHandler(async (req, res) => {
  const { id } = req.params
  const {
    decision, // 'approve' | 'reject'
    rejectionReason,
    verifiedAmount,
    bankReference,
    notes,
  } = req.body
  const adminId = req.user._id

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return sendError(res, { message: 'Invalid payment ID', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  if (!['approve', 'reject'].includes(decision)) {
    return sendError(res, {
      message: 'Decision must be either "approve" or "reject"',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_DECISION',
    })
  }

  if (decision === 'reject' && (!rejectionReason || !String(rejectionReason).trim())) {
    return sendError(res, {
      message: 'A rejection reason is required when rejecting a payment submission',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'MISSING_REJECTION_REASON',
    })
  }

  const existing = await ProviderPayment.findById(id)
  if (!existing) {
    return sendError(res, { message: 'Payment record not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  if (existing.status === PAYMENT_STATUS.APPROVED || existing.financialActionExecuted) {
    return sendError(res, {
      message: 'This payment has already been verified, approved, and processed.',
      statusCode: HTTP_STATUS.CONFLICT,
      code: 'ALREADY_APPROVED',
    })
  }

  if (decision === 'approve') {
    const finalAmount = Number(verifiedAmount !== undefined ? verifiedAmount : existing.amount)
    if (isNaN(finalAmount) || finalAmount <= 0) {
      return sendError(res, {
        message: 'Verified amount must be a positive number',
        statusCode: HTTP_STATUS.BAD_REQUEST,
      })
    }

    // Atomic state transition ensuring concurrent approval cannot run twice
    const updatedPayment = await ProviderPayment.findOneAndUpdate(
      {
        _id: id,
        status: { $in: [PAYMENT_STATUS.SUBMITTED, PAYMENT_STATUS.UNDER_REVIEW, PAYMENT_STATUS.PENDING] },
        financialActionExecuted: { $ne: true },
      },
      {
        $set: {
          status: PAYMENT_STATUS.APPROVED,
          reviewedBy: adminId,
          reviewedAt: new Date(),
          rejectionReason: '',
          paymentVerificationDetails: {
            verifiedAmount: finalAmount,
            bankReference: bankReference ? String(bankReference).trim() : '',
            notes: notes ? String(notes).trim() : '',
            verifiedAt: new Date(),
          },
        },
        $push: {
          auditTrail: {
            fromStatus: existing.status,
            toStatus: PAYMENT_STATUS.APPROVED,
            actor: adminId,
            role: req.user.role,
            note: `Approved by admin. Verified Amount: ₹${finalAmount}${bankReference ? ` (Bank Ref: ${bankReference})` : ''}`,
            timestamp: new Date(),
          },
        },
      },
      { new: true }
    )

    if (!updatedPayment) {
      return sendError(res, {
        message: 'Payment could not be approved. It may have already been approved or modified by another administrator.',
        statusCode: HTTP_STATUS.CONFLICT,
        code: 'CONCURRENCY_ERROR',
      })
    }

    // Execute corresponding financial action
    try {
      if (updatedPayment.purpose === PAYMENT_PURPOSE.WALLET_TOPUP) {
        const credResult = await rechargeLabourWallet({
          labourId: updatedPayment.providerId,
          amount: finalAmount,
          transactionId: updatedPayment.utr ? `UPI_${updatedPayment.utr}` : `QR_${updatedPayment._id}`,
          paymentMethod: 'UPI_QR',
          description: `Wallet top-up via verified Admin UPI QR (Ref: ${updatedPayment.utr || updatedPayment._id})`,
        })

        updatedPayment.financialActionExecuted = true
        updatedPayment.financialActionDetails = {
          action: 'WALLET_TOPUP',
          transactionId: credResult.transaction?._id?.toString(),
          balanceBefore: credResult.balanceBefore,
          balanceAfter: credResult.balanceAfter,
          executedAt: new Date(),
        }
        await updatedPayment.save()
      } else if (updatedPayment.purpose === PAYMENT_PURPOSE.WALLET_CLEARANCE) {
        const wallet = await getOrCreateLabourWallet(updatedPayment.providerId)
        const balanceBefore = Number(wallet.adminBalance || 0)
        wallet.adminBalance = Math.max(0, balanceBefore - finalAmount)
        await wallet.save()

        const clearanceTx = await WalletTransaction.create({
          walletId: wallet._id,
          userId: updatedPayment.providerId,
          labourId: updatedPayment.providerId,
          amount: finalAmount,
          type: 'DEBIT',
          targetWallet: 'ADMIN',
          context: 'CLEARANCE',
          referenceType: 'PAYMENT',
          referenceId: updatedPayment._id,
          description: `Admin balance cleared via verified Admin UPI QR (Ref: ${updatedPayment.utr || updatedPayment._id})`,
          status: 'COMPLETED',
        })

        // Increase AdminWallet commissions collected
        let adminWallet = await AdminWallet.findOne()
        if (!adminWallet) adminWallet = new AdminWallet()
        adminWallet.totalCommissionsCollected = (adminWallet.totalCommissionsCollected || 0) + finalAmount
        await adminWallet.save()

        // Settle pending cash bookings for this labourer if dues cleared
        await Booking.updateMany(
          { laborId: updatedPayment.providerId, paymentMethod: 'CASH', adminSettlementStatus: 'PENDING' },
          { $set: { adminSettlementStatus: 'SETTLED' } }
        )

        updatedPayment.financialActionExecuted = true
        updatedPayment.financialActionDetails = {
          action: 'WALLET_CLEARANCE',
          transactionId: clearanceTx._id?.toString(),
          balanceBefore,
          balanceAfter: wallet.adminBalance,
          executedAt: new Date(),
        }
        await updatedPayment.save()
      } else if (updatedPayment.purpose === PAYMENT_PURPOSE.SUBSCRIPTION && updatedPayment.metadata?.planId) {
        const { VendorSubscription } = await import('../models/VendorSubscription.js')
        const plan = await SubscriptionPlan.findById(updatedPayment.metadata.planId)
        if (plan) {
          const durationLower = plan.duration?.toLowerCase() || ''
          let days = 30
          if (durationLower.includes('year')) days = 365
          else if (durationLower.includes('quarter')) days = 90

          await VendorSubscription.create({
            vendor: updatedPayment.providerId,
            plan: plan._id,
            status: 'active',
            startDate: new Date(),
            endDate: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
          })
        }
        updatedPayment.financialActionExecuted = true
        updatedPayment.financialActionDetails = {
          action: 'SUBSCRIPTION_ACTIVATED',
          planId: updatedPayment.metadata.planId,
          executedAt: new Date(),
        }
        await updatedPayment.save()
      } else if (updatedPayment.purpose === PAYMENT_PURPOSE.TRIAL_PENALTY) {
        const { verifyAndActivateFinalChance } = await import('../services/trialEvaluationService.js')
        await verifyAndActivateFinalChance({
          vendorId: updatedPayment.providerId,
          finalChanceRequestId: updatedPayment.metadata?.finalChanceRequestId,
        })
        updatedPayment.financialActionExecuted = true
        updatedPayment.financialActionDetails = {
          action: 'FINAL_CHANCE_ACTIVATED',
          executedAt: new Date(),
        }
        await updatedPayment.save()
      }
    } catch (finErr) {
      console.error('[Financial Action Error]:', finErr)
      // Rollback status to 'under_review' with failure note
      updatedPayment.status = PAYMENT_STATUS.UNDER_REVIEW
      updatedPayment.financialActionExecuted = false
      updatedPayment.rejectionReason = `Financial update error: ${finErr.message}`
      await updatedPayment.save()

      return sendError(res, {
        message: `Payment approval succeeded but wallet/financial action failed: ${finErr.message}`,
        statusCode: HTTP_STATUS.SERVER_ERROR,
        code: 'FINANCIAL_ACTION_FAILED',
      })
    }

    // Create In-App Notification
    try {
      await InAppNotification.create({
        userId: updatedPayment.providerId,
        title: 'UPI Payment Verified & Approved',
        body: `Your payment of ₹${finalAmount} (${updatedPayment.purpose}) has been verified and processed successfully.`,
        type: NOTIFICATION_TYPES.WALLET_CREDIT || 'WALLET_CREDIT',
        metadata: { paymentId: updatedPayment._id, amount: finalAmount, purpose: updatedPayment.purpose },
      })
    } catch (notifErr) {
      console.warn('[Notification Warning]:', notifErr?.message)
    }

    // Socket.io emission
    try {
      emitToUser(updatedPayment.providerId, 'PAYMENT_STATUS_UPDATE', {
        paymentId: updatedPayment._id,
        status: PAYMENT_STATUS.APPROVED,
        amount: finalAmount,
        purpose: updatedPayment.purpose,
        message: 'Your payment has been verified and approved!',
      })
    } catch (socketErr) {
      console.warn('[Socket Warning]:', socketErr?.message)
    }

    // Push notification
    try {
      sendNotificationToUser(
        updatedPayment.providerId,
        'Payment Approved',
        `Your UPI payment of ₹${finalAmount} has been verified and processed.`
      ).catch(() => {})
    } catch {
      // safe fallback
    }

    return sendSuccess(res, {
      message: 'Payment has been successfully verified, approved, and processed.',
      data: { payment: updatedPayment },
    })
  }

  // Reject decision
  const updatedPayment = await ProviderPayment.findOneAndUpdate(
    {
      _id: id,
      status: { $in: [PAYMENT_STATUS.SUBMITTED, PAYMENT_STATUS.UNDER_REVIEW, PAYMENT_STATUS.PENDING] },
      financialActionExecuted: { $ne: true },
    },
    {
      $set: {
        status: PAYMENT_STATUS.REJECTED,
        rejectionReason: String(rejectionReason).trim(),
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
      $push: {
        auditTrail: {
          fromStatus: existing.status,
          toStatus: PAYMENT_STATUS.REJECTED,
          actor: adminId,
          role: req.user.role,
          note: `Rejected by admin: ${String(rejectionReason).trim()}`,
          timestamp: new Date(),
        },
      },
    },
    { new: true }
  )

  if (!updatedPayment) {
    return sendError(res, {
      message: 'Payment status could not be updated to rejected.',
      statusCode: HTTP_STATUS.CONFLICT,
    })
  }

  // In-App Notification
  try {
    await InAppNotification.create({
      userId: updatedPayment.providerId,
      title: 'Payment Verification Update',
      body: `Your payment of ₹${updatedPayment.amount} could not be verified. Reason: ${String(rejectionReason).trim()}`,
      type: NOTIFICATION_TYPES.SYSTEM || 'SYSTEM',
      metadata: { paymentId: updatedPayment._id, rejectionReason: String(rejectionReason).trim() },
    })
  } catch (notifErr) {
    console.warn('[Notification Warning]:', notifErr?.message)
  }

  // Socket.io emission
  try {
    emitToUser(updatedPayment.providerId, 'PAYMENT_STATUS_UPDATE', {
      paymentId: updatedPayment._id,
      status: PAYMENT_STATUS.REJECTED,
      amount: updatedPayment.amount,
      purpose: updatedPayment.purpose,
      rejectionReason: String(rejectionReason).trim(),
      message: `Payment rejected: ${String(rejectionReason).trim()}`,
    })
  } catch (socketErr) {
    console.warn('[Socket Warning]:', socketErr?.message)
  }

  return sendSuccess(res, {
    message: 'Payment has been rejected.',
    data: { payment: updatedPayment },
  })
})
