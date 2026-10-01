import { motion, useReducedMotion } from 'framer-motion'
import { userTypes } from '../../data/landingContent'
import { LandingIcon } from '../../lib/iconMap'
import { Container } from '../ui/Container'
import { Reveal } from '../ui/Reveal'
import { SectionHeading } from '../ui/SectionHeading'

export function UserTypesSection() {
  const reduce = useReducedMotion()

  return (
    <section
      id="users"
      className="border-y border-slate-200/80 bg-white py-20 text-zinc-900"
      aria-labelledby="users-heading"
    >
      <Container>
        <SectionHeading
          titleId="users-heading"
          eyebrow="Who it’s for"
          title="One ecosystem—many stakeholders"
          subtitle="A2Z aligns incentives: faster hiring for clients, fair visibility for workers, and cleaner records for everyone in between."
          align="center"
        />

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {userTypes.map((u, i) => (
            <Reveal key={u.title} delay={i * 0.05}>
              <motion.article
                className="flex h-full flex-col rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm"
                whileHover={reduce ? undefined : { y: -5 }}
              >
                <div className="mb-4 flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-white shadow-md shadow-brand/25">
                    <LandingIcon name={u.icon} className="h-6 w-6" />
                  </span>
                  <h3 className="text-lg font-bold">{u.title}</h3>
                </div>
                <p className="text-sm leading-relaxed text-zinc-600">{u.description}</p>
                <ul className="mt-4 space-y-2 border-t border-zinc-100 pt-4 text-sm text-zinc-700">
                  {u.perks.map((p) => (
                    <li key={p} className="flex gap-2">
                      <span className="text-brand">✓</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </motion.article>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  )
}
