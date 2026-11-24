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
  const commission = Number(booking?.commissionAmount)
  if (base > 0 && Number.isFinite(commission) && commission >= 0) {
    return Math.min(1, Math.max(0, (base - commission) / base))
  }
  return 0.9 // legacy fallback when the booking has no commission snapshot
}
