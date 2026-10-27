const KEY = 'lc-app-user-location'

/**
 * @returns {{ address: string, lat: number | null, lng: number | null, city: string | null } | null}
 */
export function readAppUserLocation() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const j = JSON.parse(raw)
    const address = typeof j.address === 'string' ? j.address.trim() : ''
    const lat = typeof j.lat === 'number' && Number.isFinite(j.lat) ? j.lat : null
    const lng = typeof j.lng === 'number' && Number.isFinite(j.lng) ? j.lng : null
    const city = typeof j.city === 'string' ? j.city.trim() : null
    const addressId = typeof j.addressId === 'string' ? j.addressId : null
    const tag = typeof j.tag === 'string' ? j.tag : null
    const receiverName = typeof j.receiverName === 'string' ? j.receiverName : null
    const receiverPhone = typeof j.receiverPhone === 'string' ? j.receiverPhone : null
    if (!address && lat == null && lng == null && !city) return null
    return { address, lat, lng, city, addressId, tag, receiverName, receiverPhone }
  } catch {
    return null
  }
}

/** @param {{ address?: string, lat?: number | null, lng?: number | null, city?: string | null, addressId?: string | null, tag?: string | null, receiverName?: string | null, receiverPhone?: string | null }} loc */
export function writeAppUserLocation(loc) {
  const address = typeof loc.address === 'string' ? loc.address.trim() : ''
  const lat = loc.lat != null && Number.isFinite(Number(loc.lat)) ? Number(loc.lat) : null
  const lng = loc.lng != null && Number.isFinite(Number(loc.lng)) ? Number(loc.lng) : null
  const city = typeof loc.city === 'string' ? loc.city.trim() : null
  const addressId = loc.addressId || loc._id || null
  const tag = loc.tag || null
  const receiverName = loc.receiverName || null
  const receiverPhone = loc.receiverPhone || null
  if (!address && lat == null && lng == null && !city) {
    localStorage.removeItem(KEY)
    return
  }
  localStorage.setItem(
    KEY,
    JSON.stringify({ address, lat, lng, city, addressId, tag, receiverName, receiverPhone, updatedAt: Date.now() }),
  )
}

export function clearAppUserLocation() {
  localStorage.removeItem(KEY)
}

/** True when user saved an address label or GPS coordinates. */
export function hasAppUserLocation(loc) {
  if (!loc) return false
  if (loc.address?.trim()) return true
  return loc.lat != null && loc.lng != null && Number.isFinite(loc.lat) && Number.isFinite(loc.lng)
}

/** Display string for headers and cards. */
export function formatAppUserLocationLabel(loc) {
  if (!loc) return ''
  const addr = loc.address?.trim()
  if (addr) return addr
  if (loc.lat != null && loc.lng != null) {
    return `GPS ${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`
  }
  return ''
}
