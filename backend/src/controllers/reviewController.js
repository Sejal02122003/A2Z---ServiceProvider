import { Review } from '../models/Review.js'
import { Booking } from '../models/Booking.js'
import { User } from '../models/User.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { evaluateBookingRating } from '../services/trialEvaluationService.js'

export const submitReview = asyncHandler(async (req, res) => {
  const { bookingId, rating, comment, revieweeId: providedRevieweeId } = req.body

  const booking = await Booking.findById(bookingId)
  if (!booking) {
    return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  if (booking.status !== 'COMPLETED') {
    return sendError(res, { message: 'Can only review completed bookings', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  let revieweeId
  let isCustomerReviewingWorker = false
  if (String(booking.userId) === String(req.user._id)) {
    revieweeId = providedRevieweeId || booking.laborId || booking.acceptedLabourId // Customer reviewing Labor
    isCustomerReviewingWorker = true
  } else if (String(booking.laborId) === String(req.user._id) || (booking.assignments && booking.assignments.some(a => String(a.labourId) === String(req.user._id)))) {
    revieweeId = booking.userId // Labor reviewing Customer
  } else {
    return sendError(res, { message: 'Unauthorized to review this booking', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const existingReview = await Review.findOne({ bookingId, reviewerId: req.user._id, revieweeId })
  if (existingReview) {
    return sendError(res, { message: 'You have already reviewed this booking', statusCode: HTTP_STATUS.CONFLICT })
  }

  const review = await Review.create({
    bookingId,
    reviewerId: req.user._id,
    revieweeId,
    rating,
    comment
  })

  // If customer reviewed a vendor/worker, trigger trial evaluation
  let trialEvalResult = null
  if (isCustomerReviewingWorker && revieweeId) {
    try {
      trialEvalResult = await evaluateBookingRating({
        bookingId,
        rating,
        comment,
        reviewerId: req.user._id,
        vendorId: revieweeId,
      })
    } catch (trialErr) {
      console.error('Error evaluating trial rating:', trialErr)
    }
  }

  return sendSuccess(res, {
    message: 'Review submitted successfully',
    data: { review, trialEvaluation: trialEvalResult },
  })
})

export const getReviews = asyncHandler(async (req, res) => {
  const { userId } = req.params
  
  const reviews = await Review.find({ revieweeId: userId }).populate('reviewerId', 'name').sort({ createdAt: -1 })
  
  // Calculate average
  const total = reviews.reduce((sum, r) => sum + r.rating, 0)
  const averageRating = reviews.length > 0 ? (total / reviews.length).toFixed(1) : 0

  return sendSuccess(res, { data: { reviews, averageRating, totalReviews: reviews.length } })
})

export const getAllReviews = asyncHandler(async (req, res) => {
  const reviews = await Review.find({})
    .populate('reviewerId', 'name fullName email phone profileImageUrl')
    .populate('revieweeId', 'name fullName email phone profileImageUrl')
    .populate({
      path: 'bookingId',
      select: 'type scheduledAt timeSlot status',
    })
    .sort({ createdAt: -1 })
    
  return sendSuccess(res, { data: { reviews, totalReviews: reviews.length } })
})

export const deleteReview = asyncHandler(async (req, res) => {
  const { id } = req.params
  const review = await Review.findByIdAndDelete(id)
  if (!review) {
    return sendError(res, { message: 'Review not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }
  return sendSuccess(res, { message: 'Review deleted successfully' })
})
