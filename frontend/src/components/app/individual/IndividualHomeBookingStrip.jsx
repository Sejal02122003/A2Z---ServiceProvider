import { Link } from 'react-router-dom'
import { CalendarClock, ChevronRight } from 'lucide-react'
import { AppListSkeleton } from '../../app-ui/feedback/AppListSkeleton.jsx'
import { bookingStatusToUi } from '../../../lib/individualBookings.js'

export function IndividualHomeBookingStrip({ bookings, loading, formatDay }) {
  if (loading) {
    return <AppListSkeleton rows={1} />
  }

  if (!bookings?.length) {
    return null
  }

  return (
    <section className="space-y-3" aria-label="Recent bookings">
      <div className="flex items-center justify-between gap-2 px-0.5">
        <h3 className="text-lg font-bold tracking-tight text-slate-900">Recent bookings</h3>
        <Link
          to="/app/bookings"
          className="text-xs font-bold text-brand"
        >
          View all
        </Link>
      </div>

      <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 scrollbar-none [&::-webkit-scrollbar]:hidden">
        {bookings.map((b) => {
          const st = bookingStatusToUi(b.status)
          const primaryLine = (b.lines || [])[0]
          const itemLabel = primaryLine?.categoryName || 'Service booking'
          const day = formatDay(b.serviceDate)

          return (
            <Link
              key={b.id || b.ref}
              to={`/app/bookings?ref=${encodeURIComponent(b.ref || '')}`}
              className="flex min-w-[16rem] shrink-0 snap-start items-center gap-3 rounded-2xl border border-slate-100 bg-white p-3.5 shadow-sm transition hover:border-brand/25 active:scale-[0.99]"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-muted text-brand">
                <CalendarClock className="h-5 w-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900">{itemLabel}</p>
                <p className="mt-0.5 text-xs font-medium text-slate-500">
                  {day} · {b.address ? b.address.split(',')[0] : 'Site'}
                </p>
                <span className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold ring-1 ${st.tone}`}>
                  {st.label}
                </span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" aria-hidden />
            </Link>
          )
        })}
      </div>
    </section>
  )
}
