import { apiRequest } from './http.js'

/**
 * Fetch all saved addresses for current user
 */
export async function getSavedAddresses() {
  return apiRequest('/users/me/addresses', { method: 'GET' })
}

/**
 * Add a new saved address
 */
export async function addSavedAddress(payload) {
  return apiRequest('/users/me/addresses', { method: 'POST', body: payload })
}

/**
 * Update an existing saved address
 */
export async function updateSavedAddress(addressId, payload) {
  return apiRequest(`/users/me/addresses/${addressId}`, { method: 'PUT', body: payload })
}

/**
 * Delete a saved address
 */
export async function deleteSavedAddress(addressId) {
  return apiRequest(`/users/me/addresses/${addressId}`, { method: 'DELETE' })
}

/**
 * Mark a saved address as default
 */
export async function setDefaultSavedAddress(addressId) {
  return apiRequest(`/users/me/addresses/${addressId}/default`, { method: 'PATCH' })
}

/**
 * Import addresses from Blinkit
 */
export async function importBlinkitAddresses(addresses) {
  return apiRequest('/users/me/addresses/import-blinkit', { method: 'POST', body: { addresses } })
}
