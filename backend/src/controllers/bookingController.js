import { Booking } from '../models/Booking.js'
import { LabourSubcategory } from '../models/LabourSubcategory.js'
import { LabourService } from '../models/LabourService.js'
import { SystemSetting } from '../models/SystemSetting.js'
import { Zone } from '../models/Zone.js'
import { Wallet } from '../models/Wallet.js'
import { AdminWallet } from '../models/AdminWallet.js'
import { Invoice } from '../models/Invoice.js'
import { INVOICE_STATUS } from '../constants/workforceConstants.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { parseISTDateTime } from '../utils/dateHelper.js'

export const calculateBill = asyncHandler(async (req, res) => {
  const { serviceId, hours: rawHours = 1, quantity = 1, address, contractorServices } = req.body
  const hours = parseFloat(rawHours) || 1 // supports 0.5 = 30 min

  let matchedZone = null
  if (address) {
    const activeZones = await Zone.find({ isActive: true }).lean()
    matchedZone = activeZones.find(z => address.toLowerCase().includes(z.city.toLowerCase()))
  }

  const resolveHourlyRate = async (sId) => {
    const service = await LabourService.findById(sId)
    let hourlyRate = 0
    let originalHourlyRate = 0
    let discountType = 'PERCENTAGE'
    let discountValue = 0
    let offerBadge = ''
    let name = ''
    let categoryId = null
    if (service) {
      originalHourlyRate = service.hourlyPrice || service.basePrice || 0
      discountType = service.discountType || 'PERCENTAGE'
      discountValue = Number(service.discountValue || 0)
      offerBadge = service.offerBadge || ''
      name = service.name
      const sub = await LabourSubcategory.findById(service.subcategoryId)
      if (sub) categoryId = sub.categoryId
      if (matchedZone && service.zones && service.zones.length > 0) {
        const zonePricing = service.zones.find(z => String(z.zone) === String(matchedZone._id))
        if (zonePricing && typeof zonePricing.price === 'number') {
          originalHourlyRate = zonePricing.price
        }
      }
      if (discountValue > 0) {
        if (discountType === 'PERCENTAGE') {
          hourlyRate = Math.max(0, Math.round(originalHourlyRate * (1 - discountValue / 100)))
        } else {
          hourlyRate = Math.max(0, originalHourlyRate - discountValue)
        }
      } else {
        hourlyRate = originalHourlyRate
      }
    } else {
      const subcategory = await LabourSubcategory.findById(sId)
      if (subcategory) {
        originalHourlyRate = subcategory.basePrice || 800
        hourlyRate = originalHourlyRate
        name = subcategory.name
        categoryId = subcategory.categoryId
      } else {
        const { LabourCategory } = await import('../models/LabourCategory.js')
        const category = await LabourCategory.findById(sId)
        if (category) {
          originalHourlyRate = 800
          hourlyRate = originalHourlyRate
          name = category.name
          categoryId = category._id
        } else {
          return { error: 'Service or Category not found' }
        }
      }
    }
    return { hourlyRate, originalHourlyRate, discountType, discountValue, offerBadge, name, categoryId }
  }

  let subTotal = 0
  let originalSubTotal = 0
  let serviceDiscount = 0
  let breakdown = []

  const servicesToCalculate = contractorServices && contractorServices.length > 0 
    ? contractorServices 
    : [{ serviceId, quantity }]

  let primaryCategoryId = null
  for (const item of servicesToCalculate) {
    if (!item.serviceId) continue
    const { hourlyRate, originalHourlyRate, discountType, discountValue, offerBadge, name, categoryId, error } = await resolveHourlyRate(item.serviceId)
    if (error) return sendError(res, { message: error, statusCode: HTTP_STATUS.NOT_FOUND })
    
    if (!primaryCategoryId && categoryId) primaryCategoryId = categoryId

    const itemOriginalTotal = (originalHourlyRate || hourlyRate) * hours * (item.quantity || 1)
    const itemTotal = hourlyRate * hours * (item.quantity || 1)
    const itemDiscount = Math.max(0, itemOriginalTotal - itemTotal)

    originalSubTotal += itemOriginalTotal
    subTotal += itemTotal
    serviceDiscount += itemDiscount

    breakdown.push({
      serviceId: item.serviceId,
      name,
      originalHourlyRate: originalHourlyRate || hourlyRate,
      hourlyRate,
      discountType,
      discountValue,
      offerBadge,
      hours,
      quantity: item.quantity || 1,
      subTotal: itemTotal,
      savings: itemDiscount,
    })
  }

  let settings = await SystemSetting.findOne({ configKey: 'master_config' })
  if (!settings) {
    settings = await SystemSetting.create({ configKey: 'master_config' })
  }

  // Calculate Subtotal (Hourly Rate * Hours * Quantity)
  let maxHourDiscount = 0

  if (hours >= 8 && settings.maxHourDiscountPercentage > 0) {
    maxHourDiscount = (subTotal * settings.maxHourDiscountPercentage) / 100
  }

  let basePrice = subTotal - maxHourDiscount
  let platformFee = 0

  if (settings.platformFee.isActive) {
    if (settings.platformFee.type === 'fixed') {
      platformFee = settings.platformFee.value
    } else if (settings.platformFee.type === 'percentage') {
      platformFee = (basePrice * settings.platformFee.value) / 100
    }
  }

  const baseAmount = basePrice + platformFee
  let taxes = 0

  let gstPercentage = 0
  if (primaryCategoryId) {
    const { LabourCategory } = await import('../models/LabourCategory.js')
    const category = await LabourCategory.findById(primaryCategoryId)
    if (category && category.isGstActive) {
      gstPercentage = category.gstPercentage || 0
    }
  } else if (settings.gstPercentage > 0) {
    // Fallback to global if for some reason category is not resolved
    gstPercentage = settings.gstPercentage
  }

  if (gstPercentage > 0) {
    taxes = (basePrice * gstPercentage) / 100
  }

  const totalAmount = baseAmount + taxes

  // Also pre-calculate commission to show to admin internally, but user doesn't necessarily need to see it
  let commissionAmount = 0
  if (settings.commission.isActive && settings.commission.type === 'global') {
    commissionAmount = (basePrice * settings.commission.globalPercentage) / 100
  }

  return sendSuccess(res, {
    data: {
      originalSubTotal,
      serviceDiscount,
      subTotal,
      maxHourDiscount,
      totalSavings: serviceDiscount + maxHourDiscount,
      basePrice,
      platformFee,
      taxes,
      totalAmount,
      commissionAmount, // Internal calculation preview
      laborShare: basePrice - commissionAmount,
      paymentModes: settings.paymentModes || { cashEnabled: true, onlineEnabled: true },
      breakdown
    }
  })
})

export const createBooking = asyncHandler(async (req, res) => {
  const { serviceId, type, scheduledAt, timeSlot, endTime, locationText, lat, lng, paymentMethod, notes, hours: rawHours = 1, quantity = 1, imageNames = [], contractorInfo } = req.body
  const hours = parseFloat(rawHours) || 1 // supports 0.5 = 30 min

  if (!serviceId || !type || !locationText || !paymentMethod) {
    return sendError(res, { message: 'Missing required fields', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  if (lat === undefined || lng === undefined) {
    return sendError(res, { message: 'Latitude and Longitude are required for accurate matching', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  if (type === 'SCHEDULED' && (!scheduledAt || !timeSlot)) {
    return sendError(res, { message: 'scheduledAt date and timeSlot (startTime) are required for SCHEDULED bookings', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const service = await LabourService.findById(serviceId)
  if (!service || !service.isActive) {
    return sendError(res, { message: 'Valid and active Service required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  let settings = await SystemSetting.findOne({ configKey: 'master_config' })
  
  const parsedLng = parseFloat(lng)
  const parsedLat = parseFloat(lat)

  // Enforce Zone matching
  const activeZones = await Zone.find({ isActive: true })
  const normalizedLocation = locationText.toLowerCase()
  const matchingZone = activeZones.find(z => normalizedLocation.includes(z.city.toLowerCase()))

  if (!matchingZone) {
    return sendError(res, { message: 'We currently do not provide service in this area (Zone not found).', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  
  const resolveHourlyRate = async (sId) => {
    let hrRate = 0
    const srv = await LabourService.findById(sId)
    if (srv) {
      let baseRate = srv.hourlyPrice || srv.basePrice || 0
      if (matchingZone && srv.zones && srv.zones.length > 0) {
        const zonePricing = srv.zones.find(z => String(z.zone) === String(matchingZone._id))
        if (zonePricing && typeof zonePricing.price === 'number') {
          baseRate = zonePricing.price
        }
      }
      if (srv.discountValue > 0) {
        if (srv.discountType === 'PERCENTAGE') {
          hrRate = Math.max(0, Math.round(baseRate * (1 - srv.discountValue / 100)))
        } else {
          hrRate = Math.max(0, baseRate - srv.discountValue)
        }
      } else {
        hrRate = baseRate
      }
    }
    return hrRate
  }

  let subTotal = 0
  if (contractorInfo && contractorInfo.services && contractorInfo.services.length > 0) {
    for (const item of contractorInfo.services) {
      const hrRate = await resolveHourlyRate(item.serviceId)
      item.price = hrRate // Store the unit hourly rate
      subTotal += hrRate * hours * (item.quantity || 1)
    }
  } else {
    const hrRate = await resolveHourlyRate(serviceId)
    subTotal = hrRate * hours * quantity
  }
  let maxHourDiscount = 0
  if (hours >= 8 && settings?.maxHourDiscountPercentage > 0) {
    maxHourDiscount = (subTotal * settings.maxHourDiscountPercentage) / 100
  }
  
  const basePrice = subTotal - maxHourDiscount
  let platformFee = 0
  if (settings?.platformFee?.isActive) {
    platformFee = settings.platformFee.type === 'fixed' 
      ? settings.platformFee.value 
      : (basePrice * settings.platformFee.value) / 100
  }
  
  const baseAmount = basePrice + platformFee
  let taxes = 0
  
  let gstPercentage = 0
  const subcategory = await LabourSubcategory.findById(service.subcategoryId)
  if (subcategory) {
    const { LabourCategory } = await import('../models/LabourCategory.js')
    const category = await LabourCategory.findById(subcategory.categoryId)
    if (category && category.isGstActive) {
      gstPercentage = category.gstPercentage || 0
    }
  } else if (settings?.gstPercentage > 0) {
    gstPercentage = settings.gstPercentage
  }

  if (gstPercentage > 0) {
    taxes = (basePrice * gstPercentage) / 100
  }

  
  const totalAmount = baseAmount + taxes

  let commissionAmount = 0
  if (settings?.commission?.isActive && settings.commission.type === 'global') {
    commissionAmount = (basePrice * settings.commission.globalPercentage) / 100
  }

  const laborShare = basePrice - commissionAmount

  const startOtp = Math.floor(1000 + Math.random() * 9000).toString()
  const completionOtp = Math.floor(1000 + Math.random() * 9000).toString()

  let totalQuantity = quantity
  if (contractorInfo && contractorInfo.services) {
    totalQuantity = contractorInfo.services.reduce((acc, curr) => acc + (curr.quantity || 1), 0)
  }

  const booking = await Booking.create({
    userId: req.user._id,
    subcategoryId: service.subcategoryId,
    serviceId: service._id,
    type,
    scheduledAt: type === 'SCHEDULED' ? parseISTDateTime(scheduledAt, timeSlot) : undefined,
    timeSlot: type === 'SCHEDULED' ? timeSlot : (type === 'INSTANT' ? timeSlot : undefined),
    endTime: type === 'SCHEDULED' ? endTime : undefined,
    images: Array.isArray(imageNames) ? imageNames : [],
    notes,
    hours,
    quantity: totalQuantity,
    contractorInfo,
    maxHourDiscount,
    address: { 
      locationText,
      coordinates: {
        type: 'Point',
        coordinates: [parsedLng, parsedLat] // GeoJSON uses [longitude, latitude]
      }
    },
    basePrice,
    platformFee,
    taxes,
    totalAmount,
    commissionAmount,
    laborShare,
    paymentMethod,
    status: 'CREATED',
    startOtp,
    completionOtp
  })


  // Phase 3: Trigger the Broadcast Engine asynchronously
  // Only trigger immediately for INSTANT bookings.
  // SCHEDULED bookings will be handled by the broadcastCron job 1 hour before the time.
  if (type === 'INSTANT') {
    import('../services/broadcastService.js').then(({ startBroadcastCycle }) => {
      startBroadcastCycle(booking._id).catch(err => console.error('Broadcast Error:', err))
    })
  } else {
    // For scheduled, we can emit a socket event to let the user know it is confirmed and queued
    import('../socket.js').then(({ emitToUser }) => {
      emitToUser(booking.userId, 'BOOKING_SCHEDULED_QUEUED', { bookingId: booking._id, scheduledAt: booking.scheduledAt })
    }).catch(err => console.error(err))
  }

  // Save the address for future use if requested
  if (req.body.saveAddress) {
    import('../models/User.js').then(({ User }) => {
      User.findByIdAndUpdate(req.user._id, {
        'savedAddress.text': locationText,
        'savedAddress.lat': lat,
        'savedAddress.lng': lng
      }).catch(err => console.error('Update savedAddress error:', err))
    })
  }

  return sendSuccess(res, { message: 'Booking created successfully', statusCode: HTTP_STATUS.CREATED, data: { booking } })
})

export const getBookingStatus = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate('subcategoryId')
    .populate('serviceId').populate('contractorInfo.services.serviceId')
    .populate('laborId', 'fullName phone profileImageUrl')
    .populate('userId', 'fullName phone')
    .populate('assignments.labourId', 'fullName phone profileImageUrl serviceIds labourProfile')
    .lean()

  if (!booking) {
    return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  // Hide OTPs from labourer
  if (['labour', 'contractor'].includes(req.user.role)) {
    // Only hide if the requesting user is the labourer. If it's the contractor, they SHOULD see the OTPs to share with labourer or verify?
    // Wait, the contractor IS the customer in this scenario. The contractor role acts as the buyer. 
    // If the req.user._id matches booking.userId, they are the customer, they should see OTPs.
    if (String(req.user._id) !== String(booking.userId?._id || booking.userId)) {
      delete booking.startOtp
      delete booking.completionOtp
      if (booking.assignments) {
        booking.assignments.forEach(a => {
          delete a.startOtp;
          delete a.completionOtp;
        })
      }
    }
  }

  return sendSuccess(res, { data: { booking } })
})

export const getMyBookings = asyncHandler(async (req, res) => {
  const { role, _id } = req.user
  
  let query = {}
  if (role === 'customer' || role === 'contractor') {
    query = { userId: _id }
  } else if (role === 'labour' || role === 'contractor') {
    // A contractor could also be a labourer for some jobs if configured that way, but mainly they are customers.
    // We'll use an OR query to support both if they act as both.
    query = { 
      $or: [
        { userId: _id },
        { laborId: _id, status: { $in: ['ACCEPTED', 'ASSIGNED', 'EN_ROUTE', 'STARTED', 'COMPLETED', 'CANCELLED'] } },
        { acceptedLabourIds: _id }
      ] 
    }
  } else {
    return sendError(res, { message: 'Unauthorized role for fetching bookings', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const bookings = await Booking.find(query)
    .populate('subcategoryId')
    .populate('serviceId').populate('contractorInfo.services.serviceId')
    .populate('userId', 'fullName phone')
    .populate('laborId', 'fullName phone profileImageUrl')
    .populate('assignments.labourId', 'fullName phone profileImageUrl serviceIds labourProfile')
    .sort({ createdAt: -1 })
    .lean()

  bookings.forEach(b => {
    // Hide OTPs if the requesting user is NOT the customer
    if (String(_id) !== String(b.userId?._id || b.userId)) {
      delete b.startOtp
      delete b.completionOtp
      if (b.assignments) {
        b.assignments.forEach(a => {
          delete a.startOtp;
          delete a.completionOtp;
        })
      }
    }
  })

  return sendSuccess(res, { data: { bookings } })
})

// @desc    Update booking payment method
// @route   PATCH /api/v1/bookings/:id/payment-method
// @access  Private (User)
export const updatePaymentMethod = asyncHandler(async (req, res) => {
  const { paymentMethod } = req.body
  const booking = await Booking.findById(req.params.id)

  if (!booking) {
    return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  // Only allow updating if it belongs to the user
  if (booking.userId.toString() !== req.user.id) {
    return sendError(res, { message: 'Not authorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  booking.paymentMethod = paymentMethod
  await booking.save()

  res.json({ success: true, paymentMethod })
})

export const updateBookingStatus = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { status, otp, startWorkImage, endWorkImage, beforeImage, afterImage } = req.body
  const booking = await Booking.findById(id)
  
  if (!booking) return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })
  
  const isLabourer = String(req.user._id) !== String(booking.userId);
  const labourIdStr = String(req.user._id);

  if (isLabourer && !booking.acceptedLabourIds?.includes(labourIdStr) && String(booking.laborId) !== labourIdStr) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const validTransitions = {
    'ACCEPTED': ['EN_ROUTE', 'CANCELLED'],
    'EN_ROUTE': ['STARTED', 'CANCELLED'],
    'STARTED': ['COMPLETED']
  }

  // Find specific assignment if bulk booking
  let assignment = booking.assignments?.find(a => String(a.labourId) === labourIdStr);
  const currentStatus = assignment ? assignment.status : booking.status;

  if (currentStatus === status) {
    return sendSuccess(res, { message: `Status is already ${status}`, data: { booking } })
  }

  if (!validTransitions[currentStatus]?.includes(status)) {
    return sendError(res, { message: `Invalid transition from ${currentStatus} to ${status}`, statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const startOtp = assignment ? assignment.startOtp : booking.startOtp;
  const completionOtp = assignment ? assignment.completionOtp : booking.completionOtp;

  // OTP Verification
  if (status === 'STARTED') {
    if (!otp) return sendError(res, { message: 'OTP is required to start the job', statusCode: HTTP_STATUS.BAD_REQUEST })
    if (otp !== startOtp) return sendError(res, { message: 'Invalid Start OTP', statusCode: HTTP_STATUS.BAD_REQUEST })
    const finalStartImg = startWorkImage || beforeImage
    
    if (assignment) {
      if (finalStartImg) assignment.startWorkImage = finalStartImg;
      assignment.startedAt = new Date();
    } else {
      if (finalStartImg) booking.startWorkImage = finalStartImg;
      booking.startedAt = new Date();
    }
  }

  if (status === 'COMPLETED') {
    if (!otp) return sendError(res, { message: 'OTP is required to complete the job', statusCode: HTTP_STATUS.BAD_REQUEST })
    if (otp !== completionOtp) return sendError(res, { message: 'Invalid Completion OTP', statusCode: HTTP_STATUS.BAD_REQUEST })
    const finalEndImg = endWorkImage || afterImage
    
    if (assignment) {
      if (finalEndImg) assignment.endWorkImage = finalEndImg;
      assignment.completedAt = new Date();
    } else {
      if (finalEndImg) booking.endWorkImage = finalEndImg;
    }
  }

  if (assignment) {
    assignment.status = status;
  } else {
    booking.status = status;
  }

  // Calculate top-level booking status based on assignments if it's a bulk booking
  if (booking.assignments && booking.assignments.length > 0) {
    const allStatuses = booking.assignments.map(a => a.status);
    const expectedQuantity = booking.quantity || 1;
    if (allStatuses.length > 0 && allStatuses.every(s => s === 'COMPLETED')) {
      booking.status = 'COMPLETED';
    } else if (allStatuses.some(s => s === 'STARTED' || s === 'COMPLETED')) {
      booking.status = 'STARTED';
    } else if (allStatuses.some(s => s === 'EN_ROUTE')) {
      booking.status = 'EN_ROUTE';
    } else if (allStatuses.length === expectedQuantity && allStatuses.every(s => s === 'ACCEPTED')) {
      booking.status = 'ACCEPTED';
    }
  } else if (!assignment) {
    booking.status = status;
  }

  await booking.save()

  // Phase 4: Handle Commission if Cash Payment and Completed
  if (status === 'COMPLETED') {
    let wallet = await Wallet.findOne({ userId: booking.laborId })
    if (!wallet) wallet = new Wallet({ userId: booking.laborId })

    if (booking.paymentMethod === 'CASH') {
      // NOTE: Admin dues for CASH bookings are now collected only when the customer explicitly clicks "Paid",
      // and are processed inside confirmCashPayment to prevent charging the labourer before they collect the cash.
    } else if (booking.paymentMethod === 'ONLINE') {
      // ONLY payout if the customer has actually completed the online payment.
      // If they haven't paid yet, the paymentController will handle this payout later once they pay.
      if (booking.paymentStatus === 'PAID') {
        // Add laborShare to labor's self wallet
        wallet.selfBalance += booking.laborShare
        await wallet.save()

        import('../models/WalletTransaction.js').then(({ WalletTransaction }) => {
          WalletTransaction.create({
            walletId: wallet._id,
            amount: booking.laborShare,
            type: 'CREDIT',
            targetWallet: 'SELF',
            context: 'PAYOUT',
            referenceId: booking._id,
            description: 'Payout for Online Booking'
          }).catch(err => console.error('WalletTx error:', err))
        })

        // Log splits to AdminWallet for Platform Fee, Commission and total business
        if (booking.platformFee > 0 || booking.commissionAmount > 0 || booking.basePrice > 0 || booking.taxes > 0) {
          let adminWallet = await AdminWallet.findOne()
          if (!adminWallet) adminWallet = new AdminWallet()
          
          adminWallet.totalPlatformFeesCollected += (booking.platformFee || 0)
          adminWallet.totalCommissionsCollected += (booking.commissionAmount || 0)
          adminWallet.totalTaxesCollected += (booking.taxes || 0)
          adminWallet.totalServiceAmountCollected += (booking.basePrice || 0)
          await adminWallet.save()
        }
      }
    }
  }

  // Notify customer
  import('../socket.js').then(({ emitToUser }) => {
    emitToUser(booking.userId, 'BOOKING_STATUS_UPDATE', { bookingId: booking._id, status })
    if (booking.assignments && booking.assignments.length > 0) {
      booking.assignments.forEach(a => {
        const lid = typeof a.labourId === 'object' ? a.labourId._id : a.labourId;
        if (lid) emitToUser(lid, 'BOOKING_STATUS_UPDATE', { bookingId: booking._id, status })
      });
    }
  }).catch(err => console.error(err))

  // Also send Push Notification
  import('../utils/pushNotificationHelper.js').then(({ sendNotificationToUser }) => {
    // To Customer
    sendNotificationToUser(booking.userId, {
      title: 'Booking Update',
      body: `Your booking status is now ${status}`,
      data: { type: 'booking_update', bookingId: String(booking._id) }
    })
    
    // To Labourers
    if (booking.assignments && booking.assignments.length > 0) {
      booking.assignments.forEach(a => {
        const lid = typeof a.labourId === 'object' ? a.labourId._id : a.labourId;
        if (lid) {
          sendNotificationToUser(lid, {
            title: 'Job Status Update',
            body: `The job status has been updated to ${status}`,
            data: { type: 'booking_update', bookingId: String(booking._id) }
          })
        }
      });
    } else if (booking.laborId) {
      sendNotificationToUser(booking.laborId, {
        title: 'Job Status Update',
        body: `The job status has been updated to ${status}`,
        data: { type: 'booking_update', bookingId: String(booking._id) }
      })
    }
  }).catch(err => console.error(err))

  return sendSuccess(res, { message: `Booking marked as ${status}`, data: { booking } })
})

export const confirmCashPayment = asyncHandler(async (req, res) => {
  const { id } = req.params
  
  const booking = await Booking.findById(id)
  if (!booking) {
    return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }
  
  if (booking.userId.toString() !== req.user._id.toString()) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  if (booking.status !== 'COMPLETED') {
    return sendError(res, { message: 'Booking must be completed before payment', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  
  if (booking.paymentMethod !== 'CASH') {
    return sendError(res, { message: 'Not a cash booking', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  if (booking.paymentStatus === 'PAID') {
    return sendSuccess(res, { message: 'Already paid', data: { booking } })
  }

  booking.paymentStatus = 'PAID'
  await booking.save()

  // Charge Admin Dues to the Labourer's Wallet NOW that the cash has been collected!
  import('../models/Wallet.js').then(async ({ Wallet }) => {
    let wallet = await Wallet.findOne({ userId: booking.laborId })
    if (!wallet) wallet = new Wallet({ userId: booking.laborId })
    
    const adminDues = (booking.platformFee || 0) + (booking.taxes || 0) + (booking.commissionAmount || 0)
    wallet.adminBalance += adminDues
    await wallet.save()

    import('../models/WalletTransaction.js').then(({ WalletTransaction }) => {
      WalletTransaction.create({
        walletId: wallet._id,
        amount: adminDues,
        type: 'CREDIT',
        targetWallet: 'ADMIN',
        context: 'BOOKING',
        referenceId: booking._id,
        description: 'Platform fees, taxes & commission for Cash Booking'
      }).catch(err => console.error('WalletTx error:', err))
    })

    // Log splits to AdminWallet for Platform Fee and Commission
    if (booking.platformFee > 0 || booking.commissionAmount > 0 || booking.basePrice > 0 || booking.taxes > 0) {
      import('../models/AdminWallet.js').then(async ({ AdminWallet }) => {
        let adminWallet = await AdminWallet.findOne()
        if (!adminWallet) adminWallet = new AdminWallet()
        
        adminWallet.totalPlatformFeesCollected += (booking.platformFee || 0)
        adminWallet.totalCommissionsCollected += (booking.commissionAmount || 0)
        adminWallet.totalTaxesCollected += (booking.taxes || 0)
        adminWallet.totalServiceAmountCollected += (booking.basePrice || 0)
        await adminWallet.save()
      }).catch(err => console.error('AdminWallet error:', err))
    }
  }).catch(err => console.error(err))

  // Notify both
  import('../socket.js').then(({ emitToUser }) => {
    emitToUser(booking.laborId, 'BOOKING_STATUS_UPDATE', { bookingId: booking._id, status: booking.status, paymentStatus: 'PAID' })
        emitToUser(booking.userId, 'BOOKING_STATUS_UPDATE', { bookingId: booking._id, status: booking.status, paymentStatus: 'PAID' })
        if (booking.assignments && booking.assignments.length > 0) {
          booking.assignments.forEach(a => {
            const lid = typeof a.labourId === 'object' ? a.labourId._id : a.labourId;
            if (lid) emitToUser(lid, 'BOOKING_STATUS_UPDATE', { bookingId: booking._id, status: booking.status, paymentStatus: 'PAID' })
          });
        }
  }).catch(err => console.error(err))

  return sendSuccess(res, { message: 'Cash payment confirmed', data: { booking } })
})

export const addExtraTime = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { extraHours: rawExtra, assignmentId } = req.body
  const extraHours = parseFloat(rawExtra) || 0 // supports 0.5 = 30 min

  if (extraHours < 0.5) {
    return sendError(res, { message: 'Extra time must be at least 30 minutes (0.5)', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const booking = await Booking.findById(id)
  if (!booking) {
    return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  if (booking.userId.toString() !== req.user._id.toString()) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  if (!['ACCEPTED', 'EN_ROUTE', 'STARTED', 'COMPLETED'].includes(booking.status)) {
    return sendError(res, { message: 'Cannot add extra time at this status', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  if (booking.paymentStatus === 'PAID') {
    return sendError(res, { message: 'Booking is already paid', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const totalExtraAmount = (booking.assignments && booking.assignments.length > 0) 
    ? booking.assignments.reduce((sum, a) => sum + (a.extraAmount || 0), 0) 
    : (booking.extraAmount || 0)
  
  const originalBasePrice = booking.basePrice - totalExtraAmount
  
  let totalProfessionals = booking.quantity || 1
  if (booking.contractorInfo && booking.contractorInfo.services && booking.contractorInfo.services.length > 0) {
    totalProfessionals = booking.contractorInfo.services.reduce((sum, s) => sum + (s.quantity || 1), 0)
  }
  
  let hourlyRate = originalBasePrice / (booking.hours * totalProfessionals)
  
  // If specific assignment is provided, try to find its exact service rate
  if (assignmentId && booking.assignments && booking.contractorInfo && booking.contractorInfo.services) {
    const assignment = booking.assignments.find(a => String(a.labourId) === String(assignmentId) || String(a._id) === String(assignmentId))
    if (assignment && assignment.serviceId) {
      const serviceInfo = booking.contractorInfo.services.find(s => String(s.serviceId) === String(assignment.serviceId))
      if (serviceInfo && serviceInfo.price) {
        hourlyRate = serviceInfo.price
      }
    }
  }

  const addedBasePrice = extraHours * hourlyRate

  let newBasePrice = booking.basePrice + addedBasePrice

  const settings = await SystemSetting.findOne({ configKey: 'master_config' })

  let platformFee = booking.platformFee
  if (settings?.platformFee?.isActive) {
    platformFee = settings.platformFee.type === 'fixed' 
      ? settings.platformFee.value 
      : (newBasePrice * settings.platformFee.value) / 100
  }
  
  const baseAmount = newBasePrice + platformFee
  let taxes = 0

  let gstPercentage = 0
  if (booking.subcategoryId) {
    const subcategory = await LabourSubcategory.findById(booking.subcategoryId)
    if (subcategory) {
      const { LabourCategory } = await import('../models/LabourCategory.js')
      const category = await LabourCategory.findById(subcategory.categoryId)
      if (category && category.isGstActive) {
        gstPercentage = category.gstPercentage || 0
      }
    }
  } else if (settings?.gstPercentage > 0) {
    gstPercentage = settings.gstPercentage
  }

  if (gstPercentage > 0) {
    taxes = (newBasePrice * gstPercentage) / 100
  }

  
  const newTotalAmount = baseAmount + taxes

  let commissionAmount = booking.commissionAmount
  if (settings?.commission?.isActive && settings.commission.type === 'global') {
    commissionAmount = (newBasePrice * settings.commission.globalPercentage) / 100
  }

  const laborShare = newBasePrice - commissionAmount

  // Update specific assignment or the whole booking
  if (assignmentId && booking.assignments && booking.assignments.length > 0) {
    const assignment = booking.assignments.find(a => String(a.labourId) === String(assignmentId) || String(a._id) === String(assignmentId))
    if (!assignment) return sendError(res, { message: 'Assignment not found', statusCode: HTTP_STATUS.NOT_FOUND })
    assignment.extraHours = (assignment.extraHours || 0) + extraHours
    assignment.extraAmount = (assignment.extraAmount || 0) + addedBasePrice
  } else {
    booking.extraHours = (booking.extraHours || 0) + extraHours
    booking.extraAmount = (booking.extraAmount || 0) + addedBasePrice
  }

  booking.basePrice = newBasePrice
  booking.platformFee = platformFee
  booking.taxes = taxes
  booking.totalAmount = newTotalAmount
  booking.commissionAmount = commissionAmount
  booking.laborShare = laborShare

  await booking.save()

  // Notify socket
  import('../socket.js').then(({ emitToUser }) => {
    emitToUser(booking.userId, 'BOOKING_UPDATED', { bookingId: booking._id })
  }).catch(err => console.error(err))

  return sendSuccess(res, { message: 'Extra time added successfully', data: { booking } })
})

function generateInvoiceNumber() {
  return `INV-${Math.random().toString(36).substring(2, 10).toUpperCase()}`
}

export const generateMyInvoice = asyncHandler(async (req, res) => {
  const { id } = req.params

  const booking = await Booking.findById(id)
    .populate('subcategoryId')
    .populate('serviceId').populate('contractorInfo.services.serviceId')
    .populate('laborId', 'fullName phone profileImageUrl')
    .populate('userId', 'fullName phone')
    .populate('assignments.labourId', 'fullName phone profileImageUrl serviceIds labourProfile')
    .lean()

  if (!booking) {
    return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  // Ensure it's the user's booking
  if (String(booking.userId._id || booking.userId) !== String(req.user._id)) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  let invoice = await Invoice.findOne({ requestId: id }).lean()

  if (!invoice) {
    let lines = []
    if (booking.contractorInfo?.services?.length > 0) {
      const services = booking.contractorInfo.services || []
      const assignments = booking.assignments || []
      const bookingHours = booking.duration || booking.hours || 1

      let subtotal = 0
      lines = services.map((s, idx) => {
        const sId = s.serviceId?._id ? String(s.serviceId._id) : String(s.serviceId || '')
        let matched = assignments.filter(a => {
          const aSvcId = a.serviceId?._id ? String(a.serviceId._id) : String(a.serviceId || '')
          return aSvcId && aSvcId === sId
        })
        if (matched.length === 0 && assignments.length > 0) {
          let offset = 0
          for (let i = 0; i < idx; i++) offset += Number(services[i].quantity) || 1
          matched = assignments.slice(offset, offset + (Number(s.quantity) || 1))
        }

        const completedAssignments = matched.filter(a => a.status === 'COMPLETED')
        const completedCount = completedAssignments.length
        const extraHours = completedAssignments.reduce((acc, a) => acc + (Number(a.extraHours) || 0), 0)
        const lineAmount = ((s.price || 0) * bookingHours * completedCount) + ((s.price || 0) * extraHours)
        subtotal += lineAmount

        return {
          description: `Service - ${s.serviceId?.name || 'Contractor Service'} (${completedCount}/${s.quantity || 1} completed)`,
          categoryId: booking.subcategoryId,
          billableUnits: completedCount,
          ratePerUnit: s.price || 0,
          amount: lineAmount,
          gstAmount: 0,
        }
      })

      const originalBase = booking.basePrice || subtotal
      const ratio = originalBase > 0 ? subtotal / originalBase : 0
      const gstTotal = Math.round((booking.taxes || 0) * ratio)
      const platformFee = subtotal > 0 ? (booking.platformFee || 0) : 0
      const total = subtotal + gstTotal + platformFee

      invoice = await Invoice.create({
        invoiceNumber: generateInvoiceNumber(),
        contractorId: booking.contractorInfo?.services ? booking.userId._id || booking.userId : undefined,
        requestId: booking._id,
        type: 'attendance',
        billingMode: 'postpaid',
        status: INVOICE_STATUS.ISSUED,
        lines,
        subtotal,
        gstTotal,
        total,
        issuedAt: new Date(),
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      })
    } else {
      lines = [
        {
          description: `Service - ${booking.serviceId?.name || 'Booking Service'}`,
          categoryId: booking.subcategoryId,
          billableUnits: booking.quantity || 1,
          ratePerUnit: booking.basePrice || 0,
          amount: booking.basePrice || 0,
          gstAmount: booking.taxes || 0,
        }
      ]

      invoice = await Invoice.create({
        invoiceNumber: generateInvoiceNumber(),
        contractorId: undefined,
        requestId: booking._id,
        type: 'attendance',
        billingMode: 'postpaid',
        status: INVOICE_STATUS.ISSUED,
        lines,
        subtotal: booking.basePrice || 0,
        gstTotal: booking.taxes || 0,
        total: booking.totalAmount || 0,
        issuedAt: new Date(),
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      })
    }
  }

  // Hide OTPs
  delete booking.startOtp
  delete booking.completionOtp
  if (booking.assignments) {
    booking.assignments.forEach(a => {
      delete a.startOtp;
      delete a.completionOtp;
    })
  }

  return sendSuccess(res, { data: { invoice, booking }, statusCode: HTTP_STATUS.CREATED })
})
