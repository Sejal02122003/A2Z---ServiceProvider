import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  BadgeIndianRupee,
  Calendar,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Filter,
  IndianRupee,
  Info,
  Loader2,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  TrendingUp,
  Users,
  Wallet,
  X,
  XCircle,
} from 'lucide-react'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { adminLabourSubscriptionsApi } from '../../api/adminLabourSubscriptionsApi.js'
import { adminSettingsApi } from '../../api/adminSettingsApi.js'

// ─── Toast ─────────────────────────────────────────────────────────────────
function Toast({ message, variant = 'success' }) {
  if (!message) return null
  const isError = variant === 'error'
  const styles = isError
    ? 'border-rose-200/90 bg-rose-50/95 text-rose-900 shadow-rose-500/10'
    : 'border-emerald-200/90 bg-emerald-50/95 text-emerald-900 shadow-emerald-500/10'
  const Icon = isError ? AlertTriangle : CheckCircle2

  return (
    <motion.div
      initial={{ opacity: 0, y: -16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16, scale: 0.96 }}
      transition={{ duration: 0.2 }}
      className={`fixed left-4 right-4 top-20 z-50 mx-auto flex max-w-md items-center gap-2.5 rounded-2xl border px-4 py-3 text-sm font-semibold shadow-xl backdrop-blur-md ${styles}`}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden />
      <span className="flex-1">{message}</span>
    </motion.div>
  )
}

function getCurrentISTHour() {
  return parseInt(
    new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false }),
    10
  )
}

function formatHour(h) {
  if (h == null) return '—'
  const suffix = h >= 12 ? 'PM' : 'AM'
  const display = h % 12 || 12
  return `${display}:00 ${suffix}`
}

// ─── Compact Stat Card ─────────────────────────────────────────────────────
function StatCard({ icon: Icon, label, value, sub, accent = 'blue', loading }) {
  const themes = {
    blue: {
      card: 'border-blue-200/75 bg-gradient-to-b from-blue-50/40 via-white to-white hover:border-blue-300',
      iconBox: 'bg-blue-500/10 text-blue-600 ring-1 ring-blue-500/20',
      text: 'text-blue-600',
    },
    emerald: {
      card: 'border-emerald-200/75 bg-gradient-to-b from-emerald-50/40 via-white to-white hover:border-emerald-300',
      iconBox: 'bg-emerald-500/10 text-emerald-600 ring-1 ring-emerald-500/20',
      text: 'text-emerald-700',
    },
    amber: {
      card: 'border-amber-200/75 bg-gradient-to-b from-amber-50/40 via-white to-white hover:border-amber-300',
      iconBox: 'bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20',
      text: 'text-amber-700',
    },
    rose: {
      card: 'border-rose-200/75 bg-gradient-to-b from-rose-50/40 via-white to-white hover:border-rose-300',
      iconBox: 'bg-rose-500/10 text-rose-600 ring-1 ring-rose-500/20',
      text: 'text-rose-700',
    },
    slate: {
      card: 'border-slate-200/75 bg-gradient-to-b from-slate-50/40 via-white to-white hover:border-slate-300',
      iconBox: 'bg-slate-500/10 text-slate-600 ring-1 ring-slate-500/20',
      text: 'text-slate-800',
    },
  }

  const theme = themes[accent] || themes.blue

  return (
    <div
      className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border px-3.5 py-2.5 shadow-2xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xs ${theme.card}`}
    >
      <div className="flex items-center justify-between gap-1.5">
        <p className="min-w-0 flex-1 truncate text-[10.5px] font-bold uppercase tracking-wider text-slate-500" title={label}>
          {label}
        </p>
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg shadow-2xs transition-transform duration-200 group-hover:scale-105 ${theme.iconBox}`}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>

      <div className="mt-1 flex items-baseline justify-between gap-1">
        {loading ? (
          <div className="h-6 w-14 animate-pulse rounded-md bg-slate-200/70" />
        ) : (
          <p className={`text-xl font-black tracking-tight ${theme.text}`}>{value}</p>
        )}
        {sub && !loading && (
          <span className="truncate rounded bg-amber-50 px-1.5 py-0.5 text-[9.5px] font-bold text-amber-700 border border-amber-200/60">
            {sub}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Badges ────────────────────────────────────────────────────────────────
function RefundBadge({ status }) {
  const map = {
    pending: { bg: 'bg-amber-50 text-amber-800 border-amber-200/80', dot: 'bg-amber-500', label: 'Pending' },
    processing: { bg: 'bg-sky-50 text-sky-800 border-sky-200/80', dot: 'bg-sky-500', label: 'Processing' },
    refunded: { bg: 'bg-emerald-50 text-emerald-800 border-emerald-200/80', dot: 'bg-emerald-500', label: 'Refunded' },
    failed: { bg: 'bg-rose-50 text-rose-800 border-rose-200/80', dot: 'bg-rose-500', label: 'Failed' },
    manually_approved: { bg: 'bg-blue-50 text-blue-800 border-blue-200/80', dot: 'bg-blue-500', label: 'Approved' },
    manually_rejected: { bg: 'bg-slate-100 text-slate-700 border-slate-200/80', dot: 'bg-slate-500', label: 'Rejected' },
    not_eligible: { bg: 'bg-slate-50 text-slate-500 border-slate-200/80', dot: 'bg-slate-400', label: 'Not Eligible' },
  }
  const current = map[status] || map.pending

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${current.bg}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${current.dot}`} />
      {current.label}
    </span>
  )
}

function SubStatusBadge({ status }) {
  const map = {
    active: { bg: 'bg-emerald-50 text-emerald-800 border-emerald-200/80', dot: 'bg-emerald-500', label: 'ACTIVE' },
    expired: { bg: 'bg-slate-100 text-slate-700 border-slate-200/80', dot: 'bg-slate-400', label: 'EXPIRED' },
    refunded: { bg: 'bg-sky-50 text-sky-800 border-sky-200/80', dot: 'bg-sky-500', label: 'REFUNDED' },
  }
  const current = map[status] || {
    bg: 'bg-slate-100 text-slate-700 border-slate-200/80',
    dot: 'bg-slate-400',
    label: (status || 'UNKNOWN').toUpperCase(),
  }

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold tracking-wide ${current.bg}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${current.dot}`} />
      {current.label}
    </span>
  )
}

function WorkerCell({ labour }) {
  const name = labour?.fullName || 'Unknown Worker'
  const phone = labour?.phone ? `+91 ${labour.phone}` : '—'
  const initials =
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'L'

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-blue-200/70 bg-gradient-to-br from-blue-500/10 to-indigo-500/10 text-xs font-black text-brand shadow-2xs">
        {initials}
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-bold text-slate-900">{name}</p>
        <p className="font-mono text-xs text-slate-500">{phone}</p>
      </div>
    </div>
  )
}

function TxIdCell({ txId }) {
  const [copied, setCopied] = useState(false)
  if (!txId) return <span className="font-mono text-xs text-slate-400">—</span>

  const handleCopy = () => {
    navigator.clipboard.writeText(txId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="Click to copy Transaction ID"
      className="group inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50/80 px-2 py-1 font-mono text-xs text-slate-600 transition hover:border-brand/40 hover:bg-brand/5 hover:text-brand"
    >
      <span>{txId.length > 14 ? `${txId.slice(0, 6)}...${txId.slice(-4)}` : txId}</span>
      {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3 opacity-40 group-hover:opacity-100" />}
    </button>
  )
}

function PlanDateCell({ sub, selectedDate }) {
  if (sub.durationDays > 1) {
    const targetStr = selectedDate || new Date().toISOString().split('T')[0]
    const start = new Date(sub.date)
    const current = new Date(targetStr)
    const diffTime = current - start
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1
    const progress = Math.min(Math.max(1, diffDays), sub.durationDays)
    const pct = Math.round((progress / sub.durationDays) * 100)

    return (
      <div className="min-w-[110px] space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-brand">Day {progress} of {sub.durationDays}</span>
          <span className="text-[10px] font-semibold text-slate-400">{pct}%</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-brand transition-all duration-300" style={{ width: `${pct}%` }} />
        </div>
        <p className="font-mono text-[10px] text-slate-400">Started: {sub.date}</p>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1.5 font-mono text-xs text-slate-600">
      <Calendar className="h-3.5 w-3.5 text-slate-400" />
      <span>{sub.date}</span>
    </div>
  )
}

// ─── Refund Action Modal ────────────────────────────────────────────────────
function RefundModal({ sub, onClose, onDone }) {
  const [action, setAction] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function handle(act) {
    setAction(act)
    setLoading(true)
    setErr('')
    try {
      await adminLabourSubscriptionsApi.processRefund(sub._id, act, note)
      onDone(`Refund ${act}d successfully`)
    } catch (e) {
      setErr(e?.message || 'Action failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 backdrop-blur-sm sm:items-center sm:p-4" role="dialog" aria-modal>
      <button type="button" className="absolute inset-0 bg-slate-950/40 transition-opacity" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        className="relative z-10 w-full max-w-lg overflow-hidden rounded-t-3xl border border-slate-200/80 bg-white shadow-2xl sm:rounded-3xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">Manage Refund Request</h3>
            <p className="text-xs text-slate-500 font-medium">{sub.labour?.fullName || 'Worker'} • {sub.date}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 p-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-blue-100 bg-blue-50/50 p-3 text-center">
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-600">Amount Paid</p>
              <p className="mt-1 text-lg font-black text-slate-900">₹{sub.amountPaid}</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-3 text-center">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Bookings</p>
              <p className="mt-1 text-lg font-black text-slate-900">{sub.bookingsReceived || 0}</p>
            </div>
            <div className="rounded-2xl border border-slate-200/80 bg-slate-50 p-3 text-center">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Offers</p>
              <p className="mt-1 text-lg font-black text-slate-900">{sub.bookingOpportunitiesOffered || 0}</p>
            </div>
          </div>

          {/* Note Input */}
          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Admin Note <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Approved due to zero work opportunities..."
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-brand focus:ring-3 focus:ring-brand/15"
            />
          </div>

          {err && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{err}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-3 gap-2.5 pt-1">
            <button
              type="button"
              disabled={loading}
              onClick={() => handle('reject')}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm font-bold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
            >
              {loading && action === 'reject' ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              Reject
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => handle('approve')}
              className="flex items-center justify-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm font-bold text-blue-700 transition hover:bg-blue-100 disabled:opacity-50"
            >
              {loading && action === 'approve' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Approve
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={() => handle('process')}
              className="flex items-center justify-center gap-1.5 rounded-xl bg-brand px-3 py-2.5 text-sm font-bold text-white shadow-md shadow-brand/20 transition hover:bg-brand/90 disabled:opacity-50"
            >
              {loading && action === 'process' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}
              Process
            </button>
          </div>

          <div className="flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
            <Info className="h-3.5 w-3.5" />
            <span>"Process" instantly refunds ₹{sub.amountPaid} to the worker's wallet.</span>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

// ─── Subscription Plan Modal ────────────────────────────────────────────────
function SubscriptionPlanModal({ plan, onClose, onDone }) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: plan?.name || '',
    durationDays: plan?.durationDays || 7,
    price: plan?.price || 99,
    features: plan?.features?.join(', ') || '',
    isActive: plan?.isActive ?? true,
  })
  const [err, setErr] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErr('')
    setLoading(true)
    try {
      const payload = {
        ...form,
        durationDays: Number(form.durationDays),
        price: Number(form.price),
        features: form.features
          .split(',')
          .map((f) => f.trim())
          .filter(Boolean),
      }
      if (plan) {
        await adminLabourSubscriptionsApi.updatePlan(plan._id, payload)
      } else {
        await adminLabourSubscriptionsApi.createPlan(payload)
      }
      onDone(plan ? 'Plan updated successfully' : 'Plan created successfully')
    } catch (error) {
      setErr(error.message || 'Failed to save plan')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-sm" role="dialog" aria-modal>
      <div className="absolute inset-0 bg-slate-950/40" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
          <h3 className="text-base font-extrabold text-slate-900">{plan ? 'Edit Subscription Plan' : 'Create Subscription Plan'}</h3>
          <button onClick={onClose} className="rounded-xl p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          {err && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{err}</span>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Plan Name</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
              placeholder="e.g. 7 Days Unlimited"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Duration (Days)</label>
              <input
                type="number"
                required
                min="1"
                value={form.durationDays}
                onChange={(e) => setForm({ ...form, durationDays: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">Price (₹)</label>
              <input
                type="number"
                required
                min="0"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
              Features <span className="font-normal text-slate-400">(comma separated)</span>
            </label>
            <textarea
              required
              value={form.features}
              onChange={(e) => setForm({ ...form, features: e.target.value })}
              rows={3}
              className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
              placeholder="All job offers, Priority alerts, Zero commission..."
            />
          </div>

          <label className="flex cursor-pointer items-center gap-2.5 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
            />
            <span>Make this plan active and visible to workers</span>
          </label>

          <div className="flex gap-2.5 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-sm font-bold text-white shadow-md shadow-brand/20 transition hover:bg-brand/90 disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Plan'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────
export function AdminLabourSubscriptionsPage() {
  const [activeTab, setActiveTab] = useState('subscriptions')
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [subscriptions, setSubscriptions] = useState([])
  const [refundEligible, setRefundEligible] = useState([])
  const [history, setHistory] = useState([])
  const [total, setTotal] = useState(0)
  const [plans, setPlans] = useState([])
  const [settings, setSettings] = useState(null)
  const [currentHour, setCurrentHour] = useState(getCurrentISTHour())
  const [page, setPage] = useState(1)
  const LIMIT = 30

  // Filters
  const [selectedDate, setSelectedDate] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [refundStatusFilter, setRefundStatusFilter] = useState('all')
  const [search, setSearch] = useState('')

  // Modal State
  const [actionSub, setActionSub] = useState(null)
  const [toast, setToast] = useState({ message: '', variant: 'success' })
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [editingPlan, setEditingPlan] = useState(null)

  const showToast = useCallback((message, variant = 'success') => {
    setToast({ message, variant })
    setTimeout(() => setToast({ message: '', variant: 'success' }), 4000)
  }, [])

  const fetchStats = useCallback(async () => {
    try {
      const [res, settingsRes] = await Promise.all([
        adminLabourSubscriptionsApi.getStats({ date: selectedDate || undefined }),
        adminSettingsApi.getSettings(),
      ])
      setStats(res?.data || null)
      setSettings(settingsRes?.data?.settings || null)
    } catch (e) {
      console.error('Failed to fetch stats/settings', e)
    }
  }, [selectedDate])

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      if (activeTab === 'subscriptions') {
        const res = await adminLabourSubscriptionsApi.getSubscriptions({
          date: selectedDate,
          status: statusFilter,
          refundStatus: refundStatusFilter,
          search,
          page,
          limit: LIMIT,
        })
        setSubscriptions(res?.data?.subscriptions || [])
        setTotal(res?.data?.total || 0)
      } else if (activeTab === 'refund-eligible') {
        const res = await adminLabourSubscriptionsApi.getRefundEligible({ date: selectedDate })
        setRefundEligible(res?.data?.subscriptions || [])
      } else if (activeTab === 'history') {
        const res = await adminLabourSubscriptionsApi.getRefundHistory({ date: selectedDate || undefined, page })
        setHistory(res?.data?.subscriptions || [])
        setTotal(res?.data?.total || 0)
      } else if (activeTab === 'plans') {
        const res = await adminLabourSubscriptionsApi.getPlans()
        setPlans(res?.data?.plans || [])
      }
    } catch (e) {
      showToast('Failed to load data', 'error')
    } finally {
      setLoading(false)
    }
  }, [activeTab, selectedDate, statusFilter, refundStatusFilter, search, page, showToast])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleDeletePlan = async (id) => {
    if (!window.confirm('Are you sure you want to delete this subscription plan?')) return
    try {
      await adminLabourSubscriptionsApi.deletePlan(id)
      showToast('Plan deleted successfully', 'success')
      fetchData()
    } catch (e) {
      showToast('Failed to delete plan', 'error')
    }
  }

  useEffect(() => {
    const interval = setInterval(() => setCurrentHour(getCurrentISTHour()), 60_000)
    return () => clearInterval(interval)
  }, [])

  const pages = Math.ceil(total / LIMIT)

  const TABS = [
    { id: 'subscriptions', label: 'All Subscriptions', icon: Users, count: stats?.totalToday },
    {
      id: 'refund-eligible',
      label: 'Refund Eligible',
      icon: RotateCcw,
      count: stats?.pendingRefund,
      highlight: stats?.pendingRefund > 0,
    },
    { id: 'history', label: 'Refund History', icon: Clock },
    { id: 'plans', label: 'Subscription Plans', icon: Shield },
  ]

  const isWindowOpen =
    settings?.subscriptionStartHour != null &&
    settings?.subscriptionEndHour != null &&
    currentHour >= settings.subscriptionStartHour &&
    currentHour < settings.subscriptionEndHour

  const windowProgress =
    isWindowOpen && settings.subscriptionEndHour > settings.subscriptionStartHour
      ? Math.min(
          100,
          Math.max(
            0,
            ((currentHour - settings.subscriptionStartHour) /
              (settings.subscriptionEndHour - settings.subscriptionStartHour)) *
              100
          )
        )
      : 0

  const hasActiveFilters = Boolean(search || statusFilter !== 'all' || refundStatusFilter !== 'all')

  const handleClearFilters = () => {
    setSearch('')
    setStatusFilter('all')
    setRefundStatusFilter('all')
    setPage(1)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="mx-auto w-full max-w-7xl space-y-6"
    >
      <AnimatePresence>
        {toast.message && <Toast message={toast.message} variant={toast.variant} />}
      </AnimatePresence>

      {/* ─── Header Bar ──────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <BadgeIndianRupee className="h-5 w-5" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Service Provider Subscriptions</h1>
          </div>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 font-medium">
            Daily subscription operations, fee management & refund processing
          </p>
        </div>

        {/* Date Selector & Refresh */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Quick Date Clear / Filter */}
          <div className="relative flex items-center">
            <Calendar className="pointer-events-none absolute left-3 h-4 w-4 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value)
                setPage(1)
              }}
              className="h-10 rounded-xl border border-slate-200/90 bg-white pl-9 pr-8 text-xs sm:text-sm font-semibold text-slate-800 shadow-2xs outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/15"
            />
            {selectedDate && (
              <button
                type="button"
                onClick={() => {
                  setSelectedDate('')
                  setPage(1)
                }}
                title="Clear date"
                className="absolute right-2.5 rounded-md p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {selectedDate && (
            <button
              type="button"
              onClick={() => {
                setSelectedDate('')
                setPage(1)
              }}
              className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
            >
              All Time
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              fetchStats()
              fetchData()
            }}
            title="Refresh data"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200/90 bg-white text-slate-600 shadow-2xs transition hover:border-brand/40 hover:text-brand"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-brand' : ''}`} />
          </button>
        </div>
      </div>

      {/* ─── Metric Cards Grid ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7">
        <StatCard
          icon={Users}
          label={selectedDate ? 'Total Date' : 'Total Subs'}
          value={stats?.totalToday ?? '—'}
          loading={!stats}
          accent="blue"
        />
        <StatCard
          icon={ShieldCheck}
          label={selectedDate ? 'Active Date' : 'Active Today'}
          value={stats?.activeToday ?? '—'}
          loading={!stats}
          accent="emerald"
        />
        <StatCard
          icon={IndianRupee}
          label="Revenue"
          value={stats ? `₹${stats.totalRevenue}` : '—'}
          loading={!stats}
          accent="blue"
        />
        <StatCard
          icon={BadgeIndianRupee}
          label="Net Revenue"
          value={stats ? `₹${stats.netRevenue}` : '—'}
          loading={!stats}
          accent="emerald"
        />
        <StatCard
          icon={RotateCcw}
          label="Refunded"
          value={stats?.refundedToday ?? '—'}
          sub={stats?.totalRefunded ? `₹${stats.totalRefunded}` : ''}
          loading={!stats}
          accent="amber"
        />
        <StatCard
          icon={AlertTriangle}
          label="Pending"
          value={stats?.pendingRefund ?? '—'}
          loading={!stats}
          accent="rose"
        />
        <StatCard
          icon={TrendingUp}
          label="Rejected"
          value={stats?.rejectedRefund ?? '—'}
          loading={!stats}
          accent="slate"
        />
      </div>

      {/* ─── Subscription Window Widget (if enabled) ──────────────────────── */}
      {settings?.isUserSubscriptionEnabled && (
        <GlassPanel className="p-4 sm:p-5 border border-slate-200/80 bg-gradient-to-r from-slate-50/70 via-white to-slate-50/70">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Daily Subscription Window</p>
                <p className="text-sm font-semibold text-slate-800">
                  Workers can subscribe between {formatHour(settings.subscriptionStartHour)} and {formatHour(settings.subscriptionEndHour)} IST
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-center">
              {isWindowOpen ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800 border border-emerald-200">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  Window Open
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 border border-slate-200">
                  <span className="h-2 w-2 rounded-full bg-slate-400" />
                  Window Closed
                </span>
              )}
            </div>
          </div>

          {/* Progress Indicator */}
          <div className="mt-4 flex items-center justify-between gap-4">
            <span className="font-mono text-xs font-bold text-slate-600 shrink-0">
              {formatHour(settings.subscriptionStartHour)}
            </span>
            <div className="relative h-2 flex-1 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-700 ${
                  isWindowOpen ? 'bg-gradient-to-r from-brand to-emerald-500' : 'bg-slate-300'
                }`}
                style={{ width: `${windowProgress}%` }}
              />
            </div>
            <span className="font-mono text-xs font-bold text-slate-600 shrink-0">
              {formatHour(settings.subscriptionEndHour)}
            </span>
          </div>
        </GlassPanel>
      )}

      {/* ─── Tabs Bar ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-1">
        <div className="flex flex-wrap gap-1.5">
          {TABS.map(({ id, label, icon: Icon, count, highlight }) => {
            const isActive = activeTab === id
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setActiveTab(id)
                  setPage(1)
                }}
                className={`relative flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-bold transition-all duration-150 ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{label}</span>
                {count != null && count > 0 && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-black ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : highlight
                        ? 'bg-rose-100 text-rose-700'
                        : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {activeTab === 'plans' && (
          <button
            onClick={() => {
              setEditingPlan(null)
              setShowPlanModal(true)
            }}
            className="flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-xs sm:text-sm font-bold text-white shadow-sm transition hover:bg-brand/90"
          >
            <Plus className="h-4 w-4" />
            Add Plan
          </button>
        )}
      </div>

      {/* ─── Search & Filters (Subscriptions tab) ────────────────────────── */}
      {activeTab === 'subscriptions' && (
        <div className="flex flex-col gap-2.5 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-2xs sm:flex-row sm:items-center">
          {/* Search Box */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              placeholder="Search by worker name or phone..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-2 pl-9 pr-8 text-xs sm:text-sm outline-none transition focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/15"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setPage(1)
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Status Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-slate-700 outline-none transition focus:border-brand"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="refunded">Refunded</option>
            </select>

            {/* Refund Status Filter */}
            <select
              value={refundStatusFilter}
              onChange={(e) => {
                setRefundStatusFilter(e.target.value)
                setPage(1)
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-slate-700 outline-none transition focus:border-brand"
            >
              <option value="all">All Refund Status</option>
              <option value="pending">Pending</option>
              <option value="refunded">Refunded</option>
              <option value="failed">Failed</option>
              <option value="manually_approved">Approved</option>
              <option value="manually_rejected">Rejected</option>
              <option value="not_eligible">Not Eligible</option>
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="h-3.5 w-3.5" />
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {/* ─── Main Content Tabs ───────────────────────────────────────────── */}
      {loading ? (
        <GlassPanel className="p-8">
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex h-14 w-full animate-pulse items-center rounded-xl bg-slate-100/70 p-3" />
            ))}
          </div>
        </GlassPanel>
      ) : activeTab === 'refund-eligible' ? (
        /* ─── Refund Eligible Table ─────────────────────────────────────── */
        <GlassPanel className="overflow-hidden rounded-2xl border border-slate-200/80 p-0 shadow-2xs">
          {refundEligible.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-500 ring-8 ring-emerald-50/50">
                <CheckCircle2 className="h-7 w-7" />
              </div>
              <p className="text-base font-bold text-slate-800">No pending refunds for {selectedDate || 'all dates'}</p>
              <p className="max-w-sm text-xs text-slate-500">
                All daily subscriptions eligible for refunds have been processed or settled.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3.5">Worker</th>
                    <th className="px-5 py-3.5">Plan</th>
                    <th className="px-5 py-3.5">Amount</th>
                    <th className="px-5 py-3.5">Performance</th>
                    <th className="px-5 py-3.5">Window Hours</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {refundEligible.map((sub) => (
                    <tr key={sub._id} className="transition-colors hover:bg-slate-50/70">
                      <td className="px-5 py-3.5">
                        <WorkerCell labour={sub.labour} />
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                          {sub.planId?.name || (sub.durationDays === 1 ? '1 Day Plan' : 'Custom Plan')}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 font-black text-slate-900">₹{sub.amountPaid}</td>
                      <td className="px-5 py-3.5">
                        <div className="text-xs">
                          <span className="font-bold text-slate-900">{sub.bookingsReceived || 0}</span>
                          <span className="text-slate-400"> received / </span>
                          <span className="font-semibold text-slate-600">{sub.bookingOpportunitiesOffered || 0}</span>
                          <span className="text-slate-400"> offered</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-xs font-mono text-slate-600">
                        {formatHour(sub.subscriptionStartHour)} – {formatHour(sub.subscriptionEndHour)}
                      </td>
                      <td className="px-5 py-3.5">
                        <RefundBadge status={sub.refundStatus} />
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => setActionSub(sub)}
                          className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition hover:bg-brand/90"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Manage
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </GlassPanel>
      ) : activeTab === 'subscriptions' || activeTab === 'history' ? (
        /* ─── Subscriptions / History Table ─────────────────────────────── */
        <GlassPanel className="overflow-hidden rounded-2xl border border-slate-200/80 p-0 shadow-2xs">
          {(activeTab === 'subscriptions' ? subscriptions : history).length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                <Users className="h-7 w-7" />
              </div>
              <p className="text-base font-bold text-slate-800">No subscriptions found</p>
              <p className="max-w-sm text-xs text-slate-500">
                {hasActiveFilters
                  ? 'No records match your active search filters. Try clearing filters.'
                  : 'No subscription records available for this selection.'}
              </p>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={handleClearFilters}
                  className="mt-2 rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 transition"
                >
                  Clear Filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] text-left text-sm">
                <thead className="border-b border-slate-200/80 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-5 py-3.5">Worker</th>
                    <th className="px-5 py-3.5">Plan</th>
                    <th className="px-5 py-3.5">Date / Progress</th>
                    <th className="px-5 py-3.5">Tx ID</th>
                    <th className="px-5 py-3.5">Amount</th>
                    <th className="px-5 py-3.5">Bookings</th>
                    <th className="px-5 py-3.5">Sub Status</th>
                    <th className="px-5 py-3.5">Refund Status</th>
                    {activeTab === 'history' && <th className="px-5 py-3.5">Handled By</th>}
                    <th className="px-5 py-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {(activeTab === 'subscriptions' ? subscriptions : history).map((sub) => {
                    const canManage =
                      sub.durationDays === 1 &&
                      sub.refundEligibility &&
                      ['pending', 'processing', 'failed', 'manually_approved'].includes(sub.refundStatus)

                    return (
                      <tr key={sub._id} className="transition-colors hover:bg-slate-50/70">
                        <td className="px-5 py-3.5">
                          <WorkerCell labour={sub.labour} />
                        </td>
                        <td className="px-5 py-3.5">
                          <span className="inline-flex rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                            {sub.planId?.name || (sub.durationDays === 1 ? '1 Day Plan' : 'Custom Plan')}
                          </span>
                        </td>
                        <td className="px-5 py-3.5">
                          <PlanDateCell sub={sub} selectedDate={selectedDate} />
                        </td>
                        <td className="px-5 py-3.5">
                          <TxIdCell txId={sub.transactionId} />
                        </td>
                        <td className="px-5 py-3.5 font-black text-slate-900">₹{sub.amountPaid}</td>
                        <td className="px-5 py-3.5">
                          <div className="text-xs">
                            <span className="font-bold text-slate-900">{sub.bookingsReceived || 0}</span>
                            <span className="text-slate-400 font-normal"> / {sub.bookingOpportunitiesOffered || 0} offers</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5">
                          <SubStatusBadge status={sub.status} />
                        </td>
                        <td className="px-5 py-3.5">
                          {sub.durationDays === 1 ? <RefundBadge status={sub.refundStatus} /> : <span className="text-slate-400 font-mono text-xs">—</span>}
                        </td>
                        {activeTab === 'history' && (
                          <td className="px-5 py-3.5 text-xs font-medium text-slate-600">
                            {sub.adminActionBy?.fullName || 'System Auto'}
                          </td>
                        )}
                        <td className="px-5 py-3.5 text-right">
                          {canManage ? (
                            <button
                              type="button"
                              onClick={() => setActionSub(sub)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3 py-1.5 text-xs font-bold text-white shadow-2xs transition hover:bg-brand/90"
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              Manage
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400 font-mono">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </GlassPanel>
      ) : activeTab === 'plans' ? (
        /* ─── Subscription Plans Grid ───────────────────────────────────── */
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {plans.map((plan) => (
              <GlassPanel key={plan._id} className="relative flex flex-col justify-between p-5 border border-slate-200/80 shadow-2xs hover:shadow-md transition-all">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold tracking-wide ${
                        plan.isActive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${plan.isActive ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                      {plan.isActive ? 'ACTIVE' : 'INACTIVE'}
                    </span>

                    <button
                      onClick={() => handleDeletePlan(plan._id)}
                      title="Delete Plan"
                      className="rounded-xl p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <h3 className="mt-3 text-lg font-black text-slate-900">{plan.name}</h3>

                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-black text-brand">₹{plan.price}</span>
                    <span className="text-xs font-bold text-slate-500">/ {plan.durationDays} days</span>
                  </div>

                  <ul className="mt-4 space-y-2 text-xs text-slate-600">
                    {plan.features?.map((f, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                        <span className="font-medium">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={() => {
                    setEditingPlan(plan)
                    setShowPlanModal(true)
                  }}
                  className="mt-6 w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:border-brand/30 hover:text-brand transition"
                >
                  Edit Plan
                </button>
              </GlassPanel>
            ))}
          </div>
        </div>
      ) : null}

      {/* ─── Pagination ──────────────────────────────────────────────────── */}
      {pages > 1 && (
        <div className="flex items-center justify-between gap-3 pt-2">
          <p className="text-xs font-semibold text-slate-500">
            Page <span className="text-slate-900 font-bold">{page}</span> of {pages} ({total} total records)
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Previous
            </button>
            <button
              type="button"
              disabled={page >= pages || loading}
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-2xs transition hover:bg-slate-50 disabled:opacity-40"
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* ─── Modals ──────────────────────────────────────────────────────── */}
      {actionSub && (
        <RefundModal
          sub={actionSub}
          onClose={() => setActionSub(null)}
          onDone={(msg) => {
            setActionSub(null)
            showToast(msg, 'success')
            fetchStats()
            fetchData()
          }}
        />
      )}

      {showPlanModal && (
        <SubscriptionPlanModal
          plan={editingPlan}
          onClose={() => setShowPlanModal(false)}
          onDone={(msg) => {
            setShowPlanModal(false)
            showToast(msg, 'success')
            fetchData()
          }}
        />
      )}
    </motion.div>
  )
}
