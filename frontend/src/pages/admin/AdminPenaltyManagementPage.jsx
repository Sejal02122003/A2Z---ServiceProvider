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
} from 'lucide-react'
import { penaltyApi } from '../../api/penaltyApi.js'
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
    DETECTED: { label: 'Detected', class: 'bg-slate-100 text-slate-700 border-slate-200' },
    PENDING_REVIEW: { label: 'Pending Review', class: 'bg-amber-50 text-amber-800 border-amber-200' },
    APPROVED: { label: 'Approved', class: 'bg-blue-50 text-blue-800 border-blue-200' },
    APPLIED: { label: 'Applied (Deducted)', class: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
    DISPUTED: { label: 'Disputed', class: 'bg-purple-50 text-purple-800 border-purple-200' },
    WAIVED: { label: 'Waived', class: 'bg-teal-50 text-teal-800 border-teal-200' },
    REJECTED: { label: 'Rejected', class: 'bg-slate-100 text-slate-500 border-slate-200' },
    REVERSED: { label: 'Reversed (Refunded)', class: 'bg-rose-50 text-rose-800 border-rose-200' },
  }
  const s = map[status] || { label: status, class: 'bg-slate-100 text-slate-700 border-slate-200' }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${s.class}`}>
      {s.label}
    </span>
  )
}

export function AdminPenaltyManagementPage() {
  const [activeTab, setActiveTab] = useState('incidents') // 'incidents' | 'disputes' | 'settings'
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [penalties, setPenalties] = useState([])
  const [pagination, setPagination] = useState({ page: 1, limit: 15, totalPages: 1, totalCount: 0 })
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [toast, setToast] = useState({ message: '', variant: 'success' })

  // Modals & Action States
  const [detailModalItem, setDetailModalItem] = useState(null)
  const [actionModal, setActionModal] = useState(null) // { type: 'APPROVE'|'WAIVE'|'REVERSE'|'REVIEW_DISPUTE', item: penalty }
  const [actionInput, setActionInput] = useState({ reason: '', decision: 'ACCEPT', notes: '' })
  const [submittingAction, setSubmittingAction] = useState(false)

  // Settings State
  const [settingsForm, setSettingsForm] = useState(null)
  const [savingSettings, setSavingSettings] = useState(false)

  const showToast = (message, variant = 'success') => {
    setToast({ message, variant })
    setTimeout(() => setToast({ message: '', variant: 'success' }), 4000)
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [overviewRes, listRes, settingsRes] = await Promise.all([
        penaltyApi.getAdminOverview().catch(() => ({ data: null })),
        penaltyApi.getAdminPenalties({
          status: activeTab === 'disputes' ? 'DISPUTED' : statusFilter,
          penaltyType: typeFilter,
          search: searchQuery,
          page: pagination.page,
          limit: pagination.limit,
        }).catch(() => ({ data: { penalties: [], pagination: {} } })),
        penaltyApi.getAdminSettings().catch(() => ({ data: { settings: {} } })),
      ])

      if (overviewRes.data) setStats(overviewRes.data)
      setPenalties(listRes.data?.penalties || [])
      setPagination(listRes.data?.pagination || { page: 1, limit: 15, totalPages: 1, totalCount: 0 })
      if (settingsRes.data?.settings) setSettingsForm(settingsRes.data.settings)
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to load penalty records', 'error')
    } finally {
      setLoading(false)
    }
  }, [activeTab, statusFilter, typeFilter, searchQuery, pagination.page, pagination.limit])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Handle Master Toggle
  const handleToggleMaster = async () => {
    if (!settingsForm) return
    const nextState = !settingsForm.enabled
    try {
      const res = await penaltyApi.updateAdminSettings({ enabled: nextState })
      setSettingsForm(res.data.settings)
      showToast(`Penalty system ${nextState ? 'ENABLED' : 'DISABLED'}`)
      loadData()
    } catch (err) {
      showToast(err.message || 'Failed to update toggle', 'error')
    }
  }

  // Handle Settings Save
  const handleSaveSettings = async (e) => {
    e.preventDefault()
    setSavingSettings(true)
    try {
      const res = await penaltyApi.updateAdminSettings(settingsForm)
      setSettingsForm(res.data.settings)
      showToast('Penalty & bounce configuration saved successfully!')
    } catch (err) {
      showToast(err.message || 'Failed to save settings', 'error')
    } finally {
      setSavingSettings(false)
    }
  }

  // Handle Penalty Action Confirmation
  const handleConfirmAction = async () => {
    if (!actionModal) return
    setSubmittingAction(true)
    const { type, item } = actionModal

    try {
      if (type === 'APPROVE') {
        await penaltyApi.approvePenalty(item._id)
        showToast('Penalty approved and deduction executed.')
      } else if (type === 'REJECT') {
        await penaltyApi.rejectPenalty(item._id, actionInput.reason)
        showToast('Penalty incident rejected.')
      } else if (type === 'WAIVE') {
        if (!actionInput.reason.trim()) {
          showToast('Mandatory reason is required to waive penalty', 'error')
          setSubmittingAction(false)
          return
        }
        await penaltyApi.waivePenalty(item._id, actionInput.reason)
        showToast('Penalty waived and refunded if previously deducted.')
      } else if (type === 'REVERSE') {
        if (!actionInput.reason.trim()) {
          showToast('Mandatory reason is required to reverse deduction', 'error')
          setSubmittingAction(false)
          return
        }
        await penaltyApi.reverseDeduction(item._id, actionInput.reason)
        showToast('Deduction reversed and credited back to partner wallet.')
      } else if (type === 'REVIEW_DISPUTE') {
        await penaltyApi.reviewDispute(item._id, actionInput.decision, actionInput.notes)
        showToast(`Dispute ${actionInput.decision === 'ACCEPT' ? 'accepted and waived' : 'rejected'}.`)
      }

      setActionModal(null)
      setActionInput({ reason: '', decision: 'ACCEPT', notes: '' })
      loadData()
    } catch (err) {
      showToast(err.message || 'Action failed', 'error')
    } finally {
      setSubmittingAction(false)
    }
  }

  return (
    <div className="space-y-6 pb-16">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast.message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`fixed left-4 right-4 top-20 z-[400] mx-auto flex max-w-md items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold shadow-xl ${
              toast.variant === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-800'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800'
            }`}
          >
            {toast.variant === 'error' ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner & Master Switch */}
      <GlassPanel className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600 ring-1 ring-rose-500/20">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-900">Late Fee & Bounce Penalty Management</h1>
                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${settingsForm?.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                  {settingsForm?.enabled ? 'Engine Active 🟢' : 'Engine Disabled 🔴'}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Automated detection, grace period enforcement, no-show bounce tracking, and partner dispute review.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggleMaster}
            className={`flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-black transition shadow-xs ${
              settingsForm?.enabled
                ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                : 'bg-emerald-600 text-white shadow-emerald-600/20 hover:bg-emerald-700'
            }`}
          >
            {settingsForm?.enabled ? <Ban className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            {settingsForm?.enabled ? 'Disable Engine' : 'Enable Engine'}
          </button>
        </div>
      </GlassPanel>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <GlassPanel className="p-4 border-slate-200/80">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Incidents</span>
            <Layers className="h-4 w-4 text-slate-400" />
          </div>
          <p className="mt-2 text-2xl font-black text-slate-900">{stats?.totalCount || 0}</p>
          <div className="mt-1 flex items-center gap-1.5 text-[10px] text-slate-400 font-semibold">
            <span>Late: {stats?.lateCount || 0}</span>
            <span>·</span>
            <span>Bounce: {stats?.bounceCount || 0}</span>
          </div>
        </GlassPanel>

        <GlassPanel className="p-4 border-amber-200/80 bg-amber-50/20">
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-[11px] font-bold uppercase tracking-wider">Pending Review</span>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <p className="mt-2 text-2xl font-black text-amber-900">{stats?.pendingReviewCount || 0}</p>
          <p className="mt-1 text-[10px] text-amber-700 font-bold">Awaiting Admin Action</p>
        </GlassPanel>

        <GlassPanel className="p-4 border-emerald-200/80 bg-emerald-50/20">
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Deductions</span>
            <IndianRupee className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-black text-emerald-900">{formatInr(stats?.totalDeductedAmount)}</p>
          <p className="mt-1 text-[10px] text-emerald-700 font-bold">{stats?.appliedCount || 0} Deductions Executed</p>
        </GlassPanel>

        <GlassPanel className="p-4 border-purple-200/80 bg-purple-50/20">
          <div className="flex items-center justify-between text-purple-700">
            <span className="text-[11px] font-bold uppercase tracking-wider">Active Disputes</span>
            <HelpCircle className="h-4 w-4 text-purple-600" />
          </div>
          <p className="mt-2 text-2xl font-black text-purple-900">{stats?.disputedCount || 0}</p>
          <p className="mt-1 text-[10px] text-purple-700 font-bold">Partner Submissions</p>
        </GlassPanel>

        <GlassPanel className="p-4 border-teal-200/80 bg-teal-50/20">
          <div className="flex items-center justify-between text-teal-700">
            <span className="text-[11px] font-bold uppercase tracking-wider">Waived / Refunded</span>
            <RotateCcw className="h-4 w-4 text-teal-600" />
          </div>
          <p className="mt-2 text-2xl font-black text-teal-900">{(stats?.waivedCount || 0) + (stats?.reversedCount || 0)}</p>
          <p className="mt-1 text-[10px] text-teal-700 font-bold">Approved Exceptions</p>
        </GlassPanel>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
        <div className="flex items-center gap-2">
          {[
            { id: 'incidents', label: 'All Incidents & Ledger', icon: FileText, count: stats?.totalCount },
            { id: 'disputes', label: 'Partner Disputes', icon: HelpCircle, count: stats?.disputedCount, badgeClass: 'bg-purple-100 text-purple-800' },
            { id: 'settings', label: 'Policy & Thresholds', icon: Sliders },
          ].map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black transition ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
                {tab.count != null && tab.count > 0 && (
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${isActive ? 'bg-white/20 text-white' : tab.badgeClass || 'bg-slate-200 text-slate-700'}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          onClick={loadData}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* TAB 1 & 2: INCIDENTS / DISPUTES TABLE */}
      {(activeTab === 'incidents' || activeTab === 'disputes') && (
        <div className="space-y-4">
          {/* Filters Bar */}
          {activeTab === 'incidents' && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 max-w-md">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search booking code, vendor or reason..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-brand"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <select
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none"
                >
                  <option value="ALL">All Types</option>
                  <option value="LATE_FEE">Late Fee</option>
                  <option value="BOUNCE_PENALTY">Bounce Penalty</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="PENDING_REVIEW">Pending Review</option>
                  <option value="APPLIED">Applied (Deducted)</option>
                  <option value="DISPUTED">Disputed</option>
                  <option value="WAIVED">Waived</option>
                  <option value="REVERSED">Reversed</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
            </div>
          )}

          {/* Incidents Table */}
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-brand" />
            </div>
          ) : penalties.length === 0 ? (
            <GlassPanel className="p-12 text-center border-dashed">
              <ShieldAlert className="mx-auto h-12 w-12 text-slate-300 mb-3" />
              <h3 className="text-sm font-bold text-slate-700">No Penalty Records Found</h3>
              <p className="text-xs text-slate-400 mt-1">
                {activeTab === 'disputes'
                  ? 'No active disputes submitted by partners.'
                  : 'No penalty incidents matching your current filters.'}
              </p>
            </GlassPanel>
          ) : (
            <GlassPanel className="overflow-hidden p-0 border-slate-200/80">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-extrabold uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">Booking / Type</th>
                      <th className="py-3.5 px-4">Partner</th>
                      <th className="py-3.5 px-4">Incident Details</th>
                      <th className="py-3.5 px-4">Amount</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {penalties.map((item) => {
                      const shortCode = String(item.bookingId?._id || item.bookingId).slice(-6).toUpperCase()
                      const isLate = item.penaltyType === 'LATE_FEE'

                      return (
                        <tr key={item._id} className="hover:bg-slate-50/80 transition">
                          {/* Booking / Type */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2">
                              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${isLate ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                                {isLate ? <Clock className="h-3.5 w-3.5" /> : <Ban className="h-3.5 w-3.5" />}
                              </span>
                              <div>
                                <p className="font-extrabold text-slate-900">Job #{shortCode}</p>
                                <p className="text-[10px] font-bold text-slate-400">
                                  {isLate ? 'Late Arrival' : 'Job Bounce'}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Partner */}
                          <td className="py-3.5 px-4">
                            <p className="font-bold text-slate-800">{item.vendorId?.fullName || 'Partner'}</p>
                            <p className="text-[10px] font-semibold text-slate-400">{item.vendorId?.phone || '—'}</p>
                          </td>

                          {/* Incident Details */}
                          <td className="py-3.5 px-4 max-w-xs">
                            <p className="font-semibold text-slate-700 truncate" title={item.reason}>
                              {item.reason}
                            </p>
                            <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                              {formatDate(item.incidentTime || item.createdAt)}
                              {item.delayMinutes > 0 && ` · ${item.delayMinutes} mins late`}
                            </p>
                          </td>

                          {/* Amount */}
                          <td className="py-3.5 px-4">
                            <p className="font-black text-rose-700 text-sm">{formatInr(item.amount)}</p>
                            {item.deductedAmount > 0 && (
                              <p className="text-[10px] font-bold text-emerald-700">Deducted: {formatInr(item.deductedAmount)}</p>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4">
                            <StatusBadge status={item.status} />
                            {item.dispute?.isDisputed && (
                              <span className="block mt-1 text-[10px] font-bold text-purple-700">
                                💬 Dispute: {item.dispute.status}
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Inspect */}
                              <button
                                type="button"
                                onClick={() => setDetailModalItem(item)}
                                className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                                title="Inspect Details"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>

                              {/* Dispute Review */}
                              {item.status === 'DISPUTED' && item.dispute?.status === 'PENDING' && (
                                <button
                                  type="button"
                                  onClick={() => setActionModal({ type: 'REVIEW_DISPUTE', item })}
                                  className="px-2.5 py-1 rounded-lg bg-purple-600 text-white font-extrabold hover:bg-purple-700 shadow-xs"
                                >
                                  Review Dispute
                                </button>
                              )}

                              {/* Approve Deduction */}
                              {item.status === 'PENDING_REVIEW' && (
                                <button
                                  type="button"
                                  onClick={() => setActionModal({ type: 'APPROVE', item })}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-extrabold hover:bg-emerald-700 shadow-xs"
                                >
                                  Approve
                                </button>
                              )}

                              {/* Waive Penalty */}
                              {(item.status === 'PENDING_REVIEW' || item.status === 'APPLIED') && (
                                <button
                                  type="button"
                                  onClick={() => setActionModal({ type: 'WAIVE', item })}
                                  className="px-2.5 py-1 rounded-lg border border-teal-300 text-teal-700 hover:bg-teal-50 font-bold"
                                >
                                  Waive
                                </button>
                              )}

                              {/* Reverse Deduction */}
                              {item.status === 'APPLIED' && (
                                <button
                                  type="button"
                                  onClick={() => setActionModal({ type: 'REVERSE', item })}
                                  className="px-2.5 py-1 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 font-bold"
                                >
                                  Refund Reversal
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </GlassPanel>
          )}
        </div>
      )}

      {/* TAB 3: SETTINGS & POLICY CONFIGURATION */}
      {activeTab === 'settings' && settingsForm && (
        <form onSubmit={handleSaveSettings} className="space-y-6 max-w-4xl">
          <GlassPanel className="p-6 space-y-6">
            <h2 className="text-base font-black text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Sliders className="h-5 w-5 text-brand" />
              General Rules & Thresholds
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1 block">
                  Default Grace Period (Minutes)
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={settingsForm.defaultGracePeriodMinutes}
                  onChange={(e) => setSettingsForm({ ...settingsForm, defaultGracePeriodMinutes: Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm font-bold text-slate-900 outline-none focus:border-brand"
                />
                <p className="text-[11px] text-slate-400 mt-1">Arrival within this period incurs zero late penalty.</p>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1 block">
                  Dispute Submission Deadline (Hours)
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={settingsForm.disputeDeadlineHours}
                  onChange={(e) => setSettingsForm({ ...settingsForm, disputeDeadlineHours: Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm font-bold text-slate-900 outline-none focus:border-brand"
                />
                <p className="text-[11px] text-slate-400 mt-1">Partners can submit disputes within this window.</p>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1 block">
                  No-Show Verification Window (Minutes)
                </label>
                <input
                  type="number"
                  min="15"
                  required
                  value={settingsForm.noShowVerificationWindowMinutes}
                  onChange={(e) => setSettingsForm({ ...settingsForm, noShowVerificationWindowMinutes: Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm font-bold text-slate-900 outline-none focus:border-brand"
                />
                <p className="text-[11px] text-slate-400 mt-1">Time past scheduled appointment to auto-mark no-show bounce.</p>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1 block">
                  Max Penalty Per Booking Cap (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={settingsForm.maxPenaltyPerBooking}
                  onChange={(e) => setSettingsForm({ ...settingsForm, maxPenaltyPerBooking: Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm font-bold text-slate-900 outline-none focus:border-brand"
                />
                <p className="text-[11px] text-slate-400 mt-1">Upper limit safety cap for any booking penalty.</p>
              </div>
            </div>

            {/* Auto Deduct Toggle */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <div>
                <p className="text-sm font-bold text-slate-900">Automatic Wallet Deduction</p>
                <p className="text-xs text-slate-500 font-medium">
                  {settingsForm.autoDeductEnabled
                    ? 'Penalties are automatically deducted upon detection.'
                    : 'Penalties are held in PENDING_REVIEW status until Admin manual approval.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSettingsForm({ ...settingsForm, autoDeductEnabled: !settingsForm.autoDeductEnabled })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
                  settingsForm.autoDeductEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${settingsForm.autoDeductEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </GlassPanel>

          {/* Late Fee Config */}
          <GlassPanel className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Clock className="h-5 w-5 text-amber-600" />
                Late Arrival Fee Rules
              </h2>
              <button
                type="button"
                onClick={() => setSettingsForm({ ...settingsForm, lateFeeEnabled: !settingsForm.lateFeeEnabled })}
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  settingsForm.lateFeeEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {settingsForm.lateFeeEnabled ? 'Enabled 🟢' : 'Disabled 🔴'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1 block">
                  Calculation Mode
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {['FIXED', 'TIERED'].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setSettingsForm({ ...settingsForm, lateFeeMode: m })}
                      className={`p-2.5 rounded-xl text-xs font-black transition border ${
                        settingsForm.lateFeeMode === m
                          ? 'bg-amber-500 text-white border-amber-500 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {m === 'FIXED' ? 'Flat Fee' : 'Tiered by Delay'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1 block">
                  Fixed Late Fee Amount (₹)
                </label>
                <input
                  type="number"
                  min="0"
                  value={settingsForm.fixedLateFeeAmount}
                  onChange={(e) => setSettingsForm({ ...settingsForm, fixedLateFeeAmount: Number(e.target.value) })}
                  className="w-full rounded-xl border border-slate-200 p-3 text-sm font-bold text-slate-900 outline-none focus:border-brand"
                />
              </div>
            </div>
          </GlassPanel>

          {/* Bounce Penalty Config */}
          <GlassPanel className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
                <Ban className="h-5 w-5 text-rose-600" />
                Job Bounce Penalty Rules
              </h2>
              <button
                type="button"
                onClick={() => setSettingsForm({ ...settingsForm, bouncePenaltyEnabled: !settingsForm.bouncePenaltyEnabled })}
                className={`px-3 py-1 rounded-full text-xs font-bold ${
                  settingsForm.bouncePenaltyEnabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {settingsForm.bouncePenaltyEnabled ? 'Enabled 🟢' : 'Disabled 🔴'}
              </button>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1 block">
                Standard Bounce Penalty Fee (₹)
              </label>
              <input
                type="number"
                min="0"
                value={settingsForm.fixedBouncePenaltyAmount}
                onChange={(e) => setSettingsForm({ ...settingsForm, fixedBouncePenaltyAmount: Number(e.target.value) })}
                className="w-full rounded-xl border border-slate-200 p-3 text-sm font-bold text-slate-900 outline-none focus:border-brand"
              />
              <p className="text-[11px] text-slate-400 mt-1">Applied when a partner cancels without an approved exemption.</p>
            </div>
          </GlassPanel>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingSettings}
              className="flex items-center gap-2 rounded-xl bg-brand px-6 py-3 text-xs font-extrabold text-white shadow-md shadow-brand/20 transition hover:bg-brand/90 disabled:opacity-50"
            >
              {savingSettings ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save All Policy Settings
            </button>
          </div>
        </form>
      )}

      {/* DETAIL MODAL */}
      <AnimatePresence>
        {detailModalItem && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-rose-600" />
                  <h3 className="text-base font-black text-slate-900">Penalty Incident #{String(detailModalItem._id).slice(-6).toUpperCase()}</h3>
                </div>
                <button type="button" onClick={() => setDetailModalItem(null)} className="p-1 rounded-lg text-slate-400 hover:text-slate-600">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200/70">
                  <div>
                    <span className="text-slate-400 font-bold uppercase tracking-wider block">Partner</span>
                    <span className="font-extrabold text-slate-900">{detailModalItem.vendorId?.fullName || '—'}</span>
                    <span className="block text-slate-500 font-medium">{detailModalItem.vendorId?.phone}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold uppercase tracking-wider block">Amount</span>
                    <span className="text-base font-black text-rose-700">{formatInr(detailModalItem.amount)}</span>
                    <StatusBadge status={detailModalItem.status} />
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 font-bold uppercase tracking-wider block">Reason & Findings</span>
                  <p className="font-bold text-slate-800 mt-0.5">{detailModalItem.reason}</p>
                </div>

                {detailModalItem.dispute?.isDisputed && (
                  <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-200 text-purple-950 space-y-1">
                    <p className="font-black text-xs">Partner Dispute Submission:</p>
                    <p className="font-medium text-xs text-purple-900">"{detailModalItem.dispute.reason}"</p>
                    {detailModalItem.dispute.evidenceUrls?.length > 0 && (
                      <div className="pt-2 flex flex-wrap gap-2">
                        {detailModalItem.dispute.evidenceUrls.map((u, i) => (
                          <a key={i} href={u} target="_blank" rel="noreferrer" className="text-[11px] font-bold text-purple-700 underline">
                            View Proof #{i + 1}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Audit Trail */}
                {detailModalItem.actionAudit?.length > 0 && (
                  <div>
                    <span className="text-slate-400 font-bold uppercase tracking-wider block mb-1">Audit Trail</span>
                    <div className="space-y-1.5 p-3 rounded-2xl bg-slate-50 border border-slate-200/70">
                      {detailModalItem.actionAudit.map((a, i) => (
                        <div key={i} className="flex items-start justify-between text-[11px]">
                          <span className="font-bold text-slate-800">{a.action}: {a.notes}</span>
                          <span className="text-slate-400 shrink-0 ml-2">{formatDate(a.performedAt)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => setDetailModalItem(null)}
                className="w-full rounded-xl bg-slate-900 py-3 text-xs font-bold text-white hover:bg-slate-800"
              >
                Close
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ACTION CONFIRMATION MODAL */}
      <AnimatePresence>
        {actionModal && (
          <div className="fixed inset-0 z-[310] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-black text-slate-900">
                  {actionModal.type === 'APPROVE' && 'Approve & Deduct Penalty'}
                  {actionModal.type === 'WAIVE' && 'Waive Penalty (Refund if deducted)'}
                  {actionModal.type === 'REVERSE' && 'Reverse Penalty Deduction'}
                  {actionModal.type === 'REVIEW_DISPUTE' && 'Review Partner Dispute'}
                </h3>
                <button type="button" onClick={() => setActionModal(null)} className="p-1 text-slate-400 hover:text-slate-600">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <p className="font-bold text-slate-900">Penalty Amount: {formatInr(actionModal.item.amount)}</p>
                  <p className="text-slate-500 mt-0.5">{actionModal.item.reason}</p>
                </div>

                {actionModal.type === 'REVIEW_DISPUTE' ? (
                  <div className="space-y-3">
                    <p className="font-bold text-purple-900">Dispute: "{actionModal.item.dispute?.reason}"</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setActionInput({ ...actionInput, decision: 'ACCEPT' })}
                        className={`p-2.5 rounded-xl font-black text-xs transition border ${
                          actionInput.decision === 'ACCEPT'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200'
                        }`}
                      >
                        Accept & Waive
                      </button>
                      <button
                        type="button"
                        onClick={() => setActionInput({ ...actionInput, decision: 'REJECT' })}
                        className={`p-2.5 rounded-xl font-black text-xs transition border ${
                          actionInput.decision === 'REJECT'
                            ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200'
                        }`}
                      >
                        Reject Dispute
                      </button>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-slate-600 mb-1 block">Admin Review Notes</label>
                      <textarea
                        rows={2}
                        placeholder="Explain decision to partner..."
                        value={actionInput.notes}
                        onChange={(e) => setActionInput({ ...actionInput, notes: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-semibold outline-none focus:border-brand"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 mb-1 block">
                      {actionModal.type === 'APPROVE' ? 'Audit Notes (Optional)' : 'Mandatory Reason *'}
                    </label>
                    <textarea
                      rows={2}
                      required={actionModal.type !== 'APPROVE'}
                      placeholder="Enter reason for audit record..."
                      value={actionInput.reason}
                      onChange={(e) => setActionInput({ ...actionInput, reason: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-semibold outline-none focus:border-brand"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setActionModal(null)}
                  className="rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={submittingAction}
                  onClick={handleConfirmAction}
                  className="rounded-xl bg-slate-900 py-2.5 text-xs font-extrabold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {submittingAction ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Confirm Action'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
export default AdminPenaltyManagementPage
