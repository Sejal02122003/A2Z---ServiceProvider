import { useEffect, useState, useMemo } from 'react'
import {
  Wallet,
  Clock,
  CheckCircle2,
  XCircle,
  Download,
  Search,
  Filter,
  Eye,
  X,
  UserCircle,
  Landmark,
  QrCode,
  Trash2,
  Settings,
  FileText,
  Sliders,
  DollarSign,
  Percent,
  RefreshCw,
  PlusCircle,
  MinusCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import { adminBookingsApi } from '../../api/adminBookingsApi.js'
import { adminWalletsApi } from '../../api/adminWalletsApi.js'
import { walletsApi } from '../../api/walletsApi.js'

export function AdminLabourWalletPage() {
  const [activeTab, setActiveTab] = useState('overview') // overview, settings, ledger, users
  const [loading, setLoading] = useState(true)

  // Overview / Payouts State
  const [bookings, setBookings] = useState([])
  const [withdrawals, setWithdrawals] = useState([])
  const [stats, setStats] = useState(null)

  // Filters for Payout History
  const [historyFilter, setHistoryFilter] = useState('ALL')
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Modal State
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [rejecting, setRejecting] = useState(false)
  const [rejectNote, setRejectNote] = useState('')
  const [recordToDelete, setRecordToDelete] = useState(null)

  // Settings State
  const [settings, setSettings] = useState({
    enabled: true,
    minimumLabourWalletBalance: 0,
    welcomeBonusAmount: 100,
    walletDiscountPercentage: 20,
    minimumBookingAmount: 0,
  })
  const [savingSettings, setSavingSettings] = useState(false)
  const [settingsMsg, setSettingsMsg] = useState({ type: '', text: '' })

  // Ledger / Transactions State
  const [ledgerTransactions, setLedgerTransactions] = useState([])
  const [ledgerLoading, setLedgerLoading] = useState(false)
  const [ledgerSearch, setLedgerSearch] = useState('')
  const [ledgerContext, setLedgerContext] = useState('')
  const [ledgerType, setLedgerType] = useState('')
  const [ledgerPage, setLedgerPage] = useState(1)
  const [ledgerTotalPages, setLedgerTotalPages] = useState(1)

  // Labour Accounts & Adjustments State
  const [labourUsers, setLabourUsers] = useState([])
  const [labourLoading, setLabourLoading] = useState(false)
  const [labourSearch, setLabourSearch] = useState('')
  const [adjustModalUser, setAdjustModalUser] = useState(null)
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustType, setAdjustType] = useState('CREDIT')
  const [adjustReason, setAdjustReason] = useState('')
  const [adjusting, setAdjusting] = useState(false)
  const [adjustError, setAdjustError] = useState('')

  // Initial Data Fetch
  const fetchOverviewData = async () => {
    setLoading(true)
    try {
      const [bookingsRes, wRes, statsRes, settingsRes] = await Promise.all([
        adminBookingsApi.getAllBookings({ limit: 5000 }).catch(() => ({})),
        adminWalletsApi.getAllWithdrawals().catch(() => ({})),
        adminWalletsApi.getLabourWalletStats().catch(() => ({})),
        adminWalletsApi.getWalletSettings().catch(() => ({})),
      ])

      const allB = bookingsRes?.data?.bookings || bookingsRes?.bookings || bookingsRes || []
      setBookings(Array.isArray(allB) ? allB : [])

      const fetchedWithdrawals = wRes?.data?.requests || wRes?.data || []
      setWithdrawals(Array.isArray(fetchedWithdrawals) ? fetchedWithdrawals : [])

      if (statsRes?.data?.stats) {
        setStats(statsRes.data.stats)
      }

      if (settingsRes?.data?.settings) {
        setSettings(settingsRes.data.settings)
      }
    } catch (err) {
      console.error('Failed to fetch admin wallet overview:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOverviewData()
  }, [])

  // Fetch Ledger Transactions
  const fetchLedger = async () => {
    setLedgerLoading(true)
    try {
      const res = await adminWalletsApi.getAllWalletTransactions({
        search: ledgerSearch,
        context: ledgerContext,
        type: ledgerType,
        page: ledgerPage,
        limit: 15,
      })
      setLedgerTransactions(res?.data?.transactions || [])
      setLedgerTotalPages(res?.data?.pagination?.pages || 1)
    } catch (err) {
      console.error('Failed to fetch ledger:', err)
    } finally {
      setLedgerLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'ledger') {
      fetchLedger()
    }
  }, [activeTab, ledgerPage, ledgerContext, ledgerType])

  // Fetch Labour Users List
  const fetchLabourUsers = async () => {
    setLabourLoading(true)
    try {
      const res = await walletsApi.getAdminUserWallets({
        search: labourSearch,
        role: 'labour',
        limit: 50,
      })
      setLabourUsers(res?.data?.users || [])
    } catch (err) {
      console.error('Failed to fetch labour accounts:', err)
    } finally {
      setLabourLoading(false)
    }
  }

  useEffect(() => {
    if (activeTab === 'users') {
      fetchLabourUsers()
    }
  }, [activeTab])

  // Save Settings Handler
  const handleSaveSettings = async (e) => {
    e.preventDefault()
    setSavingSettings(true)
    setSettingsMsg({ type: '', text: '' })

    const minBalance = Number(settings.minimumLabourWalletBalance)
    if (isNaN(minBalance) || minBalance < 0) {
      setSettingsMsg({ type: 'error', text: 'Minimum balance must not be negative' })
      setSavingSettings(false)
      return
    }

    try {
      await adminWalletsApi.updateWalletSettings({
        enabled: settings.enabled,
        minimumLabourWalletBalance: minBalance,
        welcomeBonusAmount: Number(settings.welcomeBonusAmount || 0),
        walletDiscountPercentage: Number(settings.walletDiscountPercentage || 0),
      })
      setSettingsMsg({ type: 'success', text: 'Wallet settings saved successfully' })
      fetchOverviewData()
    } catch (err) {
      setSettingsMsg({ type: 'error', text: err.message || 'Failed to update settings' })
    } finally {
      setSavingSettings(false)
    }
  }

  // Adjust Wallet Balance Handler
  const handleAdjustBalance = async () => {
    if (!adjustModalUser) return
    const num = Number(adjustAmount)
    if (isNaN(num) || num <= 0) {
      setAdjustError('Please enter a valid amount greater than 0')
      return
    }
    if (!adjustReason.trim()) {
      setAdjustError('Reason is required for audit trail')
      return
    }

    setAdjusting(true)
    setAdjustError('')

    try {
      await walletsApi.adjustAdminUserWallet(adjustModalUser._id, {
        amount: num,
        type: adjustType,
        reason: adjustReason.trim(),
      })
      setAdjustModalUser(null)
      setAdjustAmount('')
      setAdjustReason('')
      fetchLabourUsers()
      fetchOverviewData()
    } catch (err) {
      setAdjustError(err.message || 'Adjustment failed')
    } finally {
      setAdjusting(false)
    }
  }

  // Action Handlers for Payouts
  const handleUpdateStatus = async (id, status, remarks = '') => {
    setWithdrawals((prev) =>
      prev.map((w) => (w._id === id ? { ...w, status, adminRemarks: remarks } : w))
    )
    setSelectedRequest(null)
    setRejecting(false)
    setRejectNote('')
    try {
      await adminWalletsApi.updateWithdrawalStatus(id, status, remarks)
    } catch (err) {
      console.warn('Backend patch failed', err)
      setWithdrawals((prev) => prev.map((w) => (w._id === id ? { ...w, status: 'PENDING' } : w)))
      alert('Failed to update status')
    }
  }

  const handleDeleteHistory = (id) => {
    setRecordToDelete(id)
  }

  const confirmDeleteHistory = async () => {
    if (!recordToDelete) return
    const id = recordToDelete
    setRecordToDelete(null)

    try {
      await adminWalletsApi.deleteWithdrawalRequest(id)
      setWithdrawals((prev) => prev.filter((w) => w._id !== id))
    } catch (err) {
      console.error('Failed to delete history record:', err)
      alert('Failed to delete record')
    }
  }

  // Metrics
  const pendingAmount = useMemo(() => {
    return withdrawals
      .filter((w) => w.status === 'PENDING')
      .reduce((sum, w) => sum + (w.amount || 0), 0)
  }, [withdrawals])

  const totalPaidOut = useMemo(() => {
    return withdrawals
      .filter((w) => w.status === 'APPROVED')
      .reduce((sum, w) => sum + (w.amount || 0), 0)
  }, [withdrawals])

  const pendingWithdrawals = useMemo(() => {
    return withdrawals
      .filter((w) => w.status === 'PENDING')
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
  }, [withdrawals])

  const historyWithdrawals = useMemo(() => {
    return withdrawals
      .filter((w) => {
        if (w.status === 'PENDING') return false
        if (historyFilter !== 'ALL' && w.status !== historyFilter) return false

        if (searchTerm) {
          const lowerSearch = searchTerm.toLowerCase()
          const idMatch = w._id?.toLowerCase().includes(lowerSearch)
          const nameMatch = w.labourId?.fullName?.toLowerCase().includes(lowerSearch)
          if (!idMatch && !nameMatch) return false
        }
        return true
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }, [withdrawals, historyFilter, searchTerm])

  const totalPages = Math.ceil(historyWithdrawals.length / itemsPerPage)
  const currentHistory = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return historyWithdrawals.slice(start, start + itemsPerPage)
  }, [historyWithdrawals, currentPage])

  return (
    <div className="space-y-6 relative pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Labour Wallet & Recovery Management
          </h1>
          <p className="text-sm text-slate-500">
            Manage minimum balance settings, track platform charges recovery (Commission, Platform Fee, GST), process settlements and audit ledger.
          </p>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="overflow-hidden rounded-2xl border border-blue-100 bg-blue-50/50 p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-800/70">Total Commission Recovered</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-blue-700">
              ₹{(stats?.totalCommissionRecovered || 0).toLocaleString('en-IN')}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-blue-600">Deducted from completed cash bookings</p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-800/70">Total Platform Fees Recovered</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-indigo-700">
              ₹{(stats?.totalPlatformFeesRecovered || 0).toLocaleString('en-IN')}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-indigo-600">Platform operational fees</p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-emerald-100 bg-emerald-50/50 p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-emerald-800/70">Total GST Recovered</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-emerald-700">
              ₹{(stats?.totalGstRecovered || 0).toLocaleString('en-IN')}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-emerald-600">Applicable tax recovery</p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50/70 p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Labour Wallet Balances</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">
              ₹{(stats?.totalLabourBalance || 0).toLocaleString('en-IN')}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-slate-500">
            Across {stats?.totalLabourAccounts || 0} active workers
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition whitespace-nowrap ${
            activeTab === 'overview'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
          }`}
        >
          <Clock className="h-4 w-4" />
          Payout Requests & Overview
        </button>

        <button
          onClick={() => setActiveTab('ledger')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition whitespace-nowrap ${
            activeTab === 'ledger'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
          }`}
        >
          <FileText className="h-4 w-4" />
          Wallet Transaction Ledger
        </button>

        <button
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition whitespace-nowrap ${
            activeTab === 'users'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
          }`}
        >
          <UserCircle className="h-4 w-4" />
          Labour Accounts & Balances
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-bold transition whitespace-nowrap ${
            activeTab === 'settings'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800'
          }`}
        >
          <Settings className="h-4 w-4" />
          Wallet Configuration
        </button>
      </div>

      {/* TAB 1: OVERVIEW & PAYOUTS */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Pending Requests Section */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              <h3 className="font-bold text-slate-900">Pending Withdrawal Payouts</h3>
              <span className="ml-auto rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                {pendingWithdrawals.length} New
              </span>
            </div>

            <div className="p-0 overflow-x-auto">
              {loading ? (
                <div className="p-8 text-center text-sm font-medium text-slate-500 animate-pulse">
                  Loading requests...
                </div>
              ) : pendingWithdrawals.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 text-slate-500">
                  <CheckCircle2 className="h-10 w-10 text-emerald-300 mb-2" />
                  <p className="text-sm font-semibold text-slate-600">All caught up!</p>
                  <p className="text-xs">No pending withdrawal requests.</p>
                </div>
              ) : (
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="border-b border-slate-100 text-xs uppercase text-slate-400">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Labourer</th>
                      <th className="px-6 py-3 font-semibold">Amount</th>
                      <th className="px-6 py-3 font-semibold">Requested</th>
                      <th className="px-6 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {pendingWithdrawals.map((req) => (
                      <tr key={req._id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-900">{req.labourId?.fullName || 'N/A'}</p>
                          <p className="text-xs text-slate-500">{req.labourId?.phone || ''}</p>
                        </td>
                        <td className="px-6 py-4">
                          <p className="font-bold text-blue-600">₹{(req.amount || 0).toLocaleString('en-IN')}</p>
                        </td>
                        <td className="px-6 py-4 text-xs text-slate-500">
                          {new Date(req.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => setSelectedRequest(req)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100"
                          >
                            <Eye className="h-3.5 w-3.5" /> Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Payout History Ledger */}
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <h3 className="font-bold text-slate-900">Payout History Ledger</h3>
              <div className="flex items-center gap-3">
                <select
                  value={historyFilter}
                  onChange={(e) => setHistoryFilter(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 outline-none"
                >
                  <option value="ALL">All Status</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </select>
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search name or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-48 rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-sm font-medium outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="p-0 overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="border-b border-slate-100 text-xs uppercase text-slate-400">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Request ID & Date</th>
                    <th className="px-6 py-3 font-semibold">Labourer</th>
                    <th className="px-6 py-3 font-semibold">Amount</th>
                    <th className="px-6 py-3 font-semibold">Status</th>
                    <th className="px-6 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {currentHistory.length > 0 ? (
                    currentHistory.map((w) => (
                      <tr key={w._id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-6 py-4">
                          <p className="font-bold text-slate-900">#{w._id.slice(-6)}</p>
                          <p className="text-xs text-slate-400">{new Date(w.createdAt).toLocaleString()}</p>
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-700">
                          {w.labourId?.fullName || 'N/A'}
                        </td>
                        <td className="px-6 py-4 font-bold text-slate-900">
                          ₹{(w.amount || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase ${
                              w.status === 'APPROVED'
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-rose-100 text-rose-700'
                            }`}
                          >
                            {w.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleDeleteHistory(w._id)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition"
                            title="Delete record"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="px-6 py-8 text-center text-slate-500">
                        No history found matching filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: WALLET TRANSACTION LEDGER */}
      {activeTab === 'ledger' && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden space-y-4 p-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-900">Immutable Wallet Transaction Ledger</h3>
              <p className="text-xs text-slate-500">
                Full audit trail of commission deductions, platform fees, GST recovery, recharges, and settlements.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                value={ledgerContext}
                onChange={(e) => {
                  setLedgerContext(e.target.value)
                  setLedgerPage(1)
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 outline-none"
              >
                <option value="">All Contexts</option>
                <option value="CASH_BOOKING_SETTLEMENT">Cash Booking Settlement</option>
                <option value="WALLET_RECHARGE">Wallet Recharge</option>
                <option value="PAYOUT">Booking Payout</option>
                <option value="PENALTY">Late Fee / Penalty</option>
                <option value="ADMIN_ADJUSTMENT">Admin Adjustment</option>
                <option value="REVERSAL">Reversal</option>
              </select>

              <select
                value={ledgerType}
                onChange={(e) => {
                  setLedgerType(e.target.value)
                  setLedgerPage(1)
                }}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 outline-none"
              >
                <option value="">All Types</option>
                <option value="DEBIT">Debit</option>
                <option value="CREDIT">Credit</option>
              </select>

              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search tx ID or note..."
                  value={ledgerSearch}
                  onChange={(e) => setLedgerSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchLedger()}
                  className="w-48 rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs font-medium outline-none"
                />
              </div>

              <button
                onClick={fetchLedger}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800"
              >
                Filter
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            {ledgerLoading ? (
              <div className="p-8 text-center text-sm font-medium text-slate-500 animate-pulse">
                Loading ledger records...
              </div>
            ) : ledgerTransactions.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No ledger transactions found.
              </div>
            ) : (
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="border-b border-slate-100 uppercase text-slate-400 bg-slate-50/50">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Tx ID & Date</th>
                    <th className="px-4 py-3 font-semibold">Labour User</th>
                    <th className="px-4 py-3 font-semibold">Context / Type</th>
                    <th className="px-4 py-3 font-semibold">Amount</th>
                    <th className="px-4 py-3 font-semibold">Breakdown (Comm / Fee / GST)</th>
                    <th className="px-4 py-3 font-semibold">Balance After</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ledgerTransactions.map((tx) => {
                    const breakdown = tx.chargesBreakdown
                    return (
                      <tr key={tx._id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-mono">
                          <p className="font-bold text-slate-900">{tx.transactionId || `#${tx._id.slice(-6)}`}</p>
                          <p className="text-[10px] text-slate-400">{new Date(tx.createdAt).toLocaleString()}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-bold text-slate-900">
                            {tx.labourId?.fullName || tx.userId?.fullName || '—'}
                          </p>
                          <p className="text-[10px] text-slate-400">
                            {tx.labourId?.phone || tx.userId?.phone || ''}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex rounded bg-slate-100 px-2 py-0.5 font-bold uppercase tracking-wider text-[10px] text-slate-700">
                            {tx.context || tx.type}
                          </span>
                          {tx.description && (
                            <p className="text-[10px] text-slate-500 mt-0.5 max-w-xs truncate">{tx.description}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 font-bold tabular-nums">
                          <span className={tx.type === 'CREDIT' ? 'text-emerald-600' : 'text-slate-900'}>
                            {tx.type === 'CREDIT' ? '+' : '-'}₹{(tx.amount || 0).toLocaleString('en-IN')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {breakdown && (breakdown.commission > 0 || breakdown.platformFee > 0 || breakdown.gst > 0) ? (
                            <div className="flex flex-wrap gap-1 text-[10px]">
                              <span className="rounded bg-blue-50 px-1 py-0.5 text-blue-700 font-semibold">
                                Comm: ₹{breakdown.commission || 0}
                              </span>
                              <span className="rounded bg-indigo-50 px-1 py-0.5 text-indigo-700 font-semibold">
                                Fee: ₹{breakdown.platformFee || 0}
                              </span>
                              <span className="rounded bg-emerald-50 px-1 py-0.5 text-emerald-700 font-semibold">
                                GST: ₹{breakdown.gst || 0}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-700">
                          ₹{(tx.balanceAfter || 0).toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${
                              tx.status === 'COMPLETED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : tx.status === 'PARTIAL'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {tx.status || 'COMPLETED'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {ledgerTotalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-100 pt-3">
              <span className="text-xs text-slate-500">
                Page {ledgerPage} of {ledgerTotalPages}
              </span>
              <div className="flex gap-2">
                <button
                  disabled={ledgerPage === 1}
                  onClick={() => setLedgerPage((p) => Math.max(1, p - 1))}
                  className="rounded border border-slate-200 p-1 disabled:opacity-50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  disabled={ledgerPage === ledgerTotalPages}
                  onClick={() => setLedgerPage((p) => Math.min(ledgerTotalPages, p + 1))}
                  className="rounded border border-slate-200 p-1 disabled:opacity-50"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: LABOUR ACCOUNTS & BALANCES */}
      {activeTab === 'users' && (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h3 className="font-bold text-slate-900">Labour Wallets Directory</h3>
              <p className="text-xs text-slate-500">
                View individual worker balances, held charges, outstanding dues, and perform audited manual adjustments.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search labourer..."
                  value={labourSearch}
                  onChange={(e) => setLabourSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && fetchLabourUsers()}
                  className="w-56 rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs font-medium outline-none"
                />
              </div>
              <button
                onClick={fetchLabourUsers}
                className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:bg-slate-800"
              >
                Search
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            {labourLoading ? (
              <div className="p-8 text-center text-sm font-medium text-slate-500 animate-pulse">
                Loading accounts...
              </div>
            ) : labourUsers.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">No labour accounts found.</div>
            ) : (
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="border-b border-slate-100 uppercase text-slate-400 bg-slate-50/50">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Labour Name</th>
                    <th className="px-4 py-3 font-semibold">Phone / Email</th>
                    <th className="px-4 py-3 font-semibold">Current Balance</th>
                    <th className="px-4 py-3 font-semibold">Total Credits</th>
                    <th className="px-4 py-3 font-semibold">Total Debits</th>
                    <th className="px-4 py-3 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {labourUsers.map((user) => (
                    <tr key={user._id} className="hover:bg-slate-50/50">
                      <td className="px-4 py-3 font-bold text-slate-900">{user.fullName || 'N/A'}</td>
                      <td className="px-4 py-3">
                        <p>{user.phone || '—'}</p>
                        <p className="text-[10px] text-slate-400">{user.email || ''}</p>
                      </td>
                      <td className="px-4 py-3 font-black text-slate-900">
                        ₹{(user.balance || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-emerald-600 font-semibold">
                        +₹{(user.totalCredits || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-rose-600 font-semibold">
                        -₹{(user.totalDebits || 0).toLocaleString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => {
                            setAdjustModalUser(user)
                            setAdjustAmount('')
                            setAdjustReason('')
                            setAdjustError('')
                          }}
                          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                        >
                          Adjust Balance
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: WALLET CONFIGURATION */}
      {activeTab === 'settings' && (
        <div className="max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <h3 className="text-lg font-bold text-slate-900">Labour Wallet Configuration</h3>
            <p className="text-xs text-slate-500">
              Configure minimum required wallet balance and global wallet controls.
            </p>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-4">
            {settingsMsg.text && (
              <div
                className={`rounded-xl p-3 text-xs font-semibold ${
                  settingsMsg.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                {settingsMsg.text}
              </div>
            )}

            {/* Feature Toggle */}
            <div className="flex items-center justify-between rounded-xl border border-slate-200 p-4 bg-slate-50/50">
              <div>
                <p className="text-sm font-bold text-slate-900">Enable Labour Wallet System</p>
                <p className="text-xs text-slate-500">Enforce wallet balance and booking acceptance limits</p>
              </div>
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
            </div>

            {/* Minimum Balance Input */}
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Minimum Required Labour Wallet Balance (₹)
              </label>
              <p className="text-xs text-slate-400 mb-2">
                Minimum balance a labourer must maintain in their wallet. Workers with balance below this cannot accept jobs.
              </p>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-slate-400">₹</span>
                <input
                  type="number"
                  min="0"
                  value={settings.minimumLabourWalletBalance || 0}
                  onChange={(e) =>
                    setSettings({ ...settings, minimumLabourWalletBalance: e.target.value })
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-8 pr-4 text-sm font-bold text-slate-900 outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={savingSettings}
                className="rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-slate-800 disabled:opacity-50 transition"
              >
                {savingSettings ? 'Saving...' : 'Save Configuration'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Manual Balance Adjustment Modal */}
      {adjustModalUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-900">Adjust Labour Balance</h3>
                <p className="text-xs text-slate-500">{adjustModalUser.fullName} ({adjustModalUser.phone})</p>
              </div>
              <button
                onClick={() => setAdjustModalUser(null)}
                className="p-1 text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Adjustment Type</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setAdjustType('CREDIT')}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${
                      adjustType === 'CREDIT'
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    Credit (+)
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustType('DEBIT')}
                    className={`py-2 rounded-xl text-xs font-bold border transition ${
                      adjustType === 'DEBIT'
                        ? 'border-rose-500 bg-rose-50 text-rose-800'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    Debit (-)
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Amount (₹)</label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  placeholder="500"
                  className="w-full mt-1 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-sm font-bold outline-none focus:border-blue-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Reason (Required for audit)</label>
                <textarea
                  rows="2"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. Approved incentive bonus, manual penalty waiver, cash reconciliation"
                  className="w-full mt-1 rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs outline-none focus:border-blue-500 focus:bg-white"
                ></textarea>
              </div>

              {adjustError && (
                <p className="rounded-lg bg-rose-50 p-2 text-xs font-semibold text-rose-700 border border-rose-200">
                  {adjustError}
                </p>
              )}

              <button
                disabled={adjusting}
                onClick={handleAdjustBalance}
                className="w-full rounded-xl bg-slate-900 py-3 text-sm font-bold text-white hover:bg-slate-800 disabled:opacity-50 transition"
              >
                {adjusting ? 'Processing...' : `Confirm ${adjustType}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payout Details Modal */}
      {selectedRequest && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
              <div>
                <h3 className="font-bold text-slate-900">Process Request</h3>
                <p className="text-xs font-semibold text-slate-500">#{selectedRequest._id}</p>
              </div>
              <button
                onClick={() => {
                  setSelectedRequest(null)
                  setRejecting(false)
                  setRejectNote('')
                }}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-200"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto">
              <div className="mb-6 rounded-xl bg-blue-50 p-4 text-center border border-blue-100">
                <p className="text-sm font-semibold text-blue-800">Requested Amount</p>
                <p className="text-4xl font-black text-blue-600 mt-1">
                  ₹{(selectedRequest.amount || 0).toLocaleString('en-IN')}
                </p>
              </div>

              <div className="mb-6 space-y-4">
                <h4 className="font-bold text-slate-900 flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-slate-400" /> Bank Details
                </h4>
                {selectedRequest.bankDetails ? (
                  <div className="rounded-xl border border-slate-200 overflow-hidden text-sm">
                    <div className="flex justify-between border-b border-slate-100 px-4 py-3 bg-slate-50">
                      <span className="text-slate-500">Account Name</span>
                      <span className="font-bold text-slate-900">{selectedRequest.bankDetails.accountHolderName}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 px-4 py-3">
                      <span className="text-slate-500">Bank Name</span>
                      <span className="font-semibold text-slate-900">{selectedRequest.bankDetails.bankName}</span>
                    </div>
                    <div className="flex justify-between border-b border-slate-100 px-4 py-3 bg-slate-50">
                      <span className="text-slate-500">Account Number</span>
                      <span className="font-mono font-bold text-slate-900">{selectedRequest.bankDetails.accountNumber}</span>
                    </div>
                    <div className="flex justify-between px-4 py-3">
                      <span className="text-slate-500">IFSC Code</span>
                      <span className="font-mono font-bold text-slate-900">{selectedRequest.bankDetails.ifscCode}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500 italic bg-slate-50 p-4 rounded-xl">
                    No bank details provided.
                  </p>
                )}
              </div>

              {rejecting ? (
                <div className="rounded-xl border border-rose-100 bg-rose-50 p-4">
                  <p className="mb-2 text-sm font-bold text-rose-800">Reason for Rejection (Required)</p>
                  <textarea
                    className="w-full rounded-lg border border-rose-200 bg-white p-3 text-sm outline-none"
                    rows="3"
                    placeholder="Enter reason..."
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                  ></textarea>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => setRejecting(false)}
                      className="flex-1 rounded-lg bg-white py-2 text-sm font-bold text-slate-600 border border-slate-200"
                    >
                      Cancel
                    </button>
                    <button
                      disabled={!rejectNote.trim()}
                      onClick={() => handleUpdateStatus(selectedRequest._id, 'REJECTED', rejectNote)}
                      className="flex-1 rounded-lg bg-rose-600 py-2 text-sm font-bold text-white shadow-md hover:bg-rose-700 disabled:opacity-50"
                    >
                      Confirm Reject
                    </button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setRejecting(true)}
                    className="flex items-center justify-center gap-2 rounded-xl border-2 border-rose-100 bg-white px-4 py-3 text-sm font-bold text-rose-600 hover:bg-rose-50"
                  >
                    <XCircle className="h-4 w-4" /> Reject
                  </button>
                  <button
                    onClick={() => handleUpdateStatus(selectedRequest._id, 'APPROVED')}
                    className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/20 hover:bg-blue-700"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Mark Paid
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Record Confirmation */}
      {recordToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl p-6 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 mx-auto">
              <Trash2 className="h-6 w-6 text-rose-600" />
            </div>
            <h3 className="mb-2 text-lg font-bold text-slate-900">Delete Record</h3>
            <p className="mb-6 text-xs text-slate-500">
              Are you sure you want to delete this record? This action cannot be undone.
            </p>
            <div className="flex w-full gap-3">
              <button
                onClick={() => setRecordToDelete(null)}
                className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={confirmDeleteHistory}
                className="flex-1 rounded-xl bg-rose-600 py-2.5 text-xs font-bold text-white"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
