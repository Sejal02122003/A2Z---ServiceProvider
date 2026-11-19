import { apiRequest } from './http.js'

export const adminWalletApprovalApi = {
  /**
   * Fetch all recharge requests with filters, pagination, sorting, and search
   */
  getRechargeRequests: (params = {}) => {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        qs.set(key, val)
      }
    })
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return apiRequest(`/admin/wallet/recharge-requests${query}`)
  },

  /**
   * Fetch complete details of an individual recharge request
   */
  getRechargeRequestById: (requestId) => {
    return apiRequest(`/admin/wallet/recharge-requests/${requestId}`)
  },

  /**
   * Approve a pending recharge request
   */
  approveRechargeRequest: (requestId, data = {}) => {
    return apiRequest(`/admin/wallet/recharge-requests/${requestId}/approve`, {
      method: 'PATCH',
      body: data,
    })
  },

  /**
   * Reject a pending recharge request with mandatory reason
   */
  rejectRechargeRequest: (requestId, data = {}) => {
    return apiRequest(`/admin/wallet/recharge-requests/${requestId}/reject`, {
      method: 'PATCH',
      body: data,
    })
  },

  /**
   * Fetch wallet recharge statistics
   */
  getWalletStatistics: () => {
    return apiRequest('/admin/wallet/statistics')
  },

  /**
   * Fetch wallet transaction ledger records for users and workers
   */
  getWalletTransactions: (params = {}) => {
    const qs = new URLSearchParams()
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        qs.set(key, val)
      }
    })
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return apiRequest(`/admin/wallet/transactions${query}`)
  },
}
