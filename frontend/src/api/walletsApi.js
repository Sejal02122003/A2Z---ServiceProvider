import { apiRequest } from './http.js'

export const walletsApi = {
  // Labour wallet APIs
  getMyWallet: () => {
    return apiRequest('/wallets/me', { method: 'GET' })
  },

  clearAdminDues: (payload) => {
    return apiRequest('/wallets/clear', {
      method: 'POST',
      body: payload,
    })
  },

  getEarningsSummary: () => {
    return apiRequest('/wallets/earnings-summary', { method: 'GET' })
  },

  getMyTransactions: () => {
    return apiRequest('/wallets/transactions', { method: 'GET' })
  },

  checkBookingEligibility: (bookingId) => {
    return apiRequest(`/wallets/eligibility/${bookingId}`, { method: 'GET' })
  },

  rechargeMyWallet: (payload) => {
    return apiRequest('/wallets/recharge', {
      method: 'POST',
      body: payload,
    })
  },

  // Customer / User wallet APIs
  getMyUserWallet: () => {
    return apiRequest('/wallets/user/me', { method: 'GET' })
  },

  getMyUserTransactions: (params = {}) => {
    const q = new URLSearchParams()
    if (params.page) q.set('page', params.page)
    if (params.limit) q.set('limit', params.limit)
    const qs = q.toString() ? `?${q.toString()}` : ''
    return apiRequest(`/wallets/user/transactions${qs}`, { method: 'GET' })
  },

  getPublicWalletSettings: () => {
    return apiRequest('/wallets/public-settings', { method: 'GET' })
  },

  // Admin Wallet & Rewards APIs
  getAdminWalletSettings: () => {
    return apiRequest('/admin/wallets/settings', { method: 'GET' })
  },

  updateAdminWalletSettings: (payload) => {
    return apiRequest('/admin/wallets/settings', {
      method: 'PUT',
      body: payload,
    })
  },

  getAdminUserWallets: (params = {}) => {
    const q = new URLSearchParams()
    if (params.search) q.set('search', params.search)
    if (params.role) q.set('role', params.role)
    if (params.page) q.set('page', params.page)
    if (params.limit) q.set('limit', params.limit)
    const qs = q.toString() ? `?${q.toString()}` : ''
    return apiRequest(`/admin/wallets/users${qs}`, { method: 'GET' })
  },

  getAdminUserWalletDetails: (userId) => {
    return apiRequest(`/admin/wallets/users/${userId}`, { method: 'GET' })
  },

  adjustAdminUserWallet: (userId, payload) => {
    return apiRequest(`/admin/wallets/users/${userId}/adjust`, {
      method: 'POST',
      body: payload,
    })
  },
}
