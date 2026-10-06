import { apiRequest } from './http.js'

export const simulatedOpportunitiesApi = {
  // --- Admin Methods ---
  getSettings: () => {
    return apiRequest('/simulated-opportunities/admin/settings')
  },

  updateSettings: (enabled) => {
    return apiRequest('/simulated-opportunities/admin/settings', {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    })
  },

  createOpportunity: (data) => {
    return apiRequest('/simulated-opportunities/admin', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  getAdminOpportunities: (params = {}) => {
    const searchParams = new URLSearchParams()
    if (params.status) searchParams.set('status', params.status)
    if (params.page) searchParams.set('page', params.page)
    if (params.limit) searchParams.set('limit', params.limit)
    const qs = searchParams.toString() ? `?${searchParams.toString()}` : ''
    return apiRequest(`/simulated-opportunities/admin${qs}`)
  },

  getAdminOpportunityById: (id) => {
    return apiRequest(`/simulated-opportunities/admin/${id}`)
  },

  cancelOpportunity: (id) => {
    return apiRequest(`/simulated-opportunities/admin/${id}/cancel`, {
      method: 'PATCH',
    })
  },

  // --- Vendor Methods ---
  getVendorOpportunities: () => {
    return apiRequest('/simulated-opportunities/vendor')
  },

  getVendorOpportunityById: (id) => {
    return apiRequest(`/simulated-opportunities/vendor/${id}`)
  },

  acceptOpportunity: (id) => {
    return apiRequest(`/simulated-opportunities/vendor/${id}/accept`, {
      method: 'POST',
    })
  },

  rejectOpportunity: (id) => {
    return apiRequest(`/simulated-opportunities/vendor/${id}/reject`, {
      method: 'POST',
    })
  },
}
