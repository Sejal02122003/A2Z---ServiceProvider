import { apiRequest } from './http.js'

export const walletEligibilityApi = {
  // Admin endpoints
  getAdminSettings: () => {
    return apiRequest('/admin/wallet-eligibility/settings')
  },

  updateAdminSettings: (data) => {
    return apiRequest('/admin/wallet-eligibility/settings', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  getProvidersReport: (params = {}) => {
    const qp = new URLSearchParams()
    if (params.search) qp.append('search', params.search)
    if (params.filter) qp.append('filter', params.filter)
    if (params.page) qp.append('page', String(params.page))
    if (params.limit) qp.append('limit', String(params.limit))
    const query = qp.toString() ? `?${qp.toString()}` : ''
    return apiRequest(`/admin/wallet-eligibility/providers${query}`)
  },

  getEligibilityTransactions: (params = {}) => {
    const qp = new URLSearchParams()
    if (params.search) qp.append('search', params.search)
    if (params.context) qp.append('context', params.context)
    if (params.page) qp.append('page', String(params.page))
    if (params.limit) qp.append('limit', String(params.limit))
    const query = qp.toString() ? `?${qp.toString()}` : ''
    return apiRequest(`/admin/wallet-eligibility/transactions${query}`)
  },

  // Service Provider endpoints
  getProviderEligibility: () => {
    return apiRequest('/provider/wallet/eligibility')
  },

  checkBookingEligibility: (bookingId) => {
    return apiRequest(`/provider/wallet/eligibility/check?bookingId=${encodeURIComponent(bookingId)}`)
  },

  acceptBooking: (bookingId, data = {}) => {
    return apiRequest(`/provider/bookings/${bookingId}/accept`, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },
}
