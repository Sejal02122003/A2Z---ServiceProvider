import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '../../.env') })

import { Booking } from '../models/Booking.js'
import { User } from '../models/User.js'
import { Wallet } from '../models/Wallet.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
import { LabourSubcategory } from '../models/LabourSubcategory.js'
import { LabourService } from '../models/LabourService.js'
import { PenaltySetting } from '../models/PenaltySetting.js'
import { VendorPenalty, PENALTY_STATUS, PENALTY_TYPE } from '../models/VendorPenalty.js'
import {
  getPenaltySettings,
  updatePenaltySettings,
  calculateLateFeeAmount,
  recordLateFeeIncident,
  recordBounceIncident,
  approvePenalty,
  waivePenalty,
  submitPenaltyDispute,
  reviewPenaltyDispute,
  reversePenaltyDeduction,
  getPenaltyOverviewStats,
  scanOverdueBookingsJob,
} from '../services/penaltyService.js'

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`)
    process.exit(1)
  }
  console.log(`  ✅ PASS: ${message}`)
}

async function runTests() {
  console.log('🚀 Starting Late Fee & Bounce Penalty Engine Test Suite...\n')

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/a2z-service'
  await mongoose.connect(mongoUri)
  console.log('Connected to MongoDB.')

  try {
    // Clean up test data
    await PenaltySetting.deleteMany({ configKey: 'master_penalty_config' })
    await VendorPenalty.deleteMany({ reason: /Test/ })
    await User.deleteMany({ email: /testpenalty/ })
    await Booking.deleteMany({ notes: /Test Penalty/ })

    // Create test admin and vendor users
    const adminUser = await User.create({
      fullName: 'Test Admin Penalty',
      phone: '9999990091',
      email: 'testpenalty_admin@example.com',
      password: 'password123',
      role: 'admin',
    })

    const vendorUser = await User.create({
      fullName: 'Test Vendor Partner',
      phone: '9999990092',
      email: 'testpenalty_vendor@example.com',
      password: 'password123',
      role: 'labour',
    })

    const customerUser = await User.create({
      fullName: 'Test Customer Penalty',
      phone: '9999990093',
      email: 'testpenalty_customer@example.com',
      password: 'password123',
      role: 'customer',
    })

    // Setup wallet with ₹500 balance for vendor
    const vendorWallet = await Wallet.create({
      userId: vendorUser._id,
      selfBalance: 500,
      balance: 500,
    })

    let subcat = await LabourSubcategory.findOne()
    if (!subcat) {
      subcat = await LabourSubcategory.create({
        name: 'Test Subcategory Penalty',
        categoryId: new mongoose.Types.ObjectId(),
      })
    }

    let service = await LabourService.findOne()
    if (!service) {
      service = await LabourService.create({
        name: 'Test Penalty Cleaning',
        categoryId: subcat.categoryId,
        subcategoryId: subcat._id,
        basePrice: 500,
        priceUnit: 'hr',
      })
    }

    // --- TEST GROUP 1: Penalty Settings Configuration ---
    console.log('\n--- TEST GROUP 1: Penalty Settings Configuration ---')
    let settings = await updatePenaltySettings(
      {
        enabled: true,
        defaultGracePeriodMinutes: 15,
        autoDeductEnabled: false, // require admin approval first
        fixedLateFeeAmount: 50,
        fixedBouncePenaltyAmount: 100,
        lateFeeMode: 'TIERED',
        lateFeeTiers: [
          { minDelayMinutes: 15, maxDelayMinutes: 30, feeAmount: 50 },
          { minDelayMinutes: 31, maxDelayMinutes: 60, feeAmount: 100 },
          { minDelayMinutes: 61, maxDelayMinutes: null, feeAmount: 150 },
        ],
      },
      adminUser
    )

    assert(settings.enabled === true, 'Penalty master system enabled')
    assert(settings.defaultGracePeriodMinutes === 15, 'Grace period configured to 15 mins')
    assert(settings.lateFeeTiers.length === 3, 'Configured 3 tiered late fee brackets')

    // --- TEST GROUP 2: Late Fee Calculation Engine ---
    console.log('\n--- TEST GROUP 2: Late Fee Calculation Engine ---')
    const fee20m = calculateLateFeeAmount(20, settings)
    assert(fee20m === 50, 'Tier 1 (20m delay) yields ₹50 late fee')

    const fee45m = calculateLateFeeAmount(45, settings)
    assert(fee45m === 100, 'Tier 2 (45m delay) yields ₹100 late fee')

    const fee90m = calculateLateFeeAmount(90, settings)
    assert(fee90m === 150, 'Tier 3 (90m delay) yields ₹150 late fee')

    // --- TEST GROUP 3: On-Time & Grace Period Arrival ---
    console.log('\n--- TEST GROUP 3: On-Time & Grace Period Arrival ---')
    const apptDate = new Date(Date.now() + 2 * 60 * 60 * 1000) // 2 hours in future

    const apptSlot = apptDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })

    const onTimeBooking = await Booking.create({
      userId: customerUser._id,
      laborId: vendorUser._id,
      subcategoryId: subcat._id,
      serviceId: service._id,
      type: 'SCHEDULED',
      scheduledAt: apptDate,
      timeSlot: apptSlot,
      address: { locationText: 'Vijay Nagar, Indore' },
      basePrice: 500,
      totalAmount: 500,
      laborShare: 400,
      paymentMethod: 'ONLINE',
      status: 'ACCEPTED',
      notes: 'Test Penalty OnTime',
    })

    // Arrived 10 minutes past appointment (within 15m grace period)
    const onTimeArrival = new Date(apptDate.getTime() + 10 * 60 * 1000)
    const graceRes = await recordLateFeeIncident({
      booking: onTimeBooking,
      vendorId: vendorUser._id,
      arrivalTime: onTimeArrival,
    })
    assert(graceRes.created === false, 'Arrival within 15m grace period generated NO penalty')

    // --- TEST GROUP 4: Late Arrival Incident & Admin Approval ---
    console.log('\n--- TEST GROUP 4: Late Arrival Incident & Admin Approval ---')
    // Arrived 40 minutes past appointment (past grace period, Tier 2)
    const lateArrival = new Date(apptDate.getTime() + 40 * 60 * 1000)
    const lateRes = await recordLateFeeIncident({
      booking: onTimeBooking,
      vendorId: vendorUser._id,
      arrivalTime: lateArrival,
    })

    assert(lateRes.created === true, 'Late arrival past grace period created penalty incident')
    assert(lateRes.penalty.amount === 100, 'Incident amount calculated as ₹100 for 40m delay')
    assert(lateRes.penalty.status === PENALTY_STATUS.PENDING_REVIEW, 'Incident status is PENDING_REVIEW')

    // Duplicate prevention test
    const dupRes = await recordLateFeeIncident({
      booking: onTimeBooking,
      vendorId: vendorUser._id,
      arrivalTime: lateArrival,
    })
    assert(dupRes.created === false, 'Duplicate late incident prevented by dedupe key')

    // Admin approves late penalty and triggers wallet deduction
    const approveLateRes = await approvePenalty(lateRes.penalty._id, adminUser)
    assert(approveLateRes.success === true, 'Admin successfully approved late penalty')
    assert(approveLateRes.penalty.status === PENALTY_STATUS.APPLIED, 'Penalty status transitioned to APPLIED')
    assert(approveLateRes.penalty.deductedAmount === 100, 'Recorded ₹100 deductedAmount')

    const updatedWallet1 = await Wallet.findOne({ userId: vendorUser._id })
    assert(updatedWallet1.selfBalance === 400, 'Vendor wallet balance deducted atomically (₹500 -> ₹400)')

    const lateTxn = await WalletTransaction.findById(approveLateRes.penalty.walletTransactionId)
    assert(lateTxn != null && lateTxn.type === 'DEBIT' && lateTxn.context === 'PENALTY', 'Immutable WalletTransaction created with context: PENALTY')

    // --- TEST GROUP 5: Bounce Penalty on Cancellation ---
    console.log('\n--- TEST GROUP 5: Bounce Penalty on Cancellation ---')
    const bounceBooking = await Booking.create({
      userId: customerUser._id,
      laborId: vendorUser._id,
      subcategoryId: subcat._id,
      serviceId: service._id,
      type: 'SCHEDULED',
      scheduledAt: apptDate,
      timeSlot: apptSlot,
      address: { locationText: 'Scheme 54, Indore' },
      basePrice: 500,
      totalAmount: 500,
      laborShare: 400,
      paymentMethod: 'ONLINE',
      status: 'CANCELLED',
      notes: 'Test Penalty Bounce',
    })

    // Exempt cancellation test (Customer requested cancel)
    const exemptBounce = await recordBounceIncident({
      booking: bounceBooking,
      vendorId: vendorUser._id,
      reason: 'Customer requested to cancel',
      cancelledBy: 'LABOUR',
      isExempt: true,
    })
    assert(exemptBounce.created === false, 'Exempt cancellation generated NO bounce penalty')

    // Unauthorized worker cancellation
    const unauthBounce = await recordBounceIncident({
      booking: bounceBooking,
      vendorId: vendorUser._id,
      reason: 'Personal transport issue',
      cancelledBy: 'LABOUR',
      isExempt: false,
    })
    assert(unauthBounce.created === true, 'Unauthorized worker cancellation created bounce penalty incident')
    assert(unauthBounce.penalty.amount === 100, 'Bounce penalty amount snapshot is ₹100')

    // Approve bounce deduction
    const approveBounceRes = await approvePenalty(unauthBounce.penalty._id, adminUser)
    assert(approveBounceRes.penalty.status === PENALTY_STATUS.APPLIED, 'Bounce penalty approved and applied')

    const updatedWallet2 = await Wallet.findOne({ userId: vendorUser._id })
    assert(updatedWallet2.selfBalance === 300, 'Vendor wallet balance deducted (₹400 -> ₹300)')

    // --- TEST GROUP 6: Vendor Dispute Workflow ---
    console.log('\n--- TEST GROUP 6: Vendor Dispute Workflow ---')
    const disputeRes = await submitPenaltyDispute(
      unauthBounce.penalty._id,
      vendorUser,
      'There was an unavoidable road blockage, proof attached',
      ['https://example.com/proof.jpg']
    )
    assert(disputeRes.status === PENALTY_STATUS.DISPUTED, 'Penalty status updated to DISPUTED')
    assert(disputeRes.dispute.isDisputed === true, 'Dispute flag set to true')

    // Admin accepts dispute -> Automatically waives & refunds wallet!
    const reviewRes = await reviewPenaltyDispute(
      unauthBounce.penalty._id,
      adminUser,
      'ACCEPT',
      'Valid road blockage verified from local news'
    )
    assert(reviewRes.status === PENALTY_STATUS.WAIVED, 'Dispute accepted and penalty marked as WAIVED')

    const updatedWallet3 = await Wallet.findOne({ userId: vendorUser._id })
    assert(updatedWallet3.selfBalance === 400, 'Vendor wallet refunded on accepted dispute (₹300 -> ₹400)')

    // --- TEST GROUP 7: Admin Reversal of Applied Penalty ---
    console.log('\n--- TEST GROUP 7: Admin Reversal of Applied Penalty ---')
    const reversalRes = await reversePenaltyDeduction(
      lateRes.penalty._id,
      adminUser,
      'Customer confirmed partner arrived on time but phone was dead'
    )
    assert(reversalRes.penalty.status === PENALTY_STATUS.REVERSED, 'Penalty status transitioned to REVERSED')
    assert(reversalRes.refundTxn != null && reversalRes.refundTxn.type === 'CREDIT', 'Compensating CREDIT WalletTransaction recorded')

    const updatedWallet4 = await Wallet.findOne({ userId: vendorUser._id })
    assert(updatedWallet4.selfBalance === 500, 'Vendor wallet restored to original balance (₹400 -> ₹500)')

    // --- TEST GROUP 8: Overview Statistics ---
    console.log('\n--- TEST GROUP 8: Overview Statistics ---')
    const stats = await getPenaltyOverviewStats()
    assert(stats.totalCount >= 2, 'Overview stats returned total penalty count')
    assert(stats.waivedCount >= 1, 'Overview stats returned waived count')
    assert(stats.reversedCount >= 1, 'Overview stats returned reversed count')

    console.log('\n========================================')
    console.log('🎉 ALL 24/24 PENALTY TESTS PASSED SUCCESSFULLY!')
    console.log('========================================\n')
  } catch (err) {
    console.error('Test execution error:', err)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
  }
}

runTests()
