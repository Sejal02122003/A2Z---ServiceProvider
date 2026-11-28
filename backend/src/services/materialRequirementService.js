import { Product } from '../models/Product.js'
import { ServiceProduct } from '../models/ServiceProduct.js'
import { MaterialRequest, generateRequestId } from '../models/MaterialRequest.js'
import { InventoryTransaction, generateTransactionId } from '../models/InventoryTransaction.js'
import { Booking } from '../models/Booking.js'

const idOf = (v) => String(v?._id || v || '')

/**
 * Resolve all LabourService IDs relevant for a booking (and optional specific vendor),
 * covering single-service, multi-service, contractor, and package bookings.
 */
export function resolveServiceIdsForBookingVendor(booking, vendorId = null) {
  if (!booking) return []
  const vid = idOf(vendorId)
  const raw = []

  const multiItems = Array.isArray(booking.multiServiceBooking?.items)
    ? booking.multiServiceBooking.items.filter((it) => it.status !== 'CANCELLED')
    : []
  if ((booking.multiServiceBooking?.isMultiService || multiItems.length > 0) && multiItems.length > 0) {
    const matched = vid ? multiItems.filter((it) => idOf(it.assignedLabourId) === vid) : multiItems
    ;(matched.length > 0 ? matched : multiItems).forEach((it) => {
      if (it.serviceId) raw.push(idOf(it.serviceId))
    })
  } else if (vid && Array.isArray(booking.assignments) && booking.assignments.some((a) => idOf(a.labourId) === vid && a.serviceId)) {
    booking.assignments
      .filter((a) => idOf(a.labourId) === vid && a.serviceId && a.status !== 'CANCELLED')
      .forEach((a) => raw.push(idOf(a.serviceId)))
  } else {
    if (booking.serviceId) raw.push(idOf(booking.serviceId))
    ;(booking.packageBooking?.inclusions || []).forEach((inc) => {
      if (inc.serviceId) raw.push(idOf(inc.serviceId))
    })
    ;(booking.contractorInfo?.services || []).forEach((sv) => {
      if (sv.serviceId) raw.push(idOf(sv.serviceId))
    })
  }

  return raw.filter((v, i, arr) => v && arr.indexOf(v) === i)
}

/**
 * Pre-fetch mapped products grouped by serviceId for broadcast previews & requirement checks.
 */
export async function getMappedMaterialsByServiceIds(serviceIds = []) {
  const cleanIds = [...new Set((serviceIds || []).map(idOf).filter(Boolean))]
  const byService = new Map()
  if (cleanIds.length === 0) return byService

  const mappings = await ServiceProduct.find({ serviceId: { $in: cleanIds }, isActive: true })
    .populate('productId', 'name sku unit price currentStock minimumStock usesPerAssignment isActive')
    .lean()

  for (const m of mappings) {
    if (!m.productId || m.productId.isActive === false) continue
    const sid = idOf(m.serviceId)
    if (!byService.has(sid)) byService.set(sid, [])
    byService.get(sid).push({
      productId: idOf(m.productId._id),
      name: m.productId.name,
      sku: m.productId.sku,
      unit: m.unit || m.productId.unit || 'Piece',
      quantityRequired: m.quantityRequired || 1,
      usesPerAssignment: Math.max(1, Number(m.productId.usesPerAssignment) || 1),
      currentStock: m.productId.currentStock ?? 0,
      isMandatory: m.isMandatory ?? true,
    })
  }
  return byService
}

/**
 * Flatten & deduplicate mapped materials across a set of serviceIds using a pre-fetched map.
 */
export function collectUniqueMappedMaterials(byServiceMap, serviceIds = []) {
  const byProd = new Map()
  for (const rawSid of serviceIds || []) {
    const sid = idOf(rawSid)
    const list = byServiceMap?.get?.(sid) || []
    for (const item of list) {
      const pid = idOf(item.productId)
      if (byProd.has(pid)) {
        const existing = byProd.get(pid)
        existing.quantityRequired += Number(item.quantityRequired) || 1
        if (item.isMandatory) existing.isMandatory = true
      } else {
        byProd.set(pid, { ...item })
      }
    }
  }
  return [...byProd.values()]
}

/**
 * Generate or retrieve material requirement for a booking and vendor.
 */
export async function generateMaterialRequirementForBooking(bookingId, vendorId = null) {
  const booking = await Booking.findById(bookingId).lean()
  if (!booking) return null

  const targetVendorId = vendorId || booking.laborId || booking.acceptedLabourId
  const serviceIds = resolveServiceIdsForBookingVendor(booking, targetVendorId)

  if (serviceIds.length === 0) return null

  // Check if active ServiceProduct mappings exist across the vendor's service(s)
  const mappings = await ServiceProduct.find({ serviceId: { $in: serviceIds }, isActive: true })
    .populate('productId')
    .lean()

  if (!mappings || mappings.length === 0) {
    return null
  }

  // Check if a MaterialRequest already exists for this (bookingId, vendorId)
  if (!targetVendorId) return null
  let existingRequest = await MaterialRequest.findOne({ bookingId, vendorId: targetVendorId })
  if (existingRequest) {
    return existingRequest
  }

  // Deduplicate products across services on the same booking (adding required quantities)
  const productMap = new Map()
  for (const m of mappings) {
    const product = m.productId
    if (!product || product.isActive === false) continue
    const pid = idOf(product._id)
    const qtyRequired = m.quantityRequired || 1
    if (productMap.has(pid)) {
      productMap.get(pid).qtyRequired += qtyRequired
      if (m.isMandatory) productMap.get(pid).isMandatory = true
    } else {
      productMap.set(pid, {
        product,
        qtyRequired,
        unit: m.unit || product.unit || 'Piece',
        isMandatory: m.isMandatory ?? true,
      })
    }
  }

  if (productMap.size === 0) return null

  // Calculate items with real-time stock check
  const items = [...productMap.values()].map(({ product, qtyRequired, unit, isMandatory }) => {
    const currentStock = product.currentStock ?? 0

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
      productId: product._id,
      quantityRequired: qtyRequired,
      quantityRequested: qtyRequired,
      quantityApproved: 0,
      quantityIssued: 0,
      quantityUsed: 0,
      quantityReturned: 0,
      unit,
      isMandatory,
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
    serviceId: booking.serviceId || serviceIds[0],
    status: initialStatus,
    items,
  })

  return materialRequest
}

/**
 * When a booking is cancelled, close material requests that have not been issued yet.
 * Requests already issued / in use stay open so the provider can still return the materials.
 */
export async function cancelPendingMaterialRequestsForBooking(bookingId, reason = 'Booking cancelled') {
  const res = await MaterialRequest.updateMany(
    { bookingId, status: { $in: ['REQUESTED', 'APPROVED', 'WAITING_FOR_STOCK', 'READY_FOR_ISSUE'] } },
    { $set: { status: 'CANCELLED', adminRemarks: reason } }
  )
  return res.modifiedCount || 0
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
