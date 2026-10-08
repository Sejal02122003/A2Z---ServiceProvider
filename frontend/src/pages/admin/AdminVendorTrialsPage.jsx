import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { vendorTrialApi } from '../../api/vendorTrialApi.js'
import {
  Users,
  CheckCircle2,
  AlertTriangle,
  ShieldAlert,
  Clock,
  Ban,
  Search,
  RefreshCw,
  Eye,
  Sliders,
  Play,
  Pause,
  PlusCircle,
  Award,
  Layers,
  FileCheck,
} from 'lucide-react'

const STATUS_TABS = [
  { id: 'all', label: 'All Vendors' },
  { id: 'TRIAL_ACTIVE', label: 'Active Trials' },
  { id: 'WARNING', label: 'Warnings' },
  { id: 'TRIAL_COMPLETED', label: 'Completed' },
  { id: 'PENDING_ADMIN_CONFIRMATION', label: 'Pending Confirmation' },
  { id: 'FINAL_FAILURE', label: 'Final Failure' },
  { id: 'FINAL_CHANCE_ACTIVE', label: 'Final Chance Active' },
  { id: 'CONFIRMED', label: 'Confirmed' },
  { id: 'BLOCKED', label: 'Blocked' },
]

export function AdminVendorTrialsPage() {
  const [loading, setLoading] = useState(true)
  const [statsLoading, setStatsLoading] = useState(true)
  const [stats, setStats] = useState(null)
  const [trials, setTrials] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [selectedStatus, setSelectedStatus] = useState('all')
  const [search, setSearch] = useState('')
  const [toast, setToast] = useState({ type: '', message: '' })
  const [migrating, setMigrating] = useState(false)

  useEffect(() => {
    loadStats()
  }, [])

  useEffect(() => {
    loadTrials()
  }, [selectedStatus, page])

  const loadStats = async () => {
    setStatsLoading(true)
    try {
      const res = await vendorTrialApi.getDashboardStats()
      if (res?.data?.stats) {
        setStats(res.data.stats)
      }
    } catch (err) {
      console.warn('Failed to load trial stats:', err)
    } finally {
      setStatsLoading(false)
    }
  }

  const loadTrials = async () => {
    setLoading(true)
    try {
      const res = await vendorTrialApi.getVendorTrials({
        status: selectedStatus,
        search,
        page,
        limit: 15,
      })
      if (res?.data) {
        setTrials(res.data.trials || [])
        setTotal(res.data.total || 0)
      }
    } catch (err) {
      showToast('error', err?.message || 'Failed to load vendor trials')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = (e) => {
    e.preventDefault()
    setPage(1)
    loadTrials()
  }

  const showToast = (type, message) => {
    setToast({ type, message })
    setTimeout(() => setToast({ type: '', message: '' }), 4000)
  }

  const handleMigrate = async () => {
    if (!window.confirm('Are you sure you want to grandfather existing verified vendors as CONFIRMED?')) return
    setMigrating(true)
    try {
      const res = await vendorTrialApi.migrateExistingVendors()
      showToast('success', res.message || 'Migrated existing verified vendors successfully')
      loadStats()
      loadTrials()
    } catch (err) {
      showToast('error', err?.message || 'Failed to run migration')
    } finally {
      setMigrating(false)
    }
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'TRIAL_ACTIVE':
        return <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-200">TRIAL ACTIVE</span>
      case 'WARNING':
        return <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 border border-amber-200">WARNING ISSUED</span>
      case 'TRIAL_COMPLETED':
        return <span className="rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700 border border-teal-200">TRIAL COMPLETED</span>
      case 'PENDING_ADMIN_CONFIRMATION':
        return <span className="rounded-full bg-purple-50 px-2.5 py-1 text-xs font-semibold text-purple-700 border border-purple-200 animate-pulse">PENDING CONFIRMATION</span>
      case 'CONFIRMED':
        return <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 border border-emerald-200">CONFIRMED VENDOR</span>
      case 'FINAL_FAILURE':
        return <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700 border border-orange-200">FINAL FAILURE</span>
      case 'FINAL_CHANCE_PAYMENT_PENDING':
        return <span className="rounded-full bg-yellow-50 px-2.5 py-1 text-xs font-semibold text-yellow-800 border border-yellow-200">PAYMENT PENDING</span>
      case 'FINAL_CHANCE_ACTIVE':
        return <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700 border border-indigo-200">FINAL CHANCE ACTIVE</span>
      case 'BLOCKED':
        return <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700 border border-rose-200">BLOCKED</span>
      case 'REJECTED':
        return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 border border-slate-200">REJECTED</span>
      case 'TRIAL_PAUSED':
        return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 border border-slate-200">TRIAL PAUSED</span>
      default:
        return <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">{status || 'NOT STARTED'}</span>
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Vendor Trial Management</h1>
          <p className="text-sm text-slate-500">
            Monitor vendor trial performance, passing ratings, warnings, final chance penalties, and admin confirmations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleMigrate}
            disabled={migrating}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
          >
            <FileCheck className="h-4 w-4 text-emerald-600" />
            {migrating ? 'Migrating...' : 'Grandfather Existing'}
          </button>

          <Link
            to="/admin/vendor-trials/settings"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <Sliders className="h-4 w-4 text-amber-500" />
            Trial Settings
          </Link>

          <Link
            to="/admin/vendor-trials/pending-confirmations"
            className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white shadow-sm shadow-amber-500/20 transition hover:bg-amber-600"
          >
            <Award className="h-4 w-4" />
            Pending Confirmations
          </Link>
        </div>
      </div>

      {toast.message && (
        <div
          className={`flex items-center gap-2 rounded-xl p-4 text-sm font-medium border ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-rose-600 flex-shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Dashboard Statistics Grid (Requirement 32) */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Active Trials</p>
          <p className="mt-1 text-2xl font-bold text-blue-600">{stats?.activeTrials ?? '—'}</p>
          <p className="text-[11px] text-slate-400">Total in progress</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Completed</p>
          <p className="mt-1 text-2xl font-bold text-teal-600">{stats?.trialCompleted ?? '—'}</p>
          <p className="text-[11px] text-slate-400">Finished trials</p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
          <p className="text-xs font-medium text-amber-800">Pending Review</p>
          <p className="mt-1 text-2xl font-bold text-amber-600">{stats?.pendingConfirmation ?? '—'}</p>
          <p className="text-[11px] text-amber-700">Awaiting admin confirm</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Warnings</p>
          <p className="mt-1 text-2xl font-bold text-amber-500">{stats?.warnings ?? '—'}</p>
          <p className="text-[11px] text-slate-400">Low rating alerts</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Final Failures</p>
          <p className="mt-1 text-2xl font-bold text-orange-600">{stats?.finalFailures ?? '—'}</p>
          <p className="text-[11px] text-slate-400">Eligible for penalty</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-medium text-slate-500">Confirmed</p>
          <p className="mt-1 text-2xl font-bold text-emerald-600">{stats?.confirmedVendors ?? '—'}</p>
          <p className="text-[11px] text-slate-400">Production vendors</p>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-200 pb-2">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setSelectedStatus(tab.id)
                setPage(1)
              }}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
                selectedStatus === tab.id
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by vendor name, phone, or email..."
              className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2.5 text-sm shadow-sm focus:border-amber-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>
          <button
            type="submit"
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            Search
          </button>
        </form>
      </div>

      {/* Vendors Trial Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <div className="flex items-center gap-3 text-slate-600">
              <RefreshCw className="h-6 w-6 animate-spin text-amber-500" />
              <span>Loading trial records...</span>
            </div>
          </div>
        ) : trials.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="mx-auto h-12 w-12 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-900">No vendor trials found</p>
            <p className="mt-1 text-xs text-slate-500">Try selecting a different status filter or clear your search.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-100 bg-slate-50/75 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-4">Vendor</th>
                  <th className="px-6 py-4">Trial Status</th>
                  <th className="px-6 py-4">Progress</th>
                  <th className="px-6 py-4">Pass / Fail</th>
                  <th className="px-6 py-4">Warnings</th>
                  <th className="px-6 py-4">Final Chance</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {trials.map((trial) => {
                  const vendor = trial.vendorId || {}
                  const vendorId = vendor._id || trial.vendorId
                  const totalAllowed = trial.configuredTrialCount + (trial.adminGrantedAdditionalTrials || 0)
                  const progressPct = totalAllowed > 0 ? Math.min(100, Math.round((trial.completedTrialCount / totalAllowed) * 100)) : 0

                  return (
                    <tr key={trial._id} className="hover:bg-slate-50/60 transition">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 font-bold text-slate-700">
                            {vendor.fullName ? vendor.fullName[0].toUpperCase() : 'V'}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900">{vendor.fullName || 'Unnamed Vendor'}</p>
                            <p className="text-xs text-slate-500">{vendor.phone || vendor.email || 'N/A'}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        {getStatusBadge(trial.status)}
                      </td>

                      <td className="px-6 py-4">
                        <div className="w-36">
                          <div className="flex justify-between text-xs font-semibold text-slate-700 mb-1">
                            <span>{trial.completedTrialCount} / {totalAllowed}</span>
                            <span>{progressPct}%</span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                progressPct >= 100 ? 'bg-emerald-500' : 'bg-amber-500'
                              }`}
                              style={{ width: `${progressPct}%` }}
                            ></div>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 text-xs font-medium">
                        <span className="text-emerald-700 font-bold">{trial.passedTrialCount || 0} Pass</span>
                        <span className="text-slate-300 mx-1.5">•</span>
                        <span className="text-rose-700 font-bold">{trial.failedTrialCount || 0} Fail</span>
                      </td>

                      <td className="px-6 py-4 text-xs font-semibold text-slate-700">
                        {trial.warningCount > 0 ? (
                          <span className="text-amber-600 font-bold">{trial.warningCount} Issued</span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-xs">
                        {trial.finalChanceUsed ? (
                          <span className="rounded bg-indigo-50 px-2 py-0.5 font-bold text-indigo-700 border border-indigo-200">
                            Used (Paid)
                          </span>
                        ) : (
                          <span className="text-slate-400">No</span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <Link
                          to={`/admin/vendor-trials/${vendorId}`}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                        >
                          <Eye className="h-3.5 w-3.5 text-slate-400" />
                          View
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {total > 15 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
            <p className="text-xs text-slate-500">
              Showing {(page - 1) * 15 + 1} to {Math.min(total, page * 15)} of {total} trials
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page * 15 >= total}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
