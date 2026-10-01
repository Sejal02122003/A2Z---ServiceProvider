import { motion, useReducedMotion } from 'framer-motion'
import { Star } from 'lucide-react'
import { testimonials } from '../../data/landingContent'
import { Container } from '../ui/Container'
import { Reveal } from '../ui/Reveal'
import { SectionHeading } from '../ui/SectionHeading'

export function TestimonialsSection() {
  const reduce = useReducedMotion()

  return (
    <section
      id="testimonials"
      className="border-y border-slate-200/80 bg-white py-20"
      aria-labelledby="testimonials-heading"
    >
      <Container>
        <SectionHeading
          titleId="testimonials-heading"
          eyebrow="Stories from the field"
          title="Real crews. Real sites. Real outcomes."
          subtitle="From home appliance servicing to salon packages—customers and pros use A2Z when timelines and trust both matter."
          align="center"
        />

        <div className="grid gap-6 md:grid-cols-2">
          {testimonials.map((t, i) => (
            <Reveal key={t.name} delay={i * 0.06}>
              <motion.figure
                className="h-full rounded-3xl border border-slate-200/90 bg-page p-6 shadow-sm"
                whileHover={reduce ? undefined : { y: -4 }}
              >
                <div className="flex items-start gap-4">
                  <img
                    src={t.avatar}
                    alt=""
                    width={56}
                    height={56}
                    className="h-14 w-14 rounded-2xl border border-slate-200 bg-white object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <figcaption className="font-bold text-slate-900">{t.name}</figcaption>
                      <span className="rounded-full bg-brand-muted px-2 py-0.5 text-[11px] font-medium text-slate-700">
                        {t.role}
                      </span>
                    </div>
                    <div className="mt-2 flex gap-0.5" aria-label={`${t.rating} out of 5 stars`}>
                      {Array.from({ length: 5 }).map((_, j) => (
                        <Star
                          key={j}
                          className={`h-4 w-4 ${
                            j < t.rating ? 'fill-brand text-brand' : 'text-slate-300'
                          }`}
                          aria-hidden
                        />
                      ))}
                    </div>
                  </div>
                </div>
                <blockquote className="mt-4 text-sm leading-relaxed text-slate-600">
                  “{t.quote}”
                </blockquote>
              </motion.figure>
            </Reveal>
          ))}
        </div>
      </Container>
    </section>
  )
}
