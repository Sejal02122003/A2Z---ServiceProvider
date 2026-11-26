import { UserSubscription } from '../models/UserSubscription.js'

/**
 * Adds to the booking counters of a service provider's subscription that is active today (IST).
 *
 *  - bookingOpportunitiesOffered : every booking offer sent to the provider (even if rejected / ignored)
 *  - bookingsReceived            : bookings the provider actually accepted
 *  - bookingOpportunitiesAccepted: same as accepted, kept for the offered-vs-accepted audit
 *
 * This deliberately does NOT depend on whether subscriptions are enforced or whether the provider is
 * in a free trial: if an active subscription exists, its counters are kept up to date, so the admin
 * Service Provider Subscriptions page always shows real numbers.
 *
 * Never throws: stats must not break broadcasting or accepting a booking.
 */
export async function incrementActiveSubscriptionStats(labourId, increments) {
  if (!labourId || !increments || Object.keys(increments).length === 0) return null
  try {
    const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
    return await UserSubscription.findOneAndUpdate(
      {
        labour: labourId,
        status: 'active',
        date: { $lte: todayIST },
        endDate: { $gte: todayIST },
      },
      { $inc: increments },
    )
  } catch (err) {
    console.error('[subscriptionStats] Failed to update subscription booking counters:', err?.message)
    return null
  }
}
