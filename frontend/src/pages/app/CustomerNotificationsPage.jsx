import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  Bell,
  CheckCircle2,
  Clock,
  ChevronRight,
  Loader2,
  Sparkles,
  AlertTriangle,
  CalendarCheck,
  Check,
  ArrowLeft,
  XCircle,
  Phone,
  KeyRound,
  User,
  X,
  Trash2,
} from 'lucide-react'
import { notificationApi } from '../../api/notificationApi.js'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { useSocket } from '../../context/SocketContext.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import { TestPushNotificationCard } from '../../components/app/TestPushNotificationCard.jsx'

function formatNotificationTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return ''
  const now = new Date()
  const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000)

  if (diffSec < 60) return 'Just now'
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`
  if (diffSec < 172800) return 'Yesterday'
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: 'Asia/Kolkata',
  })
}

export function CustomerNotificationsPage() {
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const socket = useSocket()
  const { user } = useAuth()

  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [tab, setTab] = useState('all') // 'all' | 'unread'
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState(false)

  const fetchNotifications = useCallback(async () => {
    try {
      setError('')
      const res = await notificationApi.getMyNotifications({
        limit: 50,
        unreadOnly: tab === 'unread',
      })
      if (res?.success && res.data) {
        setNotifications(res.data.notifications || [])
        setUnreadCount(res.data.unreadCount || 0)
      }
    } catch (err) {
      console.error('[NOTIFICATIONS_PAGE]', err)
      setError('Unable to load notifications. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [tab])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  // Listen to real-time notifications via socket
  useEffect(() => {
    if (!socket) return

    const handleNewNotification = (newNotif) => {
      if (!newNotif) return
      setNotifications((prev) => [newNotif, ...prev.filter((n) => n._id !== newNotif._id)])
      setUnreadCount((c) => c + 1)
    }

    const handleBookingAccepted = (data) => {
      // Re-fetch or increment if socket payload arrives
      fetchNotifications()
    }

    socket.on('NEW_IN_APP_NOTIFICATION', handleNewNotification)
    socket.on('BOOKING_ACCEPTED', handleBookingAccepted)

    return () => {
      socket.off('NEW_IN_APP_NOTIFICATION', handleNewNotification)
      socket.off('BOOKING_ACCEPTED', handleBookingAccepted)
    }
  }, [socket, fetchNotifications])

  const handleMarkAllRead = async () => {
    if (unreadCount === 0 || actionLoading) return
    setActionLoading(true)
    try {
      await notificationApi.markAllNotificationsRead()
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read: true, readAt: new Date() }))
      )
      setUnreadCount(0)
    } catch (err) {
      console.warn('Failed to mark all as read:', err)
    } finally {
      setActionLoading(false)
    }
  }

  const handleRemoveNotification = async (notifId, e) => {
    e?.stopPropagation()
    const target = notifications.find((n) => n._id === notifId)
    // Optimistically remove from state
    setNotifications((prev) => prev.filter((n) => n._id !== notifId))
    if (target && !target.read) {
      setUnreadCount((c) => Math.max(0, c - 1))
    }
    try {
      await notificationApi.deleteNotification(notifId)
    } catch (err) {
      console.warn('Failed to delete notification:', err)
    }
  }

  const handleClearRead = async () => {
    const hasRead = notifications.some((n) => n.read)
    if (!hasRead || actionLoading) return
    setActionLoading(true)
    setNotifications((prev) => prev.filter((n) => !n.read))
    try {
      await notificationApi.clearNotifications({ readOnly: true })
    } catch (err) {
      console.warn('Failed to clear read notifications:', err)
    } finally {
      setActionLoading(false)
    }
  }

  const handleNotificationClick = async (notif) => {
    // Mark as read in background if unread
    if (!notif.read) {
      setNotifications((prev) =>
        prev.map((n) => (n._id === notif._id ? { ...n, read: true } : n))
      )
      setUnreadCount((c) => Math.max(0, c - 1))
      notificationApi.markNotificationRead(notif._id).catch(() => {})
    }

    // Target navigation to exact booking tracking screen
    const bookingId = notif.bookingId?._id || notif.bookingId
    if (bookingId) {
      navigate(`/user/tracking/${bookingId}`)
    } else if (notif.metadata?.link) {
      navigate(notif.metadata.link)
    }
  }

  const displayedNotifications =
    tab === 'unread' ? notifications.filter((n) => !n.read) : notifications

  return (
    <div className="space-y-4 pb-12 max-w-xl mx-auto">
      {/* Header Bar */}
      <div className="rounded-3xl border border-slate-200 bg-white px-4 py-3 shadow-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/user')}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 transition active:scale-95"
            aria-label="Back to home"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-lg font-black tracking-tight text-slate-900 leading-tight">
              Notifications
            </h1>
            <p className="text-xs font-semibold text-slate-500">
              {unreadCount > 0 ? `${unreadCount} unread update${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={handleMarkAllRead}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-brand hover:bg-brand/5 active:scale-95 transition disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              Mark all read
            </button>
          )}
          {notifications.some((n) => n.read) && (
            <button
              type="button"
              disabled={actionLoading}
              onClick={handleClearRead}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs font-bold text-slate-500 hover:text-rose-600 hover:border-rose-200 hover:bg-rose-50 active:scale-95 transition disabled:opacity-50"
              title="Clear all read notifications"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Clear read
            </button>
          )}
        </div>
      </div>

      {/* Device Push Notifications (Out of App) */}
      <TestPushNotificationCard user={user} />

      {/* Tabs */}
      <GlassPanel className="p-1.5">
        <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-0.5">
          <button
            type="button"
            onClick={() => setTab('all')}
            className={`rounded-lg py-2 text-xs font-bold transition ${
              tab === 'all'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            All Updates
          </button>
          <button
            type="button"
            onClick={() => setTab('unread')}
            className={`rounded-lg py-2 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              tab === 'unread'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <span>Unread</span>
            {unreadCount > 0 && (
              <span className="rounded-full bg-brand px-1.5 py-0.2 text-[10px] font-black text-white">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </GlassPanel>

      {/* Main Content Feed */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
        </div>
      ) : error ? (
        <GlassPanel className="p-6 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-amber-500" />
          <p className="mt-2 text-sm font-semibold text-slate-700">{error}</p>
          <button
            type="button"
            onClick={fetchNotifications}
            className="mt-4 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white hover:bg-brand/90 transition"
          >
            Try Again
          </button>
        </GlassPanel>
      ) : displayedNotifications.length === 0 ? (
        <GlassPanel className="p-10 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand/10 text-brand mb-3">
            <Bell className="h-7 w-7" />
          </div>
          <h3 className="text-base font-extrabold text-slate-800">
            {tab === 'unread' ? 'No unread notifications' : 'No notifications yet'}
          </h3>
          <p className="mt-1 text-xs text-slate-500 max-w-xs mx-auto">
            {tab === 'unread'
              ? 'You are up to date on all booking updates and service alerts.'
              : 'When a service partner accepts your booking, you will receive real-time confirmations right here.'}
          </p>
        </GlassPanel>
      ) : (
        <div className="space-y-2.5">
          <AnimatePresence initial={false}>
            {displayedNotifications.map((notif, index) => {
              const isBookingAccepted = notif.type === 'BOOKING_ACCEPTED'
              const isBookingCancelled = notif.type === 'BOOKING_CANCELLED'
              const hasBooking = Boolean(notif.bookingId)

              let icon = <Bell className="h-5 w-5 text-brand" />
              let badgeBg = 'bg-brand/10 text-brand ring-brand/20'

              if (isBookingAccepted) {
                icon = <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                badgeBg = 'bg-emerald-50 text-emerald-700 ring-emerald-200'
              } else if (isBookingCancelled) {
                icon = <XCircle className="h-5 w-5 text-rose-600" />
                badgeBg = 'bg-rose-50 text-rose-700 ring-rose-200'
              } else if (notif.type === 'BOOKING_REMINDER') {
                icon = <Clock className="h-5 w-5 text-blue-600" />
                badgeBg = 'bg-blue-50 text-blue-700 ring-blue-200'
              }

              return (
                <motion.div
                  key={notif._id}
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, height: 0, marginBottom: 0, overflow: 'hidden' }}
                  transition={{ duration: 0.2 }}
                >
                  <div
                    onClick={() => handleNotificationClick(notif)}
                    className={`group relative flex items-start gap-3.5 rounded-2xl border p-4 transition cursor-pointer select-none ${
                      notif.read
                        ? 'border-slate-200/80 bg-white/70 hover:bg-white hover:border-slate-300'
                        : 'border-brand/30 bg-white shadow-sm ring-1 ring-brand/10 hover:border-brand/50'
                    }`}
                  >
                    {/* Unread Indicator Bar */}
                    {!notif.read && (
                      <span
                        className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-brand"
                        aria-hidden
                      />
                    )}

                    {/* Icon */}
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 ${badgeBg}`}
                    >
                      {icon}
                    </div>

                    {/* Content */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-extrabold text-slate-900 group-hover:text-brand transition leading-snug">
                          {notif.title}
                        </h4>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-[11px] font-bold text-slate-400">
                            {formatNotificationTime(notif.createdAt)}
                          </span>
                          <button
                            type="button"
                            onClick={(e) => handleRemoveNotification(notif._id, e)}
                            className="flex h-6 w-6 items-center justify-center rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 active:bg-rose-100 transition active:scale-90"
                            title="Remove notification"
                            aria-label="Remove notification"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>

                      <p className="mt-1 text-xs font-medium text-slate-600 leading-relaxed">
                        {notif.body}
                      </p>

                      {/* Rich Partner Details Card for Accepted Bookings */}
                      {isBookingAccepted && notif.metadata?.partnerName && (
                        <div className="mt-3 rounded-xl border border-emerald-100 bg-emerald-50/60 p-3 space-y-2.5">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2.5 min-w-0">
                              {notif.metadata.partnerAvatar ? (
                                <img
                                  src={notif.metadata.partnerAvatar}
                                  alt={notif.metadata.partnerName}
                                  className="h-9 w-9 shrink-0 rounded-xl object-cover ring-1 ring-emerald-200"
                                />
                              ) : (
                                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-200/80 text-emerald-800 font-bold text-xs">
                                  {notif.metadata.partnerName.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div className="min-w-0">
                                <p className="text-xs font-black text-slate-900 truncate">
                                  {notif.metadata.partnerName}
                                </p>
                                {notif.metadata.partnerPhone && (
                                  <p className="text-[11px] font-bold text-emerald-700">
                                    {notif.metadata.partnerPhone}
                                  </p>
                                )}
                              </div>
                            </div>

                            {notif.metadata.partnerPhone && (
                              <a
                                href={`tel:${notif.metadata.partnerPhone}`}
                                onClick={(e) => e.stopPropagation()}
                                className="flex items-center gap-1 shrink-0 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white shadow-sm hover:bg-emerald-700 active:scale-95 transition"
                              >
                                <Phone className="h-3 w-3" />
                                Call
                              </a>
                            )}
                          </div>

                          {notif.metadata.startOtp && (
                            <div className="flex items-center justify-between rounded-lg bg-white/90 border border-emerald-200/70 px-2.5 py-1.5">
                              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                                <KeyRound className="h-3 w-3 text-emerald-600" /> Start Job OTP
                              </span>
                              <span className="font-mono text-xs font-black tracking-widest text-emerald-800">
                                {notif.metadata.startOtp}
                              </span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Metadata Pill / Booking Action */}
                      {hasBooking && (
                        <div className="mt-2.5 flex items-center justify-between text-[11px] font-bold text-brand">
                          <span className="inline-flex items-center gap-1">
                            <Sparkles className="h-3 w-3" />
                            Track Booking Live
                          </span>
                          <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5 text-slate-400 group-hover:text-brand" />
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}
