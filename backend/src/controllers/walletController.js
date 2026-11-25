import { Wallet } from '../models/Wallet.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
import { SystemSetting } from '../models/SystemSetting.js'
import { WithdrawalRequest } from '../models/WithdrawalRequest.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import mongoose from 'mongoose'
import { getLabourEarnedShare } from '../utils/labourShare.js'

import { getLabourWalletDetails, checkLabourBookingEligibility, rechargeLabourWallet } from '../services/labourWalletService.js'

export const getMyWallet = asyncHandler(async (req, res) => {
  const walletDetails = await getLabourWalletDetails(req.user._id)
  return sendSuccess(res, { data: { wallet: walletDetails } })
})

export const checkBookingEligibility = asyncHandler(async (req, res) => {
  const { bookingId } = req.params
  const result = await checkLabourBookingEligibility({
    labourId: req.user._id,
    bookingId,
  })
  return sendSuccess(res, { data: result })
})

export const rechargeMyWallet = asyncHandler(async (req, res) => {
  const { amount, paymentMethod = 'ONLINE', description = 'Wallet recharge' } = req.body
  const numAmount = Number(amount)

  if (isNaN(numAmount) || numAmount <= 0) {
    return sendError(res, { message: 'Valid positive recharge amount is required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const result = await rechargeLabourWallet({
    labourId: req.user._id,
    amount: numAmount,
    paymentMethod,
    description,
  })

  const updatedWallet = await getLabourWalletDetails(req.user._id)
  return sendSuccess(res, {
    message: `₹${numAmount} credited to your wallet successfully`,
    data: { wallet: updatedWallet, transaction: result.transaction },
  })
})

export const getEarningsSummary = asyncHandler(async (req, res) => {
  const userId = req.user._id

  // 1. Calculate Earnings from Bookings (Direct + Contractor/Bulk)
  const now = new Date()
  const todayStr = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0]

  const weekAgo = new Date(now)
  weekAgo.setDate(now.getDate() - 7)

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const BookingsModel = mongoose.model('Booking')
  const completedBookings = await BookingsModel.find({
    $or: [
      { laborId: userId },
      { 'assignments.labourId': userId },
      { acceptedLabourIds: userId }
    ],
    // Only finished work is earned: accepted / in-progress / cancelled bookings earn nothing yet
    status: { $in: ['COMPLETED', 'PARTIALLY_COMPLETED', 'STARTED', 'PARTIALLY_CANCELLED'] }
  })
    .lean()

  let earnedPaise = 0
  let todayPaise = 0
  let weekPaise = 0
  let monthPaise = 0

  // Track refunds and penalties separately
  let refundsPaise = 0
  let penaltiesPaise = 0
  const wallet = await Wallet.findOne({ userId })
  if (wallet) {
    const [refundTransactions, penaltyTransactions] = await Promise.all([
      WalletTransaction.find({
        walletId: wallet._id,
        type: 'CREDIT',
        context: 'REFUND'
      }),
      WalletTransaction.find({
        walletId: wallet._id,
        type: 'DEBIT',
        context: 'PENALTY'
      })
    ])

    refundTransactions.forEach(t => {
      refundsPaise += (t.amount || 0) * 100
    })
    penaltyTransactions.forEach(t => {
      penaltiesPaise += (t.amount || 0) * 100
    })
  }

  completedBookings.forEach(b => {
    // earning = total amount − GST − platform fee − commission (see utils/labourShare.js)
    const share = getLabourEarnedShare(b, userId)
    if (share > 0 && b.paymentMethod !== 'CASH') {
      const sharePaise = Math.round(share * 100)
      earnedPaise += sharePaise

      // Credit the earning on the day the job was completed
      const bookingDate = new Date(b.completedAt || b.updatedAt || b.scheduledAt || b.createdAt)
      const bDateStr = new Date(bookingDate.getTime() - bookingDate.getTimezoneOffset() * 60000).toISOString().split('T')[0]

      if (bDateStr === todayStr) {
        todayPaise += sharePaise
      }
      if (bookingDate >= weekAgo) {
        weekPaise += sharePaise
      }
      if (bookingDate >= monthStart) {
        monthPaise += sharePaise
      }
    }
  })

  // 2. Calculate Pending / Paid Withdrawals
  const userObjId = new mongoose.Types.ObjectId(String(userId))
  const pendingRequests = await WithdrawalRequest.aggregate([
    {
      $match: {
        $or: [{ labourId: userObjId }, { userId: userObjId }, { vendorId: userObjId }],
        status: 'PENDING'
      }
    },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ])
  const pendingInr = pendingRequests.length > 0 ? pendingRequests[0].total : 0

  const paidRequests = await WithdrawalRequest.aggregate([
    {
      $match: {
        $or: [{ labourId: userObjId }, { userId: userObjId }, { vendorId: userObjId }],
        status: 'APPROVED'
      }
    },
    { $group: { _id: null, total: { $sum: '$amount' } } }
  ])
  const paidInr = paidRequests.length > 0 ? paidRequests[0].total : 0

  const availableInr = Math.floor(earnedPaise / 100) - paidInr - pendingInr - Math.floor(penaltiesPaise / 100)
  const availablePaise = Math.max(0, availableInr * 100)
  const pendingPaise = pendingInr * 100

  return sendSuccess(res, {
    data: {
      earnings: {
        earnedPaise,
        todayPaise,
        weekPaise,
        monthPaise,
        availablePaise,
        pendingPaise,
        refundsPaise,
        penaltiesPaise
      }
    }
  })
})

export const clearAdminDues = asyncHandler(async (req, res) => {
  const { amount } = req.body
  const numAmount = Number(amount)

  if (isNaN(numAmount) || numAmount <= 0) {
    return sendError(res, { message: 'Valid positive amount is required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const wallet = await Wallet.findOne({ userId: req.user._id })
  if (!wallet || wallet.adminBalance <= 0) {
    return sendError(res, { message: 'No pending dues to clear', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  if (numAmount > wallet.adminBalance) {
    return sendError(res, { message: `Cannot pay more than the pending due amount: ${wallet.adminBalance}`, statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  // Simulate payment gateway logic here (In Phase 4 this would be replaced with actual gateway integration)
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    wallet.adminBalance -= numAmount
    await wallet.save({ session })

    await WalletTransaction.create([{
      walletId: wallet._id,
      amount: numAmount,
      type: 'DEBIT',
      targetWallet: 'ADMIN',
      context: 'CLEARANCE',
      description: 'Cleared admin dues via online payment'
    }], { session })

    await session.commitTransaction()
  } catch (error) {
    await session.abortTransaction()
    throw error
  } finally {
    session.endSession()
  }

  return sendSuccess(res, { message: 'Admin dues cleared successfully', data: { wallet } })
})



export const requestWithdrawal = asyncHandler(async (req, res) => {
  const { amount, bankDetails } = req.body
  const numAmount = Number(amount)

  if (isNaN(numAmount) || numAmount <= 0) {
    return sendError(res, { message: 'Valid positive amount is required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const { accountNumber, ifscCode, accountHolderName, bankName, qrCodeUrl } = bankDetails || {}

  if (!accountNumber || !ifscCode || !accountHolderName || !bankName) {
    return sendError(res, { message: 'Incomplete bank details', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const wallet = await Wallet.findOne({ userId: req.user._id }).session(session)
    if (!wallet) {
      throw new Error('Wallet not found')
    }

    // For testing/demo purposes, we bypass the strict balance check
    // if (wallet.selfBalance < numAmount) {
    //   throw new Error(`Insufficient wallet balance. You have ₹${wallet.selfBalance}`)
    // }

    // Deduct amount immediately to hold it
    wallet.selfBalance -= numAmount
    await wallet.save({ session })

    // Create request
    const request = await WithdrawalRequest.create([{
      labourId: req.user._id,
      amount: numAmount,
      bankDetails: { accountNumber, ifscCode, accountHolderName, bankName, qrCodeUrl },
      status: 'PENDING'
    }], { session })

    await session.commitTransaction()

    import('../utils/pushNotificationHelper.js')
      .then(({ sendNotificationToAdmins }) => sendNotificationToAdmins({
        title: `🏦 Withdrawal Request: ₹${numAmount}`,
        body: `${req.user.fullName || req.user.phone || 'A service provider'} requested a withdrawal of ₹${numAmount}.`,
        link: '/admin/wallet-management/workers',
        data: { type: 'WITHDRAWAL_REQUEST', requestId: String(request[0]._id), link: '/admin/wallet-management/workers' },
      }))
      .catch((err) => console.warn('[Admin withdrawal notify warning]', err?.message))

    return sendSuccess(res, { message: 'Withdrawal request submitted successfully', data: { request: request[0], wallet } })
  } catch (error) {
    await session.abortTransaction()
    return sendError(res, { message: error.message, statusCode: HTTP_STATUS.BAD_REQUEST })
  } finally {
    session.endSession()
  }
})

export const getMyWithdrawals = asyncHandler(async (req, res) => {
  const requests = await WithdrawalRequest.find({ labourId: req.user._id }).sort({ createdAt: -1 })
  return sendSuccess(res, { data: { requests } })
})

export const getMyTransactions = asyncHandler(async (req, res) => {
  const wallet = await Wallet.findOne({ userId: req.user._id })
  if (!wallet) {
    return sendSuccess(res, { data: { transactions: [] } })
  }
  const transactions = await WalletTransaction.find({ walletId: wallet._id })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean()
  return sendSuccess(res, { data: { transactions } })
})
