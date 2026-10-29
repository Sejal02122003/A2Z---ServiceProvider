import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft, Menu } from 'lucide-react'

function openAppDrawer() {
  window.dispatchEvent(new Event('lc-open-app-drawer'))
}

/**
 * Standard header for full-screen app routes without AppShell chrome (bookings, search, etc.).
 */
export function AppStackScreenHeader({ title, backTo, onBack, className = '' }) {
  const { pathname } = useLocation()
  const defaultHome = pathname.startsWith('/serviceprovider') ? '/serviceprovider' : '/user'
  const resolvedBackTo = (!backTo || backTo === '/app') ? defaultHome : backTo

  return (
    <div className={`mb-4 mt-[max(0.75rem,env(safe-area-inset-top))] rounded-3xl border border-slate-200 bg-white px-4 py-3 shadow-sm sticky top-[max(0.75rem,env(safe-area-inset-top))] z-40 ${className}`}>
      <div className="flex items-center gap-3.5">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[14px] border border-slate-200 text-slate-700 shadow-sm transition-colors hover:bg-slate-50 active:scale-95"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2} aria-hidden />
          </button>
        ) : (
          <Link
            to={resolvedBackTo}
            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[14px] border border-slate-200 text-slate-700 shadow-sm transition-colors hover:bg-slate-50 active:scale-95"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2} aria-hidden />
          </Link>
        )}
        <div className="flex flex-col justify-center min-w-0 flex-1">
          <h1 className="text-[20px] font-bold tracking-tight text-slate-900 leading-none truncate">{title}</h1>
        </div>
        <button
          type="button"
          onClick={openAppDrawer}
          className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[14px] border border-slate-200 bg-white text-slate-800 shadow-sm transition-colors hover:bg-slate-50 active:scale-95"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" strokeWidth={2} aria-hidden />
        </button>
      </div>
    </div>
  )
}
