import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, CheckCheck, Loader2, Trash2 } from 'lucide-react'
import { notificationApi } from '../../api/notificationApi.js'
import { useSocket } from '../../context/SocketContext.jsx'

const PAGE_SIZE = 30

function formatWhen(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function AdminNotificationsPage() {
  const navigate = useNavigate()
  const socket = useSocket()
  const [items, setItems] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [unreadCount, setUnreadCount] = useState(0)
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const pageRef = useRef(1)

  const normalize = (list) => list.map((n) => ({ ...n, isRead: Boolean(n.isRead ?? n.read) }))

  // Reloads everything loaded so far (pages 1..current) so live refreshes never drop older items.
  const reload = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    try {
      const upTo = pageRef.current
      const res = await notificationApi.getMyNotifications({ page: 1, limit: PAGE_SIZE * upTo, unreadOnly })
      const data = res?.data || {}
      setItems(normalize(Array.isArray(data.notifications) ? data.notifications : []))
      setTotal(data.pagination?.total ?? 0)
      setTotalPages(Math.max(1, Math.ceil((data.pagination?.total ?? 0) / PAGE_SIZE)))
      setUnreadCount(data.unreadCount ?? 0)
      setError('')
    } catch (err) {
      setError(err?.message || 'Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }, [unreadOnly])

  useEffect(() => {
    pageRef.current = 1
    setPage(1)
    reload()
  }, [reload])

  // Live: refresh on any admin socket alert, plus a light poll as a safety net
  useEffect(() => {
    const refresh = () => reload({ silent: true })
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') refresh()
    }, 30_000)
    const events = [
      'ADMIN_NOTIFICATION', 'NEW_BOOKING_ALERT', 'BOOKING_ACCEPTED_ADMIN', 'BOOKING_STATUS_UPDATE_ADMIN',
      'WALLET_RECHARGE_REQUEST_SUBMITTED', 'PROVIDER_PAYMENT_SUBMITTED', 'PROVIDER_APPROVAL_REQUEST', 'WELCOME_KIT_PAYMENT_SUBMITTED',
    ]
    const onEvent = () => setTimeout(refresh, 1200)
    if (socket) events.forEach((e) => socket.on(e, onEvent))
    return () => {
      clearInterval(timer)
      if (socket) events.forEach((e) => socket.off(e, onEvent))
    }
  }, [socket, reload])

  const loadMore = async () => {
    const next = page + 1
    setLoadingMore(true)
    try {
      const res = await notificationApi.getMyNotifications({ page: next, limit: PAGE_SIZE, unreadOnly })
      const more = normalize(res?.data?.notifications || [])
      setItems((prev) => {
        const seen = new Set(prev.map((n) => n._id))
        return [...prev, ...more.filter((n) => !seen.has(n._id))]
      })
      pageRef.current = next
      setPage(next)
    } catch (err) {
      setError(err?.message || 'Failed to load more')
    } finally {
      setLoadingMore(false)
    }
  }

  const openItem = (n) => {
    if (!n.isRead) {
      notificationApi.markNotificationRead(n._id).catch(() => {})
      setItems((prev) => prev.map((x) => (x._id === n._id ? { ...x, isRead: true } : x)))
      setUnreadCount((c) => Math.max(0, c - 1))
    }
    navigate(n.metadata?.link || '/admin/bookings')
  }

  const markAllRead = async () => {
    try {
      await notificationApi.markAllNotificationsRead()
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })))
      setUnreadCount(0)
    } catch (err) {
      setError(err?.message || 'Failed to mark all as read')
    }
  }

  const removeItem = async (e, n) => {
    e.stopPropagation()
    try {
      await notificationApi.deleteNotification(n._id)
      setItems((prev) => prev.filter((x) => x._id !== n._id))
      setTotal((t) => Math.max(0, t - 1))
      if (!n.isRead) setUnreadCount((c) => Math.max(0, c - 1))
    } catch (err) {
      setError(err?.message || 'Failed to delete notification')
    }
  }

  const clearRead = async () => {
    try {
      await notificationApi.clearNotifications({ readOnly: true })
      reload({ silent: true })
    } catch (err) {
      setError(err?.message || 'Failed to clear notifications')
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900">All notifications</h1>
          <p className="text-xs text-slate-500">
            {total} total{unreadCount > 0 ? ` · ${unreadCount} unread` : ''} · updates live
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex overflow-hidden rounded-xl border border-slate-200 bg-white text-xs font-bold">
            <button
              type="button"
              onClick={() => setUnreadOnly(false)}
              className={`px-3 py-2 ${!unreadOnly ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setUnreadOnly(true)}
              className={`px-3 py-2 ${unreadOnly ? 'bg-brand text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              Unread
            </button>
          </div>
          <button
            type="button"
            onClick={markAllRead}
            disabled={unreadCount === 0}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-brand hover:bg-slate-50 disabled:opacity-40"
          >
            <CheckCheck className="h-4 w-4" /> Mark all read
          </button>
          <button
            type="button"
            onClick={clearRead}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            <Trash2 className="h-4 w-4" /> Clear read
          </button>
        </div>
      </div>

      {error ? (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{error}</p>
      ) : null}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <Bell className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-600">
              {unreadOnly ? 'No unread notifications' : 'No notifications yet'}
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map((n) => (
              <li
                key={n._id}
                onClick={() => openItem(n)}
                className={`flex cursor-pointer items-start gap-3 p-4 transition hover:bg-slate-50 ${!n.isRead ? 'bg-amber-50/40' : ''}`}
              >
                <span
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                    !n.isRead ? 'bg-brand/15 text-brand' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  <Bell className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-bold text-slate-900">{n.title}</p>
                    {!n.isRead ? <span className="h-2 w-2 shrink-0 rounded-full bg-brand" /> : null}
                  </div>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-600">{n.body}</p>
                  <span className="mt-1 block text-[11px] text-slate-400">{formatWhen(n.createdAt)}</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => removeItem(e, n)}
                  aria-label="Delete notification"
                  className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {!loading && page < totalPages && items.length < total ? (
        <div className="text-center">
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-brand hover:bg-slate-50 disabled:opacity-50"
          >
            {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Load older notifications
          </button>
        </div>
      ) : null}
    </div>
  )
}
