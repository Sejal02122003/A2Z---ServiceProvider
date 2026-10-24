import { apiRequest } from './http.js'

export const broadcastsApi = {
  acceptBroadcast: (logId, data = {}) => {
    return apiRequest(`/broadcasts/${logId}/accept`, { method: 'POST', body: JSON.stringify(data) })
  },

  rejectBroadcast: (logId) => {
    return apiRequest(`/broadcasts/${logId}/reject`, { method: 'POST' })
  },

  getActiveBroadcast: () => {
    return apiRequest('/broadcasts/active')
  },
}
