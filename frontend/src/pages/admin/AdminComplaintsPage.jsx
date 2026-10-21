import { useState, useEffect, useCallback } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Clock,
  Filter,
  Loader2,
  MessageSquare,
  RefreshCw,
  XCircle,
} from 'lucide-react'
import { adminComplaintsApi } from '../../api/adminComplaintsApi.js'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'

const STATUS_FILTERS = ['ALL', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']
const ROLE_FILTERS = ['ALL', 'customer', 'labour', 'contractor', 'contractor']
const ROLE_LABELS = {
  ALL: 'All Roles',
  individual: 'Individuals',
  labour: 'Service Provider',
  contractor: 'Contractor',
  contractor: 'Vendors'
}

const STATUS_META = {
  OPEN: { label: 'Open', cls: 'bg-amber-100 text-amber-700', icon: Clock },
  IN_PROGRESS: { label: 'In Progress', cls: 'bg-blue-100 text-blue-700', icon: RefreshCw },
  RESOLVED: { label: 'Resolved', cls: 'bg-blue-100 text-blue-700', icon: CheckCircle2 },
  CLOSED: { label: 'Closed', cls: 'bg-slate-100 text-slate-500', icon: XCircle },
}

function StatusBadge({ status }) {
  const meta = STATUS_META[status] ?? STATUS_META.OPEN
  const Icon = meta.icon
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${meta.cls}`}>
      <Icon className="h-3 w-3" aria-hidden />
      {meta.label}
    </span>
  )
}

function ComplaintCard({ complaint, onUpdate }) {
  const [open, setOpen] = useState(false)
  const [newStatus, setNewStatus] = useState(complaint.status ?? 'OPEN')
  const [remarks, setRemarks] = useState(complaint.adminRemarks ?? '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const handleSave = async () => {
    setSaving(true)
    setErr('')
    try {
      await adminComplaintsApi.updateComplaint(complaint._id, {
        status: newStatus,
        adminRemarks: remarks.trim(),
      })
      onUpdate()
      setOpen(false)
    } catch (e) {
      setErr(e?.message || 'Failed to update')
    } finally {
      setSaving(false)
    }
  }

  const complainant = complaint.complainantId
  const complainee = complaint.complaineeId

  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm transition hover:shadow-md">
      {/* Header row */}
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-start gap-3 p-4 text-left"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
          <MessageSquare className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-bold text-slate-900 leading-snug">{complaint.title}</p>
            <StatusBadge status={complaint.status} />
          </div>
          <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{complaint.description}</p>
          <div className="mt-1.5 flex flex-wrap gap-3 text-[10px] text-slate-400">
            {complainant && (
              <span>
                <span className="font-semibold text-slate-600">By:</span>{' '}
                {complainant.fullName ? `${complainant.fullName} (${complainant.phone})` : complainant.phone || '—'}
              </span>
            )}
            {complainee && (
              <span>
                <span className="font-semibold text-slate-600">Against:</span>{' '}
                {complainee.fullName ? `${complainee.fullName} (${complainee.phone})` : complainee.phone || '—'}
              </span>
            )}
            {complaint.createdAt && (
              <span>
                {new Date(complaint.createdAt).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            )}
          </div>
        </div>
        <ChevronDown
          className={`mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>

      {/* Expandable action panel */}
      {open && (
        <div className="border-t border-slate-100 bg-slate-50/60 p-4 space-y-3">
          {/* Full description */}
          {complaint.description ? (
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Description</p>
              <p className="text-sm text-slate-700">{complaint.description}</p>
            </div>
          ) : null}

          {/* Existing admin remarks (read-only display) */}
          {complaint.adminRemarks ? (
            <div className="rounded-xl bg-white border border-slate-200 px-3 py-2">
              <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 mb-1">Previous remark</p>
              <p className="text-xs text-slate-600">{complaint.adminRemarks}</p>
            </div>
          ) : null}

          {/* Status select */}
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Update Status
            </label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-brand/30"
            >
              {['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map((s) => (
                <option key={s} value={s}>
                  {STATUS_META[s]?.label ?? s}
                </option>
              ))}
            </select>
          </div>

          {/* Admin remarks */}
          <div>
            <label className="mb-1 block text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Admin Remarks
            </label>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              placeholder="Write a note for the complainant…"
              className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-brand/30"
            />
          </div>

          {err ? (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 flex items-center gap-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {err}
            </p>
          ) : null}

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-600 transition hover:border-slate-300"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand py-2.5 text-xs font-bold text-white transition disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function AdminComplaintsPage() {
  const [complaints, setComplaints] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [roleFilter, setRoleFilter] = useState('ALL')
  const [total, setTotal] = useState(0)

  const load = useCallback(async (status = statusFilter, role = roleFilter) => {
    setLoading(true)
    setError('')
    try {
      const res = await adminComplaintsApi.getAllComplaints({ status, role, limit: 50 })
      const data = res.data ?? {}
      setComplaints(data.complaints ?? data.items ?? [])
      setTotal(data.total ?? (data.complaints ?? data.items ?? []).length)
    } catch (e) {
      setError(e?.message || 'Failed to load complaints')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    load(statusFilter, roleFilter)
  }, [statusFilter, roleFilter]) // eslint-disable-line react-hooks/exhaustive-deps

  const countByStatus = {
    OPEN: complaints.filter((c) => c.status === 'OPEN' || !c.status).length,
    IN_PROGRESS: complaints.filter((c) => c.status === 'IN_PROGRESS').length,
    RESOLVED: complaints.filter((c) => c.status === 'RESOLVED').length,
    CLOSED: complaints.filter((c) => c.status === 'CLOSED').length,
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Complaints</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {loading ? 'Loading…' : `${total} complaint${total !== 1 ? 's' : ''} total`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => load(statusFilter, roleFilter)}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand/30 hover:text-brand disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} aria-hidden />
          Refresh
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Object.entries(STATUS_META).map(([key, meta]) => {
          const Icon = meta.icon
          return (
            <GlassPanel
              key={key}
              className={`flex items-center gap-3 p-3.5 cursor-pointer border-2 transition ${
                statusFilter === key ? 'border-brand/40 bg-brand/5' : 'border-transparent hover:border-slate-200'
              }`}
              onClick={() => setStatusFilter(key)}
            >
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${meta.cls}`}>
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <div>
                <p className="text-lg font-black text-slate-900">{statusFilter === 'ALL' ? countByStatus[key] : (statusFilter === key ? complaints.length : '—')}</p>
                <p className="text-[11px] font-semibold text-slate-500">{meta.label}</p>
              </div>
            </GlassPanel>
          )
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 p-1 lg:flex-row lg:items-center">
        <div className="flex flex-1 gap-1">
          <Filter className="my-auto ml-2 mr-1 h-3.5 w-3.5 shrink-0 text-slate-400 hidden sm:block" aria-hidden />
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`flex-1 rounded-xl py-1.5 text-xs font-bold transition ${
                statusFilter === s
                  ? 'bg-white text-brand shadow-sm ring-1 ring-slate-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {s === 'ALL' ? 'Status: All' : (STATUS_META[s]?.label ?? s)}
            </button>
          ))}
        </div>
        
        <div className="hidden h-6 w-px bg-slate-200 lg:block" aria-hidden />
        
        <div className="flex flex-1 gap-1">
          {ROLE_FILTERS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRoleFilter(r)}
              className={`flex-1 rounded-xl py-1.5 text-xs font-bold transition ${
                roleFilter === r
                  ? 'bg-white text-brand shadow-sm ring-1 ring-slate-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {ROLE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error ? (
        <div className="flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {/* Content */}
      {loading ? (
        <div className="flex h-48 items-center justify-center gap-2 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm font-semibold">Loading complaints…</span>
        </div>
      ) : complaints.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 py-16 text-center">
          <MessageSquare className="mb-3 h-10 w-10 text-slate-200" aria-hidden />
          <p className="text-sm font-bold text-slate-500">No complaints found</p>
          <p className="mt-1 text-xs text-slate-400">
            {statusFilter !== 'ALL' ? `No ${STATUS_META[statusFilter]?.label?.toLowerCase() ?? statusFilter} complaints.` : 'All clear!'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {complaints.map((c) => (
            <ComplaintCard key={c._id} complaint={c} onUpdate={() => load(statusFilter, roleFilter)} />
          ))}
        </div>
      )}
    </div>
  )
}
