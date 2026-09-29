import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { motion, useReducedMotion } from 'framer-motion'
import {
  Check,
  CheckCircle2,
  Loader2,
  MapPin,
  Phone,
  Star,
  User,
} from 'lucide-react'
import { bookingsApi } from '../../api/bookingsApi.js'
import { ApiError } from '../../api/http.js'
import { useSocket } from '../../context/SocketContext.jsx'
import { setActiveBooking, updateBookingStatus as updateBookingStatusAction, clearActiveBooking } from '../../store/slices/activeBookingSlice.js'
import { AppStackScreenHeader } from '../../components/app/AppStackScreenHeader.jsx'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { BookingReviewModal } from '../../components/app/booking/BookingReviewModal.jsx'

const BOOKING_STEPS = [
  { id: 'CREATED', label: 'Booking Created' },
  { id: 'BROADCASTING', label: 'Searching for Workers' },
  { id: 'ACCEPTED', label: 'Labour Accepted' },
  { id: 'EN_ROUTE', label: 'On the Way' },
  { id: 'STARTED', label: 'Work Started' },
  { id: 'COMPLETED', label: 'Completed' },
]

export function JobTracking() {
  const { bookingId } = useParams()
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const socket = useSocket()
  const reduce = useReducedMotion()

  const [booking, setBooking] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showReview, setShowReview] = useState(false)
  const [labourLocation, setLabourLocation] = useState(null)

  // Fetch booking on mount
  useEffect(() => {
    if (!bookingId) return
    let cancelled = false
    bookingsApi.getBookingStatus(bookingId)
      .then((res) => {
        if (cancelled) return
        const b = res.data?.booking
        if (b) {
          setBooking(b)
          dispatch(setActiveBooking({ bookingId: b._id, status: b.status }))
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load booking')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [bookingId, dispatch])

  // Socket event listeners
  useEffect(() => {
    if (!socket || !bookingId) return

    const handleAccepted = (data) => {
      if (data.bookingId === bookingId) {
        setBooking((prev) => prev ? { ...prev, status: 'ACCEPTED', laborId: data.laborId } : prev)
        dispatch(updateBookingStatusAction('ACCEPTED'))
        // Refetch to get labor details
        bookingsApi.getBookingStatus(bookingId)
          .then((res) => {
            const b = res.data?.booking
            if (b) setBooking(b)
          })
          .catch(() => {})
      }
    }

    const handleStatusUpdate = (data) => {
      if (data.bookingId === bookingId) {
        setBooking((prev) => prev ? { ...prev, status: data.status } : prev)
        dispatch(updateBookingStatusAction(data.status))
        if (data.status === 'COMPLETED') {
          setShowReview(true)
        }
      }
    }

    const handleLocationUpdate = (data) => {
      if (data.bookingId === bookingId && data.lat && data.lng) {
        setLabourLocation({ lat: data.lat, lng: data.lng })
      }
    }

    socket.on('BOOKING_ACCEPTED', handleAccepted)
    socket.on('BOOKING_STATUS_UPDATE', handleStatusUpdate)
    socket.on('LABOUR_LOCATION_UPDATE', handleLocationUpdate)

    return () => {
      socket.off('BOOKING_ACCEPTED', handleAccepted)
      socket.off('BOOKING_STATUS_UPDATE', handleStatusUpdate)
      socket.off('LABOUR_LOCATION_UPDATE', handleLocationUpdate)
    }
  }, [socket, bookingId, dispatch])

  const currentStepIndex = useMemo(() => {
    if (!booking) return 0
    const idx = BOOKING_STEPS.findIndex((s) => s.id === booking.status)
    return idx >= 0 ? idx : 0
  }, [booking])

  const handleReviewClose = useCallback(() => {
    setShowReview(false)
    dispatch(clearActiveBooking())
    navigate('/app/my-bookings', { replace: true })
  }, [dispatch, navigate])

  if (loading) {
    return (
      <div className="space-y-4">
        <AppStackScreenHeader title="Tracking" backTo="/app" />
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
        </div>
      </div>
    )
  }

  if (error || !booking) {
    return (
      <div className="space-y-4">
        <AppStackScreenHeader title="Tracking" backTo="/app" />
        <GlassPanel className="p-6 text-center">
          <p className="text-sm font-semibold text-rose-700">{error || 'Booking not found'}</p>
        </GlassPanel>
      </div>
    )
  }

  if (booking.status === 'FAILED' || booking.status === 'CANCELLED') {
    return (
      <div className="space-y-4">
        <AppStackScreenHeader title="Tracking" backTo="/app" />
        <GlassPanel className="p-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 mb-4">
            <span className="text-2xl font-black text-rose-600">!</span>
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-2">Booking {booking.status === 'FAILED' ? 'Failed' : 'Cancelled'}</h3>
          <p className="text-sm text-slate-500">
            {booking.status === 'FAILED' 
              ? 'No labourers were available to accept this booking. Please try booking again at a different time.' 
              : 'This booking has been cancelled.'}
          </p>
        </GlassPanel>
      </div>
    )
  }

  const labor = booking.laborId || (booking.assignments && booking.assignments[0]?.labourId)
  
  const displayStartOtp = booking.assignments?.length > 0 ? booking.assignments[0].startOtp : booking.startOtp
  const displayCompletionOtp = booking.assignments?.length > 0 ? booking.assignments[0].completionOtp : booking.completionOtp

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 font-sans pb-24">
      <AppStackScreenHeader title="Job Tracking" backTo="/app" />

      {/* Status Badge */}
      <GlassPanel className="border-brand/20 bg-brand/5 px-4 py-3 text-center">
        <p className="text-xs font-bold uppercase tracking-wider text-brand">Current Status</p>
        <p className="mt-1 text-lg font-extrabold text-slate-900">
          {booking.type === 'SCHEDULED' && booking.status === 'CREATED' 
            ? 'Scheduled (Awaiting Worker)' 
            : BOOKING_STEPS[currentStepIndex]?.label || booking.status}
        </p>
      </GlassPanel>

      {/* Map Tracking */}
      {booking.status === 'EN_ROUTE' && labourLocation && (
        <GlassPanel className="overflow-hidden p-0">
          <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-2">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 text-brand" /> Live Tracking
            </p>
          </div>
          <div className="h-48 w-full bg-slate-100 relative">
            <iframe
              width="100%"
              height="100%"
              style={{ border: 0 }}
              loading="lazy"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              src={`https://maps.google.com/maps?q=${labourLocation.lat},${labourLocation.lng}&z=15&output=embed`}
            />
          </div>
        </GlassPanel>
      )}

      {/* Booking Details */}
      <GlassPanel className="p-4">
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">Booking Details</p>
        <div className="space-y-2 text-sm text-slate-700">
          <div className="flex justify-between">
            <span className="font-semibold text-slate-500">Date</span>
            <span className="font-medium text-slate-900">{booking.type === 'SCHEDULED' ? new Date(booking.scheduledAt).toLocaleDateString() : 'ASAP'}</span>
          </div>
          <div className="flex justify-between">
            <span className="font-semibold text-slate-500">Time</span>
            <span className="font-medium text-slate-900">{booking.type === 'SCHEDULED' ? booking.timeSlot : 'Earliest available'}</span>
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-slate-500">Location</span>
            <span className="text-right line-clamp-2 mt-0.5 text-slate-900 font-medium">{booking.address?.locationText}</span>
          </div>
          <div className="flex justify-between border-t border-slate-100 pt-2 font-bold text-slate-900 mt-2">
            <span>Total Bill</span>
            <span>₹{booking.totalAmount?.toLocaleString('en-IN') || 0}</span>
          </div>
        </div>
      </GlassPanel>

      {/* Progress Stepper */}
      <GlassPanel className="p-5">
        <ol className="space-y-3">
          {BOOKING_STEPS.map((step, i) => {
            const done = i <= currentStepIndex
            const isCurrent = i === currentStepIndex
            return (
              <motion.li
                key={step.id}
                initial={reduce ? false : { opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className="flex items-center gap-4"
              >
                <span
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-black shadow-sm transition ${
                    done
                      ? 'bg-brand text-white shadow-brand/30'
                      : 'bg-slate-100 text-slate-400'
                  } ${isCurrent ? 'ring-4 ring-brand/20' : ''}`}
                >
                  {done ? <Check className="h-4 w-4" /> : i + 1}
                </span>
                <span className={`text-sm font-semibold ${done ? 'text-slate-900' : 'text-slate-400'}`}>
                  {step.label}
                </span>
                {isCurrent && (
                  <span className="ml-auto rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand">
                    Active
                  </span>
                )}
              </motion.li>
            )
          })}
        </ol>
      </GlassPanel>

      {/* Laborer Details */}
      {labor && (
        <GlassPanel className="overflow-hidden p-0">
          <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-2">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Assigned Labour</p>
          </div>
          <div className="flex items-center gap-4 p-4">
            {labor.profilePic ? (
              <img src={labor.profileImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(labor.fullName || 'W')}`} alt="" className="h-14 w-14 rounded-2xl object-cover ring-2 ring-white" />
            ) : (
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand">
                <User className="h-7 w-7" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-base font-extrabold text-slate-900">{labor.fullName || 'Labour'}</p>
              {labor.phone && (
                <a href={`tel:${labor.phone}`} className="mt-1 flex items-center gap-1 text-sm font-semibold text-brand">
                  <Phone className="h-3.5 w-3.5" aria-hidden />
                  {labor.phone}
                </a>
              )}
            </div>
          </div>
        </GlassPanel>
      )}

      {/* Booking Info */}
      <GlassPanel className="p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-slate-500">Booking ID</span>
          <span className="font-mono font-bold text-slate-900">{booking._id?.slice(-8) || bookingId}</span>
        </div>
        {booking.totalAmount && (
          <div className="mt-2 flex justify-between">
            <span className="text-slate-500">Total Amount</span>
            <span className="font-bold text-brand">₹{booking.totalAmount}</span>
          </div>
        )}
        {booking.paymentMethod && (
          <div className="mt-2 flex justify-between">
            <span className="text-slate-500">Payment</span>
            <span className="font-bold text-slate-900">{booking.paymentMethod}</span>
          </div>
        )}
      </GlassPanel>

      {/* OTP Display for Customer */}
      {(booking.status === 'EN_ROUTE' && displayStartOtp) ? (
        booking.assignments?.length > 1 ? (
          <GlassPanel className="border-brand/20 bg-brand/5 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-brand text-center mb-3">Start OTPs</p>
            <div className="grid grid-cols-2 gap-3">
              {booking.assignments.map(a => (
                <div key={a.labourId?._id || Math.random()} className="bg-white p-3 rounded-xl border border-brand/10 text-center shadow-sm">
                  <p className="text-[10px] font-bold text-slate-500 mb-1 truncate">{a.labourId?.fullName || 'Labour'}</p>
                  <p className="text-xl font-black tracking-widest text-slate-900">{a.startOtp}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs font-semibold text-slate-600 text-center">Share these with the workers to start the job.</p>
          </GlassPanel>
        ) : (
          <GlassPanel className="border-brand/20 bg-brand/5 p-4 text-center">
            <p className="text-xs font-bold uppercase tracking-wider text-brand">Start OTP</p>
            <p className="mt-2 text-3xl font-black tracking-[0.2em] text-slate-900">{displayStartOtp}</p>
            <p className="mt-1 text-xs font-semibold text-slate-600">Share this with the worker to start the job.</p>
          </GlassPanel>
        )
      ) : (booking.status === 'STARTED' && displayCompletionOtp) ? (
        booking.assignments?.length > 1 ? (
          <GlassPanel className="border-blue-600/20 bg-blue-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-blue-600 text-center mb-3">Completion OTPs</p>
            <div className="grid grid-cols-2 gap-3">
              {booking.assignments.map(a => (
                <div key={a.labourId?._id || Math.random()} className="bg-white p-3 rounded-xl border border-blue-600/10 text-center shadow-sm">
                  <p className="text-[10px] font-bold text-slate-500 mb-1 truncate">{a.labourId?.fullName || 'Labour'}</p>
                  <p className="text-xl font-black tracking-widest text-slate-900">{a.completionOtp}</p>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs font-semibold text-slate-600 text-center">Share these with the workers when the job is completed.</p>
          </GlassPanel>
        ) : (
          <GlassPanel className="border-blue-600/20 bg-blue-50 p-4 text-center">
            <p className="text-xs font-bold uppercase tracking-wider text-blue-600">Completion OTP</p>
            <p className="mt-2 text-3xl font-black tracking-[0.2em] text-slate-900">{displayCompletionOtp}</p>
            <p className="mt-1 text-xs font-semibold text-slate-600">Share this with the worker when the job is completed.</p>
          </GlassPanel>
        )
      ) : null}

      {/* Review Modal */}
      <BookingReviewModal
        open={showReview}
        bookingId={bookingId}
        workerName={booking?.laborId?.fullName || booking?.laborId?.name || booking?.assignments?.[0]?.labourId?.fullName || ''}
        revieweeId={booking?.laborId?._id || booking?.assignments?.[0]?.labourId?._id}
        onClose={handleReviewClose}
        onSubmitted={() => setShowReview(false)}
      />
    </div>
  )
}
