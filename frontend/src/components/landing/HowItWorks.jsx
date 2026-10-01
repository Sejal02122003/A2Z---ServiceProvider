import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { howItWorksLabourers, howItWorksUsers } from '../../data/landingContent'
import { LandingIcon } from '../../lib/iconMap'
import { Container } from '../ui/Container'
import { Reveal } from '../ui/Reveal'
import { SectionHeading } from '../ui/SectionHeading'

const tabs = [
  { id: 'users', label: 'For hirers', data: howItWorksUsers },
  { id: 'labour', label: 'For labour partners', data: howItWorksLabourers },
]

export function HowItWorks() {
  const [tab, setTab] = useState('users')
  const reduce = useReducedMotion()
  const active = tabs.find((t) => t.id === tab) ?? tabs[0]

  return (
    <section
      id="how-it-works"
      className="relative border-y border-slate-200/80 bg-white py-20"
      aria-labelledby="how-heading"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_40%_at_70%_0%,rgba(0,43,92,0.08),transparent)]" />
      <Container className="relative">
        <SectionHeading
          titleId="how-heading"
          eyebrow="How it works"
          title="From first tap to boots on your site"
          subtitle="Whether you need emergency appliance repair or want to offer your professional salon services, A2Z keeps the journey simple and documented."
          align="center"
        />

        <Reveal className="mx-auto mb-10 flex max-w-md rounded-2xl border border-slate-200 bg-slate-50/80 p-1 shadow-inner">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`relative flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                tab === t.id ? 'text-white' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab === t.id ? (
                <motion.span
                  layoutId="hitab"
                  className="absolute inset-0 rounded-xl bg-gradient-to-r from-brand-bright to-brand shadow-md shadow-brand/25"
                  transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                />
              ) : null}
              <span className="relative z-10">{t.label}</span>
            </button>
          ))}
        </Reveal>

        <div className="relative grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={tab}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="contents"
            >
              {active.data.map((step, i) => (
                <motion.article
                  key={step.step}
                  layout
                  initial={reduce ? false : { opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: reduce ? 0 : i * 0.06 }}
                  className="relative overflow-hidden rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm"
                >
                  <div className="mb-5 flex items-center justify-between">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/12 text-brand ring-1 ring-brand/20">
                      <LandingIcon name={step.icon} className="h-6 w-6" />
                    </span>
                    <span className="text-4xl font-black text-brand/15">0{step.step}</span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-600">{step.description}</p>
                  {i < active.data.length - 1 ? (
                    <div
                      className="pointer-events-none absolute -right-3 top-1/2 hidden h-px w-6 -translate-y-1/2 bg-gradient-to-r from-brand/40 to-transparent lg:block"
                      aria-hidden
                    />
                  ) : null}
                </motion.article>
              ))}
            </motion.div>
          </AnimatePresence>
        </div>
      </Container>
    </section>
  )
}
