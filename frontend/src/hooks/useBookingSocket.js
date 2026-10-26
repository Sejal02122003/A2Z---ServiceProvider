import { useEffect, useState } from 'react'
import { useSocket } from '../context/SocketContext.jsx'

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
      }
    }

    const handleCancelled = (data) => {
      if (!bookingId || !data?.bookingId || String(data.bookingId) === String(bookingId)) {
        setBookingEvent({ type: 'BOOKING_CANCELLED', data })
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

