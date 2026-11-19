import mongoose from 'mongoose'
import { WalletRechargeRequest, RECHARGE_STATUS, ACCOUNT_TYPES } from '../models/WalletRechargeRequest.js'
import { Wallet } from '../models/Wallet.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
import { User } from '../models/User.js'
import { approveRechargeRequest, rejectRechargeRequest } from '../services/walletRechargeService.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'

/**
 * GET /api/admin/wallet/recharge-requests
 * Fetch all recharge requests with filters, pagination, sorting, and search.
 */
export const getRechargeRequests = asyncHandler(async (req, res) => {
  const {
    status,
    accountType,
    search,
    startDate,
    endDate,
    sort = 'newest',
    page = 1,
    limit = 20,
  } = req.query

  const query = {}

  // Filter by Status
  if (status && status !== 'ALL') {
    const upperStatus = String(status).toUpperCase()
    if (Object.values(RECHARGE_STATUS).includes(upperStatus)) {
      query.status = upperStatus
    }
  }

  // Filter by Account Type (USER / WORKER)
  if (accountType && accountType !== 'ALL') {
    const upperType = String(accountType).toUpperCase()
    if (Object.values(ACCOUNT_TYPES).includes(upperType)) {
      query.accountType = upperType
    }
  }

  // Date range filtering
  if (startDate || endDate) {
    query.createdAt = {}
    if (startDate) {
      const start = new Date(startDate)
      if (!isNaN(start.getTime())) {
        query.createdAt.$gte = start
      }
    }
    if (endDate) {
      const end = new Date(endDate)
      if (!isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999)
        query.createdAt.$lte = end
      }
    }
  }

  // Search by name, phone, request ID, UTR
  if (search && String(search).trim()) {
    const s = String(search).trim()
    const orConditions = []

    if (mongoose.Types.ObjectId.isValid(s)) {
      orConditions.push({ _id: s })
    }

    // UTR search
    orConditions.push({ utrNumber: { $regex: s, $options: 'i' } })

    // Find matching users by name, phone, email
    const matchingUsers = await User.find({
      $or: [
        { fullName: { $regex: s, $options: 'i' } },
        { phone: { $regex: s, $options: 'i' } },
        { email: { $regex: s, $options: 'i' } },
      ],
    }).select('_id')

    if (matchingUsers.length > 0) {
      const userIds = matchingUsers.map((u) => u._id)
      orConditions.push({ userId: { $in: userIds } })
    }

    query.$or = orConditions
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1)
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20))
  const skip = (pageNum - 1) * limitNum

  const sortDirection = sort === 'oldest' ? 1 : -1

  const [requests, total, aggregateStats] = await Promise.all([
    WalletRechargeRequest.find(query)
      .sort({ createdAt: sortDirection })
      .skip(skip)
      .limit(limitNum)
      .populate('userId', 'fullName phone email role avatar')
      .populate('reviewedBy', 'fullName email')
      .lean(),
    WalletRechargeRequest.countDocuments(query),
    WalletRechargeRequest.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
    ]),
  ])

  // Process summary metrics
  const stats = {
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    totalApprovedAmount: 0,
  }

  for (const item of aggregateStats) {
    stats.total += item.count
    if (item._id === RECHARGE_STATUS.PENDING) stats.pending = item.count
    if (item._id === RECHARGE_STATUS.APPROVED) {
      stats.approved = item.count
      stats.totalApprovedAmount = item.totalAmount
    }
    if (item._id === RECHARGE_STATUS.REJECTED) stats.rejected = item.count
  }

  return sendSuccess(res, {
    data: {
      requests,
      stats,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum) || 1,
      },
    },
  })
})

/**
 * GET /api/admin/wallet/recharge-requests/:requestId
 * Fetch complete details of an individual recharge request with current wallet balance.
 */
export const getRechargeRequestById = asyncHandler(async (req, res) => {
  const { requestId } = req.params

  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    return sendError(res, { message: 'Invalid recharge request ID', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const request = await WalletRechargeRequest.findById(requestId)
    .populate('userId', 'fullName phone email role avatar')
    .populate('reviewedBy', 'fullName email')
    .lean()

  if (!request) {
    return sendError(res, { message: 'Recharge request not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  // Fetch current wallet balance
  let currentWalletBalance = 0
  if (request.userId?._id) {
    const wallet = await Wallet.findOne({ userId: request.userId._id }).lean()
    if (wallet) {
      currentWalletBalance = Number(wallet.selfBalance !== undefined ? wallet.selfBalance : (wallet.balance || 0))
    }
  }

  return sendSuccess(res, {
    data: {
      request: {
        ...request,
        currentWalletBalance,
      },
    },
  })
})

/**
 * PATCH /api/admin/wallet/recharge-requests/:requestId/approve
 * Approve a pending recharge request.
 */
export const approveRequest = asyncHandler(async (req, res) => {
  const { requestId } = req.params
  const { adminRemarks } = req.body
  const adminUserId = req.user._id

  try {
    const result = await approveRechargeRequest({
      requestId,
      adminUserId,
      adminRemarks,
    })

    return sendSuccess(res, {
      message: `Recharge request for ₹${result.request.amount} has been successfully approved and credited.`,
      data: result,
    })
  } catch (err) {
    const statusCode = err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR
    return sendError(res, {
      message: err.message,
      statusCode,
      code: err.code || 'APPROVAL_FAILED',
    })
  }
})

/**
 * PATCH /api/admin/wallet/recharge-requests/:requestId/reject
 * Reject a pending recharge request with a mandatory reason.
 */
export const rejectRequest = asyncHandler(async (req, res) => {
  const { requestId } = req.params
  const { rejectionReason, adminRemarks } = req.body
  const adminUserId = req.user._id

  if (!rejectionReason || !String(rejectionReason).trim()) {
    return sendError(res, {
      message: 'Rejection reason is required when rejecting a recharge request.',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'MISSING_REJECTION_REASON',
    })
  }

  try {
    const updatedRequest = await rejectRechargeRequest({
      requestId,
      adminUserId,
      rejectionReason,
      adminRemarks,
    })

    return sendSuccess(res, {
      message: 'Recharge request has been rejected successfully.',
      data: { request: updatedRequest },
    })
  } catch (err) {
    const statusCode = err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR
    return sendError(res, {
      message: err.message,
      statusCode,
      code: err.code || 'REJECTION_FAILED',
    })
  }
})

/**
 * GET /api/admin/wallet/statistics
 * Fetch overall wallet recharge statistics.
 */
export const getWalletStatistics = asyncHandler(async (req, res) => {
  const [counts, userCount, workerCount] = await Promise.all([
    WalletRechargeRequest.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
        },
      },
    ]),
    WalletRechargeRequest.countDocuments({ accountType: ACCOUNT_TYPES.USER }),
    WalletRechargeRequest.countDocuments({ accountType: ACCOUNT_TYPES.WORKER }),
  ])

  const stats = {
    totalRechargeRequests: 0,
    pendingRequests: 0,
    approvedRequests: 0,
    rejectedRequests: 0,
    totalApprovedRechargeAmount: 0,
    userRequestsCount: userCount,
    workerRequestsCount: workerCount,
  }

  for (const item of counts) {
    stats.totalRechargeRequests += item.count
    if (item._id === RECHARGE_STATUS.PENDING) stats.pendingRequests = item.count
    if (item._id === RECHARGE_STATUS.APPROVED) {
      stats.approvedRequests = item.count
      stats.totalApprovedRechargeAmount = item.totalAmount
    }
    if (item._id === RECHARGE_STATUS.REJECTED) stats.rejectedRequests = item.count
  }

  return sendSuccess(res, {
    data: { stats },
  })
})

/**
 * GET /api/admin/wallet/transactions
 * Fetch wallet transaction history for users and workers with filtering, search, and pagination.
 */
export const getWalletTransactions = asyncHandler(async (req, res) => {
  const {
    accountType,
    type,
    context,
    search,
    startDate,
    endDate,
    page = 1,
    limit = 20,
  } = req.query

  const query = {}

  if (type && type !== 'ALL') query.type = type
  if (context && context !== 'ALL') query.context = context

  if (accountType && accountType !== 'ALL') {
    const upperType = String(accountType).toUpperCase()
    query.accountType = upperType
  }

  if (startDate || endDate) {
    query.createdAt = {}
    if (startDate) {
      const start = new Date(startDate)
      if (!isNaN(start.getTime())) query.createdAt.$gte = start
    }
    if (endDate) {
      const end = new Date(endDate)
      if (!isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999)
        query.createdAt.$lte = end
      }
    }
  }

  if (search && String(search).trim()) {
    const s = String(search).trim()
    const orConditions = []

    if (mongoose.Types.ObjectId.isValid(s)) {
      orConditions.push({ _id: s }, { userId: s }, { referenceId: s })
    }

    orConditions.push(
      { transactionId: { $regex: s, $options: 'i' } },
      { idempotencyKey: { $regex: s, $options: 'i' } },
      { description: { $regex: s, $options: 'i' } }
    )

    const matchingUsers = await User.find({
      $or: [
        { fullName: { $regex: s, $options: 'i' } },
        { phone: { $regex: s, $options: 'i' } },
        { email: { $regex: s, $options: 'i' } },
      ],
    }).select('_id')

    if (matchingUsers.length > 0) {
      orConditions.push({ userId: { $in: matchingUsers.map((u) => u._id) } })
    }

    query.$or = orConditions
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1)
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20))
  const skip = (pageNum - 1) * limitNum

  const [transactions, total] = await Promise.all([
    WalletTransaction.find(query)
      .populate('userId', 'fullName phone email role')
      .populate('labourId', 'fullName phone email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    WalletTransaction.countDocuments(query),
  ])

  return sendSuccess(res, {
    data: {
      transactions,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum) || 1,
      },
    },
  })
})
