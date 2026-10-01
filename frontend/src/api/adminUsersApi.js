import { apiRequest } from './http.js'

/**
 * @param {string} userId
 */
export async function fetchAdminUserById(userId) {
  const json = await apiRequest(`/users/${userId}`)
  return json.data?.user ?? null
}

/**
 * @param {string} userId
 * @param {{ decision: 'approved' | 'rejected', note?: string }} body
 */
export async function reviewLabourKycAdmin(userId, body) {
  const json = await apiRequest(`/users/${userId}/labour-kyc-review`, { method: 'PATCH', body })
  return json.data?.user ?? null
}

export function updateAdminUserStatus(userId, isActive) {
  return apiRequest(`/users/${userId}/status`, {
    method: 'PATCH',
    body: { isActive },
  })
}

export function deleteAdminUser(userId) {
  return apiRequest(`/users/${userId}`, { method: 'DELETE' })
}

/**
 * @param {{ search?: string, role?: string, status?: 'all' | 'active' | 'inactive', kycStatus?: 'all' | 'pending' | 'verified' | 'failed', kitStatus?: 'all' | 'complete' | 'partial' | 'not_issued', freeTrialStatus?: 'all' | 'active' | 'expired', categoryId?: string, location?: string, page?: number, limit?: number }} params
 */
export async function fetchAdminUsers(params = {}) {
  const sp = new URLSearchParams()
  if (params.search?.trim()) sp.set('search', params.search.trim())
  if (params.role) sp.set('role', params.role)
  if (params.status && params.status !== 'all') sp.set('status', params.status)
  if (params.kycStatus && params.kycStatus !== 'all') sp.set('kycStatus', params.kycStatus)
  if (params.kitStatus && params.kitStatus !== 'all') sp.set('kitStatus', params.kitStatus)
  if (params.freeTrialStatus && params.freeTrialStatus !== 'all') sp.set('freeTrialStatus', params.freeTrialStatus)
  if (params.categoryId && params.categoryId !== 'all') sp.set('categoryId', params.categoryId)
  if (params.location?.trim() && params.location !== 'all') sp.set('location', params.location.trim())
  sp.set('page', String(Math.max(1, params.page ?? 1)))
  sp.set('limit', String(Math.min(100, Math.max(1, params.limit ?? 20))))
  const json = await apiRequest(`/users?${sp.toString()}`)
  return json.data
}
