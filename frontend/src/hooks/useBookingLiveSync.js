import { useEffect, useRef } from 'react'
import { bookingsApi } from '../api/bookingsApi.js'
import { useSocket } from '../context/SocketContext.jsx'

const SOCKET_EVENTS = ['BOOKING_STATUS_UPDATE', 'BOOKING_ACCEPTED', 'BOOKING_CANCELLED', 'MATERIAL_REQUEST_UPDATED']

/**
 * Keeps a booking screen in sync with the server without a manual page refresh.
 * Re-fetches the booking on an interval, whenever the tab/app becomes visible again,
 * when the network or socket reconnects, and on any booking socket event.
 * `onBooking(booking)` receives the fresh server copy each time.
 */
export function useBookingLiveSync({ bookingId, enabled = true, intervalMs = 4000, onBooking }) {
  const socket = useSocket()
  const onBookingRef = useRef(onBooking)

  useEffect(() => {
    onBookingRef.current = onBooking
  }, [onBooking])

  useEffect(() => {
    if (!bookingId || !enabled) return undefined
    let cancelled = false
    let inFlight = false

    const fetchNow = async () => {
      if (cancelled || inFlight) return
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      inFlight = true
      try {
        const res = await bookingsApi.getBookingStatus(bookingId)
        const b = res?.data?.booking
        if (!cancelled && b) onBookingRef.current?.(b)
      } catch {
        /* transient network error: next tick retries */
      } finally {
        inFlight = false
      }
    }

    const timer = setInterval(fetchNow, intervalMs)
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchNow()
    }
    const onSocketEvent = (data) => {
      if (!data?.bookingId || String(data.bookingId) === String(bookingId)) fetchNow()
    }

    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', fetchNow)
    window.addEventListener('online', fetchNow)
    if (socket) {
      socket.on('connect', fetchNow)
      SOCKET_EVENTS.forEach((ev) => socket.on(ev, onSocketEvent))
    }

    return () => {
      cancelled = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', fetchNow)
      window.removeEventListener('online', fetchNow)
      if (socket) {
        socket.off('connect', fetchNow)
        SOCKET_EVENTS.forEach((ev) => socket.off(ev, onSocketEvent))
      }
    }
  }, [bookingId, enabled, intervalMs, socket])
}
