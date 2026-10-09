import React, { useState, useEffect } from 'react';
import { 
  Award, 
  TrendingUp, 
  Gift, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight, 
  DollarSign, 
  Star, 
  Briefcase, 
  Zap, 
  Info,
  Calendar,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
  Sparkles
} from 'lucide-react';
import { rewardApi } from '../../api/rewardApi';

export default function VendorRewardsPage() {
  const [activeTab, setActiveTab] = useState('active'); // 'active' | 'history' | 'tiers'
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [history, setHistory] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchVendorRewardsData = async () => {
    try {
      setError(null);
      const [summaryRes, campaignsRes, historyRes] = await Promise.all([
        rewardApi.getVendorRewardSummary(),
        rewardApi.getVendorActiveCampaigns(),
        rewardApi.getVendorRewardHistory()
      ]);

      if (summaryRes?.success) setSummary(summaryRes.data);
      if (campaignsRes?.success) setCampaigns(campaignsRes.data || []);
      if (historyRes?.success) setHistory(historyRes.data || []);
    } catch (err) {
      console.error('Failed to load vendor rewards:', err);
      setError(err?.response?.data?.message || 'Unable to load reward programs. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchVendorRewardsData();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchVendorRewardsData();
  };

  const formatCurrency = (amt) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(amt || 0);
  };

  if (loading) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-gray-600 font-medium">Loading your rewards and incentive progress...</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Top Header Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-gray-900 via-indigo-950 to-purple-950 text-white p-6 md:p-8 shadow-2xl border border-indigo-800/40">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-semibold uppercase tracking-wider border border-amber-500/30">
              <Sparkles className="w-3.5 h-3.5" />
              Partner Incentive Program
            </div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white flex items-center gap-3">
              Rewards & Incentives Hub
            </h1>
            <p className="text-indigo-200 text-sm max-w-xl">
              Earn direct wallet bonuses by maintaining 5-star ratings, completing more service bookings, and hitting monthly performance milestones.
            </p>
          </div>

          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="self-start md:self-center flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-medium transition backdrop-blur-sm border border-white/10"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Sync Progress
          </button>
        </div>

        {/* Summary Metrics Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-6 border-t border-white/10">
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <span className="text-xs font-medium text-indigo-300 block mb-1">Total Earned</span>
            <div className="text-2xl font-black text-emerald-400">
              {formatCurrency(summary?.totalEarned)}
            </div>
            <span className="text-[11px] text-gray-400 mt-1 block">Credited to wallet</span>
          </div>

          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <span className="text-xs font-medium text-amber-300 block mb-1">Pending Approval</span>
            <div className="text-2xl font-black text-amber-400">
              {formatCurrency(summary?.pendingApprovalAmount)}
            </div>
            <span className="text-[11px] text-gray-400 mt-1 block">{summary?.pendingApprovalCount || 0} rewards in review</span>
          </div>

          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <span className="text-xs font-medium text-indigo-300 block mb-1">Active Programs</span>
            <div className="text-2xl font-black text-white">
              {summary?.activeCampaignsCount || 0}
            </div>
            <span className="text-[11px] text-gray-400 mt-1 block">Eligible campaigns</span>
          </div>

          <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
            <span className="text-xs font-medium text-purple-300 block mb-1">Rewards Won</span>
            <div className="text-2xl font-black text-purple-300">
              {summary?.completedRewardsCount || 0}
            </div>
            <span className="text-[11px] text-gray-400 mt-1 block">Lifetime claims</span>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex gap-2 border-b border-gray-200 pb-1">
        <button
          onClick={() => setActiveTab('active')}
          className={`px-4 py-2.5 rounded-xl font-medium text-sm transition flex items-center gap-2 ${
            activeTab === 'active'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Zap className="w-4 h-4" />
          Active Challenges ({campaigns.length})
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2.5 rounded-xl font-medium text-sm transition flex items-center gap-2 ${
            activeTab === 'history'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <Clock className="w-4 h-4" />
          Reward History ({history.length})
        </button>
      </div>

      {/* Tab 1: Active Campaigns & Live Progress */}
      {activeTab === 'active' && (
        <div className="space-y-6">
          {campaigns.length === 0 ? (
            <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 shadow-sm">
              <Gift className="w-16 h-16 text-gray-300 mx-auto mb-4 animate-bounce" />
              <h3 className="text-lg font-bold text-gray-800 mb-1">No Active Campaigns Available</h3>
              <p className="text-gray-500 text-sm max-w-md mx-auto">
                There are currently no active incentive programs open for your category or zone. Please check back soon for new offers!
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {campaigns.map((item) => {
                const campaign = item.campaign || item;
                const progress = item.progress || {};
                const pct = Math.min(100, Math.round(progress.percentage || 0));
                const isQualified = item.status === 'QUALIFIED' || item.status === 'APPROVED' || item.status === 'CREDITED';

                return (
                  <div 
                    key={campaign._id}
                    className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition flex flex-col justify-between"
                  >
                    <div>
                      {/* Badge & Category */}
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                          campaign.category === 'PERFORMANCE' 
                            ? 'bg-amber-100 text-amber-800 border border-amber-200' 
                            : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        }`}>
                          {campaign.category === 'PERFORMANCE' ? 'Performance Reward' : 'Business Growth'}
                        </span>

                        <span className="text-xs font-semibold text-gray-400 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {campaign.evaluationPeriod}
                        </span>
                      </div>

                      {/* Title & Description */}
                      <h3 className="text-lg font-bold text-gray-900 mb-1">{campaign.name}</h3>
                      <p className="text-sm text-gray-500 line-clamp-2 mb-4">{campaign.description}</p>

                      {/* Reward Amount Highlight */}
                      <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex items-center justify-between mb-4">
                        <div>
                          <span className="text-xs font-medium text-indigo-700 block">Reward Incentive</span>
                          <span className="text-xl font-black text-indigo-950">
                            {campaign.rewardType === 'PERCENTAGE' 
                              ? `${campaign.percentageConfig?.percentage || 0}% Revenue Bonus` 
                              : formatCurrency(item.potentialReward || campaign.rewardAmount || (campaign.businessTiers?.[0]?.rewardAmount))}
                          </span>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
                          <Award className="w-5 h-5" />
                        </div>
                      </div>

                      {/* Progress Bar & Current Metric */}
                      <div className="space-y-2 mb-4">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-gray-700 flex items-center gap-1">
                            <TrendingUp className="w-3.5 h-3.5 text-indigo-600" />
                            Target Progress
                          </span>
                          <span className={pct >= 100 ? 'text-emerald-600' : 'text-indigo-600'}>
                            {pct}% Completed
                          </span>
                        </div>

                        <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden p-0.5 border border-gray-200/60">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              pct >= 100 
                                ? 'bg-gradient-to-r from-emerald-500 to-teal-500' 
                                : 'bg-gradient-to-r from-indigo-500 to-purple-600'
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>

                        {/* Metric Highlights */}
                        <div className="grid grid-cols-2 gap-2 pt-1 text-xs text-gray-600">
                          {progress.currentCompletedBookings !== undefined && (
                            <div className="bg-gray-50 p-2 rounded-xl border border-gray-100">
                              <span className="text-gray-400 block text-[10px]">Completed Jobs</span>
                              <span className="font-bold text-gray-800">{progress.currentCompletedBookings} Bookings</span>
                            </div>
                          )}

                          {progress.currentRating !== undefined && (
                            <div className="bg-gray-50 p-2 rounded-xl border border-gray-100">
                              <span className="text-gray-400 block text-[10px]">Rating Score</span>
                              <span className="font-bold text-amber-600 flex items-center gap-1">
                                <Star className="w-3 h-3 fill-amber-500" />
                                {progress.currentRating ? Number(progress.currentRating).toFixed(1) : 'N/A'}
                              </span>
                            </div>
                          )}

                          {progress.currentRevenue !== undefined && (
                            <div className="bg-gray-50 p-2 rounded-xl border border-gray-100">
                              <span className="text-gray-400 block text-[10px]">Service Revenue</span>
                              <span className="font-bold text-emerald-600">{formatCurrency(progress.currentRevenue)}</span>
                            </div>
                          )}

                          {progress.currentNewCustomers !== undefined && (
                            <div className="bg-gray-50 p-2 rounded-xl border border-gray-100">
                              <span className="text-gray-400 block text-[10px]">New Customers</span>
                              <span className="font-bold text-indigo-600">{progress.currentNewCustomers} Acquired</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Tiered Ladders Preview if applicable */}
                      {campaign.rewardType === 'TIERED' && campaign.businessTiers?.length > 0 && (
                        <div className="mb-4 bg-gray-50 p-3 rounded-2xl border border-gray-100 space-y-1.5">
                          <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wider block">Milestone Ladders</span>
                          {campaign.businessTiers.map((tier, idx) => (
                            <div key={idx} className="flex justify-between text-xs items-center py-1 border-b border-gray-200/50 last:border-0">
                              <span className="text-gray-700 font-medium">
                                {tier.tierName || `Tier ${idx + 1}`}: {tier.targetValue} {tier.targetMetric === 'COMPLETED_BOOKINGS' ? 'Jobs' : 'Revenue'}
                              </span>
                              <span className="font-bold text-emerald-600">+{formatCurrency(tier.rewardAmount)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Footer Status & Info Button */}
                    <div className="pt-4 border-t border-gray-100 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 text-xs">
                        {isQualified ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                            <CheckCircle2 className="w-4 h-4" />
                            Target Achieved!
                          </span>
                        ) : (
                          <span className="text-gray-500">
                            {progress.remainingToTarget ? `${progress.remainingToTarget} more needed` : 'In Progress'}
                          </span>
                        )}
                      </div>

                      <button
                        onClick={() => setSelectedCampaign(campaign)}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 hover:underline"
                      >
                        Rules & Terms
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Reward History & Credited Wallets */}
      {activeTab === 'history' && (
        <div className="bg-white rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-900">Reward History & Claims</h3>
              <p className="text-xs text-gray-500">All evaluated bonuses, pending approvals and wallet disbursements</p>
            </div>
          </div>

          {history.length === 0 ? (
            <div className="p-12 text-center">
              <Gift className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-sm font-semibold text-gray-700">No reward claims yet</p>
              <p className="text-xs text-gray-400 mt-1">Complete more bookings and maintain 5-star ratings to qualify for your first reward.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-gray-600">
                <thead className="bg-gray-50/80 text-xs uppercase font-bold text-gray-500 border-b border-gray-100">
                  <tr>
                    <th className="px-6 py-3.5">Campaign Name</th>
                    <th className="px-6 py-3.5">Period</th>
                    <th className="px-6 py-3.5">Reward Amount</th>
                    <th className="px-6 py-3.5">Status</th>
                    <th className="px-6 py-3.5">Wallet Ref</th>
                    <th className="px-6 py-3.5">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {history.map((rew) => (
                    <tr key={rew._id} className="hover:bg-gray-50/60 transition">
                      <td className="px-6 py-4 font-bold text-gray-900">
                        {rew.campaign?.name || 'Campaign'}
                        <span className="block text-xs font-normal text-gray-400">{rew.campaign?.category}</span>
                      </td>
                      <td className="px-6 py-4 text-xs font-medium text-gray-600">
                        {new Date(rew.periodStart).toLocaleDateString()} - {new Date(rew.periodEnd).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 font-black text-emerald-600 text-base">
                        {formatCurrency(rew.rewardAmount)}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                          rew.status === 'CREDITED'
                            ? 'bg-emerald-100 text-emerald-800'
                            : rew.status === 'APPROVED'
                            ? 'bg-blue-100 text-blue-800'
                            : rew.status === 'PENDING_APPROVAL' || rew.status === 'QUALIFIED'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {rew.status === 'CREDITED' && <CheckCircle2 className="w-3 h-3" />}
                          {rew.status === 'PENDING_APPROVAL' && <Clock className="w-3 h-3" />}
                          {rew.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-400">
                        {rew.creditTransactionId ? (
                          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                            {rew.creditTransactionId.slice(-8)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-gray-400">
                        {new Date(rew.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Rules & Terms Modal */}
      {selectedCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-600">Campaign Rules</span>
                <h3 className="text-xl font-bold text-gray-900">{selectedCampaign.name}</h3>
              </div>
              <button 
                onClick={() => setSelectedCampaign(null)}
                className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-sm text-gray-600">
              <p>{selectedCampaign.description}</p>

              <div className="bg-indigo-50 p-4 rounded-2xl border border-indigo-100 space-y-2">
                <span className="font-bold text-xs text-indigo-900 uppercase">Eligibility Criteria:</span>
                <ul className="list-disc pl-5 text-xs text-indigo-800 space-y-1">
                  {selectedCampaign.category === 'PERFORMANCE' && (
                    <>
                      {selectedCampaign.performanceRules?.minAverageRating && (
                        <li>Minimum Average Rating: <strong>{selectedCampaign.performanceRules.minAverageRating} / 5.0</strong></li>
                      )}
                      {selectedCampaign.performanceRules?.minEligibleReviews && (
                        <li>Minimum Verified Reviews: <strong>{selectedCampaign.performanceRules.minEligibleReviews} reviews</strong></li>
                      )}
                      {selectedCampaign.performanceRules?.minCompletedBookings && (
                        <li>Minimum Completed Bookings: <strong>{selectedCampaign.performanceRules.minCompletedBookings} jobs</strong></li>
                      )}
                      {selectedCampaign.performanceRules?.maxCancellationRate !== undefined && (
                        <li>Max Cancellation Rate: <strong>{selectedCampaign.performanceRules.maxCancellationRate}%</strong></li>
                      )}
                    </>
                  )}

                  {selectedCampaign.category === 'BUSINESS' && (
                    <>
                      {selectedCampaign.businessTiers?.map((tier, i) => (
                        <li key={i}>
                          Tier {i + 1}: Reach <strong>{tier.targetValue} {tier.targetMetric}</strong> to earn <strong>{formatCurrency(tier.rewardAmount)}</strong>
                        </li>
                      ))}
                    </>
                  )}
                </ul>
              </div>

              {selectedCampaign.termsAndConditions && (
                <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-xl border border-gray-100">
                  <span className="font-bold block mb-1 text-gray-700">Terms & Conditions:</span>
                  <p>{selectedCampaign.termsAndConditions}</p>
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedCampaign(null)}
              className="w-full py-3 rounded-xl bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 transition"
            >
              Got it, Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
