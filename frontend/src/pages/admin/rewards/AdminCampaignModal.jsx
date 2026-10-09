import React, { useState, useEffect } from 'react'
import {
  X,
  Plus,
  Trash2,
  Sparkles,
  Trophy,
  Percent,
  CheckCircle2,
  AlertTriangle,
  Layers,
  HelpCircle,
} from 'lucide-react'
import { rewardApi } from '../../../api/rewardApi.js'
import { fetchAdminLabourCategoryTree } from '../../../api/adminLabourCategoriesApi.js'

export function AdminCampaignModal({ isOpen, onClose, campaign, onSuccess }) {
  const isEdit = Boolean(campaign?._id)

  const [categories, setCategories] = useState([])
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  // Form State
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('PERFORMANCE')
  const [approvalMode, setApprovalMode] = useState('AUTOMATIC')
  const [evaluationPeriod, setEvaluationPeriod] = useState('MONTHLY')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [termsAndConditions, setTermsAndConditions] = useState('')
  const [totalBudget, setTotalBudget] = useState(50000)
  const [maxRewardPerVendor, setMaxRewardPerVendor] = useState('')
  const [maxEligibleVendors, setMaxEligibleVendors] = useState('')
  const [verifiedOnly, setVerifiedOnly] = useState(true)
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([])

  // Performance Rules State
  const [conditionLogic, setConditionLogic] = useState('ALL')
  const [minAverageRating, setMinAverageRating] = useState(4.8)
  const [minReviewsCount, setMinReviewsCount] = useState(5)
  const [minCompletedBookings, setMinCompletedBookings] = useState(5)
  const [maxCancellationRatePct, setMaxCancellationRatePct] = useState(5)
  const [performanceRewardAmount, setPerformanceRewardAmount] = useState(1000)

  // Business Rules State
  const [targetType, setTargetType] = useState('BOOKING_COUNT')
  const [rewardType, setRewardType] = useState('FIXED')
  const [targetThreshold, setTargetThreshold] = useState(10)
  const [fixedAmount, setFixedAmount] = useState(500)
  const [percentage, setPercentage] = useState(5)
  const [maxPercentageCap, setMaxPercentageCap] = useState(2000)
  const [tierPolicy, setTierPolicy] = useState('HIGHEST_TIER_ONLY')
  const [tiers, setTiers] = useState([
    { tierNumber: 1, targetValue: 10, rewardAmount: 200, label: 'Tier 1' },
    { tierNumber: 2, targetValue: 25, rewardAmount: 600, label: 'Tier 2' },
  ])

  useEffect(() => {
    // Load categories for selector
    fetchAdminLabourCategoryTree()
      .then((res) => {
        const list = res?.data?.categories || res?.data || (Array.isArray(res) ? res : [])
        setCategories(Array.isArray(list) ? list : [])
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (campaign) {
      setName(campaign.name || '')
      setCode(campaign.code || '')
      setDescription(campaign.description || '')
      setCategory(campaign.category || 'PERFORMANCE')
      setApprovalMode(campaign.approvalMode || 'AUTOMATIC')
      setEvaluationPeriod(campaign.evaluationPeriod || 'MONTHLY')
      setStartDate(campaign.startDate ? campaign.startDate.slice(0, 10) : '')
      setEndDate(campaign.endDate ? campaign.endDate.slice(0, 10) : '')
      setTermsAndConditions(campaign.termsAndConditions || '')
      setTotalBudget(campaign.budget?.totalBudget || 50000)
      setMaxRewardPerVendor(campaign.budget?.maxRewardPerVendor || '')
      setMaxEligibleVendors(campaign.budget?.maxEligibleVendors || '')
      setVerifiedOnly(campaign.eligibility?.verifiedOnly ?? true)
      setSelectedCategoryIds((campaign.eligibility?.categoryIds || []).map((c) => c._id || c))

      // Performance
      const p = campaign.performanceRules || {}
      setConditionLogic(p.conditionLogic || 'ALL')
      setMinAverageRating(p.minAverageRating ?? 4.8)
      setMinReviewsCount(p.minReviewsCount ?? 5)
      setMinCompletedBookings(p.minCompletedBookings ?? 5)
      setMaxCancellationRatePct(p.maxCancellationRatePct ?? 5)
      setPerformanceRewardAmount(p.rewardAmount ?? 1000)

      // Business
      const b = campaign.businessRules || {}
      setTargetType(b.targetType || 'BOOKING_COUNT')
      setRewardType(b.rewardType || 'FIXED')
      setTargetThreshold(b.targetThreshold ?? 10)
      setFixedAmount(b.fixedAmount ?? 500)
      setPercentage(b.percentage ?? 5)
      setMaxPercentageCap(b.maxPercentageCap ?? 2000)
      setTierPolicy(b.tierPolicy || 'HIGHEST_TIER_ONLY')
      if (b.tiers?.length > 0) setTiers(b.tiers)
    } else {
      // Default dates
      const now = new Date()
      const end = new Date(now.getFullYear(), now.getMonth() + 2, 0)
      setStartDate(now.toISOString().slice(0, 10))
      setEndDate(end.toISOString().slice(0, 10))
    }
  }, [campaign])

  if (!isOpen) return null

  const handleAddTier = () => {
    const nextNum = tiers.length + 1
    const lastTarget = tiers[tiers.length - 1]?.targetValue || 10
    const lastReward = tiers[tiers.length - 1]?.rewardAmount || 200
    setTiers([
      ...tiers,
      {
        tierNumber: nextNum,
        targetValue: lastTarget + 15,
        rewardAmount: lastReward + 400,
        label: `Tier ${nextNum}`,
      },
    ])
  }

  const handleRemoveTier = (idx) => {
    if (tiers.length <= 1) return
    setTiers(tiers.filter((_, i) => i !== idx).map((t, i) => ({ ...t, tierNumber: i + 1 })))
  }

  const handleUpdateTier = (idx, field, val) => {
    const next = [...tiers]
    next[idx] = { ...next[idx], [field]: val }
    setTiers(next)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')

    if (!name.trim()) {
      setErrorMsg('Please provide a campaign name')
      return
    }
    if (!startDate || !endDate) {
      setErrorMsg('Please provide valid start and end dates')
      return
    }
    if (new Date(endDate) <= new Date(startDate)) {
      setErrorMsg('End date must be strictly after start date')
      return
    }
    if (Number(totalBudget) <= 0) {
      setErrorMsg('Total campaign budget must be greater than 0')
      return
    }

    setBusy(true)

    const payload = {
      name: name.trim(),
      code: code ? code.trim() : undefined,
      description: description.trim(),
      category,
      approvalMode,
      evaluationPeriod,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      termsAndConditions: termsAndConditions.trim(),
      budget: {
        totalBudget: Number(totalBudget),
        maxRewardPerVendor: maxRewardPerVendor ? Number(maxRewardPerVendor) : null,
        maxEligibleVendors: maxEligibleVendors ? Number(maxEligibleVendors) : null,
      },
      eligibility: {
        verifiedOnly,
        categoryIds: selectedCategoryIds,
      },
      performanceRules:
        category === 'PERFORMANCE'
          ? {
              conditionLogic,
              minAverageRating: Number(minAverageRating),
              minReviewsCount: Number(minReviewsCount),
              minCompletedBookings: Number(minCompletedBookings),
              maxCancellationRatePct: Number(maxCancellationRatePct),
              rewardAmount: Number(performanceRewardAmount),
            }
          : undefined,
      businessRules:
        category === 'BUSINESS'
          ? {
              targetType,
              rewardType,
              targetThreshold: Number(targetThreshold),
              fixedAmount: Number(fixedAmount),
              percentage: Number(percentage),
              maxPercentageCap: Number(maxPercentageCap),
              tierPolicy,
              tiers: rewardType === 'TIERED' ? tiers : [],
            }
          : undefined,
    }

    try {
      if (isEdit) {
        await rewardApi.updateAdminCampaign(campaign._id, payload)
      } else {
        await rewardApi.createAdminCampaign(payload)
      }
      onSuccess?.()
      onClose()
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to save campaign')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">
                {isEdit ? 'Edit Reward Campaign' : 'Create New Reward Campaign'}
              </h2>
              <p className="text-xs text-slate-500">Configure rules, incentives, and qualification criteria</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Form Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {errorMsg && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Section 1: Basic Campaign Info */}
          <div className="space-y-3">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              1. Campaign Details
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700">Campaign Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., 5-Star Customer Service Champion"
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs font-medium focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Campaign Code (Optional)</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="Auto-generated if blank"
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs font-mono uppercase focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Category *</label>
                <select
                  value={category}
                  disabled={isEdit}
                  onChange={(e) => setCategory(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs font-bold text-slate-800 focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                >
                  <option value="PERFORMANCE">Performance-Based Reward (Rating/Quality)</option>
                  <option value="BUSINESS">Business-Based Incentive (Volume/Revenue)</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700">Description</label>
                <textarea
                  rows="2"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Summary of why providers are rewarded..."
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Dates, Budget & Approval Mode */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              2. Timeline, Budget & Approval Mode
            </label>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Start Date *</label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">End Date *</label>
                <input
                  type="date"
                  required
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Cycle Period</label>
                <select
                  value={evaluationPeriod}
                  onChange={(e) => setEvaluationPeriod(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs font-medium"
                >
                  <option value="DAILY">Daily</option>
                  <option value="WEEKLY">Weekly</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY">Quarterly</option>
                  <option value="CUSTOM">Full Campaign Range</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Approval Mode</label>
                <select
                  value={approvalMode}
                  onChange={(e) => setApprovalMode(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs font-bold text-slate-800"
                >
                  <option value="AUTOMATIC">Auto-Credit to Wallet</option>
                  <option value="MANUAL">Manual Admin Approval</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Total Budget (₹) *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={totalBudget}
                  onChange={(e) => setTotalBudget(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs font-bold text-emerald-700"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Max Cap/Vendor (₹)</label>
                <input
                  type="number"
                  placeholder="Optional limit"
                  value={maxRewardPerVendor}
                  onChange={(e) => setMaxRewardPerVendor(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Max Vendors</label>
                <input
                  type="number"
                  placeholder="e.g. 50"
                  value={maxEligibleVendors}
                  onChange={(e) => setMaxEligibleVendors(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-xs"
                />
              </div>
              <div className="flex items-center pt-5">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={verifiedOnly}
                    onChange={(e) => setVerifiedOnly(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span>Verified KYC Only</span>
                </label>
              </div>
            </div>
          </div>

          {/* Section 3: Criteria Builder (Performance vs Business) */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                3. {category === 'PERFORMANCE' ? 'Performance Criteria Rules' : 'Business Growth Incentive Rules'}
              </label>
            </div>

            {category === 'PERFORMANCE' ? (
              <div className="rounded-2xl bg-amber-50/60 border border-amber-200/80 p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Min Average Rating (⭐)</label>
                    <input
                      type="number"
                      step="0.1"
                      min="1"
                      max="5"
                      value={minAverageRating}
                      onChange={(e) => setMinAverageRating(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-amber-700"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Min Reviews Count</label>
                    <input
                      type="number"
                      min="1"
                      value={minReviewsCount}
                      onChange={(e) => setMinReviewsCount(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Min Completed Jobs</label>
                    <input
                      type="number"
                      min="1"
                      value={minCompletedBookings}
                      onChange={(e) => setMinCompletedBookings(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Max Cancellation Rate (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={maxCancellationRatePct}
                      onChange={(e) => setMaxCancellationRatePct(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-medium"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Condition Logic</label>
                    <select
                      value={conditionLogic}
                      onChange={(e) => setConditionLogic(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold"
                    >
                      <option value="ALL">ALL Conditions Must Match</option>
                      <option value="ANY">ANY Condition Matches</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Reward Payout (₹) *</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={performanceRewardAmount}
                      onChange={(e) => setPerformanceRewardAmount(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-black text-emerald-700"
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-indigo-50/60 border border-indigo-200/80 p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Target Metric</label>
                    <select
                      value={targetType}
                      onChange={(e) => setTargetType(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold"
                    >
                      <option value="BOOKING_COUNT">Completed Bookings</option>
                      <option value="SERVICE_REVENUE">Service Revenue (₹)</option>
                      <option value="NEW_CUSTOMERS">New Customer Acquisition</option>
                      <option value="REPEAT_CUSTOMERS">Repeat Customer Bookings</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Reward Structure</label>
                    <select
                      value={rewardType}
                      onChange={(e) => setRewardType(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold"
                    >
                      <option value="FIXED">Fixed Amount</option>
                      <option value="PERCENTAGE">Percentage of Revenue</option>
                      <option value="TIERED">Milestone / Tiered Rewards</option>
                    </select>
                  </div>

                  {rewardType === 'FIXED' && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">Target Threshold</label>
                        <input
                          type="number"
                          min="1"
                          value={targetThreshold}
                          onChange={(e) => setTargetThreshold(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">Fixed Reward (₹)</label>
                        <input
                          type="number"
                          min="1"
                          value={fixedAmount}
                          onChange={(e) => setFixedAmount(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-black text-emerald-700"
                        />
                      </div>
                    </>
                  )}

                  {rewardType === 'PERCENTAGE' && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">Min Target (₹)</label>
                        <input
                          type="number"
                          min="1"
                          value={targetThreshold}
                          onChange={(e) => setTargetThreshold(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">Percentage (%)</label>
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          max="100"
                          value={percentage}
                          onChange={(e) => setPercentage(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-indigo-700"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">Max Cap (₹)</label>
                        <input
                          type="number"
                          min="1"
                          value={maxPercentageCap}
                          onChange={(e) => setMaxPercentageCap(e.target.value)}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs"
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Tiered Rows Configuration */}
                {rewardType === 'TIERED' && (
                  <div className="space-y-2 pt-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-800">Tier Milestone Ladder</span>
                        <select
                          value={tierPolicy}
                          onChange={(e) => setTierPolicy(e.target.value)}
                          className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold"
                        >
                          <option value="HIGHEST_TIER_ONLY">Highest Tier Achieved Only</option>
                          <option value="CUMULATIVE">Cumulative (Sum of all completed tiers)</option>
                        </select>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddTier}
                        className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-bold text-white shadow hover:bg-indigo-700"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Tier
                      </button>
                    </div>

                    <div className="space-y-1.5">
                      {tiers.map((t, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 rounded-xl bg-white p-2.5 border border-slate-200 shadow-2xs"
                        >
                          <span className="w-12 text-center text-xs font-bold text-slate-500">Tier #{t.tierNumber}</span>
                          <input
                            type="number"
                            placeholder="Target Required"
                            value={t.targetValue}
                            onChange={(e) => handleUpdateTier(idx, 'targetValue', Number(e.target.value))}
                            className="w-32 rounded-lg border border-slate-200 p-1.5 text-xs font-semibold"
                          />
                          <span className="text-xs text-slate-400">➡️ Reward ₹</span>
                          <input
                            type="number"
                            placeholder="Reward (₹)"
                            value={t.rewardAmount}
                            onChange={(e) => handleUpdateTier(idx, 'rewardAmount', Number(e.target.value))}
                            className="w-32 rounded-lg border border-slate-200 p-1.5 text-xs font-bold text-emerald-700"
                          />
                          <input
                            type="text"
                            placeholder="Label (e.g. Silver)"
                            value={t.label || ''}
                            onChange={(e) => handleUpdateTier(idx, 'label', e.target.value)}
                            className="flex-1 rounded-lg border border-slate-200 p-1.5 text-xs"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveTier(idx)}
                            disabled={tiers.length <= 1}
                            className="text-slate-400 hover:text-rose-600 disabled:opacity-30"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 4: Terms & Conditions */}
          <div className="space-y-1 pt-2 border-t border-slate-100">
            <label className="block text-xs font-semibold text-slate-700">Terms & Conditions</label>
            <textarea
              rows="2"
              value={termsAndConditions}
              onChange={(e) => setTermsAndConditions(e.target.value)}
              placeholder="Eligibility conditions, terms of payout..."
              className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
          </div>

          {/* Submit Footer */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-amber-500/25 transition hover:brightness-105 active:scale-95 disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>{busy ? 'Saving...' : isEdit ? 'Update Campaign' : 'Create Campaign'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
