import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Bell, ChevronDown, LogOut, MapPin, Menu, Sparkles, X } from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import {
  getAppNavigation,
  getAppShellTitle,
} from '../config/appNavigation.js'
import { KYC_STATUS, ROLE_LABELS, USER_ROLES } from '../constants/userRoles.js'
import { AppAmbientBackground } from '../components/app/AppAmbientBackground.jsx'
import { AppPageTransition } from '../components/app/AppPageTransition.jsx'
import { appSpring } from '../components/app/appMotion.js'
import { GlassPanel } from '../components/ui/GlassPanel.jsx'
import { AppBottomNav } from '../components/app-ui/navigation/AppBottomNav.jsx'
import { AppBadge } from '../components/app-ui/data-display/AppBadge.jsx'
import { adminInitials } from '../lib/formatAdminLastLogin.js'
import { readAppUserLocation } from '../lib/appUserLocationStorage.js'
import { AppUserLocationModal } from '../components/app/AppUserLocationModal.jsx'
import { BOOT_ROUTES } from '../constants/bootFlow.js'
import { APP_HOME_LOCATION, APP_HOME_PATH, hasBookingFlowQuery } from '../lib/bookingFlowNavigation.js'

export function AppShell() {
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const { logout, user, isGuest } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [locationModalOpen, setLocationModalOpen] = useState(false)
  const [appLocation, setAppLocation] = useState(() => readAppUserLocation())
  const headerRef = useRef(null)
  const reduce = useReducedMotion()

  const { headerTagline, bottomNav, drawerNav } = useMemo(() => getAppNavigation(user?.role), [user?.role])

  const isIndividualAppHome = (user?.role === USER_ROLES.CUSTOMER || user?.role === USER_ROLES.CONTRACTOR) && pathname === '/app'
  const isLabourAppHome = user?.role === USER_ROLES.LABOUR && pathname === '/app'
  const isLabourNotifications = user?.role === USER_ROLES.LABOUR && pathname === '/app/notifications'
  const isLabourJobs = user?.role === USER_ROLES.LABOUR && pathname === '/app/jobs'
  const isLabourEarnings = user?.role === USER_ROLES.LABOUR && pathname === '/app/earnings'
  const isLabourKyc = user?.role === USER_ROLES.LABOUR && pathname === '/app/kyc'
  const hideShellHeader =
    pathname.startsWith('/app/booking/flow') ||
    pathname.startsWith('/app/tracking') ||
    pathname.startsWith('/app/sub-category/') ||
    pathname.startsWith('/app/active-job') ||
    pathname === '/app/bookings' ||
    pathname === '/app/my-bookings' ||
    pathname === '/app/search' ||
    pathname === '/app/support' ||
    pathname === '/app/profile' ||
    pathname === '/app/wallet' ||
    isLabourAppHome ||
    isLabourJobs ||
    isLabourEarnings ||
    isLabourKyc ||
    isLabourNotifications
  const title = getAppShellTitle(pathname)
  const drawerInitials = adminInitials(user)
  const profileImageUrl = user?.profileImageUrl?.trim()

  useEffect(() => {
    queueMicrotask(() => setDrawerOpen(false))
  }, [pathname])

  useEffect(() => {
    if (pathname === APP_HOME_PATH && hasBookingFlowQuery(search)) {
      navigate(APP_HOME_LOCATION, { replace: true })
    }
  }, [navigate, pathname, search])

  useEffect(() => {
    queueMicrotask(() => setLocationModalOpen(false))
  }, [pathname])

  useEffect(() => {
    const onOpenDrawer = () => {
      queueMicrotask(() => setDrawerOpen(true))
    }
    window.addEventListener('lc-open-app-drawer', onOpenDrawer)
    return () => window.removeEventListener('lc-open-app-drawer', onOpenDrawer)
  }, [])

  useEffect(() => {
    if (!drawerOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [drawerOpen])

  useEffect(() => {
    const onLoc = () => {
      queueMicrotask(() => {
        setAppLocation(readAppUserLocation())
      })
    }
    window.addEventListener('lc-app-user-location-changed', onLoc)
    return () => window.removeEventListener('lc-app-user-location-changed', onLoc)
  }, [])

  useEffect(() => {
    if (!isIndividualAppHome) return
    queueMicrotask(() => {
      setAppLocation(readAppUserLocation())
    })
  }, [isIndividualAppHome, pathname])

  const updateIndividualHomeChrome = useCallback(() => {
    if (!isIndividualAppHome) return
    const header = headerRef.current
    if (header) {
      const h = Math.ceil(header.getBoundingClientRect().height)
      document.documentElement.style.setProperty('--individual-home-sticky-top', `${h}px`)
    }
  }, [isIndividualAppHome])

  useLayoutEffect(() => {
    if (!isIndividualAppHome) {
      document.documentElement.style.removeProperty('--individual-home-sticky-top')
      return undefined
    }
    const id = requestAnimationFrame(() => {
      updateIndividualHomeChrome()
    })
    return () => {
      cancelAnimationFrame(id)
      document.documentElement.style.removeProperty('--individual-home-sticky-top')
    }
  }, [isIndividualAppHome, pathname, updateIndividualHomeChrome])

  useEffect(() => {
    if (!isIndividualAppHome) return undefined

    let raf = 0
    const schedule = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        updateIndividualHomeChrome()
      })
    }

    schedule()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule)

    const onLayout = () => schedule()
    window.addEventListener('lc-individual-home-layout', onLayout)

    let ro
    const node = headerRef.current
    if (node && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(schedule)
      ro.observe(node)
    }

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('lc-individual-home-layout', onLayout)
      ro?.disconnect()
    }
  }, [isIndividualAppHome, updateIndividualHomeChrome])

  const headerBadge = useMemo(() => {
    const role = user?.role
    if (role === USER_ROLES.LABOUR && user?.labourProfile?.kycStatus) {
      const k = user.labourProfile.kycStatus
      if (k === KYC_STATUS.PENDING) {
        return user.labourProfile.kycSubmittedAt
          ? { label: 'KYC with admin', variant: 'amber' }
          : { label: 'KYC not submitted', variant: 'amber' }
      }
      if (k === KYC_STATUS.FAILED) return { label: 'KYC needs attention', variant: 'rose' }
      if (k === KYC_STATUS.VERIFIED) return { label: 'KYC verified', variant: 'emerald' }
    }
    return null
  }, [user])

  const { individualLocationTitle, individualLocationSubtitle } = useMemo(() => {
    if (!isIndividualAppHome) {
      return { individualLocationTitle: '', individualLocationSubtitle: '' }
    }
    const addr = appLocation?.address?.trim()
    const la = appLocation?.lat
    const ln = appLocation?.lng
    if (addr) {
      return {
        individualLocationTitle: addr,
        individualLocationSubtitle:
          la != null && ln != null ? `GPS ${la.toFixed(5)}, ${ln.toFixed(5)}` : 'Current work area',
      }
    }
    if (la != null && ln != null) {
      return {
        individualLocationTitle: 'Current location',
        individualLocationSubtitle: `${la.toFixed(5)}, ${ln.toFixed(5)}`,
      }
    }
    
    if (user?.currentLocation?.trim()) {
      return {
        individualLocationTitle: user.currentLocation.trim(),
        individualLocationSubtitle: 'Profile location',
      }
    }
    
    if (user?.permanentAddress?.trim()) {
      return {
        individualLocationTitle: user.permanentAddress.trim(),
        individualLocationSubtitle: 'Profile address',
      }
    }

    return {
      individualLocationTitle: 'Your location',
      individualLocationSubtitle: 'Tap to set address or use GPS',
    }
  }, [appLocation, isIndividualAppHome, user?.currentLocation, user?.permanentAddress])

  return (
    <div className="relative min-h-dvh w-full overflow-x-clip print:overflow-visible text-slate-900">
      <AppAmbientBackground />

      <AnimatePresence>
        {drawerOpen ? (
          <>
            <motion.button
              key="drawer-overlay"
              type="button"
              className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-md"
              aria-label="Close menu"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              onClick={() => setDrawerOpen(false)}
            />
            <motion.aside
              key="drawer-panel"
              className="fixed inset-y-0 left-0 z-50 flex w-[min(88vw,19.5rem)] flex-col border-r border-slate-200/80 bg-white shadow-[8px_0_40px_-12px_rgba(15,23,42,0.14)]"
              initial={{ x: '-105%' }}
              animate={{ x: 0 }}
              exit={{ x: '-105%' }}
              transition={reduce ? { duration: 0.2 } : appSpring}
              aria-hidden={!drawerOpen}
            >
              <div className="relative border-b border-slate-200/70 bg-linear-to-b from-slate-50/90 to-white px-4 pb-6 pt-5">
                <div className="pointer-events-none absolute inset-x-4 bottom-0 h-px bg-linear-to-r from-brand/30 via-slate-200/50 to-transparent" aria-hidden />

                <div className="relative flex items-center justify-between gap-3">
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-brand-bright to-brand text-sm font-black text-white shadow-md ring-2 ring-white">
                      {drawerInitials}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-base font-extrabold text-slate-900">
                        {user?.fullName || 'Menu'}
                      </p>
                      <p className="mt-0.5 truncate text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        {ROLE_LABELS[user?.role] || 'Account'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-500 shadow-sm transition hover:border-brand/30 hover:bg-slate-50 hover:text-slate-900"
                    aria-label="Close menu"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {headerBadge ? (
                  <div className="relative mt-3">
                    <AppBadge variant={headerBadge.variant}>{headerBadge.label}</AppBadge>
                  </div>
                ) : null}
              </div>
              <nav
                className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4 scrollbar-thin [scrollbar-color:rgba(148,163,184,0.45)_transparent]"
                aria-label="Main"
              >
                {drawerNav.map(({ id, to, end, label, icon: Icon }) => (
                  <NavLink
                    key={`${id}-${to}`}
                    to={to}
                    end={Boolean(end)}
                    onClick={() => setDrawerOpen(false)}
                    className={({ isActive }) =>
                      `group relative flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition duration-200 ${isActive
                        ? 'bg-linear-to-r from-brand/10 to-white text-slate-900 shadow-[inset_0_0_0_1px_rgba(0,43,92,0.12)] before:absolute before:left-0 before:top-1/2 before:z-10 before:h-9 before:w-1 before:-translate-y-1/2 before:rounded-r-full before:bg-brand before:shadow-[2px_0_10px_-2px_rgba(0,43,92,0.45)]'
                        : 'text-slate-700 hover:bg-slate-50'
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm ring-1 transition ${isActive
                            ? 'bg-white text-brand ring-brand/25'
                            : 'bg-white text-slate-500 ring-slate-200/80 group-hover:text-brand group-hover:ring-brand/15'
                            }`}
                        >
                          <Icon className="h-[18px] w-[18px]" aria-hidden />
                        </span>
                        <span className="min-w-0 flex-1 leading-snug">{label}</span>
                      </>
                    )}
                  </NavLink>
                ))}
              </nav>
              <div className="border-t border-slate-200/70 bg-linear-to-t from-slate-50/50 to-white p-3">
                {isGuest ? (
                  <Link
                    to="/auth"
                    onClick={() => setDrawerOpen(false)}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-brand/30 bg-brand/5 py-3 text-sm font-semibold text-brand shadow-sm transition hover:bg-brand/10"
                  >
                    <LogOut className="h-4 w-4 rotate-180" aria-hidden />
                    Login / Register
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      const role = user?.role
                      logout()
                      navigate(role === USER_ROLES.LABOUR ? '/labours/auth' : '/users/auth', { replace: true })
                    }}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-rose-200/90 bg-rose-50 py-3 text-sm font-semibold text-rose-800 shadow-sm transition hover:bg-rose-50/90"
                  >
                    <LogOut className="h-4 w-4" aria-hidden />
                    Sign out
                  </button>
                )}
              </div>
            </motion.aside>
          </>
        ) : null}
      </AnimatePresence>

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-lg flex-col">
        {isIndividualAppHome ? (
          <div
            className="pointer-events-none absolute left-1/2 top-0 z-0 h-[12.5rem] w-full max-w-lg -translate-x-1/2 bg-gradient-to-b from-[#002633] via-[#004e64] to-brand"
            aria-hidden
          />
        ) : (isLabourAppHome || isLabourNotifications) ? (
          <div
            className="pointer-events-none absolute left-1/2 top-0 z-0 h-[min(52vh,26rem)] w-full max-w-lg -translate-x-1/2 rounded-b-[2rem] bg-gradient-to-b from-[#002633] via-[#004e64] to-brand"
            aria-hidden
          />
        ) : null}

        {!hideShellHeader ? (
          <header
            ref={headerRef}
            className={`sticky top-0 z-30 hide-on-print ${isIndividualAppHome ? 'bg-transparent px-4 pb-1 pt-3' : 'px-3 pt-3'
              }`}
          >
            {isIndividualAppHome ? (
              <div className="flex items-center gap-2 text-white">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition active:scale-95 hover:bg-white/25"
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => setLocationModalOpen(true)}
                  className="flex min-w-0 flex-1 items-start gap-2 rounded-xl py-0.5 text-left outline-none transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/40"
                  aria-haspopup="dialog"
                  aria-expanded={locationModalOpen}
                  aria-label="Open location settings"
                >
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-white" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold text-white/80">Your location</p>
                    <div className="flex items-center gap-0.5">
                      <span className="truncate text-sm font-extrabold tracking-tight sm:text-[0.95rem]">
                        {individualLocationTitle}
                      </span>
                      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-white/80" aria-hidden />
                    </div>
                    <p className="sr-only">{individualLocationSubtitle}</p>
                  </div>
                </button>
                <Link
                  to="/app/support"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition active:scale-95 hover:bg-white/25"
                  aria-label="Support and notifications"
                >
                  <Bell className="h-5 w-5" aria-hidden />
                </Link>
                <Link
                  to="/app/profile"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition active:scale-95 hover:bg-white/25 overflow-hidden"
                  aria-label="Open profile"
                >
                  {profileImageUrl ? (
                    <img
                      src={profileImageUrl}
                      alt=""
                      className="h-full w-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="text-[11px] font-black">
                      {drawerInitials}
                    </span>
                  )}
                </Link>
              </div>
            ) : (
              <GlassPanel className="flex items-center gap-3 px-3 py-2.5 ">
                <button
                  type="button"
                  onClick={() => setDrawerOpen(true)}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200/70 bg-white/90 text-slate-700 shadow-sm transition hover:border-brand/30 hover:text-slate-900 active:scale-95"
                  aria-label="Open menu"
                >
                  <Menu className="h-5 w-5" />
                </button>
                <div className="min-w-0 flex-1">
                  <h1 className="truncate text-lg font-extrabold tracking-tight text-slate-900">{title}</h1>
                  <p className="truncate text-xs font-medium leading-snug text-slate-500">{headerTagline}</p>
                </div>
                <motion.div
                  className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-inner ring-1 sm:flex bg-linear-to-br from-brand/15 to-brand-muted/60 text-brand ring-brand/15"
                  aria-hidden
                >
                  <Sparkles className="h-5 w-5" />
                </motion.div>
              </GlassPanel>
            )}
          </header>
        ) : null}

        <main
          className={`relative z-10 flex-1 px-4 pb-32 ${hideShellHeader
            ? 'pt-[max(0.5rem,env(safe-area-inset-top,0px))]'
            : isIndividualAppHome
              ? 'pt-0'
              : 'pt-4'
            }`}
        >
          <AppPageTransition />
        </main>
      </div>

      <AppBottomNav items={bottomNav} />

      {isIndividualAppHome ? (
        <AppUserLocationModal
          open={locationModalOpen}
          onClose={() => setLocationModalOpen(false)}
          onSaved={() => setAppLocation(readAppUserLocation())}
        />
      ) : null}
    </div>
  )
}
