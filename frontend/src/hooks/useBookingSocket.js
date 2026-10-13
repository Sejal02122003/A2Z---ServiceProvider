import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { useSelector } from 'react-redux'

const BACKEND_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5005/api/v1').replace('/api/v1', '')

export function useBookingSocket(bookingId) {
  const { token } = useSelector((state) => state.auth)
  const [socketStatus, setSocketStatus] = useState('disconnected')
  const [bookingEvent, setBookingEvent] = useState(null)
  const socketRef = useRef(null)

  useEffect(() => {
    if (!token) return

    const socket = io(BACKEND_URL, {
      auth: { token },
      transports: ['websocket'],
    })
    
    socketRef.current = socket

    socket.on('connect', () => setSocketStatus('connected'))
    socket.on('disconnect', () => setSocketStatus('disconnected'))
    socket.on('connect_error', (err) => console.error('Socket error:', err))

    socket.on('BOOKING_BROADCAST_STARTED', (data) => {
      if (!bookingId || String(data.bookingId) === String(bookingId)) {
        setBookingEvent({ type: 'BOOKING_BROADCAST_STARTED', data })
      }
    })

    socket.on('BOOKING_ACCEPTED', (data) => {
      if (!bookingId || String(data.bookingId) === String(bookingId)) {
        setBookingEvent({ type: 'BOOKING_ACCEPTED', data })
      }
    })

    socket.on('BOOKING_FAILED', (data) => {
      if (!bookingId || String(data.bookingId) === String(bookingId)) {
        setBookingEvent({ type: 'BOOKING_FAILED', data })
      }
    })

    socket.on('BOOKING_STATUS_UPDATE', (data) => {
      if (!bookingId || String(data.bookingId) === String(bookingId)) {
        setBookingEvent({ type: 'BOOKING_STATUS_UPDATE', data })
      }
    })

    return () => {
      socket.disconnect()
    }
  }, [token, bookingId])

  return { socketStatus, bookingEvent, clearEvent: () => setBookingEvent(null) }
}
