import { Booking } from '../models/Booking.js'
import { User } from '../models/User.js'
import { Invoice, generateInvoiceNumber } from '../models/Invoice.js'
import { INVOICE_STATUS } from '../constants/workforceConstants.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'

export const getAllBookings = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, status, search, paymentMethod, paymentStatus, adminSettlementStatus, startDate, endDate } = req.query
  const skip = (page - 1) * limit
  
  const query = {}

  if (status && status !== 'ALL') {
    if (status === 'PENDING') {
      query.status = { $in: ['CREATED', 'BROADCASTING', 'ACCEPTED', 'EN_ROUTE'] }
    } else {
      query.status = status
    }
  }

  if (paymentMethod && paymentMethod !== 'ALL') {
    query.paymentMethod = paymentMethod
  }
  if (paymentStatus && paymentStatus !== 'ALL') {
    query.paymentStatus = paymentStatus
  }
  if (adminSettlementStatus && adminSettlementStatus !== 'ALL') {
    query.adminSettlementStatus = adminSettlementStatus
  }

  if (req.query.type === 'contractor') {
    query['contractorInfo.services.0'] = { $exists: true }
  } else if (req.query.type === 'individual') {
    query['contractorInfo.services.0'] = { $exists: false }
  }

  if (startDate || endDate) {
    query.createdAt = {}
    if (startDate) query.createdAt.$gte = new Date(startDate)
    if (endDate) {
      const end = new Date(endDate)
      end.setHours(23, 59, 59, 999)
      query.createdAt.$lte = end
    }
  }

  if (search) {
    const searchRegex = new RegExp(search, 'i')
    const users = await User.find({ fullName: searchRegex }).select('_id')
    const userIds = users.map(u => u._id)
    
    query.$or = [
      { laborId: { $in: userIds } },
      { userId: { $in: userIds } }
    ]
    
    if (search.length >= 4) {
      query.$or.push({ $expr: { $regexMatch: { input: { $toString: '$_id' }, regex: search, options: 'i' } } })
    }
  }

  // Populate users beforehand if search exists, though typical simple search just matches IDs
  // To keep it simple, we'll just filter by status for now.

  const total = await Booking.countDocuments(query)
  const bookingsRaw = await Booking.find(query)
    .populate('userId', 'fullName phone email profileImageUrl serviceIds labourProfile')
    .populate('laborId', 'fullName phone email profileImageUrl serviceIds labourProfile savedAddress')
    .populate({
      path: 'subcategoryId',
      select: 'name',
      populate: { path: 'categoryId', select: 'name' }
    })
    .populate('serviceId', 'name basePrice')
    .populate('contractorInfo.services.serviceId', 'name')
    .populate('assignments.labourId', 'fullName phone profileImageUrl serviceIds labourProfile')
    .populate('assignments.serviceId', 'name basePrice')
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(Number(limit))
    .lean()

  const activeZones = await Zone.find({ isActive: true }).lean()
  const bookings = bookingsRaw.map(b => {
    const loc = b.address?.locationText?.toLowerCase() || ''
    const matchingZone = activeZones.find(z => loc.includes(z.city.toLowerCase()))
    return { ...b, zoneName: matchingZone ? matchingZone.name : 'Unknown Zone' }
  })

  return sendSuccess(res, {
    data: {
      bookings,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / limit)
      }
    }
  })
})

import { Zone } from '../models/Zone.js'

export const getBookingDetails = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate('userId', 'fullName phone email profileImageUrl serviceIds labourProfile')
    .populate('laborId', 'fullName phone email profileImageUrl serviceIds labourProfile savedAddress')
    .populate({
      path: 'subcategoryId',
      select: 'name',
      populate: { path: 'categoryId', select: 'name' }
    })
    .populate('serviceId', 'name basePrice')
    .populate('contractorInfo.services.serviceId', 'name')
    .populate('assignments.labourId', 'fullName phone profileImageUrl serviceIds labourProfile')
    .populate('assignments.serviceId', 'name basePrice')
    .lean()

  if (!booking) {
    return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  const activeZones = await Zone.find({ isActive: true }).lean()
  const loc = booking.address?.locationText?.toLowerCase() || ''
  const matchingZone = activeZones.find(z => loc.includes(z.city.toLowerCase()))
  booking.zoneName = matchingZone ? matchingZone.name : 'Unknown Zone'

  return sendSuccess(res, { data: { booking } })
})

export const updateBookingStatusAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { status } = req.body

  const validStatuses = [
    'DRAFT', 'CREATED', 'BROADCASTING', 'ACCEPTED', 
    'ASSIGNED', 'EN_ROUTE', 'STARTED', 'COMPLETED', 
    'CANCELLED', 'REFUNDED', 'FAILED'
  ]

  if (!validStatuses.includes(status)) {
    return sendError(res, { message: 'Invalid status', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const booking = await Booking.findByIdAndUpdate(
    id,
    { status },
    { new: true, runValidators: true }
  ).populate('userId', 'fullName phone email')
   .populate('laborId', 'fullName phone email')

  if (!booking) {
    return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }
  
  // Lifecycle reminder handling on admin status change
  if (['CANCELLED', 'REFUNDED', 'COMPLETED'].includes(status)) {
    import('../services/bookingReminderService.js').then(({ cancelRemindersForBooking }) => {
      cancelRemindersForBooking(booking._id, `Admin updated status to ${status}`).catch(console.error)
    }).catch(() => {})
  } else if (['ACCEPTED', 'ASSIGNED'].includes(status)) {
    import('../services/bookingReminderService.js').then(({ scheduleRemindersForBooking }) => {
      scheduleRemindersForBooking(booking._id).catch(console.error)
    }).catch(() => {})
  }

  return sendSuccess(res, { message: 'Booking status updated successfully', data: { booking } })
})

export const assignLabourerManually = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { laborId } = req.body

  if (!laborId) {
    return sendError(res, { message: 'Labour ID is required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const labourer = await User.findById(laborId)
  if (!labourer || !['labour', 'contractor'].includes(labourer.role)) {
    return sendError(res, { message: 'Valid labourer is required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const booking = await Booking.findById(id)
  if (!booking) {
    return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  if (['COMPLETED', 'CANCELLED', 'REFUNDED'].includes(booking.status)) {
    return sendError(res, { message: 'Cannot assign labourer to a completed or cancelled booking', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  booking.laborId = laborId
  booking.acceptedLabourId = laborId
  booking.status = 'ASSIGNED'
  await booking.save()

  // Auto-generate material requirement if service has mapped products
  import('../services/materialRequirementService.js')
    .then(({ generateMaterialRequirementForBooking }) => {
      generateMaterialRequirementForBooking(booking._id, laborId).catch(err =>
        console.error('[MaterialRequirement Error on Manual Assign]', err)
      )
    })
    .catch(err => console.error('[Import Error]', err))

  // Schedule automated reminder alerts for newly assigned vendor & customer
  import('../services/bookingReminderService.js')
    .then(({ scheduleRemindersForBooking }) => {
      scheduleRemindersForBooking(booking._id).catch(err =>
        console.error('[Reminder Scheduling Error on Manual Assign]', err)
      )
    })
    .catch(err => console.error('[Import Error]', err))

  const updatedBooking = await Booking.findById(id)
    .populate('userId', 'fullName phone email profileImageUrl serviceIds labourProfile')
    .populate('laborId', 'fullName phone email profileImageUrl serviceIds labourProfile')
    .populate('subcategoryId', 'name')
    .populate('serviceId', 'name basePrice')
    .lean()

  return sendSuccess(res, { message: 'Labourer assigned manually successfully', data: { booking: updatedBooking } })
})


export const createBookingAdmin = asyncHandler(async (req, res) => {
  const bookingData = req.body
  
  // Add some minimum validations based on what your Booking model expects
  if (!bookingData.userId || !bookingData.serviceId || !bookingData.type) {
    return sendError(res, { message: 'userId, serviceId, and type are required', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const startOtp = Math.floor(1000 + Math.random() * 9000).toString()
  const completionOtp = Math.floor(1000 + Math.random() * 9000).toString()

  const booking = await Booking.create({
    ...bookingData,
    startOtp,
    completionOtp
  })
  
  // Schedule reminders for newly created admin booking
  import('../services/bookingReminderService.js')
    .then(({ scheduleRemindersForBooking }) => {
      scheduleRemindersForBooking(booking._id).catch(err =>
        console.error('[Reminder Scheduling Error on Admin Create]', err)
      )
    })
    .catch(err => console.error('[Import Error]', err))

  return sendSuccess(res, { message: 'Booking created successfully', statusCode: HTTP_STATUS.CREATED, data: { booking } })
})

export const updateBookingAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params
  const updates = req.body

  const booking = await Booking.findByIdAndUpdate(id, updates, { new: true, runValidators: true })
    .populate('userId', 'fullName phone email')
    .populate('laborId', 'fullName phone email')
    .populate('subcategoryId', 'name')
    .populate('serviceId', 'name basePrice')

  if (!booking) {
    return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  // Reschedule reminders if date/time or vendor changed
  if (updates.scheduledAt || updates.timeSlot || updates.laborId) {
    import('../services/bookingReminderService.js')
      .then(({ rescheduleRemindersForBooking }) => {
        rescheduleRemindersForBooking(booking._id).catch(err =>
          console.error('[Reminder Reschedule Error on Admin Update]', err)
        )
      })
      .catch(err => console.error('[Import Error]', err))
  }

  return sendSuccess(res, { message: 'Booking updated successfully', data: { booking } })
})

export const deleteBookingAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params
  
  console.log(`[deleteBookingAdmin] Attempting to delete booking with ID: ${id}`);

  const booking = await Booking.findByIdAndDelete(id)

  if (!booking) {
    console.log(`[deleteBookingAdmin] Booking NOT FOUND for ID: ${id}`);
    return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  // If the booking was COMPLETED and ONLINE, we need to deduct its amounts from AdminWallet
  if (booking.status === 'COMPLETED' && booking.paymentMethod === 'ONLINE') {
    import('../models/AdminWallet.js').then(async ({ AdminWallet }) => {
      const adminWallet = await AdminWallet.findOne()
      if (adminWallet) {
        if (booking.commissionAmount) {
          adminWallet.totalCommissionsCollected = Math.max(0, adminWallet.totalCommissionsCollected - booking.commissionAmount)
        }
        if (booking.platformFee) {
          adminWallet.totalPlatformFeesCollected = Math.max(0, adminWallet.totalPlatformFeesCollected - booking.platformFee)
        }
        if (booking.basePrice) {
          adminWallet.totalServiceAmountCollected = Math.max(0, adminWallet.totalServiceAmountCollected - booking.basePrice)
        }
        await adminWallet.save()
        console.log(`[deleteBookingAdmin] Decremented AdminWallet totals for deleted booking ${id}`)
      }
    }).catch(err => console.error('AdminWallet error on delete:', err))
  }

  console.log(`[deleteBookingAdmin] Successfully deleted booking: ${booking._id}, Status was: ${booking.status}`);
  return sendSuccess(res, { message: 'Booking deleted successfully' })
})

export const generateBookingInvoiceAdmin = asyncHandler(async (req, res) => {
  const { id } = req.params
  
  const booking = await Booking.findById(id).populate('serviceId', 'name basePrice').lean()
  if (!booking) {
    return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  // Check if invoice already exists for this booking
  const existingInvoice = await Invoice.findOne({ requestId: id }) // Wait, is there a bookingId in Invoice model? Let's check Invoice model. 
  // It only has requestId (ref: WorkforceRequest). I will use requestId to store bookingId, or I can just create it. 
  
  // Let's create an invoice for this booking
  let subtotal = booking.basePrice || booking.totalAmount - (booking.taxes || 0) - (booking.platformFee || 0)
  if (booking.quantity && booking.quantity > 1) {
    // Already calculated in basePrice for contractors, or calculate it.
    // Booking has totalAmount, basePrice, taxes, platformFee.
  }
  
  let lines = []
  if (booking.contractorInfo?.services?.length > 0) {
    lines = booking.contractorInfo.services.map(s => ({
      description: `Service - ${s.serviceId?.name || 'Contractor Service'}`,
      categoryId: booking.subcategoryId,
      billableUnits: s.quantity || 1,
      ratePerUnit: s.price || 0,
      amount: (s.price || 0) * (s.quantity || 1),
      gstAmount: 0,
    }))
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
  }

  const invoice = await Invoice.create({
    invoiceNumber: generateInvoiceNumber(),
    contractorId: booking.contractorInfo?.services ? booking.userId : undefined,
    vendorId: undefined, // Add if needed
    requestId: booking._id, // Using requestId field to store booking _id to avoid altering Invoice model now
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

  return sendSuccess(res, { data: { invoice }, statusCode: HTTP_STATUS.CREATED })
})
