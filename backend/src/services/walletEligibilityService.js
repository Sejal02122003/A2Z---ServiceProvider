import mongoose from 'mongoose'
import { Wallet } from '../models/Wallet.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
import { WalletEligibilitySetting } from '../models/WalletEligibilitySetting.js'
import { WalletReservation } from '../models/WalletReservation.js'
import { Booking } from '../models/Booking.js'
import { AdminWallet } from '../models/AdminWallet.js'
import { User } from '../models/User.js'
import { InAppNotification, NOTIFICATION_TYPES, DELIVERY_STATUS } from '../models/InAppNotification.js'
import { getOrCreateLabourWallet } from './labourWalletService.js'

export const DEFAULT_ELIGIBILITY_SETTINGS = {
  configKey: 'wallet_eligibility_config',
  minimumWalletBalance: 300,
  commissionPercentage: 25,
  eligibilitySystemEnabled: true,
  commissionReservationEnabled: true,
}

/**
 * Fetch or initialize singleton master wallet eligibility settings
 */
export async function getWalletEligibilitySettings() {
  let settings = await WalletEligibilitySetting.findOne({ configKey: 'wallet_eligibility_config' })
    .populate('updatedBy', 'fullName email')

  if (!settings) {
    settings = await WalletEligibilitySetting.create(DEFAULT_ELIGIBILITY_SETTINGS)
  }
  return settings
}

/**
 * Update wallet eligibility settings with backend validation and audit logging
 */
export async function updateWalletEligibilitySettings(data, adminUserId, reason = 'Admin update') {
  if (!adminUserId) {
    throw new Error('Unauthorized: Admin ID is required to update wallet eligibility settings')
  }

  const {
    minimumWalletBalance,
    commissionPercentage,
    eligibilitySystemEnabled,
    commissionReservationEnabled,
  } = data

  const currentSettings = await getWalletEligibilitySettings()
  const oldValues = {
    minimumWalletBalance: currentSettings.minimumWalletBalance,
    commissionPercentage: currentSettings.commissionPercentage,
    eligibilitySystemEnabled: currentSettings.eligibilitySystemEnabled,
    commissionReservationEnabled: currentSettings.commissionReservationEnabled,
  }

  const update = {}

  if (minimumWalletBalance !== undefined) {
    const num = Number(minimumWalletBalance)
    if (isNaN(num) || !isFinite(num) || num < 0) {
      throw new Error('Minimum wallet balance must be a number greater than or equal to 0')
    }
    update.minimumWalletBalance = Math.round(num * 100) / 100
  }

  if (commissionPercentage !== undefined) {
    const num = Number(commissionPercentage)
    if (isNaN(num) || !isFinite(num) || num < 0 || num > 100) {
      throw new Error('Booking commission percentage must be a number between 0 and 100')
    }
    update.commissionPercentage = Math.round(num * 100) / 100
  }

  if (eligibilitySystemEnabled !== undefined) {
    update.eligibilitySystemEnabled = Boolean(eligibilitySystemEnabled)
  }

  if (commissionReservationEnabled !== undefined) {
    update.commissionReservationEnabled = Boolean(commissionReservationEnabled)
  }

  update.updatedBy = adminUserId

  // Append to audit log
  const auditEntry = {
    action: 'CONFIG_UPDATED',
    updatedBy: adminUserId,
    oldValues,
    newValues: { ...oldValues, ...update },
    reason: String(reason || 'Admin updated wallet eligibility configuration'),
    changedAt: new Date(),
  }

  const updatedSettings = await WalletEligibilitySetting.findOneAndUpdate(
    { configKey: 'wallet_eligibility_config' },
    {
      $set: update,
      $push: { auditLog: auditEntry },
    },
    { new: true, upsert: true }
  ).populate('updatedBy', 'fullName email')

  return updatedSettings
}

/**
 * Shared Decimal-Safe (Integer Paise) Calculation Engine
 * 
 * Booking Commission = Booking Amount × (Commission Percentage / 100)
 * Required Wallet Balance = Minimum Wallet Balance + Booking Commission
 * Available Balance = Wallet Balance - Total Reserved Amount
 * 
 * Booking Eligibility:
 * Available Balance >= Required Wallet Balance
 */
export function calculateEligibility({ wallet, settings, bookingAmount = 0 }) {
  const commPercent = Number(settings?.commissionPercentage ?? DEFAULT_ELIGIBILITY_SETTINGS.commissionPercentage)
  const minRequiredBalance = Number(settings?.minimumWalletBalance ?? DEFAULT_ELIGIBILITY_SETTINGS.minimumWalletBalance)
  const systemEnabled = Boolean(settings?.eligibilitySystemEnabled ?? true)
  const reservationEnabled = Boolean(settings?.commissionReservationEnabled ?? true)

  // Convert all currency values to integer paise to eliminate floating-point errors
  const bookingAmountPaise = Math.max(0, Math.round(Number(bookingAmount || 0) * 100))
  const commPercentInt = commPercent
  const commissionPaise = Math.round((bookingAmountPaise * commPercentInt) / 100)
  const minBalancePaise = Math.max(0, Math.round(minRequiredBalance * 100))
  const requiredBalancePaise = minBalancePaise + commissionPaise

  const actualBalance = Number(wallet?.selfBalance !== undefined ? wallet.selfBalance : (wallet?.balance || 0))
  const walletBalancePaise = Math.round(actualBalance * 100)
  const reservedAmountPaise = Math.max(0, Math.round(Number(wallet?.reservedBalance || 0) * 100))
  const availableBalancePaise = Math.max(0, walletBalancePaise - reservedAmountPaise)

  const isEligible = !systemEnabled || (availableBalancePaise >= requiredBalancePaise)
  const shortagePaise = isEligible ? 0 : Math.max(0, requiredBalancePaise - availableBalancePaise)

  return {
    eligible: isEligible,
    walletBalance: walletBalancePaise / 100,
    reservedAmount: reservedAmountPaise / 100,
    availableBalance: availableBalancePaise / 100,
    minimumBalance: minBalancePaise / 100,
    bookingAmount: bookingAmountPaise / 100,
    commissionPercentage: commPercent,
    estimatedCommission: commissionPaise / 100,
    requiredBalance: requiredBalancePaise / 100,
    shortageAmount: shortagePaise / 100,
    eligibilitySystemEnabled: systemEnabled,
    commissionReservationEnabled: reservationEnabled,
  }
}

/**
 * Check provider booking eligibility for a specific booking or general wallet status
 */
export async function checkProviderBookingEligibility({ providerId, bookingId = null, booking = null }) {
  let targetBooking = booking
  if (!targetBooking && bookingId) {
    targetBooking = await Booking.findById(bookingId).lean()
  }

  const [wallet, settings] = await Promise.all([
    getOrCreateLabourWallet(providerId),
    getWalletEligibilitySettings(),
  ])

  const bookingAmount = targetBooking ? Number(targetBooking.totalAmount || targetBooking.basePrice || 0) : 0
  const calculation = calculateEligibility({ wallet, settings, bookingAmount })

  return {
    ...calculation,
    bookingId: targetBooking?._id || null,
    providerId,
    isActive: Boolean(wallet.isActive ?? true),
  }
}

/**
 * Concurrency-Safe and Atomic Booking Commission Reservation
 * 
 * Reserves the exact estimated commission upon booking acceptance.
 * Checks eligibility authoritatively inside the database atomic operation.
 */
export async function reserveBookingCommission({ providerId, booking, session = null }) {
  const settings = await getWalletEligibilitySettings()

  // Ensure wallet exists
  const wallet = await getOrCreateLabourWallet(providerId, session)

  const bookingAmount = Number(booking.totalAmount || booking.basePrice || 0)
  const calculation = calculateEligibility({ wallet, settings, bookingAmount })

  if (!calculation.eligible) {
    return {
      reserved: false,
      code: 'LOW_WALLET_BALANCE',
      message: 'Insufficient wallet balance to accept this booking.',
      data: calculation,
    }
  }

  // If commission reservation is disabled by admin, return success with 0 reservation
  if (!calculation.commissionReservationEnabled) {
    return {
      reserved: true,
      reservedAmount: 0,
      data: calculation,
    }
  }

  // Idempotency check: see if active reservation already exists for this booking
  let existingReservation = await WalletReservation.findOne({
    bookingId: booking._id,
    status: 'RESERVED',
  }).session(session)

  if (existingReservation) {
    return {
      reserved: true,
      alreadyReserved: true,
      reservation: existingReservation,
      data: calculation,
    }
  }

  const reserveAmount = calculation.estimatedCommission
  const requiredBalance = calculation.requiredBalance

  // Concurrency-safe atomic reservation using conditional update
  // Only succeeds if (selfBalance - reservedBalance) >= requiredBalance
  const updatedWallet = await Wallet.findOneAndUpdate(
    {
      userId: providerId,
      $expr: {
        $gte: [
          { $subtract: [{ $ifNull: ['$selfBalance', '$balance'] }, { $ifNull: ['$reservedBalance', 0] }] },
          requiredBalance,
        ],
      },
    },
    {
      $inc: { reservedBalance: reserveAmount },
    },
    { new: true, session }
  )

  if (!updatedWallet) {
    return {
      reserved: false,
      code: 'LOW_WALLET_BALANCE',
      message: 'Insufficient wallet balance to accept this booking.',
      data: calculation,
    }
  }

  // Create immutable reservation hold document
  const reservationDocs = await WalletReservation.create(
    [
      {
        providerId,
        bookingId: booking._id,
        estimatedBookingAmount: calculation.bookingAmount,
        commissionPercentageSnapshot: calculation.commissionPercentage,
        estimatedCommissionAmount: calculation.estimatedCommission,
        minimumBalanceSnapshot: calculation.minimumBalance,
        reservedAmount: reserveAmount,
        status: 'RESERVED',
      },
    ],
    { session }
  )
  const reservation = reservationDocs[0]

  // Create immutable ledger hold entry
  const txNumber = `WRES_${Date.now()}_${String(booking._id).slice(-4)}`
  await WalletTransaction.create(
    [
      {
        walletId: updatedWallet._id,
        userId: providerId,
        labourId: providerId,
        bookingId: booking._id,
        transactionId: txNumber,
        amount: reserveAmount,
        type: 'HOLD',
        targetWallet: 'ADMIN',
        context: 'BOOKING_COMMISSION_RESERVE',
        balanceBefore: updatedWallet.selfBalance,
        balanceAfter: updatedWallet.selfBalance,
        commissionPercentageSnapshot: calculation.commissionPercentage,
        minimumBalanceSnapshot: calculation.minimumBalance,
        reservedAmount: reserveAmount,
        referenceType: 'BOOKING',
        referenceId: booking._id,
        idempotencyKey: `RESERVE_${booking._id}_${providerId}`,
        description: `Commission reservation of ₹${reserveAmount} (${calculation.commissionPercentage}%) held for Booking #${String(booking._id).slice(-6).toUpperCase()}`,
        status: 'COMPLETED',
      },
    ],
    { session }
  )

  // Attach snapshots to booking
  booking.commissionPercentageSnapshot = calculation.commissionPercentage
  booking.minimumBalanceSnapshot = calculation.minimumBalance
  booking.commissionReservationId = reservation._id
  booking.walletReservationStatus = 'RESERVED'
  await booking.save({ session })

  return {
    reserved: true,
    alreadyReserved: false,
    reservation,
    wallet: updatedWallet,
    data: calculation,
  }
}

/**
 * Idempotent Commission Settlement Workflow upon Booking Completion
 * 
 * 1. Fetches original commission snapshot from reservation / booking.
 * 2. Calculates actual commission using final booking amount.
 * 3. Settles actual commission against provider wallet.
 * 4. Releases held reservation funds safely.
 * 5. Updates reservation status to SETTLED.
 * 6. Creates immutable transaction ledger record.
 */
export async function settleBookingCommission({ bookingId, session = null, actualBookingAmount = null }) {
  const booking = await Booking.findById(bookingId).session(session)
  if (!booking) {
    throw new Error('Booking not found for commission settlement')
  }

  const effectiveProviderId = booking.laborId || booking.acceptedLabourId || (booking.assignments && booking.assignments.find(a => a.labourId)?.labourId)
  if (!effectiveProviderId) {
    throw new Error('No service provider associated with booking for settlement')
  }

  const reservation = await WalletReservation.findOne({
    bookingId: booking._id,
  }).session(session)

  // Check if already settled
  if (reservation && reservation.status === 'SETTLED') {
    return {
      settled: true,
      alreadySettled: true,
      reservation,
    }
  }

  const idempotencyKey = `SETTLE_COMM_${booking._id}_${effectiveProviderId}`
  const existingTx = await WalletTransaction.findOne({ idempotencyKey }).session(session)
  if (existingTx) {
    return {
      settled: true,
      alreadySettled: true,
      transaction: existingTx,
      bookingId: booking._id,
    }
  }

  // Retrieve original snapshots from reservation or booking or fallback to active settings
  const commPercent = Number(reservation?.commissionPercentageSnapshot ?? booking.commissionPercentageSnapshot ?? 25)
  const minBalSnapshot = Number(reservation?.minimumBalanceSnapshot ?? booking.minimumBalanceSnapshot ?? 300)
  const originalReserved = Number(reservation?.reservedAmount || 0)

  // Calculate actual applicable commission
  const finalAmount = actualBookingAmount !== null && actualBookingAmount !== undefined
    ? Number(actualBookingAmount)
    : Number(booking.totalAmount || booking.basePrice || 0)
  const finalAmountPaise = Math.round(finalAmount * 100)
  const actualCommissionPaise = Math.round((finalAmountPaise * commPercent) / 100)
  const actualCommission = actualCommissionPaise / 100

  const wallet = await getOrCreateLabourWallet(effectiveProviderId, session)
  const currentBalance = Number(wallet.selfBalance !== undefined ? wallet.selfBalance : (wallet.balance || 0))

  let deductionAmount = actualCommission
  let unpaidDues = 0

  // For CASH bookings, commission must be recovered from provider wallet.
  // For ONLINE bookings, commission is recovered from customer payment directly.
  const isCash = booking.paymentMethod === 'CASH'

  if (isCash) {
    if (currentBalance < actualCommission) {
      deductionAmount = Math.max(0, currentBalance)
      unpaidDues = actualCommission - deductionAmount
    }
  } else {
    // Online booking: commission was already withheld from the payout to provider
    deductionAmount = 0
    unpaidDues = 0
  }

  const newBalance = Math.max(0, currentBalance - deductionAmount)
  const newReservedBalance = Math.max(0, (wallet.reservedBalance || 0) - originalReserved)

  wallet.selfBalance = newBalance
  wallet.balance = newBalance
  wallet.reservedBalance = newReservedBalance
  if (unpaidDues > 0) {
    wallet.adminBalance = (wallet.adminBalance || 0) + unpaidDues
  }
  await wallet.save({ session })

  // Update reservation record to SETTLED
  if (reservation) {
    reservation.status = 'SETTLED'
    reservation.settledAmount = actualCommission
    reservation.settledAt = new Date()
    await reservation.save({ session })
  }

  // Update Admin Wallet commissions collected
  if (actualCommission > 0) {
    let adminWallet = await AdminWallet.findOne().session(session)
    if (!adminWallet) adminWallet = new AdminWallet()
    adminWallet.totalCommissionsCollected += actualCommission
    await adminWallet.save({ session })
  }

  // Create immutable ledger entry
  const txNumber = `WSET_${Date.now()}_${String(booking._id).slice(-4)}`
  const txDocs = await WalletTransaction.create(
    [
      {
        walletId: wallet._id,
        userId: effectiveProviderId,
        labourId: effectiveProviderId,
        bookingId: booking._id,
        transactionId: txNumber,
        amount: actualCommission,
        type: 'DEBIT',
        targetWallet: 'ADMIN',
        context: 'BOOKING_COMMISSION_SETTLEMENT',
        balanceBefore: currentBalance,
        balanceAfter: newBalance,
        commissionPercentageSnapshot: commPercent,
        minimumBalanceSnapshot: minBalSnapshot,
        reservedAmount: originalReserved,
        chargesBreakdown: {
          commission: actualCommission,
          platformFee: booking.platformFee || 0,
          gst: booking.taxes || 0,
          totalDeducted: deductionAmount,
        },
        referenceType: 'BOOKING',
        referenceId: booking._id,
        idempotencyKey,
        description: `Commission settled: ₹${actualCommission} (${commPercent}%) for Booking #${String(booking._id).slice(-6).toUpperCase()}${unpaidDues > 0 ? ` (₹${unpaidDues} outstanding dues)` : ''}`,
        status: unpaidDues > 0 ? 'PARTIAL' : 'COMPLETED',
      },
    ],
    { session }
  )

  booking.walletReservationStatus = 'SETTLED'
  booking.adminSettlementStatus = 'SETTLED'
  await booking.save({ session })

  return {
    settled: true,
    alreadySettled: false,
    actualCommission,
    deductedFromWallet: deductionAmount,
    reservation,
    transaction: txDocs[0],
    wallet,
  }
}

/**
 * Idempotent Reservation Release Workflow
 * 
 * Called on customer cancellation, provider cancellation, expiration, or failure.
 * Releases the exact reserved hold back to available balance.
 */
export async function releaseBookingCommissionReservation({ bookingId, reason = 'BOOKING_CANCELLED', session = null }) {
  const reservation = await WalletReservation.findOne({
    bookingId,
    status: 'RESERVED',
  }).session(session)

  if (!reservation) {
    return {
      released: true,
      alreadyReleased: true,
      message: 'No active reservation found to release',
    }
  }

  const releaseAmount = Number(reservation.reservedAmount || 0)
  const providerId = reservation.providerId

  // Release hold on provider wallet
  const wallet = await Wallet.findOneAndUpdate(
    { userId: providerId },
    { $inc: { reservedBalance: -releaseAmount } },
    { new: true, session }
  )

  if (wallet && wallet.reservedBalance < 0) {
    wallet.reservedBalance = 0
    await wallet.save({ session })
  }

  // Update reservation status to RELEASED
  reservation.status = 'RELEASED'
  reservation.releasedAmount = releaseAmount
  reservation.releasedAt = new Date()
  reservation.releaseReason = reason
  await reservation.save({ session })

  // Immutable transaction log
  const txNumber = `WREL_${Date.now()}_${String(bookingId).slice(-4)}`
  await WalletTransaction.create(
    [
      {
        walletId: wallet ? wallet._id : null,
        userId: providerId,
        labourId: providerId,
        bookingId,
        transactionId: txNumber,
        amount: releaseAmount,
        type: 'RELEASE',
        targetWallet: 'SELF',
        context: 'BOOKING_COMMISSION_RELEASE',
        balanceBefore: wallet?.selfBalance || 0,
        balanceAfter: wallet?.selfBalance || 0,
        reservedAmount: releaseAmount,
        referenceType: 'BOOKING',
        referenceId: bookingId,
        idempotencyKey: `RELEASE_COMM_${bookingId}_${providerId}`,
        description: `Released commission reservation of ₹${releaseAmount} for Booking #${String(bookingId).slice(-6).toUpperCase()} (${reason})`,
        status: 'COMPLETED',
      },
    ],
    { session }
  )

  // Update booking flag if exists
  await Booking.findByIdAndUpdate(
    bookingId,
    { walletReservationStatus: 'RELEASED' },
    { session }
  )

  return {
    released: true,
    alreadyReleased: false,
    releasedAmount: releaseAmount,
    reservation,
    wallet,
  }
}

/**
 * Dispatch notification when wallet balance is low
 */
export async function notifyLowBalanceProvider({ providerId, shortageAmount, requiredBalance, availableBalance }) {
  try {
    const today = new Date().toISOString().split('T')[0]
    const idempotencyKey = `LOW_BALANCE_${providerId}_${today}`

    const existing = await InAppNotification.findOne({ idempotencyKey })
    if (existing) return

    const title = 'Low Wallet Balance'
    const body = `Your wallet balance is low. Recharge your wallet with at least ₹${shortageAmount} to continue accepting bookings.`

    await InAppNotification.create({
      userId: providerId,
      title,
      body,
      type: NOTIFICATION_TYPES.SYSTEM,
      idempotencyKey,
      deliveryStatus: DELIVERY_STATUS.SENT,
      metadata: {
        shortageAmount,
        requiredBalance,
        availableBalance,
        actionUrl: '/serviceprovider/wallet',
      },
    })

    const { emitToUser } = await import('../socket.js')
    emitToUser(providerId, 'NEW_IN_APP_NOTIFICATION', { title, body, shortageAmount })

    const { sendNotificationToUser } = await import('../utils/pushNotificationHelper.js')
    await sendNotificationToUser(providerId, {
      title,
      body,
      data: { type: 'LOW_WALLET_BALANCE', shortageAmount: String(shortageAmount) },
    }).catch(() => {})
  } catch (err) {
    console.warn('[WALLET_NOTIF] Failed to send low balance notification:', err.message)
  }
}

/**
 * Dispatch notification when booking acceptance is blocked due to low balance
 */
export async function notifyAcceptanceBlocked({ providerId, bookingId, shortageAmount }) {
  try {
    const idempotencyKey = `ACCEPT_BLOCKED_${bookingId}_${providerId}`
    const existing = await InAppNotification.findOne({ idempotencyKey })
    if (existing) return

    const title = 'Booking Acceptance Blocked'
    const body = `Booking acceptance failed due to insufficient wallet balance. Please recharge your wallet with at least ₹${shortageAmount}.`

    await InAppNotification.create({
      userId: providerId,
      title,
      body,
      type: NOTIFICATION_TYPES.SYSTEM,
      idempotencyKey,
      deliveryStatus: DELIVERY_STATUS.SENT,
      metadata: {
        bookingId,
        shortageAmount,
        actionUrl: '/serviceprovider/wallet',
      },
    })

    const { emitToUser } = await import('../socket.js')
    emitToUser(providerId, 'NEW_IN_APP_NOTIFICATION', { title, body, shortageAmount })

    const { sendNotificationToUser } = await import('../utils/pushNotificationHelper.js')
    await sendNotificationToUser(providerId, {
      title,
      body,
      data: { type: 'ACCEPTANCE_BLOCKED', bookingId: String(bookingId), shortageAmount: String(shortageAmount) },
    }).catch(() => {})
  } catch (err) {
    console.warn('[WALLET_NOTIF] Failed to send acceptance blocked notification:', err.message)
  }
}

/**
 * Dispatch notification upon successful wallet recharge
 */
export async function notifyRechargeSuccess({ providerId, amount, newBalance }) {
  try {
    const title = 'Wallet Recharged Successfully'
    const body = `Your wallet has been recharged with ₹${amount} successfully. You can now accept eligible bookings.`

    const inApp = await InAppNotification.create({
      userId: providerId,
      title,
      body,
      type: NOTIFICATION_TYPES.WALLET_CREDIT,
      deliveryStatus: DELIVERY_STATUS.SENT,
      metadata: {
        amount,
        newBalance,
        actionUrl: '/serviceprovider/wallet',
      },
    })

    const { emitToUser } = await import('../socket.js')
    emitToUser(providerId, 'NEW_IN_APP_NOTIFICATION', inApp)
    emitToUser(providerId, 'WALLET_UPDATED', { balance: newBalance })

    const { sendNotificationToUser } = await import('../utils/pushNotificationHelper.js')
    await sendNotificationToUser(providerId, {
      title,
      body,
      data: { type: 'WALLET_RECHARGE', amount: String(amount) },
    }).catch(() => {})
  } catch (err) {
    console.warn('[WALLET_NOTIF] Failed to send recharge success notification:', err.message)
  }
}

/**
 * Admin Provider Eligibility Report Generator
 * 
 * Table showing:
 * - Provider Name
 * - Provider ID
 * - Wallet Balance
 * - Reserved Amount
 * - Available Balance
 * - Minimum Required Balance
 * - Eligibility Status (ELIGIBLE / LOW_BALANCE)
 * - Pending Reservations
 * - Last Recharge
 * - Total Commission Collected
 */
export async function getAdminProvidersEligibilityReport({
  search = '',
  filter = 'all', // all, eligible, low_balance, pending_reservations
  page = 1,
  limit = 20,
}) {
  const settings = await getWalletEligibilitySettings()
  const minRequiredBalance = Number(settings.minimumWalletBalance || 300)

  // Query service providers (labour or contractor)
  const query = {
    role: { $in: ['labour', 'contractor'] },
  }

  if (search && search.trim()) {
    const term = search.trim()
    query.$or = [
      { fullName: { $regex: term, $options: 'i' } },
      { phone: { $regex: term, $options: 'i' } },
      { email: { $regex: term, $options: 'i' } },
    ]
  }

  const providers = await User.find(query)
    .select('fullName phone email role createdAt')
    .lean()

  const providerIds = providers.map((p) => p._id)

  const [wallets, reservations, lastRecharges, commissionsCollected] = await Promise.all([
    Wallet.find({ userId: { $in: providerIds } }).lean(),
    WalletReservation.aggregate([
      { $match: { providerId: { $in: providerIds }, status: 'RESERVED' } },
      { $group: { _id: '$providerId', count: { $sum: 1 }, totalReserved: { $sum: '$reservedAmount' } } },
    ]),
    WalletTransaction.aggregate([
      { $match: { userId: { $in: providerIds }, context: 'WALLET_RECHARGE', status: 'COMPLETED' } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: '$userId', lastDate: { $first: '$createdAt' }, lastAmount: { $first: '$amount' } } },
    ]),
    WalletTransaction.aggregate([
      { $match: { userId: { $in: providerIds }, context: 'BOOKING_COMMISSION_SETTLEMENT', status: 'COMPLETED' } },
      { $group: { _id: '$userId', totalCommission: { $sum: '$amount' } } },
    ]),
  ])

  const walletMap = new Map(wallets.map((w) => [String(w.userId), w]))
  const reservationMap = new Map(reservations.map((r) => [String(r._id), r]))
  const rechargeMap = new Map(lastRecharges.map((r) => [String(r._id), r]))
  const commissionMap = new Map(commissionsCollected.map((c) => [String(c._id), c.totalCommission]))

  let rows = providers.map((p) => {
    const w = walletMap.get(String(p._id))
    const r = reservationMap.get(String(p._id))
    const rech = rechargeMap.get(String(p._id))
    const totalComm = commissionMap.get(String(p._id)) || 0

    const balance = Number(w?.selfBalance !== undefined ? w.selfBalance : (w?.balance || 0))
    const reservedAmount = Number(w?.reservedBalance || 0)
    const availableBalance = Math.max(0, balance - reservedAmount)
    const isEligible = settings.eligibilitySystemEnabled ? availableBalance >= minRequiredBalance : true

    return {
      providerId: p._id,
      providerName: p.fullName || 'Service Provider',
      phone: p.phone,
      email: p.email || '—',
      role: p.role,
      walletBalance: balance,
      reservedAmount,
      availableBalance,
      minimumRequiredBalance: minRequiredBalance,
      eligibilityStatus: isEligible ? 'ELIGIBLE' : 'LOW_BALANCE',
      pendingReservationsCount: r?.count || 0,
      lastRechargeDate: rech?.lastDate || null,
      lastRechargeAmount: rech?.lastAmount || null,
      totalCommissionCollected: totalComm,
      createdAt: p.createdAt,
    }
  })

  // Apply status filters
  if (filter === 'eligible') {
    rows = rows.filter((row) => row.eligibilityStatus === 'ELIGIBLE')
  } else if (filter === 'low_balance') {
    rows = rows.filter((row) => row.eligibilityStatus === 'LOW_BALANCE')
  } else if (filter === 'pending_reservations') {
    rows = rows.filter((row) => row.pendingReservationsCount > 0)
  }

  const total = rows.length
  const pageNum = Math.max(1, parseInt(page, 10) || 1)
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20))
  const paginatedRows = rows.slice((pageNum - 1) * limitNum, pageNum * limitNum)

  return {
    providers: paginatedRows,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum) || 1,
    },
    settings: {
      minimumWalletBalance: minRequiredBalance,
      commissionPercentage: settings.commissionPercentage,
      eligibilitySystemEnabled: settings.eligibilitySystemEnabled,
      commissionReservationEnabled: settings.commissionReservationEnabled,
    },
  }
}
