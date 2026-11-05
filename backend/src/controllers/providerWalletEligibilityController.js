import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { checkProviderBookingEligibility } from '../services/walletEligibilityService.js'
import { acceptBroadcast } from './broadcastController.js'

/**
 * GET /api/v1/provider/wallet/eligibility
 * Return provider's general wallet balance, reservations, available balance, min required, and eligibility status
 */
export const getMyEligibility = asyncHandler(async (req, res) => {
  const result = await checkProviderBookingEligibility({
    providerId: req.user._id,
  })

  return sendSuccess(res, {
    data: result,
  })
})

/**
 * GET /api/v1/provider/wallet/eligibility/check?bookingId=...
 * Check provider eligibility specifically against a booking
 */
export const checkBookingEligibility = asyncHandler(async (req, res) => {
  const bookingId = req.query.bookingId || req.params.bookingId
  if (!bookingId) {
    return sendError(res, {
      message: 'bookingId query parameter is required',
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
  }

  const result = await checkProviderBookingEligibility({
    providerId: req.user._id,
    bookingId,
  })

  if (!result.eligible) {
    return sendError(res, {
      message: `Insufficient wallet balance to accept this booking. Please recharge your wallet with at least ₹${result.shortageAmount} to become eligible.`,
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'LOW_WALLET_BALANCE',
      data: result,
    })
  }

  return sendSuccess(res, {
    data: result,
  })
})

/**
 * POST /api/v1/provider/bookings/:bookingId/accept
 * Dedicated authoritative provider booking acceptance endpoint
 */
export const acceptBooking = acceptBroadcast
