import 'dotenv/config'
import mongoose from 'mongoose'
import { LabourCategory } from '../models/LabourCategory.js'
import { LabourSubcategory } from '../models/LabourSubcategory.js'
import { LabourService } from '../models/LabourService.js'
import { LABOUR_CATEGORY_SEED_V2 } from '../data/labourCategorySeed.js'

async function run() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI required')
  await mongoose.connect(uri)
  console.log('Connected to MongoDB')

  const cats = await LabourCategory.find({}).lean()
  const catMap = {
    'Salon': cats.find(c => c.name.includes('Salon')),
    'Home Appliances': cats.find(c => c.name.includes('Home Appliances')),
    'Caretaker & Nurse': cats.find(c => c.name.includes('Caretaker')),
    'Services On Demand': cats.find(c => c.name.includes('On Demand'))
  }

  const idMap = {
    "Women's Salon & Spa": '6abf4c89ff1353269ba05817',
    "Men's Salon & Grooming": '6abf4c89ff1353269ba05827',
    "Kids Haircut & Styling": '6abf4c8aff1353269ba05835',
    "Salon & Beauty Products": '6abf4c8aff1353269ba05839',
    "AC Services & Repair": '6abf4c8aff1353269ba05843',
    "Refrigerator Services": '6abf4c8aff1353269ba0584d',
    "Washing Machine Services": '6abf4c8bff1353269ba05855',
    "Water Purifier (RO) Services": '6abf4c8bff1353269ba0585d',
    "Microwave & Oven Services": '6abf4c8bff1353269ba05865',
    "Geyser & Water Heater Services": '6abf4c8bff1353269ba0586b',
    "TV & LED Repair": '6abf4c8bff1353269ba05871',
    "Kitchen Chimney & Hob Services": '6abf4c8bff1353269ba05877',
    "Appliance Care Products & Spares": '6abf4c8bff1353269ba0587d',
    "Elderly Care & Companion": '6abf4c8cff1353269ba05887',
    "Certified Home Nursing": '6abf4c8cff1353269ba0588f',
    "Baby Care & Jharokha (Nanny)": '6abf4c8cff1353269ba05899',
    "Patient Attendant & Bedside Care": '6abf4c8cff1353269ba0589f',
    "Home Physiotherapy & Rehab": '6abf4c8cff1353269ba058a5',
    "Healthcare & Caretaking Products": '6abf4c8cff1353269ba058ab',
    "Plumbing Services": '6abf4c8cff1353269ba058b5',
    "Electrical Services": '6abf4c8dff1353269ba058bf',
    "Carpentry & Furniture Repair": '6abf4c8dff1353269ba058c9',
    "Deep Cleaning Services": '6abf4c8dff1353269ba058d1',
    "Pest Control & Disinfection": '6abf4c8eff1353269ba058db',
    "Painting & Wall Repair": '6abf4c8eff1353269ba058e3',
    "Handyman & Locksmith": '6abf4c8eff1353269ba058e9'
  }

  let restored = 0
  for (const c of LABOUR_CATEGORY_SEED_V2) {
    const parentCat = catMap[c.category]
    if (!parentCat) {
      console.warn('Parent category not found for:', c.category)
      continue
    }
    for (const sub of c.subcategories) {
      const fixedId = idMap[sub.name]
      if (!fixedId) continue
      await LabourSubcategory.findByIdAndUpdate(
        fixedId,
        {
          _id: new mongoose.Types.ObjectId(fixedId),
          categoryId: parentCat._id,
          name: sub.name,
          description: sub.description || '',
          iconUrl: sub.image || '',
          isActive: true
        },
        { upsert: true, new: true }
      )
      restored++
    }
  }

  // Also make sure all 8 custom salon services have isAllZones: true or fallback so they aren't hidden
  const updatedSalonServices = await LabourService.updateMany(
    { isAllZones: false },
    { $set: { isAllZones: true } }
  )

  console.log(`Successfully restored ${restored} subcategories!`)
  console.log(`Updated ${updatedSalonServices.modifiedCount} services to isAllZones: true!`)
  await mongoose.disconnect()
}

run().catch(console.error)
