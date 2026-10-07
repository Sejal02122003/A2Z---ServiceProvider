import { Product } from '../models/Product.js'
import { ServiceProduct } from '../models/ServiceProduct.js'
import { MaterialRequest, generateRequestId } from '../models/MaterialRequest.js'
import { InventoryTransaction, generateTransactionId } from '../models/InventoryTransaction.js'
import { Booking } from '../models/Booking.js'

/**
 * Generate or retrieve material requirement for a booking and vendor
 */
export async function generateMaterialRequirementForBooking(bookingId, vendorId = null) {
  const booking = await Booking.findById(bookingId).lean()
  if (!booking) return null

  const targetVendorId = vendorId || booking.laborId || booking.acceptedLabourId
  const serviceId = booking.serviceId

  if (!serviceId) return null

  // Check if active ServiceProduct mappings exist
  const mappings = await ServiceProduct.find({ serviceId, isActive: true })
    .populate('productId')
    .lean()

  if (!mappings || mappings.length === 0) {
    return null
  }

  // Check if a MaterialRequest already exists for this booking
  let existingRequest = await MaterialRequest.findOne({ bookingId })
  if (existingRequest) {
    if (targetVendorId && String(existingRequest.vendorId) !== String(targetVendorId)) {
      existingRequest.vendorId = targetVendorId
      await existingRequest.save()
    }
    return existingRequest
  }

  // If no vendor assigned yet, and no vendor passed, we can still prepare requirement if needed, or wait
  if (!targetVendorId) return null

  // Calculate items with real-time stock check
  const items = mappings.map((m) => {
    const product = m.productId
    const qtyRequired = m.quantityRequired || 1
    const currentStock = product ? product.currentStock : 0

    let itemStatus = 'AVAILABLE'
    let shortageQty = 0

    if (currentStock <= 0) {
      itemStatus = 'OUT_OF_STOCK'
      shortageQty = qtyRequired
    } else if (currentStock < qtyRequired) {
      itemStatus = 'PARTIALLY_AVAILABLE'
      shortageQty = qtyRequired - currentStock
    } else if (currentStock <= (product?.minimumStock || 5)) {
      itemStatus = 'LOW_STOCK'
    }

    return {
      productId: product?._id || m.productId,
      quantityRequired: qtyRequired,
      quantityRequested: qtyRequired,
      quantityApproved: 0,
      quantityIssued: 0,
      quantityUsed: 0,
      quantityReturned: 0,
      unit: m.unit || product?.unit || 'Piece',
      isMandatory: m.isMandatory ?? true,
      isAdditional: false,
      itemStatus,
      shortageQuantity: shortageQty,
    }
  })

  const hasShortage = items.some((i) => i.itemStatus === 'OUT_OF_STOCK' || i.itemStatus === 'PARTIALLY_AVAILABLE')
  const initialStatus = hasShortage ? 'WAITING_FOR_STOCK' : 'REQUESTED'

  const materialRequest = await MaterialRequest.create({
    requestId: generateRequestId(),
    bookingId,
    vendorId: targetVendorId,
    serviceId,
    status: initialStatus,
    items,
  })

  return materialRequest
}

/**
 * Re-evaluate pending material requests when new stock is added for a product
 */
export async function recheckStockForPendingRequests(productId) {
  try {
    const product = await Product.findById(productId).lean()
    if (!product || product.currentStock <= 0) return

    // Find requests that are waiting for stock or requested with shortage on this product
    const pendingRequests = await MaterialRequest.find({
      status: { $in: ['WAITING_FOR_STOCK', 'REQUESTED', 'PARTIALLY_ISSUED'] },
      'items.productId': productId,
    })

    for (const req of pendingRequests) {
      let allItemsReady = true
      let modified = false

      for (const item of req.items) {
        if (String(item.productId) === String(productId)) {
          if (product.currentStock >= item.quantityRequired) {
            item.itemStatus = 'READY_FOR_ISSUE'
            item.shortageQuantity = 0
            modified = true
          } else if (product.currentStock > 0) {
            item.itemStatus = 'PARTIALLY_AVAILABLE'
            item.shortageQuantity = item.quantityRequired - product.currentStock
            allItemsReady = false
            modified = true
          } else {
            allItemsReady = false
          }
        } else if (['OUT_OF_STOCK', 'WAITING_FOR_STOCK'].includes(item.itemStatus)) {
          allItemsReady = false
        }
      }

      if (allItemsReady && req.status === 'WAITING_FOR_STOCK') {
        req.status = 'READY_FOR_ISSUE'
        modified = true
      }

      if (modified) {
        await req.save()
      }
    }
  } catch (err) {
    console.error('[recheckStockForPendingRequests Error]', err)
  }
}

/**
 * Helper to record inventory transaction safely
 */
export async function createInventoryLog({
  productId,
  type,
  quantity,
  previousStock,
  newStock,
  vendorId = null,
  bookingId = null,
  requestId = null,
  originalProductId = null,
  performedBy,
  remarks = '',
}) {
  return await InventoryTransaction.create({
    transactionId: generateTransactionId(),
    productId,
    type,
    quantity,
    previousStock,
    newStock,
    vendorId,
    bookingId,
    requestId,
    originalProductId,
    performedBy,
    remarks,
  })
}
