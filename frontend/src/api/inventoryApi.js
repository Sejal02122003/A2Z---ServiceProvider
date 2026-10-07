import { apiRequest } from './http.js'

// ==========================================
// PRODUCTS API
// ==========================================

export async function fetchProducts(params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') query.append(k, v)
  })
  const res = await apiRequest(`/products?${query.toString()}`)
  return res.data
}

export async function fetchProductById(id) {
  const res = await apiRequest(`/products/${id}`)
  return res.data
}

export async function createProduct(payload) {
  const res = await apiRequest('/products', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.data
}

export async function updateProduct(id, payload) {
  const res = await apiRequest(`/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  return res.data
}

export async function toggleProductStatus(id) {
  const res = await apiRequest(`/products/${id}/status`, {
    method: 'PATCH',
  })
  return res.data
}

export async function fetchProductCategories() {
  const res = await apiRequest('/products/categories')
  return res.data?.categories || []
}

// ==========================================
// SERVICE PRODUCT MAPPINGS API
// ==========================================

export async function fetchServiceProductMappings(serviceId) {
  const res = await apiRequest(`/services/${serviceId}/products`)
  return res.data?.mappings || []
}

export async function addServiceProductMapping(serviceId, payload) {
  const res = await apiRequest(`/services/${serviceId}/products`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.data
}

export async function updateServiceProductMapping(mappingId, payload) {
  const res = await apiRequest(`/service-products/${mappingId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  return res.data
}

export async function deleteServiceProductMapping(mappingId) {
  const res = await apiRequest(`/service-products/${mappingId}`, {
    method: 'DELETE',
  })
  return res
}

export async function fetchAllServiceProductMappings(params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') query.append(k, v)
  })
  const res = await apiRequest(`/service-products?${query.toString()}`)
  return res.data
}

// ==========================================
// CENTRAL INVENTORY & STOCK API
// ==========================================

export async function fetchInventoryList(params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') query.append(k, v)
  })
  const res = await apiRequest(`/inventory?${query.toString()}`)
  return res.data
}

export async function addInventoryStock(payload) {
  const res = await apiRequest('/inventory/add-stock', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.data
}

export async function adjustInventoryStock(payload) {
  const res = await apiRequest('/inventory/adjust-stock', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.data
}

export async function fetchLowStockProducts(params = {}) {
  const query = new URLSearchParams(params)
  const res = await apiRequest(`/inventory/low-stock?${query.toString()}`)
  return res.data
}

export async function fetchInventoryTransactions(params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') query.append(k, v)
  })
  const res = await apiRequest(`/inventory/transactions?${query.toString()}`)
  return res.data
}

export async function fetchVendorInventory(params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') query.append(k, v)
  })
  const res = await apiRequest(`/inventory/vendor-inventory?${query.toString()}`)
  return res.data
}

export async function fetchInventoryDashboardStats() {
  const res = await apiRequest('/inventory/dashboard-stats')
  return res.data
}

// ==========================================
// ADMIN MATERIAL REQUESTS API
// ==========================================

export async function fetchAdminMaterialRequests(params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') query.append(k, v)
  })
  const res = await apiRequest(`/material-requests/admin?${query.toString()}`)
  return res.data
}

export async function fetchAdminMaterialRequestById(id) {
  const res = await apiRequest(`/material-requests/admin/${id}`)
  return res.data
}

export async function approveMaterialRequest(id, payload = {}) {
  const res = await apiRequest(`/material-requests/admin/${id}/approve`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return res.data
}

export async function rejectMaterialRequest(id, payload = {}) {
  const res = await apiRequest(`/material-requests/admin/${id}/reject`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return res.data
}

export async function issueMaterialsToVendor(id, payload) {
  const res = await apiRequest(`/material-requests/admin/${id}/issue`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.data
}

export async function markRequestWaitingStock(id, payload = {}) {
  const res = await apiRequest(`/material-requests/admin/${id}/waiting-stock`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  })
  return res.data
}

// ==========================================
// VENDOR MATERIAL REQUESTS API
// ==========================================

export async function fetchVendorMaterialRequests(params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') query.append(k, v)
  })
  const res = await apiRequest(`/material-requests/vendor?${query.toString()}`)
  return res.data
}

export async function fetchVendorMaterialRequestById(id) {
  const res = await apiRequest(`/material-requests/vendor/${id}`)
  return res.data
}

export async function createVendorMaterialRequest(payload) {
  const res = await apiRequest('/material-requests/vendor', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.data
}

export async function requestAdditionalMaterial(id, payload) {
  const res = await apiRequest(`/material-requests/vendor/${id}/additional`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.data
}

export async function recordMaterialUsage(id, payload) {
  const res = await apiRequest(`/material-requests/vendor/${id}/usage`, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return res.data
}
