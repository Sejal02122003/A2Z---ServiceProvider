import { useCallback, useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ChevronLeft, ChevronRight, RefreshCw, Search, Users, Eye, Sparkles } from 'lucide-react'
import { fetchAdminUsers } from '../../api/adminUsersApi.js'
import { ApiError } from '../../api/http.js'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { AdminUserViewModal } from './components/AdminUserViewModal.jsx'

function FreeTrialStatusPill({ user }) {
  const trialEnds = user?.labourProfile?.trialEndsAt ? new Date(user.labourProfile.trialEndsAt) : null
  const trialStarted = user?.labourProfile?.trialStartedAt ? new Date(user.labourProfile.trialStartedAt) : null
  
  if (!trialStarted && !trialEnds) {
    return <span className="text-xs text-slate-500">—</span>
  }
  
  const isActive = trialEnds && trialEnds.getTime() > Date.now()
  
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1 ${
        isActive
          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200/80'
          : 'bg-rose-50 text-rose-700 ring-rose-200/80'
      }`}
    >
      {isActive ? 'Active' : 'Expired'}
    </span>
  )
}

export function AdminFreeTrialPage() {
  const reduce = useReducedMotion()
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [freeTrialStatus, setFreeTrialStatus] = useState('all')
  const [page, setPage] = useState(1)
  const limit = 15

  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  const [viewingUser, setViewingUser] = useState(null)

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 350)
    return () => window.clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, freeTrialStatus])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAdminUsers({
        search: debouncedSearch,
        role: 'labour',
        freeTrialStatus,
        page,
        limit,
      })
      setItems(data?.items ?? [])
      setTotal(data?.total ?? 0)
      setPages(data?.pages ?? 1)
    } catch (e) {
      setItems([])
      setError(e instanceof ApiError ? e.message : 'Could not load users')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, freeTrialStatus, page, limit])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-lg ring-4 ring-emerald-500/10">
            <Sparkles className="h-6 w-6" aria-hidden />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">Free Trials</h1>
            <p className="text-sm text-slate-500">Monitor service provider free trial statuses</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => load()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 self-start rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand/30 disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
          Refresh
        </button>
      </motion.div>

      <GlassPanel className="p-4 md:p-5">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Name, email, or mobile number…"
                className="w-full rounded-xl border border-slate-200/90 bg-white py-2.5 pl-10 pr-3 text-sm shadow-sm outline-none ring-slate-200/80 focus:ring-2 focus:ring-brand/35"
              />
            </div>
          </div>
          <div className="lg:col-span-2">
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Free Trial Status</label>
            <select
              value={freeTrialStatus}
              onChange={(e) => setFreeTrialStatus(e.target.value)}
              className="w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm shadow-sm outline-none focus:ring-2 focus:ring-brand/35"
            >
              <option value="all">All Free Trials</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
            </select>
          </div>
        </div>
        <p className="mt-4 text-xs font-medium text-slate-500">
          Showing {items.length} of {total} service provider{total === 1 ? '' : 's'}
          {debouncedSearch ? ` · matching “${debouncedSearch}”` : ''}
        </p>
      </GlassPanel>

      {error ? (
        <p className="rounded-xl border border-rose-200/80 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900">{error}</p>
      ) : null}

      {/* Desktop table */}
      <GlassPanel className="hidden overflow-hidden p-0 md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Started At</th>
                <th className="px-4 py-3">Ends At</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      {Array.from({ length: 5 }).map((__, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 animate-pulse rounded bg-slate-200/80" />
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <div className="h-4 animate-pulse rounded bg-slate-200/80" />
                      </td>
                    </tr>
                  ))
                : items.map((u) => (
                    <tr key={u._id} className="border-b border-slate-100 transition hover:bg-slate-50/60">
                      <td className="px-4 py-3 font-semibold text-slate-900">{u.fullName || '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs tabular-nums text-slate-700">
                        {u.phone ? `+91 ${u.phone}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <FreeTrialStatusPill user={u} />
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {u.labourProfile?.trialStartedAt ? new Date(u.labourProfile.trialStartedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {u.labourProfile?.trialEndsAt ? new Date(u.labourProfile.trialEndsAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setViewingUser(u._id)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-brand/10 hover:text-brand transition-colors"
                            title="View Details"
                          >
                            <Eye className="size-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        {!loading && items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Users className="h-10 w-10 text-slate-300" aria-hidden />
            <p className="font-semibold text-slate-700">No free trials found</p>
          </div>
        ) : null}
      </GlassPanel>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <GlassPanel key={i} className="p-4">
                <div className="h-5 w-40 animate-pulse rounded bg-slate-200/80" />
                <div className="mt-3 h-4 w-full animate-pulse rounded bg-slate-200/60" />
              </GlassPanel>
            ))
          : items.map((u) => (
              <GlassPanel key={u._id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-bold text-slate-900">{u.fullName || '—'}</p>
                    <p className="mt-0.5 font-mono text-xs text-slate-600">+91 {u.phone || '—'}</p>
                  </div>
                  <FreeTrialStatusPill user={u} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-slate-500">
                    Started: {u.labourProfile?.trialStartedAt ? new Date(u.labourProfile.trialStartedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    Ends: {u.labourProfile?.trialEndsAt ? new Date(u.labourProfile.trialEndsAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                  <button
                    onClick={() => setViewingUser(u._id)}
                    className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-brand/10 hover:text-brand transition-colors"
                  >
                    <Eye className="size-3.5" /> View
                  </button>
                </div>
              </GlassPanel>
            ))}
        {!loading && items.length === 0 ? (
          <GlassPanel className="p-8 text-center">
            <Users className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-2 font-semibold text-slate-700">No free trials found</p>
          </GlassPanel>
        ) : null}
      </div>

      {pages > 1 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-medium text-slate-500">
            Page {page} of {pages}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand/30 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
              Prev
            </button>
            <button
              type="button"
              disabled={page >= pages || loading}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200/80 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand/30 disabled:opacity-40"
            >
              Next
              <ChevronRight className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>
      ) : null}

      {viewingUser && (
        <AdminUserViewModal
          userId={viewingUser}
          onClose={() => setViewingUser(null)}
        />
      )}
    </div>
  )
}
