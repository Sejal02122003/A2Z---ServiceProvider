import { User } from '../models/User.js'
import { Booking } from '../models/Booking.js'
import { BroadcastLog } from '../models/BroadcastLog.js'
import { SystemSetting } from '../models/SystemSetting.js'
import { getRoadDistances } from '../utils/googleMapsDistance.js'
import { UserSubscription } from '../models/UserSubscription.js'
import { Review } from '../models/Review.js'
import { sendNotificationToUser } from '../utils/pushNotificationHelper.js'

export const BROADCAST_TIMEOUT_MS = 300000 // 5 minutes flash broadcast timeout

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

  // EXCLUDE labourers who are actively executing a job on-site
  const busyBookings = await Booking.find({
    status: { $in: ['EN_ROUTE', 'STARTED'] },
    acceptedLabourId: { $exists: true, $ne: null }
  }).select('acceptedLabourId').lean()
  const busyLabourIds = busyBookings.map(b => b.acceptedLabourId)

  const query = {
    _id: { $nin: busyLabourIds },
    role: { $in: ['labour', 'contractor', 'vendor'] },
    'labourProfile.availabilityStatus': 'available',
    'labourProfile.kycStatus': 'verified',
    'labourProfile.currentLatitude': { $gte: bookingLat - bufferLatDiff, $lte: bookingLat + bufferLatDiff },
    'labourProfile.currentLongitude': { $gte: bookingLng - bufferLngDiff, $lte: bookingLng + bufferLngDiff }
  }

  const matchOr = []
  if (booking.contractorInfo && booking.contractorInfo.services && booking.contractorInfo.services.length > 0) {
    const requestedServiceIds = booking.contractorInfo.services.map(s => s.serviceId)
    matchOr.push({ 'labourProfile.serviceIds': { $in: requestedServiceIds } })
  } else {
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

  if (matchOr.length > 0) {
    query.$or = matchOr
  }

  const potentialLaborersRaw = await User.find(query).lean()

  const to24Hour = (timeStr) => {
    if (!timeStr) return ''
    const match = timeStr.match(/(\d+):(\d+)\s?(AM|PM)?/i)
    if (!match) return timeStr
    let [ , h, m, ampm ] = match
    h = parseInt(h, 10)
    if (ampm) {
      if (ampm.toUpperCase() === 'PM' && h < 12) h += 12
      if (ampm.toUpperCase() === 'AM' && h === 12) h = 0
    }
    return `${String(h).padStart(2, '0')}:${m}`
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

  const potentialLaborers = potentialLaborersRaw.filter(labor => {
    const schedule = labor.labourProfile?.schedule || []
    if (schedule.length === 0) return true // Assume available if no schedule set

    const dayEntry = schedule.find(s => s.day === targetDayName)
    if (!dayEntry || !dayEntry.isAvailable) return false
    
    const sTime = to24Hour(dayEntry.startTime || '00:00')
    const eTime = to24Hour(dayEntry.endTime || '23:59')
    
    if (booking.type === 'INSTANT') {
      // For instant jobs, worker is available if current time falls within working shift
      if (currentIstTimeStr < sTime || currentIstTimeStr > eTime) return false
      return true
    }

    // For scheduled jobs
    if (targetStartTimeStr < sTime || targetStartTimeStr > eTime) return false
    if (targetEndTimeStr && targetEndTimeStr > eTime) return false

    return true
  })

  if (potentialLaborers.length === 0) {
    await markBookingFailed(booking, 'No laborers in area')
    return
  }

  // Wallet Eligibility Filter removed as per request
  const walletEligible = potentialLaborers

  // 3b. Subscription Eligibility Filter
  const subEligible = []
  const today = new Date().toISOString().split('T')[0]
  const activeSubsMap = {} // Store to increment bookingsReceived later
  const isSubscriptionEnforced = settings?.isUserSubscriptionEnabled === true

  if (!isSubscriptionEnforced) {
    // When subscription is disabled in settings, all available laborers are eligible
    subEligible.push(...walletEligible)
  } else {
    for (const labor of walletEligible) {
      const trialEnds = labor.labourProfile?.trialEndsAt
      const now = new Date()
      if (trialEnds && now <= new Date(trialEnds)) {
        subEligible.push(labor) // Free trial
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

  if (subEligible.length === 0) {
    await markBookingFailed(booking, 'No eligible laborers found (Subscription / Trial Expired)')
    return
  }

  // 4. Precise Distance Filter (Google Maps)
  const destinations = subEligible.map(l => ({
    id: String(l._id),
    lat: l.labourProfile.currentLatitude,
    lng: l.labourProfile.currentLongitude
  }))

  const distances = await getRoadDistances(bookingLat, bookingLng, destinations)
  
  const eligibleLaborers = subEligible.filter(labor => {
    const distData = distances.find(d => d.id === String(labor._id))
    // Include them if distance is within radius. 
    // If FALLBACK or error, we still include if Haversine said it's within radius
    return distData && distData.distanceKm <= radiusKm
  })

  if (eligibleLaborers.length === 0) {
    await markBookingFailed(booking, 'No laborers within actual driving radius')
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
    const distData = distances.find(d => d.id === idStr)
    const dist = distData ? distData.distanceKm : radiusKm
    
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

      if (booking.contractorInfo?.services?.length > 0) {
        const svcDocs = await LabourService.find({
          _id: { $in: booking.contractorInfo.services.map(s => s.serviceId) }
        }).select('_id name').lean()
        svcDocs.forEach(s => { serviceNameMap[String(s._id)] = s.name })
      } else {
        const service = await LabourService.findById(booking.serviceId).select('name').lean()
        if (service) singleServiceName = service.name
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

        if (booking.contractorInfo?.services?.length > 0) {
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
            emitToUser(labor._id, 'BOOKING_RECEIVED', {
              bookingId: booking._id,
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
            title: 'New Job Offer!',
            body: `New ${servicesPayload.length === 1 ? servicesPayload[0].name : 'Multiple Services'} job available near you. Estimated earnings: ₹${bestEarning}`,
            data: { type: 'booking_received', bookingId: String(booking._id) }
          })
        } else {
          // Single-service booking
          const singleShare = booking.laborShare || booking.basePrice || 0
          import('../socket.js').then(({ emitToUser }) => {
            emitToUser(labor._id, 'BOOKING_RECEIVED', {
              bookingId: booking._id,
              customerName: booking.userId?.fullName || 'Customer',
              serviceName: singleServiceName,
              isContractorBooking: false,
              requiresServiceSelection: false,
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
            title: 'New Job Offer!',
            body: `New ${singleServiceName} job available near you. Estimated earnings: ₹${singleShare}`,
            data: { type: 'booking_received', bookingId: String(booking._id) }
          })
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
