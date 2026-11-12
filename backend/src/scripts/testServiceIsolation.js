import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import assert from 'assert'
import { User } from '../models/User.js'
import { Booking } from '../models/Booking.js'
import { LabourService } from '../models/LabourService.js'
import { LabourSubcategory } from '../models/LabourSubcategory.js'
import { startBroadcastCycle } from '../services/broadcastService.js'
import { getActiveBroadcast, acceptBroadcast } from '../controllers/broadcastController.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../../.env') })

async function runTest() {
  await mongoose.connect(process.env.MONGODB_URI)
  console.log('Connected to DB')

  // Find Poonam Rathor (who only has Salon services)
  const poonam = await User.findOne({ phone: '9520978083' }).lean()
  assert.ok(poonam, 'Poonam Rathor should exist')
  const poonamServiceIds = (poonam.labourProfile?.serviceIds || []).map(id => String(id))
  console.log(`Poonam services count: ${poonamServiceIds.length}`)

  // Find a CCTV service (which Poonam definitely does NOT offer)
  const cctvService = await LabourService.findOne({ name: /DVR|CCTV|Hard Disk/i }).lean()
  console.log(`Using CCTV service: "${cctvService?.name}" (${cctvService?._id})`)

  // Find a Salon service that Poonam DOES offer
  const salonService = await LabourService.findOne({ _id: { $in: poonamServiceIds } }).lean()
  console.log(`Using Salon service offered by Poonam: "${salonService?.name}" (${salonService?._id})`)

  // Find or create a test customer
  let customer = await User.findOne({ role: 'customer' }).lean()
  if (!customer) {
    customer = await User.findOne({}).lean()
  }

  // TEST 1: Create a CCTV Booking
  const cctvBooking = await Booking.create({
    userId: customer._id,
    serviceId: cctvService._id,
    subcategoryId: cctvService.subcategoryId,
    type: 'SCHEDULED',
    scheduledAt: new Date(Date.now() + 30 * 60 * 1000),
    timeSlot: '14:00',
    basePrice: 500,
    totalAmount: 500,
    paymentMethod: 'ONLINE',
    laborShare: 450,
    status: 'CREATED',
    address: {
      locationText: 'Test Location',
      coordinates: { type: 'Point', coordinates: [75.8577, 22.7196] }
    }
  })

  console.log(`Created CCTV Booking: ${cctvBooking._id}`)

  // Trigger broadcast cycle
  await startBroadcastCycle(cctvBooking._id)

  // Verify booking status is FAILED because 0 CCTV technicians exist (no spamming unrelated providers!)
  const refreshedCctv = await Booking.findById(cctvBooking._id)
  assert.strictEqual(refreshedCctv.status, 'FAILED')
  console.log('✓ TEST 1 PASSED: CCTV booking was NOT broadcasted to unrelated providers like Poonam')

  // Now set status to BROADCASTING to test getActiveBroadcast and acceptBroadcast isolation
  await Booking.findByIdAndUpdate(cctvBooking._id, { status: 'BROADCASTING' })

  // TEST 2: getActiveBroadcast for Poonam
  // Mock req and res for getActiveBroadcast
  let activeBroadcastData = null
  const reqPoonam = {
    user: poonam,
  }
  const resPoonam = {
    status: () => resPoonam,
    json: (data) => {
      activeBroadcastData = data
      return resPoonam
    }
  }

  await getActiveBroadcast(reqPoonam, resPoonam, () => {})
  console.log('getActiveBroadcast result for Poonam on CCTV booking:', activeBroadcastData)
  assert.strictEqual(
    activeBroadcastData?.data?.broadcast,
    null,
    'Poonam must NOT receive the CCTV active broadcast!'
  )
  console.log('✓ TEST 1 PASSED: Poonam did NOT receive CCTV booking broadcast in getActiveBroadcast')

  // TEST 3: Poonam trying to accept the CCTV booking via acceptBroadcast
  let acceptError = null
  let acceptSuccess = null
  const reqAccept = {
    params: { bookingId: cctvBooking._id },
    user: poonam,
    body: {}
  }
  const resAccept = {
    status: (code) => {
      resAccept.statusCode = code
      return resAccept
    },
    json: (data) => {
      if (resAccept.statusCode >= 400) {
        acceptError = data
      } else {
        acceptSuccess = data
      }
      return resAccept
    }
  }

  await acceptBroadcast(reqAccept, resAccept, () => {})
  console.log('acceptBroadcast result for Poonam on CCTV booking:', acceptError || acceptSuccess)
  assert.ok(acceptError, 'Poonam must get an error when attempting to accept CCTV booking!')
  assert.strictEqual(acceptError.code, 'SERVICE_NOT_OFFERED', 'Error code must be SERVICE_NOT_OFFERED')
  console.log('✓ TEST 2 PASSED: Poonam cannot accept CCTV booking (SERVICE_NOT_OFFERED)')

  // TEST 4: Create a Salon Booking for Poonam's actual service
  const salonBooking = await Booking.create({
    userId: customer._id,
    serviceId: salonService._id,
    subcategoryId: salonService.subcategoryId,
    type: 'SCHEDULED',
    scheduledAt: new Date(Date.now() + 30 * 60 * 1000),
    timeSlot: '15:00',
    basePrice: 800,
    totalAmount: 800,
    paymentMethod: 'ONLINE',
    laborShare: 720,
    status: 'CREATED',
    address: {
      locationText: 'Test Location',
      coordinates: { type: 'Point', coordinates: [75.8577, 22.7196] }
    }
  })

  // Start broadcast for salon booking
  await startBroadcastCycle(salonBooking._id)

  // Clear CCTV booking to avoid confusion
  await Booking.findByIdAndUpdate(cctvBooking._id, { status: 'CANCELLED' })

  // Now call getActiveBroadcast for Poonam on Salon booking
  let salonBroadcastData = null
  const resSalon = {
    status: () => resSalon,
    json: (data) => {
      salonBroadcastData = data
      return resSalon
    }
  }

  await getActiveBroadcast(reqPoonam, resSalon, () => {})
  console.log('getActiveBroadcast result for Poonam on Salon booking:', salonBroadcastData?.data?.broadcast?.serviceName)
  assert.ok(salonBroadcastData?.data?.broadcast, 'Poonam SHOULD receive the Salon broadcast that matches her service!')
  assert.strictEqual(String(salonBroadcastData.data.broadcast.bookingId), String(salonBooking._id))
  console.log('✓ TEST 3 PASSED: Poonam successfully receives booking for her chosen Salon service')

  // Clean up test bookings
  await Booking.findByIdAndDelete(cctvBooking._id)
  await Booking.findByIdAndDelete(salonBooking._id)

  console.log('\n======================================================')
  console.log('ALL SERVICE ISOLATION TESTS PASSED SUCCESSFULLY! ✓')
  console.log('======================================================')
  process.exit(0)
}

runTest().catch(err => {
  console.error('Test failed:', err)
  process.exit(1)
})
