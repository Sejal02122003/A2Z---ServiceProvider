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
  Download,
  ExternalLink,
  Eye,
  FileCheck,
  FileText,
  IdCard,
  Layers,
  Loader2,
  Package,
  RefreshCw,
  RotateCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Users,
  X,
  ZoomIn,
  ZoomOut,
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
import { KitStatusBadge, WorkflowStatusBadge } from '../../components/admin/welcomeKit/KitStatusBadge.jsx'
import { WelcomeKitModal } from '../../components/admin/welcomeKit/WelcomeKitModal.jsx'
import { formatTrialTimeSlot } from '../../lib/formatTrialTimeSlot.js'

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
            {trialSlot.date} {trialSlot.timeSlot ? `• ${formatTrialTimeSlot(trialSlot.timeSlot)}` : ''}
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
          <p className="text-[10px] font-medium text-slate-500">{formatTrialTimeSlot(trialSlot.timeSlot)}</p>
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

function isVideoUrl(url) {
  if (!url || typeof url !== 'string') return false
  if (/\.(webm|mp4|mov|mkv|avi|m4v)($|\?)/i.test(url)) return true
  if (url.includes('/video/upload/')) return true
  return false
}

function isPdfUrl(url) {
  if (!url || typeof url !== 'string') return false
  return /\.pdf($|\?)/i.test(url)
}

function extractKycMedia(detailUser) {
  if (!detailUser) return { documents: [], videos: [] }
  const profile = detailUser.contractorProfile || detailUser.labourProfile || {}
  const idDoc = detailUser.identityVerification || detailUser.identityVerificationRef || {}

  const documents = []
  const videos = []
  const seenUrls = new Set()

  const addItem = (url, label, isBack = false) => {
    if (!url || typeof url !== 'string' || !url.trim()) return
    const clean = url.trim()
    if (seenUrls.has(clean)) return
    seenUrls.add(clean)

    const isVid = isVideoUrl(clean)
    const isPdf = isPdfUrl(clean)

    if (isVid) {
      videos.push({ url: clean, label: label || 'Recorded KYC Video' })
    } else {
      documents.push({
        url: clean,
        label: label || (isPdf ? 'KYC Document (PDF)' : 'KYC Document Photo'),
        isPdf,
        isBack,
      })
    }
  }

  // 1. Explicit front & back images
  if (profile.kycFrontImageUrl) addItem(profile.kycFrontImageUrl, 'Aadhaar / ID Card (Front)')
  if (profile.kycFrontImageDataUrl) addItem(profile.kycFrontImageDataUrl, 'Aadhaar / ID Card (Front Photo)')
  if (profile.kycBackImageUrl) addItem(profile.kycBackImageUrl, 'Aadhaar / ID Card (Back)', true)
  if (profile.kycBackImageDataUrl) addItem(profile.kycBackImageDataUrl, 'Aadhaar / ID Card (Back Photo)', true)

  // 2. IdentityVerification documentUrls
  if (Array.isArray(idDoc.documentUrls)) {
    idDoc.documentUrls.forEach((u, i) => {
      addItem(u, `Uploaded Document #${i + 1}`)
    })
  }

  // 3. kycVideoUrl (detect if it's an image or a video or PDF)
  if (profile.kycVideoUrl) {
    const isVid = isVideoUrl(profile.kycVideoUrl)
    addItem(profile.kycVideoUrl, isVid ? 'Recorded KYC Video' : 'Aadhaar / Document Proof')
  }

  return { documents, videos }
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

  // Document Lightbox & Zoom Inspection State
  const [lightboxMedia, setLightboxMedia] = useState(null)
  const [zoomScale, setZoomScale] = useState(1)
  const [rotation, setRotation] = useState(0)

  const openLightbox = (media) => {
    setLightboxMedia(media)
    setZoomScale(1)
    setRotation(0)
  }

  const closeLightbox = () => {
    setLightboxMedia(null)
    setZoomScale(1)
    setRotation(0)
  }

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
            <label className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-slate-500">Kit & Payment Slip</label>
            <div className="relative">
              <select
                value={kitFilter}
                onChange={(e) => setKitFilter(e.target.value)}
                className="w-full appearance-none rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 pr-10 text-sm shadow-sm outline-none focus:ring-2 focus:ring-brand/35 font-medium"
              >
                <option value="all">All Kit & Slip States</option>
                <option value="payment_submitted">🧾 Slips Pending Review</option>
                <option value="payment_pending">⏳ Payment Pending</option>
                <option value="payment_rejected">❌ Payment Rejected</option>
                <option value="address_pending">📍 Address Pending</option>
                <option value="address_submitted">📮 Address Submitted</option>
                <option value="ready_to_dispatch">📦 Ready to Dispatch</option>
                <option value="dispatched">🚚 Dispatched</option>
                <option value="delivered">✅ Delivered</option>
                <option value="paid">✓ Payment Approved / Paid</option>
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
                <th className="px-4 py-3 min-w-[210px]">Kit & Payment Slip</th>
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
                        <div className="flex flex-col gap-2 items-start min-w-[200px]">
                          {/* Row 1: Kit Status badge + Checklist edit */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <WorkflowStatusBadge welcomeKit={u.welcomeKit} />
                            <KitStatusBadge welcomeKit={u.welcomeKit} showItems={true} />
                            <button
                              type="button"
                              onClick={() => setKitModalUser(u)}
                              className="rounded-lg border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-300 transition cursor-pointer"
                              title="Manage Welcome Kit & Dispatch"
                            >
                              Manage
                            </button>
                          </div>

                          {/* Row 2: Payment Slip Thumbnail & Status */}
                          {u.welcomeKit?.paymentReceiptUrl ? (
                            <div className="flex items-center gap-2 w-full pt-0.5">
                              {/* Clickable Image Preview Thumbnail */}
                              <div
                                onClick={() => setKitModalUser(u)}
                                className="relative h-11 w-11 shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 border-brand/50 bg-slate-900/5 shadow-xs hover:border-brand hover:scale-105 transition group"
                                title="Click to view payment slip screenshot"
                              >
                                <img
                                  src={u.welcomeKit.paymentReceiptUrl}
                                  alt="Payment slip"
                                  className="h-full w-full object-cover"
                                />
                                <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-[10px] transition font-bold">
                                  🔍
                                </div>
                              </div>

                              <div className="flex flex-col gap-0.5 min-w-0">
                                {u.welcomeKit?.status === 'PAYMENT_SUBMITTED' ? (
                                  <button
                                    type="button"
                                    onClick={() => setKitModalUser(u)}
                                    className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold text-amber-900 border border-amber-300 shadow-2xs hover:bg-amber-200 transition animate-pulse cursor-pointer"
                                    title="Click to review and accept/reject"
                                  >
                                    <span>🧾 Review Slip</span>
                                  </button>
                                ) : u.welcomeKit?.status === 'PAYMENT_REJECTED' ? (
                                  <button
                                    type="button"
                                    onClick={() => setKitModalUser(u)}
                                    className="inline-flex items-center gap-1 rounded-md bg-rose-50 px-2 py-0.5 text-[10px] font-bold text-rose-700 border border-rose-200 hover:bg-rose-100 transition cursor-pointer"
                                    title="Payment slip rejected - click to view"
                                  >
                                    <span>❌ Slip Rejected</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setKitModalUser(u)}
                                    className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200 hover:bg-emerald-100 transition cursor-pointer"
                                    title="Payment slip verified - click to view"
                                  >
                                    <span>✓ View Slip (₹{u.welcomeKit?.paymentAmount || 999})</span>
                                  </button>
                                )}
                                <span className="text-[10px] text-slate-400 font-mono truncate">
                                  {u.welcomeKit?.paidAt ? new Date(u.welcomeKit.paidAt).toLocaleDateString() : 'Slip Uploaded'}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-[11px] pt-0.5">
                              {u.welcomeKit?.status === 'PAID' || u.welcomeKit?.status === 'DELIVERED' || u.welcomeKit?.status === 'DISPATCHED' ? (
                                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                                  ✓ Paid (Direct)
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">
                                  No slip uploaded
                                </span>
                              )}
                            </div>
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
                        {(() => {
                          const profile = u.contractorProfile || u.labourProfile
                          const hasDocs = Boolean(
                            profile?.kycSubmittedAt ||
                            profile?.kycVideoUrl ||
                            profile?.kycFrontImageUrl ||
                            profile?.kycBackImageUrl ||
                            u.identityVerificationRef
                          )
                          const st = profile?.kycStatus || KYC_STATUS.PENDING

                          if (st === KYC_STATUS.PENDING) {
                            if (hasDocs) {
                              return (
                                <button
                                  type="button"
                                  onClick={() => setReviewUserId(u._id)}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] font-bold text-amber-900 shadow-2xs hover:bg-amber-100 transition cursor-pointer"
                                  title="Review submitted documents"
                                >
                                  <FileCheck className="h-3.5 w-3.5 text-amber-700" />
                                  <span>Review KYC</span>
                                </button>
                              )
                            }
                            return <span className="text-xs text-slate-400">Not submitted</span>
                          }

                          if (st === KYC_STATUS.VERIFIED) {
                            return (
                              <button
                                type="button"
                                onClick={() => setReviewUserId(u._id)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-300 transition cursor-pointer"
                                title="View verified documents"
                              >
                                <Eye className="h-3.5 w-3.5 text-emerald-600" />
                                <span>View KYC</span>
                              </button>
                            )
                          }

                          if (st === KYC_STATUS.FAILED) {
                            return (
                              <button
                                type="button"
                                onClick={() => setReviewUserId(u._id)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-800 shadow-2xs hover:bg-rose-100 transition cursor-pointer"
                                title="Review rejected documents"
                              >
                                <Eye className="h-3.5 w-3.5 text-rose-600" />
                                <span>View KYC</span>
                              </button>
                            )
                          }

                          return <span className="text-xs text-slate-400">—</span>
                        })()}
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
                <div className="mt-2.5 flex items-start justify-between border-t border-slate-100 pt-2.5 gap-2">
                  <div className="flex flex-col gap-1 text-xs min-w-0">
                    <div className="flex items-center gap-1.5 text-slate-500 font-semibold flex-wrap">
                      <Package className="h-3.5 w-3.5 text-slate-400" />
                      <span>Kit:</span>
                      <WorkflowStatusBadge welcomeKit={u.welcomeKit} />
                      <KitStatusBadge welcomeKit={u.welcomeKit} showItems={false} />
                    </div>

                    {u.welcomeKit?.paymentReceiptUrl ? (
                      <div className="flex items-center gap-2 mt-1">
                        <img
                          src={u.welcomeKit.paymentReceiptUrl}
                          alt="Slip"
                          className="h-9 w-9 rounded-md object-cover border border-slate-200 shrink-0 cursor-pointer"
                          onClick={() => setKitModalUser(u)}
                        />
                        <div className="min-w-0">
                          {u.welcomeKit?.status === 'PAYMENT_SUBMITTED' ? (
                            <span className="text-[10px] font-bold text-amber-700 animate-pulse block">
                              🧾 Slip Needs Review
                            </span>
                          ) : u.welcomeKit?.status === 'PAYMENT_REJECTED' ? (
                            <span className="text-[10px] font-bold text-rose-600 block">
                              ❌ Slip Rejected
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold text-emerald-700 block">
                              ✓ Slip Verified (₹{u.welcomeKit?.paymentAmount || 999})
                            </span>
                          )}
                          <span className="text-[9px] text-slate-400 font-mono">
                            {u.welcomeKit?.paidAt ? new Date(u.welcomeKit.paidAt).toLocaleDateString() : ''}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-0.5">
                        {u.welcomeKit?.status === 'PAID' || u.welcomeKit?.status === 'DELIVERED' || u.welcomeKit?.status === 'DISPATCHED' ? (
                          <span className="text-[10px] font-bold text-emerald-700">
                            ✓ ₹999 Verified (Direct)
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400 italic">
                            No slip uploaded
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setKitModalUser(u)}
                    className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold transition shadow-2xs ${
                      u.welcomeKit?.status === 'PAYMENT_SUBMITTED'
                        ? 'bg-amber-500 text-white hover:bg-amber-600 ring-2 ring-amber-300'
                        : u.welcomeKit?.paymentReceiptUrl
                        ? 'border border-brand/30 bg-brand/10 text-brand hover:bg-brand/15'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {u.welcomeKit?.status === 'PAYMENT_SUBMITTED' ? 'Review Slip' : u.welcomeKit?.paymentReceiptUrl ? 'View Slip' : 'Manage Kit'}
                  </button>
                </div>
                {(() => {
                  const profile = u.contractorProfile || u.labourProfile
                  const hasDocs = Boolean(
                    profile?.kycSubmittedAt ||
                    profile?.kycVideoUrl ||
                    profile?.kycFrontImageUrl ||
                    profile?.kycBackImageUrl ||
                    u.identityVerificationRef
                  )
                  if (!hasDocs && profile?.kycStatus === KYC_STATUS.PENDING) return null

                  const isPending = profile?.kycStatus === KYC_STATUS.PENDING
                  return (
                    <button
                      type="button"
                      onClick={() => setReviewUserId(u._id)}
                      className={`mt-2 flex w-full items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-bold transition cursor-pointer ${
                        isPending
                          ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 shadow-xs'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <FileCheck className="h-4 w-4" />
                      <span>{isPending ? 'Review KYC & Documents' : 'View KYC & Documents'}</span>
                    </button>
                  )
                })()}
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
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center p-0 sm:p-4" role="dialog" aria-modal="true">
          <button
            type="button"
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-[2px]"
            aria-label="Close"
            disabled={reviewBusy}
            onClick={() => !reviewBusy && setReviewUserId(null)}
          />
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative z-10 max-h-[92vh] w-full max-w-2xl sm:max-w-3xl overflow-y-auto rounded-t-3xl border border-slate-200/90 bg-white shadow-2xl sm:rounded-3xl"
          >
            {/* Modal Header */}
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur-md">
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand/10 text-brand ring-1 ring-brand/20 shrink-0">
                  <IdCard className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                    KYC & Document Verification
                  </h3>
                  <p className="text-xs text-slate-500 truncate">
                    Review uploaded Aadhaar, PAN card, and identity media
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={reviewBusy}
                onClick={() => setReviewUserId(null)}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200/90 text-slate-500 hover:text-slate-800 transition hover:bg-slate-50 shrink-0 cursor-pointer"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5 p-5">
              {detailLoading ? (
                <div className="flex flex-col items-center gap-3 py-16">
                  <Loader2 className="h-9 w-9 animate-spin text-brand" aria-hidden />
                  <p className="text-sm font-semibold text-slate-600">Loading partner documents…</p>
                </div>
              ) : detailError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-900">
                  {detailError}
                </div>
              ) : detailUser ? (
                <>
                  {(() => {
                    const profile = detailUser.contractorProfile || detailUser.labourProfile || {}
                    const kycMedia = extractKycMedia(detailUser)
                    const status = profile?.kycStatus || KYC_STATUS.PENDING

                    return (
                      <>
                        {/* Worker Identity Summary Card */}
                        <div className="rounded-2xl border border-slate-200/80 bg-slate-50/75 p-4 space-y-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                  {detailUser.role === USER_ROLES.CONTRACTOR ? 'Contractor Partner' : 'Service Partner'}
                                </span>
                                <KycPill status={status} submittedAt={profile?.kycSubmittedAt} />
                              </div>
                              <h4 className="text-lg font-black text-slate-900 mt-0.5">
                                {detailUser.fullName || '—'}
                              </h4>
                              <p className="font-mono text-xs text-slate-600">+91 {detailUser.phone}</p>
                            </div>

                            {profile?.kycSubmittedAt ? (
                              <div className="text-right">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                                  Submitted On
                                </span>
                                <span className="text-xs font-semibold text-slate-700">
                                  {new Date(profile.kycSubmittedAt).toLocaleString(undefined, {
                                    dateStyle: 'medium',
                                    timeStyle: 'short',
                                  })}
                                </span>
                              </div>
                            ) : null}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-200/60">
                            <div className="rounded-xl border border-slate-200 bg-white p-2.5 flex items-center justify-between">
                              <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                                  Aadhaar Number
                                </span>
                                <span className="font-mono text-xs font-bold text-slate-800">
                                  {profile?.aadhaarMasked || 'Not provided'}
                                </span>
                              </div>
                              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                                UIDAI
                              </span>
                            </div>

                            <div className="rounded-xl border border-slate-200 bg-white p-2.5 flex items-center justify-between">
                              <div>
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                                  PAN Card Number
                                </span>
                                <span className="font-mono text-xs font-bold text-slate-800">
                                  {profile?.panMasked || 'Not provided'}
                                </span>
                              </div>
                              <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                                ITD
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Uploaded Documents Gallery (NEW) */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                                Uploaded Documents & ID Photos ({kycMedia.documents.length})
                              </h4>
                              {kycMedia.documents.length > 0 && (
                                <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-extrabold text-brand">
                                  Click image to zoom
                                </span>
                              )}
                            </div>
                          </div>

                          {kycMedia.documents.length > 0 ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                              {kycMedia.documents.map((doc, idx) => (
                                <div
                                  key={idx}
                                  className="group rounded-2xl border border-slate-200 bg-white p-3 shadow-xs hover:border-brand/40 hover:shadow-md transition-all flex flex-col"
                                >
                                  {/* Card Top Label & Open Full Link */}
                                  <div className="flex items-center justify-between gap-2 mb-2">
                                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-800 truncate">
                                      {doc.label}
                                    </span>
                                    <a
                                      href={doc.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 text-[11px] font-bold text-brand hover:underline shrink-0"
                                      title="Open in new window"
                                    >
                                      <span>Full</span>
                                      <ExternalLink className="h-3 w-3" />
                                    </a>
                                  </div>

                                  {/* Preview Area */}
                                  {doc.isPdf ? (
                                    <a
                                      href={doc.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex h-44 w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center hover:bg-slate-100 transition"
                                    >
                                      <FileText className="h-10 w-10 text-rose-500 mb-2" />
                                      <span className="text-xs font-bold text-slate-800">PDF Document</span>
                                      <span className="text-[10px] text-brand mt-1 font-semibold flex items-center gap-1">
                                        Click to view PDF <ExternalLink className="h-3 w-3" />
                                      </span>
                                    </a>
                                  ) : (
                                    <div
                                      onClick={() => openLightbox(doc)}
                                      className="relative h-44 w-full cursor-pointer overflow-hidden rounded-xl border border-slate-200/90 bg-slate-900/5 group/thumb"
                                      title="Click to zoom / inspect high-resolution"
                                    >
                                      <img
                                        src={doc.url}
                                        alt={doc.label}
                                        className="h-full w-full object-contain transition duration-200 group-hover/thumb:scale-105"
                                        loading="lazy"
                                      />
                                      <div className="absolute inset-0 bg-slate-950/30 opacity-0 group-hover/thumb:opacity-100 flex items-center justify-center text-white text-xs font-bold transition gap-1.5 backdrop-blur-[1px]">
                                        <ZoomIn className="h-4 w-4" />
                                        <span>Click to Zoom</span>
                                      </div>
                                    </div>
                                  )}

                                  {/* Bottom Inspection Actions */}
                                  <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-slate-100">
                                    <button
                                      type="button"
                                      onClick={() => openLightbox(doc)}
                                      className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-brand transition cursor-pointer"
                                    >
                                      <ZoomIn className="h-3.5 w-3.5" />
                                      <span>Zoom & Inspect</span>
                                    </button>
                                    <a
                                      href={doc.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      download
                                      className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
                                    >
                                      <Download className="h-3.5 w-3.5" />
                                      <span>Save</span>
                                    </a>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/75 p-5 text-center">
                              <FileText className="mx-auto h-8 w-8 text-slate-300 mb-1" />
                              <p className="text-xs font-semibold text-slate-600">No document photos uploaded yet</p>
                              <p className="text-[11px] text-slate-400 mt-0.5">
                                Worker may have submitted video KYC instead.
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Recorded Video KYC Section */}
                        {kycMedia.videos.length > 0 ? (
                          <div className="space-y-2 pt-2 border-t border-slate-100">
                            <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">
                              Recorded KYC Video ({kycMedia.videos.length})
                            </h4>
                            {kycMedia.videos.map((vid, idx) => (
                              <div key={idx} className="rounded-2xl border border-slate-200 bg-slate-950 p-2 overflow-hidden shadow-sm">
                                <video
                                  src={vid.url}
                                  controls
                                  playsInline
                                  className="aspect-video w-full rounded-xl bg-slate-950 object-contain"
                                />
                                <div className="p-2 flex items-center justify-between text-white/80 text-xs">
                                  <span className="font-semibold">{vid.label}</span>
                                  <a
                                    href={vid.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-brand hover:underline text-[11px] font-bold flex items-center gap-1"
                                  >
                                    Open Video ↗
                                  </a>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : kycMedia.documents.length > 0 ? (
                          <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-3 text-xs text-sky-900 flex items-center gap-2.5">
                            <CheckCircle2 className="h-4 w-4 text-sky-600 shrink-0" />
                            <span>
                              Worker submitted document photo proof for KYC verification (no separate video file).
                            </span>
                          </div>
                        ) : null}

                        {/* Rejection Note & Decision Section */}
                        <div className="pt-2 border-t border-slate-100 space-y-3">
                          {status === KYC_STATUS.VERIFIED && (
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-bold text-emerald-800 flex items-center gap-2">
                              <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                              <span>This partner's KYC has already been verified and approved.</span>
                            </div>
                          )}

                          {status === KYC_STATUS.FAILED && profile?.kycReviewNote && (
                            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900">
                              <span className="font-bold">Previous Rejection Reason: </span>
                              <span>{profile.kycReviewNote}</span>
                            </div>
                          )}

                          <div>
                            <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500" htmlFor="reject-note">
                              Review / Rejection Note (optional if approved)
                            </label>
                            <textarea
                              id="reject-note"
                              rows={2}
                              value={reviewNote}
                              onChange={(e) => setReviewNote(e.target.value)}
                              placeholder="e.g. Aadhaar details clear and verified, or Note for worker if rejecting"
                              className="w-full rounded-xl border border-slate-200/90 bg-white px-3 py-2 text-xs font-medium text-slate-900 outline-none focus:ring-2 focus:ring-brand/35 focus:border-brand"
                            />
                          </div>

                          <div className="flex flex-col gap-2.5 sm:flex-row pt-1">
                            <button
                              type="button"
                              disabled={reviewBusy}
                              onClick={() => runKycReview('rejected')}
                              className="flex-1 rounded-2xl border border-rose-200/90 bg-rose-50 py-3 text-xs font-bold text-rose-900 transition hover:bg-rose-100 disabled:opacity-50 cursor-pointer shadow-2xs"
                            >
                              {reviewBusy ? <Loader2 className="h-4 w-4 animate-spin mx-auto" /> : 'Reject KYC'}
                            </button>
                            <AppPrimaryButton
                              type="button"
                              className="flex-1 py-3 text-xs font-bold cursor-pointer"
                              disabled={reviewBusy}
                              onClick={() => runKycReview('approved')}
                            >
                              {reviewBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                              {status === KYC_STATUS.VERIFIED ? 'Re-Approve KYC' : 'Approve KYC & Start Trial'}
                            </AppPrimaryButton>
                          </div>
                        </div>
                      </>
                    )
                  })()}
                </>
              ) : null}
            </div>
          </motion.div>
        </div>
      ) : null}

      {/* High-Resolution Document Lightbox & Zoom Modal */}
      {lightboxMedia && (
        <div
          className="fixed inset-0 z-[100] flex flex-col bg-slate-950/95 backdrop-blur-md p-3 sm:p-5"
          role="dialog"
          aria-modal="true"
        >
          {/* Lightbox Toolbar */}
          <div className="flex items-center justify-between border-b border-white/10 pb-3 text-white">
            <div className="flex items-center gap-2 min-w-0">
              <span className="rounded-md bg-white/10 px-2.5 py-1 text-xs font-bold truncate">
                {lightboxMedia.label || 'Document Photo'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setZoomScale((s) => Math.max(0.5, s - 0.25))}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition cursor-pointer text-white"
                title="Zoom Out"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setZoomScale(1)
                  setRotation(0)
                }}
                className="h-9 px-3 rounded-xl bg-white/10 hover:bg-white/20 transition cursor-pointer text-xs font-mono font-bold text-white"
                title="Reset Zoom"
              >
                {Math.round(zoomScale * 100)}%
              </button>
              <button
                type="button"
                onClick={() => setZoomScale((s) => Math.min(3, s + 0.25))}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition cursor-pointer text-white"
                title="Zoom In"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition cursor-pointer text-white"
                title="Rotate 90 degrees"
              >
                <RotateCw className="h-4 w-4" />
              </button>
              <a
                href={lightboxMedia.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 transition cursor-pointer text-white"
                title="Open in new window"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
              <button
                type="button"
                onClick={closeLightbox}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-600/80 hover:bg-rose-600 transition cursor-pointer text-white ml-2"
                title="Close Lightbox"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Lightbox Image Preview Area */}
          <div className="flex-1 overflow-auto flex items-center justify-center p-4">
            <img
              src={lightboxMedia.url}
              alt={lightboxMedia.label}
              style={{
                transform: `rotate(${rotation}deg) scale(${zoomScale})`,
                transition: 'transform 0.15s ease-out',
                maxHeight: '82vh',
                maxWidth: '92vw',
              }}
              className="object-contain rounded-lg shadow-2xl select-none"
            />
          </div>
        </div>
      )}

      {kitModalUser && (
        <WelcomeKitModal
          user={kitModalUser}
          onClose={() => {
            setKitModalUser(null)
            load()
          }}
          onSuccess={(updatedKit) => {
            setItems((prev) =>
              prev.map((item) =>
                item._id === kitModalUser._id ? { ...item, welcomeKit: updatedKit } : item
              )
            )
            load()
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
                      {formatTrialTimeSlot((trialModalUser.contractorProfile || trialModalUser.labourProfile)?.trialSlot?.timeSlot) || '—'}
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
