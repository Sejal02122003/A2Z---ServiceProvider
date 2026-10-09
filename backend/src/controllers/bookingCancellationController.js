import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import {
  getBookingCancellationSettings,
  updateBookingCancellationSettings,
  getCancellationEligibility,
  processVendorCancellation,
  approveCancellationRequest,
  rejectCancellationRequest,
  waiveCancellationPenalty,
  getAdminCancellationOverviewStats,
  getAdminCancellationRecords,
} from '../services/bookingCancellationService.js'
import { BookingCancellationRecord } from '../models/BookingCancellationRecord.js'

/**
 * 1. Admin: Get Cancellation Settings
 */
export const getAdminSettings = asyncHandler(async (req, res) => {
  const settings = await getBookingCancellationSettings()
  return sendSuccess(res, { data: { settings } })
})

/**
 * 2. Admin: Update Cancellation Settings
 */
export const updateAdminSettings = asyncHandler(async (req, res) => {
  const settings = await updateBookingCancellationSettings(req.body, req.user)
  return sendSuccess(res, {
    message: 'Cancellation settings updated successfully',
    data: { settings },
  })
})

/**
 * 3. Admin: Overview Statistics
 */
export const getAdminOverview = asyncHandler(async (req, res) => {
  const stats = await getAdminCancellationOverviewStats()
  return sendSuccess(res, { data: stats })
})

/**
 * 4. Admin: List Cancellation Records with Filters & Pagination
 */
export const getAdminRecords = asyncHandler(async (req, res) => {
  const {
    page,
    limit,
    timingClassification,
    cancellationStatus,
    approvalStatus,
    penaltyStatus,
    vendorId,
    search,
    startDate,
    endDate,
  } = req.query

  const data = await getAdminCancellationRecords({
    page,
    limit,
    timingClassification,
    cancellationStatus,
    approvalStatus,
    penaltyStatus,
    vendorId,
    search,
    startDate,
    endDate,
  })

  return sendSuccess(res, { data })
})

/**
 * 5. Admin: Get Single Record Details
 */
export const getAdminRecordById = asyncHandler(async (req, res) => {
  const record = await BookingCancellationRecord.findById(req.params.id)
    .populate('vendorId', 'fullName name phone email')
    .populate('customerId', 'fullName name phone email')
    .populate('approvedBy', 'fullName name')
    .populate('waivedBy', 'fullName name')
    .populate('bookingId')

  if (!record) {
    return sendError(res, {
      message: 'Cancellation record not found',
      statusCode: HTTP_STATUS.NOT_FOUND,
      code: 'NOT_FOUND',
    })
  }

  return sendSuccess(res, { data: { record } })
})

/**
 * 6. Admin: Approve Late Cancellation Request
 */
export const approveCancellationRequestController = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { adminNotes } = req.body

  const record = await approveCancellationRequest({
    recordId: id,
    adminUser: req.user,
    adminNotes,
  })

  return sendSuccess(res, {
    message: 'Cancellation request approved successfully',
    data: { record },
  })
})

/**
 * 7. Admin: Reject Late Cancellation Request
 */
export const rejectCancellationRequestController = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { rejectionReason } = req.body

  const record = await rejectCancellationRequest({
    recordId: id,
    adminUser: req.user,
    rejectionReason,
  })

  return sendSuccess(res, {
    message: 'Cancellation request rejected successfully',
    data: { record },
  })
})

/**
 * 8. Admin: Waive Cancellation Penalty
 */
export const waivePenaltyController = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { waiverReason } = req.body

  const result = await waiveCancellationPenalty({
    recordId: id,
    adminUser: req.user,
    waiverReason,
  })

  return sendSuccess(res, {
    message: 'Cancellation penalty waived and refunded successfully',
    data: result,
  })
})

/**
 * 9. Vendor / Partner: Check Cancellation Eligibility & Penalty Preview
 */
export const getVendorEligibility = asyncHandler(async (req, res) => {
  const { bookingId } = req.params
  const eligibility = await getCancellationEligibility(bookingId, req.user._id)
  return sendSuccess(res, { data: eligibility })
})

/**
 * 10. Vendor / Partner: Submit Booking Cancellation
 */
export const submitVendorCancellation = asyncHandler(async (req, res) => {
  const { bookingId } = req.params
  const { reason, reasonCategory, isExempt } = req.body

  const result = await processVendorCancellation({
    bookingId,
    vendorId: req.user._id,
    reason,
    reasonCategory,
    isExempt: Boolean(isExempt),
  })

  return sendSuccess(res, {
    message:
      result.status === 'CANCELLATION_REQUESTED'
        ? 'Late cancellation request submitted for admin approval'
        : 'Booking cancelled successfully',
    data: result,
  })
})
