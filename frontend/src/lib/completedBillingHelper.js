/**
 * Central helper to compute completed-only dynamic billing for contractor bookings.
 * 
 * For contractor multi-service bookings (contractorInfo.services):
 * - Loops through requested services
 * - Counts how many assigned labourers reached 'COMPLETED' status
 * - Calculates completed base price + extra hours for completed labourers
 * - Deducts pending, unassigned, or incomplete labour slots
 * - Prorates platform fees and taxes
 * 
 * @param {Object} booking - The booking document
 * @returns {Object} Calculated billing breakdown
 */
export function calculateCompletedBookingBill(booking) {
  if (!booking) {
    return {
      isContractorBooking: false,
      completedBasePrice: 0,
      deductedBasePrice: 0,
      completedPlatformFee: 0,
      completedTaxes: 0,
      completedTotalAmount: 0,
      originalBasePrice: 0,
      originalTotalAmount: 0,
      totalRequestedLabours: 0,
      totalCompletedLabours: 0,
      serviceBreakdown: [],
    }
  }

  const isContractorBooking = Boolean(
    booking.contractorInfo?.services && booking.contractorInfo.services.length > 0
  )

  const originalBasePrice = booking.basePrice || 0
  const originalPlatformFee = booking.platformFee || 0
  const originalTaxes = booking.taxes || 0
  const originalTotalAmount = booking.totalAmount || 0

  // For regular (non-contractor) bookings, retain original billing behavior
  if (!isContractorBooking) {
    const extraHours =
      (booking.extraHours || 0) +
      (booking.assignments || []).reduce((acc, a) => acc + (a.extraHours || 0), 0)
    return {
      isContractorBooking: false,
      completedBasePrice: originalBasePrice,
      deductedBasePrice: 0,
      completedPlatformFee: originalPlatformFee,
      completedTaxes: originalTaxes,
      completedTotalAmount: originalTotalAmount,
      originalBasePrice,
      originalTotalAmount,
      totalRequestedLabours: booking.quantity || 1,
      totalCompletedLabours: booking.status === 'COMPLETED' ? (booking.quantity || 1) : 0,
      extraHours,
      serviceBreakdown: [],
    }
  }

  const services = booking.contractorInfo.services || []
  const assignments = booking.assignments || []
  const bookingHours = booking.duration || booking.hours || 1

  let totalRequestedLabours = 0
  let totalCompletedLabours = 0
  let completedBasePrice = 0
  let requestedBasePrice = 0
  let totalExtraHours = 0

  const serviceBreakdown = services.map((svc, idx) => {
    const sId = svc.serviceId?._id ? String(svc.serviceId._id) : String(svc.serviceId || '')
    const sName = svc.serviceId?.name || svc.name || `Service ${idx + 1}`
    const requestedQty = Number(svc.quantity) || 1
    const pricePerHour = Number(svc.price) || 0

    totalRequestedLabours += requestedQty
    const expectedServiceBase = pricePerHour * bookingHours * requestedQty
    requestedBasePrice += expectedServiceBase

    // Find assignments matching this service.
    // In contractor bookings, assignments map by serviceId or index
    let matchedAssignments = assignments.filter((a) => {
      const aServiceId = a.serviceId?._id ? String(a.serviceId._id) : String(a.serviceId || '')
      return aServiceId && aServiceId === sId
    })

    // If assignments don't have explicit serviceId, slice by quantity index
    if (matchedAssignments.length === 0 && assignments.length > 0) {
      let offset = 0
      for (let i = 0; i < idx; i++) {
        offset += Number(services[i].quantity) || 1
      }
      matchedAssignments = assignments.slice(offset, offset + requestedQty)
    }

    const completedAssignments = matchedAssignments.filter((a) => a.status === 'COMPLETED')
    const completedQty = completedAssignments.length
    totalCompletedLabours += completedQty

    const extraHoursForService = completedAssignments.reduce(
      (acc, a) => acc + (Number(a.extraHours) || 0),
      0
    )
    totalExtraHours += extraHoursForService

    const regularCompletedAmount = pricePerHour * bookingHours * completedQty
    const extraCompletedAmount = pricePerHour * extraHoursForService
    const serviceCompletedAmount = regularCompletedAmount + extraCompletedAmount
    const pendingQty = Math.max(0, requestedQty - completedQty)
    const serviceDeductedAmount = pricePerHour * bookingHours * pendingQty

    completedBasePrice += serviceCompletedAmount

    return {
      serviceId: sId,
      name: sName,
      requestedQty,
      completedQty,
      pendingQty,
      pricePerHour,
      bookingHours,
      extraHours: extraHoursForService,
      completedAmount: serviceCompletedAmount,
      deductedAmount: serviceDeductedAmount,
      isFullyCompleted: completedQty >= requestedQty && requestedQty > 0,
      isPartiallyCompleted: completedQty > 0 && completedQty < requestedQty,
      isPending: completedQty === 0,
      assignments: matchedAssignments,
    }
  })

  // Calculate deductions
  const deductedBasePrice = Math.max(0, (originalBasePrice || requestedBasePrice) - completedBasePrice)

  // Prorate platform fees & taxes based on completed ratio
  const completionRatio =
    (originalBasePrice || requestedBasePrice) > 0
      ? completedBasePrice / (originalBasePrice || requestedBasePrice)
      : 0

  // Platform fee is a fixed dynamic fee from admin settings/booking — do not scale down unless 0 work was completed
  let completedPlatformFee = originalPlatformFee
  let completedTaxes = originalTaxes

  if (completionRatio === 0 && totalCompletedLabours === 0) {
    completedPlatformFee = 0
    completedTaxes = 0
  } else if (completionRatio < 1) {
    // Taxes are calculated on the completed base price / ratio
    completedTaxes = Math.round(originalTaxes * completionRatio)
  }

  // Platform fee is paid by service provider, not customer
  const completedTotalAmount = Math.round(
    completedBasePrice + completedTaxes
  )

  return {
    isContractorBooking: true,
    completedBasePrice,
    deductedBasePrice,
    completedPlatformFee,
    completedTaxes,
    completedTotalAmount,
    originalBasePrice,
    originalTotalAmount,
    totalRequestedLabours,
    totalCompletedLabours,
    extraHours: totalExtraHours,
    serviceBreakdown,
  }
}
