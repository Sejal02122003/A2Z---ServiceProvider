import { useEffect, useState, useMemo } from 'react'
import { AlertTriangle, ShieldAlert, X, Loader2, CheckCircle2, Info } from 'lucide-react'
import { bookingsApi } from '../../api/bookingsApi.js'
import { getPublicSettings } from '../../api/adminSettingsApi.js'

const REASONS = [
  { id: 'transport', label: 'Vehicle Breakdown / Transport Issue', isExempt: false },
  { id: 'emergency', label: 'Medical / Personal Emergency', isExempt: false },
  { id: 'schedule', label: 'Schedule Conflict / Cannot Attend', isExempt: false },
  { id: 'fake_customer', label: 'Customer Unreachable / Fake Address (Report Bogus)', isExempt: true },
  { id: 'customer_asked', label: 'Customer Requested to Cancel', isExempt: true },
  { id: 'other', label: 'Other Reason', isExempt: false },
]

export function LabourBounceCancelModal({ open, onClose, booking, onCancelled }) {
  const [selectedReasonId, setSelectedReasonId] = useState('transport')
  const [customReason, setCustomReason] = useState('')
  const [penaltyAmount, setPenaltyAmount] = useState(50)
  const [loadingSettings, setLoadingSettings] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoadingSettings(true)
    getPublicSettings()
      .then((res) => {
        if (!cancelled && res.data?.cancellationPenalty != null) {
          setPenaltyAmount(Number(res.data.cancellationPenalty))
        }
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoadingSettings(false)
      })
    return () => { cancelled = true }
  }, [open])

  const selectedReasonObj = useMemo(() => {
    return REASONS.find(r => r.id === selectedReasonId) || REASONS[0]
  }, [selectedReasonId])

  const isExempt = selectedReasonObj.isExempt

  if (!open || !booking) return null

  const handleConfirmCancellation = async () => {
    setSubmitting(true)
    setErrorMsg('')
    try {
      const finalReason = selectedReasonId === 'other' && customReason.trim()
        ? `Other: ${customReason.trim()}`
        : selectedReasonObj.label

      const res = await bookingsApi.updateBookingStatus(booking._id, {
        status: 'CANCELLED',
        reason: finalReason,
        waivePenalty: isExempt
      })

      const penaltyDeducted = res?.data?.penaltyDeducted || 0
      if (onCancelled) {
        onCancelled({ penaltyDeducted, reason: finalReason })
      }
      onClose()
    } catch (err) {
      setErrorMsg(err.message || 'Failed to cancel booking')
    } finally {
      setSubmitting(false)
    }
  }

  const shortCode = String(booking._id).slice(-6).toUpperCase()

  return (
    <div className="fixed inset-0 z-[350] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl border border-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-1 ring-rose-200">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 leading-tight">
                Cancel Accepted Job
              </h3>
              <p className="text-xs font-semibold text-slate-500">
                Booking Reference #{shortCode}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Penalty Alert Box */}
        <div className="mt-4">
          {!isExempt ? (
            <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4">
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                <div className="text-xs text-amber-950 space-y-1">
                  <p className="font-extrabold text-sm text-amber-900">
                    Bounce Penalty: ₹{penaltyAmount}
                  </p>
                  <p className="font-medium text-amber-800 leading-relaxed">
                    Cancelling an accepted job causes customer delay. A fixed penalty of <strong>₹{penaltyAmount}</strong> will be deducted from your wallet balance.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/80 p-4">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 mt-0.5" />
                <div className="text-xs text-emerald-950 space-y-1">
                  <p className="font-extrabold text-sm text-emerald-900">
                    Penalty Waived (Exempt)
                  </p>
                  <p className="font-medium text-emerald-800 leading-relaxed">
                    Reporting fake/unreachable customer requests or customer-requested cancellations will not incur any bounce penalty.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Reason Selector */}
        <div className="mt-4 space-y-2">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
            Select Cancellation Reason
          </label>
          <div className="space-y-1.5">
            {REASONS.map((r) => {
              const isSelected = selectedReasonId === r.id
              return (
                <label
                  key={r.id}
                  className={`flex items-center justify-between rounded-xl border p-3 cursor-pointer transition text-xs font-semibold ${
                    isSelected
                      ? 'border-brand bg-brand/5 text-brand ring-1 ring-brand'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <input
                      type="radio"
                      name="cancel_reason"
                      value={r.id}
                      checked={isSelected}
                      onChange={() => setSelectedReasonId(r.id)}
                      className="text-brand focus:ring-brand"
                    />
                    <span>{r.label}</span>
                  </div>
                  {r.isExempt && (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-100/70 px-1.5 py-0.5 rounded">
                      No penalty
                    </span>
                  )}
                </label>
              )
            })}
          </div>

          {selectedReasonId === 'other' && (
            <div className="mt-2">
              <textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Please describe why you cannot complete this job..."
                rows={2}
                className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 outline-none focus:ring-2 focus:ring-brand/20"
              />
            </div>
          )}
        </div>

        {errorMsg && (
          <p className="mt-3 rounded-xl bg-rose-50 p-2.5 text-xs font-bold text-rose-700 border border-rose-200">
            {errorMsg}
          </p>
        )}

        {/* Action Buttons */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl border border-slate-200 py-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 active:scale-95 disabled:opacity-50"
          >
            Keep Assignment
          </button>
          <button
            type="button"
            onClick={handleConfirmCancellation}
            disabled={submitting}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-rose-600 py-3 text-xs font-bold text-white shadow-md shadow-rose-600/20 transition hover:bg-rose-700 active:scale-95 disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              `Confirm Cancel ${!isExempt ? `(-₹${penaltyAmount})` : ''}`
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
