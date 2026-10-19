import { useCallback, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { buildGuestUser, clearBootRole, readBootRole, writeBootRole } from '../lib/bootPersona.js'
import { clearSession, setCredentials } from '../store/slices/authSlice.js'
import { baseApi } from '../store/api/baseApi.js'
import { apiRequest } from '../api/http.js'
import { registerFCMToken } from '../services/pushNotificationService.js'

export function useAuth() {
  const dispatch = useDispatch()
  const { token, user: realUser, loading } = useSelector((s) => s.auth)
  const [bootRole, setBootRoleState] = useState(() => readBootRole())

  const effectiveUser = useMemo(() => {
    if (realUser) return realUser
    if (bootRole) return buildGuestUser(bootRole)
    return null
  }, [realUser, bootRole])

  const isGuest = Boolean(!token && !realUser && bootRole)

  const isAuthenticated = Boolean(
    (token && realUser) || (!token && bootRole && effectiveUser),
  )

  const setBootRole = useCallback((role) => {
    writeBootRole(role)
    setBootRoleState(role)
  }, [])

  const logout = useCallback(async () => {
    try {
      // Clean up FCM token from backend
      const fcmToken = localStorage.getItem('fcm_token_web')
      if (fcmToken) {
        await apiRequest('/fcm-tokens/remove', {
          method: 'DELETE',
          body: { token: fcmToken, platform: 'web' }
        })
        localStorage.removeItem('fcm_token_web')
      }
      await apiRequest('/auth/logout', { method: 'POST' })
    } catch (e) {
      // Ignore network errors on logout
    }
    clearBootRole()
    setBootRoleState(null)
    dispatch(clearSession())
    try {
      dispatch(baseApi.util.resetApiState())
    } catch (err) {
      // Ignore if store is not ready
    }
  }, [dispatch])

  const applySession = useCallback(
    (accessToken, nextUser) => {
      clearBootRole()
      setBootRoleState(null)
      dispatch(setCredentials({ accessToken, user: nextUser }))
      
      // We delay it slightly to ensure Redux state is updated first, 
      // since registerFCMToken checks the store for auth token.
      setTimeout(() => registerFCMToken(true).catch(() => {}), 500)
    },
    [dispatch],
  )

  return {
    token,
    user: effectiveUser,
    realUser,
    bootRole,
    loading,
    isGuest,
    isAuthenticated,
    setBootRole,
    applySession,
    logout,
  }
}
