/**
 * Fraction of a booking's base price that goes to the service provider.
 *
 * Derived from the booking's own snapshot (basePrice and commissionAmount, both stored when the
 * booking was created), so it always matches booking.laborShare even if the admin later changes the
 * commission %, or turns commission off. Use this instead of a hard-coded 0.90.
 *
 * rate = (basePrice - commissionAmount) / basePrice
 */
export function getBookingLabourShareRate(booking) {
  const base = Number(booking?.basePrice) || 0
  if (base > 0) {
    // share of the base price left after: total − GST − platform fee − commission
    return Math.min(1, Math.max(0, getBookingLabourPool(booking) / base))
  }
  return 0.9 // legacy fallback when the booking has no price snapshot
}

const idOf = (v) => String(typeof v === 'object' && v?._id ? v._id : (v || ''))

/**
 * Service provider earning pool of a booking:
 *
 *   total amount − GST − platform fee − commission
 *
 * Computed from the booking's own bill snapshot (it matches booking.laborShare, which is also
 * kept in step with the bill when hours are extended).
 */
export function getBookingLabourPool(booking) {
  const base = Number(booking?.basePrice) || 0
  const platformFee = Number(booking?.platformFee) || 0
  const gst = Number(booking?.taxes) || 0
  const commission = Number(booking?.commissionAmount) || 0
  const discount = Number(booking?.walletDiscount?.amount) || 0
  const net = Number(booking?.totalAmount) || 0

  // The bill total before any wallet discount (the wallet discount only lowers what the customer pays)
  let total = net
  if (discount > 0 && base > 0 && Math.abs(net + discount - (base + platformFee + gst)) < 1) {
    total = net + discount
  }

  if (total > 0) {
    // THE formula:  total amount − GST − platform fee − commission
    return Math.max(0, total - gst - platformFee - commission)
  }
  // No usable total on the booking (very old data): fall back to the stored share
  const stored = Number(booking?.laborShare)
  if (Number.isFinite(stored) && stored > 0) return stored
  return Math.max(0, base - commission)
}

/**
 * One worker's earning for a booking (same rules as the frontend lib/bookingLabourShare.js):
 *  1. share stored on the worker's own assignment(s) at acceptance
 *  2. legacy: items assigned to the worker (multi-service) / matched contractor service
 *  3. even split of the pool across assignments, or the whole pool for a single worker
 */
export function getLabourBookingShare(booking, userId) {
  if (!booking) return 0
  const uid = idOf(userId)
  const pool = getBookingLabourPool(booking)
  const assignments = Array.isArray(booking.assignments) ? booking.assignments : []

  if (assignments.length > 0) {
    const live = assignments.filter((a) => a.status !== 'CANCELLED')
    const mine = live.filter((a) => idOf(a.labourId) === uid)
    if (mine.length > 0) {
      // Split the pool between workers in proportion to the share stored at acceptance
      const myStored = mine.reduce((sum, a) => sum + (Number(a.labourShare) || 0), 0)
      const allStored = live.reduce((sum, a) => sum + (Number(a.labourShare) || 0), 0)
      if (myStored > 0 && allStored > 0) return Math.round(pool * (myStored / allStored))
    }

    const items = booking.multiServiceBooking?.items
    if (booking.multiServiceBooking?.isMultiService && Array.isArray(items)) {
      const rate = getBookingLabourShareRate(booking)
      const myItems = items.filter((it) => idOf(it.assignedLabourId) === uid && it.status !== 'CANCELLED')
      if (myItems.length > 0) {
        return Math.round(myItems.reduce((sum, it) => sum + Math.round((Number(it.itemTotal) || 0) * rate), 0))
      }
    }

    // Not one of this booking's workers
    if (mine.length === 0 && !assignments.some((a) => idOf(a.labourId) === uid)) {
      const main = idOf(booking.laborId)
      const accepted = (booking.acceptedLabourIds || []).some((id) => idOf(id) === uid)
      if (main !== uid && !accepted) return 0
    }
    return Math.round(pool / (assignments.length || 1))
  }

  // Direct single-worker booking: only the accepted worker earns
  const main = idOf(booking.laborId || booking.acceptedLabourId)
  const accepted = (booking.acceptedLabourIds || []).some((id) => idOf(id) === uid)
  if (main && main !== uid && !accepted) return 0
  return Math.round(pool)
}

/**
 * What the worker has actually EARNED so far: only finished work counts.
 * A booking that is merely accepted / in progress / paid-in-advance earns nothing yet, and a
 * cancelled booking earns nothing.
 */
export function getLabourEarnedShare(booking, userId) {
  if (!booking) return 0
  const status = String(booking.status || '').toUpperCase()
  if (status === 'COMPLETED') return getLabourBookingShare(booking, userId)

  // Partly finished multi-worker booking: count only this worker's completed assignments
  if (status === 'PARTIALLY_COMPLETED' || status === 'STARTED' || status === 'PARTIALLY_CANCELLED') {
    const uid = idOf(userId)
    const done = (booking.assignments || []).filter(
      (a) => idOf(a.labourId) === uid && String(a.status).toUpperCase() === 'COMPLETED',
    )
    if (done.length > 0) {
      const stored = done.reduce((sum, a) => sum + (Number(a.labourShare) || 0), 0)
      if (stored > 0) return Math.round(stored)
    }
  }
  return 0
}

/**
 * Fraction [0, 1] of a booking that belongs to a given worker, based on their assigned
 * services/items in multi-service or multi-assignment bookings. Returns 1 for single-worker bookings.
 */
export function getLabourShareRatio(booking, userId) {
  if (!booking) return 0
  const uid = idOf(userId)
  const assignments = Array.isArray(booking.assignments) ? booking.assignments : []

  if (assignments.length > 0) {
    const live = assignments.filter((a) => a.status !== 'CANCELLED')
    const mine = live.filter((a) => idOf(a.labourId) === uid)
    if (mine.length > 0) {
      const myStored = mine.reduce((sum, a) => sum + (Number(a.labourShare) || 0), 0)
      const allStored = live.reduce((sum, a) => sum + (Number(a.labourShare) || 0), 0)
      if (myStored > 0 && allStored > 0) return myStored / allStored
    }

    const items = booking.multiServiceBooking?.items
    if (booking.multiServiceBooking?.isMultiService && Array.isArray(items)) {
      const activeItems = items.filter((it) => it.status !== 'CANCELLED')
      const myItems = activeItems.filter((it) => idOf(it.assignedLabourId) === uid)
      const myTotal = myItems.reduce((sum, it) => sum + (Number(it.itemTotal) || 0), 0)
      const allTotal = activeItems.reduce((sum, it) => sum + (Number(it.itemTotal) || 0), 0)
      if (myTotal > 0 && allTotal > 0) return myTotal / allTotal
    }

    if (mine.length > 0 && live.length > 0) {
      return mine.length / live.length
    }
    return 0
  }

  const main = idOf(booking.laborId || booking.acceptedLabourId)
  const accepted = (booking.acceptedLabourIds || []).some((id) => idOf(id) === uid)
  if (main && main !== uid && !accepted) return 0
  return 1
}

/**
 * Cash amount a specific worker should collect from the customer for a COD booking.
 * Splits the total bill proportionally according to the worker's service share.
 */
export function getLabourCashCollectAmount(booking, userId) {
  if (!booking) return 0
  const totalBill = Number(booking.totalAmount ?? booking.basePrice ?? 0)
  return Math.round(totalBill * getLabourShareRatio(booking, userId))
}
