import { Booking } from '../models/Booking.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { KYC_STATUS } from '../constants/roles.js'
import { BROADCAST_TIMEOUT_MS } from '../services/broadcastService.js'
import { getLabourStats } from '../services/labourStatsService.js'

function formatDurationHuman(mins) {
  const m = Math.max(1, Math.round(Number(mins) || 45))
  const hrs = Math.floor(m / 60)
  const remainingMins = m % 60
  if (hrs > 0 && remainingMins > 0) {
    return `${hrs} hr ${remainingMins} mins (${m} mins)`
  }
  if (hrs > 0 && remainingMins === 0) {
    return `${hrs} hr${hrs > 1 ? 's' : ''} (${m} mins)`
  }
  return `${m} mins`
}

/**
 * Validate that labour can receive/accept bookings.
 * Chain: KYC approved → trial OR subscription active → within hours → available
 */
async function validateLabourBookingAccess(labour) {
  const { SystemSetting } = await import('../models/SystemSetting.js')
  const { UserSubscription } = await import('../models/UserSubscription.js')

  // 1. Account status check
  const isSuspendedOrRejected =
    labour.identityStatus === 'SUSPENDED' || labour.identityStatus === 'REJECTED' || labour.vendorStatus === 'BLOCKED'

  if (isSuspendedOrRejected) {
    return {
      allowed: false,
      code: 'KYC_NOT_APPROVED',
      message: 'Account is suspended or rejected. Cannot receive bookings.',
    }
  }

  const settings = await SystemSetting.findOne({ configKey: 'master_config' })
  const isSubEnabled = settings?.isUserSubscriptionEnabled ?? true
  const startHour = settings?.subscriptionStartHour ?? 8
  const endHour = settings?.subscriptionEndHour ?? 20

  // 2. Check free trial
  const trialEndsAt = labour.labourProfile?.trialEndsAt
  const now = new Date()
  const inTrial = trialEndsAt && new Date(trialEndsAt) > now

  // 3. If subscription feature is disabled — skip subscription check
  if (!isSubEnabled || inTrial) {
    return { allowed: true }
  }

  // 4. Check today's subscription
  const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const subscription = await UserSubscription.findOne({ 
    labour: labour._id, 
    status: 'active',
    date: { $lte: todayIST },
    endDate: { $gte: todayIST }
  })

  if (!subscription) {
    return {
      allowed: false,
      code: 'SUBSCRIPTION_REQUIRED',
      message: 'Daily subscription required to receive bookings.',
    }
  }

  // 5. Check operating window
  const currentHour = parseInt(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false })
  )
  if (currentHour < startHour || currentHour >= endHour) {
    return {
      allowed: false,
      code: 'OUTSIDE_OPERATING_HOURS',
      message: `Bookings are only available between ${startHour}:00 and ${endHour}:00.`,
    }
  }

  return { allowed: true, subscription }
}

export const acceptBroadcast = asyncHandler(async (req, res) => {
  const { bookingId } = req.params
  const labour = req.user

  // Subscription validation chain
  const accessCheck = await validateLabourBookingAccess(labour)
  if (!accessCheck.allowed) {
    return sendError(res, {
      message: accessCheck.message,
      statusCode: HTTP_STATUS.FORBIDDEN,
      code: accessCheck.code,
    })
  }

  // Fetch booking first (can be BROADCASTING or PARTIALLY_ACCEPTED for multi-service)
  let booking = await Booking.findOne({ _id: bookingId, status: { $in: ['BROADCASTING', 'PARTIALLY_ACCEPTED'] } })
  
  if (!booking) {
    const currentBooking = await Booking.findById(bookingId)
    if (!currentBooking) {
      return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })
    }
    if (currentBooking.status === 'ACCEPTED') {
      return sendError(res, { message: 'Booking was already fully accepted', statusCode: HTTP_STATUS.CONFLICT })
    }
    if (currentBooking.status === 'CANCELLED') {
      return sendError(res, { message: 'Booking was cancelled by the customer', statusCode: HTTP_STATUS.BAD_REQUEST })
    }
    return sendError(res, {
      message: `Cannot accept booking. Current status is ${currentBooking.status}`,
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
  }

  // Wallet Eligibility Check
  const { checkLabourBookingEligibility, reserveCashBookingCharges } = await import('../services/labourWalletService.js')
  if (booking.paymentMethod === 'CASH') {
    const walletCheck = await checkLabourBookingEligibility({ labourId: labour._id, booking })
    if (!walletCheck.eligible && walletCheck.code === 'WALLET_INACTIVE') {
      return sendError(res, {
        message: walletCheck.reason,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: walletCheck.code,
      })
    }
  }

  // Concurrency-safe reservation for cash bookings
  if (booking.paymentMethod === 'CASH') {
    const reserveResult = await reserveCashBookingCharges({ labourId: labour._id, booking })
    if (!reserveResult.reserved) {
      return sendError(res, {
        message: reserveResult.message || 'Insufficient available wallet balance to accept this booking.',
        statusCode: HTTP_STATUS.CONFLICT,
        code: 'CONCURRENT_WALLET_HOLD_FAILED',
      })
    }
  }

  // Check if labourer already accepted
  if (booking.acceptedLabourIds && booking.acceptedLabourIds.includes(labour._id)) {
    return sendError(res, { message: 'You have already accepted this booking', statusCode: HTTP_STATUS.CONFLICT })
  }

  // === Service Assignment Logic ===
  let assignedServiceId = booking.serviceId
  let assignedPricePerHour = 0
  let assignedServiceName = ''
  let assignedLabourShare = 0

  const isMultiServiceBooking = Boolean(booking.multiServiceBooking?.isMultiService && booking.multiServiceBooking.items?.length > 0)
  const isContractorBooking = booking.contractorInfo?.services?.length > 0

  let chosenMultiItem = null

  if (isMultiServiceBooking) {
    const openItems = booking.multiServiceBooking.items.filter(it => it.status === 'PENDING')
    if (openItems.length === 0) {
      return sendError(res, { message: 'All service slots for this booking are already filled', statusCode: HTTP_STATUS.CONFLICT })
    }

    const fullLabour = await (await import('../models/User.js')).User.findById(labour._id).lean()
    const labourServiceIds = (fullLabour?.labourProfile?.serviceIds || []).map(id => String(id))
    const labourSubcatIds = (fullLabour?.labourProfile?.subcategoryIds || []).map(id => String(id))

    // Match open items against provider skills
    const matchingOpen = openItems.filter(it => 
      labourServiceIds.includes(String(it.serviceId)) ||
      (it.subcategoryId && labourSubcatIds.includes(String(it.subcategoryId)))
    )

    const chosenItemId = req.body?.itemId ? String(req.body.itemId) : null
    const chosenServiceId = req.body?.serviceId ? String(req.body.serviceId) : null

    if (chosenItemId) {
      chosenMultiItem = openItems.find(it => String(it._id) === chosenItemId)
    } else if (chosenServiceId) {
      chosenMultiItem = openItems.find(it => String(it.serviceId) === chosenServiceId)
    } else if (matchingOpen.length > 0) {
      chosenMultiItem = matchingOpen[0]
    } else {
      chosenMultiItem = openItems[0]
    }

    if (!chosenMultiItem) {
      return sendError(res, { message: 'Selected service item is no longer available', statusCode: HTTP_STATUS.BAD_REQUEST })
    }

    assignedServiceId = chosenMultiItem.serviceId
    assignedPricePerHour = chosenMultiItem.unitPrice || 0
    assignedServiceName = chosenMultiItem.subServiceName ? `${chosenMultiItem.serviceName} (${chosenMultiItem.subServiceName})` : chosenMultiItem.serviceName
    assignedLabourShare = Math.round(chosenMultiItem.itemTotal * 0.90)
  } else if (isContractorBooking) {
    const currentAssignments = booking.assignments || []
    const { LabourService } = await import('../models/LabourService.js')

    // Labour's registered service IDs
    const fullLabour = await (await import('../models/User.js')).User.findById(labour._id).lean()
    const labourServiceIds = (fullLabour?.labourProfile?.serviceIds || []).map(id => String(id))

    // The serviceId explicitly chosen by the labour from the popup (if multi-match)
    const chosenServiceId = req.body?.serviceId ? String(req.body.serviceId) : null

    // Build open slot map for contractor services
    const openServices = booking.contractorInfo.services.filter(s => {
      const filled = currentAssignments.filter(a => String(a.serviceId) === String(s.serviceId)).length
      return filled < (s.quantity || 1)
    })

    if (openServices.length === 0) {
      return sendError(res, { message: 'All service slots are already filled', statusCode: HTTP_STATUS.CONFLICT })
    }

    // Find matching open services for this labourer
    const matchingOpen = openServices.filter(s => labourServiceIds.includes(String(s.serviceId)))

    let chosenService = null
    if (chosenServiceId) {
      // Labourer explicitly chose a service
      chosenService = openServices.find(s => String(s.serviceId) === chosenServiceId)
      if (!chosenService) {
        return sendError(res, { message: 'Chosen service is not available or already full', statusCode: HTTP_STATUS.BAD_REQUEST })
      }
    } else if (matchingOpen.length === 1) {
      // Only one matching service — auto-assign
      chosenService = matchingOpen[0]
    } else if (matchingOpen.length > 1) {
      // Multiple matching services and no explicit choice — require front-end to send serviceId
      return sendError(res, {
        message: 'Multiple matching services. Please choose a service to accept.',
        code: 'SERVICE_SELECTION_REQUIRED',
        data: { services: matchingOpen.map(s => ({ serviceId: s.serviceId, price: s.price })) },
        statusCode: 400
      })
    } else {
      // Labour has no matching service, fall back to first open slot
      chosenService = openServices[0]
    }

    assignedServiceId = chosenService.serviceId
    assignedPricePerHour = chosenService.price || 0

    // Fetch service name
    const svcDoc = await LabourService.findById(assignedServiceId).lean()
    assignedServiceName = svcDoc?.name || ''

    // Labour share = price × hours × 90% (platform takes 10%)
    const bookingHours = booking.duration || booking.hours || 1
    assignedLabourShare = Math.round(assignedPricePerHour * bookingHours * 0.90)
  } else {
    // Simple single-service booking
    const bookingHours = booking.duration || booking.hours || 1
    assignedLabourShare = booking.laborShare || 0
    assignedPricePerHour = booking.basePrice ? Math.round(booking.basePrice / bookingHours) : 0
  }

  // Determine total expected assignments to decide if fully ACCEPTED
  const totalRequested = isMultiServiceBooking
    ? booking.multiServiceBooking.items.filter(it => it.status !== 'CANCELLED').length
    : (isContractorBooking
      ? booking.contractorInfo.services.reduce((acc, s) => acc + (s.quantity || 1), 0)
      : (booking.quantity || 1))

  const startOtp = Math.floor(1000 + Math.random() * 9000).toString()
  const completionOtp = Math.floor(1000 + Math.random() * 9000).toString()

  const newAssignment = {
    labourId: labour._id,
    serviceId: assignedServiceId,
    serviceName: assignedServiceName,
    pricePerHour: assignedPricePerHour,
    labourShare: assignedLabourShare,
    status: 'ACCEPTED',
    startOtp,
    completionOtp,
  }

  const willBeFullyAccepted = isMultiServiceBooking
    ? (booking.multiServiceBooking.items.filter(it => it.status === 'PENDING').length <= 1)
    : ((booking.assignments?.length || 0) + 1 >= totalRequested)

  const setFields = {
    acceptedLabourId: labour._id,
    laborId: labour._id,
  }
  if (willBeFullyAccepted) {
    setFields.status = 'ACCEPTED'
  } else if (isMultiServiceBooking) {
    setFields.status = 'PARTIALLY_ACCEPTED'
  }

  const query = {
    _id: bookingId,
    status: { $in: ['BROADCASTING', 'PARTIALLY_ACCEPTED'] },
    acceptedLabourIds: { $ne: labour._id },
    $expr: {
      $lt: [
        { $size: { $ifNull: ['$acceptedLabourIds', []] } },
        totalRequested,
      ],
    },
  }

  if (isMultiServiceBooking && chosenMultiItem) {
    query['multiServiceBooking.items'] = {
      $elemMatch: { _id: chosenMultiItem._id, status: 'PENDING' }
    }
    setFields['multiServiceBooking.items.$.assignedLabourId'] = labour._id
    setFields['multiServiceBooking.items.$.status'] = 'ACCEPTED'
  }

  // Atomic conditional update to prevent double-assignment concurrent races
  const updatedBooking = await Booking.findOneAndUpdate(
    query,
    {
      $push: {
        acceptedLabourIds: labour._id,
        assignments: newAssignment,
      },
      $set: setFields,
    },
    { new: true }
  )

  if (!updatedBooking) {
    // Release cash reservation if concurrent accept race lost
    if (booking.paymentMethod === 'CASH') {
      const { releaseCashBookingCharges } = await import('../services/labourWalletService.js')
      await releaseCashBookingCharges({ labourId: labour._id, bookingId: booking._id }).catch(() => {})
    }
    return sendError(res, {
      message: 'Booking was already accepted by another partner or slots are full',
      statusCode: HTTP_STATUS.CONFLICT,
      code: 'BOOKING_ALREADY_ACCEPTED',
    })
  }

  booking = updatedBooking

  // Auto-generate material requirement if service has mapped products
  import('../services/materialRequirementService.js')
    .then(({ generateMaterialRequirementForBooking }) => {
      generateMaterialRequirementForBooking(booking._id, labour._id).catch(err =>
        console.error('[MaterialRequirement Error on Broadcast Accept]', err)
      )
    })
    .catch(err => console.error('[Import Error]', err))

  // Increment subscription bookingsAccepted count
  if (accessCheck.subscription) {
    const { UserSubscription } = await import('../models/UserSubscription.js')
    await UserSubscription.findByIdAndUpdate(accessCheck.subscription._id, {
      $inc: { bookingsReceived: 1, bookingOpportunitiesAccepted: 1 },
    })
  }

  // Increment lifetime broadcasts accepted
  const { User } = await import('../models/User.js')
  await User.findByIdAndUpdate(labour._id, {
    $inc: { 'labourProfile.lifetimeBroadcastsAccepted': 1 }
  })

  // Trigger reliable booking confirmation notification to customer (Push + In-App Outbox)
  import('../services/bookingNotificationService.js')
    .then(({ sendBookingAcceptedNotification }) => {
      sendBookingAcceptedNotification({
        booking,
        partner: labour,
        assignment: newAssignment,
      }).catch((err) => console.error('[Notification Dispatch Error on Accept]', err))
    })
    .catch((err) => console.error('[Import Error bookingNotificationService]', err))

  // Notify customer and expire broadcast for other partners if fully accepted
  import('../socket.js')
    .then(async ({ emitToUser, getIo }) => {
      const stats = await getLabourStats(labour._id)
      const partnerRating = stats.rating || labour.labourProfile?.rating || 4.8
      const partnerTotalReviews = stats.totalReviews || 0
      const partnerCompletedBookings = stats.completedBookingsCount || 0

      // Immediate direct socket emit to customer so UI reacts instantly
      emitToUser(booking.userId, 'BOOKING_ACCEPTED', {
        bookingId: booking._id,
        status: booking.status,
        laborId: labour._id,
        partner: {
          id: labour._id,
          name: labour.fullName,
          phone: labour.phone,
          profileImageUrl: labour.profileImageUrl,
          rating: partnerRating,
          totalReviews: partnerTotalReviews,
          completedBookingsCount: partnerCompletedBookings,
          experienceYears: labour.labourProfile?.experienceYears,
          serviceName: assignedServiceName || 'Service',
        },
        partnerName: labour.fullName,
        partnerPhone: labour.phone,
        partnerAvatar: labour.profileImageUrl,
        partnerRating,
        partnerTotalReviews,
        partnerCompletedBookings,
        partnerExperience: labour.labourProfile?.experienceYears,
        serviceName: assignedServiceName || 'Service',
        startOtp: newAssignment.startOtp,
        completionOtp: newAssignment.completionOtp,
      })

      emitToUser(booking.userId, 'BOOKING_STATUS_UPDATE', {
        bookingId: booking._id,
        status: booking.status,
      })

      if (booking.status === 'ACCEPTED') {
        const io = getIo()
        if (io) {
          io.emit('BOOKING_EXPIRED', { bookingId: booking._id, winnerId: labour._id })
        }
      }
    })
    .catch((err) => console.error('Failed to notify sockets:', err))

  // Schedule automated reminders for assigned vendor & customer
  import('../services/bookingReminderService.js')
    .then(({ scheduleRemindersForBooking }) => {
      scheduleRemindersForBooking(booking._id).catch(err =>
        console.error('[Reminder Scheduling Error on Broadcast Accept]', err)
      )
    })
    .catch(err => console.error('[Import Error]', err))

  return sendSuccess(res, { message: 'Booking accepted successfully', data: { booking } })
})

export const rejectBroadcast = asyncHandler(async (req, res) => {
  const { bookingId } = req.params
  const labour = req.user

  const booking = await Booking.findOneAndUpdate(
    { _id: bookingId, status: 'BROADCASTING' },
    { $addToSet: { rejectedBy: labour._id } },
    { new: true }
  )

  if (!booking) {
    return sendSuccess(res, { message: 'Booking already handled or no longer broadcasting' })
  }

  // Track booking opportunities offered to this labour (even if rejected)
  // Per spec: a booking offered but rejected still counts as an opportunity
  try {
    const { SystemSetting } = await import('../models/SystemSetting.js')
    const { UserSubscription } = await import('../models/UserSubscription.js')
    const settings = await SystemSetting.findOne({ configKey: 'master_config' })
    const isSubEnabled = settings?.isUserSubscriptionEnabled ?? true

    if (isSubEnabled) {
      const trialEndsAt = labour.labourProfile?.trialEndsAt
      const inTrial = trialEndsAt && new Date(trialEndsAt) > new Date()
      if (!inTrial) {
        const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
        await UserSubscription.findOneAndUpdate(
          { 
            labour: labour._id, 
            status: 'active',
            date: { $lte: todayIST },
            endDate: { $gte: todayIST }
          },
          { $inc: { bookingOpportunitiesOffered: 1 } }
        )
      }
    }
  } catch (e) {
    console.error('[broadcastController] Failed to track booking opportunity:', e)
  }

  // If everyone eligible has rejected it, fail it
  const rejectedCount = Array.isArray(booking.rejectedBy) ? booking.rejectedBy.length : 0
  if (rejectedCount >= (booking.eligibleLabourCount || 0)) {
    booking.status = 'FAILED'
    await booking.save()

    import('../socket.js')
      .then(({ emitToUser, getIo }) => {
        emitToUser(booking.userId, 'BOOKING_FAILED', {
          bookingId: booking._id,
          reason: 'All available labourers declined',
        })
        const io = getIo()
        if (io) {
          io.emit('BOOKING_EXPIRED', { bookingId: booking._id })
        }
      })
      .catch((err) => console.error('Failed to notify sockets on reject:', err))
  }

  return sendSuccess(res, { message: 'Booking rejected successfully' })
})

export const getActiveBroadcast = asyncHandler(async (req, res) => {
  const labour = req.user
  const cutoff = new Date(Date.now() - BROADCAST_TIMEOUT_MS) // 1.5 minutes timeout window

  // Find recent bookings in BROADCASTING or PARTIALLY_ACCEPTED status
  const query = {
    status: { $in: ['BROADCASTING', 'PARTIALLY_ACCEPTED'] },
    createdAt: { $gte: cutoff },
    rejectedBy: { $ne: labour._id },
    acceptedLabourIds: { $ne: labour._id },
  }
  // In production, avoid matching the user who placed the booking
  if (process.env.NODE_ENV === 'production') {
    query.userId = { $ne: labour._id }
  }

  let activeBookings = []
  try {
    activeBookings = await Booking.find(query)
      .sort({ createdAt: -1 })
      .limit(1)
      .populate('userId', 'fullName phone')
  } catch (err) {
    console.warn('[BROADCAST] Active broadcast fetch transient DB error:', err.message)
    return sendSuccess(res, {
      data: { broadcast: null },
      statusCode: HTTP_STATUS.OK,
    })
  }

  if (!activeBookings || activeBookings.length === 0) {
    return sendSuccess(res, {
      data: { broadcast: null },
      statusCode: HTTP_STATUS.OK,
    })
  }

  const booking = activeBookings[0]
  const isMultiService = Boolean(booking.multiServiceBooking?.isMultiService && booking.multiServiceBooking?.items?.length > 0)
  const bookingHours = booking.duration || booking.hours || 1
  const remainingMs = Math.max(5000, BROADCAST_TIMEOUT_MS - (Date.now() - new Date(booking.createdAt).getTime()))

  let payload = null

  if (isMultiService) {
    const openMultiItems = (booking.multiServiceBooking?.items || []).filter((it) => it.status === 'PENDING')
    if (openMultiItems.length === 0) {
      return sendSuccess(res, { data: { broadcast: null }, statusCode: HTTP_STATUS.OK })
    }

    const servicesPayload = openMultiItems.map((it) => ({
      itemId: String(it._id),
      serviceId: String(it.serviceId),
      name: it.subServiceName ? `${it.serviceName} - ${it.subServiceName}` : it.serviceName,
      serviceName: it.serviceName,
      subServiceName: it.subServiceName || '',
      quantity: it.quantity || 1,
      estimatedDurationMins: it.estimatedDurationMins || 45,
      totalDurationMins: it.totalDurationMins || ((it.estimatedDurationMins || 45) * (it.quantity || 1)),
      formattedDuration: it.formattedDuration || formatDurationHuman(it.totalDurationMins || ((it.estimatedDurationMins || 45) * (it.quantity || 1))),
      pricePerHour: it.unitPrice || 0,
      unitPrice: it.unitPrice || 0,
      itemTotal: it.itemTotal || 0,
      estimatedEarnings: Math.round(it.itemTotal * 0.90),
      openSlots: 1,
    }))

    const bestEarning = servicesPayload.reduce((max, s) => Math.max(max, s.estimatedEarnings), 0)
    const totalBookingDuration = booking.totalDurationMins || Math.round(bookingHours * 60)
    const formattedBookingDuration = booking.formattedDuration || formatDurationHuman(totalBookingDuration)
    const totalBookingQty = (booking.multiServiceBooking?.items || []).reduce((acc, it) => acc + (it.quantity || 1), 0) || booking.quantity || 1

    payload = {
      bookingId: booking._id,
      type: booking.type || 'SCHEDULED',
      customerName: booking.userId?.fullName || 'Customer',
      customerPhone: booking.userId?.phone || '',
      serviceName: servicesPayload.length === 1 ? servicesPayload[0].name : 'Multi-Service Booking',
      services: servicesPayload,
      isMultiServiceBooking: true,
      requiresServiceSelection: servicesPayload.length > 1,
      quantity: totalBookingQty,
      totalQuantity: totalBookingQty,
      totalDurationMins: totalBookingDuration,
      formattedDuration: formattedBookingDuration,
      date: booking.scheduledAt || booking.createdAt,
      time: booking.timeSlot || 'Earliest available',
      duration: bookingHours,
      customerLocation: booking.address?.locationText || 'Service Location',
      approximateDistance: 2.5,
      estimatedEarnings: bestEarning,
      timeoutMs: remainingMs,
    }
  } else if (booking.contractorInfo?.services?.length > 0) {
    const currentAssignments = booking.assignments || []
    const { LabourService } = await import('../models/LabourService.js')
    const svcDocs = await LabourService.find({
      _id: { $in: booking.contractorInfo.services.map((s) => s.serviceId) },
    }).select('_id name').lean()
    const nameMap = {}
    svcDocs.forEach((s) => { nameMap[String(s._id)] = s.name })

    const openServices = booking.contractorInfo.services
      .filter((s) => {
        const filled = currentAssignments.filter((a) => String(a.serviceId) === String(s.serviceId)).length
        return filled < (s.quantity || 1)
      })
      .map((s) => ({
        serviceId: String(s.serviceId),
        name: nameMap[String(s.serviceId)] || 'Contractor Service',
        pricePerHour: s.price || 0,
        estimatedEarnings: Math.round((s.price || 0) * bookingHours * 0.90),
        openSlots: Math.max(0, (s.quantity || 1) - currentAssignments.filter((a) => String(a.serviceId) === String(s.serviceId)).length),
      }))

    if (openServices.length === 0) {
      return sendSuccess(res, { data: { broadcast: null }, statusCode: HTTP_STATUS.OK })
    }

    const bestEarning = openServices.reduce((max, s) => Math.max(max, s.estimatedEarnings), 0)

    payload = {
      bookingId: booking._id,
      type: booking.type || 'SCHEDULED',
      customerName: booking.userId?.fullName || 'Customer',
      serviceName: openServices.length === 1 ? openServices[0].name : 'Multi-Skill Contractor Job',
      services: openServices,
      isContractorBooking: true,
      requiresServiceSelection: openServices.length > 1,
      date: booking.scheduledAt || booking.createdAt,
      time: booking.timeSlot || 'Earliest available',
      duration: bookingHours,
      customerLocation: booking.address?.locationText || 'Service Location',
      approximateDistance: 2.5,
      estimatedEarnings: bestEarning,
      timeoutMs: remainingMs,
    }
  } else {
    // Single service booking
    const { LabourService } = await import('../models/LabourService.js')
    let singleServiceName = 'Requested Service'
    let singleServiceDetail = ''
    let singleCategoryName = ''
    let singleSubServiceName = booking.subServiceName || ''

    if (booking.packageBooking?.isPackage) {
      singleServiceName = booking.packageBooking.packageName || 'Service Package'
      if (booking.packageBooking.inclusions?.length > 0) {
        singleServiceDetail = booking.packageBooking.inclusions.map(i => i.name).filter(Boolean).join(', ')
      }
    } else if (booking.serviceId) {
      const svc = await LabourService.findById(booking.serviceId).populate('subcategoryId', 'name').lean()
      if (svc) {
        singleServiceName = svc.name
        if (booking.subServiceName) {
          singleServiceName = `${svc.name} - ${booking.subServiceName}`
          singleServiceDetail = booking.subServiceName
        }
        if (svc.description) {
          singleServiceDetail = singleServiceDetail
            ? `${singleServiceDetail} • ${svc.description}`
            : svc.description
        }
        if (svc.subcategoryId?.name) {
          singleCategoryName = svc.subcategoryId.name
        }
      }
    } else if (booking.subcategoryId) {
      const { LabourSubcategory } = await import('../models/LabourSubcategory.js')
      const subcat = await LabourSubcategory.findById(booking.subcategoryId).select('name').lean()
      if (subcat) {
        singleServiceName = subcat.name
        singleCategoryName = subcat.name
      }
    }
    const singleShare = Math.round(Number(booking.laborShare || booking.basePrice || 0))
    const singleDurationMins = booking.totalDurationMins || Math.round(bookingHours * 60)
    const formattedSingleDuration = booking.formattedDuration || formatDurationHuman(singleDurationMins)
    const singleQty = booking.quantity || 1

    payload = {
      bookingId: booking._id,
      type: booking.type || 'SCHEDULED',
      customerName: booking.userId?.fullName || 'Customer',
      customerPhone: booking.userId?.phone || '',
      serviceName: singleServiceName,
      serviceDetail: singleServiceDetail || booking.notes || '',
      categoryName: singleCategoryName,
      subServiceName: singleSubServiceName,
      quantity: singleQty,
      totalQuantity: singleQty,
      totalDurationMins: singleDurationMins,
      formattedDuration: formattedSingleDuration,
      isContractorBooking: false,
      requiresServiceSelection: false,
      date: booking.scheduledAt || booking.createdAt,
      time: booking.timeSlot || 'Earliest available',
      duration: bookingHours,
      customerLocation: booking.address?.locationText || 'Service Location',
      approximateDistance: 2.5,
      estimatedEarnings: singleShare,
      timeoutMs: remainingMs,
    }
  }

  return sendSuccess(res, {
    data: { broadcast: payload },
    statusCode: HTTP_STATUS.OK,
  })
})

