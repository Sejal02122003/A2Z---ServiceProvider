import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import { User } from '../models/User.js'
import { Booking } from '../models/Booking.js'
import { TrialConfiguration } from '../models/TrialConfiguration.js'
import { VendorTrial, VENDOR_TRIAL_STATUS } from '../models/VendorTrial.js'
import { TrialEvaluation } from '../models/TrialEvaluation.js'
import { VendorWarning } from '../models/VendorWarning.js'
import { FinalChanceRequest, FINAL_CHANCE_STATUS } from '../models/FinalChanceRequest.js'
import { TrialAuditLog } from '../models/TrialAuditLog.js'
import {
  getTrialConfig,
  updateTrialConfig,
  startVendorTrial,
  evaluateBookingRating,
  requestFinalChance,
  verifyAndActivateFinalChance,
  confirmVendor,
  rejectVendor,
  blockVendor,
  unblockVendor,
  requestAdditionalReview,
  grantAdditionalTrial,
  waivePenaltyAndActivateFinalChance,
  pauseTrial,
  resumeTrial,
  migrateExistingVendors,
} from '../services/trialEvaluationService.js'
import { KYC_STATUS, USER_ROLES } from '../constants/roles.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../../.env') })

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/labourchowck'

async function runAllTests() {
  console.log('=== STARTING VENDOR TRIAL SYSTEM INTEGRATION TEST SUITE ===')
  await mongoose.connect(MONGO_URI)
  console.log('✓ Connected to MongoDB')

  let passedTests = 0
  let failedTests = 0

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`)
      passedTests++
    } else {
      console.error(`  ✗ FAIL: ${message}`)
      failedTests++
      throw new Error(`Assertion failed: ${message}`)
    }
  }

  try {
    // 0. Clean test fixtures
    await User.deleteMany({ phone: { $regex: '^99999' } })
    await Booking.deleteMany({ notes: 'Trial System Test' })

    const adminUser = await User.create({
      phone: '9999900000',
      fullName: 'Test Super Admin',
      role: USER_ROLES.ADMIN,
      isActive: true,
    })

    const customerUser = await User.create({
      phone: '9999900001',
      fullName: 'Test Customer',
      role: USER_ROLES.CUSTOMER,
      isActive: true,
    })

    // Test 1: Configuration Management & Snapshot
    console.log('\n--- Test 1: Admin Configuration & Snapshot ---')
    await updateTrialConfig({ freeTrialCount: 5, passingRatingThreshold: 4, warningRatingThreshold: 3, finalChancePenaltyAmount: 500 }, adminUser)
    const config = await getTrialConfig()
    assert(config.freeTrialCount === 5, 'Config freeTrialCount is 5')
    assert(config.passingRatingThreshold === 4, 'Config passingRatingThreshold is 4')
    assert(config.finalChancePenaltyAmount === 500, 'Config penalty is 500')

    // Test 2: Vendor Verification starts trial (Requirement 2)
    console.log('\n--- Test 2: Vendor KYC Verification starts trial ---')
    const vendor1 = await User.create({
      phone: '9999911111',
      fullName: 'Vendor Ramesh Kumar',
      role: USER_ROLES.LABOUR,
      isActive: true,
      labourProfile: { kycStatus: KYC_STATUS.VERIFIED },
    })

    const trial1 = await startVendorTrial(vendor1._id, { performedBy: adminUser._id, actorRole: 'ADMIN' })
    assert(trial1.status === VENDOR_TRIAL_STATUS.TRIAL_ACTIVE, 'Trial 1 status is TRIAL_ACTIVE')
    assert(trial1.configuredTrialCount === 5, 'Trial 1 snapshot has 5 trials')
    assert(trial1.completedTrialCount === 0, 'Trial 1 completed count is 0')

    const v1Updated = await User.findById(vendor1._id)
    assert(v1Updated.vendorStatus === 'TRIAL_ACTIVE', 'User vendorStatus is TRIAL_ACTIVE')

    // Test 3: Successful 5-Star and 4-Star Ratings
    console.log('\n--- Test 3: 5-Star and 4-Star Trial Evaluation ---')
    const b1 = await Booking.create({
      userId: customerUser._id,
      laborId: vendor1._id,
      subcategoryId: new mongoose.Types.ObjectId(),
      serviceId: new mongoose.Types.ObjectId(),
      type: 'INSTANT',
      basePrice: 500,
      totalAmount: 500,
      laborShare: 450,
      paymentMethod: 'ONLINE',
      status: 'COMPLETED',
      address: { locationText: 'Test Location' },
      notes: 'Trial System Test',
    })

    const res1 = await evaluateBookingRating({ bookingId: b1._id, rating: 5, comment: 'Great job', reviewerId: customerUser._id, vendorId: vendor1._id })
    assert(res1.isTrialEvaluation === true, 'Booking 1 evaluated as trial')
    assert(res1.evaluation.result === 'PASSED', '5-star evaluation is PASSED')
    assert(res1.trial.completedTrialCount === 1, 'Completed trial count incremented to 1')
    assert(res1.trial.passedTrialCount === 1, 'Passed trial count incremented to 1')

    // Test 4: Duplicate rating protection (Requirement 26 & 38)
    console.log('\n--- Test 4: Duplicate Rating Idempotency Protection ---')
    const resDup = await evaluateBookingRating({ bookingId: b1._id, rating: 5, comment: 'Duplicate', reviewerId: customerUser._id, vendorId: vendor1._id })
    assert(resDup.alreadyEvaluated === true, 'Duplicate rating is safely ignored and marked alreadyEvaluated')
    assert(resDup.trial.completedTrialCount === 1, 'Completed count remains 1')

    // Test 5: 3-Star Low Performance Warning (Requirement 10)
    console.log('\n--- Test 5: 3-Star Rating triggers Low Performance Warning ---')
    const b2 = await Booking.create({
      userId: customerUser._id,
      laborId: vendor1._id,
      subcategoryId: new mongoose.Types.ObjectId(),
      serviceId: new mongoose.Types.ObjectId(),
      type: 'INSTANT',
      basePrice: 500,
      totalAmount: 500,
      laborShare: 450,
      paymentMethod: 'ONLINE',
      status: 'COMPLETED',
      address: { locationText: 'Test Location' },
      notes: 'Trial System Test',
    })

    const res2 = await evaluateBookingRating({ bookingId: b2._id, rating: 3, comment: 'Average work', reviewerId: customerUser._id, vendorId: vendor1._id })
    assert(res2.evaluation.result === 'FAILED', '3-star evaluation is FAILED')
    assert(res2.trial.status === VENDOR_TRIAL_STATUS.WARNING, 'Trial status moved to WARNING')
    assert(res2.trial.warningIssued === true, 'warningIssued flag set')

    const warningRec = await VendorWarning.findOne({ vendorId: vendor1._id })
    assert(warningRec !== null, 'VendorWarning record created in DB')

    // Test 6: Warning Chance Passed
    console.log('\n--- Test 6: Warning Opportunity Passed with 5-Stars ---')
    const b3 = await Booking.create({
      userId: customerUser._id,
      laborId: vendor1._id,
      subcategoryId: new mongoose.Types.ObjectId(),
      serviceId: new mongoose.Types.ObjectId(),
      type: 'INSTANT',
      basePrice: 500,
      totalAmount: 500,
      laborShare: 450,
      paymentMethod: 'ONLINE',
      status: 'COMPLETED',
      address: { locationText: 'Test Location' },
      notes: 'Trial System Test',
    })

    const res3 = await evaluateBookingRating({ bookingId: b3._id, rating: 5, comment: 'Recovered well', reviewerId: customerUser._id, vendorId: vendor1._id })
    assert(res3.evaluation.result === 'PASSED', 'Warning chance passed')
    assert(res3.trial.status === VENDOR_TRIAL_STATUS.TRIAL_ACTIVE, 'Trial status restored to TRIAL_ACTIVE')
    assert(res3.trial.warningChanceUsed === true, 'Warning chance marked as used')

    // Test 7: Warning Chance Failure -> FINAL_FAILURE flow (Vendor 2)
    console.log('\n--- Test 7: Warning Chance Failure leads to FINAL_FAILURE ---')
    const vendor2 = await User.create({
      phone: '9999922222',
      fullName: 'Vendor Suresh LowPerf',
      role: USER_ROLES.LABOUR,
      isActive: true,
      labourProfile: { kycStatus: KYC_STATUS.VERIFIED },
    })
    await startVendorTrial(vendor2._id)

    // Job 1: 3-star warning
    const bV2_1 = await Booking.create({
      userId: customerUser._id,
      laborId: vendor2._id,
      subcategoryId: new mongoose.Types.ObjectId(),
      serviceId: new mongoose.Types.ObjectId(),
      type: 'INSTANT',
      basePrice: 500,
      totalAmount: 500,
      laborShare: 450,
      paymentMethod: 'ONLINE',
      status: 'COMPLETED',
      address: { locationText: 'Test Location' },
      notes: 'Trial System Test',
    })
    await evaluateBookingRating({ bookingId: bV2_1._id, rating: 3, reviewerId: customerUser._id, vendorId: vendor2._id })

    // Job 2: 2-star on warning opportunity -> FINAL FAILURE
    const bV2_2 = await Booking.create({
      userId: customerUser._id,
      laborId: vendor2._id,
      subcategoryId: new mongoose.Types.ObjectId(),
      serviceId: new mongoose.Types.ObjectId(),
      type: 'INSTANT',
      basePrice: 500,
      totalAmount: 500,
      laborShare: 450,
      paymentMethod: 'ONLINE',
      status: 'COMPLETED',
      address: { locationText: 'Test Location' },
      notes: 'Trial System Test',
    })
    const resV2_2 = await evaluateBookingRating({ bookingId: bV2_2._id, rating: 2, reviewerId: customerUser._id, vendorId: vendor2._id })
    assert(resV2_2.trial.status === VENDOR_TRIAL_STATUS.FINAL_FAILURE, 'Trial moved to FINAL_FAILURE after warning failure')

    // Test 8: Final Chance Request & Penalty Payment (Requirement 14-19)
    console.log('\n--- Test 8: Final Chance Request & Penalty Payment Verification ---')
    const fcReqRes = await requestFinalChance(vendor2._id)
    assert(fcReqRes.penaltyAmount === 500, 'Penalty amount snapshot matches ₹500')
    assert(fcReqRes.finalChanceRequest.status === FINAL_CHANCE_STATUS.PAYMENT_PENDING, 'Final chance request is PAYMENT_PENDING')

    // Waive penalty / Activate Final Chance
    const waiveRes = await waivePenaltyAndActivateFinalChance(vendor2._id, adminUser, 'Test waiver')
    assert(waiveRes.trial.status === VENDOR_TRIAL_STATUS.FINAL_CHANCE_ACTIVE, 'Final chance is active')
    assert(waiveRes.finalChanceRequest.status === FINAL_CHANCE_STATUS.WAIVED, 'Final chance request is WAIVED/ACTIVATED')

    // Test 9: Final Chance Rating Evaluation (4-5 stars -> PENDING_ADMIN_CONFIRMATION)
    console.log('\n--- Test 9: Final Chance Passed -> PENDING_ADMIN_CONFIRMATION ---')
    const bV2_3 = await Booking.create({
      userId: customerUser._id,
      laborId: vendor2._id,
      subcategoryId: new mongoose.Types.ObjectId(),
      serviceId: new mongoose.Types.ObjectId(),
      type: 'INSTANT',
      basePrice: 500,
      totalAmount: 500,
      laborShare: 450,
      paymentMethod: 'ONLINE',
      status: 'COMPLETED',
      address: { locationText: 'Test Location' },
      notes: 'Trial System Test',
    })
    const resV2_3 = await evaluateBookingRating({ bookingId: bV2_3._id, rating: 5, reviewerId: customerUser._id, vendorId: vendor2._id })
    assert(resV2_3.trial.status === VENDOR_TRIAL_STATUS.TRIAL_COMPLETED, 'Trial status is TRIAL_COMPLETED')
    assert(resV2_3.trial.eligibleForConfirmation === true, 'eligibleForConfirmation is true')
    const u2 = await User.findById(vendor2._id)
    assert(u2.vendorStatus === VENDOR_TRIAL_STATUS.PENDING_ADMIN_CONFIRMATION, 'Vendor 2 status is PENDING_ADMIN_CONFIRMATION (NOT confirmed yet)')

    // Test 10: Admin Confirmation Flow (Requirement 45, 49, 60, 61)
    console.log('\n--- Test 10: Admin Explicit Confirmation ---')
    const confirmRes = await confirmVendor(vendor2._id, adminUser, 'Excellent recovery in final chance')
    assert(confirmRes.trial.status === VENDOR_TRIAL_STATUS.CONFIRMED, 'Trial status is CONFIRMED')
    assert(confirmRes.trial.confirmedBy.toString() === adminUser._id.toString(), 'confirmedBy is set to admin ID')
    assert(confirmRes.user.vendorStatus === VENDOR_TRIAL_STATUS.CONFIRMED, 'User vendorStatus is CONFIRMED')

    // Test 11: Post-Confirmation Rating Separation (Requirement 55 & 56)
    console.log('\n--- Test 11: Post-Confirmation Ratings do NOT modify trial history ---')
    const bPost = await Booking.create({
      userId: customerUser._id,
      laborId: vendor2._id,
      subcategoryId: new mongoose.Types.ObjectId(),
      serviceId: new mongoose.Types.ObjectId(),
      type: 'INSTANT',
      basePrice: 500,
      totalAmount: 500,
      laborShare: 450,
      paymentMethod: 'ONLINE',
      status: 'COMPLETED',
      address: { locationText: 'Test Location' },
      notes: 'Trial System Test',
    })
    const postRes = await evaluateBookingRating({ bookingId: bPost._id, rating: 2, comment: 'Post confirm low rating', reviewerId: customerUser._id, vendorId: vendor2._id })
    assert(postRes.isTrialEvaluation === false, 'Post confirmation rating skipped trial counters')
    const t2After = await VendorTrial.findOne({ vendorId: vendor2._id })
    assert(t2After.status === VENDOR_TRIAL_STATUS.CONFIRMED, 'Trial status remains CONFIRMED')
    assert(t2After.completedTrialCount === 3, 'Trial counters unchanged')

    // Test 12: Admin Pause, Resume, Extend, Reject, Block
    console.log('\n--- Test 12: Admin Overrides (Pause, Resume, Extend, Block, Reject) ---')
    const vendor3 = await User.create({
      phone: '9999933333',
      fullName: 'Vendor Overrides Test',
      role: USER_ROLES.LABOUR,
      isActive: true,
      labourProfile: { kycStatus: KYC_STATUS.VERIFIED },
    })
    await startVendorTrial(vendor3._id)

    // Pause
    const paused = await pauseTrial(vendor3._id, adminUser, 'Testing pause')
    assert(paused.status === VENDOR_TRIAL_STATUS.TRIAL_PAUSED, 'Trial paused')

    // Resume
    const resumed = await resumeTrial(vendor3._id, adminUser)
    assert(resumed.status === VENDOR_TRIAL_STATUS.TRIAL_ACTIVE, 'Trial resumed')

    // Extend
    const extended = await grantAdditionalTrial(vendor3._id, adminUser, { additionalCount: 2, reason: 'Testing extension' })
    assert(extended.adminGrantedAdditionalTrials === 2, 'Granted 2 additional trials')

    // Block
    const blocked = await blockVendor(vendor3._id, adminUser, 'Testing block')
    assert(blocked.trial.status === VENDOR_TRIAL_STATUS.BLOCKED, 'Trial blocked')
    assert(blocked.user.vendorStatus === 'BLOCKED', 'User vendorStatus is BLOCKED')
    assert(blocked.user.isActive === false, 'User isActive is false')

    // Unblock
    const unblocked = await unblockVendor(vendor3._id, adminUser, 'Testing unblock')
    assert(unblocked.trial.status === VENDOR_TRIAL_STATUS.TRIAL_ACTIVE, 'Trial unblocked')
    assert(unblocked.user.isActive === true, 'User isActive is true')

    // Reject
    const rejected = await rejectVendor(vendor3._id, adminUser, 'Operational standard mismatch')
    assert(rejected.trial.status === VENDOR_TRIAL_STATUS.REJECTED, 'Trial rejected')
    assert(rejected.user.vendorStatus === 'REJECTED', 'User vendorStatus is REJECTED')

    // Test 13: Existing Vendor Migration (Requirement 41)
    console.log('\n--- Test 13: Existing Verified Vendor Grandfathering Migration ---')
    const existingVerifiedVendor = await User.create({
      phone: '9999944444',
      fullName: 'Legacy Verified Worker',
      role: USER_ROLES.LABOUR,
      isActive: true,
      labourProfile: { kycStatus: 'verified' },
      vendorStatus: 'NOT_STARTED',
    })

    const migRes = await migrateExistingVendors(adminUser)
    assert(migRes.migratedCount >= 1, 'Migrated at least 1 legacy vendor')

    const migUser = await User.findById(existingVerifiedVendor._id)
    assert(migUser.vendorStatus === 'CONFIRMED', 'Legacy vendor is now CONFIRMED')

    // Clean up test records
    await User.deleteMany({ phone: { $regex: '^99999' } })
    await Booking.deleteMany({ notes: 'Trial System Test' })

    console.log(`\n========================================`)
    console.log(`✓ ALL TESTS PASSED! (${passedTests} passed, ${failedTests} failed)`)
    console.log(`========================================\n`)
  } catch (err) {
    console.error('Test failed with error:', err)
  } finally {
    await mongoose.disconnect()
  }
}

runAllTests()
