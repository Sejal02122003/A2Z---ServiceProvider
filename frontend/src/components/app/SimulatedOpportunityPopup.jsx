import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  IndianRupee,
  Layers,
  Loader2,
  MapPin,
  Sparkles,
  X,
  Zap,
} from 'lucide-react'
import { useSelector } from 'react-redux'
import { simulatedOpportunitiesApi } from '../../api/simulatedOpportunitiesApi.js'
import { useSocket } from '../../context/SocketContext.jsx'
import { useLockBodyScroll } from '../../hooks/useLockBodyScroll.js'
import { USER_ROLES } from '../../constants/userRoles.js'
import { playBookingAlertSound, stopBookingAlertSound } from '../../utils/bookingSound.js'

function formatInr(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`
}

export function SimulatedOpportunityPopup() {
  const socket = useSocket()
  const reduce = useReducedMotion()
  const user = useSelector((s) => s.auth.user)
  const timerRef = useRef(null)
  const shownAtRef = useRef(0)

  const [incoming, setIncoming] = useState(null)
  const [timeLeft, setTimeLeft] = useState(15)
  const [responding, setResponding] = useState(false)
  const [resultState, setResultState] = useState(null) // 'RESPONDED' | 'CLOSED'
  const [responseSeconds, setResponseSeconds] = useState(0)

  // Page behind the popup must not scroll
  useLockBodyScroll(Boolean(incoming))

  const isVendor =
    user?.role === USER_ROLES.LABOUR ||
    user?.role === 'labour' ||
    user?.role === USER_ROLES.CONTRACTOR ||
    user?.role === 'contractor'

  const stopAlertSound = useCallback(() => {
    stopBookingAlertSound()
  }, [])

  // Synchronize audio playback with incoming simulated opportunity
  useEffect(() => {
    if (incoming && !resultState) {
      playBookingAlertSound()
    } else {
      stopBookingAlertSound()
    }
    return () => {
      stopBookingAlertSound()
    }
  }, [incoming, resultState])

  const handleAlert = useCallback((data) => {
    if (!data) return
    console.log('--- SIMULATED_OPPORTUNITY_ALERT ---', data)
    let seconds = 15
    if (data.expiresAt) {
      const diffSecs = Math.round((new Date(data.expiresAt).getTime() - Date.now()) / 1000)
      if (diffSecs > 0) {
        seconds = Math.min(30, Math.max(5, diffSecs))
      }
    }

    shownAtRef.current = Date.now()
    setIncoming(data)
    setTimeLeft(seconds)
    setResultState(null)
    setResponding(false)
  }, [])

  // Socket listeners for Simulated Opportunities
  useEffect(() => {
    if (!isVendor) {
      setIncoming(null)
      stopAlertSound()
      return
    }
    if (!socket) return

    const handleClosed = (data) => {
      setIncoming((prev) => {
        if (prev && String(prev.opportunityId || prev.alertId) === String(data.opportunityId)) {
          stopAlertSound()
          setResultState((current) => current || 'CLOSED')
        }
        return prev
      })
    }

    socket.on('SIMULATED_OPPORTUNITY_ALERT', handleAlert)
    socket.on('SIMULATED_OPPORTUNITY_TAKEN', handleClosed)
    socket.on('SIMULATED_OPPORTUNITY_CANCELLED', handleClosed)

    return () => {
      stopAlertSound()
      socket.off('SIMULATED_OPPORTUNITY_ALERT', handleAlert)
      socket.off('SIMULATED_OPPORTUNITY_TAKEN', handleClosed)
      socket.off('SIMULATED_OPPORTUNITY_CANCELLED', handleClosed)
    }
  }, [socket, isVendor, handleAlert, stopAlertSound])

  // On mount or focus: check if there are active OPEN simulated opportunities
  useEffect(() => {
    if (!isVendor) return
    let isMounted = true

    const checkActiveOpportunities = async () => {
      try {
        const res = await simulatedOpportunitiesApi.getVendorOpportunities()
        const list = res?.data?.opportunities || []
        if (!isMounted) return
        const active = list.find(
          (o) => o.status === 'OPEN' && new Date(o.expiresAt) > new Date()
        )
        if (active && !incoming) {
          handleAlert({
            opportunityId: active._id,
            alertId: active._id,
            bookingType: 'SIMULATED',
            isSimulated: true,
            serviceCategory: active.serviceCategory,
            serviceType: active.serviceType,
            location: active.location,
            serviceDate: active.serviceDate,
            serviceTime: active.serviceTime,
            estimatedAmount: active.estimatedAmount,
            expiresAt: active.expiresAt,
            priority: active.priority,
          })
        }
      } catch (err) {
        console.warn('[Check Active Opportunities Error]', err?.message)
      }
    }

    checkActiveOpportunities()

    const onFocus = () => checkActiveOpportunities()
    window.addEventListener('focus', onFocus)
    return () => {
      isMounted = false
      window.removeEventListener('focus', onFocus)
    }
  }, [isVendor, incoming, handleAlert])

  // Countdown: the practice request closes when time runs out
  useEffect(() => {
    if (!incoming || resultState) return

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          stopAlertSound()
          setResultState('CLOSED')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [incoming, resultState, stopAlertSound])

  const handleAccept = useCallback(async () => {
    if (!incoming || responding) return
    const oppId = incoming.opportunityId || incoming.alertId

    stopAlertSound()
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setResponding(true)
    setResponseSeconds(Math.max(1, Math.round((Date.now() - shownAtRef.current) / 1000)))
    try {
      // Records the response for the admin; a practice request never creates a booking
      await simulatedOpportunitiesApi.acceptOpportunity(oppId)
    } catch (err) {
      console.warn('[Practice Request Response Error]', err?.message)
    } finally {
      setResultState('RESPONDED')
      setResponding(false)
    }
  }, [incoming, responding, stopAlertSound])

  const handleReject = useCallback(async () => {
    if (!incoming) return
    stopAlertSound()
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    const oppId = incoming.opportunityId || incoming.alertId
    setIncoming(null)
    setResultState(null)
    setResponding(false)
    try {
      await simulatedOpportunitiesApi.rejectOpportunity(oppId)
    } catch {
      /* ignore */
    }
  }, [incoming, stopAlertSound])

  const handleDismiss = () => {
    stopAlertSound()
    if (timerRef.current) clearInterval(timerRef.current)
    setIncoming(null)
    setResultState(null)
  }

  if (!isVendor) return null

  const serviceNames = Array.isArray(incoming?.services)
    ? incoming.services.map((s) => s?.name || s).filter(Boolean)
    : []
  const quantity = serviceNames.length || 1

  return (
    <AnimatePresence>
      {incoming && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9990] bg-black/60 backdrop-blur-sm touch-none"
          />

          {/* Popup */}
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 60, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, y: 40, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            className="fixed inset-x-4 bottom-6 z-[9991] mx-auto max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden"
          >
            {/* Timer Bar */}
            {!resultState && (
              <div className="relative h-1.5 overflow-hidden rounded-t-3xl bg-slate-100">
                <motion.div
                  key={incoming.opportunityId || incoming.alertId}
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: timeLeft, ease: 'linear' }}
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-brand to-blue-400"
                />
              </div>
            )}

            {/* Practice warning: must stay visible so this is never mistaken for a real booking */}
            <div role="alert" className="flex items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-black text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden />
              <span>Practice job · Not a real booking</span>
            </div>

            <div className="p-5 max-h-[78vh] overflow-y-auto overscroll-contain">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
                    <Zap className="h-5 w-5" aria-hidden />
                  </span>
                  <div>
                    <p className="text-base font-extrabold text-slate-900">Practice Instant Job ⚡</p>
                    <p className="text-xs font-semibold text-slate-500">Test your response time</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!resultState && (
                    <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 ring-1 ring-amber-200/80">
                      <Clock className="h-3.5 w-3.5 text-amber-600" aria-hidden />
                      <span className="text-sm font-extrabold text-amber-700 tabular-nums">{timeLeft}s</span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition"
                    title="Dismiss"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Customer & Service Card */}
              <div className="mt-4 rounded-2xl bg-brand/5 p-3.5 space-y-2.5 border border-brand/15">
                <div className="flex items-center justify-between gap-2 border-b border-brand/10 pb-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-brand/80">Customer</p>
                    <p className="text-sm font-extrabold text-slate-900 truncate">Sample Customer</p>
                  </div>
                  {incoming.serviceCategory && (
                    <span className="shrink-0 rounded-lg bg-white/90 px-2 py-0.5 text-[10px] font-bold text-slate-700 shadow-2xs border border-brand/15">
                      {incoming.serviceCategory}
                    </span>
                  )}
                </div>

                <div className="space-y-2 pt-1">
                  <span className="text-[11px] font-black uppercase tracking-wider text-brand/80 flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-brand" /> Requested Service
                  </span>
                  <div className="rounded-2xl bg-gradient-to-br from-white via-white to-teal-50/40 p-4 border-2 border-teal-500/25 shadow-sm space-y-3">
                    <h3 className="text-base font-black text-slate-900 leading-snug break-words">
                      {incoming.serviceType}
                    </h3>
                    {serviceNames.length > 1 && (
                      <p className="text-xs font-semibold text-slate-600">{serviceNames.join(', ')}</p>
                    )}
                    <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-100">
                      <div className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-1.5 text-xs font-black text-slate-800 border border-slate-200 shadow-2xs">
                        <Layers className="h-4 w-4 text-slate-500" />
                        <span>Qty: {quantity} {quantity === 1 ? 'Item' : 'Items'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Earnings, schedule and address */}
              <div className="mt-4 space-y-2 rounded-2xl bg-slate-50 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-slate-500 font-medium">
                    <IndianRupee className="h-3.5 w-3.5 text-blue-600" aria-hidden />
                    Sample Earnings
                  </span>
                  <span className="text-xl font-black text-blue-700">{formatInr(incoming.estimatedAmount)}</span>
                </div>
                {(incoming.serviceDate || incoming.serviceTime) && (
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-500 font-medium">Schedule</span>
                    <span className="text-right font-bold text-slate-800">
                      {incoming.serviceDate ? new Date(incoming.serviceDate).toLocaleDateString('en-IN') : 'Today'}
                      {incoming.serviceTime ? ` at ${incoming.serviceTime}` : ''}
                    </span>
                  </div>
                )}
                {(incoming.location?.address || incoming.location?.city) && (
                  <div className="flex items-start gap-1.5 text-sm mt-2 border-t border-slate-200 pt-2">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
                    <span className="text-slate-700">{incoming.location.address || incoming.location.city}</span>
                  </div>
                )}
              </div>

              {resultState ? (
                <div className="mt-4 space-y-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center">
                  <CheckCircle2 className="mx-auto h-9 w-9 text-amber-600" aria-hidden />
                  <h4 className="text-sm font-black text-amber-900">
                    {resultState === 'RESPONDED' ? 'Practice complete' : 'Practice request closed'}
                  </h4>
                  <p className="text-xs font-medium text-amber-800">
                    This was a practice request. No booking was made.
                    {resultState === 'RESPONDED' && ` You responded in ${responseSeconds} second${responseSeconds === 1 ? '' : 's'}.`}
                  </p>
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="w-full rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white hover:bg-slate-800"
                  >
                    OK
                  </button>
                </div>
              ) : (
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
                    disabled={responding}
                    onClick={handleAccept}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-brand px-4 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-brand/25 transition hover:bg-brand/90 active:scale-[0.97] disabled:opacity-50"
                  >
                    {responding ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="h-4 w-4" aria-hidden />
                        Accept
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
