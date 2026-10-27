import { User } from '../models/User.js'
import { Booking } from '../models/Booking.js'
import { BroadcastLog } from '../models/BroadcastLog.js'
import { SystemSetting } from '../models/SystemSetting.js'
import { getRoadDistances } from '../utils/googleMapsDistance.js'
import { UserSubscription } from '../models/UserSubscription.js'
import { Review } from '../models/Review.js'
import { sendNotificationToUser } from '../utils/pushNotificationHelper.js'
import { USER_ROLES } from '../constants/roles.js'

export const BROADCAST_TIMEOUT_MS = 90000 // 1.5 minutes (90 seconds) flash broadcast timeout

/**
 * Starts the flash broadcast for a new booking based on a radius zone.
 */
export async function startBroadcastCycle(bookingId) {
  const booking = await Booking.findById(bookingId).populate('userId', 'fullName phone')
  if (!booking || booking.status !== 'CREATED') return

  // 1. Get Radius Setting
  const settings = await SystemSetting.findOne({ configKey: 'master_config' })
  const radiusKm = settings?.globalBroadcastRadius || 10

  // Log snapshot of radius onto booking
  booking.broadcastRadius = radiusKm

  // Validate coordinates
  const bookingLng = booking.address?.coordinates?.coordinates[0]
  const bookingLat = booking.address?.coordinates?.coordinates[1]

  if (!bookingLng || !bookingLat) {
    console.error(`Booking ${bookingId} FAILED: Invalid coordinates for zone broadcast.`)
    booking.status = 'FAILED'
    await booking.save()
    // Emit to customer
    import('../socket.js').then(({ emitToUser }) => {
      emitToUser(booking.userId, 'BOOKING_FAILED', { bookingId, reason: 'Invalid location' })
    }).catch(err => console.error(err))
    return
  }

  booking.status = 'BROADCASTING'
  await booking.save()

  // 2. Pre-filter labourers by bounding box (rough estimate to avoid hitting Google Maps for everyone)
  const latDiff = radiusKm / 111
  const lngDiff = radiusKm / (111 * Math.cos(bookingLat * (Math.PI / 180)))

  // Multiply radius slightly to ensure we don't accidentally cut off corners in the rough box
  const bufferLatDiff = latDiff * 1.2
  const bufferLngDiff = lngDiff * 1.2

  // EXCLUDE labourers who are actively executing a job on-site AND the booking customer
  const busyBookings = await Booking.find({
    status: { $in: ['EN_ROUTE', 'STARTED'] },
    acceptedLabourId: { $exists: true, $ne: null }
  }).select('acceptedLabourId').lean()
  const busyLabourIds = busyBookings.map(b => b.acceptedLabourId)

  const customerId = booking.userId?._id || booking.userId
  const excludedUserIds = [...busyLabourIds]
  // Only exclude customer in production when customer is not also testing labour role
  if (customerId && process.env.NODE_ENV === 'production') {
    excludedUserIds.push(customerId)
  }

  const matchOr = []
  if (booking.multiServiceBooking?.isMultiService && Array.isArray(booking.multiServiceBooking.items) && booking.multiServiceBooking.items.length > 0) {
    const pendingItems = booking.multiServiceBooking.items.filter(it => it.status === 'PENDING')
    const multiServiceIds = pendingItems.map(it => it.serviceId).filter(Boolean)
    const multiSubcategoryIds = pendingItems.map(it => it.subcategoryId).filter(Boolean)
    const multiCategoryIds = pendingItems.map(it => it.categoryId).filter(Boolean)

    if (multiServiceIds.length > 0) matchOr.push({ 'labourProfile.serviceIds': { $in: multiServiceIds } })
    if (multiSubcategoryIds.length > 0) matchOr.push({ 'labourProfile.subcategoryIds': { $in: multiSubcategoryIds } })
    if (multiCategoryIds.length > 0) matchOr.push({ 'labourProfile.categoryIds': { $in: multiCategoryIds } })
  } else if (booking.contractorInfo && booking.contractorInfo.services && booking.contractorInfo.services.length > 0) {
    const requestedServiceIds = booking.contractorInfo.services.map(s => s.serviceId)
    matchOr.push({ 'labourProfile.serviceIds': { $in: requestedServiceIds } })
  } else {
    if (booking.packageBooking?.isPackage && Array.isArray(booking.packageBooking.inclusions) && booking.packageBooking.inclusions.length > 0) {
      const pkgServiceIds = booking.packageBooking.inclusions
        .map(inc => inc.serviceId)
        .filter(Boolean)
      if (pkgServiceIds.length > 0) {
        matchOr.push({ 'labourProfile.serviceIds': { $in: pkgServiceIds } })
      }
    }
    if (booking.serviceId) {
      matchOr.push({ 'labourProfile.serviceIds': booking.serviceId })
    }
    if (booking.subcategoryId) {
      matchOr.push({ 'labourProfile.subcategoryIds': booking.subcategoryId })
      const { LabourSubcategory } = await import('../models/LabourSubcategory.js')
      const sub = await LabourSubcategory.findById(booking.subcategoryId).lean()
      if (sub?.categoryId) {
        matchOr.push({ 'labourProfile.categoryIds': sub.categoryId })
      }
    }
  }

  console.log(`[BROADCAST] Target coordinates: lat=${bookingLat}, lng=${bookingLng}, radius=${radiusKm}km`)
  console.log(`[BROADCAST] Excluded user IDs: ${JSON.stringify(excludedUserIds)}`)
  console.log(`[BROADCAST] Match criteria: ${JSON.stringify(matchOr)}`)

  // Base query for active, non-blocked service providers
  const baseQuery = {
    _id: { $nin: excludedUserIds },
    role: { $in: [USER_ROLES.LABOUR, 'labour', USER_ROLES.CONTRACTOR, 'contractor'] },
    isActive: true,
    vendorStatus: { $nin: ['BLOCKED', 'REJECTED'] },
    'labourProfile.availabilityStatus': { $ne: 'offline' },
  }

  // Tier 1: Search providers matching skills/categories
  let potentialLaborersRaw = []
  if (matchOr.length > 0) {
    potentialLaborersRaw = await User.find({ ...baseQuery, $or: matchOr }).lean()
    console.log(`[BROADCAST] Tier 1 skill-matched search found ${potentialLaborersRaw.length} providers`)
  }

  // Tier 2: If none matched specific skills/categories or list is empty, include all active available providers
  if (potentialLaborersRaw.length === 0) {
    console.log('[BROADCAST] Skill match returned 0. Falling back to all available active service providers.')
    potentialLaborersRaw = await User.find(baseQuery).lean()
    console.log(`[BROADCAST] Tier 2 fallback found ${potentialLaborersRaw.length} available service providers`)
  }

  const to24Hour = (timeStr) => {
    if (!timeStr) return ''
    const s = String(timeStr).trim().toUpperCase()
    if (s === 'MORNING') return '09:00'
    if (s === 'AFTERNOON') return '13:00'
    if (s === 'EVENING') return '17:00'
    const cleanStr = s.split(/[–\-]/)[0].trim()
    const match = cleanStr.match(/(\d+):(\d+)\s?(AM|PM)?/i)
    if (!match) return timeStr
    let [ , h, m, ampm ] = match
    h = parseInt(h, 10)
    if (ampm) {
      if (ampm.toUpperCase() === 'PM' && h < 12) h += 12
      if (ampm.toUpperCase() === 'AM' && h === 12) h = 0
    }
    return `${String(h).padStart(2, '0')}:${m.padStart(2, '0')}`
  }

  const getIstDayAndTime = (dateObj) => {
    const options = { timeZone: 'Asia/Kolkata', weekday: 'long', hour: '2-digit', minute: '2-digit', hour12: false }
    const formatter = new Intl.DateTimeFormat('en-US', options)
    const parts = formatter.formatToParts(dateObj)
    let day = '', hour = '', minute = ''
    for (const part of parts) {
      if (part.type === 'weekday') day = part.value
      if (part.type === 'hour') hour = part.value
      if (part.type === 'minute') minute = part.value
    }
    if (hour === '24') hour = '00'
    return { day, timeStr: `${hour}:${minute}` }
  }

  const targetDate = (booking.type === 'SCHEDULED' && booking.scheduledAt) ? new Date(booking.scheduledAt) : new Date()
  const { day: targetDayName, timeStr: currentIstTimeStr } = getIstDayAndTime(targetDate)
  const targetStartTimeStr = to24Hour(booking.timeSlot) || currentIstTimeStr
  const targetEndTimeStr = to24Hour(booking.endTime)

  console.log(`[BROADCAST] Target context: type=${booking.type}, targetDay=${targetDayName}, targetStartTime=${targetStartTimeStr}, targetEndTime=${targetEndTimeStr || 'none'}, currentIST=${currentIstTimeStr}`)

  const potentialLaborers = potentialLaborersRaw.filter(labor => {
    // If worker explicitly marked themselves as available, trust their live status
    if (labor.labourProfile?.availabilityStatus === 'available') {
      return true
    }

    const schedule = labor.labourProfile?.schedule || []
    if (schedule.length === 0) {
      return true
    }

    const dayEntry = schedule.find(s => s.day === targetDayName)
    if (!dayEntry) {
      return true
    }
    if (dayEntry.isAvailable === false) {
      return false
    }
    
    const sTime = to24Hour(dayEntry.startTime || '00:00')
    const eTime = to24Hour(dayEntry.endTime || '23:59')
    
    if (booking.type === 'INSTANT') {
      if (currentIstTimeStr < sTime || currentIstTimeStr > eTime) {
        return false
      }
      return true
    }

    // For scheduled jobs
    let effectiveEndTime = eTime
    if (eTime === '17:00' && targetStartTimeStr > '17:00' && targetStartTimeStr <= '23:00') {
      effectiveEndTime = '23:00'
    }

    if (targetStartTimeStr && (targetStartTimeStr < sTime || targetStartTimeStr > effectiveEndTime)) {
      return false
    }
    if (targetEndTimeStr && targetEndTimeStr > effectiveEndTime) {
      return false
    }

    return true
  })

  console.log(`[BROADCAST] Potential labourers after schedule filter: ${potentialLaborers.length}`)

  let eligibleToConsider = potentialLaborers
  if (eligibleToConsider.length === 0 && potentialLaborersRaw.length > 0) {
    console.log(`[BROADCAST] Schedule filter was too restrictive for ${targetDayName}. Falling back to available raw labourers to ensure job is broadcast.`)
    eligibleToConsider = potentialLaborersRaw
  }

  if (eligibleToConsider.length === 0) {
    console.warn(`[BROADCAST] Booking ${booking._id} FAILED: No active service providers registered in system`)
    await markBookingFailed(booking, `No laborers available in area`)
    return
  }

  // Wallet Eligibility Filter removed as per request
  const walletEligible = eligibleToConsider

  // 3b. Subscription Eligibility Filter
  const subEligible = []
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const activeSubsMap = {}
  const isSubscriptionEnforced = settings?.isUserSubscriptionEnabled === true

  if (!isSubscriptionEnforced) {
    subEligible.push(...walletEligible)
  } else {
    for (const labor of walletEligible) {
      const trialEnds = labor.labourProfile?.trialEndsAt
      const now = new Date()
      if (trialEnds && now <= new Date(trialEnds)) {
        subEligible.push(labor)
        continue
      }

      const activeSub = await UserSubscription.findOne({
        labour: labor._id,
        date: { $lte: today },
        endDate: { $gte: today },
        status: 'active'
      })
      
      if (activeSub) {
        subEligible.push(labor)
        activeSubsMap[labor._id] = activeSub
      }
    }
  }

  if (subEligible.length === 0 && walletEligible.length > 0) {
    console.log('[BROADCAST] Broadening subscription eligibility to all walletEligible laborers')
    subEligible.push(...walletEligible)
  }

  // 4. Distance Calculation with NaN and null coordinate resilience
  const destinations = subEligible.map(l => {
    const lat = Number(l.labourProfile?.currentLatitude)
    const lng = Number(l.labourProfile?.currentLongitude)
    const valid = !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0
    return {
      id: String(l._id),
      lat: valid ? lat : null,
      lng: valid ? lng : null,
      hasValidCoords: valid
    }
  })

  const validDests = destinations.filter(d => d.hasValidCoords).map(d => ({ id: d.id, lat: d.lat, lng: d.lng }))
  let roadDistances = []
  if (validDests.length > 0) {
    try {
      roadDistances = await getRoadDistances(bookingLat, bookingLng, validDests)
    } catch (e) {
      console.warn('[BROADCAST] Road distance calculation warning:', e)
    }
  }

  const finalDistances = destinations.map(d => {
    if (d.hasValidCoords) {
      const match = roadDistances.find(rd => rd.id === d.id)
      const dist = (match && typeof match.distanceKm === 'number' && !isNaN(match.distanceKm))
        ? match.distanceKm
        : 2.5
      return { id: d.id, distanceKm: dist, isApproximate: false }
    }
    // Worker has not reported GPS yet: assign a nominal 2.5 km proximity so they receive the popup
    return { id: d.id, distanceKm: 2.5, isApproximate: true }
  })
  
  let eligibleLaborers = subEligible.filter(labor => {
    const distData = finalDistances.find(d => d.id === String(labor._id))
    const inRadius = distData && distData.distanceKm <= radiusKm
    if (distData) {
      console.log(`[BROADCAST] Worker ${labor.fullName || labor.phone} (${labor._id}): distance=${distData.distanceKm.toFixed(1)}km, maxRadius=${radiusKm}km => inRadius=${inRadius}`)
    }
    return inRadius
  })

  // If no labourers have exact GPS coordinates or distance data, fallback to all subEligible labourers
  if (eligibleLaborers.length === 0 && subEligible.length > 0) {
    console.log(`[BROADCAST] Falling back to all eligible labourers (${subEligible.length}) with default proximity.`)
    eligibleLaborers = subEligible
  }

  console.log(`[BROADCAST] Final eligible labourers within driving radius: ${eligibleLaborers.length}`)

  if (eligibleLaborers.length === 0) {
    console.warn(`[BROADCAST] Booking ${booking._id} FAILED: No laborers available in system`)
    await markBookingFailed(booking, 'No laborers available in system')
    return
  }

  // --- Calculate Secondary Match Scores ---
  const eligibleIds = eligibleLaborers.map(l => l._id)

  const reviews = await Review.aggregate([
    { $match: { revieweeId: { $in: eligibleIds } } },
    { $group: { _id: '$revieweeId', avgRating: { $avg: '$rating' } } }
  ])
  const ratingMap = {}
  reviews.forEach(r => ratingMap[String(r._id)] = r.avgRating)

  const completedBookings = await Booking.aggregate([
    { $match: { acceptedLabourId: { $in: eligibleIds }, status: 'COMPLETED' } },
    { $group: { _id: '$acceptedLabourId', count: { $sum: 1 } } }
  ])
  const completedMap = {}
  completedBookings.forEach(c => completedMap[String(c._id)] = c.count)

  eligibleLaborers.forEach(labor => {
    const idStr = String(labor._id)
    const distData = finalDistances.find(d => d.id === idStr)
    const dist = (distData && typeof distData.distanceKm === 'number' && !isNaN(distData.distanceKm))
      ? distData.distanceKm
      : 2.5
    
    // Distance (closer is better)
    const distScore = Math.max(0, radiusKm - dist) * 2 
    
    // Experience
    const exp = labor.labourProfile?.experienceYears || 0
    const expScore = exp * 1.5 
    
    // Rating
    const rating = ratingMap[idStr] || 0
    const ratingScore = rating * 3
    
    // Completed Bookings
    const completed = completedMap[idStr] || 0
    const completedScore = Math.min(completed, 100) * 0.1
    
    // Response Rate
    const received = labor.labourProfile?.lifetimeBroadcastsReceived || 0
    const accepted = labor.labourProfile?.lifetimeBroadcastsAccepted || 0
    const responseRate = received > 0 ? (accepted / received) : 0
    const responseScore = responseRate * 10
    
    labor.matchScore = distScore + expScore + ratingScore + completedScore + responseScore
    labor.approximateDistance = dist
  })

  // Sort by highest score first
  eligibleLaborers.sort((a, b) => b.matchScore - a.matchScore)

  // 5. Update eligible count
  booking.eligibleLabourCount = eligibleLaborers.length
  await booking.save()

  // 6. Flash Broadcast via WebSockets
  console.log(`Flash broadcasting Booking ${booking._id} to ${eligibleLaborers.length} laborers`)

  // Notify customer
  import('../socket.js').then(({ emitToUser }) => {
    emitToUser(booking.userId, 'BOOKING_BROADCAST_STARTED', { 
      bookingId: booking._id,
      radiusKm: radiusKm,
      eligibleCount: eligibleLaborers.length
    })

    // Notify all eligible laborers
    const laborUpdates = []

    import('../models/LabourService.js').then(async ({ LabourService }) => {
      // Pre-fetch service names for all contractor services
      let serviceNameMap = {}
      let singleServiceName = 'Requested Service'
      let singleServiceDetail = ''
      let singleCategoryName = ''
      let singleSubServiceName = booking.subServiceName || ''

      if (booking.contractorInfo?.services?.length > 0) {
        const svcDocs = await LabourService.find({
          _id: { $in: booking.contractorInfo.services.map(s => s.serviceId) }
        }).select('_id name description').lean()
        svcDocs.forEach(s => { serviceNameMap[String(s._id)] = s.name })
      } else if (booking.packageBooking?.isPackage) {
        singleServiceName = booking.packageBooking.packageName || 'Service Package'
        const pkgDesc = booking.packageBooking.snapshot?.description || booking.packageBooking.snapshot?.shortDescription || ''
        const inclusionsSummary = (booking.packageBooking.inclusions || []).map(i => `${i.name}${i.quantity > 1 ? ` (x${i.quantity})` : ''}`).filter(Boolean).join(', ')
        singleServiceDetail = pkgDesc ? `${pkgDesc}${inclusionsSummary ? ` • Includes: ${inclusionsSummary}` : ''}` : inclusionsSummary
        if (booking.packageBooking.snapshot?.badge) {
          singleCategoryName = booking.packageBooking.snapshot.badge
        }
      } else if (booking.serviceId) {
        const service = await LabourService.findById(booking.serviceId)
          .populate('subcategoryId', 'name')
          .lean()
        if (service) {
          singleServiceName = service.name
          if (booking.subServiceName) {
            singleServiceName = `${service.name} - ${booking.subServiceName}`
            singleServiceDetail = booking.subServiceName
          }
          if (service.description) {
            singleServiceDetail = singleServiceDetail
              ? `${singleServiceDetail} • ${service.description}`
              : service.description
          }
          if (service.subcategoryId?.name) {
            singleCategoryName = service.subcategoryId.name
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

      // Count current open slots per service
      const currentAssignments = booking.assignments || []
      const openSlotsMap = {}
      if (booking.contractorInfo?.services?.length > 0) {
        booking.contractorInfo.services.forEach(s => {
          const filled = currentAssignments.filter(a => String(a.serviceId) === String(s.serviceId)).length
          openSlotsMap[String(s.serviceId)] = Math.max(0, (s.quantity || 1) - filled)
        })
      }

      eligibleLaborers.forEach(labor => {
        const laborServiceIds = labor.labourProfile?.serviceIds?.map(id => String(id)) || []
        const bookingHours = booking.duration || booking.hours || 1

        const isMultiService = Boolean(booking.multiServiceBooking?.isMultiService && booking.multiServiceBooking?.items?.length > 0)

        if (isMultiService) {
          const openMultiItems = (booking.multiServiceBooking?.items || []).filter(it => it.status === 'PENDING')
          const matchingMulti = openMultiItems.filter(it =>
            laborServiceIds.includes(String(it.serviceId)) ||
            (it.subcategoryId && (labor.labourProfile?.subcategoryIds || []).map(id => String(id)).includes(String(it.subcategoryId)))
          ).map(it => ({
            itemId: String(it._id),
            serviceId: String(it.serviceId),
            name: it.subServiceName ? `${it.serviceName} - ${it.subServiceName}` : it.serviceName,
            pricePerHour: it.unitPrice || 0,
            estimatedEarnings: Math.round(it.itemTotal * 0.90),
            openSlots: 1
          }))

          const servicesPayload = matchingMulti.length > 0
            ? matchingMulti
            : openMultiItems.map(it => ({
                itemId: String(it._id),
                serviceId: String(it.serviceId),
                name: it.subServiceName ? `${it.serviceName} - ${it.subServiceName}` : it.serviceName,
                pricePerHour: it.unitPrice || 0,
                estimatedEarnings: Math.round(it.itemTotal * 0.90),
                openSlots: 1
              }))

          const bestEarning = servicesPayload.reduce((max, s) => Math.max(max, s.estimatedEarnings), 0)

          import('../socket.js').then(({ emitToUser }) => {
            console.log(`[BROADCAST] Emitting BOOKING_RECEIVED to labour ${labor.fullName || labor.phone} (${labor._id}) for multi-service booking ${booking._id}, earnings=₹${bestEarning}`)
            emitToUser(labor._id, 'BOOKING_RECEIVED', {
              bookingId: booking._id,
              type: booking.type || 'SCHEDULED',
              customerName: booking.userId?.fullName || 'Customer',
              serviceName: servicesPayload.length === 1 ? servicesPayload[0].name : 'Multi-Service Booking',
              services: servicesPayload,
              isMultiServiceBooking: true,
              requiresServiceSelection: servicesPayload.length > 1,
              date: booking.scheduledAt || booking.createdAt,
              time: booking.timeSlot || 'Earliest available',
              duration: bookingHours,
              customerLocation: booking.address?.locationText || 'Service Location',
              approximateDistance: labor.approximateDistance,
              estimatedEarnings: bestEarning,
              timeoutMs: BROADCAST_TIMEOUT_MS
            })
          })

          sendNotificationToUser(labor._id, {
            title: booking.type === 'SCHEDULED' ? 'New Scheduled Job Offer! ⏰' : 'New Job Offer!',
            body: `New multi-service job available near you. Estimated earnings: ₹${bestEarning}`,
            data: { type: 'booking_received', bookingId: String(booking._id) }
          })
        } else if (booking.contractorInfo?.services?.length > 0) {
          // Find open services that match this labourer's skills
          const matchingOpenServices = booking.contractorInfo.services
            .filter(s => {
              const isOpen = openSlotsMap[String(s.serviceId)] > 0
              const hasSkill = laborServiceIds.includes(String(s.serviceId))
              return isOpen && hasSkill
            })
            .map(s => {
              const sId = String(s.serviceId)
              const labourShare = Math.round((s.price || 0) * bookingHours * 0.90)
              return {
                serviceId: sId,
                name: serviceNameMap[sId] || 'Service',
                pricePerHour: s.price || 0,
                estimatedEarnings: labourShare,
                openSlots: openSlotsMap[sId] || 0
              }
            })

          // Fall back to all open services if no skill match
          const servicesPayload = matchingOpenServices.length > 0
            ? matchingOpenServices
            : booking.contractorInfo.services
                .filter(s => openSlotsMap[String(s.serviceId)] > 0)
                .map(s => {
                  const sId = String(s.serviceId)
                  return {
                    serviceId: sId,
                    name: serviceNameMap[sId] || 'Service',
                    pricePerHour: s.price || 0,
                    estimatedEarnings: Math.round((s.price || 0) * bookingHours * 0.90),
                    openSlots: openSlotsMap[sId] || 0
                  }
                })

          // Show highest earning as the headline earnings figure
          const bestEarning = servicesPayload.reduce((max, s) => Math.max(max, s.estimatedEarnings), 0)

          import('../socket.js').then(({ emitToUser }) => {
            console.log(`[BROADCAST] Emitting BOOKING_RECEIVED to labour ${labor.fullName || labor.phone} (${labor._id}) for contractor booking ${booking._id}, earnings=₹${bestEarning}`)
            emitToUser(labor._id, 'BOOKING_RECEIVED', {
              bookingId: booking._id,
              type: booking.type || 'SCHEDULED',
              customerName: booking.userId?.fullName || 'Customer',
              serviceName: servicesPayload.length === 1 ? servicesPayload[0].name : 'Multiple Services',
              services: servicesPayload,
              isContractorBooking: true,
              requiresServiceSelection: servicesPayload.length > 1,
              date: booking.scheduledAt || booking.createdAt,
              time: booking.timeSlot || 'Earliest available',
              duration: bookingHours,
              customerLocation: booking.address?.locationText || 'Service Location',
              approximateDistance: labor.approximateDistance,
              estimatedEarnings: bestEarning,
              timeoutMs: BROADCAST_TIMEOUT_MS
            })
          })
          
          sendNotificationToUser(labor._id, {
            title: booking.type === 'SCHEDULED' ? 'New Scheduled Job Offer! ⏰' : 'New Job Offer!',
            body: `New ${servicesPayload.length === 1 ? servicesPayload[0].name : 'Multiple Services'} job available near you. Estimated earnings: ₹${bestEarning}`,
            data: { type: 'booking_received', bookingId: String(booking._id) }
          })

          // Create In-App Notification record for Labour Notification feed
          const isContractorScheduled = booking.type === 'SCHEDULED' || booking.type === 'scheduled'
          const contractorNotifTitle = isContractorScheduled ? 'New Scheduled Job Offer! ⏰' : 'New Job Offer! ⚡'
          const contractorNotifBody = isContractorScheduled
            ? `New ${servicesPayload.length === 1 ? servicesPayload[0].name : 'Multiple Services'} appointment scheduled for ${booking.timeSlot || 'Scheduled Time'}. Estimated earnings: ₹${bestEarning}. Tap to accept!`
            : `New ${servicesPayload.length === 1 ? servicesPayload[0].name : 'Multiple Services'} job available near you. Estimated earnings: ₹${bestEarning}`

          import('../models/InAppNotification.js').then(({ InAppNotification }) => {
            InAppNotification.create({
              userId: labor._id,
              title: contractorNotifTitle,
              body: contractorNotifBody,
              type: 'BOOKING_STATUS',
              bookingId: booking._id,
              deliveryStatus: 'SENT',
              metadata: {
                bookingId: booking._id,
                bookingType: booking.type,
                scheduledAt: booking.scheduledAt,
                timeSlot: booking.timeSlot,
                earnings: bestEarning,
                link: `/app/home`,
              }
            }).then((inAppRecord) => {
              import('../socket.js').then(({ emitToUser }) => {
                emitToUser(labor._id, 'NEW_IN_APP_NOTIFICATION', inAppRecord)
              }).catch(err => console.error(err))
            }).catch(err => console.error('[InAppNotification Create Error]', err))
          }).catch(err => console.error(err))
        } else {
          // Single-service booking
          const singleShare = booking.laborShare || booking.basePrice || 0
          import('../socket.js').then(({ emitToUser }) => {
            console.log(`[BROADCAST] Emitting BOOKING_RECEIVED to labour ${labor.fullName || labor.phone} (${labor._id}) for single-service booking ${booking._id}, service=${singleServiceName}, earnings=₹${singleShare}`)
            emitToUser(labor._id, 'BOOKING_RECEIVED', {
              bookingId: booking._id,
              type: booking.type || 'SCHEDULED',
              customerName: booking.userId?.fullName || 'Customer',
              serviceName: singleServiceName,
              serviceDetail: singleServiceDetail || booking.notes || '',
              categoryName: singleCategoryName,
              subServiceName: singleSubServiceName,
              isContractorBooking: false,
              requiresServiceSelection: false,
              isPackage: Boolean(booking.packageBooking?.isPackage),
              packageName: booking.packageBooking?.packageName || (booking.packageBooking?.isPackage ? singleServiceName : undefined),
              packageDescription: booking.packageBooking?.snapshot?.description || booking.packageBooking?.snapshot?.shortDescription || (booking.packageBooking?.isPackage ? singleServiceDetail : undefined),
              packagePrice: booking.packageBooking?.packagePrice || (booking.packageBooking?.isPackage ? (booking.totalAmount || 0) : undefined),
              packageOriginalPrice: booking.packageBooking?.originalPrice || undefined,
              packageBadge: booking.packageBooking?.snapshot?.badge || undefined,
              packageDuration: booking.packageBooking?.snapshot?.estimatedDurationMins || (booking.packageBooking?.isPackage ? (bookingHours * 60) : undefined),
              packageInclusions: booking.packageBooking?.isPackage ? (booking.packageBooking.inclusions || []).map(inc => ({
                serviceId: inc.serviceId,
                name: inc.name,
                quantity: inc.quantity || 1,
                description: inc.description || ''
              })) : undefined,
              date: booking.scheduledAt || booking.createdAt,
              time: booking.timeSlot || 'Earliest available',
              duration: bookingHours,
              customerLocation: booking.address?.locationText || 'Service Location',
              approximateDistance: labor.approximateDistance,
              estimatedEarnings: singleShare,
              timeoutMs: BROADCAST_TIMEOUT_MS
            })
          })
          
          sendNotificationToUser(labor._id, {
            title: booking.packageBooking?.isPackage
              ? `New Package Booking: ${booking.packageBooking.packageName}! 📦`
              : (booking.type === 'SCHEDULED' ? 'New Scheduled Job Offer! ⏰' : 'New Job Offer!'),
            body: booking.packageBooking?.isPackage
              ? `Package deal with ${booking.packageBooking.inclusions?.length || 0} services. Package price: ₹${booking.packageBooking.packagePrice}. Your earnings: ₹${singleShare}`
              : `New ${singleServiceName} job available near you. Estimated earnings: ₹${singleShare}`,
            data: { type: 'booking_received', bookingId: String(booking._id) }
          })

          // Create In-App Notification record for Labour Notification feed
          const isSingleScheduled = booking.type === 'SCHEDULED' || booking.type === 'scheduled'
          const singleNotifTitle = booking.packageBooking?.isPackage
            ? `New Package Booking: ${booking.packageBooking.packageName}! 📦`
            : (isSingleScheduled ? 'New Scheduled Job Offer! ⏰' : 'New Job Offer! ⚡')
          const singleNotifBody = booking.packageBooking?.isPackage
            ? `Package appointment for ${booking.timeSlot || 'Scheduled Time'}. Includes ${booking.packageBooking.inclusions?.length || 0} services. Estimated earnings: ₹${singleShare}. Tap to accept!`
            : (isSingleScheduled
              ? `New ${singleServiceName} appointment scheduled for ${booking.timeSlot || 'Scheduled Time'}. Estimated earnings: ₹${singleShare}. Tap to accept!`
              : `New ${singleServiceName} job available near you. Estimated earnings: ₹${singleShare}`)

          import('../models/InAppNotification.js').then(({ InAppNotification }) => {
            InAppNotification.create({
              userId: labor._id,
              title: singleNotifTitle,
              body: singleNotifBody,
              type: 'BOOKING_STATUS',
              bookingId: booking._id,
              deliveryStatus: 'SENT',
              metadata: {
                bookingId: booking._id,
                bookingType: booking.type,
                isPackage: Boolean(booking.packageBooking?.isPackage),
                packageName: booking.packageBooking?.packageName,
                packagePrice: booking.packageBooking?.packagePrice,
                packageInclusions: booking.packageBooking?.inclusions || [],
                packageDescription: booking.packageBooking?.snapshot?.description || booking.packageBooking?.snapshot?.shortDescription,
                scheduledAt: booking.scheduledAt,
                timeSlot: booking.timeSlot,
                earnings: singleShare,
                link: `/app/home`,
              }
            }).then((inAppRecord) => {
              import('../socket.js').then(({ emitToUser }) => {
                emitToUser(labor._id, 'NEW_IN_APP_NOTIFICATION', inAppRecord)
              }).catch(err => console.error(err))
            }).catch(err => console.error('[InAppNotification Create Error]', err))
          }).catch(err => console.error(err))
        }
        
        const sub = activeSubsMap[labor._id]
        if (sub) {
          sub.bookingsReceived += 1
          sub.save().catch(err => console.error('Failed to increment bookingsReceived', err))
        }

        laborUpdates.push(
          User.findByIdAndUpdate(labor._id, {
            $inc: { 'labourProfile.lifetimeBroadcastsReceived': 1 }
          }).exec()
        )
      })

      Promise.all(laborUpdates).catch(err => console.error('Failed to update lifetime received', err))
    })
  }).catch(err => console.error('Failed to load socket emitter:', err))

  // Set timeout to expire broadcast if no one accepts
  setTimeout(async () => {
    const currentBooking = await Booking.findById(booking._id)
    if (currentBooking && currentBooking.status === 'BROADCASTING') {
      if (currentBooking.acceptedLabourIds && currentBooking.acceptedLabourIds.length > 0) {
        // Partially accepted, but timeout reached. Let's just finalize the partial match.
        currentBooking.status = 'ACCEPTED'
        await currentBooking.save()
        console.log(`Booking ${booking._id} EXPIRED with partial acceptance (${currentBooking.acceptedLabourIds.length}/${currentBooking.quantity || 1}).`)
        
        import('../socket.js').then(({ emitToUser, getIo }) => {
          emitToUser(currentBooking.userId, 'BOOKING_ACCEPTED', { bookingId: currentBooking._id, partial: true, acceptedCount: currentBooking.acceptedLabourIds.length })
          
          const io = getIo()
          if (io) {
            io.emit('BOOKING_EXPIRED', { bookingId: currentBooking._id })
          }
        }).catch(err => console.error(err))
      } else {
        currentBooking.status = 'FAILED'
        await currentBooking.save()
        console.log(`Booking ${booking._id} EXPIRED without acceptance.`)
        
        // Notify customer
        import('../socket.js').then(({ emitToUser }) => {
          emitToUser(currentBooking.userId, 'BOOKING_FAILED', { bookingId: currentBooking._id, reason: 'Expired' })
          
          // Notify laborers that it expired
          eligibleLaborers.forEach(labor => {
            emitToUser(labor._id, 'BOOKING_EXPIRED', { bookingId: currentBooking._id })
          })
        }).catch(err => console.error(err))
      }
    }
  }, BROADCAST_TIMEOUT_MS)
}

async function markBookingFailed(booking, reason) {
  booking.status = 'FAILED'
  await booking.save()
  console.log(`Booking ${booking._id} FAILED: ${reason}`)
  import('../socket.js').then(({ emitToUser }) => {
    emitToUser(booking.userId, 'BOOKING_FAILED', { bookingId: booking._id, reason })
  }).catch(err => console.error(err))
}
