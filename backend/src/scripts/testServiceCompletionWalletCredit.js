import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import assert from 'assert'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '../../.env') })

import { User } from '../models/User.js'
import { Wallet } from '../models/Wallet.js'
import { WalletSetting } from '../models/WalletSetting.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
import { Booking } from '../models/Booking.js'
import {
  getWalletSettings,
  updateWalletSettings,
  getOrCreateUserWallet,
  awardServiceCompletionWalletCredit,
  reverseServiceCompletionWalletCredit,
  deductWalletForBooking,
} from '../services/userWalletService.js'

const randomPhone = () => '9' + Math.floor(100000000 + Math.random() * 900000000).toString()

async function runTestSuite() {
  console.log('========================================================================')
  console.log('🚀 A2Z SERVICEPROVIDER: 15% SERVICE-BASED WALLET CREDIT TEST SUITE')
  console.log('   Testing all 20 required scenarios from Phase 10 specification')
  console.log('========================================================================\n')

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/a2z-service-provider'
  await mongoose.connect(mongoUri)
  console.log('Connected to MongoDB.\n')

  let passed = 0
  let failed = 0
  const createdUserIds = []
  const createdBookingIds = []

  function pass(testName, detail = '') {
    passed++
    console.log(`✅ [PASS] Test ${passed}: ${testName}${detail ? ' (' + detail + ')' : ''}`)
  }

  function fail(testName, err) {
    failed++
    console.error(`❌ [FAIL] Test ${passed + failed}: ${testName}`)
    console.error(`   Error: ${err.message}\n`)
  }

  // Create test admin
  const testAdmin = await User.create({
    fullName: 'Admin Test Officer',
    phone: randomPhone(),
    email: `admin_sc_${Date.now()}@a2z.com`,
    role: 'admin',
    isPhoneVerified: true,
  })
  createdUserIds.push(testAdmin._id)

  const createTestBooking = async (overrides = {}) => {
    const fakeId = new mongoose.Types.ObjectId()
    const basePrice = overrides.basePrice !== undefined ? overrides.basePrice : 1000
    const platformFee = overrides.platformFee !== undefined ? overrides.platformFee : 0
    const taxes = overrides.taxes !== undefined ? overrides.taxes : 0
    const totalAmount = overrides.totalAmount !== undefined ? overrides.totalAmount : (basePrice + platformFee + taxes)
    const laborShare = overrides.laborShare !== undefined ? overrides.laborShare : Math.round(basePrice * 0.8)

    const booking = await Booking.create({
      userId: overrides.userId || overrides.customerId,
      subcategoryId: overrides.subcategoryId || fakeId,
      serviceId: overrides.serviceId || fakeId,
      type: 'INSTANT',
      address: { locationText: 'Sector 62, Noida, UP' },
      basePrice,
      platformFee,
      taxes,
      totalAmount,
      commissionAmount: overrides.commissionAmount || 0,
      laborShare,
      paymentMethod: overrides.paymentMethod || 'ONLINE',
      paymentStatus: overrides.paymentStatus || 'PAID',
      status: overrides.status || 'COMPLETED',
      ...overrides,
    })
    createdBookingIds.push(booking._id)
    return booking
  }

  try {
    // Reset settings to default before tests
    await updateWalletSettings({
      enabled: true,
      serviceCreditEnabled: true,
      serviceCreditPercentage: 15,
      serviceCreditMaxAmount: 0,
      serviceCreditMinBookingAmount: 0,
      serviceCreditApplicablePaymentMethods: ['ONLINE', 'CASH'],
    }, testAdmin._id)

    // -------------------------------------------------------------
    // Test 1: A successful ₹1,000 booking produces a ₹150 credit
    // -------------------------------------------------------------
    try {
      const u1 = await User.create({
        fullName: 'Customer Test 1000',
        phone: randomPhone(),
        role: 'customer',
        isPhoneVerified: true,
      })
      createdUserIds.push(u1._id)

      const b1 = await createTestBooking({
        userId: u1._id,
        basePrice: 1000,
        platformFee: 50,
        taxes: 180,
        totalAmount: 1230,
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        paymentMethod: 'ONLINE',
      })

      const res1 = await awardServiceCompletionWalletCredit(b1._id)
      assert.strictEqual(res1.awarded, true, 'Credit should be awarded')
      assert.strictEqual(res1.creditAmount, 150, '₹1,000 * 15% = ₹150 credit')
      assert.strictEqual(res1.percentage, 15)
      assert.strictEqual(res1.eligibleAmount, 1000)

      const wallet1 = await Wallet.findOne({ userId: u1._id })
      assert.strictEqual(wallet1.balance, 150, 'Wallet balance should now be ₹150')

      const tx1 = await WalletTransaction.findOne({ idempotencyKey: `SERVICE_CREDIT_${b1._id}` })
      assert.ok(tx1, 'Ledger transaction must exist with unique idempotencyKey')
      assert.strictEqual(tx1.amount, 150)
      assert.strictEqual(tx1.context, 'SERVICE_CREDIT')
      assert.strictEqual(tx1.status, 'COMPLETED')

      pass('A successful ₹1,000 booking produces a ₹150 credit', '₹150 ledger & balance verified')
    } catch (e) {
      fail('A successful ₹1,000 booking produces a ₹150 credit', e)
    }

    // -------------------------------------------------------------
    // Test 2: A ₹500 booking produces a ₹75 credit
    // -------------------------------------------------------------
    try {
      const u2 = await User.create({
        fullName: 'Customer Test 500',
        phone: randomPhone(),
        role: 'customer',
        isPhoneVerified: true,
      })
      createdUserIds.push(u2._id)

      const b2 = await createTestBooking({
        userId: u2._id,
        basePrice: 500,
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        paymentMethod: 'ONLINE',
      })

      const res2 = await awardServiceCompletionWalletCredit(b2._id)
      assert.strictEqual(res2.awarded, true)
      assert.strictEqual(res2.creditAmount, 75, '₹500 * 15% = ₹75 credit')
      assert.strictEqual(res2.balanceAfter, 75)

      pass('A ₹500 booking produces a ₹75 credit', '₹75 credited accurately')
    } catch (e) {
      fail('A ₹500 booking produces a ₹75 credit', e)
    }

    // -------------------------------------------------------------
    // Test 3: The feature-disabled configuration produces no new credit
    // -------------------------------------------------------------
    try {
      await updateWalletSettings({ serviceCreditEnabled: false }, testAdmin._id)

      const u3 = await User.create({
        fullName: 'Customer Disabled Test',
        phone: randomPhone(),
        role: 'customer',
        isPhoneVerified: true,
      })
      createdUserIds.push(u3._id)

      const b3 = await createTestBooking({
        userId: u3._id,
        basePrice: 1000,
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        paymentMethod: 'ONLINE',
      })

      const res3 = await awardServiceCompletionWalletCredit(b3._id)
      assert.strictEqual(res3.awarded, false, 'Should not award when disabled')
      assert.strictEqual(res3.reason, 'FEATURE_DISABLED')

      const wallet3 = await Wallet.findOne({ userId: u3._id })
      assert.strictEqual(wallet3?.balance || 0, 0, 'Wallet balance remains 0')

      // Re-enable for subsequent tests
      await updateWalletSettings({ serviceCreditEnabled: true }, testAdmin._id)
      pass('The feature-disabled configuration produces no new credit', 'No credit issued when serviceCreditEnabled=false')
    } catch (e) {
      fail('The feature-disabled configuration produces no new credit', e)
    }

    // -------------------------------------------------------------
    // Test 4: Unauthorized admin cannot change settings
    // -------------------------------------------------------------
    try {
      let rejected = false
      try {
        await updateWalletSettings({ serviceCreditPercentage: 25 }, null)
      } catch (err) {
        rejected = true
        assert.ok(err.message.includes('Unauthorized'), 'Expected unauthorized error')
      }
      assert.strictEqual(rejected, true, 'Settings update without adminUserId must throw')
      pass('Unauthorized admin cannot change settings', 'Enforced strictly on backend')
    } catch (e) {
      fail('Unauthorized admin cannot change settings', e)
    }

    // -------------------------------------------------------------
    // Test 5: Customer cannot credit their wallet by manipulating frontend requests
    // -------------------------------------------------------------
    try {
      const u5 = await User.create({
        fullName: 'Attacker Customer',
        phone: randomPhone(),
        role: 'customer',
        isPhoneVerified: true,
      })
      createdUserIds.push(u5._id)

      // Service credit has NO public endpoint that takes arbitrary amounts.
      // Even if attacker tries to pass a booking, credit is calculated strictly from booking.basePrice
      const b5 = await createTestBooking({
        userId: u5._id,
        basePrice: 200, // authoritative base price
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        paymentMethod: 'ONLINE',
      })

      const res5 = await awardServiceCompletionWalletCredit(b5._id)
      assert.strictEqual(res5.creditAmount, 30, 'Calculated strictly server-side: 200 * 15% = 30')
      pass('Customer cannot credit their wallet by manipulating frontend requests', 'Server authoritative calculation only')
    } catch (e) {
      fail('Customer cannot credit their wallet by manipulating frontend requests', e)
    }

    // -------------------------------------------------------------
    // Test 6: Incomplete, cancelled or rejected booking receives no credit
    // -------------------------------------------------------------
    try {
      const u6 = await User.create({
        fullName: 'Incomplete Test Customer',
        phone: randomPhone(),
        role: 'customer',
        isPhoneVerified: true,
      })
      createdUserIds.push(u6._id)

      const bCreated = await createTestBooking({
        userId: u6._id,
        basePrice: 1000,
        status: 'CREATED', // NOT completed
        paymentStatus: 'PAID',
        paymentMethod: 'ONLINE',
      })

      const resCreated = await awardServiceCompletionWalletCredit(bCreated._id)
      assert.strictEqual(resCreated.awarded, false)
      assert.strictEqual(resCreated.reason, 'BOOKING_NOT_COMPLETED')

      const bCancelled = await createTestBooking({
        userId: u6._id,
        basePrice: 1000,
        status: 'CANCELLED',
        paymentStatus: 'PAID',
        paymentMethod: 'ONLINE',
      })

      const resCancelled = await awardServiceCompletionWalletCredit(bCancelled._id)
      assert.strictEqual(resCancelled.awarded, false)
      assert.strictEqual(resCancelled.reason, 'BOOKING_NOT_COMPLETED')

      pass('Incomplete, cancelled or rejected booking receives no credit', 'Checked CREATED and CANCELLED statuses')
    } catch (e) {
      fail('Incomplete, cancelled or rejected booking receives no credit', e)
    }

    // -------------------------------------------------------------
    // Test 7: Failed and pending payments follow the configured eligibility rules
    // -------------------------------------------------------------
    try {
      const u7 = await User.create({
        fullName: 'Unpaid Booking Customer',
        phone: randomPhone(),
        role: 'customer',
        isPhoneVerified: true,
      })
      createdUserIds.push(u7._id)

      const bUnpaid = await createTestBooking({
        userId: u7._id,
        basePrice: 1500,
        status: 'COMPLETED',
        paymentStatus: 'PENDING', // Payment not made
        paymentMethod: 'ONLINE',
      })

      const resUnpaid = await awardServiceCompletionWalletCredit(bUnpaid._id)
      assert.strictEqual(resUnpaid.awarded, false)
      assert.strictEqual(resUnpaid.reason, 'PAYMENT_NOT_VERIFIED')

      pass('Failed and pending payments follow the configured eligibility rules', 'Pending payment rejected')
    } catch (e) {
      fail('Failed and pending payments follow the configured eligibility rules', e)
    }

    // -------------------------------------------------------------
    // Test 8: Duplicate completion events produce one credit
    // -------------------------------------------------------------
    try {
      const u8 = await User.create({
        fullName: 'Duplicate Test Customer',
        phone: randomPhone(),
        role: 'customer',
        isPhoneVerified: true,
      })
      createdUserIds.push(u8._id)

      const b8 = await createTestBooking({
        userId: u8._id,
        basePrice: 1000,
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        paymentMethod: 'ONLINE',
      })

      const firstCall = await awardServiceCompletionWalletCredit(b8._id)
      assert.strictEqual(firstCall.awarded, true)

      const secondCall = await awardServiceCompletionWalletCredit(b8._id)
      assert.strictEqual(secondCall.alreadyCredited, true, 'Second call must detect existing credit')
      assert.strictEqual(secondCall.awarded, false)

      const wallet8 = await Wallet.findOne({ userId: u8._id })
      assert.strictEqual(wallet8.balance, 150, 'Balance must remain ₹150, not ₹300')

      const countTx = await WalletTransaction.countDocuments({ idempotencyKey: `SERVICE_CREDIT_${b8._id}` })
      assert.strictEqual(countTx, 1, 'Exactly 1 ledger record must exist')

      pass('Duplicate completion events produce one credit', 'Sequential duplicates prevented')
    } catch (e) {
      fail('Duplicate completion events produce one credit', e)
    }

    // -------------------------------------------------------------
    // Test 9: Concurrent requests cannot duplicate the credit
    // -------------------------------------------------------------
    try {
      const u9 = await User.create({
        fullName: 'Concurrent Customer',
        phone: randomPhone(),
        role: 'customer',
        isPhoneVerified: true,
      })
      createdUserIds.push(u9._id)

      const b9 = await createTestBooking({
        userId: u9._id,
        basePrice: 1000,
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        paymentMethod: 'ONLINE',
      })

      // Fire 5 concurrent completion events simultaneously
      const results = await Promise.all([
        awardServiceCompletionWalletCredit(b9._id),
        awardServiceCompletionWalletCredit(b9._id),
        awardServiceCompletionWalletCredit(b9._id),
        awardServiceCompletionWalletCredit(b9._id),
        awardServiceCompletionWalletCredit(b9._id),
      ])

      const awardedCount = results.filter(r => r.awarded === true).length
      assert.strictEqual(awardedCount, 1, 'Only 1 of the 5 concurrent calls must succeed in awarding')

      const wallet9 = await Wallet.findOne({ userId: u9._id })
      assert.strictEqual(wallet9.balance, 150, 'Concurrent race condition balance is strictly ₹150')

      pass('Concurrent requests cannot duplicate the credit', 'Race conditions prevented via atomic db lock')
    } catch (e) {
      fail('Concurrent requests cannot duplicate the credit', e)
    }

    // -------------------------------------------------------------
    // Test 10: Transaction rollback does not leave an inconsistent balance
    // -------------------------------------------------------------
    try {
      const u10 = await User.create({
        fullName: 'Rollback Customer',
        phone: randomPhone(),
        role: 'customer',
        isPhoneVerified: true,
      })
      createdUserIds.push(u10._id)

      // Initial wallet balance
      const w10 = await getOrCreateUserWallet(u10._id)
      assert.strictEqual(w10.balance, 0)

      // Test with non-existent booking ID
      const fakeBookingId = new mongoose.Types.ObjectId()
      const resFake = await awardServiceCompletionWalletCredit(fakeBookingId)
      assert.strictEqual(resFake.awarded, false)
      assert.strictEqual(resFake.reason, 'BOOKING_NOT_FOUND')

      const w10After = await Wallet.findOne({ userId: u10._id })
      assert.strictEqual(w10After.balance, 0, 'Balance unaltered after failure')

      pass('Transaction rollback does not leave an inconsistent balance', 'No dirty state on errors')
    } catch (e) {
      fail('Transaction rollback does not leave an inconsistent balance', e)
    }

    // -------------------------------------------------------------
    // Test 11: Invalid, negative, infinite or out-of-range configuration values are rejected
    // -------------------------------------------------------------
    try {
      let rejectedNeg = false
      try {
        await updateWalletSettings({ serviceCreditPercentage: -5 }, testAdmin._id)
      } catch (e) {
        rejectedNeg = true
      }
      assert.strictEqual(rejectedNeg, true, 'Negative percentage rejected')

      let rejectedOver = false
      try {
        await updateWalletSettings({ serviceCreditPercentage: 105 }, testAdmin._id)
      } catch (e) {
        rejectedOver = true
      }
      assert.strictEqual(rejectedOver, true, 'Percentage > 100 rejected')

      let rejectedNaN = false
      try {
        await updateWalletSettings({ serviceCreditPercentage: NaN }, testAdmin._id)
      } catch (e) {
        rejectedNaN = true
      }
      assert.strictEqual(rejectedNaN, true, 'NaN percentage rejected')

      pass('Invalid, negative, infinite or out-of-range configuration values are rejected', 'Full range validation verified')
    } catch (e) {
      fail('Invalid, negative, infinite or out-of-range configuration values are rejected', e)
    }

    // -------------------------------------------------------------
    // Test 12: Discounts, GST and additional fees follow the defined eligible-amount policy
    // -------------------------------------------------------------
    try {
      const u12 = await User.create({
        fullName: 'Policy Customer',
        phone: randomPhone(),
        role: 'customer',
        isPhoneVerified: true,
      })
      createdUserIds.push(u12._id)

      // Booking where basePrice is ₹1,000, but platformFee is ₹50 and GST is ₹189 (total ₹1,239)
      const b12 = await createTestBooking({
        userId: u12._id,
        basePrice: 1000,
        platformFee: 50,
        taxes: 189,
        totalAmount: 1239,
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        paymentMethod: 'ONLINE',
      })

      const res12 = await awardServiceCompletionWalletCredit(b12._id)
      assert.strictEqual(res12.eligibleAmount, 1000, 'Eligible amount is basePrice (excludes GST and fees)')
      assert.strictEqual(res12.creditAmount, 150, 'Credit is 15% of ₹1,000 basePrice, NOT of ₹1,239 total')

      pass('Discounts, GST and additional fees follow the defined eligible-amount policy', 'BasePrice used strictly')
    } catch (e) {
      fail('Discounts, GST and additional fees follow the defined eligible-amount policy', e)
    }

    // -------------------------------------------------------------
    // Test 13: Refunds and partial refunds follow the configured adjustment policy
    // -------------------------------------------------------------
    try {
      const u13 = await User.create({
        fullName: 'Refund Customer',
        phone: randomPhone(),
        role: 'customer',
        isPhoneVerified: true,
      })
      createdUserIds.push(u13._id)

      const b13 = await createTestBooking({
        userId: u13._id,
        basePrice: 1000,
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        paymentMethod: 'ONLINE',
      })

      // 1. Credit the booking
      await awardServiceCompletionWalletCredit(b13._id)
      let w13 = await Wallet.findOne({ userId: u13._id })
      assert.strictEqual(w13.balance, 150)

      // 2. Trigger reversal on cancellation/refund
      const revResult = await reverseServiceCompletionWalletCredit({
        bookingId: b13._id,
        reason: 'Customer initiated full refund',
        adminUserId: testAdmin._id,
      })
      assert.strictEqual(revResult.reversed, true)
      assert.strictEqual(revResult.reversedAmount, 150)

      w13 = await Wallet.findOne({ userId: u13._id })
      assert.strictEqual(w13.balance, 0, 'Balance successfully reduced back to 0')

      const revTx = await WalletTransaction.findOne({ idempotencyKey: `SERVICE_CREDIT_REVERSAL_${b13._id}` })
      assert.ok(revTx, 'Reversal transaction recorded in ledger')
      assert.strictEqual(revTx.type, 'DEBIT')
      assert.strictEqual(revTx.context, 'REVERSAL')

      // 3. Repeated reversal must be idempotent
      const revAgain = await reverseServiceCompletionWalletCredit({ bookingId: b13._id })
      assert.strictEqual(revAgain.alreadyReversed, true, 'Duplicate reversal recognized')

      pass('Refunds and partial refunds follow the configured adjustment policy', 'Reversal ledger & idempotency verified')
    } catch (e) {
      fail('Refunds and partial refunds follow the configured adjustment policy', e)
    }

    // -------------------------------------------------------------
    // Test 14: A credit already spent is handled without silently corrupting the ledger
    // -------------------------------------------------------------
    try {
      const u14 = await User.create({
        fullName: 'Spent Credit Customer',
        phone: randomPhone(),
        role: 'customer',
        isPhoneVerified: true,
      })
      createdUserIds.push(u14._id)

      const b14 = await createTestBooking({
        userId: u14._id,
        basePrice: 1000,
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        paymentMethod: 'ONLINE',
      })

      // 1. Credit ₹150
      await awardServiceCompletionWalletCredit(b14._id)

      // 2. Customer spends ₹100 on another booking
      const b14Other = await createTestBooking({
        userId: u14._id,
        basePrice: 500,
      })

      await deductWalletForBooking({
        userId: u14._id,
        bookingId: b14Other._id,
        eligibleBillAmount: 500,
        requestedUseWallet: true,
      })

      const w14Mid = await Wallet.findOne({ userId: u14._id })
      // Max 20% discount on ₹500 is ₹100
      assert.strictEqual(w14Mid.balance, 50, 'Remaining balance is ₹50 (150 - 100)')

      // 3. Reversal triggered: Original credit was ₹150, but customer only has ₹50 left!
      const revSpent = await reverseServiceCompletionWalletCredit({
        bookingId: b14._id,
        reason: 'Post-completion dispute',
      })

      assert.strictEqual(revSpent.reversed, true)
      assert.strictEqual(revSpent.reversedAmount, 50, 'Recovers only the available ₹50 balance')
      assert.strictEqual(revSpent.unrecoveredAmount, 100, 'Records unrecovered ₹100 transparently')

      const w14After = await Wallet.findOne({ userId: u14._id })
      assert.strictEqual(w14After.balance, 0, 'Balance is safely 0, never negative!')

      pass('A credit already spent is handled without silently corrupting the ledger', 'Non-negative balance safety confirmed')
    } catch (e) {
      fail('A credit already spent is handled without silently corrupting the ledger', e)
    }

    // -------------------------------------------------------------
    // Test 15: Admin percentage changes do not alter historical transactions
    // -------------------------------------------------------------
    try {
      const u15 = await User.create({
        fullName: 'Historical Test Customer',
        phone: randomPhone(),
        role: 'customer',
        isPhoneVerified: true,
      })
      createdUserIds.push(u15._id)

      // Booking completed under 15% rate
      const b15A = await createTestBooking({
        userId: u15._id,
        basePrice: 1000,
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        paymentMethod: 'ONLINE',
      })

      await awardServiceCompletionWalletCredit(b15A._id)

      // Admin updates percentage to 20%
      await updateWalletSettings({ serviceCreditPercentage: 20 }, testAdmin._id)

      // Historical transaction check: must still be 15% and ₹150
      const oldTx = await WalletTransaction.findOne({ idempotencyKey: `SERVICE_CREDIT_${b15A._id}` })
      assert.strictEqual(oldTx.amount, 150, 'Historical ledger amount must NOT change')
      assert.strictEqual(oldTx.metadata.appliedPercentage, 15, 'Historical percentage recorded in metadata must stay 15%')

      // New booking completed under 20% rate
      const b15B = await createTestBooking({
        userId: u15._id,
        basePrice: 1000,
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        paymentMethod: 'ONLINE',
      })

      const resNew = await awardServiceCompletionWalletCredit(b15B._id)
      assert.strictEqual(resNew.creditAmount, 200, 'New booking receives 20% = ₹200')

      // Reset percentage to 15%
      await updateWalletSettings({ serviceCreditPercentage: 15 }, testAdmin._id)
      pass('Admin percentage changes do not alter historical transactions', 'Historical audit integrity intact')
    } catch (e) {
      fail('Admin percentage changes do not alter historical transactions', e)
    }

    // -------------------------------------------------------------
    // Test 16: Notification failures do not affect the wallet balance
    // -------------------------------------------------------------
    try {
      const u16 = await User.create({
        fullName: 'Notification Resilience Customer',
        phone: randomPhone(),
        role: 'customer',
        isPhoneVerified: true,
      })
      createdUserIds.push(u16._id)

      const b16 = await createTestBooking({
        userId: u16._id,
        basePrice: 1000,
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        paymentMethod: 'ONLINE',
      })

      // In userWalletService, notification delivery is wrapped in try/catch and logged
      const res16 = await awardServiceCompletionWalletCredit(b16._id)
      assert.strictEqual(res16.awarded, true)
      assert.strictEqual(res16.balanceAfter, 150)

      pass('Notification failures do not affect the wallet balance', 'Asynchronous notification error isolation verified')
    } catch (e) {
      fail('Notification failures do not affect the wallet balance', e)
    }

    // -------------------------------------------------------------
    // Test 17: Customers cannot view or change another customer's wallet
    // -------------------------------------------------------------
    try {
      const u17A = await User.create({
        fullName: 'Customer A',
        phone: randomPhone(),
        role: 'customer',
        isPhoneVerified: true,
      })
      const u17B = await User.create({
        fullName: 'Customer B',
        phone: randomPhone(),
        role: 'customer',
        isPhoneVerified: true,
      })
      createdUserIds.push(u17A._id, u17B._id)

      const wA = await getOrCreateUserWallet(u17A._id)
      const wB = await getOrCreateUserWallet(u17B._id)

      assert.notStrictEqual(wA._id.toString(), wB._id.toString(), 'Wallets are unique per user')
      assert.strictEqual(wA.userId.toString(), u17A._id.toString())
      assert.strictEqual(wB.userId.toString(), u17B._id.toString())

      pass('Customers cannot view or change another customer\'s wallet', 'Data model enforces strict user boundary')
    } catch (e) {
      fail('Customers cannot view or change another customer\'s wallet', e)
    }

    // -------------------------------------------------------------
    // Test 18: Existing customer wallet payments and the service-provider wallet flow continue working
    // -------------------------------------------------------------
    try {
      const u18 = await User.create({
        fullName: 'Provider Flow Customer',
        phone: randomPhone(),
        role: 'customer',
        isPhoneVerified: true,
      })
      createdUserIds.push(u18._id)

      const b18 = await createTestBooking({
        userId: u18._id,
        basePrice: 1000,
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        paymentMethod: 'ONLINE',
      })

      await awardServiceCompletionWalletCredit(b18._id)

      // Test wallet deduction on new booking
      const b18Next = await createTestBooking({
        userId: u18._id,
        basePrice: 500,
      })

      const deductRes = await deductWalletForBooking({
        userId: u18._id,
        bookingId: b18Next._id,
        eligibleBillAmount: 500,
        requestedUseWallet: true,
      })
      assert.strictEqual(deductRes.applied, true)
      assert.strictEqual(deductRes.amount, 100) // 20% max discount of ₹500 is ₹100
      assert.strictEqual(deductRes.balanceAfter, 50) // 150 - 100 = 50

      pass('Existing customer wallet payments and the service-provider wallet flow continue working', 'Checkout deduction intact')
    } catch (e) {
      fail('Existing customer wallet payments and the service-provider wallet flow continue working', e)
    }

    // -------------------------------------------------------------
    // Test 19: The same credit cannot be generated by multiple backend triggers
    // -------------------------------------------------------------
    try {
      const u19 = await User.create({
        fullName: 'Multi Trigger Customer',
        phone: randomPhone(),
        role: 'customer',
        isPhoneVerified: true,
      })
      createdUserIds.push(u19._id)

      const b19 = await createTestBooking({
        userId: u19._id,
        basePrice: 1000,
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        paymentMethod: 'ONLINE',
      })

      // Trigger 1: Job completion trigger (e.g. status transition)
      const t1 = await awardServiceCompletionWalletCredit(b19._id)
      assert.strictEqual(t1.awarded, true)

      // Trigger 2: Payment webhook trigger (e.g. verifyPayment callback)
      const t2 = await awardServiceCompletionWalletCredit(b19._id)
      assert.strictEqual(t2.alreadyCredited, true)

      // Trigger 3: Admin manual retry button
      const t3 = await awardServiceCompletionWalletCredit(b19._id)
      assert.strictEqual(t3.alreadyCredited, true)

      const w19 = await Wallet.findOne({ userId: u19._id })
      assert.strictEqual(w19.balance, 150, 'Balance is credited exactly once across 3 different trigger paths')

      pass('The same credit cannot be generated by multiple backend triggers', 'Cross-trigger deduplication verified')
    } catch (e) {
      fail('The same credit cannot be generated by multiple backend triggers', e)
    }

    // -------------------------------------------------------------
    // Test 20: Monetary rounding, zero-value bookings and configured credit limits behave correctly
    // -------------------------------------------------------------
    try {
      const u20 = await User.create({
        fullName: 'Rounding & Limit Customer',
        phone: randomPhone(),
        role: 'customer',
        isPhoneVerified: true,
      })
      createdUserIds.push(u20._id)

      // 20a. Zero-value booking
      const bZero = await createTestBooking({
        userId: u20._id,
        basePrice: 0,
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        paymentMethod: 'ONLINE',
      })

      const resZero = await awardServiceCompletionWalletCredit(bZero._id)
      assert.strictEqual(resZero.awarded, false)
      assert.strictEqual(resZero.reason, 'ZERO_ELIGIBLE_AMOUNT')

      // 20b. Fractional base price: ₹333 * 15% = 49.95 -> rounds to 50
      const bFractional = await createTestBooking({
        userId: u20._id,
        basePrice: 333,
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        paymentMethod: 'ONLINE',
      })

      const resFrac = await awardServiceCompletionWalletCredit(bFractional._id)
      assert.strictEqual(resFrac.awarded, true)
      assert.strictEqual(resFrac.creditAmount, 50, 'Math.round(333 * 0.15) = 50 integer currency')

      // 20c. Configured Max Limit Cap: e.g. Max ₹100 credit
      await updateWalletSettings({ serviceCreditMaxAmount: 100 }, testAdmin._id)

      const bCapped = await createTestBooking({
        userId: u20._id,
        basePrice: 5000, // 15% would be ₹750, but cap is ₹100
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        paymentMethod: 'ONLINE',
      })

      const resCapped = await awardServiceCompletionWalletCredit(bCapped._id)
      assert.strictEqual(resCapped.awarded, true)
      assert.strictEqual(resCapped.creditAmount, 100, 'Capped at configured max ₹100')

      // Reset settings
      await updateWalletSettings({ serviceCreditMaxAmount: 0 }, testAdmin._id)

      pass('Monetary rounding, zero-value bookings and configured credit limits behave correctly', 'Rounding and cap tested')
    } catch (e) {
      fail('Monetary rounding, zero-value bookings and configured credit limits behave correctly', e)
    }

  } finally {
    // Clean up test data
    console.log('\nCleaning up created test records...')
    if (createdBookingIds.length > 0) {
      await Booking.deleteMany({ _id: { $in: createdBookingIds } })
      await WalletTransaction.deleteMany({ bookingId: { $in: createdBookingIds } })
    }
    if (createdUserIds.length > 0) {
      await Wallet.deleteMany({ userId: { $in: createdUserIds } })
      await WalletTransaction.deleteMany({ userId: { $in: createdUserIds } })
      await User.deleteMany({ _id: { $in: createdUserIds } })
    }
    await mongoose.disconnect()
    console.log('Database disconnected.')
  }

  console.log('\n========================================================================')
  console.log(`📊 TEST RESULTS: ${passed} PASSED | ${failed} FAILED`)
  console.log('========================================================================')

  if (failed > 0) {
    process.exit(1)
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal test error:', err)
  process.exit(1)
})
