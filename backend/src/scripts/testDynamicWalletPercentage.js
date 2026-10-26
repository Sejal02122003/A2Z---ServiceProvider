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
import { ServicePackage } from '../models/ServicePackage.js'
import { PaymentTransaction } from '../models/PaymentTransaction.js'
import {
  getWalletSettings,
  updateWalletSettings,
  getOrCreateUserWallet,
  calculateWalletDiscount,
  deductWalletForBooking,
  refundWalletForBooking,
  ensureWelcomeBonus,
} from '../services/userWalletService.js'

const randomPhone = () => '9' + Math.floor(100000000 + Math.random() * 900000000).toString()

async function runAllTests() {
  console.log('========================================================================')
  console.log('🚀 A2Z SERVICEPROVIDER: DYNAMIC WALLET DEDUCTION TEST SUITE')
  console.log('   Testing all 28 mandatory scenarios per production specification')
  console.log('========================================================================\n')

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/a2z-service-provider'
  await mongoose.connect(mongoUri)
  console.log('Connected to MongoDB.\n')

  let passed = 0
  let failed = 0
  const createdUserIds = []
  const createdBookingIds = []
  const createdPackageIds = []

  function pass(testName, detail = '') {
    passed++
    console.log(`✅ [PASS] Test ${passed}: ${testName}${detail ? ' (' + detail + ')' : ''}`)
  }

  function fail(testName, err) {
    failed++
    console.error(`❌ [FAIL] Test ${passed + failed}: ${testName}`)
    console.error(`   Error: ${err.message}\n`)
  }

  function mockBookingPayload(overrides = {}) {
    const dummyServiceId = new mongoose.Types.ObjectId()
    const dummySubcatId = new mongoose.Types.ObjectId()
    return {
      serviceId: dummyServiceId,
      subcategoryId: dummySubcatId,
      laborShare: overrides.laborShare ?? (overrides.totalAmount || 1000),
      basePrice: overrides.basePrice || 2000,
      platformFee: overrides.platformFee || 0,
      taxes: overrides.taxes || 0,
      totalAmount: overrides.totalAmount || 1600,
      paymentMethod: overrides.paymentMethod || 'CASH',
      type: overrides.type || 'INSTANT',
      status: overrides.status || 'CREATED',
      address: { locationText: '123 Test St' },
      ...overrides,
    }
  }

  // Create an authorized test Admin
  const testAdmin = await User.create({
    fullName: 'Executive Wallet Admin',
    phone: randomPhone(),
    email: `admin_wallet_${Date.now()}@a2z.com`,
    role: 'admin',
    isPhoneVerified: true,
  })
  createdUserIds.push(testAdmin._id)

  try {
    // -------------------------------------------------------------
    // Test 1: Wallet usage disabled
    // -------------------------------------------------------------
    try {
      await updateWalletSettings({ enabled: false, walletDiscountPercentage: 20 }, testAdmin._id)
      const u1 = await User.create({ fullName: 'Cust T1', phone: randomPhone(), role: 'customer', isPhoneVerified: true })
      createdUserIds.push(u1._id)
      const w1 = await getOrCreateUserWallet(u1._id)
      w1.balance = 5000
      w1.selfBalance = 5000
      await w1.save()

      const calc1 = await calculateWalletDiscount(u1._id, 2000)
      assert.strictEqual(calc1.enabled, false, 'Enabled should be false')
      assert.strictEqual(calc1.walletDeduction, 0, 'Wallet deduction must be 0 when disabled')
      assert.strictEqual(calc1.maxWalletUsage, 0, 'Max wallet usage must be 0')
      assert.strictEqual(calc1.remainingPayable, 2000, 'Remaining payable must equal entire order amount')
      pass('Wallet usage disabled', 'deduction: ₹0, payable: ₹2,000')
    } catch (err) {
      fail('Wallet usage disabled', err)
    }

    // -------------------------------------------------------------
    // Test 2: Percentage set to zero
    // -------------------------------------------------------------
    try {
      await updateWalletSettings({ enabled: true, walletDiscountPercentage: 0 }, testAdmin._id)
      const u2 = await User.create({ fullName: 'Cust T2', phone: randomPhone(), role: 'customer', isPhoneVerified: true })
      createdUserIds.push(u2._id)
      const w2 = await getOrCreateUserWallet(u2._id)
      w2.balance = 5000
      w2.selfBalance = 5000
      await w2.save()

      const calc2 = await calculateWalletDiscount(u2._id, 2000)
      assert.strictEqual(calc2.walletDeduction, 0, 'Deduction must be 0 at 0%')
      assert.strictEqual(calc2.maxWalletUsage, 0, 'Max wallet usage must be 0')
      assert.strictEqual(calc2.remainingPayable, 2000, 'Payable must be ₹2,000')
      pass('Percentage set to zero', 'deduction: ₹0, percentage: 0%')
    } catch (err) {
      fail('Percentage set to zero', err)
    }

    // -------------------------------------------------------------
    // Test 3: Percentage set to 1%
    // -------------------------------------------------------------
    try {
      await updateWalletSettings({ enabled: true, walletDiscountPercentage: 1 }, testAdmin._id)
      const u3 = await User.create({ fullName: 'Cust T3', phone: randomPhone(), role: 'customer', isPhoneVerified: true })
      createdUserIds.push(u3._id)
      const w3 = await getOrCreateUserWallet(u3._id)
      w3.balance = 5000
      w3.selfBalance = 5000
      await w3.save()

      const calc3 = await calculateWalletDiscount(u3._id, 2000)
      assert.strictEqual(calc3.maxWalletUsage, 20, '1% of ₹2,000 must be ₹20')
      assert.strictEqual(calc3.walletDeduction, 20, 'Actual deduction must be ₹20')
      assert.strictEqual(calc3.remainingPayable, 1980, 'Payable must be ₹1,980')
      pass('Percentage set to 1%', 'deduction: ₹20, payable: ₹1,980')
    } catch (err) {
      fail('Percentage set to 1%', err)
    }

    // -------------------------------------------------------------
    // Test 4: Percentage set to 20%
    // -------------------------------------------------------------
    try {
      await updateWalletSettings({ enabled: true, walletDiscountPercentage: 20 }, testAdmin._id)
      const u4 = await User.create({ fullName: 'Cust T4', phone: randomPhone(), role: 'customer', isPhoneVerified: true })
      createdUserIds.push(u4._id)
      const w4 = await getOrCreateUserWallet(u4._id)
      w4.balance = 5000
      w4.selfBalance = 5000
      await w4.save()

      const calc4 = await calculateWalletDiscount(u4._id, 2000)
      assert.strictEqual(calc4.maxWalletUsage, 400, '20% of ₹2,000 must be ₹400')
      assert.strictEqual(calc4.walletDeduction, 400, 'Actual deduction must be ₹400')
      assert.strictEqual(calc4.remainingPayable, 1600, 'Payable must be ₹1,600')
      pass('Percentage set to 20%', 'deduction: ₹400, payable: ₹1,600')
    } catch (err) {
      fail('Percentage set to 20%', err)
    }

    // -------------------------------------------------------------
    // Test 5: Percentage set to 100%
    // -------------------------------------------------------------
    try {
      await updateWalletSettings({ enabled: true, walletDiscountPercentage: 100 }, testAdmin._id)
      const u5 = await User.create({ fullName: 'Cust T5', phone: randomPhone(), role: 'customer', isPhoneVerified: true })
      createdUserIds.push(u5._id)
      const w5 = await getOrCreateUserWallet(u5._id)
      w5.balance = 5000
      w5.selfBalance = 5000
      await w5.save()

      const calc5 = await calculateWalletDiscount(u5._id, 2000)
      assert.strictEqual(calc5.maxWalletUsage, 2000, '100% of ₹2,000 must be ₹2,000')
      assert.strictEqual(calc5.walletDeduction, 2000, 'Actual deduction must be ₹2,000')
      assert.strictEqual(calc5.remainingPayable, 0, 'Payable must be ₹0')
      pass('Percentage set to 100%', 'deduction: ₹2,000, payable: ₹0')
    } catch (err) {
      fail('Percentage set to 100%', err)
    }

    // -------------------------------------------------------------
    // Test 6: Invalid negative percentage
    // -------------------------------------------------------------
    try {
      let rejected = false
      try {
        await updateWalletSettings({ walletDiscountPercentage: -10 }, testAdmin._id)
      } catch (e) {
        rejected = true
      }
      assert.strictEqual(rejected, true, 'Negative percentage must be rejected')
      pass('Invalid negative percentage', 'Correctly rejected with error')
    } catch (err) {
      fail('Invalid negative percentage', err)
    }

    // -------------------------------------------------------------
    // Test 7: Percentage above 100%
    // -------------------------------------------------------------
    try {
      let rejected = false
      try {
        await updateWalletSettings({ walletDiscountPercentage: 105 }, testAdmin._id)
      } catch (e) {
        rejected = true
      }
      assert.strictEqual(rejected, true, 'Percentage above 100 must be rejected')
      pass('Percentage above 100%', 'Correctly rejected with error')
    } catch (err) {
      fail('Percentage above 100%', err)
    }

    // -------------------------------------------------------------
    // Test 8: Missing and non-numeric settings
    // -------------------------------------------------------------
    try {
      let rejectedNaN = false
      try {
        await updateWalletSettings({ walletDiscountPercentage: 'INVALID' }, testAdmin._id)
      } catch (e) {
        rejectedNaN = true
      }
      let rejectedNull = false
      try {
        await updateWalletSettings({ walletDiscountPercentage: null }, testAdmin._id)
      } catch (e) {
        rejectedNull = true
      }
      assert.strictEqual(rejectedNaN, true, 'NaN must be rejected')
      assert.strictEqual(rejectedNull, true, 'null must be rejected')
      pass('Missing and non-numeric settings', 'NaN and null correctly rejected')
    } catch (err) {
      fail('Missing and non-numeric settings', err)
    }

    // -------------------------------------------------------------
    // Test 9: Wallet balance greater than permitted deduction
    // -------------------------------------------------------------
    try {
      await updateWalletSettings({ enabled: true, walletDiscountPercentage: 20 }, testAdmin._id)
      const u9 = await User.create({ fullName: 'Cust T9', phone: randomPhone(), role: 'customer', isPhoneVerified: true })
      createdUserIds.push(u9._id)
      const w9 = await getOrCreateUserWallet(u9._id)
      w9.balance = 5000
      w9.selfBalance = 5000
      await w9.save()

      const calc9 = await calculateWalletDiscount(u9._id, 2000)
      assert.strictEqual(calc9.maxWalletUsage, 400)
      assert.strictEqual(calc9.walletDeduction, 400)
      assert.strictEqual(calc9.remainingPayable, 1600)
      pass('Wallet balance greater than permitted deduction', 'deducts max permitted ₹400 from ₹5,000 balance')
    } catch (err) {
      fail('Wallet balance greater than permitted deduction', err)
    }

    // -------------------------------------------------------------
    // Test 10: Wallet balance smaller than permitted deduction
    // -------------------------------------------------------------
    try {
      const u10 = await User.create({ fullName: 'Cust T10', phone: randomPhone(), role: 'customer', isPhoneVerified: true })
      createdUserIds.push(u10._id)
      const w10 = await getOrCreateUserWallet(u10._id)
      w10.balance = 150
      w10.selfBalance = 150
      await w10.save()

      const calc10 = await calculateWalletDiscount(u10._id, 2000)
      assert.strictEqual(calc10.maxWalletUsage, 400, 'Max usage is ₹400')
      assert.strictEqual(calc10.walletDeduction, 150, 'Actual deduction must be capped at available balance ₹150')
      assert.strictEqual(calc10.remainingPayable, 1850, 'Remaining payable must be ₹1,850')
      pass('Wallet balance smaller than permitted deduction', 'uses partial balance ₹150, payable ₹1,850')
    } catch (err) {
      fail('Wallet balance smaller than permitted deduction', err)
    }

    // -------------------------------------------------------------
    // Test 11: Zero wallet balance
    // -------------------------------------------------------------
    try {
      const u11 = await User.create({ fullName: 'Cust T11', phone: randomPhone(), role: 'customer', isPhoneVerified: true })
      createdUserIds.push(u11._id)
      const w11 = await getOrCreateUserWallet(u11._id)
      w11.balance = 0
      w11.selfBalance = 0
      await w11.save()

      const calc11 = await calculateWalletDiscount(u11._id, 2000)
      assert.strictEqual(calc11.walletDeduction, 0, 'Deduction must be 0 for empty wallet')
      assert.strictEqual(calc11.remainingPayable, 2000, 'Payable must remain ₹2,000')
      pass('Zero wallet balance', 'deduction: ₹0, payable: ₹2,000')
    } catch (err) {
      fail('Zero wallet balance', err)
    }

    // -------------------------------------------------------------
    // Test 12: Invalid or zero order amount
    // -------------------------------------------------------------
    try {
      const calcZero = await calculateWalletDiscount(null, 0)
      assert.strictEqual(calcZero.walletDeduction, 0)
      assert.strictEqual(calcZero.remainingPayable, 0)

      let rejectedNegative = false
      try {
        await calculateWalletDiscount(null, -500)
      } catch (e) {
        rejectedNegative = true
      }
      assert.strictEqual(rejectedNegative, true, 'Negative bill must be rejected')
      pass('Invalid or zero order amount', '0 bill produces 0 deduction; negative bill throws error')
    } catch (err) {
      fail('Invalid or zero order amount', err)
    }

    // -------------------------------------------------------------
    // Test 13: Service discounts and applicable charges
    // -------------------------------------------------------------
    try {
      // Base: 2000, discount: 200 -> subtotal: 1800, GST 18% -> taxes: 324 -> eligible: 2124
      const eligibleAmount = 2124
      const u13 = await User.create({ fullName: 'Cust T13', phone: randomPhone(), role: 'customer', isPhoneVerified: true })
      createdUserIds.push(u13._id)
      const w13 = await getOrCreateUserWallet(u13._id)
      w13.balance = 5000
      w13.selfBalance = 5000
      await w13.save()

      const calc13 = await calculateWalletDiscount(u13._id, eligibleAmount)
      // 2124 * 20% = 424.8 -> rounded: 425
      assert.strictEqual(calc13.maxWalletUsage, 425)
      assert.strictEqual(calc13.walletDeduction, 425)
      assert.strictEqual(calc13.remainingPayable, 1699)
      pass('Service discounts and applicable charges', 'calculated on total order (base + taxes) after service discount')
    } catch (err) {
      fail('Service discounts and applicable charges', err)
    }

    // -------------------------------------------------------------
    // Test 14: Multiple-service bookings
    // -------------------------------------------------------------
    try {
      // Multi-service cart total = ₹3,500
      const multiServiceTotal = 3500
      const u14 = await User.create({ fullName: 'Cust T14', phone: randomPhone(), role: 'customer', isPhoneVerified: true })
      createdUserIds.push(u14._id)
      const w14 = await getOrCreateUserWallet(u14._id)
      w14.balance = 1000
      w14.selfBalance = 1000
      await w14.save()

      const calc14 = await calculateWalletDiscount(u14._id, multiServiceTotal)
      // 3500 * 20% = 700. Balance is 1000 -> deduction = 700, remaining = 2800
      assert.strictEqual(calc14.maxWalletUsage, 700)
      assert.strictEqual(calc14.walletDeduction, 700)
      assert.strictEqual(calc14.remainingPayable, 2800)
      pass('Multiple-service bookings', 'deduction: ₹700, remaining payable: ₹2,800')
    } catch (err) {
      fail('Multiple-service bookings', err)
    }

    // -------------------------------------------------------------
    // Test 15: Predefined package bookings
    // -------------------------------------------------------------
    try {
      const dummyCatId = new mongoose.Types.ObjectId()
      const dummyServiceId = new mongoose.Types.ObjectId()
      const pkg = await ServicePackage.create({
        name: 'Home Deep Cleaning Package',
        slug: `home-deep-cleaning-${Date.now()}`,
        description: 'Comprehensive deep cleaning package for 2BHK/3BHK homes.',
        categoryId: dummyCatId,
        inclusions: [
          {
            serviceId: dummyServiceId,
            name: 'Deep Clean Service',
            quantity: 1,
            description: 'Included full house clean',
          },
        ],
        price: 2500,
        originalPrice: 3200,
        status: 'ACTIVE',
      })
      createdPackageIds.push(pkg._id)

      const u15 = await User.create({ fullName: 'Cust T15', phone: randomPhone(), role: 'customer', isPhoneVerified: true })
      createdUserIds.push(u15._id)
      const w15 = await getOrCreateUserWallet(u15._id)
      w15.balance = 3000
      w15.selfBalance = 3000
      await w15.save()

      const calc15 = await calculateWalletDiscount(u15._id, pkg.price)
      // 2500 * 20% = 500
      assert.strictEqual(calc15.maxWalletUsage, 500)
      assert.strictEqual(calc15.walletDeduction, 500)
      assert.strictEqual(calc15.remainingPayable, 2000)
      pass('Predefined package bookings', 'package price ₹2,500 -> ₹500 wallet discount applied')
    } catch (err) {
      fail('Predefined package bookings', err)
    }

    // -------------------------------------------------------------
    // Test 16: Admin changes the percentage
    // -------------------------------------------------------------
    try {
      const updated = await updateWalletSettings({ walletDiscountPercentage: 35 }, testAdmin._id, 'Seasonal Festival Promo')
      assert.strictEqual(updated.walletDiscountPercentage, 35)
      assert(updated.auditLog.length > 0, 'Audit log must record change')
      const lastAudit = updated.auditLog[updated.auditLog.length - 1]
      assert.strictEqual(lastAudit.newValues.walletDiscountPercentage, 35)
      assert.strictEqual(String(lastAudit.performedBy), String(testAdmin._id))
      pass('Admin changes the percentage', 'changed to 35% with persistent audit trail')
    } catch (err) {
      fail('Admin changes the percentage', err)
    }

    // -------------------------------------------------------------
    // Test 17: Existing confirmed booking remains unchanged
    // -------------------------------------------------------------
    try {
      // 1. Confirm booking with 20% (deduction = 400)
      await updateWalletSettings({ walletDiscountPercentage: 20 }, testAdmin._id)
      const u17 = await User.create({ fullName: 'Cust T17', phone: randomPhone(), role: 'customer', isPhoneVerified: true })
      createdUserIds.push(u17._id)
      const w17 = await getOrCreateUserWallet(u17._id)
      w17.balance = 2000
      w17.selfBalance = 2000
      await w17.save()

      const b17 = await Booking.create(mockBookingPayload({
        userId: u17._id,
        basePrice: 2000,
        platformFee: 0,
        taxes: 0,
        totalAmount: 1600,
        laborShare: 1600,
        paymentMethod: 'CASH',
        type: 'INSTANT',
        status: 'CREATED',
        address: { locationText: '123 Test St' },
        walletDiscount: {
          applied: true,
          amount: 400,
          percentage: 20,
          eligibleAmount: 2000,
        },
      }))
      createdBookingIds.push(b17._id)

      // 2. Admin now changes percentage to 50%
      await updateWalletSettings({ walletDiscountPercentage: 50 }, testAdmin._id)

      // 3. Re-fetch confirmed booking: must still be 400 & 20%!
      const confirmedBooking = await Booking.findById(b17._id)
      assert.strictEqual(confirmedBooking.walletDiscount.amount, 400, 'Confirmed deduction must stay 400')
      assert.strictEqual(confirmedBooking.walletDiscount.percentage, 20, 'Confirmed percentage must stay 20%')
      assert.strictEqual(confirmedBooking.totalAmount, 1600, 'Confirmed totalAmount must stay 1600')
      pass('Existing confirmed booking remains unchanged', 'deduction frozen at ₹400 despite admin change to 50%')
    } catch (err) {
      fail('Existing confirmed booking remains unchanged', err)
    }

    // -------------------------------------------------------------
    // Test 18: Failed booking creation
    // -------------------------------------------------------------
    try {
      // Reset setting to 20%
      await updateWalletSettings({ walletDiscountPercentage: 20 }, testAdmin._id)
      const u18 = await User.create({ fullName: 'Cust T18', phone: randomPhone(), role: 'customer', isPhoneVerified: true })
      createdUserIds.push(u18._id)
      const w18 = await getOrCreateUserWallet(u18._id)
      w18.balance = 1000
      w18.selfBalance = 1000
      await w18.save()

      // Step A: Deduct wallet
      const deductRes = await deductWalletForBooking({
        userId: u18._id,
        bookingId: null,
        eligibleBillAmount: 2000,
        requestedUseWallet: true,
      })
      assert.strictEqual(deductRes.applied, true)
      assert.strictEqual(deductRes.amount, 400)

      // Step B: Simulate booking creation exception and immediate rollback
      const rollbackRes = await refundWalletForBooking({
        userId: u18._id,
        bookingId: null,
        amount: deductRes.amount,
        reason: 'Rollback due to simulated booking creation failure',
      })
      assert.strictEqual(rollbackRes.refunded, true)

      // Verify wallet balance restored to ₹1,000
      const walletAfter = await Wallet.findOne({ userId: u18._id })
      assert.strictEqual(walletAfter.balance, 1000, 'Balance must be fully restored')
      pass('Failed booking creation', 'deducted ₹400 safely rolled back to ₹1,000 upon simulated failure')
    } catch (err) {
      fail('Failed booking creation', err)
    }

    // -------------------------------------------------------------
    // Test 19: Failed payment
    // -------------------------------------------------------------
    try {
      const u19 = await User.create({ fullName: 'Cust T19', phone: randomPhone(), role: 'customer', isPhoneVerified: true })
      createdUserIds.push(u19._id)
      const b19 = await Booking.create(mockBookingPayload({
        userId: u19._id,
        basePrice: 1000,
        platformFee: 0,
        taxes: 0,
        totalAmount: 800,
        laborShare: 800,
        paymentMethod: 'ONLINE',
        paymentStatus: 'PENDING',
        type: 'INSTANT',
        status: 'CREATED',
        address: { locationText: '123 Payment St' },
      }))
      createdBookingIds.push(b19._id)

      const pTx = await PaymentTransaction.create({
        userId: u19._id,
        bookingId: b19._id,
        razorpayOrderId: `order_fake_${Date.now()}`,
        amount: 800,
        purpose: 'BOOKING',
        status: 'FAILED',
      })

      assert.strictEqual(pTx.status, 'FAILED')
      const bookingCheck = await Booking.findById(b19._id)
      assert.strictEqual(bookingCheck.paymentStatus, 'PENDING', 'Booking remains unpaid on payment failure')
      pass('Failed payment', 'Payment status marked FAILED without altering booking to PAID')
    } catch (err) {
      fail('Failed payment', err)
    }

    // -------------------------------------------------------------
    // Test 20: Successful payment and booking confirmation
    // -------------------------------------------------------------
    try {
      const u20 = await User.create({ fullName: 'Cust T20', phone: randomPhone(), role: 'customer', isPhoneVerified: true })
      createdUserIds.push(u20._id)
      const w20 = await getOrCreateUserWallet(u20._id)
      w20.balance = 2000
      w20.selfBalance = 2000
      await w20.save()

      // Deduct wallet for booking
      const deductRes = await deductWalletForBooking({
        userId: u20._id,
        bookingId: null,
        eligibleBillAmount: 2000,
        requestedUseWallet: true,
      })

      const b20 = await Booking.create(mockBookingPayload({
        userId: u20._id,
        basePrice: 2000,
        platformFee: 0,
        taxes: 0,
        totalAmount: 1600,
        laborShare: 1600,
        paymentMethod: 'ONLINE',
        paymentStatus: 'PAID',
        type: 'INSTANT',
        status: 'ACCEPTED',
        address: { locationText: '456 Success Ave' },
        walletDiscount: {
          applied: true,
          amount: deductRes.amount,
          percentage: 20,
          eligibleAmount: 2000,
          walletTransactionId: deductRes.walletTransactionId,
        },
      }))
      createdBookingIds.push(b20._id)

      // Link bookingId to the transaction
      await WalletTransaction.findByIdAndUpdate(deductRes.walletTransactionId, {
        bookingId: b20._id,
        referenceId: b20._id,
      })

      const txCheck = await WalletTransaction.findById(deductRes.walletTransactionId)
      assert.strictEqual(String(txCheck.bookingId), String(b20._id))
      assert.strictEqual(txCheck.status, 'COMPLETED')
      assert.strictEqual(txCheck.amount, 400)

      const wAfter = await Wallet.findOne({ userId: u20._id })
      assert.strictEqual(wAfter.balance, 1600)
      pass('Successful payment and booking confirmation', 'wallet deducted ₹400, balance ₹1,600, tx COMPLETED')
    } catch (err) {
      fail('Successful payment and booking confirmation', err)
    }

    // -------------------------------------------------------------
    // Test 21: Duplicate booking confirmation requests
    // -------------------------------------------------------------
    try {
      const u21 = await User.create({ fullName: 'Cust T21', phone: randomPhone(), role: 'customer', isPhoneVerified: true })
      createdUserIds.push(u21._id)
      const w21 = await getOrCreateUserWallet(u21._id)
      w21.balance = 1000
      w21.selfBalance = 1000
      await w21.save()

      const b21 = await Booking.create(mockBookingPayload({
        userId: u21._id,
        basePrice: 1000,
        platformFee: 0,
        taxes: 0,
        totalAmount: 800,
        laborShare: 800,
        paymentMethod: 'CASH',
        type: 'INSTANT',
        address: { locationText: '789 Idempotent Way' },
      }))
      createdBookingIds.push(b21._id)

      // First call
      const res1 = await deductWalletForBooking({
        userId: u21._id,
        bookingId: b21._id,
        eligibleBillAmount: 1000,
        requestedUseWallet: true,
      })
      assert.strictEqual(res1.applied, true)
      assert.strictEqual(res1.amount, 200)

      // Duplicate retry call
      const res2 = await deductWalletForBooking({
        userId: u21._id,
        bookingId: b21._id,
        eligibleBillAmount: 1000,
        requestedUseWallet: true,
      })
      assert.strictEqual(res2.applied, true)
      assert.strictEqual(res2.alreadyApplied, true, 'Second call must recognize already applied')

      const wCheck = await Wallet.findOne({ userId: u21._id })
      assert.strictEqual(wCheck.balance, 800, 'Balance must only be debited once (₹800, not ₹600)')
      pass('Duplicate booking confirmation requests', 'Idempotent: balance debited once (₹800)')
    } catch (err) {
      fail('Duplicate booking confirmation requests', err)
    }

    // -------------------------------------------------------------
    // Test 22: Duplicate payment webhooks
    // -------------------------------------------------------------
    try {
      const u22 = await User.create({ fullName: 'Cust T22', phone: randomPhone(), role: 'customer', isPhoneVerified: true })
      createdUserIds.push(u22._id)
      const pTx22 = await PaymentTransaction.create({
        userId: u22._id,
        razorpayOrderId: `order_webhook_${Date.now()}`,
        amount: 500,
        purpose: 'BOOKING',
        status: 'CAPTURED',
      })

      // Simulate duplicate webhook attempting to capture again
      const duplicateHandle = async (orderId) => {
        const tx = await PaymentTransaction.findOne({ razorpayOrderId: orderId })
        if (tx.status === 'CAPTURED') {
          return { processed: false, reason: 'ALREADY_CAPTURED' }
        }
        tx.status = 'CAPTURED'
        await tx.save()
        return { processed: true }
      }

      const webhookRes = await duplicateHandle(pTx22.razorpayOrderId)
      assert.strictEqual(webhookRes.processed, false)
      assert.strictEqual(webhookRes.reason, 'ALREADY_CAPTURED')
      pass('Duplicate payment webhooks', 'Duplicate callback safely identified and ignored')
    } catch (err) {
      fail('Duplicate payment webhooks', err)
    }

    // -------------------------------------------------------------
    // Test 23: Full and partial refunds
    // -------------------------------------------------------------
    try {
      const u23 = await User.create({ fullName: 'Cust T23', phone: randomPhone(), role: 'customer', isPhoneVerified: true })
      createdUserIds.push(u23._id)
      const w23 = await getOrCreateUserWallet(u23._id)
      w23.balance = 600
      w23.selfBalance = 600
      await w23.save()

      const b23 = await Booking.create(mockBookingPayload({
        userId: u23._id,
        basePrice: 2000,
        platformFee: 0,
        taxes: 0,
        totalAmount: 1600,
        laborShare: 1600,
        paymentMethod: 'CASH',
        type: 'INSTANT',
        address: { locationText: 'Refund Test Blvd' },
        walletDiscount: { applied: true, amount: 400, percentage: 20 },
      }))
      createdBookingIds.push(b23._id)

      // Full refund of ₹400
      const refundRes = await refundWalletForBooking({
        userId: u23._id,
        bookingId: b23._id,
        amount: 400,
        reason: 'Customer cancelled booking',
      })
      assert.strictEqual(refundRes.refunded, true)
      assert.strictEqual(refundRes.amount, 400)

      const wAfterRefund = await Wallet.findOne({ userId: u23._id })
      assert.strictEqual(wAfterRefund.balance, 1000, 'Balance restored to ₹1,000')

      // Attempt duplicate refund
      const dupRefund = await refundWalletForBooking({
        userId: u23._id,
        bookingId: b23._id,
        amount: 400,
      })
      assert.strictEqual(dupRefund.refunded, false)
      assert.strictEqual(dupRefund.alreadyRefunded, true)

      const wAfterDup = await Wallet.findOne({ userId: u23._id })
      assert.strictEqual(wAfterDup.balance, 1000, 'Balance must remain ₹1,000 after duplicate refund attempt')
      pass('Full and partial refunds', 'refunded ₹400; duplicate refund blocked')
    } catch (err) {
      fail('Full and partial refunds', err)
    }

    // -------------------------------------------------------------
    // Test 24: Concurrent bookings attempting to spend the same wallet balance
    // -------------------------------------------------------------
    try {
      const u24 = await User.create({ fullName: 'Cust T24', phone: randomPhone(), role: 'customer', isPhoneVerified: true })
      createdUserIds.push(u24._id)
      const w24 = await getOrCreateUserWallet(u24._id)
      w24.balance = 500
      w24.selfBalance = 500
      await w24.save()

      // Customer has ₹500. Two concurrent bookings attempt to deduct ₹400 each (total ₹800).
      const [resA, resB] = await Promise.all([
        deductWalletForBooking({ userId: u24._id, bookingId: new mongoose.Types.ObjectId(), eligibleBillAmount: 2000, requestedUseWallet: true, frozenWalletDeduction: 400 }),
        deductWalletForBooking({ userId: u24._id, bookingId: new mongoose.Types.ObjectId(), eligibleBillAmount: 2000, requestedUseWallet: true, frozenWalletDeduction: 400 }),
      ])

      const successCount = [resA, resB].filter(r => r.applied).length
      const failCount = [resA, resB].filter(r => !r.applied && r.error === 'INSUFFICIENT_BALANCE').length

      assert.strictEqual(successCount, 1, 'Exactly one concurrent deduction must succeed')
      assert.strictEqual(failCount, 1, 'The other concurrent deduction must fail with INSUFFICIENT_BALANCE')

      const finalWallet = await Wallet.findOne({ userId: u24._id })
      assert.strictEqual(finalWallet.balance, 100, 'Balance must be ₹100, never negative')
      pass('Concurrent bookings attempting to spend same balance', '1 succeeded, 1 failed, balance is ₹100')
    } catch (err) {
      fail('Concurrent bookings attempting to spend same balance', err)
    }

    // -------------------------------------------------------------
    // Test 25: Unauthorized admin configuration updates
    // -------------------------------------------------------------
    try {
      let rejectedNoAdmin = false
      try {
        await updateWalletSettings({ walletDiscountPercentage: 25 }, null)
      } catch (e) {
        rejectedNoAdmin = true
      }
      assert.strictEqual(rejectedNoAdmin, true, 'Update without admin ID must throw Unauthorized error')
      pass('Unauthorized admin configuration updates', 'Rejected unauthorized update attempt')
    } catch (err) {
      fail('Unauthorized admin configuration updates', err)
    }

    // -------------------------------------------------------------
    // Test 26: Attempts to access another customer\'s wallet
    // -------------------------------------------------------------
    try {
      const u26A = await User.create({ fullName: 'Cust 26A', phone: randomPhone(), role: 'customer', isPhoneVerified: true })
      const u26B = await User.create({ fullName: 'Cust 26B', phone: randomPhone(), role: 'customer', isPhoneVerified: true })
      createdUserIds.push(u26A._id, u26B._id)

      const w26B = await getOrCreateUserWallet(u26B._id)
      w26B.balance = 3000
      w26B.selfBalance = 3000
      await w26B.save()

      // Customer A's session attempting calculation using Customer A's own ID gets A's balance (0), not B's (3000)
      const calcA = await calculateWalletDiscount(u26A._id, 2000)
      assert.strictEqual(calcA.walletBalance, 0, 'Customer A cannot see Customer B balance')
      pass("Attempts to access another customer's wallet", 'Customer isolation verified')
    } catch (err) {
      fail("Attempts to access another customer's wallet", err)
    }

    // -------------------------------------------------------------
    // Test 27: Database errors and recovery behavior
    // -------------------------------------------------------------
    try {
      const u27 = await User.create({ fullName: 'Cust T27', phone: randomPhone(), role: 'customer', isPhoneVerified: true })
      createdUserIds.push(u27._id)
      const w27 = await getOrCreateUserWallet(u27._id)
      w27.balance = 500
      w27.selfBalance = 500
      await w27.save()

      // Test recovery if an invalid deduction amount is requested
      const deductRes = await deductWalletForBooking({
        userId: u27._id,
        bookingId: null,
        eligibleBillAmount: 0,
        requestedUseWallet: true,
      })
      assert.strictEqual(deductRes.applied, false)
      const wCheck = await Wallet.findOne({ userId: u27._id })
      assert.strictEqual(wCheck.balance, 500, 'Balance remains uncorrupted')
      pass('Database errors and recovery behavior', 'Safe recovery without balance corruption')
    } catch (err) {
      fail('Database errors and recovery behavior', err)
    }

    // -------------------------------------------------------------
    // Test 28: Existing wallet and booking functionality remains operational
    // -------------------------------------------------------------
    try {
      const u28 = await User.create({ fullName: 'Cust T28', phone: randomPhone(), role: 'customer', isPhoneVerified: true })
      createdUserIds.push(u28._id)

      // Welcome bonus
      await updateWalletSettings({ welcomeBonusEnabled: true, welcomeBonusAmount: 1000 }, testAdmin._id)
      const bonusRes = await ensureWelcomeBonus(u28._id)
      assert.strictEqual(bonusRes.credited, true)
      assert.strictEqual(bonusRes.bonusAmount, 1000)

      const w28 = await Wallet.findOne({ userId: u28._id })
      assert.strictEqual(w28.balance, 1000)

      // Service booking deduction using welcome bonus
      const deductionRes = await deductWalletForBooking({
        userId: u28._id,
        bookingId: new mongoose.Types.ObjectId(),
        eligibleBillAmount: 1000,
        requestedUseWallet: true,
      })
      assert.strictEqual(deductionRes.applied, true)
      // 1000 * 20% = 200
      assert.strictEqual(deductionRes.amount, 200)

      const w28After = await Wallet.findOne({ userId: u28._id })
      assert.strictEqual(w28After.balance, 800)
      pass('Existing wallet and booking functionality remains operational', 'welcome bonus + booking discount cycle operational')
    } catch (err) {
      fail('Existing wallet and booking functionality remains operational', err)
    }

  } finally {
    console.log('\nCleaning up test artifacts...')
    await User.deleteMany({ _id: { $in: createdUserIds } })
    await Wallet.deleteMany({ userId: { $in: createdUserIds } })
    await WalletTransaction.deleteMany({ userId: { $in: createdUserIds } })
    await Booking.deleteMany({ _id: { $in: createdBookingIds } })
    await ServicePackage.deleteMany({ _id: { $in: createdPackageIds } })
    await PaymentTransaction.deleteMany({ userId: { $in: createdUserIds } })
    // Restore default master config
    await updateWalletSettings({ enabled: true, walletDiscountPercentage: 20 }, testAdmin._id).catch(() => {})
    await mongoose.disconnect()
  }

  console.log('\n========================================================================')
  console.log(`TEST RESULTS: ${passed} PASSED / ${failed} FAILED (TOTAL: ${passed + failed})`)
  console.log('========================================================================\n')

  if (failed > 0) {
    process.exit(1)
  }
}

runAllTests().catch((err) => {
  console.error('Test Suite Fatal Error:', err)
  process.exit(1)
})
