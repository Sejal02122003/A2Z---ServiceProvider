import { motion, useReducedMotion } from 'framer-motion'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { comparisonRows, problemPoints } from '../../data/landingContent'
import { Container } from '../ui/Container'
import { Reveal } from '../ui/Reveal'
import { SectionHeading } from '../ui/SectionHeading'

export function ProblemSection() {
  const reduce = useReducedMotion()

  return (
    <section
      id="problem"
      className="relative border-y border-slate-200/80 bg-white py-20 text-zinc-900"
      aria-labelledby="problem-heading"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand/50 to-transparent" />
      <Container>
        <SectionHeading
          titleId="problem-heading"
          eyebrow="The old way is broken"
          title="Traditional labour hiring wasn’t built for modern sites"
          subtitle="Chowks and informal networks still power much of India’s construction economy—but they break down when timelines, compliance, and cash flows matter."
          align="center"
        />

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {problemPoints.map((p, i) => (
            <Reveal key={p.title} delay={i * 0.06}>
              <motion.article
                className="group h-full rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:border-brand/50 hover:shadow-[0_20px_50px_-24px_rgba(0,43,92,0.18)]"
                whileHover={reduce ? undefined : { y: -4 }}
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-2xl bg-brand/15 text-brand">
                  <AlertTriangle className="h-5 w-5" strokeWidth={2} aria-hidden />
                </div>
                <h3 className="text-lg font-bold">{p.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-600">{p.description}</p>
              </motion.article>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-14">
          <div className="overflow-hidden rounded-[2rem] border border-zinc-200 bg-white shadow-[0_24px_80px_-40px_rgba(0,0,0,0.25)]">
            <div className="grid md:grid-cols-2">
              <div className="border-b border-zinc-100 bg-zinc-50/80 p-6 md:border-b-0 md:border-r md:border-zinc-100">
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-slate-800 px-3 py-1 text-xs font-semibold text-white">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                  Traditional method
                </div>
                <ul className="space-y-3 text-sm text-zinc-600">
                  {comparisonRows.map((row) => (
                    <li key={row.aspect} className="flex gap-2">
                      <span className="mt-0.5 text-zinc-400">•</span>
                      <span>
                        <span className="font-semibold text-zinc-800">{row.aspect}:</span>{' '}
                        {row.traditional}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="relative overflow-hidden bg-gradient-to-br from-white via-slate-50 to-white p-6 text-slate-800 ring-1 ring-slate-200/80">
                <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand/15 blur-3xl" />
                <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-brand px-3 py-1 text-xs font-semibold text-white shadow-sm">
                  <CheckCircle2 className="h-3.5 w-3.5 text-white" aria-hidden />
                  With A2Z
                </div>
                <ul className="relative space-y-3 text-sm text-slate-600">
                  {comparisonRows.map((row) => (
                    <li key={row.aspect} className="flex gap-2">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
                      <span>
                        <span className="font-semibold text-slate-900">{row.aspect}:</span>{' '}
                        {row.labourchowck}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  )
}
