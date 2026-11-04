import { apiRequest } from './http.js'

export const reviewsApi = {
  submitReview: (payload) => {
    return apiRequest('/reviews', {
      method: 'POST',
      body: payload,
    })
  },

  getBookingReview: (bookingId) => {
    return apiRequest(`/reviews/booking/${bookingId}`, { method: 'GET' })
  },

  getUserReviews: (userId) => {
    return apiRequest(`/reviews/user/${userId}`, { method: 'GET' })
  },
  
  getAllReviews: () => {
    return apiRequest('/reviews', { method: 'GET' })
  },
  
  deleteReview: (reviewId) => {
    return apiRequest(`/reviews/${reviewId}`, { method: 'DELETE' })
  },
}
