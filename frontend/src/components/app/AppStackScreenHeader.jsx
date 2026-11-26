import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft, Menu } from 'lucide-react'

function openAppDrawer() {
  window.dispatchEvent(new Event('lc-open-app-drawer'))
}

const ICON_BTN =
  'flex h-9 w-9 min-[360px]:h-[42px] min-[360px]:w-[42px] shrink-0 items-center justify-center rounded-xl min-[360px]:rounded-[14px] border border-slate-200 bg-white text-slate-700 shadow-sm transition-colors hover:bg-slate-50 active:scale-95'

/**
 * Standard header for full-screen app routes without AppShell chrome (bookings, search, etc.).
 * Adapts to small/large phones and respects notch / status-bar safe areas.
 */
export function AppStackScreenHeader({ title, backTo, onBack, className = '' }) {
  const { pathname } = useLocation()
  const defaultHome = pathname.startsWith('/serviceprovider') ? '/serviceprovider' : '/user'
  const resolvedBackTo = (!backTo || backTo === '/app') ? defaultHome : backTo

  return (
    <div className={`sticky top-0 z-40 pt-[max(0.5rem,env(safe-area-inset-top))] pb-1 bg-slate-50/95 backdrop-blur-md ${className}`}>
      <div className="rounded-2xl min-[360px]:rounded-3xl border border-slate-200 bg-white px-3 min-[360px]:px-4 py-2.5 min-[360px]:py-3 shadow-sm">
        <div className="flex items-center gap-2.5 min-[360px]:gap-3.5">
          {onBack ? (
            <button type="button" onClick={onBack} className={ICON_BTN} aria-label="Go back">
              <ArrowLeft className="h-5 w-5" strokeWidth={2} aria-hidden />
            </button>
          ) : (
            <Link to={resolvedBackTo} className={ICON_BTN} aria-label="Go back">
              <ArrowLeft className="h-5 w-5" strokeWidth={2} aria-hidden />
            </Link>
          )}
          <div className="flex flex-col justify-center min-w-0 flex-1">
            <h1 className="text-base min-[360px]:text-[20px] font-bold tracking-tight text-slate-900 leading-tight truncate">{title}</h1>
          </div>
          <button type="button" onClick={openAppDrawer} className={ICON_BTN} aria-label="Open menu">
            <Menu className="h-5 w-5" strokeWidth={2} aria-hidden />
          </button>
        </div>
      </div>
    </div>
  )
}
