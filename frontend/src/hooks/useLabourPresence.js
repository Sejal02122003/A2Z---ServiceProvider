import { useCallback, useEffect, useState } from 'react'
import { updateLabourStatus } from '../api/locationApi.js'

const PRESENCE_KEY = 'lc-labour-presence'
const EVENT = 'lc-labour-presence'

export function readLabourPresenceOnline() {
  if (typeof window === 'undefined') return true
  return localStorage.getItem(PRESENCE_KEY) !== 'offline'
}

export function writeLabourPresenceOnline(online) {
  if (typeof window === 'undefined') return
  localStorage.setItem(PRESENCE_KEY, online ? 'online' : 'offline')
  window.dispatchEvent(new CustomEvent(EVENT))
  updateLabourStatus(online ? 'available' : 'offline').catch(() => {})
}

/** Online / offline for worker availability (local until presence API exists). */
export function useLabourPresence() {
  const [online, setOnlineState] = useState(readLabourPresenceOnline)

  useEffect(() => {
    const sync = () => setOnlineState(readLabourPresenceOnline())
    window.addEventListener(EVENT, sync)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener(EVENT, sync)
      window.removeEventListener('storage', sync)
    }
  }, [])

  const setOnline = useCallback((next) => {
    writeLabourPresenceOnline(next)
    setOnlineState(next)
  }, [])

  const toggle = useCallback(() => {
    const next = !readLabourPresenceOnline()
    setOnline(next)
  }, [setOnline])

  return { online, setOnline, toggle }
}
