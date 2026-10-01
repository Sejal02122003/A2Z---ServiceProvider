import { useId, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'
import { faqs } from '../../data/landingContent'
import { Container } from '../ui/Container'
import { Reveal } from '../ui/Reveal'
import { SectionHeading } from '../ui/SectionHeading'

export function FAQSection() {
  const [open, setOpen] = useState(0)
  const reduce = useReducedMotion()
  const baseId = useId()

  return (
    <section id="faq" className="bg-page py-20" aria-labelledby="faq-heading">
      <Container className="max-w-3xl">
        <SectionHeading
          titleId="faq-heading"
          eyebrow="FAQ"
          title="Answers before you book"
          subtitle="Still deciding? Here’s what users usually ask before their first A2Z booking."
          align="center"
        />

        <div className="space-y-3">
          {faqs.map((item, index) => {
            const isOpen = open === index
            const panelId = `${baseId}-panel-${index}`
            const headerId = `${baseId}-header-${index}`

            return (
              <Reveal key={item.q} delay={index * 0.04}>
                <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm">
                  <h3>
                    <button
                      type="button"
                      id={headerId}
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                      onClick={() => setOpen(isOpen ? -1 : index)}
                    >
                      {item.q}
                      <motion.span
                        animate={{ rotate: isOpen ? 180 : 0 }}
                        transition={{ duration: reduce ? 0 : 0.25 }}
                        className="shrink-0 text-brand"
                      >
                        <ChevronDown className="h-5 w-5" aria-hidden />
                      </motion.span>
                    </button>
                  </h3>
                  <AnimatePresence initial={false}>
                    {isOpen ? (
                      <motion.div
                        id={panelId}
                        role="region"
                        aria-labelledby={headerId}
                        initial={reduce ? false : { height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={reduce ? undefined : { height: 0, opacity: 0 }}
                        transition={{ duration: 0.28 }}
                        className="overflow-hidden border-t border-slate-100"
                      >
                        <p className="px-5 py-4 text-sm leading-relaxed text-slate-600">{item.a}</p>
                      </motion.div>
                    ) : null}
                  </AnimatePresence>
                </div>
              </Reveal>
            )
          })}
        </div>
      </Container>
    </section>
  )
}
