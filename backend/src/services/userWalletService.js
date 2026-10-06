import mongoose from 'mongoose'
import { Wallet } from '../models/Wallet.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
import { WalletSetting } from '../models/WalletSetting.js'
import { User } from '../models/User.js'

const DEFAULT_SETTINGS = {
  configKey: 'master_wallet_config',
  enabled: true,
  welcomeBonusAmount: 100,
  walletDiscountPercentage: 20,
  minimumBookingAmount: 0,
}

/**
 * Fetch or initialize master wallet settings
 */
export async function getWalletSettings() {
  let settings = await WalletSetting.findOne({ configKey: 'master_wallet_config' })
  if (!settings) {
    settings = await WalletSetting.create(DEFAULT_SETTINGS)
  }
  return settings
}

/**
 * Update wallet settings with validation
 */
export async function updateWalletSettings(data, adminUserId) {
  const { enabled, welcomeBonusAmount, walletDiscountPercentage, minimumBookingAmount } = data

  const update = {}
  if (enabled !== undefined) update.enabled = Boolean(enabled)
  if (welcomeBonusAmount !== undefined) {
    const num = Number(welcomeBonusAmount)
    if (isNaN(num) || num < 0) throw new Error('Welcome bonus amount must be >= 0')
    update.welcomeBonusAmount = num
  }
  if (walletDiscountPercentage !== undefined) {
    const num = Number(walletDiscountPercentage)
    if (isNaN(num) || num < 0 || num > 100) throw new Error('Wallet discount percentage must be between 0 and 100')
    update.walletDiscountPercentage = num
  }
  if (minimumBookingAmount !== undefined) {
    const num = Number(minimumBookingAmount)
    if (isNaN(num) || num < 0) throw new Error('Minimum booking amount must be >= 0')
    update.minimumBookingAmount = num
  }
  if (adminUserId) update.updatedBy = adminUserId

  let settings = await WalletSetting.findOneAndUpdate(
    { configKey: 'master_wallet_config' },
    { $set: update },
    { new: true, upsert: true }
  )
  return settings
}

/**
 * Get or create a User's wallet document
 */
export async function getOrCreateUserWallet(userId) {
  let wallet = await Wallet.findOne({ userId })
  if (!wallet) {
    wallet = await Wallet.create({
      userId,
      balance: 0,
      selfBalance: 0,
      welcomeBonusCredited: false,
    })
  }
  return wallet
}

/**
 * Idempotently and atomically credit the Welcome Bonus if eligible
 */
export async function ensureWelcomeBonus(userId) {
  try {
    const settings = await getWalletSettings()
    if (!settings.enabled || Number(settings.welcomeBonusAmount) <= 0) {
      return { credited: false, reason: 'WALLET_DISABLED_OR_ZERO_BONUS', bonusAmount: 0 }
    }

    const bonusAmount = Number(settings.welcomeBonusAmount)

    // Check user eligibility flag
    const user = await User.findById(userId)
    if (!user || user.welcomeBonusCredited) {
      return { credited: false, reason: 'ALREADY_CREDITED_OR_USER_NOT_FOUND', bonusAmount: 0 }
    }

    // Atomic update on User first to prevent race conditions
    const updatedUser = await User.findOneAndUpdate(
      { _id: userId, welcomeBonusCredited: false },
      { $set: { welcomeBonusCredited: true } },
      { new: true }
    )

    if (!updatedUser) {
      return { credited: false, reason: 'ALREADY_CREDITED_CONCURRENT', bonusAmount: 0 }
    }

    // Get or create wallet
    let wallet = await Wallet.findOne({ userId })
    if (!wallet) {
      wallet = await Wallet.create({
        userId,
        balance: 0,
        selfBalance: 0,
        welcomeBonusCredited: false,
      })
    }

    if (wallet.welcomeBonusCredited) {
      return { credited: false, reason: 'WALLET_ALREADY_CREDITED', bonusAmount: 0 }
    }

    const balanceBefore = wallet.balance || wallet.selfBalance || 0
    const balanceAfter = balanceBefore + bonusAmount

    // Atomically increment wallet
    await Wallet.updateOne(
      { _id: wallet._id },
      {
        $inc: { balance: bonusAmount, selfBalance: bonusAmount },
        $set: { welcomeBonusCredited: true },
      }
    )

    // Create unique audit transaction
    await WalletTransaction.create({
      walletId: wallet._id,
      userId,
      amount: bonusAmount,
      type: 'CREDIT',
      targetWallet: 'SELF',
      context: 'WELCOME_BONUS',
      balanceBefore,
      balanceAfter,
      referenceType: 'WELCOME_BONUS',
      description: `Welcome bonus of ₹${bonusAmount} credited on registration`,
      status: 'COMPLETED',
    })

    console.log(`[WALLET] Welcome bonus credited userId: ${userId} amount: ${bonusAmount}`)
    return { credited: true, bonusAmount, balanceAfter }
  } catch (err) {
    console.error(`[WALLET_ERROR] Failed to credit welcome bonus for user ${userId}:`, err)
    return { credited: false, error: err.message, bonusAmount: 0 }
  }
}

/**
 * Calculate maximum allowable wallet discount for a bill
 */
export async function calculateWalletDiscount(userId, eligibleBillAmount) {
  const billAmount = Math.max(0, Number(eligibleBillAmount) || 0)
  const settings = await getWalletSettings()

  let walletBalance = 0
  if (userId) {
    const wallet = await Wallet.findOne({ userId }).lean()
    if (wallet) {
      walletBalance = wallet.balance !== undefined ? wallet.balance : (wallet.selfBalance || 0)
    }
  }

  if (!settings.enabled || settings.walletDiscountPercentage <= 0) {
    return {
      enabled: false,
      walletBalance,
      maxWalletDiscount: 0,
      actualWalletDiscount: 0,
      eligibleBillAmount: billAmount,
      discountPercentage: settings.walletDiscountPercentage || 0,
      minimumBookingAmount: settings.minimumBookingAmount || 0,
    }
  }

  if (settings.minimumBookingAmount > 0 && billAmount < settings.minimumBookingAmount) {
    return {
      enabled: true,
      meetsMinimum: false,
      walletBalance,
      maxWalletDiscount: 0,
      actualWalletDiscount: 0,
      eligibleBillAmount: billAmount,
      discountPercentage: settings.walletDiscountPercentage,
      minimumBookingAmount: settings.minimumBookingAmount,
    }
  }

  const maxPercentageDiscount = Math.round((billAmount * settings.walletDiscountPercentage) / 100)
  const actualWalletDiscount = Math.min(walletBalance, maxPercentageDiscount)

  return {
    enabled: true,
    meetsMinimum: true,
    walletBalance,
    maxWalletDiscount: maxPercentageDiscount,
    actualWalletDiscount: Math.max(0, actualWalletDiscount),
    eligibleBillAmount: billAmount,
    discountPercentage: settings.walletDiscountPercentage,
    minimumBookingAmount: settings.minimumBookingAmount,
  }
}

/**
 * Atomically deduct wallet balance for confirmed booking
 */
export async function deductWalletForBooking({ userId, bookingId, eligibleBillAmount, requestedUseWallet }) {
  if (!requestedUseWallet || !userId) {
    return { applied: false, amount: 0, walletTransactionId: null }
  }

  const calculation = await calculateWalletDiscount(userId, eligibleBillAmount)
  const deductionAmount = calculation.actualWalletDiscount

  if (deductionAmount <= 0) {
    return { applied: false, amount: 0, walletTransactionId: null }
  }

  // Atomic deduction: ensure balance >= deductionAmount
  const wallet = await Wallet.findOneAndUpdate(
    {
      userId,
      $or: [
        { balance: { $gte: deductionAmount } },
        { selfBalance: { $gte: deductionAmount } },
      ],
    },
    {
      $inc: { balance: -deductionAmount, selfBalance: -deductionAmount },
    },
    { new: true }
  )

  if (!wallet) {
    console.warn(`[WALLET_ERROR] Insufficient wallet balance for userId: ${userId}, required: ${deductionAmount}`)
    return { applied: false, amount: 0, walletTransactionId: null, error: 'INSUFFICIENT_BALANCE' }
  }

  const balanceAfter = wallet.balance !== undefined ? wallet.balance : (wallet.selfBalance || 0)
  const balanceBefore = balanceAfter + deductionAmount

  const tx = await WalletTransaction.create({
    walletId: wallet._id,
    userId,
    amount: deductionAmount,
    type: 'DEBIT',
    targetWallet: 'SELF',
    context: 'SERVICE_DISCOUNT',
    balanceBefore,
    balanceAfter,
    referenceType: 'BOOKING',
    referenceId: bookingId,
    description: `Service discount applied on booking`,
    status: 'COMPLETED',
  })

  console.log(`[WALLET] Service discount applied userId: ${userId} bookingId: ${bookingId} amount: ${deductionAmount}`)
  return {
    applied: true,
    amount: deductionAmount,
    walletTransactionId: tx._id,
  }
}

/**
 * Refund wallet deduction upon booking cancellation
 */
export async function refundWalletForBooking({ userId, bookingId, amount, reason = 'Booking cancelled' }) {
  const refundAmount = Number(amount)
  if (!userId || isNaN(refundAmount) || refundAmount <= 0) {
    return { refunded: false, amount: 0 }
  }

  // Prevent duplicate refund for same booking
  const existingRefund = await WalletTransaction.findOne({
    userId,
    referenceId: bookingId,
    context: 'REFUND',
  })

  if (existingRefund) {
    console.log(`[WALLET] Refund already processed for bookingId: ${bookingId}`)
    return { refunded: false, alreadyRefunded: true, amount: existingRefund.amount }
  }

  const wallet = await Wallet.findOneAndUpdate(
    { userId },
    { $inc: { balance: refundAmount, selfBalance: refundAmount } },
    { new: true }
  )

  if (!wallet) {
    return { refunded: false, error: 'WALLET_NOT_FOUND' }
  }

  const balanceAfter = wallet.balance !== undefined ? wallet.balance : (wallet.selfBalance || 0)
  const balanceBefore = balanceAfter - refundAmount

  const tx = await WalletTransaction.create({
    walletId: wallet._id,
    userId,
    amount: refundAmount,
    type: 'CREDIT',
    targetWallet: 'SELF',
    context: 'REFUND',
    balanceBefore,
    balanceAfter,
    referenceType: 'BOOKING',
    referenceId: bookingId,
    description: `Wallet refund: ${reason}`,
    status: 'COMPLETED',
  })

  console.log(`[WALLET] Wallet refunded userId: ${userId} bookingId: ${bookingId} amount: ${refundAmount}`)
  return { refunded: true, amount: refundAmount, walletTransactionId: tx._id }
}

/**
 * Admin manual credit or debit adjustment with audit trail
 */
export async function adminAdjustWallet({ userId, amount, type, action, reason, adminUserId }) {
  const adjustAmount = Number(amount)
  const adjustType = (type || action || '').toUpperCase()
  if (isNaN(adjustAmount) || adjustAmount <= 0) {
    throw new Error('Amount must be greater than 0')
  }
  if (!['CREDIT', 'DEBIT'].includes(adjustType)) {
    throw new Error('Adjustment type must be CREDIT or DEBIT')
  }
  if (!reason || !reason.trim()) {
    throw new Error('Reason is required for manual adjustment')
  }

  let wallet = await getOrCreateUserWallet(userId)
  const currentBalance = wallet.balance !== undefined ? wallet.balance : (wallet.selfBalance || 0)

  if (adjustType === 'DEBIT' && currentBalance < adjustAmount) {
    throw new Error(`Insufficient wallet balance. Current balance is ₹${currentBalance}`)
  }

  const delta = adjustType === 'CREDIT' ? adjustAmount : -adjustAmount
  const updatedWallet = await Wallet.findByIdAndUpdate(
    wallet._id,
    { $inc: { balance: delta, selfBalance: delta } },
    { new: true }
  )

  const balanceAfter = updatedWallet.balance !== undefined ? updatedWallet.balance : (updatedWallet.selfBalance || 0)
  const balanceBefore = currentBalance

  const tx = await WalletTransaction.create({
    walletId: wallet._id,
    userId,
    amount: adjustAmount,
    type: adjustType,
    targetWallet: 'SELF',
    context: 'ADMIN_ADJUSTMENT',
    balanceBefore,
    balanceAfter,
    referenceType: 'ADMIN',
    referenceId: adminUserId,
    description: `Admin manual ${adjustType.toLowerCase()}: ${reason.trim()}`,
    status: 'COMPLETED',
  })

  console.log(`[WALLET] Admin adjustment userId: ${userId} type: ${type} amount: ${adjustAmount} by admin: ${adminUserId}`)
  return {
    wallet: updatedWallet,
    transaction: tx,
    balanceBefore,
    balanceAfter,
  }
}
