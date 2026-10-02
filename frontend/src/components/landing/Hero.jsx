import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Star } from 'lucide-react'
import { trustBadges } from '../../data/landingContent'
import { LandingIcon } from '../../lib/iconMap'
import { ButtonLink } from '../ui/ButtonLink'
import { Container } from '../ui/Container'
import { GlassPanel } from '../ui/GlassPanel'
import { ConstructionIllustration } from './ConstructionIllustration'
import { useAuth } from '../../hooks/useAuth.js'
import { USER_ROLES } from '../../constants/userRoles.js'
import { writeBootRole } from '../../lib/bootPersona.js'

export function Hero() {
  const reduce = useReducedMotion()
  const { user, logout } = useAuth()

  const handleHireLabour = (e) => {
    if (e && e.preventDefault) e.preventDefault()
    if (user && user.role === USER_ROLES.CUSTOMER) {
      window.location.href = '/app'
      return
    }
    logout().finally(() => {
      writeBootRole(USER_ROLES.CUSTOMER)
      window.location.href = '/app'
    })
  }

  const handleRegisterLabour = (e) => {
    if (e && e.preventDefault) e.preventDefault()
    if (user && user.role === USER_ROLES.LABOUR) {
      window.location.href = '/app'
      return
    }
    logout().finally(() => {
      writeBootRole(USER_ROLES.LABOUR)
      window.location.href = '/app'
    })
  }

  return (
    <section
      id="hero"
      className="relative overflow-hidden border-b border-slate-200/80 bg-white pt-24 pb-16 md:pt-28 md:pb-24"
      aria-labelledby="hero-heading"
    >
      <Container className="relative grid gap-12 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:items-center">
        <div className="space-y-8">
          <motion.div
            className="inline-flex items-center gap-2 rounded-full border border-slate-200/90 bg-white/90 px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm backdrop-blur-sm"
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="flex items-center gap-1 text-brand">
              <Star className="h-3.5 w-3.5 fill-brand text-brand" aria-hidden />
              4.8 avg. rating
            </span>
            <span className="text-slate-400">·</span>
            <span>Built for India’s construction economy</span>
          </motion.div>

          <div className="space-y-4">
            <motion.h1
              id="hero-heading"
              className="text-4xl font-extrabold leading-[1.08] tracking-tight text-slate-900 sm:text-5xl lg:text-[3.35rem]"
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.05 }}
            >
              Book Trusted Construction Labour{' '}
              <span className="bg-gradient-to-r from-brand via-cyan-500 to-teal-600 bg-clip-text text-transparent">
                in Minutes
              </span>
            </motion.h1>
            <motion.p
              className="max-w-xl text-lg leading-relaxed text-slate-600"
              initial={reduce ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, delay: 0.12 }}
            >
              A2Z connects customers and businesses with verified salon, home appliances & on-demand experts—transparent pricing, digital payments, and instant booking when you need it most.
            </motion.p>
          </div>

          <motion.div
            className="flex flex-col gap-3 sm:flex-row sm:items-center"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.18 }}
          >
            <ButtonLink href="/app" variant="primary" className="group" onClick={handleHireLabour}>
              Hire Labour
              <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden />
            </ButtonLink>
            <ButtonLink href="/app" variant="secondary" onClick={handleRegisterLabour}>
              Register as Labour
            </ButtonLink>
          </motion.div>

          <motion.div
            className="flex flex-wrap gap-2"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.28 }}
          >
            {trustBadges.map((b, i) => (
              <motion.div
                key={b.id}
                className="flex items-center gap-2 rounded-2xl border border-slate-200/90 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-sm"
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + i * 0.05 }}
                whileHover={reduce ? undefined : { y: -2, borderColor: 'rgba(0,158,179,0.45)' }}
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand/12 text-brand">
                  <LandingIcon name={b.icon} className="h-4 w-4" />
                </span>
                {b.label}
              </motion.div>
            ))}
          </motion.div>
        </div>

        <motion.div
          className="relative"
          initial={reduce ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, delay: 0.15 }}
        >
          <GlassPanel className="relative overflow-hidden p-4 sm:p-6">
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand/15 blur-3xl" />
            <ConstructionIllustration />
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-200/90 pt-4 text-center text-[11px] text-slate-500 sm:text-xs">
              <div>
                <p className="font-bold text-slate-900">35+</p>
                <p>cities</p>
              </div>
              <div>
                <p className="font-bold text-slate-900">12k+</p>
                <p>verified workers</p>
              </div>
              <div>
                <p className="font-bold text-slate-900">24/7</p>
                <p>support</p>
              </div>
            </div>
          </GlassPanel>
        </motion.div>
      </Container>
    </section>
  )
}
