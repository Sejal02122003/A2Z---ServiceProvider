import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { HardHat, Menu, X } from 'lucide-react'
import { ButtonLink } from '../ui/ButtonLink'
import { Container } from '../ui/Container'
import { SITE } from '../../data/landingContent'
import { useAuth } from '../../hooks/useAuth.js'
import { USER_ROLES } from '../../constants/userRoles.js'
import { writeBootRole } from '../../lib/bootPersona.js'

const links = [
  { href: '#problem', label: 'Why A2Z' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#services', label: 'Services' },
  { href: '#features', label: 'Trust' },
  { href: '#testimonials', label: 'Stories' },
  { href: '#faq', label: 'FAQ' },
]

export function Navbar() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
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

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const linkClass = scrolled
    ? 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
    : 'text-slate-700 hover:bg-white/60 hover:text-slate-900'

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[background,box-shadow] duration-300 ${
        scrolled
          ? 'border-b border-slate-200/90 bg-white/90 shadow-sm shadow-slate-200/50 backdrop-blur-xl'
          : 'border-b border-transparent bg-transparent'
      }`}
    >
      <Container className="flex h-16 items-center justify-between gap-4 md:h-[4.25rem]">
        <a
          href="#hero"
          className="flex items-center gap-2.5 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <img src="/logo.png" alt={SITE.name} className="h-10 sm:h-11 w-auto object-contain rounded-lg" />
          <span className="text-base font-extrabold tracking-tight text-slate-900 sm:text-lg">
            {SITE.name}
          </span>
        </a>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className={`rounded-xl px-3 py-2 text-sm font-medium transition ${linkClass}`}
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <Link
            to="/auth"
            className="rounded-xl px-3 py-2 text-sm font-semibold text-brand hover:bg-brand-muted/50"
          >
            Sign in
          </Link>
          <ButtonLink href="/app" variant="secondary" className="!py-2.5 !text-xs" onClick={handleRegisterLabour}>
            Register as Labour
          </ButtonLink>
          <ButtonLink href="/app" variant="primary" className="!py-2.5 !text-xs" onClick={handleHireLabour}>
            Hire Labour
          </ButtonLink>
        </div>

        <button
          type="button"
          className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-sm lg:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          <span className="sr-only">Toggle menu</span>
        </button>
      </Container>

      <AnimatePresence>
        {open ? (
          <motion.div
            id="mobile-menu"
            className="border-t border-slate-200 bg-white shadow-lg backdrop-blur-xl lg:hidden"
            initial={reduce ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.28 }}
          >
            <Container className="flex flex-col gap-1 py-4 pb-6">
              {links.map((l, i) => (
                <motion.a
                  key={l.href}
                  href={l.href}
                  className="rounded-2xl px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  onClick={() => setOpen(false)}
                  initial={reduce ? false : { opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.04 * i }}
                >
                  {l.label}
                </motion.a>
              ))}
              <div className="mt-3 flex flex-col gap-2">
                <Link
                  to="/auth"
                  className="rounded-2xl border border-brand/30 bg-brand-muted py-3 text-center text-sm font-semibold text-brand"
                  onClick={() => setOpen(false)}
                >
                  Sign in / Register
                </Link>
                <ButtonLink href="/app" variant="primary" onClick={(e) => { setOpen(false); handleHireLabour(e); }}>
                  Hire Labour
                </ButtonLink>
                <ButtonLink href="/app" variant="secondary" onClick={(e) => { setOpen(false); handleRegisterLabour(e); }}>
                  Register as Labour
                </ButtonLink>
              </div>
            </Container>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  )
}
