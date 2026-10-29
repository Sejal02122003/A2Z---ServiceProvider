import { Link } from 'react-router-dom'
import { CalendarClock, FastForward, MapPin, RefreshCw } from 'lucide-react'
import { BookingWorkflowTimeline } from './BookingWorkflowTimeline.jsx'
import {
  bookingStatusToUi,
  formatBookingSchedule,
  formatInr,
  isDemoBooking,
  totalWorkersFromLines,
} from '../../../lib/individualBookings.js'

const BTN_PRIMARY =
  'inline-flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-bold text-white transition active:opacity-90'
const BTN_SECONDARY =
  'inline-flex w-full items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-800 transition active:bg-slate-50'

export function IndividualBookingDetail({ booking, onRebook, onBack, onAdvancePipeline }) {
  const st = bookingStatusToUi(booking.status)
  const demo = isDemoBooking(booking)
  const workers = totalWorkersFromLines(booking.lines)

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="font-mono text-sm font-bold text-brand">{booking.ref}</p>
            <p className="mt-1 text-xs text-slate-500">
              {new Date(booking.createdAt).toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {demo ? (
              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">Sample</span>
            ) : null}
            <span className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${st.tone}`}>{st.label}</span>
          </div>
        </div>

        <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-800">
          <CalendarClock className="h-4 w-4 text-slate-500" aria-hidden />
          {formatBookingSchedule(booking)}
        </p>

        <ul className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          {booking.lines.map((ln, i) => (
            <li key={`${ln.categoryName}-${i}`} className="flex justify-between gap-2 text-sm">
              <span className="font-medium text-slate-900">{ln.categoryName}</span>
              <span className="shrink-0 font-bold text-brand">×{ln.quantity}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-600">{workers} {workers > 1 ? 'service providers' : 'service provider'}</p>

        <p className="mt-3 flex items-start gap-2 text-xs text-slate-600">
          <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {booking.address}
        </p>

        {booking.notes ? <p className="mt-2 text-xs text-slate-600">Note: {booking.notes}</p> : null}

        <p className="mt-3 border-t border-slate-100 pt-3 text-base font-extrabold text-slate-900">
          {formatInr(booking.estimatedTotal)}
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="mb-3 text-sm font-bold text-slate-900">Progress</p>
        <BookingWorkflowTimeline status={booking.status} compact />
        {!demo && booking.status !== 'completed' && booking.status !== 'cancelled' && onAdvancePipeline ? (
          <button
            type="button"
            className="mt-3 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700"
            onClick={() => onAdvancePipeline(booking)}
          >
            <FastForward className="mr-1 inline h-3.5 w-3.5" aria-hidden />
            Demo: next status
          </button>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <button type="button" className={BTN_PRIMARY} onClick={() => onRebook(booking)}>
          <RefreshCw className="h-4 w-4" aria-hidden />
          Rebook
        </button>
        <button type="button" className={BTN_SECONDARY} onClick={onBack}>
          Back to list
        </button>
        <Link to="/user/support" className="py-2 text-center text-xs font-semibold text-brand">
          Need help?
        </Link>
      </div>
    </div>
  )
}
