import { apiRequest } from './http.js'

export const notificationApi = {
  /**
   * Get paginated notifications for current user
   * @param {{ page?: number, limit?: number, unreadOnly?: boolean, type?: string }} params
   */
  getMyNotifications: (params = {}) => {
    const query = new URLSearchParams()
    if (params.page) query.append('page', String(params.page))
    if (params.limit) query.append('limit', String(params.limit))
    if (params.unreadOnly !== undefined) query.append('unreadOnly', String(params.unreadOnly))
    if (params.type) query.append('type', params.type)
    return apiRequest(`/notifications?${query.toString()}`)
  },

  /**
   * Get unread notification badge count
   */
  getUnreadCount: () => apiRequest('/notifications/unread-count'),

  /**
   * Mark a single notification as read
   * @param {string} id
   */
  markNotificationRead: (id) =>
    apiRequest(`/notifications/${id}/read`, {
      method: 'PATCH',
    }),

  /**
   * Mark all notifications as read
   */
  markAllNotificationsRead: () =>
    apiRequest('/notifications/read-all', {
      method: 'POST',
    }),

  /**
   * Delete a single notification
   * @param {string} id
   */
  deleteNotification: (id) =>
    apiRequest(`/notifications/${id}`, {
      method: 'DELETE',
    }),

  /**
   * Clear notifications (all or read-only)
   * @param {{ readOnly?: boolean }} params
   */
  clearNotifications: (params = {}) => {
    const query = new URLSearchParams()
    if (params.readOnly !== undefined) query.append('readOnly', String(params.readOnly))
    return apiRequest(`/notifications?${query.toString()}`, {
      method: 'DELETE',
    })
  },

  /**
   * Register FCM Token with backend
   */
  saveToken: (token, platform = 'web') =>
    apiRequest('/notifications/token', {
      method: 'POST',
      body: { token, platform },
    }),

  /**
   * De-register FCM Token
   */
  removeToken: (token, platform = 'web') =>
    apiRequest('/notifications/remove-token', {
      method: 'POST',
      body: { token, platform },
    }),
}
