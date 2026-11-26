import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Calendar, CheckCircle2, Clock, Loader2, MapPin, Sparkles, User, CreditCard, Menu } from 'lucide-react'
import { B2cBookingCard } from '../../components/app/B2cBookingCard.jsx'
import { bookingsApi } from '../../api/bookingsApi.js'
import { ApiError } from '../../api/http.js'
import { useAuth } from '../../hooks/useAuth.js'
import { USER_ROLES } from '../../constants/userRoles.js'
import { AppStackScreenHeader } from '../../components/app/AppStackScreenHeader.jsx'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'

const STATUS_STYLES = {
  CREATED: 'bg-blue-50 text-blue-700 border-blue-200',
  ACCEPTED: 'bg-amber-50 text-amber-700 border-amber-200',
  EN_ROUTE: 'bg-purple-50 text-purple-700 border-purple-200',
  STARTED: 'bg-orange-50 text-orange-700 border-orange-200',
  PAYMENT_PENDING: 'bg-amber-100 text-amber-800 border-amber-200',
  COMPLETED: 'bg-blue-50 text-blue-700 border-blue-200',
  CANCELLED: 'bg-rose-50 text-rose-700 border-rose-200',
}

export function MyBookings() {
  const { user } = useAuth()
  const location = useLocation()
  const isLabour = location.pathname.startsWith('/serviceprovider')
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('active')
  const [pastFilter, setPastFilter] = useState('all') // all | completed | cancelled

  useEffect(() => {
    let cancelled = false
    bookingsApi.getMyBookings()
      .then((res) => {
        if (cancelled) return
        setBookings(res.data?.bookings ?? [])
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load bookings')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const { activeBookings, pastBookings } = useMemo(() => {
    const active = []
    const past = []
    for (const b of bookings) {
      const s = (b.status || '').toUpperCase()
      const isPaid = (b.paymentStatus || '').toUpperCase() === 'PAID'
      if ((s === 'COMPLETED' && isPaid) || s === 'CANCELLED') {
        past.push(b)
      } else {
        active.push(b)
      }
    }
    return { activeBookings: active, pastBookings: past }
  }, [bookings])

  const completedCount = useMemo(
    () => pastBookings.filter((b) => (b.status || '').toUpperCase() === 'COMPLETED').length,
    [pastBookings],
  )
  const cancelledCount = pastBookings.length - completedCount

  const displayed = useMemo(() => {
    if (tab === 'active') return activeBookings
    if (pastFilter === 'all') return pastBookings
    const want = pastFilter === 'completed' ? 'COMPLETED' : 'CANCELLED'
    return pastBookings.filter((b) => (b.status || '').toUpperCase() === want)
  }, [tab, pastFilter, activeBookings, pastBookings])

  const handleBookingUpdated = (updatedBooking) => {
    setBookings((prev) =>
      prev.map((b) => (b._id === updatedBooking._id ? { ...b, ...updatedBooking } : b))
    )
  }

  return (
    <div className="space-y-4 pb-8">
      <AppStackScreenHeader title="My Bookings" backTo={isLabour ? '/serviceprovider' : '/user'} />

      {/* Tab Bar */}
      <GlassPanel className="p-1.5">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100/90 p-0.5">
          {[
            { id: 'active', label: `Active (${activeBookings.length})` },
            { id: 'past', label: `Past (${pastBookings.length})` },
          ].map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-lg py-2.5 text-xs font-bold transition ${
                tab === t.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </GlassPanel>

      {tab === 'past' && !loading && !error && pastBookings.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-0.5 scrollbar-none [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Filter past bookings">
          {[
            { id: 'all', label: 'All', count: pastBookings.length },
            { id: 'completed', label: 'Completed', count: completedCount },
            { id: 'cancelled', label: 'Cancelled', count: cancelledCount },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={pastFilter === f.id}
              onClick={() => setPastFilter(f.id)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold transition ${
                pastFilter === f.id
                  ? 'border-brand bg-brand text-white shadow-sm'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
        </div>
      ) : error ? (
        <GlassPanel className="p-6 text-center">
          <p className="text-sm font-semibold text-rose-700">{error}</p>
        </GlassPanel>
      ) : displayed.length === 0 ? (
        <GlassPanel className="p-8 text-center">
          <Sparkles className="mx-auto h-10 w-10 text-slate-300" aria-hidden />
          <p className="mt-3 text-sm font-semibold text-slate-600">
            {tab === 'active'
              ? 'No active bookings'
              : pastFilter === 'completed'
                ? 'No completed bookings'
                : pastFilter === 'cancelled'
                  ? 'No cancelled bookings'
                  : 'No past bookings'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {tab === 'active' ? 'Book a service to get started!' : 'Your completed bookings will appear here.'}
          </p>
        </GlassPanel>
      ) : (
        <div className="space-y-3">
          {displayed.map((booking, i) => {
            const status = (booking.status || 'CREATED').toUpperCase()
            const subcategory = typeof booking.subcategoryId === 'object' ? booking.subcategoryId : null
            const isActive = status !== 'COMPLETED' && status !== 'CANCELLED'

            return (
              <motion.div
                key={booking._id}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <B2cBookingCard
                  booking={booking}
                  isLabour={isLabour}
                  onBookingUpdated={handleBookingUpdated}
                />
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
