import { motion, useReducedMotion } from 'framer-motion'
import { Clock3, PhoneCall } from 'lucide-react'
import { SITE } from '../../data/landingContent'
import { ButtonLink } from '../ui/ButtonLink'
import { Container } from '../ui/Container'

export function FinalCTA() {
  const reduce = useReducedMotion()

  return (
    <section
      id="cta"
      className="relative overflow-hidden border-t border-slate-200/80 bg-white py-20"
      aria-labelledby="cta-heading"
    >
      <div className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-brand/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-16 bottom-0 h-64 w-64 rounded-full bg-brand-muted/80 blur-3xl" />

      <Container className="relative">
        <motion.div
          className="rounded-[2rem] border border-slate-200/90 bg-white p-8 shadow-xl shadow-slate-200/30 md:p-12"
          initial={reduce ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
        >
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div className="space-y-4 text-slate-900">
              <div className="inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand-muted px-3 py-1 text-xs font-semibold text-slate-800">
                <Clock3 className="h-3.5 w-3.5 text-brand" aria-hidden />
                Same-day & emergency slots in select cities
              </div>
              <h2 id="cta-heading" className="text-3xl font-extrabold tracking-tight md:text-4xl">
                Need service providers urgently?
              </h2>
              <p className="max-w-xl text-sm leading-relaxed text-slate-600 md:text-base">
                Post your requirement once—we match verified service providers, share live status, and keep
                payouts documented. Scaling contractors can talk to our team for custom SLAs.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <ButtonLink href={`tel:${SITE.phone.replace(/\s/g, '')}`} variant="secondary">
                  <PhoneCall className="h-4 w-4" aria-hidden />
                  Talk to us
                </ButtonLink>
                <p className="text-xs text-slate-500">
                  Prefer human help? {SITE.phone} · {SITE.contactEmail}
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <ButtonLink href="#services" variant="primary" className="!py-4 !text-base">
                Book Now
              </ButtonLink>
              <ButtonLink href="/labours/auth" variant="secondary" className="!py-4 !text-base">
                Become a Service Provider
              </ButtonLink>
            </div>
          </div>
        </motion.div>
      </Container>
    </section>
  )
}
