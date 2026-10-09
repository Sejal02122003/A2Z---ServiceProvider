import React, { useState, useEffect, useCallback } from 'react'
import {
  Trophy,
  Award,
  TrendingUp,
  Gift,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Plus,
  Search,
  Filter,
  Users,
  Eye,
  Play,
  Pause,
  StopCircle,
  Sliders,
  DollarSign,
  ChevronRight,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  FileText,
  Percent,
  Calendar,
  Layers,
} from 'lucide-react'
import { rewardApi } from '../../api/rewardApi.js'
import { AdminCampaignModal } from './rewards/AdminCampaignModal.jsx'
import { AdminRewardApprovalModal } from './rewards/AdminRewardApprovalModal.jsx'

export function AdminRewardsHubPage() {
  const [activeTab, setActiveTab] = useState('overview')
  // 'overview' | 'campaigns' | 'performance' | 'business' | 'progress' | 'pending' | 'transactions' | 'reports' | 'settings'

  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState({ type: '', message: '' })

  // Data states
  const [overviewStats, setOverviewStats] = useState(null)
  const [campaigns, setCampaigns] = useState([])
  const [campaignsTotal, setCampaignsTotal] = useState(0)
  const [campaignsPage, setCampaignsPage] = useState(1)
  const [campaignCategoryFilter, setCampaignCategoryFilter] = useState('ALL')
  const [campaignStatusFilter, setCampaignStatusFilter] = useState('ALL')
  const [campaignSearch, setCampaignSearch] = useState('')

  // Vendor Progress State
  const [vendorProgress, setVendorProgress] = useState([])
  const [progressTotal, setProgressTotal] = useState(0)
  const [progressSearch, setProgressSearch] = useState('')

  // Pending Approvals State
  const [pendingApprovals, setPendingApprovals] = useState([])
  const [pendingTotal, setPendingTotal] = useState(0)

  // Transactions State
  const [transactions, setTransactions] = useState([])
  const [transactionsTotal, setTransactionsTotal] = useState(0)

  // Reports & Audits State
  const [auditLogs, setAuditLogs] = useState([])
  const [categoryBreakdown, setCategoryBreakdown] = useState([])

  // Settings State
  const [settings, setSettings] = useState(null)
  const [savingSettings, setSavingSettings] = useState(false)

  // Modals
  const [campaignModalOpen, setCampaignModalOpen] = useState(false)
  const [selectedCampaignForEdit, setSelectedCampaignForEdit] = useState(null)
  const [approvalModalOpen, setApprovalModalOpen] = useState(false)
  const [selectedRewardForApproval, setSelectedRewardForApproval] = useState(null)

  const showToast = (type, message) => {
    setToast({ type, message })
    setTimeout(() => setToast({ type: '', message: '' }), 4000)
  }

  // Fetch Overview Stats
  const loadOverview = useCallback(async () => {
    try {
      const res = await rewardApi.getAdminOverview()
      if (res?.data) setOverviewStats(res.data)
    } catch (err) {
      console.error('Error loading overview:', err)
    }
  }, [])

  // Fetch Campaigns
  const loadCampaigns = useCallback(
    async (cat = campaignCategoryFilter, stat = campaignStatusFilter, q = campaignSearch, pg = 1) => {
      try {
        setLoading(true)
        const res = await rewardApi.getAdminCampaigns({
          category: cat !== 'ALL' ? cat : undefined,
          status: stat !== 'ALL' ? stat : undefined,
          search: q || undefined,
          page: pg,
          limit: 20,
        })
        if (res?.data) {
          setCampaigns(res.data.campaigns || [])
          setCampaignsTotal(res.data.total || 0)
          setCampaignsPage(res.data.page || 1)
        }
      } catch (err) {
        showToast('error', err?.message || 'Failed to load campaigns')
      } finally {
        setLoading(false)
      }
    },
    [campaignCategoryFilter, campaignStatusFilter, campaignSearch]
  )

  // Fetch Vendor Progress
  const loadVendorProgress = useCallback(async (q = progressSearch, pg = 1) => {
    try {
      setLoading(true)
      const res = await rewardApi.getAdminVendorProgress({
        search: q || undefined,
        page: pg,
        limit: 20,
      })
      if (res?.data) {
        setVendorProgress(res.data.vendorRewards || [])
        setProgressTotal(res.data.total || 0)
      }
    } catch (err) {
      showToast('error', err?.message || 'Failed to load vendor progress')
    } finally {
      setLoading(false)
    }
  }, [progressSearch])

  // Fetch Pending Approvals
  const loadPendingApprovals = useCallback(async () => {
    try {
      setLoading(true)
      const res = await rewardApi.getAdminPendingApprovals({ limit: 50 })
      if (res?.data) {
        setPendingApprovals(res.data.pendingRewards || [])
        setPendingTotal(res.data.total || 0)
      }
    } catch (err) {
      showToast('error', err?.message || 'Failed to load pending approvals')
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch Transactions
  const loadTransactions = useCallback(async () => {
    try {
      setLoading(true)
      const res = await rewardApi.getAdminRewardTransactions({ limit: 50 })
      if (res?.data) {
        setTransactions(res.data.transactions || [])
        setTransactionsTotal(res.data.total || 0)
      }
    } catch (err) {
      showToast('error', err?.message || 'Failed to load reward transactions')
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch Reports & Audits
  const loadReports = useCallback(async () => {
    try {
      setLoading(true)
      const res = await rewardApi.getAdminRewardReports()
      if (res?.data) {
        setAuditLogs(res.data.auditLogs || [])
        setCategoryBreakdown(res.data.categoryBreakdown || [])
      }
    } catch (err) {
      showToast('error', err?.message || 'Failed to load reports')
    } finally {
      setLoading(false)
    }
  }, [])

  // Fetch Settings
  const loadSettings = useCallback(async () => {
    try {
      setLoading(true)
      const res = await rewardApi.getAdminRewardSettings()
      if (res?.data?.settings) setSettings(res.data.settings)
    } catch (err) {
      showToast('error', err?.message || 'Failed to load reward settings')
    } finally {
      setLoading(false)
    }
  }, [])

  // Primary Tab Switch Handler
  useEffect(() => {
    loadOverview()
    if (activeTab === 'overview') {
      loadCampaigns('ALL', 'ALL', '', 1)
      loadPendingApprovals()
    } else if (activeTab === 'campaigns') {
      loadCampaigns(campaignCategoryFilter, campaignStatusFilter, campaignSearch, 1)
    } else if (activeTab === 'performance') {
      loadCampaigns('PERFORMANCE', 'ALL', '', 1)
    } else if (activeTab === 'business') {
      loadCampaigns('BUSINESS', 'ALL', '', 1)
    } else if (activeTab === 'progress') {
      loadVendorProgress(progressSearch, 1)
    } else if (activeTab === 'pending') {
      loadPendingApprovals()
    } else if (activeTab === 'transactions') {
      loadTransactions()
    } else if (activeTab === 'reports') {
      loadReports()
    } else if (activeTab === 'settings') {
      loadSettings()
    }
  }, [
    activeTab,
    loadOverview,
    loadCampaigns,
    loadVendorProgress,
    loadPendingApprovals,
    loadTransactions,
    loadReports,
    loadSettings,
    campaignCategoryFilter,
    campaignStatusFilter,
    campaignSearch,
    progressSearch,
  ])

  // Lifecycle Campaign Actions
  const handleActivateCampaign = async (cId) => {
    try {
      await rewardApi.activateAdminCampaign(cId)
      showToast('success', 'Campaign activated successfully')
      loadOverview()
      loadCampaigns()
    } catch (err) {
      showToast('error', err?.message || 'Failed to activate campaign')
    }
  }

  const handlePauseCampaign = async (cId) => {
    try {
      await rewardApi.pauseAdminCampaign(cId, 'Paused by administrator')
      showToast('success', 'Campaign paused')
      loadOverview()
      loadCampaigns()
    } catch (err) {
      showToast('error', err?.message || 'Failed to pause campaign')
    }
  }

  const handleEndCampaign = async (cId) => {
    if (!window.confirm('Are you sure you want to end this campaign? No new rewards will be generated.')) return
    try {
      await rewardApi.endAdminCampaign(cId, 'Ended by administrator')
      showToast('success', 'Campaign ended')
      loadOverview()
      loadCampaigns()
    } catch (err) {
      showToast('error', err?.message || 'Failed to end campaign')
    }
  }

  const handleEvaluateCampaign = async (cId) => {
    try {
      const res = await rewardApi.evaluateAdminCampaign(cId)
      showToast('success', res?.message || 'Campaign evaluation completed')
      loadOverview()
      loadCampaigns()
    } catch (err) {
      showToast('error', err?.message || 'Failed to evaluate campaign')
    }
  }

  const handleTriggerReconcileAll = async () => {
    try {
      const res = await rewardApi.triggerManualReconciliation()
      showToast('success', res?.message || 'Batch reconciliation triggered')
      loadOverview()
      if (activeTab === 'campaigns') loadCampaigns()
      if (activeTab === 'pending') loadPendingApprovals()
    } catch (err) {
      showToast('error', err?.message || 'Failed to run reconciliation')
    }
  }

  const handleSaveSettings = async (e) => {
    e.preventDefault()
    setSavingSettings(true)
    try {
      await rewardApi.updateAdminRewardSettings(settings)
      showToast('success', 'Reward settings saved successfully')
    } catch (err) {
      showToast('error', err?.message || 'Failed to save settings')
    } finally {
      setSavingSettings(false)
    }
  }

  const handleReverseReward = async (rewardId) => {
    const reason = window.prompt('Enter audit reason for reversing this reward payout:')
    if (!reason || !reason.trim()) return
    try {
      await rewardApi.reverseAdminReward(rewardId, reason.trim())
      showToast('success', 'Reward reversed and wallet debited successfully')
      loadOverview()
      loadTransactions()
    } catch (err) {
      showToast('error', err?.message || 'Failed to reverse reward')
    }
  }

  const fin = overviewStats?.financials || {}
  const campStats = overviewStats?.campaigns || {}
  const rwdStats = overviewStats?.rewards || {}
  const budgetUtilizationPct =
    fin.totalBudget > 0 ? Math.min(100, Math.round((fin.totalCreditedAmount / fin.totalBudget) * 100)) : 0

  return (
    <div className="space-y-6 pb-12">
      {/* Toast */}
      {toast.message && (
        <div
          className={`flex items-center gap-2 rounded-2xl p-4 text-xs font-semibold shadow-lg border ${
            toast.type === 'success'
              ? 'bg-emerald-500 text-white border-emerald-600'
              : 'bg-rose-500 text-white border-rose-600'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-black tracking-tight text-slate-900">Rewards & Incentives Hub</h1>
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-bold text-amber-800">
              {campStats.active || 0} Active Campaigns
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Admin-Managed Engine for Performance-Based Quality Rewards and Business Growth Incentives
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleTriggerReconcileAll}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 active:scale-95"
          >
            <RefreshCw className="h-3.5 w-3.5 text-amber-600" />
            <span>Reconcile Now</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedCampaignForEdit(null)
              setCampaignModalOpen(true)
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 text-xs font-bold text-white shadow-md shadow-amber-500/20 transition hover:brightness-105 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>Create Campaign</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 pb-1 scrollbar-none">
        {[
          { id: 'overview', label: 'Overview Dashboard', icon: Trophy },
          { id: 'campaigns', label: `All Campaigns (${campStats.total || 0})`, icon: Gift },
          { id: 'performance', label: 'Performance Rewards', icon: Award },
          { id: 'business', label: 'Business Incentives', icon: TrendingUp },
          { id: 'progress', label: 'Vendor Progress', icon: Users },
          { id: 'pending', label: `Pending Approvals (${rwdStats.pendingApprovals || 0})`, icon: Clock, badge: rwdStats.pendingApprovals },
          { id: 'transactions', label: 'Reward Transactions', icon: DollarSign },
          { id: 'reports', label: 'Reports & Audits', icon: FileText },
          { id: 'settings', label: 'Settings', icon: Sliders },
        ].map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                isActive
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
              {tab.badge > 0 && (
                <span className="rounded-full bg-rose-500 px-1.5 py-0.2 text-[10px] text-white">
                  {tab.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ========================================================= */}
      {/* TAB 1: OVERVIEW DASHBOARD */}
      {/* ========================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metric Grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Campaigns</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{campStats.total || 0}</p>
              <p className="mt-0.5 text-[10px] text-slate-500">
                {campStats.active || 0} Active • {campStats.paused || 0} Paused
              </p>
            </div>

            <div className="rounded-2xl border border-amber-200/80 bg-amber-50/40 p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">Total Budget</p>
              <p className="mt-1 text-2xl font-black text-amber-900">₹{(fin.totalBudget || 0).toLocaleString()}</p>
              <p className="mt-0.5 text-[10px] text-amber-700">Allocated across campaigns</p>
            </div>

            <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">Total Credited</p>
              <p className="mt-1 text-2xl font-black text-emerald-900">
                ₹{(fin.totalCreditedAmount || 0).toLocaleString()}
              </p>
              <p className="mt-0.5 text-[10px] text-emerald-700">Wallet payouts issued</p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Available Budget</p>
              <p className="mt-1 text-2xl font-black text-slate-900">
                ₹{(fin.remainingAvailableBudget || 0).toLocaleString()}
              </p>
              <p className="mt-0.5 text-[10px] text-slate-500">Remaining reserve</p>
            </div>

            <div className="rounded-2xl border border-purple-200/80 bg-purple-50/40 p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-purple-700">Pending Approvals</p>
              <p className="mt-1 text-2xl font-black text-purple-900">{rwdStats.pendingApprovals || 0}</p>
              <p className="mt-0.5 text-[10px] text-purple-700">
                ₹{(fin.pendingApprovalAmount || 0).toLocaleString()} awaiting
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Eligible Vendors</p>
              <p className="mt-1 text-2xl font-black text-slate-900">{overviewStats?.vendors?.totalEligible || 0}</p>
              <p className="mt-0.5 text-[10px] text-slate-500">Active workforce</p>
            </div>
          </div>

          {/* Budget Expenditure Progress */}
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">Campaign Budget Utilization</h3>
                <p className="text-xs text-slate-500">
                  ₹{(fin.totalCreditedAmount || 0).toLocaleString()} spent of ₹{(fin.totalBudget || 0).toLocaleString()} total cap
                </p>
              </div>
              <span className="text-base font-black text-amber-600">{budgetUtilizationPct}%</span>
            </div>
            <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500"
                style={{ width: `${budgetUtilizationPct}%` }}
              />
            </div>
          </div>

          {/* Active Campaigns Quick Preview */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Gift className="h-4 w-4 text-amber-500" /> Currently Running Campaigns
              </h3>
              <button
                type="button"
                onClick={() => setActiveTab('campaigns')}
                className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:text-indigo-800"
              >
                <span>View All ({campStats.total || 0})</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {campaigns.slice(0, 3).map((camp) => (
                <div
                  key={camp._id}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition"
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase ${
                          camp.category === 'PERFORMANCE'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-indigo-100 text-indigo-800'
                        }`}
                      >
                        {camp.category}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                          camp.status === 'ACTIVE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {camp.status}
                      </span>
                    </div>

                    <h4 className="mt-2 text-sm font-bold text-slate-900 line-clamp-1">{camp.name}</h4>
                    <p className="mt-1 text-xs text-slate-500 line-clamp-2">{camp.description || 'No description'}</p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                    <div>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase">Budget</p>
                      <p className="font-bold text-slate-900">₹{camp.budget?.totalBudget?.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-400 font-semibold uppercase">Qualified</p>
                      <p className="font-bold text-emerald-600">{camp.stats?.qualifiedCount || 0}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleEvaluateCampaign(camp._id)}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-1.5 text-slate-600 hover:bg-slate-100"
                      title="Trigger evaluation"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 2, 3, 4: CAMPAIGNS (ALL, PERFORMANCE, BUSINESS) */}
      {/* ========================================================= */}
      {(activeTab === 'campaigns' || activeTab === 'performance' || activeTab === 'business') && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white p-4 border border-slate-200 shadow-2xs">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search campaigns..."
                  value={campaignSearch}
                  onChange={(e) => {
                    setCampaignSearch(e.target.value)
                    loadCampaigns(campaignCategoryFilter, campaignStatusFilter, e.target.value, 1)
                  }}
                  className="rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs font-medium focus:border-amber-500 focus:bg-white"
                />
              </div>

              {activeTab === 'campaigns' && (
                <select
                  value={campaignCategoryFilter}
                  onChange={(e) => {
                    setCampaignCategoryFilter(e.target.value)
                    loadCampaigns(e.target.value, campaignStatusFilter, campaignSearch, 1)
                  }}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700"
                >
                  <option value="ALL">All Categories</option>
                  <option value="PERFORMANCE">Performance-Based</option>
                  <option value="BUSINESS">Business-Based</option>
                </select>
              )}

              <select
                value={campaignStatusFilter}
                onChange={(e) => {
                  setCampaignStatusFilter(e.target.value)
                  loadCampaigns(campaignCategoryFilter, e.target.value, campaignSearch, 1)
                }}
                className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700"
              >
                <option value="ALL">All Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="DRAFT">DRAFT</option>
                <option value="PAUSED">PAUSED</option>
                <option value="ENDED">ENDED</option>
              </select>
            </div>

            <div className="text-xs font-semibold text-slate-500">
              Showing {campaigns.length} of {campaignsTotal} campaigns
            </div>
          </div>

          {/* Campaign List Cards */}
          {loading ? (
            <div className="flex h-60 items-center justify-center">
              <RefreshCw className="h-6 w-6 animate-spin text-amber-500" />
            </div>
          ) : campaigns.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
              <Trophy className="mx-auto h-12 w-12 text-slate-300" />
              <h3 className="mt-3 text-sm font-bold text-slate-800">No Reward Campaigns Found</h3>
              <p className="mt-1 text-xs text-slate-500">Click "Create Campaign" above to launch a new incentive.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {campaigns.map((camp) => {
                const isPerf = camp.category === 'PERFORMANCE'
                const pRules = camp.performanceRules || {}
                const bRules = camp.businessRules || {}
                const bud = camp.budget || {}

                return (
                  <div
                    key={camp._id}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
                  >
                    <div className="flex flex-wrap items-center justify-between border-b border-slate-100 bg-slate-50/70 px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-10 w-10 items-center justify-center rounded-xl font-bold text-white shadow-sm ${
                            isPerf
                              ? 'bg-gradient-to-tr from-amber-500 to-orange-500'
                              : 'bg-gradient-to-tr from-indigo-600 to-blue-600'
                          }`}
                        >
                          {isPerf ? <Award className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-extrabold text-slate-900">{camp.name}</h3>
                            <span
                              className={`rounded-md px-2 py-0.5 text-[9px] font-extrabold uppercase ${
                                isPerf ? 'bg-amber-100 text-amber-800' : 'bg-indigo-100 text-indigo-800'
                              }`}
                            >
                              {camp.category}
                            </span>
                            <span
                              className={`rounded-md px-2 py-0.5 text-[9px] font-extrabold ${
                                camp.status === 'ACTIVE'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : camp.status === 'PAUSED'
                                  ? 'bg-amber-100 text-amber-800'
                                  : 'bg-slate-100 text-slate-600'
                              }`}
                            >
                              {camp.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 font-mono">
                            Code: {camp.code} • Cycle: {camp.evaluationPeriod} • Mode: {camp.approvalMode}
                          </p>
                        </div>
                      </div>

                      {/* Top Action Buttons */}
                      <div className="flex items-center gap-1.5">
                        {camp.status !== 'ACTIVE' && camp.status !== 'ENDED' && (
                          <button
                            type="button"
                            onClick={() => handleActivateCampaign(camp._id)}
                            className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow hover:bg-emerald-700"
                          >
                            <Play className="h-3.5 w-3.5" /> Activate
                          </button>
                        )}
                        {camp.status === 'ACTIVE' && (
                          <button
                            type="button"
                            onClick={() => handlePauseCampaign(camp._id)}
                            className="inline-flex items-center gap-1 rounded-xl border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-100"
                          >
                            <Pause className="h-3.5 w-3.5" /> Pause
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCampaignForEdit(camp)
                            setCampaignModalOpen(true)
                          }}
                          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEvaluateCampaign(camp._id)}
                          className="inline-flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-2xs"
                          title="Evaluate all participating vendors"
                        >
                          <RefreshCw className="h-3.5 w-3.5 text-amber-600" /> Evaluate
                        </button>
                        {camp.status !== 'ENDED' && (
                          <button
                            type="button"
                            onClick={() => handleEndCampaign(camp._id)}
                            className="rounded-xl border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50"
                            title="End Campaign"
                          >
                            <StopCircle className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Criteria & Budget Grid */}
                    <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4 lg:grid-cols-6 text-xs bg-white">
                      <div className="rounded-xl bg-slate-50/70 p-2.5 border border-slate-100">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Budget</span>
                        <span className="text-sm font-extrabold text-slate-900">
                          ₹{bud.totalBudget?.toLocaleString() || 0}
                        </span>
                        <p className="text-[10px] text-slate-500">₹{bud.usedBudget?.toLocaleString() || 0} credited</p>
                      </div>

                      <div className="rounded-xl bg-slate-50/70 p-2.5 border border-slate-100">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Reward Payout</span>
                        <span className="text-sm font-extrabold text-emerald-600">
                          {isPerf
                            ? `₹${pRules.rewardAmount || 0}`
                            : bRules.rewardType === 'FIXED'
                            ? `₹${bRules.fixedAmount || 0}`
                            : bRules.rewardType === 'PERCENTAGE'
                            ? `${bRules.percentage}% Rev`
                            : 'Tiered Ladder'}
                        </span>
                        <p className="text-[10px] text-slate-500">
                          {camp.approvalMode === 'AUTOMATIC' ? '⚡ Auto-credit' : '🛡️ Admin approval'}
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-50/70 p-2.5 border border-slate-100">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Target Metric</span>
                        <span className="text-xs font-bold text-slate-800">
                          {isPerf
                            ? `${pRules.minAverageRating || 4.5}⭐ & ${pRules.minCompletedBookings || 5} Jobs`
                            : `${bRules.targetThreshold || 'Tier'} (${bRules.targetType || 'Jobs'})`}
                        </span>
                        <p className="text-[10px] text-slate-500">
                          {isPerf ? `Logic: ${pRules.conditionLogic}` : `Policy: ${bRules.tierPolicy || 'Standard'}`}
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-50/70 p-2.5 border border-slate-100">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Timeline</span>
                        <span className="text-[11px] font-semibold text-slate-800 block">
                          {new Date(camp.startDate).toLocaleDateString()}
                        </span>
                        <p className="text-[10px] text-slate-500">to {new Date(camp.endDate).toLocaleDateString()}</p>
                      </div>

                      <div className="rounded-xl bg-slate-50/70 p-2.5 border border-slate-100">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Qualified Vendors</span>
                        <span className="text-sm font-extrabold text-emerald-700">
                          {camp.stats?.qualifiedCount || 0}
                        </span>
                        <p className="text-[10px] text-slate-500">Of {camp.stats?.participantsCount || 0} tracked</p>
                      </div>

                      <div className="rounded-xl bg-slate-50/70 p-2.5 border border-slate-100">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Eligibility</span>
                        <span className="text-[11px] font-bold text-slate-800">
                          {camp.eligibility?.verifiedOnly ? 'Verified KYC Only' : 'All Providers'}
                        </span>
                        <p className="text-[10px] text-slate-500">
                          {camp.eligibility?.categoryIds?.length > 0
                            ? `${camp.eligibility.categoryIds.length} categories`
                            : 'All Trades'}
                        </p>
                      </div>
                    </div>

                    {/* Tiered Ladders Preview if applicable */}
                    {!isPerf && bRules.rewardType === 'TIERED' && bRules.tiers?.length > 0 && (
                      <div className="border-t border-slate-100 bg-slate-50/40 px-5 py-2.5 flex flex-wrap items-center gap-2 text-xs">
                        <span className="font-bold text-slate-500 text-[11px]">Tier Ladders:</span>
                        {bRules.tiers.map((t, i) => (
                          <span
                            key={i}
                            className="rounded-lg bg-white px-2 py-0.5 border border-slate-200 font-medium text-slate-700"
                          >
                            Tier {t.tierNumber}: {t.targetValue} {bRules.targetType} ➡️ <strong>₹{t.rewardAmount}</strong>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 5: VENDOR REWARD PROGRESS */}
      {/* ========================================================= */}
      {activeTab === 'progress' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl bg-white p-4 border border-slate-200 shadow-2xs">
            <div className="relative w-72">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by vendor name or phone..."
                value={progressSearch}
                onChange={(e) => {
                  setProgressSearch(e.target.value)
                  loadVendorProgress(e.target.value, 1)
                }}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-3 py-1.5 text-xs font-medium focus:border-amber-500 focus:bg-white"
              />
            </div>
            <span className="text-xs text-slate-500 font-semibold">{progressTotal} vendor progress records</span>
          </div>

          {loading ? (
            <div className="flex h-60 items-center justify-center">
              <RefreshCw className="h-6 w-6 animate-spin text-amber-500" />
            </div>
          ) : vendorProgress.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
              <Users className="mx-auto h-10 w-10 text-slate-300" />
              <h3 className="mt-3 text-sm font-bold text-slate-800">No Vendor Progress Records</h3>
              <p className="mt-1 text-xs text-slate-500">
                Run reconciliation or complete customer bookings to track vendor performance.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {vendorProgress.map((vr) => {
                const v = vr.vendorId || {}
                const c = vr.campaignId || {}
                const p = vr.currentProgress || {}
                const pct = p.achievedPercentage || 0

                return (
                  <div
                    key={vr._id}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 font-bold text-white">
                          {v.fullName ? v.fullName[0].toUpperCase() : 'V'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-900">{v.fullName || 'Service Provider'}</h4>
                            <span className="text-xs text-slate-500 font-mono">({v.phone || 'No phone'})</span>
                          </div>
                          <p className="text-xs text-indigo-700 font-semibold">
                            Campaign: {c.name || 'Campaign'} ({vr.category})
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold ${
                            vr.status === 'CREDITED'
                              ? 'bg-emerald-100 text-emerald-800'
                              : vr.status === 'PENDING_APPROVAL'
                              ? 'bg-purple-100 text-purple-800 animate-pulse'
                              : vr.status === 'QUALIFIED'
                              ? 'bg-blue-100 text-blue-800'
                              : vr.status === 'REJECTED'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {vr.status}
                        </span>
                        {vr.status === 'PENDING_APPROVAL' && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedRewardForApproval(vr)
                              setApprovalModalOpen(true)
                            }}
                            className="rounded-xl bg-emerald-600 px-3 py-1 text-xs font-bold text-white shadow hover:bg-emerald-700"
                          >
                            Review & Approve
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Progress Bar & Details */}
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3 items-center">
                      <div className="sm:col-span-2 space-y-1.5">
                        <div className="flex items-center justify-between text-xs font-bold">
                          <span className="text-slate-700">
                            Current Progress: {p.currentValue || 0} / {p.targetRequired || 10} {p.unit || 'units'}
                          </span>
                          <span className="text-amber-600 font-black">{pct}%</span>
                        </div>
                        <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              pct >= 100
                                ? 'bg-emerald-500'
                                : 'bg-gradient-to-r from-amber-500 to-orange-500'
                            }`}
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                        <p className="text-[10px] text-slate-400">
                          {p.remainingRequired > 0
                            ? `Remaining: ${p.remainingRequired} ${p.unit || 'units'} to qualify`
                            : '🎉 Target completed!'}
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-50 p-2.5 text-right border border-slate-100">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Reward Incentive</span>
                        <span className="text-base font-black text-emerald-600">₹{vr.rewardAmount || 0}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 6: PENDING REWARD APPROVALS */}
      {/* ========================================================= */}
      {activeTab === 'pending' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl bg-white p-4 border border-slate-200 shadow-2xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Pending Reward Approvals Queue</h3>
              <p className="text-xs text-slate-500">
                Review qualified providers and approve instant atomic wallet payouts
              </p>
            </div>
            <span className="rounded-full bg-purple-100 px-3 py-1 text-xs font-bold text-purple-800">
              {pendingTotal} Awaiting Action
            </span>
          </div>

          {loading ? (
            <div className="flex h-60 items-center justify-center">
              <RefreshCw className="h-6 w-6 animate-spin text-amber-500" />
            </div>
          ) : pendingApprovals.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
              <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-400" />
              <h3 className="mt-3 text-sm font-bold text-slate-800">All Approvals Cleared!</h3>
              <p className="mt-1 text-xs text-slate-500">
                No vendor rewards are currently waiting for administrator review.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingApprovals.map((r) => {
                const v = r.vendorId || {}
                const c = r.campaignId || {}
                const p = r.currentProgress || {}

                return (
                  <div
                    key={r._id}
                    className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-purple-200 bg-white p-4 shadow-sm hover:shadow-md transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-600 font-bold text-white shadow-sm">
                        {v.fullName ? v.fullName[0].toUpperCase() : 'V'}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-extrabold text-slate-900">{v.fullName || 'Service Provider'}</h4>
                          <span className="text-xs text-slate-500 font-mono">({v.phone || 'No phone'})</span>
                        </div>
                        <p className="text-xs text-purple-900 font-medium">
                          Qualified for: <strong>{c.name || 'Campaign'}</strong> ({r.category})
                        </p>
                        <p className="text-[11px] text-slate-500">
                          Evidence: {p.completedBookings || 0} completed bookings • {p.averageRating || '—'}⭐ rating
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block">Reward</span>
                        <span className="text-lg font-black text-emerald-600">₹{r.rewardAmount || 0}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedRewardForApproval(r)
                          setApprovalModalOpen(true)
                        }}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700 active:scale-95"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        <span>Review & Approve</span>
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 7: REWARD TRANSACTIONS */}
      {/* ========================================================= */}
      {activeTab === 'transactions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl bg-white p-4 border border-slate-200 shadow-2xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Wallet Incentive Ledger</h3>
              <p className="text-xs text-slate-500">Financial records of all credited rewards and payout adjustments</p>
            </div>
            <span className="text-xs font-semibold text-slate-500">{transactionsTotal} total transactions</span>
          </div>

          {loading ? (
            <div className="flex h-60 items-center justify-center">
              <RefreshCw className="h-6 w-6 animate-spin text-amber-500" />
            </div>
          ) : transactions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
              <DollarSign className="mx-auto h-10 w-10 text-slate-300" />
              <h3 className="mt-3 text-sm font-bold text-slate-800">No Reward Transactions Yet</h3>
              <p className="mt-1 text-xs text-slate-500">Transactions will appear here when rewards are credited.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-100 bg-slate-50/80 text-[10px] font-bold uppercase text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Transaction Date</th>
                      <th className="px-4 py-3">Recipient Vendor</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Balance After</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                    {transactions.map((tx) => (
                      <tr key={tx._id} className="hover:bg-slate-50/60 transition">
                        <td className="px-4 py-3 text-slate-500">
                          {new Date(tx.createdAt).toLocaleString('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </td>
                        <td className="px-4 py-3 font-bold text-slate-900">
                          {tx.userId?.fullName || 'Vendor'}
                          <span className="block text-[10px] font-normal text-slate-400">{tx.userId?.phone}</span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 max-w-xs truncate">{tx.description}</td>
                        <td className="px-4 py-3 font-extrabold text-emerald-600">+₹{tx.amount}</td>
                        <td className="px-4 py-3 font-mono font-bold text-slate-900">₹{tx.balanceAfter}</td>
                        <td className="px-4 py-3">
                          <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                            {tx.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {tx.referenceId && (
                            <button
                              type="button"
                              onClick={() => handleReverseReward(tx.referenceId)}
                              className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-700 hover:bg-rose-100"
                              title="Reverse this credit"
                            >
                              <RotateCcw className="h-3 w-3" /> Reverse
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 8: REPORTS & AUDIT LOGS */}
      {/* ========================================================= */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-2xl bg-white p-4 border border-slate-200 shadow-2xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Reports & Audit Trail</h3>
              <p className="text-xs text-slate-500">Immutable chronological log of all administrative actions</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Action History</h4>
            {auditLogs.length === 0 ? (
              <p className="text-xs text-slate-400">No audit records recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {auditLogs.map((log) => (
                  <div
                    key={log._id}
                    className="flex items-center justify-between rounded-xl bg-slate-50 p-3 border border-slate-100 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[9px] font-bold text-white font-mono">
                          {log.action}
                        </span>
                        <span className="font-bold text-slate-800">{log.reason || 'Audit event'}</span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        By: {log.actorId?.fullName || log.actorRole} • Campaign: {log.campaignId?.name || '—'}
                      </p>
                    </div>
                    <span className="text-[10px] text-slate-400">
                      {new Date(log.createdAt).toLocaleString('en-IN', {
                        dateStyle: 'short',
                        timeStyle: 'short',
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* TAB 9: SETTINGS */}
      {/* ========================================================= */}
      {activeTab === 'settings' && settings && (
        <form onSubmit={handleSaveSettings} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm space-y-5 max-w-xl">
          <div>
            <h3 className="text-base font-bold text-slate-900">Master Rewards & Incentives Settings</h3>
            <p className="text-xs text-slate-500">Configure engine switches, limits, and reconciliation frequencies</p>
          </div>

          <div className="space-y-4 text-xs">
            <label className="flex items-center justify-between rounded-xl bg-slate-50 p-3 border border-slate-100 cursor-pointer">
              <div>
                <span className="font-bold text-slate-900 block">Rewards Engine Enabled</span>
                <span className="text-slate-500 text-[11px]">Master toggle to allow campaign evaluation and payouts</span>
              </div>
              <input
                type="checkbox"
                checked={settings.enabled}
                onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                className="h-4 w-4 rounded text-amber-600 focus:ring-amber-500"
              />
            </label>

            <label className="flex items-center justify-between rounded-xl bg-slate-50 p-3 border border-slate-100 cursor-pointer">
              <div>
                <span className="font-bold text-slate-900 block">Auto-Reconciliation Cron</span>
                <span className="text-slate-500 text-[11px]">Automatically calculate progress and activate scheduled campaigns</span>
              </div>
              <input
                type="checkbox"
                checked={settings.autoReconciliationEnabled}
                onChange={(e) => setSettings({ ...settings, autoReconciliationEnabled: e.target.checked })}
                className="h-4 w-4 rounded text-amber-600 focus:ring-amber-500"
              />
            </label>

            <div>
              <label className="block font-semibold text-slate-700">Reconciliation Interval (Minutes)</label>
              <input
                type="number"
                min="5"
                value={settings.reconciliationIntervalMinutes}
                onChange={(e) => setSettings({ ...settings, reconciliationIntervalMinutes: Number(e.target.value) })}
                className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 font-bold"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700">Max Global Budget Cap / Month (₹)</label>
              <input
                type="number"
                min="0"
                value={settings.maxGlobalBudgetPerMonth}
                onChange={(e) => setSettings({ ...settings, maxGlobalBudgetPerMonth: Number(e.target.value) })}
                className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 font-bold text-emerald-700"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={savingSettings}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-xs font-bold text-white shadow hover:bg-black disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>{savingSettings ? 'Saving...' : 'Save Settings'}</span>
          </button>
        </form>
      )}

      {/* Campaign Creation / Edit Modal */}
      <AdminCampaignModal
        isOpen={campaignModalOpen}
        onClose={() => {
          setCampaignModalOpen(false)
          setSelectedCampaignForEdit(null)
        }}
        campaign={selectedCampaignForEdit}
        onSuccess={() => {
          showToast('success', 'Campaign saved successfully')
          loadOverview()
          loadCampaigns()
        }}
      />

      {/* Reward Approval Modal */}
      <AdminRewardApprovalModal
        isOpen={approvalModalOpen}
        onClose={() => {
          setApprovalModalOpen(false)
          setSelectedRewardForApproval(null)
        }}
        reward={selectedRewardForApproval}
        onSuccess={() => {
          showToast('success', 'Approval action recorded successfully')
          loadOverview()
          loadPendingApprovals()
        }}
      />
    </div>
  )
}

export default AdminRewardsHubPage

