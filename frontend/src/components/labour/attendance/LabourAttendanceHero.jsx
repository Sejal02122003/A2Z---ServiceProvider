import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, CalendarClock } from 'lucide-react'
import { formatSecondsAsClock } from '../../../lib/formatDurationClock.js'

export function LabourAttendanceHero({
  onSite,
  workedSecondsToday,
  weekPresentDays,
  weekTotalMinutes,
  activeProjectTitle,
}) {
  const reduce = useReducedMotion()

  return (
    <section className="relative -mx-4 px-4 pb-1">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-[1.65rem] border border-white/15 bg-linear-to-br from-sky-900 via-slate-900 to-slate-950 text-white shadow-[0_22px_48px_-20px_rgba(0,0,0,0.55)]"
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[url('https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&q=60')] bg-cover bg-center opacity-25"
          aria-hidden
        />
        <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-sky-950/90 via-slate-900/85 to-brand/15" aria-hidden />

        <div className="relative p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <Link
              to="/serviceprovider"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/10 backdrop-blur-sm transition hover:bg-white/20"
              aria-label="Back to home"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden />
            </Link>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-500/20 ring-1 ring-sky-400/30">
              <CalendarClock className="h-5 w-5 text-sky-200" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/55">Site time</p>
              <h1 className="text-xl font-extrabold tracking-tight">Attendance</h1>
            </div>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ${
                onSite
                  ? 'bg-blue-600/25 text-blue-100 ring-blue-400/40'
                  : 'bg-white/10 text-white/70 ring-white/20'
              }`}
            >
              {onSite ? 'On site' : 'Off site'}
            </span>
          </div>

          <p className="mt-4 font-mono text-3xl font-black tabular-nums tracking-tight sm:text-4xl">
            {formatSecondsAsClock(workedSecondsToday)}
          </p>
          <p className="mt-1 text-xs text-white/70">Working time today</p>

          {activeProjectTitle ? (
            <p className="mt-2 truncate text-xs font-semibold text-sky-200/90">Active: {activeProjectTitle}</p>
          ) : null}

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-white/15 bg-white/8 px-3 py-2.5">
              <p className="text-[9px] font-bold uppercase tracking-wider text-white/55">This week</p>
              <p className="mt-0.5 font-mono text-lg font-black tabular-nums">
                {formatSecondsAsClock(weekTotalMinutes * 60)}
              </p>
            </div>
            <div className="rounded-2xl border border-blue-400/30 bg-blue-600/15 px-3 py-2.5">
              <p className="text-[9px] font-bold uppercase tracking-wider text-blue-100/90">Days present</p>
              <p className="mt-0.5 font-mono text-lg font-black tabular-nums">{weekPresentDays}/7</p>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  )
}
