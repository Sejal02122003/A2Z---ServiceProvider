import { motion, useReducedMotion } from 'framer-motion'
import { features } from '../../data/landingContent'
import { LandingIcon } from '../../lib/iconMap'
import { Container } from '../ui/Container'
import { Reveal } from '../ui/Reveal'
import { SectionHeading } from '../ui/SectionHeading'

export function FeaturesSection() {
  const reduce = useReducedMotion()

  return (
    <section
      id="features"
      className="relative overflow-hidden border-b border-slate-200/80 bg-white py-20"
      aria-labelledby="features-heading"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_20%_0%,rgba(0,43,92,0.1),transparent)]" />
      <Container className="relative">
        <SectionHeading
          titleId="features-heading"
          eyebrow="Why A2Z"
          title="Trust, speed, and clarity—by design"
          subtitle="We built verification, tracking, and payments into the core flow so contractors can focus on execution—not chasing people."
          align="center"
        />

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {features.map((f, i) => (
            <Reveal key={f.title} delay={i * 0.03}>
              <motion.article
                className="h-full rounded-3xl border border-slate-200/90 bg-white p-5 shadow-sm"
                whileHover={
                  reduce ? undefined : { y: -4, borderColor: 'rgba(0,43,92,0.35)' }
                }
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/12 text-brand ring-1 ring-brand/20">
                  <LandingIcon name={f.icon} className="h-5 w-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.description}</p>
              </motion.article>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  )
}
