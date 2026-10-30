import { useEffect, useState } from 'react'
import { useSocket } from '../context/SocketContext.jsx'
import { showDesktopNotification } from '../services/pushNotificationService.js'

export function useBookingSocket(bookingId) {
  const socket = useSocket()
  const [socketStatus, setSocketStatus] = useState(socket?.connected ? 'connected' : 'disconnected')
  const [bookingEvent, setBookingEvent] = useState(null)

  useEffect(() => {
    if (!socket) return

    const onConnect = () => setSocketStatus('connected')
    const onDisconnect = () => setSocketStatus('disconnected')

    if (socket.connected) {
      setSocketStatus('connected')
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)

    const handleBroadcastStarted = (data) => {
      if (!bookingId || !data?.bookingId || String(data.bookingId) === String(bookingId)) {
        setBookingEvent({ type: 'BOOKING_BROADCAST_STARTED', data })
      }
    }

    const handleAccepted = (data) => {
      if (!bookingId || !data?.bookingId || String(data.bookingId) === String(bookingId)) {
        setBookingEvent({ type: 'BOOKING_ACCEPTED', data })
        const partnerName = data?.partner?.name || data?.partnerName || 'A service partner'
        showDesktopNotification({
          title: '🎉 Booking Confirmed!',
          body: `${partnerName} has accepted your booking!`,
          link: `/user/tracking/${data?.bookingId || bookingId}`,
          tag: `booking-accepted-${data?.bookingId || bookingId}`
        })
      }
    }

    const handleFailed = (data) => {
      if (!bookingId || !data?.bookingId || String(data.bookingId) === String(bookingId)) {
        setBookingEvent({ type: 'BOOKING_FAILED', data })
      }
    }

    const handleStatusUpdate = (data) => {
      if (!bookingId || !data?.bookingId || String(data.bookingId) === String(bookingId)) {
        setBookingEvent({ type: 'BOOKING_STATUS_UPDATE', data })
        if (data?.status) {
          showDesktopNotification({
            title: 'Booking Status Update',
            body: `Status changed to: ${data.status.replace(/_/g, ' ')}`,
            link: `/user/tracking/${data?.bookingId || bookingId}`,
            tag: `booking-status-${data?.bookingId || bookingId}`
          })
        }
      }
    }

    const handleCancelled = (data) => {
      if (!bookingId || !data?.bookingId || String(data.bookingId) === String(bookingId)) {
        setBookingEvent({ type: 'BOOKING_CANCELLED', data })
        showDesktopNotification({
          title: 'Booking Cancelled',
          body: data?.reason || 'Your booking was cancelled.',
          link: `/user/tracking/${data?.bookingId || bookingId}`,
          tag: `booking-cancelled-${data?.bookingId || bookingId}`
        })
      }
    }

    socket.on('BOOKING_BROADCAST_STARTED', handleBroadcastStarted)
    socket.on('BOOKING_ACCEPTED', handleAccepted)
    socket.on('BOOKING_FAILED', handleFailed)
    socket.on('BOOKING_STATUS_UPDATE', handleStatusUpdate)
    socket.on('BOOKING_CANCELLED', handleCancelled)

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('BOOKING_BROADCAST_STARTED', handleBroadcastStarted)
      socket.off('BOOKING_ACCEPTED', handleAccepted)
      socket.off('BOOKING_FAILED', handleFailed)
      socket.off('BOOKING_STATUS_UPDATE', handleStatusUpdate)
      socket.off('BOOKING_CANCELLED', handleCancelled)
    }
  }, [socket, bookingId])

  return { socketStatus, bookingEvent, clearEvent: () => setBookingEvent(null) }
}

