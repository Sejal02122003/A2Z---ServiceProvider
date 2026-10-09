import { SimulatedOpportunity } from '../models/SimulatedOpportunity.js'
import { SystemSetting } from '../models/SystemSetting.js'
import { User } from '../models/User.js'
import { InAppNotification } from '../models/InAppNotification.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { emitToUser } from '../socket.js'
import { sendNotificationToUser } from '../utils/pushNotificationHelper.js'

/**
 * 1. Admin: Get Global Setting
 */
export const getSimulatedSettings = asyncHandler(async (req, res) => {
  const setting = await SystemSetting.findOne({ configKey: 'master_config' })
  const enabled = setting ? Boolean(setting.simulatedOpportunitiesEnabled ?? true) : true
  return sendSuccess(res, { data: { enabled } })
})

/**
 * 2. Admin: Update Global Setting (Toggle ON / OFF)
 */
export const updateSimulatedSettings = asyncHandler(async (req, res) => {
  const { enabled } = req.body
  if (typeof enabled !== 'boolean') {
    return sendError(res, {
      message: 'Invalid request: enabled boolean required',
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
  }

  let setting = await SystemSetting.findOne({ configKey: 'master_config' })
  if (!setting) {
    setting = new SystemSetting({ configKey: 'master_config' })
  }

  setting.simulatedOpportunitiesEnabled = enabled
  setting.updatedBy = req.user._id
  await setting.save()

  console.log(`[SIMULATED_OPPORTUNITY_SETTING_UPDATED] Status set to: ${enabled ? 'ON' : 'OFF'} by ${req.user._id}`)
  return sendSuccess(res, {
    message: `Simulated opportunity alerts turned ${enabled ? 'ON' : 'OFF'}`,
    data: { enabled: setting.simulatedOpportunitiesEnabled },
  })
})

/**
 * 3. Admin: Create Simulated Opportunity
 */
export const createSimulatedOpportunity = asyncHandler(async (req, res) => {
  // Verify Global Setting
  const setting = await SystemSetting.findOne({ configKey: 'master_config' })
  const isEnabled = setting ? Boolean(setting.simulatedOpportunitiesEnabled ?? true) : true

  if (!isEnabled) {
    return sendError(res, {
      message: 'Simulated opportunity alerts are currently disabled by global setting.',
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
  }

  const {
    serviceCategory,
    serviceType,
    categoryId,
    subcategoryId,
    location,
    serviceDate,
    serviceTime,
    estimatedAmount,
    notifyVendorCount = 10,
    expiryMinutes = 10,
    priority = 'NORMAL',
  } = req.body

  if (!serviceCategory || !serviceType || estimatedAmount == null) {
    return sendError(res, {
      message: 'Service category, service type, and estimated amount are required.',
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
  }

  const numAmount = Number(estimatedAmount)
  if (isNaN(numAmount) || numAmount < 0) {
    return sendError(res, {
      message: 'Valid estimated amount is required.',
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
  }

  const numVendorCount = Math.max(1, Math.min(100, Number(notifyVendorCount) || 10))
  const numExpiryMinutes = Math.max(1, Math.min(1440, Number(expiryMinutes) || 10))

  // Find eligible vendors/labourers
  const vendorQuery = {
    role: { $in: ['labour', 'contractor'] },
    isBlocked: { $ne: true },
  }

  if (subcategoryId) {
    vendorQuery['labourProfile.subcategoryIds'] = subcategoryId
  } else if (categoryId) {
    vendorQuery['labourProfile.categoryIds'] = categoryId
  }

  let eligibleVendors = await User.find(vendorQuery)
    .select('_id fullName phone role labourProfile')
    .limit(numVendorCount * 2)
    .lean()

  // Fallback if category matching yields fewer vendors
  if (eligibleVendors.length === 0) {
    eligibleVendors = await User.find({
      role: { $in: ['labour', 'contractor'] },
      isBlocked: { $ne: true },
    })
      .select('_id fullName phone role labourProfile')
      .limit(numVendorCount)
      .lean()
  }

  const targetVendors = eligibleVendors.slice(0, numVendorCount)
  const targetVendorIds = targetVendors.map((v) => v._id)

  const expiresAt = new Date(Date.now() + numExpiryMinutes * 60 * 1000)

  const opportunity = await SimulatedOpportunity.create({
    bookingType: 'SIMULATED',
    isSimulated: true,
    serviceCategory,
    serviceType,
    categoryId: categoryId || null,
    subcategoryId: subcategoryId || null,
    location: {
      address: location?.address || 'City Area',
      city: location?.city || '',
      latitude: location?.latitude || null,
      longitude: location?.longitude || null,
    },
    serviceDate: serviceDate ? new Date(serviceDate) : new Date(),
    serviceTime: serviceTime || 'Immediate / Flexible',
    estimatedAmount: numAmount,
    targetVendorCount: targetVendorIds.length,
    notifiedVendors: targetVendorIds,
    priority,
    createdBy: req.user._id,
    expiresAt,
    status: 'OPEN',
  })

  console.log(`[SIMULATED_OPPORTUNITY_CREATED] ID: ${opportunity._id} | Service: ${serviceCategory} - ${serviceType} | Amount: ₹${numAmount} | Vendors: ${targetVendorIds.length}`)

  // Dispatch real-time Socket and Push Notifications to all notified vendors
  const alertPayload = {
    opportunityId: opportunity._id,
    alertId: opportunity._id,
    bookingType: 'SIMULATED',
    isSimulated: true,
    serviceCategory: opportunity.serviceCategory,
    serviceType: opportunity.serviceType,
    location: opportunity.location,
    serviceDate: opportunity.serviceDate,
    serviceTime: opportunity.serviceTime,
    estimatedAmount: opportunity.estimatedAmount,
    expiresAt: opportunity.expiresAt,
    timeoutMs: 15000, // 15-second countdown alert
    priority: opportunity.priority,
  }

  targetVendorIds.forEach(async (vendorId) => {
    try {
      emitToUser(vendorId, 'SIMULATED_OPPORTUNITY_ALERT', alertPayload)

      // Persistent In-App Notification
      try {
        await InAppNotification.create({
          recipientId: vendorId,
          recipientRole: 'VENDOR',
          title: `⚡ Urgent Lead: ${serviceType} (₹${numAmount})`,
          body: `New incoming booking available near you. Estimated earning: ₹${numAmount}. Respond quickly!`,
          type: 'SIMULATED_OPPORTUNITY',
          metadata: {
            opportunityId: String(opportunity._id),
            serviceType,
            estimatedAmount: numAmount,
          },
        })
      } catch (inAppErr) {
        console.warn(`[InAppNotification Error for ${vendorId}]`, inAppErr?.message)
      }

      // Firebase Push Notification
      sendNotificationToUser(vendorId, {
        title: `⚡ New Booking Alert! (₹${numAmount})`,
        body: `${serviceType} lead nearby. Open app now to claim before other partners!`,
        data: {
          type: 'SIMULATED_OPPORTUNITY',
          opportunityId: String(opportunity._id),
          serviceType: String(serviceType),
          estimatedAmount: String(numAmount),
          click_action: '/app/labour',
        },
      }).catch((err) => console.error(`[Push Notification Error for ${vendorId}]`, err?.message))
    } catch (err) {
      console.error(`[Socket Error for vendor ${vendorId}]`, err?.message)
    }
  })

  console.log(`[SIMULATED_OPPORTUNITY_SENT] Sent alert #${opportunity._id} to ${targetVendorIds.length} vendors.`)

  return sendSuccess(res, {
    statusCode: HTTP_STATUS.CREATED,
    message: `Simulated opportunity created and sent to ${targetVendorIds.length} vendors.`,
    data: { opportunity },
  })
})

/**
 * 4. Admin: List All Simulated Opportunities (with automatic expiry updates)
 */
export const getAdminSimulatedOpportunities = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query
  const query = {}

  if (status && status !== 'ALL') {
    query.status = status
  }

  // Automatically update status to EXPIRED for past due open opportunities
  await SimulatedOpportunity.updateMany(
    { status: 'OPEN', expiresAt: { $lt: new Date() } },
    { $set: { status: 'EXPIRED' } }
  )

  const skip = (Number(page) - 1) * Number(limit)
  const [opportunities, total] = await Promise.all([
    SimulatedOpportunity.find(query)
      .populate('createdBy', 'fullName email')
      .populate('acceptedBy', 'fullName phone email')
      .populate('notifiedVendors', 'fullName phone')
      .populate('vendorResponses.vendorId', 'fullName phone')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean(),
    SimulatedOpportunity.countDocuments(query),
  ])

  return sendSuccess(res, {
    data: {
      opportunities,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)),
      },
    },
  })
})

/**
 * 5. Admin: Get Single Simulated Opportunity Detail
 */
export const getAdminSimulatedOpportunityById = asyncHandler(async (req, res) => {
  const { id } = req.params
  const opportunity = await SimulatedOpportunity.findById(id)
    .populate('createdBy', 'fullName email')
    .populate('acceptedBy', 'fullName phone email')
    .populate('notifiedVendors', 'fullName phone')
    .populate('vendorResponses.vendorId', 'fullName phone')
    .lean()

  if (!opportunity) {
    return sendError(res, {
      message: 'Simulated opportunity not found',
      statusCode: HTTP_STATUS.NOT_FOUND,
    })
  }

  return sendSuccess(res, { data: { opportunity } })
})

/**
 * 6. Admin: Cancel Simulated Opportunity
 */
export const cancelSimulatedOpportunity = asyncHandler(async (req, res) => {
  const { id } = req.params

  const opportunity = await SimulatedOpportunity.findOneAndUpdate(
    { _id: id, status: 'OPEN' },
    { $set: { status: 'CANCELLED' } },
    { new: true }
  )

  if (!opportunity) {
    const existing = await SimulatedOpportunity.findById(id)
    if (!existing) {
      return sendError(res, { message: 'Opportunity not found', statusCode: HTTP_STATUS.NOT_FOUND })
    }
    if (existing.status === 'ACCEPTED') {
      return sendError(res, {
        message: 'Cannot cancel: This opportunity has already been accepted by a vendor.',
        statusCode: HTTP_STATUS.BAD_REQUEST,
      })
    }
    return sendError(res, {
      message: `Opportunity cannot be cancelled (current status: ${existing.status}).`,
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
  }

  console.log(`[SIMULATED_OPPORTUNITY_CANCELLED] ID: ${id} by Admin ${req.user._id}`)

  // Broadcast cancellation to notified vendors
  opportunity.notifiedVendors.forEach((vendorId) => {
    emitToUser(vendorId, 'SIMULATED_OPPORTUNITY_CANCELLED', {
      opportunityId: opportunity._id,
      message: 'This opportunity has been cancelled by admin.',
    })
  })

  return sendSuccess(res, {
    message: 'Simulated opportunity cancelled successfully.',
    data: { opportunity },
  })
})

/**
 * 7. Vendor: Get Open Simulated Opportunities Available to This Vendor
 */
export const getVendorSimulatedOpportunities = asyncHandler(async (req, res) => {
  const vendorId = req.user._id

  // Auto-expire past open opportunities
  await SimulatedOpportunity.updateMany(
    { status: 'OPEN', expiresAt: { $lt: new Date() } },
    { $set: { status: 'EXPIRED' } }
  )

  const opportunities = await SimulatedOpportunity.find({
    notifiedVendors: vendorId,
    status: { $in: ['OPEN', 'ACCEPTED'] },
    'vendorResponses.vendorId': { $ne: vendorId }, // Exclude if this vendor rejected it
  })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean()

  return sendSuccess(res, { data: { opportunities } })
})

/**
 * 8. Vendor: Get Single Opportunity Detail & Log VIEWED
 */
export const getVendorSimulatedOpportunityById = asyncHandler(async (req, res) => {
  const { id } = req.params
  const vendorId = req.user._id

  const opportunity = await SimulatedOpportunity.findOne({
    _id: id,
    notifiedVendors: vendorId,
  }).lean()

  if (!opportunity) {
    return sendError(res, {
      message: 'Opportunity not found or you are not authorized.',
      statusCode: HTTP_STATUS.NOT_FOUND,
    })
  }

  // Record VIEWED if not already recorded
  const hasViewed = opportunity.vendorResponses?.some(
    (r) => String(r.vendorId) === String(vendorId)
  )

  if (!hasViewed) {
    await SimulatedOpportunity.findByIdAndUpdate(id, {
      $push: {
        vendorResponses: {
          vendorId,
          response: 'VIEWED',
          respondedAt: new Date(),
        },
      },
    })
    console.log(`[SIMULATED_OPPORTUNITY_VIEWED] ID: ${id} by Vendor ${vendorId}`)
  }

  return sendSuccess(res, { data: { opportunity } })
})

/**
 * 9. Vendor: Accept Simulated Opportunity (First Vendor Action Wins - Atomic Race Protection)
 */
export const acceptSimulatedOpportunity = asyncHandler(async (req, res) => {
  const { id } = req.params
  const vendorId = req.user._id

  // Check global setting
  const setting = await SystemSetting.findOne({ configKey: 'master_config' })
  const isEnabled = setting ? Boolean(setting.simulatedOpportunitiesEnabled ?? true) : true

  if (!isEnabled) {
    return sendError(res, {
      message: 'Simulated opportunities are currently unavailable.',
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
  }

  const now = new Date()

  // ATOMIC CONDITIONAL UPDATE: First vendor to click wins
  const opportunity = await SimulatedOpportunity.findOneAndUpdate(
    {
      _id: id,
      status: 'OPEN',
      expiresAt: { $gt: now },
      notifiedVendors: vendorId,
    },
    {
      $set: {
        status: 'ACCEPTED',
        acceptedBy: vendorId,
        acceptedAt: now,
      },
    },
    { new: true }
  ).populate('acceptedBy', 'fullName phone name')

  // If atomic update returned null, find out why to give the exact error
  if (!opportunity) {
    const existing = await SimulatedOpportunity.findById(id)

    if (!existing) {
      return sendError(res, { message: 'Opportunity not found.', statusCode: HTTP_STATUS.NOT_FOUND })
    }

    if (!existing.notifiedVendors.some((vid) => String(vid) === String(vendorId))) {
      return sendError(res, {
        message: 'You are not authorized to access this opportunity.',
        statusCode: HTTP_STATUS.FORBIDDEN,
      })
    }

    if (existing.status === 'ACCEPTED') {
      return sendError(res, {
        message: 'This opportunity has already been taken by another vendor.',
        statusCode: HTTP_STATUS.CONFLICT,
      })
    }

    if (existing.status === 'CANCELLED') {
      return sendError(res, {
        message: 'This opportunity has been cancelled by admin.',
        statusCode: HTTP_STATUS.BAD_REQUEST,
      })
    }

    if (existing.status === 'EXPIRED' || existing.expiresAt <= now) {
      if (existing.status !== 'EXPIRED') {
        existing.status = 'EXPIRED'
        await existing.save()
      }
      return sendError(res, {
        message: 'This opportunity has expired.',
        statusCode: HTTP_STATUS.BAD_REQUEST,
      })
    }

    return sendError(res, {
      message: 'This opportunity is no longer available.',
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
  }

  console.log(`[SIMULATED_OPPORTUNITY_ACCEPTED] ID: ${id} WON by Vendor ${vendorId} (${opportunity.acceptedBy?.fullName || 'Vendor'})`)

  // Notify all other notified vendors that the opportunity is already taken
  const winningVendorName = opportunity.acceptedBy?.fullName || 'Another vendor'
  opportunity.notifiedVendors.forEach((notifiedId) => {
    if (String(notifiedId) !== String(vendorId)) {
      emitToUser(notifiedId, 'SIMULATED_OPPORTUNITY_TAKEN', {
        opportunityId: opportunity._id,
        message: 'This opportunity has already been taken.',
        acceptedBy: winningVendorName,
      })
    }
  })

  return sendSuccess(res, {
    message: 'Opportunity accepted successfully! You secured this opportunity.',
    data: { opportunity },
  })
})

/**
 * 10. Vendor: Reject Simulated Opportunity
 */
export const rejectSimulatedOpportunity = asyncHandler(async (req, res) => {
  const { id } = req.params
  const vendorId = req.user._id

  const opportunity = await SimulatedOpportunity.findById(id)
  if (!opportunity) {
    return sendError(res, { message: 'Opportunity not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  // Record rejection
  const existingResp = opportunity.vendorResponses?.find(
    (r) => String(r.vendorId) === String(vendorId)
  )

  if (existingResp) {
    existingResp.response = 'REJECTED'
    existingResp.respondedAt = new Date()
  } else {
    opportunity.vendorResponses.push({
      vendorId,
      response: 'REJECTED',
      respondedAt: new Date(),
    })
  }

  await opportunity.save()
  console.log(`[SIMULATED_OPPORTUNITY_REJECTED] ID: ${id} by Vendor ${vendorId}`)

  return sendSuccess(res, {
    message: 'Opportunity rejected.',
  })
})
