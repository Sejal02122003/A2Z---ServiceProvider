import { apiRequest } from './http.js'

/**
 * Fetch full 5-step registration onboarding status for the logged-in service partner
 */
export async function fetchPartnerOnboardingStatus() {
  const json = await apiRequest('/users/me/onboarding-status')
  return json.data
}

/**
 * Fetch latest trial slots and hub address configured by the Admin
 */
export async function fetchAvailableTrialSlots() {
  const json = await apiRequest(`/users/trial-slots?_t=${Date.now()}`, { skipAuth: true })
  return json.data
}

/**
 * Submit Partner Application (Category, services & service experience)
 * @param {{ services: Array<{ serviceId: string, subcategoryId?: string }>, experienceYears: number }} payload
 */
export async function submitPartnerApplication(payload) {
  // Update categories and services
  const catBody = {}
  if (Array.isArray(payload.services)) catBody.services = payload.services
  if (Array.isArray(payload.categoryIds)) catBody.categoryIds = payload.categoryIds
  if (Array.isArray(payload.subcategoryIds)) catBody.subcategoryIds = payload.subcategoryIds

  if (catBody.services?.length || catBody.categoryIds?.length || catBody.subcategoryIds?.length) {
    await apiRequest('/users/me/labour-categories', {
      method: 'PATCH',
      body: catBody,
    })
  }

  // Update experience years
  if (payload.experienceYears !== undefined && payload.experienceYears !== null) {
    await apiRequest('/users/me', {
      method: 'PATCH',
      body: {
        labourProfile: {
          experienceYears: Number(payload.experienceYears),
        },
      },
    })
  }

  return fetchPartnerOnboardingStatus()
}

/**
 * Schedule Trial Slot (date, time, location)
 * @param {{ date: string, timeSlot: string, location?: string, notes?: string }} payload
 */
export async function schedulePartnerTrialSlot(payload) {
  const json = await apiRequest('/users/me/trial-slot', {
    method: 'PATCH',
    body: payload,
  })
  return json.data
}

/**
 * Complete Partner Trial evaluation (marks passed / joining confirmed)
 */
export async function completePartnerTrial(notes) {
  const json = await apiRequest('/users/me/trial-complete', {
    method: 'POST',
    body: { notes },
  })
  return json.data
}

/**
 * Submit Welcome Kit Payment (Online / Offline with bill upload)
 * @param {{
 *   paymentMethod: 'ONLINE' | 'OFFLINE',
 *   paymentReceiptUrl?: string,
 *   paymentNotes?: string,
 *   deliveryAddress?: string,
 *   deliveryCity?: string,
 *   deliveryPincode?: string
 * }} payload
 */
export async function submitWelcomeKitPayment(payload) {
  const json = await apiRequest('/users/me/welcome-kit/payment', {
    method: 'POST',
    body: payload,
  })
  return json.data
}

/**
 * Confirm Partner Welcome Kit delivery / receipt
 */
export async function confirmWelcomeKitReceipt() {
  const json = await apiRequest('/users/me/welcome-kit/confirm-receipt', {
    method: 'POST',
  })
  return json.data
}
