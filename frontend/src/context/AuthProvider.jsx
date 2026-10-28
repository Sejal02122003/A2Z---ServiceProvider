import { useEffect } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { fetchMe } from '../api/authApi.js'
import { clearSession, setLoading, setUser } from '../store/slices/authSlice.js'

export function AuthProvider({ children }) {
  const dispatch = useDispatch()
  const token = useSelector((s) => s.auth.token)
  const cachedUser = useSelector((s) => s.auth.user)

  useEffect(() => {
    let cancelled = false

    if (!token) {
      queueMicrotask(() => {
        if (!cancelled) {
          dispatch(setUser(null))
          dispatch(setLoading(false))
        }
      })
      return () => {
        cancelled = true
      }
    }

    // Only block with loading state if we do not even have a cached user profile
    if (!cachedUser) {
      queueMicrotask(() => {
        if (!cancelled) dispatch(setLoading(true))
      })
    }

    fetchMe()
      .then((res) => {
        if (!cancelled && res.data?.user) {
          dispatch(setUser(res.data.user))
        }
      })
      .catch((err) => {
        // CRITICAL FIX: Only clear session if server explicitly returns 401 (Invalid/expired token).
        // On temporary network errors, offline mobile app state, server 502/503/500, or timeouts,
        // NEVER clear the user's login session!
        const status = err?.status ?? err?.response?.status
        if (status === 401) {
          console.warn('[AuthProvider] 401 Unauthorized received. Clearing session.')
          if (!cancelled) dispatch(clearSession())
        } else {
          console.warn('[AuthProvider] Background profile refresh failed (offline/network). Keeping session.', err)
        }
      })
      .finally(() => {
        if (!cancelled) dispatch(setLoading(false))
      })

    return () => {
      cancelled = true
    }
  }, [token, dispatch])

  return children
}
