import axios from 'axios'
import { clearSession } from '../store/slices/authSlice.js'
import { store } from '../store/index.js'

const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5005/api/v1'

export class ApiError extends Error {
  constructor(message, { status, code, errors, data } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.errors = errors
    this.data = data
  }
}

export const apiClient = axios.create({
  baseURL: baseUrl,
  headers: {
    Accept: 'application/json',
  },
})

apiClient.interceptors.request.use((config) => {
  if (!config.skipAuth) {
    const token = store.getState().auth.token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  if (
    config.data !== undefined &&
    config.headers['Content-Type'] === undefined &&
    !(typeof FormData !== 'undefined' && config.data instanceof FormData)
  ) {
    config.headers['Content-Type'] = 'application/json'
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status
      const cfg = error.config
      if (status === 401 && cfg && !cfg.skipAuth) {
        const token = store.getState().auth.token
        if (token) store.dispatch(clearSession())
      }
    }
    return Promise.reject(error)
  },
)

/**
 * Shared HTTP client — same envelope as backend (`success`, `message`, `data`, `errors`).
 * @param {string} path
 * @param {{ method?: string, body?: unknown, headers?: Record<string, string>, skipAuth?: boolean }} [options]
 */
export async function apiRequest(path, { method = 'GET', body, headers = {}, skipAuth = false } = {}) {
  try {
    const res = await apiClient.request({
      url: path,
      method,
      data: body,
      headers: { ...headers },
      skipAuth,
    })
    return res.data
  } catch (e) {
    if (axios.isAxiosError(e)) {
      const json = e.response?.data ?? {}
      const message = typeof json.message === 'string' ? json.message : e.message || 'Request failed'
      throw new ApiError(message, {
        status: e.response?.status,
        code: json.code,
        errors: json.errors,
        data: json.data,
      })
    }
    throw e
  }
}
