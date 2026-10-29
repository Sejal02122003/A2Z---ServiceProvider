import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, Briefcase, ChevronRight, HardHat, ShieldAlert } from 'lucide-react'

export function LabourJobsHero({ offersCount, activeCount, kycOk }) {
  const reduce = useReducedMotion()

  return (
    <section className="relative -mx-4 px-4 pb-1">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42 }}
        className="relative overflow-hidden rounded-[1.65rem] border border-white/15 bg-linear-to-br from-slate-900 via-slate-800 to-slate-950 text-white shadow-[0_22px_48px_-20px_rgba(0,0,0,0.55)]"
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[url('https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=800&q=60')] bg-cover bg-center opacity-22"
          aria-hidden
        />
        <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-slate-950/90 via-slate-900/80 to-brand/25" aria-hidden />
        <motion.div
          className="pointer-events-none absolute -left-8 bottom-0 h-32 w-32 rounded-full bg-brand/25 blur-3xl"
          animate={reduce ? undefined : { opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 5, repeat: Infinity }}
          aria-hidden
        />

        <div className="relative p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <Link
              to="/serviceprovider"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/10 text-white backdrop-blur-sm transition hover:bg-white/20"
              aria-label="Back to home"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden />
            </Link>
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/12 ring-1 ring-white/25 backdrop-blur-sm">
              <HardHat className="h-6 w-6" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/60">My work</p>
              <h1 className="mt-0.5 text-xl font-extrabold tracking-tight sm:text-[1.35rem]">Jobs & sites</h1>
              <p className="mt-1.5 text-xs leading-relaxed text-white/75">
                Accept assignments, check in on site, and track completed shifts.
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-2xl border border-white/15 bg-white/8 px-3 py-2.5 backdrop-blur-sm">
              <p className="text-[9px] font-bold uppercase tracking-wider text-amber-200/90">Open offers</p>
              <p className="mt-0.5 font-mono text-2xl font-black tabular-nums">{offersCount}</p>
            </div>
            <div className="rounded-2xl border border-blue-400/30 bg-blue-600/15 px-3 py-2.5 backdrop-blur-sm">
              <p className="text-[9px] font-bold uppercase tracking-wider text-blue-100/90">On site now</p>
              <p className="mt-0.5 font-mono text-2xl font-black tabular-nums">{activeCount}</p>
            </div>
          </div>

          {!kycOk ? (
            <Link
              to="/serviceprovider/kyc"
              className="mt-3 flex items-center justify-between gap-2 rounded-2xl border border-amber-300/40 bg-amber-500/20 px-3 py-2.5 text-xs font-bold text-amber-50 transition hover:bg-amber-500/28"
            >
              <span className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden />
                Complete KYC to accept jobs
              </span>
              <ChevronRight className="h-4 w-4 opacity-80" aria-hidden />
            </Link>
          ) : (
            <p className="mt-3 flex items-center gap-1.5 text-[10px] font-semibold text-blue-100/90">
              <Briefcase className="h-3.5 w-3.5" aria-hidden />
              Verified — you can accept new assignments
            </p>
          )}
        </div>
      </motion.div>
    </section>
  )
}
