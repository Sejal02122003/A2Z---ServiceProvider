import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { Zone } from '../models/Zone.js'
import * as packageService from '../services/packageService.js'

/**
 * GET /api/packages
 * Public / customer discovery endpoint for active service packages
 */
export const getPublicServicePackages = asyncHandler(async (req, res) => {
  const { categoryId, search, city, lat, lng, page = 1, limit = 20 } = req.query

  let matchedZoneId = null
  if (city || (lat && lng)) {
    const activeZones = await Zone.find({ isActive: true }).lean()
    if (city) {
      const z = activeZones.find(item => item.city.toLowerCase() === String(city).trim().toLowerCase())
      if (z) matchedZoneId = z._id
    }
  }

  const result = await packageService.listServicePackages({
    search,
    categoryId,
    zoneId: matchedZoneId,
    page,
    limit,
    publicOnly: true,
  })

  return sendSuccess(res, { data: result })
})

/**
 * GET /api/packages/:idOrSlug
 * Public / customer endpoint for package details
 */
export const getPublicServicePackageDetails = asyncHandler(async (req, res) => {
  const { idOrSlug } = req.params
  const { city } = req.query

  let matchedZoneId = null
  if (city) {
    const activeZones = await Zone.find({ isActive: true }).lean()
    const z = activeZones.find(item => item.city.toLowerCase() === String(city).trim().toLowerCase())
    if (z) matchedZoneId = z._id
  }

  const pkg = await packageService.getServicePackageByIdOrSlug(idOrSlug, {
    publicOnly: true,
    zoneId: matchedZoneId,
  })

  if (!pkg) {
    return sendError(res, {
      message: 'Service package not found or currently unavailable',
      statusCode: HTTP_STATUS.NOT_FOUND,
    })
  }

  return sendSuccess(res, { data: { package: pkg } })
})

/**
 * GET /api/admin/packages
 * Admin endpoint to list and manage all packages
 */
export const getAdminServicePackages = asyncHandler(async (req, res) => {
  const { categoryId, status, search, page = 1, limit = 20 } = req.query

  const result = await packageService.listServicePackages({
    search,
    categoryId,
    status,
    page,
    limit,
    publicOnly: false,
  })

  return sendSuccess(res, { data: result })
})

/**
 * GET /api/admin/packages/:id
 * Admin endpoint for package details
 */
export const getAdminServicePackageDetails = asyncHandler(async (req, res) => {
  const { id } = req.params

  const pkg = await packageService.getServicePackageByIdOrSlug(id, {
    publicOnly: false,
  })

  if (!pkg) {
    return sendError(res, {
      message: 'Service package not found',
      statusCode: HTTP_STATUS.NOT_FOUND,
    })
  }

  return sendSuccess(res, { data: { package: pkg } })
})

/**
 * POST /api/admin/packages
 * Admin endpoint to create a service package
 */
export const createAdminServicePackage = asyncHandler(async (req, res) => {
  const pkg = await packageService.createServicePackage(req.body, req.user._id)

  return sendSuccess(res, {
    message: 'Service package created successfully',
    statusCode: HTTP_STATUS.CREATED,
    data: { package: pkg },
  })
})

/**
 * PUT /api/admin/packages/:id
 * Admin endpoint to update a service package
 */
export const updateAdminServicePackage = asyncHandler(async (req, res) => {
  const { id } = req.params
  const pkg = await packageService.updateServicePackage(id, req.body, req.user._id)

  return sendSuccess(res, {
    message: 'Service package updated successfully',
    data: { package: pkg },
  })
})

/**
 * PATCH /api/admin/packages/:id/status
 * Admin endpoint to quickly change package status
 */
export const changeAdminPackageStatus = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { status } = req.body

  if (!['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED'].includes(status)) {
    return sendError(res, {
      message: 'Status must be DRAFT, ACTIVE, INACTIVE, or ARCHIVED',
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
  }

  const pkg = await packageService.updateServicePackage(id, { status }, req.user._id)

  return sendSuccess(res, {
    message: `Package status updated to ${status}`,
    data: { package: pkg },
  })
})

/**
 * DELETE /api/admin/packages/:id
 * Admin endpoint to delete or archive package
 */
export const deleteAdminServicePackage = asyncHandler(async (req, res) => {
  const { id } = req.params
  const result = await packageService.deleteServicePackage(id, req.user._id)

  return sendSuccess(res, {
    message: result.archived
      ? 'Package has historical bookings and was safely archived'
      : 'Service package deleted successfully',
    data: result,
  })
})
