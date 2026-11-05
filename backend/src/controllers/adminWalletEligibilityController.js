import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import {
  getWalletEligibilitySettings,
  updateWalletEligibilitySettings,
  getAdminProvidersEligibilityReport,
} from '../services/walletEligibilityService.js'
import { WalletTransaction } from '../models/WalletTransaction.js'

/**
 * GET /api/v1/admin/wallet-eligibility/settings
 * Fetch singleton wallet eligibility configuration
 */
export const getSettings = asyncHandler(async (req, res) => {
  const settings = await getWalletEligibilitySettings()
  return sendSuccess(res, {
    data: { settings },
  })
})

/**
 * PUT /api/v1/admin/wallet-eligibility/settings
 * Update wallet eligibility settings
 */
export const updateSettings = asyncHandler(async (req, res) => {
  const {
    minimumWalletBalance,
    commissionPercentage,
    eligibilitySystemEnabled,
    commissionReservationEnabled,
    reason,
  } = req.body

  if (minimumWalletBalance !== undefined) {
    const num = Number(minimumWalletBalance)
    if (isNaN(num) || !isFinite(num) || num < 0) {
      return sendError(res, {
        message: 'Minimum wallet balance must be a number greater than or equal to 0',
        statusCode: HTTP_STATUS.UNPROCESSABLE,
      })
    }
  }

  if (commissionPercentage !== undefined) {
    const num = Number(commissionPercentage)
    if (isNaN(num) || !isFinite(num) || num < 0 || num > 100) {
      return sendError(res, {
        message: 'Booking commission percentage must be a valid number between 0 and 100',
        statusCode: HTTP_STATUS.UNPROCESSABLE,
      })
    }
  }

  const updatedSettings = await updateWalletEligibilitySettings(
    {
      minimumWalletBalance,
      commissionPercentage,
      eligibilitySystemEnabled,
      commissionReservationEnabled,
    },
    req.user._id,
    reason
  )

  return sendSuccess(res, {
    message: 'Wallet eligibility settings updated successfully',
    data: { settings: updatedSettings },
  })
})

/**
 * GET /api/v1/admin/wallet-eligibility/providers
 * Fetch provider eligibility report table
 */
export const getProvidersReport = asyncHandler(async (req, res) => {
  const { search = '', filter = 'all', page = 1, limit = 20 } = req.query
  const report = await getAdminProvidersEligibilityReport({
    search,
    filter,
    page: Number(page) || 1,
    limit: Number(limit) || 20,
  })

  return sendSuccess(res, {
    data: report,
  })
})

/**
 * GET /api/v1/admin/wallet-eligibility/transactions
 * Fetch transaction history specifically for eligibility & reservation flows
 */
export const getEligibilityTransactions = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20, context, search } = req.query
  const pageNum = Math.max(1, parseInt(page, 10) || 1)
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20))
  const skip = (pageNum - 1) * limitNum

  const query = {
    context: {
      $in: [
        'BOOKING_COMMISSION_RESERVE',
        'BOOKING_COMMISSION_SETTLEMENT',
        'BOOKING_COMMISSION_RELEASE',
        'WALLET_RECHARGE',
      ],
    },
  }

  if (context && context !== 'ALL') {
    query.context = context
  }

  if (search && search.trim()) {
    const term = search.trim()
    const { User } = await import('../models/User.js')
    const matchedUsers = await User.find({
      $or: [
        { fullName: { $regex: term, $options: 'i' } },
        { phone: { $regex: term, $options: 'i' } },
      ],
    }).select('_id')
    const userIds = matchedUsers.map((u) => u._id)

    query.$or = [
      { userId: { $in: userIds } },
      { transactionId: { $regex: term, $options: 'i' } },
      { description: { $regex: term, $options: 'i' } },
    ]
  }

  const [transactions, total] = await Promise.all([
    WalletTransaction.find(query)
      .populate('userId', 'fullName phone email role')
      .populate('bookingId', 'totalAmount basePrice status paymentMethod')
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
