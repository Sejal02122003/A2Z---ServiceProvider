import { apiRequest } from './http.js'

export async function fetchMyIdentityStatus() {
  const json = await apiRequest('/identity-verification/me')
  return json.data
}

export async function submitIdentityVerification(data) {
  const json = await apiRequest('/identity-verification/submit', {
    method: 'POST',
    body: data,
  })
  return json.data
}

export async function appealIdentityVerification(data) {
  const json = await apiRequest('/identity-verification/appeal', {
    method: 'POST',
    body: data,
  })
  return json.data
}

export async function fetchAdminVerifications(params = {}) {
  const sp = new URLSearchParams()
  if (params.search?.trim()) sp.set('search', params.search.trim())
  if (params.status && params.status !== 'all') sp.set('status', params.status)
  if (params.role && params.role !== 'all') sp.set('role', params.role)
  if (params.riskFlag && params.riskFlag !== 'all') sp.set('riskFlag', params.riskFlag)
  sp.set('page', String(Math.max(1, params.page ?? 1)))
  sp.set('limit', String(Math.min(100, Math.max(1, params.limit ?? 20))))

  const json = await apiRequest(`/admin/identity-verifications?${sp.toString()}`)
  return json.data
}

export async function fetchAdminVerificationById(id) {
  const json = await apiRequest(`/admin/identity-verifications/${id}`)
  return json.data
}

export async function reviewAdminVerification(id, { decision, reason, verifiedLegalName }) {
  const json = await apiRequest(`/admin/identity-verifications/${id}/decision`, {
    method: 'PATCH',
    body: { decision, reason, verifiedLegalName },
  })
  return json.data
}

export async function suspendAdminUser(id, { reason }) {
  const json = await apiRequest(`/admin/identity-verifications/${id}/suspend`, {
    method: 'POST',
    body: { reason },
  })
  return json.data
}

export async function restoreAdminUser(id, { reason }) {
  const json = await apiRequest(`/admin/identity-verifications/${id}/restore`, {
    method: 'POST',
    body: { reason },
  })
  return json.data
}

export async function fetchAdminAuditLogs(params = {}) {
  const sp = new URLSearchParams()
  if (params.action) sp.set('action', params.action)
  if (params.userId) sp.set('userId', params.userId)
  sp.set('page', String(Math.max(1, params.page ?? 1)))
  sp.set('limit', String(Math.min(100, Math.max(1, params.limit ?? 50))))

  const json = await apiRequest(`/admin/identity-verifications/audit-logs?${sp.toString()}`)
  return json.data
}
