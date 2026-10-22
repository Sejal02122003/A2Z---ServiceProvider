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

