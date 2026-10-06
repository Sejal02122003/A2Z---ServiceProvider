import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { Wallet } from '../models/Wallet.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
import {
  getWalletSettings,
  getOrCreateUserWallet,
  ensureWelcomeBonus,
  calculateWalletDiscount,
} from '../services/userWalletService.js'

/**
 * GET /api/wallets/user/me
 * Returns user's wallet details, balance, stats, and discount rules
 */
export const getMyUserWallet = asyncHandler(async (req, res) => {
  const userId = req.user._id

  // Ensure welcome bonus if eligible
  await ensureWelcomeBonus(userId)

  const wallet = await getOrCreateUserWallet(userId)
  const settings = await getWalletSettings()

  const currentBalance = wallet.balance !== undefined ? wallet.balance : (wallet.selfBalance || 0)

  // Aggregate stats
  const stats = await WalletTransaction.aggregate([
    { $match: { userId: wallet.userId, status: 'COMPLETED' } },
    {
      $group: {
        _id: '$type',
        total: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
  ])

  let totalCredits = 0
  let totalDebits = 0
  stats.forEach((s) => {
    if (s._id === 'CREDIT') totalCredits = s.total
    if (s._id === 'DEBIT') totalDebits = s.total
  })

  return sendSuccess(res, {
    data: {
      wallet: {
        _id: wallet._id,
        userId: wallet.userId,
        balance: currentBalance,
        currency: wallet.currency || 'INR',
        welcomeBonusCredited: Boolean(wallet.welcomeBonusCredited),
        totalCredits,
        totalDebits,
      },
      settings: {
        enabled: settings.enabled,
        welcomeBonusAmount: settings.welcomeBonusAmount,
        walletDiscountPercentage: settings.walletDiscountPercentage,
        minimumBookingAmount: settings.minimumBookingAmount,
      },
    },
  })
})

/**
 * GET /api/wallets/user/transactions
 * Returns user's wallet transaction history
 */
export const getMyUserTransactions = asyncHandler(async (req, res) => {
  const userId = req.user._id
  const page = Math.max(1, parseInt(req.query.page, 10) || 1)
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20))
  const skip = (page - 1) * limit

  const query = {
    $or: [
      { userId },
      { walletId: (await Wallet.findOne({ userId }))?._id },
    ],
  }

  const [transactions, total] = await Promise.all([
    WalletTransaction.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    WalletTransaction.countDocuments(query),
  ])

  return sendSuccess(res, {
    data: {
      transactions,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
      total,
    },
  })
})

/**
 * GET /api/wallets/public-settings
 * Returns public-facing wallet discount rules
 */
export const getPublicWalletSettings = asyncHandler(async (req, res) => {
  const settings = await getWalletSettings()
  return sendSuccess(res, {
    data: {
      enabled: settings.enabled,
      welcomeBonusAmount: settings.welcomeBonusAmount,
      walletDiscountPercentage: settings.walletDiscountPercentage,
      minimumBookingAmount: settings.minimumBookingAmount,
    },
  })
})
