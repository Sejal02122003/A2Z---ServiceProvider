import { apiRequest } from './http.js'

export const rewardApi = {
  // ==================== ADMIN ENDPOINTS ====================

  getAdminOverview: async () => {
    return apiRequest('/admin/rewards/overview', { method: 'GET' })
  },

  getAdminCampaigns: async (params = {}) => {
    const query = new URLSearchParams()
    if (params.category) query.append('category', params.category)
    if (params.status) query.append('status', params.status)
    if (params.search) query.append('search', params.search)
    if (params.page) query.append('page', params.page)
    if (params.limit) query.append('limit', params.limit)
    return apiRequest(`/admin/rewards/campaigns?${query.toString()}`, { method: 'GET' })
  },

  getAdminCampaignById: async (id) => {
    return apiRequest(`/admin/rewards/campaigns/${id}`, { method: 'GET' })
  },

  createAdminCampaign: async (data) => {
    return apiRequest('/admin/rewards/campaigns', {
      method: 'POST',
      body: data,
    })
  },

  updateAdminCampaign: async (id, data) => {
    return apiRequest(`/admin/rewards/campaigns/${id}`, {
      method: 'PATCH',
      body: data,
    })
  },

  activateAdminCampaign: async (id) => {
    return apiRequest(`/admin/rewards/campaigns/${id}/activate`, { method: 'POST' })
  },

  pauseAdminCampaign: async (id, reason) => {
    return apiRequest(`/admin/rewards/campaigns/${id}/pause`, {
      method: 'POST',
      body: { reason },
    })
  },

  endAdminCampaign: async (id, reason) => {
    return apiRequest(`/admin/rewards/campaigns/${id}/end`, {
      method: 'POST',
      body: { reason },
    })
  },

  evaluateAdminCampaign: async (id) => {
    return apiRequest(`/admin/rewards/campaigns/${id}/evaluate`, { method: 'POST' })
  },

  getAdminPendingApprovals: async (params = {}) => {
    const query = new URLSearchParams()
    if (params.page) query.append('page', params.page)
    if (params.limit) query.append('limit', params.limit)
    return apiRequest(`/admin/rewards/pending?${query.toString()}`, { method: 'GET' })
  },

  approveAdminReward: async (id, notes = '') => {
    return apiRequest(`/admin/rewards/${id}/approve`, {
      method: 'POST',
      body: { notes },
    })
  },

  rejectAdminReward: async (id, reason) => {
    return apiRequest(`/admin/rewards/${id}/reject`, {
      method: 'POST',
      body: { reason },
    })
  },

  reverseAdminReward: async (id, reason) => {
    return apiRequest(`/admin/rewards/${id}/reverse`, {
      method: 'POST',
      body: { reason },
    })
  },

  getAdminVendorProgress: async (params = {}) => {
    const query = new URLSearchParams()
    if (params.campaignId) query.append('campaignId', params.campaignId)
    if (params.status) query.append('status', params.status)
    if (params.search) query.append('search', params.search)
    if (params.page) query.append('page', params.page)
    if (params.limit) query.append('limit', params.limit)
    return apiRequest(`/admin/rewards/vendors?${query.toString()}`, { method: 'GET' })
  },

  getAdminRewardTransactions: async (params = {}) => {
    const query = new URLSearchParams()
    if (params.page) query.append('page', params.page)
    if (params.limit) query.append('limit', params.limit)
    return apiRequest(`/admin/rewards/transactions?${query.toString()}`, { method: 'GET' })
  },

  getAdminRewardReports: async (params = {}) => {
    const query = new URLSearchParams()
    if (params.startDate) query.append('startDate', params.startDate)
    if (params.endDate) query.append('endDate', params.endDate)
    if (params.category) query.append('category', params.category)
    return apiRequest(`/admin/rewards/reports?${query.toString()}`, { method: 'GET' })
  },

  getAdminRewardSettings: async () => {
    return apiRequest('/admin/rewards/settings', { method: 'GET' })
  },

  updateAdminRewardSettings: async (data) => {
    return apiRequest('/admin/rewards/settings', {
      method: 'PUT',
      body: data,
    })
  },

  triggerManualReconciliation: async () => {
    return apiRequest('/admin/rewards/reconcile-now', { method: 'POST' })
  },

  // ==================== VENDOR ENDPOINTS ====================

  getVendorRewardsOverview: async () => {
    return apiRequest('/vendor/rewards/overview', { method: 'GET' })
  },
}
