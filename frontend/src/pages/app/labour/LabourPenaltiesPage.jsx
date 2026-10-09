import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldAlert,
  Clock,
  Ban,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  IndianRupee,
  ChevronLeft,
  Loader2,
  HelpCircle,
  FileText,
  Upload,
  X,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { penaltyApi } from '../../../api/penaltyApi.js'
import { ApiError } from '../../../api/http.js'
import { GlassPanel } from '../../../components/ui/GlassPanel.jsx'

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

export function LabourPenaltiesPage() {
  const navigate = useNavigate()
  const [penalties, setPenalties] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState({ message: '', variant: 'success' })

  // Dispute Modal State
  const [disputeItem, setDisputeItem] = useState(null)
  const [disputeReason, setDisputeReason] = useState('')
  const [disputeProofUrl, setDisputeProofUrl] = useState('')
  const [submittingDispute, setSubmittingDispute] = useState(false)

  const showToast = (message, variant = 'success') => {
    setToast({ message, variant })
    setTimeout(() => setToast({ message: '', variant: 'success' }), 4000)
  }

  const loadPenalties = useCallback(async () => {
    setLoading(true)
    try {
      const res = await penaltyApi.getVendorPenalties()
      setPenalties(res.data?.penalties || [])
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to load penalties', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPenalties()
  }, [loadPenalties])

  const handleDisputeSubmit = async (e) => {
    e.preventDefault()
    if (!disputeItem || !disputeReason.trim()) return

    setSubmittingDispute(true)
    try {
      await penaltyApi.submitDispute(disputeItem._id, {
        reason: disputeReason.trim(),
        evidenceUrls: disputeProofUrl.trim() ? [disputeProofUrl.trim()] : [],
      })
      showToast('Dispute submitted successfully! Admin will review your explanation.')
      setDisputeItem(null)
      setDisputeReason('')
      setDisputeProofUrl('')
      loadPenalties()
    } catch (err) {
      showToast(err.message || 'Failed to submit dispute', 'error')
    } finally {
      setSubmittingDispute(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-4 py-3.5">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/app/wallet')}
            className="p-1.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-base font-black text-slate-900">My Penalties & Late Fees</h1>
            <p className="text-[11px] font-bold text-slate-400">Review deductions, waivers and submit disputes</p>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      <AnimatePresence>
        {toast.message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`fixed left-4 right-4 top-16 z-[400] mx-auto flex max-w-md items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold shadow-xl ${
              toast.variant === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-800'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800'
            }`}
          >
            {toast.variant === 'error' ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mx-auto max-w-lg px-4 pt-4 space-y-4">
        {/* Info Card */}
        <div className="rounded-2xl bg-blue-50 border border-blue-200/80 p-4 text-xs text-blue-950 space-y-1">
          <p className="font-black flex items-center gap-1.5 text-blue-900">
            <ShieldAlert className="h-4 w-4 text-blue-700" />
            Fair Penalty & Dispute Policy
          </p>
          <p className="font-medium text-blue-800 leading-relaxed">
            Arrive within the allowed grace period to avoid late arrival fees. If an unforeseen emergency or roadblock occurred, you can submit a dispute with proof for full waiver and refund.
          </p>
        </div>

        {/* List */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-brand" />
          </div>
        ) : penalties.length === 0 ? (
          <GlassPanel className="p-10 text-center border-dashed">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500 mb-2" />
            <h3 className="text-sm font-bold text-slate-800">Clean Record!</h3>
            <p className="text-xs text-slate-500 mt-1">You have no penalty incidents on your account.</p>
          </GlassPanel>
        ) : (
          <div className="space-y-3">
            {penalties.map((item) => {
              const shortCode = String(item.bookingId?._id || item.bookingId).slice(-6).toUpperCase()
              const isLate = item.penaltyType === 'LATE_FEE'
              const canDispute = !item.dispute?.isDisputed && (item.status === 'APPLIED' || item.status === 'PENDING_REVIEW')

              return (
                <GlassPanel key={item._id} className="p-4 space-y-3 border-slate-200/80 shadow-xs">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className={`flex h-9 w-9 items-center justify-center rounded-2xl ${isLate ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>
                        {isLate ? <Clock className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
                      </span>
                      <div>
                        <p className="text-sm font-black text-slate-900">
                          {isLate ? 'Late Arrival Fee' : 'Job Bounce Penalty'}
                        </p>
                        <p className="text-[11px] font-bold text-slate-400">Booking #{shortCode}</p>
                      </div>
                    </div>
                    <span className="text-sm font-black text-rose-700">{formatInr(item.amount)}</span>
                  </div>

                  <p className="text-xs font-semibold text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    {item.reason}
                  </p>

                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <span className="text-slate-400 font-medium">{formatDate(item.incidentTime || item.createdAt)}</span>
                    <span className={`px-2 py-0.5 rounded-full font-extrabold ${
                      item.status === 'WAIVED' || item.status === 'REVERSED'
                        ? 'bg-emerald-100 text-emerald-800'
                        : item.status === 'DISPUTED'
                        ? 'bg-purple-100 text-purple-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}>
                      {item.status === 'WAIVED' ? 'Waived / Refunded' : item.status === 'REVERSED' ? 'Refunded' : item.status}
                    </span>
                  </div>

                  {/* Dispute Status Info */}
                  {item.dispute?.isDisputed && (
                    <div className="rounded-xl bg-purple-50 p-2.5 border border-purple-200 text-xs text-purple-900">
                      <p className="font-bold">Dispute Status: {item.dispute.status}</p>
                      <p className="text-[11px] text-purple-700 mt-0.5">"{item.dispute.reason}"</p>
                      {item.dispute.adminNotes && (
                        <p className="text-[11px] font-bold text-purple-900 mt-1">Admin Note: {item.dispute.adminNotes}</p>
                      )}
                    </div>
                  )}

                  {/* Dispute Button */}
                  {canDispute && (
                    <button
                      type="button"
                      onClick={() => {
                        setDisputeItem(item)
                        setDisputeReason('')
                        setDisputeProofUrl('')
                      }}
                      className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-purple-300 bg-purple-50/50 py-2.5 text-xs font-black text-purple-700 hover:bg-purple-100 transition"
                    >
                      <HelpCircle className="h-3.5 w-3.5" />
                      Submit Dispute / Request Waiver
                    </button>
                  )}
                </GlassPanel>
              )
            })}
          </div>
        )}
      </div>

      {/* DISPUTE SUBMISSION MODAL */}
      <AnimatePresence>
        {disputeItem && (
          <div className="fixed inset-0 z-[320] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-purple-600" />
                  <h3 className="text-base font-black text-slate-900">Submit Penalty Dispute</h3>
                </div>
                <button type="button" onClick={() => setDisputeItem(null)} className="p-1 text-slate-400 hover:text-slate-600">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleDisputeSubmit} className="space-y-3 text-xs">
                <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200">
                  <p className="font-bold text-slate-900">Disputing: {formatInr(disputeItem.amount)}</p>
                  <p className="text-slate-500 mt-0.5">{disputeItem.reason}</p>
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1 block">
                    Reason for Delay / Cancellation *
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Provide clear explanation (e.g. Traffic jam at square with photo, customer unreachable, etc.)"
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-3 text-xs font-semibold text-slate-800 outline-none focus:border-brand"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-1 block">
                    Evidence Image URL / Proof Link (Optional)
                  </label>
                  <input
                    type="url"
                    placeholder="https://..."
                    value={disputeProofUrl}
                    onChange={(e) => setDisputeProofUrl(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-3 text-xs font-semibold text-slate-800 outline-none focus:border-brand"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setDisputeItem(null)}
                    className="rounded-xl border border-slate-200 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingDispute}
                    className="rounded-xl bg-purple-600 py-2.5 text-xs font-extrabold text-white hover:bg-purple-700 shadow-md shadow-purple-600/20 disabled:opacity-50"
                  >
                    {submittingDispute ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Submit Dispute'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
export default LabourPenaltiesPage
