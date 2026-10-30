import { apiClient, apiRequest } from './http.js'

export const adminQrPaymentsApi = {
  /**
   * Fetch currently active payment QR code configuration (Provider/Public facing)
   */
  fetchActiveQrConfig: (purpose = 'ALL') => {
    const params = new URLSearchParams()
    if (purpose && purpose !== 'ALL') params.set('purpose', purpose)
    const qs = params.toString() ? `?${params.toString()}` : ''
    return apiRequest(`/payments/qr-config${qs}`)
  },

  /**
   * Fetch complete QR configuration, audit log, and usage stats (Admin facing)
   */
  fetchAdminQrConfig: (purpose = 'ALL') => {
    const params = new URLSearchParams()
    if (purpose && purpose !== 'ALL') params.set('purpose', purpose)
    const qs = params.toString() ? `?${params.toString()}` : ''
    return apiRequest(`/admin/payments/qr-config${qs}`)
  },

  /**
   * Update or upload QR code configuration (Admin facing). Supports multipart FormData or JSON.
   */
  updateAdminQrConfig: async (payload, isMultipart = false) => {
    if (isMultipart && payload instanceof FormData) {
      const res = await apiClient.put('/admin/payments/qr-config', payload)
      return res.data
    }
    return apiRequest('/admin/payments/qr-config', {
      method: 'PUT',
      body: payload,
    })
  },

  /**
   * Activate or deactivate QR payments
   */
  toggleQrConfigStatus: (isActive, reason = '') => {
    return apiRequest('/admin/payments/qr-config/status', {
      method: 'PATCH',
      body: { isActive, reason },
    })
  },

  /**
   * Provider initiates a payment under active QR
   */
  createProviderPayment: (payload) => {
    return apiRequest('/provider-payments', {
      method: 'POST',
      body: payload,
    })
  },

  /**
   * Provider submits UTR/RRN and optional receipt proof
   */
  submitProviderPayment: async (id, payload, isMultipart = false) => {
    if (isMultipart && payload instanceof FormData) {
      const res = await apiClient.post(`/provider-payments/${id}/submit`, payload)
      return res.data
    }
    return apiRequest(`/provider-payments/${id}/submit`, {
      method: 'POST',
      body: payload,
    })
  },

  /**
   * Fetch provider's own payment submissions history
   */
  fetchMyProviderPayments: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return apiRequest(`/provider-payments/my${qs ? `?${qs}` : ''}`)
  },

  /**
   * Fetch specific payment details
   */
  fetchProviderPaymentDetails: (id) => {
    return apiRequest(`/provider-payments/${id}`)
  },

  /**
   * Fetch payments for admin review dashboard with stats & filters
   */
  fetchAdminProviderPayments: (params = {}) => {
    const qs = new URLSearchParams(params).toString()
    return apiRequest(`/admin/provider-payments${qs ? `?${qs}` : ''}`)
  },

  /**
   * Admin approves or rejects payment submission
   */
  reviewProviderPayment: (id, payload) => {
    return apiRequest(`/admin/provider-payments/${id}/review`, {
      method: 'PATCH',
      body: payload,
    })
  },
}
