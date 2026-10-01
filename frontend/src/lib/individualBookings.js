/** @typedef {'instant' | 'scheduled'} IndividualBookingType */
/** @typedef {'pending_review' | 'confirmed' | 'assigned' | 'in_progress' | 'completed' | 'cancelled' | 'searching' | 'accepted'} IndividualBookingStatus */
/** @typedef {'advance' | 'after_assignment' | 'after_work'} IndividualPaymentPreference */
/** @typedef {'manual' | 'smart'} BookingMatchMode */
/** @typedef {'few_hours' | 'full_day' | 'multi_day'} BookingDurationKind */

export const BOOKING_JOB_TIMELINE = [
  { id: 'sent', label: 'Request sent' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'en_route', label: 'On the way' },
  { id: 'started', label: 'Started work' },
  { id: 'completed', label: 'Completed' },
]

export const PAYMENT_METHODS = [
  { id: 'cash', label: 'Cash' },
  { id: 'upi', label: 'UPI' },
  { id: 'wallet', label: 'Wallet' },
  { id: 'card', label: 'Card' },
]

export const INDIVIDUAL_BOOKING_STORAGE_KEY = 'lc_homeowner_bookings_v1'

export const INDIVIDUAL_BOOKING_WORKFLOW = [
  { id: 'submitted', label: 'Request raised', short: 'Submitted' },
  { id: 'review', label: 'Admin review', short: 'Review' },
  { id: 'assigned', label: 'Labour assigned', short: 'Assigned' },
  { id: 'work', label: 'Work on site', short: 'On site' },
  { id: 'payment', label: 'Payment processed', short: 'Payment' },
]

/** Demo rows when storage is empty (shows full status journey in history). */
export const DEMO_INDIVIDUAL_BOOKINGS = [
  {
    id: 'demo-1',
    ref: 'BK-M9K2J4',
    createdAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    bookingType: 'instant',
    serviceDate: null,
    durationDays: 1,
    address: 'Sector 18, Noida — near metro gate 2',
    lat: null,
    lng: null,
    notes: '',
    lines: [
      { groupName: 'Salon', categoryName: "Women's Salon & Spa", quantity: 1 },
      { groupName: 'Salon', categoryName: 'Facial & Cleanup', quantity: 1 },
    ],
    status: 'assigned',
    paymentPreference: 'advance',
    estimatedTotal: 1298,
    advanceAmount: 260,
    currency: 'INR',
  },
  {
    id: 'demo-2',
    ref: 'BK-M9K1ZQ',
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    bookingType: 'scheduled',
    serviceDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    durationDays: 1,
    address: 'Indirapuram, Ghaziabad',
    lat: null,
    lng: null,
    notes: 'Weekend morning slot',
    lines: [{ groupName: 'Home Appliances', categoryName: 'AC Jet Pump Deep Cleaning', quantity: 1 }],
    status: 'pending_review',
    paymentPreference: 'after_assignment',
    estimatedTotal: 499,
    advanceAmount: 0,
    currency: 'INR',
  },
  {
    id: 'demo-3',
    ref: 'BK-M8XY12',
    createdAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
    bookingType: 'scheduled',
    serviceDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
    durationDays: 1,
    address: 'Rohini Sector 24, Delhi',
    lat: null,
    lng: null,
    notes: '',
    lines: [
      { groupName: 'Home Appliances', categoryName: 'Washing Machine Servicing & Descaling', quantity: 1 },
      { groupName: 'Salon', categoryName: "Men's Haircut & Styling", quantity: 1 },
    ],
    status: 'completed',
    paymentPreference: 'advance',
    estimatedTotal: 548,
    advanceAmount: 110,
    currency: 'INR',
  },
]

const RATE_PER_WORKER_DAY = 800

export function loadIndividualBookings() {
  try {
    const raw = localStorage.getItem(INDIVIDUAL_BOOKING_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveIndividualBookings(items) {
  localStorage.setItem(INDIVIDUAL_BOOKING_STORAGE_KEY, JSON.stringify(items))
}

export function todayISODate() {
  const d = new Date()
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function maxISODate(days = 5) {
  const d = new Date()
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function generateBookingRef() {
  return `BK-${Date.now().toString(36).toUpperCase()}`
}

/**
 * @param {{ lines: { quantity: number }[], durationDays: number }} input
 */
export function estimateIndividualBooking(input) {
  const durationDays = Math.max(1, Number(input.durationDays) || 1)
  const workerDays = (input.lines || []).reduce((sum, ln) => sum + Math.max(1, Number(ln.quantity) || 1), 0)
  const totalWorkerDays = workerDays * durationDays
  const estimatedTotal = totalWorkerDays * RATE_PER_WORKER_DAY
  const platformFee = Math.round(estimatedTotal * 0.05)
  const gst = Math.round((estimatedTotal + platformFee) * 0.18)
  const grandTotal = estimatedTotal + platformFee + gst
  const advanceAmount = Math.round(grandTotal * 0.2)
  return {
    workerDays: totalWorkerDays,
    ratePerWorkerDay: RATE_PER_WORKER_DAY,
    estimatedSubtotal: estimatedTotal,
    platformFee,
    gst,
    grandTotal,
    advanceAmount,
    currency: 'INR',
  }
}

export function formatInr(amount) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Math.round(amount || 0))
}

/**
 * Format a duration (in hours) as a human-readable string.
 * Supports fractional hours: 0.5 → "30 Minutes", 1 → "1 Hour", etc.
 * @param {number} hours
 */
export function formatDuration(hours) {
  const h = parseFloat(hours) || 0
  if (h === 0.5) return '30 Minutes'
  return `${h} ${h === 1 ? 'Hour' : 'Hours'}`
}

export function bookingStatusToUi(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'pending_review') {
    return { label: 'Pending review', variant: 'amber', tone: 'bg-amber-50 text-amber-900 ring-amber-200/80' }
  }
  if (s === 'confirmed') {
    return { label: 'Confirmed', variant: 'emerald', tone: 'bg-blue-50 text-blue-900 ring-blue-200/80' }
  }
  if (s === 'assigned') {
    return { label: 'Workers assigned', variant: 'sky', tone: 'bg-sky-50 text-sky-900 ring-sky-200/80' }
  }
  if (s === 'in_progress') {
    return { label: 'Work in progress', variant: 'brand', tone: 'bg-brand/10 text-brand ring-brand/25' }
  }
  if (s === 'searching') {
    return { label: 'Finding labour', variant: 'sky', tone: 'bg-sky-50 text-sky-900 ring-sky-200/80' }
  }
  if (s === 'accepted') {
    return { label: 'Worker accepted', variant: 'emerald', tone: 'bg-blue-50 text-blue-900 ring-blue-200/80' }
  }
  if (s === 'cancelled') {
    return { label: 'Cancelled', variant: 'rose', tone: 'bg-rose-50 text-rose-900 ring-rose-200/80' }
  }
  if (s === 'completed') {
    return { label: 'Completed', variant: 'slate', tone: 'bg-slate-50 text-slate-700 ring-slate-200/80' }
  }
  return { label: 'In progress', variant: 'slate', tone: 'bg-slate-50 text-slate-700 ring-slate-200/80' }
}

/** Active step index 0..4 for workflow timeline. */
export function bookingWorkflowStepIndex(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'pending_review') return 1
  if (s === 'confirmed') return 1
  if (s === 'assigned') return 2
  if (s === 'in_progress') return 3
  if (s === 'completed') return 4
  if (s === 'cancelled') return 1
  return 0
}

export function formatBookingSchedule(booking) {
  if (booking.bookingType === 'instant') return 'Instant · as soon as matched'
  if (booking.serviceDate) {
    const d = new Date(booking.serviceDate)
    if (!Number.isNaN(d.getTime())) {
      return `Scheduled · ${d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`
    }
  }
  return 'Scheduled'
}

export function totalWorkersFromLines(lines) {
  return (lines || []).reduce((sum, ln) => sum + Math.max(1, Number(ln.quantity) || 1), 0)
}

/**
 * @param {object} source
 * @returns {object} draft fields for rebook
 */
export function rebookDraftFromRecord(source) {
  if (!source) return null
  return {
    bookingType: source.bookingType === 'scheduled' ? 'scheduled' : 'instant',
    serviceDate: source.serviceDate || '',
    durationDays: source.durationDays || 1,
    address: source.address || '',
    lat: source.lat ?? null,
    lng: source.lng ?? null,
    notes: source.notes || '',
    lines: (source.lines || []).map((ln) => ({
      rowId: crypto.randomUUID(),
      groupId: ln.groupId || '',
      categoryId: ln.categoryId || '',
      quantity: ln.quantity || 1,
      groupName: ln.groupName,
      categoryName: ln.categoryName,
    })),
    paymentPreference: source.paymentPreference || 'after_assignment',
  }
}

/**
 * @param {object} payload
 */
export function durationKindToDays(kind, fallback = 1) {
  if (kind === 'full_day') return 1
  if (kind === 'multi_day') return Math.max(2, Number(fallback) || 2)
  return 0
}

export function durationKindLabel(kind) {
  if (kind === 'full_day') return 'Full day'
  if (kind === 'multi_day') return 'Multi day'
  return 'Few hours'
}

/**
 * @param {object} payload
 */
export function createIndividualBookingRecord(payload) {
  const durationDays = Math.max(
    1,
    Number(payload.durationDays) || durationKindToDays(payload.durationKind, 1),
  )
  const estimate = estimateIndividualBooking({
    lines: payload.lines,
    durationDays,
  })
  let paymentPreference = 'after_assignment'
  if (payload.paymentPreference === 'advance') paymentPreference = 'advance'
  if (payload.paymentTiming === 'after_work' || payload.paymentPreference === 'after_work') {
    paymentPreference = 'after_work'
  }
  const advanceAmount = paymentPreference === 'advance' ? estimate.advanceAmount : 0
  const matchMode = payload.matchMode === 'smart' ? 'smart' : 'manual'
  const initialStatus = matchMode === 'smart' ? 'searching' : 'pending_review'

  return {
    id: crypto.randomUUID(),
    ref: generateBookingRef(),
    createdAt: new Date().toISOString(),
    bookingType: payload.bookingType,
    serviceDate: payload.bookingType === 'scheduled' ? payload.serviceDate : null,
    timeSlot: payload.timeSlot?.trim() || '',
    durationKind: payload.durationKind || 'few_hours',
    durationDays,
    address: payload.address.trim(),
    lat: payload.lat ?? null,
    lng: payload.lng ?? null,
    notes: payload.notes?.trim() || '',
    imageNames: Array.isArray(payload.imageNames) ? payload.imageNames : [],
    lines: payload.lines,
    matchMode,
    selectedWorkers: Array.isArray(payload.selectedWorkers) ? payload.selectedWorkers : [],
    assignedWorker: payload.assignedWorker || null,
    jobTimelineStep: matchMode === 'smart' ? 'sent' : 'sent',
    status: initialStatus,
    paymentPreference,
    paymentMethod: payload.paymentMethod || null,
    paymentTiming: payload.paymentTiming || 'after_work',
    estimatedTotal: estimate.grandTotal,
    estimatedSubtotal: estimate.estimatedSubtotal,
    advanceAmount,
    platformFee: estimate.platformFee,
    gst: estimate.gst,
    currency: 'INR',
    etaMinutes: payload.etaMinutes ?? null,
  }
}

/**
 * Build booking lines + payload from flow draft.
 * @param {object} draft
 */
export function bookingPayloadFromDraft(draft) {
  const qty = Math.max(1, (draft.selectedWorkers || []).length || 1)
  const lines = [
    {
      categoryId: draft.categoryId,
      categoryName: draft.categoryName,
      groupName: draft.groupName,
      quantity: draft.matchMode === 'manual' ? qty : 1,
    },
  ]
  return {
    bookingType: draft.bookingType,
    serviceDate: draft.serviceDate,
    timeSlot: draft.timeSlot,
    durationKind: draft.durationKind,
    durationDays: draft.durationDays,
    address: draft.address,
    lat: draft.lat,
    lng: draft.lng,
    notes: draft.notes,
    imageNames: draft.imageNames,
    lines,
    matchMode: draft.matchMode,
    selectedWorkers: draft.selectedWorkers,
    paymentTiming: draft.paymentTiming,
    paymentMethod: draft.paymentMethod,
    paymentPreference: draft.paymentTiming === 'pay_now' ? 'advance' : 'after_work',
    assignedWorker: draft.matchMode === 'smart' ? draft.assignedWorker : (draft.selectedWorkers || [])[0] || null,
    etaMinutes: 18 + Math.floor(Math.random() * 12),
  }
}

export function findBookingByRef(bookings, ref) {
  const r = String(ref || '').trim()
  if (!r) return null
  return bookings.find((b) => b.ref === r) ?? null
}

export function displayBookingsList(stored) {
  return stored.length > 0 ? stored : DEMO_INDIVIDUAL_BOOKINGS
}

export function isDemoBooking(booking) {
  return String(booking?.id || '').startsWith('demo-')
}
