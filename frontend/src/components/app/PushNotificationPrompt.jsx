import { useState, useEffect } from 'react'
import { Bell, X, Sparkles, CheckCircle2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../hooks/useAuth.js'
import { registerFCMToken, showDesktopNotification } from '../../services/pushNotificationService.js'

export function PushNotificationPrompt() {
  const { user, isGuest } = useAuth()
  const [visible, setVisible] = useState(false)
  const [loading, setLoading] = useState(false)
  const [enabledSuccess, setEnabledSuccess] = useState(false)

  useEffect(() => {
    if (!user || isGuest) return

    // Check if browser supports notifications
    if (!('Notification' in window)) return

    // Only prompt if permission is 'default' and not dismissed during this session
    if (Notification.permission === 'default' && !sessionStorage.getItem('push_prompt_dismissed')) {
      const timer = setTimeout(() => {
        setVisible(true)
      }, 2500)
      return () => clearTimeout(timer)
    }
  }, [user, isGuest])

  const handleEnable = async () => {
    setLoading(true)
    try {
      const token = await registerFCMToken(true)
      if (token) {
        setEnabledSuccess(true)
        showDesktopNotification({
          title: 'A2Z Service Hub',
          body: '🎉 Notifications enabled! You will now receive booking & job alerts outside the app.',
          tag: 'a2z-welcome'
        })
        setTimeout(() => {
          setVisible(false)
        }, 2200)
      } else {
        setVisible(false)
      }
    } catch (err) {
      console.warn('[PUSH] Prompt enable error:', err)
      setVisible(false)
    } finally {
      setLoading(false)
    }
  }

  const handleDismiss = () => {
    sessionStorage.setItem('push_prompt_dismissed', 'true')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 50, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 50, opacity: 0, scale: 0.95 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed bottom-20 left-4 right-4 z-50 mx-auto max-w-lg md:bottom-6"
      >
        <div className="relative overflow-hidden rounded-2xl border border-blue-200/90 bg-white/95 p-3.5 shadow-xl backdrop-blur-md sm:p-4">
          {enabledSuccess ? (
            <div className="flex items-center gap-3 text-emerald-800">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold">Push notifications enabled!</p>
                <p className="text-xs text-emerald-600">You will get updates outside the app even when minimized.</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-brand to-indigo-600 text-white shadow-md shadow-brand/25">
                  <Bell className="h-5 w-5 animate-bounce" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-bold text-slate-900 sm:text-sm">Get Notifications Outside App</h4>
                    <span className="rounded-full bg-blue-100 px-1.5 py-0.5 text-[9px] font-extrabold text-blue-700">NEW</span>
                  </div>
                  <p className="text-[11px] text-slate-500 sm:text-xs">
                    Receive instant booking updates, worker arrival alerts, and job requests directly on your device.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleEnable}
                  className="inline-flex items-center gap-1 rounded-xl bg-brand px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-brand/90 active:scale-95 disabled:opacity-50"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{loading ? 'Enabling...' : 'Turn On'}</span>
                </button>
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
                  aria-label="Dismiss notification prompt"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
