import { MaterialRequest, generateRequestId } from '../models/MaterialRequest.js'
import { Product } from '../models/Product.js'
import { Booking } from '../models/Booking.js'
import { ServiceProduct } from '../models/ServiceProduct.js'
import { InventoryTransaction } from '../models/InventoryTransaction.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import {
  generateMaterialRequirementForBooking,
  createInventoryLog,
} from '../services/materialRequirementService.js'

// ==========================================
// VENDOR CONTROLLERS
// ==========================================

export const getVendorMaterialRequests = asyncHandler(async (req, res) => {
  const vendorId = req.user._id

  // 1. Check for assigned bookings of this vendor that might not have a MaterialRequest generated yet
  const assignedBookings = await Booking.find({
    $or: [{ laborId: vendorId }, { acceptedLabourId: vendorId }, { 'assignments.labourId': vendorId }],
    status: { $in: ['ACCEPTED', 'ASSIGNED', 'EN_ROUTE', 'STARTED', 'COMPLETED'] },
  }).select('_id serviceId').lean()

  for (const b of assignedBookings) {
    const existing = await MaterialRequest.findOne({ bookingId: b._id })
    if (!existing) {
      await generateMaterialRequirementForBooking(b._id, vendorId)
    }
  }

  const { status, page = 1, limit = 20 } = req.query
  const query = { vendorId }

  if (status && status !== 'ALL') {
    if (status === 'PENDING') {
      query.status = { $in: ['REQUESTED', 'APPROVED', 'WAITING_FOR_STOCK', 'READY_FOR_ISSUE'] }
    } else {
      query.status = status
    }
  }

  const skip = (Number(page) - 1) * Number(limit)
  const total = await MaterialRequest.countDocuments(query)

  const requests = await MaterialRequest.find(query)
    .populate({
      path: 'bookingId',
      select: 'status address type scheduledAt timeSlot quantity totalAmount basePrice',
      populate: { path: 'userId', select: 'fullName phone' },
    })
    .populate({
      path: 'serviceId',
      select: 'name basePrice iconUrl',
    })
    .populate('items.productId', 'name sku unit price imageUrl currentStock minimumStock')
    .populate('items.alternativeIssuedProductId', 'name sku unit price imageUrl')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean()

  return sendSuccess(res, {
    data: {
      requests,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)) || 1,
      },
    },
  })
})

export const getVendorMaterialRequestById = asyncHandler(async (req, res) => {
  const { id } = req.params
  const vendorId = req.user._id

  const request = await MaterialRequest.findById(id)
    .populate({
      path: 'bookingId',
      populate: [
        { path: 'userId', select: 'fullName phone email' },
        { path: 'serviceId', select: 'name basePrice' },
      ],
    })
    .populate('serviceId', 'name basePrice iconUrl')
    .populate({
      path: 'items.productId',
      populate: { path: 'alternativeProductIds', select: 'name sku currentStock unit' },
    })
    .populate('items.alternativeIssuedProductId', 'name sku unit price imageUrl')
    .populate('approvedBy', 'fullName email')
    .populate('issuedBy', 'fullName email')
    .lean()

  if (!request) {
    return sendError(res, { message: 'Material request not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  // Authorize: only vendor owner or admin
  if (req.user.role !== 'admin' && String(request.vendorId) !== String(vendorId)) {
    return sendError(res, { message: 'Unauthorized access to this request', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  return sendSuccess(res, { data: { request } })
})

export const createVendorMaterialRequest = asyncHandler(async (req, res) => {
  const { bookingId, items = [], remarks } = req.body
  const vendorId = req.user._id

  if (!bookingId) {
    return sendError(res, { message: 'Booking ID is required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const booking = await Booking.findById(bookingId)
  if (!booking) {
    return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  // Ensure vendor is assigned to this booking
  const isAssigned =
    String(booking.laborId) === String(vendorId) ||
    String(booking.acceptedLabourId) === String(vendorId) ||
    (booking.assignments && booking.assignments.some((a) => String(a.labourId) === String(vendorId)))

  if (!isAssigned && req.user.role !== 'admin') {
    return sendError(res, {
      message: 'You are not assigned to this booking',
      statusCode: HTTP_STATUS.FORBIDDEN,
    })
  }

  let materialRequest = await MaterialRequest.findOne({ bookingId })

  if (!materialRequest) {
    materialRequest = await generateMaterialRequirementForBooking(bookingId, vendorId)
  }

  if (materialRequest) {
    if (remarks) materialRequest.requestRemarks = remarks.trim()
    materialRequest.status = 'REQUESTED'

    // If specific item quantities were adjusted by vendor
    if (Array.isArray(items) && items.length > 0) {
      items.forEach((submitted) => {
        const item = materialRequest.items.find((i) => String(i.productId) === String(submitted.productId))
        if (item && submitted.quantityRequested !== undefined) {
          item.quantityRequested = Math.max(1, Number(submitted.quantityRequested) || item.quantityRequired)
        }
      })
    }

    await materialRequest.save()
  } else {
    // If no service mapping existed, create an empty or custom requested requirement
    const requestItems = Array.isArray(items)
      ? items.map((i) => ({
          productId: i.productId,
          quantityRequired: Number(i.quantityRequested) || 1,
          quantityRequested: Number(i.quantityRequested) || 1,
          unit: i.unit || 'Piece',
          isAdditional: true,
        }))
      : []

    materialRequest = await MaterialRequest.create({
      requestId: generateRequestId(),
      bookingId,
      vendorId,
      serviceId: booking.serviceId,
      status: 'REQUESTED',
      items: requestItems,
      requestRemarks: remarks?.trim() || '',
    })
  }

  const populated = await MaterialRequest.findById(materialRequest._id)
    .populate('items.productId')
    .populate('serviceId', 'name')
    .populate('bookingId')
    .lean()

  return sendSuccess(res, {
    message: 'Material request submitted successfully',
    data: { request: populated },
  })
})

export const requestAdditionalMaterial = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { productId, quantityRequested, remarks } = req.body
  const vendorId = req.user._id

  if (!productId || !quantityRequested || Number(quantityRequested) <= 0) {
    return sendError(res, {
      message: 'Valid Product ID and quantity are required',
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
  }

  const materialRequest = await MaterialRequest.findById(id)
  if (!materialRequest) {
    return sendError(res, { message: 'Material request not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  if (req.user.role !== 'admin' && String(materialRequest.vendorId) !== String(vendorId)) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const product = await Product.findById(productId)
  if (!product) {
    return sendError(res, { message: 'Product not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  const reqQty = Number(quantityRequested)
  let itemStatus = 'AVAILABLE'
  let shortageQty = 0

  if (product.currentStock <= 0) {
    itemStatus = 'OUT_OF_STOCK'
    shortageQty = reqQty
  } else if (product.currentStock < reqQty) {
    itemStatus = 'PARTIALLY_AVAILABLE'
    shortageQty = reqQty - product.currentStock
  }

  materialRequest.items.push({
    productId: product._id,
    quantityRequired: reqQty,
    quantityRequested: reqQty,
    quantityApproved: 0,
    quantityIssued: 0,
    quantityUsed: 0,
    quantityReturned: 0,
    unit: product.unit || 'Piece',
    isMandatory: false,
    isAdditional: true,
    itemStatus,
    shortageQuantity: shortageQty,
    remarks: remarks?.trim() || 'Additional material requested',
  })

  // If request was already completed or issued, keep in appropriate state
  if (['COMPLETED', 'RETURNED'].includes(materialRequest.status)) {
    materialRequest.status = 'REQUESTED'
  }

  await materialRequest.save()

  const populated = await MaterialRequest.findById(id)
    .populate('items.productId')
    .populate('serviceId', 'name')
    .lean()

  return sendSuccess(res, {
    message: 'Additional material requested successfully',
    data: { request: populated },
  })
})

export const recordMaterialUsage = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { itemsUsage = [], remarks } = req.body
  const vendorId = req.user._id

  const materialRequest = await MaterialRequest.findById(id)
  if (!materialRequest) {
    return sendError(res, { message: 'Material request not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  if (req.user.role !== 'admin' && String(materialRequest.vendorId) !== String(vendorId)) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  if (!['ISSUED', 'PARTIALLY_ISSUED', 'IN_USE'].includes(materialRequest.status)) {
    return sendError(res, {
      message: `Cannot record usage for request in status '${materialRequest.status}'. Materials must be issued first.`,
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
  }

  // Validate usage and returns
  for (const usage of itemsUsage) {
    const item = materialRequest.items.id(usage.itemId) || materialRequest.items.find((i) => String(i._id) === String(usage.itemId))
    if (!item) continue

    const usedQty = Math.max(0, Number(usage.usedQuantity) || 0)
    const returnedQty = Math.max(0, Number(usage.returnedQuantity) || 0)
    const issuedQty = item.quantityIssued || 0

    if (usedQty > issuedQty) {
      return sendError(res, {
        message: `Used quantity (${usedQty}) cannot exceed issued quantity (${issuedQty})`,
        statusCode: HTTP_STATUS.BAD_REQUEST,
      })
    }

    if (returnedQty > issuedQty - usedQty) {
      return sendError(res, {
        message: `Returned quantity (${returnedQty}) cannot exceed remaining unused quantity (${issuedQty - usedQty})`,
        statusCode: HTTP_STATUS.BAD_REQUEST,
      })
    }

    const previousReturned = item.quantityReturned || 0
    const newReturnDelta = returnedQty - previousReturned

    item.quantityUsed = usedQty
    item.quantityReturned = returnedQty

    const targetProductId = item.alternativeIssuedProductId || item.productId

    // If there is new returned quantity, add back to product central inventory atomically
    if (newReturnDelta > 0) {
      const product = await Product.findById(targetProductId)
      if (product) {
        const prevStock = product.currentStock || 0
        product.currentStock = prevStock + newReturnDelta
        await product.save()

        await createInventoryLog({
          productId: product._id,
          type: 'RETURNED_BY_VENDOR',
          quantity: newReturnDelta,
          previousStock: prevStock,
          newStock: product.currentStock,
          vendorId,
          bookingId: materialRequest.bookingId,
          requestId: materialRequest._id,
          performedBy: req.user._id,
          remarks: `Returned by vendor after service completion`,
        })
      }
    }

    // Log material used transaction
    if (usedQty > 0) {
      const product = await Product.findById(targetProductId)
      await createInventoryLog({
        productId: targetProductId,
        type: 'USED_BY_VENDOR',
        quantity: usedQty,
        previousStock: product?.currentStock || 0,
        newStock: product?.currentStock || 0,
        vendorId,
        bookingId: materialRequest.bookingId,
        requestId: materialRequest._id,
        performedBy: req.user._id,
        remarks: `Consumed during service execution`,
      })
    }

    item.itemStatus = returnedQty > 0 ? 'RETURNED' : 'USED'
  }

  // Determine overall status
  const totalIssued = materialRequest.items.reduce((s, i) => s + (i.quantityIssued || 0), 0)
  const totalUsedAndReturned = materialRequest.items.reduce(
    (s, i) => s + (i.quantityUsed || 0) + (i.quantityReturned || 0),
    0
  )

  if (totalUsedAndReturned >= totalIssued && totalIssued > 0) {
    const hasReturns = materialRequest.items.some((i) => (i.quantityReturned || 0) > 0)
    materialRequest.status = hasReturns ? 'RETURNED' : 'COMPLETED'
  } else {
    materialRequest.status = 'IN_USE'
  }

  materialRequest.completedAt = new Date()
  if (remarks) materialRequest.requestRemarks = (materialRequest.requestRemarks + ' ' + remarks).trim()
  await materialRequest.save()

  const populated = await MaterialRequest.findById(id)
    .populate('items.productId')
    .populate('items.alternativeIssuedProductId')
    .populate('serviceId', 'name')
    .lean()

  return sendSuccess(res, {
    message: 'Material usage and returns recorded successfully',
    data: { request: populated },
  })
})

// ==========================================
// ADMIN CONTROLLERS
// ==========================================

export const getAdminMaterialRequests = asyncHandler(async (req, res) => {
  const {
    status,
    vendorId,
    bookingId,
    serviceId,
    startDate,
    endDate,
    search,
    page = 1,
    limit = 20,
  } = req.query

  const query = {}

  if (status && status !== 'ALL') {
    if (status === 'PENDING') {
      query.status = { $in: ['REQUESTED', 'APPROVED', 'WAITING_FOR_STOCK', 'READY_FOR_ISSUE', 'PARTIALLY_ISSUED'] }
    } else {
      query.status = status
    }
  }

  if (vendorId) query.vendorId = vendorId
  if (bookingId) query.bookingId = bookingId
  if (serviceId) query.serviceId = serviceId

  if (startDate || endDate) {
    query.createdAt = {}
    if (startDate) query.createdAt.$gte = new Date(startDate)
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      query.createdAt.$lte = end
    }
  }

  if (search) {
    const regex = new RegExp(search.trim(), 'i')
    query.requestId = regex
  }

  const skip = (Number(page) - 1) * Number(limit)
  const total = await MaterialRequest.countDocuments(query)

  const requests = await MaterialRequest.find(query)
    .populate('vendorId', 'fullName phone email profileImageUrl')
    .populate({
      path: 'bookingId',
      select: 'status address type scheduledAt timeSlot totalAmount',
      populate: { path: 'userId', select: 'fullName phone email' },
    })
    .populate('serviceId', 'name basePrice iconUrl')
    .populate({
      path: 'items.productId',
      populate: { path: 'alternativeProductIds', select: 'name sku currentStock unit price' },
    })
    .populate('items.alternativeIssuedProductId', 'name sku unit price imageUrl currentStock')
    .populate('approvedBy', 'fullName email')
    .populate('issuedBy', 'fullName email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean()

  return sendSuccess(res, {
    data: {
      requests,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)) || 1,
      },
    },
  })
})

export const getAdminMaterialRequestById = asyncHandler(async (req, res) => {
  const { id } = req.params

  const request = await MaterialRequest.findById(id)
    .populate('vendorId', 'fullName phone email profileImageUrl')
    .populate({
      path: 'bookingId',
      select: 'status address type scheduledAt timeSlot totalAmount',
      populate: { path: 'userId', select: 'fullName phone email' },
    })
    .populate('serviceId', 'name basePrice iconUrl')
    .populate({
      path: 'items.productId',
      populate: { path: 'alternativeProductIds', select: 'name sku currentStock unit price' },
    })
    .populate('items.alternativeIssuedProductId', 'name sku unit price imageUrl currentStock')
    .populate('approvedBy', 'fullName email')
    .populate('issuedBy', 'fullName email')
    .lean()

  if (!request) {
    return sendError(res, { message: 'Material request not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  return sendSuccess(res, { data: { request } })
})

export const approveMaterialRequest = asyncHandler(async (req, res) => {

  const { id } = req.params
  const { adminRemarks } = req.body

  const materialRequest = await MaterialRequest.findById(id).populate('items.productId')
  if (!materialRequest) {
    return sendError(res, { message: 'Material request not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  if (['ISSUED', 'COMPLETED', 'RETURNED', 'CANCELLED'].includes(materialRequest.status)) {
    return sendError(res, {
      message: `Cannot approve request with status '${materialRequest.status}'`,
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
  }

  let allAvailable = true
  materialRequest.items.forEach((item) => {
    item.quantityApproved = item.quantityRequested || item.quantityRequired
    const stock = item.productId?.currentStock ?? 0
    if (stock < item.quantityApproved) {
      allAvailable = false
      item.itemStatus = stock <= 0 ? 'OUT_OF_STOCK' : 'PARTIALLY_AVAILABLE'
      item.shortageQuantity = Math.max(0, item.quantityApproved - stock)
    } else {
      item.itemStatus = 'READY_FOR_ISSUE'
      item.shortageQuantity = 0
    }
  })

  materialRequest.status = allAvailable ? 'APPROVED' : 'WAITING_FOR_STOCK'
  materialRequest.approvedBy = req.user._id
  materialRequest.approvedAt = new Date()
  if (adminRemarks) materialRequest.adminRemarks = adminRemarks.trim()

  await materialRequest.save()

  return sendSuccess(res, {
    message: allAvailable
      ? 'Material request approved successfully'
      : 'Material request approved but marked as WAITING_FOR_STOCK due to stock shortage',
    data: { request: materialRequest },
  })
})

export const rejectMaterialRequest = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { adminRemarks = 'Rejected by admin' } = req.body

  const materialRequest = await MaterialRequest.findById(id)
  if (!materialRequest) {
    return sendError(res, { message: 'Material request not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  if (['ISSUED', 'COMPLETED', 'RETURNED'].includes(materialRequest.status)) {
    return sendError(res, {
      message: `Cannot reject request that is already ${materialRequest.status}`,
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
  }

  materialRequest.status = 'REJECTED'
  materialRequest.adminRemarks = adminRemarks.trim()
  materialRequest.items.forEach((item) => {
    item.itemStatus = 'REJECTED'
  })

  await materialRequest.save()

  return sendSuccess(res, {
    message: 'Material request rejected',
    data: { request: materialRequest },
  })
})

export const issueMaterials = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { items = [], adminRemarks } = req.body

  const materialRequest = await MaterialRequest.findById(id).populate('items.productId')
  if (!materialRequest) {
    return sendError(res, { message: 'Material request not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  if (['COMPLETED', 'RETURNED', 'CANCELLED'].includes(materialRequest.status)) {
    return sendError(res, {
      message: `Cannot issue materials for request with status '${materialRequest.status}'`,
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
  }

  let totalIssuedCount = 0
  let totalPendingCount = 0

  for (const itemPayload of items) {
    const item =
      materialRequest.items.id(itemPayload.itemId) ||
      materialRequest.items.find((i) => String(i._id) === String(itemPayload.itemId))

    if (!item) continue

    const qtyToIssue = Math.max(0, Number(itemPayload.issueQuantity) || 0)
    if (qtyToIssue <= 0) {
      if ((item.quantityIssued || 0) < item.quantityRequired) {
        totalPendingCount += 1
      }
      continue
    }

    const useAlternative = Boolean(itemPayload.useAlternative && itemPayload.alternativeProductId)
    const targetProductId = useAlternative ? itemPayload.alternativeProductId : item.productId?._id || item.productId

    const product = await Product.findById(targetProductId)
    if (!product) {
      return sendError(res, { message: `Product ${targetProductId} not found`, statusCode: HTTP_STATUS.NOT_FOUND })
    }

    // Check stock
    if (product.currentStock < qtyToIssue) {
      return sendError(res, {
        message: `Insufficient stock for ${product.name}. Available: ${product.currentStock}, Requested to issue: ${qtyToIssue}`,
        statusCode: HTTP_STATUS.CONFLICT,
      })
    }

    // Atomically decrement stock
    const prevStock = product.currentStock
    product.currentStock = Math.max(0, prevStock - qtyToIssue)
    await product.save()

    // Update item record
    item.quantityIssued = (item.quantityIssued || 0) + qtyToIssue
    item.quantityApproved = Math.max(item.quantityApproved || 0, item.quantityIssued)

    let txnType = 'ISSUED_TO_VENDOR'
    if (useAlternative) {
      item.alternativeIssuedProductId = product._id
      item.itemStatus = 'ALTERNATIVE_ISSUED'
      txnType = 'ALTERNATIVE_PRODUCT_ISSUED'
    } else {
      item.itemStatus = item.quantityIssued >= item.quantityRequired ? 'ISSUED' : 'PARTIALLY_ISSUED'
    }

    // Log ledger transaction
    await createInventoryLog({
      productId: product._id,
      type: txnType,
      quantity: qtyToIssue,
      previousStock: prevStock,
      newStock: product.currentStock,
      vendorId: materialRequest.vendorId,
      bookingId: materialRequest.bookingId,
      requestId: materialRequest._id,
      originalProductId: useAlternative ? item.productId?._id || item.productId : null,
      performedBy: req.user._id,
      remarks: useAlternative
        ? `Alternative product issued: ${product.name} (reason: ${itemPayload.alternativeReason || 'Original unavailable'})`
        : `Material issued to vendor for booking`,
    })

    if (item.quantityIssued >= item.quantityRequired) {
      item.shortageQuantity = 0
      totalIssuedCount += 1
    } else {
      item.shortageQuantity = item.quantityRequired - item.quantityIssued
      totalPendingCount += 1
    }
  }

  // Determine overall status
  const totalItems = materialRequest.items.length
  if (totalPendingCount === 0 && totalIssuedCount > 0) {
    materialRequest.status = 'ISSUED'
  } else if (totalIssuedCount > 0 || materialRequest.items.some((i) => (i.quantityIssued || 0) > 0)) {
    materialRequest.status = 'PARTIALLY_ISSUED'
  } else {
    materialRequest.status = 'WAITING_FOR_STOCK'
  }

  materialRequest.issuedBy = req.user._id
  materialRequest.issuedAt = new Date()
  if (adminRemarks) materialRequest.adminRemarks = adminRemarks.trim()

  await materialRequest.save()

  const populated = await MaterialRequest.findById(id)
    .populate('vendorId', 'fullName phone email')
    .populate('items.productId')
    .populate('items.alternativeIssuedProductId')
    .populate('serviceId', 'name')
    .populate('bookingId')
    .lean()

  return sendSuccess(res, {
    message: `Materials issued successfully. Status: ${materialRequest.status}`,
    data: { request: populated },
  })
})

export const markWaitingForStock = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { adminRemarks = 'Marked as waiting for central stock replenishment' } = req.body

  const materialRequest = await MaterialRequest.findById(id)
  if (!materialRequest) {
    return sendError(res, { message: 'Material request not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  materialRequest.status = 'WAITING_FOR_STOCK'
  materialRequest.adminRemarks = adminRemarks.trim()
  materialRequest.items.forEach((item) => {
    if ((item.quantityIssued || 0) < item.quantityRequired) {
      item.itemStatus = 'WAITING_FOR_STOCK'
    }
  })

  await materialRequest.save()

  return sendSuccess(res, {
    message: 'Material request marked as WAITING_FOR_STOCK',
    data: { request: materialRequest },
  })
})
