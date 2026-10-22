import { apiRequest } from './http.js'

/**
 * Update a service partner's welcome kit status
 * @param {string} partnerId
 * @param {{ uniformIssued: boolean, idCardIssued: boolean, bagIssued: boolean }} body
 */
export async function updatePartnerWelcomeKit(partnerId, body) {
  const json = await apiRequest(`/service-partners/${partnerId}/welcome-kit`, {
    method: 'PATCH',
    body,
  })
  return json.data
}

/**
 * Fetch welcome kit distribution dashboard statistics
 */
export async function fetchPartnerWelcomeKitStats() {
  const json = await apiRequest('/service-partners/welcome-kit-stats')
  return json.data
}

/**
 * Admin: Accept or reject service partner's welcome kit payment screenshot
 * @param {string} partnerId
 * @param {{ action: 'APPROVE' | 'REJECT', rejectionReason?: string, notes?: string }} body
 */
export async function verifyPartnerWelcomeKitPayment(partnerId, body) {
  const json = await apiRequest(`/service-partners/${partnerId}/welcome-kit/verify-payment`, {
    method: 'PATCH',
    body,
  })
  return json.data
}

/**
 * Admin: Request address correction from service partner with a reason
 * @param {string} partnerId
 * @param {{ reason: string }} body
 */
export async function requestPartnerAddressCorrection(partnerId, body) {
  const json = await apiRequest(`/service-partners/${partnerId}/welcome-kit/address/request-correction`, {
    method: 'PATCH',
    body,
  })
  return json.data
}

/**
 * Admin: Confirm service partner's welcome kit delivery address and mark ready for dispatch
 * @param {string} partnerId
 */
export async function confirmPartnerWelcomeKitAddress(partnerId) {
  const json = await apiRequest(`/service-partners/${partnerId}/welcome-kit/address/confirm`, {
    method: 'PATCH',
  })
  return json.data
}

/**
 * Admin: Record manual dispatch details for a welcome kit
 * @param {string} partnerId
 * @param {{
 *   courierName: string,
 *   trackingNumber?: string,
 *   trackingUrl?: string,
 *   dispatchDate?: string,
 *   estimatedDeliveryDate?: string,
 *   notes?: string
 * }} body
 */
export async function dispatchPartnerWelcomeKit(partnerId, body) {
  const json = await apiRequest(`/service-partners/${partnerId}/welcome-kit/dispatch`, {
    method: 'POST',
    body,
  })
  return json.data
}

/**
 * Admin: Explicit manual delivery confirmation
 * @param {string} partnerId
 * @param {{ notes?: string }} [body]
 */
export async function confirmPartnerWelcomeKitDeliveryAdmin(partnerId, body = {}) {
  const json = await apiRequest(`/service-partners/${partnerId}/welcome-kit/confirm-delivery`, {
    method: 'POST',
    body,
  })
  return json.data
}

