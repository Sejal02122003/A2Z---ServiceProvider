/** Canonical booking flow route — always navigate with full path + query (never `setSearchParams` alone). */
export const BOOKING_FLOW_PATH = '/user/booking/flow'

/** Query keys owned by the booking flow — must not appear on `/user` or other routes. */
export const BOOKING_FLOW_QUERY_KEYS = ['step', 'categoryId', 'groupId', 'packageId', 'ref']

/**
 * @param {string} step
 * @param {{ categoryId?: string, groupId?: string, packageId?: string, ref?: string }} [extra]
 */
export function buildBookingFlowPath(step, extra = {}) {
  const params = new URLSearchParams()
  params.set('step', step)
  if (extra.categoryId) params.set('categoryId', String(extra.categoryId))
  if (extra.groupId) params.set('groupId', String(extra.groupId))
  if (extra.packageId) params.set('packageId', String(extra.packageId))
  if (extra.ref) params.set('ref', String(extra.ref))
  return `${BOOKING_FLOW_PATH}?${params.toString()}`
}

/** Home tab / menu — strips booking query params. */
export const APP_HOME_PATH = '/user'

/** React Router location for Home — explicit empty search avoids leaking `?step=`. */
export const APP_HOME_LOCATION = { pathname: APP_HOME_PATH, search: '', hash: '' }

/**
 * @param {URLSearchParams | string} input
 */
export function hasBookingFlowQuery(input) {
  const params = typeof input === 'string' ? new URLSearchParams(input) : input
  return BOOKING_FLOW_QUERY_KEYS.some((key) => params.has(key))
}
