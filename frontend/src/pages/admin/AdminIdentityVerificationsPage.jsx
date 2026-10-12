import { useCallback, useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  FileText,
  Filter,
  History,
  IdCard,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserX,
  X,
  ExternalLink,
} from 'lucide-react'
import {
  fetchAdminVerificationById,
  fetchAdminVerifications,
  restoreAdminUser,
  reviewAdminVerification,
  suspendAdminUser,
} from '../../api/identityVerificationApi.js'
import { ApiError } from '../../api/http.js'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { AppPrimaryButton } from '../../components/app/AppPrimaryButton.jsx'

const STATUS_TABS = [
  { key: 'all', label: 'All Submissions' },
  { key: 'PENDING_IDENTITY_VERIFICATION', label: 'Pending Review' },
  { key: 'MANUAL_REVIEW', label: 'Needs Review / Mismatch' },
  { key: 'VERIFIED', label: 'Verified' },
  { key: 'REJECTED', label: 'Rejected' },
  { key: 'SUSPENDED', label: 'Suspended' },
]

function StatusBadge({ status }) {
  const map = {
    UNVERIFIED: { bg: 'bg-slate-100 text-slate-700 ring-slate-200', label: 'Unverified' },
    CONTACT_VERIFIED: { bg: 'bg-blue-50 text-blue-700 ring-blue-200', label: 'Phone Verified' },
    PENDING_IDENTITY_VERIFICATION: { bg: 'bg-sky-50 text-sky-700 ring-sky-200', label: 'Pending Review' },
    MANUAL_REVIEW: { bg: 'bg-amber-50 text-amber-700 ring-amber-200', label: 'Manual Review' },
    VERIFIED: { bg: 'bg-emerald-50 text-emerald-700 ring-emerald-200', label: 'Verified' },
    REJECTED: { bg: 'bg-rose-50 text-rose-700 ring-rose-200', label: 'Rejected' },
    SUSPENDED: { bg: 'bg-purple-50 text-purple-700 ring-purple-200', label: 'Suspended' },
  }
  const item = map[status] || map.UNVERIFIED
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ring-1 ${item.bg}`}>
      {status === 'VERIFIED' ? <ShieldCheck className="h-3.5 w-3.5" /> : null}
      {status === 'MANUAL_REVIEW' ? <AlertTriangle className="h-3.5 w-3.5" /> : null}
      {status === 'SUSPENDED' ? <ShieldAlert className="h-3.5 w-3.5" /> : null}
      {item.label}
    </span>
  )
}

function ConfidenceBadge({ confidence, score }) {
  if (score == null) return <span className="text-xs text-slate-400">—</span>
  const isHigh = score >= 80
  const isMed = score >= 50 && score < 80
  const color = isHigh
    ? 'text-emerald-700 bg-emerald-50 ring-emerald-200'
    : isMed
      ? 'text-amber-700 bg-amber-50 ring-amber-200'
      : 'text-rose-700 bg-rose-50 ring-rose-200'

  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ${color}`}>
      <span>{score}% match</span>
      <span className="text-[10px] uppercase opacity-75">({confidence})</span>
    </span>
  )
}

export function AdminIdentityVerificationsPage() {
  const reduce = useReducedMotion()
  const [activeTab, setActiveTab] = useState('all')
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [page, setPage] = useState(1)
  const limit = 15

  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [pages, setPages] = useState(1)
  const [counts, setCounts] = useState({ pending: 0, manualReview: 0, verified: 0, rejected: 0, suspended: 0, total: 0 })
  const [error, setError] = useState(null)

  // Review & Detail Modal state
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [auditLogs, setAuditLogs] = useState([])
  const [modalLoading, setModalLoading] = useState(false)
  const [decisionReason, setDecisionReason] = useState('')
  const [verifiedNameInput, setVerifiedNameInput] = useState('')
  const [actionBusy, setActionBusy] = useState(false)
  const [actionSuccess, setActionSuccess] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAdminVerifications({
        status: activeTab,
        role: roleFilter,
        search,
        page,
        limit,
      })
      setItems(data?.items || [])
      setTotal(data?.total || 0)
      setPages(data?.pages || 1)
      if (data?.counts) setCounts(data.counts)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not load verification records')
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [activeTab, roleFilter, search, page, limit])

  useEffect(() => {
    loadData()
  }, [loadData])

  async function openDetailModal(item) {
    setSelectedRecord(item)
    setVerifiedNameInput(item.verifiedLegalName || item.submittedName || '')
    setDecisionReason('')
    setActionSuccess('')
    setModalLoading(true)
    try {
      const res = await fetchAdminVerificationById(item._id)
      if (res?.verification) setSelectedRecord(res.verification)
      if (res?.auditLogs) setAuditLogs(res.auditLogs)
    } catch (err) {
      console.error(err)
    } finally {
      setModalLoading(false)
    }
  }

  async function handleDecision(decision) {
    if (!selectedRecord) return
    if ((decision === 'reject' || decision === 'request_correction') && !decisionReason.trim()) {
      alert('Please specify a reason for rejection or correction request.')
      return
    }

    setActionBusy(true)
    try {
      await reviewAdminVerification(selectedRecord._id, {
        decision,
        reason: decisionReason.trim(),
        verifiedLegalName: verifiedNameInput.trim() || undefined,
      })
      setActionSuccess(`Successfully updated verification decision to: ${decision}`)
      await loadData()
      setTimeout(() => setSelectedRecord(null), 1200)
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Action failed')
    } finally {
      setActionBusy(false)
    }
  }

  async function handleSuspend() {
    if (!selectedRecord) return
    const reason = prompt('Please enter the reason for account suspension:')
    if (!reason?.trim()) return

    setActionBusy(true)
    try {
      await suspendAdminUser(selectedRecord._id, { reason: reason.trim() })
      alert('Account suspended successfully.')
      await loadData()
      setSelectedRecord(null)
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Suspension failed')
    } finally {
      setActionBusy(false)
    }
  }

  async function handleRestore() {
    if (!selectedRecord) return
    const reason = prompt('Please enter the reason for restoring this account:')
    if (!reason?.trim()) return

    setActionBusy(true)
    try {
      await restoreAdminUser(selectedRecord._id, { reason: reason.trim() })
      alert('Account restored successfully.')
      await loadData()
      setSelectedRecord(null)
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Restore failed')
    } finally {
      setActionBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-12">
      {/* Header */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <div className="flex items-center gap-2 text-brand">
            <Shield className="h-6 w-6" />
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Security & Compliance</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight sm:text-3xl">
            Identity Verification & Anti-Impersonation
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Verify legitimate identities, review name discrepancies, and prevent unauthorized impersonation.
          </p>
        </div>
        <button
          type="button"
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 shadow-sm hover:bg-slate-50 active:scale-95 transition"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-brand' : ''}`} />
          Refresh Queue
        </button>
      </motion.div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Submissions</span>
          <p className="mt-1 text-2xl font-black text-slate-900">{counts.total}</p>
        </div>
        <div className="rounded-2xl border border-sky-100 bg-sky-50/60 p-4 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-sky-800">Pending Review</span>
          <p className="mt-1 text-2xl font-black text-sky-950">{counts.pending}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800">Needs Review</span>
          <p className="mt-1 text-2xl font-black text-amber-950">{counts.manualReview}</p>
        </div>
        <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">Verified</span>
          <p className="mt-1 text-2xl font-black text-emerald-950">{counts.verified}</p>
        </div>
        <div className="rounded-2xl border border-rose-100 bg-rose-50/60 p-4 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-rose-800">Rejected</span>
          <p className="mt-1 text-2xl font-black text-rose-950">{counts.rejected}</p>
        </div>
        <div className="rounded-2xl border border-purple-100 bg-purple-50/60 p-4 shadow-xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-purple-800">Suspended</span>
          <p className="mt-1 text-2xl font-black text-purple-950">{counts.suspended}</p>
        </div>
      </div>

      {/* Tabs and Filters */}
      <GlassPanel className="p-4 space-y-4">
        {/* Status Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setActiveTab(tab.key)
                setPage(1)
              }}
              className={`shrink-0 rounded-xl px-4 py-2 text-xs font-bold transition ${
                activeTab === tab.key
                  ? 'bg-brand text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search & Role Filter Bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by submitted name, legal name, or document number…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-4 text-xs font-medium text-slate-800 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10 placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase text-slate-400">Role:</span>
            <select
              value={roleFilter}
              onChange={(e) => {
                setRoleFilter(e.target.value)
                setPage(1)
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-brand/40"
            >
              <option value="all">All Roles</option>
              <option value="customer">Customers</option>
              <option value="labour">Labour / Workers</option>
              <option value="contractor">Contractors</option>
            </select>
          </div>
        </div>
      </GlassPanel>

      {/* Main Table */}
      <GlassPanel className="overflow-hidden p-0 border border-slate-200/80">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <RefreshCw className="h-8 w-8 animate-spin text-brand" />
            <p className="mt-3 text-sm font-semibold">Loading identity verification records…</p>
          </div>
        ) : error ? (
          <div className="py-16 text-center text-rose-600">
            <AlertTriangle className="mx-auto h-8 w-8" />
            <p className="mt-2 text-sm font-bold">{error}</p>
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Shield className="h-10 w-10 stroke-1 text-slate-300" />
            <p className="mt-3 text-sm font-bold text-slate-600">No records found matching criteria</p>
            <p className="text-xs text-slate-400">Try adjusting your status tab or search filter</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50/75 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-5 py-3.5">User Details</th>
                  <th className="px-4 py-3.5">Role</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Name Comparison</th>
                  <th className="px-4 py-3.5">Document / Masked ID</th>
                  <th className="px-4 py-3.5">Submitted</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item._id} className="hover:bg-slate-50/60 transition">
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-slate-900 text-sm">{item.submittedName}</div>
                      {item.verifiedLegalName ? (
                        <div className="text-[11px] text-emerald-700 font-medium flex items-center gap-1">
                          <span>Legal: {item.verifiedLegalName}</span>
                        </div>
                      ) : null}
                      <div className="text-[11px] text-slate-400 tabular-nums">
                        {item.userId?.phone ? `+91 ${item.userId.phone}` : item.userId?.email || '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="capitalize font-semibold text-slate-700 bg-slate-100 rounded-md px-2 py-0.5">
                        {item.role}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3.5">
                      <ConfidenceBadge confidence={item.nameMatchConfidence} score={item.nameMatchScore} />
                      {item.riskFlags?.length > 0 ? (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {item.riskFlags.map((flag, idx) => (
                            <span key={idx} className="rounded bg-rose-50 px-1.5 py-0.2 text-[9px] font-bold text-rose-700">
                              {flag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="font-mono font-medium text-slate-700 uppercase">{item.documentType}</span>
                      <div className="text-[11px] font-mono text-slate-500 tabular-nums">
                        {item.documentNumberMasked || 'No masked ID'}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-slate-500">
                      {item.submittedAt ? new Date(item.submittedAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => openDetailModal(item)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-brand hover:bg-brand/5 shadow-xs transition"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Review
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {pages > 1 ? (
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 px-5 py-3 text-xs font-semibold text-slate-600">
            <span>
              Showing {items.length} of {total} records (Page {page} of {pages})
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-slate-200 bg-white p-1.5 hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={page >= pages}
                onClick={() => setPage((p) => Math.min(pages, p + 1))}
                className="rounded-lg border border-slate-200 bg-white p-1.5 hover:bg-slate-100 disabled:opacity-40"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}
      </GlassPanel>

      {/* Review Modal */}
      {selectedRecord ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-3xl bg-white shadow-2xl p-6 space-y-6 my-8 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Review Identity</span>
                <h2 className="text-xl font-black text-slate-900">{selectedRecord.submittedName}</h2>
                <div className="mt-1 flex items-center gap-2">
                  <StatusBadge status={selectedRecord.status} />
                  <span className="text-xs font-semibold text-slate-500 capitalize">• {selectedRecord.role}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="rounded-full p-2 text-slate-400 hover:bg-slate-100 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {actionSuccess ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-bold text-emerald-800">
                {actionSuccess}
              </div>
            ) : null}

            {/* Comparison Grid */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Submitted Display Name</span>
                <p className="mt-1 text-base font-bold text-slate-900">{selectedRecord.submittedName}</p>
                <span className="text-[11px] text-slate-400">Normalized: {selectedRecord.normalizedName || '—'}</span>
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Verified Legal Name</span>
                <input
                  type="text"
                  value={verifiedNameInput}
                  onChange={(e) => setVerifiedNameInput(e.target.value)}
                  placeholder="Enter exact name as per ID document"
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-900 outline-none focus:border-brand/40"
                />
                <span className="text-[10px] text-slate-400">Admin can edit/confirm verified official name</span>
              </div>
            </div>

            {/* Match Analysis */}
            <div className="rounded-2xl border border-slate-200 p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Similarity Match Confidence</span>
                <ConfidenceBadge confidence={selectedRecord.nameMatchConfidence} score={selectedRecord.nameMatchScore} />
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div
                  className={`h-full ${
                    selectedRecord.nameMatchScore >= 80
                      ? 'bg-emerald-500'
                      : selectedRecord.nameMatchScore >= 50
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                  }`}
                  style={{ width: `${selectedRecord.nameMatchScore || 0}%` }}
                />
              </div>
              {selectedRecord.riskFlags?.length > 0 ? (
                <div className="mt-2 text-xs">
                  <span className="font-bold text-rose-800">Flagged Signals: </span>
                  <span className="text-slate-600">{selectedRecord.riskFlags.join(', ')}</span>
                </div>
              ) : null}
            </div>

            {/* Document Evidence */}
            {selectedRecord.documentUrls?.length > 0 ? (
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700">Uploaded Verification Evidence</span>
                <div className="grid grid-cols-2 gap-2">
                  {selectedRecord.documentUrls.map((url, idx) => (
                    <a
                      key={idx}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-semibold text-brand hover:bg-slate-100 transition"
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span>View Document #{idx + 1}</span>
                    </a>
                  ))}
                </div>
              </div>
            ) : null}

            {/* Notes / Reason Input */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Admin Review Notes / Rejection Reason
              </label>
              <textarea
                rows={3}
                value={decisionReason}
                onChange={(e) => setDecisionReason(e.target.value)}
                placeholder="Specify clear review reason (required for rejections or corrections)…"
                className="w-full rounded-2xl border border-slate-200 p-3 text-xs font-medium text-slate-800 outline-none focus:border-brand/40 focus:ring-2 focus:ring-brand/10"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => handleDecision('approve')}
                className="flex-1 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white hover:bg-emerald-700 active:scale-95 transition shadow-sm"
              >
                Approve Identity
              </button>
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => handleDecision('request_correction')}
                className="flex-1 rounded-xl bg-amber-500 py-3 text-xs font-bold text-white hover:bg-amber-600 active:scale-95 transition shadow-sm"
              >
                Request Correction
              </button>
              <button
                type="button"
                disabled={actionBusy}
                onClick={() => handleDecision('reject')}
                className="flex-1 rounded-xl bg-rose-600 py-3 text-xs font-bold text-white hover:bg-rose-700 active:scale-95 transition shadow-sm"
              >
                Reject
              </button>
            </div>

            {/* Security Suspend / Restore */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-[11px] font-bold text-slate-400">Impersonation / Fraud Safeguards:</span>
              <div className="flex gap-2">
                {selectedRecord.status !== 'SUSPENDED' ? (
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={handleSuspend}
                    className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50"
                  >
                    Suspend Account
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={actionBusy}
                    onClick={handleRestore}
                    className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50"
                  >
                    Restore Account
                  </button>
                )}
              </div>
            </div>

            {/* Audit History Timeline */}
            {auditLogs.length > 0 ? (
              <div className="border-t border-slate-100 pt-4 space-y-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <History className="h-4 w-4 text-slate-400" />
                  Audit Trail
                </span>
                <div className="max-h-36 overflow-y-auto space-y-2 pr-1">
                  {auditLogs.map((log) => (
                    <div key={log._id} className="rounded-xl border border-slate-100 bg-slate-50/60 p-2.5 text-[11px]">
                      <div className="flex items-center justify-between font-bold text-slate-800">
                        <span>{log.action}</span>
                        <span className="text-[10px] text-slate-400 font-normal">
                          {new Date(log.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="mt-0.5 text-slate-600">{log.reason || 'No recorded note'}</p>
                      <span className="text-[10px] text-slate-400">
                        Actor: {log.performedBy?.fullName || log.performedBy?.email || log.actorRole}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
