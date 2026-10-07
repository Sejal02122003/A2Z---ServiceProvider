import 'dotenv/config'
import mongoose from 'mongoose'
import { Product } from '../models/Product.js'
import { ServiceProduct } from '../models/ServiceProduct.js'
import { LabourService } from '../models/LabourService.js'
import { InventoryTransaction, generateTransactionId } from '../models/InventoryTransaction.js'
import { User } from '../models/User.js'

async function seed() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI required')
  await mongoose.connect(uri)
  console.log('Connected to MongoDB')

  const adminUser = await User.findOne({ role: 'admin' })
  const adminId = adminUser?._id || new mongoose.Types.ObjectId()

  console.log('Seeding Products...')

  const productData = [
    {
      name: 'AC Cleaner Foam Spray',
      sku: 'PRD-ACC-01',
      description: 'Deep penetrating foam cleaner for air conditioner cooling coils and filters.',
      category: 'AC Cleaning & Chemical',
      unit: 'Bottle',
      price: 280,
      currentStock: 80,
      minimumStock: 15,
    },
    {
      name: 'Universal Coil Cleaner Solution',
      sku: 'PRD-ACC-02',
      description: 'Heavy duty coil cleaning liquid for split & window AC systems.',
      category: 'AC Cleaning & Chemical',
      unit: 'Bottle',
      price: 320,
      currentStock: 45,
      minimumStock: 10,
    },
    {
      name: 'Microfiber Cleaning Cloth',
      sku: 'PRD-CLT-01',
      description: 'Lint-free, scratch-free multi-purpose microfiber cloth.',
      category: 'Cleaning Supplies',
      unit: 'Piece',
      price: 45,
      currentStock: 150,
      minimumStock: 25,
    },
    {
      name: 'AC Service Jet Bag Cover',
      sku: 'PRD-BAG-01',
      description: 'Waterproof wash bag jacket with drain tube for indoor AC servicing.',
      category: 'Service Equipment',
      unit: 'Piece',
      price: 450,
      currentStock: 30,
      minimumStock: 5,
    },
    {
      name: 'Refrigerant Gas R-32 Can',
      sku: 'PRD-GAS-32',
      description: 'Eco-friendly R32 refrigerant canister for inverter AC systems.',
      category: 'Refrigerants',
      unit: 'Can',
      price: 1200,
      currentStock: 20,
      minimumStock: 5,
    },
    {
      name: 'Copper Pipe 1/2 Inch (3m)',
      sku: 'PRD-COP-12',
      description: 'High grade seamless copper pipe coil for AC installation & repair.',
      category: 'Hardware & Piping',
      unit: 'Set',
      price: 850,
      currentStock: 12,
      minimumStock: 4,
    },
    {
      name: 'Electrical Insulation Tape',
      sku: 'PRD-TPE-01',
      description: 'Flame retardant PVC insulating tape.',
      category: 'Electrical Supplies',
      unit: 'Roll',
      price: 25,
      currentStock: 200,
      minimumStock: 30,
    },
    {
      name: 'Drain Pipe 2 Metres',
      sku: 'PRD-DRN-02',
      description: 'Flexible AC water outlet drain pipe.',
      category: 'Hardware & Piping',
      unit: 'Piece',
      price: 60,
      currentStock: 60,
      minimumStock: 10,
    },
    {
      name: 'Heavy Duty Wall Bracket Stand',
      sku: 'PRD-BRK-01',
      description: 'Anti-rust outdoor AC compressor mounting bracket with fasteners.',
      category: 'Hardware & Piping',
      unit: 'Set',
      price: 550,
      currentStock: 18,
      minimumStock: 5,
    },
  ]

  const seededProducts = []
  for (const item of productData) {
    let prod = await Product.findOne({ sku: item.sku })
    if (!prod) {
      prod = await Product.create({
        ...item,
        createdBy: adminId,
      })

      // Log initial stock transaction
      await InventoryTransaction.create({
        transactionId: generateTransactionId(),
        productId: prod._id,
        type: 'STOCK_ADDED',
        quantity: prod.currentStock,
        previousStock: 0,
        newStock: prod.currentStock,
        performedBy: adminId,
        remarks: 'Initial catalog seed',
      })
      console.log(`Created product: ${prod.name} (${prod.sku})`)
    } else {
      console.log(`Product exists: ${prod.name}`)
    }
    seededProducts.push(prod)
  }

  // Set alternative products (e.g. Coil Cleaner as alternative to AC Cleaner Foam Spray)
  const acCleaner = seededProducts.find((p) => p.sku === 'PRD-ACC-01')
  const coilCleaner = seededProducts.find((p) => p.sku === 'PRD-ACC-02')
  if (acCleaner && coilCleaner) {
    if (!acCleaner.alternativeProductIds.includes(coilCleaner._id)) {
      acCleaner.alternativeProductIds.push(coilCleaner._id)
      await acCleaner.save()
    }
    if (!coilCleaner.alternativeProductIds.includes(acCleaner._id)) {
      coilCleaner.alternativeProductIds.push(acCleaner._id)
      await coilCleaner.save()
    }
    console.log('Configured mutual alternatives between AC Cleaner & Coil Cleaner')
  }

  // Map products to services matching "AC" or other services
  const services = await LabourService.find({}).lean()
  console.log(`Found ${services.length} services to check for mapping...`)

  const cloth = seededProducts.find((p) => p.sku === 'PRD-CLT-01')
  const jetBag = seededProducts.find((p) => p.sku === 'PRD-BAG-01')
  const tape = seededProducts.find((p) => p.sku === 'PRD-TPE-01')
  const gas = seededProducts.find((p) => p.sku === 'PRD-GAS-32')

  for (const s of services) {
    const sName = s.name.toLowerCase()
    if (sName.includes('ac') || sName.includes('air conditioner') || sName.includes('cooling') || sName.includes('appliance')) {
      if (acCleaner) {
        await ServiceProduct.findOneAndUpdate(
          { serviceId: s._id, productId: acCleaner._id },
          { quantityRequired: 1, unit: 'Bottle', isMandatory: true, isActive: true },
          { upsert: true }
        )
      }
      if (cloth) {
        await ServiceProduct.findOneAndUpdate(
          { serviceId: s._id, productId: cloth._id },
          { quantityRequired: 2, unit: 'Piece', isMandatory: true, isActive: true },
          { upsert: true }
        )
      }
      if (coilCleaner) {
        await ServiceProduct.findOneAndUpdate(
          { serviceId: s._id, productId: coilCleaner._id },
          { quantityRequired: 1, unit: 'Bottle', isMandatory: false, isActive: true },
          { upsert: true }
        )
      }
      console.log(`Mapped AC materials to service: ${s.name}`)
    } else if (sName.includes('electric') || sName.includes('fan') || sName.includes('switch') || sName.includes('wire')) {
      if (tape) {
        await ServiceProduct.findOneAndUpdate(
          { serviceId: s._id, productId: tape._id },
          { quantityRequired: 1, unit: 'Roll', isMandatory: true, isActive: true },
          { upsert: true }
        )
      }
      if (cloth) {
        await ServiceProduct.findOneAndUpdate(
          { serviceId: s._id, productId: cloth._id },
          { quantityRequired: 1, unit: 'Piece', isMandatory: false, isActive: true },
          { upsert: true }
        )
      }
      console.log(`Mapped Electrical materials to service: ${s.name}`)
    }
  }

  console.log('Seeding completed successfully!')
  await mongoose.disconnect()
}

seed().catch((err) => {
  console.error('Seed error:', err)
  process.exit(1)
})
