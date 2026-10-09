import React, { useState } from 'react'
import {
  X,
  CheckCircle2,
  XCircle,
  AlertCircle,
  User,
  Phone,
  Star,
  Trophy,
  Calendar,
  Wallet,
  ShieldCheck,
} from 'lucide-react'
import { rewardApi } from '../../../api/rewardApi.js'

export function AdminRewardApprovalModal({ isOpen, onClose, reward, onSuccess }) {
  const [actionType, setActionType] = useState('APPROVE') // 'APPROVE' | 'REJECT'
  const [notes, setNotes] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  if (!isOpen || !reward) return null

  const vendor = reward.vendorId || {}
  const campaign = reward.campaignId || {}
  const progress = reward.currentProgress || {}
  const evidence = reward.qualificationEvidence || {}

  const handleApprove = async () => {
    setBusy(true)
    setErrorMsg('')
    try {
      await rewardApi.approveAdminReward(reward._id, notes)
      onSuccess?.()
      onClose()
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to approve reward')
    } finally {
      setBusy(false)
    }
  }

  const handleReject = async () => {
    if (!reason.trim()) {
      setErrorMsg('Please enter a rejection reason')
      return
    }
    setBusy(true)
    setErrorMsg('')
    try {
      await rewardApi.rejectAdminReward(reward._id, reason)
      onSuccess?.()
      onClose()
    } catch (err) {
      setErrorMsg(err?.message || 'Failed to reject reward')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900">Review Reward Qualification</h2>
              <p className="text-xs text-slate-500">{campaign.name || 'Incentive Campaign'}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {errorMsg && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Vendor Profile Card */}
          <div className="flex items-center justify-between rounded-2xl bg-slate-50 p-4 border border-slate-100">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500 font-bold text-white shadow-sm">
                {vendor.fullName ? vendor.fullName[0].toUpperCase() : 'V'}
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold text-slate-900">{vendor.fullName || 'Service Provider'}</h3>
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800">
                    KYC {vendor.labourProfile?.kycStatus || 'VERIFIED'}
                  </span>
                </div>
                <p className="text-xs text-slate-500">{vendor.phone ? `+91 ${vendor.phone}` : 'No phone'}</p>
              </div>
            </div>

            <div className="text-right">
              <p className="text-[10px] uppercase font-bold text-slate-400">Reward Amount</p>
              <p className="text-lg font-black text-emerald-600">₹{reward.rewardAmount || 0}</p>
            </div>
          </div>

          {/* Qualification Evidence Snapshot */}
          <div className="rounded-2xl border border-amber-200/80 bg-amber-50/40 p-4 space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-amber-600" /> Metric Qualification Evidence
            </h4>

            <div className="grid grid-cols-2 gap-2 text-xs pt-1 sm:grid-cols-4">
              <div className="rounded-xl bg-white p-2.5 border border-amber-100 text-center">
                <span className="text-[10px] text-slate-400 font-semibold block">Completed Jobs</span>
                <span className="text-sm font-extrabold text-slate-900">{progress.completedBookings ?? '—'}</span>
              </div>

              <div className="rounded-xl bg-white p-2.5 border border-amber-100 text-center">
                <span className="text-[10px] text-slate-400 font-semibold block">Avg Rating</span>
                <div className="flex items-center justify-center gap-0.5 mt-0.5">
                  <span className="text-sm font-extrabold text-amber-600">{progress.averageRating ?? '—'}</span>
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                </div>
              </div>

              <div className="rounded-xl bg-white p-2.5 border border-amber-100 text-center">
                <span className="text-[10px] text-slate-400 font-semibold block">Total Revenue</span>
                <span className="text-sm font-extrabold text-slate-900">₹{progress.totalRevenue ?? 0}</span>
              </div>

              <div className="rounded-xl bg-white p-2.5 border border-amber-100 text-center">
                <span className="text-[10px] text-slate-400 font-semibold block">Cancel Rate</span>
                <span className="text-sm font-extrabold text-slate-900">{progress.cancellationRate ?? 0}%</span>
              </div>
            </div>

            {evidence.notes && (
              <p className="text-xs text-slate-600 italic pt-1">
                "{evidence.notes}"
              </p>
            )}
          </div>

          {/* Action Tabs */}
          <div className="flex rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setActionType('APPROVE')}
              className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
                actionType === 'APPROVE' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Approve & Credit to Wallet
            </button>
            <button
              type="button"
              onClick={() => setActionType('REJECT')}
              className={`flex-1 rounded-lg py-2 text-xs font-bold transition ${
                actionType === 'REJECT' ? 'bg-rose-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Reject Qualification
            </button>
          </div>

          {actionType === 'APPROVE' ? (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">Approval Note (Optional)</label>
              <textarea
                rows="2"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Verified performance standards met."
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
              <p className="text-[11px] text-slate-500">
                Approving will immediately credit <strong>₹{reward.rewardAmount}</strong> to the vendor's wallet and send a push notification.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-700">
                Rejection Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows="2"
                required
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g., Unresolved complaint during evaluation period."
                className="w-full rounded-xl border border-rose-200 p-2.5 text-xs focus:border-rose-500 focus:ring-1 focus:ring-rose-500"
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 bg-slate-50/80 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          {actionType === 'APPROVE' ? (
            <button
              type="button"
              onClick={handleApprove}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700 disabled:opacity-50"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>{busy ? 'Crediting Wallet...' : `Confirm & Credit ₹${reward.rewardAmount}`}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleReject}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-rose-700 disabled:opacity-50"
            >
              <XCircle className="h-4 w-4" />
              <span>{busy ? 'Rejecting...' : 'Reject Reward'}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
