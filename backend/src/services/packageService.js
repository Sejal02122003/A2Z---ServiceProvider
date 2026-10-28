import mongoose from 'mongoose'
import { ServicePackage } from '../models/ServicePackage.js'
import { LabourService } from '../models/LabourService.js'
import { LabourCategory } from '../models/LabourCategory.js'
import { LabourSubcategory } from '../models/LabourSubcategory.js'

function generateSlug(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Validates and enriches package service inclusions
 */
export async function validateAndEnrichInclusions(inclusions, primarySubcategoryId = null) {
  if (!Array.isArray(inclusions) || inclusions.length === 0) {
    throw new Error('Package must have at least one service inclusion')
  }

  const enrichedInclusions = []
  let calculatedOriginalPrice = 0
  let calculatedDuration = 0
  let resolvedSubcategoryId = primarySubcategoryId

  for (const item of inclusions) {
    const sId = item.serviceId?._id || item.serviceId
    let service = null

    if (sId && mongoose.Types.ObjectId.isValid(sId)) {
      service = await LabourService.findById(sId)
      if (service && !service.isActive) {
        throw new Error(`Service "${service.name}" is currently disabled and cannot be added to a package`)
      }
    }

    const name = (item.name || service?.name || '').trim()
    if (!name) {
      throw new Error('Each inclusion must have a service name')
    }

    const brand = (item.brand || '').trim()
    const quantity = Math.max(1, parseInt(item.quantity, 10) || 1)
    const duration = (item.duration || (service?.estimatedDurationMins ? `${service.estimatedDurationMins} mins` : '')).trim()
    const description = (item.description || service?.description || '').trim()

    if (service) {
      const serviceRate = service.basePrice || service.hourlyPrice || 0
      calculatedOriginalPrice += serviceRate * quantity
      calculatedDuration += (service.estimatedDurationMins || 60) * quantity
      if (!resolvedSubcategoryId && service.subcategoryId) {
        resolvedSubcategoryId = service.subcategoryId
      }
    } else {
      if (duration) {
        const match = String(duration).match(/(\d+)/)
        if (match) {
          calculatedDuration += parseInt(match[1], 10) * quantity
        }
      }
    }

    enrichedInclusions.push({
      serviceId: service?._id || (sId && mongoose.Types.ObjectId.isValid(sId) ? sId : undefined),
      name,
      brand,
      quantity,
      duration,
      description,
    })
  }

  return {
    enrichedInclusions,
    calculatedOriginalPrice,
    calculatedDuration,
    resolvedSubcategoryId,
  }
}

/**
 * Create a new service package (Admin only)
 */
export async function createServicePackage(data, adminUserId) {
  const {
    name,
    description,
    shortDescription = '',
    images = [],
    imageUrl = '',
    categoryId,
    subcategoryId,
    inclusions,
    exclusions = [],
    termsAndConditions = [],
    price,
    originalPrice,
    estimatedDurationMins,
    badge = '',
    status = 'ACTIVE',
    isAllZones = true,
    zones = [],
    validFrom,
    validUntil,
    sortOrder = 0,
  } = data

  if (!name || !name.trim()) throw new Error('Package name is required')
  if (!description || !description.trim()) throw new Error('Package description is required')
  if (!categoryId || !mongoose.Types.ObjectId.isValid(categoryId)) {
    throw new Error('Valid categoryId is required')
  }

  const category = await LabourCategory.findById(categoryId)
  if (!category) throw new Error('Selected Category does not exist')

  const parsedPrice = Number(price)
  if (isNaN(parsedPrice) || parsedPrice < 0) {
    throw new Error('Package price must be a valid positive number')
  }

  // Generate unique slug
  let baseSlug = generateSlug(name)
  let slug = baseSlug
  let counter = 1
  while (await ServicePackage.findOne({ slug })) {
    slug = `${baseSlug}-${counter}`
    counter++
  }

  // Validate and enrich inclusions
  const {
    enrichedInclusions,
    calculatedOriginalPrice,
    calculatedDuration,
    resolvedSubcategoryId,
  } = await validateAndEnrichInclusions(inclusions, subcategoryId)

  const effectiveOriginalPrice = Number(originalPrice) > 0 ? Number(originalPrice) : calculatedOriginalPrice
  const effectiveDuration = Number(estimatedDurationMins) > 0 ? Number(estimatedDurationMins) : calculatedDuration

  let discountPercentage = 0
  if (effectiveOriginalPrice > parsedPrice) {
    discountPercentage = Math.round(((effectiveOriginalPrice - parsedPrice) / effectiveOriginalPrice) * 100)
  }

  const primaryImage = imageUrl || (images.length > 0 ? images[0] : '')

  const pkg = await ServicePackage.create({
    name: name.trim(),
    slug,
    description: description.trim(),
    shortDescription: shortDescription.trim(),
    images: Array.isArray(images) ? images : (primaryImage ? [primaryImage] : []),
    imageUrl: primaryImage,
    categoryId,
    subcategoryId: subcategoryId || resolvedSubcategoryId,
    inclusions: enrichedInclusions,
    exclusions: Array.isArray(exclusions) ? exclusions.map(e => String(e).trim()).filter(Boolean) : [],
    termsAndConditions: Array.isArray(termsAndConditions) ? termsAndConditions.map(t => String(t).trim()).filter(Boolean) : [],
    originalPrice: effectiveOriginalPrice,
    price: parsedPrice,
    discountPercentage,
    estimatedDurationMins: Math.max(15, effectiveDuration),
    badge: badge.trim(),
    status: ['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED'].includes(status) ? status : 'ACTIVE',
    isAllZones: Boolean(isAllZones),
    zones: Array.isArray(zones) ? zones : [],
    validFrom: validFrom ? new Date(validFrom) : undefined,
    validUntil: validUntil ? new Date(validUntil) : undefined,
    sortOrder: Number(sortOrder) || 0,
    createdBy: adminUserId,
    updatedBy: adminUserId,
  })

  return pkg
}

/**
 * Update an existing service package (Admin only)
 */
export async function updateServicePackage(packageId, data, adminUserId) {
  const pkg = await ServicePackage.findById(packageId)
  if (!pkg) throw new Error('Service package not found')

  const update = {}

  if (data.name !== undefined && data.name.trim()) {
    update.name = data.name.trim()
  }

  if (data.description !== undefined && data.description.trim()) {
    update.description = data.description.trim()
  }

  if (data.shortDescription !== undefined) {
    update.shortDescription = data.shortDescription.trim()
  }

  if (data.categoryId !== undefined) {
    if (!mongoose.Types.ObjectId.isValid(data.categoryId)) throw new Error('Invalid category ID')
    const cat = await LabourCategory.findById(data.categoryId)
    if (!cat) throw new Error('Category not found')
    update.categoryId = data.categoryId
  }

  if (data.subcategoryId !== undefined) {
    update.subcategoryId = data.subcategoryId || null
  }

  if (data.images !== undefined) {
    update.images = Array.isArray(data.images) ? data.images : []
    if (update.images.length > 0 && !data.imageUrl) {
      update.imageUrl = update.images[0]
    }
  }

  if (data.imageUrl !== undefined) {
    update.imageUrl = data.imageUrl.trim()
  }

  // Handle inclusions re-validation
  if (data.inclusions !== undefined) {
    const {
      enrichedInclusions,
      calculatedOriginalPrice,
      calculatedDuration,
      resolvedSubcategoryId,
    } = await validateAndEnrichInclusions(data.inclusions, data.subcategoryId || pkg.subcategoryId)

    update.inclusions = enrichedInclusions
    if (!data.originalPrice) {
      update.originalPrice = calculatedOriginalPrice
    }
    if (!data.estimatedDurationMins) {
      update.estimatedDurationMins = calculatedDuration
    }
    if (!update.subcategoryId && !pkg.subcategoryId) {
      update.subcategoryId = resolvedSubcategoryId
    }
  }

  if (data.originalPrice !== undefined) {
    const op = Number(data.originalPrice)
    if (isNaN(op) || op < 0) throw new Error('Invalid originalPrice')
    update.originalPrice = op
  }

  if (data.price !== undefined) {
    const p = Number(data.price)
    if (isNaN(p) || p < 0) throw new Error('Invalid price')
    update.price = p
  }

  // Re-calculate discount percentage if either price or originalPrice changed
  const effectivePrice = update.price !== undefined ? update.price : pkg.price
  const effectiveOriginal = update.originalPrice !== undefined ? update.originalPrice : pkg.originalPrice
  if (effectiveOriginal > effectivePrice) {
    update.discountPercentage = Math.round(((effectiveOriginal - effectivePrice) / effectiveOriginal) * 100)
  } else {
    update.discountPercentage = 0
  }

  if (data.estimatedDurationMins !== undefined) {
    update.estimatedDurationMins = Math.max(15, Number(data.estimatedDurationMins) || 60)
  }

  if (data.exclusions !== undefined) {
    update.exclusions = Array.isArray(data.exclusions) ? data.exclusions.map(e => String(e).trim()).filter(Boolean) : []
  }

  if (data.termsAndConditions !== undefined) {
    update.termsAndConditions = Array.isArray(data.termsAndConditions) ? data.termsAndConditions.map(t => String(t).trim()).filter(Boolean) : []
  }

  if (data.badge !== undefined) {
    update.badge = String(data.badge).trim()
  }

  if (data.status !== undefined) {
    if (!['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED'].includes(data.status)) {
      throw new Error('Invalid package status')
    }
    update.status = data.status
  }

  if (data.isAllZones !== undefined) {
    update.isAllZones = Boolean(data.isAllZones)
  }

  if (data.zones !== undefined) {
    update.zones = Array.isArray(data.zones) ? data.zones : []
  }

  if (data.validFrom !== undefined) {
    update.validFrom = data.validFrom ? new Date(data.validFrom) : null
  }

  if (data.validUntil !== undefined) {
    update.validUntil = data.validUntil ? new Date(data.validUntil) : null
  }

  if (data.sortOrder !== undefined) {
    update.sortOrder = Number(data.sortOrder) || 0
  }

  update.updatedBy = adminUserId

  const updatedPkg = await ServicePackage.findByIdAndUpdate(packageId, { $set: update }, { new: true, runValidators: true })
    .populate('categoryId', 'name slug imageUrl gstPercentage isGstActive')
    .populate('subcategoryId', 'name iconUrl')
    .populate('inclusions.serviceId', 'name basePrice hourlyPrice iconUrl estimatedDurationMins')

  return updatedPkg
}

/**
 * List service packages with filtering, searching, and zone matching
 */
export async function listServicePackages({
  search = '',
  categoryId = null,
  status = null,
  zoneId = null,
  page = 1,
  limit = 20,
  publicOnly = false,
}) {
  const query = {}

  if (publicOnly) {
    query.status = 'ACTIVE'
    const now = new Date()
    query.$and = [
      { $or: [{ validFrom: { $exists: false } }, { validFrom: null }, { validFrom: { $lte: now } }] },
      { $or: [{ validUntil: { $exists: false } }, { validUntil: null }, { validUntil: { $gte: now } }] },
    ]

    if (zoneId) {
      query.$or = [{ isAllZones: true }, { zones: zoneId }]
    }
  } else {
    if (status && status !== 'ALL') {
      query.status = status
    }
  }

  if (categoryId) {
    query.categoryId = categoryId
  }

  if (search && search.trim()) {
    const s = search.trim()
    query.$or = [
      { name: { $regex: s, $options: 'i' } },
      { description: { $regex: s, $options: 'i' } },
      { shortDescription: { $regex: s, $options: 'i' } },
      { badge: { $regex: s, $options: 'i' } },
    ]
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1)
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20))
  const skip = (pageNum - 1) * limitNum

  const [packages, total] = await Promise.all([
    ServicePackage.find(query)
      .populate('categoryId', 'name slug imageUrl gstPercentage isGstActive')
      .populate('subcategoryId', 'name iconUrl')
      .populate('inclusions.serviceId', 'name basePrice hourlyPrice iconUrl estimatedDurationMins')
      .sort({ sortOrder: 1, createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    ServicePackage.countDocuments(query),
  ])

  return {
    packages,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      pages: Math.ceil(total / limitNum) || 1,
    },
  }
}

/**
 * Retrieve a single package by ID or unique slug
 */
export async function getServicePackageByIdOrSlug(idOrSlug, { publicOnly = false, zoneId = null } = {}) {
  const query = mongoose.Types.ObjectId.isValid(idOrSlug) ? { _id: idOrSlug } : { slug: idOrSlug }

  if (publicOnly) {
    query.status = 'ACTIVE'
  }

  const pkg = await ServicePackage.findOne(query)
    .populate('categoryId', 'name slug imageUrl gstPercentage isGstActive')
    .populate('subcategoryId', 'name iconUrl')
    .populate('inclusions.serviceId', 'name basePrice hourlyPrice iconUrl estimatedDurationMins')
    .populate('zones', 'city state')
    .lean()

  if (!pkg) return null

  if (publicOnly) {
    const now = new Date()
    if (pkg.validFrom && new Date(pkg.validFrom) > now) return null
    if (pkg.validUntil && new Date(pkg.validUntil) < now) return null
    if (zoneId && !pkg.isAllZones && Array.isArray(pkg.zones)) {
      const hasZone = pkg.zones.some(z => String(z._id || z) === String(zoneId))
      if (!hasZone) return null
    }
  }

  return pkg
}

/**
 * Delete or soft-archive a service package
 */
export async function deleteServicePackage(packageId, adminUserId) {
  const { Booking } = await import('../models/Booking.js')
  const hasBookings = await Booking.exists({ 'packageBooking.packageId': packageId })

  if (hasBookings) {
    // Soft-archive to preserve historical integrity
    const archived = await ServicePackage.findByIdAndUpdate(
      packageId,
      { $set: { status: 'ARCHIVED', updatedBy: adminUserId } },
      { new: true }
    )
    return { archived: true, deleted: false, package: archived }
  }

  const deleted = await ServicePackage.findByIdAndDelete(packageId)
  return { archived: false, deleted: true, package: deleted }
}
