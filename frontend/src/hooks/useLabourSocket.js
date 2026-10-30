import { useEffect, useState } from 'react'
import { useSocket } from '../context/SocketContext.jsx'
import { showDesktopNotification } from '../services/pushNotificationService.js'

export function useLabourSocket() {
  const socket = useSocket()
  const [socketStatus, setSocketStatus] = useState(socket?.connected ? 'connected' : 'disconnected')
  const [liveOffers, setLiveOffers] = useState([])

  useEffect(() => {
    if (!socket) {
      setSocketStatus('disconnected')
      return
    }

    setSocketStatus(socket.connected ? 'connected' : 'disconnected')

    const onConnect = () => setSocketStatus('connected')
    const onDisconnect = () => setSocketStatus('disconnected')

    // Flash Broadcast Received
    const onBookingReceived = (data) => {
      setLiveOffers((prev) => {
        if (prev.find((o) => o.bookingId === data.bookingId)) return prev
        return [...prev, { ...data, receivedAt: Date.now() }]
      })
      const priceText = data?.amount || data?.price ? ` (₹${data.amount || data.price})` : ''
      const svc = data?.serviceName || 'New Service Request'
      showDesktopNotification({
        title: `⚡ New Job Alert${priceText}`,
        body: `${svc}. Tap to review and accept before timeout!`,
        link: '/serviceprovider',
        tag: `offer-${data?.bookingId || Date.now()}`
      })
    }

    // Broadcast expired or accepted by someone else
    const onBookingExpired = (data) => {
      setLiveOffers((prev) => prev.filter((o) => o.bookingId !== data.bookingId))
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('BOOKING_RECEIVED', onBookingReceived)
    socket.on('BOOKING_EXPIRED', onBookingExpired)

    if (socket.connected) {
      onConnect()
    }

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('BOOKING_RECEIVED', onBookingReceived)
      socket.off('BOOKING_EXPIRED', onBookingExpired)
    }
  }, [socket])

  const removeOfferLocal = (bookingId) => {
    setLiveOffers((prev) => prev.filter((o) => o.bookingId !== bookingId))
  }

  return { socketStatus, liveOffers, removeOfferLocal }
}
