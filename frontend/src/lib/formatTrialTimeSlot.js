/**
 * Extracts and formats clean, human-readable trial slot timing from potentially composite slot strings.
 * e.g. "04:00 PM - 06:00 PM_6ace5ec90c3527d0fda3837c_2026-10-24_1792660945476" -> "04:00 PM - 06:00 PM"
 *
 * @param {string} timeSlot
 * @returns {string}
 */
export function formatTrialTimeSlot(timeSlot) {
  if (!timeSlot || typeof timeSlot !== 'string') return ''
  const trimmed = timeSlot.trim()
  if (trimmed.includes('_')) {
    const cleanTiming = trimmed.split('_')[0].trim()
    if (cleanTiming) return cleanTiming
  }
  return trimmed
}
