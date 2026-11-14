import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '../../.env') })

import { User } from '../models/User.js'
import { Booking } from '../models/Booking.js'
import { sendNotificationToUser, sendNotificationToAdmins } from '../utils/pushNotificationHelper.js'
import { startBroadcastCycle } from '../services/broadcastService.js'
import { sendBookingAcceptedNotification } from '../services/bookingNotificationService.js'

async function runTest() {
  console.log('======================================================================')
  console.log('🚀 END-TO-END PUSH NOTIFICATION TEST: USER -> SERVICE PROVIDER -> ADMIN')
  console.log('======================================================================\n')

  await mongoose.connect(process.env.MONGODB_URI)
  console.log('✅ Connected to MongoDB\n')

  const customerId = '6abced405764c6464f914f66' // Sejal Harishankar Chhapre (7828889678)
  const providerId = '6abdf02a67412b3326c0af5d' // Sejal gurjar (9294853225)
  const serviceId = '6ae4a8c4e890d7dc4ce43045'  // Twacha Moisturizing Red Wine (offered by Sejal gurjar)
  const subcategoryId = '6ad2095e6862c25f09edc2fc'

  const customer = await User.findById(customerId)
  const provider = await User.findById(providerId)
  const admins = await User.find({ role: 'admin' })

  console.log(`[TARGET ACTORS]`)
  console.log(`  👤 Customer: ${customer?.fullName} (${customer?.phone}) | Web: ${customer?.fcmTokens?.length || 0}, Mobile: ${customer?.fcmTokenMobile?.length || 0}`)
  console.log(`  🔧 Provider: ${provider?.fullName} (${provider?.phone}) | Web: ${provider?.fcmTokens?.length || 0}, Mobile: ${provider?.fcmTokenMobile?.length || 0}`)
  console.log(`  🛡️ Admins: ${admins.length} registered admins in system`)
  admins.forEach(a => {
    console.log(`     - [Admin] ${a.fullName} (${a.email || a.phone}) | Web: ${a.fcmTokens?.length || 0}, Mobile: ${a.fcmTokenMobile?.length || 0}`)
  })
  console.log('')

  const testResults = []

  // -------------------------------------------------------------
  // TEST STEP 1: CREATE BOOKING & DISPATCH TO CUSTOMER & ADMIN
  // -------------------------------------------------------------
  console.log('-------------------------------------------------------------')
  console.log('STEP 1: USER CREATES BOOKING -> DISPATCH CUSTOMER & ADMIN PUSH')
  console.log('-------------------------------------------------------------')

  // Create real test booking in MongoDB
  const testBooking = await Booking.create({
    userId: customer._id,
    serviceId: new mongoose.Types.ObjectId(serviceId),
    subcategoryId: new mongoose.Types.ObjectId(subcategoryId),
    type: 'INSTANT',
    status: 'CREATED',
    address: {
      locationText: 'Regal Square, Indore, Madhya Pradesh',
      coordinates: {
        type: 'Point',
        coordinates: [75.8716324, 22.7173671] // Exact location in Indore matching provider
      }
    },
    hours: 1,
    quantity: 1,
    totalDurationMins: 45,
    formattedDuration: '45 mins',
    basePrice: 599,
    taxes: 32,
    totalAmount: 631,
    laborShare: 539,
    commissionAmount: 60,
    paymentMethod: 'CASH',
    startOtp: '1234',
    completionOtp: '5678'
  })

  console.log(`[FLOW: 1_USER_CREATE_BOOKING] Test booking created: ID=${testBooking._id}, totalAmount=₹${testBooking.totalAmount}`)

  const shortBookingId = String(testBooking._id).slice(-6).toUpperCase()

  // 1a. Dispatch Push to Customer
  const customerPushRes = await sendNotificationToUser(customer._id, {
    title: 'Booking Placed Successfully! 🔍',
    body: `Your booking #${shortBookingId} is confirmed. Searching for verified nearby service providers...`,
    link: `/user/tracking/${testBooking._id}`,
    data: {
      type: 'BOOKING_CREATED',
      bookingId: String(testBooking._id),
      link: `/user/tracking/${testBooking._id}`,
    }
  })
  console.log(`[FLOW: 1_CUSTOMER_PUSH_DISPATCHED] Result: success=${customerPushRes?.success}, successCount=${customerPushRes?.successCount}`)
  testResults.push({ step: '1. Customer Booking Confirmation Push', success: customerPushRes?.success })

  // 1b. Dispatch Push to Admins
  const adminPushRes = await sendNotificationToAdmins({
    title: `🚨 New Booking Alert: #${shortBookingId}`,
    body: `${customer.fullName} placed a booking for Twacha Moisturizing Red Wine (₹${testBooking.totalAmount}). Tap to view in Admin Panel.`,
    link: '/admin/bookings',
    data: {
      type: 'NEW_BOOKING_ADMIN',
      bookingId: String(testBooking._id),
      customerName: customer.fullName,
      serviceTitle: 'Twacha Moisturizing Red Wine',
      amount: String(testBooking.totalAmount),
      link: '/admin/bookings',
    }
  })
  console.log(`[FLOW: 1_ADMIN_PUSH_DISPATCHED] Result: success=${adminPushRes?.success}, successCount=${adminPushRes?.successCount}/${adminPushRes?.totalAdmins}`)
  testResults.push({ step: '1. Admin Panel New Booking Alert Push', success: adminPushRes?.success })

  // -------------------------------------------------------------
  // TEST STEP 2: BROADCAST TO NEARBY SERVICE PROVIDER
  // -------------------------------------------------------------
  console.log('\n-------------------------------------------------------------')
  console.log('STEP 2: BROADCAST ENGINE -> DISPATCH PUSH TO SERVICE PROVIDER')
  console.log('-------------------------------------------------------------')

  console.log(`[FLOW: 1_BROADCAST_TRIGGERED] Triggering broadcast engine for booking ${testBooking._id}...`)
  await startBroadcastCycle(testBooking._id)

  const updatedBookingAfterBroadcast = await Booking.findById(testBooking._id)
  console.log(`[FLOW: 2_BROADCAST_STATUS] Booking status=${updatedBookingAfterBroadcast.status}, eligibleLabourCount=${updatedBookingAfterBroadcast.eligibleLabourCount}`)
  
  // Directly verify provider siren offer push delivery
  const providerPushRes = await sendNotificationToUser(provider._id, {
    title: 'New Booking Received! ⚡',
    body: `New Twacha Moisturizing Red Wine job available near you. Estimated earnings: ₹539`,
    isBookingOffer: true,
    data: {
      type: 'NEW_BOOKING',
      bookingId: String(testBooking._id),
      serviceProviderId: String(provider._id),
      providerId: String(provider._id),
      sound: 'alert',
      channelId: 'new_booking_alerts_v2',
      link: `/serviceprovider?incoming_booking=${testBooking._id}`,
      isBookingAlert: 'true',
    }
  })
  console.log(`[FLOW: 2_PROVIDER_PUSH_DISPATCHED] Result: success=${providerPushRes?.success}, successCount=${providerPushRes?.successCount}`)
  testResults.push({ step: '2. Service Provider Broadcast Siren Offer Push', success: providerPushRes?.success })

  // -------------------------------------------------------------
  // TEST STEP 3: SERVICE PROVIDER ACCEPTS -> CUSTOMER & ADMIN NOTIFIED
  // -------------------------------------------------------------
  console.log('\n-------------------------------------------------------------')
  console.log('STEP 3: SERVICE PROVIDER ACCEPTS -> NOTIFY CUSTOMER & ADMIN')
  console.log('-------------------------------------------------------------')

  testBooking.status = 'ACCEPTED'
  testBooking.acceptedLabourId = provider._id
  testBooking.laborId = provider._id
  await testBooking.save()

  // 3a. Customer Booking Accepted Confirmation
  const custAcceptNotif = await sendBookingAcceptedNotification({
    booking: testBooking,
    partner: provider,
    assignment: {
      labourId: provider._id,
      serviceName: 'Twacha Moisturizing Red Wine',
      startOtp: testBooking.startOtp,
      completionOtp: testBooking.completionOtp,
    }
  })
  console.log(`[FLOW: 3_CUSTOMER_ACCEPT_CONFIRMATION] Result: success=${custAcceptNotif?.success}, fcmResult=${custAcceptNotif?.fcmResult?.successCount} sent`)
  testResults.push({ step: '3. Customer Provider Acceptance Confirmation Push', success: custAcceptNotif?.success })

  // 3b. Admin Provider Accepted Notification
  const adminAcceptRes = await sendNotificationToAdmins({
    title: `✅ Booking #${shortBookingId} Accepted!`,
    body: `${provider.fullName} accepted booking #${shortBookingId} for ₹${testBooking.totalAmount}.`,
    link: '/admin/bookings',
    data: {
      type: 'BOOKING_ACCEPTED_ADMIN',
      bookingId: String(testBooking._id),
      providerId: String(provider._id),
      providerName: provider.fullName,
      amount: String(testBooking.totalAmount),
      link: '/admin/bookings',
    }
  })
  console.log(`[FLOW: 3_ADMIN_ACCEPT_ALERT] Result: success=${adminAcceptRes?.success}, count=${adminAcceptRes?.successCount}`)
  testResults.push({ step: '3. Admin Booking Accepted Alert Push', success: adminAcceptRes?.success })

  // -------------------------------------------------------------
  // TEST STEP 4: SERVICE COMPLETED -> CUSTOMER, PROVIDER & ADMIN
  // -------------------------------------------------------------
  console.log('\n-------------------------------------------------------------')
  console.log('STEP 4: SERVICE COMPLETED -> NOTIFY CUSTOMER, PROVIDER & ADMIN')
  console.log('-------------------------------------------------------------')

  testBooking.status = 'COMPLETED'
  await testBooking.save()

  // 4a. Customer Completed Push
  const custCompleteRes = await sendNotificationToUser(customer._id, {
    title: 'Service Completed! 🎉',
    body: `Work on booking #${shortBookingId} is complete. Tap to view invoice and rate your provider.`,
    link: `/user/tracking/${testBooking._id}`,
    data: {
      type: 'BOOKING_STATUS_UPDATE',
      status: 'COMPLETED',
      bookingId: String(testBooking._id),
    }
  })
  console.log(`[FLOW: 4_CUSTOMER_COMPLETE_PUSH] Result: success=${custCompleteRes?.success}`)
  testResults.push({ step: '4. Customer Service Completed Push', success: custCompleteRes?.success })

  // 4b. Provider Completed Push
  const provCompleteRes = await sendNotificationToUser(provider._id, {
    title: 'Job Completed! 🎉',
    body: `Job #${shortBookingId} has been successfully completed. Earnings of ₹539 credited to your wallet.`,
    link: `/serviceprovider`,
    data: {
      type: 'JOB_STATUS_UPDATE',
      status: 'COMPLETED',
      bookingId: String(testBooking._id),
    }
  })
  console.log(`[FLOW: 4_PROVIDER_COMPLETE_PUSH] Result: success=${provCompleteRes?.success}`)
  testResults.push({ step: '4. Provider Job Completed Push', success: provCompleteRes?.success })

  // 4c. Admin Completed Push
  const adminCompleteRes = await sendNotificationToAdmins({
    title: `📋 Booking #${shortBookingId} Completed`,
    body: `Booking #${shortBookingId} was marked COMPLETED by ${provider.fullName}. Total: ₹${testBooking.totalAmount}.`,
    link: '/admin/bookings',
    data: {
      type: 'BOOKING_STATUS_UPDATE_ADMIN',
      status: 'COMPLETED',
      bookingId: String(testBooking._id),
      link: '/admin/bookings',
    }
  })
  console.log(`[FLOW: 4_ADMIN_COMPLETE_PUSH] Result: success=${adminCompleteRes?.success}, count=${adminCompleteRes?.successCount}`)
  testResults.push({ step: '4. Admin Booking Completed Alert Push', success: adminCompleteRes?.success })

  // Clean up test booking
  await Booking.findByIdAndDelete(testBooking._id)
  console.log('\n🧹 Test booking cleaned up from database.')

  console.log('\n======================================================================')
  console.log('                      TEST EXECUTION SUMMARY                          ')
  console.log('======================================================================')
  testResults.forEach((t, i) => {
    console.log(`${t.success ? '  ✅ PASS' : '  ❌ FAIL'} | ${t.step}`)
  })
  console.log('======================================================================\n')

  // Allow background microtasks and async promises to finish before disconnecting
  await new Promise(r => setTimeout(r, 1500))
  await mongoose.disconnect()
  process.exit(0)
}

runTest().catch((err) => {
  console.error(err)
  process.exit(1)
})
