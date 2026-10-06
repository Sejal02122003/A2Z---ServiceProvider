import 'dotenv/config'
import mongoose from 'mongoose'
import { LabourService } from '../models/LabourService.js'

async function run() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI required')
  await mongoose.connect(uri)

  console.log('Applying promotional offers to services...')

  const services = await LabourService.find({})
  let updatedCount = 0

  // Curated offers based on service types/keywords
  for (const s of services) {
    const name = s.name.toLowerCase()
    let discountType = 'PERCENTAGE'
    let discountValue = 0
    let offerBadge = ''
    let offerDescription = ''

    if (name.includes('facial') || name.includes('cleanup')) {
      discountType = 'PERCENTAGE'
      discountValue = 20
      offerBadge = '20% OFF'
      offerDescription = 'Special Glow Deal: 20% OFF'
    } else if (name.includes('haircut') || name.includes('blowdry') || name.includes('styling')) {
      discountType = 'PERCENTAGE'
      discountValue = 15
      offerBadge = '15% OFF'
      offerDescription = 'Trending Look Deal: 15% OFF'
    } else if (name.includes('spa') || name.includes('massage')) {
      discountType = 'PERCENTAGE'
      discountValue = 25
      offerBadge = '25% OFF'
      offerDescription = 'Relaxation Special: Flat 25% OFF'
    } else if (name.includes('bridal') || name.includes('makeup')) {
      discountType = 'PERCENTAGE'
      discountValue = 15
      offerBadge = '15% OFF'
      offerDescription = 'Festive Glamour Deal: 15% OFF'
    } else if (name.includes('ac jet') || name.includes('deep cleaning') || name.includes('ac services')) {
      discountType = 'PERCENTAGE'
      discountValue = 20
      offerBadge = '20% OFF'
      offerDescription = 'Summer Saver: 20% OFF Jet Pump Cleaning'
    } else if (name.includes('ac installation') || name.includes('gas charging') || name.includes('gas leak')) {
      discountType = 'PERCENTAGE'
      discountValue = 15
      offerBadge = '15% OFF'
      offerDescription = 'Cooling Guarantee Deal: 15% OFF'
    } else if (name.includes('washing machine') || name.includes('descaling')) {
      discountType = 'PERCENTAGE'
      discountValue = 20
      offerBadge = '20% OFF'
      offerDescription = 'Appliance Care: 20% OFF'
    } else if (name.includes('refrigerator') || name.includes('fridge')) {
      discountType = 'PERCENTAGE'
      discountValue = 15
      offerBadge = '15% OFF'
      offerDescription = 'Fridge Chill Special: 15% OFF'
    } else if (name.includes('ro ') || name.includes('purifier') || name.includes('filter')) {
      discountType = 'PERCENTAGE'
      discountValue = 20
      offerBadge = '20% OFF'
      offerDescription = 'Pure Water Deal: 20% OFF'
    } else if (name.includes('caretaker') || name.includes('nurse') || name.includes('elder')) {
      discountType = 'PERCENTAGE'
      discountValue = 10
      offerBadge = '10% OFF'
      offerDescription = 'Care Assist Discount: 10% OFF'
    } else if (name.includes('plumb') || name.includes('electric') || name.includes('carpenter') || name.includes('paint')) {
      discountType = 'PERCENTAGE'
      discountValue = 15
      offerBadge = '15% OFF'
      offerDescription = 'Home Fix Special: 15% OFF'
    } else {
      // Default sample offer on other services
      discountType = 'PERCENTAGE'
      discountValue = 10
      offerBadge = '10% OFF'
      offerDescription = 'Limited Time Offer: 10% OFF'
    }

    s.discountType = discountType
    s.discountValue = discountValue
    s.offerBadge = offerBadge
    s.offerDescription = offerDescription
    await s.save()
    updatedCount++
  }

  console.log(`Successfully updated ${updatedCount} services with active promotional offers!`)
  await mongoose.disconnect()
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
