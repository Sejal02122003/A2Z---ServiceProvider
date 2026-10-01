import { motion } from 'framer-motion'
import { Apple, QrCode, Smartphone } from 'lucide-react'
import { Container } from '../ui/Container'
import { Reveal } from '../ui/Reveal'
import { SectionHeading } from '../ui/SectionHeading'
import { ButtonLink } from '../ui/ButtonLink'

function PhoneMock({ label, accent }) {
  return (
    <motion.div
      className="relative mx-auto w-[9.5rem] shrink-0 sm:w-[11rem]"
      whileHover={{ y: -6 }}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
    >
      <div
        className={`rounded-[2rem] border border-slate-700 bg-slate-900 p-2 shadow-[0_24px_60px_-20px_rgba(0,43,92,0.2)] ring-1 ring-black/5`}
      >
        <div className="overflow-hidden rounded-[1.6rem] bg-gradient-to-b from-zinc-900 to-black">
          <div className="flex items-center justify-between px-4 pb-2 pt-4 text-[10px] text-zinc-500">
            <span>9:41</span>
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[9px] text-brand-bright">
              LTE
            </span>
          </div>
          <div className={`mx-4 mb-3 h-24 rounded-2xl bg-gradient-to-br ${accent} opacity-90`} />
          <div className="space-y-2 px-4 pb-5">
            <div className="h-2.5 w-2/3 rounded-full bg-zinc-800" />
            <div className="h-2 w-full rounded-full bg-zinc-800/80" />
            <div className="h-2 w-5/6 rounded-full bg-zinc-800/60" />
            <div className="mt-3 h-9 rounded-xl bg-brand/90" />
          </div>
        </div>
      </div>
      <p className="mt-3 text-center text-xs font-semibold text-zinc-600">{label}</p>
    </motion.div>
  )
}

export function AppPromoSection() {
  return (
    <section id="app" className="bg-white py-20 text-zinc-900" aria-labelledby="app-heading">
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <SectionHeading
              titleId="app-heading"
              eyebrow="Mobile apps"
              title="Carry A2Z in your pocket"
              subtitle="Book crews on-site, approve attendance, and help labour partners get paid faster—with notifications tuned for noisy, dusty environments."
            />
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <ButtonLink
                href="#cta"
                variant="primary"
                className="!inline-flex !items-center !gap-2"
              >
                <Smartphone className="h-4 w-4" aria-hidden />
                Get Android app
              </ButtonLink>
              <ButtonLink
                href="#cta"
                variant="ghost"
                className="!inline-flex !items-center !gap-2 !border !border-zinc-200"
              >
                <Apple className="h-4 w-4" aria-hidden />
                Get iOS app
              </ButtonLink>
            </div>
            <Reveal className="mt-8 flex flex-wrap items-center gap-6">
              <div className="flex h-28 w-28 flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 text-zinc-500">
                <QrCode className="h-10 w-10" strokeWidth={1.5} aria-hidden />
                <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider">
                  Scan to download
                </span>
              </div>
              <p className="max-w-xs text-sm text-zinc-600">
                QR links to the store listing—swap with your final campaign URL or deep link when you
                ship to production.
              </p>
            </Reveal>
          </div>

          <Reveal>
            <div className="relative overflow-hidden rounded-[2rem] border border-slate-200/90 bg-gradient-to-br from-white via-slate-50/90 to-white p-8 shadow-[0_30px_80px_-40px_rgba(15,23,42,0.08)]">
              <div className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-brand/20 blur-3xl" />
              <div className="flex flex-wrap items-end justify-center gap-6">
                <PhoneMock label="Hirer app" accent="from-brand-bright to-brand" />
                <PhoneMock label="Labour app" accent="from-surface-800 to-surface-950" />
              </div>
            </div>
          </Reveal>
        </div>
      </Container>
    </section>
  )
}
