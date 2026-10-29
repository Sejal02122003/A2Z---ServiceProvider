/**
 * Calculates a single worker's individual shared earning for a booking.
 * Correctly accounts for bulk contractor bookings, multiple assignments,
 * custom service rates, and single 1-to-1 direct bookings.
 *
 * @param {Object} booking - The booking object
 * @param {string|Object} userId - The current labour user's ID or user object
 * @returns {number} The individual labour share in INR
 */
export function getLabourBookingShare(booking, userId) {
  if (!booking) return 0
  const uIdStr = String(typeof userId === 'object' && userId?._id ? userId._id : (userId || ''))

  // 1. Multi-Worker / Bulk Contractor Booking
  if (booking.assignments && booking.assignments.length > 0) {
    // If specific service breakdowns exist under contractorInfo
    if (booking.contractorInfo?.services?.length > 0) {
      let subTotal = 0
      booking.contractorInfo.services.forEach((s) => {
        subTotal += (Number(s.price) || 0) * (Number(booking.hours) || 1) * (Number(s.quantity) || 1)
      })
      const ratio = subTotal > 0 ? (Number(booking.laborShare) || 0) / subTotal : 0

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

      booking.assignments.forEach((a) => {
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
          matchedService.labourIdStr = String(typeof labour === 'object' && labour._id ? labour._id : labour)
        }
      })

      const myService = availableServices.find((as) => as.labourIdStr === uIdStr)
      if (myService && myService.share > 0) {
        return Math.round(myService.share)
      } else {
        return Math.round((Number(booking.laborShare) || 0) / (booking.assignments.length || 1))
      }
    } else {
      // Standard multi-labour split without per-service rates
      return Math.round((Number(booking.laborShare) || 0) / (booking.assignments.length || 1))
    }
  }

  // 2. Direct Single Worker Booking
  const share = Number(booking.laborShare) ||
    (Number(booking.totalAmount) - (Number(booking.commissionAmount) || 0)) ||
    Number(booking.basePrice) ||
    0

  return Math.round(share)
}
