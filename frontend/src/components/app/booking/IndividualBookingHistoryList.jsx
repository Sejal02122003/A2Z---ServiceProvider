import { Calendar, MapPin, RefreshCw } from 'lucide-react'
import {
  bookingStatusToUi,
  formatBookingSchedule,
  formatInr,
  isDemoBooking,
} from '../../../lib/individualBookings.js'

const BTN_SOLID = 'rounded-xl bg-brand px-3 py-2 text-xs font-bold text-white active:opacity-90'
const BTN_OUTLINE =
  'rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 active:bg-slate-50'

export function IndividualBookingHistoryList({ items, isDemo, onTrack, onRebook }) {
  if (!items.length) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 py-10 text-center text-sm text-slate-600">
        No bookings yet.
      </p>
    )
  }

  return (
    <ul className="space-y-3">
      {items.map((h) => {
        const st = bookingStatusToUi(h.status)
        const primary = (h.lines || [])[0]
        const title = primary?.categoryName || 'Service booking'

        return (
          <li
            key={h.id || h.ref}
            className="rounded-2xl border border-slate-200 bg-white p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900">{title}</p>
                <p className="mt-0.5 font-mono text-[11px] font-semibold text-brand">{h.ref}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {isDemo && isDemoBooking(h) ? (
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                    Sample
                  </span>
                ) : null}
                <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${st.tone}`}>{st.label}</span>
              </div>
            </div>

            <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-600">
              <Calendar className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
              {formatBookingSchedule(h)}
            </p>
            <p className="mt-1 flex items-start gap-1.5 text-xs text-slate-500">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="line-clamp-1">{h.address}</span>
            </p>
            <p className="mt-2 text-sm font-bold text-slate-900">{formatInr(h.estimatedTotal)}</p>

            <div className="mt-3 flex gap-2">
              <button type="button" className={`${BTN_OUTLINE} flex-1`} onClick={() => onTrack(h.ref)}>
                Track
              </button>
              <button
                type="button"
                className={`${BTN_SOLID} flex-1 inline-flex items-center justify-center gap-1`}
                onClick={() => onRebook(h)}
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden />
                Rebook
              </button>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
