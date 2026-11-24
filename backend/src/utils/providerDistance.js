// Straight-line distance (km) between a provider's last reported GPS position and a booking location.

function toRad(deg) {
  return (deg * Math.PI) / 180
}

export function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export function getBookingCoords(booking) {
  const lng = Number(booking?.address?.coordinates?.coordinates?.[0] ?? booking?.address?.lng ?? booking?.address?.longitude)
  const lat = Number(booking?.address?.coordinates?.coordinates?.[1] ?? booking?.address?.lat ?? booking?.address?.latitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null
  return { lat, lng }
}

/** Returns distance in km, or undefined when either side has no usable coordinates. */
export function getProviderDistanceKm(providerUser, booking) {
  const lat = Number(providerUser?.labourProfile?.currentLatitude)
  const lng = Number(providerUser?.labourProfile?.currentLongitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return undefined
  const dest = getBookingCoords(booking)
  if (!dest) return undefined
  return haversineKm(lat, lng, dest.lat, dest.lng)
}
