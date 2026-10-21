import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
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
  const isLabour = user?.role === USER_ROLES.LABOUR
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState('active')

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

  const displayed = tab === 'active' ? activeBookings : pastBookings

  const handleBookingUpdated = (updatedBooking) => {
    setBookings((prev) =>
      prev.map((b) => (b._id === updatedBooking._id ? { ...b, ...updatedBooking } : b))
    )
  }

  return (
    <div className="space-y-4 pb-8">
      <div className="mb-4 rounded-3xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3.5">
          <button 
            onClick={() => navigate('/app')}
            className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[14px] border border-slate-200 text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex flex-col justify-center">
            <h1 className="text-[20px] font-bold tracking-tight text-slate-900 leading-none mb-1.5">My bookings</h1>
            <p className="text-[13px] font-medium text-slate-500 leading-none">Hire service providers for your home or small site</p>
          </div>
        </div>
      </div>

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
            {tab === 'active' ? 'No active bookings' : 'No past bookings'}
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
