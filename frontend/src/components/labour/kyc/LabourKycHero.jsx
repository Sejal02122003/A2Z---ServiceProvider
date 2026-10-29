import { Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, Fingerprint, ShieldCheck } from 'lucide-react'

const TONE_BADGE = {
  emerald: 'bg-blue-600/25 text-blue-100 ring-blue-400/40',
  sky: 'bg-sky-500/25 text-sky-100 ring-sky-400/40',
  rose: 'bg-rose-500/25 text-rose-100 ring-rose-400/40',
  violet: 'bg-violet-500/25 text-violet-100 ring-violet-400/40',
}

const TONE_GRADIENT = {
  emerald: 'from-blue-900 via-slate-900 to-slate-950',
  sky: 'from-sky-900 via-slate-900 to-slate-950',
  rose: 'from-rose-900 via-slate-900 to-slate-950',
  violet: 'from-violet-900 via-slate-900 to-slate-950',
}

export function LabourKycHero({ title, subtitle, phaseLabel, tone = 'violet', maskedAadhaar, maskedPan }) {
  const reduce = useReducedMotion()
  const badgeClass = TONE_BADGE[tone] || TONE_BADGE.violet
  const gradient = TONE_GRADIENT[tone] || TONE_GRADIENT.violet

  return (
    <section className="relative -mx-4 px-4 pb-1">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className={`relative overflow-hidden rounded-[1.65rem] border border-white/15 bg-linear-to-br ${gradient} text-white shadow-[0_22px_48px_-20px_rgba(0,0,0,0.55)]`}
      >
        <div
          className="pointer-events-none absolute inset-0 bg-[url('https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=800&q=60')] bg-cover bg-center opacity-20"
          aria-hidden
        />
        <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-violet-950/88 via-slate-900/85 to-brand/10" aria-hidden />

        <div className="relative p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <Link
              to="/serviceprovider"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/10 backdrop-blur-sm transition hover:bg-white/20"
              aria-label="Back to home"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden />
            </Link>
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/20 ring-1 ring-violet-400/30">
              <Fingerprint className="h-5 w-5 text-violet-200" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/55">Identity</p>
              <h1 className="text-xl font-extrabold tracking-tight">Video KYC</h1>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ring-1 ${badgeClass}`}>
              {phaseLabel}
            </span>
          </div>

          <p className="mt-4 text-sm font-bold leading-snug text-white/95">{title}</p>
          <p className="mt-1 text-xs leading-relaxed text-white/70">{subtitle}</p>

          {maskedAadhaar || maskedPan ? (
            <div className="mt-3 space-y-1 font-mono text-sm font-black tabular-nums text-violet-200">
              {maskedAadhaar ? <p>Aadhaar {maskedAadhaar}</p> : null}
              {maskedPan ? <p>PAN {maskedPan}</p> : null}
            </div>
          ) : null}

          <div className="mt-4 flex items-center gap-2 rounded-2xl border border-white/15 bg-white/8 px-3 py-2.5">
            <ShieldCheck className="h-4 w-4 shrink-0 text-blue-300" aria-hidden />
            <p className="text-[11px] leading-relaxed text-white/75">
              Video KYC is reviewed by admin only. Your Aadhaar and PAN stay masked outside review.
            </p>
          </div>
        </div>
      </motion.div>
    </section>
  )
}
