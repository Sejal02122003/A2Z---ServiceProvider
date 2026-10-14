import dotenv from 'dotenv'
import mongoose from 'mongoose'
import { User } from '../models/User.js'

dotenv.config()

async function run() {
  await mongoose.connect(process.env.MONGODB_URI)
  const serviceIds = [
    '6abf4c89ff1353269ba05829', // Men's Haircut & Styling
    '6abf4c89ff1353269ba0582b', // Beard Trimming & Shaping
    '6abf4c8aff1353269ba05845', // AC Jet Pump Deep Cleaning
    '6abf4c8aff1353269ba05849', // AC Gas Leak Repair & Refill
    '6abf4c8bff1353269ba0585b', // Washing Machine Water Inlet & Drain Repair
    '6abf4c8cff1353269ba058b7'  // Tap & Shower Repair / Replacement
  ]
  const allDaysSchedule = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d => ({
    day: d,
    startTime: '09:00',
    endTime: '23:59',
    isAvailable: true
  }))
  const trialEnds = new Date('2026-12-31T23:59:59.000Z')

  const res = await User.updateMany(
    { phone: { $in: ['7828889678', '7828394005', '6263823004', '7024896018', '7389279971'] } },
    {
      $set: {
        'labourProfile.trialEndsAt': trialEnds,
        'labourProfile.schedule': allDaysSchedule,
        'labourProfile.kycStatus': 'verified',
        'labourProfile.availabilityStatus': 'available',
        'labourProfile.serviceIds': serviceIds
      }
    }
  )
  console.log('UPDATED INDORE LABOURS:', res)
  await mongoose.disconnect()
}

run().catch(console.error)
