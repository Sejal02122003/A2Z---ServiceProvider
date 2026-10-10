import { Booking } from '../models/Booking.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { KYC_STATUS } from '../constants/roles.js'

/**
 * Validate that labour can receive/accept bookings.
 * Chain: KYC approved → trial OR subscription active → within hours → available
 */
async function validateLabourBookingAccess(labour) {
  const { SystemSetting } = await import('../models/SystemSetting.js')
  const { UserSubscription } = await import('../models/UserSubscription.js')

  // 1. KYC check
  if (labour.labourProfile?.kycStatus !== KYC_STATUS.VERIFIED) {
    return { allowed: false, code: 'KYC_NOT_APPROVED', message: 'KYC not approved. Cannot receive bookings.' }
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

  // Fetch booking first
  let booking = await Booking.findOne({ _id: bookingId, status: 'BROADCASTING' })
  
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

  // Wallet Eligibility Check (Rules: availableWalletBalance >= bookingAmount & >= minRequired)
  const { checkLabourBookingEligibility, reserveCashBookingCharges } = await import('../services/labourWalletService.js')
  const walletCheck = await checkLabourBookingEligibility({ labourId: labour._id, booking })
  if (!walletCheck.eligible) {
    return sendError(res, {
      message: walletCheck.reason,
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: walletCheck.code,
      data: {
        bookingAmount: walletCheck.bookingAmount,
        availableWalletBalance: walletCheck.availableWalletBalance,
        requiredTopUp: walletCheck.requiredTopUp,
        minimumWalletBalance: walletCheck.minimumWalletBalance,
      },
    })
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

  const isContractorBooking = booking.contractorInfo?.services?.length > 0

  if (isContractorBooking) {
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

  // Push to accepted lists
  booking.acceptedLabourIds = booking.acceptedLabourIds || []
  booking.acceptedLabourIds.push(labour._id)

  const startOtp = Math.floor(1000 + Math.random() * 9000).toString()
  const completionOtp = Math.floor(1000 + Math.random() * 9000).toString()

  booking.assignments = booking.assignments || []
  booking.assignments.push({
    labourId: labour._id,
    serviceId: assignedServiceId,
    serviceName: assignedServiceName,
    pricePerHour: assignedPricePerHour,
    labourShare: assignedLabourShare,
    status: 'ACCEPTED',
    startOtp,
    completionOtp
  })

  // For backward compatibility (quantity=1)
  booking.acceptedLabourId = labour._id
  booking.laborId = labour._id
  
  // Determine total expected assignments to decide if fully ACCEPTED
  const totalRequested = isContractorBooking
    ? booking.contractorInfo.services.reduce((acc, s) => acc + (s.quantity || 1), 0)
    : (booking.quantity || 1)

  if (booking.assignments.length >= totalRequested) {
    booking.status = 'ACCEPTED'
  }

  await booking.save()

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

  // Notify customer
  import('../socket.js')
    .then(({ emitToUser, getIo }) => {
      emitToUser(booking.userId, 'BOOKING_ACCEPTED', { bookingId: booking._id, laborId: labour._id, quantity: booking.quantity, acceptedCount: booking.acceptedLabourIds.length })
      
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
  if (booking.rejectedBy.length >= (booking.eligibleLabourCount || 0)) {
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
