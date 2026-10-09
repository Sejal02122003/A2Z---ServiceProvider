import { apiRequest } from './http.js'

export const penaltyApi = {
  // Admin Endpoints
  getAdminOverview: () => apiRequest('/penalties/admin/overview'),
  getAdminSettings: () => apiRequest('/penalties/admin/settings'),
  updateAdminSettings: (data) => apiRequest('/penalties/admin/settings', { method: 'PUT', body: data }),
  getAdminPenalties: (params = {}) => {
    const qs = new URLSearchParams()
    if (params.status && params.status !== 'ALL') qs.set('status', params.status)
    if (params.penaltyType && params.penaltyType !== 'ALL') qs.set('penaltyType', params.penaltyType)
    if (params.search) qs.set('search', params.search)
    if (params.page) qs.set('page', params.page)
    if (params.limit) qs.set('limit', params.limit)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return apiRequest(`/penalties/admin/penalties${query}`)
  },
  getAdminPenaltyById: (id) => apiRequest(`/penalties/admin/penalties/${id}`),
  approvePenalty: (id) => apiRequest(`/penalties/admin/penalties/${id}/approve`, { method: 'POST' }),
  rejectPenalty: (id, reason = '') => apiRequest(`/penalties/admin/penalties/${id}/reject`, { method: 'POST', body: { reason } }),
  waivePenalty: (id, reason) => apiRequest(`/penalties/admin/penalties/${id}/waive`, { method: 'POST', body: { reason } }),
  reviewDispute: (id, decision, notes = '') => apiRequest(`/penalties/admin/penalties/${id}/review-dispute`, { method: 'POST', body: { decision, notes } }),
  reverseDeduction: (id, reason) => apiRequest(`/penalties/admin/penalties/${id}/reverse`, { method: 'POST', body: { reason } }),

  // Vendor Endpoints
  getVendorPenalties: (params = {}) => {
    const qs = new URLSearchParams()
    if (params.status && params.status !== 'ALL') qs.set('status', params.status)
    if (params.page) qs.set('page', params.page)
    if (params.limit) qs.set('limit', params.limit)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return apiRequest(`/penalties/vendor/my-penalties${query}`)
  },
  getVendorPenaltyById: (id) => apiRequest(`/penalties/vendor/my-penalties/${id}`),
  submitDispute: (id, data) => apiRequest(`/penalties/vendor/my-penalties/${id}/dispute`, { method: 'POST', body: data }),
}
