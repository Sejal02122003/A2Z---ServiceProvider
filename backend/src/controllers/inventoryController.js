import { Product } from '../models/Product.js'
import { InventoryTransaction } from '../models/InventoryTransaction.js'
import { MaterialRequest } from '../models/MaterialRequest.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { createInventoryLog, recheckStockForPendingRequests } from '../services/materialRequirementService.js'

export const addStock = asyncHandler(async (req, res) => {
  const { productId, quantity, remarks } = req.body

  if (!productId || !quantity || Number(quantity) <= 0) {
    return sendError(res, {
      message: 'Valid Product ID and positive quantity are required',
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
  }

  const addQty = Number(quantity)
  const product = await Product.findById(productId)
  if (!product) {
    return sendError(res, { message: 'Product not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  const previousStock = product.currentStock || 0
  const newStock = previousStock + addQty

  product.currentStock = newStock
  await product.save()

  const log = await createInventoryLog({
    productId: product._id,
    type: 'STOCK_ADDED',
    quantity: addQty,
    previousStock,
    newStock,
    performedBy: req.user._id,
    remarks: remarks?.trim() || 'Stock replenishment',
  })

  // Trigger automatic availability recheck for pending material requests
  await recheckStockForPendingRequests(product._id)

  return sendSuccess(res, {
    message: `Added ${addQty} ${product.unit}(s) to stock successfully`,
    data: {
      product,
      transaction: log,
    },
  })
})

export const adjustStock = asyncHandler(async (req, res) => {
  const { productId, targetStock, adjustmentType, quantity, remarks } = req.body

  if (!productId) {
    return sendError(res, { message: 'Product ID is required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const product = await Product.findById(productId)
  if (!product) {
    return sendError(res, { message: 'Product not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  const previousStock = product.currentStock || 0
  let newStock = previousStock
  let changeQty = 0
  let type = 'STOCK_ADJUSTMENT'

  if (targetStock !== undefined) {
    newStock = Math.max(0, Number(targetStock))
    changeQty = Math.abs(newStock - previousStock)
  } else if (adjustmentType === 'INCREASE') {
    changeQty = Math.max(0, Number(quantity) || 0)
    newStock = previousStock + changeQty
  } else if (adjustmentType === 'DECREASE') {
    changeQty = Math.max(0, Number(quantity) || 0)
    newStock = Math.max(0, previousStock - changeQty)
    type = 'STOCK_REMOVED'
  } else {
    return sendError(res, {
      message: 'Either targetStock or adjustmentType with quantity must be provided',
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
  }

  product.currentStock = newStock
  await product.save()

  const log = await createInventoryLog({
    productId: product._id,
    type,
    quantity: changeQty,
    previousStock,
    newStock,
    performedBy: req.user._id,
    remarks: remarks?.trim() || 'Manual stock adjustment',
  })

  if (newStock > previousStock) {
    await recheckStockForPendingRequests(product._id)
  }

  return sendSuccess(res, {
    message: 'Stock adjusted successfully',
    data: {
      product,
      transaction: log,
    },
  })
})

export const getInventoryList = asyncHandler(async (req, res) => {
  const { search, category, status, page = 1, limit = 20 } = req.query
  const query = {}

  if (status === 'active') query.isActive = true
  if (status === 'inactive') query.isActive = false
  if (category && category !== 'ALL') query.category = category

  if (search) {
    const regex = new RegExp(search.trim(), 'i')
    query.$or = [{ name: regex }, { sku: regex }, { category: regex }]
  }

  const skip = (Number(page) - 1) * Number(limit)
  const total = await Product.countDocuments(query)

  const products = await Product.find(query)
    .populate('alternativeProductIds', 'name sku currentStock unit')
    .sort({ currentStock: 1, name: 1 })
    .skip(skip)
    .limit(Number(limit))
    .lean()

  const enrichedProducts = products.map((p) => {
    let stockStatus = 'IN_STOCK'
    if (p.currentStock <= 0) stockStatus = 'OUT_OF_STOCK'
    else if (p.currentStock <= p.minimumStock) stockStatus = 'LOW_STOCK'

    return {
      ...p,
      stockStatus,
      stockValue: (p.currentStock || 0) * (p.price || 0),
    }
  })

  return sendSuccess(res, {
    data: {
      products: enrichedProducts,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)) || 1,
      },
    },
  })
})

export const getLowStockProducts = asyncHandler(async (req, res) => {
  const { page = 1, limit = 20 } = req.query

  const query = {
    isActive: true,
    $expr: { $lte: ['$currentStock', '$minimumStock'] },
  }

  const skip = (Number(page) - 1) * Number(limit)
  const total = await Product.countDocuments(query)

  const products = await Product.find(query)
    .populate('alternativeProductIds', 'name sku currentStock unit')
    .sort({ currentStock: 1 })
    .skip(skip)
    .limit(Number(limit))
    .lean()

  return sendSuccess(res, {
    data: {
      products: products.map((p) => ({
        ...p,
        shortageToMinimum: Math.max(0, p.minimumStock - p.currentStock),
        stockStatus: p.currentStock <= 0 ? 'OUT_OF_STOCK' : 'LOW_STOCK',
      })),
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)) || 1,
      },
    },
  })
})

export const getInventoryTransactions = asyncHandler(async (req, res) => {
  const {
    productId,
    vendorId,
    bookingId,
    type,
    startDate,
    endDate,
    page = 1,
    limit = 20,
  } = req.query

  const query = {}

  if (productId) query.productId = productId
  if (vendorId) query.vendorId = vendorId
  if (bookingId) query.bookingId = bookingId
  if (type && type !== 'ALL') query.type = type

  if (startDate || endDate) {
    query.createdAt = {}
    if (startDate) query.createdAt.$gte = new Date(startDate)
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      query.createdAt.$lte = end
    }
  }

  const skip = (Number(page) - 1) * Number(limit)
  const total = await InventoryTransaction.countDocuments(query)

  const transactions = await InventoryTransaction.find(query)
    .populate('productId', 'name sku unit price imageUrl')
    .populate('originalProductId', 'name sku unit')
    .populate('vendorId', 'fullName phone email profileImageUrl')
    .populate('performedBy', 'fullName email')
    .populate({
      path: 'bookingId',
      select: 'status address type scheduledAt',
    })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean()

  return sendSuccess(res, {
    data: {
      transactions,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)) || 1,
      },
    },
  })
})

export const getVendorInventory = asyncHandler(async (req, res) => {
  const { vendorId } = req.query

  // Aggregate material requests to find materials held by vendors
  const matchStage = {
    status: { $in: ['ISSUED', 'PARTIALLY_ISSUED', 'IN_USE', 'COMPLETED', 'RETURNED'] },
  }

  if (vendorId) {
    const mongoose = (await import('mongoose')).default
    matchStage.vendorId = new mongoose.Types.ObjectId(vendorId)
  }

  const requests = await MaterialRequest.find(matchStage)
    .populate('vendorId', 'fullName phone email profileImageUrl')
    .populate('bookingId', 'status address')
    .populate('serviceId', 'name')
    .populate('items.productId', 'name sku unit price imageUrl')
    .populate('items.alternativeIssuedProductId', 'name sku unit price imageUrl')
    .sort({ updatedAt: -1 })
    .lean()

  // Build aggregated held summary per vendor & product
  const vendorSummaryMap = {}

  requests.forEach((req) => {
    const vId = req.vendorId?._id?.toString()
    if (!vId) return

    if (!vendorSummaryMap[vId]) {
      vendorSummaryMap[vId] = {
        vendor: req.vendorId,
        heldItems: {},
        activeRequestsCount: 0,
        requests: [],
      }
    }

    if (['ISSUED', 'PARTIALLY_ISSUED', 'IN_USE'].includes(req.status)) {
      vendorSummaryMap[vId].activeRequestsCount += 1
    }

    vendorSummaryMap[vId].requests.push(req)

    req.items.forEach((item) => {
      const prod = item.alternativeIssuedProductId || item.productId
      if (!prod) return
      const pId = prod._id?.toString()

      if (!vendorSummaryMap[vId].heldItems[pId]) {
        vendorSummaryMap[vId].heldItems[pId] = {
          product: prod,
          totalIssued: 0,
          totalUsed: 0,
          totalReturned: 0,
          currentHeld: 0,
        }
      }

      vendorSummaryMap[vId].heldItems[pId].totalIssued += item.quantityIssued || 0
      vendorSummaryMap[vId].heldItems[pId].totalUsed += item.quantityUsed || 0
      vendorSummaryMap[vId].heldItems[pId].totalReturned += item.quantityReturned || 0
      vendorSummaryMap[vId].heldItems[pId].currentHeld = Math.max(
        0,
        vendorSummaryMap[vId].heldItems[pId].totalIssued -
          vendorSummaryMap[vId].heldItems[pId].totalUsed -
          vendorSummaryMap[vId].heldItems[pId].totalReturned
      )
    })
  })

  const vendorInventories = Object.values(vendorSummaryMap).map((v) => ({
    vendor: v.vendor,
    activeRequestsCount: v.activeRequestsCount,
    heldItems: Object.values(v.heldItems),
    totalHeldQuantity: Object.values(v.heldItems).reduce((sum, item) => sum + item.currentHeld, 0),
  }))

  return sendSuccess(res, {
    data: { vendorInventories },
  })
})

export const getInventoryDashboardStats = asyncHandler(async (req, res) => {
  const totalProducts = await Product.countDocuments()
  const activeProducts = await Product.countDocuments({ isActive: true })

  const lowStockProducts = await Product.countDocuments({
    isActive: true,
    $expr: { $lte: ['$currentStock', '$minimumStock'] },
  })

  const pendingMaterialRequests = await MaterialRequest.countDocuments({
    status: { $in: ['REQUESTED', 'WAITING_FOR_STOCK', 'READY_FOR_ISSUE', 'PARTIALLY_ISSUED'] },
  })

  // Today range in IST
  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date()
  endOfDay.setHours(23, 59, 59, 999)

  const todayTransactions = await InventoryTransaction.find({
    createdAt: { $gte: startOfDay, $lte: endOfDay },
  }).lean()

  let materialsIssuedToday = 0
  let materialsUsedToday = 0
  let materialsReturnedToday = 0

  todayTransactions.forEach((txn) => {
    if (txn.type === 'ISSUED_TO_VENDOR' || txn.type === 'ALTERNATIVE_PRODUCT_ISSUED') {
      materialsIssuedToday += txn.quantity || 0
    } else if (txn.type === 'USED_BY_VENDOR') {
      materialsUsedToday += txn.quantity || 0
    } else if (txn.type === 'RETURNED_BY_VENDOR') {
      materialsReturnedToday += txn.quantity || 0
    }
  })

  // Total inventory value
  const allProducts = await Product.find({ isActive: true }).select('currentStock price').lean()
  const totalInventoryValue = allProducts.reduce((sum, p) => sum + (p.currentStock || 0) * (p.price || 0), 0)

  return sendSuccess(res, {
    data: {
      totalProducts,
      activeProducts,
      lowStockProducts,
      pendingMaterialRequests,
      materialsIssuedToday,
      materialsUsedToday,
      materialsReturnedToday,
      totalInventoryValue,
    },
  })
})
