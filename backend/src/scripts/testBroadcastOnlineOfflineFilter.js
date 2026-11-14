import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '../../.env') })

import { User } from '../models/User.js'
import { Booking } from '../models/Booking.js'
import { LabourCategory } from '../models/LabourCategory.js'
import { LabourSubcategory } from '../models/LabourSubcategory.js'
import { startBroadcastCycle } from '../services/broadcastService.js'
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

async function runTestSuite() {
  console.log('=================================================================')
  console.log('   BROADCAST ONLINE / OFFLINE (TIME MANAGEMENT) FILTER TESTS    ')
  console.log('=================================================================\n')

  try {
    await mongoose.connect(process.env.MONGODB_URI)
    console.log('[TEST] Connected to MongoDB.\n')

    // Clean up past test entities
    await User.deleteMany({ email: { $regex: /@online-offline-broadcast-test\.internal$/ } })
    await Booking.deleteMany({ 'address.locationText': 'TEST_ONLINE_OFFLINE_LOCATION' })

    // Find or create test category and subcategory
    let testCategory = await LabourCategory.findOne()
    if (!testCategory) {
      testCategory = await LabourCategory.create({ name: 'Test Home Services' })
    }
    let testSubcategory = await LabourSubcategory.findOne({ categoryId: testCategory._id })
    if (!testSubcategory) {
      testSubcategory = await LabourSubcategory.create({
        name: 'Test Plumber Service',
        categoryId: testCategory._id,
        price: 350,
      })
    }

    // Determine current IST day
    const istDay = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'long' }).format(new Date())
    console.log(`[TEST Context] Current IST Day: ${istDay}`)

    // Create 4 test service providers:
    // Provider 1: ONLINE (Schedule for today has isAvailable: true, 00:00 - 23:59, availabilityStatus: 'available')
    const providerOnline = await User.create({
      fullName: 'Provider One Online',
      phone: '9777111001',
      email: 'p1.online@online-offline-broadcast-test.internal',
      role: USER_ROLES.LABOUR,
      isPhoneVerified: true,
      identityStatus: 'VERIFIED',
      vendorStatus: 'CONFIRMED',
      fcmTokens: ['token_online_p1_web'],
      fcmTokenMobile: ['token_online_p1_mobile'],
      labourProfile: {
        categoryIds: [testCategory._id],
        subcategoryIds: [testSubcategory._id],
        availabilityStatus: 'available',
        currentLatitude: 22.7196,
        currentLongitude: 75.8577,
        schedule: [
          { day: 'Monday', startTime: '00:00', endTime: '23:59', isAvailable: true },
          { day: 'Tuesday', startTime: '00:00', endTime: '23:59', isAvailable: true },
          { day: 'Wednesday', startTime: '00:00', endTime: '23:59', isAvailable: true },
          { day: 'Thursday', startTime: '00:00', endTime: '23:59', isAvailable: true },
          { day: 'Friday', startTime: '00:00', endTime: '23:59', isAvailable: true },
          { day: 'Saturday', startTime: '00:00', endTime: '23:59', isAvailable: true },
          { day: 'Sunday', startTime: '00:00', endTime: '23:59', isAvailable: true },
        ],
      },
    })

    // Provider 2: OFFLINE via Time Management Toggle (Today's isAvailable is FALSE)
    const providerScheduleOffline = await User.create({
      fullName: 'Provider Two Toggle Offline',
      phone: '9777111002',
      email: 'p2.toggleoff@online-offline-broadcast-test.internal',
      role: USER_ROLES.LABOUR,
      isPhoneVerified: true,
      identityStatus: 'VERIFIED',
      vendorStatus: 'CONFIRMED',
      fcmTokens: ['token_toggleoff_p2_web'],
      fcmTokenMobile: ['token_toggleoff_p2_mobile'],
      labourProfile: {
        categoryIds: [testCategory._id],
        subcategoryIds: [testSubcategory._id],
        availabilityStatus: 'available', // Even if status was 'available', schedule toggle is FALSE
        currentLatitude: 22.7196,
        currentLongitude: 75.8577,
        schedule: [
          { day: 'Monday', startTime: '00:00', endTime: '23:59', isAvailable: istDay !== 'Monday' },
          { day: 'Tuesday', startTime: '00:00', endTime: '23:59', isAvailable: istDay !== 'Tuesday' },
          { day: 'Wednesday', startTime: '00:00', endTime: '23:59', isAvailable: istDay !== 'Wednesday' },
          { day: 'Thursday', startTime: '00:00', endTime: '23:59', isAvailable: istDay !== 'Thursday' },
          { day: 'Friday', startTime: '00:00', endTime: '23:59', isAvailable: istDay !== 'Friday' },
          { day: 'Saturday', startTime: '00:00', endTime: '23:59', isAvailable: istDay !== 'Saturday' },
          { day: 'Sunday', startTime: '00:00', endTime: '23:59', isAvailable: istDay !== 'Sunday' },
        ],
      },
    })

    // Provider 3: OFFLINE via Global Availability Status ('offline')
    const providerGlobalOffline = await User.create({
      fullName: 'Provider Three Global Offline',
      phone: '9777111003',
      email: 'p3.globaloff@online-offline-broadcast-test.internal',
      role: USER_ROLES.LABOUR,
      isPhoneVerified: true,
      identityStatus: 'VERIFIED',
      vendorStatus: 'CONFIRMED',
      fcmTokens: ['token_globaloff_p3_web'],
      fcmTokenMobile: ['token_globaloff_p3_mobile'],
      labourProfile: {
        categoryIds: [testCategory._id],
        subcategoryIds: [testSubcategory._id],
        availabilityStatus: 'offline', // Explicitly toggled duty to OFF
        currentLatitude: 22.7196,
        currentLongitude: 75.8577,
        schedule: [
          { day: istDay, startTime: '00:00', endTime: '23:59', isAvailable: true },
        ],
      },
    })

    // Provider 4: OFFLINE via Out-of-Hours (Schedule 02:00 to 02:05 in middle of night)
    const providerOutHours = await User.create({
      fullName: 'Provider Four Out of Hours',
      phone: '9777111004',
      email: 'p4.outhours@online-offline-broadcast-test.internal',
      role: USER_ROLES.LABOUR,
      isPhoneVerified: true,
      identityStatus: 'VERIFIED',
      vendorStatus: 'CONFIRMED',
      fcmTokens: ['token_outhours_p4_web'],
      fcmTokenMobile: ['token_outhours_p4_mobile'],
      labourProfile: {
        categoryIds: [testCategory._id],
        subcategoryIds: [testSubcategory._id],
        availabilityStatus: 'available',
        currentLatitude: 22.7196,
        currentLongitude: 75.8577,
        schedule: [
          { day: istDay, startTime: '02:00', endTime: '02:05', isAvailable: true },
        ],
      },
    })

    console.log('[TEST 1] Verifying Test Providers Created in MongoDB...')
    assert(providerOnline._id && providerScheduleOffline._id, 'Created Provider 1 (Online) and Provider 2 (Toggle OFF)')
    assert(providerGlobalOffline._id && providerOutHours._id, 'Created Provider 3 (Global Offline) and Provider 4 (Out of Hours)')

    // Create a customer user to place the booking
    const customer = await User.create({
      fullName: 'Customer Test Requester',
      phone: '9777111099',
      email: 'customer@online-offline-broadcast-test.internal',
      role: USER_ROLES.CUSTOMER,
      isPhoneVerified: true,
    })

    // Create an INSTANT booking at Indore coordinates
    const instantBooking = await Booking.create({
      userId: customer._id,
      categoryId: testCategory._id,
      subcategoryId: testSubcategory._id,
      serviceId: testSubcategory._id,
      type: 'INSTANT',
      status: 'CREATED',
      paymentMethod: 'CASH',
      laborShare: 300,
      totalAmount: 350,
      basePrice: 350,
      address: {
        locationText: 'TEST_ONLINE_OFFLINE_LOCATION',
        coordinates: {
          type: 'Point',
          coordinates: [75.8577, 22.7196],
        },
      },
    })

    console.log(`\n[TEST 2] Running startBroadcastCycle for Instant Booking ${instantBooking._id}...`)
    await startBroadcastCycle(instantBooking._id)

    // Allow asynchronous dispatch and notification creation to settle
    await new Promise(r => setTimeout(r, 1200))

    // Verify booking log / status
    const refreshedBooking = await Booking.findById(instantBooking._id)
    assert(
      refreshedBooking.status === 'BROADCASTING' || refreshedBooking.status === 'CREATED',
      `Booking transition succeeded (status: ${refreshedBooking.status})`
    )

    console.log('\n[TEST 3] Verifying Exact Broadcast Recipients via InAppNotification...')
    const { InAppNotification } = await import('../models/InAppNotification.js')
    const inAppNotifs = await InAppNotification.find({ bookingId: instantBooking._id })
    const notifiedLaborIds = inAppNotifs.map(n => n.userId.toString())
    console.log(`  ℹ️ Notified providers count: ${notifiedLaborIds.length}`)

    assert(
      notifiedLaborIds.includes(providerOnline._id.toString()),
      'Provider 1 (Online & within Time Management schedule) RECEIVED broadcast'
    )
    assert(
      !notifiedLaborIds.includes(providerScheduleOffline._id.toString()),
      'Provider 2 (Time Management toggle OFF for today) was EXCLUDED from broadcast'
    )
    assert(
      !notifiedLaborIds.includes(providerGlobalOffline._id.toString()),
      'Provider 3 (Availability status explicitly OFFLINE) was EXCLUDED from broadcast'
    )
    assert(
      !notifiedLaborIds.includes(providerOutHours._id.toString()),
      'Provider 4 (Outside scheduled working hours) was EXCLUDED from broadcast'
    )

    // Clean up
    await User.deleteMany({ email: { $regex: /@online-offline-broadcast-test\.internal$/ } })
    await Booking.deleteMany({ 'address.locationText': 'TEST_ONLINE_OFFLINE_LOCATION' })
    await InAppNotification.deleteMany({ bookingId: instantBooking._id })

    console.log('\n=================================================================')
    console.log(`🎉 ALL ${passedTests}/${totalTests} ONLINE/OFFLINE BROADCAST TESTS PASSED!`)
    console.log('=================================================================\n')
  } catch (err) {
    console.error('\n❌ TEST SUITE FAILED:', err)
    process.exit(1)
  } finally {
    await mongoose.disconnect()
    console.log('[TEST] Disconnected from MongoDB.')
    process.exit(0)
  }
}

runTestSuite()
