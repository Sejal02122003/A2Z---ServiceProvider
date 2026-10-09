import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { VendorPenalty } from '../models/VendorPenalty.js'
import {
  getPenaltySettings,
  updatePenaltySettings,
  getPenaltyOverviewStats,
  approvePenalty,
  rejectPenalty,
  waivePenalty,
  submitPenaltyDispute,
  reviewPenaltyDispute,
  reversePenaltyDeduction,
} from '../services/penaltyService.js'

/**
 * 1. Admin: Get Settings
 */
export const getAdminSettings = asyncHandler(async (req, res) => {
  const settings = await getPenaltySettings()
  return sendSuccess(res, { data: { settings } })
})

/**
 * 2. Admin: Update Settings
 */
export const updateAdminSettings = asyncHandler(async (req, res) => {
  const settings = await updatePenaltySettings(req.body, req.user)
  return sendSuccess(res, {
    message: 'Penalty settings updated successfully',
    data: { settings },
  })
})

/**
 * 3. Admin: Overview Statistics
 */
export const getAdminOverview = asyncHandler(async (req, res) => {
  const stats = await getPenaltyOverviewStats()
  return sendSuccess(res, { data: stats })
})

/**
 * 4. Admin: List Penalties with Pagination & Filters
 */
export const getAdminPenalties = asyncHandler(async (req, res) => {
  const {
    status,
    penaltyType,
    vendorId,
    bookingId,
    search,
    startDate,
    endDate,
    page = 1,
    limit = 20,
  } = req.query

  const query = {}

  if (status && status !== 'ALL') {
    query.status = status
  }
  if (penaltyType && penaltyType !== 'ALL') {
    query.penaltyType = penaltyType
  }
  if (vendorId) {
    query.vendorId = vendorId
  }
  if (bookingId) {
    query.bookingId = bookingId
  }

  if (startDate || endDate) {
    query.createdAt = {}
    if (startDate) query.createdAt.$gte = new Date(startDate)
    if (endDate) query.createdAt.$lte = new Date(endDate)
  }

  if (search) {
    query.$or = [
      { reason: { $regex: search, $options: 'i' } },
      { dedupeKey: { $regex: search, $options: 'i' } },
    ]
  }

  const pageNum = Math.max(1, parseInt(page, 10))
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)))
  const skip = (pageNum - 1) * limitNum

  const [penalties, totalCount] = await Promise.all([
    VendorPenalty.find(query)
      .populate('vendorId', 'fullName phone email role')
      .populate('bookingId', 'status scheduledAt timeSlot totalAmount address serviceId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    VendorPenalty.countDocuments(query),
  ])

  return sendSuccess(res, {
    data: {
      penalties,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalCount,
        totalPages: Math.ceil(totalCount / limitNum),
      },
    },
  })
})

/**
 * 5. Admin: Get Single Penalty By ID
 */
export const getAdminPenaltyById = asyncHandler(async (req, res) => {
  const { id } = req.params
  const penalty = await VendorPenalty.findById(id)
    .populate('vendorId', 'fullName phone email role')
    .populate('customerId', 'fullName phone email')
    .populate('bookingId')
    .populate('walletTransactionId')
    .populate('reversal.refundTransactionId')
    .lean()

  if (!penalty) {
    return sendError(res, { message: 'Penalty not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  return sendSuccess(res, { data: { penalty } })
})

/**
 * 6. Admin: Approve Penalty (Trigger wallet deduction)
 */
export const approvePenaltyController = asyncHandler(async (req, res) => {
  const { id } = req.params
  const result = await approvePenalty(id, req.user)
  return sendSuccess(res, {
    message: 'Penalty approved and deduction applied successfully',
    data: result,
  })
})

/**
 * 7. Admin: Reject Penalty
 */
export const rejectPenaltyController = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { reason = '' } = req.body
  const penalty = await rejectPenalty(id, req.user, reason)
  return sendSuccess(res, {
    message: 'Penalty rejected successfully',
    data: { penalty },
  })
})

/**
 * 8. Admin: Waive Penalty
 */
export const waivePenaltyController = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { reason } = req.body

  if (!reason || !reason.trim()) {
    return sendError(res, {
      message: 'Reason is required to waive a penalty',
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
  }

  const penalty = await waivePenalty(id, req.user, reason)
  return sendSuccess(res, {
    message: 'Penalty waived successfully',
    data: { penalty },
  })
})

/**
 * 9. Admin: Review Dispute (Accept / Reject)
 */
export const reviewDisputeController = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { decision, notes = '' } = req.body

  if (!['ACCEPT', 'REJECT'].includes(decision)) {
    return sendError(res, {
      message: 'Decision must be ACCEPT or REJECT',
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
  }

  const penalty = await reviewPenaltyDispute(id, req.user, decision, notes)
  return sendSuccess(res, {
    message: `Dispute ${decision === 'ACCEPT' ? 'accepted and penalty waived' : 'rejected'}`,
    data: { penalty },
  })
})

/**
 * 10. Admin: Reverse Deduction
 */
export const reverseDeductionController = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { reason } = req.body

  if (!reason || !reason.trim()) {
    return sendError(res, {
      message: 'Reason is required to reverse a deduction',
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
  }

  const result = await reversePenaltyDeduction(id, req.user, reason)
  return sendSuccess(res, {
    message: 'Deduction reversed and funds credited back to partner wallet',
    data: result,
  })
})

/**
 * 11. Vendor: View Personal Penalties
 */
export const getVendorPenalties = asyncHandler(async (req, res) => {
  const vendorId = req.user._id
  const { status, page = 1, limit = 20 } = req.query

  const query = { vendorId }
  if (status && status !== 'ALL') {
    query.status = status
  }

  const pageNum = Math.max(1, parseInt(page, 10))
  const limitNum = Math.max(1, Math.min(50, parseInt(limit, 10)))
  const skip = (pageNum - 1) * limitNum

  const [penalties, totalCount] = await Promise.all([
    VendorPenalty.find(query)
      .populate('bookingId', 'status scheduledAt timeSlot totalAmount address')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    VendorPenalty.countDocuments(query),
  ])

  return sendSuccess(res, {
    data: {
      penalties,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalCount,
        totalPages: Math.ceil(totalCount / limitNum),
      },
    },
  })
})

/**
 * 12. Vendor: Get Single Penalty Detail
 */
export const getVendorPenaltyById = asyncHandler(async (req, res) => {
  const { id } = req.params
  const penalty = await VendorPenalty.findOne({ _id: id, vendorId: req.user._id })
    .populate('bookingId')
    .lean()

  if (!penalty) {
    return sendError(res, { message: 'Penalty not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  return sendSuccess(res, { data: { penalty } })
})

/**
 * 13. Vendor: Submit Dispute
 */
export const submitVendorDispute = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { reason, evidenceUrls } = req.body

  if (!reason || !reason.trim()) {
    return sendError(res, {
      message: 'Dispute reason is required',
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
  }

  const penalty = await submitPenaltyDispute(id, req.user, reason, evidenceUrls)
  return sendSuccess(res, {
    message: 'Dispute submitted successfully. Admin will review your submission.',
    data: { penalty },
  })
})
