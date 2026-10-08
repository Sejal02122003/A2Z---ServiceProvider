import { createContext, useContext, useEffect, useState } from 'react'
import { useSelector } from 'react-redux'
import { io } from 'socket.io-client'

const SocketContext = createContext(null)

const SOCKET_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5005/api/v1').replace('/api/v1', '')

let currentSocket = null
let currentToken = null

export function SocketProvider({ children }) {
  const token = useSelector((s) => s.auth.token)
  const [socket, setSocket] = useState(null)

  useEffect(() => {
    if (!token) {
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
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    })

    newSocket.on('connect', () => {
      console.log('[Socket] Connected:', newSocket.id)
    })

    newSocket.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message)
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
