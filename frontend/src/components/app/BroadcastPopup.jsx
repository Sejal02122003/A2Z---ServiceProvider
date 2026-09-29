import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { AlertCircle, Check, Clock, IndianRupee, Loader2, MapPin, X, Zap } from 'lucide-react'
import { useSelector } from 'react-redux'
import { broadcastsApi } from '../../api/broadcastsApi.js'
import { ApiError } from '../../api/http.js'
import { useSocket } from '../../context/SocketContext.jsx'
import { USER_ROLES } from '../../constants/userRoles.js'

export function BroadcastPopup() {
  const socket = useSocket()
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const user = useSelector((s) => s.auth.user)
  const timerRef = useRef(null)

  const [incoming, setIncoming] = useState(null)
  const [timeLeft, setTimeLeft] = useState(30)
  const [responding, setResponding] = useState(false)
  const [error, setError] = useState('')
  const [selectedServiceId, setSelectedServiceId] = useState(null)

  // Only render for labour and contractor users
  const isWorkerOrContractor = user?.role === USER_ROLES.LABOUR || user?.role === 'labour' || user?.role === USER_ROLES.CONTRACTOR || user?.role === 'contractor'

  // Listen for broadcast events
  useEffect(() => {
    if (!socket || !isWorkerOrContractor) return

    const handleBroadcast = (data) => {
      console.log('--- BOOKING_RECEIVED EVENT ---', data);
      const timeout = Math.floor((data.timeoutMs || 30000) / 1000)
      setIncoming(data)
      setTimeLeft(timeout)
      setError('')
      setResponding(false)
      setSelectedServiceId(null)
    }

    socket.on('BOOKING_RECEIVED', handleBroadcast)
    const handleExpired = (data) => {
      setIncoming((prev) => (prev?.bookingId === data.bookingId ? null : prev))
    }
    socket.on('BOOKING_EXPIRED', handleExpired)

    return () => {
      socket.off('BOOKING_RECEIVED', handleBroadcast)
      socket.off('BOOKING_EXPIRED', handleExpired)
    }
  }, [socket, isWorkerOrContractor])

  // Countdown timer
  useEffect(() => {
    if (!incoming) return

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          if (incoming?.bookingId) broadcastsApi.rejectBroadcast(incoming.bookingId).catch(() => {})
          setIncoming(null)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [incoming])

  const handleAccept = useCallback(async () => {
    if (!incoming) return

    // If multi-service and no selection yet, prompt
    if (incoming.requiresServiceSelection && !selectedServiceId) {
      setError('Please choose which service you want to accept.')
      return
    }

    setResponding(true)
    setError('')
    try {
      const payload = selectedServiceId ? { serviceId: selectedServiceId } : {}
      await broadcastsApi.acceptBroadcast(incoming.bookingId, payload)
      if (timerRef.current) clearInterval(timerRef.current)
      const bookingId = incoming.bookingId
      setIncoming(null)
      navigate(`/app/active-job/${bookingId}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to accept')
      setResponding(false)
    }
  }, [incoming, navigate, selectedServiceId])

  const handleReject = useCallback(async () => {
    if (!incoming) return
    setResponding(true)
    try {
      await broadcastsApi.rejectBroadcast(incoming.bookingId)
    } catch {
      /* ignore */
    } finally {
      if (timerRef.current) clearInterval(timerRef.current)
      setIncoming(null)
      setResponding(false)
    }
  }, [incoming])

  if (!isWorkerOrContractor) return null

  const services = incoming?.services || []
  const requiresSelection = incoming?.requiresServiceSelection && services.length > 1
  const selectedService = services.find(s => s.serviceId === selectedServiceId)

  return (
    <AnimatePresence>
      {incoming && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] bg-black/60 backdrop-blur-sm"
          />

          {/* Popup */}
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 60, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, y: 40, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed inset-x-4 bottom-6 z-[301] mx-auto max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden"
          >
            {/* Timer Bar */}
            <div className="relative h-1.5 overflow-hidden rounded-t-3xl bg-slate-100">
              <motion.div
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: (incoming.timeoutMs || 30000) / 1000, ease: 'linear' }}
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-brand to-blue-400"
              />
            </div>

            <div className="p-5 max-h-[82vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
                    <Zap className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <p className="text-base font-extrabold text-slate-900">New Job!</p>
                    <p className="text-xs text-slate-500">{incoming.type || 'INSTANT'} booking</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 ring-1 ring-amber-200/80">
                  <Clock className="h-3.5 w-3.5 text-amber-600" aria-hidden />
                  <span className="text-sm font-extrabold text-amber-700">{timeLeft}s</span>
                </div>
              </div>

              {/* Customer Details */}
              {(incoming.customerName || incoming.customer) && (
                <div className="mt-4 rounded-2xl bg-brand/5 p-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-brand/80">Customer</p>
                    <p className="text-sm font-bold text-slate-900">{incoming.customerName || incoming.customer?.fullName || incoming.customer?.name}</p>
                  </div>
                  {!requiresSelection && incoming.serviceName && (
                    <div className="text-right">
                      <p className="text-xs font-semibold text-brand/80">Service</p>
                      <p className="text-sm font-bold text-slate-900 line-clamp-1">{incoming.serviceName}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Service Selection for multi-service contractor bookings */}
              {requiresSelection && (
                <div className="mt-4">
                  <p className="text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">
                    Choose your service:
                  </p>
                  <div className="space-y-2">
                    {services.map((svc) => {
                      const isSelected = selectedServiceId === svc.serviceId
                      return (
                        <button
                          key={svc.serviceId}
                          type="button"
                          onClick={() => setSelectedServiceId(svc.serviceId)}
                          className={`w-full flex items-center justify-between rounded-2xl border-2 px-4 py-3 text-left transition ${
                            isSelected
                              ? 'border-brand bg-brand/5 shadow-sm'
                              : 'border-slate-200 bg-white hover:border-brand/40'
                          }`}
                        >
                          <div>
                            <p className="font-bold text-sm text-slate-900">{svc.name}</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              ₹{svc.pricePerHour}/hr · {incoming.duration || 1} hr{(incoming.duration || 1) > 1 ? 's' : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="text-right">
                              <p className="text-[10px] text-slate-400">You earn</p>
                              <p className="font-extrabold text-blue-700 text-base">₹{svc.estimatedEarnings}</p>
                            </div>
                            <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition ${
                              isSelected ? 'border-brand bg-brand' : 'border-slate-300'
                            }`}>
                              {isSelected && <Check className="h-3 w-3 text-white" />}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Single-service or selected-service earnings */}
              <div className="mt-4 space-y-2 rounded-2xl bg-slate-50 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-slate-500">
                    <IndianRupee className="h-3.5 w-3.5" aria-hidden />
                    {requiresSelection ? 'Selected Earnings' : 'Estimated Earnings'}
                  </span>
                  <span className="text-lg font-extrabold text-blue-700">
                    {requiresSelection
                      ? selectedService ? `₹${selectedService.estimatedEarnings}` : '—'
                      : `₹${incoming.estimatedEarnings || incoming.laborShare || incoming.basePrice}`
                    }
                  </span>
                </div>
                {(incoming.date || incoming.time) && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Schedule</span>
                    <span className="font-bold text-slate-800">
                      {incoming.date ? new Date(incoming.date).toLocaleDateString() : ''} {incoming.time ? `at ${incoming.time}` : ''}
                    </span>
                  </div>
                )}
                {incoming.duration && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">Duration</span>
                    <span className="font-bold text-slate-800">{incoming.duration} {incoming.duration === 1 ? 'Hour' : 'Hours'}</span>
                  </div>
                )}
                {(incoming.customerLocation || incoming.address) && (
                  <div className="flex items-start gap-1.5 text-sm mt-2 border-t border-slate-200 pt-2">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
                    <span className="text-slate-700">
                      {incoming.customerLocation || (typeof incoming.address === 'object' ? incoming.address.locationText : incoming.address)}
                    </span>
                  </div>
                )}
                {incoming.approximateDistance !== undefined && (
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-slate-500">Distance</span>
                    <span className="font-bold text-slate-800">
                      {incoming.approximateDistance < 1
                        ? `${(incoming.approximateDistance * 1000).toFixed(0)} m`
                        : `${incoming.approximateDistance.toFixed(1)} km`
                      }
                    </span>
                  </div>
                )}
              </div>

              {error && (
                <p className="mt-2 flex items-center gap-1 rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
                </p>
              )}

              {/* Actions */}
              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={responding}
                  onClick={handleReject}
                  className="flex items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white px-4 py-3.5 text-sm font-extrabold text-slate-600 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 active:scale-[0.97] disabled:opacity-50"
                >
                  <X className="h-4 w-4" aria-hidden />
                  Reject
                </button>
                <button
                  type="button"
                  disabled={responding || (requiresSelection && !selectedServiceId)}
                  onClick={handleAccept}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-brand/25 transition hover:bg-brand/90 active:scale-[0.97] disabled:opacity-50"
                >
                  {responding ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Check className="h-4 w-4" aria-hidden />
                      {requiresSelection && !selectedServiceId ? 'Pick Service' : 'Accept'}
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
