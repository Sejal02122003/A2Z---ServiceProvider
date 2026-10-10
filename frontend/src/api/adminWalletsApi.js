import { apiRequest } from './http.js'

export const adminWalletsApi = {
  /**
   * Get all withdrawal requests for admin
   */
  getAllWithdrawals: () => {
    return apiRequest('/admin/wallets/withdrawals', { method: 'GET' })
  },

  getVendorWithdrawals: () => {
    return apiRequest('/admin/wallets/vendor-withdrawals', { method: 'GET' })
  },

  getVendorWalletStats: () => {
    return apiRequest('/admin/wallets/vendor-stats', { method: 'GET' })
  },

  /**
   * Update withdrawal status (e.g. APPROVED or REJECTED)
   * @param {string} id - Withdrawal Request ID
   * @param {string} status - New status
   */
  updateWithdrawalStatus: (id, status, adminRemarks = '') => {
    return apiRequest(`/admin/wallets/withdrawals/${id}`, {
      method: 'PATCH',
      body: { status, adminRemarks },
    })
  },

  getLabourWalletStats: () => {
    return apiRequest('/admin/wallets/labour-stats', { method: 'GET' })
  },

  getAllWalletTransactions: (params = {}) => {
    const q = new URLSearchParams()
    if (params.search) q.set('search', params.search)
    if (params.type) q.set('type', params.type)
    if (params.context) q.set('context', params.context)
    if (params.status) q.set('status', params.status)
    if (params.userId) q.set('userId', params.userId)
    if (params.page) q.set('page', params.page)
    if (params.limit) q.set('limit', params.limit)
    const qs = q.toString() ? `?${q.toString()}` : ''
    return apiRequest(`/admin/wallets/transactions${qs}`, { method: 'GET' })
  },

  reconcileBookingSettlement: (bookingId) => {
    return apiRequest(`/admin/wallets/reconcile-settlement/${bookingId}`, {
      method: 'POST',
    })
  },

  getWalletSettings: () => {
    return apiRequest('/admin/wallets/settings', { method: 'GET' })
  },

  updateWalletSettings: (payload) => {
    return apiRequest('/admin/wallets/settings', {
      method: 'PUT',
      body: payload,
    })
  },

  /**
   * Delete a withdrawal request
   */
  deleteWithdrawalRequest: (id) => {
    return apiRequest(`/admin/wallets/withdrawals/${id}`, { method: 'DELETE' })
  }
}
