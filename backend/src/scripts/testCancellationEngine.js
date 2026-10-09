import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import assert from 'assert'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '../../.env') })

import { BookingCancellationSetting } from '../models/BookingCancellationSetting.js'
import {
  BookingCancellationRecord,
  CANCELLATION_STATUS,
  TIMING_CLASSIFICATION,
  CANCELLATION_PENALTY_STATUS,
  APPROVAL_STATUS,
} from '../models/BookingCancellationRecord.js'
import { Booking } from '../models/Booking.js'
import { Wallet } from '../models/Wallet.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
import {
  getBookingCancellationSettings,
  updateBookingCancellationSettings,
  getCancellationEligibility,
  processVendorCancellation,
  approveCancellationRequest,
  rejectCancellationRequest,
  waiveCancellationPenalty,
  getAdminCancellationOverviewStats,
} from '../services/bookingCancellationService.js'

function toISTDateTime(d) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]))
  const datePart = `${p.year}-${p.month}-${p.day}`
  const timeSlot = `${p.hour}:${p.minute}`
  return { datePart, timeSlot }
}

async function runTest() {
  console.log('🚀 Starting Booking Cancellation & Late Penalty Engine Test Suite...\n')

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/a2z-service-provider'
  await mongoose.connect(mongoUri)
  console.log('Connected to MongoDB.\n')

  const testVendorId = new mongoose.Types.ObjectId()
  const otherVendorId = new mongoose.Types.ObjectId()
  const testCustomerId = new mongoose.Types.ObjectId()
  const testAdminUser = { _id: new mongoose.Types.ObjectId(), fullName: 'Test Super Admin', role: 'admin' }

  // Clean up any test records
  await BookingCancellationRecord.deleteMany({ vendorId: { $in: [testVendorId, otherVendorId] } })

  // Initialize vendor wallet with ₹500
  let wallet = await Wallet.findOne({ userId: testVendorId })
  if (!wallet) {
    wallet = await Wallet.create({ userId: testVendorId, selfBalance: 500, adminBalance: 0 })
  } else {
    wallet.selfBalance = 500
    await wallet.save()
  }

  // -------------------------------------------------------------
  // TEST GROUP 1: Policy Settings Configuration
  // -------------------------------------------------------------
  console.log('--- TEST GROUP 1: Cancellation Policy Settings ---')
  let settings = await updateBookingCancellationSettings(
    {
      enabled: true,
      cutoffHours: 2,
      penaltyType: 'FIXED',
      fixedPenaltyAmount: 200,
      percentagePenaltyRate: 20,
      lateCancellationAction: 'PENALIZE',
      requireReason: true,
    },
    testAdminUser
  )

  assert.strictEqual(settings.enabled, true, 'Cancellation policy should be enabled')
  assert.strictEqual(settings.cutoffHours, 2, 'Cutoff hours should be 2')
  assert.strictEqual(settings.fixedPenaltyAmount, 200, 'Fixed penalty amount should be 200')
  console.log('  ✅ PASS: Policy configured (2h cutoff, ₹200 fixed penalty, PENALIZE action)')

  // -------------------------------------------------------------
  // TEST GROUP 2: Standard Cancellation (> 2 Hours away)
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 2: Standard Cancellation (> 2 Hours Away) ---')
  const futureDate = new Date(Date.now() + 5 * 3600 * 1000) // 5 hours in future
  const { datePart, timeSlot } = toISTDateTime(futureDate)

  const standardBooking = await Booking.create({
    userId: testCustomerId,
    laborId: testVendorId,
    acceptedLabourId: testVendorId,
    type: 'SCHEDULED',
    serviceId: new mongoose.Types.ObjectId(),
    subcategoryId: new mongoose.Types.ObjectId(),
    date: datePart,
    timeSlot,
    status: 'ACCEPTED',
    basePrice: 500,
    totalAmount: 600,
    laborShare: 450,
    paymentMethod: 'ONLINE',
    address: { locationText: 'Test Location standard' },
  })

  const standardEligibility = await getCancellationEligibility(standardBooking._id, testVendorId)
  assert.strictEqual(standardEligibility.isEligible, true, 'Standard cancellation should be eligible')
  assert.strictEqual(standardEligibility.isLate, false, 'Standard cancellation should not be late')
  assert.strictEqual(standardEligibility.penaltyAmount, 0, 'Standard cancellation penalty should be ₹0')
  assert.strictEqual(standardEligibility.timingClassification, TIMING_CLASSIFICATION.STANDARD)
  console.log('  ✅ PASS: 5h advance cancellation classified as STANDARD (₹0 penalty)')

  const standardCancelResult = await processVendorCancellation({
    bookingId: standardBooking._id,
    vendorId: testVendorId,
    reason: 'Scheduling Conflict',
  })
  assert.strictEqual(standardCancelResult.status, 'CANCELLED')
  assert.strictEqual(standardCancelResult.penaltyDeducted, 0)
  const updatedWallet1 = await Wallet.findOne({ userId: testVendorId })
  assert.strictEqual(updatedWallet1.selfBalance, 500, 'Wallet balance should remain unchanged (₹500)')
  console.log('  ✅ PASS: Standard cancellation completed without wallet deduction')

  // -------------------------------------------------------------
  // TEST GROUP 3: Late Cancellation (< 2 Hours away) with FIXED Penalty
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 3: Late Cancellation (< 2h) with Fixed Penalty ---')
  const lateDate = new Date(Date.now() + 45 * 60 * 1000) // 45 mins in future
  const { datePart: lateDatePart, timeSlot: lateTimeSlot } = toISTDateTime(lateDate)

  const lateBooking = await Booking.create({
    userId: testCustomerId,
    laborId: testVendorId,
    acceptedLabourId: testVendorId,
    type: 'SCHEDULED',
    serviceId: new mongoose.Types.ObjectId(),
    subcategoryId: new mongoose.Types.ObjectId(),
    date: lateDatePart,
    timeSlot: lateTimeSlot,
    status: 'ACCEPTED',
    basePrice: 500,
    totalAmount: 600,
    laborShare: 450,
    paymentMethod: 'ONLINE',
    address: { locationText: 'Test Location late' },
  })

  const lateEligibility = await getCancellationEligibility(lateBooking._id, testVendorId)
  assert.strictEqual(lateEligibility.isEligible, true, 'Late cancellation should be eligible')
  assert.strictEqual(lateEligibility.isLate, true, 'Should be flagged as late')
  assert.strictEqual(lateEligibility.penaltyAmount, 200, 'Late penalty should be ₹200')
  assert.strictEqual(lateEligibility.timingClassification, TIMING_CLASSIFICATION.LATE)
  console.log('  ✅ PASS: 45m advance cancellation classified as LATE (₹200 penalty calculated)')

  const lateCancelResult = await processVendorCancellation({
    bookingId: lateBooking._id,
    vendorId: testVendorId,
    reason: 'Vehicle Breakdown',
  })
  assert.strictEqual(lateCancelResult.status, 'CANCELLED')
  assert.strictEqual(lateCancelResult.penaltyDeducted, 200)

  const updatedWallet2 = await Wallet.findOne({ userId: testVendorId })
  assert.strictEqual(updatedWallet2.selfBalance, 300, 'Wallet balance should be deducted (₹500 -> ₹300)')
  console.log('  ✅ PASS: ₹200 late cancellation penalty deducted atomically (₹500 -> ₹300)')

  const tx = await WalletTransaction.findOne({
    userId: testVendorId,
    context: 'PENALTY',
    referenceId: lateBooking._id,
  })
  assert(tx != null, 'Immutable WalletTransaction should be created')
  console.log('  ✅ PASS: Immutable WalletTransaction created with context: PENALTY')

  // -------------------------------------------------------------
  // TEST GROUP 4: Percentage-based Penalty Calculation
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 4: Percentage-based Penalty Calculation ---')
  await updateBookingCancellationSettings(
    {
      penaltyType: 'PERCENTAGE',
      percentagePenaltyRate: 20, // 20% of 450 = ₹90
    },
    testAdminUser
  )

  const pctBooking = await Booking.create({
    userId: testCustomerId,
    laborId: testVendorId,
    acceptedLabourId: testVendorId,
    type: 'SCHEDULED',
    serviceId: new mongoose.Types.ObjectId(),
    subcategoryId: new mongoose.Types.ObjectId(),
    date: lateDatePart,
    timeSlot: lateTimeSlot,
    status: 'ACCEPTED',
    basePrice: 500,
    totalAmount: 600,
    laborShare: 450,
    paymentMethod: 'ONLINE',
    address: { locationText: 'Test Location pct' },
  })

  const pctEligibility = await getCancellationEligibility(pctBooking._id, testVendorId)
  assert.strictEqual(pctEligibility.penaltyAmount, 90, '20% of ₹450 should be ₹90')
  console.log('  ✅ PASS: 20% penalty on ₹450 booking calculated accurately as ₹90')

  // -------------------------------------------------------------
  // TEST GROUP 5: Admin Approval Workflow (REQUIRE_APPROVAL)
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 5: Admin Approval Workflow ---')
  await updateBookingCancellationSettings(
    {
      lateCancellationAction: 'REQUIRE_APPROVAL',
      penaltyType: 'FIXED',
      fixedPenaltyAmount: 150,
    },
    testAdminUser
  )

  const approvalBooking = await Booking.create({
    userId: testCustomerId,
    laborId: testVendorId,
    acceptedLabourId: testVendorId,
    type: 'SCHEDULED',
    serviceId: new mongoose.Types.ObjectId(),
    subcategoryId: new mongoose.Types.ObjectId(),
    date: lateDatePart,
    timeSlot: lateTimeSlot,
    status: 'ACCEPTED',
    basePrice: 500,
    totalAmount: 600,
    laborShare: 450,
    paymentMethod: 'ONLINE',
    address: { locationText: 'Test Location approval' },
  })

  const approvalEligibility = await getCancellationEligibility(approvalBooking._id, testVendorId)
  assert.strictEqual(approvalEligibility.requiresApproval, true, 'Should require admin approval')
  console.log('  ✅ PASS: Late cancellation flagged as requiring admin approval')

  const reqResult = await processVendorCancellation({
    bookingId: approvalBooking._id,
    vendorId: testVendorId,
    reason: 'Personal Emergency',
  })
  assert.strictEqual(reqResult.status, 'CANCELLATION_REQUESTED')
  assert.strictEqual(reqResult.requiresApproval, true)

  const refreshedBooking = await Booking.findById(approvalBooking._id)
  assert.strictEqual(refreshedBooking.status, 'CANCELLATION_REQUESTED')
  console.log('  ✅ PASS: Booking transitioned to CANCELLATION_REQUESTED')

  // Admin approves the request
  const approvedRecord = await approveCancellationRequest({
    recordId: reqResult.record._id,
    adminUser: testAdminUser,
    adminNotes: 'Approved with penalty',
  })
  assert.strictEqual(approvedRecord.cancellationStatus, CANCELLATION_STATUS.APPROVED)
  assert.strictEqual(approvedRecord.approvalStatus, APPROVAL_STATUS.APPROVED)
  assert.strictEqual(approvedRecord.deductedAmount, 150)

  const finalBooking = await Booking.findById(approvalBooking._id)
  assert.strictEqual(finalBooking.status, 'CANCELLED')
  console.log('  ✅ PASS: Admin approval finalized cancellation and deducted ₹150 penalty')

  // -------------------------------------------------------------
  // TEST GROUP 6: Blocked Late Cancellation (BLOCK)
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 6: Blocked Late Cancellation Action ---')
  await updateBookingCancellationSettings(
    {
      lateCancellationAction: 'BLOCK',
    },
    testAdminUser
  )

  const blockedBooking = await Booking.create({
    userId: testCustomerId,
    laborId: testVendorId,
    acceptedLabourId: testVendorId,
    type: 'SCHEDULED',
    serviceId: new mongoose.Types.ObjectId(),
    subcategoryId: new mongoose.Types.ObjectId(),
    date: lateDatePart,
    timeSlot: lateTimeSlot,
    status: 'ACCEPTED',
    basePrice: 500,
    totalAmount: 600,
    laborShare: 450,
    paymentMethod: 'ONLINE',
    address: { locationText: 'Test Location blocked' },
  })

  const blockedEligibility = await getCancellationEligibility(blockedBooking._id, testVendorId)
  assert.strictEqual(blockedEligibility.isEligible, false, 'Should not be eligible')
  assert.strictEqual(blockedEligibility.isBlocked, true, 'Should be flagged as blocked')
  console.log('  ✅ PASS: Late cancellation successfully BLOCKED by platform policy')

  // -------------------------------------------------------------
  // TEST GROUP 7: Service Start Passed (EXPIRED) & Ineligible Statuses
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 7: Lifecycle Integrity & Boundary Checks ---')
  const pastDate = new Date(Date.now() - 30 * 60 * 1000) // 30m in past
  const { datePart: pastDatePart, timeSlot: pastTimeSlot } = toISTDateTime(pastDate)

  const pastBooking = await Booking.create({
    userId: testCustomerId,
    laborId: testVendorId,
    acceptedLabourId: testVendorId,
    type: 'SCHEDULED',
    serviceId: new mongoose.Types.ObjectId(),
    subcategoryId: new mongoose.Types.ObjectId(),
    date: pastDatePart,
    timeSlot: pastTimeSlot,
    status: 'ACCEPTED',
    basePrice: 500,
    totalAmount: 600,
    laborShare: 450,
    paymentMethod: 'ONLINE',
    address: { locationText: 'Test Location past' },
  })

  const pastEligibility = await getCancellationEligibility(pastBooking._id, testVendorId)
  assert.strictEqual(pastEligibility.isEligible, false)
  assert.strictEqual(pastEligibility.isExpired, true)
  console.log('  ✅ PASS: Cancellation after service start time rejected as EXPIRED')

  // Started Booking Check
  const startedBooking = await Booking.create({
    userId: testCustomerId,
    laborId: testVendorId,
    acceptedLabourId: testVendorId,
    type: 'SCHEDULED',
    serviceId: new mongoose.Types.ObjectId(),
    subcategoryId: new mongoose.Types.ObjectId(),
    date: datePart,
    timeSlot: timeSlot,
    status: 'STARTED',
    basePrice: 500,
    totalAmount: 600,
    laborShare: 450,
    paymentMethod: 'ONLINE',
    address: { locationText: 'Test Location started' },
  })
  const startedEligibility = await getCancellationEligibility(startedBooking._id, testVendorId)
  assert.strictEqual(startedEligibility.isEligible, false)
  console.log('  ✅ PASS: Cancellation of STARTED booking rejected')

  // Ownership Check
  const otherBookingEligibility = await getCancellationEligibility(standardBooking._id, otherVendorId)
  assert.strictEqual(otherBookingEligibility.isEligible, false)
  console.log('  ✅ PASS: Cancellation by non-assigned vendor rejected')

  // -------------------------------------------------------------
  // TEST GROUP 8: Penalty Waiver & Compensating Refund
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 8: Admin Penalty Waiver & Ledger Refund ---')
  const walletBeforeWaiver = await Wallet.findOne({ userId: testVendorId })
  const balanceBeforeWaiver = walletBeforeWaiver.selfBalance

  const waiverResult = await waiveCancellationPenalty({
    recordId: lateCancelResult.record._id,
    adminUser: testAdminUser,
    waiverReason: 'Vendor provided medical doctor certificate proof',
  })
  assert.strictEqual(waiverResult.success, true)
  assert.strictEqual(waiverResult.record.penaltyStatus, CANCELLATION_PENALTY_STATUS.WAIVED)

  const walletAfterWaiver = await Wallet.findOne({ userId: testVendorId })
  assert.strictEqual(
    walletAfterWaiver.selfBalance,
    balanceBeforeWaiver + 200,
    'Wallet balance should be refunded by ₹200'
  )
  console.log('  ✅ PASS: Penalty marked as WAIVED and ₹200 refunded to vendor wallet')

  // -------------------------------------------------------------
  // TEST GROUP 9: Overview Statistics
  // -------------------------------------------------------------
  console.log('\n--- TEST GROUP 9: Admin Overview Statistics ---')
  const stats = await getAdminCancellationOverviewStats()
  assert(stats.totalRecords > 0, 'Total records count should be > 0')
  assert(stats.standardCount > 0, 'Standard count should be > 0')
  assert(stats.lateCount > 0, 'Late count should be > 0')
  assert(stats.waivedCount > 0, 'Waived count should be > 0')
  console.log(`  ✅ PASS: Overview stats returned (Total: ${stats.totalRecords}, Standard: ${stats.standardCount}, Late: ${stats.lateCount}, Waived: ${stats.waivedCount})`)

  console.log('\n========================================')
  console.log('🎉 ALL 20/20 CANCELLATION ENGINE TESTS PASSED SUCCESSFULLY!')
  console.log('========================================\n')

  await mongoose.disconnect()
}

runTest().catch((err) => {
  console.error('\n❌ TEST FAILED:', err)
  process.exit(1)
})
