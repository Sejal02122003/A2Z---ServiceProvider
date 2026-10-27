/**
 * Calculate Haversine distance between two coordinates in kilometers.
 */
export function calculateDistanceKm(lat1, lon1, lat2, lon2) {
  if (lat1 == null || lon1 == null || lat2 == null || lon2 == null) return null
  const numLat1 = Number(lat1)
  const numLon1 = Number(lon1)
  const numLat2 = Number(lat2)
  const numLon2 = Number(lon2)

  if (
    !Number.isFinite(numLat1) ||
    !Number.isFinite(numLon1) ||
    !Number.isFinite(numLat2) ||
    !Number.isFinite(numLon2)
  ) {
    return null
  }

  const R = 6371 // Radius of the Earth in km
  const dLat = ((numLat2 - numLat1) * Math.PI) / 180
  const dLon = ((numLon2 - numLon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((numLat1 * Math.PI) / 180) *
      Math.cos((numLat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  const d = R * c

  if (d < 0.1) return 'Within 100m'
  return `${d.toFixed(1)} km`
}
