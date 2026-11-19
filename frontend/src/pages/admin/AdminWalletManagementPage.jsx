import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Wallet,
  Users,
  Wrench,
  BarChart3,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Search,
  Filter,
  Eye,
  RefreshCw,
  Copy,
  Check,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Calendar,
  IndianRupee,
  SlidersHorizontal,
  X,
  Loader2,
  ArrowUpDown,
  FileText,
  ShieldCheck,
  TrendingUp,
  CreditCard,
  User,
  Phone,
  ZoomIn,
} from 'lucide-react'
import { adminWalletApprovalApi } from '../../api/adminWalletApprovalApi.js'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { useSocket } from '../../context/SocketContext.jsx'
import { stopBookingAlertSound } from '../../utils/bookingSound.js'

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

const QUICK_REJECTION_REASONS = [
  'Invalid or unverified UTR / Transaction ID',
  'Payment receipt screenshot is blurred or unreadable',
  'Amount was not received in administrator bank account',
  'Duplicate submission detected for the same payment transaction',
  'Transaction timestamp does not match submission details',
]

export function AdminWalletManagementPage() {
  const { tab = 'all' } = useParams()
  const navigate = useNavigate()
  const socket = useSocket()

  // Navigation tab: 'all' | 'users' | 'workers' | 'transactions'
  const activeTab = useMemo(() => {
    if (['all', 'users', 'workers', 'transactions'].includes(tab)) return tab
    return 'all'
  }, [tab])

  const setTab = (newTab) => {
    navigate(`/admin/wallet-management/${newTab}`)
  }

  // ==========================================
  // STATE: STATISTICS
  // ==========================================
  const [stats, setStats] = useState({
    totalRechargeRequests: 0,
    pendingRequests: 0,
    approvedRequests: 0,
    rejectedRequests: 0,
    totalApprovedRechargeAmount: 0,
    userRequestsCount: 0,
    workerRequestsCount: 0,
  })

  // ==========================================
  // STATE: RECHARGE REQUESTS LIST
  // ==========================================
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [requests, setRequests] = useState([])
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 15,
    total: 0,
    pages: 1,
  })

  // Filters
  const [statusFilter, setStatusFilter] = useState('ALL') // 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED'
  const [searchTerm, setSearchTerm] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [sortBy, setSortBy] = useState('newest') // 'newest' | 'oldest'

  // Debounce search input
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(searchTerm)
    }, 350)
    return () => clearTimeout(handler)
  }, [searchTerm])

  // Derive accountType query param based on active tab
  const tabAccountType = useMemo(() => {
    if (activeTab === 'users') return 'USER'
    if (activeTab === 'workers') return 'WORKER'
    return 'ALL'
  }, [activeTab])

  // ==========================================
  // STATE: TRANSACTIONS TAB
  // ==========================================
  const [txLoading, setTxLoading] = useState(false)
  const [transactions, setTransactions] = useState([])
  const [txPagination, setTxPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 1,
  })
  const [txTypeFilter, setTxTypeFilter] = useState('ALL')
  const [txAccountFilter, setTxAccountFilter] = useState('ALL')
  const [txSearch, setTxSearch] = useState('')

  // ==========================================
  // STATE: MODALS & ACTIONS
  // ==========================================
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [detailsLoading, setDetailsLoading] = useState(false)
  const [showDetailsModal, setShowDetailsModal] = useState(false)

  // Approve Confirmation Modal
  const [approveConfirmRequest, setApproveConfirmRequest] = useState(null)
  const [approving, setApproving] = useState(false)
  const [approvalRemarks, setApprovalRemarks] = useState('')

  // Reject Modal
  const [rejectModalRequest, setRejectModalRequest] = useState(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejectRemarks, setRejectRemarks] = useState('')
  const [rejecting, setRejecting] = useState(false)
  const [rejectionError, setRejectionError] = useState('')

  // Image Zoom Modal
  const [zoomedImage, setZoomedImage] = useState(null)

  // Copy Feedback
  const [copiedId, setCopiedId] = useState(null)

  const handleCopy = (text, id) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  // ==========================================
  // API CALLS
  // ==========================================
  const loadStats = useCallback(async () => {
    try {
      const res = await adminWalletApprovalApi.getWalletStatistics()
      if (res.data?.stats) {
        setStats(res.data.stats)
      }
    } catch (err) {
      console.warn('[Admin Wallet] Failed to load statistics:', err.message)
    }
  }, [])

  const loadRequests = useCallback(
    async (isManualRefresh = false) => {
      if (activeTab === 'transactions') return
      try {
        if (isManualRefresh) setRefreshing(true)
        else setLoading(true)

        const params = {
          page: pagination.page,
          limit: pagination.limit,
          accountType: tabAccountType,
          status: statusFilter !== 'ALL' ? statusFilter : undefined,
          search: debouncedSearch || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          sort: sortBy,
        }

        const res = await adminWalletApprovalApi.getRechargeRequests(params)
        if (res.data) {
          setRequests(res.data.requests || [])
          if (res.data.pagination) {
            setPagination((p) => ({ ...p, ...res.data.pagination }))
          }
          if (res.data.stats) {
            setStats((prev) => ({
              ...prev,
              totalRechargeRequests: res.data.stats.total,
              pendingRequests: res.data.stats.pending,
              approvedRequests: res.data.stats.approved,
              rejectedRequests: res.data.stats.rejected,
              totalApprovedRechargeAmount: res.data.stats.totalApprovedAmount,
            }))
          }
        }
      } catch (err) {
        console.error('[Admin Wallet] Failed to load requests:', err)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [
      activeTab,
      pagination.page,
      pagination.limit,
      tabAccountType,
      statusFilter,
      debouncedSearch,
      startDate,
      endDate,
      sortBy,
    ]
  )

  const loadTransactions = useCallback(async () => {
    if (activeTab !== 'transactions') return
    try {
      setTxLoading(true)
      const params = {
        page: txPagination.page,
        limit: txPagination.limit,
        accountType: txAccountFilter !== 'ALL' ? txAccountFilter : undefined,
        type: txTypeFilter !== 'ALL' ? txTypeFilter : undefined,
        search: txSearch || undefined,
      }
      const res = await adminWalletApprovalApi.getWalletTransactions(params)
      if (res.data) {
        setTransactions(res.data.transactions || [])
        if (res.data.pagination) {
          setTxPagination((p) => ({ ...p, ...res.data.pagination }))
        }
      }
    } catch (err) {
      console.error('[Admin Wallet] Failed to load transactions:', err)
    } finally {
      setTxLoading(false)
    }
  }, [activeTab, txPagination.page, txPagination.limit, txAccountFilter, txTypeFilter, txSearch])

  // Initial load
  useEffect(() => {
    loadStats()
  }, [loadStats])

  useEffect(() => {
    if (activeTab === 'transactions') {
      loadTransactions()
    } else {
      loadRequests()
    }
  }, [activeTab, loadRequests, loadTransactions])

  // Socket.IO event listener for real-time submission alerts
  useEffect(() => {
    if (!socket) return

    const handleRechargeSubmitted = () => {
      loadStats()
      if (activeTab !== 'transactions') {
        loadRequests(true)
      }
    }

    const handleRechargeUpdated = () => {
      loadStats()
      if (activeTab !== 'transactions') {
        loadRequests(true)
      } else {
        loadTransactions()
      }
    }

    socket.on('WALLET_RECHARGE_REQUEST_SUBMITTED', handleRechargeSubmitted)
    socket.on('WALLET_RECHARGE_UPDATED', handleRechargeUpdated)

    return () => {
      socket.off('WALLET_RECHARGE_REQUEST_SUBMITTED', handleRechargeSubmitted)
      socket.off('WALLET_RECHARGE_UPDATED', handleRechargeUpdated)
    }
  }, [socket, activeTab, loadStats, loadRequests, loadTransactions])

  // Stop any active alert sound when admin enters or leaves the wallet management screen
  useEffect(() => {
    stopBookingAlertSound()
    return () => {
      stopBookingAlertSound()
    }
  }, [])

  // View Details
  const handleViewDetails = async (reqItem) => {
    stopBookingAlertSound()
    try {
      setSelectedRequest(reqItem)
      setShowDetailsModal(true)
      setDetailsLoading(true)

      const res = await adminWalletApprovalApi.getRechargeRequestById(reqItem._id)
      if (res.data?.request) {
        setSelectedRequest(res.data.request)
      }
    } catch (err) {
      console.warn('[Admin Wallet] Could not fetch fresh request details:', err.message)
    } finally {
      setDetailsLoading(false)
    }
  }

  // Handle Approve
  const executeApprove = async () => {
    if (!approveConfirmRequest) return
    stopBookingAlertSound()
    try {
      setApproving(true)
      const res = await adminWalletApprovalApi.approveRechargeRequest(approveConfirmRequest._id, {
        adminRemarks: approvalRemarks,
      })

      // Update state locally
      setRequests((prev) =>
        prev.map((r) => (r._id === approveConfirmRequest._id ? res.data?.request || { ...r, status: 'APPROVED' } : r))
      )
      if (selectedRequest && selectedRequest._id === approveConfirmRequest._id) {
        setSelectedRequest(res.data?.request || { ...selectedRequest, status: 'APPROVED' })
      }

      setApproveConfirmRequest(null)
      setApprovalRemarks('')
      loadStats()
    } catch (err) {
      alert(`Approval Failed: ${err.message || 'Error processing request'}`)
    } finally {
      setApproving(false)
    }
  }

  // Handle Reject
  const executeReject = async () => {
    if (!rejectModalRequest) return
    stopBookingAlertSound()
    const cleanReason = String(rejectionReason || '').trim()
    if (!cleanReason) {
      setRejectionError('Please enter a rejection reason.')
      return
    }

    try {
      setRejecting(true)
      setRejectionError('')

      const res = await adminWalletApprovalApi.rejectRechargeRequest(rejectModalRequest._id, {
        rejectionReason: cleanReason,
        adminRemarks: rejectRemarks,
      })

      setRequests((prev) =>
        prev.map((r) => (r._id === rejectModalRequest._id ? res.data?.request || { ...r, status: 'REJECTED' } : r))
      )
      if (selectedRequest && selectedRequest._id === rejectModalRequest._id) {
        setSelectedRequest(res.data?.request || { ...selectedRequest, status: 'REJECTED', rejectionReason: cleanReason })
      }

      setRejectModalRequest(null)
      setRejectionReason('')
      setRejectRemarks('')
      loadStats()
    } catch (err) {
      setRejectionError(err.message || 'Failed to reject request')
    } finally {
      setRejecting(false)
    }
  }

  const handleOpenApprove = (req) => {
    stopBookingAlertSound()
    setApproveConfirmRequest(req)
  }

  const handleOpenReject = (req) => {
    stopBookingAlertSound()
    setRejectModalRequest(req)
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-7xl mx-auto">
      {/* Top Banner Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-teal-600/10 text-teal-700">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">Wallet Management</h1>
              <p className="text-xs font-semibold text-slate-500">
                Centralized verification & approval dashboard for User and Worker wallet recharges
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              loadStats()
              if (activeTab === 'transactions') loadTransactions()
              else loadRequests(true)
            }}
            disabled={loading || refreshing || txLoading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition shadow-xs disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing || txLoading ? 'animate-spin text-teal-600' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Submenu Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => setTab('all')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'all'
              ? 'bg-teal-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Wallet className="w-4 h-4" />
          All Recharge Requests
        </button>

        <button
          type="button"
          onClick={() => setTab('users')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'users'
              ? 'bg-teal-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Users className="w-4 h-4" />
          User Recharge Requests
          {stats.userRequestsCount > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === 'users' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {stats.userRequestsCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setTab('workers')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'workers'
              ? 'bg-teal-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Wrench className="w-4 h-4" />
          Worker Recharge Requests
          {stats.workerRequestsCount > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-black ${
              activeTab === 'workers' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
            }`}>
              {stats.workerRequestsCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setTab('transactions')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
            activeTab === 'transactions'
              ? 'bg-teal-700 text-white shadow-sm'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Wallet Transaction History
        </button>
      </div>

      {/* DASHBOARD STATISTICS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Total Requests */}
        <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-bold uppercase tracking-wider">Total Requests</span>
            <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-slate-900">{stats.totalRechargeRequests.toLocaleString('en-IN')}</p>
            <p className="text-[11px] font-semibold text-slate-400 mt-0.5">All time submissions</p>
          </div>
        </div>

        {/* Pending Requests */}
        <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-700">
            <span className="text-xs font-bold uppercase tracking-wider">Pending</span>
            <div className="p-2 rounded-xl bg-amber-100 text-amber-800">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-amber-900">{stats.pendingRequests.toLocaleString('en-IN')}</p>
            <p className="text-[11px] font-semibold text-amber-700 mt-0.5">Awaiting verification</p>
          </div>
        </div>

        {/* Approved Requests */}
        <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-700">
            <span className="text-xs font-bold uppercase tracking-wider">Approved</span>
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-emerald-900">{stats.approvedRequests.toLocaleString('en-IN')}</p>
            <p className="text-[11px] font-semibold text-emerald-700 mt-0.5">Credited to wallet</p>
          </div>
        </div>

        {/* Rejected Requests */}
        <div className="p-4 rounded-2xl bg-rose-50/60 border border-rose-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-rose-700">
            <span className="text-xs font-bold uppercase tracking-wider">Rejected</span>
            <div className="p-2 rounded-xl bg-rose-100 text-rose-800">
              <XCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-rose-900">{stats.rejectedRequests.toLocaleString('en-IN')}</p>
            <p className="text-[11px] font-semibold text-rose-700 mt-0.5">Declined / invalid</p>
          </div>
        </div>

        {/* Total Approved Amount */}
        <div className="col-span-2 lg:col-span-1 p-4 rounded-2xl bg-teal-50/70 border border-teal-200/80 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-teal-800">
            <span className="text-xs font-bold uppercase tracking-wider">Total Approved</span>
            <div className="p-2 rounded-xl bg-teal-100 text-teal-900">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <p className="text-2xl font-black text-teal-900">{formatInr(stats.totalApprovedRechargeAmount)}</p>
            <p className="text-[11px] font-semibold text-teal-700 mt-0.5">Recharge volume credited</p>
          </div>
        </div>
      </div>

      {/* CONDITIONAL TAB CONTENT */}
      {activeTab !== 'transactions' ? (
        /* RECHARGE REQUESTS TABLE & FILTERS */
        <div className="space-y-4">
          {/* Filter Bar */}
          <GlassPanel className="p-4 space-y-3">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              {/* Search input */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name, mobile, request ID, UTR..."
                  className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Status Filter Chips */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
                {['ALL', 'PENDING', 'APPROVED', 'REJECTED'].map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusFilter(st)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                      statusFilter === st
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {st === 'ALL' ? 'All Status' : st}
                  </button>
                ))}
              </div>
            </div>

            {/* Date range & Sorting Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-slate-500 flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> Date:
                </span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700"
                />
                <span className="text-slate-400">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-700"
                />
                {(startDate || endDate) && (
                  <button
                    type="button"
                    onClick={() => {
                      setStartDate('')
                      setEndDate('')
                    }}
                    className="text-xs text-teal-700 hover:underline font-bold"
                  >
                    Clear dates
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-500">Sort:</span>
                <button
                  type="button"
                  onClick={() => setSortBy((s) => (s === 'newest' ? 'oldest' : 'newest'))}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-50"
                >
                  <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  {sortBy === 'newest' ? 'Newest First' : 'Oldest First'}
                </button>
              </div>
            </div>
          </GlassPanel>

          {/* Table Container */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {loading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
                <p className="text-xs font-semibold text-slate-500">Loading wallet recharge requests...</p>
              </div>
            ) : requests.length === 0 ? (
              <div className="py-20 text-center space-y-2">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                  <Wallet className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-slate-800">No recharge requests found</p>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {searchTerm || statusFilter !== 'ALL' || startDate
                    ? 'No requests match your current filters. Try resetting the search or filter criteria.'
                    : 'Recharge requests submitted by users and workers will appear here for verification.'}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 uppercase tracking-wider font-extrabold text-[11px]">
                      <th className="py-3 px-4">Request ID</th>
                      <th className="py-3 px-4">User / Worker Name</th>
                      <th className="py-3 px-4">Account Type</th>
                      <th className="py-3 px-4">Mobile Number</th>
                      <th className="py-3 px-4">Requested Amount</th>
                      <th className="py-3 px-4">UTR / Transaction ID</th>
                      <th className="py-3 px-4">Request Date</th>
                      <th className="py-3 px-4">Payment Screenshot</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {requests.map((r) => {
                      const isPending = r.status === 'PENDING'
                      const isApproved = r.status === 'APPROVED'
                      const isRejected = r.status === 'REJECTED'
                      const isWorker = r.accountType === 'WORKER'

                      return (
                        <tr key={r._id} className="hover:bg-slate-50/70 transition-colors">
                          {/* Request ID */}
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                            <div className="flex items-center gap-1.5">
                              <span>#{String(r._id).slice(-6).toUpperCase()}</span>
                              <button
                                type="button"
                                onClick={() => handleCopy(String(r._id), `req_${r._id}`)}
                                title="Copy full Request ID"
                                className="text-slate-400 hover:text-slate-600 p-0.5 rounded"
                              >
                                {copiedId === `req_${r._id}` ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                          </td>

                          {/* User/Worker Name */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-600 shrink-0 text-xs">
                                {r.userId?.avatar ? (
                                  <img
                                    src={r.userId.avatar}
                                    alt=""
                                    className="w-full h-full rounded-full object-cover"
                                  />
                                ) : (
                                  (r.userId?.fullName || 'U').charAt(0).toUpperCase()
                                )}
                              </div>
                              <div className="min-w-0">
                                <p className="font-bold text-slate-900 truncate">
                                  {r.userId?.fullName || 'Registered User'}
                                </p>
                                <p className="text-[10px] text-slate-400 truncate">{r.userId?.email || '—'}</p>
                              </div>
                            </div>
                          </td>

                          {/* Account Type */}
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                isWorker
                                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                  : 'bg-blue-100 text-blue-800 border border-blue-200'
                              }`}
                            >
                              {isWorker ? <Wrench className="w-3 h-3" /> : <User className="w-3 h-3" />}
                              {r.accountType}
                            </span>
                          </td>

                          {/* Mobile Number */}
                          <td className="py-3.5 px-4 text-slate-600 font-mono text-xs">
                            <div className="flex items-center gap-1">
                              <Phone className="w-3 h-3 text-slate-400" />
                              <span>{r.userId?.phone || '—'}</span>
                            </div>
                          </td>

                          {/* Requested Amount */}
                          <td className="py-3.5 px-4">
                            <span className="text-sm font-black text-slate-900">{formatInr(r.amount)}</span>
                          </td>

                          {/* UTR / Transaction ID */}
                          <td className="py-3.5 px-4 font-mono font-bold text-slate-800">
                            <div className="flex items-center gap-1.5">
                              <span className="bg-slate-100 px-2 py-0.5 rounded text-[11px] text-slate-800 select-all">
                                {r.utrNumber || '—'}
                              </span>
                              {r.utrNumber && (
                                <button
                                  type="button"
                                  onClick={() => handleCopy(r.utrNumber, `utr_${r._id}`)}
                                  title="Copy UTR"
                                  className="text-slate-400 hover:text-slate-600 p-0.5 rounded"
                                >
                                  {copiedId === `utr_${r._id}` ? (
                                    <Check className="w-3 h-3 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3 h-3" />
                                  )}
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Request Date */}
                          <td className="py-3.5 px-4 text-slate-500 whitespace-nowrap">
                            {formatDate(r.createdAt)}
                          </td>

                          {/* Payment Screenshot */}
                          <td className="py-3.5 px-4">
                            {r.paymentScreenshot ? (
                              <button
                                type="button"
                                onClick={() => setZoomedImage(r.paymentScreenshot)}
                                className="group relative w-12 h-12 rounded-xl overflow-hidden border border-slate-200 shadow-2xs hover:ring-2 hover:ring-teal-500 transition block"
                                title="Click to view payment receipt"
                              >
                                <img
                                  src={r.paymentScreenshot}
                                  alt="Receipt"
                                  className="w-full h-full object-cover group-hover:scale-110 transition duration-200"
                                />
                                <div className="absolute inset-0 bg-slate-950/20 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                                  <ZoomIn className="w-4 h-4" />
                                </div>
                              </button>
                            ) : (
                              <span className="text-slate-400 italic">No receipt</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3.5 px-4">
                            {isPending && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-amber-100 text-amber-800 border border-amber-200">
                                <Clock className="w-3 h-3 text-amber-600" />
                                Pending
                              </span>
                            )}
                            {isApproved && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                Approved
                              </span>
                            )}
                            {isRejected && (
                              <span
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-200 cursor-help"
                                title={`Rejected: ${r.rejectionReason || 'No reason specified'}`}
                              >
                                <XCircle className="w-3 h-3 text-rose-600" />
                                Rejected
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleViewDetails(r)}
                                className="p-1.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-teal-700 transition"
                                title="View Request Details"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {isPending && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenApprove(r)}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-2xs"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenReject(r)}
                                    className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition shadow-2xs"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination footer */}
            {!loading && requests.length > 0 && (
              <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-medium">
                <div>
                  Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                  {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} requests
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={pagination.page <= 1}
                    onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  <span className="px-3 py-1 font-bold text-slate-800">
                    Page {pagination.page} of {pagination.pages || 1}
                  </span>

                  <button
                    type="button"
                    disabled={pagination.page >= pagination.pages}
                    onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* WALLET TRANSACTION HISTORY TAB */
        <div className="space-y-4">
          <GlassPanel className="p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={txSearch}
                onChange={(e) => setTxSearch(e.target.value)}
                placeholder="Search ledger by transaction ID, user, UTR, or description..."
                className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <select
                value={txAccountFilter}
                onChange={(e) => setTxAccountFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700"
              >
                <option value="ALL">All Account Types</option>
                <option value="USER">User Wallets</option>
                <option value="WORKER">Worker Wallets</option>
              </select>

              <select
                value={txTypeFilter}
                onChange={(e) => setTxTypeFilter(e.target.value)}
                className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700"
              >
                <option value="ALL">All Transaction Types</option>
                <option value="CREDIT">Credits</option>
                <option value="DEBIT">Debits</option>
              </select>
            </div>
          </GlassPanel>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {txLoading ? (
              <div className="py-20 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
                <p className="text-xs font-semibold text-slate-500">Loading wallet transaction ledger...</p>
              </div>
            ) : transactions.length === 0 ? (
              <div className="py-20 text-center space-y-2">
                <BarChart3 className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-800">No transaction records found</p>
                <p className="text-xs text-slate-500">Financial entries will appear here once approved or transacted.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-slate-500 uppercase tracking-wider font-extrabold text-[11px]">
                      <th className="py-3 px-4">Date & Time</th>
                      <th className="py-3 px-4">Account Holder</th>
                      <th className="py-3 px-4">Account Type</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Context</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Balance Before</th>
                      <th className="py-3 px-4">Balance After</th>
                      <th className="py-3 px-4">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {transactions.map((t) => {
                      const isCredit = t.type === 'CREDIT'
                      const isWorker = t.accountType === 'WORKER' || t.labourId || t.userId?.role === 'labour'

                      return (
                        <tr key={t._id} className="hover:bg-slate-50/70 transition-colors">
                          <td className="py-3 px-4 whitespace-nowrap text-slate-500">{formatDate(t.createdAt)}</td>
                          <td className="py-3 px-4 font-bold text-slate-900">
                            {t.userId?.fullName || t.labourId?.fullName || 'User'}
                            <span className="block text-[10px] text-slate-400 font-normal">
                              {t.userId?.phone || t.labourId?.phone || ''}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] font-black ${
                                isWorker ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {isWorker ? 'WORKER' : 'USER'}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-black">
                            <span
                              className={`inline-block px-2 py-0.5 rounded text-[10px] ${
                                isCredit ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {t.type}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-bold text-slate-600">{t.context}</td>
                          <td className={`py-3 px-4 font-black text-sm ${isCredit ? 'text-emerald-600' : 'text-slate-900'}`}>
                            {isCredit ? '+' : '-'} {formatInr(t.amount)}
                          </td>
                          <td className="py-3 px-4 font-mono text-slate-500">{formatInr(t.balanceBefore)}</td>
                          <td className="py-3 px-4 font-mono font-bold text-slate-900">{formatInr(t.balanceAfter)}</td>
                          <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={t.description}>
                            {t.description || '—'}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Transactions pagination footer */}
            {!txLoading && transactions.length > 0 && (
              <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
                <div>Total {txPagination.total} ledger entries</div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={txPagination.page <= 1}
                    onClick={() => setTxPagination((p) => ({ ...p, page: p.page - 1 }))}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="px-3 py-1 font-bold text-slate-800">
                    Page {txPagination.page} of {txPagination.pages || 1}
                  </span>
                  <button
                    type="button"
                    disabled={txPagination.page >= txPagination.pages}
                    onClick={() => setTxPagination((p) => ({ ...p, page: p.page + 1 }))}
                    className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 1: VIEW DETAILS MODAL                               */}
      {/* ======================================================== */}
      {showDetailsModal && selectedRequest && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 bg-gradient-to-r from-teal-800 to-teal-900 text-white flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-teal-200">Recharge Request Details</span>
                <h3 className="text-lg font-black mt-0.5">#{String(selectedRequest._id).slice(-8).toUpperCase()}</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowDetailsModal(false)}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {detailsLoading && (
                <div className="flex items-center gap-2 p-2 bg-teal-50 text-teal-700 rounded-lg text-xs font-semibold">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Fetching latest live wallet balance...
                </div>
              )}

              {/* Account & Request Overview Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-200/80 text-xs">
                <div>
                  <span className="text-slate-400 font-bold uppercase text-[10px] block">Account Holder</span>
                  <span className="font-extrabold text-slate-900 text-sm">{selectedRequest.userId?.fullName || '—'}</span>
                </div>

                <div>
                  <span className="text-slate-400 font-bold uppercase text-[10px] block">Account Type</span>
                  <span
                    className={`inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-black ${
                      selectedRequest.accountType === 'WORKER'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {selectedRequest.accountType}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 font-bold uppercase text-[10px] block">Registered Mobile</span>
                  <span className="font-mono font-bold text-slate-800">{selectedRequest.userId?.phone || '—'}</span>
                </div>

                <div>
                  <span className="text-slate-400 font-bold uppercase text-[10px] block">Current Wallet Balance</span>
                  <span className="font-extrabold text-teal-700 text-sm">
                    {formatInr(selectedRequest.currentWalletBalance ?? 0)}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 font-bold uppercase text-[10px] block">Requested Amount</span>
                  <span className="font-extrabold text-slate-900 text-base">
                    {formatInr(selectedRequest.amount)}
                  </span>
                </div>

                <div>
                  <span className="text-slate-400 font-bold uppercase text-[10px] block">Payment Mode</span>
                  <span className="font-bold text-slate-800">{selectedRequest.paymentMode || 'UPI_QR'}</span>
                </div>

                <div className="col-span-2 sm:col-span-3">
                  <span className="text-slate-400 font-bold uppercase text-[10px] block">UTR / Transaction ID</span>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono font-bold text-slate-900 bg-white px-2.5 py-1 rounded border border-slate-200 select-all">
                      {selectedRequest.utrNumber}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(selectedRequest.utrNumber, 'modal_utr')}
                      className="text-xs text-teal-700 hover:underline font-bold flex items-center gap-1"
                    >
                      {copiedId === 'modal_utr' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      Copy
                    </button>
                  </div>
                </div>

                <div>
                  <span className="text-slate-400 font-bold uppercase text-[10px] block">Submitted Date & Time</span>
                  <span className="font-medium text-slate-700">{formatDate(selectedRequest.createdAt)}</span>
                </div>

                <div>
                  <span className="text-slate-400 font-bold uppercase text-[10px] block">Request Status</span>
                  <span
                    className={`inline-block mt-0.5 px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                      selectedRequest.status === 'APPROVED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : selectedRequest.status === 'REJECTED'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {selectedRequest.status}
                  </span>
                </div>
              </div>

              {/* Status Specific Review Info */}
              {selectedRequest.status === 'REJECTED' && (
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 space-y-1.5 text-xs text-rose-900">
                  <p className="font-black flex items-center gap-1.5">
                    <XCircle className="w-4 h-4 text-rose-600" />
                    Rejection Reason:
                  </p>
                  <p className="font-semibold text-rose-800 pl-5">{selectedRequest.rejectionReason}</p>
                  {selectedRequest.reviewedAt && (
                    <p className="text-[10px] text-rose-600 pl-5 pt-1">
                      Reviewed on {formatDate(selectedRequest.reviewedAt)} by {selectedRequest.reviewedBy?.fullName || 'Admin'}
                    </p>
                  )}
                </div>
              )}

              {selectedRequest.status === 'APPROVED' && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1.5 text-xs text-emerald-900">
                  <p className="font-black flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Approval & Credit Details:
                  </p>
                  <div className="pl-5 space-y-0.5 text-emerald-800 font-medium">
                    <p>Amount ₹{selectedRequest.amount} successfully credited to wallet.</p>
                    {selectedRequest.financialActionDetails?.balanceAfter !== undefined && (
                      <p>Balance after credit: ₹{selectedRequest.financialActionDetails.balanceAfter}</p>
                    )}
                    {selectedRequest.reviewedAt && (
                      <p className="text-[10px] text-emerald-700 pt-1">
                        Approved on {formatDate(selectedRequest.reviewedAt)} by {selectedRequest.reviewedBy?.fullName || 'Admin'}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Payment Screenshot Preview */}
              <div className="space-y-2">
                <span className="text-xs font-bold text-slate-700 block uppercase tracking-wider">
                  Uploaded Payment Screenshot / Receipt:
                </span>
                {selectedRequest.paymentScreenshot ? (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-2 overflow-hidden flex flex-col items-center">
                    <img
                      src={selectedRequest.paymentScreenshot}
                      alt="Uploaded Screenshot"
                      className="max-h-80 w-auto rounded-xl object-contain cursor-zoom-in"
                      onClick={() => setZoomedImage(selectedRequest.paymentScreenshot)}
                    />
                    <div className="w-full flex justify-between items-center pt-2 px-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setZoomedImage(selectedRequest.paymentScreenshot)}
                        className="text-teal-700 hover:underline font-bold flex items-center gap-1"
                      >
                        <ZoomIn className="w-3.5 h-3.5" /> Fullscreen Zoom
                      </button>
                      <a
                        href={selectedRequest.paymentScreenshot}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-500 hover:text-slate-700 font-bold flex items-center gap-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" /> Open in New Tab
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-xs text-slate-400">
                    No screenshot attached to this request.
                  </div>
                )}
              </div>
            </div>

            {/* Modal Actions Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setShowDetailsModal(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 transition"
              >
                Close
              </button>

              {selectedRequest.status === 'PENDING' && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleOpenReject(selectedRequest)
                      setShowDetailsModal(false)
                    }}
                    className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition shadow-xs"
                  >
                    Reject Request
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleOpenApprove(selectedRequest)
                      setShowDetailsModal(false)
                    }}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-xs"
                  >
                    Approve Recharge
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 2: APPROVE CONFIRMATION POPUP                       */}
      {/* ======================================================== */}
      {approveConfirmRequest && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-emerald-100 text-emerald-800">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Confirm Wallet Credit</h3>
                <p className="text-xs text-slate-500">Please review before crediting funds</p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 text-xs space-y-2 text-emerald-950">
              <div className="flex justify-between">
                <span className="font-semibold text-emerald-800">Account Holder:</span>
                <span className="font-black text-slate-900">{approveConfirmRequest.userId?.fullName || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-emerald-800">Account Type:</span>
                <span className="font-bold">{approveConfirmRequest.accountType}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-emerald-800">UTR / Ref Number:</span>
                <span className="font-mono font-bold text-slate-900">{approveConfirmRequest.utrNumber}</span>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t border-emerald-200">
                <span className="font-bold text-emerald-900">Recharge Amount:</span>
                <span className="text-xl font-black text-emerald-900">{formatInr(approveConfirmRequest.amount)}</span>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Upon approval, <strong>{formatInr(approveConfirmRequest.amount)}</strong> will be credited directly to the
              holder&apos;s existing wallet and an immutable transaction ledger entry will be created.
            </p>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">Admin Remarks (Optional)</label>
              <input
                type="text"
                value={approvalRemarks}
                onChange={(e) => setApprovalRemarks(e.target.value)}
                placeholder="e.g. Verified with bank statement"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setApproveConfirmRequest(null)
                  setApprovalRemarks('')
                }}
                disabled={approving}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeApprove}
                disabled={approving}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition shadow-sm disabled:opacity-50"
              >
                {approving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Crediting Wallet...
                  </>
                ) : (
                  'Yes, Confirm Approval'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 3: REJECT REQUEST POPUP                             */}
      {/* ======================================================== */}
      {rejectModalRequest && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-rose-100 text-rose-800">
                <XCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">Reject Recharge Request</h3>
                <p className="text-xs text-slate-500">Provide a mandatory reason for the rejection</p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Holder:</span>
                <span className="font-bold text-slate-800">{rejectModalRequest.userId?.fullName || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Requested Amount:</span>
                <span className="font-bold text-slate-800">{formatInr(rejectModalRequest.amount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">UTR:</span>
                <span className="font-mono font-bold text-slate-800">{rejectModalRequest.utrNumber}</span>
              </div>
            </div>

            {/* Quick Rejection Reasons */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-slate-600 block">Quick Reason Suggestions:</label>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_REJECTION_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setRejectionReason(r)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-slate-100 text-slate-700 hover:bg-slate-200 transition text-left"
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>

            {/* Mandatory Reason Input */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-800">
                Rejection Reason <span className="text-rose-600">*</span>
              </label>
              <textarea
                rows={3}
                value={rejectionReason}
                onChange={(e) => {
                  setRejectionReason(e.target.value)
                  if (rejectionError) setRejectionError('')
                }}
                placeholder="Explain why this request is being rejected..."
                className="w-full p-3 rounded-xl border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
              {rejectionError && <p className="text-xs font-bold text-rose-600">{rejectionError}</p>}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setRejectModalRequest(null)
                  setRejectionReason('')
                  setRejectionError('')
                }}
                disabled={rejecting}
                className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeReject}
                disabled={rejecting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition shadow-sm disabled:opacity-50"
              >
                {rejecting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Rejecting...
                  </>
                ) : (
                  'Confirm Rejection'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL 4: IMAGE ZOOM OVERLAY                               */}
      {/* ======================================================== */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4"
          onClick={() => setZoomedImage(null)}
        >
          <div className="relative max-w-3xl max-h-[90vh] overflow-hidden rounded-2xl bg-black" onClick={(e) => e.stopPropagation()}>
            <img src={zoomedImage} alt="Payment Receipt Zoom" className="max-w-full max-h-[85vh] object-contain mx-auto" />
            <button
              type="button"
              onClick={() => setZoomedImage(null)}
              className="absolute top-3 right-3 p-2 rounded-xl bg-black/60 text-white hover:bg-black transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
