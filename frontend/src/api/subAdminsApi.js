import { apiRequest } from './http.js'

export const subAdminsApi = {
  list: () => apiRequest('/admin/sub-admins'),
  create: (payload) => apiRequest('/admin/sub-admins', { method: 'POST', body: payload }),
  update: (id, payload) => apiRequest(`/admin/sub-admins/${id}`, { method: 'PATCH', body: payload }),
  remove: (id) => apiRequest(`/admin/sub-admins/${id}`, { method: 'DELETE' }),
}
