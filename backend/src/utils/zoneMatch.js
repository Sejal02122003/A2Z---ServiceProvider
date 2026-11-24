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
  return explainProviderZoneMatch(user, bookingZoneId, zones).matches
}

/**
 * Same decision as providerMatchesBookingZone, but returns the reason too (for logging).
 * Zones are city based, so two zone records in the SAME city (e.g. "Indore Zone" and
 * "regal square", both city=Indore) count as the same dispatch area. Without this, a provider
 * whose trial slot / address resolves to a sibling zone in the booking's city was silently skipped.
 */
export function explainProviderZoneMatch(user, bookingZoneId, zones) {
  if (!bookingZoneId) return { matches: true, reason: 'booking has no zone' }

  const providerZoneId = resolveProviderZoneId(user, zones)
  if (!providerZoneId) return { matches: true, reason: 'provider zone unknown (kept)' }

  if (providerZoneId === String(bookingZoneId)) {
    return { matches: true, reason: 'same zone', providerZoneId }
  }

  const list = Array.isArray(zones) ? zones : []
  const providerZone = list.find((z) => String(z._id) === providerZoneId)
  const bookingZone = list.find((z) => String(z._id) === String(bookingZoneId))
  const providerCity = norm(providerZone?.city)
  const bookingCity = norm(bookingZone?.city)

  if (providerCity && bookingCity && providerCity === bookingCity) {
    return {
      matches: true,
      reason: `different zone records but same city "${bookingZone.city}" (${providerZone.name} ~ ${bookingZone.name})`,
      providerZoneId,
    }
  }

  return {
    matches: false,
    reason: `provider zone "${providerZone?.name || providerZoneId}" (${providerZone?.city || '?'}) != booking zone "${bookingZone?.name || bookingZoneId}" (${bookingZone?.city || '?'})`,
    providerZoneId,
  }
}
