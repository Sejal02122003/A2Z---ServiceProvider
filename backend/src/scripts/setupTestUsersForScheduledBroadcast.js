import dotenv from 'dotenv'
import mongoose from 'mongoose'
import { User } from '../models/User.js'
import { LabourService } from '../models/LabourService.js'

dotenv.config()

async function setup() {
  await mongoose.connect(process.env.MONGODB_URI)
  console.log('--- Connecting to DB to setup test users ---')

  // Get active services in Indore
  const services = await LabourService.find({ isActive: true }).select('_id subcategoryId categoryId').lean()
  const serviceIds = services.map(s => s._id)
  const subcategoryIds = [...new Set(services.map(s => s.subcategoryId).filter(Boolean))]
  const categoryIds = [...new Set(services.map(s => s.categoryId).filter(Boolean))]

  const allDaysSchedule = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'].map(d => ({
    day: d,
    startTime: '09:00',
    endTime: '23:59',
    isAvailable: true
  }))

  const trialEnds = new Date('2026-12-31T23:59:59.000Z')

  // 1. Setup 7828889678 as Customer (as specified by user in prompt)
  const custRes = await User.findOneAndUpdate(
    { phone: '7828889678' },
    {
      $set: {
        role: 'customer',
        fullName: 'Sejal Harishankar Chhapre',
        city: 'Indore',
        isActive: true,
        isPhoneVerified: true,
        currentLocation: 'Corporate House, 208, 169, RNT Marg, near CENTRAL, Near Central Mall, Opposite Ravindra Natya, South Tukoganj, Indore, Madhya Pradesh 452001, India',
        'savedAddress.lat': 22.717629,
        'savedAddress.lng': 75.871877,
        'savedAddress.text': 'Corporate House, 208, 169, RNT Marg, near CENTRAL, Near Central Mall, Opposite Ravindra Natya, South Tukoganj, Indore, Madhya Pradesh 452001, India'
      }
    },
    { new: true }
  )
  console.log('Customer (7828889678) updated:', {
    _id: custRes?._id,
    phone: custRes?.phone,
    role: custRes?.role,
    fullName: custRes?.fullName,
    city: custRes?.city
  })

  // 2. Setup 9294853225 as Labour (as specified by user in prompt)
  const labRes = await User.findOneAndUpdate(
    { phone: '9294853225' },
    {
      $set: {
        role: 'labour',
        fullName: 'Sejal gurjar',
        city: 'Indore',
        isActive: true,
        isPhoneVerified: true,
        currentLocation: '17/C, New Palasia, Indore, Madhya Pradesh 452001, India',
        vendorStatus: 'CONFIRMED',
        identityStatus: 'VERIFIED',
        'labourProfile.kycStatus': 'verified',
        'labourProfile.availabilityStatus': 'available',
        'labourProfile.trialEndsAt': trialEnds,
        'labourProfile.trialStartedAt': new Date('2026-10-01T00:00:00.000Z'),
        'labourProfile.schedule': allDaysSchedule,
        'labourProfile.serviceIds': serviceIds,
        'labourProfile.categoryIds': categoryIds,
        'labourProfile.subcategoryIds': subcategoryIds,
        'labourProfile.currentLatitude': 22.7282041,
        'labourProfile.currentLongitude': 75.884373,
        'labourProfile.lastLocationUpdatedAt': new Date()
      }
    },
    { new: true }
  )
  console.log('Labour (9294853225) updated:', {
    _id: labRes?._id,
    phone: labRes?.phone,
    role: labRes?.role,
    fullName: labRes?.fullName,
    kycStatus: labRes?.labourProfile?.kycStatus,
    availabilityStatus: labRes?.labourProfile?.availabilityStatus,
    serviceCount: labRes?.labourProfile?.serviceIds?.length,
    currentLatitude: labRes?.labourProfile?.currentLatitude,
    currentLongitude: labRes?.labourProfile?.currentLongitude
  })

  await mongoose.disconnect()
}

setup().catch(console.error)
