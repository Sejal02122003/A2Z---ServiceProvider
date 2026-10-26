import { apiRequest } from './http.js'

export const bookingsApi = {
  calculateBill: (payload) => {
    return apiRequest('/bookings/calculate', {
      method: 'POST',
      body: payload,
    })
  },

  createBooking: (payload) => {
    return apiRequest('/bookings', {
      method: 'POST',
      body: payload,
    })
  },

  getBookingStatus: (id) => {
    return apiRequest(`/bookings/${id}`, { method: 'GET' })
  },
  
  getMyBookings: () => {
    return apiRequest('/bookings/me', { method: 'GET' })
  },
  
  generateInvoice: (id) => {
    return apiRequest(`/bookings/${id}/invoice`, { method: 'POST' })
  },

  updateBookingStatus: (id, payload) => {
    return apiRequest(`/bookings/${id}/status`, {
      method: 'PATCH',
      body: typeof payload === 'string' ? { status: payload } : payload,
    })
  },

  updatePaymentMethod: (id, paymentMethod) => {
    return apiRequest(`/bookings/${id}/payment-method`, {
      method: 'PATCH',
      body: { paymentMethod },
    })
  },

  confirmCashPayment: (id) => {
    return apiRequest(`/bookings/${id}/confirm-cash`, { method: 'POST' })
  },

  addExtraTime: (id, payload) => {
    return apiRequest(`/bookings/${id}/extra-time`, {
      method: 'POST',
      body: payload,
    })
  },

  cancelBooking: (id, payload) => {
    return apiRequest(`/bookings/${id}/cancel`, {
      method: 'POST',
      body: payload,
    })
  },

  rescheduleBooking: (id, payload) => {
    return apiRequest(`/bookings/${id}/reschedule`, {
      method: 'POST',
      body: payload,
    })
  },

  getCancellationEligibility: (id) => {
    return apiRequest(`/bookings/${id}/cancel-eligibility`, {
      method: 'GET',
    })
  },

  cancelBookingItem: (id, itemId, payload) => {
    return apiRequest(`/bookings/${id}/items/${itemId}/cancel`, {
      method: 'POST',
      body: payload,
    })
  },
}
