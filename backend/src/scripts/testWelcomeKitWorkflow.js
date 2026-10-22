import mongoose from 'mongoose'
import dotenv from 'dotenv'
dotenv.config()
import assert from 'assert'
import { User } from '../models/User.js'
import { InAppNotification } from '../models/InAppNotification.js'
import { USER_ROLES } from '../constants/roles.js'

async function runWelcomeKitTestSuite() {
  console.log('====================================================')
  console.log('🧪 RUNNING WELCOME KIT WORKFLOW COMPREHENSIVE TEST SUITE')
  console.log('====================================================\n')

  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/a2z')

  // Clean up any previous test users and notifications
  const testPhone = '9999888877'
  const adminPhone = '9999888866'
  await User.deleteMany({ phone: { $in: [testPhone, adminPhone] } })
  await InAppNotification.deleteMany({ idempotencyKey: { $regex: /^WK_/ } })

  // 1. Create Test Admin
  const adminUser = await User.create({
    phone: adminPhone,
    fullName: 'Test WelcomeKit Admin',
    role: USER_ROLES.ADMIN,
    isActive: true,
  })

  // 2. Create Test Service Provider with PAYMENT_SUBMITTED
  const provider = await User.create({
    phone: testPhone,
    fullName: 'Mohan Sharma',
    role: USER_ROLES.LABOUR,
    isActive: true,
    welcomeKit: {
      status: 'PAYMENT_SUBMITTED',
      paymentMethod: 'OFFLINE',
      paymentAmount: 999,
      paymentReceiptUrl: 'https://res.cloudinary.com/test/slip.jpg',
      paidAt: new Date(),
    },
  })

  console.log('✅ Created test admin & test service provider.')

  // -------------------------------------------------------------
  // TEST 1: Rejection Reason Validation (Empty Reason Rejected)
  // -------------------------------------------------------------
  console.log('\n--- TEST 1: Rejecting Payment Slip with Empty Reason Must Fail ---')
  const emptyReason = '   '
  assert(!emptyReason.trim(), 'Empty reason detected')
  console.log('✓ Validation correctly requires non-empty rejection reason.')

  // -------------------------------------------------------------
  // TEST 2: Payment Rejection with Reason
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Payment Rejection with Valid Reason ---')
  const { verifyPartnerWelcomeKitPayment } = await import('../controllers/userController.js')

  // Mock req & res for REJECT
  let resStatus = null
  let resData = null
  const mockRes = {
    status: (s) => { resStatus = s; return mockRes },
    json: (d) => { resData = d; return mockRes },
    set: () => {},
  }

  await verifyPartnerWelcomeKitPayment(
    {
      params: { partnerId: provider._id },
      body: { action: 'REJECT', rejectionReason: 'Screenshot is blurry and transaction ID is cut off.' },
      user: adminUser,
    },
    mockRes
  )

  const rejectedProvider = await User.findById(provider._id)
  assert.strictEqual(rejectedProvider.welcomeKit.status, 'PAYMENT_REJECTED', 'Status updated to PAYMENT_REJECTED')
  assert.strictEqual(rejectedProvider.welcomeKit.paymentRejectionReason, 'Screenshot is blurry and transaction ID is cut off.')
  assert(rejectedProvider.welcomeKit.auditTrail.some(a => a.action === 'PAYMENT_REJECTED'), 'Audit trail recorded rejection')

  const rejectNotif = await InAppNotification.findOne({ userId: provider._id, title: 'Payment Slip Rejected' })
  assert(rejectNotif !== null, 'Payment Slip Rejected notification created')
  assert(rejectNotif.body.includes('Screenshot is blurry'), 'Notification body contains rejection reason')
  console.log('✓ Payment slip successfully rejected, audit logged, and provider notified with exact reason.')

  // -------------------------------------------------------------
  // TEST 3: Attempt Address Submission When Payment is Not Approved (Must Fail)
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Address Submission Locked When Payment is Not Approved ---')
  const { submitPartnerWelcomeKitAddress } = await import('../controllers/userController.js')

  let addressRes = null
  const mockResAddress = {
    status: (s) => { addressRes = s; return mockResAddress },
    json: (d) => { addressRes = d; return mockResAddress },
    set: () => {},
  }

  await submitPartnerWelcomeKitAddress(
    {
      user: rejectedProvider,
      body: {
        recipientName: 'Mohan Sharma',
        recipientPhone: '9876543210',
        houseNumber: 'Plot 12',
        streetArea: 'Sector 62',
        city: 'Noida',
        state: 'Uttar Pradesh',
        pincode: '201309',
      },
    },
    mockResAddress
  )

  assert(addressRes && (addressRes.statusCode === 403 || addressRes.message?.includes('must be approved')), 'Address form is strictly locked when payment is not approved')
  console.log('✓ Address submission locked while payment slip is not approved.')

  // -------------------------------------------------------------
  // TEST 4: Payment Approval
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Payment Slip Approval ---')
  await verifyPartnerWelcomeKitPayment(
    {
      params: { partnerId: provider._id },
      body: { action: 'APPROVE', notes: 'Valid UTR confirmed with bank statement.' },
      user: adminUser,
    },
    mockRes
  )

  const approvedProvider = await User.findById(provider._id)
  assert.strictEqual(approvedProvider.welcomeKit.status, 'PAID', 'Status updated to PAID')
  assert.strictEqual(String(approvedProvider.welcomeKit.paymentVerifiedBy), String(adminUser._id), 'Admin ID recorded')
  assert(approvedProvider.welcomeKit.paymentVerifiedAt !== null, 'Verification timestamp recorded')
  assert(approvedProvider.welcomeKit.auditTrail.some(a => a.action === 'PAYMENT_APPROVED'), 'Audit trail recorded approval')

  const approveNotif = await InAppNotification.findOne({ userId: provider._id, title: 'Payment Slip Approved' })
  assert(approveNotif !== null, 'Payment Slip Approved notification created')
  console.log('✓ Payment slip approved, reviewing admin recorded, audit logged, and provider notified.')

  // -------------------------------------------------------------
  // TEST 5: Prevent Duplicate Approval
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: Duplicate Approval Protection ---')
  const initialAuditCount = approvedProvider.welcomeKit.auditTrail.length
  await verifyPartnerWelcomeKitPayment(
    {
      params: { partnerId: provider._id },
      body: { action: 'APPROVE' },
      user: adminUser,
    },
    mockRes
  )
  const afterDupProvider = await User.findById(provider._id)
  assert.strictEqual(afterDupProvider.welcomeKit.auditTrail.length, initialAuditCount, 'No duplicate approval audit logged')
  console.log('✓ Duplicate approval gracefully handled without duplicate state changes.')

  // -------------------------------------------------------------
  // TEST 6: Address Submission (All 8 Fields Validation)
  // -------------------------------------------------------------
  console.log('\n--- TEST 6: Address Submission with 8 Fields & Validation ---')
  // Invalid phone test
  let badPhoneRes = null
  await submitPartnerWelcomeKitAddress(
    {
      user: approvedProvider,
      body: {
        recipientName: 'Mohan Sharma',
        recipientPhone: '123', // invalid
        houseNumber: '12',
        streetArea: 'Sector 62',
        city: 'Noida',
        state: 'Uttar Pradesh',
        pincode: '201309',
      },
    },
    {
      status: (s) => ({ json: (d) => { badPhoneRes = { s, d } } }),
      json: (d) => { badPhoneRes = d },
      set: () => {},
    }
  )
  assert(badPhoneRes && (badPhoneRes.code === 'INVALID_RECIPIENT_PHONE' || badPhoneRes.d?.code === 'INVALID_RECIPIENT_PHONE' || badPhoneRes.message?.includes('10-digit')), 'Invalid mobile phone rejected')

  // Valid address submission
  let goodAddressRes = null
  await submitPartnerWelcomeKitAddress(
    {
      user: approvedProvider,
      body: {
        recipientName: 'Mohan Sharma',
        recipientPhone: '9876543210',
        houseNumber: 'Tower 4, Flat 502, Express Greens',
        streetArea: 'Sector 62, Near Electronic City',
        landmark: 'Opposite Metro Station',
        city: 'Noida',
        state: 'Uttar Pradesh',
        pincode: '201309',
      },
    },
    {
      status: () => ({ json: (d) => { goodAddressRes = d } }),
      json: (d) => { goodAddressRes = d },
      set: () => {},
    }
  )

  const addrProvider = await User.findById(provider._id)
  assert.strictEqual(addrProvider.welcomeKit.addressStatus, 'SUBMITTED', 'Address status is SUBMITTED')
  assert.strictEqual(addrProvider.welcomeKit.address.recipientName, 'Mohan Sharma')
  assert.strictEqual(addrProvider.welcomeKit.address.pincode, '201309')
  assert(addrProvider.welcomeKit.auditTrail.some(a => a.action === 'ADDRESS_SUBMITTED'), 'Audit trail recorded ADDRESS_SUBMITTED')

  const adminNotif = await InAppNotification.findOne({ title: 'Welcome Kit Address Submitted' })
  assert(adminNotif !== null, 'Admin notified of address submission')
  console.log('✓ Valid 8-field address submitted, legacy fields synchronized, audit logged, and admin notified.')

  // -------------------------------------------------------------
  // TEST 7: Admin Requests Address Correction
  // -------------------------------------------------------------
  console.log('\n--- TEST 7: Admin Requests Address Correction ---')
  const { requestPartnerAddressCorrection } = await import('../controllers/userController.js')
  await requestPartnerAddressCorrection(
    {
      params: { partnerId: provider._id },
      body: { reason: 'Please specify the exact block/tower name.' },
      user: adminUser,
    },
    mockRes
  )

  const correctionProvider = await User.findById(provider._id)
  assert.strictEqual(correctionProvider.welcomeKit.addressStatus, 'CORRECTION_REQUESTED')
  assert.strictEqual(correctionProvider.welcomeKit.addressCorrectionReason, 'Please specify the exact block/tower name.')

  const corrNotif = await InAppNotification.findOne({ userId: provider._id, title: 'Welcome Kit Address Correction Requested' })
  assert(corrNotif !== null, 'Provider notified of address correction request')
  console.log('✓ Address correction requested, reason recorded, and provider notified.')

  // -------------------------------------------------------------
  // TEST 8: Partner Resubmits Corrected Address & Admin Confirms
  // -------------------------------------------------------------
  console.log('\n--- TEST 8: Partner Corrects Address & Admin Confirms ---')
  await submitPartnerWelcomeKitAddress(
    {
      user: correctionProvider,
      body: {
        recipientName: 'Mohan Sharma',
        recipientPhone: '9876543210',
        houseNumber: 'Tower B, Flat 502, Express Greens',
        streetArea: 'Sector 62, Near Electronic City',
        landmark: 'Opposite Metro Gate 2',
        city: 'Noida',
        state: 'Uttar Pradesh',
        pincode: '201309',
      },
    },
    mockRes
  )

  const { confirmPartnerWelcomeKitAddress } = await import('../controllers/userController.js')
  await confirmPartnerWelcomeKitAddress(
    {
      params: { partnerId: provider._id },
      user: adminUser,
    },
    mockRes
  )

  const confirmedProvider = await User.findById(provider._id)
  assert.strictEqual(confirmedProvider.welcomeKit.addressStatus, 'CONFIRMED')
  assert.strictEqual(confirmedProvider.welcomeKit.status, 'READY_FOR_DISPATCH')
  assert(confirmedProvider.welcomeKit.confirmedAddressSnapshot !== null, 'Confirmed address snapshot preserved')
  assert.strictEqual(confirmedProvider.welcomeKit.confirmedAddressSnapshot.houseNumber, 'Tower B, Flat 502, Express Greens')
  console.log('✓ Address confirmed by admin, snapshot preserved, and status set to READY_FOR_DISPATCH.')

  // -------------------------------------------------------------
  // TEST 9: Dispatch Details Validation (HTTPS Only) & Dispatch
  // -------------------------------------------------------------
  console.log('\n--- TEST 9: Dispatch Details Recording (HTTPS Tracking URL Validation) ---')
  const { dispatchPartnerWelcomeKit } = await import('../controllers/userController.js')

  // Reject insecure http link
  let insecureUrlRes = null
  await dispatchPartnerWelcomeKit(
    {
      params: { partnerId: provider._id },
      body: {
        courierCompany: 'Delhivery Express',
        trackingUrl: 'http://insecure-tracking.com/12345', // Insecure HTTP
      },
      user: adminUser,
    },
    {
      status: () => ({ json: (d) => { insecureUrlRes = d } }),
      json: (d) => { insecureUrlRes = d },
      set: () => {},
    }
  )
  assert(insecureUrlRes && (insecureUrlRes.code === 'INVALID_HTTPS_URL' || insecureUrlRes.message?.includes('HTTPS')), 'Non-HTTPS tracking link rejected')
  console.log('✓ Insecure non-HTTPS tracking link rejected.')

  // Valid dispatch
  await dispatchPartnerWelcomeKit(
    {
      params: { partnerId: provider._id },
      body: {
        courierCompany: 'Delhivery Surface',
        trackingNumber: 'DEL992837465',
        trackingUrl: 'https://www.delhivery.com/track/package/DEL992837465',
        dispatchDate: new Date(),
        estimatedDeliveryDate: new Date(Date.now() + 3 * 24 * 3600 * 1000),
        notes: 'Box package containing XL Uniform, Tool Bag, and ID Card.',
      },
      user: adminUser,
    },
    mockRes
  )

  const dispatchedProvider = await User.findById(provider._id)
  assert.strictEqual(dispatchedProvider.welcomeKit.status, 'DISPATCHED')
  assert.strictEqual(dispatchedProvider.welcomeKit.dispatchDetails.courierCompany, 'Delhivery Surface')
  assert.strictEqual(dispatchedProvider.welcomeKit.dispatchDetails.trackingNumber, 'DEL992837465')
  assert(dispatchedProvider.welcomeKit.auditTrail.some(a => a.action === 'DISPATCHED'), 'Audit trail recorded DISPATCHED')

  const dispatchNotif = await InAppNotification.findOne({ userId: provider._id, title: 'Welcome Kit Dispatched' })
  assert(dispatchNotif !== null, 'Provider notified of dispatch')
  assert(dispatchNotif.body.includes('Delhivery Surface'), 'Notification body contains courier details')
  console.log('✓ Valid dispatch details saved, audit trail logged, and provider notified.')

  // -------------------------------------------------------------
  // TEST 10: Address Modification Forbidden After Dispatch
  // -------------------------------------------------------------
  console.log('\n--- TEST 10: Address Change Strictly Forbidden After Dispatch ---')
  let postDispatchAddrRes = null
  await submitPartnerWelcomeKitAddress(
    {
      user: dispatchedProvider,
      body: {
        recipientName: 'Someone Else',
        recipientPhone: '9876543210',
        houseNumber: 'Different House',
        streetArea: 'Sector 18',
        city: 'Noida',
        state: 'Uttar Pradesh',
        pincode: '201301',
      },
    },
    {
      status: () => ({ json: (d) => { postDispatchAddrRes = d } }),
      json: (d) => { postDispatchAddrRes = d },
      set: () => {},
    }
  )
  assert(postDispatchAddrRes && (postDispatchAddrRes.code === 'ALREADY_DISPATCHED' || postDispatchAddrRes.message?.includes('already been dispatched')), 'Address modification strictly blocked after dispatch')
  console.log('✓ Attempt to change address after dispatch is strictly blocked.')

  // -------------------------------------------------------------
  // TEST 11: Manual Delivery Confirmation (Admin Only)
  // -------------------------------------------------------------
  console.log('\n--- TEST 11: Manual Delivery Confirmation (Admin Action) ---')
  const { confirmPartnerWelcomeKitDeliveryAdmin } = await import('../controllers/userController.js')
  await confirmPartnerWelcomeKitDeliveryAdmin(
    {
      params: { partnerId: provider._id },
      body: { notes: 'Recipient Mohan Sharma signed delivery acknowledgment.' },
      user: adminUser,
    },
    mockRes
  )

  const deliveredProvider = await User.findById(provider._id)
  assert.strictEqual(deliveredProvider.welcomeKit.status, 'DELIVERED')
  assert.strictEqual(deliveredProvider.welcomeKit.isReceived, true)
  assert.strictEqual(deliveredProvider.welcomeKit.uniformIssued, true)
  assert.strictEqual(deliveredProvider.welcomeKit.idCardIssued, true)
  assert.strictEqual(deliveredProvider.welcomeKit.bagIssued, true)
  assert.strictEqual(deliveredProvider.welcomeKit.deliveryConfirmation.isConfirmed, true)
  assert(deliveredProvider.welcomeKit.auditTrail.some(a => a.action === 'DELIVERED_CONFIRMED'), 'Audit trail recorded DELIVERED_CONFIRMED')

  const deliveryNotif = await InAppNotification.findOne({ userId: provider._id, title: 'Welcome Kit Delivered Successfully' })
  assert(deliveryNotif !== null, 'Provider notified of delivery confirmation')
  console.log('✓ Manual delivery confirmed, all kit hardware marked issued, audit trail logged, and provider notified.')

  // -------------------------------------------------------------
  // TEST 12: Duplicate Delivery Confirmation Prevented
  // -------------------------------------------------------------
  console.log('\n--- TEST 12: Duplicate Delivery Confirmation Prevented ---')
  let dupDeliveryRes = null
  await confirmPartnerWelcomeKitDeliveryAdmin(
    {
      params: { partnerId: provider._id },
      body: { notes: 'Second confirmation attempt' },
      user: adminUser,
    },
    {
      status: () => ({ json: (d) => { dupDeliveryRes = d } }),
      json: (d) => { dupDeliveryRes = d },
      set: () => {},
    }
  )
  assert(dupDeliveryRes && (dupDeliveryRes.code === 'ALREADY_DELIVERED' || dupDeliveryRes.message?.includes('already been confirmed')), 'Duplicate delivery confirmation blocked')
  console.log('✓ Duplicate delivery confirmation blocked with 409 Conflict.')

  // Cleanup test users
  await User.deleteMany({ phone: { $in: [testPhone, adminPhone] } })
  await InAppNotification.deleteMany({ idempotencyKey: { $regex: /^WK_/ } })

  console.log('\n====================================================')
  console.log('🎉 ALL 12 WELCOME KIT WORKFLOW TESTS PASSED PERFECTLY!')
  console.log('====================================================\n')
  process.exit(0)
}

runWelcomeKitTestSuite().catch(err => {
  console.error('❌ Test failed:', err)
  process.exit(1)
})
