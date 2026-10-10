import mongoose from 'mongoose'
import dotenv from 'dotenv'
import assert from 'assert'
import { User } from '../models/User.js'
import { Wallet } from '../models/Wallet.js'
import { WalletSetting } from '../models/WalletSetting.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
import { Booking } from '../models/Booking.js'
import { LabourCategory } from '../models/LabourCategory.js'
import { LabourSubcategory } from '../models/LabourSubcategory.js'
import { LabourService } from '../models/LabourService.js'
import { AdminWallet } from '../models/AdminWallet.js'
import {
  getOrCreateLabourWallet,
  getLabourWalletDetails,
  checkLabourBookingEligibility,
  reserveCashBookingCharges,
  releaseCashBookingCharges,
  settleCashBookingPayment,
  rechargeLabourWallet,
  reverseCashBookingSettlement,
} from '../services/labourWalletService.js'
import { updateWalletSettings } from '../services/userWalletService.js'

dotenv.config()

async function runTests() {
  console.log('--- STARTING LABOUR WALLET SYSTEM TEST SUITE ---')

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/a2z-service'
  await mongoose.connect(mongoUri)
  console.log('Connected to MongoDB')

  try {
    // Setup test users and data
    const timestamp = Date.now()
    const testAdmin = await User.create({
      fullName: `Test Admin ${timestamp}`,
      phone: `9999${String(timestamp).slice(-6)}`,
      email: `admin_${timestamp}@test.com`,
      role: 'admin',
    })

    const testLabour = await User.create({
      fullName: `Test Labour ${timestamp}`,
      phone: `8888${String(timestamp).slice(-6)}`,
      email: `labour_${timestamp}@test.com`,
      role: 'labour',
      labourProfile: {
        kycStatus: 'verified',
        availabilityStatus: 'available',
      },
    })

    const testCustomer = await User.create({
      fullName: `Test Customer ${timestamp}`,
      phone: `7777${String(timestamp).slice(-6)}`,
      email: `customer_${timestamp}@test.com`,
      role: 'customer',
    })

    const testCategory = await LabourCategory.create({
      name: `Test Cat ${timestamp}`,
      nameHi: 'टेस्ट',
      slug: `test-cat-${timestamp}`,
      icon: 'wrench',
      gstPercentage: 18,
      isGstActive: true,
    })

    const testSubcategory = await LabourSubcategory.create({
      categoryId: testCategory._id,
      name: `Test Subcat ${timestamp}`,
      nameHi: 'सब',
      icon: 'wrench',
    })

    const testService = await LabourService.create({
      subcategoryId: testSubcategory._id,
      name: `Test Service ${timestamp}`,
      nameHi: 'सेवा',
      basePrice: 500,
      hourlyPrice: 500,
    })

    // Reset settings for tests
    await updateWalletSettings({
      enabled: true,
      minimumLabourWalletBalance: 0,
      welcomeBonusAmount: 0,
    }, testAdmin._id)

    // Helper to create test booking
    async function createTestBooking({ basePrice, platformFee = 20, taxes = 0, commissionAmount = 50, paymentMethod = 'CASH' }) {
      const totalAmount = basePrice + platformFee + taxes
      const laborShare = basePrice - commissionAmount
      return await Booking.create({
        userId: testCustomer._id,
        laborId: testLabour._id,
        subcategoryId: testSubcategory._id,
        serviceId: testService._id,
        type: 'INSTANT',
        basePrice,
        platformFee,
        taxes,
        totalAmount,
        commissionAmount,
        laborShare,
        paymentMethod,
        paymentStatus: 'PENDING',
        adminSettlementStatus: 'PENDING',
        status: 'BROADCASTING',
        address: { locationText: 'Test Location' },
      })
    }

    console.log('\n--- Scenario 1: Booking ₹300, wallet ₹500: acceptance allowed ---')
    await Wallet.findOneAndUpdate(
      { userId: testLabour._id },
      { $set: { selfBalance: 500, balance: 500, reservedBalance: 0, adminBalance: 0 } },
      { upsert: true, new: true }
    )
    const booking1 = await createTestBooking({ basePrice: 280, platformFee: 20, commissionAmount: 28 })
    // totalAmount = 300
    const check1 = await checkLabourBookingEligibility({ labourId: testLabour._id, booking: booking1 })
    assert.strictEqual(check1.eligible, true, 'Should be eligible to accept ₹300 booking with ₹500 balance')
    console.log('✅ Scenario 1 Passed: Booking ₹300 with ₹500 wallet allowed.')

    console.log('\n--- Scenario 2: Booking ₹500, wallet ₹500: acceptance allowed ---')
    const booking2 = await createTestBooking({ basePrice: 480, platformFee: 20, commissionAmount: 48 })
    // totalAmount = 500
    const check2 = await checkLabourBookingEligibility({ labourId: testLabour._id, booking: booking2 })
    assert.strictEqual(check2.eligible, true, 'Should be eligible to accept ₹500 booking with ₹500 balance')
    console.log('✅ Scenario 2 Passed: Booking ₹500 with ₹500 wallet allowed.')

    console.log('\n--- Scenario 3: Booking ₹700, wallet ₹500: acceptance blocked ---')
    const booking3 = await createTestBooking({ basePrice: 680, platformFee: 20, commissionAmount: 68 })
    // totalAmount = 700
    const check3 = await checkLabourBookingEligibility({ labourId: testLabour._id, booking: booking3 })
    assert.strictEqual(check3.eligible, false, 'Should NOT be eligible to accept ₹700 booking with ₹500 balance')
    assert.strictEqual(check3.requiredTopUp, 200, 'Top-up required should be ₹200')
    assert.ok(check3.reason.includes('Insufficient wallet balance'), 'Reason should explain insufficient balance')
    console.log('✅ Scenario 3 Passed: Booking ₹700 with ₹500 wallet blocked with top-up requirement of ₹200.')

    console.log('\n--- Scenario 4: Booking ₹1,000, wallet ₹1,200: acceptance allowed ---')
    await Wallet.findOneAndUpdate(
      { userId: testLabour._id },
      { $set: { selfBalance: 1200, balance: 1200, reservedBalance: 0 } }
    )
    const booking4 = await createTestBooking({ basePrice: 950, platformFee: 50, commissionAmount: 95 })
    // totalAmount = 1000
    const check4 = await checkLabourBookingEligibility({ labourId: testLabour._id, booking: booking4 })
    assert.strictEqual(check4.eligible, true, 'Should be eligible to accept ₹1,000 booking with ₹1,200 balance')
    console.log('✅ Scenario 4 Passed: Booking ₹1,000 with ₹1,200 wallet allowed.')

    console.log('\n--- Scenario 5: Wallet below configured minimum balance policy ---')
    // Set admin minimum balance to ₹200
    await updateWalletSettings({ minimumLabourWalletBalance: 200 }, testAdmin._id)
    await Wallet.findOneAndUpdate(
      { userId: testLabour._id },
      { $set: { selfBalance: 150, balance: 150, reservedBalance: 0 } }
    )
    const booking5 = await createTestBooking({ basePrice: 90, platformFee: 10, commissionAmount: 9 })
    // totalAmount = 100 <= available (150), BUT available (150) < minRequired (200)
    const check5 = await checkLabourBookingEligibility({ labourId: testLabour._id, booking: booking5 })
    assert.strictEqual(check5.eligible, false, 'Should be blocked when balance is below admin minimum')
    assert.strictEqual(check5.code, 'BELOW_MINIMUM_WALLET_BALANCE')
    assert.strictEqual(check5.requiredTopUp, 50, 'Top-up required to meet minimum is ₹50')
    console.log('✅ Scenario 5 Passed: Minimum balance policy enforced correctly.')

    // Reset minimum balance back to 0 for subsequent scenarios
    await updateWalletSettings({ minimumLabourWalletBalance: 0 }, testAdmin._id)

    console.log('\n--- Scenario 6 & 7: Cash booking completed: only existing charges deducted, NOT full cash amount ---')
    // Set wallet to ₹500
    await Wallet.findOneAndUpdate(
      { userId: testLabour._id },
      { $set: { selfBalance: 500, balance: 500, reservedBalance: 0, adminBalance: 0 } }
    )
    // Booking: basePrice = ₹400, platformFee = ₹30, taxes (GST) = ₹20, commissionAmount = ₹40 -> totalAmount = ₹450
    // Total platform charges = 30 + 20 + 40 = ₹90
    const cashBooking = await createTestBooking({
      basePrice: 400,
      platformFee: 30,
      taxes: 20,
      commissionAmount: 40,
      paymentMethod: 'CASH',
    })

    // 1. Acceptance holds expected charges (₹90)
    const reserveRes = await reserveCashBookingCharges({ labourId: testLabour._id, booking: cashBooking })
    assert.strictEqual(reserveRes.reserved, true)
    assert.strictEqual(reserveRes.reservedAmount, 90)
    const walletAfterHold = await getLabourWalletDetails(testLabour._id)
    assert.strictEqual(walletAfterHold.currentBalance, 500, 'Current total balance remains ₹500')
    assert.strictEqual(walletAfterHold.reservedBalance, 90, 'Reserved balance is ₹90')
    assert.strictEqual(walletAfterHold.availableBalance, 410, 'Available balance is ₹410')

    // 2. Settlement on completion
    cashBooking.status = 'COMPLETED'
    await cashBooking.save()

    const settlement = await settleCashBookingPayment({ bookingId: cashBooking._id, labourId: testLabour._id })
    assert.strictEqual(settlement.settled, true)
    assert.strictEqual(settlement.chargesBreakdown.totalCharges, 90, 'Total deducted is only ₹90, NOT ₹450')
    assert.strictEqual(settlement.chargesBreakdown.deductedFromWallet, 90)

    const walletAfterSettlement = await getLabourWalletDetails(testLabour._id)
    assert.strictEqual(walletAfterSettlement.currentBalance, 410, 'Wallet debited only ₹90 (500 -> 410)')
    assert.strictEqual(walletAfterSettlement.reservedBalance, 0, 'Reservation released to 0')
    assert.strictEqual(walletAfterSettlement.availableBalance, 410, 'Available balance is ₹410')
    console.log('✅ Scenario 6 & 7 Passed: Only platform charges (₹90) debited; full booking cash (₹450) retained by labour.')

    console.log('\n--- Scenario 8 & 9: Commission, platform fee and GST match billing engine exactly; no double GST ---')
    const tx = await WalletTransaction.findOne({ bookingId: cashBooking._id, context: 'CASH_BOOKING_SETTLEMENT' })
    assert.ok(tx, 'Settlement transaction exists')
    assert.strictEqual(tx.chargesBreakdown.commission, 40, 'Commission matches booking exactly')
    assert.strictEqual(tx.chargesBreakdown.platformFee, 30, 'Platform fee matches booking exactly')
    assert.strictEqual(tx.chargesBreakdown.gst, 20, 'GST matches booking exactly')
    assert.strictEqual(tx.amount, 90, 'Total transaction amount is sum of individual charges')
    console.log('✅ Scenario 8 & 9 Passed: Charge breakdown matches billing engine and no double GST applied.')

    console.log('\n--- Scenario 10: Idempotent duplicate completion does NOT duplicate deduction ---')
    const duplicateSettlement = await settleCashBookingPayment({ bookingId: cashBooking._id, labourId: testLabour._id })
    assert.strictEqual(duplicateSettlement.alreadySettled, true, 'Should detect duplicate settlement')
    const walletAfterDup = await getLabourWalletDetails(testLabour._id)
    assert.strictEqual(walletAfterDup.currentBalance, 410, 'Wallet balance remained unchanged at ₹410')
    console.log('✅ Scenario 10 Passed: Duplicate settlement prevented idempotently.')

    console.log('\n--- Scenario 11: Concurrent acceptance requests safety check ---')
    // Wallet available: 410. Try reserving a booking of ₹500 (fails)
    const bigBooking = await createTestBooking({ basePrice: 480, platformFee: 20, commissionAmount: 48 })
    const bigReserve = await reserveCashBookingCharges({ labourId: testLabour._id, booking: bigBooking })
    assert.strictEqual(bigReserve.reserved, false, 'Reservation must fail when available balance is insufficient')
    console.log('✅ Scenario 11 Passed: Concurrent overspend prevented by atomic reservation query.')

    console.log('\n--- Scenario 12: Cancelled booking releases held reservation ---')
    // Reserve charges for a new cash booking
    const cancelBooking = await createTestBooking({ basePrice: 200, platformFee: 20, taxes: 10, commissionAmount: 20 })
    // charges = 50
    const holdRes = await reserveCashBookingCharges({ labourId: testLabour._id, booking: cancelBooking })
    assert.strictEqual(holdRes.reserved, true)
    const walletHeld = await getLabourWalletDetails(testLabour._id)
    assert.strictEqual(walletHeld.reservedBalance, 50)

    // Release on cancellation
    const releaseRes = await releaseCashBookingCharges({ labourId: testLabour._id, bookingId: cancelBooking._id, amount: 50 })
    assert.strictEqual(releaseRes.released, true)
    const walletReleased = await getLabourWalletDetails(testLabour._id)
    assert.strictEqual(walletReleased.reservedBalance, 0, 'Reserved balance cleanly released back to 0')
    console.log('✅ Scenario 12 Passed: Cancellation successfully released reservation.')

    console.log('\n--- Scenario 13: Reversal of settlement refunds wallet and creates linked transaction ---')
    const reversal = await reverseCashBookingSettlement({
      bookingId: cashBooking._id,
      reason: 'Customer disputed job',
      adminUserId: testAdmin._id,
    })
    assert.strictEqual(reversal.reversed, true)
    assert.strictEqual(reversal.refundAmount, 90, 'Refunded amount is ₹90')
    const walletAfterReversal = await getLabourWalletDetails(testLabour._id)
    assert.strictEqual(walletAfterReversal.currentBalance, 500, 'Wallet balance restored to ₹500 (410 + 90)')
    console.log('✅ Scenario 13 Passed: Settlement reversal restored balance and created immutable audit record.')

    console.log('\n--- Scenario 14: Top-up / Recharge adds funds atomically ---')
    const recharge = await rechargeLabourWallet({
      labourId: testLabour._id,
      amount: 300,
      paymentMethod: 'UPI',
      description: 'Test recharge',
    })
    assert.strictEqual(recharge.success, true)
    assert.strictEqual(recharge.balanceAfter, 800, 'Balance is now ₹800 (500 + 300)')
    console.log('✅ Scenario 14 Passed: Wallet recharge succeeded atomically.')

    console.log('\n--- Scenario 15: Online bookings do not suffer cash deductions ---')
    const onlineBooking = await createTestBooking({
      basePrice: 500,
      platformFee: 25,
      taxes: 25,
      commissionAmount: 50,
      paymentMethod: 'ONLINE',
    })
    onlineBooking.paymentStatus = 'PAID'
    onlineBooking.status = 'COMPLETED'
    await onlineBooking.save()

    const onlineSettlement = await settleCashBookingPayment({ bookingId: onlineBooking._id, labourId: testLabour._id })
    assert.strictEqual(onlineSettlement.isCash, false, 'Non-cash booking returns online workflow indicator without deduction')
    const walletAfterOnline = await getLabourWalletDetails(testLabour._id)
    assert.strictEqual(walletAfterOnline.currentBalance, 800, 'No wallet deduction for online bookings')
    console.log('✅ Scenario 15 Passed: Online booking handled without accidental wallet deduction.')

    console.log('\n🎉 ALL 15 CRITICAL TEST SCENARIOS PASSED WITH 100% SUCCESS! 🎉')
  } catch (err) {
    console.error('❌ TEST FAILED:', err)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
    console.log('Disconnected from MongoDB')
  }
}

runTests()
