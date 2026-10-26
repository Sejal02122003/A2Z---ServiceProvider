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
        serviceCreditEnabled: settings.serviceCreditEnabled !== false,
        serviceCreditPercentage: settings.serviceCreditPercentage ?? 15,
        serviceCreditMaxAmount: settings.serviceCreditMaxAmount ?? 0,
        serviceCreditMinBookingAmount: settings.serviceCreditMinBookingAmount ?? 0,
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
    WalletTransaction.find(query)
      .populate('bookingId', 'basePrice totalAmount status paymentMethod paymentStatus')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
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
 * Returns public-facing wallet discount & cashback rules
 */
export const getPublicWalletSettings = asyncHandler(async (req, res) => {
  const settings = await getWalletSettings()
  return sendSuccess(res, {
    data: {
      enabled: settings.enabled,
      welcomeBonusAmount: settings.welcomeBonusAmount,
      walletDiscountPercentage: settings.walletDiscountPercentage,
      minimumBookingAmount: settings.minimumBookingAmount,
      serviceCreditEnabled: settings.serviceCreditEnabled !== false,
      serviceCreditPercentage: settings.serviceCreditPercentage ?? 15,
      serviceCreditMaxAmount: settings.serviceCreditMaxAmount ?? 0,
      serviceCreditMinBookingAmount: settings.serviceCreditMinBookingAmount ?? 0,
    },
  })
})

/**
 * POST /api/wallets/checkout-calculation
 * Calculates authoritative wallet deduction and remaining payable for customer checkout
 */
export const calculateCheckoutWallet = asyncHandler(async (req, res) => {
  const userId = req.user._id
  const { serviceId, packageId, items, eligibleOrderAmount, eligibleBillAmount } = req.body

  let eligibleAmount = 0

  if (packageId) {
    const { ServicePackage } = await import('../models/ServicePackage.js')
    const pkg = await ServicePackage.findById(packageId).lean()
    if (!pkg) {
      return sendError(res, { message: 'Service package not found', statusCode: HTTP_STATUS.NOT_FOUND })
    }
    if (pkg.status !== 'ACTIVE') {
      return sendError(res, { message: 'Selected package is not active or available', statusCode: HTTP_STATUS.BAD_REQUEST })
    }
    const packagePrice = Number(pkg.price) || 0
    let gstPercentage = 0
    if (pkg.categoryId) {
      const { LabourCategory } = await import('../models/LabourCategory.js')
      const category = await LabourCategory.findById(pkg.categoryId)
      if (category && category.isGstActive) {
        gstPercentage = category.gstPercentage || 0
      }
    }
    const taxes = gstPercentage > 0 ? (packagePrice * gstPercentage) / 100 : 0
    eligibleAmount = packagePrice + taxes
  } else if (serviceId) {
    const { LabourService } = await import('../models/LabourService.js')
    const service = await LabourService.findById(serviceId).lean()
    if (!service) {
      return sendError(res, { message: 'Service not found', statusCode: HTTP_STATUS.NOT_FOUND })
    }
    const basePrice = Number(service.hourlyPrice || service.basePrice || service.pricePerUnit || 0)
    let gstPercentage = 0
    if (service.categoryId) {
      const { LabourCategory } = await import('../models/LabourCategory.js')
      const category = await LabourCategory.findById(service.categoryId)
      if (category && category.isGstActive) {
        gstPercentage = category.gstPercentage || 0
      }
    }
    const taxes = gstPercentage > 0 ? (basePrice * gstPercentage) / 100 : 0
    eligibleAmount = basePrice + taxes
  } else if (eligibleOrderAmount !== undefined || eligibleBillAmount !== undefined) {
    const rawAmt = eligibleOrderAmount !== undefined ? eligibleOrderAmount : eligibleBillAmount
    if (rawAmt === null || typeof rawAmt === 'boolean' || isNaN(Number(rawAmt)) || Number(rawAmt) < 0) {
      return sendError(res, { message: 'Invalid eligible order amount: must be a non-negative number', statusCode: HTTP_STATUS.BAD_REQUEST })
    }
    eligibleAmount = Number(rawAmt)
  } else {
    return sendError(res, { message: 'Please provide serviceId, packageId, or eligibleOrderAmount', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const calculation = await calculateWalletDiscount(userId, eligibleAmount)

  const checkoutData = {
    eligibleOrderAmount: calculation.eligibleOrderAmount,
    walletBalance: calculation.walletBalance,
    walletUsagePercentage: calculation.walletUsagePercentage,
    maxWalletUsage: calculation.maxWalletUsage,
    walletDeduction: calculation.walletDeduction,
    remainingPayable: calculation.remainingPayable,
  }

  return sendSuccess(res, {
    message: 'Checkout calculation completed',
    checkout: checkoutData,
    data: {
      checkout: checkoutData,
      walletInfo: calculation,
    },
  })
})
