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
  Percent,
  Users,
  Bell,
  ShieldX,
  Unlock,
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

  // Customer Cancellations & Restrictions Tab State
  const [customerItems, setCustomerItems] = useState([])
  const [loadingCustomers, setLoadingCustomers] = useState(false)
  const [customerFilter, setCustomerFilter] = useState('ALL')
  const [customerSearch, setCustomerSearch] = useState('')
  const [customerPagination, setCustomerPagination] = useState({ page: 1, limit: 15, total: 0, pages: 1 })
  const [customerPolicyMeta, setCustomerPolicyMeta] = useState(null)

  // Customer Modals
  const [customerHistoryModal, setCustomerHistoryModal] = useState({ open: false, data: null, loading: false })
  const [restrictModal, setRestrictModal] = useState({
    open: false,
    customer: null,
    durationDays: 7,
    reason: '',
    adminNote: '',
    loading: false,
    error: '',
  })
  const [unrestrictModal, setUnrestrictModal] = useState({
    open: false,
    customer: null,
    reason: '',
    adminNote: '',
    loading: false,
    error: '',
  })

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

  // Fetch Customer Cancellations
  const fetchCustomerCancellations = useCallback(
    async (page = 1) => {
      setLoadingCustomers(true)
      try {
        const res = await bookingCancellationApi.getAdminCustomerCancellations({
          page,
          limit: customerPagination.limit,
          search: customerSearch,
          filter: customerFilter,
        })
        if (res.data) {
          setCustomerItems(res.data.items || [])
          setCustomerPagination(res.data.pagination || { page: 1, limit: 15, total: 0, pages: 1 })
          setCustomerPolicyMeta(res.data.policy || null)
        }
      } catch (err) {
        console.error('Failed to load customer cancellations:', err)
      } finally {
        setLoadingCustomers(false)
      }
    },
    [customerSearch, customerFilter, customerPagination.limit]
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
    } else if (activeTab === 'customers') {
      fetchCustomerCancellations(1)
    } else if (activeTab === 'settings') {
      fetchSettings()
    }
  }, [activeTab, fetchRecords, fetchCustomerCancellations, fetchSettings])

  // Customer History & Restriction Handlers
  const handleOpenCustomerHistory = async (customerId) => {
    setCustomerHistoryModal({ open: true, data: null, loading: true })
    try {
      const res = await bookingCancellationApi.getAdminCustomerHistory(customerId)
      setCustomerHistoryModal({ open: true, data: res.data, loading: false })
    } catch (err) {
      console.error('Failed to load customer history:', err)
      setCustomerHistoryModal({ open: false, data: null, loading: false })
      alert('Failed to load customer cancellation history')
    }
  }

  const handleApplyRestriction = async (e) => {
    e.preventDefault()
    if (!restrictModal.customer?._id) return
    setRestrictModal((prev) => ({ ...prev, loading: true, error: '' }))
    try {
      await bookingCancellationApi.adminRestrictCustomer(restrictModal.customer._id, {
        durationDays: Number(restrictModal.durationDays),
        reason: restrictModal.reason.trim(),
        adminNote: restrictModal.adminNote.trim(),
      })
      setRestrictModal({
        open: false,
        customer: null,
        durationDays: 7,
        reason: '',
        adminNote: '',
        loading: false,
        error: '',
      })
      fetchCustomerCancellations(customerPagination.page)
    } catch (err) {
      setRestrictModal((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof ApiError ? err.message : err.message || 'Failed to restrict customer',
      }))
    }
  }

  const handleLiftRestriction = async (e) => {
    e.preventDefault()
    if (!unrestrictModal.customer?._id) return
    setUnrestrictModal((prev) => ({ ...prev, loading: true, error: '' }))
    try {
      await bookingCancellationApi.adminUnrestrictCustomer(unrestrictModal.customer._id, {
        reason: unrestrictModal.reason.trim(),
        adminNote: unrestrictModal.adminNote.trim(),
      })
      setUnrestrictModal({
        open: false,
        customer: null,
        reason: '',
        adminNote: '',
        loading: false,
        error: '',
      })
      fetchCustomerCancellations(customerPagination.page)
    } catch (err) {
      setUnrestrictModal((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof ApiError ? err.message : err.message || 'Failed to lift restriction',
      }))
    }
  }

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
          onClick={() => setActiveTab('customers')}
          className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition ${
            activeTab === 'customers'
              ? 'bg-brand text-white shadow-md shadow-brand/20'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="h-4 w-4" />
          Customer Cancellations & Restrictions
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
      {/* TAB: CUSTOMER CANCELLATIONS & RESTRICTION MANAGEMENT */}
      {/* ======================================================== */}
      {activeTab === 'customers' && (
        <div className="space-y-4">
          <GlassPanel className="p-4 border-slate-200/80">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              {/* Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'ALL', label: 'All Customers' },
                  { id: 'HIGH_CANCELLATIONS', label: 'High Cancellations (≥ Warning)' },
                  { id: 'WARNED', label: 'Warned Customers' },
                  { id: 'RESTRICTED', label: 'Restricted Accounts' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setCustomerFilter(f.id)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                      customerFilter === f.id
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Search Bar */}
              <div className="relative w-full lg:w-72">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search customer name, phone..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-4 text-xs font-semibold text-slate-800 placeholder-slate-400 outline-hidden focus:border-brand"
                />
              </div>
            </div>

            {/* Active Policy Summary Pill */}
            {customerPolicyMeta && (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-blue-50/70 border border-blue-100 px-3 py-2 text-[11px] font-semibold text-blue-900">
                <ShieldAlert className="h-4 w-4 text-blue-600 shrink-0" />
                <span>
                  Active Repeat Policy: <b>{customerPolicyMeta.windowDays}d</b> rolling window • Warning at{' '}
                  <b>{customerPolicyMeta.warningThreshold}</b> cancellations • Restriction threshold:{' '}
                  <b>{customerPolicyMeta.restrictionThreshold}</b> cancellations (Mode:{' '}
                  <span className="uppercase font-bold">{customerPolicyMeta.restrictionMode}</span>)
                </span>
              </div>
            )}
          </GlassPanel>

          {/* Customers Table */}
          <GlassPanel className="overflow-hidden border-slate-200/80 p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/70 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Rolling Cancellations</th>
                    <th className="py-3 px-4">Warning Count</th>
                    <th className="py-3 px-4">Restriction Status</th>
                    <th className="py-3 px-4">Latest Cancellation</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                  {loadingCustomers ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400">
                        <Loader2 className="mx-auto h-6 w-6 animate-spin text-brand" />
                        <span className="mt-2 block font-bold">Loading customers...</span>
                      </td>
                    </tr>
                  ) : customerItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 font-bold">
                        No customer cancellation records found matching criteria
                      </td>
                    </tr>
                  ) : (
                    customerItems.map((item) => {
                      const c = item.customer || {}
                      const isHigh = item.activeCount >= (item.warningThreshold || 3)
                      const isRestricted = item.isRestricted
                      return (
                        <tr key={c._id} className="hover:bg-slate-50/60 transition">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold">
                                {(c.name || 'C').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-bold text-slate-900 leading-tight">{c.name || 'Customer'}</p>
                                <p className="text-[11px] text-slate-400">{c.phone || c.email || '—'}</p>
                              </div>
                            </div>
                          </td>

                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-black border ${
                                isHigh
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : item.activeCount > 0
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}
                            >
                              {item.activeCount} cancellations / {item.windowDays}d
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="text-slate-800 font-bold">
                              {item.warningCount > 0 ? (
                                <span className="text-amber-700 font-black">{item.warningCount} times warned</span>
                              ) : (
                                <span className="text-slate-400 font-medium">None</span>
                              )}
                            </div>
                            {item.lastWarningAt && (
                              <p className="text-[10px] text-slate-400">Last: {formatDate(item.lastWarningAt)}</p>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            {isRestricted ? (
                              <div className="space-y-0.5">
                                <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 text-rose-800 border border-rose-200 px-2.5 py-0.5 text-[11px] font-black">
                                  <ShieldX className="h-3 w-3" />
                                  RESTRICTED
                                </span>
                                <p className="text-[10px] text-rose-600 font-semibold">
                                  {item.restrictedUntil
                                    ? `Until ${formatDate(item.restrictedUntil)}`
                                    : 'Indefinite (Admin)'}
                                </p>
                              </div>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[11px] font-bold">
                                <CheckCircle2 className="h-3 w-3" />
                                ACTIVE
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            {item.lastCancellation ? (
                              <div>
                                <p className="text-slate-800 font-bold leading-tight">
                                  {item.lastCancellation.reason}
                                </p>
                                <p className="text-[10px] text-slate-400 mt-0.5">
                                  {formatDate(item.lastCancellation.createdAt)}
                                </p>
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 text-right space-x-1">
                            <button
                              type="button"
                              onClick={() => handleOpenCustomerHistory(c._id)}
                              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50 shadow-xs"
                            >
                              <Eye className="h-3 w-3" />
                              History
                            </button>

                            {isRestricted ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setUnrestrictModal({
                                    open: true,
                                    customer: c,
                                    reason: '',
                                    adminNote: '',
                                    loading: false,
                                    error: '',
                                  })
                                }
                                className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-extrabold text-white hover:bg-emerald-700 shadow-xs active:scale-95"
                              >
                                <Unlock className="h-3 w-3" />
                                Lift Restriction
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  setRestrictModal({
                                    open: true,
                                    customer: c,
                                    durationDays: 7,
                                    reason: 'Repeated cancellation policy violation',
                                    adminNote: '',
                                    loading: false,
                                    error: '',
                                  })
                                }
                                className="inline-flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1.5 text-[11px] font-extrabold text-white hover:bg-rose-700 shadow-xs active:scale-95"
                              >
                                <Ban className="h-3 w-3" />
                                Restrict
                              </button>
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
            {customerPagination.pages > 1 && (
              <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-xs font-semibold text-slate-500">
                <span>
                  Showing page {customerPagination.page} of {customerPagination.pages} ({customerPagination.total} customers)
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={customerPagination.page <= 1}
                    onClick={() => fetchCustomerCancellations(customerPagination.page - 1)}
                    className="rounded-lg border border-slate-200 px-2.5 py-1 disabled:opacity-40 hover:bg-slate-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={customerPagination.page >= customerPagination.pages}
                    onClick={() => fetchCustomerCancellations(customerPagination.page + 1)}
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

              {/* Card 4: Customer Repeat Cancellation & Restriction Policy */}
              <GlassPanel className="p-6 border-slate-200/80 space-y-6">
                <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      Customer Repeat Cancellation & Restriction Policy
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Warn customers when they frequently cancel bookings and automatically or manually restrict new bookings.
                    </p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={settings.customerWarningEnabled !== false}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          customerWarningEnabled: e.target.checked,
                        })
                      }
                      className="peer sr-only"
                    />
                    <div className="h-6 w-11 rounded-full bg-slate-200 peer-checked:bg-emerald-600 peer-focus:outline-hidden after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full" />
                  </label>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                  {/* Warning Threshold */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Warning Threshold (Cancellations)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={settings.customerWarningThreshold ?? 3}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          customerWarningThreshold: parseInt(e.target.value, 10) || 1,
                        })
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 outline-hidden focus:border-brand"
                    />
                    <p className="text-[11px] font-medium text-slate-400 mt-1">
                      Default: 3. Warns customer upon reaching this count.
                    </p>
                  </div>

                  {/* Restriction Threshold */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Restriction Threshold (Cancellations)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={settings.customerRestrictionThreshold ?? 5}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          customerRestrictionThreshold: parseInt(e.target.value, 10) || 1,
                        })
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 outline-hidden focus:border-brand"
                    />
                    <p className="text-[11px] font-medium text-slate-400 mt-1">
                      Default: 5. Triggers configured restriction action.
                    </p>
                  </div>

                  {/* Rolling Window Days */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Rolling Window (Days)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={settings.customerRollingWindowDays ?? 30}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          customerRollingWindowDays: parseInt(e.target.value, 10) || 1,
                        })
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 outline-hidden focus:border-brand"
                    />
                    <p className="text-[11px] font-medium text-slate-400 mt-1">
                      Default: 30 days. Older cancellations drop off automatically.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  {/* Restriction Mode */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Restriction Action Mode
                    </label>
                    <select
                      value={settings.customerRestrictionMode || 'WARNING_ONLY'}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          customerRestrictionMode: e.target.value,
                        })
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 outline-hidden focus:border-brand"
                    >
                      <option value="WARNING_ONLY">Warning Only (Informational warning, no auto-block)</option>
                      <option value="TEMPORARY_RESTRICTION">Temporary Restriction (Block new bookings for duration)</option>
                      <option value="MANUAL_REVIEW">Manual Admin Review (Flag for admin signoff)</option>
                    </select>
                    <p className="text-[11px] font-medium text-slate-400 mt-1">
                      Select policy enforcement level when restriction threshold is reached.
                    </p>
                  </div>

                  {/* Restriction Duration Days */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Restriction Duration (Days)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={settings.customerRestrictionDurationDays ?? 7}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          customerRestrictionDurationDays: parseInt(e.target.value, 10) || 1,
                        })
                      }
                      disabled={settings.customerRestrictionMode !== 'TEMPORARY_RESTRICTION'}
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 outline-hidden focus:border-brand disabled:opacity-50"
                    />
                    <p className="text-[11px] font-medium text-slate-400 mt-1">
                      Default: 7 days. Only applies when Temporary Restriction mode is active.
                    </p>
                  </div>
                </div>

                {/* Push Notifications Toggle */}
                <div className="flex items-center justify-between border-t border-slate-100 pt-4">
                  <div>
                    <h4 className="text-xs font-extrabold text-slate-800">
                      Push & In-App Notifications
                    </h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Send FCM push alerts and in-app notifications to customers on warnings and restrictions.
                    </p>
                  </div>
                  <label className="relative inline-flex cursor-pointer items-center">
                    <input
                      type="checkbox"
                      checked={settings.customerPushNotificationsEnabled !== false}
                      onChange={(e) =>
                        setSettings({
                          ...settings,
                          customerPushNotificationsEnabled: e.target.checked,
                        })
                      }
                      className="peer sr-only"
                    />
                    <div className="h-6 w-11 rounded-full bg-slate-200 peer-checked:bg-emerald-600 peer-focus:outline-hidden after:absolute after:left-[2px] after:top-[2px] after:h-5 after:w-5 after:rounded-full after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full" />
                  </label>
                </div>

                {/* Messages */}
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 border-t border-slate-100 pt-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Warning Message Displayed to Customer
                    </label>
                    <textarea
                      rows={3}
                      value={settings.customerWarningMessage || ''}
                      onChange={(e) =>
                        setSettings({ ...settings, customerWarningMessage: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-medium text-slate-800 outline-hidden focus:border-brand"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Restriction Message Displayed to Customer
                    </label>
                    <textarea
                      rows={3}
                      value={settings.customerRestrictionMessage || ''}
                      onChange={(e) =>
                        setSettings({ ...settings, customerRestrictionMessage: e.target.value })
                      }
                      className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-medium text-slate-800 outline-hidden focus:border-brand"
                    />
                  </div>
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

      {/* ======================================================== */}
      {/* MODAL: CUSTOMER CANCELLATION HISTORY & AUDIT LOG */}
      {/* ======================================================== */}
      {customerHistoryModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-900">
                  Customer Cancellation Profile & Audit History
                </h3>
                {customerHistoryModal.data?.customer && (
                  <p className="text-xs font-semibold text-slate-400 mt-0.5">
                    {customerHistoryModal.data.customer.name} • {customerHistoryModal.data.customer.phone || customerHistoryModal.data.customer.email}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setCustomerHistoryModal({ open: false, data: null, loading: false })}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {customerHistoryModal.loading ? (
              <div className="py-12 text-center text-slate-400">
                <Loader2 className="mx-auto h-6 w-6 animate-spin text-brand" />
                <p className="mt-2 text-xs font-bold">Loading customer history...</p>
              </div>
            ) : customerHistoryModal.data ? (
              <div className="space-y-4">
                {/* Stats ribbon */}
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                    <span className="text-slate-400 font-bold block mb-0.5">Rolling Cancellations</span>
                    <span className="text-lg font-black text-slate-900">
                      {customerHistoryModal.data.activeCount} / {customerHistoryModal.data.windowDays}d
                    </span>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                    <span className="text-slate-400 font-bold block mb-0.5">Policy Thresholds</span>
                    <span className="text-xs font-bold text-slate-700">
                      Warn: {customerHistoryModal.data.warningThreshold} • Restrict: {customerHistoryModal.data.restrictionThreshold}
                    </span>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
                    <span className="text-slate-400 font-bold block mb-0.5">Restriction Status</span>
                    {customerHistoryModal.data.isRestricted ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 text-rose-800 border border-rose-200 px-2 py-0.5 text-[10px] font-black">
                        RESTRICTED
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 px-2 py-0.5 text-[10px] font-black">
                        ACTIVE
                      </span>
                    )}
                  </div>
                </div>

                {/* Cancellation Records */}
                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-2">
                    Customer Initiated Cancellations ({customerHistoryModal.data.records?.length || 0})
                  </h4>
                  <div className="rounded-xl border border-slate-100 overflow-hidden">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="bg-slate-50 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-100">
                        <tr>
                          <th className="py-2.5 px-3">Date</th>
                          <th className="py-2.5 px-3">Booking</th>
                          <th className="py-2.5 px-3">Reason</th>
                          <th className="py-2.5 px-3">Refund Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                        {customerHistoryModal.data.records?.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="py-6 text-center text-slate-400">
                              No customer cancellations on record
                            </td>
                          </tr>
                        ) : (
                          customerHistoryModal.data.records.map((r) => (
                            <tr key={r._id} className="hover:bg-slate-50/50">
                              <td className="py-2.5 px-3 whitespace-nowrap">{formatDate(r.createdAt)}</td>
                              <td className="py-2.5 px-3 font-bold text-slate-900">
                                #{String(r.bookingId?._id || r.bookingId).slice(-6).toUpperCase()}
                              </td>
                              <td className="py-2.5 px-3">{r.reason}</td>
                              <td className="py-2.5 px-3">
                                <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                                  {r.refundStatus || 'N/A'}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Restriction & Warning Audit Trail */}
                <div>
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-600 mb-2">
                    Policy Actions & Restriction Audit Trail ({customerHistoryModal.data.restrictionHistory?.length || 0})
                  </h4>
                  <div className="space-y-2">
                    {customerHistoryModal.data.restrictionHistory?.length === 0 ? (
                      <p className="text-xs text-slate-400 font-medium py-2">No warning or restriction events logged yet.</p>
                    ) : (
                      customerHistoryModal.data.restrictionHistory.map((hist, idx) => (
                        <div
                          key={idx}
                          className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 flex items-start justify-between text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`rounded-md px-1.5 py-0.5 text-[10px] font-black ${
                                  hist.action === 'RESTRICTED'
                                    ? 'bg-rose-100 text-rose-800'
                                    : hist.action === 'UNRESTRICTED'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {hist.action}
                              </span>
                              <span className="font-bold text-slate-800">By: {hist.performedBy}</span>
                            </div>
                            <p className="text-slate-600 mt-1 font-medium">{hist.reason}</p>
                            {hist.restrictedUntil && (
                              <p className="text-[11px] text-rose-600 font-semibold mt-0.5">
                                Restricted Until: {formatDate(hist.restrictedUntil)}
                              </p>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-400 font-semibold whitespace-nowrap">
                            {formatDate(hist.timestamp)}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setCustomerHistoryModal({ open: false, data: null, loading: false })}
                className="rounded-xl bg-slate-100 px-5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: APPLY MANUAL CUSTOMER RESTRICTION */}
      {/* ======================================================== */}
      {restrictModal.open && restrictModal.customer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <form
            onSubmit={handleApplyRestriction}
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-extrabold text-base">
                <Ban className="h-5 w-5 text-rose-600" />
                Restrict Customer Booking Access
              </div>
              <button
                type="button"
                onClick={() => setRestrictModal({ open: false, customer: null, durationDays: 7, reason: '', adminNote: '', loading: false, error: '' })}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-2xl bg-rose-50/80 p-3.5 text-xs text-rose-900 space-y-1 border border-rose-100">
              <p><b>Target Customer:</b> {restrictModal.customer.name}</p>
              <p><b>Phone / Contact:</b> {restrictModal.customer.phone || restrictModal.customer.email}</p>
              <p className="text-[11px] text-rose-700 mt-1">
                This will prevent the customer from creating new bookings. Existing bookings remain intact.
              </p>
            </div>

            {restrictModal.error && (
              <p className="text-xs font-bold text-rose-600">{restrictModal.error}</p>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Restriction Duration
              </label>
              <select
                value={restrictModal.durationDays}
                onChange={(e) => setRestrictModal({ ...restrictModal, durationDays: Number(e.target.value) })}
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-bold text-slate-800 outline-hidden focus:border-brand"
              >
                <option value={1}>1 Day</option>
                <option value={3}>3 Days</option>
                <option value={7}>7 Days (Standard)</option>
                <option value={14}>14 Days</option>
                <option value={30}>30 Days</option>
                <option value={0}>Indefinite (Until Manually Lifted)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Mandatory Reason *
              </label>
              <input
                type="text"
                required
                value={restrictModal.reason}
                onChange={(e) => setRestrictModal({ ...restrictModal, reason: e.target.value })}
                placeholder="Reason for restriction (visible to customer)..."
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-medium text-slate-800 outline-hidden focus:border-brand"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Internal Admin Memo
              </label>
              <textarea
                rows={2}
                value={restrictModal.adminNote}
                onChange={(e) => setRestrictModal({ ...restrictModal, adminNote: e.target.value })}
                placeholder="Internal audit notes..."
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-medium text-slate-800 outline-hidden focus:border-brand"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRestrictModal({ open: false, customer: null, durationDays: 7, reason: '', adminNote: '', loading: false, error: '' })}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={restrictModal.loading}
                className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-5 py-2 text-xs font-extrabold text-white shadow-sm hover:bg-rose-700 transition active:scale-95 disabled:opacity-50"
              >
                {restrictModal.loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Apply Restriction
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL: LIFT MANUAL CUSTOMER RESTRICTION */}
      {/* ======================================================== */}
      {unrestrictModal.open && unrestrictModal.customer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <form
            onSubmit={handleLiftRestriction}
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2 text-slate-900 font-extrabold text-base">
                <Unlock className="h-5 w-5 text-emerald-600" />
                Lift Customer Restriction
              </div>
              <button
                type="button"
                onClick={() => setUnrestrictModal({ open: false, customer: null, reason: '', adminNote: '', loading: false, error: '' })}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-2xl bg-emerald-50/80 p-3.5 text-xs text-emerald-900 space-y-1 border border-emerald-100">
              <p><b>Target Customer:</b> {unrestrictModal.customer.name}</p>
              <p><b>Phone / Contact:</b> {unrestrictModal.customer.phone || unrestrictModal.customer.email}</p>
              <p className="text-[11px] text-emerald-700 mt-1">
                Lifting this restriction will immediately restore the customer's ability to create bookings.
              </p>
            </div>

            {unrestrictModal.error && (
              <p className="text-xs font-bold text-rose-600">{unrestrictModal.error}</p>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Reason for Restoring Access *
              </label>
              <input
                type="text"
                required
                value={unrestrictModal.reason}
                onChange={(e) => setUnrestrictModal({ ...unrestrictModal, reason: e.target.value })}
                placeholder="Reason (e.g., Customer contacted support, policy reviewed)..."
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-medium text-slate-800 outline-hidden focus:border-brand"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Internal Admin Memo
              </label>
              <textarea
                rows={2}
                value={unrestrictModal.adminNote}
                onChange={(e) => setUnrestrictModal({ ...unrestrictModal, adminNote: e.target.value })}
                placeholder="Internal audit notes..."
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-medium text-slate-800 outline-hidden focus:border-brand"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setUnrestrictModal({ open: false, customer: null, reason: '', adminNote: '', loading: false, error: '' })}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={unrestrictModal.loading}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-extrabold text-white shadow-sm hover:bg-emerald-700 transition active:scale-95 disabled:opacity-50"
              >
                {unrestrictModal.loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Restore Booking Access
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}

export default AdminBookingCancellationPage
