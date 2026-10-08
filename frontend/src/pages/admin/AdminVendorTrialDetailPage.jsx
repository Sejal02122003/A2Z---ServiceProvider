import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import { vendorTrialApi } from '../../api/vendorTrialApi.js'
import {
  UserCheck,
  UserX,
  Ban,
  Pause,
  Play,
  PlusCircle,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  Star,
  Clock,
  ArrowLeft,
  RefreshCw,
  HelpCircle,
  FileText,
  Activity,
  CreditCard,
} from 'lucide-react'

export function AdminVendorTrialDetailPage() {
  const { vendorId } = useParams()
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [toast, setToast] = useState({ type: '', message: '' })

  // Modal State
  const [modalType, setModalType] = useState(null)
  const [modalInput, setModalInput] = useState({ reason: '', notes: '', count: 1 })

  useEffect(() => {
    loadDetail()
  }, [vendorId])

  const loadDetail = async () => {
    setLoading(true)
    try {
      const res = await vendorTrialApi.getVendorTrialDetail(vendorId)
      if (res?.data) {
        setData(res.data)
      }
    } catch (err) {
      showToast('error', err?.message || 'Failed to load vendor trial details')
    } finally {
      setLoading(false)
    }
  }

  const showToast = (type, message) => {
    setToast({ type, message })
    setTimeout(() => setToast({ type: '', message: '' }), 4000)
  }

  const openModal = (type) => {
    setModalType(type)
    setModalInput({ reason: '', notes: '', count: 1 })
  }

  const closeModal = () => {
    setModalType(null)
    setModalInput({ reason: '', notes: '', count: 1 })
  }

  const handleAction = async () => {
    setActionLoading(true)
    try {
      if (modalType === 'CONFIRM') {
        await vendorTrialApi.confirmVendor(vendorId, modalInput.notes)
        showToast('success', 'Vendor confirmed successfully!')
      } else if (modalType === 'REJECT') {
        if (!modalInput.reason.trim()) throw new Error('Rejection reason is required')
        await vendorTrialApi.rejectVendor(vendorId, modalInput.reason)
        showToast('success', 'Vendor rejected successfully')
      } else if (modalType === 'BLOCK') {
        if (!modalInput.reason.trim()) throw new Error('Block reason is required')
        await vendorTrialApi.blockVendor(vendorId, modalInput.reason)
        showToast('success', 'Vendor blocked successfully')
      } else if (modalType === 'UNBLOCK') {
        await vendorTrialApi.unblockVendor(vendorId, modalInput.reason)
        showToast('success', 'Vendor unblocked successfully')
      } else if (modalType === 'PAUSE') {
        await vendorTrialApi.pauseTrial(vendorId, modalInput.reason)
        showToast('success', 'Trial paused')
      } else if (modalType === 'RESUME') {
        await vendorTrialApi.resumeTrial(vendorId)
        showToast('success', 'Trial resumed')
      } else if (modalType === 'EXTEND') {
        await vendorTrialApi.extendTrial(vendorId, {
          additionalCount: Number(modalInput.count) || 1,
          reason: modalInput.reason,
        })
        showToast('success', 'Trial extended')
      } else if (modalType === 'WAIVE') {
        await vendorTrialApi.waivePenalty(vendorId, modalInput.reason)
        showToast('success', 'Penalty waived and final chance activated')
      }
      closeModal()
      loadDetail()
    } catch (err) {
      showToast('error', err?.message || 'Action failed')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-3 text-slate-600">
          <RefreshCw className="h-6 w-6 animate-spin text-amber-500" />
          <span>Loading vendor trial dossier...</span>
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="p-8 text-center">
        <p className="text-base font-semibold text-slate-800">Vendor record not found</p>
        <Link to="/admin/vendor-trials" className="mt-2 inline-block text-sm text-indigo-600">
          Return to Trial Management
        </Link>
      </div>
    )
  }

  const { vendor, trial, stats, evaluations, warnings, finalChanceRequests, auditLogs } = data

  return (
    <div className="space-y-6 pb-16 max-w-6xl mx-auto">
      {/* Top Breadcrumb & Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Link
          to="/admin/vendor-trials"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Vendor Trials
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {trial.status === 'TRIAL_PAUSED' ? (
            <button
              onClick={() => openModal('RESUME')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm hover:bg-slate-50"
            >
              <Play className="h-3.5 w-3.5" /> Resume Trial
            </button>
          ) : (
            <button
              onClick={() => openModal('PAUSE')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <Pause className="h-3.5 w-3.5" /> Pause Trial
            </button>
          )}

          <button
            onClick={() => openModal('EXTEND')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <PlusCircle className="h-3.5 w-3.5 text-indigo-600" /> Extend Trial
          </button>

          {trial.status === 'FINAL_FAILURE' || trial.status === 'FINAL_CHANCE_PAYMENT_PENDING' ? (
            <button
              onClick={() => openModal('WAIVE')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 shadow-sm hover:bg-amber-100"
            >
              <CreditCard className="h-3.5 w-3.5" /> Waive Penalty
            </button>
          ) : null}

          {trial.status === 'BLOCKED' ? (
            <button
              onClick={() => openModal('UNBLOCK')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm hover:bg-emerald-100"
            >
              <ShieldCheck className="h-3.5 w-3.5" /> Unblock Vendor
            </button>
          ) : (
            <button
              onClick={() => openModal('BLOCK')}
              className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 shadow-sm hover:bg-rose-100"
            >
              <Ban className="h-3.5 w-3.5" /> Block
            </button>
          )}

          <button
            onClick={() => openModal('REJECT')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 shadow-sm hover:bg-slate-50"
          >
            <UserX className="h-3.5 w-3.5" /> Reject
          </button>

          <button
            onClick={() => openModal('CONFIRM')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700"
          >
            <UserCheck className="h-3.5 w-3.5" /> Confirm Vendor
          </button>
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

      {/* Vendor Profile Card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-2xl font-bold text-amber-600">
              {vendor.fullName ? vendor.fullName[0].toUpperCase() : 'V'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900">{vendor.fullName || 'Unnamed Vendor'}</h2>
                <span className="rounded-full bg-slate-900 px-2.5 py-0.5 text-xs font-bold text-white">
                  {trial.status}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                Phone: {vendor.phone} • Email: {vendor.email || 'N/A'} • Role: {vendor.role?.toUpperCase()}
              </p>
              <p className="text-xs text-slate-500">
                KYC Status:{' '}
                <span className="font-semibold text-emerald-600">
                  {vendor.labourProfile?.kycStatus?.toUpperCase() || 'VERIFIED'}
                </span>
              </p>
            </div>
          </div>

          <div className="text-right">
            <p className="text-xs text-slate-400">Trial Snapshot Rules</p>
            <p className="text-xs font-semibold text-slate-700">
              Required Trials: {trial.configuredTrialCount} • Pass Threshold: {trial.passingRatingThreshold}⭐
            </p>
            <p className="text-xs text-slate-500">Penalty Snapshot: ₹{trial.finalChancePenaltyAmount}</p>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6 border-t border-slate-100 pt-6">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Progress</p>
            <p className="text-lg font-bold text-slate-900">
              {stats.completedTrialCount} / {stats.totalAllowed}
            </p>
          </div>
          <div className="rounded-xl bg-emerald-50/50 p-3">
            <p className="text-xs text-emerald-700">Passed Trials</p>
            <p className="text-lg font-bold text-emerald-900">{stats.passedTrialCount}</p>
          </div>
          <div className="rounded-xl bg-rose-50/50 p-3">
            <p className="text-xs text-rose-700">Failed Trials</p>
            <p className="text-lg font-bold text-rose-900">{stats.failedTrialCount}</p>
          </div>
          <div className="rounded-xl bg-amber-50/50 p-3">
            <p className="text-xs text-amber-700">Average Rating</p>
            <div className="flex items-center gap-1">
              <span className="text-lg font-bold text-amber-900">{stats.averageRating || '—'}</span>
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            </div>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Warnings</p>
            <p className="text-lg font-bold text-slate-900">{stats.warningCount}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-xs text-slate-500">Final Chance</p>
            <p className="text-sm font-bold text-slate-900">
              {stats.finalChanceUsed ? 'Used' : 'Not Used'}
            </p>
          </div>
        </div>
      </div>

      {/* Trial Rating Evaluations (Requirement 8 & 33) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Star className="h-5 w-5 text-amber-500" /> Trial Rating Evaluations ({evaluations.length})
        </h3>

        {evaluations.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No bookings evaluated yet for this vendor.</p>
        ) : (
          <div className="space-y-3">
            {evaluations.map((ev) => (
              <div
                key={ev._id}
                className="flex flex-col gap-2 rounded-xl border border-slate-100 bg-slate-50/60 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-slate-900 px-2 py-0.5 text-xs font-bold text-white">
                      Trial #{ev.trialNumber}
                    </span>
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-bold ${
                        ev.result === 'PASSED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {ev.result}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">({ev.evaluationType})</span>
                  </div>

                  <p className="mt-1 text-sm text-slate-700">
                    Rating Feedback: <span className="italic">"{ev.ratingComment || 'No comment provided'}"</span>
                  </p>
                  <p className="text-xs text-slate-400">
                    Reviewed by: {ev.reviewerId?.fullName || 'Customer'} •{' '}
                    {new Date(ev.evaluatedAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="flex items-center gap-1 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200">
                  <span className="text-base font-bold text-amber-800">{ev.rating}</span>
                  <div className="flex">
                    {[1, 2, 3, 4, 5].map((st) => (
                      <Star
                        key={st}
                        className={`h-4 w-4 ${
                          st <= ev.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Warnings & Penalty Requests Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Warnings */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" /> Warnings Issued ({warnings.length})
          </h3>
          {warnings.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No low-performance warnings issued.</p>
          ) : (
            <div className="space-y-3">
              {warnings.map((w) => (
                <div key={w._id} className="rounded-xl border border-amber-200 bg-amber-50/50 p-3.5">
                  <div className="flex justify-between items-center text-xs font-semibold text-amber-900">
                    <span>Warning #{w.warningNumber} (Rating: {w.rating}⭐)</span>
                    <span className="text-amber-700">{new Date(w.issuedAt).toLocaleDateString()}</span>
                  </div>
                  <p className="mt-1 text-xs text-amber-800">{w.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Final Chance Requests */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-indigo-500" /> Final Chance Requests ({finalChanceRequests.length})
          </h3>
          {finalChanceRequests.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No final chance requests created.</p>
          ) : (
            <div className="space-y-3">
              {finalChanceRequests.map((fc) => (
                <div key={fc._id} className="rounded-xl border border-slate-200 bg-slate-50 p-3.5">
                  <div className="flex justify-between items-center text-xs font-semibold text-slate-900">
                    <span>Penalty Amount: ₹{fc.penaltyAmount}</span>
                    <span className="rounded bg-indigo-50 px-2 py-0.5 text-[11px] font-bold text-indigo-700">
                      {fc.status}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Requested: {new Date(fc.requestedAt).toLocaleString()}
                    {fc.paidAt && ` • Paid: ${new Date(fc.paidAt).toLocaleString()}`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Complete Audit Log Timeline (Requirement 39) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-base font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5 text-slate-600" /> Audit Trail ({auditLogs.length})
        </h3>
        {auditLogs.length === 0 ? (
          <p className="text-xs text-slate-400 italic">No audit records found.</p>
        ) : (
          <div className="space-y-3">
            {auditLogs.map((log) => (
              <div key={log._id} className="flex items-start gap-3 border-l-2 border-slate-200 pl-4 py-1 text-xs">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">{log.action}</span>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                      {log.actorRole}
                    </span>
                    <span className="text-slate-400">{new Date(log.timestamp).toLocaleString()}</span>
                  </div>
                  {log.reason && <p className="mt-0.5 text-slate-600">{log.reason}</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action Dialog Modal */}
      {modalType && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900">
              {modalType === 'CONFIRM' && 'Confirm Vendor'}
              {modalType === 'REJECT' && 'Reject Vendor'}
              {modalType === 'BLOCK' && 'Block Vendor'}
              {modalType === 'UNBLOCK' && 'Unblock Vendor'}
              {modalType === 'PAUSE' && 'Pause Trial'}
              {modalType === 'RESUME' && 'Resume Trial'}
              {modalType === 'EXTEND' && 'Grant Additional Trials'}
              {modalType === 'WAIVE' && 'Waive Penalty & Activate Final Chance'}
            </h3>

            {modalType === 'CONFIRM' && (
              <div className="mt-3">
                <p className="text-xs text-slate-500 mb-2">
                  The vendor will become a fully active production service provider.
                </p>
                <label className="block text-xs font-semibold text-slate-700">Confirmation Notes</label>
                <textarea
                  rows="3"
                  value={modalInput.notes}
                  onChange={(e) => setModalInput({ ...modalInput, notes: e.target.value })}
                  placeholder="e.g. Excellent trial service quality."
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                />
              </div>
            )}

            {(modalType === 'REJECT' || modalType === 'BLOCK' || modalType === 'PAUSE' || modalType === 'UNBLOCK' || modalType === 'WAIVE') && (
              <div className="mt-3">
                <label className="block text-xs font-semibold text-slate-700">
                  Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  rows="3"
                  required
                  value={modalInput.reason}
                  onChange={(e) => setModalInput({ ...modalInput, reason: e.target.value })}
                  placeholder="Enter detailed reason..."
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                />
              </div>
            )}

            {modalType === 'EXTEND' && (
              <div className="mt-3 space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Additional Trial Count</label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={modalInput.count}
                    onChange={(e) => setModalInput({ ...modalInput, count: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Reason</label>
                  <textarea
                    rows="2"
                    value={modalInput.reason}
                    onChange={(e) => setModalInput({ ...modalInput, reason: e.target.value })}
                    placeholder="Reason for extension..."
                    className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm"
                  />
                </div>
              </div>
            )}

            {modalType === 'RESUME' && (
              <p className="mt-3 text-sm text-slate-600">
                Are you sure you want to resume this vendor's trial services?
              </p>
            )}

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeModal}
                disabled={actionLoading}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAction}
                disabled={actionLoading}
                className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-bold text-white shadow hover:bg-black disabled:opacity-50"
              >
                {actionLoading ? 'Processing...' : 'Confirm Action'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
