import { KYC_STATUS } from '../constants/userRoles.js'

import { offerDistanceKm } from './labourHomeHelpers.js'
import { loadJobDemoState } from './labourJobDemoStorage.js'
import { hasAppUserLocation, readAppUserLocation } from './appUserLocationStorage.js'

const READ_KEY = 'lc-labour-notifications-read-v1'
const EVENT = 'lc-labour-notifications'

/**
 * @typedef {'job_request' | 'kyc' | 'attendance' | 'earnings' | 'assignment' | 'profile' | 'system'} LabourNotificationKind
 * @typedef {{
 *   id: string
 *   kind: LabourNotificationKind
 *   category: 'jobs' | 'updates'
 *   title: string
 *   body: string
 *   createdAt: string
 *   priority: 'high' | 'normal' | 'low'
 *   actionable?: boolean
 *   offerId?: string
 *   href?: string
 *   ctaLabel?: string
 *   meta?: Record<string, string>
 * }} LabourNotification
 */

function loadReadState() {
  if (typeof window === 'undefined') return { readIds: [], dismissedIds: [] }
  try {
    const raw = localStorage.getItem(READ_KEY)
    if (!raw) return { readIds: [], dismissedIds: [] }
    const j = JSON.parse(raw)
    return {
      readIds: Array.isArray(j.readIds) ? j.readIds.map(String) : [],
      dismissedIds: Array.isArray(j.dismissedIds) ? j.dismissedIds.map(String) : [],
    }
  } catch {
    return { readIds: [], dismissedIds: [] }
  }
}

function saveReadState(state) {
  if (typeof window === 'undefined') return
  localStorage.setItem(READ_KEY, JSON.stringify(state))
  window.dispatchEvent(new CustomEvent(EVENT))
}

export function subscribeLabourNotifications(cb) {
  if (typeof window === 'undefined') return () => {}
  const fn = () => cb()
  window.addEventListener(EVENT, fn)
  window.addEventListener('lc-labour-jobs-demo', fn)
  window.addEventListener('lc-platform-workforce', fn)
  window.addEventListener('storage', fn)
  return () => {
    window.removeEventListener(EVENT, fn)
    window.removeEventListener('lc-labour-jobs-demo', fn)
    window.removeEventListener('lc-platform-workforce', fn)
    window.removeEventListener('storage', fn)
  }
}

export function markNotificationRead(id) {
  const state = loadReadState()
  if (!state.readIds.includes(id)) {
    state.readIds = [...state.readIds, id]
    saveReadState(state)
  }
}

export function markNotificationsRead(ids) {
  const state = loadReadState()
  const set = new Set(state.readIds)
  for (const id of ids) set.add(id)
  state.readIds = [...set]
  saveReadState(state)
}

export function dismissNotification(id) {
  const state = loadReadState()
  if (!state.dismissedIds.includes(id)) {
    state.dismissedIds = [...state.dismissedIds, id]
  }
  if (!state.readIds.includes(id)) {
    state.readIds = [...state.readIds, id]
  }
  saveReadState(state)
}

export function isNotificationUnread(id, state = loadReadState()) {
  return !state.readIds.includes(id) && !state.dismissedIds.includes(id)
}

/**
 * @param {object} user
 * @param {ReturnType<typeof loadJobDemoState>} [jobs]
 * @param {{ earnedPaise?: number, pendingPaise?: number }} [earnings]
 */
export function buildLabourNotifications(user, jobs = loadJobDemoState(), earnings = {}) {
  const state = loadReadState()
  const dismissed = new Set(state.dismissedIds)
  /** @type {LabourNotification[]} */
  const list = []
  const now = new Date().toISOString()

  const kyc = user?.labourProfile?.kycStatus
  const kycSubmitted = Boolean(user?.labourProfile?.kycSubmittedAt)

  for (const offer of jobs.offers || []) {
    list.push({
      id: `job:${offer.id}`,
      kind: 'job_request',
      category: 'jobs',
      title: offer.urgency === 'high' ? 'Priority job request' : 'New job request',
      body: `${offer.trade} · ${offer.site} · ${offer.rateLabel} · ~${offerDistanceKm(offer.id)} km away`,
      createdAt: now,
      priority: offer.urgency === 'high' ? 'high' : 'normal',
      actionable: true,
      offerId: offer.id,
      meta: {
        shift: offer.shiftWindow,
        supervisor: offer.supervisor,
        trade: offer.trade,
      },
    })
  }

  if (jobs.active?.length > 0 && !dismissed.has('assignment:active')) {
    const a = jobs.active[0]
    list.push({
      id: 'assignment:active',
      kind: 'assignment',
      category: 'updates',
      title: 'Active assignment',
      body: `You are on ${a.title || a.site}. Mark attendance daily for correct pay.`,
      createdAt: now,
      priority: 'normal',
      href: '/serviceprovider/jobs',
      ctaLabel: 'View assignment',
    })
  }

  if (kyc === KYC_STATUS.PENDING && !kycSubmitted && !dismissed.has('kyc:submit')) {
    list.push({
      id: 'kyc:submit',
      kind: 'kyc',
      category: 'updates',
      title: 'KYC pending',
      body: 'Upload Aadhaar details to unlock job accept and admin assignments.',
      createdAt: now,
      priority: 'high',
      href: '/serviceprovider/kyc',
      ctaLabel: 'Complete KYC',
    })
  } else if (kyc === KYC_STATUS.PENDING && kycSubmitted && !dismissed.has('kyc:review')) {
    list.push({
      id: 'kyc:review',
      kind: 'kyc',
      category: 'updates',
      title: 'KYC under review',
      body: 'Admin is verifying your documents. You will get job offers after approval.',
      createdAt: now,
      priority: 'normal',
      href: '/serviceprovider/kyc',
      ctaLabel: 'View status',
    })
  } else if (kyc === KYC_STATUS.FAILED && !dismissed.has('kyc:failed')) {
    list.push({
      id: 'kyc:failed',
      kind: 'kyc',
      category: 'updates',
      title: 'KYC needs correction',
      body: 'Fix your Aadhaar photos or details so you can accept new jobs.',
      createdAt: now,
      priority: 'high',
      href: '/serviceprovider/kyc',
      ctaLabel: 'Fix KYC',
    })
  } else if (kyc === KYC_STATUS.VERIFIED && !dismissed.has('kyc:verified')) {
    list.push({
      id: 'kyc:verified',
      kind: 'kyc',
      category: 'updates',
      title: 'KYC verified',
      body: 'You are cleared for assignments. Keep your work area and attendance up to date.',
      createdAt: now,
      priority: 'low',
      href: '/serviceprovider/profile',
      ctaLabel: 'View profile',
    })
  }

  if (!hasAppUserLocation(readAppUserLocation()) && !dismissed.has('profile:work-area')) {
    list.push({
      id: 'profile:work-area',
      kind: 'profile',
      category: 'updates',
      title: 'Set your work area',
      body: 'Add your location before check-in so supervisors know where you are working.',
      createdAt: now,
      priority: 'high',
      href: '/serviceprovider',
      ctaLabel: 'Set on home',
    })
  }


  const available = earnings.availablePaise ?? earnings.pendingPaise ?? 0
  if (available > 0 && !dismissed.has('earnings:pending')) {
    list.push({
      id: 'earnings:pending',
      kind: 'earnings',
      category: 'updates',
      title: 'Payment available',
      body: `You have ${available > 0 ? 'balance ready to withdraw' : 'earnings pending'} on this device.`,
      createdAt: now,
      priority: 'normal',
      href: '/serviceprovider/earnings',
      ctaLabel: 'View earnings',
    })
  }

  const priorityRank = { high: 0, normal: 1, low: 2 }
  const sorted = list
    .filter((n) => !dismissed.has(n.id))
    .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority])

  const withRead = sorted.map((n) => ({
    ...n,
    unread: isNotificationUnread(n.id, state),
  }))

  return {
    items: withRead,
    unreadCount: withRead.filter((n) => n.unread).length,
    jobCount: withRead.filter((n) => n.kind === 'job_request').length,
  }
}

export function countUnreadLabourNotifications(user, jobs, earnings) {
  return buildLabourNotifications(user, jobs, earnings).unreadCount
}
