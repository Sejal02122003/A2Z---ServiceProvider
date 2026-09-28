import { useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { useSelector } from 'react-redux'

const BACKEND_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5005/api/v1').replace('/api/v1', '')

let currentSocket = null
let currentToken = null

export function useLabourSocket() {
  const { token } = useSelector((state) => state.auth)
  const [socketStatus, setSocketStatus] = useState('disconnected')
  const [liveOffers, setLiveOffers] = useState([])
  const socketRef = useRef(null)

  useEffect(() => {
    if (!token) {
      if (currentSocket) {
        currentSocket.disconnect()
        currentSocket = null
        currentToken = null
      }
      setSocketStatus('disconnected')
      return
    }

    if (currentSocket && currentToken === token) {
      socketRef.current = currentSocket
      setSocketStatus(currentSocket.connected ? 'connected' : 'disconnected')
    } else {
      if (currentSocket) {
        currentSocket.disconnect()
      }

      const socket = io(BACKEND_URL, {
        auth: { token },
        transports: ['websocket'],
      })
      
      currentSocket = socket
      currentToken = token
      socketRef.current = socket
    }

    const socket = currentSocket

    const onConnect = () => setSocketStatus('connected')
    const onDisconnect = () => setSocketStatus('disconnected')
    const onConnectError = (err) => console.error('Socket error:', err)
    
    // Flash Broadcast Received
    const onBookingReceived = (data) => {
      setLiveOffers((prev) => {
        if (prev.find(o => o.bookingId === data.bookingId)) return prev
        return [...prev, { ...data, receivedAt: Date.now() }]
      })
    }

    // Broadcast expired or accepted by someone else
    const onBookingExpired = (data) => {
      setLiveOffers((prev) => prev.filter(o => o.bookingId !== data.bookingId))
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('connect_error', onConnectError)
    socket.on('BOOKING_RECEIVED', onBookingReceived)
    socket.on('BOOKING_EXPIRED', onBookingExpired)

    // Trigger connect if already connected
    if (socket.connected) {
      onConnect()
    }

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('connect_error', onConnectError)
      socket.off('BOOKING_RECEIVED', onBookingReceived)
      socket.off('BOOKING_EXPIRED', onBookingExpired)
      // Do not disconnect the socket here to avoid React Strict Mode closing it
    }
  }, [token])

  const removeOfferLocal = (bookingId) => {
    setLiveOffers((prev) => prev.filter(o => o.bookingId !== bookingId))
  }

  return { socketStatus, liveOffers, removeOfferLocal }
}
