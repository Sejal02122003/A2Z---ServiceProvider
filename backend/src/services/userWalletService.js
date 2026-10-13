import mongoose from 'mongoose'
import { Wallet } from '../models/Wallet.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
import { WalletSetting } from '../models/WalletSetting.js'
import { User } from '../models/User.js'
import { Booking } from '../models/Booking.js'

const DEFAULT_SETTINGS = {
  configKey: 'master_wallet_config',
  enabled: true,
  welcomeBonusEnabled: true,
  welcomeBonusAmount: 1000,
  walletDiscountPercentage: 20,
  minimumBookingAmount: 0,
  minimumLabourWalletBalance: 0,
  serviceCreditEnabled: true,
  serviceCreditPercentage: 15,
  serviceCreditMaxAmount: 0,
  serviceCreditMinBookingAmount: 0,
  serviceCreditApplicablePaymentMethods: ['ONLINE', 'CASH'],
  serviceCreditVersion: 1,
}

/**
 * Fetch or initialize master wallet settings
 */
export async function getWalletSettings() {
  let settings = await WalletSetting.findOne({ configKey: 'master_wallet_config' })
    .populate('updatedBy', 'fullName email')
  if (!settings) {
    settings = await WalletSetting.create(DEFAULT_SETTINGS)
  }
  return settings
}

/**
 * Update wallet settings with validation and audit logging
 */
export async function updateWalletSettings(data, adminUserId, updateReason = '') {
  if (!adminUserId) {
    throw new Error('Unauthorized: Admin ID is required to update wallet settings')
  }

  const {
    enabled,
    welcomeBonusEnabled,
    welcomeBonusAmount,
    walletDiscountPercentage,
    minimumBookingAmount,
    minimumLabourWalletBalance,
    serviceCreditEnabled,
    serviceCreditPercentage,
    serviceCreditMaxAmount,
    serviceCreditMinBookingAmount,
    serviceCreditApplicablePaymentMethods,
    reason,
  } = data

  const currentSettings = await getWalletSettings()
  const oldValues = {
    enabled: currentSettings.enabled,
    welcomeBonusEnabled: currentSettings.welcomeBonusEnabled,
    welcomeBonusAmount: currentSettings.welcomeBonusAmount,
    walletDiscountPercentage: currentSettings.walletDiscountPercentage,
    minimumBookingAmount: currentSettings.minimumBookingAmount,
    minimumLabourWalletBalance: currentSettings.minimumLabourWalletBalance,
    serviceCreditEnabled: currentSettings.serviceCreditEnabled,
    serviceCreditPercentage: currentSettings.serviceCreditPercentage,
    serviceCreditMaxAmount: currentSettings.serviceCreditMaxAmount,
    serviceCreditMinBookingAmount: currentSettings.serviceCreditMinBookingAmount,
    serviceCreditApplicablePaymentMethods: currentSettings.serviceCreditApplicablePaymentMethods,
    serviceCreditVersion: currentSettings.serviceCreditVersion,
  }

  const update = {}
  if (enabled !== undefined) update.enabled = Boolean(enabled)
  if (welcomeBonusEnabled !== undefined) update.welcomeBonusEnabled = Boolean(welcomeBonusEnabled)

  if (welcomeBonusAmount !== undefined) {
    const num = Number(welcomeBonusAmount)
    if (isNaN(num) || !Number.isInteger(num) || num < 500 || num > 1500) {
      throw new Error('Welcome bonus amount must be a whole rupee amount between ₹500 and ₹1,500')
    }
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
  if (minimumLabourWalletBalance !== undefined) {
    const num = Number(minimumLabourWalletBalance)
    if (isNaN(num) || num < 0) throw new Error('Minimum labour wallet balance must be >= 0')
    update.minimumLabourWalletBalance = num
  }

  let serviceCreditChanged = false
  if (serviceCreditEnabled !== undefined) {
    update.serviceCreditEnabled = Boolean(serviceCreditEnabled)
    if (update.serviceCreditEnabled !== currentSettings.serviceCreditEnabled) serviceCreditChanged = true
  }

  if (serviceCreditPercentage !== undefined) {
    const num = Number(serviceCreditPercentage)
    if (isNaN(num) || num < 0 || num > 100) {
      throw new Error('Service credit percentage must be a valid number between 0 and 100')
    }
    update.serviceCreditPercentage = num
    if (num !== currentSettings.serviceCreditPercentage) serviceCreditChanged = true
  }

  if (serviceCreditMaxAmount !== undefined) {
    const num = Number(serviceCreditMaxAmount)
    if (isNaN(num) || num < 0) {
      throw new Error('Service credit maximum amount must be >= 0')
    }
    update.serviceCreditMaxAmount = num
    if (num !== currentSettings.serviceCreditMaxAmount) serviceCreditChanged = true
  }

  if (serviceCreditMinBookingAmount !== undefined) {
    const num = Number(serviceCreditMinBookingAmount)
    if (isNaN(num) || num < 0) {
      throw new Error('Service credit minimum booking amount must be >= 0')
    }
    update.serviceCreditMinBookingAmount = num
    if (num !== currentSettings.serviceCreditMinBookingAmount) serviceCreditChanged = true
  }

  if (serviceCreditApplicablePaymentMethods !== undefined) {
    if (!Array.isArray(serviceCreditApplicablePaymentMethods)) {
      throw new Error('Applicable payment methods must be an array')
    }
    const validMethods = ['ONLINE', 'CASH']
    const cleaned = serviceCreditApplicablePaymentMethods
      .map((m) => String(m).toUpperCase())
      .filter((m) => validMethods.includes(m))
    update.serviceCreditApplicablePaymentMethods = cleaned
    serviceCreditChanged = true
  }

  if (serviceCreditChanged) {
    update.serviceCreditVersion = (currentSettings.serviceCreditVersion || 1) + 1
  }

  if (adminUserId) update.updatedBy = adminUserId

  const effectiveReason = reason || updateReason || 'Admin updated wallet configuration'
  const auditEntry = {
    action: 'WALLET_CONFIG_UPDATED',
    performedBy: adminUserId || null,
    timestamp: new Date(),
    oldValues,
    newValues: { ...oldValues, ...update },
    reason: effectiveReason,
  }

  let settings = await WalletSetting.findOneAndUpdate(
    { configKey: 'master_wallet_config' },
    {
      $set: update,
      $push: { auditLog: auditEntry },
    },
    { new: true, upsert: true }
  ).populate('updatedBy', 'fullName email')

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
    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return { credited: false, reason: 'INVALID_USER_ID', bonusAmount: 0 }
    }

    const settings = await getWalletSettings()
    const isEnabled = Boolean(settings.enabled) && settings.welcomeBonusEnabled !== false
    if (!isEnabled) {
      return { credited: false, reason: 'FEATURE_DISABLED', bonusAmount: 0 }
    }

    const bonusAmount = Number(settings.welcomeBonusAmount || 1000)
    if (isNaN(bonusAmount) || bonusAmount < 500 || bonusAmount > 1500) {
      return { credited: false, reason: 'INVALID_CONFIGURED_AMOUNT', bonusAmount: 0 }
    }

    // 1. Fetch user and verify eligibility
    const user = await User.findById(userId)
    if (!user) {
      return { credited: false, reason: 'USER_NOT_FOUND', bonusAmount: 0 }
    }

    // Must be a customer account
    if (user.role !== 'customer') {
      return { credited: false, reason: 'ROLE_NOT_ELIGIBLE', bonusAmount: 0 }
    }

    // Must have phone verified
    if (user.isPhoneVerified !== true) {
      return { credited: false, reason: 'PHONE_NOT_VERIFIED', bonusAmount: 0 }
    }

    // If user already has welcomeBonusCredited flag marked
    if (user.welcomeBonusCredited) {
      return {
        credited: false,
        alreadyCredited: true,
        reason: 'ALREADY_CREDITED',
        bonusAmount: user.welcomeBonusAmount || bonusAmount,
      }
    }

    // 2. Ledger-level duplicate verification: check existing WELCOME_BONUS transaction
    const existingTx = await WalletTransaction.findOne({
      userId,
      $or: [
        { context: 'WELCOME_BONUS' },
        { idempotencyKey: `WELCOME_BONUS_${userId}` },
      ],
    })

    if (existingTx) {
      await User.findByIdAndUpdate(userId, {
        $set: { welcomeBonusCredited: true, welcomeBonusAmount: existingTx.amount },
      })
      await Wallet.findOneAndUpdate({ userId }, { $set: { welcomeBonusCredited: true } })
      return {
        credited: false,
        alreadyCredited: true,
        reason: 'ALREADY_CREDITED_LEDGER_EXISTS',
        bonusAmount: existingTx.amount,
      }
    }

    // 3. Atomic lock on User to prevent concurrent race conditions
    const updatedUser = await User.findOneAndUpdate(
      { _id: userId, welcomeBonusCredited: { $ne: true } },
      {
        $set: {
          welcomeBonusCredited: true,
          welcomeBonusAmount: bonusAmount,
          welcomeBonusCreditedAt: new Date(),
        },
      },
      { new: true }
    )

    if (!updatedUser) {
      return { credited: false, alreadyCredited: true, reason: 'ALREADY_CREDITED_CONCURRENT', bonusAmount: 0 }
    }

    // 4. Get or create customer wallet
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
      return { credited: false, alreadyCredited: true, reason: 'WALLET_ALREADY_CREDITED', bonusAmount: 0 }
    }

    const balanceBefore = wallet.balance !== undefined ? wallet.balance : (wallet.selfBalance || 0)
    const balanceAfter = balanceBefore + bonusAmount
    const idempotencyKey = `WELCOME_BONUS_${userId}`

    // 5. Create transaction and increment wallet with database-level uniqueness
    try {
      const tx = await WalletTransaction.create({
        walletId: wallet._id,
        userId,
        amount: bonusAmount,
        type: 'CREDIT',
        targetWallet: 'SELF',
        context: 'WELCOME_BONUS',
        balanceBefore,
        balanceAfter,
        referenceType: 'WELCOME_BONUS',
        idempotencyKey,
        description: `Welcome bonus of ₹${bonusAmount.toLocaleString('en-IN')} credited on registration`,
        status: 'COMPLETED',
      })

      await Wallet.updateOne(
        { _id: wallet._id },
        {
          $inc: { balance: bonusAmount, selfBalance: bonusAmount },
          $set: { welcomeBonusCredited: true },
        }
      )

      console.log(`[WALLET] Welcome bonus credited userId: ${userId} amount: ₹${bonusAmount}`)
      return {
        credited: true,
        bonusAmount,
        balanceBefore,
        balanceAfter,
        transactionId: tx._id,
        message: `₹${bonusAmount.toLocaleString('en-IN')} welcome bonus added to your wallet`,
      }
    } catch (txErr) {
      if (txErr.code === 11000 || txErr.message?.includes('duplicate key')) {
        console.warn(`[WALLET_IDEMPOTENCY] Duplicate key detected on welcome bonus for user ${userId}`)
        return {
          credited: false,
          alreadyCredited: true,
          reason: 'DUPLICATE_KEY_ALREADY_CREDITED',
          bonusAmount,
        }
      }
      // Revert user flag if unexpected error occurred
      await User.findByIdAndUpdate(userId, {
        $set: { welcomeBonusCredited: false, welcomeBonusAmount: 0 },
      })
      throw txErr
    }
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
    balanceBefore,
    balanceAfter,
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

/**
 * Deliver asynchronous notifications and real-time socket updates for service credits
 */
async function deliverServiceCreditNotification({
  userId,
  bookingId,
  shortCode,
  creditAmount,
  percentage,
  balanceAfter,
}) {
  try {
    const { InAppNotification, NOTIFICATION_TYPES } = await import('../models/InAppNotification.js')
    await InAppNotification.create({
      userId,
      title: 'Wallet Cashback Credited',
      body: `₹${creditAmount} has been credited to your A2Z wallet (${percentage}% service reward) for completed booking #${shortCode}.`,
      type: NOTIFICATION_TYPES?.WALLET_CREDIT || 'WALLET_CREDIT',
      bookingId,
    })
  } catch (e) {
    console.warn('[InAppNotification Warning]', e?.message)
  }

  try {
    const { sendNotificationToUser } = await import('../utils/pushNotificationHelper.js')
    await sendNotificationToUser(userId, {
      title: 'Wallet Cashback Credited',
      body: `₹${creditAmount} has been credited to your A2Z wallet for booking #${shortCode}.`,
      data: {
        type: 'WALLET_CREDIT',
        bookingId: String(bookingId),
        creditAmount: String(creditAmount),
        balanceAfter: String(balanceAfter),
      },
    })
  } catch (e) {
    console.warn('[Push Notification Warning]', e?.message)
  }

  try {
    const { emitToUser } = await import('../socket.js')
    emitToUser(userId, 'WALLET_UPDATED', {
      balance: balanceAfter,
      creditAmount,
      type: 'SERVICE_CREDIT',
      bookingId,
    })
  } catch (e) {
    console.warn('[Socket Warning]', e?.message)
  }
}

/**
 * Atomically & idempotently calculate and credit 15% (or configured %) of eligible service amount to customer wallet
 * 
 * Formula: Wallet credit = eligible service amount (basePrice) * percentage / 100
 * Example: ₹1,000 eligible amount -> ₹150 credit.
 */
export async function awardServiceCompletionWalletCredit(bookingId) {
  try {
    if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
      return { credited: false, awarded: false, reason: 'INVALID_BOOKING_ID', amount: 0 }
    }

    const booking = await Booking.findById(bookingId).populate('userId')
    if (!booking) {
      return { credited: false, awarded: false, reason: 'BOOKING_NOT_FOUND', amount: 0 }
    }

    // 1. Authoritative lifecycle check: booking status must be COMPLETED
    if (booking.status !== 'COMPLETED') {
      return {
        credited: false,
        awarded: false,
        reason: 'BOOKING_NOT_COMPLETED',
        currentStatus: booking.status,
        amount: 0,
      }
    }

    // 2. Authoritative payment verification: must be PAID
    if (booking.paymentStatus !== 'PAID') {
      return {
        credited: false,
        awarded: false,
        reason: 'PAYMENT_NOT_VERIFIED',
        currentPaymentStatus: booking.paymentStatus,
        amount: 0,
      }
    }

    // 3. Customer ownership verification
    const customerId = booking.userId?._id || booking.userId
    if (!customerId) {
      return { credited: false, awarded: false, reason: 'CUSTOMER_NOT_FOUND', amount: 0 }
    }

    // 4. Idempotency Check A: Booking model flag
    if (booking.serviceCredit?.credited) {
      return {
        credited: false,
        awarded: false,
        alreadyCredited: true,
        reason: 'ALREADY_CREDITED',
        amount: booking.serviceCredit.amount || 0,
        transactionId: booking.serviceCredit.walletTransactionId,
      }
    }

    // 5. Config check: Master wallet enabled and serviceCredit enabled
    const settings = await getWalletSettings()
    if (!settings.enabled || settings.serviceCreditEnabled === false) {
      return { credited: false, awarded: false, reason: 'FEATURE_DISABLED', amount: 0 }
    }

    // 6. Check eligible payment method
    const allowedMethods = settings.serviceCreditApplicablePaymentMethods || ['ONLINE', 'CASH']
    if (!allowedMethods.includes(booking.paymentMethod)) {
      return {
        credited: false,
        awarded: false,
        reason: 'PAYMENT_METHOD_NOT_ELIGIBLE',
        paymentMethod: booking.paymentMethod,
        amount: 0,
      }
    }

    // 7. Calculate eligible service amount:
    // Explicitly uses core basePrice of service, excluding platformFee, taxes, commission, penalties
    const eligibleAmount = Number(booking.basePrice || 0)
    if (isNaN(eligibleAmount) || eligibleAmount <= 0) {
      return { credited: false, awarded: false, reason: 'ZERO_ELIGIBLE_AMOUNT', amount: 0 }
    }

    // Minimum booking amount threshold check
    if (settings.serviceCreditMinBookingAmount > 0 && eligibleAmount < settings.serviceCreditMinBookingAmount) {
      return {
        credited: false,
        awarded: false,
        reason: 'BELOW_MINIMUM_BOOKING_AMOUNT',
        eligibleAmount,
        minRequired: settings.serviceCreditMinBookingAmount,
        amount: 0,
      }
    }

    // 8. Calculate credit amount using integer paise / standard rounding:
    const percentage = Number(settings.serviceCreditPercentage ?? 15)
    let creditAmount = Math.round((eligibleAmount * percentage) / 100)

    // Optional Max Credit Cap per booking
    if (settings.serviceCreditMaxAmount > 0 && creditAmount > settings.serviceCreditMaxAmount) {
      creditAmount = settings.serviceCreditMaxAmount
    }

    if (creditAmount <= 0) {
      return { credited: false, awarded: false, reason: 'CALCULATED_CREDIT_ZERO', amount: 0 }
    }

    const idempotencyKey = `SERVICE_CREDIT_${booking._id}`

    // 9. Idempotency Check B: Existing transaction in ledger
    const existingTx = await WalletTransaction.findOne({ idempotencyKey })
    if (existingTx) {
      await Booking.findByIdAndUpdate(booking._id, {
        $set: {
          'serviceCredit.credited': true,
          'serviceCredit.amount': existingTx.amount,
          'serviceCredit.percentage': percentage,
          'serviceCredit.eligibleAmount': eligibleAmount,
          'serviceCredit.walletTransactionId': existingTx._id,
          'serviceCredit.creditedAt': existingTx.createdAt,
        },
      })
      return {
        credited: false,
        awarded: false,
        alreadyCredited: true,
        reason: 'ALREADY_CREDITED_LEDGER_EXISTS',
        amount: existingTx.amount,
        transactionId: existingTx._id,
      }
    }

    // 10. Atomic lock on Booking to prevent concurrent duplicate credit
    const lockedBooking = await Booking.findOneAndUpdate(
      { _id: booking._id, 'serviceCredit.credited': { $ne: true } },
      {
        $set: {
          'serviceCredit.credited': true,
          'serviceCredit.amount': creditAmount,
          'serviceCredit.percentage': percentage,
          'serviceCredit.eligibleAmount': eligibleAmount,
          'serviceCredit.creditedAt': new Date(),
        },
      },
      { new: true }
    )

    if (!lockedBooking) {
      return {
        credited: false,
        awarded: false,
        alreadyCredited: true,
        reason: 'CONCURRENT_RACE_ALREADY_CREDITED',
        amount: 0,
      }
    }

    // 11. Atomic Wallet Balance Update & Ledger Insertion
    const wallet = await getOrCreateUserWallet(customerId)
    const balanceBefore = wallet.balance !== undefined ? wallet.balance : (wallet.selfBalance || 0)
    const balanceAfter = balanceBefore + creditAmount
    const shortCode = String(booking._id).slice(-6).toUpperCase()

    try {
      const tx = await WalletTransaction.create({
        walletId: wallet._id,
        userId: customerId,
        bookingId: booking._id,
        amount: creditAmount,
        type: 'CREDIT',
        targetWallet: 'SELF',
        context: 'SERVICE_CREDIT',
        balanceBefore,
        balanceAfter,
        referenceType: 'BOOKING',
        referenceId: booking._id,
        idempotencyKey,
        description: `${percentage}% Service Cashback on Booking #${shortCode}`,
        metadata: {
          eligibleAmount,
          appliedPercentage: percentage,
          configVersion: settings.serviceCreditVersion || 1,
          bookingReference: shortCode,
          paymentMethod: booking.paymentMethod,
          maxCapApplied: settings.serviceCreditMaxAmount > 0 && creditAmount === settings.serviceCreditMaxAmount,
        },
        status: 'COMPLETED',
      })

      await Wallet.updateOne(
        { _id: wallet._id },
        { $inc: { balance: creditAmount, selfBalance: creditAmount } }
      )

      await Booking.updateOne(
        { _id: booking._id },
        { $set: { 'serviceCredit.walletTransactionId': tx._id } }
      )

      console.log(`[WALLET_SERVICE_CREDIT] Credited ₹${creditAmount} (${percentage}%) to customer ${customerId} for booking ${booking._id}`)

      // 12. Asynchronous Notifications & Socket Emit (Guarded)
      deliverServiceCreditNotification({
        userId: customerId,
        bookingId: booking._id,
        shortCode,
        creditAmount,
        percentage,
        balanceAfter,
      }).catch((notifErr) => console.warn('[Service Credit Notification Warning]', notifErr?.message))

      return {
        credited: true,
        awarded: true,
        amount: creditAmount,
        creditAmount,
        percentage,
        eligibleAmount,
        balanceBefore,
        balanceAfter,
        transactionId: tx._id,
        message: `₹${creditAmount} credited to wallet for completed booking`,
      }
    } catch (txErr) {
      // Handle MongoDB unique key duplicate safely
      if (txErr.code === 11000 || txErr.message?.includes('duplicate key')) {
        console.warn(`[WALLET_IDEMPOTENCY] Duplicate key detected on service credit for booking ${booking._id}`)
        return {
          credited: false,
          alreadyCredited: true,
          reason: 'DUPLICATE_KEY_ALREADY_CREDITED',
          amount: creditAmount,
        }
      }

      // Revert booking lock if unexpected failure
      await Booking.findByIdAndUpdate(booking._id, {
        $set: { 'serviceCredit.credited': false, 'serviceCredit.amount': 0 },
      })
      throw txErr
    }
  } catch (err) {
    console.error(`[WALLET_SERVICE_CREDIT_ERROR] Error awarding service credit for booking ${bookingId}:`, err)
    return { credited: false, error: err.message, amount: 0 }
  }
}

/**
 * Reverse a service credit upon booking refund, cancellation or dispute
 * 
 * If the customer has already spent the credit, we never force the wallet balance negative;
 * we recover whatever balance is currently available, record any unrecovered amount in metadata,
 * and create an explicit REVERSAL transaction.
 */
export async function reverseServiceCompletionWalletCredit({ bookingId, reason, adminUserId }) {
  try {
    if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
      return { reversed: false, reason: 'INVALID_BOOKING_ID' }
    }

    const booking = await Booking.findById(bookingId)
    if (!booking) {
      return { reversed: false, reason: 'BOOKING_NOT_FOUND' }
    }

    if (!booking.serviceCredit?.credited) {
      return { reversed: false, reason: 'NO_CREDIT_TO_REVERSE' }
    }

    if (booking.serviceCredit.reversed) {
      return { reversed: false, alreadyReversed: true, reason: 'ALREADY_REVERSED' }
    }

    const originalCreditAmount = Number(booking.serviceCredit.amount || 0)
    if (originalCreditAmount <= 0) {
      return { reversed: false, reason: 'ZERO_ORIGINAL_CREDIT' }
    }

    const customerId = booking.userId?._id || booking.userId
    const wallet = await Wallet.findOne({ userId: customerId })
    if (!wallet) {
      return { reversed: false, reason: 'WALLET_NOT_FOUND' }
    }

    const idempotencyKey = `SERVICE_CREDIT_REVERSAL_${booking._id}`
    const existingReversal = await WalletTransaction.findOne({ idempotencyKey })
    if (existingReversal) {
      await Booking.updateOne(
        { _id: booking._id },
        { $set: { 'serviceCredit.reversed': true, 'serviceCredit.reversalTransactionId': existingReversal._id } }
      )
      return { reversed: false, alreadyReversed: true, reason: 'ALREADY_REVERSED_LEDGER_EXISTS' }
    }

    // Do not force wallet negative if customer already spent part or all of the credit!
    const currentBalance = wallet.balance !== undefined ? wallet.balance : (wallet.selfBalance || 0)
    const actualDeductAmount = Math.min(currentBalance, originalCreditAmount)
    const unrecoveredAmount = originalCreditAmount - actualDeductAmount
    const balanceAfter = Math.max(0, currentBalance - actualDeductAmount)
    const balanceBefore = currentBalance

    const originalTx = await WalletTransaction.findOne({
      bookingId: booking._id,
      context: 'SERVICE_CREDIT',
    })

    const shortCode = String(booking._id).slice(-6).toUpperCase()
    const reversalTx = await WalletTransaction.create({
      walletId: wallet._id,
      userId: customerId,
      bookingId: booking._id,
      amount: actualDeductAmount,
      type: 'DEBIT',
      targetWallet: 'SELF',
      context: 'REVERSAL',
      balanceBefore,
      balanceAfter,
      referenceType: 'BOOKING',
      referenceId: booking._id,
      reversalOf: originalTx?._id || null,
      idempotencyKey,
      description: `Reversal of Service Cashback for Booking #${shortCode}: ${reason || 'Booking refunded/cancelled'}`,
      metadata: {
        originalCreditAmount,
        actualDeductAmount,
        unrecoveredAmount,
        reason: reason || 'Booking refunded/cancelled',
        reversedBy: adminUserId || null,
      },
      status: 'COMPLETED',
    })

    if (actualDeductAmount > 0) {
      await Wallet.updateOne(
        { _id: wallet._id },
        { $inc: { balance: -actualDeductAmount, selfBalance: -actualDeductAmount } }
      )
    }

    await Booking.updateOne(
      { _id: booking._id },
      {
        $set: {
          'serviceCredit.reversed': true,
          'serviceCredit.reversedAt': new Date(),
          'serviceCredit.reversalTransactionId': reversalTx._id,
        },
      }
    )

    console.log(`[WALLET_REVERSAL] Reversed service credit for booking ${booking._id}: deducted ₹${actualDeductAmount}, unrecovered ₹${unrecoveredAmount}`)

    return {
      reversed: true,
      originalCreditAmount,
      deductedAmount: actualDeductAmount,
      reversedAmount: actualDeductAmount,
      unrecoveredAmount,
      balanceBefore,
      balanceAfter,
      transactionId: reversalTx._id,
    }
  } catch (err) {
    console.error(`[WALLET_REVERSAL_ERROR] Failed to reverse service credit for booking ${bookingId}:`, err)
    return { reversed: false, error: err.message }
  }
}
