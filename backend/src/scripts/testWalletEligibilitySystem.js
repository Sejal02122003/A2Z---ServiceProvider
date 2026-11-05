import mongoose from 'mongoose'
import dotenv from 'dotenv'
import assert from 'assert'
import { User } from '../models/User.js'
import { Wallet } from '../models/Wallet.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
import { WalletEligibilitySetting } from '../models/WalletEligibilitySetting.js'
import { WalletReservation } from '../models/WalletReservation.js'
import { Booking } from '../models/Booking.js'
import {
  getWalletEligibilitySettings,
  updateWalletEligibilitySettings,
  calculateEligibility,
  checkProviderBookingEligibility,
  reserveBookingCommission,
  settleBookingCommission,
  releaseBookingCommissionReservation,
} from '../services/walletEligibilityService.js'
import { getOrCreateLabourWallet, rechargeLabourWallet } from '../services/labourWalletService.js'

dotenv.config()

async function runWalletEligibilityTests() {
  console.log('=================================================================')
  console.log('🚀 RUNNING COMPREHENSIVE WALLET ELIGIBILITY SYSTEM TEST SUITE')
  console.log('=================================================================\n')

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/a2z-service'
  await mongoose.connect(mongoUri)
  console.log('Connected to MongoDB.\n')

  try {
    const timestamp = Date.now()

    // Setup Admin
    const testAdmin = await User.create({
      fullName: `Admin Test ${timestamp}`,
      phone: `9911${String(timestamp).slice(-6)}`,
      email: `admin_${timestamp}@a2ztest.com`,
      role: 'admin',
    })

    // Setup Provider
    const testProvider = await User.create({
      fullName: `Provider Test ${timestamp}`,
      phone: `9822${String(timestamp).slice(-6)}`,
      email: `provider_${timestamp}@a2ztest.com`,
      role: 'labour',
      labourProfile: { kycStatus: 'verified', availabilityStatus: 'available' },
    })

    // Setup Customer
    const testCustomer = await User.create({
      fullName: `Customer Test ${timestamp}`,
      phone: `9733${String(timestamp).slice(-6)}`,
      email: `customer_${timestamp}@a2ztest.com`,
      role: 'customer',
    })

    // Reset settings to default: min ₹300, comm 25%, enabled
    await updateWalletEligibilitySettings(
      {
        minimumWalletBalance: 300,
        commissionPercentage: 25,
        eligibilitySystemEnabled: true,
        commissionReservationEnabled: true,
      },
      testAdmin._id,
      'Initial test suite reset'
    )

    const defaultSettings = await getWalletEligibilitySettings()
    assert.strictEqual(defaultSettings.minimumWalletBalance, 300, 'Default min balance must be 300')
    assert.strictEqual(defaultSettings.commissionPercentage, 25, 'Default commission % must be 25')
    assert.strictEqual(defaultSettings.eligibilitySystemEnabled, true, 'Eligibility system must be enabled')
    console.log('✅ Configuration defaults verified (₹300 min, 25% comm, enabled)')

    // Helper to create test booking
    async function createBooking(totalAmount, status = 'BROADCASTING') {
      return Booking.create({
        userId: testCustomer._id,
        type: 'SCHEDULED',
        basePrice: totalAmount,
        totalAmount,
        packageBooking: { isPackage: true },
        laborShare: Math.round(totalAmount * 0.75),
        address: { locationText: 'Test Street, Jaipur' },
        status,
        paymentMethod: 'CASH',
      })
    }

    // Helper to set provider balance
    async function setProviderBalance(amount) {
      const w = await getOrCreateLabourWallet(testProvider._id)
      w.selfBalance = amount
      w.balance = amount
      w.reservedBalance = 0
      w.adminBalance = 0
      await w.save()
      return w
    }

    // -------------------------------------------------------------
    // SCENARIO 1: Provider has ₹1,000 and receives a ₹1,000 booking at 25%
    // Expected: Eligible; reserve ₹250.
    // -------------------------------------------------------------
    console.log('\n--- SCENARIO 1: Balance ₹1,000, Booking ₹1,000 @ 25% ---')
    await setProviderBalance(1000)
    const booking1 = await createBooking(1000)
    const check1 = await checkProviderBookingEligibility({
      providerId: testProvider._id,
      bookingId: booking1._id,
    })
    assert.strictEqual(check1.eligible, true, 'Provider with ₹1000 should be eligible for ₹1000 booking')
    assert.strictEqual(check1.estimatedCommission, 250, 'Commission should be ₹250')
    assert.strictEqual(check1.requiredBalance, 550, 'Required balance should be ₹550')

    const reserve1 = await reserveBookingCommission({ providerId: testProvider._id, booking: booking1 })
    assert.strictEqual(reserve1.reserved, true, 'Reservation must succeed')
    assert.strictEqual(reserve1.reservation.reservedAmount, 250, 'Reserved amount must be ₹250')
    const wallet1 = await Wallet.findOne({ userId: testProvider._id })
    assert.strictEqual(wallet1.reservedBalance, 250, 'Wallet reservedBalance should be ₹250')
    assert.strictEqual(wallet1.selfBalance - wallet1.reservedBalance, 750, 'Available balance should be ₹750')
    console.log('✅ Scenario 1 PASSED: Eligible; ₹250 reserved; available balance is ₹750.')

    // -------------------------------------------------------------
    // SCENARIO 2: Provider has ₹500 and receives a ₹1,000 booking
    // Expected: Blocked; shortage ₹50.
    // -------------------------------------------------------------
    console.log('\n--- SCENARIO 2: Balance ₹500, Booking ₹1,000 @ 25% ---')
    await setProviderBalance(500)
    const booking2 = await createBooking(1000)
    const check2 = await checkProviderBookingEligibility({
      providerId: testProvider._id,
      bookingId: booking2._id,
    })
    assert.strictEqual(check2.eligible, false, 'Provider with ₹500 must not be eligible')
    assert.strictEqual(check2.requiredBalance, 550, 'Required balance is ₹550')
    assert.strictEqual(check2.shortageAmount, 50, 'Shortage must be exactly ₹50')

    const reserve2 = await reserveBookingCommission({ providerId: testProvider._id, booking: booking2 })
    assert.strictEqual(reserve2.reserved, false, 'Reservation must be rejected')
    assert.strictEqual(reserve2.code, 'LOW_WALLET_BALANCE', 'Code must be LOW_WALLET_BALANCE')
    console.log('✅ Scenario 2 PASSED: Blocked; shortage ₹50 detected correctly.')

    // -------------------------------------------------------------
    // SCENARIO 3: Provider has ₹550 and receives a ₹1,000 booking
    // Expected: Eligible; reserve ₹250.
    // -------------------------------------------------------------
    console.log('\n--- SCENARIO 3: Balance ₹550, Booking ₹1,000 @ 25% ---')
    await setProviderBalance(550)
    const booking3 = await createBooking(1000)
    const check3 = await checkProviderBookingEligibility({
      providerId: testProvider._id,
      bookingId: booking3._id,
    })
    assert.strictEqual(check3.eligible, true, 'Provider with ₹550 must be eligible')
    assert.strictEqual(check3.shortageAmount, 0, 'Shortage must be 0')
    const reserve3 = await reserveBookingCommission({ providerId: testProvider._id, booking: booking3 })
    assert.strictEqual(reserve3.reserved, true, 'Reservation must succeed')
    assert.strictEqual(reserve3.reservation.reservedAmount, 250, 'Reserved ₹250')
    console.log('✅ Scenario 3 PASSED: Eligible with exact threshold ₹550; ₹250 reserved.')

    // -------------------------------------------------------------
    // SCENARIO 4: Provider has ₹300 and receives a ₹500 booking
    // Expected: Blocked; required balance ₹425 (shortage ₹125).
    // -------------------------------------------------------------
    console.log('\n--- SCENARIO 4: Balance ₹300, Booking ₹500 @ 25% ---')
    await setProviderBalance(300)
    const booking4 = await createBooking(500)
    const check4 = await checkProviderBookingEligibility({
      providerId: testProvider._id,
      bookingId: booking4._id,
    })
    assert.strictEqual(check4.eligible, false, 'Provider with ₹300 must be blocked for ₹500 booking')
    assert.strictEqual(check4.estimatedCommission, 125, 'Commission is ₹125')
    assert.strictEqual(check4.requiredBalance, 425, 'Required balance is ₹425')
    assert.strictEqual(check4.shortageAmount, 125, 'Shortage is ₹125')
    console.log('✅ Scenario 4 PASSED: Blocked; required ₹425, shortage ₹125.')

    // -------------------------------------------------------------
    // SCENARIO 5: Provider recharges ₹100 after being blocked
    // Expected: Eligibility recalculated automatically; now eligible.
    // -------------------------------------------------------------
    console.log('\n--- SCENARIO 5: Recharges ₹100 after Scenario 2 shortage ---')
    await setProviderBalance(500) // from Scenario 2, shortage was ₹50
    const booking5 = await createBooking(1000)
    const beforeRecharge = await checkProviderBookingEligibility({
      providerId: testProvider._id,
      bookingId: booking5._id,
    })
    assert.strictEqual(beforeRecharge.eligible, false, 'Initially blocked with ₹500')

    await rechargeLabourWallet({ labourId: testProvider._id, amount: 100 })
    const afterRecharge = await checkProviderBookingEligibility({
      providerId: testProvider._id,
      bookingId: booking5._id,
    })
    assert.strictEqual(afterRecharge.walletBalance, 600, 'Wallet balance is now ₹600')
    assert.strictEqual(afterRecharge.eligible, true, 'Provider is now eligible after ₹100 recharge')
    assert.strictEqual(afterRecharge.shortageAmount, 0, 'Shortage is now 0')
    console.log('✅ Scenario 5 PASSED: Automatically eligible after ₹100 recharge.')

    // -------------------------------------------------------------
    // SCENARIO 6: Admin changes minimum balance from ₹300 to ₹500
    // Expected: New booking checks use ₹500.
    // -------------------------------------------------------------
    console.log('\n--- SCENARIO 6: Admin updates minimum balance to ₹500 ---')
    await updateWalletEligibilitySettings(
      { minimumWalletBalance: 500 },
      testAdmin._id,
      'Test update minimum balance'
    )
    await setProviderBalance(600)
    const booking6 = await createBooking(1000) // comm 25% = 250. Required = 500 + 250 = 750
    const check6 = await checkProviderBookingEligibility({
      providerId: testProvider._id,
      bookingId: booking6._id,
    })
    assert.strictEqual(check6.minimumBalance, 500, 'New checks must use ₹500 min balance')
    assert.strictEqual(check6.requiredBalance, 750, 'Required balance is ₹750 (500 + 250)')
    assert.strictEqual(check6.eligible, false, '₹600 is less than ₹750, should be blocked')
    assert.strictEqual(check6.shortageAmount, 150, 'Shortage is ₹150')
    console.log('✅ Scenario 6 PASSED: New booking check dynamically uses ₹500 minimum.')

    // Reset min balance back to 300 for subsequent tests
    await updateWalletEligibilitySettings({ minimumWalletBalance: 300 }, testAdmin._id)

    // -------------------------------------------------------------
    // SCENARIO 7: Admin changes commission from 25% to 20%
    // Expected: New bookings use 20%; previously accepted bookings retain snapshots.
    // -------------------------------------------------------------
    console.log('\n--- SCENARIO 7: Admin updates commission to 20%, historical retention ---')
    await setProviderBalance(1000)
    const historicalBooking = await createBooking(1000)
    await reserveBookingCommission({ providerId: testProvider._id, booking: historicalBooking })
    assert.strictEqual(historicalBooking.commissionPercentageSnapshot, 25, 'Historical booking snapshotted at 25%')

    // Admin updates commission to 20%
    await updateWalletEligibilitySettings(
      { commissionPercentage: 20 },
      testAdmin._id,
      'Test change commission to 20%'
    )
    const newBooking7 = await createBooking(1000)
    const check7 = await checkProviderBookingEligibility({
      providerId: testProvider._id,
      bookingId: newBooking7._id,
    })
    assert.strictEqual(check7.commissionPercentage, 20, 'New booking uses 20%')
    assert.strictEqual(check7.estimatedCommission, 200, 'Estimated commission is ₹200 (20% of 1000)')
    assert.strictEqual(check7.requiredBalance, 500, 'Required balance is ₹500 (300 + 200)')

    // Verify historical booking retained its 25% snapshot
    const fetchedHistorical = await Booking.findById(historicalBooking._id)
    assert.strictEqual(fetchedHistorical.commissionPercentageSnapshot, 25, 'Historical booking retained 25%')
    console.log('✅ Scenario 7 PASSED: New bookings use 20%; historical booking retained 25% snapshot.')

    // Reset commission back to 25%
    await updateWalletEligibilitySettings({ commissionPercentage: 25 }, testAdmin._id)

    // -------------------------------------------------------------
    // SCENARIO 8: Provider attempts to accept two bookings simultaneously
    // Expected: Wallet funds are reserved atomically; no double spending.
    // -------------------------------------------------------------
    console.log('\n--- SCENARIO 8: Race conditions / Concurrency test ---')
    // Provider has available balance of ₹600 (min 300 + 250 = 550 needed per booking)
    // Provider can only accept 1 booking; second one must fail atomically!
    await setProviderBalance(600)
    const concurrentBookingA = await createBooking(1000)
    const concurrentBookingB = await createBooking(1000)

    const [resA, resB] = await Promise.all([
      reserveBookingCommission({ providerId: testProvider._id, booking: concurrentBookingA }),
      reserveBookingCommission({ providerId: testProvider._id, booking: concurrentBookingB }),
    ])

    const successCount = (resA.reserved ? 1 : 0) + (resB.reserved ? 1 : 0)
    assert.strictEqual(successCount, 1, 'Exactly one concurrent booking reservation must succeed!')
    const failedRes = resA.reserved ? resB : resA
    assert.strictEqual(failedRes.reserved, false, 'Second concurrent booking must fail')
    assert.strictEqual(failedRes.code, 'LOW_WALLET_BALANCE', 'Failure code must indicate low balance')
    console.log('✅ Scenario 8 PASSED: Atomic concurrency control prevented double spending.')

    // -------------------------------------------------------------
    // SCENARIO 9: Customer cancels an accepted booking
    // Expected: Applicable reservation is released once.
    // -------------------------------------------------------------
    console.log('\n--- SCENARIO 9: Customer cancellation reservation release ---')
    await setProviderBalance(1000)
    const cancelTestBooking = await createBooking(1000)
    await reserveBookingCommission({ providerId: testProvider._id, booking: cancelTestBooking })
    let wBeforeCancel = await Wallet.findOne({ userId: testProvider._id })
    assert.strictEqual(wBeforeCancel.reservedBalance, 250, 'Reserved balance is ₹250')

    const releaseRes = await releaseBookingCommissionReservation({
      bookingId: cancelTestBooking._id,
      reason: 'Customer cancelled booking',
    })
    assert.strictEqual(releaseRes.released, true, 'Reservation must be released')
    let wAfterCancel = await Wallet.findOne({ userId: testProvider._id })
    assert.strictEqual(wAfterCancel.reservedBalance, 0, 'Reserved balance must be restored to 0')

    // Idempotent duplicate release check
    const duplicateRelease = await releaseBookingCommissionReservation({
      bookingId: cancelTestBooking._id,
      reason: 'Customer cancelled booking again',
    })
    assert.strictEqual(duplicateRelease.alreadyReleased, true, 'Second release must be a no-op')
    console.log('✅ Scenario 9 PASSED: Reservation released once and idempotent on repetition.')

    // -------------------------------------------------------------
    // SCENARIO 10: Booking gets completed
    // Expected: Actual commission is settled once and remaining reservation is released.
    // -------------------------------------------------------------
    console.log('\n--- SCENARIO 10: Booking completion commission settlement ---')
    await setProviderBalance(1000)
    const completeTestBooking = await createBooking(1000)
    completeTestBooking.laborId = testProvider._id
    completeTestBooking.status = 'ACCEPTED'
    await completeTestBooking.save()

    await reserveBookingCommission({ providerId: testProvider._id, booking: completeTestBooking })
    let wBeforeComplete = await Wallet.findOne({ userId: testProvider._id })
    assert.strictEqual(wBeforeComplete.reservedBalance, 250, 'Reserved balance is ₹250 before completion')

    const settleRes = await settleBookingCommission({ bookingId: completeTestBooking._id })
    assert.strictEqual(settleRes.settled, true, 'Settlement must succeed')
    assert.strictEqual(settleRes.actualCommission, 250, 'Settled commission is ₹250')

    let wAfterComplete = await Wallet.findOne({ userId: testProvider._id })
    assert.strictEqual(wAfterComplete.reservedBalance, 0, 'Reserved balance released to 0')
    assert.strictEqual(wAfterComplete.selfBalance, 750, '₹250 deducted from wallet for cash booking, balance is 750')

    // Idempotent duplicate settlement
    const duplicateSettle = await settleBookingCommission({ bookingId: completeTestBooking._id })
    assert.strictEqual(duplicateSettle.alreadySettled, true, 'Duplicate settlement must be idempotent')
    console.log('✅ Scenario 10 PASSED: Commission settled cleanly and idempotent.')

    // -------------------------------------------------------------
    // SCENARIO 11: Provider attempts to accept a booking with insufficient balance through direct API request
    // Expected: Backend rejects it.
    // -------------------------------------------------------------
    console.log('\n--- SCENARIO 11: Direct API acceptance rejection ---')
    await setProviderBalance(200)
    const directApiBooking = await createBooking(1000)
    const directRes = await reserveBookingCommission({ providerId: testProvider._id, booking: directApiBooking })
    assert.strictEqual(directRes.reserved, false, 'Direct backend acceptance must be rejected')
    assert.strictEqual(directRes.code, 'LOW_WALLET_BALANCE', 'Code is LOW_WALLET_BALANCE')
    assert.strictEqual(directRes.data.shortageAmount, 350, 'Shortage is ₹350 (required ₹550 - balance ₹200)')
    console.log('✅ Scenario 11 PASSED: Direct acceptance rejected authoritatively by backend.')

    // -------------------------------------------------------------
    // SCENARIO 12: Wallet recharge succeeds
    // Expected: Balance, eligibility, and dashboard update correctly.
    // -------------------------------------------------------------
    console.log('\n--- SCENARIO 12: Recharge balance and eligibility refresh ---')
    await setProviderBalance(100)
    const rechResult = await rechargeLabourWallet({ labourId: testProvider._id, amount: 450 })
    assert.strictEqual(rechResult.success, true, 'Recharge succeeds')
    assert.strictEqual(rechResult.wallet.selfBalance, 550, 'Balance is now ₹550')

    const eligibilityAfter = await checkProviderBookingEligibility({
      providerId: testProvider._id,
      bookingAmount: 1000,
    })
    assert.strictEqual(eligibilityAfter.eligible, true, 'Now eligible for ₹1000 booking')
    console.log('✅ Scenario 12 PASSED: Recharge updated balance and eligibility.')

    // -------------------------------------------------------------
    // SCENARIO 13: Duplicate completion or cancellation requests
    // Expected: No duplicate financial transactions.
    // -------------------------------------------------------------
    console.log('\n--- SCENARIO 13: Duplicate requests idempotency test ---')
    await setProviderBalance(1000)
    const dedupeBooking = await createBooking(1000)
    dedupeBooking.laborId = testProvider._id
    await dedupeBooking.save()
    await reserveBookingCommission({ providerId: testProvider._id, booking: dedupeBooking })

    const txCountBefore = await WalletTransaction.countDocuments({ bookingId: dedupeBooking._id })
    await settleBookingCommission({ bookingId: dedupeBooking._id })
    await settleBookingCommission({ bookingId: dedupeBooking._id })
    await settleBookingCommission({ bookingId: dedupeBooking._id })

    const settlementTxCount = await WalletTransaction.countDocuments({
      bookingId: dedupeBooking._id,
      context: 'BOOKING_COMMISSION_SETTLEMENT',
    })
    assert.strictEqual(settlementTxCount, 1, 'Only one settlement ledger transaction must be created')
    console.log('✅ Scenario 13 PASSED: Duplicate financial transactions strictly prevented.')

    // -------------------------------------------------------------
    // SCENARIO 14: Admin disables the eligibility feature
    // Expected: Existing business rules apply without leaving stale reservations or corrupting wallet data.
    // -------------------------------------------------------------
    console.log('\n--- SCENARIO 14: Admin disables eligibility feature ---')
    await updateWalletEligibilitySettings(
      { eligibilitySystemEnabled: false, commissionReservationEnabled: false },
      testAdmin._id,
      'Test disable eligibility feature'
    )
    await setProviderBalance(50) // Very low balance
    const disabledBooking = await createBooking(1000)
    const checkDisabled = await checkProviderBookingEligibility({
      providerId: testProvider._id,
      bookingId: disabledBooking._id,
    })
    assert.strictEqual(checkDisabled.eligible, true, 'Provider is eligible when system is disabled')

    const reserveDisabled = await reserveBookingCommission({ providerId: testProvider._id, booking: disabledBooking })
    assert.strictEqual(reserveDisabled.reserved, true, 'Reservation passes with 0 held amount')
    assert.strictEqual(reserveDisabled.reservedAmount, 0, 'No reservation hold created')

    // Clean up settings
    await updateWalletEligibilitySettings(
      { eligibilitySystemEnabled: true, commissionReservationEnabled: true },
      testAdmin._id,
      'Restore eligibility feature'
    )
    console.log('✅ Scenario 14 PASSED: Graceful degradation when feature is disabled.')

    console.log('\n=================================================================')
    console.log('🎉 ALL 14 TEST SCENARIOS PASSED WITH 100% SUCCESS!')
    console.log('=================================================================\n')
  } catch (error) {
    console.error('❌ Test failed with error:', error)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
    console.log('Disconnected from MongoDB.')
  }
}

runWalletEligibilityTests()
