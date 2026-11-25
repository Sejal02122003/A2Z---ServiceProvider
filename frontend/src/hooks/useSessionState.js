import { useCallback, useState } from 'react'

/**
 * useState that survives a remount (e.g. the admin auto-refresh) by keeping the value in
 * sessionStorage for the current tab. Falls back to plain state if storage is unavailable.
 */
export function useSessionState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = sessionStorage.getItem(key)
      if (raw !== null) return JSON.parse(raw)
    } catch {
      /* ignore */
    }
    return initialValue
  })

  const setAndStore = useCallback(
    (next) => {
      setValue((prev) => {
        const resolved = typeof next === 'function' ? next(prev) : next
        try {
          sessionStorage.setItem(key, JSON.stringify(resolved))
        } catch {
          /* ignore */
        }
        return resolved
      })
    },
    [key],
  )

  return [value, setAndStore]
}
