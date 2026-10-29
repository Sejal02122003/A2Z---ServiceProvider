import { useState } from 'react'
import { Building2, CheckCircle2, ChevronDown, MapPin } from 'lucide-react'
import { GlassPanel } from '../../ui/GlassPanel.jsx'
import { AppEmptyState } from '../../app/AppEmptyState.jsx'
import { Link } from 'react-router-dom'

const DAY_CELL = {
  emerald: 'bg-blue-600 text-white',
  amber: 'bg-amber-400 text-amber-950',
  sky: 'bg-sky-400 text-white',
  brand: 'bg-brand text-white ring-2 ring-brand/40 ring-offset-1',
  rose: 'bg-slate-200 text-slate-500',
  slate: 'bg-slate-100 text-slate-400',
}

const KIND_BADGE = {
  active: 'bg-brand/15 text-brand',
  completed: 'bg-slate-100 text-slate-700',
  scheduled: 'bg-amber-100 text-amber-900',
  manual: 'bg-violet-100 text-violet-800',
}

export function LabourAttendanceProjectView({ bundles }) {
  const [openId, setOpenId] = useState(bundles[0]?.id ?? null)

  if (!bundles.length) {
    return (
      <div className="space-y-3">
        <AppEmptyState
          icon={Building2}
          title="No project attendance"
          subtitle="Accept a job on Jobs, then check in on Today with that project selected."
        />
        <p className="text-center">
          <Link to="/serviceprovider/jobs" className="text-sm font-bold text-brand underline-offset-4 hover:underline">
            View my jobs
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <p className="px-1 text-xs leading-relaxed text-slate-600">
        Each card is a <strong className="text-slate-900">project or assignment</strong> (e.g. 10-day deployment). Green
        dots = present · amber = half day · grey = absent or future.
      </p>
      {bundles.map((b) => {
        const open = openId === b.id
        const log = b.attendanceLog || []
        return (
          <GlassPanel key={b.id} className="overflow-hidden border-slate-200/90 p-0">
            <button
              type="button"
              onClick={() => setOpenId(open ? null : b.id)}
              className="w-full px-4 py-4 text-left"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-linear-to-br from-slate-700 to-slate-900 text-white">
                  <Building2 className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${KIND_BADGE[b.kind] || KIND_BADGE.manual}`}>
                      {b.kind === 'active' ? 'Active' : b.kind === 'completed' ? 'Completed' : b.kind === 'scheduled' ? 'Scheduled' : 'Tagged'}
                    </span>
                    {b.isMultiDay ? (
                      <span className="text-[10px] font-bold text-slate-500">
                        Day {b.dayIndex} of {b.durationDays}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm font-extrabold text-slate-900">{b.title}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                    <MapPin className="h-3 w-3 shrink-0 text-brand" aria-hidden />
                    <span className="truncate">{b.site}</span>
                  </p>
                </div>
                <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition ${open ? 'rotate-180' : ''}`} />
              </div>

              <div className="mt-3 flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <span
                    className="block h-full rounded-full bg-linear-to-r from-brand-bright to-brand transition-all"
                    style={{ width: `${b.progressPct}%` }}
                  />
                </div>
                <span className="text-[10px] font-bold text-slate-600">{b.workedDays}/{b.durationDays} days</span>
              </div>

              {log.length > 0 ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {log.map((day) => {
                    const tone = day.isFuture ? 'slate' : day.status?.tone || 'rose'
                    const label = day.dayLabel?.replace('Today', 'T').slice(0, 3) || day.day.slice(-2)
                    return (
                      <span
                        key={day.day}
                        title={`${day.dayLabel}: ${day.status?.label || '—'} · ${day.workTime}`}
                        className={`flex h-8 w-8 items-center justify-center rounded-lg text-[9px] font-black ${DAY_CELL[tone] || DAY_CELL.rose} ${day.isToday ? 'ring-2 ring-sky-400 ring-offset-1' : ''}`}
                      >
                        {label}
                      </span>
                    )
                  })}
                </div>
              ) : null}

              <p className="mt-2 text-xs font-semibold text-slate-600">
                Total on project: <span className="font-mono font-black text-slate-900">{b.totalWorkTime}</span>
              </p>
            </button>

            {open && log.length > 0 ? (
              <ul className="border-t border-slate-100 bg-slate-50/80 px-4 py-2">
                {log.map((day) => (
                  <li
                    key={day.day}
                    className={`flex items-center justify-between gap-2 border-b border-slate-100 py-2.5 last:border-0 ${day.isToday ? 'bg-brand/5 -mx-4 px-4' : ''}`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900">{day.dayLabel}</p>
                      {day.punches?.length > 0 ? (
                        <p className="text-[10px] text-slate-500">
                          {day.punches.map((p) => `${p.type === 'in' ? 'In' : 'Out'} ${p.time}`).join(' · ')}
                        </p>
                      ) : (
                        <p className="text-[10px] text-slate-400">No punches</p>
                      )}
                    </div>
                    <span className="text-[10px] font-bold uppercase text-slate-500">{day.status?.label}</span>
                    <span className="font-mono text-xs font-black text-slate-800">{day.workTime}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {open && b.kind === 'active' ? (
              <p className="flex items-center gap-1 border-t border-slate-100 px-4 py-2 text-[11px] text-brand">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                Check in on Today with this project selected
              </p>
            ) : null}
          </GlassPanel>
        )
      })}
    </div>
  )
}
