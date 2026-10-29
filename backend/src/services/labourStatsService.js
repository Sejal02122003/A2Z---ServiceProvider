import mongoose from 'mongoose'
import { Review } from '../models/Review.js'
import { Booking } from '../models/Booking.js'

/**
 * Retrieves dynamic performance stats for a service provider:
 * - Average review rating & total count of reviews from the Review collection
 * - Total completed jobs/bookings count from the Booking collection
 *
 * @param {string|mongoose.Types.ObjectId} labourId
 * @returns {Promise<{ rating: number|null, totalReviews: number, completedBookingsCount: number }>}
 */
export async function getLabourStats(labourId) {
  if (!labourId) {
    return { rating: null, totalReviews: 0, completedBookingsCount: 0 }
  }

  const idStr = String(labourId._id || labourId)
  if (!mongoose.Types.ObjectId.isValid(idStr)) {
    return { rating: null, totalReviews: 0, completedBookingsCount: 0 }
  }

  const objId = new mongoose.Types.ObjectId(idStr)

  try {
    const [reviewAgg, completedCount] = await Promise.all([
      Review.aggregate([
        { $match: { revieweeId: objId } },
        {
          $group: {
            _id: '$revieweeId',
            avgRating: { $avg: '$rating' },
            totalReviews: { $sum: 1 },
          },
        },
      ]),
      Booking.countDocuments({
        status: 'COMPLETED',
        $or: [
          { laborId: objId },
          { acceptedLabourId: objId },
          { acceptedLabourIds: objId },
          { 'assignments.labourId': objId },
          { 'multiServiceBooking.items.assignedLabourId': objId },
        ],
      }),
    ])

    const avgRating =
      reviewAgg.length > 0 && reviewAgg[0].avgRating != null
        ? Math.round(reviewAgg[0].avgRating * 10) / 10
        : null
    const totalReviews = reviewAgg.length > 0 ? (reviewAgg[0].totalReviews || 0) : 0

    return {
      rating: avgRating,
      totalReviews,
      completedBookingsCount: completedCount || 0,
    }
  } catch (err) {
    console.error(`[labourStatsService] Error getting stats for labour ${idStr}:`, err)
    return { rating: null, totalReviews: 0, completedBookingsCount: 0 }
  }
}

/**
 * Batch retrieves stats for multiple labour IDs.
 * Returns a dictionary mapping string labour ID to stats.
 *
 * @param {Array<string|mongoose.Types.ObjectId>} labourIds
 * @returns {Promise<Record<string, { rating: number|null, totalReviews: number, completedBookingsCount: number }>>}
 */
export async function getMultipleLaboursStats(labourIds = []) {
  const result = {}
  if (!Array.isArray(labourIds) || labourIds.length === 0) {
    return result
  }

  const validIds = [
    ...new Set(
      labourIds
        .map((id) => (id && typeof id === 'object' && id._id ? String(id._id) : String(id || '')))
        .filter((id) => mongoose.Types.ObjectId.isValid(id)),
    ),
  ]

  if (validIds.length === 0) {
    return result
  }

  await Promise.all(
    validIds.map(async (idStr) => {
      result[idStr] = await getLabourStats(idStr)
    }),
  )

  return result
}
