// Helpers to keep bookings zone-wise: a booking is only offered to providers in the same zone.
// Zones are city based (see Zone model), so a provider's zone is resolved from the best data we hold:
// 1) trial slot zone, 2) welcome-kit / saved address city, 3) saved address text.

const norm = (v) => String(v || '').trim().toLowerCase()

function textMatchesZone(text, zone) {
  const t = norm(text)
  if (!t) return false
  const city = norm(zone.city)
  const name = norm(zone.name)
  return Boolean((city && t.includes(city)) || (name && t.includes(name)))
}

/** Returns the Zone _id (string) a provider belongs to, or null when it cannot be determined. */
export function resolveProviderZoneId(user, zones) {
  if (!user || !Array.isArray(zones) || zones.length === 0) return null

  const trialZoneId = user.labourProfile?.trialSlot?.zoneId
  if (trialZoneId && trialZoneId !== 'ALL' && zones.some((z) => String(z._id) === String(trialZoneId))) {
    return String(trialZoneId)
  }

  const candidates = [
    user.address?.city,
    ...(user.savedAddresses || []).map((a) => a?.city),
    ...(user.savedAddresses || []).map((a) => a?.locationText),
    user.savedAddress?.text,
  ].filter(Boolean)

  for (const text of candidates) {
    const zone = zones.find((z) => textMatchesZone(text, z))
    if (zone) return String(zone._id)
  }
  return null
}

/**
 * True when the provider may receive a booking of `bookingZoneId`.
 * Providers whose zone is known and different are excluded; providers whose zone
 * cannot be determined are kept so they are not silently cut off.
 */
export function providerMatchesBookingZone(user, bookingZoneId, zones) {
  if (!bookingZoneId) return true
  const providerZoneId = resolveProviderZoneId(user, zones)
  if (!providerZoneId) return true
  return providerZoneId === String(bookingZoneId)
}
