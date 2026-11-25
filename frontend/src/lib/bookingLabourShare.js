const idOf = (v) => String(typeof v === 'object' && v?._id ? v._id : (v || ''))

/**
 * Fraction of a booking's base price that goes to the service provider.
 * Derived from the booking's own snapshot (basePrice & commissionAmount), so it always agrees with
 * booking.laborShare even if the commission % changes later. Never hard-code 0.90.
 */
export function getBookingLabourRate(booking) {
  const base = Number(booking?.basePrice) || 0
  if (base > 0) {
    // share of the base price left after: total − GST − platform fee − commission
    return Math.min(1, Math.max(0, getBookingLabourPool(booking) / base))
  }
  return 0.9 // legacy fallback for bookings without a price snapshot
}

/**
 * A single worker's earning for a booking. ONE rule used by every screen (Jobs, Home, Active Job,
 * Admin) so the amounts always match:
 *
 *   1. The provider's own assignments: sum of the share stored on each assignment at acceptance.
 *   2. Legacy bookings without a stored share: derived from the items / services they were given,
 *      using the booking's own commission rate.
 *   3. No assignments (direct single booking): booking.laborShare.
 *
 * @param {Object} booking - The booking object
 * @param {string|Object} userId - The current labour user's ID or user object
 * @returns {number} The individual labour share in INR
 */
export function getLabourBookingShare(booking, userId) {
  if (!booking) return 0
  const uIdStr = idOf(userId)
  const assignments = Array.isArray(booking.assignments) ? booking.assignments : []

  if (assignments.length > 0) {
    // 1. Stored share on this worker's own assignment(s)
    const live = assignments.filter((a) => a.status !== 'CANCELLED')
    const mine = live.filter((a) => idOf(a.labourId) === uIdStr)
    if (mine.length > 0) {
      // Split the pool between workers in proportion to the share stored at acceptance
      const pool = getBookingLabourPool(booking)
      const myStored = mine.reduce((sum, a) => sum + (Number(a.labourShare) || 0), 0)
      const allStored = live.reduce((sum, a) => sum + (Number(a.labourShare) || 0), 0)
      if (myStored > 0 && allStored > 0) return Math.round(pool * (myStored / allStored))
    }

    // 2a. Legacy multi-service: items assigned to this worker
    const items = booking.multiServiceBooking?.items
    if (booking.multiServiceBooking?.isMultiService && Array.isArray(items)) {
      const rate = getBookingLabourRate(booking)
      const myItems = items.filter((it) => idOf(it.assignedLabourId) === uIdStr && it.status !== 'CANCELLED')
      if (myItems.length > 0) {
        return Math.round(
          myItems.reduce((sum, it) => sum + Math.round((Number(it.itemTotal) || 0) * rate), 0),
        )
      }
    }

    // 2b. Legacy contractor booking: share of the matched service
    if (booking.contractorInfo?.services?.length > 0) {
      let subTotal = 0
      booking.contractorInfo.services.forEach((s) => {
        subTotal += (Number(s.price) || 0) * (Number(booking.hours) || 1) * (Number(s.quantity) || 1)
      })
      const ratio = subTotal > 0 ? getBookingLabourPool(booking) / subTotal : 0

      const availableServices = []
      booking.contractorInfo.services.forEach((s) => {
        const sShare = (Number(s.price) || 0) * (Number(booking.hours) || 1) * ratio
        const qty = Number(s.quantity) || 1
        for (let i = 0; i < qty; i++) {
          availableServices.push({
            serviceId: String(s.serviceId?._id || s.serviceId || ''),
            share: sShare,
            assigned: false,
          })
        }
      })

      assignments.forEach((a) => {
        const labour = a.labourId
        if (!labour) return
        const labServiceIds = [
          ...(labour.serviceIds || []),
          ...(labour.labourProfile?.serviceIds || []),
        ].map((id) => String(typeof id === 'object' && id?._id ? id._id : id))

        let matchedService = availableServices.find(
          (as) => !as.assigned && labServiceIds.includes(as.serviceId),
        )
        if (!matchedService) matchedService = availableServices.find((as) => !as.assigned)
        if (matchedService) {
          matchedService.assigned = true
          matchedService.labourIdStr = idOf(labour)
        }
      })

      const myService = availableServices.find((as) => as.labourIdStr === uIdStr)
      if (myService && myService.share > 0) return Math.round(myService.share)
    }

    // 2c. Last resort: even split of the booking share between its assignments
    return Math.round(getBookingLabourPool(booking) / (assignments.length || 1))
  }

  // 3. Direct single worker booking
  return Math.round(getBookingLabourPool(booking))
}

/**
 * Provider earning pool of a booking:
 *
 *   total amount − GST − platform fee − commission
 *
 * Computed from the booking's own bill snapshot. Same rule as backend utils/labourShare.js.
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
 * What the worker has actually EARNED: only finished work counts. Accepted / in-progress /
 * cancelled bookings earn nothing yet (mirrors backend getLabourEarnedShare).
 */
export function getLabourEarnedShare(booking, userId) {
  if (!booking) return 0
  const status = String(booking.status || '').toUpperCase()
  if (status === 'COMPLETED') return getLabourBookingShare(booking, userId)

  if (status === 'PARTIALLY_COMPLETED' || status === 'STARTED' || status === 'PARTIALLY_CANCELLED') {
    const uid = idOf(userId)
    const done = (booking.assignments || []).filter(
      (a) => idOf(a.labourId) === uid && String(a.status).toUpperCase() === 'COMPLETED',
    )
    const stored = done.reduce((sum, a) => sum + (Number(a.labourShare) || 0), 0)
    if (stored > 0) return Math.round(stored)
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
