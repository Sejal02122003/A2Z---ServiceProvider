import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import {
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  IdCard,
  Layers,
  Loader2,
  Package,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react'
import { fetchAdminUserById, fetchAdminUsers, reviewLabourKycAdmin } from '../../api/adminUsersApi.js'
import { ApiError } from '../../api/http.js'
import { AppPrimaryButton } from '../../components/app/AppPrimaryButton.jsx'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { KYC_STATUS, USER_ROLES } from '../../constants/userRoles.js'
import { formatLastLoginDisplay } from '../../lib/formatAdminLastLogin.js'
import { KitStatusBadge } from '../../components/admin/welcomeKit/KitStatusBadge.jsx'
import { WelcomeKitModal } from '../../components/admin/welcomeKit/WelcomeKitModal.jsx'

function readInitialKyc(sp) {
  const k = sp.get('kyc')?.toLowerCase()
  if (k === KYC_STATUS.PENDING || k === KYC_STATUS.VERIFIED || k === KYC_STATUS.FAILED) return k
  return 'all'
}

function readInitialKit(sp) {
  const k = sp.get('kit')?.toLowerCase()
  if (k === 'complete' || k === 'partial' || k === 'not_issued') return k
  return 'all'
}

function readInitialStatus(sp) {
  const s = sp.get('status')?.toLowerCase()
  if (s === 'active' || s === 'inactive') return s
  return 'all'
}

function KycPill({ status, submittedAt }) {
  const raw = status || KYC_STATUS.PENDING
  if (raw === KYC_STATUS.PENDING && submittedAt) {
    return (
      <span className="inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1 bg-sky-50 text-sky-900 ring-sky-200/80">
        Submitted
      </span>
    )
  }
  const map = {
    [KYC_STATUS.PENDING]: 'bg-amber-50 text-amber-900 ring-amber-200/80',
    [KYC_STATUS.VERIFIED]: 'bg-blue-50 text-blue-900 ring-blue-200/80',
    [KYC_STATUS.FAILED]: 'bg-rose-50 text-rose-900 ring-rose-200/80',
  }
  const label = raw === KYC_STATUS.PENDING ? 'Pending' : raw === KYC_STATUS.VERIFIED ? 'Verified' : 'Failed'
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1 ${map[raw] || map[KYC_STATUS.PENDING]}`}
    >
      {label}
    </span>
  )
}

function StatusPill({ active }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1 ${
        active ? 'bg-blue-50 text-blue-900 ring-blue-200/80' : 'bg-slate-100 text-slate-600 ring-slate-200/80'
      }`}
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

function formatSkillLine(user) {
  const cats = user?.labourProfile?.categoryIds
  if (!Array.isArray(cats) || cats.length === 0) return '—'
  const names = cats.map((c) => (c && typeof c === 'object' && c.name ? c.name : null)).filter(Boolean)
  if (!names.length) return `${cats.length} selected`
  const s = names.join(', ')
  return s.length > 48 ? `${s.slice(0, 45)}…` : s
}

function formatServiceLine(user) {
  const svcs = user?.labourProfile?.serviceIds
  if (!Array.isArray(svcs) || svcs.length === 0) return ''
  const names = svcs.map((s) => (s && typeof s === 'object' && s.name ? s.name : null)).filter(Boolean)
  if (!names.length) return `${svcs.length} selected`
  const s = names.join(', ')
  return s.length > 48 ? `${s.slice(0, 45)}…` : s
}

export function AdminLabourPage() {
  const reduce = useReducedMotion()
  const [searchParams, setSearchParams] = useSearchParams()

  const [searchInput, setSearchInput] = useState(() => searchParams.get('search')?.trim() || '')
  const [debouncedSearch, setDebouncedSearch] = useState(() => searchParams.get('search')?.trim() || '')
  const [kycFilter, setKycFilter] = useState(() => readInitialKyc(searchParams))
  const [kitFilter, setKitFilter] = useState(() => readInitialKit(searchParams))
  const [status, setStatus] = useState(() => readInitialStatus(searchParams))
  const [locationFilter, setLocationFilter] = useState(() => searchParams.get('location') || '')
  const [debouncedLocation, setDebouncedLocation] = useState(() => searchParams.get('location') || '')
  const [page, setPage] = useState(() => Math.max(1, Number(searchParams.get('page')) || 1))
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') === 'contractor' ? 'contractor' : 'labour')
  const limit = 12

  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [kycStats, setKycStats] = useState(null)
  const [reviewUserId, setReviewUserId] = useState(null)
  const [kitModalUser, setKitModalUser] = useState(null)
  const [detailUser, setDetailUser] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [reviewNote, setReviewNote] = useState('')
  const [reviewBusy, setReviewBusy] = useState(false)

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 350)
    return () => window.clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedLocation(locationFilter.trim()), 350)
    return () => window.clearTimeout(t)
  }, [locationFilter])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, debouncedLocation, kycFilter, kitFilter, status, activeTab])

  useEffect(() => {
    const next = new URLSearchParams()
    if (debouncedSearch) next.set('search', debouncedSearch)
    if (kycFilter !== 'all') next.set('kyc', kycFilter)
    if (kitFilter !== 'all') next.set('kit', kitFilter)
    if (status !== 'all') next.set('status', status)
    if (debouncedLocation) next.set('location', debouncedLocation)
    if (activeTab === 'contractor') next.set('tab', 'contractor')
    if (page > 1) next.set('page', String(page))
    setSearchParams(next, { replace: true })
  }, [debouncedSearch, debouncedLocation, kycFilter, kitFilter, status, activeTab, page, setSearchParams])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await fetchAdminUsers({
        search: debouncedSearch,
        role: activeTab === 'contractor' ? USER_ROLES.CONTRACTOR : USER_ROLES.LABOUR,
        status,
        kycStatus: kycFilter,
        kitStatus: kitFilter,
        location: debouncedLocation,
        page,
        limit,
      })
      setItems(data?.items ?? [])
      setTotal(data?.total ?? 0)
      setPages(data?.pages ?? 1)
      setKycStats(data?.labourKycCounts ?? null)
    } catch (e) {
      setItems([])
      setKycStats(null)
      setError(e instanceof ApiError ? e.message : 'Could not load roster')
    } finally {
      setLoading(false)
    }
  }, [debouncedSearch, kycFilter, kitFilter, status, debouncedLocation, page, limit, activeTab])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!reviewUserId) {
      setDetailUser(null)
      setDetailError('')
      setReviewNote('')
      return
    }
    let cancelled = false
    setDetailLoading(true)
    setDetailError('')
    setDetailUser(null)
    fetchAdminUserById(reviewUserId)
      .then((u) => {
        if (!cancelled) {
          if (u) setDetailUser(u)
          else setDetailError('User not found')
        }
      })
      .catch((e) => {
        if (!cancelled) setDetailError(e instanceof ApiError ? e.message : 'Failed to load user')
      })
      .finally(() => {
        if (!cancelled) setDetailLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [reviewUserId])

  const runKycReview = async (decision) => {
    if (!reviewUserId) return
    setReviewBusy(true)
    setDetailError('')
    try {
      await reviewLabourKycAdmin(reviewUserId, {
        decision,
        note: decision === 'rejected' ? reviewNote : undefined,
      })
      setReviewUserId(null)
      setReviewNote('')
      await load()
    } catch (e) {
      setDetailError(e instanceof ApiError ? e.message : 'Review failed')
    } finally {
      setReviewBusy(false)
    }
  }

  const statCards = [
    {
      key: 'pending',
      label: 'KYC pending',
      value: kycStats?.pending ?? '—',
      hint: 'Needs review',
      icon: ShieldCheck,
      tone: 'from-amber-500/15 to-amber-50/40',
      filter: KYC_STATUS.PENDING,
    },
    {
      key: 'verified',
      label: 'KYC verified',
      value: kycStats?.verified ?? '—',
      hint: 'Ready to deploy',
      icon: IdCard,
      tone: 'from-brand/20 to-blue-50/80',
      filter: KYC_STATUS.VERIFIED,
    },
    {
      key: 'failed',
      label: 'KYC failed',
      value: kycStats?.failed ?? '—',
      hint: 'Follow up',
      icon: ShieldCheck,
      tone: 'from-rose-500/12 to-rose-50/35',
      filter: KYC_STATUS.FAILED,
    },
    {
      key: 'total',
      label: activeTab === 'contractor' ? 'Contractor accounts' : 'Labour accounts',
      value: kycStats?.total ?? '—',
      hint: 'Search + account status',
      icon: Users,
      tone: 'from-sky-500/15 to-slate-50',
      filter: null,
    },
  ]

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <h2 className="text-lg font-extrabold text-slate-900 md:text-xl">KYC Verification</h2>
          <p className="mt-1 text-sm text-slate-600">
            Search by name, email, or mobile. Filter by KYC and account status. Summary tiles use search and
            active/inactive only — not the KYC dropdown.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <AppPrimaryButton as={Link} to="/admin/categories" className="w-auto px-4 py-2.5 text-sm shadow-md">
            <Layers className="h-4 w-4" aria-hidden />
            Skill categories
          </AppPrimaryButton>
          <Link
            to="/admin/users"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200/90 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition hover:border-brand/35 hover:text-brand"
          >
            All user roles
            <ArrowUpRight className="h-4 w-4 opacity-70" aria-hidden />
          </Link>
          <button
            type="button"
            onClick={() => load()}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand/30 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
            Refresh
          </button>
        </div>
      </motion.div>

      <div className="flex border-b border-slate-200/90 mb-4">
        <button
          onClick={() => setActiveTab('labour')}
          className={`pb-2.5 px-4 text-sm font-bold uppercase tracking-wide transition-colors ${
            activeTab === 'labour'
              ? 'border-b-2 border-brand text-brand'
              : 'border-b-2 border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Labour
        </button>
        <button
          onClick={() => setActiveTab('contractor')}
          className={`pb-2.5 px-4 text-sm font-bold uppercase tracking-wide transition-colors ${
            activeTab === 'contractor'
              ? 'border-b-2 border-brand text-brand'
              : 'border-b-2 border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Contractor
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((c, i) => {
          const inner = (
            <GlassPanel
              className={`relative h-full overflow-hidden p-5 bg-linear-to-br ${c.tone} ${c.filter && kycFilter === c.filter ? 'ring-2 ring-brand/35' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{c.label}</p>
                  <p className="mt-2 text-2xl font-black tabular-nums text-slate-900">{c.value}</p>
                  <p className="mt-1 text-xs font-medium text-slate-500">{c.hint}</p>
                  {c.filter ? (
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-wide text-brand/80">
                      {kycFilter === c.filter ? 'Filter on · tap to clear' : 'Tap to filter'}
                    </p>
                  ) : null}
                </div>
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/85 text-slate-700 shadow-sm ring-1 ring-slate-200/80">
                  <c.icon className="h-5 w-5" aria-hidden />
                </span>
              </div>
            </GlassPanel>
          )
          if (!c.filter) {
            return (
              <motion.div
                key={c.key}
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.04 * i }}
              >
                {inner}
              </motion.div>
            )
          }
          return (
            <motion.button
              key={c.key}
              type="button"
              onClick={() => setKycFilter((prev) => (prev === c.filter ? 'all' : c.filter))}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.04 * i }}
              className="text-left transition hover:opacity-95 focus-visible:outline focus-visible:ring-2 focus-visible:ring-brand/40"
            >
              {inner}
            </motion.button>
          )
        })}
      </div>

      <GlassPanel className="p-4 md:p-5">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
          <div className="lg:col-span-2">
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Name, email, or mobile…"
                className="w-full appearance-none rounded-xl border border-slate-200/90 bg-white py-2.5 pl-10 pr-3 text-sm shadow-sm outline-none ring-slate-200/80 focus:ring-2 focus:ring-brand/35"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Location</label>
            <input
              type="text"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              placeholder="City or location..."
              className="w-full appearance-none rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 text-sm shadow-sm outline-none focus:ring-2 focus:ring-brand/35"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">KYC status</label>
            <div className="relative">
              <select
                value={kycFilter}
                onChange={(e) => setKycFilter(e.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 pr-10 text-sm shadow-sm outline-none focus:ring-2 focus:ring-brand/35"
              >
                <option value="all">All KYC states</option>
                <option value={KYC_STATUS.PENDING}>Pending</option>
                <option value={KYC_STATUS.VERIFIED}>Verified</option>
                <option value={KYC_STATUS.FAILED}>Failed</option>
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Welcome Kit</label>
            <div className="relative">
              <select
                value={kitFilter}
                onChange={(e) => setKitFilter(e.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 pr-10 text-sm shadow-sm outline-none focus:ring-2 focus:ring-brand/35"
              >
                <option value="all">All Kit States</option>
                <option value="complete">Complete (All Issued)</option>
                <option value="partial">Partially Issued</option>
                <option value="not_issued">Not Issued</option>
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Account</label>
            <div className="relative">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 pr-10 text-sm shadow-sm outline-none focus:ring-2 focus:ring-brand/35"
              >
                <option value="all">Active & inactive</option>
                <option value="active">Active only</option>
                <option value="inactive">Inactive only</option>
              </select>
              <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
        </div>
        <p className="mt-4 text-xs font-medium text-slate-500">
          Showing {items.length} of {total} labour account{total === 1 ? '' : 's'}
          {debouncedSearch ? ` · matching “${debouncedSearch}”` : ''}
        </p>
      </GlassPanel>

      {error ? (
        <p className="rounded-xl border border-rose-200/80 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900">{error}</p>
      ) : null}

      <GlassPanel className="hidden overflow-hidden p-0 md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">KYC</th>
                <th className="px-4 py-3">Welcome Kit</th>
                {activeTab !== 'contractor' && <th className="px-4 py-3">Skill</th>}
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Review</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Last login</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      {Array.from({ length: activeTab === 'contractor' ? 8 : 9 }).map((__, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 animate-pulse rounded bg-slate-200/80" />
                        </td>
                      ))}
                    </tr>
                  ))
                : items.map((u) => (
                    <tr key={u._id} className="border-b border-slate-100 transition hover:bg-slate-50/60">
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900">{u.fullName || '—'}</div>
                        {u.email ? <div className="text-[11px] text-slate-500">{u.email}</div> : null}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs tabular-nums text-slate-700">
                        {u.phone ? `+91 ${u.phone}` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <KycPill status={(u.contractorProfile || u.labourProfile)?.kycStatus} submittedAt={(u.contractorProfile || u.labourProfile)?.kycSubmittedAt} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <KitStatusBadge welcomeKit={u.welcomeKit} showItems={true} />
                          <button
                            type="button"
                            onClick={() => setKitModalUser(u)}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-300 transition"
                            title="Update Kit"
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                      {activeTab !== 'contractor' && (
                        <td className="max-w-[280px] px-4 py-3 text-xs text-slate-600">
                          <div className="font-medium text-slate-800">{formatSkillLine(u)}</div>
                          <div className="mt-0.5 text-slate-500">{formatServiceLine(u)}</div>
                        </td>
                      )}
                      <td className="px-4 py-3 text-xs text-slate-700">
                        {u.city || u.currentLocation || '—'}
                      </td>
                      <td className="px-4 py-3">
                        {(u.contractorProfile || u.labourProfile)?.kycStatus === KYC_STATUS.PENDING ? (
                          (u.contractorProfile || u.labourProfile)?.kycSubmittedAt ? (
                            <button
                              type="button"
                              onClick={() => setReviewUserId(u._id)}
                              className="rounded-lg border border-brand/30 bg-brand/10 px-2.5 py-1.5 text-[11px] font-bold text-brand transition hover:bg-brand/15"
                            >
                              Review video KYC
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">Not submitted</span>
                          )
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill active={u.isActive !== false} />
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{formatLastLoginDisplay(u.lastLoginAt) || '—'}</td>
                    </tr>
                  ))}
            </tbody>
          </table>
        </div>
        {!loading && items.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Users className="h-10 w-10 text-slate-300" aria-hidden />
            <p className="font-semibold text-slate-700">No labour accounts match</p>
            <p className="max-w-sm text-xs text-slate-500">Try clearing search or widening KYC / kit / account filters.</p>
          </div>
        ) : null}
      </GlassPanel>

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
                    {u.email ? <p className="mt-0.5 text-[11px] text-slate-500">{u.email}</p> : null}
                    <p className="mt-0.5 font-mono text-xs text-slate-600">+91 {u.phone || '—'}</p>
                  </div>
                  <StatusPill active={u.isActive !== false} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <KycPill status={(u.contractorProfile || u.labourProfile)?.kycStatus} submittedAt={(u.contractorProfile || u.labourProfile)?.kycSubmittedAt} />
                  <span className="text-[11px] text-slate-500">Last: {formatLastLoginDisplay(u.lastLoginAt) || '—'}</span>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 font-semibold">
                    <Package className="h-3.5 w-3.5 text-slate-400" />
                    <span>Kit:</span>
                    <KitStatusBadge welcomeKit={u.welcomeKit} showItems={false} />
                  </div>
                  <button
                    type="button"
                    onClick={() => setKitModalUser(u)}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
                  >
                    Manage Kit
                  </button>
                </div>
                {(u.contractorProfile || u.labourProfile)?.kycStatus === KYC_STATUS.PENDING && (u.contractorProfile || u.labourProfile)?.kycSubmittedAt ? (
                  <button
                    type="button"
                    onClick={() => setReviewUserId(u._id)}
                    className="mt-2 w-full rounded-xl border border-brand/30 bg-brand/10 py-2 text-xs font-bold text-brand transition hover:bg-brand/15"
                  >
                    Review video KYC
                  </button>
                ) : null}
                {activeTab !== 'contractor' && (
                  <div className="mt-3 rounded bg-slate-50 p-2">
                    <p className="text-xs font-medium text-slate-800">{formatSkillLine(u)}</p>
                    <p className="mt-0.5 text-[11px] text-slate-500">{formatServiceLine(u)}</p>
                  </div>
                )}
                <p className="mt-2 text-[11px] text-slate-500">
                  Location: <span className="font-medium text-slate-700">{u.city || u.currentLocation || '—'}</span>
                </p>
              </GlassPanel>
            ))}
        {!loading && items.length === 0 ? (
          <GlassPanel className="p-8 text-center">
            <Users className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-2 font-semibold text-slate-700">No labour accounts match</p>
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

      {reviewUserId ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]"
            aria-label="Close"
            disabled={reviewBusy}
            onClick={() => !reviewBusy && setReviewUserId(null)}
          />
          <motion.div
        initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative z-10 max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-3xl border border-slate-200/90 bg-white shadow-2xl sm:rounded-3xl"
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-slate-100 bg-white/95 px-4 py-3 backdrop-blur-sm">
              <p className="text-sm font-extrabold text-slate-900">Video KYC review</p>
              <button
                type="button"
                disabled={reviewBusy}
                onClick={() => setReviewUserId(null)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/90 text-slate-600 transition hover:bg-slate-50"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 p-4">
              {detailLoading ? (
                <div className="flex flex-col items-center gap-3 py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-brand" aria-hidden />
                  <p className="text-sm font-medium text-slate-600">Loading worker…</p>
                </div>
              ) : detailError ? (
                <p className="rounded-xl border border-rose-200/80 bg-rose-50 px-3 py-2 text-sm text-rose-900">{detailError}</p>
              ) : detailUser ? (
                <>
                  <div>
                    <p className="text-xs font-bold uppercase text-slate-400">Worker</p>
                    <p className="text-base font-extrabold text-slate-900">{detailUser.fullName || '—'}</p>
                    <p className="font-mono text-xs text-slate-600">+91 {detailUser.phone}</p>
                    {(detailUser.contractorProfile || detailUser.labourProfile)?.aadhaarMasked ? (
                      <p className="mt-1 font-mono text-sm text-slate-800">Aadhaar: {(detailUser.contractorProfile || detailUser.labourProfile).aadhaarMasked}</p>
                    ) : null}
                    {(detailUser.contractorProfile || detailUser.labourProfile)?.panMasked ? (
                      <p className="mt-1 font-mono text-sm text-slate-800">PAN: {(detailUser.contractorProfile || detailUser.labourProfile).panMasked}</p>
                    ) : null}
                    {(detailUser.contractorProfile || detailUser.labourProfile)?.kycSubmittedAt ? (
                      <p className="mt-1 text-xs text-slate-500">
                        Submitted{' '}
                        {new Date((detailUser.contractorProfile || detailUser.labourProfile).kycSubmittedAt).toLocaleString(undefined, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })}
                      </p>
                    ) : null}
                  </div>
                  <div>
                    <p className="mb-1 text-[11px] font-bold uppercase text-slate-500">Recorded KYC video</p>
                    {(detailUser.contractorProfile || detailUser.labourProfile)?.kycVideoUrl ? (
                      <video
                        src={(detailUser.contractorProfile || detailUser.labourProfile).kycVideoUrl}
                        controls
                        playsInline
                        className="aspect-video w-full rounded-xl border border-slate-200/90 bg-slate-950 object-contain"
                      />
                    ) : (
                      <p className="rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                        No KYC video found for this worker.
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500" htmlFor="reject-note">
                      Note if rejecting (optional)
                    </label>
                    <textarea
                      id="reject-note"
                      rows={2}
                      value={reviewNote}
                      onChange={(e) => setReviewNote(e.target.value)}
                      placeholder="e.g. Video is unclear — please record again"
                      className="w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-brand/35"
                    />
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      disabled={reviewBusy}
                      onClick={() => runKycReview('rejected')}
                      className="flex-1 rounded-2xl border border-rose-200/90 bg-rose-50 py-3 text-sm font-bold text-rose-900 transition hover:bg-rose-100 disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <AppPrimaryButton
                      type="button"
                      className="flex-1 py-3 text-sm"
                      disabled={reviewBusy}
                      onClick={() => runKycReview('approved')}
                    >
                      {reviewBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                      Approve KYC
                    </AppPrimaryButton>
                  </div>
                </>
              ) : null}
            </div>
          </motion.div>
        </div>
      ) : null}

      {kitModalUser && (
        <WelcomeKitModal
          user={kitModalUser}
          onClose={() => setKitModalUser(null)}
          onSuccess={(updatedKit) => {
            setItems((prev) =>
              prev.map((item) =>
                item._id === kitModalUser._id ? { ...item, welcomeKit: updatedKit } : item
              )
            )
          }}
        />
      )}
    </div>
  )
}
