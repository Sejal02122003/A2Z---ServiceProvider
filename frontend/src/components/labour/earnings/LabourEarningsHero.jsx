import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, Wallet } from 'lucide-react'
import { formatInrFromPaise } from '../../../lib/labourEarningsFlow.js'

export function LabourEarningsHero({
  availableNetPaise,
  availableGrossPaise,
  pendingPaise,
  grossPaise,
  totalFeesPaidPaise = 0,
  fees,
}) {
  const reduce = useReducedMotion()

  return (
    <section className="relative -mx-4 px-4 pb-1">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-[1.65rem] border border-white/15 bg-linear-to-br from-blue-900 via-slate-900 to-slate-950 text-white shadow-[0_22px_48px_-20px_rgba(0,0,0,0.55)]"
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[url('https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=800&q=60')] bg-cover bg-center opacity-20"
          aria-hidden
        />
        <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-slate-950/85 via-slate-900/80 to-brand/20" aria-hidden />

        <div className="relative p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <Link
              to="/serviceprovider"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/10 backdrop-blur-sm transition hover:bg-white/20"
              aria-label="Back to home"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden />
            </Link>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600/20 ring-1 ring-blue-400/30">
              <Wallet className="h-5 w-5 text-blue-200" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/55">Payroll</p>
              <h1 className="text-xl font-extrabold tracking-tight">Earnings & withdraw</h1>
            </div>
          </div>

          <p className="mt-4 font-mono text-3xl font-black tabular-nums tracking-tight sm:text-4xl">
            {formatInrFromPaise(availableNetPaise)}
          </p>
          <p className="mt-1 text-xs text-white/70">
            Max net payout · gross balance {formatInrFromPaise(availableGrossPaise)}
          </p>


          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-amber-400/30 bg-amber-500/15 px-2 py-2.5 sm:px-3">
              <p className="text-[9px] font-bold uppercase tracking-wider text-amber-100/90">Pending</p>
              <p className="mt-0.5 font-mono text-base font-black tabular-nums sm:text-lg">
                {formatInrFromPaise(pendingPaise)}
              </p>
            </div>
            <div className="rounded-2xl border border-white/15 bg-white/8 px-2 py-2.5 sm:px-3">
              <p className="text-[9px] font-bold uppercase tracking-wider text-white/55">Earned</p>
              <p className="mt-0.5 font-mono text-base font-black tabular-nums sm:text-lg">
                {formatInrFromPaise(grossPaise)}
              </p>
            </div>
            <div className="rounded-2xl border border-rose-400/25 bg-rose-500/10 px-2 py-2.5 sm:px-3">
              <p className="text-[9px] font-bold uppercase tracking-wider text-rose-100/80">Fees paid</p>
              <p className="mt-0.5 font-mono text-base font-black tabular-nums sm:text-lg">
                {formatInrFromPaise(totalFeesPaidPaise)}
              </p>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  )
}
