import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle, CalendarX2, ChevronRight, Info } from 'lucide-react'
import { bookingCancellationApi } from '../../../api/bookingCancellationApi.js'

const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`

function formatWindow(mins) {
  const m = Math.max(0, Math.round(Number(mins) || 0))
  if (m === 0) return null
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'}`
  const h = m / 60
  if (Number.isInteger(h)) return `${h} hour${h === 1 ? '' : 's'}`
  return `${Math.floor(m / 60)} hr ${m % 60} min`
}

function penaltyText(t) {
  if (!t.penaltyEnabled || !(t.penaltyValue > 0)) return null
  let base = t.penaltyType === 'FIXED' ? inr(t.penaltyValue) : `${t.penaltyValue}% of the booking amount`
  const bounds = []
  if (t.penaltyType === 'PERCENTAGE') {
    if (t.minPenaltyAmount > 0) bounds.push(`min ${inr(t.minPenaltyAmount)}`)
    if (t.maxPenaltyAmount > 0) bounds.push(`max ${inr(t.maxPenaltyAmount)}`)
  }
  if (bounds.length) base += ` (${bounds.join(', ')})`
  return base
}

/**
 * Shows the cancellation terms (free window, fee / penalty) before the customer confirms a booking.
 * Data comes from the admin-configured cancellation policy.
 */
export function BookingCancellationInfo({ bookingType = '', className = '' }) {
  const [policy, setPolicy] = useState(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    bookingCancellationApi
      .getCustomerPolicyStatus()
      .then((res) => {
        if (!cancelled) setPolicy(res?.data ?? null)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (failed || !policy?.terms) return null
  const t = policy.terms
  const scheduled = String(bookingType).toLowerCase() === 'scheduled'
  const windowText = formatWindow(t.cutoffMinutes)
  const penalty = penaltyText(t)
  const fee = t.cancellationFee > 0 ? inr(t.cancellationFee) : null

  const lines = []
  if (!t.cancellationEnabled) {
    lines.push('Online cancellation is currently unavailable for new bookings. Please contact support for help.')
  } else {
    if (scheduled && windowText) {
      lines.push(`Free cancellation until ${windowText} before your scheduled service time.`)
    } else if (scheduled) {
      lines.push('Free cancellation until your scheduled service starts.')
    } else {
      lines.push('Free cancellation before a service provider is on the way.')
    }

    if (penalty || fee) {
      const when =
        t.penaltyCondition === 'ALWAYS'
          ? 'Cancelling'
          : t.penaltyCondition === 'AFTER_ASSIGNMENT'
            ? 'Cancelling after a service provider is assigned'
            : scheduled && windowText
              ? `Cancelling within ${windowText} of the service time`
              : 'Late cancellation'
      const parts = [penalty, fee ? `a cancellation fee of ${fee}` : null].filter(Boolean)
      lines.push(`${when} may charge ${parts.join(' plus ')}.`)
    } else {
      lines.push('No cancellation charges apply right now.')
    }
  }

  const showWarning = policy.policyEnabled && (policy.warningActive || policy.approachingThreshold)

  return (
    <div className={`lc-booking-flow-card space-y-3 ${className}`}>
      <div className="flex items-center gap-2">
        <CalendarX2 className="h-4 w-4 text-brand" aria-hidden />
        <p className="lc-booking-flow-label font-bold text-slate-800">Cancellation details</p>
      </div>

      <ul className="space-y-1.5 text-xs leading-relaxed text-slate-600">
        {lines.map((line) => (
          <li key={line} className="flex gap-2">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
            <span>{line}</span>
          </li>
        ))}
      </ul>

      {showWarning && (
        <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-[11px] font-medium text-amber-900">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" aria-hidden />
          <span>
            {policy.warningMessage ||
              'You have cancelled multiple bookings recently. Repeated cancellations may lead to restrictions.'}{' '}
            ({policy.eligibleCount} cancelled in the last {policy.windowDays} days)
          </span>
        </div>
      )}

      <Link
        to="/user/cancellation-policy"
        className="inline-flex items-center gap-0.5 text-xs font-bold text-brand hover:underline"
      >
        View full cancellation policy
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </div>
  )
}
