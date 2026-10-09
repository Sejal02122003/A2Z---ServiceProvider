import { useEffect, useState, useMemo } from 'react'
import {
  AlertTriangle,
  ShieldAlert,
  X,
  Loader2,
  CheckCircle2,
  Clock,
  Ban,
  Info,
} from 'lucide-react'
import { bookingCancellationApi } from '../../api/bookingCancellationApi.js'
import { bookingsApi } from '../../api/bookingsApi.js'

const REASONS = [
  { id: 'transport', label: 'Vehicle Breakdown / Transport Issue', isExempt: false },
  { id: 'emergency', label: 'Medical / Personal Emergency', isExempt: false },
  { id: 'schedule', label: 'Schedule Conflict / Cannot Attend', isExempt: false },
  {
    id: 'fake_customer',
    label: 'Customer Unreachable / Fake Address (Report Bogus)',
    isExempt: true,
  },
  { id: 'customer_asked', label: 'Customer Requested to Cancel', isExempt: true },
  { id: 'other', label: 'Other Reason', isExempt: false },
]

export function LabourBounceCancelModal({ open, onClose, booking, onCancelled }) {
  const [selectedReasonId, setSelectedReasonId] = useState('transport')
  const [customReason, setCustomReason] = useState('')
  const [eligibility, setEligibility] = useState(null)
  const [loadingEligibility, setLoadingEligibility] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!open || !booking?._id) return
    let cancelled = false
    setLoadingEligibility(true)
    setErrorMsg('')

    bookingCancellationApi
      .getVendorEligibility(booking._id)
      .then((res) => {
        if (!cancelled && res.data) {
          setEligibility(res.data)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Error fetching cancellation eligibility:', err)
          // Fallback eligibility object
          setEligibility({
            isEligible: true,
            timingClassification: 'STANDARD',
            penaltyAmount: 0,
            isLate: false,
            cutoffHours: 2,
          })
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingEligibility(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, booking])

  const selectedReasonObj = useMemo(() => {
    return REASONS.find((r) => r.id === selectedReasonId) || REASONS[0]
  }, [selectedReasonId])

  const isExempt = selectedReasonObj.isExempt

  if (!open || !booking) return null

  const shortCode = String(booking._id).slice(-6).toUpperCase()

  const handleConfirmCancellation = async () => {
    setSubmitting(true)
    setErrorMsg('')
    try {
      const finalReason =
        selectedReasonId === 'other' && customReason.trim()
          ? `Other: ${customReason.trim()}`
          : selectedReasonObj.label

      const res = await bookingCancellationApi.submitVendorCancellation(booking._id, {
        reason: finalReason,
        reasonCategory: selectedReasonObj.id,
        isExempt,
      })

      const data = res?.data || {}
      if (onCancelled) {
        onCancelled({
          status: data.status,
          penaltyDeducted: data.penaltyDeducted || 0,
          requiresApproval: data.requiresApproval || false,
          reason: finalReason,
        })
      }
      onClose()
    } catch (err) {
      // If endpoint returns error, also attempt legacy fallback
      try {
        const finalReason =
          selectedReasonId === 'other' && customReason.trim()
            ? `Other: ${customReason.trim()}`
            : selectedReasonObj.label

        const legacyRes = await bookingsApi.updateBookingStatus(booking._id, {
          status: 'CANCELLED',
          reason: finalReason,
          waivePenalty: isExempt,
        })
        if (onCancelled) {
          onCancelled({
            penaltyDeducted: legacyRes?.data?.penaltyDeducted || 0,
            reason: finalReason,
          })
        }
        onClose()
      } catch (fallbackErr) {
        setErrorMsg(err.message || fallbackErr.message || 'Failed to cancel booking')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const isBlocked = eligibility?.isBlocked
  const requiresApproval = eligibility?.requiresApproval
  const isLate = eligibility?.isLate
  const penaltyAmount = isExempt ? 0 : eligibility?.penaltyAmount || 0
  const timeRemainingMinutes = eligibility?.timeRemainingMinutes || 0
  const cutoffHours = eligibility?.cutoffHours || 2

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
                Cancel Booking Assignment
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

        {/* Live Timing & Policy Assessment Banner */}
        {loadingEligibility ? (
          <div className="mt-4 flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-brand" />
            <span className="ml-2 text-xs font-bold text-slate-500">
              Checking cancellation cutoff policy...
            </span>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {/* Time remaining pill */}
            {timeRemainingMinutes > 0 && (
              <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-600 border border-slate-200">
                <span className="flex items-center gap-1.5 text-slate-500">
                  <Clock className="h-4 w-4 text-brand" />
                  Time to Service Start:
                </span>
                <span className="font-extrabold text-slate-900">
                  {Math.floor(timeRemainingMinutes / 60)}h {timeRemainingMinutes % 60}m
                </span>
              </div>
            )}

            {/* Classification Alert */}
            {isBlocked ? (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                <div className="flex items-start gap-2.5">
                  <Ban className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
                  <div className="text-xs text-rose-950 space-y-1">
                    <p className="font-extrabold text-sm text-rose-900">
                      Cancellation Blocked
                    </p>
                    <p className="font-medium text-rose-800 leading-relaxed">
                      Platform policy blocks cancellations less than {cutoffHours} hours before
                      the scheduled start time. Please contact admin support if you have an
                      unavoidable emergency.
                    </p>
                  </div>
                </div>
              </div>
            ) : requiresApproval ? (
              <div className="rounded-2xl border border-purple-200 bg-purple-50 p-4">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-purple-600 mt-0.5" />
                  <div className="text-xs text-purple-950 space-y-1">
                    <p className="font-extrabold text-sm text-purple-900">
                      Admin Approval Required
                    </p>
                    <p className="font-medium text-purple-800 leading-relaxed">
                      This job is within the {cutoffHours}-hour cutoff window. Submitting will
                      send a cancellation request to the administrator. If approved, a penalty
                      of <strong>₹{penaltyAmount}</strong> will be applied.
                    </p>
                  </div>
                </div>
              </div>
            ) : isLate && !isExempt ? (
              <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 p-4">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" />
                  <div className="text-xs text-amber-950 space-y-1">
                    <p className="font-extrabold text-sm text-amber-900">
                      Late Cancellation Penalty: ₹{penaltyAmount}
                    </p>
                    <p className="font-medium text-amber-800 leading-relaxed">
                      Cancelling within {cutoffHours} hours causes customer delay. A late fee
                      of <strong>₹{penaltyAmount}</strong> will be deducted from your earnings
                      wallet.
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
                      Standard Cancellation (₹0 Fee)
                    </p>
                    <p className="font-medium text-emerald-800 leading-relaxed">
                      {isExempt
                        ? 'Reporting fake/unreachable customers or customer-requested cancellations incurs ₹0 penalty.'
                        : `You are cancelling at least ${cutoffHours} hours in advance. No late penalty will be applied.`}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reason Selector */}
        {!isBlocked && (
          <div className="mt-4 space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500 block">
              Select Cancellation Reason *
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
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-800 outline-hidden focus:ring-2 focus:ring-brand/20"
                />
              </div>
            )}
          </div>
        )}

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

          {isBlocked ? (
            <button
              type="button"
              disabled
              className="flex items-center justify-center rounded-xl bg-slate-300 py-3 text-xs font-bold text-slate-500 cursor-not-allowed"
            >
              Cancellation Blocked
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConfirmCancellation}
              disabled={submitting || loadingEligibility}
              className={`flex items-center justify-center gap-1.5 rounded-xl py-3 text-xs font-bold text-white shadow-md transition active:scale-95 disabled:opacity-50 ${
                requiresApproval
                  ? 'bg-purple-600 hover:bg-purple-700 shadow-purple-600/20'
                  : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
              }`}
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : requiresApproval ? (
                'Request Admin Approval'
              ) : isLate && !isExempt && penaltyAmount > 0 ? (
                `Confirm Cancel (-₹${penaltyAmount})`
              ) : (
                'Confirm Free Cancellation'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
