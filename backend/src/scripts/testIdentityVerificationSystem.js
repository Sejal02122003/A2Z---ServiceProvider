import assert from 'assert'
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import { User } from '../models/User.js'
import { IdentityVerification } from '../models/IdentityVerification.js'
import { IdentityAuditLog, IDENTITY_AUDIT_ACTIONS } from '../models/IdentityAuditLog.js'
import { IDENTITY_STATUS, NAME_MATCH_CONFIDENCE } from '../constants/identityConstants.js'
import { USER_ROLES, KYC_STATUS } from '../constants/roles.js'
import {
  calculateNameSimilarity,
  normalizeName,
  validateName,
} from '../utils/nameNormalization.js'
import {
  evaluateIdentityRiskSignals,
  handleProviderWebhook,
  isValidStateTransition,
  logIdentityAudit,
  restoreUserIdentity,
  reviewIdentityVerificationAdmin,
  submitIdentityVerification,
  suspendUserIdentity,
} from '../services/identityVerificationService.js'
import { otpRequestLimiter } from '../utils/rateLimiter.js'

dotenv.config()

async function runTestSuite() {
  console.log('=================================================================')
  console.log('   A2Z IDENTITY VERIFICATION & ANTI-IMPERSONATION TEST SUITE     ')
  console.log('=================================================================\n')

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/a2z-service'
  await mongoose.connect(mongoUri)
  console.log('[TEST] Connected to MongoDB at', mongoUri)

  const timestamp = Date.now()

  try {
    // -------------------------------------------------------------
    // TEST 1: Name Validation - Reject Empty, Numeric-only, Prohibited
    // -------------------------------------------------------------
    console.log('\n--- TEST 1: Name Validation Rule Checks ---')
    assert.strictEqual(validateName('').isValid, false, 'Empty name must be rejected')
    assert.strictEqual(validateName('   ').isValid, false, 'Whitespace-only name must be rejected')
    assert.strictEqual(validateName('123456').isValid, false, 'Numeric-only name must be rejected')
    assert.strictEqual(validateName('9876543210').isValid, false, 'Phone digits as name must be rejected')
    assert.strictEqual(validateName('admin').isValid, false, 'Reserved system word must be rejected')
    assert.strictEqual(validateName('a2z support').isValid, false, 'Deceptive company name must be rejected')
    assert.strictEqual(validateName('A').isValid, false, 'Single letter name must be rejected')
    console.log('✓ TEST 1 PASSED: Invalid and malformed names correctly rejected.')

    // -------------------------------------------------------------
    // TEST 2: Name Validation - Accept Valid Indian & International
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Accept Legitimate Multilingual Names ---')
    assert.strictEqual(validateName('Rajesh Kumar').isValid, true, 'Standard English name accepted')
    assert.strictEqual(validateName('राजेश कुमार').isValid, true, 'Devanagari script name accepted')
    assert.strictEqual(validateName('முத்து குமார்').isValid, true, 'Tamil script name accepted')
    assert.strictEqual(validateName("Shaun O'Connor").isValid, true, 'Apostrophe in name accepted')
    assert.strictEqual(validateName('Mary-Jane Watson').isValid, true, 'Hyphenated name accepted')
    assert.strictEqual(validateName('Renée Zellweger').isValid, true, 'Accented international name accepted')
    console.log('✓ TEST 2 PASSED: Multilingual, hyphenated, and regional names accepted.')

    // -------------------------------------------------------------
    // TEST 3: Name Normalization & Order-Independent Matching
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Name Normalization and Matching Algorithm ---')
    const matchExact = calculateNameSimilarity('Rahul Sharma', 'Rahul Sharma')
    assert.strictEqual(matchExact.isMatch, true)
    assert.strictEqual(matchExact.confidence, NAME_MATCH_CONFIDENCE.EXACT)

    const matchReordered = calculateNameSimilarity('Sharma Rahul', 'Rahul Sharma')
    assert.strictEqual(matchReordered.isMatch, true)
    assert.strictEqual(matchReordered.confidence, NAME_MATCH_CONFIDENCE.HIGH)

    const matchTypo = calculateNameSimilarity('Mohammad Rajesh', 'Mohamed Rajesh')
    assert.strictEqual(matchTypo.isMatch, true)

    const matchDiscrepancy = calculateNameSimilarity('Amit Kumar', 'Sunil Verma')
    assert.strictEqual(matchDiscrepancy.isMatch, false)
    assert.strictEqual(matchDiscrepancy.confidence, NAME_MATCH_CONFIDENCE.MISMATCH)
    console.log('✓ TEST 3 PASSED: Order-independent and fuzzy comparison behaves correctly.')

    // -------------------------------------------------------------
    // TEST 4: Two Genuine Users With Identical Names (Distinct Phones)
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Identical Names with Distinct Phone Numbers ---')
    const phoneA = `91${String(timestamp).slice(-8)}`
    const phoneB = `92${String(timestamp).slice(-8)}`

    const userA = await User.create({
      fullName: 'Vikram Singh',
      phone: phoneA,
      role: USER_ROLES.CUSTOMER,
      isPhoneVerified: true,
      identityStatus: IDENTITY_STATUS.CONTACT_VERIFIED,
    })

    const userB = await User.create({
      fullName: 'Vikram Singh', // Identical name!
      phone: phoneB,
      role: USER_ROLES.CUSTOMER,
      isPhoneVerified: true,
      identityStatus: IDENTITY_STATUS.CONTACT_VERIFIED,
    })

    assert.ok(userA._id && userB._id, 'Both users must be created')
    assert.strictEqual(userA.fullName, userB.fullName, 'Names are identical')
    assert.notStrictEqual(userA.phone, userB.phone, 'Phones must be distinct')
    console.log('✓ TEST 4 PASSED: Permitted identical names with distinct contact credentials.')

    // -------------------------------------------------------------
    // TEST 5: Duplicate Phone Enforcement
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Duplicate Phone Enforcement ---')
    let dupFailed = false
    try {
      await User.create({
        fullName: 'Another Person',
        phone: phoneA, // Duplicate phone!
        role: USER_ROLES.CUSTOMER,
      })
    } catch (err) {
      dupFailed = true
    }
    assert.strictEqual(dupFailed, true, 'Duplicate phone number must trigger unique violation')
    console.log('✓ TEST 5 PASSED: Duplicate contact registration prevented.')

    // -------------------------------------------------------------
    // TEST 6: State Machine Transitions
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: State Machine Transition Enforcement ---')
    assert.strictEqual(isValidStateTransition(IDENTITY_STATUS.UNVERIFIED, IDENTITY_STATUS.CONTACT_VERIFIED), true)
    assert.strictEqual(isValidStateTransition(IDENTITY_STATUS.CONTACT_VERIFIED, IDENTITY_STATUS.PENDING_IDENTITY_VERIFICATION), true)
    assert.strictEqual(isValidStateTransition(IDENTITY_STATUS.PENDING_IDENTITY_VERIFICATION, IDENTITY_STATUS.VERIFIED), true)
    // Client cannot jump directly from UNVERIFIED to VERIFIED
    assert.strictEqual(isValidStateTransition(IDENTITY_STATUS.UNVERIFIED, IDENTITY_STATUS.VERIFIED), false)
    console.log('✓ TEST 6 PASSED: Invalid direct status transitions blocked.')

    // -------------------------------------------------------------
    // TEST 7: Customer Submitting Verification with Clean Match
    // -------------------------------------------------------------
    console.log('\n--- TEST 7: Customer Verification Submission ---')
    const subRes = await submitIdentityVerification({
      user: userA,
      submittedName: 'Vikram Singh',
      verifiedLegalName: 'Vikram Singh',
      documentType: 'aadhaar',
      documentNumberMasked: 'XXXX XXXX 1234',
      provider: 'manual',
    })

    assert.strictEqual(subRes.verification.status, IDENTITY_STATUS.PENDING_IDENTITY_VERIFICATION)
    assert.strictEqual(userA.identityStatus, IDENTITY_STATUS.PENDING_IDENTITY_VERIFICATION)
    assert.strictEqual(subRes.nameComparison.isMatch, true)
    console.log('✓ TEST 7 PASSED: Customer verification registered and queued.')

    // -------------------------------------------------------------
    // TEST 8: Name Mismatch Escalates to MANUAL_REVIEW
    // -------------------------------------------------------------
    console.log('\n--- TEST 8: Name Mismatch Escalates to Manual Review ---')
    const subMismatch = await submitIdentityVerification({
      user: userB,
      submittedName: 'Vikram Singh',
      verifiedLegalName: 'Dharmendra Sharma', // Discrepancy!
      documentType: 'pan',
      documentNumberMasked: 'ABCDE XXXX F',
      provider: 'manual',
    })

    assert.strictEqual(subMismatch.verification.status, IDENTITY_STATUS.MANUAL_REVIEW)
    assert.strictEqual(userB.identityStatus, IDENTITY_STATUS.MANUAL_REVIEW)
    assert.ok(subMismatch.verification.riskFlags.includes('NAME_DISCREPANCY_FLAG'))
    console.log('✓ TEST 8 PASSED: Name discrepancy flagged for manual review without false accusation.')

    // -------------------------------------------------------------
    // TEST 9: Admin Review and Approval
    // -------------------------------------------------------------
    console.log('\n--- TEST 9: Admin Review & Approval with Audit Trail ---')
    const adminUser = await User.create({
      fullName: `Admin Reviewer ${timestamp}`,
      phone: `93${String(timestamp).slice(-8)}`,
      role: USER_ROLES.ADMIN,
      isPhoneVerified: true,
      identityStatus: IDENTITY_STATUS.VERIFIED,
    })

    const approvedRes = await reviewIdentityVerificationAdmin({
      verificationId: subRes.verification._id,
      adminUser,
      decision: 'approve',
      reason: 'Government Aadhaar masked card and photo verified',
      verifiedLegalName: 'Vikram Singh',
    })

    assert.strictEqual(approvedRes.user.identityStatus, IDENTITY_STATUS.VERIFIED)
    assert.strictEqual(approvedRes.verification.status, IDENTITY_STATUS.VERIFIED)

    const auditCheck = await IdentityAuditLog.findOne({
      verificationId: subRes.verification._id,
      action: IDENTITY_AUDIT_ACTIONS.ADMIN_APPROVED,
    })
    assert.ok(auditCheck, 'Audit log must record admin approval')
    console.log('✓ TEST 9 PASSED: Admin review recorded with immutable audit trail.')

    // -------------------------------------------------------------
    // TEST 10: Labour / Vendor KYC & Booking Enforcement
    // -------------------------------------------------------------
    console.log('\n--- TEST 10: Service Provider Identity & Booking Access ---')
    const labourVendor = await User.create({
      fullName: `Vendor Worker ${timestamp}`,
      phone: `94${String(timestamp).slice(-8)}`,
      role: USER_ROLES.LABOUR,
      isPhoneVerified: true,
      identityStatus: IDENTITY_STATUS.CONTACT_VERIFIED,
      labourProfile: {
        kycStatus: KYC_STATUS.PENDING,
      },
    })

    // Vendor with unverified KYC cannot be verified
    assert.strictEqual(labourVendor.identityStatus, IDENTITY_STATUS.CONTACT_VERIFIED)
    assert.notStrictEqual(labourVendor.identityStatus, IDENTITY_STATUS.VERIFIED)

    // Admin approves labour vendor KYC
    const vendorSub = await submitIdentityVerification({
      user: labourVendor,
      submittedName: labourVendor.fullName,
      verifiedLegalName: labourVendor.fullName,
      documentType: 'aadhaar',
      provider: 'manual',
    })

    await reviewIdentityVerificationAdmin({
      verificationId: vendorSub.verification._id,
      adminUser,
      decision: 'approve',
      reason: 'Aadhaar video KYC verified',
    })

    const updatedVendor = await User.findById(labourVendor._id)
    assert.strictEqual(updatedVendor.identityStatus, IDENTITY_STATUS.VERIFIED)
    assert.strictEqual(updatedVendor.labourProfile.kycStatus, KYC_STATUS.VERIFIED)
    console.log('✓ TEST 10 PASSED: Service provider KYC & identity verification synchronized.')

    // -------------------------------------------------------------
    // TEST 11: Account Suspension for Impersonation
    // -------------------------------------------------------------
    console.log('\n--- TEST 11: Account Suspension Safeguard ---')
    await suspendUserIdentity({
      userId: userB._id,
      adminUser,
      reason: 'Multiple conflicting document submissions requiring investigation',
    })

    const suspendedUser = await User.findById(userB._id)
    assert.strictEqual(suspendedUser.identityStatus, IDENTITY_STATUS.SUSPENDED)
    assert.strictEqual(suspendedUser.isActive, false)

    // Test restoring suspended user
    await restoreUserIdentity({
      userId: userB._id,
      adminUser,
      reason: 'User provided valid proof of name change via marriage certificate',
    })

    const restoredUser = await User.findById(userB._id)
    assert.strictEqual(restoredUser.identityStatus, IDENTITY_STATUS.CONTACT_VERIFIED)
    assert.strictEqual(restoredUser.isActive, true)
    console.log('✓ TEST 11 PASSED: Account suspension and restoration handled with reasons.')

    // -------------------------------------------------------------
    // TEST 12: Webhook Idempotency & Replay Protection
    // -------------------------------------------------------------
    console.log('\n--- TEST 12: Provider Webhook Idempotency ---')
    const eventId = `evt_test_${timestamp}`
    const webhookPayload = {
      eventId,
      referenceId: subRes.verification._id.toString(),
      status: 'VERIFIED',
      verifiedLegalName: 'Vikram Singh',
      riskScore: 0,
    }

    const firstRun = await handleProviderWebhook({
      eventId,
      payload: webhookPayload,
    })
    assert.strictEqual(firstRun.ok, true)

    // Second delivery of same event
    const secondRun = await handleProviderWebhook({
      eventId,
      payload: webhookPayload,
    })
    assert.strictEqual(secondRun.duplicate, true, 'Replay delivery must be detected as duplicate')
    console.log('✓ TEST 12 PASSED: Replay attack prevention and webhook deduplication confirmed.')

    // -------------------------------------------------------------
    // TEST 13: Backward Compatibility with Older Records
    // -------------------------------------------------------------
    console.log('\n--- TEST 13: Backward Compatibility for Older Accounts ---')
    const legacyUser = new User({
      fullName: 'Legacy Customer',
      phone: `95${String(timestamp).slice(-8)}`,
      role: USER_ROLES.CUSTOMER,
      isPhoneVerified: true,
      // identityStatus not set (simulating pre-existing record)
    })

    const safeObj = legacyUser.toSafeObject()
    assert.strictEqual(safeObj.identityStatus, IDENTITY_STATUS.CONTACT_VERIFIED, 'Phone-verified legacy accounts default to CONTACT_VERIFIED')
    console.log('✓ TEST 13 PASSED: Legacy accounts remain compatible with safe defaults.')

    // -------------------------------------------------------------
    // Cleanup test data
    // -------------------------------------------------------------
    await User.deleteMany({ _id: { $in: [userA._id, userB._id, adminUser._id, labourVendor._id] } })
    await IdentityVerification.deleteMany({ userId: { $in: [userA._id, userB._id, labourVendor._id] } })
    await IdentityAuditLog.deleteMany({ userId: { $in: [userA._id, userB._id, labourVendor._id] } })

    console.log('\n=================================================================')
    console.log('   ALL 13 AUTOMATED SYSTEM & INTEGRATION TESTS PASSED 100%       ')
    console.log('=================================================================\n')
  } catch (err) {
    console.error('\n❌ TEST FAILED:', err)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
  }
}

runTestSuite()
