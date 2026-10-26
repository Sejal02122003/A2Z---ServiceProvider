import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { motion, useReducedMotion } from 'framer-motion'
import {
  Calendar,
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
import { CancelBookingModal } from '../../components/app/booking/CancelBookingModal.jsx'
import { RescheduleBookingModal } from '../../components/app/booking/RescheduleBookingModal.jsx'

const BOOKING_STEPS = [
  { id: 'CREATED', label: 'Booking Created' },
  { id: 'BROADCASTING', label: 'Searching for Workers' },
  { id: 'ACCEPTED', label: 'Service Provider Accepted' },
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
  const [showCancelModal, setShowCancelModal] = useState(false)
  const [showRescheduleModal, setShowRescheduleModal] = useState(false)
  const [labourLocation, setLabourLocation] = useState(null)

  const [cancellingItemId, setCancellingItemId] = useState(null)
  const [itemCancelReason, setItemCancelReason] = useState('')
  const [isCancellingItem, setIsCancellingItem] = useState(false)
  const [cancelItemError, setCancelItemError] = useState('')

  const handleCancelItem = async () => {
    if (!cancellingItemId || !booking?._id) return
    setIsCancellingItem(true)
    setCancelItemError('')
    try {
      await bookingsApi.cancelBookingItem(booking._id, cancellingItemId, {
        reason: itemCancelReason || 'Customer requested item cancellation',
      })
      const res = await bookingsApi.getBookingStatus(booking._id)
      if (res.data?.booking) {
        setBooking(res.data.booking)
      }
      setCancellingItemId(null)
      setItemCancelReason('')
    } catch (err) {
      setCancelItemError(err instanceof ApiError ? err.message : 'Failed to cancel item')
    } finally {
      setIsCancellingItem(false)
    }
  }

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
    const isCancelled = booking.status === 'CANCELLED'
    const shortCode = String(booking._id).slice(-6).toUpperCase()

    return (
      <div className="space-y-4 font-sans pb-12">
        <AppStackScreenHeader title="Job Status" backTo="/app/my-bookings" />
        <GlassPanel className="p-6 text-center space-y-4">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 shadow-sm border border-rose-200">
            <span className="text-2xl font-black text-rose-600">✕</span>
          </div>
          <div>
            <h3 className="text-xl font-black text-slate-900">
              Booking {isCancelled ? 'Cancelled' : 'Failed'}
            </h3>
            <p className="text-xs font-semibold text-slate-500 mt-1">
              Booking #{shortCode}
            </p>
          </div>

          <div className="rounded-2xl bg-rose-50/70 border border-rose-100 p-4 text-left space-y-2">
            {booking.cancellationReason && (
              <div className="text-xs">
                <span className="font-bold text-rose-900">Reason: </span>
                <span className="font-semibold text-rose-700">{booking.cancellationReason}</span>
              </div>
            )}
            {booking.cancelledBy && (
              <div className="text-xs">
                <span className="font-bold text-rose-900">Cancelled By: </span>
                <span className="font-semibold text-rose-700">
                  {booking.cancelledBy === 'CUSTOMER' ? 'Customer' : booking.cancelledBy}
                </span>
              </div>
            )}
            {booking.cancelledAt && (
              <div className="text-xs text-rose-600 font-medium">
                Cancelled on {new Date(booking.cancelledAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
              </div>
            )}
            {!booking.cancellationReason && (
              <p className="text-xs text-rose-700 font-medium">
                {isCancelled
                  ? 'This booking has been cancelled and is no longer active.'
                  : 'No service partners were available for this request. Please try again.'}
              </p>
            )}
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => navigate('/app/my-bookings')}
              className="w-full rounded-xl bg-slate-900 py-3 text-sm font-bold text-white shadow-sm hover:bg-slate-800 transition"
            >
              View My Bookings
            </button>
            <button
              type="button"
              onClick={() => navigate('/app')}
              className="w-full rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              Book Another Service
            </button>
          </div>
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
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Assigned Service Provider</p>
          </div>
          <div className="flex items-center gap-4 p-4">
            {labor.profileImageUrl || labor.profilePic ? (
              <img src={labor.profileImageUrl || labor.profilePic} alt="" className="h-14 w-14 rounded-2xl object-cover ring-2 ring-white" />
            ) : (
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand">
                <User className="h-7 w-7" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-base font-extrabold text-slate-900">{labor.fullName || 'Service Provider'}</p>
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

      {/* Package Info if booked as Package */}
      {booking.packageBooking?.isPackage && (
        <GlassPanel className="p-4 text-sm border-indigo-200/80 bg-indigo-50/40">
          <div className="flex items-center justify-between pb-2 border-b border-indigo-100">
            <span className="font-extrabold text-indigo-950 flex items-center gap-1.5">
              <span>📦</span> {booking.packageBooking.packageName}
            </span>
            {booking.packageBooking.snapshot?.badge && (
              <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[9px] font-black text-slate-900 shadow-2xs">
                {booking.packageBooking.snapshot.badge}
              </span>
            )}
          </div>
          {booking.packageBooking.inclusions && booking.packageBooking.inclusions.length > 0 && (
            <div className="mt-2.5 space-y-1.5">
              <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Included Services</p>
              <div className="grid grid-cols-1 gap-1.5">
                {booking.packageBooking.inclusions.map((inc, i) => (
                  <div key={i} className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-indigo-100 text-xs">
                    <span className="font-semibold text-slate-800">✓ {inc.name}</span>
                    <span className="font-bold text-slate-500">Qty: {inc.quantity || 1}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </GlassPanel>
      )}

      {/* Multi-Service Items List */}
      {booking.multiServiceBooking?.isMultiService && booking.multiServiceBooking?.items?.length > 0 && (
        <GlassPanel className="p-4 text-sm border-brand/20 bg-white">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-3">
            <span className="font-extrabold text-slate-900 flex items-center gap-1.5 text-sm">
              <span className="text-base">✨</span> Booked Services ({booking.multiServiceBooking.items.length})
            </span>
            <span className="text-[10px] font-bold text-brand uppercase tracking-wider bg-brand/10 px-2 py-0.5 rounded-full">
              Multi-Service
            </span>
          </div>

          <div className="space-y-3">
            {booking.multiServiceBooking.items.map((item, idx) => {
              const isItemCancellable = ['PENDING', 'ACCEPTED'].includes(item.status) && !['COMPLETED', 'CANCELLED', 'STARTED'].includes(item.status)
              return (
                <div key={item._id || idx} className="rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      {item.iconUrl ? (
                        <img src={item.iconUrl} alt="" className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-brand/10 text-brand flex items-center justify-center font-bold text-xs shrink-0">
                          #{idx + 1}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 break-words">{item.serviceName}</p>
                        {item.subServiceName && (
                          <p className="text-xs text-brand font-semibold">{item.subServiceName}</p>
                        )}
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Qty: {item.quantity || 1} · ₹{item.unitPrice || 0}/item
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-black text-slate-900">₹{item.itemTotal || 0}</p>
                      <span className={`inline-block mt-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                        item.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800'
                        : item.status === 'STARTED' ? 'bg-purple-100 text-purple-700'
                        : item.status === 'ACCEPTED' ? 'bg-teal-100 text-teal-700'
                        : item.status === 'CANCELLED' ? 'bg-rose-100 text-rose-700'
                        : 'bg-amber-100 text-amber-700'
                      }`}>
                        {item.status || 'PENDING'}
                      </span>
                    </div>
                  </div>

                  {/* Assigned Provider info for this item */}
                  {item.assignedLabourId && (
                    <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200/60 text-slate-600">
                      <span className="font-medium">Provider: {item.assignedLabourId.fullName || 'Assigned'}</span>
                      {item.assignedLabourId.phone && (
                        <a href={`tel:${item.assignedLabourId.phone}`} className="text-brand font-bold text-[11px] flex items-center gap-1">
                          <Phone className="h-3 w-3" /> Call
                        </a>
                      )}
                    </div>
                  )}

                  {/* Item OTPs */}
                  {(item.startOtp || item.completionOtp) && (
                    <div className="flex items-center gap-3 text-xs pt-1 border-t border-slate-200/60 text-slate-600">
                      {item.startOtp && <span>Start OTP: <strong className="font-mono text-slate-900">{item.startOtp}</strong></span>}
                      {item.completionOtp && <span>End OTP: <strong className="font-mono text-slate-900">{item.completionOtp}</strong></span>}
                    </div>
                  )}

                  {/* Individual Cancellation Button */}
                  {isItemCancellable && (
                    <div className="pt-1 flex justify-end">
                      <button
                        type="button"
                        onClick={() => {
                          setCancellingItemId(item._id)
                          setItemCancelReason('')
                          setCancelItemError('')
                        }}
                        className="text-[11px] font-bold text-rose-600 hover:text-rose-700 underline"
                      >
                        Cancel this service
                      </button>
                    </div>
                  )}

                  {item.cancellationReason && (
                    <p className="text-[10px] text-rose-600 italic">Cancelled: {item.cancellationReason}</p>
                  )}
                </div>
              )
            })}
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
                  <p className="text-[10px] font-bold text-slate-500 mb-1 truncate">{a.labourId?.fullName || 'Service Provider'}</p>
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
                  <p className="text-[10px] font-bold text-slate-500 mb-1 truncate">{a.labourId?.fullName || 'Service Provider'}</p>
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

      {/* Customer Reschedule & Cancellation Options */}
      {['CREATED', 'BROADCASTING', 'ACCEPTED', 'ASSIGNED', 'PARTIALLY_ACCEPTED'].includes(booking.status) && (
        <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={() => setShowRescheduleModal(true)}
            className="flex-1 rounded-2xl border border-blue-200 bg-blue-50/80 py-3 px-4 text-sm font-bold text-blue-700 hover:bg-blue-100 hover:border-blue-300 transition shadow-sm flex items-center justify-center gap-2"
          >
            <Calendar className="h-4 w-4" />
            <span>Reschedule Booking</span>
          </button>
          <button
            type="button"
            onClick={() => setShowCancelModal(true)}
            className="flex-1 rounded-2xl border border-rose-200 bg-rose-50/70 py-3 px-4 text-sm font-bold text-rose-700 hover:bg-rose-100 hover:border-rose-300 transition shadow-sm flex items-center justify-center gap-2"
          >
            <span>Cancel This Booking</span>
          </button>
        </div>
      )}

      {/* Cancel Booking Modal */}
      <CancelBookingModal
        open={showCancelModal}
        booking={booking}
        onClose={() => setShowCancelModal(false)}
        onSuccess={() => {
          setShowCancelModal(false)
          navigate('/app', { replace: true })
        }}
      />

      {/* Reschedule Booking Modal */}
      <RescheduleBookingModal
        open={showRescheduleModal}
        booking={booking}
        onClose={() => setShowRescheduleModal(false)}
        onSuccess={(updatedBooking) => {
          setBooking(updatedBooking)
        }}
      />

      {/* Cancel Item Confirmation Modal */}
      {cancellingItemId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl ring-1 ring-slate-900/5">
            <h3 className="text-base font-extrabold text-slate-900">Cancel Selected Service?</h3>
            <p className="mt-1 text-xs text-slate-500">
              Only this service item will be cancelled. Your remaining booked services will proceed as scheduled.
            </p>

            <div className="mt-3">
              <label className="text-xs font-bold text-slate-700 block mb-1">Reason for cancellation</label>
              <textarea
                value={itemCancelReason}
                onChange={(e) => setItemCancelReason(e.target.value)}
                placeholder="e.g. Changed mind, booked wrong variant"
                rows={2}
                className="w-full text-xs rounded-xl border border-slate-200 p-2.5 focus:border-brand focus:ring-1 focus:ring-brand outline-none"
              />
            </div>

            {cancelItemError && (
              <p className="mt-2 text-xs font-semibold text-rose-600">{cancelItemError}</p>
            )}

            <div className="mt-4 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setCancellingItemId(null)}
                disabled={isCancellingItem}
                className="rounded-lg px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 transition disabled:opacity-50"
              >
                Keep Service
              </button>
              <button
                type="button"
                onClick={handleCancelItem}
                disabled={isCancellingItem}
                className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-700 transition flex items-center gap-1.5 disabled:opacity-50"
              >
                {isCancellingItem ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                {isCancellingItem ? 'Cancelling...' : 'Confirm Cancellation'}
              </button>
            </div>
          </div>
        </div>
      )}

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
