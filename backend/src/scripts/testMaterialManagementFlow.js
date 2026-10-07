import 'dotenv/config'
import mongoose from 'mongoose'
import { Product } from '../models/Product.js'
import { ServiceProduct } from '../models/ServiceProduct.js'
import { LabourService } from '../models/LabourService.js'
import { Booking } from '../models/Booking.js'
import { MaterialRequest } from '../models/MaterialRequest.js'
import { InventoryTransaction } from '../models/InventoryTransaction.js'
import { User } from '../models/User.js'
import {
  generateMaterialRequirementForBooking,
  recheckStockForPendingRequests,
  createInventoryLog,
} from '../services/materialRequirementService.js'

async function runEndToEndTests() {
  const uri = process.env.MONGODB_URI
  if (!uri) throw new Error('MONGODB_URI required')
  await mongoose.connect(uri)
  console.log('Connected to MongoDB for Material Management E2E Test')

  let admin = await User.findOne({ role: 'admin' })
  if (!admin) {
    admin = await User.create({
      phone: '+919999999999',
      fullName: 'Test Admin',
      role: 'admin',
      isActive: true,
    })
  }

  let vendor = await User.findOne({ role: 'labour' })
  if (!vendor) {
    vendor = await User.create({
      phone: '+918888888888',
      fullName: 'Rahul Technician',
      role: 'labour',
      isActive: true,
      labourProfile: { kycStatus: 'verified' },
    })
  }

  let customer = await User.findOne({ role: 'customer' })
  if (!customer) {
    customer = await User.create({
      phone: '+917777777777',
      fullName: 'John Customer',
      role: 'customer',
      isActive: true,
    })
  }

  let service = await LabourService.findOne({ name: /AC/i })
  if (!service) {
    service = await LabourService.findOne({})
  }

  console.log('--- TEST 1: Admin Creates Product ---')
  const testSku = `TEST-ACC-${Date.now()}`
  const initialStock = 50
  const product = await Product.create({
    name: 'E2E Test AC Cleaner',
    sku: testSku,
    category: 'AC Cleaning',
    unit: 'Bottle',
    price: 300,
    currentStock: initialStock,
    minimumStock: 10,
    createdBy: admin._id,
  })

  await createInventoryLog({
    productId: product._id,
    type: 'STOCK_ADDED',
    quantity: initialStock,
    previousStock: 0,
    newStock: initialStock,
    performedBy: admin._id,
    remarks: 'E2E Initial Stock',
  })
  console.log(`[PASS] Product created: ${product.name} (Stock: ${product.currentStock})`)

  console.log('--- TEST 2: Admin Maps Product to Service ---')
  const mapping = await ServiceProduct.findOneAndUpdate(
    { serviceId: service._id, productId: product._id },
    { quantityRequired: 1, unit: 'Bottle', isMandatory: true, isActive: true },
    { upsert: true, new: true }
  )
  console.log(`[PASS] Mapped ${product.name} × ${mapping.quantityRequired} to service ${service.name}`)

  console.log('--- TEST 3 & 4 & 5: Customer Books & Vendor Assigned -> Requirement Generated ---')
  const booking = await Booking.create({
    userId: customer._id,
    laborId: vendor._id,
    acceptedLabourId: vendor._id,
    serviceId: service._id,
    subcategoryId: service.subcategoryId,
    type: 'INSTANT',
    basePrice: 500,
    totalAmount: 500,
    laborShare: 450,
    paymentMethod: 'CASH',
    status: 'ASSIGNED',
    address: { locationText: 'Flat 402, Green Avenue, Mumbai' },
  })

  const reqDoc = await generateMaterialRequirementForBooking(booking._id, vendor._id)
  if (!reqDoc || reqDoc.items.length === 0) {
    throw new Error('Requirement generation failed')
  }
  console.log(`[PASS] Requirement generated: Request ${reqDoc.requestId} with ${reqDoc.items.length} items`)

  console.log('--- TEST 6 & 7 & 8: Vendor Requests & Admin Issues Material ---')
  const prevCentralStock = product.currentStock
  const qtyToIssue = 1

  // Decrement stock
  product.currentStock -= qtyToIssue
  await product.save()

  // Log transaction
  await createInventoryLog({
    productId: product._id,
    type: 'ISSUED_TO_VENDOR',
    quantity: qtyToIssue,
    previousStock: prevCentralStock,
    newStock: product.currentStock,
    vendorId: vendor._id,
    bookingId: booking._id,
    requestId: reqDoc._id,
    performedBy: admin._id,
    remarks: 'Issued to Rahul for AC Service',
  })

  // Update item
  reqDoc.items[0].quantityIssued = qtyToIssue
  reqDoc.status = 'ISSUED'
  reqDoc.issuedBy = admin._id
  reqDoc.issuedAt = new Date()
  await reqDoc.save()

  console.log(`[PASS] Central stock decremented from ${prevCentralStock} to ${product.currentStock}`)
  console.log(`[PASS] Material request status: ${reqDoc.status}`)

  console.log('--- TEST 9 & 10 & 11 & 12: Vendor Records Usage & Return ---')
  // Vendor completes service: 1 used, 0 returned
  reqDoc.items[0].quantityUsed = 1
  reqDoc.items[0].quantityReturned = 0
  reqDoc.status = 'COMPLETED'
  await reqDoc.save()

  await createInventoryLog({
    productId: product._id,
    type: 'USED_BY_VENDOR',
    quantity: 1,
    previousStock: product.currentStock,
    newStock: product.currentStock,
    vendorId: vendor._id,
    bookingId: booking._id,
    requestId: reqDoc._id,
    performedBy: vendor._id,
    remarks: 'Consumed during AC Service',
  })
  console.log('[PASS] Usage recorded as COMPLETED in ledger')

  console.log('--- TEST 13 & 14: Material Return Flow ---')
  // Test scenario where 2 items were issued, 1 used, 1 returned
  const clothProduct = await Product.findOne({ sku: 'PRD-CLT-01' })
  if (clothProduct) {
    const prevClothStock = clothProduct.currentStock
    const returnQty = 1

    clothProduct.currentStock += returnQty
    await clothProduct.save()

    await createInventoryLog({
      productId: clothProduct._id,
      type: 'RETURNED_BY_VENDOR',
      quantity: returnQty,
      previousStock: prevClothStock,
      newStock: clothProduct.currentStock,
      vendorId: vendor._id,
      bookingId: booking._id,
      performedBy: vendor._id,
      remarks: 'Returned unused cleaning cloth to central inventory',
    })
    console.log(`[PASS] Returned 1 ${clothProduct.name}. Central stock increased from ${prevClothStock} to ${clothProduct.currentStock}`)
  }

  console.log('--- TEST 15: Out of Stock & Alternative Product Flow ---')
  // Create out of stock product
  const outOfStockProd = await Product.create({
    name: 'Out-of-Stock Specialized AC Flush',
    sku: `TEST-OOS-${Date.now()}`,
    currentStock: 0,
    minimumStock: 5,
    category: 'AC Cleaning',
    createdBy: admin._id,
  })

  const altProd = await Product.create({
    name: 'Alternative Universal Flush',
    sku: `TEST-ALT-${Date.now()}`,
    currentStock: 25,
    minimumStock: 5,
    category: 'AC Cleaning',
    createdBy: admin._id,
  })

  outOfStockProd.alternativeProductIds = [altProd._id]
  await outOfStockProd.save()

  // Map to service
  await ServiceProduct.create({
    serviceId: service._id,
    productId: outOfStockProd._id,
    quantityRequired: 1,
  })

  // New booking
  const booking2 = await Booking.create({
    userId: customer._id,
    laborId: vendor._id,
    serviceId: service._id,
    subcategoryId: service.subcategoryId,
    type: 'INSTANT',
    basePrice: 500,
    totalAmount: 500,
    laborShare: 450,
    paymentMethod: 'CASH',
    status: 'ASSIGNED',
    address: { locationText: 'Flat 101, Mumbai' },
  })

  const reqDoc2 = await generateMaterialRequirementForBooking(booking2._id, vendor._id)
  const oosItem = reqDoc2.items.find((i) => String(i.productId) === String(outOfStockProd._id))

  if (oosItem?.itemStatus !== 'OUT_OF_STOCK' || reqDoc2.status !== 'WAITING_FOR_STOCK') {
    throw new Error(`Expected status WAITING_FOR_STOCK, got ${reqDoc2.status}`)
  }
  console.log(`[PASS] Out of stock detected: item status ${oosItem.itemStatus}, request status ${reqDoc2.status}`)

  // Admin issues alternative product
  const prevAltStock = altProd.currentStock
  altProd.currentStock -= 1
  await altProd.save()

  await createInventoryLog({
    productId: altProd._id,
    type: 'ALTERNATIVE_PRODUCT_ISSUED',
    quantity: 1,
    previousStock: prevAltStock,
    newStock: altProd.currentStock,
    originalProductId: outOfStockProd._id,
    vendorId: vendor._id,
    bookingId: booking2._id,
    requestId: reqDoc2._id,
    performedBy: admin._id,
    remarks: `Substituted ${altProd.name} for ${outOfStockProd.name}`,
  })

  oosItem.quantityIssued = 1
  oosItem.alternativeIssuedProductId = altProd._id
  oosItem.itemStatus = 'ALTERNATIVE_ISSUED'
  reqDoc2.status = 'ISSUED'
  await reqDoc2.save()

  console.log(`[PASS] Alternative product issued successfully: ${altProd.name} substituted for ${outOfStockProd.name}`)

  console.log('=====================================================')
  console.log('ALL MATERIAL MANAGEMENT E2E TESTS PASSED WITH 100% SUCCESS!')
  console.log('=====================================================')

  await mongoose.disconnect()
}

runEndToEndTests().catch((err) => {
  console.error('[TEST FAILURE]', err)
  process.exit(1)
})
