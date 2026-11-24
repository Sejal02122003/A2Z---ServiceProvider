import { createContext, useContext, useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { io } from 'socket.io-client'

const SocketContext = createContext(null)

const SOCKET_URL =
  import.meta.env.VITE_SOCKET_URL ||
  (import.meta.env.VITE_API_URL
    ? import.meta.env.VITE_API_URL.replace(/\/api\/v1\/?$/, '')
    : 'http://localhost:5005')

let currentSocket = null
let currentToken = null

export function SocketProvider({ children }) {
  const token = useSelector((s) => s.auth.token)
  const [socket, setSocket] = useState(null)

  useEffect(() => {
    console.log('[Socket][SP] Provider effect → hasToken =', Boolean(token), '| tokenPreview =', token ? token.slice(0, 12) + '…' : null, '| localStorage token present =', Boolean(typeof localStorage !== 'undefined' && localStorage.getItem('lc_access_token')))
    if (!token) {
      console.warn('[Socket][SP] NO TOKEN in redux auth state → socket NOT created. Provider will never get live bookings until logged in.')
      if (currentSocket) {
        currentSocket.disconnect()
        currentSocket = null
        currentToken = null
      }
      setSocket(null)
      return
    }

    // Reuse existing socket if token hasn't changed (prevents React Strict Mode from closing and reopening)
    if (currentSocket && currentToken === token) {
      setSocket(currentSocket)
      return
    }

    if (currentSocket) {
      currentSocket.disconnect()
    }

    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 10,
      reconnectionDelay: 2000,
    })

    console.log('[Socket][SP] Creating socket →', SOCKET_URL)

    newSocket.on('connect', () => {
      console.log('[Socket][SP] Connected:', newSocket.id, '| transport:', newSocket.io?.engine?.transport?.name, '| url:', SOCKET_URL)
    })

    newSocket.on('disconnect', (reason) => {
      console.warn('[Socket][SP] Disconnected. reason =', reason)
    })

    newSocket.io.on('reconnect_attempt', (n) => {
      console.log('[Socket][SP] Reconnect attempt #', n)
    })

    newSocket.io.on('reconnect_failed', () => {
      console.error('[Socket][SP] Reconnect FAILED - giving up')
    })

    // Log EVERY event received so we can see if BOOKING_RECEIVED ever arrives
    newSocket.onAny((eventName, ...args) => {
      console.log(`[Socket][SP] ◀ EVENT "${eventName}"`, args[0])
    })

    newSocket.on('connect_error', (err) => {
      console.warn('[Socket][SP] Connection error:', err.message)
      if (err.message && err.message.toLowerCase().includes('authentication error')) {
        newSocket.disconnect()
      }
    })

    currentSocket = newSocket
    currentToken = token

    setSocket(newSocket)

    return () => {
      // In React Strict Mode, we intentionally do not disconnect here.
      // Disconnection will happen when the token becomes null or changes.
    }
  }, [token])

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  return useContext(SocketContext)
}
