import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { AlertCircle, Check, Clock, IndianRupee, Loader2, MapPin, X, Zap } from 'lucide-react'
import { useSelector } from 'react-redux'
import { broadcastsApi } from '../../api/broadcastsApi.js'
import { ApiError } from '../../api/http.js'
import { useSocket } from '../../context/SocketContext.jsx'
import { USER_ROLES } from '../../constants/userRoles.js'

function formatScheduleDate(dateValue) {
  if (!dateValue) return ''
  const d = new Date(dateValue)
  if (isNaN(d.getTime())) return String(dateValue)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const year = d.getFullYear()
  return `${day}/${month}/${year}`
}

export function BroadcastPopup() {
  const socket = useSocket()
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const user = useSelector((s) => s.auth.user)
  const timerRef = useRef(null)

  const [incoming, setIncoming] = useState(null)
  const [timeLeft, setTimeLeft] = useState(90)
  const [responding, setResponding] = useState(false)
  const [error, setError] = useState('')
  const [selectedServiceId, setSelectedServiceId] = useState(null)
  const audioCtxRef = useRef(null)

  // Web Audio chime generator
  const playAlertChime = useCallback(() => {
    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext
      if (!AudioCtxClass) return
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioCtxClass()
      }
      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') {
        ctx.resume()
      }

      const now = ctx.currentTime

      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()
      osc1.type = 'triangle'
      osc1.frequency.setValueAtTime(880, now) // A5
      gain1.gain.setValueAtTime(0.35, now)
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22)
      osc1.connect(gain1)
      gain1.connect(ctx.destination)
      osc1.start(now)
      osc1.stop(now + 0.22)

      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.type = 'triangle'
      osc2.frequency.setValueAtTime(1174.66, now + 0.18) // D6
      gain2.gain.setValueAtTime(0.4, now + 0.18)
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.45)
      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.start(now + 0.18)
      osc2.stop(now + 0.45)
    } catch (e) {
      console.warn('[Broadcast Chime Error]', e)
    }
  }, [])

  // Only render for labour / contractor / service provider users
  const roleLower = String(user?.role || '').toLowerCase()
  const isLabour = roleLower === 'labour' || roleLower === 'contractor'

  const handleBroadcast = useCallback((data) => {
    if (!data) return
    console.log('--- BOOKING_RECEIVED EVENT ---', data)
    const timeout = Math.max(5, Math.floor((data.timeoutMs || 90000) / 1000))
    setIncoming(data)
    setTimeLeft(timeout)
    setError('')
    setResponding(false)
    setSelectedServiceId(null)
    playAlertChime()

    // Browser notification fallback if granted
    if (window.Notification && Notification.permission === 'granted') {
      try {
        const title = data.type === 'SCHEDULED' ? 'Scheduled Job Offer! ⏰' : 'New Job Offer! ⚡'
        new Notification(title, {
          body: `${data.serviceName || 'Service'} · ₹${data.estimatedEarnings || 0}`,
          icon: '/favicon.ico'
        })
      } catch { /* ignore */ }
    }
  }, [playAlertChime])

  // Listen for real-time WebSocket broadcast events
  useEffect(() => {
    if (!isLabour) {
      setIncoming(null)
      return
    }
    if (!socket) return

    socket.on('BOOKING_RECEIVED', handleBroadcast)
    const handleExpired = (data) => {
      setIncoming((prev) => (prev?.bookingId === data.bookingId ? null : prev))
    }
    socket.on('BOOKING_EXPIRED', handleExpired)

    return () => {
      socket.off('BOOKING_RECEIVED', handleBroadcast)
      socket.off('BOOKING_EXPIRED', handleExpired)
    }
  }, [socket, isLabour, handleBroadcast])

  // Periodic fallback: Poll for active broadcasts in case of socket reconnection or page refresh
  useEffect(() => {
    if (!isLabour) return

    let cancelled = false
    const fetchActive = async () => {
      if (incoming) return // already displaying an offer
      try {
        const res = await broadcastsApi.getActiveBroadcast()
        if (!cancelled && res?.data?.broadcast && !incoming) {
          handleBroadcast(res.data.broadcast)
        }
      } catch {
        // ignore background poll errors
      }
    }

    fetchActive()
    const interval = setInterval(fetchActive, 4000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [isLabour, incoming, handleBroadcast])

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

  const services = incoming?.services || []
  const requiresSelection = incoming?.requiresServiceSelection && services.length > 1
  const selectedService = services.find(s => (s.itemId || s.serviceId) === selectedServiceId)

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
      const chosen = services.find(s => (s.itemId || s.serviceId) === selectedServiceId)
      const payload = chosen
        ? { serviceId: chosen.serviceId, itemId: chosen.itemId }
        : (selectedServiceId ? { serviceId: selectedServiceId } : {})
      await broadcastsApi.acceptBroadcast(incoming.bookingId, payload)
      if (timerRef.current) clearInterval(timerRef.current)
      const bookingId = incoming.bookingId
      setIncoming(null)
      navigate(`/app/active-job/${bookingId}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to accept')
      setResponding(false)
    }
  }, [incoming, navigate, selectedServiceId, services])

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

  if (!isLabour) return null

  return (
    <AnimatePresence>
      {incoming && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9998] bg-black/60 backdrop-blur-sm"
          />

          {/* Popup */}
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 60, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, y: 40, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed inset-x-4 bottom-6 z-[9999] mx-auto max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden"
          >
            {/* Timer Bar */}
            <div className="relative h-1.5 overflow-hidden rounded-t-3xl bg-slate-100">
              <motion.div
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: (incoming.timeoutMs || 90000) / 1000, ease: 'linear' }}
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-brand to-blue-400"
              />
            </div>

            <div className="p-5 max-h-[82vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                    incoming.type === 'SCHEDULED' ? 'bg-amber-500/10 text-amber-600' : 'bg-brand/10 text-brand'
                  }`}>
                    {incoming.type === 'SCHEDULED' ? <Clock className="h-5 w-5" aria-hidden /> : <Zap className="h-5 w-5" aria-hidden />}
                  </span>
                  <div>
                    <p className="text-base font-extrabold text-slate-900">
                      {incoming.type === 'SCHEDULED' ? 'Scheduled Job Offer! 📅' : 'New Instant Job! ⚡'}
                    </p>
                    <p className="text-xs font-semibold text-slate-500">
                      {incoming.type === 'SCHEDULED'
                        ? `Starts at ${incoming.time || 'scheduled time'}`
                        : 'Immediate arrival requested'
                      }
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 ring-1 ring-amber-200/80">
                  <Clock className="h-3.5 w-3.5 text-amber-600" aria-hidden />
                  <span className="text-sm font-extrabold text-amber-700">{timeLeft}s</span>
                </div>
              </div>

              {/* Customer & Service Information Card */}
              <div className="mt-4 rounded-2xl bg-brand/5 p-3.5 space-y-2.5 border border-brand/15">
                <div className="flex items-center justify-between gap-2 border-b border-brand/10 pb-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-brand/80">Customer</p>
                    <p className="text-sm font-extrabold text-slate-900 truncate">
                      {incoming.customerName || incoming.customer?.fullName || incoming.customer?.name || 'Customer'}
                    </p>
                  </div>
                  {incoming.categoryName && (
                    <span className="shrink-0 rounded-lg bg-white/90 px-2 py-0.5 text-[10px] font-bold text-slate-700 shadow-2xs border border-brand/15">
                      {incoming.categoryName}
                    </span>
                  )}
                </div>

                {!requiresSelection && incoming.serviceName && (
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-brand/80">Service</p>
                      {incoming.subServiceName && (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                          {incoming.subServiceName}
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-black text-slate-900 leading-snug break-words">
                      {incoming.serviceName}
                    </p>
                    {(incoming.serviceDetail || incoming.description || incoming.notes) && (
                      <div className="mt-1.5 rounded-xl bg-white/80 p-2 text-xs text-slate-600 border border-slate-200/60 space-y-0.5">
                        <span className="font-bold text-slate-700 block text-[11px]">Service Details:</span>
                        <p className="leading-relaxed text-slate-600">
                          {incoming.serviceDetail || incoming.description || incoming.notes}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Service Selection for multi-service contractor bookings */}
              {requiresSelection && (
                <div className="mt-4">
                  <p className="text-xs font-bold text-slate-600 mb-2 uppercase tracking-wide">
                    Choose your service:
                  </p>
                  <div className="space-y-2">
                    {services.map((svc) => {
                      const svcKey = svc.itemId || svc.serviceId
                      const isSelected = selectedServiceId === svcKey
                      return (
                        <button
                          key={svcKey}
                          type="button"
                          onClick={() => setSelectedServiceId(svcKey)}
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
                      {incoming.date ? formatScheduleDate(incoming.date) : ''} {incoming.time ? `at ${incoming.time}` : ''}
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
                <div className="mt-2 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700 border border-rose-200 space-y-1">
                  <p className="flex items-center gap-1">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {error}
                  </p>
                  {(error.toLowerCase().includes('wallet') || error.toLowerCase().includes('recharge') || error.toLowerCase().includes('balance')) && (
                    <button
                      type="button"
                      onClick={() => {
                        setIncoming(null)
                        navigate('/app/labor-wallet')
                      }}
                      className="mt-1 block text-xs font-extrabold text-brand underline"
                    >
                      Go to My Wallet to Recharge &rarr;
                    </button>
                  )}
                  {error.toLowerCase().includes('subscription') && (
                    <button
                      type="button"
                      onClick={() => {
                        setIncoming(null)
                        navigate('/app/subscriptions')
                      }}
                      className="mt-1 block text-xs font-extrabold text-brand underline"
                    >
                      View Plans &amp; Subscribe &rarr;
                    </button>
                  )}
                  {(error.toLowerCase().includes('kyc') || error.toLowerCase().includes('identity') || error.toLowerCase().includes('verification')) && (
                    <button
                      type="button"
                      onClick={() => {
                        setIncoming(null)
                        navigate('/app/kyc')
                      }}
                      className="mt-1 block text-xs font-extrabold text-brand underline"
                    >
                      Complete KYC / Identity Verification &rarr;
                    </button>
                  )}
                </div>
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
