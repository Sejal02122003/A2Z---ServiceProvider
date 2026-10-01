import { formatSecondsAsClock } from './formatDurationClock.js'

/** Match attendance punches to this assignment (by project title / site). */
export function projectLabelMatches(entryLabel, job) {
  const e = String(entryLabel || '')
    .trim()
    .toLowerCase()
  if (!e || e === 'unassigned') return false
  const candidates = [
    job?.title,
    job?.siteName,
    job?.location,
    job?.projectCode,
  ]
    .filter(Boolean)
    .map((s) => String(s).toLowerCase())
  return candidates.some((c) => c === e || c.includes(e) || e.includes(c))
}

function formatDayLabel(isoDay) {
  const d = new Date(`${isoDay}T12:00:00`)
  if (Number.isNaN(d.getTime())) return isoDay
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
}


function dayKey(d) {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
  return local.toISOString().split('T')[0]
}

function enumerateProjectDays(startIso, durationDays) {
  if (!startIso || !durationDays || durationDays < 1) return []
  const start = new Date(`${startIso}T12:00:00`)
  if (Number.isNaN(start.getTime())) return []
  const keys = []
  for (let i = 0; i < durationDays; i += 1) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    keys.push(dayKey(d))
  }
  return keys
}

/**
 * @param {Array<{ type: string, at: string, day: string, projectLabel?: string, workLabel?: string }>} entries
 * @param {ReturnType<import('./labourHomeHelpers.js').enrichJobForHome>} job
 */
export function buildAssignmentDetailSnapshot(entries, job, rawJob = null) {
  if (!job) return null

  const durationDays = Math.max(1, Number(job.projectDurationDays) || 1)
  const startIso = job.projectStartDate || new Date().toISOString().split('T')[0]
  const projectDays = enumerateProjectDays(startIso, durationDays)
  const endIso = projectDays[projectDays.length - 1] || startIso
  const todayIso = dayKey(new Date())
  
  let dayIndex = projectDays.indexOf(todayIso) + 1
  if (dayIndex === 0) {
    dayIndex = todayIso > endIso ? durationDays : 0
  }
  const workedDays = 0

  const timeline = []
  if (rawJob?.acceptedAt) {
    timeline.push({
      at: rawJob.acceptedAt,
      title: 'Assignment accepted',
      body: 'You joined this service on A2Z.',
    })
  }
  timeline.push({
    at: `${startIso}T08:00:00`,
    title: 'Project start date',
    body: `${durationDays}-day deployment · ${job.contractor || 'Contractor'}`,
  })
  timeline.sort((a, b) => new Date(b.at) - new Date(a.at))

  return {
    job,
    durationDays,
    startIso,
    endIso,
    endLabel: formatDayLabel(endIso),
    startLabel: formatDayLabel(startIso),
    dayIndex,
    daysRemaining: Math.max(0, durationDays - dayIndex),
    workedDays,
    totalWorkTime: formatSecondsAsClock(0),
    progressPct: Math.min(100, Math.round((workedDays / durationDays) * 100)),
    timeline,
    isMultiDay: durationDays > 1,
    rawNotes: job.notes,
    gateInstruction: job.gateInstruction,
    acceptedAt: rawJob?.acceptedAt,
  }
}
