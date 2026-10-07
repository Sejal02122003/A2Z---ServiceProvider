import { Product } from '../models/Product.js'
import { InventoryTransaction } from '../models/InventoryTransaction.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { createInventoryLog, recheckStockForPendingRequests } from '../services/materialRequirementService.js'

export const createProduct = asyncHandler(async (req, res) => {
  const {
    name,
    sku,
    description,
    category,
    unit,
    imageUrl,
    price,
    currentStock = 0,
    minimumStock = 5,
    alternativeProductIds = [],
  } = req.body

  if (!name || !sku) {
    return sendError(res, { message: 'Product name and SKU are required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const existingSku = await Product.findOne({ sku: sku.trim().toUpperCase() })
  if (existingSku) {
    return sendError(res, { message: `Product with SKU '${sku}' already exists`, statusCode: HTTP_STATUS.CONFLICT })
  }

  const initialStockNum = Math.max(0, Number(currentStock) || 0)
  const product = await Product.create({
    name: name.trim(),
    sku: sku.trim().toUpperCase(),
    description: description?.trim() || '',
    category: category?.trim() || 'General',
    unit: unit?.trim() || 'Piece',
    imageUrl: imageUrl?.trim() || '',
    price: Math.max(0, Number(price) || 0),
    currentStock: initialStockNum,
    minimumStock: Math.max(0, Number(minimumStock) || 5),
    alternativeProductIds: Array.isArray(alternativeProductIds) ? alternativeProductIds : [],
    createdBy: req.user._id,
  })

  // If initial stock was given, log initial transaction
  if (initialStockNum > 0) {
    await createInventoryLog({
      productId: product._id,
      type: 'STOCK_ADDED',
      quantity: initialStockNum,
      previousStock: 0,
      newStock: initialStockNum,
      performedBy: req.user._id,
      remarks: 'Initial stock creation',
    })
  }

  return sendSuccess(res, {
    message: 'Product created successfully',
    statusCode: HTTP_STATUS.CREATED,
    data: { product },
  })
})

export const getProducts = asyncHandler(async (req, res) => {
  const {
    page = 1,
    limit = 20,
    search,
    category,
    status, // 'active', 'inactive', 'all'
    stockStatus, // 'all', 'low_stock', 'out_of_stock', 'in_stock'
  } = req.query

  const query = {}

  if (status === 'active') query.isActive = true
  else if (status === 'inactive') query.isActive = false

  if (category && category !== 'ALL') {
    query.category = category
  }

  if (search) {
    const regex = new RegExp(search.trim(), 'i')
    query.$or = [{ name: regex }, { sku: regex }, { category: regex }]
  }

  if (stockStatus === 'out_of_stock') {
    query.currentStock = { $lte: 0 }
  } else if (stockStatus === 'low_stock') {
    query.$expr = { $and: [{ $gt: ['$currentStock', 0] }, { $lte: ['$currentStock', '$minimumStock'] }] }
  } else if (stockStatus === 'in_stock') {
    query.$expr = { $gt: ['$currentStock', '$minimumStock'] }
  }

  const skip = (Number(page) - 1) * Number(limit)
  const total = await Product.countDocuments(query)

  const products = await Product.find(query)
    .populate('alternativeProductIds', 'name sku currentStock unit')
    .populate('createdBy', 'fullName email')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean()

  return sendSuccess(res, {
    data: {
      products,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)) || 1,
      },
    },
  })
})

export const getProductById = asyncHandler(async (req, res) => {
  const { id } = req.params
  const product = await Product.findById(id)
    .populate('alternativeProductIds', 'name sku currentStock unit price')
    .populate('createdBy', 'fullName email')
    .lean()

  if (!product) {
    return sendError(res, { message: 'Product not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  // Fetch recent stock history for this product
  const recentTransactions = await InventoryTransaction.find({ productId: id })
    .populate('vendorId', 'fullName phone')
    .populate('performedBy', 'fullName email')
    .sort({ createdAt: -1 })
    .limit(20)
    .lean()

  return sendSuccess(res, {
    data: {
      product,
      recentTransactions,
    },
  })
})

export const updateProduct = asyncHandler(async (req, res) => {
  const { id } = req.params
  const {
    name,
    sku,
    description,
    category,
    unit,
    imageUrl,
    price,
    minimumStock,
    alternativeProductIds,
    isActive,
  } = req.body

  const product = await Product.findById(id)
  if (!product) {
    return sendError(res, { message: 'Product not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  if (sku && sku.trim().toUpperCase() !== product.sku) {
    const existing = await Product.findOne({ sku: sku.trim().toUpperCase(), _id: { $ne: id } })
    if (existing) {
      return sendError(res, { message: `Product with SKU '${sku}' already exists`, statusCode: HTTP_STATUS.CONFLICT })
    }
    product.sku = sku.trim().toUpperCase()
  }

  if (name !== undefined) product.name = name.trim()
  if (description !== undefined) product.description = description.trim()
  if (category !== undefined) product.category = category.trim()
  if (unit !== undefined) product.unit = unit.trim()
  if (imageUrl !== undefined) product.imageUrl = imageUrl.trim()
  if (price !== undefined) product.price = Math.max(0, Number(price) || 0)
  if (minimumStock !== undefined) product.minimumStock = Math.max(0, Number(minimumStock) || 0)
  if (Array.isArray(alternativeProductIds)) product.alternativeProductIds = alternativeProductIds
  if (isActive !== undefined) product.isActive = Boolean(isActive)

  await product.save()

  const updated = await Product.findById(id)
    .populate('alternativeProductIds', 'name sku currentStock unit price')
    .populate('createdBy', 'fullName email')
    .lean()

  return sendSuccess(res, {
    message: 'Product updated successfully',
    data: { product: updated },
  })
})

export const toggleProductStatus = asyncHandler(async (req, res) => {
  const { id } = req.params
  const product = await Product.findById(id)
  if (!product) {
    return sendError(res, { message: 'Product not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  product.isActive = !product.isActive
  await product.save()

  return sendSuccess(res, {
    message: `Product ${product.isActive ? 'activated' : 'deactivated'} successfully`,
    data: { product },
  })
})

export const getProductCategories = asyncHandler(async (req, res) => {
  const categories = await Product.distinct('category', { isActive: true })
  return sendSuccess(res, { data: { categories: categories.filter(Boolean) } })
})
