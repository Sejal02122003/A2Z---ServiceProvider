import { useState, useEffect } from 'react'
import { Bell, CheckCircle2, AlertTriangle, Sparkles, Loader2, ShieldCheck } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { registerFCMToken, showDesktopNotification } from '../../services/pushNotificationService.js'
import { unlockAudioContext } from '../../utils/bookingSound.js'

export function ProviderNotificationBanner({ user }) {
  const [permission, setPermission] = useState(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
    return Notification.permission
  })
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null) // { type: 'success' | 'error', text: '' }

  const syncPermission = () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission)
    }
  }

  useEffect(() => {
    syncPermission()
    window.addEventListener('focus', syncPermission)
    document.addEventListener('visibilitychange', syncPermission)
    return () => {
      window.removeEventListener('focus', syncPermission)
      document.removeEventListener('visibilitychange', syncPermission)
    }
  }, [])

  if (permission === 'unsupported') return null

  const handleEnable = async () => {
    setLoading(true)
    setMessage(null)
    try {
      unlockAudioContext()
      const token = await registerFCMToken(true)
      syncPermission()
      if (token) {
        setMessage({
          type: 'success',
          text: '🎉 Notifications enabled! You will now receive booking alerts and sound outside the app.'
        })
        showDesktopNotification({
          title: 'A2Z Service Hub',
          body: 'Booking alerts and sound are now ACTIVE on your device!',
          tag: 'a2z-verified'
        })
      } else {
        setMessage({
          type: 'error',
          text: 'Permission was not granted. Please click the lock icon in your browser address bar to allow notifications.'
        })
      }
    } catch (err) {
      console.warn('[PUSH] Enable failed:', err)
      setMessage({
        type: 'error',
        text: err?.message || 'Could not enable notifications. Please check browser settings.'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="px-4 py-2">
      <AnimatePresence mode="wait">
        {permission === 'default' && (
          <motion.div
            key="default-banner"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="overflow-hidden rounded-2xl border border-amber-300/80 bg-gradient-to-r from-amber-50 via-amber-100/70 to-orange-50 p-3.5 shadow-sm sm:p-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white shadow-md shadow-amber-500/25">
                  <Bell className="h-5 w-5 animate-bounce" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-black tracking-tight text-amber-950 sm:text-sm">
                      Enable Out-of-App Booking Alerts
                    </h4>
                    <span className="rounded-full bg-amber-200 px-1.5 py-0.5 text-[9px] font-extrabold text-amber-800">
                      CRITICAL
                    </span>
                  </div>
                  <p className="mt-0.5 text-[11px] font-medium leading-relaxed text-amber-800/90 sm:text-xs">
                    Get loud booking ringtone &amp; vibration when jobs arrive, even if your phone is locked or app is in background.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleEnable}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 px-4 py-2 text-xs font-black text-white shadow-md shadow-amber-600/25 transition hover:from-amber-700 hover:to-orange-700 active:scale-95 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Enabling…</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Turn On Alerts</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {permission === 'denied' && (
          <motion.div
            key="denied-banner"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="overflow-hidden rounded-2xl border border-rose-300/80 bg-rose-50 p-3.5 text-xs text-rose-900 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-100 text-rose-600">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-rose-950">Notifications Blocked by Browser</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-rose-800">
                  You will NOT receive sound or job alerts outside this app. Click the 🔒 lock/tune icon in your browser address bar next to the URL and set <strong>Notifications</strong> to <strong>Allow</strong>.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {permission === 'granted' && (
          <motion.div
            key="granted-banner"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="overflow-hidden rounded-2xl border border-emerald-200/80 bg-gradient-to-r from-emerald-50/90 to-teal-50/70 p-2.5 shadow-2xs sm:p-3"
          >
            <div className="flex items-center justify-between gap-2.5">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
                  <ShieldCheck className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <p className="text-xs font-bold text-emerald-950 truncate">
                      Out-of-App Booking Alerts Active
                    </p>
                  </div>
                  <p className="text-[10px] text-emerald-700 truncate">
                    Ready for real-time job alerts on +91 {user?.phone || 'device'}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {message && (
        <motion.p
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className={`mt-1.5 px-1 text-[11px] font-semibold ${
            message.type === 'success' ? 'text-emerald-700' : 'text-rose-600'
          }`}
        >
          {message.text}
        </motion.p>
      )}
    </div>
  )
}
