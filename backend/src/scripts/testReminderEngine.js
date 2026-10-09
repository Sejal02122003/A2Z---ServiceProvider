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
import { BookingReminder, REMINDER_STATUS, REMINDER_TYPE, RECIPIENT_ROLE } from '../models/BookingReminder.js'
import { BookingReminderSetting } from '../models/BookingReminderSetting.js'
import { InAppNotification } from '../models/InAppNotification.js'
import {
  getReminderSettings,
  updateReminderSettings,
  calculateBookingAppointmentTime,
  scheduleRemindersForBooking,
  cancelRemindersForBooking,
  rescheduleRemindersForBooking,
  handleVendorReassignment,
  processDueReminders,
  recoverStaleLeases,
  retryReminderManually,
  getReminderOverviewStats,
} from '../services/bookingReminderService.js'

let passedTests = 0
let totalTests = 0

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

async function runTests() {
  console.log('🚀 Starting Booking Date & Time Reminder Engine Test Suite...\n')

  try {
    await mongoose.connect(process.env.MONGODB_URI)
    console.log('Connected to MongoDB.\n')

    // 1. Setup Test Users and Service
    let testCustomer = await User.findOne({ email: 'test_rem_customer@appzeto.com' })
    if (!testCustomer) {
      testCustomer = await User.create({
        fullName: 'Test Reminder Customer',
        phone: '9888811111',
        email: 'test_rem_customer@appzeto.com',
        role: 'customer',
        status: 'active',
      })
    }

    let testVendor1 = await User.findOne({ email: 'test_rem_vendor1@appzeto.com' })
    if (!testVendor1) {
      testVendor1 = await User.create({
        fullName: 'Test Reminder Partner 1',
        phone: '9888822222',
        email: 'test_rem_vendor1@appzeto.com',
        role: 'labour',
        status: 'active',
        isAadhaarVerified: true,
      })
    }

    let testVendor2 = await User.findOne({ email: 'test_rem_vendor2@appzeto.com' })
    if (!testVendor2) {
      testVendor2 = await User.create({
        fullName: 'Test Reminder Partner 2',
        phone: '9888833333',
        email: 'test_rem_vendor2@appzeto.com',
        role: 'labour',
        status: 'active',
        isAadhaarVerified: true,
      })
    }

    let testAdmin = await User.findOne({ email: 'test_rem_admin@appzeto.com' })
    if (!testAdmin) {
      testAdmin = await User.create({
        fullName: 'Test Reminder Admin',
        phone: '9888844444',
        email: 'test_rem_admin@appzeto.com',
        role: 'admin',
        status: 'active',
      })
    }

    // Clean any previous test data
    await BookingReminder.deleteMany({
      $or: [
        { recipientId: { $in: [testCustomer._id, testVendor1._id, testVendor2._id] } },
      ],
    })
    await InAppNotification.deleteMany({
      userId: { $in: [testCustomer._id, testVendor1._id, testVendor2._id] },
    })

    // Reset settings to known defaults
    await updateReminderSettings(
      {
        enabled: true,
        customerRemindersEnabled: true,
        vendorRemindersEnabled: true,
        intervals: {
          twentyFourHour: { enabled: true, hoursBefore: 24 },
          oneHour: { enabled: true, hoursBefore: 1 },
          atAppointment: { enabled: true, hoursBefore: 0 },
        },
      },
      testAdmin
    )

    // TEST GROUP 1: Appointment Date & Time Resolution
    console.log('--- TEST GROUP 1: Appointment Date & Time Resolution ---')
    const subcatId = new mongoose.Types.ObjectId()
    const servId = new mongoose.Types.ObjectId()

    // 48 hours in the future
    const futureAppointmentDate = new Date(Date.now() + 48 * 3600 * 1000)
    const futureDateStr = futureAppointmentDate.toISOString().split('T')[0]

    const testBooking1 = await Booking.create({
      userId: testCustomer._id,
      laborId: testVendor1._id,
      acceptedLabourId: testVendor1._id,
      subcategoryId: subcatId,
      serviceId: servId,
      type: 'SCHEDULED',
      scheduledAt: futureAppointmentDate,
      timeSlot: '10:00 AM',
      basePrice: 1000,
      platformFee: 50,
      taxes: 180,
      totalAmount: 1230,
      laborShare: 900,
      paymentMethod: 'ONLINE',
      paymentStatus: 'PAID',
      status: 'ACCEPTED',
      address: { locationText: 'Sector 62, Noida' },
    })

    const resolvedTime = calculateBookingAppointmentTime(testBooking1)
    assert(resolvedTime instanceof Date && !isNaN(resolvedTime.getTime()), 'Appointment time successfully resolved as valid Date')
    assert(resolvedTime.getTime() > Date.now() + 40 * 3600 * 1000, 'Resolved appointment timestamp preserves future scheduling')

    // TEST GROUP 2: Reminder Scheduling (24h, 1h, and At-Appointment)
    console.log('\n--- TEST GROUP 2: Automatic Reminder Scheduling & Deduplication ---')
    const scheduleRes1 = await scheduleRemindersForBooking(testBooking1._id)
    assert(scheduleRes1.success === true, 'scheduleRemindersForBooking executed successfully')
    assert(scheduleRes1.count >= 3, `Scheduled ${scheduleRes1.count} reminders for customer and assigned vendor`)

    const customer24hReminder = await BookingReminder.findOne({
      bookingId: testBooking1._id,
      recipientId: testCustomer._id,
      reminderType: REMINDER_TYPE.TWENTY_FOUR_HOURS,
    })
    assert(customer24hReminder != null, 'Customer 24-hour reminder created in DB')
    assert(customer24hReminder.status === REMINDER_STATUS.PENDING, 'Reminder status set to PENDING')

    const vendor24hReminder = await BookingReminder.findOne({
      bookingId: testBooking1._id,
      recipientId: testVendor1._id,
      reminderType: REMINDER_TYPE.TWENTY_FOUR_HOURS,
    })
    assert(vendor24hReminder != null, 'Vendor 24-hour reminder created for assigned partner')

    // Idempotent re-run check
    const reScheduleRes = await scheduleRemindersForBooking(testBooking1._id)
    const totalCountAfter = await BookingReminder.countDocuments({ bookingId: testBooking1._id })
    assert(totalCountAfter === scheduleRes1.count, 'Re-scheduling is idempotent and did not create duplicate reminders')

    // TEST GROUP 3: Skipping Past Intervals (Booking created shortly before appointment)
    console.log('\n--- TEST GROUP 3: Short-Notice Booking (Skipping Past Intervals) ---')
    // Appointment 30 minutes in the future
    const shortNoticeTime = new Date(Date.now() + 30 * 60 * 1000)
    const shortTimeSlot = shortNoticeTime.toLocaleTimeString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    })

    const testBookingShort = await Booking.create({
      userId: testCustomer._id,
      laborId: testVendor1._id,
      acceptedLabourId: testVendor1._id,
      subcategoryId: subcatId,
      serviceId: servId,
      type: 'SCHEDULED',
      scheduledAt: shortNoticeTime,
      timeSlot: shortTimeSlot,
      basePrice: 800,
      totalAmount: 800,
      laborShare: 700,
      paymentMethod: 'CASH',
      status: 'ACCEPTED',
      address: { locationText: 'Indirapuram, Ghaziabad' },
    })

    const shortScheduleRes = await scheduleRemindersForBooking(testBookingShort._id)
    const short24h = await BookingReminder.findOne({
      bookingId: testBookingShort._id,
      reminderType: REMINDER_TYPE.TWENTY_FOUR_HOURS,
    })
    const short1h = await BookingReminder.findOne({
      bookingId: testBookingShort._id,
      reminderType: REMINDER_TYPE.ONE_HOUR,
    })
    assert(short24h == null, '24-hour reminder correctly skipped because 24h before is in the past')
    assert(short1h == null, '1-hour reminder correctly skipped because 1h before is in the past')

    const shortAtAppt = await BookingReminder.findOne({
      bookingId: testBookingShort._id,
      reminderType: REMINDER_TYPE.AT_APPOINTMENT,
    })
    assert(shortAtAppt != null, 'At-appointment reminder correctly created for future 30-min appointment')

    // TEST GROUP 4: Vendor Reassignment Handling
    console.log('\n--- TEST GROUP 4: Vendor Reassignment ---')
    await handleVendorReassignment(testBooking1._id, testVendor2._id, testVendor1._id)

    const oldVendorReminders = await BookingReminder.find({
      bookingId: testBooking1._id,
      recipientId: testVendor1._id,
      status: REMINDER_STATUS.PENDING,
    })
    assert(oldVendorReminders.length === 0, 'Old vendor pending reminders cancelled on reassignment')

    const newVendorReminders = await BookingReminder.find({
      bookingId: testBooking1._id,
      recipientId: testVendor2._id,
      status: REMINDER_STATUS.PENDING,
    })
    assert(newVendorReminders.length > 0, 'New vendor pending reminders scheduled on reassignment')

    // TEST GROUP 5: Booking Rescheduling
    console.log('\n--- TEST GROUP 5: Booking Rescheduling ---')
    const newAppointmentDate = new Date(Date.now() + 72 * 3600 * 1000)
    testBooking1.scheduledAt = newAppointmentDate
    await testBooking1.save()

    await rescheduleRemindersForBooking(testBooking1._id)
    const rescheduledCustomerReminder = await BookingReminder.findOne({
      bookingId: testBooking1._id,
      recipientId: testCustomer._id,
      reminderType: REMINDER_TYPE.TWENTY_FOUR_HOURS,
      status: REMINDER_STATUS.PENDING,
    })
    assert(rescheduledCustomerReminder != null, 'Customer reminder updated after rescheduling')
    assert(
      rescheduledCustomerReminder.appointmentTime.getTime() === calculateBookingAppointmentTime(testBooking1).getTime(),
      'Reminder appointmentTime accurately updated to newly calculated appointment timestamp'
    )

    // TEST GROUP 6: Worker Execution & Atomic Claiming
    console.log('\n--- TEST GROUP 6: Worker Batch Execution & In-App Notification ---')
    // Manually set a test reminder due in the past so the worker picks it up
    const dueReminder = await BookingReminder.create({
      bookingId: testBooking1._id,
      recipientId: testCustomer._id,
      recipientRole: RECIPIENT_ROLE.CUSTOMER,
      reminderType: REMINDER_TYPE.CUSTOM,
      scheduledAt: new Date(Date.now() - 5000), // 5 seconds ago
      appointmentTime: newAppointmentDate,
      status: REMINDER_STATUS.PENDING,
      dedupeKey: `TEST_DUE_REMINDER_${Date.now()}`,
      metadata: { serviceName: 'AC Deep Clean Service' },
    })

    const workerResult = await processDueReminders()
    assert(workerResult.processed > 0, 'Worker processed due reminder job')

    const processedReminder = await BookingReminder.findById(dueReminder._id)
    assert(processedReminder.status === REMINDER_STATUS.SENT, 'Reminder marked as SENT after processing')
    assert(processedReminder.sentAt != null, 'Reminder sentAt timestamp recorded')

    // Check In-App Notification
    const inAppRecord = await InAppNotification.findOne({
      userId: testCustomer._id,
      bookingId: testBooking1._id,
    })
    assert(inAppRecord != null, 'In-App Notification record created for recipient')

    // TEST GROUP 7: Stale Lease Recovery
    console.log('\n--- TEST GROUP 7: Stale Lease Recovery ---')
    const staleReminder = await BookingReminder.create({
      bookingId: testBooking1._id,
      recipientId: testCustomer._id,
      recipientRole: RECIPIENT_ROLE.CUSTOMER,
      reminderType: REMINDER_TYPE.CUSTOM,
      scheduledAt: new Date(Date.now() - 10000),
      appointmentTime: newAppointmentDate,
      status: REMINDER_STATUS.PROCESSING,
      leaseExpiresAt: new Date(Date.now() - 5000), // Expired lease
      dedupeKey: `TEST_STALE_LEASE_${Date.now()}`,
    })

    const reclaimedCount = await recoverStaleLeases()
    assert(reclaimedCount >= 1, 'Worker successfully reclaimed stale processing lease')
    const reclaimedReminder = await BookingReminder.findById(staleReminder._id)
    assert(reclaimedReminder.status === REMINDER_STATUS.PENDING, 'Stale reminder reverted to PENDING for safe retry')

    // TEST GROUP 8: Booking Cancellation & Completion
    console.log('\n--- TEST GROUP 8: Booking Cancellation & Completion ---')
    await cancelRemindersForBooking(testBooking1._id, 'Customer cancelled booking')
    const pendingAfterCancel = await BookingReminder.find({
      bookingId: testBooking1._id,
      status: REMINDER_STATUS.PENDING,
    })
    assert(pendingAfterCancel.length === 0, 'All pending reminders cancelled when booking is cancelled')

    // TEST GROUP 9: Admin Overview Statistics
    console.log('\n--- TEST GROUP 9: Admin Overview Statistics ---')
    const overviewStats = await getReminderOverviewStats()
    assert(overviewStats.totalReminders > 0, 'Overview stats returned total reminder counts')
    assert(overviewStats.settings != null && overviewStats.settings.enabled === true, 'Overview stats returned settings object')

    console.log(`\n========================================`)
    console.log(`🎉 ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`)
    console.log(`========================================\n`)

    // Clean up test documents
    await BookingReminder.deleteMany({
      recipientId: { $in: [testCustomer._id, testVendor1._id, testVendor2._id, testAdmin._id] },
    })
    await InAppNotification.deleteMany({
      userId: { $in: [testCustomer._id, testVendor1._id, testVendor2._id, testAdmin._id] },
    })
    await Booking.deleteMany({
      _id: { $in: [testBooking1._id, testBookingShort._id] },
    })
    await User.deleteMany({
      email: {
        $in: [
          'test_rem_customer@appzeto.com',
          'test_rem_vendor1@appzeto.com',
          'test_rem_vendor2@appzeto.com',
          'test_rem_admin@appzeto.com',
        ],
      },
    })

    process.exit(0)
  } catch (err) {
    console.error('❌ Test suite encountered an error:', err)
    process.exit(1)
  }
}

runTests()
