import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldAlert,
  Clock,
  Ban,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  IndianRupee,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  Save,
  Check,
  X,
  Eye,
  Sliders,
  FileText,
  HelpCircle,
  TrendingDown,
  User,
  Layers,
  Calendar,
  AlertOctagon,
  Percent,
} from 'lucide-react'
import { bookingCancellationApi } from '../../api/bookingCancellationApi.js'
import { ApiError } from '../../api/http.js'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'

function formatInr(val) {
  return `₹${Number(val || 0).toLocaleString('en-IN')}`
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function StatusBadge({ status }) {
  const map = {
    STANDARD: { label: 'Standard (Free)', class: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
    LATE: { label: 'Late Cancellation', class: 'bg-rose-50 text-rose-800 border-rose-200' },
    EXPIRED: { label: 'Expired / Passed', class: 'bg-slate-100 text-slate-700 border-slate-200' },
    PENDING_APPROVAL: { label: 'Pending Approval', class: 'bg-amber-50 text-amber-800 border-amber-200' },
    APPROVED: { label: 'Approved', class: 'bg-blue-50 text-blue-800 border-blue-200' },
    CANCELLED: { label: 'Cancelled', class: 'bg-slate-100 text-slate-800 border-slate-200' },
    REJECTED: { label: 'Rejected', class: 'bg-rose-50 text-rose-700 border-rose-200' },
    RECOVERED: { label: 'Deducted (Recovered)', class: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
    WAIVED: { label: 'Penalty Waived', class: 'bg-teal-50 text-teal-800 border-teal-200' },
    NOT_APPLICABLE: { label: 'No Penalty', class: 'bg-slate-50 text-slate-500 border-slate-200' },
  }
  const s = map[status] || { label: status, class: 'bg-slate-100 text-slate-700 border-slate-200' }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${s.class}`}>
      {s.label}
    </span>
  )
}

export function AdminBookingCancellationPage() {
  const [activeTab, setActiveTab] = useState('records') // 'records' | 'approvals' | 'settings'

  // Overview Stats
  const [stats, setStats] = useState({
    totalRecords: 0,
    standardCount: 0,
    lateCount: 0,
    pendingApprovalCount: 0,
    totalPenaltiesDeducted: 0,
    waivedCount: 0,
  })

  // Records Table State
  const [records, setRecords] = useState([])
  const [loadingRecords, setLoadingRecords] = useState(false)
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, pages: 1 })
  const [timingFilter, setTimingFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [penaltyFilter, setPenaltyFilter] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')

  // Settings State
  const [settings, setSettings] = useState(null)
  const [loadingSettings, setLoadingSettings] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsSuccess, setSettingsSuccess] = useState('')
  const [settingsError, setSettingsError] = useState('')

  // Modal States
  const [selectedRecord, setSelectedRecord] = useState(null)
  const [approvalModal, setApprovalModal] = useState({ open: false, record: null, type: 'APPROVE', notes: '' })
  const [waiveModal, setWaiveModal] = useState({ open: false, record: null, reason: '' })
  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState('')

  // Fetch Stats
  const fetchOverview = useCallback(async () => {
    try {
      const res = await bookingCancellationApi.getAdminOverview()
      if (res.data) setStats(res.data)
    } catch (err) {
      console.error('Failed to load cancellation stats:', err)
    }
  }, [])

  // Fetch Records
  const fetchRecords = useCallback(
    async (page = 1) => {
      setLoadingRecords(true)
      try {
        const res = await bookingCancellationApi.getAdminRecords({
          page,
          limit: pagination.limit,
          timingClassification: timingFilter,
          cancellationStatus: activeTab === 'approvals' ? 'PENDING_APPROVAL' : statusFilter,
          penaltyStatus: penaltyFilter,
          search: searchQuery,
        })
        if (res.data?.records) {
          setRecords(res.data.records)
          setPagination(res.data.pagination)
        }
      } catch (err) {
        console.error('Failed to load cancellation records:', err)
      } finally {
        setLoadingRecords(false)
      }
    },
    [timingFilter, statusFilter, penaltyFilter, searchQuery, activeTab, pagination.limit]
  )

  // Fetch Settings
  const fetchSettings = useCallback(async () => {
    setLoadingSettings(true)
    try {
      const res = await bookingCancellationApi.getAdminSettings()
      if (res.data?.settings) {
        setSettings(res.data.settings)
      }
    } catch (err) {
      console.error('Failed to load cancellation settings:', err)
    } finally {
      setLoadingSettings(false)
    }
  }, [])

  useEffect(() => {
    fetchOverview()
  }, [fetchOverview])

  useEffect(() => {
    if (activeTab === 'records' || activeTab === 'approvals') {
      fetchRecords(1)
    } else if (activeTab === 'settings') {
      fetchSettings()
    }
  }, [activeTab, fetchRecords, fetchSettings])

  // Save Settings
  const handleSaveSettings = async (e) => {
    e.preventDefault()
    if (!settings) return
    setSavingSettings(true)
    setSettingsSuccess('')
    setSettingsError('')

    try {
      const res = await bookingCancellationApi.updateAdminSettings(settings)
      if (res.data?.settings) {
        setSettings(res.data.settings)
        setSettingsSuccess('Cancellation policy & late fee settings saved successfully!')
      }
    } catch (err) {
      setSettingsError(err instanceof ApiError ? err.message : err.message || 'Failed to update settings')
    } finally {
      setSavingSettings(false)
    }
  }

  // Handle Approve / Reject Request
  const handleProcessApproval = async () => {
    if (!approvalModal.record) return
    setActionLoading(true)
    setActionError('')
    try {
      if (approvalModal.type === 'APPROVE') {
        await bookingCancellationApi.approveRequest(approvalModal.record._id, approvalModal.notes)
      } else {
        await bookingCancellationApi.rejectRequest(approvalModal.record._id, approvalModal.notes)
      }
      setApprovalModal({ open: false, record: null, type: 'APPROVE', notes: '' })
      fetchRecords(pagination.page)
      fetchOverview()
    } catch (err) {
      setActionError(err.message || 'Action failed')
    } finally {
      setActionLoading(false)
    }
  }

  // Handle Waive Penalty
  const handleWaivePenalty = async () => {
    if (!waiveModal.record || !waiveModal.reason.trim()) return
    setActionLoading(true)
    setActionError('')
    try {
      await bookingCancellationApi.waivePenalty(waiveModal.record._id, waiveModal.reason.trim())
      setWaiveModal({ open: false, record: null, reason: '' })
      fetchRecords(pagination.page)
      fetchOverview()
    } catch (err) {
      setActionError(err.message || 'Failed to waive penalty')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">
            Booking Cancellation & Late Fee Policy
          </h1>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Configure cutoff hours, automated late penalties, vendor approval workflows, and penalty audit ledger.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              fetchOverview()
              if (activeTab === 'settings') fetchSettings()
              else fetchRecords(pagination.page)
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50 active:scale-95 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingRecords || loadingSettings ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Metrics Ribbon */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <GlassPanel className="p-4 border-slate-200/80">
          <div className="flex items-center gap-2 text-slate-500 text-xs font-bold uppercase tracking-wider">
            <FileText className="h-4 w-4 text-slate-600" />
            Total Cancelled
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900">{stats.totalRecords}</p>
          <p className="mt-0.5 text-[11px] font-medium text-slate-400">All cancellation logs</p>
        </GlassPanel>

        <GlassPanel className="p-4 border-emerald-200/60 bg-emerald-50/20">
          <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold uppercase tracking-wider">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            Standard (Free)
          </div>
          <p className="mt-2 text-2xl font-black text-emerald-700">{stats.standardCount}</p>
          <p className="mt-0.5 text-[11px] font-medium text-slate-500">Cancelled before cutoff</p>
        </GlassPanel>

        <GlassPanel className="p-4 border-rose-200/60 bg-rose-50/20">
          <div className="flex items-center gap-2 text-rose-800 text-xs font-bold uppercase tracking-wider">
            <Clock className="h-4 w-4 text-rose-600" />
            Late Cancellations
          </div>
          <p className="mt-2 text-2xl font-black text-rose-700">{stats.lateCount}</p>
          <p className="mt-0.5 text-[11px] font-medium text-slate-500">Inside cutoff threshold</p>
        </GlassPanel>

        <GlassPanel className="p-4 border-amber-200/60 bg-amber-50/20">
          <div className="flex items-center gap-2 text-amber-800 text-xs font-bold uppercase tracking-wider">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Pending Review
          </div>
          <p className="mt-2 text-2xl font-black text-amber-700">{stats.pendingApprovalCount}</p>
          <p className="mt-0.5 text-[11px] font-medium text-slate-500">Requires admin signoff</p>
        </GlassPanel>

        <GlassPanel className="p-4 border-blue-200/60 bg-blue-50/20">
          <div className="flex items-center gap-2 text-blue-800 text-xs font-bold uppercase tracking-wider">
            <IndianRupee className="h-4 w-4 text-blue-600" />
            Total Deductions
          </div>
          <p className="mt-2 text-2xl font-black text-blue-800">{formatInr(stats.totalPenaltiesDeducted)}</p>
          <p className="mt-0.5 text-[11px] font-medium text-slate-500">Recovered to platform</p>
        </GlassPanel>

        <GlassPanel className="p-4 border-teal-200/60 bg-teal-50/20">
          <div className="flex items-center gap-2 text-teal-800 text-xs font-bold uppercase tracking-wider">
            <RotateCcw className="h-4 w-4 text-teal-600" />
            Penalties Waived
          </div>
          <p className="mt-2 text-2xl font-black text-teal-700">{stats.waivedCount}</p>
          <p className="mt-0.5 text-[11px] font-medium text-slate-500">Waived & refunded</p>
        </GlassPanel>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('records')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
            activeTab === 'records'
              ? 'bg-brand text-white shadow-md shadow-brand/20'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileText className="h-4 w-4" />
          All Cancellation Records
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('approvals')}
          className={`relative flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
            activeTab === 'approvals'
              ? 'bg-brand text-white shadow-md shadow-brand/20'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <AlertTriangle className="h-4 w-4" />
          Pending Approvals Queue
          {stats.pendingApprovalCount > 0 && (
            <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white">
              {stats.pendingApprovalCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
            activeTab === 'settings'
              ? 'bg-brand text-white shadow-md shadow-brand/20'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Sliders className="h-4 w-4" />
          Policy & Cutoff Rules
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1 & 2: RECORDS & APPROVALS QUEUE */}
      {/* ======================================================== */}
      {(activeTab === 'records' || activeTab === 'approvals') && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <GlassPanel className="p-4 border-slate-200/80">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search Booking or Reason..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs font-semibold text-slate-800 placeholder-slate-400 outline-hidden focus:border-brand focus:ring-1 focus:ring-brand"
                />
              </div>

              <div>
                <select
                  value={timingFilter}
                  onChange={(e) => setTimingFilter(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-hidden focus:border-brand"
                >
                  <option value="ALL">Timing: All Classifications</option>
                  <option value="STANDARD">Standard (Before Cutoff)</option>
                  <option value="LATE">Late Cancellation</option>
                  <option value="EXPIRED">Expired / Passed Start</option>
                </select>
              </div>

              {activeTab === 'records' && (
                <div>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-hidden focus:border-brand"
                  >
                    <option value="ALL">Status: All</option>
                    <option value="CANCELLED">Cancelled</option>
                    <option value="PENDING_APPROVAL">Pending Approval</option>
                    <option value="APPROVED">Approved by Admin</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>
              )}

              <div>
                <select
                  value={penaltyFilter}
                  onChange={(e) => setPenaltyFilter(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-hidden focus:border-brand"
                >
                  <option value="ALL">Penalty: All</option>
                  <option value="RECOVERED">Deducted (Recovered)</option>
                  <option value="WAIVED">Waived</option>
                  <option value="NOT_APPLICABLE">No Penalty (₹0)</option>
                  <option value="PENDING">Pending Deduction</option>
                </select>
              </div>
            </div>
          </GlassPanel>

          {/* Table */}
          <GlassPanel className="overflow-hidden border-slate-200/80 p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">Booking / Date</th>
                    <th className="py-3 px-4">Vendor</th>
                    <th className="py-3 px-4">Timing Class</th>
                    <th className="py-3 px-4">Reason</th>
                    <th className="py-3 px-4">Penalty Amount</th>
                    <th className="py-3 px-4">Approval Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {loadingRecords ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        <Loader2 className="mx-auto h-6 w-6 animate-spin text-brand mb-2" />
                        Loading cancellation records...
                      </td>
                    </tr>
                  ) : records.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        No cancellation records matching the selected filters.
                      </td>
                    </tr>
                  ) : (
                    records.map((r) => {
                      const shortCode = String(r.bookingId?._id || r.bookingId).slice(-6).toUpperCase()
                      const vendorName = r.vendorId?.fullName || r.vendorId?.name || 'Assigned Partner'
                      const isPendingApproval = r.approvalStatus === 'PENDING'
                      const isRecovered = r.penaltyStatus === 'RECOVERED'

                      return (
                        <tr key={r._id} className="hover:bg-slate-50/50 transition">
                          <td className="py-3.5 px-4">
                            <div className="font-extrabold text-slate-900">#{shortCode}</div>
                            <div className="text-[11px] text-slate-400">
                              Service: {formatDate(r.serviceStartDateTime)}
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-800 flex items-center gap-1.5">
                              <User className="h-3.5 w-3.5 text-slate-400" />
                              {vendorName}
                            </div>
                            <div className="text-[10px] text-slate-400">{r.vendorId?.phone || ''}</div>
                          </td>

                          <td className="py-3.5 px-4">
                            <StatusBadge status={r.timingClassification} />
                            <div className="mt-0.5 text-[10px] text-slate-400">
                              {r.timeRemainingMinutes > 0
                                ? `${Math.floor(r.timeRemainingMinutes / 60)}h ${r.timeRemainingMinutes % 60}m remaining`
                                : 'Passed start time'}
                            </div>
                          </td>

                          <td className="py-3.5 px-4 max-w-xs">
                            <p className="line-clamp-2 font-medium text-slate-800" title={r.reason}>
                              {r.reason}
                            </p>
                            <span className="text-[10px] text-slate-400">
                              {formatDate(r.requestedAt)}
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="font-extrabold text-slate-900">
                              {formatInr(r.deductedAmount || r.assessedPenaltyAmount)}
                            </div>
                            <StatusBadge status={r.penaltyStatus} />
                          </td>

                          <td className="py-3.5 px-4">
                            <StatusBadge status={r.approvalStatus === 'PENDING' ? 'PENDING_APPROVAL' : r.cancellationStatus} />
                          </td>

                          <td className="py-3.5 px-4 text-right space-x-1">
                            {isPendingApproval ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setApprovalModal({
                                      open: true,
                                      record: r,
                                      type: 'APPROVE',
                                      notes: 'Approved with applicable penalty',
                                    })
                                  }
                                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-extrabold text-white hover:bg-emerald-700 shadow-xs active:scale-95"
                                >
                                  <Check className="h-3 w-3" />
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setApprovalModal({
                                      open: true,
                                      record: r,
                                      type: 'REJECT',
                                      notes: 'Please proceed with service assignment',
                                    })
                                  }
                                  className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1.5 text-[11px] font-extrabold text-white hover:bg-rose-700 shadow-xs active:scale-95"
                                >
                                  <X className="h-3 w-3" />
                                  Reject
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setSelectedRecord(r)}
                                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                                >
                                  <Eye className="h-3 w-3" />
                                  Details
                                </button>

                                {isRecovered && (
                                  <button
                                    type="button"
                                    onClick={() => setWaiveModal({ open: true, record: r, reason: '' })}
                                    className="inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-700 hover:bg-teal-100"
                                  >
                                    <RotateCcw className="h-3 w-3" />
                                    Waive
                                  </button>
                                )}
                              </>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs font-semibold text-slate-500">
                <span>
                  Showing page {pagination.page} of {pagination.pages} ({pagination.total} records)
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={pagination.page <= 1}
                    onClick={() => fetchRecords(pagination.page - 1)}
                    className="rounded-lg border border-slate-200 px-2.5 py-1 disabled:opacity-40 hover:bg-slate-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={pagination.page >= pagination.pages}
                    onClick={() => fetchRecords(pagination.page + 1)}
                    className="rounded-lg border border-slate-200 px-2.5 py-1 disabled:opacity-40 hover:bg-slate-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </GlassPanel>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: POLICY & CUTOFF SETTINGS */}
      {/* ======================================================== */}
      {activeTab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="space-y-6 max-w-4xl">
          {settingsSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 rounded-2xl bg-emerald-50 border border-emerald-200 p-4 text-sm font-bold text-emerald-800"
            >
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              {settingsSuccess}
            </motion.div>
          )}

          {settingsError && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 rounded-2xl bg-rose-50 border border-rose-200 p-4 text-sm font-bold text-rose-800"
            >
              <AlertTriangle className="h-5 w-5 shrink-0" />
              {settingsError}
            </motion.div>
          )}

          {loadingSettings || !settings ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-brand" />
            </div>
          ) : (
            <>
              {/* Master Policy Switch */}
              <GlassPanel className="p-6 border-slate-200/80 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      Cancellation Policy & Penalty Engine
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      When enabled, partner cancellations within cutoff will trigger late fee assessment or approval.
                    </p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={settings.enabled}
                      onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                      className="peer sr-only"
                    />
                    <div className="h-6 w-11 rounded-full bg-slate-200 peer-checked:bg-emerald-600 peer-focus:outline-hidden after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full" />
                  </label>
                </div>
              </GlassPanel>

              {/* Cutoff & Penalty Configuration */}
              <GlassPanel className="p-6 border-slate-200/80 space-y-6">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Cutoff & Penalty Calculation Rules
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Define the advance window for free cancellation and the penalty applied for late cancellations.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  {/* Cutoff Hours */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Cancellation Cutoff (Hours before Service)
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        value={settings.cutoffHours}
                        onChange={(e) =>
                          setSettings({ ...settings, cutoffHours: Number(e.target.value) })
                        }
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 outline-hidden focus:border-brand"
                      />
                      <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">
                        Hours
                      </span>
                    </div>
                    <p className="text-[11px] font-medium text-slate-400 mt-1">
                      Default: 2 Hours. Cancellations &gt;= this cutoff incur ₹0 penalty.
                    </p>
                  </div>

                  {/* Penalty Type */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Penalty Calculation Model
                    </label>
                    <select
                      value={settings.penaltyType}
                      onChange={(e) =>
                        setSettings({ ...settings, penaltyType: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 outline-hidden focus:border-brand"
                    >
                      <option value="FIXED">Fixed Amount (₹)</option>
                      <option value="PERCENTAGE">Percentage of Booking Value (%)</option>
                    </select>
                    <p className="text-[11px] font-medium text-slate-400 mt-1">
                      Choose whether late fee is a flat charge or proportional to service value.
                    </p>
                  </div>

                  {/* Fixed Amount vs Percentage Rate */}
                  {settings.penaltyType === 'FIXED' ? (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Fixed Late Penalty Amount (₹)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-sm font-bold text-slate-400">₹</span>
                        <input
                          type="number"
                          min="0"
                          value={settings.fixedPenaltyAmount}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              fixedPenaltyAmount: Number(e.target.value),
                            })
                          }
                          className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-2.5 text-sm font-bold text-slate-800 outline-hidden focus:border-brand"
                        />
                      </div>
                      <p className="text-[11px] font-medium text-slate-400 mt-1">
                        Default: ₹200. Deducted from vendor wallet upon late cancellation.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-bold text-slate-700 mb-1.5">
                        Percentage Penalty Rate (%)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={settings.percentagePenaltyRate}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              percentagePenaltyRate: Number(e.target.value),
                            })
                          }
                          className="w-full rounded-xl border border-slate-200 bg-white pr-8 pl-3 py-2.5 text-sm font-bold text-slate-800 outline-hidden focus:border-brand"
                        />
                        <span className="absolute right-3 top-2.5 text-sm font-bold text-slate-400">%</span>
                      </div>
                      <p className="text-[11px] font-medium text-slate-400 mt-1">
                        Calculated against partner share / booking total (0–100%).
                      </p>
                    </div>
                  )}

                  {/* Late Cancellation Action */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Late Cancellation Action (&lt; Cutoff)
                    </label>
                    <select
                      value={settings.lateCancellationAction}
                      onChange={(e) =>
                        setSettings({ ...settings, lateCancellationAction: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 outline-hidden focus:border-brand"
                    >
                      <option value="PENALIZE">Allow Cancellation & Apply Penalty (Default)</option>
                      <option value="REQUIRE_APPROVAL">Require Admin Approval before Cancelling</option>
                      <option value="BLOCK">Block Late Cancellation Completely</option>
                    </select>
                    <p className="text-[11px] font-medium text-slate-400 mt-1">
                      Action executed when vendor cancels inside the {settings.cutoffHours}h cutoff.
                    </p>
                  </div>
                </div>
              </GlassPanel>

              {/* Standard Reasons Taxonomy */}
              <GlassPanel className="p-6 border-slate-200/80 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      Cancellation Reason Requirement
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Require partner to submit a categorized reason before cancelling.
                    </p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={settings.requireReason}
                      onChange={(e) =>
                        setSettings({ ...settings, requireReason: e.target.checked })
                      }
                      className="peer sr-only"
                    />
                    <div className="h-6 w-11 rounded-full bg-slate-200 peer-checked:bg-emerald-600 peer-focus:outline-hidden after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full" />
                  </label>
                </div>
              </GlassPanel>

              {/* Save Button */}
              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={savingSettings}
                  className="flex items-center gap-2 rounded-2xl bg-gradient-to-r from-brand to-blue-800 px-8 py-3.5 text-sm font-black text-white shadow-lg shadow-brand/25 transition hover:opacity-95 active:scale-98 disabled:opacity-50"
                >
                  {savingSettings ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Cancellation Policy
                </button>
              </div>
            </>
          )}
        </form>
      )}

      {/* ======================================================== */}
      {/* MODAL: APPROVE / REJECT LATE CANCELLATION REQUEST */}
      {/* ======================================================== */}
      {approvalModal.open && approvalModal.record && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-extrabold text-base">
                {approvalModal.type === 'APPROVE' ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : (
                  <XCircle className="h-5 w-5 text-rose-600" />
                )}
                {approvalModal.type === 'APPROVE'
                  ? 'Approve Late Cancellation'
                  : 'Reject Cancellation Request'}
              </div>
              <button
                type="button"
                onClick={() => setApprovalModal({ open: false, record: null, type: 'APPROVE', notes: '' })}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-2xl bg-slate-50 p-3.5 text-xs text-slate-600 space-y-1.5 border border-slate-200/70">
              <p>
                <b>Booking ID:</b> #{String(approvalModal.record.bookingId?._id || approvalModal.record.bookingId).slice(-6).toUpperCase()}
              </p>
              <p>
                <b>Partner:</b> {approvalModal.record.vendorId?.fullName || approvalModal.record.vendorId?.name || 'Partner'}
              </p>
              <p>
                <b>Reason:</b> {approvalModal.record.reason}
              </p>
              <p>
                <b>Assessed Penalty:</b> {formatInr(approvalModal.record.assessedPenaltyAmount)}
              </p>
            </div>

            {actionError && (
              <p className="text-xs font-bold text-rose-600">{actionError}</p>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Admin Notes / Feedback to Vendor
              </label>
              <textarea
                rows={3}
                value={approvalModal.notes}
                onChange={(e) => setApprovalModal({ ...approvalModal, notes: e.target.value })}
                placeholder="Enter notes..."
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-medium text-slate-800 outline-hidden focus:border-brand"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setApprovalModal({ open: false, record: null, type: 'APPROVE', notes: '' })}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading}
                onClick={handleProcessApproval}
                className={`flex items-center gap-1.5 rounded-xl px-5 py-2 text-xs font-extrabold text-white shadow-sm transition active:scale-95 ${
                  approvalModal.type === 'APPROVE' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirm {approvalModal.type === 'APPROVE' ? 'Approval' : 'Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: WAIVE PENALTY */}
      {/* ======================================================== */}
      {waiveModal.open && waiveModal.record && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-extrabold text-base">
                <RotateCcw className="h-5 w-5 text-teal-600" />
                Waive & Refund Late Penalty
              </div>
              <button
                type="button"
                onClick={() => setWaiveModal({ open: false, record: null, reason: '' })}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Waiving this penalty will create a compensating <b>CREDIT</b> transaction of{' '}
              <b>{formatInr(waiveModal.record.deductedAmount)}</b> to the partner wallet and update the record status to <b>WAIVED</b>.
            </p>

            {actionError && (
              <p className="text-xs font-bold text-rose-600">{actionError}</p>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mandatory Waiver Reason *
              </label>
              <textarea
                rows={3}
                value={waiveModal.reason}
                onChange={(e) => setWaiveModal({ ...waiveModal, reason: e.target.value })}
                placeholder="e.g. Verified customer emergency or authorized platform waiver..."
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-medium text-slate-800 outline-hidden focus:border-brand"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setWaiveModal({ open: false, record: null, reason: '' })}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={actionLoading || !waiveModal.reason.trim()}
                onClick={handleWaivePenalty}
                className="flex items-center gap-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 px-5 py-2 text-xs font-extrabold text-white shadow-sm transition active:scale-95 disabled:opacity-50"
              >
                {actionLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Confirm Waiver & Refund
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: RECORD DETAILS */}
      {/* ======================================================== */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-extrabold text-slate-900">
                Cancellation Log #{String(selectedRecord.bookingId?._id || selectedRecord.bookingId).slice(-6).toUpperCase()}
              </h3>
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs text-slate-600">
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                <span className="font-bold text-slate-400 block mb-0.5">Timing Classification</span>
                <StatusBadge status={selectedRecord.timingClassification} />
              </div>
              <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                <span className="font-bold text-slate-400 block mb-0.5">Penalty Status</span>
                <StatusBadge status={selectedRecord.penaltyStatus} />
              </div>
            </div>

            <div className="space-y-2 text-xs text-slate-700">
              <p><b>Service Start:</b> {formatDate(selectedRecord.serviceStartDateTime)}</p>
              <p><b>Requested At:</b> {formatDate(selectedRecord.requestedAt)}</p>
              <p><b>Time Remaining When Cancelled:</b> {selectedRecord.timeRemainingMinutes} minutes ({Number((selectedRecord.timeRemainingMinutes / 60).toFixed(1))}h)</p>
              <p><b>Policy Cutoff at Assessment:</b> {selectedRecord.cutoffHoursSnapshot} hours</p>
              <p><b>Partner:</b> {selectedRecord.vendorId?.fullName || selectedRecord.vendorId?.name || '—'} ({selectedRecord.vendorId?.phone || '—'})</p>
              <p><b>Reason:</b> {selectedRecord.reason}</p>
              {selectedRecord.adminNotes && <p><b>Admin Notes:</b> {selectedRecord.adminNotes}</p>}
              {selectedRecord.waiverReason && (
                <p className="text-teal-700"><b>Waiver Reason:</b> {selectedRecord.waiverReason} ({formatDate(selectedRecord.waivedAt)})</p>
              )}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSelectedRecord(null)}
                className="rounded-xl bg-slate-100 px-5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminBookingCancellationPage
