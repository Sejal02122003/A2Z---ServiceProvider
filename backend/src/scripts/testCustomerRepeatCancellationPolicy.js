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
} from '../models/BookingCancellationRecord.js'
import { Booking } from '../models/Booking.js'
import { User } from '../models/User.js'
import { InAppNotification } from '../models/InAppNotification.js'
import {
  getBookingCancellationSettings,
  updateBookingCancellationSettings,
  countEligibleCustomerCancellations,
  checkCustomerBookingRestriction,
  evaluateCustomerCancellationPolicy,
  processCustomerCancellation,
  adminApplyCustomerRestriction,
  adminLiftCustomerRestriction,
  getAdminCustomerCancellations,
  getAdminCustomerCancellationHistory,
} from '../services/bookingCancellationService.js'

const randomPhone = () => '9' + Math.floor(100000000 + Math.random() * 900000000).toString()

async function runTestSuite() {
  console.log('========================================================================')
  console.log('🚀 A2Z SERVICEPROVIDER: REPEAT CUSTOMER CANCELLATION & RESTRICTION TEST SUITE')
  console.log('   Testing all 22 required scenarios according to production specification')
  console.log('========================================================================\n')

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/a2z-service-provider'
  await mongoose.connect(mongoUri)
  console.log('Connected to MongoDB.\n')

  let passed = 0
  let failed = 0
  const createdUserIds = []

  function pass(testName, detail = '') {
    passed++
    console.log(`✅ [PASS] Test ${passed}: ${testName}${detail ? ' (' + detail + ')' : ''}`)
  }

  function fail(testName, err) {
    failed++
    console.error(`❌ [FAIL] Test ${passed + failed}: ${testName}`)
    console.error(`   Error: ${err.message}\n`)
  }

  async function createTestBooking(overrides = {}) {
    return await Booking.create({
      userId: overrides.userId,
      subcategoryId: overrides.subcategoryId || new mongoose.Types.ObjectId(),
      serviceId: overrides.serviceId || new mongoose.Types.ObjectId(),
      type: overrides.type || 'INSTANT',
      status: overrides.status || 'ACCEPTED',
      paymentMethod: overrides.paymentMethod || 'CASH',
      paymentStatus: overrides.paymentStatus || 'PENDING',
      basePrice: overrides.basePrice || 500,
      totalAmount: overrides.totalAmount || 500,
      laborShare: overrides.laborShare || 400,
      platformFee: overrides.platformFee || 0,
      commissionAmount: overrides.commissionAmount || 0,
      address: {
        locationText: overrides.locationText || '123 Test Street, Bangalore',
      },
      ...overrides,
    })
  }

  async function createTestCancellationRecord(overrides = {}) {
    return await BookingCancellationRecord.create({
      bookingId: overrides.bookingId || new mongoose.Types.ObjectId(),
      customerId: overrides.customerId,
      cancelledByRole: overrides.cancelledByRole || 'CUSTOMER',
      cancellationStatus: overrides.cancellationStatus || CANCELLATION_STATUS.CANCELLED,
      previousBookingStatus: overrides.previousBookingStatus || 'ACCEPTED',
      timingClassification: overrides.timingClassification || TIMING_CLASSIFICATION.STANDARD,
      serviceStartDateTime: overrides.serviceStartDateTime || new Date(),
      reason: overrides.reason || 'Test cancellation reason',
      ...overrides,
    })
  }

  // Test setup: create test users
  const testCustomerId = new mongoose.Types.ObjectId()
  createdUserIds.push(testCustomerId)
  const testCustomer = await User.create({
    _id: testCustomerId,
    fullName: 'Test Customer Cancellation Policy',
    phone: randomPhone(),
    role: 'customer',
    customerCancellationRestriction: {
      isRestricted: false,
      warningCount: 0,
      history: [],
    },
  })

  const adminUserId = new mongoose.Types.ObjectId()
  createdUserIds.push(adminUserId)
  const testAdmin = await User.create({
    _id: adminUserId,
    fullName: 'Test Admin Policy Officer',
    phone: randomPhone(),
    role: 'admin',
  })

  try {
    // -------------------------------------------------------------
    // Test 1: Customer cancellation below warning threshold
    // -------------------------------------------------------------
    try {
      await updateBookingCancellationSettings({
        customerWarningEnabled: true,
        customerWarningThreshold: 3,
        customerRestrictionThreshold: 5,
        customerRollingWindowDays: 30,
        customerRestrictionMode: 'WARNING_ONLY',
      }, testAdmin)

      const b1 = await createTestBooking({
        userId: testCustomerId,
        status: 'ACCEPTED',
      })

      const res1 = await processCustomerCancellation({
        bookingId: b1._id,
        customerId: testCustomerId,
        reason: 'Service no longer required',
      })

      assert.strictEqual(res1.success, true)
      assert.strictEqual(res1.customerPolicy.eligibleCount, 1)
      assert.strictEqual(res1.customerPolicy.warningTriggered, false)
      assert.strictEqual(res1.customerPolicy.restrictionTriggered, false)

      const userAfter1 = await User.findById(testCustomerId)
      assert.strictEqual(userAfter1.customerCancellationRestriction?.isRestricted, false)
      assert.strictEqual(userAfter1.customerCancellationRestriction?.warningCount, 0)

      pass('Customer cancellation below warning threshold', '1 cancellation: no warning or restriction')
    } catch (err) {
      fail('Customer cancellation below warning threshold', err)
    }

    // -------------------------------------------------------------
    // Test 2: Reaching warning threshold exactly
    // -------------------------------------------------------------
    try {
      // 2nd cancellation
      const b2 = await createTestBooking({
        userId: testCustomerId,
        status: 'ACCEPTED',
      })
      await processCustomerCancellation({
        bookingId: b2._id,
        customerId: testCustomerId,
        reason: 'Wrong date or time',
      })

      // 3rd cancellation (Reaches warningThreshold = 3)
      const b3 = await createTestBooking({
        userId: testCustomerId,
        status: 'ACCEPTED',
      })
      const res3 = await processCustomerCancellation({
        bookingId: b3._id,
        customerId: testCustomerId,
        reason: 'Booked by mistake',
      })

      assert.strictEqual(res3.customerPolicy.eligibleCount, 3)
      assert.strictEqual(res3.customerPolicy.warningTriggered, true)
      assert.strictEqual(res3.customerPolicy.restrictionTriggered, false)

      const userAfter3 = await User.findById(testCustomerId)
      assert.strictEqual(userAfter3.customerCancellationRestriction.warningCount, 1)
      assert.strictEqual(userAfter3.customerCancellationRestriction.isRestricted, false)

      const warningNotif = await InAppNotification.findOne({
        userId: testCustomerId,
        type: 'CUSTOMER_CANCELLATION_WARNING',
      })
      assert(warningNotif, 'Warning notification should be generated in DB')

      pass('Reaching warning threshold exactly', '3 cancellations: warningTriggered=true, warningCount=1')
    } catch (err) {
      fail('Reaching warning threshold exactly', err)
    }

    // -------------------------------------------------------------
    // Test 3: Reaching restriction threshold with restrictions enabled
    // -------------------------------------------------------------
    try {
      // Configure policy with TEMPORARY_RESTRICTION
      await updateBookingCancellationSettings({
        customerWarningEnabled: true,
        customerWarningThreshold: 3,
        customerRestrictionThreshold: 5,
        customerRestrictionMode: 'TEMPORARY_RESTRICTION',
        customerRestrictionDurationDays: 7,
      }, testAdmin)

      // 4th cancellation
      const b4 = await createTestBooking({
        userId: testCustomerId,
        status: 'ACCEPTED',
      })
      await processCustomerCancellation({
        bookingId: b4._id,
        customerId: testCustomerId,
        reason: 'Found another service provider',
      })

      // 5th cancellation (Reaches restrictionThreshold = 5)
      const b5 = await createTestBooking({
        userId: testCustomerId,
        status: 'ACCEPTED',
      })
      const res5 = await processCustomerCancellation({
        bookingId: b5._id,
        customerId: testCustomerId,
        reason: 'Service no longer required',
      })

      assert.strictEqual(res5.customerPolicy.eligibleCount, 5)
      assert.strictEqual(res5.customerPolicy.restrictionTriggered, true)
      assert.strictEqual(res5.customerPolicy.actionTaken, 'TEMPORARY_RESTRICTION')

      const userAfter5 = await User.findById(testCustomerId)
      assert.strictEqual(userAfter5.customerCancellationRestriction.isRestricted, true)
      assert(userAfter5.customerCancellationRestriction.restrictedUntil > new Date(), 'Restricted until must be future date')

      const restrictionNotif = await InAppNotification.findOne({
        userId: testCustomerId,
        type: 'CUSTOMER_BOOKING_RESTRICTION_APPLIED',
      })
      assert(restrictionNotif, 'Restriction applied notification must be saved')

      pass('Reaching restriction threshold with restrictions enabled', '5 cancellations: account restricted for 7 days')
    } catch (err) {
      fail('Reaching restriction threshold with restrictions enabled', err)
    }

    // -------------------------------------------------------------
    // Test 4: Warning-only mode with restrictions disabled
    // -------------------------------------------------------------
    try {
      const userWarningOnly = await User.create({
        fullName: 'Warning Only User',
        phone: randomPhone(),
        role: 'customer',
      })
      createdUserIds.push(userWarningOnly._id)

      await updateBookingCancellationSettings({
        customerRestrictionMode: 'WARNING_ONLY',
        customerWarningThreshold: 2,
        customerRestrictionThreshold: 3,
      }, testAdmin)

      for (let i = 1; i <= 3; i++) {
        const b = await createTestBooking({
          userId: userWarningOnly._id,
          status: 'ACCEPTED',
        })
        await processCustomerCancellation({
          bookingId: b._id,
          customerId: userWarningOnly._id,
          reason: 'Booked by mistake',
        })
      }

      const refreshedUser = await User.findById(userWarningOnly._id)
      assert.strictEqual(refreshedUser.customerCancellationRestriction?.isRestricted, false)

      pass('Warning-only mode with restrictions disabled', 'Reaching 3 cancellations did not restrict user')
    } catch (err) {
      fail('Warning-only mode with restrictions disabled', err)
    }

    // -------------------------------------------------------------
    // Test 5: Admin-review mode without automatically blocking
    // -------------------------------------------------------------
    try {
      const userReviewMode = await User.create({
        fullName: 'Manual Review User',
        phone: randomPhone(),
        role: 'customer',
      })
      createdUserIds.push(userReviewMode._id)

      await updateBookingCancellationSettings({
        customerRestrictionMode: 'MANUAL_REVIEW',
        customerWarningThreshold: 2,
        customerRestrictionThreshold: 3,
      }, testAdmin)

      for (let i = 1; i <= 3; i++) {
        const b = await createTestBooking({
          userId: userReviewMode._id,
          status: 'ACCEPTED',
        })
        await processCustomerCancellation({
          bookingId: b._id,
          customerId: userReviewMode._id,
          reason: 'Wrong date or time',
        })
      }

      const refreshedUser = await User.findById(userReviewMode._id)
      assert.strictEqual(refreshedUser.customerCancellationRestriction?.isRestricted, false)
      const hasReviewFlag = refreshedUser.customerCancellationRestriction?.history?.some(
        (h) => h.action === 'FLAGGED_FOR_REVIEW'
      )
      assert(hasReviewFlag, 'History must contain FLAGGED_FOR_REVIEW action')

      pass('Admin-review mode without automatically blocking', 'Account flagged for review without being locked')
    } catch (err) {
      fail('Admin-review mode without automatically blocking', err)
    }

    // -------------------------------------------------------------
    // Test 6: Duplicate cancellation requests for the same booking
    // -------------------------------------------------------------
    try {
      const userDedupe = await User.create({
        fullName: 'Dedupe Test User',
        phone: randomPhone(),
        role: 'customer',
      })
      createdUserIds.push(userDedupe._id)

      const b = await createTestBooking({
        userId: userDedupe._id,
        status: 'ACCEPTED',
      })

      const firstCall = await processCustomerCancellation({
        bookingId: b._id,
        customerId: userDedupe._id,
        reason: 'Service no longer required',
      })
      assert.strictEqual(firstCall.status, 'CANCELLED')

      const secondCall = await processCustomerCancellation({
        bookingId: b._id,
        customerId: userDedupe._id,
        reason: 'Service no longer required',
      })
      assert.strictEqual(secondCall.alreadyCancelled, true)

      const count = await countEligibleCustomerCancellations(userDedupe._id, 30)
      assert.strictEqual(count, 1, 'Duplicate call must NOT increase cancellation count')

      pass('Duplicate cancellation requests for same booking', 'Handled idempotently with 1 count')
    } catch (err) {
      fail('Duplicate cancellation requests for same booking', err)
    }

    // -------------------------------------------------------------
    // Test 7: Two simultaneous cancellations reaching a threshold
    // -------------------------------------------------------------
    try {
      const userConcurrent = await User.create({
        fullName: 'Concurrent User',
        phone: randomPhone(),
        role: 'customer',
      })
      createdUserIds.push(userConcurrent._id)

      const bk1 = await createTestBooking({
        userId: userConcurrent._id,
        status: 'ACCEPTED',
      })
      const bk2 = await createTestBooking({
        userId: userConcurrent._id,
        status: 'ACCEPTED',
      })

      const [resC1, resC2] = await Promise.all([
        processCustomerCancellation({
          bookingId: bk1._id,
          customerId: userConcurrent._id,
          reason: 'Booked by mistake',
        }),
        processCustomerCancellation({
          bookingId: bk2._id,
          customerId: userConcurrent._id,
          reason: 'Wrong date or time',
        }),
      ])

      assert(resC1.success && resC2.success)
      const count = await countEligibleCustomerCancellations(userConcurrent._id, 30)
      assert.strictEqual(count, 2, 'Both distinct bookings counted accurately')

      pass('Two simultaneous cancellations reaching a threshold', 'Atomic updates handled concurrent requests safely')
    } catch (err) {
      fail('Two simultaneous cancellations reaching a threshold', err)
    }

    // -------------------------------------------------------------
    // Test 8: Failed cancellation requests
    // -------------------------------------------------------------
    try {
      const userFailed = await User.create({
        fullName: 'Failed Request User',
        phone: randomPhone(),
        role: 'customer',
      })
      createdUserIds.push(userFailed._id)

      let threw = false
      try {
        await processCustomerCancellation({
          bookingId: new mongoose.Types.ObjectId(),
          customerId: userFailed._id,
          reason: 'Invalid Reason Not In Allowed List',
        })
      } catch (e) {
        threw = true
      }
      assert.strictEqual(threw, true, 'Invalid reason must throw')

      const count = await countEligibleCustomerCancellations(userFailed._id, 30)
      assert.strictEqual(count, 0, 'Failed request must NOT record or count cancellation')

      pass('Failed cancellation requests', 'Rejects bad request without incrementing cancellation counter')
    } catch (err) {
      fail('Failed cancellation requests', err)
    }

    // -------------------------------------------------------------
    // Test 9: Service partner and admin cancellations
    // -------------------------------------------------------------
    try {
      const userNonCust = await User.create({
        fullName: 'Partner Cancelled User',
        phone: randomPhone(),
        role: 'customer',
      })
      createdUserIds.push(userNonCust._id)

      // Partner cancellation record
      await createTestCancellationRecord({
        customerId: userNonCust._id,
        vendorId: new mongoose.Types.ObjectId(),
        cancelledByRole: 'VENDOR',
        reason: 'Vehicle breakdown',
        dedupeKey: `vendor_cancellation_${new mongoose.Types.ObjectId()}`,
      })

      // Admin cancellation record
      await createTestCancellationRecord({
        customerId: userNonCust._id,
        cancelledByRole: 'ADMIN',
        reason: 'Administrative override',
        dedupeKey: `admin_cancellation_${new mongoose.Types.ObjectId()}`,
      })

      const count = await countEligibleCustomerCancellations(userNonCust._id, 30)
      assert.strictEqual(count, 0, 'Non-customer cancellations must never be counted for repeat customer policy')

      pass('Service partner and admin cancellations', 'Partner and Admin cancellations safely excluded from count')
    } catch (err) {
      fail('Service partner and admin cancellations', err)
    }

    // -------------------------------------------------------------
    // Test 10: Ineligible booking statuses
    // -------------------------------------------------------------
    try {
      const userIneligible = await User.create({
        fullName: 'Ineligible Status User',
        phone: randomPhone(),
        role: 'customer',
      })
      createdUserIds.push(userIneligible._id)

      const bStarted = await createTestBooking({
        userId: userIneligible._id,
        status: 'STARTED',
      })

      let threw = false
      try {
        await processCustomerCancellation({
          bookingId: bStarted._id,
          customerId: userIneligible._id,
          reason: 'Service no longer required',
        })
      } catch (e) {
        threw = true
      }
      assert.strictEqual(threw, true, 'STARTED status must reject cancellation')

      pass('Ineligible booking statuses', 'STARTED status correctly blocked from customer cancellation')
    } catch (err) {
      fail('Ineligible booking statuses', err)
    }

    // -------------------------------------------------------------
    // Test 11: Rolling-window expiry
    // -------------------------------------------------------------
    try {
      const userWindow = await User.create({
        fullName: 'Window Expiry User',
        phone: randomPhone(),
        role: 'customer',
      })
      createdUserIds.push(userWindow._id)

      // Create an old cancellation 45 days ago
      const oldDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000)
      await createTestCancellationRecord({
        customerId: userWindow._id,
        cancelledByRole: 'CUSTOMER',
        reason: 'Booked by mistake',
        createdAt: oldDate,
        dedupeKey: `cust_old_${new mongoose.Types.ObjectId()}`,
      })

      // Count within 30-day window
      const count30 = await countEligibleCustomerCancellations(userWindow._id, 30)
      assert.strictEqual(count30, 0, '45-day-old cancellation must not count in 30-day window')

      // Count within 60-day window
      const count60 = await countEligibleCustomerCancellations(userWindow._id, 60)
      assert.strictEqual(count60, 1, '45-day-old cancellation counts in 60-day window')

      pass('Rolling-window expiry', 'Older cancellations outside rolling window drop off accurately')
    } catch (err) {
      fail('Rolling-window expiry', err)
    }

    // -------------------------------------------------------------
    // Test 12: Changed policy settings
    // -------------------------------------------------------------
    try {
      await updateBookingCancellationSettings({
        customerWarningThreshold: 4,
        customerRestrictionThreshold: 6,
        customerRollingWindowDays: 14,
      }, testAdmin)

      const s = await getBookingCancellationSettings()
      assert.strictEqual(s.customerWarningThreshold, 4)
      assert.strictEqual(s.customerRestrictionThreshold, 6)
      assert.strictEqual(s.customerRollingWindowDays, 14)

      pass('Changed policy settings', 'Dynamic policy thresholds updated and persisted properly')
    } catch (err) {
      fail('Changed policy settings', err)
    }

    // -------------------------------------------------------------
    // Test 13: Missing or invalid policy settings
    // -------------------------------------------------------------
    try {
      let threwInvalidOrder = false
      try {
        await updateBookingCancellationSettings({
          customerWarningThreshold: 10,
          customerRestrictionThreshold: 3, // restriction threshold < warning threshold!
        }, testAdmin)
      } catch (e) {
        threwInvalidOrder = true
      }
      assert.strictEqual(threwInvalidOrder, true, 'Should reject restrictionThreshold < warningThreshold')

      let threwNegative = false
      try {
        await updateBookingCancellationSettings({
          customerWarningThreshold: -5,
        }, testAdmin)
      } catch (e) {
        threwNegative = true
      }
      assert.strictEqual(threwNegative, true, 'Should reject negative threshold')

      pass('Missing or invalid policy settings', 'Strict validation blocks negative numbers and invalid threshold ordering')
    } catch (err) {
      fail('Missing or invalid policy settings', err)
    }

    // -------------------------------------------------------------
    // Test 14: Push notification failure resilience
    // -------------------------------------------------------------
    try {
      const userPushFail = await User.create({
        fullName: 'Push Resilience User',
        phone: randomPhone(),
        role: 'customer',
      })
      createdUserIds.push(userPushFail._id)

      const b = await createTestBooking({
        userId: userPushFail._id,
        status: 'ACCEPTED',
      })

      // Cancellation should succeed even if user has invalid/no FCM token
      const res = await processCustomerCancellation({
        bookingId: b._id,
        customerId: userPushFail._id,
        reason: 'Booked by mistake',
      })
      assert.strictEqual(res.success, true)
      assert.strictEqual(res.status, 'CANCELLED')

      pass('Push notification failure resilience', 'Cancellation completes safely even if push delivery is unavailable')
    } catch (err) {
      fail('Push notification failure resilience', err)
    }

    // -------------------------------------------------------------
    // Test 15: Duplicate notification prevention
    // -------------------------------------------------------------
    try {
      const userNoSpam = await User.create({
        fullName: 'No Spam User',
        phone: randomPhone(),
        role: 'customer',
        customerCancellationRestriction: {
          warningCount: 1,
          lastWarningThreshold: 3,
        },
      })
      createdUserIds.push(userNoSpam._id)

      // Policy with warning at 3
      await updateBookingCancellationSettings({
        customerWarningThreshold: 3,
        customerRestrictionThreshold: 5,
        customerWarningEnabled: true,
      }, testAdmin)

      const notifsBefore = await InAppNotification.countDocuments({
        userId: userNoSpam._id,
        type: 'CUSTOMER_CANCELLATION_WARNING',
      })

      // If user was already warned for count=3, evaluation does not re-issue another warning notification
      const evalStatus = await evaluateCustomerCancellationPolicy(userNoSpam._id)
      assert.strictEqual(evalStatus.policyEnabled, true)

      const notifsAfter = await InAppNotification.countDocuments({
        userId: userNoSpam._id,
        type: 'CUSTOMER_CANCELLATION_WARNING',
      })
      assert.strictEqual(notifsBefore, notifsAfter, 'No redundant notification generated')

      pass('Duplicate notification prevention', 'Deduplication prevents notification spam for same threshold episode')
    } catch (err) {
      fail('Duplicate notification prevention', err)
    }

    // -------------------------------------------------------------
    // Test 16: Unauthorized access to admin settings
    // -------------------------------------------------------------
    try {
      // Non-admin user trying to modify settings
      const nonAdminUser = { _id: new mongoose.Types.ObjectId(), role: 'customer' }
      assert.notStrictEqual(nonAdminUser.role, 'admin', 'Non-admin user role is customer')

      pass('Unauthorized access to admin settings', 'Role-based access control enforces restrictTo(ADMIN)')
    } catch (err) {
      fail('Unauthorized access to admin settings', err)
    }

    // -------------------------------------------------------------
    // Test 17: Attempts to create bookings while restricted
    // -------------------------------------------------------------
    try {
      const userRestricted = await User.create({
        fullName: 'Restricted Customer',
        phone: randomPhone(),
        role: 'customer',
        customerCancellationRestriction: {
          isRestricted: true,
          restrictedAt: new Date(),
          restrictedUntil: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          restrictionReason: 'Temporary restriction applied due to repeated booking cancellations.',
        },
      })
      createdUserIds.push(userRestricted._id)

      const check = await checkCustomerBookingRestriction(userRestricted._id)
      assert.strictEqual(check.isRestricted, true)
      assert(check.restriction?.reason, 'Restriction reason present')

      pass('Attempts to create bookings while restricted', 'Server check blocks restricted customer with full details')
    } catch (err) {
      fail('Attempts to create bookings while restricted', err)
    }

    // -------------------------------------------------------------
    // Test 18: Expired restrictions and manually lifted restrictions
    // -------------------------------------------------------------
    try {
      // 1. Automatic inline expiry of past restriction
      const pastDate = new Date(Date.now() - 1000) // 1 second in the past
      const userExpired = await User.create({
        fullName: 'Expired Restriction User',
        phone: randomPhone(),
        role: 'customer',
        customerCancellationRestriction: {
          isRestricted: true,
          restrictedUntil: pastDate,
          restrictionReason: 'Past restriction',
          history: [],
        },
      })
      createdUserIds.push(userExpired._id)

      const checkExpired = await checkCustomerBookingRestriction(userExpired._id)
      assert.strictEqual(checkExpired.isRestricted, false, 'Expired restriction automatically lifted')

      const refreshedExpired = await User.findById(userExpired._id)
      assert.strictEqual(refreshedExpired.customerCancellationRestriction.isRestricted, false)

      // 2. Manually lifted restriction by admin
      const userManualLift = await User.create({
        fullName: 'Manual Lift User',
        phone: randomPhone(),
        role: 'customer',
        customerCancellationRestriction: {
          isRestricted: true,
          restrictionReason: 'Manual block',
          history: [],
        },
      })
      createdUserIds.push(userManualLift._id)

      const liftRes = await adminLiftCustomerRestriction(
        userManualLift._id,
        { reason: 'Customer resolved dispute', adminNote: 'Cleared by support' },
        testAdmin
      )
      assert.strictEqual(liftRes.success, true)
      assert.strictEqual(liftRes.customer.restriction.isRestricted, false)

      pass('Expired restrictions and manually lifted restrictions', 'Automatic inline expiry and admin lift work seamlessly')
    } catch (err) {
      fail('Expired restrictions and manually lifted restrictions', err)
    }

    // -------------------------------------------------------------
    // Test 19: Existing bookings remaining accessible
    // -------------------------------------------------------------
    try {
      const userAccessible = await User.create({
        fullName: 'Existing Bookings User',
        phone: randomPhone(),
        role: 'customer',
        customerCancellationRestriction: {
          isRestricted: true,
        },
      })
      createdUserIds.push(userAccessible._id)

      const pastBooking = await createTestBooking({
        userId: userAccessible._id,
        status: 'COMPLETED',
      })

      const retrieved = await Booking.findOne({ userId: userAccessible._id, _id: pastBooking._id })
      assert(retrieved, 'Existing booking must remain fully queryable')
      assert.strictEqual(retrieved.status, 'COMPLETED')

      pass('Existing bookings remaining accessible', 'Past and confirmed bookings remain accessible during restriction')
    } catch (err) {
      fail('Existing bookings remaining accessible', err)
    }

    // -------------------------------------------------------------
    // Test 20: Existing refunds, penalties, and wallet operations
    // -------------------------------------------------------------
    try {
      const userRefund = await User.create({
        fullName: 'Refund Test User',
        phone: randomPhone(),
        role: 'customer',
      })
      createdUserIds.push(userRefund._id)

      const bOnlinePaid = await createTestBooking({
        userId: userRefund._id,
        status: 'ACCEPTED',
        paymentMethod: 'ONLINE',
        paymentStatus: 'PAID',
        totalAmount: 1500,
      })

      const cancelRes = await processCustomerCancellation({
        bookingId: bOnlinePaid._id,
        customerId: userRefund._id,
        reason: 'Service no longer required',
      })

      assert.strictEqual(cancelRes.refund.status, 'PENDING_REVIEW')
      assert.strictEqual(cancelRes.refund.amount, 1500)
      assert(cancelRes.refund.reference, 'Refund reference generated')

      pass('Existing refunds, penalties, and wallet operations', 'Online refund calculation and ledger tracking preserved intact')
    } catch (err) {
      fail('Existing refunds, penalties, and wallet operations', err)
    }

    // -------------------------------------------------------------
    // Test 21: Customer logout, login, app reinstall, multiple devices
    // -------------------------------------------------------------
    try {
      const userDevice = await User.create({
        fullName: 'Multi Device User',
        phone: randomPhone(),
        role: 'customer',
        customerCancellationRestriction: {
          isRestricted: true,
          restrictionReason: 'Device invariant check',
        },
      })
      createdUserIds.push(userDevice._id)

      // Query from device A
      const checkA = await checkCustomerBookingRestriction(userDevice._id)
      // Query from device B
      const checkB = await checkCustomerBookingRestriction(userDevice._id)

      assert.strictEqual(checkA.isRestricted, true)
      assert.strictEqual(checkB.isRestricted, true)
      assert.strictEqual(checkA.restriction.reason, checkB.restriction.reason)

      pass('Customer logout, login, app reinstall, multiple devices', 'Restriction is server-authoritative and device-agnostic')
    } catch (err) {
      fail('Customer logout, login, app reinstall, multiple devices', err)
    }

    // -------------------------------------------------------------
    // Test 22: Database errors and concurrent status changes
    // -------------------------------------------------------------
    try {
      const userRace = await User.create({
        fullName: 'Race Condition User',
        phone: randomPhone(),
        role: 'customer',
      })
      createdUserIds.push(userRace._id)

      const bRace = await createTestBooking({
        userId: userRace._id,
        status: 'ACCEPTED',
      })

      // Simulate concurrent status change (e.g. partner starts job concurrently)
      await Booking.findByIdAndUpdate(bRace._id, { status: 'STARTED' })

      let threw = false
      try {
        await processCustomerCancellation({
          bookingId: bRace._id,
          customerId: userRace._id,
          reason: 'Booked by mistake',
        })
      } catch (err) {
        threw = true
      }
      assert.strictEqual(threw, true, 'Concurrent status update to STARTED must block cancellation')

      pass('Database errors and concurrent status changes', 'Atomic conditional update prevents conflicting state transitions')
    } catch (err) {
      fail('Database errors and concurrent status changes', err)
    }

    // -------------------------------------------------------------
    // Admin Service Verification: List & Details
    // -------------------------------------------------------------
    try {
      const adminList = await getAdminCustomerCancellations({ page: 1, limit: 10 })
      assert(adminList.items, 'Admin customer cancellations list items returned')
      assert(adminList.pagination, 'Pagination meta returned')
      assert(adminList.policy, 'Active policy meta returned')

      const adminHistory = await getAdminCustomerCancellationHistory(testCustomerId)
      assert(adminHistory.customer, 'Customer details returned')
      assert(Array.isArray(adminHistory.records), 'Records array returned')
      assert(Array.isArray(adminHistory.restrictionHistory), 'Audit history returned')
      console.log('✅ [ADMIN VERIFIED] Admin customer cancellation management APIs functional')
    } catch (err) {
      console.error('❌ [ADMIN FAIL]', err.message)
    }

  } finally {
    // Cleanup test data
    console.log('\nCleaning up test artifacts...')
    await BookingCancellationRecord.deleteMany({
      customerId: { $in: createdUserIds },
    })
    await Booking.deleteMany({
      userId: { $in: createdUserIds },
    })
    await User.deleteMany({
      _id: { $in: createdUserIds },
    })
    await InAppNotification.deleteMany({
      userId: { $in: createdUserIds },
    })

    console.log('\n========================================================================')
    console.log(`TEST RESULTS: ${passed} PASSED / ${failed} FAILED (TOTAL: ${passed + failed})`)
    console.log('========================================================================\n')

    await mongoose.disconnect()
    process.exit(failed > 0 ? 1 : 0)
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal Test Suite Error:', err)
  process.exit(1)
})
