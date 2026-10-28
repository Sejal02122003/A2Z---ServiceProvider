import { createSlice } from '@reduxjs/toolkit'

export const AUTH_STORAGE_KEY = 'lc_access_token'
export const AUTH_USER_KEY = 'lc_user'

function readStoredToken() {
  if (typeof localStorage === 'undefined') return null
  return localStorage.getItem(AUTH_STORAGE_KEY)
}

function readStoredUser() {
  if (typeof localStorage === 'undefined') return null
  try {
    const raw = localStorage.getItem(AUTH_USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (e) {
    console.warn('[authSlice] Failed to parse cached user:', e)
    return null
  }
}

const initialToken = readStoredToken()
const initialUser = initialToken ? readStoredUser() : null

const authSlice = createSlice({
  name: 'auth',
  initialState: {
    token: initialToken,
    user: initialUser,
    loading: Boolean(initialToken && !initialUser),
  },
  reducers: {
    setCredentials(state, action) {
      const { accessToken, user } = action.payload
      if (accessToken) {
        localStorage.setItem(AUTH_STORAGE_KEY, accessToken)
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY)
      }

      if (user) {
        try {
          localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user))
        } catch (e) {
          console.warn('[authSlice] Failed to persist user:', e)
        }
      } else if (!accessToken) {
        localStorage.removeItem(AUTH_USER_KEY)
      }

      state.token = accessToken ?? null
      state.user = user ?? null
      state.loading = false
    },
    setUser(state, action) {
      const user = action.payload
      if (user) {
        try {
          localStorage.setItem(AUTH_USER_KEY, JSON.stringify(user))
        } catch (e) {
          console.warn('[authSlice] Failed to persist user update:', e)
        }
      } else if (!state.token) {
        localStorage.removeItem(AUTH_USER_KEY)
      }
      state.user = user
    },
    setLoading(state, action) {
      state.loading = action.payload
    },
    clearSession(state) {
      localStorage.removeItem(AUTH_STORAGE_KEY)
      localStorage.removeItem(AUTH_USER_KEY)
      state.token = null
      state.user = null
      state.loading = false
    },
  },
})

export const { setCredentials, setUser, setLoading, clearSession } = authSlice.actions
export const authReducer = authSlice.reducer
