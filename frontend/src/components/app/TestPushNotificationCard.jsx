import { useState, useEffect } from 'react'
import { Bell, CheckCircle2, AlertCircle, Loader2, Send, ShieldCheck, Sparkles, RefreshCw } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { sendTestNotification, registerFCMToken, requestNotificationPermission, showDesktopNotification } from '../../services/pushNotificationService.js'

export function TestPushNotificationCard({ user }) {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState(null) // { type: 'success' | 'error', message: '' }
  const [permission, setPermission] = useState('default')

  const refreshPermission = () => {
    if ('Notification' in window) {
      setPermission(Notification.permission)
    }
  }

  useEffect(() => {
    refreshPermission()
    // Check permission state periodically in case user changes it in browser settings
    const interval = setInterval(refreshPermission, 3000)
    return () => clearInterval(interval)
  }, [])

  const handleEnablePush = async () => {
    setLoading(true)
    setStatus(null)
    try {
      const token = await registerFCMToken(true)
      refreshPermission()
      if (token) {
        setStatus({
          type: 'success',
          message: 'Push notifications enabled! You will now receive alerts even outside this app.'
        })
        // Show test banner immediately
        showDesktopNotification({
          title: 'A2Z Service Hub',
          body: 'Push notifications are now enabled on this device!',
          tag: 'a2z-enabled'
        })
      } else {
        setStatus({
          type: 'error',
          message: 'Permission was not granted. Please allow notifications in your browser address bar.'
        })
      }
    } catch (err) {
      console.error('[PUSH] Enable push failed:', err)
      refreshPermission()
      setStatus({
        type: 'error',
        message: err?.message || 'Failed to enable push notifications.'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleTestNotification = async () => {
    setLoading(true)
    setStatus(null)
    try {
      if (!user) {
        throw new Error('Please log in first to test push notifications with your account.')
      }

      // Also trigger a local desktop notification in 1 second to demonstrate immediate out-of-app notification
      setTimeout(() => {
        showDesktopNotification({
          title: 'A2Z Notification Out',
          body: '🔔 Outside-app notification! Your device is successfully linked to A2Z Service Hub.',
          tag: 'a2z-test-direct'
        })
      }, 1000)

      const res = await sendTestNotification()
      refreshPermission()

      setStatus({
        type: 'success',
        message: 'Push notification triggered! Minimize this tab or switch apps to see the OS system banner.'
      })
    } catch (err) {
      console.error('Test notification failed:', err)
      refreshPermission()
      setStatus({
        type: 'error',
        message: err?.message || 'Failed to send test push notification. Please check browser permissions.'
      })
    } finally {
      setLoading(false)
    }
  }

  const permissionBadge = {
    granted: { label: 'Active', bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
    denied: { label: 'Blocked', bg: 'bg-rose-50 text-rose-700 border-rose-200', dot: 'bg-rose-500' },
    default: { label: 'Prompt Needed', bg: 'bg-amber-50 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  }[permission] || { label: permission, bg: 'bg-slate-100 text-slate-700 border-slate-200', dot: 'bg-slate-400' }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-blue-200/90 bg-gradient-to-br from-blue-50/80 via-white to-indigo-50/60 p-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white shadow-md shadow-brand/20 mt-0.5">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900">Device Push Notifications</h3>
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${permissionBadge.bg}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${permissionBadge.dot}`} />
                {permissionBadge.label}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-0.5">
              {permission === 'granted'
                ? 'Get real-time booking alerts outside the app (desktop & mobile banners).'
                : permission === 'denied'
                ? 'Notifications are blocked in your browser. Click the lock/settings icon in the address bar to allow.'
                : 'Enable notifications to get instant alerts outside the app even when minimized or closed.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          {permission === 'granted' ? (
            <button
              type="button"
              disabled={loading}
              onClick={handleTestNotification}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-brand/90 active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Send className="h-3.5 w-3.5" />
                  <span>Test Push (Out of App)</span>
                </>
              )}
            </button>
          ) : permission === 'default' ? (
            <button
              type="button"
              disabled={loading}
              onClick={handleEnablePush}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Enabling...</span>
                </>
              ) : (
                <>
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Enable Push Now</span>
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={refreshPermission}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 active:scale-95 transition"
            >
              <RefreshCw className="h-3 w-3" />
              <span>Check Status</span>
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {status && (
          <motion.div
            initial={{ opacity: 0, height: 0, marginTop: 0 }}
            animate={{ opacity: 1, height: 'auto', marginTop: 12 }}
            exit={{ opacity: 0, height: 0, marginTop: 0 }}
            className={`flex items-start gap-2 rounded-xl border p-2.5 text-xs font-medium ${
              status.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-rose-200 bg-rose-50 text-rose-900'
            }`}
          >
            {status.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
            ) : (
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
            )}
            <div className="flex-1">
              <p>{status.message}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
