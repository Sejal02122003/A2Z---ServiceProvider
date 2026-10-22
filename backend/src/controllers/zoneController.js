import { SystemSetting } from '../models/SystemSetting.js'
import { Booking } from '../models/Booking.js'
import { User } from '../models/User.js'
import { Zone } from '../models/Zone.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'

export const getActiveZones = asyncHandler(async (req, res) => {
  const zones = await Zone.find({ isActive: true }).select('name city state country description isActive').sort('name')
  return sendSuccess(res, { data: { zones } })
})

export const getAllZones = asyncHandler(async (req, res) => {
  const { page = 1, limit = 50, search = '' } = req.query
  const query = {}
  
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { city: { $regex: search, $options: 'i' } },
      { state: { $regex: search, $options: 'i' } }
    ]
  }

  const skip = (Number(page) - 1) * Number(limit)
  
  const [zones, total] = await Promise.all([
    Zone.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)),
    Zone.countDocuments(query)
  ])

  return sendSuccess(res, {
    data: {
      zones,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit))
      }
    }
  })
})

export const createZone = asyncHandler(async (req, res) => {
  const { name, country, state, city, isActive, description } = req.body

  if (!name || !country || !state || !city) {
    return sendError(res, { message: 'Missing required fields', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const existingZone = await Zone.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } })
  if (existingZone) {
    return sendError(res, { message: 'Zone with this name already exists', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const newZone = await Zone.create({
    name,
    country,
    state,
    city,
    isActive: isActive ?? true,
    description
  })

  return sendSuccess(res, { message: 'Zone created successfully', data: newZone })
})

export const updateZone = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { name, country, state, city, isActive, description } = req.body

  const zone = await Zone.findById(id)
  if (!zone) {
    return sendError(res, { message: 'Zone not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  if (name && name !== zone.name) {
    const existingZone = await Zone.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } })
    if (existingZone) {
      return sendError(res, { message: 'Zone with this name already exists', statusCode: HTTP_STATUS.BAD_REQUEST })
    }
    zone.name = name
  }

  if (country) zone.country = country
  if (state) zone.state = state
  if (city) zone.city = city
  if (isActive !== undefined) zone.isActive = isActive
  if (description !== undefined) zone.description = description

  await zone.save()

  return sendSuccess(res, { message: 'Zone updated successfully', data: zone })
})

export const toggleZoneStatus = asyncHandler(async (req, res) => {
  const { id } = req.params
  const zone = await Zone.findById(id)
  if (!zone) {
    return sendError(res, { message: 'Zone not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }
  
  zone.isActive = !zone.isActive
  await zone.save()

  return sendSuccess(res, { message: `Zone ${zone.isActive ? 'activated' : 'deactivated'} successfully`, data: zone })
})

export const deleteZone = asyncHandler(async (req, res) => {
  const { id } = req.params
  const zone = await Zone.findById(id)
  if (!zone) {
    return sendError(res, { message: 'Zone not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }
  
  await zone.deleteOne()

  return sendSuccess(res, { message: 'Zone deleted successfully' })
})

export const getZoneSettings = asyncHandler(async (req, res) => {
  let settings = await SystemSetting.findOne({ configKey: 'master_config' })
  if (!settings) {
    settings = await SystemSetting.create({ configKey: 'master_config' })
  }
  return sendSuccess(res, { 
    data: { 
      globalBroadcastRadius: settings.globalBroadcastRadius
    } 
  })
})

export const updateZoneSettings = asyncHandler(async (req, res) => {
  const { globalBroadcastRadius } = req.body

  if (globalBroadcastRadius !== undefined && (typeof globalBroadcastRadius !== 'number' || globalBroadcastRadius < 1)) {
    return sendError(res, { message: 'Invalid radius', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  let settings = await SystemSetting.findOne({ configKey: 'master_config' })
  if (!settings) {
    settings = new SystemSetting({ configKey: 'master_config' })
  }

  if (globalBroadcastRadius !== undefined) settings.globalBroadcastRadius = globalBroadcastRadius

  settings.updatedBy = req.user._id
  await settings.save()

  return sendSuccess(res, { 
    message: 'Radius updated successfully', 
    data: { 
      globalBroadcastRadius: settings.globalBroadcastRadius
    } 
  })
})

export const getZoneStatistics = asyncHandler(async (req, res) => {
  // Aggregate stats from Bookings
  const stats = await Booking.aggregate([
    {
      $group: {
        _id: null,
        totalBookings: { $sum: 1 },
        totalEligibleLabourers: { $sum: '$eligibleLabourCount' },
        bookingsWithNoLabourers: {
          $sum: { $cond: [{ $eq: ['$eligibleLabourCount', 0] }, 1, 0] }
        },
        avgRadius: { $avg: '$broadcastRadius' }
      }
    }
  ])

  // Count active labourers in the system
  const activeLabourCount = await User.countDocuments({
    role: { $in: ['LABOUR', 'INDIVIDUAL'] },
    isActive: true,
    'labourProfile.availabilityStatus': 'available'
  })

  const result = stats[0] || {
    totalBookings: 0,
    totalEligibleLabourers: 0,
    bookingsWithNoLabourers: 0,
    avgRadius: 0
  }

  const broadcastSuccessRate = result.totalBookings > 0 
    ? ((result.totalBookings - result.bookingsWithNoLabourers) / result.totalBookings) * 100 
    : 0

  return sendSuccess(res, {
    data: {
      totalBookings: result.totalBookings,
      totalEligibleLabourers: result.totalEligibleLabourers,
      bookingsWithNoLabourers: result.bookingsWithNoLabourers,
      avgRadius: result.avgRadius ? Math.round(result.avgRadius * 100) / 100 : 0,
      broadcastSuccessRate: Math.round(broadcastSuccessRate * 100) / 100,
      activeLabourCount
    }
  })
})

export const updateLabourLocation = asyncHandler(async (req, res) => {
  const { latitude, longitude } = req.body

  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return sendError(res, { message: 'Invalid coordinates', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const user = await User.findById(req.user._id)
  if (!user || !['labour', 'contractor'].includes(String(user.role).toLowerCase())) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  if (!user.labourProfile) {
    user.labourProfile = {}
  }

  user.labourProfile.currentLatitude = latitude
  user.labourProfile.currentLongitude = longitude
  user.labourProfile.lastLocationUpdatedAt = new Date()

  await user.save()

  return sendSuccess(res, { message: 'Location updated successfully' })
})

export const updateLabourStatus = asyncHandler(async (req, res) => {
  const { availabilityStatus } = req.body

  if (!['available', 'busy', 'offline'].includes(availabilityStatus)) {
    return sendError(res, { message: 'Invalid status. Must be available, busy, or offline', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const user = await User.findById(req.user._id)
  if (!user || !['labour', 'contractor'].includes(String(user.role).toLowerCase())) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  if (!user.labourProfile) {
    user.labourProfile = {}
  }

  user.labourProfile.availabilityStatus = availabilityStatus
  await user.save()

  return sendSuccess(res, { message: `Status updated to ${availabilityStatus}` })
})
