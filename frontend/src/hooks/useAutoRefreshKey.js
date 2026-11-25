import { useEffect, useRef, useState } from 'react'

const REFRESH_INTERVAL_MS = 30_000
const ADMIN_REFRESH_INTERVAL_MS = 60_000
const REFOCUS_MIN_AWAY_MS = 15_000

// Read-only screens that are safe to remount. Screens with forms, live jobs
// (active-job, tracking), booking flow, checkout, KYC, onboarding, profile and
// the provider home (incoming-job popups) are deliberately excluded.
const SAFE_PATH = /^\/(user|serviceprovider|app)(\/(bookings|my-bookings|jobs|wallet|labor-wallet|labour-wallet|earnings|notifications|rewards|penalties|labour\/penalties|subscriptions?|trial-status|materials|packages|services))?\/?$/

// Admin monitoring screens (dashboard + list/queue views). Settings, policies,
// catalog CRUD, zones, fees etc. are excluded since they are mostly forms.
const ADMIN_SAFE_PATH = /^\/admin\/?(bookings|users|labour|identity-verifications|complaints|qr-payments|wallet-management(\/[^/]+)?|labour-wallet|labour-subscriptions|reports|reviews|billing|booking-reminders|vendor-trials(\/pending-confirmations)?)?\/?$/

function isRefreshSafe(pathname) {
  if (pathname.startsWith('/admin')) return ADMIN_SAFE_PATH.test(pathname)
  if (!SAFE_PATH.test(pathname)) return false
  // Provider home holds live incoming-job state; leave it to sockets.
  if (/^\/serviceprovider\/?$/.test(pathname)) return false
  return true
}

function userIsBusy() {
  const el = document.activeElement
  if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return true
  if (el && el.isContentEditable) return true
  return Boolean(document.querySelector('[role="dialog"], [aria-modal="true"]'))
}

export function useAutoRefreshKey(pathname) {
  const [key, setKey] = useState(0)
  const lastRefreshRef = useRef(0)
  const hiddenAtRef = useRef(null)

  useEffect(() => {
    lastRefreshRef.current = Date.now()
    if (!isRefreshSafe(pathname)) return undefined

    const interval = pathname.startsWith('/admin') ? ADMIN_REFRESH_INTERVAL_MS : REFRESH_INTERVAL_MS

    const refresh = () => {
      if (document.visibilityState !== 'visible' || !navigator.onLine || userIsBusy()) return
      lastRefreshRef.current = Date.now()
      setKey((k) => k + 1)
    }

    const timer = setInterval(() => {
      if (Date.now() - lastRefreshRef.current >= interval) refresh()
    }, 5_000)

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now()
      } else if (hiddenAtRef.current && Date.now() - hiddenAtRef.current >= REFOCUS_MIN_AWAY_MS) {
        hiddenAtRef.current = null
        refresh()
      }
    }

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('online', refresh)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('online', refresh)
    }
  }, [pathname])

  return key
}
