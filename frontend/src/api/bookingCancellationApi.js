import { apiRequest } from './http.js'

export const bookingCancellationApi = {
  // Admin Endpoints
  getAdminOverview: () => apiRequest('/booking-cancellations/admin/overview'),
  getAdminSettings: () => apiRequest('/booking-cancellations/admin/settings'),
  updateAdminSettings: (data) =>
    apiRequest('/booking-cancellations/admin/settings', { method: 'PUT', body: data }),
  getAdminRecords: (params = {}) => {
    const qs = new URLSearchParams()
    if (params.timingClassification && params.timingClassification !== 'ALL') {
      qs.set('timingClassification', params.timingClassification)
    }
    if (params.cancellationStatus && params.cancellationStatus !== 'ALL') {
      qs.set('cancellationStatus', params.cancellationStatus)
    }
    if (params.approvalStatus && params.approvalStatus !== 'ALL') {
      qs.set('approvalStatus', params.approvalStatus)
    }
    if (params.penaltyStatus && params.penaltyStatus !== 'ALL') {
      qs.set('penaltyStatus', params.penaltyStatus)
    }
    if (params.search) qs.set('search', params.search)
    if (params.page) qs.set('page', params.page)
    if (params.limit) qs.set('limit', params.limit)
    if (params.startDate) qs.set('startDate', params.startDate)
    if (params.endDate) qs.set('endDate', params.endDate)

    const query = qs.toString() ? `?${qs.toString()}` : ''
    return apiRequest(`/booking-cancellations/admin/records${query}`)
  },
  getAdminRecordById: (id) => apiRequest(`/booking-cancellations/admin/records/${id}`),
  approveRequest: (id, adminNotes = '') =>
    apiRequest(`/booking-cancellations/admin/records/${id}/approve`, {
      method: 'POST',
      body: { adminNotes },
    }),
  rejectRequest: (id, rejectionReason = '') =>
    apiRequest(`/booking-cancellations/admin/records/${id}/reject`, {
      method: 'POST',
      body: { rejectionReason },
    }),
  waivePenalty: (id, waiverReason) =>
    apiRequest(`/booking-cancellations/admin/records/${id}/waive`, {
      method: 'POST',
      body: { waiverReason },
    }),
  recordAdminBouncePenalty: (bookingId, data = {}) =>
    apiRequest(`/booking-cancellations/admin/bookings/${bookingId}/bounce`, {
      method: 'POST',
      body: data,
    }),

  // Vendor / Partner Endpoints
  getVendorEligibility: (bookingId) =>
    apiRequest(`/booking-cancellations/vendor/bookings/${bookingId}/eligibility`),
  submitVendorCancellation: (bookingId, data) =>
    apiRequest(`/booking-cancellations/vendor/bookings/${bookingId}/cancel`, {
      method: 'POST',
      body: data,
    }),

  // Customer Endpoints
  getCustomerPolicyStatus: () =>
    apiRequest('/booking-cancellations/customer/policy-status'),

  // Admin Customer Cancellations Management
  getAdminCustomerCancellations: (params = {}) => {
    const qs = new URLSearchParams()
    if (params.page) qs.set('page', params.page)
    if (params.limit) qs.set('limit', params.limit)
    if (params.search) qs.set('search', params.search)
    if (params.filter && params.filter !== 'ALL') qs.set('filter', params.filter)
    const query = qs.toString() ? `?${qs.toString()}` : ''
    return apiRequest(`/booking-cancellations/admin/customer-cancellations${query}`)
  },
  getAdminCustomerHistory: (id) =>
    apiRequest(`/booking-cancellations/admin/customers/${id}/history`),
  adminRestrictCustomer: (id, data) =>
    apiRequest(`/booking-cancellations/admin/customers/${id}/restrict`, {
      method: 'POST',
      body: data,
    }),
  adminUnrestrictCustomer: (id, data = {}) =>
    apiRequest(`/booking-cancellations/admin/customers/${id}/unrestrict`, {
      method: 'POST',
      body: data,
    }),
}
