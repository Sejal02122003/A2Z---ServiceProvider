import { apiRequest } from './http.js'

function buildQueryString(params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.append(key, String(value))
    }
  })
  const qs = query.toString()
  return qs ? `?${qs}` : ''
}

// Public / Customer API
export function fetchPublicPackages(params = {}) {
  const qs = buildQueryString(params)
  return apiRequest(`/packages${qs}`, { method: 'GET' })
}

export function fetchPublicPackageDetails(idOrSlug) {
  return apiRequest(`/packages/${encodeURIComponent(idOrSlug)}`, { method: 'GET' })
}

// Admin API
export function fetchAdminPackages(params = {}) {
  const qs = buildQueryString(params)
  return apiRequest(`/admin/packages${qs}`, { method: 'GET' })
}

export function fetchAdminPackageDetails(id) {
  return apiRequest(`/admin/packages/${encodeURIComponent(id)}`, { method: 'GET' })
}

export function createAdminPackage(payload) {
  return apiRequest('/admin/packages', {
    method: 'POST',
    body: payload,
  })
}

export function updateAdminPackage(id, payload) {
  return apiRequest(`/admin/packages/${encodeURIComponent(id)}`, {
    method: 'PUT',
    body: payload,
  })
}

export function updateAdminPackageStatus(id, status) {
  return apiRequest(`/admin/packages/${encodeURIComponent(id)}/status`, {
    method: 'PATCH',
    body: { status },
  })
}

export function deleteAdminPackage(id) {
  return apiRequest(`/admin/packages/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  })
}
