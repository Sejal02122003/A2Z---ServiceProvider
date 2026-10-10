import mongoose from 'mongoose'
import { Wallet } from '../models/Wallet.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
import { WalletSetting } from '../models/WalletSetting.js'
import { AdminWallet } from '../models/AdminWallet.js'
import { Booking } from '../models/Booking.js'
import { getWalletSettings } from './userWalletService.js'

/**
 * Get or create Labour Wallet
 */
export async function getOrCreateLabourWallet(userId, session = null) {
  let query = Wallet.findOne({ userId })
  if (session) query = query.session(session)
  let wallet = await query

  if (!wallet) {
    const createData = {
      userId,
      selfBalance: 0,
      balance: 0,
      reservedBalance: 0,
      adminBalance: 0,
      isActive: true,
    }
    if (session) {
      const created = await Wallet.create([createData], { session })
      wallet = created[0]
    } else {
      wallet = await Wallet.create(createData)
    }
  }

  return wallet
}

/**
 * Get detailed Labour Wallet state including available balance and settings
 */
export async function getLabourWalletDetails(userId) {
  const [wallet, settings] = await Promise.all([
    getOrCreateLabourWallet(userId),
    getWalletSettings(),
  ])

  const currentBalance = Number(wallet.selfBalance !== undefined ? wallet.selfBalance : (wallet.balance || 0))
  const reservedBalance = Math.max(0, Number(wallet.reservedBalance || 0))
  const availableBalance = Math.max(0, currentBalance - reservedBalance)
  const adminBalance = Math.max(0, Number(wallet.adminBalance || 0))
  const minimumRequiredBalance = Math.max(0, Number(settings.minimumLabourWalletBalance || 0))
  const isWalletEnabled = Boolean(settings.enabled ?? true)

  return {
    walletId: wallet._id,
    userId: wallet.userId,
    currentBalance,
    reservedBalance,
    availableBalance,
    adminBalance,
    minimumRequiredBalance,
    isWalletEnabled,
    isLowBalance: availableBalance < minimumRequiredBalance,
    isActive: Boolean(wallet.isActive ?? true),
    currency: wallet.currency || 'INR',
    updatedAt: wallet.updatedAt,
  }
}

/**
 * Check whether a labourer can accept a booking based on wallet balance.
 * 
 * Rules:
 * 1. availableWalletBalance >= bookingAmount (canonical payable amount from DB)
 * 2. availableWalletBalance >= minimumLabourWalletBalance (admin configured minimum)
 */
export async function checkLabourBookingEligibility({ labourId, bookingId, booking = null }) {
  let targetBooking = booking
  if (!targetBooking && bookingId) {
    targetBooking = await Booking.findById(bookingId).lean()
  }

  if (!targetBooking) {
    return {
      eligible: false,
      reason: 'Booking not found',
      code: 'BOOKING_NOT_FOUND',
    }
  }

  const walletDetails = await getLabourWalletDetails(labourId)
  if (!walletDetails.isActive) {
    return {
      eligible: false,
      reason: 'Labour wallet is suspended or inactive',
      code: 'WALLET_INACTIVE',
      walletDetails,
    }
  }

  // Canonical payable amount for the booking
  const bookingAmount = Number(targetBooking.totalAmount || targetBooking.basePrice || 0)
  const availableBalance = walletDetails.availableBalance
  const minRequired = walletDetails.minimumRequiredBalance

  // 1. Primary Rule: availableWalletBalance >= bookingAmount
  if (availableBalance < bookingAmount) {
    const requiredTopUp = Math.max(0, Math.max(bookingAmount, minRequired) - availableBalance)
    return {
      eligible: false,
      code: 'INSUFFICIENT_WALLET_BALANCE',
      bookingAmount,
      availableWalletBalance: availableBalance,
      currentBalance: walletDetails.currentBalance,
      reservedBalance: walletDetails.reservedBalance,
      minimumWalletBalance: minRequired,
      requiredTopUp,
      reason: `Insufficient wallet balance to accept this booking. Booking amount: ₹${bookingAmount}. Available wallet balance: ₹${availableBalance}. Please recharge your wallet.`,
    }
  }

  // 2. Admin Minimum Policy: availableWalletBalance >= minimumRequiredBalance
  if (minRequired > 0 && availableBalance < minRequired) {
    const requiredTopUp = Math.max(0, minRequired - availableBalance)
    return {
      eligible: false,
      code: 'BELOW_MINIMUM_WALLET_BALANCE',
      bookingAmount,
      availableWalletBalance: availableBalance,
      minimumWalletBalance: minRequired,
      requiredTopUp,
      reason: `Wallet balance is below the minimum required balance of ₹${minRequired}. Available wallet balance: ₹${availableBalance}. Please recharge your wallet.`,
    }
  }

  return {
    eligible: true,
    bookingAmount,
    availableWalletBalance: availableBalance,
    minimumWalletBalance: minRequired,
    walletDetails,
  }
}

/**
 * Concurrency-safe reservation of expected platform charges for cash bookings.
 * Only reserves the expected platform recovery (platformFee + taxes + commissionAmount),
 * NOT the full customer booking amount.
 */
export async function reserveCashBookingCharges({ labourId, booking }) {
  if (booking.paymentMethod !== 'CASH') {
    return { reserved: true, reservedAmount: 0 }
  }

  const bookingAmount = Number(booking.totalAmount || booking.basePrice || 0)
  const expectedCharges = Math.max(
    0,
    Number((booking.platformFee || 0) + (booking.taxes || 0) + (booking.commissionAmount || 0))
  )

  // Ensure wallet document exists
  await getOrCreateLabourWallet(labourId)

  // Atomic reservation update:
  // Only succeeds if (selfBalance - reservedBalance) >= bookingAmount
  const updatedWallet = await Wallet.findOneAndUpdate(
    {
      userId: labourId,
      $expr: {
        $gte: [
          { $subtract: [{ $ifNull: ['$selfBalance', '$balance'] }, { $ifNull: ['$reservedBalance', 0] }] },
          bookingAmount,
        ],
      },
    },
    {
      $inc: { reservedBalance: expectedCharges },
    },
    { new: true }
  )

  if (!updatedWallet) {
    return {
      reserved: false,
      error: 'CONCURRENT_INSUFFICIENT_BALANCE',
      message: 'Wallet balance is no longer sufficient to reserve booking charges.',
    }
  }

  return {
    reserved: true,
    reservedAmount: expectedCharges,
    reservedBalance: updatedWallet.reservedBalance,
    availableBalance: Math.max(0, (updatedWallet.selfBalance || 0) - (updatedWallet.reservedBalance || 0)),
  }
}

/**
 * Release reserved charges upon cancellation or assignment release
 */
export async function releaseCashBookingCharges({ labourId, bookingId = null, amount }) {
  const releaseAmount = Math.max(0, Number(amount || 0))
  if (releaseAmount <= 0) return { released: true, releasedAmount: 0 }

  const wallet = await Wallet.findOneAndUpdate(
    { userId: labourId },
    {
      $inc: { reservedBalance: -releaseAmount },
    },
    { new: true }
  )

  if (wallet && wallet.reservedBalance < 0) {
    wallet.reservedBalance = 0
    await wallet.save()
  }

  return {
    released: true,
    releasedAmount: releaseAmount,
    reservedBalance: wallet ? wallet.reservedBalance : 0,
  }
}

/**
 * Perform atomic and idempotent cash booking settlement upon completion.
 * Recovers exact existing platform charges: commission + platformFee + taxes (GST).
 * Labour retains the full cash received from customer.
 */
export async function settleCashBookingPayment({ bookingId, labourId = null, session = null }) {
  const booking = await Booking.findById(bookingId).session(session)
  if (!booking) {
    throw new Error('Booking not found for settlement')
  }

  if (booking.paymentMethod !== 'CASH') {
    return {
      settled: true,
      isCash: false,
      message: 'Not a cash booking; settlement follows online payout workflow.',
    }
  }

  const effectiveLabourId = labourId || booking.laborId || booking.acceptedLabourId
  if (!effectiveLabourId) {
    throw new Error('No labourer assigned to booking for settlement')
  }

  const idempotencyKey = `SETTLE_CASH_${booking._id}_${effectiveLabourId}`

  // Check if settlement transaction already exists (idempotent protection)
  const existingTx = await WalletTransaction.findOne({ idempotencyKey }).session(session)
  if (existingTx) {
    return {
      settled: true,
      alreadySettled: true,
      transaction: existingTx,
      chargesBreakdown: existingTx.chargesBreakdown,
      bookingId: booking._id,
    }
  }

  // Exact canonical charges calculated by the existing billing engine
  const commission = Number(booking.commissionAmount || 0)
  const platformFee = Number(booking.platformFee || 0)
  const gst = Number(booking.taxes || 0)
  const totalCharges = commission + platformFee + gst

  const wallet = await getOrCreateLabourWallet(effectiveLabourId, session)

  const balanceBefore = Number(wallet.selfBalance !== undefined ? wallet.selfBalance : (wallet.balance || 0))
  let deductionAmount = totalCharges
  let unpaidDues = 0

  // If wallet balance is less than total charges, deduct down to 0 and record outstanding dues in adminBalance
  if (balanceBefore < totalCharges) {
    deductionAmount = Math.max(0, balanceBefore)
    unpaidDues = totalCharges - deductionAmount
  }

  const balanceAfter = Math.max(0, balanceBefore - deductionAmount)

  // Release held reservation if any
  const reservationToRelease = totalCharges
  const newReservedBalance = Math.max(0, (wallet.reservedBalance || 0) - reservationToRelease)

  // Update wallet atomically
  wallet.selfBalance = balanceAfter
  wallet.balance = balanceAfter
  wallet.reservedBalance = newReservedBalance
  if (unpaidDues > 0) {
    wallet.adminBalance = (wallet.adminBalance || 0) + unpaidDues
  }
  await wallet.save({ session })

  // Record immutable ledger entry
  const txNumber = `WTX_${Date.now()}_${String(booking._id).slice(-4)}`
  const tx = await WalletTransaction.create(
    [
      {
        walletId: wallet._id,
        userId: effectiveLabourId,
        labourId: effectiveLabourId,
        bookingId: booking._id,
        transactionId: txNumber,
        amount: totalCharges,
        type: 'DEBIT',
        targetWallet: 'ADMIN',
        context: 'CASH_BOOKING_SETTLEMENT',
        balanceBefore,
        balanceAfter,
        chargesBreakdown: {
          commission,
          platformFee,
          gst,
          totalDeducted: deductionAmount,
        },
        referenceType: 'BOOKING',
        referenceId: booking._id,
        idempotencyKey,
        description: `Platform fee (₹${platformFee}), Commission (₹${commission}) & GST (₹${gst}) recovered for Cash Booking #${String(booking._id).slice(-6).toUpperCase()}${unpaidDues > 0 ? ` (₹${unpaidDues} added to outstanding dues)` : ''}`,
        status: unpaidDues > 0 ? 'PARTIAL' : 'COMPLETED',
      },
    ],
    { session }
  )

  // Update AdminWallet splits
  if (platformFee > 0 || commission > 0 || booking.basePrice > 0 || gst > 0) {
    let adminWallet = await AdminWallet.findOne().session(session)
    if (!adminWallet) {
      adminWallet = new AdminWallet()
    }
    adminWallet.totalPlatformFeesCollected += platformFee
    adminWallet.totalCommissionsCollected += commission
    adminWallet.totalTaxesCollected += gst
    adminWallet.totalServiceAmountCollected += booking.basePrice || 0
    await adminWallet.save({ session })
  }

  // Update booking status
  booking.adminSettlementStatus = 'SETTLED'
  booking.paymentStatus = 'PAID'
  await booking.save({ session })

  return {
    settled: true,
    alreadySettled: false,
    transaction: tx[0],
    chargesBreakdown: {
      commission,
      platformFee,
      gst,
      totalCharges,
      deductedFromWallet: deductionAmount,
      outstandingDuesAdded: unpaidDues,
    },
    balanceBefore,
    balanceAfter,
    bookingId: booking._id,
  }
}

/**
 * Top up / recharge a labour's wallet
 */
export async function rechargeLabourWallet({
  labourId,
  amount,
  transactionId = null,
  paymentMethod = 'ONLINE',
  description = 'Wallet recharge',
  session = null,
}) {
  const rechargeAmount = Number(amount)
  if (isNaN(rechargeAmount) || rechargeAmount <= 0) {
    throw new Error('Recharge amount must be a positive number')
  }

  const wallet = await getOrCreateLabourWallet(labourId, session)
  const balanceBefore = Number(wallet.selfBalance !== undefined ? wallet.selfBalance : (wallet.balance || 0))
  const balanceAfter = balanceBefore + rechargeAmount

  wallet.selfBalance = balanceAfter
  wallet.balance = balanceAfter
  await wallet.save({ session })

  const txId = transactionId || `RCH_${Date.now()}_${String(labourId).slice(-4)}`
  const tx = await WalletTransaction.create(
    [
      {
        walletId: wallet._id,
        userId: labourId,
        labourId,
        amount: rechargeAmount,
        type: 'CREDIT',
        targetWallet: 'SELF',
        context: 'WALLET_RECHARGE',
        balanceBefore,
        balanceAfter,
        referenceType: 'PAYMENT',
        transactionId: txId,
        description: `${description} via ${paymentMethod}`,
        status: 'COMPLETED',
      },
    ],
    { session }
  )

  return {
    success: true,
    wallet,
    transaction: tx[0],
    balanceBefore,
    balanceAfter,
  }
}

/**
 * Reverses a cash booking settlement (e.g. admin reversal / full refund)
 */
export async function reverseCashBookingSettlement({ bookingId, reason = 'Admin reversal', adminUserId = null }) {
  const booking = await Booking.findById(bookingId)
  if (!booking) throw new Error('Booking not found')

  const labourId = booking.laborId || booking.acceptedLabourId
  if (!labourId) throw new Error('No labourer associated with booking')

  const originalTx = await WalletTransaction.findOne({
    bookingId: booking._id,
    context: 'CASH_BOOKING_SETTLEMENT',
    status: { $in: ['COMPLETED', 'PARTIAL'] },
  })

  if (!originalTx) {
    throw new Error('No completed settlement transaction found for this booking')
  }

  const idempotencyKey = `REVERSAL_${originalTx._id}`
  const existingReversal = await WalletTransaction.findOne({ idempotencyKey })
  if (existingReversal) {
    return { reversed: true, alreadyReversed: true, transaction: existingReversal }
  }

  const refundAmount = originalTx.chargesBreakdown?.totalDeducted || originalTx.amount || 0
  const wallet = await getOrCreateLabourWallet(labourId)

  const balanceBefore = Number(wallet.selfBalance || 0)
  const balanceAfter = balanceBefore + refundAmount

  wallet.selfBalance = balanceAfter
  wallet.balance = balanceAfter
  await wallet.save()

  const reversalTx = await WalletTransaction.create({
    walletId: wallet._id,
    userId: labourId,
    labourId,
    bookingId: booking._id,
    amount: refundAmount,
    type: 'CREDIT',
    targetWallet: 'SELF',
    context: 'REVERSAL',
    balanceBefore,
    balanceAfter,
    referenceType: 'REVERSAL',
    referenceId: originalTx._id,
    reversalOf: originalTx._id,
    idempotencyKey,
    description: `Reversal of settlement charges for booking #${String(booking._id).slice(-6).toUpperCase()}: ${reason}`,
    status: 'COMPLETED',
  })

  // Mark original transaction as REVERSED
  originalTx.status = 'REVERSED'
  await originalTx.save()

  booking.adminSettlementStatus = 'PENDING'
  await booking.save()

  return {
    reversed: true,
    refundAmount,
    transaction: reversalTx,
    balanceBefore,
    balanceAfter,
  }
}
