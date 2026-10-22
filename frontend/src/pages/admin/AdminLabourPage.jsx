import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import {
  ArrowUpRight,
  Award,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
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
import {
  evaluateLabourTrialAdmin,
  fetchAdminUserById,
  fetchAdminUsers,
  reviewLabourKycAdmin,
} from '../../api/adminUsersApi.js'
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

function readInitialTrial(sp) {
  const t = sp.get('trial')?.toLowerCase()
  if (t === 'scheduled' || t === 'completed' || t === 'failed' || t === 'not_scheduled') return t
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

function TrialSlotBadge({ trialSlot, onEvaluate }) {
  const status = trialSlot?.status || 'NOT_SCHEDULED'

  if (status === 'COMPLETED' || status === 'PASSED') {
    return (
      <div className="flex flex-col items-start gap-0.5">
        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1 bg-emerald-50 text-emerald-900 ring-emerald-200/80">
          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
          Trial Passed
        </span>
        {trialSlot.date && (
          <span className="text-[10px] text-slate-500 font-medium">
            {trialSlot.date} {trialSlot.timeSlot ? `• ${trialSlot.timeSlot}` : ''}
          </span>
        )}
      </div>
    )
  }

  if (status === 'SCHEDULED') {
    return (
      <div className="flex flex-col items-start gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1 bg-cyan-50 text-cyan-900 ring-cyan-200/90 shadow-2xs">
          <Clock className="h-3 w-3 text-cyan-600" />
          Demo Booked
        </span>
        <div className="text-[11px] font-bold text-slate-800 leading-tight">
          <p>{trialSlot.date}</p>
          <p className="text-[10px] font-medium text-slate-500">{trialSlot.timeSlot}</p>
          {trialSlot.zoneName && (
            <p className="text-[10px] text-cyan-700 font-semibold mt-0.5">
              📍 {trialSlot.zoneName}
            </p>
          )}
        </div>
        {onEvaluate && (
          <button
            type="button"
            onClick={onEvaluate}
            className="inline-flex items-center gap-1 rounded-lg border border-brand/35 bg-brand/10 px-2.5 py-1 text-[11px] font-bold text-brand hover:bg-brand/20 transition shadow-2xs active:scale-95"
            title="Evaluate Practical Trial Demo"
          >
            <Award className="h-3.5 w-3.5 text-brand" />
            Evaluate Demo
          </button>
        )}
      </div>
    )
  }

  if (status === 'FAILED') {
    return (
      <div className="flex flex-col items-start gap-1">
        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ring-1 bg-rose-50 text-rose-900 ring-rose-200/80">
          <X className="h-3 w-3 text-rose-600" />
          Trial Failed
        </span>
        {onEvaluate && (
          <button
            type="button"
            onClick={onEvaluate}
            className="text-[11px] font-bold text-brand hover:underline"
          >
            Re-evaluate
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 text-xs text-slate-400">
      <span>Not booked</span>
      {onEvaluate && (
        <button
          type="button"
          onClick={onEvaluate}
          className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 hover:text-slate-800 hover:border-slate-300"
          title="Direct evaluate"
        >
          Evaluate
        </button>
      )}
    </div>
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
  const [trialFilter, setTrialFilter] = useState(() => readInitialTrial(searchParams))
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

  // Practical Trial Evaluation Modal State
  const [trialModalUser, setTrialModalUser] = useState(null)
  const [evalDecision, setEvalDecision] = useState('passed')
  const [evalNotes, setEvalNotes] = useState('')
  const [evalBusy, setEvalBusy] = useState(false)
  const [evalError, setEvalError] = useState('')
  const [actionToast, setActionToast] = useState('')

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
  }, [debouncedSearch, debouncedLocation, kycFilter, kitFilter, trialFilter, status, activeTab])

  useEffect(() => {
    const next = new URLSearchParams()
    if (debouncedSearch) next.set('search', debouncedSearch)
    if (kycFilter !== 'all') next.set('kyc', kycFilter)
    if (kitFilter !== 'all') next.set('kit', kitFilter)
    if (trialFilter !== 'all') next.set('trial', trialFilter)
    if (status !== 'all') next.set('status', status)
    if (debouncedLocation) next.set('location', debouncedLocation)
    if (activeTab === 'contractor') next.set('tab', 'contractor')
    if (page > 1) next.set('page', String(page))
    setSearchParams(next, { replace: true })
  }, [debouncedSearch, debouncedLocation, kycFilter, kitFilter, trialFilter, status, activeTab, page, setSearchParams])

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
        trialSlotStatus: trialFilter,
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
  }, [debouncedSearch, kycFilter, kitFilter, trialFilter, status, debouncedLocation, page, limit, activeTab])

  const handleTrialEvaluateSubmit = async (e) => {
    if (e) e.preventDefault()
    if (!trialModalUser) return
    setEvalBusy(true)
    setEvalError('')
    try {
      await evaluateLabourTrialAdmin(trialModalUser._id, {
        decision: evalDecision,
        notes: evalNotes.trim(),
      })
      setItems((prev) =>
        prev.map((item) => {
          if (item._id !== trialModalUser._id) return item
          const profileKey = item.role === USER_ROLES.CONTRACTOR ? 'contractorProfile' : 'labourProfile'
          const currentProfile = item[profileKey] || {}
          return {
            ...item,
            vendorStatus: evalDecision === 'passed' ? 'CONFIRMED' : item.vendorStatus,
            [profileKey]: {
              ...currentProfile,
              trialSlot: {
                ...(currentProfile.trialSlot || {}),
                status: evalDecision === 'passed' ? 'COMPLETED' : 'FAILED',
                completedAt: new Date().toISOString(),
                evaluatedAt: new Date().toISOString(),
                notes: evalNotes.trim() || (evalDecision === 'passed' ? 'Practical evaluation passed' : 'Evaluation not cleared'),
              },
            },
          }
        })
      )
      setActionToast(
        evalDecision === 'passed'
          ? `Practical trial passed for ${trialModalUser.fullName || 'partner'}! Joining confirmed.`
          : `Trial marked as failed for ${trialModalUser.fullName || 'partner'}.`
      )
      setTimeout(() => setActionToast(''), 4500)
      setTrialModalUser(null)
    } catch (err) {
      setEvalError(err instanceof ApiError ? err.message : err?.message || 'Failed to submit evaluation')
    } finally {
      setEvalBusy(false)
    }
  }

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
      label: activeTab === 'contractor' ? 'Contractor accounts' : 'Service Provider accounts',
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
          Service Provider
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

      {actionToast && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            <span>{actionToast}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionToast('')}
            className="text-emerald-700 hover:text-emerald-900 p-1 rounded-lg"
          >
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}

      <GlassPanel className="p-4 md:p-5">
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          <div className="sm:col-span-2 md:col-span-1 lg:col-span-1">
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Search</label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Name, email, mobile…"
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
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Trial Demo</label>
            <div className="relative">
              <select
                value={trialFilter}
                onChange={(e) => setTrialFilter(e.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 pr-10 text-sm shadow-sm outline-none focus:ring-2 focus:ring-brand/35 font-medium"
              >
                <option value="all">All Demo States</option>
                <option value="scheduled">Demo Booked (Awaiting Eval)</option>
                <option value="completed">Trial Passed ✓</option>
                <option value="failed">Trial Failed</option>
                <option value="not_scheduled">Not Booked</option>
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
          Showing {items.length} of {total} service provider account{total === 1 ? '' : 's'}
          {debouncedSearch ? ` · matching “${debouncedSearch}”` : ''}
          {trialFilter !== 'all' ? ` · demo filter: ${trialFilter}` : ''}
        </p>
      </GlassPanel>

      {error ? (
        <p className="rounded-xl border border-rose-200/80 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-900">{error}</p>
      ) : null}

      <GlassPanel className="hidden overflow-hidden p-0 md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">KYC</th>
                <th className="px-4 py-3">Trial Demo</th>
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
                      {Array.from({ length: activeTab === 'contractor' ? 9 : 10 }).map((__, j) => (
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
                        <TrialSlotBadge
                          trialSlot={(u.contractorProfile || u.labourProfile)?.trialSlot}
                          onEvaluate={() => {
                            setTrialModalUser(u)
                            setEvalDecision('passed')
                            setEvalNotes('')
                            setEvalError('')
                          }}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1.5 items-start">
                          <div className="flex items-center gap-2">
                            <KitStatusBadge welcomeKit={u.welcomeKit} showItems={true} />
                            <button
                              type="button"
                              onClick={() => setKitModalUser(u)}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-300 transition"
                              title="Update Kit & Slip"
                            >
                              Edit
                            </button>
                          </div>
                          {u.welcomeKit?.status === 'PAYMENT_SUBMITTED' && (
                            <button
                              type="button"
                              onClick={() => setKitModalUser(u)}
                              className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-900 border border-amber-300 shadow-2xs hover:bg-amber-200 transition animate-pulse cursor-pointer"
                              title="Click to review payment screenshot"
                            >
                              <span>🧾 Verify Slip</span>
                            </button>
                          )}
                          {u.welcomeKit?.status === 'PAYMENT_REJECTED' && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200">
                              <span>❌ Slip Rejected</span>
                            </span>
                          )}
                          {u.welcomeKit?.status === 'PAID' && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                              <span>✓ ₹999 Paid</span>
                            </span>
                          )}
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
            <p className="font-semibold text-slate-700">No service provider accounts match</p>
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
                  <div className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold">
                    <Award className="h-3.5 w-3.5 text-amber-500" />
                    <span>Demo:</span>
                  </div>
                  <TrialSlotBadge
                    trialSlot={(u.contractorProfile || u.labourProfile)?.trialSlot}
                    onEvaluate={() => {
                      setTrialModalUser(u)
                      setEvalDecision('passed')
                      setEvalNotes('')
                      setEvalError('')
                    }}
                  />
                </div>
                <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2.5">
                  <div className="flex flex-col gap-1 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-500 font-semibold">
                      <Package className="h-3.5 w-3.5 text-slate-400" />
                      <span>Kit:</span>
                      <KitStatusBadge welcomeKit={u.welcomeKit} showItems={false} />
                    </div>
                    {u.welcomeKit?.status === 'PAYMENT_SUBMITTED' && (
                      <span className="text-[10px] font-bold text-amber-700 animate-pulse">
                        🧾 Payment Slip Pending Review
                      </span>
                    )}
                    {u.welcomeKit?.status === 'PAYMENT_REJECTED' && (
                      <span className="text-[10px] font-bold text-rose-600">
                        ❌ Slip Rejected
                      </span>
                    )}
                    {u.welcomeKit?.status === 'PAID' && (
                      <span className="text-[10px] font-bold text-emerald-700">
                        ✓ ₹999 Verified
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setKitModalUser(u)}
                    className={`rounded-lg px-2.5 py-1 text-xs font-bold transition shadow-2xs ${
                      u.welcomeKit?.status === 'PAYMENT_SUBMITTED'
                        ? 'bg-amber-500 text-white hover:bg-amber-600'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {u.welcomeKit?.status === 'PAYMENT_SUBMITTED' ? 'Review Slip' : 'Manage Kit'}
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
            <p className="mt-2 font-semibold text-slate-700">No service provider accounts match</p>
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

      {trialModalUser && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-0 sm:p-4" role="dialog" aria-modal="true">
          <button
            type="button"
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-[2px]"
            aria-label="Close"
            disabled={evalBusy}
            onClick={() => !evalBusy && setTrialModalUser(null)}
          />
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative z-10 w-full max-w-lg rounded-t-3xl sm:rounded-3xl border border-slate-200/90 bg-white p-5 sm:p-6 shadow-2xl overflow-hidden max-h-[92vh] overflow-y-auto"
          >
            <div className="flex items-start justify-between border-b border-slate-100 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-200/60">
                  <Award className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">Practical Demo Evaluation</h3>
                  <p className="text-xs text-slate-500">In-person trade demonstration grading at Hub</p>
                </div>
              </div>
              <button
                type="button"
                disabled={evalBusy}
                onClick={() => setTrialModalUser(null)}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* Candidate Info Card */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-3.5 text-xs">
                <div className="flex items-center justify-between font-bold text-slate-900 mb-2">
                  <span className="text-sm font-extrabold text-slate-900">{trialModalUser.fullName || 'Partner'}</span>
                  <span className="font-mono text-slate-600">+91 {trialModalUser.phone}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-600 pt-2 border-t border-slate-200/60 text-[11px]">
                  <div>
                    <span className="text-slate-400 font-semibold block uppercase text-[9px]">Trade / Skill</span>
                    <span className="font-semibold text-slate-800">{formatSkillLine(trialModalUser)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block uppercase text-[9px]">Location</span>
                    <span className="font-semibold text-slate-800">{trialModalUser.city || trialModalUser.currentLocation || '—'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block uppercase text-[9px]">Booked Slot Date</span>
                    <span className="font-bold text-slate-900">
                      {(trialModalUser.contractorProfile || trialModalUser.labourProfile)?.trialSlot?.date || 'Not booked'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block uppercase text-[9px]">Timing & Hub</span>
                    <span className="font-bold text-slate-900">
                      {(trialModalUser.contractorProfile || trialModalUser.labourProfile)?.trialSlot?.timeSlot || '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Decision Selector */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">
                  Evaluation Decision
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setEvalDecision('passed')}
                    className={`flex flex-col items-start p-3 rounded-2xl border text-left transition ${
                      evalDecision === 'passed'
                        ? 'border-emerald-500 bg-emerald-50/80 ring-2 ring-emerald-500/30'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-emerald-900 text-xs">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      Pass Trial ✓
                    </div>
                    <p className="mt-1 text-[10px] text-emerald-800 leading-snug">
                      Candidate demonstrated safe, quality workmanship. Confirms joining and unlocks Welcome Kit.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setEvalDecision('failed')}
                    className={`flex flex-col items-start p-3 rounded-2xl border text-left transition ${
                      evalDecision === 'failed'
                        ? 'border-rose-500 bg-rose-50/80 ring-2 ring-rose-500/30'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-rose-900 text-xs">
                      <X className="h-4 w-4 text-rose-600" />
                      Fail / Reject
                    </div>
                    <p className="mt-1 text-[10px] text-rose-800 leading-snug">
                      Candidate did not meet trade standards. Must re-schedule practical demonstration.
                    </p>
                  </button>
                </div>
              </div>

              {/* Evaluator Notes */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1" htmlFor="eval-notes">
                  Evaluator Remarks / Notes
                </label>
                <textarea
                  id="eval-notes"
                  rows={2}
                  value={evalNotes}
                  onChange={(e) => setEvalNotes(e.target.value)}
                  placeholder="e.g. Demonstrated strong expertise in trade repairs, safety compliance, and passed the practical demo test."
                  className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs text-slate-900 outline-none focus:ring-2 focus:ring-brand/35 shadow-xs"
                />
              </div>

              {evalError && (
                <p className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800 font-medium">
                  {evalError}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  disabled={evalBusy}
                  onClick={() => setTrialModalUser(null)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={evalBusy}
                  onClick={handleTrialEvaluateSubmit}
                  className={`flex items-center gap-1.5 rounded-xl px-5 py-2 text-xs font-bold text-white shadow-sm transition disabled:opacity-50 ${
                    evalDecision === 'passed' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                  }`}
                >
                  {evalBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : evalDecision === 'passed' ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <X className="h-4 w-4" />
                  )}
                  Confirm {evalDecision === 'passed' ? 'Passing Grade' : 'Rejection'}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  )
}
