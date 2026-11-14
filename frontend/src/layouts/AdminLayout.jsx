import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  Bell,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  LogOut,
  Mail,
  Menu,
  PanelLeftClose,
  PanelLeft,
  Sparkles,
  User,
  Volume2,
} from 'lucide-react'
import { useAuth } from '../hooks/useAuth.js'
import { useSocket } from '../context/SocketContext.jsx'
import { ADMIN_NAV_SECTIONS, getAdminTitle } from '../config/adminNavigation.js'
import { appSpring } from '../components/app/appMotion.js'
import { GlassPanel } from '../components/ui/GlassPanel.jsx'
import { adminInitials, formatLastLoginDisplay, formatLastLoginRelative } from '../lib/formatAdminLastLogin.js'
import { registerFCMToken, showDesktopNotification } from '../services/pushNotificationService.js'
import { playBookingAlertSound } from '../utils/bookingSound.js'
import { notificationApi } from '../api/notificationApi.js'

const STORAGE_KEY = 'lc-admin-sidebar-collapsed'

export function AdminLayout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const socket = useSocket()
  const reduce = useReducedMotion()

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })
  const [mobileOpen, setMobileOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [notifOpen, setNotifOpen] = useState(false)
  const [permission, setPermission] = useState(() => (typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported'))
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState([])
  const [enablingPush, setEnablingPush] = useState(false)

  const profileRef = useRef(null)
  const notifRef = useRef(null)


  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [collapsed])

  useEffect(() => {
    setMobileOpen(false)
    setProfileOpen(false)
    setNotifOpen(false)
  }, [pathname])

  useEffect(() => {
    function handlePointerDown(e) {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false)
      if (notifRef.current && !notifRef.current.contains(e.target)) setNotifOpen(false)
    }
    function handleKey(e) {
      if (e.key === 'Escape') {
        setProfileOpen(false)
        setNotifOpen(false)
      }
    }
    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKey)
    }
  }, [])

  // Auto-sync FCM token on load if permission is already granted
  useEffect(() => {
    if (user?._id && permission === 'granted') {
      registerFCMToken(false).catch((err) => console.warn('[Admin PUSH] Token auto-sync skipped:', err))
    }
  }, [user?._id, permission])

  // Fetch initial notifications
  const loadNotifications = () => {
    notificationApi.getUnreadCount()
      .then((res) => {
        if (res?.data?.unreadCount !== undefined) {
          setUnreadCount(res.data.unreadCount)
        }
      })
      .catch(() => {})

    notificationApi.getMyNotifications({ limit: 10 })
      .then((res) => {
        if (Array.isArray(res?.data?.notifications)) {
          setNotifications(res.data.notifications)
        }
      })
      .catch(() => {})
  }

  useEffect(() => {
    loadNotifications()
  }, [])

  // Handle incoming live alerts from Sockets and FCM foreground events
  useEffect(() => {
    const handleNewAlert = (data, defaultTitle, defaultBody) => {
      console.log('[Admin FLOW] Live alert received in Admin Panel:', data)
      playBookingAlertSound(data?.bookingId)

      const title = data?.title || defaultTitle || '🚨 Admin Notification'
      const body = data?.body || defaultBody || 'New booking activity received.'
      const link = data?.link || '/admin/bookings'

      if ('Notification' in window && Notification.permission === 'granted') {
        showDesktopNotification({
          title,
          body,
          link,
          tag: data?.bookingId ? `admin-booking-${data.bookingId}` : 'admin-alert',
          playAlert: true,
        })
      }

      setUnreadCount((c) => c + 1)
      setNotifications((prev) => [
        {
          _id: `live_${Date.now()}_${Math.random()}`,
          title,
          body,
          createdAt: new Date().toISOString(),
          isRead: false,
          metadata: { link, bookingId: data?.bookingId },
        },
        ...prev.slice(0, 19),
      ])
    }

    if (socket) {
      const onBookingAlert = (data) => {
        const shortId = data?.shortBookingId || (data?.bookingId ? String(data.bookingId).slice(-6).toUpperCase() : '')
        handleNewAlert(
          data,
          `🚨 New Booking Alert: #${shortId}`,
          `${data?.customerName || 'Customer'} placed a booking for ${data?.serviceTitle || 'Service'} (₹${data?.amount || 0})`
        )
      }

      const onAcceptedAlert = (data) => {
        const shortId = data?.shortBookingId || (data?.bookingId ? String(data.bookingId).slice(-6).toUpperCase() : '')
        handleNewAlert(
          data,
          `✅ Booking #${shortId} Accepted!`,
          `${data?.provider?.name || 'Service Partner'} accepted booking #${shortId} (₹${data?.totalAmount || 0})`
        )
      }

      const onStatusAlert = (data) => {
        const shortId = data?.shortBookingId || (data?.bookingId ? String(data.bookingId).slice(-6).toUpperCase() : '')
        handleNewAlert(
          data,
          `📋 Booking #${shortId} Status: ${data?.status}`,
          `Status updated to ${data?.status}`
        )
      }

      socket.on('NEW_BOOKING_ALERT', onBookingAlert)
      socket.on('BOOKING_ACCEPTED_ADMIN', onAcceptedAlert)
      socket.on('BOOKING_STATUS_UPDATE_ADMIN', onStatusAlert)

      return () => {
        socket.off('NEW_BOOKING_ALERT', onBookingAlert)
        socket.off('BOOKING_ACCEPTED_ADMIN', onAcceptedAlert)
        socket.off('BOOKING_STATUS_UPDATE_ADMIN', onStatusAlert)
      }
    }
  }, [socket])

  // Also listen for FCM window notifications
  useEffect(() => {
    const handlePushEvent = (e) => {
      const payload = e.detail
      console.log('[Admin FLOW] a2z-push-notification event received in Admin Panel:', payload)
      const data = payload?.data || {}
      const notif = payload?.notification || {}
      const title = notif.title || data.title || '🚨 A2Z Admin Alert'
      const body = notif.body || data.body || 'New update received.'

      playBookingAlertSound(data?.bookingId)
      setUnreadCount((c) => c + 1)
      setNotifications((prev) => [
        {
          _id: `fcm_${Date.now()}`,
          title,
          body,
          createdAt: new Date().toISOString(),
          isRead: false,
          metadata: { link: data?.link || '/admin/bookings', bookingId: data?.bookingId },
        },
        ...prev.slice(0, 19),
      ])
    }

    window.addEventListener('a2z-push-notification', handlePushEvent)
    return () => window.removeEventListener('a2z-push-notification', handlePushEvent)
  }, [])

  const handleEnablePush = async () => {
    setEnablingPush(true)
    try {
      const token = await registerFCMToken(true)
      if ('Notification' in window) {
        setPermission(Notification.permission)
      }
      if (token) {
        showDesktopNotification({
          title: '🚨 Admin Notifications Enabled',
          body: 'You will now receive instant push alerts and audio notifications for all incoming bookings!',
          tag: 'admin-enabled',
        })
      }
    } catch (err) {
      console.warn('Failed to enable admin push notifications:', err)
    } finally {
      setEnablingPush(false)
    }
  }

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllNotificationsRead()
      setUnreadCount(0)
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    } catch {}
  }

  const title = getAdminTitle(pathname)

  function handleLogout() {
    setProfileOpen(false)
    logout()
    navigate('/admin/login', { replace: true })
  }

  const displayName = user?.fullName?.trim() || user?.email?.split('@')[0] || 'Administrator'
  const displayEmail = user?.email || '—'
  const lastLoginRaw = user?.lastLoginAt
  const lastLoginShort = formatLastLoginRelative(lastLoginRaw)
  const lastLoginFull = formatLastLoginDisplay(lastLoginRaw)
  const initials = adminInitials(user)

  const sidebarInner = (
    <>
      <div
        className={`relative flex h-17 shrink-0 items-center border-b border-white/15 bg-transparent px-3 ${collapsed ? 'md:justify-center' : 'justify-between gap-2'}`}
      >
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-linear-to-r from-white/0 via-white/20 to-white/0" aria-hidden />
        <Link
          to="/admin"
          className={`relative z-10 flex min-w-0 items-center gap-2.5 rounded-xl px-1.5 py-1.5 font-extrabold tracking-tight text-white transition hover:bg-white/10 hover:shadow-sm active:scale-95 ${collapsed ? 'md:justify-center' : ''}`}
          title="Dashboard"
        >
          <img src="/logo.png" alt="A2Z" className="h-9 w-auto rounded-lg bg-white/95 p-1 object-contain shadow-sm ring-1 ring-white/20" />
          <span className={`min-w-0 truncate ${collapsed ? 'md:sr-only' : ''}`}>
            <span className="block text-sm font-black text-white">A2Z</span>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#01C7D0]">
              Control panel
            </span>
          </span>
        </Link>
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="relative z-10 hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white shadow-sm transition hover:bg-white/20 active:scale-95 md:flex"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      <nav
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-2.5 py-4 scrollbar-thin [scrollbar-color:rgba(148,163,184,0.5)_transparent]"
        aria-label="Admin navigation"
      >
        {ADMIN_NAV_SECTIONS.map((section, si) => (
          <div
            key={section.title ?? 'main'}
            className={`${si > 0 ? 'mt-5 border-t border-slate-100 pt-5' : ''} mb-1 last:mb-0`}
          >
            {section.title ? (
              <div className={`mb-2.5 flex items-center gap-2 px-3 ${collapsed ? 'md:hidden' : ''}`}>
                <span className="h-px w-4 shrink-0 rounded-full bg-white/30" aria-hidden />
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-blue-100">{section.title}</p>
              </div>
            ) : null}
            <ul className="space-y-1">
              {section.items.map(({ to, label, icon: Icon, end }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={Boolean(end)}
                    title={label}
                    className={({ isActive }) =>
                      `group relative flex items-center gap-3 rounded-xl py-2.5 text-sm font-semibold transition-all duration-200 active:scale-[0.98] md:px-2 ${collapsed ? 'md:justify-center md:px-0' : 'px-3'
                      } ${isActive
                        ? 'bg-white text-brand shadow-md'
                        : 'text-teal-100/90 hover:bg-white/15 hover:text-white'
                      } ${collapsed && isActive ? 'md:ring-2 md:ring-white/50 md:ring-offset-2 md:ring-offset-brand' : ''
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors duration-200 ${isActive
                              ? 'bg-brand/10 text-brand'
                              : 'bg-white/10 text-teal-100/90 group-hover:text-white group-hover:bg-white/20'
                            }`}
                        >
                          <Icon className="h-[18px] w-[18px]" aria-hidden />
                        </span>
                        <span className={`min-w-0 flex-1 truncate ${collapsed ? 'md:sr-only' : ''}`}>{label}</span>
                        {!collapsed ? (
                          <ChevronRight
                            className={`h-4 w-4 shrink-0 transition-all duration-200 ${isActive ? 'translate-x-0 text-brand opacity-100' : 'text-teal-200 opacity-0 group-hover:translate-x-0.5 group-hover:opacity-100'}`}
                            aria-hidden
                          />
                        ) : null}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>


    </>
  )

  const sidebarClassName = `
    flex h-dvh max-h-dvh shrink-0 flex-col overflow-hidden border-r border-[#012227]/40 bg-gradient-to-b from-[#012227] via-[#014852] to-[#015F6C] shadow-[6px_0_32px_-12px_rgba(1,95,108,0.3)] transition-[transform,width] duration-300 ease-out
    w-[min(18rem,88vw)] max-md:max-w-[18rem]
    ${collapsed ? 'md:w-19' : 'md:w-64'}
    fixed inset-y-0 left-0 z-50 md:relative md:z-20
    ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
  `

  return (
    <div className="flex h-dvh max-h-dvh w-full overflow-hidden bg-[#F5FAFA] text-[#263238]">
      <AnimatePresence>
        {mobileOpen ? (
          <motion.button
            key="admin-overlay"
            type="button"
            className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-sm md:hidden"
            aria-label="Close menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
          />
        ) : null}
      </AnimatePresence>

      <aside className={`${sidebarClassName} hide-on-print`}>{sidebarInner}</aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {permission !== 'granted' && permission !== 'unsupported' && (
          <div className="hide-on-print flex items-center justify-between gap-3 border-b border-brand/20 bg-linear-to-r from-brand/15 via-brand/10 to-transparent px-4 py-2 text-xs font-medium text-slate-800">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand text-white shadow-sm">
                <Volume2 className="h-3.5 w-3.5 animate-bounce" />
              </span>
              <span>
                <strong>Enable Push Notifications:</strong> Receive real-time audio chimes & desktop alerts for incoming customer bookings!
              </span>
            </div>
            <button
              type="button"
              disabled={enablingPush}
              onClick={handleEnablePush}
              className="flex shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3 py-1 font-bold text-white shadow-sm transition hover:bg-brand-dark active:scale-95 disabled:opacity-50"
            >
              <Sparkles className="h-3 w-3" />
              {enablingPush ? 'Enabling...' : 'Enable Notifications'}
            </button>
          </div>
        )}

        <header className="hide-on-print relative z-30 flex h-17 shrink-0 items-center gap-3 border-b border-slate-200/70 bg-white/80 px-3 shadow-[0_8px_30px_-18px_rgba(15,23,42,0.12)] backdrop-blur-xl md:gap-4 md:px-6">
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200/70 bg-white text-slate-700 shadow-sm transition hover:border-brand/30 hover:shadow-md md:hidden"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <button
            type="button"
            className="hidden h-11 w-11 items-center justify-center rounded-xl border border-slate-200/70 bg-white text-slate-600 shadow-sm transition hover:border-brand/30 hover:shadow-md md:flex"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <PanelLeft className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
          </button>

          <div className="min-w-0 flex-1 py-1">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
              <h1 className="truncate text-lg font-extrabold tracking-tight text-slate-900 md:text-xl">{title}</h1>
              {lastLoginShort ? (
                <span className="hidden items-center gap-1 text-[11px] font-semibold text-slate-400 sm:inline-flex">
                  <Clock className="h-3 w-3 shrink-0 text-brand/70" aria-hidden />
                  <span className="truncate">Last login · {lastLoginShort}</span>
                </span>
              ) : null}
            </div>
            <p className="truncate text-xs font-medium text-slate-500">Super control panel · Work Scope modules</p>
          </div>

          <div className="flex shrink-0 items-center gap-2 md:gap-3">
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => {
                  setNotifOpen((o) => !o)
                  setProfileOpen(false)
                }}
                className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200/70 bg-white text-slate-600 shadow-sm transition hover:border-brand/25 hover:text-brand hover:shadow-md"
                aria-expanded={notifOpen}
                aria-haspopup="true"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" aria-hidden />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-black text-white shadow-sm ring-2 ring-white animate-pulse">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>
              <AnimatePresence>
                {notifOpen ? (
                  <motion.div
                    initial={reduce ? false : { opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={reduce ? undefined : { opacity: 0, y: 4, scale: 0.98 }}
                    transition={{ duration: 0.18 }}
                    className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(calc(100vw-2rem),24rem)] origin-top-right"
                  >
                    <GlassPanel className="p-0 shadow-2xl ring-1 ring-slate-200/80 overflow-hidden rounded-2xl bg-white/95 backdrop-blur-xl">
                      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 px-4 py-3">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-extrabold text-slate-900">Notifications</p>
                          {unreadCount > 0 && (
                            <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-bold text-brand">
                              {unreadCount} new
                            </span>
                          )}
                        </div>
                        {notifications.length > 0 && (
                          <button
                            type="button"
                            onClick={handleMarkAllRead}
                            className="flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline"
                          >
                            <CheckCheck className="h-3.5 w-3.5" />
                            Mark all read
                          </button>
                        )}
                      </div>

                      <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                        {notifications.length === 0 ? (
                          <div className="p-6 text-center">
                            <Bell className="mx-auto h-8 w-8 text-slate-300" />
                            <p className="mt-2 text-xs font-semibold text-slate-600">No new alerts</p>
                            <p className="text-[11px] text-slate-400">Live booking alerts and provider updates will appear here.</p>
                          </div>
                        ) : (
                          notifications.map((n) => (
                            <div
                              key={n._id}
                              onClick={() => {
                                if (!n.isRead && n._id && !n._id.startsWith('live_') && !n._id.startsWith('fcm_')) {
                                  notificationApi.markNotificationRead(n._id).catch(() => {})
                                }
                                setNotifOpen(false)
                                if (n.metadata?.link) {
                                  navigate(n.metadata.link)
                                } else {
                                  navigate('/admin/bookings')
                                }
                              }}
                              className={`flex cursor-pointer items-start gap-3 p-3.5 transition hover:bg-slate-50 ${!n.isRead ? 'bg-amber-50/40' : ''}`}
                            >
                              <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${!n.isRead ? 'bg-brand/15 text-brand' : 'bg-slate-100 text-slate-500'}`}>
                                <Bell className="h-3.5 w-3.5" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center justify-between gap-1">
                                  <p className="truncate text-xs font-bold text-slate-900">{n.title}</p>
                                  {!n.isRead && (
                                    <span className="h-2 w-2 shrink-0 rounded-full bg-brand" />
                                  )}
                                </div>
                                <p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-slate-600">{n.body}</p>
                                <span className="mt-1 block text-[10px] text-slate-400">
                                  {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      <div className="border-t border-slate-100 bg-slate-50/50 p-2 text-center">
                        <Link
                          to="/admin/bookings"
                          onClick={() => setNotifOpen(false)}
                          className="text-xs font-bold text-brand hover:underline"
                        >
                          View all Bookings & Alerts →
                        </Link>
                      </div>
                    </GlassPanel>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>

            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => {
                  setProfileOpen((o) => !o)
                  setNotifOpen(false)
                }}
                className="flex items-center gap-2 rounded-2xl border border-slate-200/70 bg-white py-1 pl-1 pr-2 shadow-sm transition hover:border-brand/25 hover:shadow-md md:pr-3"
                aria-expanded={profileOpen}
                aria-haspopup="true"
                aria-label="Account menu"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-brand-bright to-brand text-xs font-black text-white shadow-inner ring-2 ring-white">
                  {initials}
                </span>
                <div className="hidden min-w-0 text-left lg:block">
                  <p className="truncate text-sm font-bold text-slate-900">{displayName}</p>
                  <p className="truncate text-[11px] font-medium text-slate-500">{displayEmail}</p>
                </div>
                <ChevronDown
                  className={`hidden h-4 w-4 shrink-0 text-slate-400 transition lg:block ${profileOpen ? '-rotate-180' : ''}`}
                  aria-hidden
                />
              </button>

              <AnimatePresence>
                {profileOpen ? (
                  <motion.div
                    initial={reduce ? false : { opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={reduce ? undefined : { opacity: 0, y: 4, scale: 0.98 }}
                    transition={{ duration: 0.18 }}
                    className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-[min(calc(100vw-2rem),19rem)] origin-top-right"
                  >
                    <GlassPanel className="overflow-hidden p-0 shadow-xl ring-1 ring-slate-200/60">
                      <div className="border-b border-slate-100 bg-linear-to-br from-slate-50/95 to-white px-4 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-brand-bright to-brand text-sm font-black text-white shadow-lg ring-4 ring-white/80">
                            {initials}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-bold text-slate-900">{displayName}</p>
                            <p className="mt-0.5 flex items-center gap-1 truncate text-xs font-medium text-slate-600">
                              <Mail className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
                              {displayEmail}
                            </p>
                          </div>
                        </div>
                        {lastLoginFull ? (
                          <p className="mt-3 flex items-center gap-2 rounded-xl bg-white/70 px-3 py-2 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-100">
                            <Clock className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden />
                            Last login: {lastLoginFull}
                          </p>
                        ) : (
                          <p className="mt-3 text-[11px] font-medium text-slate-500">Last login not available yet.</p>
                        )}
                      </div>
                      <div className="p-2">
                        <button
                          type="button"
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                          onClick={() => {
                            setProfileOpen(false)
                            navigate('/admin/profile')
                          }}
                        >
                          <User className="h-4 w-4 text-slate-400" aria-hidden />
                          Profile settings
                        </button>
                        <button
                          type="button"
                          onClick={handleLogout}
                          className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-bold text-rose-700 transition hover:bg-rose-50"
                        >
                          <LogOut className="h-4 w-4" aria-hidden />
                          Log out
                        </button>
                      </div>
                    </GlassPanel>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-6 lg:p-8">
          <motion.div
            key={pathname}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reduce ? { duration: 0 } : appSpring}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>
    </div>
  )
}
