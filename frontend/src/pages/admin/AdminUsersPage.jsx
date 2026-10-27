import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { ChevronLeft, ChevronRight, RefreshCw, Search, Users, Eye, Trash2, Ban, ShieldCheck } from 'lucide-react'
import { fetchAdminUsers, deleteAdminUser, updateAdminUserStatus } from '../../api/adminUsersApi.js'
import { ApiError } from '../../api/http.js'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { ROLE_LABELS, ROLE_LIST } from '../../constants/userRoles.js'
import { formatLastLoginDisplay } from '../../lib/formatAdminLastLogin.js'
import { AdminUserViewModal } from './components/AdminUserViewModal.jsx'
import { AdminUserDeleteModal } from './components/AdminUserDeleteModal.jsx'

function StatusPill({ active }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1 ${
        active
          ? 'bg-emerald-50 text-emerald-800 ring-emerald-200/80'
          : 'bg-rose-50 text-rose-800 ring-rose-200/80'
      }`}
    >
      <span className={`size-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
      {active ? 'Unblocked' : 'Blocked'}
    </span>
  )
}

function RolePill({ role }) {
  return (
    <span className="inline-flex max-w-full truncate rounded-lg bg-slate-100 px-2 py-0.5 text-xs font-semibold capitalize text-slate-800 ring-1 ring-slate-200/80">
      {ROLE_LABELS[role] || role}
    </span>
  )
}

export function AdminUsersPage() {
  const reduce = useReducedMotion()
  const [searchParams] = useSearchParams()
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const limit = 15

  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  
  const [viewingUser, setViewingUser] = useState(null)
  const [deletingUser, setDeletingUser] = useState(null)
  const [togglingUserId, setTogglingUserId] = useState(null)

  const handleToggleBlock = async (u) => {
    const isCurrentlyActive = u.isActive !== false
    const actionName = isCurrentlyActive ? 'block' : 'unblock'
    const confirmMsg = isCurrentlyActive
      ? `Are you sure you want to BLOCK ${u.fullName || 'this user'}? They will be signed out and unable to access the app.`
      : `Are you sure you want to UNBLOCK ${u.fullName || 'this user'}? Their access will be restored immediately.`

    if (!window.confirm(confirmMsg)) return

    try {
      setTogglingUserId(u._id)
      await updateAdminUserStatus(u._id, !isCurrentlyActive)
      setItems((prev) =>
        prev.map((item) =>
          item._id === u._id ? { ...item, isActive: !isCurrentlyActive } : item
        )
      )
    } catch (err) {
      alert(err.message || `Failed to ${actionName} user`)
    } finally {
      setTogglingUserId(null)
    }
  }

  useEffect(() => {
    const fromUrl = searchParams.get('role')
    if (fromUrl && ROLE_LIST.includes(fromUrl)) setRole(fromUrl)
  }, [searchParams])

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 350)
    return () => window.clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, role, status])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAdminUsers({
        search: debouncedSearch,
        role: role || undefined,
        status,
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
  }, [debouncedSearch, role, status, page, limit])

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
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 md:text-xl">All users</h2>
          <p className="mt-1 text-sm text-slate-600">
            Search by name, email, or mobile. Filter by role and account status. Block or unblock accounts anytime. Data loads from{' '}
            <code className="rounded bg-slate-200/70 px-1 font-mono text-xs">GET /users</code> (admin).
          </p>
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
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm shadow-sm outline-none focus:ring-2 focus:ring-brand/35"
            >
              <option value="">All roles</option>
              {ROLE_LIST.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r] || r}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm shadow-sm outline-none focus:ring-2 focus:ring-brand/35"
            >
              <option value="all">All Accounts (Blocked & Unblocked)</option>
              <option value="unblocked">Unblocked (Active)</option>
              <option value="blocked">Blocked</option>
            </select>
          </div>
        </div>
        <p className="mt-4 text-xs font-medium text-slate-500">
          Showing {items.length} of {total} user{total === 1 ? '' : 's'}
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
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last login</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      {Array.from({ length: 7 }).map((__, j) => (
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
                      <td className="max-w-[200px] truncate px-4 py-3 text-slate-600">{u.email || '—'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <RolePill role={u.role} />
                          {u.welcomeKit?.paymentReceiptUrl && (
                            <button
                              type="button"
                              onClick={() => setViewingUser(u._id)}
                              className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200 transition cursor-pointer"
                              title="Payment slip uploaded - click to view details"
                            >
                              🧾 Slip
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill active={u.isActive !== false} />
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{formatLastLoginDisplay(u.lastLoginAt) || '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-500">
                        {u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleToggleBlock(u)}
                            disabled={togglingUserId === u._id}
                            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold transition border cursor-pointer ${
                              u.isActive !== false
                                ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 hover:border-rose-300'
                                : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 hover:border-emerald-300'
                            } disabled:opacity-50`}
                            title={u.isActive !== false ? 'Block this account' : 'Unblock this account'}
                          >
                            {togglingUserId === u._id ? (
                              <RefreshCw className="size-3.5 animate-spin" />
                            ) : u.isActive !== false ? (
                              <Ban className="size-3.5 text-rose-600" />
                            ) : (
                              <ShieldCheck className="size-3.5 text-emerald-600" />
                            )}
                            <span>{u.isActive !== false ? 'Block' : 'Unblock'}</span>
                          </button>
                          <button
                            onClick={() => setViewingUser(u._id)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-brand/10 hover:text-brand transition-colors cursor-pointer"
                            title="View Details"
                          >
                            <Eye className="size-4" />
                          </button>
                          <button
                            onClick={() => setDeletingUser(u)}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-100 hover:text-rose-600 transition-colors cursor-pointer"
                            title="Delete User"
                          >
                            <Trash2 className="size-4" />
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
            <p className="font-semibold text-slate-700">No users match</p>
            <p className="max-w-sm text-xs text-slate-500">Try clearing search or widening role / status filters.</p>
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
                    <p className="mt-1 truncate text-xs text-slate-500">{u.email || '—'}</p>
                  </div>
                  <StatusPill active={u.isActive !== false} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <RolePill role={u.role} />
                  {u.welcomeKit?.paymentReceiptUrl && (
                    <button
                      type="button"
                      onClick={() => setViewingUser(u._id)}
                      className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300"
                    >
                      🧾 Payment Slip
                    </button>
                  )}
                  <span className="text-[11px] text-slate-500">
                    Last login: {formatLastLoginDisplay(u.lastLoginAt) || '—'}
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => handleToggleBlock(u)}
                    disabled={togglingUserId === u._id}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold border transition cursor-pointer ${
                      u.isActive !== false
                        ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                    } disabled:opacity-50`}
                  >
                    {togglingUserId === u._id ? (
                      <RefreshCw className="size-3.5 animate-spin" />
                    ) : u.isActive !== false ? (
                      <Ban className="size-3.5 text-rose-600" />
                    ) : (
                      <ShieldCheck className="size-3.5 text-emerald-600" />
                    )}
                    {u.isActive !== false ? 'Block' : 'Unblock'}
                  </button>
                  <button
                    onClick={() => setViewingUser(u._id)}
                    className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-brand/10 hover:text-brand transition-colors cursor-pointer"
                  >
                    <Eye className="size-3.5" /> View
                  </button>
                  <button
                    onClick={() => setDeletingUser(u)}
                    className="flex items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-rose-100 hover:text-rose-600 transition-colors cursor-pointer"
                  >
                    <Trash2 className="size-3.5" /> Delete
                  </button>
                </div>
              </GlassPanel>
            ))}
        {!loading && items.length === 0 ? (
          <GlassPanel className="p-8 text-center">
            <Users className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-2 font-semibold text-slate-700">No users match</p>
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
          onStatusChange={(updatedId, nextActive) => {
            setItems((prev) =>
              prev.map((item) =>
                item._id === updatedId ? { ...item, isActive: nextActive } : item
              )
            )
          }}
        />
      )}

      {deletingUser && (
        <AdminUserDeleteModal
          user={deletingUser}
          onClose={() => setDeletingUser(null)}
          onConfirm={async (id) => {
            await deleteAdminUser(id)
            setDeletingUser(null)
            load() // refresh list
          }}
        />
      )}
    </div>
  )
}
