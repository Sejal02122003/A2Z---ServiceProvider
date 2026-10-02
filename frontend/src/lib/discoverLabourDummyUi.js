/** Deterministic pseudo-random 0..max-1 from string (for stable demo UI per worker). */
export function hashSeed(str, max) {
  let h = 0
  for (let i = 0; i < str.length; i += 1) {
    h = (h << 5) - h + str.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h) % max
}

const EXPERIENCE_OPTS = ['2+ yrs', '3+ yrs', '4+ yrs', '5+ yrs', '6+ yrs', '8+ yrs']
const HOURS_OPTS = ['8 hr shifts', '9 hr shifts', '10 hr shifts', 'Day wage · flexible', 'Half-day available']
const RESPONSE_OPTS = ['Usually within 2 hrs', 'Usually same day', 'Often within 30 min']

/**
 * Avatar image URL (illustration-style, no account required).
 * @param {string} seed
 */
export function discoverLabourAvatarUrl(seed) {
  const s = encodeURIComponent(seed.slice(0, 48))
  return `https://api.dicebear.com/7.x/avataaars/svg?seed=${s}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf`
}

/**
 * @param {{ id: string, displayName?: string }} labour
 * @returns {{
 *   photoUrl: string,
 *   rating: number,
 *   ratingCount: number,
 *   experienceLabel: string,
 *   workHoursLabel: string,
 *   responseLabel: string,
 *   jobsCompleted: number,
 *   hireScore: number,
 * }}
 */
export function enrichDiscoverLabourUi(labour) {
  const seed = `${labour.id}:${labour.displayName || 'w'}`
  const r = 4.2 + (hashSeed(seed, 80) / 100) * 0.7
  const rating = Math.round(r * 10) / 10
  return {
    photoUrl: discoverLabourAvatarUrl(seed),
    rating,
    ratingCount: 12 + hashSeed(seed + 'c', 180),
    experienceLabel: EXPERIENCE_OPTS[hashSeed(seed + 'e', EXPERIENCE_OPTS.length)],
    workHoursLabel: HOURS_OPTS[hashSeed(seed + 'h', HOURS_OPTS.length)],
    responseLabel: RESPONSE_OPTS[hashSeed(seed + 'r', RESPONSE_OPTS.length)],
    jobsCompleted: 8 + hashSeed(seed + 'j', 90),
    hireScore: 78 + hashSeed(seed + 's', 20),
  }
}

/** Synthetic demo row when API returns no workers (UI preview). */
export function createDemoLabour(index) {
  const names = ['Ramesh K.', 'Priya S.', 'Vikram S.', 'Ananya M.', 'Deepak R.', 'Pooja T.']
  const id = `demo-${index}`
  const displayName = names[index % names.length]
  const catIdx = index % 4
  const tradeMap = [
    [
      { _id: `d${index}-1`, name: "Women's Salon & Spa Expert", subtitle: 'Hair, beauty & facial therapies', groupName: 'Salon' },
      { _id: `d${index}-2`, name: "Bridal Makeup & Skincare", subtitle: 'HD makeover & spa treatments', groupName: 'Salon' },
    ],
    [
      { _id: `d${index}-1`, name: 'AC & Cooling Technician', subtitle: 'Deep jet cleaning & gas refill', groupName: 'Home Appliances' },
      { _id: `d${index}-2`, name: 'Washing Machine & RO Expert', subtitle: 'Motor & filter replacement', groupName: 'Home Appliances' },
    ],
    [
      { _id: `d${index}-1`, name: 'Certified Home Nurse', subtitle: 'Injections, IV drips & post-op care', groupName: 'Caretaker & Nurse' },
      { _id: `d${index}-2`, name: 'Elderly & Patient Attendant', subtitle: 'Mobility, vitals & daily care', groupName: 'Caretaker & Nurse' },
    ],
    [
      { _id: `d${index}-1`, name: 'Emergency Plumber & Electrician', subtitle: 'Fast pipe leaks, wiring & switches', groupName: 'Services On Demand' },
      { _id: `d${index}-2`, name: 'Deep Cleaning & Pest Specialist', subtitle: 'Bathroom, kitchen & sanitization', groupName: 'Services On Demand' },
    ],
  ]
  const base = {
    id,
    displayName,
    kycVerified: index % 3 !== 1,
    kycStatus: index % 3 === 1 ? 'pending' : 'verified',
    tradeCategories: tradeMap[catIdx],
    memberSinceYear: 2021 + (index % 4),
  }
  return base
}

export const DEMO_LABOUR_ROWS = [0, 1, 2, 3, 4].map((i) => {
  const row = createDemoLabour(i)
  return { ...row, _ui: enrichDiscoverLabourUi(row) }
})
