import { apiRequest } from './http.js'

export const vendorTrialApi = {
  // ==================== VENDOR ====================
  getMyTrial() {
    return apiRequest('/vendor/trial')
  },
  getMyTrialHistory() {
    return apiRequest('/vendor/trial/history')
  },
  requestFinalChance() {
    return apiRequest('/vendor/trial/final-chance/request', { method: 'POST' })
  },
  verifyPenaltyPayment(payload) {
    return apiRequest('/vendor/trial/final-chance/verify-payment', {
      method: 'POST',
      body: payload,
    })
  },

  // ==================== ADMIN ====================
  getTrialSettings() {
    return apiRequest('/admin/trial-settings')
  },
  updateTrialSettings(settings) {
    return apiRequest('/admin/trial-settings', {
      method: 'PUT',
      body: settings,
    })
  },
  getDashboardStats() {
    return apiRequest('/admin/vendor-trials/stats')
  },
  getVendorTrials(params = {}) {
    const query = new URLSearchParams()
    if (params.status && params.status !== 'all') query.set('status', params.status)
    if (params.search) query.set('search', params.search)
    if (params.page) query.set('page', params.page)
    if (params.limit) query.set('limit', params.limit)
    const qs = query.toString()
    return apiRequest(`/admin/vendor-trials${qs ? `?${qs}` : ''}`)
  },
  getPendingConfirmations(params = {}) {
    const query = new URLSearchParams()
    if (params.page) query.set('page', params.page)
    if (params.limit) query.set('limit', params.limit)
    const qs = query.toString()
    return apiRequest(`/admin/vendor-trials/pending-confirmations${qs ? `?${qs}` : ''}`)
  },
  getVendorTrialDetail(vendorId) {
    return apiRequest(`/admin/vendor-trials/${vendorId}`)
  },
  confirmVendor(vendorId, notes = '') {
    return apiRequest(`/admin/vendor-trials/${vendorId}/confirm`, {
      method: 'POST',
      body: { notes },
    })
  },
  rejectVendor(vendorId, reason) {
    return apiRequest(`/admin/vendor-trials/${vendorId}/reject`, {
      method: 'POST',
      body: { reason },
    })
  },
  blockVendor(vendorId, reason) {
    return apiRequest(`/admin/vendor-trials/${vendorId}/block`, {
      method: 'POST',
      body: { reason },
    })
  },
  unblockVendor(vendorId, reason = '') {
    return apiRequest(`/admin/vendor-trials/${vendorId}/unblock`, {
      method: 'POST',
      body: { reason },
    })
  },
  pauseTrial(vendorId, reason = '') {
    return apiRequest(`/admin/vendor-trials/${vendorId}/pause`, {
      method: 'POST',
      body: { reason },
    })
  },
  resumeTrial(vendorId) {
    return apiRequest(`/admin/vendor-trials/${vendorId}/resume`, {
      method: 'POST',
    })
  },
  extendTrial(vendorId, { additionalCount, reason }) {
    return apiRequest(`/admin/vendor-trials/${vendorId}/extend`, {
      method: 'POST',
      body: { additionalCount, reason },
    })
  },
  requestReview(vendorId, reason) {
    return apiRequest(`/admin/vendor-trials/${vendorId}/request-review`, {
      method: 'POST',
      body: { reason },
    })
  },
  waivePenalty(vendorId, reason = '') {
    return apiRequest(`/admin/vendor-trials/${vendorId}/waive-penalty`, {
      method: 'POST',
      body: { reason },
    })
  },
  migrateExistingVendors() {
    return apiRequest('/admin/vendor-trials/migrate-existing', {
      method: 'POST',
    })
  },
}
