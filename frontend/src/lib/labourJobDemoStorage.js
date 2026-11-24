const STORAGE_KEY = 'lc-labour-jobs-demo-v1'
const EVENT = 'lc-labour-jobs-demo'
const LEGACY_SEED_DISABLED_KEY = 'lc-labour-jobs-seed-off'

function nowIso() {
  return new Date().toISOString()
}

function shiftDateLabel(daysFromNow) {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

function isoDateDaysFromToday(offset) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

export function getDefaultJobDemoState() {
  return {
    version: 1,
    // No seeded sample requests: job requests come from real bookings (location-based)
    offers: [],
    active: [],
    history: [],
  }
}

function readLegacyBuckets() {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || data.version !== 1) return null
    return {
      // drop any sample offers saved by older versions
      offers: Array.isArray(data.offers)
        ? data.offers.filter((o) => !String(o?.id || '').startsWith('demo-') && !String(o?.requestRef || '').startsWith('DEMO-'))
        : [],
      active: Array.isArray(data.active) ? data.active : [],
      history: Array.isArray(data.history) ? data.history : [],
    }
  } catch {
    return null
  }
}

export function loadJobDemoState() {
  const legacy = readLegacyBuckets()
  if (legacy) return { version: 1, ...legacy }
  if (typeof window !== 'undefined' && localStorage.getItem(LEGACY_SEED_DISABLED_KEY)) {
    return { version: 1, offers: [], active: [], history: [] }
  }
  return getDefaultJobDemoState()
}

export function saveJobDemoState(state) {
  if (typeof window === 'undefined') return
  localStorage.setItem(LEGACY_SEED_DISABLED_KEY, '1')
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: 1,
      offers: state.offers,
      active: state.active,
      history: state.history,
    }),
  )
  window.dispatchEvent(new CustomEvent(EVENT))
}

export function subscribeJobDemo(cb) {
  if (typeof window === 'undefined') return () => {}
  const fn = () => cb(loadJobDemoState())
  window.addEventListener(EVENT, fn)
  window.addEventListener('storage', fn)
  return () => {
    window.removeEventListener(EVENT, fn)
    window.removeEventListener('storage', fn)
  }
}

export function resetJobDemoToSeed() {
  if (typeof window === 'undefined') return getDefaultJobDemoState()
  localStorage.removeItem(LEGACY_SEED_DISABLED_KEY)
  localStorage.removeItem(STORAGE_KEY)
  const next = getDefaultJobDemoState()
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent(EVENT))
  return next
}

export { nowIso }

/** Map API assignment + request to job card shape */
export function assignmentToJobCard(assignment) {
  const req = assignment.requestId
  const loc = typeof req === 'object' ? req?.locationText : ''
  return {
    id: assignment._id,
    requestId: typeof req === 'object' ? req?._id : req,
    title: loc || 'Site assignment',
    site: loc || 'See job details',
    shiftWindow: 'As per admin schedule',
    rateLabel: 'Per shift',
    trade: 'Labour',
    sourceType: typeof req === 'object' ? req?.sourceType : 'customer',
    requestRef: typeof req === 'object' ? req?.reference : '',
    status: assignment.status,
  }
}

export function bucketsFromAssignments(assignments = []) {
  const offers = []
  const active = []
  const history = []
  for (const a of assignments) {
    const card = assignmentToJobCard(a)
    if (a.status === 'offered') offers.push(card)
    else if (a.status === 'accepted' || a.status === 'on_site') active.push(card)
    else if (a.status === 'completed') history.push(card)
  }
  return { offers, active, history }
}
