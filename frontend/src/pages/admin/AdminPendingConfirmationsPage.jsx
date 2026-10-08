import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { vendorTrialApi } from '../../api/vendorTrialApi.js'
import {
  CheckCircle2,
  XCircle,
  ShieldAlert,
  HelpCircle,
  PlusCircle,
  Star,
  Clock,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  UserCheck,
  UserX,
  Ban,
  MessageSquare,
} from 'lucide-react'

export function AdminPendingConfirmationsPage() {
  const [loading, setLoading] = useState(true)
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [actionLoading, setActionLoading] = useState(false)
  const [toast, setToast] = useState({ type: '', message: '' })

  // Action Modals State
  const [activeModal, setActiveModal] = useState(null) // 'CONFIRM' | 'REJECT' | 'BLOCK' | 'REQUEST_REVIEW' | 'ADDITIONAL_TRIAL'
  const [selectedVendor, setSelectedVendor] = useState(null)
  const [modalInput, setModalInput] = useState({
    notes: '',
    reason: '',
    additionalCount: 1,
  })

  useEffect(() => {
    loadPendingConfirmations()
  }, [page])

  const loadPendingConfirmations = async () => {
    setLoading(true)
    try {
      const res = await vendorTrialApi.getPendingConfirmations({ page, limit: 10 })
      if (res?.data) {
        setItems(res.data.pendingConfirmations || [])
        setTotal(res.data.total || 0)
      }
    } catch (err) {
      showToast('error', err?.message || 'Failed to load pending confirmations')
    } finally {
      setLoading(false)
    }
  }

  const showToast = (type, message) => {
    setToast({ type, message })
    setTimeout(() => setToast({ type: '', message: '' }), 4000)
  }

  const openActionModal = (type, trial) => {
    setSelectedVendor(trial)
    setActiveModal(type)
    setModalInput({ notes: '', reason: '', additionalCount: 1 })
  }

  const closeActionModal = () => {
    setActiveModal(null)
    setSelectedVendor(null)
    setModalInput({ notes: '', reason: '', additionalCount: 1 })
  }

  const handleConfirmVendor = async () => {
    if (!selectedVendor) return
    setActionLoading(true)
    const vendorId = selectedVendor.vendorId?._id || selectedVendor.vendorId
    try {
      await vendorTrialApi.confirmVendor(vendorId, modalInput.notes)
      showToast('success', `${selectedVendor.vendorSummary?.vendorName || 'Vendor'} confirmed successfully!`)
      closeActionModal()
      loadPendingConfirmations()
    } catch (err) {
      showToast('error', err?.message || 'Failed to confirm vendor')
    } finally {
      setActionLoading(false)
    }
  }

  const handleRejectVendor = async () => {
    if (!selectedVendor) return
    if (!modalInput.reason.trim()) {
      showToast('error', 'Please enter a rejection reason')
      return
    }
    setActionLoading(true)
    const vendorId = selectedVendor.vendorId?._id || selectedVendor.vendorId
    try {
      await vendorTrialApi.rejectVendor(vendorId, modalInput.reason)
      showToast('success', 'Vendor rejected successfully')
      closeActionModal()
      loadPendingConfirmations()
    } catch (err) {
      showToast('error', err?.message || 'Failed to reject vendor')
    } finally {
      setActionLoading(false)
    }
  }

  const handleBlockVendor = async () => {
    if (!selectedVendor) return
    if (!modalInput.reason.trim()) {
      showToast('error', 'Please enter a block reason')
      return
    }
    setActionLoading(true)
    const vendorId = selectedVendor.vendorId?._id || selectedVendor.vendorId
    try {
      await vendorTrialApi.blockVendor(vendorId, modalInput.reason)
      showToast('success', 'Vendor blocked successfully')
      closeActionModal()
      loadPendingConfirmations()
    } catch (err) {
      showToast('error', err?.message || 'Failed to block vendor')
    } finally {
      setActionLoading(false)
    }
  }

  const handleRequestReview = async () => {
    if (!selectedVendor) return
    if (!modalInput.reason.trim()) {
      showToast('error', 'Please enter a review reason')
      return
    }
    setActionLoading(true)
    const vendorId = selectedVendor.vendorId?._id || selectedVendor.vendorId
    try {
      await vendorTrialApi.requestReview(vendorId, modalInput.reason)
      showToast('success', 'Additional review request recorded')
      closeActionModal()
      loadPendingConfirmations()
    } catch (err) {
      showToast('error', err?.message || 'Failed to request review')
    } finally {
      setActionLoading(false)
    }
  }

  const handleGrantAdditionalTrial = async () => {
    if (!selectedVendor) return
    setActionLoading(true)
    const vendorId = selectedVendor.vendorId?._id || selectedVendor.vendorId
    try {
      await vendorTrialApi.extendTrial(vendorId, {
        additionalCount: Number(modalInput.additionalCount) || 1,
        reason: modalInput.reason,
      })
      showToast('success', `Granted ${modalInput.additionalCount || 1} additional trial service(s)`)
      closeActionModal()
      loadPendingConfirmations()
    } catch (err) {
      showToast('error', err?.message || 'Failed to grant additional trial')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Pending Confirmations</h1>
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
              {total} Eligible
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Requirement 47: Review all vendors who have completed trial services. Confirm, reject, block, or request additional reviews.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/admin/vendor-trials"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            Trial Management Hub
          </Link>
          <button
            type="button"
            onClick={loadPendingConfirmations}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-slate-800"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
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

      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <div className="flex items-center gap-3 text-slate-600">
            <RefreshCw className="h-6 w-6 animate-spin text-amber-500" />
            <span>Loading pending confirmation queue...</span>
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <UserCheck className="h-7 w-7" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-slate-900">No Pending Confirmations</h3>
          <p className="mt-1 text-sm text-slate-500">
            All vendors who completed trials have been reviewed, or no vendor is currently awaiting confirmation.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {items.map((trial) => {
            const s = trial.vendorSummary || {}
            const vendorId = trial.vendorId?._id || trial.vendorId
            const isReviewRequired = trial.status === 'ADMIN_REVIEW_REQUIRED'

            return (
              <div
                key={trial._id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
              >
                {/* Top Banner */}
                <div className="flex flex-wrap items-center justify-between border-b border-slate-100 bg-slate-50/80 px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-amber-500/10 font-bold text-amber-600">
                      {s.vendorName ? s.vendorName[0].toUpperCase() : 'V'}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-slate-900">{s.vendorName}</h3>
                        <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                          KYC {s.verificationStatus?.toUpperCase()}
                        </span>
                        {isReviewRequired && (
                          <span className="rounded-md bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-700 border border-purple-200">
                            REVIEW REQUIRED
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500">Vendor ID: {s.vendorId} • Phone: {s.phone || 'N/A'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link
                      to={`/admin/vendor-trials/${vendorId}`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                    >
                      Full Details & History <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>

                {/* Main Metrics Grid */}
                <div className="grid grid-cols-2 gap-4 p-6 sm:grid-cols-3 lg:grid-cols-6 bg-white">
                  <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
                    <p className="text-xs font-medium text-slate-500">Trial Progress</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">
                      {s.servicesCompleted} / {s.trialCount}
                    </p>
                    <p className="text-[11px] text-slate-400">Passed: {s.passedTrials} • Failed: {s.failedTrials}</p>
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
                    <p className="text-xs font-medium text-slate-500">Average Rating</p>
                    <div className="mt-1 flex items-center gap-1">
                      <span className="text-lg font-bold text-slate-900">{s.averageRating || 'N/A'}</span>
                      {s.averageRating && <Star className="h-4 w-4 fill-amber-400 text-amber-400" />}
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Min: {s.lowestRating || '—'}⭐ • Max: {s.highestRating || '—'}⭐
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
                    <p className="text-xs font-medium text-slate-500">Warnings</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">{s.warningsReceived}</p>
                    <p className="text-[11px] text-slate-400">Low-rating alerts</p>
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
                    <p className="text-xs font-medium text-slate-500">Final Chance</p>
                    <p className="mt-1 text-sm font-bold text-slate-900">
                      {s.finalChanceUsed ? (
                        <span className="text-amber-600">Used (Paid: {s.penaltyPaid ? 'Yes' : 'No'})</span>
                      ) : (
                        <span className="text-slate-600">Not Used</span>
                      )}
                    </p>
                    <p className="text-[11px] text-slate-400">Penalty Status</p>
                  </div>

                  <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3.5">
                    <p className="text-xs font-medium text-slate-500">Trial Duration</p>
                    <p className="mt-1 text-lg font-bold text-slate-900">{s.trialDurationDays || 1} Days</p>
                    <p className="text-[11px] text-slate-400">Total completion time</p>
                  </div>

                  <div className="rounded-xl border border-emerald-100 bg-emerald-50/40 p-3.5">
                    <p className="text-xs font-medium text-emerald-700">Status Eligibility</p>
                    <p className="mt-1 text-xs font-bold text-emerald-900">
                      ELIGIBLE FOR CONFIRMATION
                    </p>
                    <p className="text-[11px] text-emerald-600">Awaiting Admin Action</p>
                  </div>
                </div>

                {/* Recent Reviews snippet */}
                {s.recentReviews && s.recentReviews.length > 0 && (
                  <div className="border-t border-slate-100 bg-slate-50/30 px-6 py-3">
                    <p className="text-xs font-semibold text-slate-600">Recent Customer Ratings:</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {s.recentReviews.map((rev, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs"
                        >
                          <span className="font-semibold text-slate-700">Trial #{rev.trialNumber}:</span>
                          <span className="flex items-center font-bold text-amber-500">
                            {rev.rating} <Star className="h-3 w-3 fill-amber-400 text-amber-400 ml-0.5" />
                          </span>
                          <span
                            className={`rounded px-1 text-[10px] font-bold ${
                              rev.result === 'PASSED'
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}
                          >
                            {rev.result}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Admin Action Buttons — Explicit options per Requirement 48 */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 bg-white px-6 py-4">
                  <div className="text-xs text-slate-500">
                    {trial.reviewReason && (
                      <span className="text-purple-700 font-medium">Review Note: {trial.reviewReason}</span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    <button
                      type="button"
                      onClick={() => openActionModal('GRANT_ADDITIONAL_TRIAL', trial)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
                    >
                      <PlusCircle className="h-3.5 w-3.5 text-slate-500" />
                      Grant Additional Trial
                    </button>

                    <button
                      type="button"
                      onClick={() => openActionModal('REQUEST_REVIEW', trial)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-purple-200 bg-purple-50 px-3 py-2 text-xs font-semibold text-purple-700 shadow-sm transition hover:bg-purple-100"
                    >
                      <HelpCircle className="h-3.5 w-3.5 text-purple-600" />
                      Request Review
                    </button>

                    <button
                      type="button"
                      onClick={() => openActionModal('BLOCK', trial)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 shadow-sm transition hover:bg-rose-100"
                    >
                      <Ban className="h-3.5 w-3.5 text-rose-600" />
                      Block
                    </button>

                    <button
                      type="button"
                      onClick={() => openActionModal('REJECT', trial)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-rose-600 shadow-sm transition hover:bg-rose-50"
                    >
                      <UserX className="h-3.5 w-3.5 text-rose-500" />
                      Reject
                    </button>

                    <button
                      type="button"
                      onClick={() => openActionModal('CONFIRM', trial)}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-emerald-700"
                    >
                      <UserCheck className="h-4 w-4" />
                      CONFIRM VENDOR
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ==================== ACTION MODALS ==================== */}

      {/* Modal 1: CONFIRM VENDOR (Requirement 49) */}
      {activeModal === 'CONFIRM' && selectedVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 text-emerald-600">
              <UserCheck className="h-6 w-6" />
              <h3 className="text-lg font-bold text-slate-900">Confirm Vendor Joining</h3>
            </div>
            <p className="mt-3 text-sm text-slate-600">
              Are you sure you want to confirm{' '}
              <strong>{selectedVendor.vendorSummary?.vendorName || 'this vendor'}</strong>?
            </p>
            <p className="mt-1 text-xs text-slate-500">
              The vendor will become a fully active production service provider and will no longer be treated as a trial vendor.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-700">Confirmation Notes (Optional)</label>
              <textarea
                rows="3"
                value={modalInput.notes}
                onChange={(e) => setModalInput({ ...modalInput, notes: e.target.value })}
                placeholder="e.g., Vendor consistently maintained good service quality during trial."
                className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              ></textarea>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeActionModal}
                disabled={actionLoading}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmVendor}
                disabled={actionLoading}
                className="rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow hover:bg-emerald-700 disabled:opacity-50"
              >
                {actionLoading ? 'Confirming...' : 'Yes, Confirm Vendor'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: REJECT VENDOR (Requirement 50) */}
      {activeModal === 'REJECT' && selectedVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 text-rose-600">
              <UserX className="h-6 w-6" />
              <h3 className="text-lg font-bold text-slate-900">Reject Vendor</h3>
            </div>
            <p className="mt-3 text-sm text-slate-600">
              Admin rejection override for{' '}
              <strong>{selectedVendor.vendorSummary?.vendorName || 'this vendor'}</strong>.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-700">
                Rejection Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows="3"
                required
                value={modalInput.reason}
                onChange={(e) => setModalInput({ ...modalInput, reason: e.target.value })}
                placeholder="e.g., Service quality acceptable but vendor does not meet operational requirements."
                className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
              ></textarea>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeActionModal}
                disabled={actionLoading}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRejectVendor}
                disabled={actionLoading}
                className="rounded-xl bg-rose-600 px-5 py-2 text-sm font-bold text-white shadow hover:bg-rose-700 disabled:opacity-50"
              >
                {actionLoading ? 'Rejecting...' : 'Reject Vendor'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: BLOCK VENDOR (Requirement 51) */}
      {activeModal === 'BLOCK' && selectedVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 text-rose-600">
              <Ban className="h-6 w-6" />
              <h3 className="text-lg font-bold text-slate-900">Block Vendor Account</h3>
            </div>
            <p className="mt-3 text-sm text-slate-600">
              Manually block{' '}
              <strong>{selectedVendor.vendorSummary?.vendorName || 'this vendor'}</strong>.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-700">
                Block Reason <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows="3"
                required
                value={modalInput.reason}
                onChange={(e) => setModalInput({ ...modalInput, reason: e.target.value })}
                placeholder="e.g., Document verification issue discovered after trial."
                className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
              ></textarea>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeActionModal}
                disabled={actionLoading}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBlockVendor}
                disabled={actionLoading}
                className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-bold text-white shadow hover:bg-black disabled:opacity-50"
              >
                {actionLoading ? 'Blocking...' : 'Confirm Block'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: REQUEST ADDITIONAL REVIEW (Requirement 52) */}
      {activeModal === 'REQUEST_REVIEW' && selectedVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 text-purple-600">
              <HelpCircle className="h-6 w-6" />
              <h3 className="text-lg font-bold text-slate-900">Request Additional Review</h3>
            </div>
            <p className="mt-3 text-sm text-slate-600">
              Mark <strong>{selectedVendor.vendorSummary?.vendorName || 'this vendor'}</strong> as requiring admin review.
            </p>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-700">
                Review Reason / Notes <span className="text-rose-500">*</span>
              </label>
              <textarea
                rows="3"
                required
                value={modalInput.reason}
                onChange={(e) => setModalInput({ ...modalInput, reason: e.target.value })}
                placeholder="e.g., Need to review customer complaints before final confirmation."
                className="mt-1 w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-purple-500 focus:outline-none focus:ring-1 focus:ring-purple-500"
              ></textarea>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeActionModal}
                disabled={actionLoading}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleRequestReview}
                disabled={actionLoading}
                className="rounded-xl bg-purple-600 px-5 py-2 text-sm font-bold text-white shadow hover:bg-purple-700 disabled:opacity-50"
              >
                {actionLoading ? 'Saving...' : 'Set Review Required'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 5: GRANT ADDITIONAL TRIAL (Requirement 53) */}
      {activeModal === 'GRANT_ADDITIONAL_TRIAL' && selectedVendor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center gap-3 text-indigo-600">
              <PlusCircle className="h-6 w-6" />
              <h3 className="text-lg font-bold text-slate-900">Grant Additional Trial Services</h3>
            </div>
            <p className="mt-3 text-sm text-slate-600">
              Give <strong>{selectedVendor.vendorSummary?.vendorName || 'this vendor'}</strong> additional trial opportunities.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Additional Trial Count</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={modalInput.additionalCount}
                  onChange={(e) => setModalInput({ ...modalInput, additionalCount: e.target.value })}
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Reason for Extension</label>
                <textarea
                  rows="2"
                  value={modalInput.reason}
                  onChange={(e) => setModalInput({ ...modalInput, reason: e.target.value })}
                  placeholder="e.g., Need additional verification of service quality."
                  className="mt-1 w-full rounded-xl border border-slate-200 p-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                ></textarea>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={closeActionModal}
                disabled={actionLoading}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleGrantAdditionalTrial}
                disabled={actionLoading}
                className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-bold text-white shadow hover:bg-indigo-700 disabled:opacity-50"
              >
                {actionLoading ? 'Granting...' : 'Grant Trial'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
