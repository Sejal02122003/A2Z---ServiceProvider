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
  evaluateCustomerCancellationPolicy,
  getAdminCustomerCancellations,
  getAdminCustomerCancellationHistory,
  adminApplyCustomerRestriction,
  adminLiftCustomerRestriction,
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

/**
 * 11. Customer: Check Active Cancellation Policy & Restriction Status
 */
export const getCustomerPolicyStatusController = asyncHandler(async (req, res) => {
  const policyStatus = await evaluateCustomerCancellationPolicy(req.user._id)
  return sendSuccess(res, { data: policyStatus })
})

/**
 * 12. Admin: List Customers with Cancellation Records & Restriction Flags
 */
export const getAdminCustomerCancellationsController = asyncHandler(async (req, res) => {
  const { page, limit, search, filter } = req.query
  const data = await getAdminCustomerCancellations({ page, limit, search, filter })
  return sendSuccess(res, { data })
})

/**
 * 13. Admin: Get Detailed Customer Cancellation History & Policy Info
 */
export const getAdminCustomerHistoryController = asyncHandler(async (req, res) => {
  const { id } = req.params
  const data = await getAdminCustomerCancellationHistory(id)
  return sendSuccess(res, { data })
})

/**
 * 14. Admin: Apply Customer Booking Restriction Manually
 */
export const adminRestrictCustomerController = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { durationDays, reason, adminNote } = req.body

  const result = await adminApplyCustomerRestriction(
    id,
    { durationDays, reason, adminNote },
    req.user
  )

  return sendSuccess(res, {
    message: result.message || 'Customer restricted successfully',
    data: result,
  })
})

/**
 * 15. Admin: Lift Customer Booking Restriction Manually
 */
export const adminUnrestrictCustomerController = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { reason, adminNote } = req.body

  const result = await adminLiftCustomerRestriction(
    id,
    { reason, adminNote },
    req.user
  )

  return sendSuccess(res, {
    message: result.message || 'Customer restriction lifted successfully',
    data: result,
  })
})

/**
 * 16. Admin: Record Partner Bounce / No-Show Penalty
 */
export const recordAdminBouncePenaltyController = asyncHandler(async (req, res) => {
  const { bookingId } = req.params
  const { reason } = req.body

  const { Booking } = await import('../models/Booking.js')
  const booking = await Booking.findById(bookingId)
  if (!booking) {
    return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  const vendorId =
    booking.laborId ||
    booking.acceptedLabourId ||
    (booking.acceptedLabourIds && booking.acceptedLabourIds[0])
  if (!vendorId) {
    return sendError(res, {
      message: 'No assigned partner found on this booking to penalize',
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
  }

  const { recordBounceIncident } = await import('../services/penaltyService.js')
  const result = await recordBounceIncident({
    booking,
    vendorId,
    reason: reason || 'Partner Bounce / Abandonment recorded by Admin',
    cancelledBy: 'ADMIN',
    isExempt: false,
  })

  return sendSuccess(res, {
    message: 'Partner bounce penalty recorded and deducted from wallet successfully',
    data: result,
  })
})

