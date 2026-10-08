import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  AlertCircle,
  Check,
  CheckCircle2,
  Clock,
  IndianRupee,
  Loader2,
  MapPin,
  Radio,
  ShieldAlert,
  Sparkles,
  X,
  Zap,
} from 'lucide-react'
import { useSelector } from 'react-redux'
import { simulatedOpportunitiesApi } from '../../api/simulatedOpportunitiesApi.js'
import { ApiError } from '../../api/http.js'
import { useSocket } from '../../context/SocketContext.jsx'
import { USER_ROLES } from '../../constants/userRoles.js'

function formatInr(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`
}

export function SimulatedOpportunityPopup() {
  const socket = useSocket()
  const reduce = useReducedMotion()
  const user = useSelector((s) => s.auth.user)
  const timerRef = useRef(null)

  const [incoming, setIncoming] = useState(null)
  const [timeLeft, setTimeLeft] = useState(60)
  const [responding, setResponding] = useState(false)
  const [statusMessage, setStatusMessage] = useState('')
  const [resultState, setResultState] = useState(null) // 'WON' | 'TAKEN' | 'EXPIRED' | 'CANCELLED'

  const isLabour =
    user?.role === USER_ROLES.LABOUR ||
    user?.role === 'labour'

  // Socket listeners for Simulated Opportunities
  useEffect(() => {
    if (!isLabour) {
      setIncoming(null)
      return
    }
    if (!socket) return

    const handleAlert = (data) => {
      console.log('--- SIMULATED_OPPORTUNITY_ALERT ---', data)
      const expiryMs = data.expiresAt ? new Date(data.expiresAt).getTime() - Date.now() : (data.timeoutMs || 60000)
      const seconds = Math.max(5, Math.floor(expiryMs / 1000))

      setIncoming(data)
      setTimeLeft(seconds)
      setStatusMessage('')
      setResultState(null)
      setResponding(false)
    }

    const handleTaken = (data) => {
      console.log('--- SIMULATED_OPPORTUNITY_TAKEN ---', data)
      setIncoming((prev) => {
        if (prev && String(prev.opportunityId || prev.alertId) === String(data.opportunityId)) {
          setResultState('TAKEN')
          setStatusMessage(data.message || 'This opportunity has already been taken by another vendor.')
        }
        return prev
      })
    }

    const handleCancelled = (data) => {
      console.log('--- SIMULATED_OPPORTUNITY_CANCELLED ---', data)
      setIncoming((prev) => {
        if (prev && String(prev.opportunityId || prev.alertId) === String(data.opportunityId)) {
          setResultState('CANCELLED')
          setStatusMessage(data.message || 'This opportunity was cancelled by admin.')
        }
        return prev
      })
    }

    socket.on('SIMULATED_OPPORTUNITY_ALERT', handleAlert)
    socket.on('SIMULATED_OPPORTUNITY_TAKEN', handleTaken)
    socket.on('SIMULATED_OPPORTUNITY_CANCELLED', handleCancelled)

    return () => {
      socket.off('SIMULATED_OPPORTUNITY_ALERT', handleAlert)
      socket.off('SIMULATED_OPPORTUNITY_TAKEN', handleTaken)
      socket.off('SIMULATED_OPPORTUNITY_CANCELLED', handleCancelled)
    }
  }, [socket, isLabour])

  // Countdown timer
  useEffect(() => {
    if (!incoming || resultState) return

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current)
          setResultState('EXPIRED')
          setStatusMessage('This opportunity has expired.')
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [incoming, resultState])

  const handleAccept = useCallback(async () => {
    if (!incoming || responding) return
    const oppId = incoming.opportunityId || incoming.alertId

    setResponding(true)
    setStatusMessage('')
    try {
      await simulatedOpportunitiesApi.acceptOpportunity(oppId)
      if (timerRef.current) clearInterval(timerRef.current)
      setResultState('WON')
      setStatusMessage('Opportunity Secured! Great job staying active and responsive.')
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : err.message || 'Opportunity is no longer available'
      if (err?.statusCode === 409 || msg.toLowerCase().includes('already taken')) {
        setResultState('TAKEN')
      } else if (msg.toLowerCase().includes('expired')) {
        setResultState('EXPIRED')
      } else if (msg.toLowerCase().includes('cancelled')) {
        setResultState('CANCELLED')
      }
      setStatusMessage(msg)
    } finally {
      setResponding(false)
    }
  }, [incoming, responding])

  const handleReject = useCallback(async () => {
    if (!incoming) return
    const oppId = incoming.opportunityId || incoming.alertId
    setResponding(true)
    try {
      await simulatedOpportunitiesApi.rejectOpportunity(oppId)
    } catch {
      /* ignore */
    } finally {
      if (timerRef.current) clearInterval(timerRef.current)
      setIncoming(null)
      setResultState(null)
      setResponding(false)
    }
  }, [incoming])

  const handleDismiss = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    setIncoming(null)
    setResultState(null)
    setStatusMessage('')
  }

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
            className="fixed inset-0 z-[320] bg-slate-950/70 backdrop-blur-xs"
          />

          {/* Alert Card Modal */}
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 60, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? undefined : { opacity: 0, y: 40, scale: 0.92 }}
            transition={{ type: 'spring', stiffness: 320, damping: 26 }}
            className="fixed inset-x-4 bottom-6 z-[321] mx-auto max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden border border-slate-100"
          >
            {/* Countdown Bar */}
            {!resultState && (
              <div className="relative h-1.5 overflow-hidden bg-slate-100">
                <motion.div
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: timeLeft, ease: 'linear' }}
                  className="absolute inset-y-0 left-0 bg-gradient-to-r from-amber-500 to-brand"
                />
              </div>
            )}

            <div className="p-5 max-h-[85vh] overflow-y-auto">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20">
                    <Radio className="h-5 w-5 animate-pulse" />
                  </span>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-base font-black text-slate-900 leading-tight">
                        New Service Opportunity!
                      </p>
                    </div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                      {incoming.serviceCategory || 'Service Alert'}
                    </p>
                  </div>
                </div>

                {!resultState && (
                  <div className="flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1.5 ring-1 ring-amber-200/80">
                    <Clock className="h-3.5 w-3.5 text-amber-600" />
                    <span className="text-xs font-black text-amber-700 tabular-nums">{timeLeft}s</span>
                  </div>
                )}
              </div>

              {/* Service Info Box */}
              <div className="mt-4 rounded-2xl bg-slate-50 p-4 border border-slate-200/70 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Service</span>
                  <span className="text-sm font-black text-slate-900">{incoming.serviceType}</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Estimated Earning</span>
                  <span className="text-xl font-black text-blue-700">
                    {formatInr(incoming.estimatedAmount)}
                  </span>
                </div>

                {(incoming.location?.address || incoming.location?.city) && (
                  <div className="flex items-start gap-2 pt-2 border-t border-slate-200/70 text-xs text-slate-600">
                    <MapPin className="h-4 w-4 shrink-0 text-brand mt-0.5" />
                    <span className="font-semibold">
                      {incoming.location.address || incoming.location.city}
                    </span>
                  </div>
                )}

                {(incoming.serviceDate || incoming.serviceTime) && (
                  <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                    <span>Schedule:</span>
                    <span className="font-bold text-slate-800">
                      {incoming.serviceDate ? new Date(incoming.serviceDate).toLocaleDateString() : 'Today'} {incoming.serviceTime ? `· ${incoming.serviceTime}` : ''}
                    </span>
                  </div>
                )}
              </div>

              {/* RESULT STATE NOTICES */}
              {resultState === 'WON' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-4 rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-center space-y-2"
                >
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <h4 className="text-base font-black text-emerald-900">Opportunity Secured!</h4>
                  <p className="text-xs font-medium text-emerald-700">
                    {statusMessage || 'Great job responding quickly. Keep your app active for more opportunities.'}
                  </p>
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="w-full mt-2 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700"
                  >
                    Done
                  </button>
                </motion.div>
              )}

              {resultState === 'TAKEN' && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-4 rounded-2xl bg-amber-50 border border-amber-200 p-4 text-center space-y-2"
                >
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                    <ShieldAlert className="h-5 w-5" />
                  </div>
                  <h4 className="text-sm font-black text-amber-900">Opportunity Unavailable</h4>
                  <p className="text-xs font-medium text-amber-700">
                    {statusMessage || 'This opportunity has already been accepted by another vendor.'}
                  </p>
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="w-full mt-2 rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white hover:bg-slate-800"
                  >
                    OK
                  </button>
                </motion.div>
              )}

              {(resultState === 'EXPIRED' || resultState === 'CANCELLED') && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mt-4 rounded-2xl bg-slate-100 border border-slate-200 p-4 text-center space-y-2"
                >
                  <p className="text-xs font-bold text-slate-700">{statusMessage}</p>
                  <button
                    type="button"
                    onClick={handleDismiss}
                    className="w-full rounded-xl bg-slate-800 py-2.5 text-xs font-bold text-white"
                  >
                    Close
                  </button>
                </motion.div>
              )}

              {/* ACTION BUTTONS */}
              {!resultState && (
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={responding}
                    onClick={handleReject}
                    className="flex items-center justify-center gap-2 rounded-2xl border-2 border-slate-200 bg-white py-3.5 text-sm font-extrabold text-slate-600 transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 active:scale-[0.97] disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                    Reject
                  </button>

                  <button
                    type="button"
                    disabled={responding}
                    onClick={handleAccept}
                    className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand to-blue-700 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-brand/25 transition hover:opacity-95 active:scale-[0.97] disabled:opacity-50"
                  >
                    {responding ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
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
