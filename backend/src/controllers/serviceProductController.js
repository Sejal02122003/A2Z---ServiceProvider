import { ServiceProduct } from '../models/ServiceProduct.js'
import { LabourService } from '../models/LabourService.js'
import { Product } from '../models/Product.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'

export const addServiceProductMapping = asyncHandler(async (req, res) => {
  const { serviceId } = req.params
  const { productId, quantityRequired = 1, unit, isMandatory = true, isActive = true } = req.body

  if (!productId || !serviceId) {
    return sendError(res, { message: 'Service ID and Product ID are required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const service = await LabourService.findById(serviceId)
  if (!service) {
    return sendError(res, { message: 'Service not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  const product = await Product.findById(productId)
  if (!product) {
    return sendError(res, { message: 'Product not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  const qty = Math.max(0.01, Number(quantityRequired) || 1)
  const resolvedUnit = unit?.trim() || product.unit || 'Piece'

  // Upsert or create
  const mapping = await ServiceProduct.findOneAndUpdate(
    { serviceId, productId },
    {
      quantityRequired: qty,
      unit: resolvedUnit,
      isMandatory: Boolean(isMandatory),
      isActive: Boolean(isActive),
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).populate('productId')

  return sendSuccess(res, {
    message: 'Product mapped to service successfully',
    statusCode: HTTP_STATUS.CREATED,
    data: { mapping },
  })
})

export const getServiceProductMappings = asyncHandler(async (req, res) => {
  const { serviceId } = req.params

  const mappings = await ServiceProduct.find({ serviceId })
    .populate({
      path: 'productId',
      populate: { path: 'alternativeProductIds', select: 'name sku currentStock unit' },
    })
    .sort({ createdAt: 1 })
    .lean()

  return sendSuccess(res, {
    data: { mappings },
  })
})

export const updateServiceProductMapping = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { quantityRequired, unit, isMandatory, isActive } = req.body

  const mapping = await ServiceProduct.findById(id)
  if (!mapping) {
    return sendError(res, { message: 'Mapping not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  if (quantityRequired !== undefined) {
    mapping.quantityRequired = Math.max(0.01, Number(quantityRequired) || 1)
  }
  if (unit !== undefined) mapping.unit = unit.trim()
  if (isMandatory !== undefined) mapping.isMandatory = Boolean(isMandatory)
  if (isActive !== undefined) mapping.isActive = Boolean(isActive)

  await mapping.save()
  const updated = await ServiceProduct.findById(id).populate('productId').lean()

  return sendSuccess(res, {
    message: 'Service product mapping updated successfully',
    data: { mapping: updated },
  })
})

export const deleteServiceProductMapping = asyncHandler(async (req, res) => {
  const { id } = req.params
  const mapping = await ServiceProduct.findByIdAndDelete(id)

  if (!mapping) {
    return sendError(res, { message: 'Mapping not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  return sendSuccess(res, {
    message: 'Service product mapping removed successfully',
  })
})

export const getAllServiceProductMappings = asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, serviceId, search } = req.query
  const query = {}

  if (serviceId) query.serviceId = serviceId

  const skip = (Number(page) - 1) * Number(limit)
  const total = await ServiceProduct.countDocuments(query)

  const mappings = await ServiceProduct.find(query)
    .populate({
      path: 'serviceId',
      select: 'name basePrice subcategoryId',
      populate: { path: 'subcategoryId', select: 'name' },
    })
    .populate('productId')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean()

  return sendSuccess(res, {
    data: {
      mappings,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)) || 1,
      },
    },
  })
})
