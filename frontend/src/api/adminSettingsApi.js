import { apiRequest } from './http.js'

export const adminSettingsApi = {
  getSettings: () => {
    return apiRequest('/admin/settings', { method: 'GET' })
  },

  getCommissionFeeAmounts: () => {
    return apiRequest('/admin/commission-fee', { method: 'GET' })
  },

  updatePlatformFees: (payload) => {
    return apiRequest('/admin/settings/platform-fees', {
      method: 'PATCH',
      body: payload,
    })
  },

  updateCommission: (payload) => {
    return apiRequest('/admin/settings/commission', {
      method: 'PATCH',
      body: payload,
    })
  },

  updateLabourCashLimit: (payload) => {
    return apiRequest('/admin/settings/labour-cash-limit', {
      method: 'PATCH',
      body: payload,
    })
  },



  updateGstPercentage: (payload) => {
    return apiRequest('/admin/settings/gst', {
      method: 'PATCH',
      body: payload,
    })
  },

  updateCancellationPenalty: (payload) => {
    return apiRequest('/admin/settings/penalty', {
      method: 'PATCH',
      body: payload,
    })
  },

  updateTimeSlots: (payload) => {
    return apiRequest('/admin/settings/time-slots', {
      method: 'PATCH',
      body: payload,
    })
  },

  updateUserSubscriptionToggle: (payload) => {
    return apiRequest('/admin/settings/user-subscription-toggle', {
      method: 'PATCH',
      body: payload,
    })
  },
  updateDynamicSubscriptionSettings: (payload) => {
    return apiRequest('/admin/settings/dynamic-subscription', {
      method: 'PATCH',
      body: payload,
    })
  },

  updateMaxHourDiscount: (payload) => {
    return apiRequest('/admin/settings/max-hour-discount', {
      method: 'PATCH',
      body: payload,
    })
  },

  updatePaymentModes: (payload) => {
    return apiRequest('/admin/settings/payment-modes', {
      method: 'PATCH',
      body: payload,
    })
  },

  updateSimulatedOpportunitiesToggle: (payload) => {
    return apiRequest('/admin/settings/simulated-opportunities-toggle', {
      method: 'PATCH',
      body: payload,
    })
  },

  uploadBranding: (formData) => {
    return apiRequest('/admin/settings/branding', {
      method: 'POST',
      body: formData,
    })
  },

  deleteBranding: (type) => {
    return apiRequest(`/admin/settings/branding/${type}`, {
      method: 'DELETE',
    })
  },
}

// Public endpoint (no admin auth) — used in Checkout to fetch time slots
export const getPublicSettings = () => apiRequest('/admin/settings/public', { method: 'GET' })
