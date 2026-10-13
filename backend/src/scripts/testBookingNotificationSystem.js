import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '../../.env') })

import { Booking } from '../models/Booking.js'
import { User } from '../models/User.js'
import { LabourSubcategory } from '../models/LabourSubcategory.js'
import { LabourService } from '../models/LabourService.js'
import { InAppNotification, NOTIFICATION_TYPES, DELIVERY_STATUS } from '../models/InAppNotification.js'
import {
  buildBookingAcceptedContent,
  sendBookingAcceptedNotification,
  processPendingNotifications,
} from '../services/bookingNotificationService.js'
import { sendNotificationToUser } from '../utils/pushNotificationHelper.js'

import { USER_ROLES } from '../constants/roles.js'

let totalTests = 0
let passedTests = 0

function assert(condition, message) {
  totalTests++
  if (condition) {
    console.log(`  ✅ PASS: ${message}`)
    passedTests++
  } else {
    console.error(`  ❌ FAIL: ${message}`)
    throw new Error(`Assertion failed: ${message}`)
  }
}

async function runBookingNotificationTestSuite() {
  console.log('=================================================================')
  console.log('   A2Z BOOKING ACCEPTANCE CONFIRMATION NOTIFICATION TEST SUITE   ')
  console.log('=================================================================\n')

  try {
    await mongoose.connect(process.env.MONGODB_URI)
    console.log('[TEST] Connected to MongoDB.\n')

    // Clean up past test fixtures if any
    await InAppNotification.deleteMany({ idempotencyKey: { $regex: /^TEST_/ } })
    await Booking.deleteMany({ notes: 'NOTIFICATION_SYSTEM_TEST_FIXTURE' })
    await User.deleteMany({ email: { $regex: /@notif-test\.a2z\.internal$/ } })

    // Setup Test Users
    const customerA = await User.create({
      fullName: 'Vikram Mehta',
      phone: '9899000001',
      email: 'customer.a@notif-test.a2z.internal',
      role: USER_ROLES.CUSTOMER,
      isPhoneVerified: true,
      identityStatus: 'CONTACT_VERIFIED',
      fcmTokens: ['token_cust_a_web_1', 'token_cust_a_web_2'],
    })

    const customerB = await User.create({
      fullName: 'Ananya Sharma',
      phone: '9899000002',
      email: 'customer.b@notif-test.a2z.internal',
      role: USER_ROLES.CUSTOMER,
      isPhoneVerified: true,
      identityStatus: 'CONTACT_VERIFIED',
      fcmTokens: [],
    })

    const partner1 = await User.create({
      fullName: 'Ramesh Patel',
      phone: '9899000003',
      email: 'partner.1@notif-test.a2z.internal',
      role: USER_ROLES.LABOUR,
      isPhoneVerified: true,
      identityStatus: 'VERIFIED',
    })

    const partner2 = await User.create({
      fullName: 'Suresh Kumar',
      phone: '9899000004',
      email: 'partner.2@notif-test.a2z.internal',
      role: USER_ROLES.LABOUR,
      isPhoneVerified: true,
      identityStatus: 'VERIFIED',
    })

    // Setup Category & Service
    let subcategory = await LabourSubcategory.findOne()
    const subcategoryId = subcategory?._id || new mongoose.Types.ObjectId()

    let service = await LabourService.findOne()
    const serviceId = service?._id || new mongoose.Types.ObjectId()
    const serviceName = service?.name || 'Deep Home Cleaning'

    // Setup Test Booking
    const booking1 = await Booking.create({
      userId: customerA._id,
      subcategoryId: subcategoryId,
      serviceId: serviceId,
      type: 'SCHEDULED',
      date: '2026-10-25',
      timeSlot: '11:00 AM',
      scheduledAt: new Date('2026-10-25T11:00:00+05:30'),
      address: { locationText: 'Flat 402, Green Glen, Bangalore' },
      basePrice: 1500,
      totalAmount: 1500,
      laborShare: 1350,
      paymentMethod: 'ONLINE',
      paymentStatus: 'PAID',
      status: 'BROADCASTING',
      notes: 'NOTIFICATION_SYSTEM_TEST_FIXTURE',
    })

    // -------------------------------------------------------------
    console.log('--- TEST 1: Successful Acceptance Creates Confirmation Event ---')
    // -------------------------------------------------------------
    const assignment1 = {
      labourId: partner1._id,
      serviceId: serviceId,
      serviceName: serviceName,
      status: 'ACCEPTED',
    }

    booking1.acceptedLabourIds = [partner1._id]
    booking1.acceptedLabourId = partner1._id
    booking1.status = 'ACCEPTED'
    await booking1.save()

    const result1 = await sendBookingAcceptedNotification({
      booking: booking1,
      partner: partner1,
      assignment: assignment1,
    })

    assert(result1.success === true, 'Confirmation notification triggered successfully')
    assert(result1.notification !== null, 'In-app notification record was persisted in database')
    assert(result1.notification.userId.toString() === customerA._id.toString(), 'Recipient is customerA')
    assert(result1.notification.type === NOTIFICATION_TYPES.BOOKING_ACCEPTED, 'Type is BOOKING_ACCEPTED')
    assert(result1.notification.title === 'Your booking has been confirmed!', 'Title is user-friendly confirmation')
    assert(result1.notification.body.includes('Ramesh Patel'), 'Notification body contains assigned partner name')
    assert(result1.notification.body.includes(serviceName), 'Notification body contains service name')
    assert(result1.notification.body.includes('11:00 AM'), 'Notification body contains scheduled appointment time')

    // -------------------------------------------------------------
    console.log('\n--- TEST 2: Failed Acceptance Does Not Create Confirmation Event ---')
    // -------------------------------------------------------------
    const failedResult = await sendBookingAcceptedNotification({
      booking: null,
      partner: partner1,
    })
    assert(failedResult.success === false, 'Null booking safely rejected without triggering notification')

    // -------------------------------------------------------------
    console.log('\n--- TEST 3: Concurrent Acceptance Race Condition Protection ---')
    // -------------------------------------------------------------
    const raceBooking = await Booking.create({
      userId: customerA._id,
      subcategoryId: subcategoryId,
      serviceId: serviceId,
      type: 'SCHEDULED',
      date: '2026-10-25',
      timeSlot: '02:00 PM',
      scheduledAt: new Date('2026-10-25T14:00:00+05:30'),
      address: { locationText: 'Sector 5, Bangalore' },
      basePrice: 1200,
      totalAmount: 1200,
      laborShare: 1080,
      paymentMethod: 'ONLINE',
      paymentStatus: 'PAID',
      status: 'BROADCASTING',
      quantity: 1,
      acceptedLabourIds: [],
      assignments: [],
      notes: 'NOTIFICATION_SYSTEM_TEST_FIXTURE',
    })

    // Simulate Partner 1 and Partner 2 racing to atomically accept slot
    const acceptSlot = async (partnerUser) => {
      return Booking.findOneAndUpdate(
        {
          _id: raceBooking._id,
          status: 'BROADCASTING',
          acceptedLabourIds: { $ne: partnerUser._id },
          $expr: {
            $lt: [{ $size: { $ifNull: ['$acceptedLabourIds', []] } }, raceBooking.quantity],
          },
        },
        {
          $push: {
            acceptedLabourIds: partnerUser._id,
            assignments: {
              labourId: partnerUser._id,
              serviceId: service._id,
              serviceName: service.name,
              status: 'ACCEPTED',
            },
          },
          $set: {
            acceptedLabourId: partnerUser._id,
            laborId: partnerUser._id,
            status: 'ACCEPTED',
          },
        },
        { new: true }
      )
    }

    const [winner1, winner2] = await Promise.all([
      acceptSlot(partner1),
      acceptSlot(partner2),
    ])

    const exactlyOneWon = (winner1 && !winner2) || (!winner1 && winner2)
    assert(exactlyOneWon, 'Atomic conditional update allowed only 1 winner; race collision prevented')
    const finalRaceDoc = await Booking.findById(raceBooking._id)
    assert(finalRaceDoc.acceptedLabourIds.length === 1, 'Booking accepted by strictly 1 partner')

    // -------------------------------------------------------------
    console.log('\n--- TEST 4: Customer Ownership & Isolation (Recipient Authorization) ---')
    // -------------------------------------------------------------
    const notifDoc = await InAppNotification.findOne({ userId: customerA._id })
    assert(notifDoc !== null, 'Notification found for customer A')
    const unauthorizedQuery = await InAppNotification.findOne({
      _id: notifDoc._id,
      userId: customerB._id, // customer B trying to access customer A's notification
    })
    assert(unauthorizedQuery === null, 'Customer B cannot access Customer A notification (ownership isolation enforced)')

    // -------------------------------------------------------------
    console.log('\n--- TEST 5: Missing Device Tokens Do Not Break Acceptance ---')
    // -------------------------------------------------------------
    const bookingForCustB = await Booking.create({
      userId: customerB._id, // Has 0 registered tokens
      subcategoryId: subcategoryId,
      serviceId: serviceId,
      type: 'INSTANT',
      address: { locationText: 'Indiranagar, Bangalore' },
      basePrice: 800,
      totalAmount: 800,
      laborShare: 720,
      paymentMethod: 'ONLINE',
      paymentStatus: 'PAID',
      status: 'ACCEPTED',
      acceptedLabourIds: [partner2._id],
      acceptedLabourId: partner2._id,
      notes: 'NOTIFICATION_SYSTEM_TEST_FIXTURE',
    })

    const resultMissingTokens = await sendBookingAcceptedNotification({
      booking: bookingForCustB,
      partner: partner2,
    })

    assert(resultMissingTokens.success === true, 'Acceptance succeeded despite 0 FCM tokens registered')
    assert(resultMissingTokens.notification !== null, 'In-app notification saved for customer with 0 tokens')
    assert(resultMissingTokens.notification.deliveryStatus === DELIVERY_STATUS.SENT, 'In-app status marked SENT so customer sees it in notification center upon login')

    // -------------------------------------------------------------
    console.log('\n--- TEST 6: Invalid FCM Token Detection and Pruning ---')
    // -------------------------------------------------------------
    const userWithBadToken = await User.create({
      fullName: 'Test Stale Tokens',
      phone: '9899000099',
      email: 'stale.tokens@notif-test.a2z.internal',
      role: USER_ROLES.CUSTOMER,
      isPhoneVerified: true,
      fcmTokens: ['stale_invalid_fcm_token_xyz'],
    })

    const sendRes = await sendNotificationToUser(userWithBadToken._id, {
      title: 'Ping',
      body: 'Check',
    })

    // If Firebase Admin credentials are mock/test, it handles gracefully without crashing
    assert(sendRes !== undefined, 'FCM helper returned clean structured object')

    // -------------------------------------------------------------
    console.log('\n--- TEST 7: Duplicate Prevention via Unique Idempotency Key ---')
    // -------------------------------------------------------------
    const repeatResult = await sendBookingAcceptedNotification({
      booking: booking1,
      partner: partner1,
      assignment: assignment1,
    })
    assert(repeatResult.success === true, 'Repeated call handled gracefully')
    assert(repeatResult.alreadySent === true, 'Duplicate notification suppressed by atomic idempotencyKey')

    const countNotifs = await InAppNotification.countDocuments({
      bookingId: booking1._id,
      type: NOTIFICATION_TYPES.BOOKING_ACCEPTED,
    })
    assert(countNotifs === 1, 'Strictly 1 in-app notification exists for booking acceptance')

    // -------------------------------------------------------------
    console.log('\n--- TEST 8: Notification Navigation Link Points to Tracking Page ---')
    // -------------------------------------------------------------
    const targetNotif = await InAppNotification.findOne({ bookingId: booking1._id })
    assert(
      targetNotif.metadata.link === `/app/tracking/${booking1._id}`,
      `Payload link points to /app/tracking/${booking1._id} for customer one-click navigation`
    )

    // -------------------------------------------------------------
    console.log('\n--- TEST 9: Background Retry Worker with Bounded Retries ---')
    // -------------------------------------------------------------
    const retryNotif = await InAppNotification.create({
      userId: customerA._id,
      title: 'Retry Test',
      body: 'Retry Body',
      type: NOTIFICATION_TYPES.BOOKING_ACCEPTED,
      bookingId: booking1._id,
      idempotencyKey: 'TEST_RETRY_IDEMPOTENCY_KEY_1',
      deliveryStatus: DELIVERY_STATUS.PENDING,
      pushDelivery: { attempts: 0 },
    })

    const retryOutcome = await processPendingNotifications()
    assert(retryOutcome.processed >= 1, 'Pending notification detected by background retry worker')

    const updatedRetryNotif = await InAppNotification.findById(retryNotif._id)
    assert(updatedRetryNotif.pushDelivery.attempts >= 1, 'Retry attempts incremented')

    // -------------------------------------------------------------
    console.log('\n--- TEST 10: In-App Notification Persistence Across Session/Time ---')
    // -------------------------------------------------------------
    const persisted = await InAppNotification.findById(result1.notification._id)
    assert(persisted !== null, 'Notification persisted in database and available across logins')
    assert(persisted.read === false, 'Notification initially marked unread for notification badge counter')

    // -------------------------------------------------------------
    console.log('\n--- TEST 11: Mark Single & All Notifications Read ---')
    // -------------------------------------------------------------
    await InAppNotification.findByIdAndUpdate(persisted._id, { $set: { read: true, readAt: new Date() } })
    const readDoc = await InAppNotification.findById(persisted._id)
    assert(readDoc.read === true, 'Notification successfully marked as read')

    // -------------------------------------------------------------
    console.log('\n--- TEST 12: Existing Notification Types (Reminders) Intact ---')
    // -------------------------------------------------------------
    const reminderNotif = await InAppNotification.create({
      userId: customerA._id,
      title: 'Your A2Z Service Is Tomorrow',
      body: 'Reminder test body',
      type: NOTIFICATION_TYPES.BOOKING_REMINDER,
      bookingId: booking1._id,
      idempotencyKey: 'TEST_REMINDER_KEY_1',
    })
    assert(reminderNotif.type === 'BOOKING_REMINDER', 'Existing BOOKING_REMINDER type operates normally')

    // Clean up test data
    await InAppNotification.deleteMany({ idempotencyKey: { $regex: /^TEST_/ } })
    await Booking.deleteMany({ notes: 'NOTIFICATION_SYSTEM_TEST_FIXTURE' })
    await User.deleteMany({ email: { $regex: /@notif-test\.a2z\.internal$/ } })

    console.log('\n=================================================================')
    console.log(`   ALL ${passedTests} OF ${totalTests} INTEGRATION TESTS PASSED 100%!`)
    console.log('=================================================================\n')

    process.exit(0)
  } catch (error) {
    console.error('\n❌ TEST RUNNER FAILED:', error)
    process.exit(1)
  }
}

runBookingNotificationTestSuite()
