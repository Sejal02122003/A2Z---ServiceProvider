import { apiRequest } from './http.js'

export const bookingReminderApi = {
  // Admin Endpoints
  getSettings: () => apiRequest('/reminders/admin/settings'),
  
  updateSettings: (payload) =>
    apiRequest('/reminders/admin/settings', {
      method: 'PATCH',
      body: payload,
    }),

  getOverview: () => apiRequest('/reminders/admin/overview'),

  getUpcomingReminders: (params = {}) => {
    const query = new URLSearchParams()
    if (params.page) query.append('page', params.page)
    if (params.limit) query.append('limit', params.limit)
    if (params.recipientRole) query.append('recipientRole', params.recipientRole)
    if (params.reminderType) query.append('reminderType', params.reminderType)
    if (params.search) query.append('search', params.search)
    return apiRequest(`/reminders/admin/upcoming?${query.toString()}`)
  },

  getReminderHistory: (params = {}) => {
    const query = new URLSearchParams()
    if (params.page) query.append('page', params.page)
    if (params.limit) query.append('limit', params.limit)
    if (params.status) query.append('status', params.status)
    if (params.recipientRole) query.append('recipientRole', params.recipientRole)
    if (params.reminderType) query.append('reminderType', params.reminderType)
    if (params.search) query.append('search', params.search)
    return apiRequest(`/reminders/admin/history?${query.toString()}`)
  },

  retryReminder: (id) =>
    apiRequest(`/reminders/admin/retry/${id}`, {
      method: 'POST',
    }),

  triggerWorkerCycle: () =>
    apiRequest('/reminders/admin/trigger-cycle', {
      method: 'POST',
    }),

  // Recipient in-app notification endpoints
  getMyNotifications: (params = {}) => {
    const query = new URLSearchParams()
    if (params.page) query.append('page', params.page)
    if (params.limit) query.append('limit', params.limit)
    if (params.unreadOnly !== undefined) query.append('unreadOnly', params.unreadOnly)
    return apiRequest(`/reminders/my-notifications?${query.toString()}`)
  },

  markNotificationRead: (id) =>
    apiRequest(`/reminders/my-notifications/${id}/read`, {
      method: 'PATCH',
    }),

  markAllNotificationsRead: () =>
    apiRequest('/reminders/my-notifications/read-all', {
      method: 'POST',
    }),
}
