import dotenv from 'dotenv'
import mongoose from 'mongoose'
import { Booking } from '../models/Booking.js'
import { User } from '../models/User.js'
import { LabourService } from '../models/LabourService.js'
import { parseISTDateTime } from '../utils/dateHelper.js'
import { startBroadcastCycle } from '../services/broadcastService.js'

dotenv.config()

async function testE2E() {
  await mongoose.connect(process.env.MONGODB_URI)
  console.log('\n======================================================')
  console.log('   SCHEDULED BOOKING BROADCAST END-TO-END TEST')
  console.log('======================================================\n')

  const customer = await User.findOne({ phone: '7828889678' }).lean()
  const labour = await User.findOne({ phone: '9294853225' }).lean()

  console.log(`[TEST SETUP] Customer: ${customer?.fullName} (${customer?.phone}, id: ${customer?._id})`)
  console.log(`[TEST SETUP] Labour: ${labour?.fullName} (${labour?.phone}, id: ${labour?._id})`)
  console.log(`[TEST SETUP] Labour verified KYC: ${labour?.labourProfile?.kycStatus}, services: ${labour?.labourProfile?.serviceIds?.length}`)

  const testService = await LabourService.findOne({ isActive: true }).lean()
  console.log(`[TEST SETUP] Using Service: ${testService?.name} (${testService?._id})\n`)

  // -------------------------------------------------------------------------
  // TEST 1: Scheduled booking booked 40 minutes from now (within 1 hour window)
  // -------------------------------------------------------------------------
  console.log('------------------------------------------------------')
  console.log('TEST 1: Customer books scheduled booking 40 mins away')
  console.log('------------------------------------------------------')

  const now = new Date()
  const fortyMinsLater = new Date(now.getTime() + 40 * 60 * 1000)
  const istFormatterDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' })
  const istFormatterTime = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false })

  const serviceDate = istFormatterDate.format(fortyMinsLater)
  const timeSlot = istFormatterTime.format(fortyMinsLater)

  console.log(`Current Time (UTC): ${now.toISOString()}`)
  console.log(`Booking for: ${serviceDate} at ${timeSlot} IST`)

  const scheduledAt = parseISTDateTime(serviceDate, timeSlot)
  const minutesUntilScheduled = Math.round((scheduledAt.getTime() - now.getTime()) / 60000)
  console.log(`minutesUntilScheduled: ${minutesUntilScheduled} mins`)

  const booking1 = await Booking.create({
    userId: customer._id,
    subcategoryId: testService.subcategoryId,
    serviceId: testService._id,
    type: 'SCHEDULED',
    scheduledAt,
    timeSlot,
    address: {
      locationText: 'Corporate House, Indore',
      coordinates: {
        type: 'Point',
        coordinates: [75.871877, 22.717629]
      }
    },
    basePrice: 200,
    platformFee: 49,
    laborShare: 150,
    paymentMethod: 'CASH',
    totalAmount: 249,
    status: 'CREATED'
  })

  console.log(`[TEST 1] Booking created in DB: ${booking1._id}, status: ${booking1.status}`)

  // Emulate bookingController logic:
  // If minutesUntilScheduled <= 60, triggers immediate broadcast
  if (minutesUntilScheduled <= 60 && minutesUntilScheduled >= -120) {
    console.log(`[TEST 1] >>> Booking is within 1 hr (${minutesUntilScheduled}m). Triggering startBroadcastCycle immediately!`)
    await startBroadcastCycle(booking1._id)
  }

  const updatedBooking1 = await Booking.findById(booking1._id).lean()
  console.log(`[TEST 1 RESULT] Booking status: ${updatedBooking1.status}, eligibleLabourCount: ${updatedBooking1.eligibleLabourCount}`)
  
  if (updatedBooking1.status === 'BROADCASTING' && updatedBooking1.eligibleLabourCount > 0) {
    console.log('>>> TEST 1 PASSED: Booking broadcast successfully dispatched to labour!')
  } else {
    console.error('>>> TEST 1 FAILED! Status:', updatedBooking1.status)
  }

  // Clean up booking 1
  await Booking.findByIdAndDelete(booking1._id)

  // -------------------------------------------------------------------------
  // TEST 2: Scheduled booking booked 3 hours from now (> 1 hour window)
  // Should queue, and then broadcastCron should trigger at the 1-hour mark
  // -------------------------------------------------------------------------
  console.log('\n------------------------------------------------------')
  console.log('TEST 2: Customer books scheduled booking 3 hours away')
  console.log('------------------------------------------------------')

  const threeHoursLater = new Date(now.getTime() + 180 * 60 * 1000)
  const serviceDate2 = istFormatterDate.format(threeHoursLater)
  const timeSlot2 = istFormatterTime.format(threeHoursLater)

  const scheduledAt2 = parseISTDateTime(serviceDate2, timeSlot2)
  const minutesUntilScheduled2 = Math.round((scheduledAt2.getTime() - now.getTime()) / 60000)
  console.log(`Booking for: ${serviceDate2} at ${timeSlot2} IST (starts in ${minutesUntilScheduled2} mins)`)

  const booking2 = await Booking.create({
    userId: customer._id,
    subcategoryId: testService.subcategoryId,
    serviceId: testService._id,
    type: 'SCHEDULED',
    scheduledAt: scheduledAt2,
    timeSlot: timeSlot2,
    address: {
      locationText: 'Corporate House, Indore',
      coordinates: {
        type: 'Point',
        coordinates: [75.871877, 22.717629]
      }
    },
    basePrice: 200,
    platformFee: 49,
    laborShare: 150,
    paymentMethod: 'CASH',
    totalAmount: 249,
    status: 'CREATED'
  })

  console.log(`[TEST 2] Booking created in DB: ${booking2._id}, status: ${booking2.status}`)

  if (minutesUntilScheduled2 > 60) {
    console.log(`[TEST 2] Booking is > 60 mins away (${minutesUntilScheduled2}m). Queued for broadcastCron. Not broadcasting now.`)
  }

  // Now emulate time advancing to 55 mins before scheduled time:
  console.log('\n[TEST 2] Emulating time passing: now at 55 minutes before scheduledAt...')
  const simulatedNow = new Date(scheduledAt2.getTime() - 55 * 60 * 1000)
  const sixtyFiveMinsFromSimulatedNow = new Date(simulatedNow.getTime() + 65 * 60 * 1000)

  // Cron query with simulatedNow
  const dueBookings = await Booking.find({
    _id: booking2._id,
    type: { $in: ['SCHEDULED', 'scheduled'] },
    status: { $in: ['CREATED', 'created'] },
    scheduledAt: { 
      $lte: sixtyFiveMinsFromSimulatedNow,
      $gt: new Date(simulatedNow.getTime() - 12 * 60 * 60 * 1000)
    }
  })

  console.log(`[TEST 2 CRON] Did broadcastCron find booking2? Found ${dueBookings.length} booking(s)`)

  if (dueBookings.length > 0) {
    console.log(`[TEST 2 CRON] Triggering broadcast for booking2 from cron...`)
    await startBroadcastCycle(booking2._id)
  }

  const updatedBooking2 = await Booking.findById(booking2._id).lean()
  console.log(`[TEST 2 RESULT] Booking2 status: ${updatedBooking2.status}, eligibleLabourCount: ${updatedBooking2.eligibleLabourCount}`)

  if (updatedBooking2.status === 'BROADCASTING' && updatedBooking2.eligibleLabourCount > 0) {
    console.log('>>> TEST 2 PASSED: Cron successfully triggered broadcast at 1 hour before scheduled time!')
  } else {
    console.error('>>> TEST 2 FAILED! Status:', updatedBooking2.status)
  }

  // Clean up booking 2
  await Booking.findByIdAndDelete(booking2._id)

  console.log('\n======================================================')
  console.log('   ALL SCHEDULED BROADCAST TESTS COMPLETED!')
  console.log('======================================================\n')

  await mongoose.disconnect()
}

testE2E().catch(console.error)
