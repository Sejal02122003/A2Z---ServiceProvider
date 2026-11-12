import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import assert from 'assert'
import crypto from 'crypto'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../../.env') })

function generateValidSignature(orderId, paymentId) {
  const secret = process.env.RAZORPAY_KEY_SECRET
  if (!secret) return 'mock_signature'
  const shasum = crypto.createHmac('sha256', secret)
  shasum.update(`${orderId}|${paymentId}`)
  return shasum.digest('hex')
}

import { Booking } from '../models/Booking.js'
import { User } from '../models/User.js'
import { BookingCancellationSetting } from '../models/BookingCancellationSetting.js'
import { BookingCancellationCycle, POLICY_CYCLE_STATUS } from '../models/BookingCancellationCycle.js'
import { BookingCancellationPenalty, PENALTY_PAYMENT_STATUS, PENALTY_STATUS } from '../models/BookingCancellationPenalty.js'
import { PaymentTransaction } from '../models/PaymentTransaction.js'
import {
  getCancellationSettings,
  calculatePenaltyAmount,
  getOrCreateCurrentPolicyCycle,
  prepareCancellationPenaltyRecord,
  initiateCancellationPenaltyPayment,
  verifyAndRestartCancellationPolicy,
  adminWaiveCancellationPenalty,
} from '../services/cancellationPenaltyService.js'
import {
  getCustomerCancellationEligibility,
  processCustomerCancellation,
  updateBookingCancellationSettings,
} from '../services/bookingCancellationService.js'

async function runTests() {
  console.log('====================================================================')
  console.log('STARTING: Comprehensive Cancellation Penalty & Policy Restart Tests')
  console.log('====================================================================\n')

  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://localhost:27017/a2z-services'
  await mongoose.connect(mongoUri)
  console.log('✓ Connected to MongoDB')

  // Setup test user
  let customer = await User.findOne({ phone: '9999999991' })
  if (!customer) {
    customer = await User.create({
      fullName: 'Test Penalty Customer',
      phone: '9999999991',
      role: 'customer',
    })
  }

  let vendor = await User.findOne({ phone: '9999999992' })
  if (!vendor) {
    vendor = await User.create({
      fullName: 'Test Assigned Vendor',
      phone: '9999999992',
      role: 'labour',
    })
  }

  console.log(`✓ Test Customer: ${customer._id}, Vendor: ${vendor._id}\n`)

  // Clean up any old test records for this customer
  await Booking.deleteMany({ userId: customer._id })
  await BookingCancellationCycle.deleteMany({ customerId: customer._id })
  await BookingCancellationPenalty.deleteMany({ customerId: customer._id })
  await PaymentTransaction.deleteMany({ userId: customer._id })

  let testsPassed = 0
  let totalTests = 0

  function pass(testName, details = '') {
    testsPassed++
    totalTests++
    console.log(`  ✓ TEST ${totalTests} PASSED: ${testName} ${details ? '(' + details + ')' : ''}`)
  }

  function fail(testName, err) {
    totalTests++
    console.error(`  ✗ TEST ${totalTests} FAILED: ${testName}`)
    console.error(err)
    process.exit(1)
  }

  const dummySubcatId = new mongoose.Types.ObjectId()
  const dummyServiceId = new mongoose.Types.ObjectId()

  try {
    // -------------------------------------------------------------
    // TEST 1: Admin Configuration Updates
    // -------------------------------------------------------------
    console.log('--- TEST GROUP 1: Admin Configuration Management ---')
    const updatedSettings = await updateBookingCancellationSettings(
      {
        customerCancellationEnabled: true,
        customerPenaltyEnabled: true,
        customerPenaltyType: 'PERCENTAGE',
        customerPenaltyValue: 25,
        customerCutoffMinutes: 60,
        customerMinPenaltyAmount: 50,
        customerMaxPenaltyAmount: 500,
        customerPenaltyCondition: 'WITHIN_CUTOFF',
        customerAutoRestartEnabled: true,
        customerRestartTimerMinutes: 60,
      },
      customer
    )

    assert.strictEqual(updatedSettings.customerPenaltyEnabled, true)
    assert.strictEqual(updatedSettings.customerPenaltyType, 'PERCENTAGE')
    assert.strictEqual(updatedSettings.customerPenaltyValue, 25)
    assert.strictEqual(updatedSettings.customerMinPenaltyAmount, 50)
    assert.strictEqual(updatedSettings.customerMaxPenaltyAmount, 500)
    pass('Admin settings dynamic configuration updated', 'Percentage: 25%, Min: ₹50, Max: ₹500')

    // -------------------------------------------------------------
    // TEST 2: Percentage-Based Penalty Calculation
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 2: Penalty Calculation Engine ---')
    const testBooking1 = await Booking.create({
      userId: customer._id,
      laborId: vendor._id,
      subcategoryId: dummySubcatId,
      serviceId: dummyServiceId,
      type: 'SCHEDULED',
      scheduledAt: new Date(Date.now() + 30 * 60 * 1000), // 30 mins away (within 60m cutoff)
      basePrice: 1000,
      platformFee: 0,
      totalAmount: 1000,
      paymentMethod: 'ONLINE',
      paymentStatus: 'PAID',
      status: 'ACCEPTED',
      laborShare: 800,
      address: { locationText: 'Test Location 1' },
    })

    const calc1 = calculatePenaltyAmount({ booking: testBooking1, settings: updatedSettings })
    assert.strictEqual(calc1.penaltyApplicable, true)
    assert.strictEqual(calc1.calculatedPenaltyAmount, 250) // 25% of 1000 = 250
    assert.strictEqual(calc1.billingSummary.originalBookingAmount, 1000)
    assert.strictEqual(calc1.billingSummary.previouslyPaidAmount, 1000)
    assert.strictEqual(calc1.billingSummary.cancellationPenalty, 250)
    assert.strictEqual(calc1.billingSummary.additionalAmountPayable, 250)
    pass('Percentage-based penalty calculation', '25% of ₹1000 = ₹250')

    // -------------------------------------------------------------
    // TEST 3: Minimum Limit Enforcement
    // -------------------------------------------------------------
    const testBookingLow = await Booking.create({
      userId: customer._id,
      subcategoryId: dummySubcatId,
      serviceId: dummyServiceId,
      type: 'SCHEDULED',
      scheduledAt: new Date(Date.now() + 20 * 60 * 1000),
      basePrice: 100,
      totalAmount: 100,
      paymentMethod: 'CASH',
      status: 'ACCEPTED',
      laborShare: 80,
      address: { locationText: 'Test Location 2' },
    })

    const calcLow = calculatePenaltyAmount({ booking: testBookingLow, settings: updatedSettings })
    assert.strictEqual(calcLow.penaltyApplicable, true)
    assert.strictEqual(calcLow.calculatedPenaltyAmount, 50) // 25% of 100 = 25, but min is 50
    assert.strictEqual(calcLow.minLimitApplied, true)
    pass('Minimum penalty limit enforcement', '25% of ₹100 was ₹25, capped at min ₹50')

    // -------------------------------------------------------------
    // TEST 4: Maximum Limit Enforcement
    // -------------------------------------------------------------
    const testBookingHigh = await Booking.create({
      userId: customer._id,
      subcategoryId: dummySubcatId,
      serviceId: dummyServiceId,
      type: 'SCHEDULED',
      scheduledAt: new Date(Date.now() + 20 * 60 * 1000),
      basePrice: 4000,
      totalAmount: 4000,
      paymentMethod: 'ONLINE',
      status: 'ACCEPTED',
      laborShare: 3200,
      address: { locationText: 'Test Location 3' },
    })

    const calcHigh = calculatePenaltyAmount({ booking: testBookingHigh, settings: updatedSettings })
    assert.strictEqual(calcHigh.penaltyApplicable, true)
    assert.strictEqual(calcHigh.calculatedPenaltyAmount, 500) // 25% of 4000 = 1000, but max is 500
    assert.strictEqual(calcHigh.maxLimitApplied, true)
    pass('Maximum penalty limit enforcement', '25% of ₹4000 was ₹1000, capped at max ₹500')

    // -------------------------------------------------------------
    // TEST 5: Fixed Penalty Calculation
    // -------------------------------------------------------------
    const fixedSettings = {
      ...updatedSettings.toObject(),
      customerPenaltyType: 'FIXED',
      customerPenaltyValue: 150,
      customerMinPenaltyAmount: 0,
      customerMaxPenaltyAmount: 0,
    }
    const calcFixed = calculatePenaltyAmount({ booking: testBooking1, settings: fixedSettings })
    assert.strictEqual(calcFixed.penaltyApplicable, true)
    assert.strictEqual(calcFixed.calculatedPenaltyAmount, 150)
    pass('Fixed-amount penalty calculation', 'Configured fixed ₹150')

    // -------------------------------------------------------------
    // TEST 6: Free Cancellation Outside Cutoff
    // -------------------------------------------------------------
    const farFutureBooking = await Booking.create({
      userId: customer._id,
      subcategoryId: dummySubcatId,
      serviceId: dummyServiceId,
      type: 'SCHEDULED',
      scheduledAt: new Date(Date.now() + 5 * 3600 * 1000), // 5 hours away (> 60m cutoff)
      basePrice: 1000,
      totalAmount: 1000,
      paymentMethod: 'ONLINE',
      status: 'ACCEPTED',
      laborShare: 800,
      address: { locationText: 'Far Future Location' },
    })
    const calcFar = calculatePenaltyAmount({ booking: farFutureBooking, settings: updatedSettings })
    assert.strictEqual(calcFar.penaltyApplicable, false)
    pass('Free cancellation outside cutoff window', '5h before scheduled time incurs ₹0 penalty')

    // -------------------------------------------------------------
    // TEST 7: Customer Cancellation Eligibility Endpoint
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 3: Eligibility & Attempt Workflow ---')
    const eligibilityRes = await getCustomerCancellationEligibility(testBooking1._id, customer._id)
    assert.strictEqual(eligibilityRes.isEligible, true)
    assert.strictEqual(eligibilityRes.penaltyApplicable, true)
    assert.strictEqual(eligibilityRes.penaltyDetails.calculatedPenaltyAmount, 250)
    assert.strictEqual(eligibilityRes.cycle.cycleNumber, 1)
    pass('Customer eligibility endpoint returns penalty & cycle details', 'Cycle #1, Penalty: ₹250')

    // -------------------------------------------------------------
    // TEST 8: Customer Submits Cancellation when Penalty Applies
    //         CRITICAL REQUIREMENT: Booking MUST NOT be cancelled!
    // -------------------------------------------------------------
    const processRes = await processCustomerCancellation({
      bookingId: testBooking1._id,
      customerId: customer._id,
      reason: 'Booked by mistake',
    })

    assert.strictEqual(processRes.success, true)
    assert.strictEqual(processRes.penaltyRequired, true)
    assert.strictEqual(processRes.status, 'PENALTY_PENDING')
    assert.strictEqual(processRes.penalty.calculatedPenaltyAmount, 250)

    // Verify booking in database remains ACCEPTED and NOT cancelled!
    const dbBookingAfterAttempt = await Booking.findById(testBooking1._id)
    assert.strictEqual(dbBookingAfterAttempt.status, 'ACCEPTED')
    assert.notStrictEqual(dbBookingAfterAttempt.status, 'CANCELLED')
    assert.strictEqual(dbBookingAfterAttempt.cancellationBilling.additionalAmountPayable, 250)
    assert.strictEqual(dbBookingAfterAttempt.cancellationBilling.penaltyLineItems.length, 1)
    assert.strictEqual(dbBookingAfterAttempt.cancellationBilling.penaltyLineItems[0].amount, 250)
    pass('Attempt requires penalty payment; Booking remains ACTIVE in DB', 'Status: ACCEPTED (not cancelled)')

    // -------------------------------------------------------------
    // TEST 9: Penalty Payment Initiation (Gateway Order Creation)
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 4: Gateway Payment & Policy Restart ---')
    const initPayRes = await initiateCancellationPenaltyPayment({
      bookingId: testBooking1._id,
      customerId: customer._id,
    })

    assert.ok(initPayRes.order)
    assert.ok(initPayRes.order.id)
    assert.strictEqual(initPayRes.order.amount, 25000) // 250 * 100 paise = 25000
    assert.strictEqual(initPayRes.penalty.amount, 250)

    const pTx = await PaymentTransaction.findById(initPayRes.paymentTransactionId)
    assert.strictEqual(pTx.purpose, 'CANCELLATION_PENALTY')
    assert.strictEqual(pTx.amount, 250)
    assert.strictEqual(pTx.status, 'CREATED')
    pass('Gateway payment initiated; Order & PaymentTransaction created', `Order: ${initPayRes.order.id}`)

    // -------------------------------------------------------------
    // TEST 10: Backend Signature Verification & Policy Restart
    // -------------------------------------------------------------
    const paymentId1 = `pay_test_${Date.now()}`
    const validSig1 = generateValidSignature(initPayRes.order.id, paymentId1)

    const restartRes = await verifyAndRestartCancellationPolicy({
      razorpayOrderId: initPayRes.order.id,
      razorpayPaymentId: paymentId1,
      razorpaySignature: validSig1,
      userId: customer._id,
    })

    assert.strictEqual(restartRes.success, true)
    assert.strictEqual(restartRes.policyRestarted, true)
    assert.strictEqual(restartRes.newCycle.cycleNumber, 2)
    assert.strictEqual(restartRes.newCycle.previousCycleId, restartRes.penalty.policyCycleId)

    // Verify booking in database:
    // 1. Status MUST remain active!
    // 2. CancellationBilling marked paid!
    // 3. CurrentCycleNumber incremented to 2!
    const refreshedBooking = await Booking.findById(testBooking1._id)
    assert.strictEqual(refreshedBooking.status, 'ACCEPTED')
    assert.strictEqual(refreshedBooking.cancellationBilling.totalPenaltyPaid, 250)
    assert.strictEqual(refreshedBooking.cancellationBilling.additionalAmountPayable, 0)
    assert.strictEqual(refreshedBooking.cancellationBilling.penaltyLineItems[0].paymentStatus, 'PAID')
    assert.strictEqual(refreshedBooking.cancellationPolicyCycle.currentCycleNumber, 2)
    assert.strictEqual(refreshedBooking.cancellationPolicyCycle.cycleStatus, 'RESTARTED')

    // Verify Cycle 1 closed
    const cycle1 = await BookingCancellationCycle.findOne({ bookingId: testBooking1._id, cycleNumber: 1 })
    assert.strictEqual(cycle1.cycleStatus, POLICY_CYCLE_STATUS.COMPLETED)
    assert.ok(cycle1.cycleEndTimestamp)

    pass('Payment verified; Cycle 1 closed; Policy restarted into Cycle 2; Booking remains ACTIVE')

    // -------------------------------------------------------------
    // TEST 11: Idempotency & Webhook Deduplication
    // -------------------------------------------------------------
    const duplicateVerifyRes = await verifyAndRestartCancellationPolicy({
      razorpayOrderId: initPayRes.order.id,
      razorpayPaymentId: paymentId1,
      razorpaySignature: validSig1,
      userId: customer._id,
    })
    assert.strictEqual(duplicateVerifyRes.alreadyProcessed, true)
    pass('Duplicate payment verification idempotency confirmed', 'Replay safe; duplicate ignored')

    // -------------------------------------------------------------
    // TEST 12: Customer Receives Fresh Cancellation Opportunity Under Cycle 2
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 5: Multi-Cycle Cancellation Sequence ---')
    const cycle2Eligibility = await getCustomerCancellationEligibility(testBooking1._id, customer._id)
    assert.strictEqual(cycle2Eligibility.isEligible, true)
    assert.strictEqual(cycle2Eligibility.cycle.cycleNumber, 2)
    assert.strictEqual(cycle2Eligibility.penaltyApplicable, true)
    pass('Customer receives fresh cancellation opportunity under Cycle #2')

    // -------------------------------------------------------------
    // TEST 13: Customer Cancels Again Under Cycle 2 -> Second Penalty Generated
    // -------------------------------------------------------------
    const attempt2Res = await processCustomerCancellation({
      bookingId: testBooking1._id,
      customerId: customer._id,
      reason: 'Wrong date or time',
    })
    assert.strictEqual(attempt2Res.penaltyRequired, true)
    assert.strictEqual(attempt2Res.cycle.cycleNumber, 2)
    assert.strictEqual(attempt2Res.penalty.policyCycleNumber, 2)
    pass('Second cancellation attempt generates penalty for Cycle #2')

    // -------------------------------------------------------------
    // TEST 14: Customer Pays Second Penalty -> Restarts Into Cycle 3
    // -------------------------------------------------------------
    const initPay2 = await initiateCancellationPenaltyPayment({
      bookingId: testBooking1._id,
      customerId: customer._id,
    })
    const paymentId2 = `pay_cycle2_${Date.now()}`
    const validSig2 = generateValidSignature(initPay2.order.id, paymentId2)

    const restart2 = await verifyAndRestartCancellationPolicy({
      razorpayOrderId: initPay2.order.id,
      razorpayPaymentId: paymentId2,
      razorpaySignature: validSig2,
      userId: customer._id,
    })
    assert.strictEqual(restart2.newCycle.cycleNumber, 3)

    const finalBooking = await Booking.findById(testBooking1._id)
    assert.strictEqual(finalBooking.status, 'ACCEPTED') // Still active!
    assert.strictEqual(finalBooking.cancellationPolicyCycle.currentCycleNumber, 3)
    assert.strictEqual(finalBooking.cancellationBilling.totalPenaltyPaid, 500) // 250 + 250
    assert.strictEqual(finalBooking.cancellationBilling.penaltyLineItems.length, 2)
    pass('Second penalty paid; Successfully restarted into Cycle #3; Total paid: ₹500')

    // -------------------------------------------------------------
    // TEST 15: Multi-Service Booking Compatibility (Individual Item Cancellation)
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 6: Multi-Service Booking Compatibility ---')
    const item1Id = new mongoose.Types.ObjectId()
    const item2Id = new mongoose.Types.ObjectId()

    const multiBooking = await Booking.create({
      userId: customer._id,
      type: 'SCHEDULED',
      scheduledAt: new Date(Date.now() + 25 * 60 * 1000), // Within cutoff
      basePrice: 1500,
      totalAmount: 1500,
      paymentMethod: 'ONLINE',
      paymentStatus: 'PAID',
      status: 'ACCEPTED',
      laborShare: 1200,
      address: { locationText: 'Multi-service address' },
      multiServiceBooking: {
        isMultiService: true,
        items: [
          {
            _id: item1Id,
            serviceId: new mongoose.Types.ObjectId(),
            serviceName: 'Hair Styling',
            unitPrice: 500,
            itemTotal: 500,
            status: 'ACCEPTED',
          },
          {
            _id: item2Id,
            serviceId: new mongoose.Types.ObjectId(),
            serviceName: 'Full Spa',
            unitPrice: 1000,
            itemTotal: 1000,
            status: 'ACCEPTED',
          },
        ],
      },
    })

    const itemCalc = calculatePenaltyAmount({
      booking: multiBooking,
      settings: updatedSettings,
      itemId: item1Id,
    })

    assert.strictEqual(itemCalc.penaltyApplicable, true)
    assert.strictEqual(itemCalc.applicableAmount, 500) // itemTotal is 500
    assert.strictEqual(itemCalc.calculatedPenaltyAmount, 125) // 25% of 500 = 125
    pass('Multi-service individual item penalty calculated accurately', '25% of ₹500 item = ₹125')

    // -------------------------------------------------------------
    // TEST 16: Admin Penalty Waiver with Audit Log
    // -------------------------------------------------------------
    console.log('\n--- TEST GROUP 7: Admin Penalty Waiver & Audit Trail ---')
    const penaltyToWaive = await BookingCancellationPenalty.findOne({
      bookingId: testBooking1._id,
      policyCycleNumber: 1,
    })
    assert.ok(penaltyToWaive)

    const waiveRes = await adminWaiveCancellationPenalty({
      penaltyId: penaltyToWaive.penaltyId,
      adminUser: { _id: new mongoose.Types.ObjectId(), fullName: 'Admin Auditor' },
      reason: 'Customer experienced verified medical emergency.',
    })

    assert.strictEqual(waiveRes.success, true)
    assert.strictEqual(waiveRes.penalty.penaltyStatus, PENALTY_STATUS.WAIVED)
    assert.strictEqual(waiveRes.penalty.waiverReason, 'Customer experienced verified medical emergency.')
    pass('Admin penalty waiver executed with audit reason saved', 'Status: WAIVED')

    // Clean up test data
    await Booking.deleteMany({ userId: customer._id })
    await BookingCancellationCycle.deleteMany({ customerId: customer._id })
    await BookingCancellationPenalty.deleteMany({ customerId: customer._id })
    await PaymentTransaction.deleteMany({ userId: customer._id })

    console.log('\n====================================================================')
    console.log(`ALL TESTS PASSED! (${testsPassed}/${totalTests} Passed successfully)`)
    console.log('====================================================================\n')
    process.exit(0)
  } catch (err) {
    fail('Unexpected exception during test execution', err)
  }
}

runTests().catch((err) => {
  console.error('Fatal test runner error:', err)
  process.exit(1)
})
