import mongoose from 'mongoose'
import { WalletRechargeRequest, RECHARGE_STATUS, ACCOUNT_TYPES } from '../models/WalletRechargeRequest.js'
import { Wallet } from '../models/Wallet.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
import { User } from '../models/User.js'
import { InAppNotification, NOTIFICATION_TYPES } from '../models/InAppNotification.js'
import { getOrCreateUserWallet } from './userWalletService.js'
import { getOrCreateLabourWallet } from './labourWalletService.js'
import { sendNotificationToUser } from '../utils/pushNotificationHelper.js'
import { emitToUser, getIo } from '../socket.js'

/**
 * Helper to safely send notifications without failing the financial transaction
 */
async function sendSafeNotification({ userId, title, body, data = {}, type = NOTIFICATION_TYPES.WALLET_CREDIT }) {
  try {
    // 1. In-app notification ledger
    await InAppNotification.create({
      userId,
      title,
      body,
      type,
      metadata: data,
    }).catch((err) => console.warn('[InAppNotification Warning]', err.message))

    // 2. FCM Push notification (retried or safe)
    await sendNotificationToUser(userId, {
      title,
      body,
      type,
      data,
    }).catch((err) => console.warn('[FCM Notification Warning]', err.message))

    // 3. Socket.IO instant alert
    try {
      emitToUser(userId, 'WALLET_NOTIFICATION', {
        title,
        body,
        type,
        data,
        createdAt: new Date().toISOString(),
      })
    } catch (sockErr) {
      // ignore socket failure
    }
  } catch (err) {
    console.error('[Notification Dispatch Error]', err)
  }
}

/**
 * Submit a new Wallet Recharge Request (by User or Worker)
 */
export async function createRechargeRequest({
  userId,
  amount,
  utrNumber,
  paymentScreenshot,
  paymentScreenshotPublicId = '',
  paymentMode = 'UPI_QR',
  metadata = {},
}) {
  const user = await User.findById(userId)
  if (!user) {
    throw new Error('User account not found')
  }

  const numAmount = Number(amount)
  if (isNaN(numAmount) || numAmount < 1) {
    throw new Error('Recharge amount must be a positive number of at least ₹1')
  }

  const cleanUtr = String(utrNumber || '').trim().toUpperCase()
  if (!cleanUtr || cleanUtr.length < 4) {
    throw new Error('A valid UTR or Transaction ID is required')
  }

  if (!paymentScreenshot) {
    throw new Error('Payment screenshot is required for recharge verification')
  }

  // Prevent duplicate submissions with the same UTR for any pending or approved request
  const duplicate = await WalletRechargeRequest.findOne({
    utrNumber: cleanUtr,
    status: { $in: [RECHARGE_STATUS.PENDING, RECHARGE_STATUS.APPROVED] },
  })

  if (duplicate) {
    const error = new Error('This UTR / Transaction ID has already been submitted for another recharge request.')
    error.statusCode = 409
    error.code = 'DUPLICATE_UTR'
    throw error
  }

  // Determine account type: customers are USER; labour/contractors are WORKER
  const isWorker = user.role === 'labour' || user.role === 'contractor'
  const accountType = isWorker ? ACCOUNT_TYPES.WORKER : ACCOUNT_TYPES.USER

  const rechargeRequest = await WalletRechargeRequest.create({
    userId,
    accountType,
    amount: numAmount,
    currency: 'INR',
    paymentMode,
    utrNumber: cleanUtr,
    paymentScreenshot,
    paymentScreenshotPublicId,
    status: RECHARGE_STATUS.PENDING,
    metadata,
  })

  // Notify admins via Socket.IO, In-App Notifications and Push
  try {
    const io = getIo()
    if (io) {
      io.emit('WALLET_RECHARGE_REQUEST_SUBMITTED', {
        requestId: rechargeRequest._id,
        userId: user._id,
        userName: user.fullName || user.phone,
        accountType,
        amount: numAmount,
        utrNumber: cleanUtr,
        status: RECHARGE_STATUS.PENDING,
        createdAt: rechargeRequest.createdAt,
      })
    }

    const { User } = await import('../models/User.js')
    const { InAppNotification } = await import('../models/InAppNotification.js')
    const { sendNotificationToUser } = await import('../utils/pushNotificationHelper.js')
    const admins = await User.find({ role: 'admin' }).select('_id').lean()
    const senderName = user.fullName || user.phone || (accountType === 'WORKER' ? 'Service Provider' : 'User')
    const notifTitle = `💰 ${accountType === 'WORKER' ? 'Worker' : 'User'} Wallet Recharge: ₹${numAmount}`
    const notifBody = `${senderName} submitted a wallet recharge request of ₹${numAmount.toLocaleString('en-IN')} (UTR: ${cleanUtr}). Tap to review & approve.`
    const notifLink = accountType === 'WORKER' ? '/admin/wallet-management/workers' : '/admin/wallet-management/users'

    for (const admin of admins) {
      const inApp = await InAppNotification.create({
        userId: admin._id,
        title: notifTitle,
        body: notifBody,
        type: 'WALLET_RECHARGE_REQUEST',
        deliveryStatus: 'SENT',
        metadata: {
          requestId: rechargeRequest._id,
          userId: user._id,
          amount: numAmount,
          utr: cleanUtr,
          link: notifLink,
        },
      })
      if (io) {
        io.to(`user_${admin._id}`).emit('NEW_IN_APP_NOTIFICATION', inApp)
      }

      sendNotificationToUser(admin._id, {
        title: notifTitle,
        body: notifBody,
        link: notifLink,
        data: {
          type: 'WALLET_RECHARGE_REQUEST',
          requestId: String(rechargeRequest._id),
          amount: String(numAmount),
          utr: cleanUtr,
          isBookingAlert: true,
          link: notifLink,
        },
      }).catch((pushErr) => console.warn('[FCM Admin Push Warning]:', pushErr?.message))
    }
  } catch (sockErr) {
    // safe fallback
  }

  // Notify User / Worker about submission
  sendSafeNotification({
    userId,
    title: 'Wallet Recharge Submitted',
    body: `Your wallet recharge request of ₹${numAmount.toLocaleString('en-IN')} has been submitted and is awaiting admin approval.`,
    data: {
      requestId: rechargeRequest._id.toString(),
      amount: String(numAmount),
      status: RECHARGE_STATUS.PENDING,
      utr: cleanUtr,
    },
    type: 'WALLET_RECHARGE',
  })

  return rechargeRequest
}

/**
 * Approve a pending Wallet Recharge Request (Admin only)
 * Strictly verifies status is PENDING, reads amount directly from DB,
 * executes wallet balance update and transaction ledger creation atomically.
 */
export async function approveRechargeRequest({ requestId, adminUserId, adminRemarks = '' }) {
  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    const err = new Error('Invalid recharge request ID')
    err.statusCode = 400
    throw err
  }

  const existing = await WalletRechargeRequest.findById(requestId)
  if (!existing) {
    const err = new Error('Recharge request not found')
    err.statusCode = 404
    throw err
  }

  if (existing.status === RECHARGE_STATUS.APPROVED) {
    const err = new Error('This recharge request has already been approved.')
    err.statusCode = 409
    err.code = 'ALREADY_APPROVED'
    throw err
  }

  if (existing.status === RECHARGE_STATUS.REJECTED) {
    const err = new Error('Cannot approve an already rejected request.')
    err.statusCode = 400
    err.code = 'ALREADY_REJECTED'
    throw err
  }

  const targetUserId = existing.userId
  const accountType = existing.accountType
  const creditAmount = Number(existing.amount)

  if (isNaN(creditAmount) || creditAmount <= 0) {
    const err = new Error('Invalid recharge request amount in database.')
    err.statusCode = 400
    throw err
  }

  let session = null
  let supportsTransactions = false

  try {
    session = await mongoose.startSession()
    session.startTransaction()
    supportsTransactions = true
  } catch (sessErr) {
    // Standalone MongoDB instances do not support replica set sessions
    session = null
    supportsTransactions = false
  }

  try {
    // 1. Atomic status transition: lock request from PENDING to APPROVED
    const updateOptions = { new: true }
    if (session) updateOptions.session = session

    const updatedRequest = await WalletRechargeRequest.findOneAndUpdate(
      {
        _id: requestId,
        status: RECHARGE_STATUS.PENDING,
      },
      {
        $set: {
          status: RECHARGE_STATUS.APPROVED,
          reviewedBy: adminUserId,
          reviewedAt: new Date(),
          adminRemarks: adminRemarks || '',
        },
      },
      updateOptions
    )

    if (!updatedRequest) {
      const err = new Error('Recharge request could not be approved. It may have already been approved or rejected by another administrator.')
      err.statusCode = 409
      err.code = 'CONCURRENCY_ERROR'
      throw err
    }

    // 2. Fetch or create the correct wallet (session aware)
    let wallet
    if (accountType === ACCOUNT_TYPES.WORKER) {
      wallet = await getOrCreateLabourWallet(targetUserId, session)
    } else {
      wallet = await getOrCreateUserWallet(targetUserId, session)
    }

    // 3. Authoritative balance calculation
    const balanceBefore = Number(wallet.selfBalance !== undefined ? wallet.selfBalance : (wallet.balance || 0))
    const balanceAfter = balanceBefore + creditAmount

    // 4. Update wallet balances
    wallet.selfBalance = balanceAfter
    wallet.balance = balanceAfter
    await wallet.save(session ? { session } : undefined)

    // 5. Create exactly one wallet transaction ledger entry with idempotency key
    const idempotencyKey = `RECHARGE_CREDIT_${requestId}`
    const txDoc = {
      walletId: wallet._id,
      userId: targetUserId,
      labourId: accountType === ACCOUNT_TYPES.WORKER ? targetUserId : undefined,
      amount: creditAmount,
      type: 'CREDIT',
      targetWallet: 'SELF',
      context: 'WALLET_RECHARGE',
      referenceType: 'WALLET_RECHARGE',
      referenceId: requestId,
      accountType,
      balanceBefore,
      balanceAfter,
      idempotencyKey,
      description: `Wallet recharge of ₹${creditAmount.toLocaleString('en-IN')} approved by Admin (UTR: ${updatedRequest.utrNumber})`,
      status: 'COMPLETED',
      metadata: {
        requestId: requestId.toString(),
        utrNumber: updatedRequest.utrNumber,
        paymentMode: updatedRequest.paymentMode,
        approvedBy: adminUserId.toString(),
      },
    }

    let createdTx
    if (session) {
      const txs = await WalletTransaction.create([txDoc], { session })
      createdTx = txs[0]
    } else {
      createdTx = await WalletTransaction.create(txDoc)
    }

    // 6. Record financial details on the recharge request
    updatedRequest.financialActionDetails = {
      transactionId: createdTx._id.toString(),
      balanceBefore,
      balanceAfter,
      executedAt: new Date(),
    }
    await updatedRequest.save(session ? { session } : undefined)

    // 7. Commit transaction
    if (session) {
      await session.commitTransaction()
    }

    // 8. Send notifications after successful commit (non-blocking)
    sendSafeNotification({
      userId: targetUserId,
      title: 'Wallet Recharge Approved',
      body: `Your wallet has been successfully credited with ₹${creditAmount.toLocaleString('en-IN')}.`,
      data: {
        requestId: requestId.toString(),
        amount: String(creditAmount),
        balanceAfter: String(balanceAfter),
        status: RECHARGE_STATUS.APPROVED,
        utr: updatedRequest.utrNumber,
      },
      type: 'WALLET_CREDIT',
    })

    // Emit live socket alert to admins
    try {
      const io = getIo()
      if (io) {
        io.emit('WALLET_RECHARGE_UPDATED', {
          requestId: updatedRequest._id,
          status: RECHARGE_STATUS.APPROVED,
          amount: creditAmount,
          userId: targetUserId,
        })
      }
    } catch (sockErr) {
      // safe fallback
    }

    // Also mark linked ProviderPayment as approved if initiated via QR modal
    if (updatedRequest.metadata?.providerPaymentId) {
      try {
        const { ProviderPayment, PAYMENT_STATUS } = await import('../models/ProviderPayment.js')
        await ProviderPayment.findByIdAndUpdate(
          updatedRequest.metadata.providerPaymentId,
          {
            $set: {
              status: PAYMENT_STATUS.APPROVED,
              reviewedBy: adminUserId,
              reviewedAt: new Date(),
              adminRemarks: adminRemarks || 'Approved via Wallet Recharge Requests',
              financialActionExecuted: true,
              financialActionDetails: updatedRequest.financialActionDetails,
            },
          }
        )
      } catch (syncErr) {
        console.warn('[Sync ProviderPayment Approve Warning]:', syncErr?.message)
      }
    }

    return {
      request: updatedRequest,
      wallet,
      transaction: createdTx,
    }
  } catch (err) {
    if (session && supportsTransactions) {
      try {
        await session.abortTransaction()
      } catch (abortErr) {
        console.error('[Session Abort Error]', abortErr.message)
      }
    }
    throw err
  } finally {
    if (session) {
      session.endSession()
    }
  }
}

/**
 * Reject a pending Wallet Recharge Request (Admin only)
 * Requires mandatory rejection reason. Does NOT modify wallet balances.
 */
export async function rejectRechargeRequest({ requestId, adminUserId, rejectionReason, adminRemarks = '' }) {
  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    const err = new Error('Invalid recharge request ID')
    err.statusCode = 400
    throw err
  }

  const cleanReason = String(rejectionReason || '').trim()
  if (!cleanReason) {
    const err = new Error('Rejection reason is mandatory when rejecting a recharge request.')
    err.statusCode = 400
    err.code = 'MISSING_REJECTION_REASON'
    throw err
  }

  const existing = await WalletRechargeRequest.findById(requestId)
  if (!existing) {
    const err = new Error('Recharge request not found')
    err.statusCode = 404
    throw err
  }

  if (existing.status === RECHARGE_STATUS.APPROVED) {
    const err = new Error('Cannot reject an already approved recharge request.')
    err.statusCode = 409
    err.code = 'ALREADY_APPROVED'
    throw err
  }

  if (existing.status === RECHARGE_STATUS.REJECTED) {
    const err = new Error('This recharge request has already been rejected.')
    err.statusCode = 400
    err.code = 'ALREADY_REJECTED'
    throw err
  }

  // Atomic state update ensuring concurrency protection
  const updatedRequest = await WalletRechargeRequest.findOneAndUpdate(
    {
      _id: requestId,
      status: RECHARGE_STATUS.PENDING,
    },
    {
      $set: {
        status: RECHARGE_STATUS.REJECTED,
        rejectionReason: cleanReason,
        reviewedBy: adminUserId,
        reviewedAt: new Date(),
        adminRemarks: adminRemarks || '',
      },
    },
    { new: true }
  )

  if (!updatedRequest) {
    const err = new Error('Recharge request could not be rejected. It may have been processed by another administrator.')
    err.statusCode = 409
    err.code = 'CONCURRENCY_ERROR'
    throw err
  }

  // Notify User / Worker with mandatory rejection reason
  sendSafeNotification({
    userId: updatedRequest.userId,
    title: 'Wallet Recharge Rejected',
    body: `Your recharge request of ₹${Number(updatedRequest.amount).toLocaleString('en-IN')} was rejected. Reason: ${cleanReason}.`,
    data: {
      requestId: requestId.toString(),
      amount: String(updatedRequest.amount),
      reason: cleanReason,
      status: RECHARGE_STATUS.REJECTED,
      utr: updatedRequest.utrNumber,
    },
    type: 'WALLET_REJECTED',
  })

  // Emit live socket alert to admins
  try {
    const io = getIo()
    if (io) {
      io.emit('WALLET_RECHARGE_UPDATED', {
        requestId: updatedRequest._id,
        status: RECHARGE_STATUS.REJECTED,
        amount: updatedRequest.amount,
        userId: updatedRequest.userId,
      })
    }
  } catch (sockErr) {
    // safe fallback
  }

  // Also mark linked ProviderPayment as rejected if initiated via QR modal
  if (updatedRequest.metadata?.providerPaymentId) {
    try {
      const { ProviderPayment, PAYMENT_STATUS } = await import('../models/ProviderPayment.js')
      await ProviderPayment.findByIdAndUpdate(
        updatedRequest.metadata.providerPaymentId,
        {
          $set: {
            status: PAYMENT_STATUS.REJECTED,
            rejectionReason: cleanReason,
            reviewedBy: adminUserId,
            reviewedAt: new Date(),
            adminRemarks: adminRemarks || cleanReason,
          },
        }
      )
    } catch (syncErr) {
      console.warn('[Sync ProviderPayment Reject Warning]:', syncErr?.message)
    }
  }

  return updatedRequest
}
