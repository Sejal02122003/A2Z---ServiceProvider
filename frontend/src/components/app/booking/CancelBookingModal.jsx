import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertCircle, CheckCircle2, ChevronRight, HelpCircle, Loader2, ShieldAlert, X } from 'lucide-react'
import { bookingsApi } from '../../../api/bookingsApi.js'
import { ApiError } from '../../../api/http.js'

const STANDARD_REASONS = [
  'Booked by mistake',
  'Wrong date or time',
  'Service no longer required',
  'Vendor response delay',
  'Found another service provider',
  'Other',
]

/**
 * CancelBookingModal
 * Props:
 *   open        - boolean, controls visibility
 *   booking     - booking object
 *   onClose     - fn(), called to dismiss modal
 *   onSuccess   - fn(updatedBooking, cancellationData), called when cancellation succeeds
 */
export function CancelBookingModal({ open, booking, onClose, onSuccess }) {
  const navigate = useNavigate()
  const [loadingEligibility, setLoadingEligibility] = useState(true)
  const [eligibility, setEligibility] = useState(null)
  const [selectedReason, setSelectedReason] = useState('')
  const [reasonNote, setReasonNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [successResult, setSuccessResult] = useState(null)

  const [showPolicyConfirmDialog, setShowPolicyConfirmDialog] = useState(false)

  // Reset and fetch eligibility whenever opened
  useEffect(() => {
    if (!open || !booking?._id) {
      setSelectedReason('')
      setReasonNote('')
      setError('')
      setSubmitting(false)
      setSuccessResult(null)
      setShowPolicyConfirmDialog(false)
      return
    }

    let isCancelled = false
    setLoadingEligibility(true)
    setError('')
    setSelectedReason('')
    setReasonNote('')
    setSuccessResult(null)
    setShowPolicyConfirmDialog(false)

    bookingsApi
      .getCancellationEligibility(booking._id)
      .then((res) => {
        if (isCancelled) return
        setEligibility(res.data)
      })
      .catch((err) => {
        if (isCancelled) return
        const msg = err instanceof ApiError ? err.message : 'Unable to check cancellation eligibility'
        setError(msg)
      })
      .finally(() => {
        if (!isCancelled) setLoadingEligibility(false)
      })

    return () => {
      isCancelled = true
    }
  }, [open, booking?._id])

  if (!open || !booking) return null

  const shortCode = String(booking._id).slice(-6).toUpperCase()
  const isOnlinePaid = booking.paymentMethod === 'ONLINE' && (booking.paymentStatus || '').toUpperCase() === 'PAID'
  const cancellationFee = eligibility?.cancellationFee || 0
  const estimatedRefund = Math.max(0, (booking.totalAmount || 0) - cancellationFee)
  const customerPolicy = eligibility?.customerPolicy

  const executeCancellation = async () => {
    setError('')
    setSubmitting(true)

    try {
      const res = await bookingsApi.cancelBooking(booking._id, {
        reason: selectedReason,
        reasonNote: selectedReason === 'Other' ? reasonNote.trim() : undefined,
      })

      const cancellationData = res.data || {}
      const updatedBooking = cancellationData.booking || {
        ...booking,
        status: 'CANCELLED',
        cancelledBy: 'CUSTOMER',
        cancellationReason: selectedReason === 'Other' ? `Other: ${reasonNote.trim()}` : selectedReason,
        cancelledAt: new Date().toISOString(),
      }

      setSuccessResult(cancellationData)
      setShowPolicyConfirmDialog(false)

      if (onSuccess) {
        onSuccess(updatedBooking, cancellationData)
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to cancel booking. Please try again.'
      setError(msg)
      setSubmitting(false)
    }
  }

  const handleConfirmCancellation = async () => {
    if (!selectedReason) {
      setError('Please select a reason for cancellation.')
      return
    }

    if (selectedReason === 'Other' && !reasonNote.trim()) {
      setError('Please enter a description when selecting "Other".')
      return
    }

    // Check if customer is approaching or at warning threshold
    if (customerPolicy?.policyEnabled && (customerPolicy?.approachingThreshold || customerPolicy?.warningActive) && !showPolicyConfirmDialog) {
      setShowPolicyConfirmDialog(true)
      return
    }

    await executeCancellation()
  }

  const modalContent = (
    <AnimatePresence>
      <div key="cancel-booking-wrapper" className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          key="cancel-booking-modal"
          initial={{ opacity: 0, y: 40, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.98 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 bg-white sticky top-0 z-10">
            <div>
              <h2 className="text-lg font-black tracking-tight text-slate-900 leading-tight">
                Cancel Booking
              </h2>
              <p className="text-xs font-semibold text-slate-400 mt-0.5">
                Booking #{shortCode} • {booking.serviceId?.name || booking.subcategoryId?.name || 'Service'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-5 overflow-y-auto space-y-4 flex-1">
            {successResult ? (
              // Success Screen
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-6 flex flex-col items-center text-center space-y-3"
              >
                <div className="h-16 w-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
                  <CheckCircle2 className="h-9 w-9" />
                </div>
                <h3 className="text-xl font-black text-slate-900">
                  Booking Cancelled
                </h3>
                <p className="text-sm font-medium text-slate-600 max-w-xs">
                  Your booking #{shortCode} has been cancelled successfully.
                </p>

                {/* Repeat Policy Warning Notice */}
                {successResult.customerPolicy?.warningTriggered && (
                  <div className="w-full mt-3 rounded-2xl bg-amber-50 border border-amber-200 p-4 text-left">
                    <div className="flex items-start gap-2.5">
                      <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                          Cancellation Policy Warning
                        </p>
                        <p className="text-xs text-amber-800 font-medium mt-1 leading-relaxed">
                          {successResult.customerPolicy.warningMessage ||
                            'You have cancelled several bookings recently. Repeated cancellations may lead to temporary restrictions on your A2Z account.'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Account Restriction Notice */}
                {successResult.customerPolicy?.restrictionTriggered && (
                  <div className="w-full mt-3 rounded-2xl bg-rose-50 border border-rose-200 p-4 text-left">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-rose-900 uppercase tracking-wider">
                          Booking Access Restricted
                        </p>
                        <p className="text-xs text-rose-800 font-medium mt-1 leading-relaxed">
                          {successResult.customerPolicy.restrictionMessage ||
                            'Your booking access has been temporarily restricted due to repeated cancellations under our cancellation policy.'}
                        </p>
                        <p className="text-[11px] text-rose-600 font-semibold mt-2">
                          Existing confirmed bookings remain active. You can contact customer support if you need assistance.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Refund & Ledger Status */}
                {booking.paymentMethod === 'ONLINE' && isOnlinePaid && (
                  <div className="w-full mt-3 rounded-2xl bg-blue-50/70 border border-blue-100 p-4 text-left">
                    <p className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-1">
                      Refund Information
                    </p>
                    <p className="text-sm font-semibold text-blue-800">
                      Refund Status: <span className="uppercase font-bold">{successResult.refund?.status || 'PENDING REVIEW'}</span>
                    </p>
                    <p className="text-xs text-blue-600 mt-0.5">
                      Estimated Amount: ₹{successResult.refund?.amount ?? estimatedRefund}
                    </p>
                    <p className="text-[11px] text-blue-500 mt-1 leading-snug">
                      Your refund request has been logged and will be processed according to the platform refund policy.
                    </p>
                  </div>
                )}

                {booking.paymentMethod === 'CASH' && (
                  <div className="w-full mt-3 rounded-2xl bg-slate-50 border border-slate-200 p-3.5 text-left text-xs text-slate-600 font-medium">
                    Cash on delivery booking. No payment was collected.
                  </div>
                )}

                <div className="w-full pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      if (onClose) onClose()
                      navigate('/app', { replace: true })
                    }}
                    className="w-full rounded-xl bg-slate-900 py-3 text-sm font-bold text-white shadow-sm hover:bg-slate-800 transition"
                  >
                    Return to Home
                  </button>
                </div>
              </motion.div>
            ) : showPolicyConfirmDialog ? (
              // Pre-Cancellation Warning Confirmation Dialog
              <div className="py-4 space-y-4">
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
                      <ShieldAlert className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-amber-950">
                        Please Note Before Cancelling
                      </h4>
                      <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wider mt-0.5">
                        A2Z Cancellation Policy Warning
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-amber-900 font-medium leading-relaxed">
                    You have cancelled several bookings recently. Another cancellation may trigger an account warning or temporary booking restriction under the A2Z cancellation policy.
                  </p>

                  <div className="rounded-xl bg-amber-100/70 p-3 text-xs text-amber-950 font-semibold flex items-center justify-between">
                    <span>Recent cancellations:</span>
                    <span className="font-bold">
                      {customerPolicy?.eligibleCount || 0} in past {customerPolicy?.windowDays || 30} days
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setShowPolicyConfirmDialog(false)}
                    disabled={submitting}
                    className="flex-1 rounded-xl bg-slate-900 py-3 text-sm font-bold text-white hover:bg-slate-800 transition disabled:opacity-50"
                  >
                    Keep Booking
                  </button>
                  <button
                    type="button"
                    onClick={executeCancellation}
                    disabled={submitting}
                    className="flex-1 rounded-xl border border-rose-300 bg-rose-50 py-3 text-sm font-bold text-rose-700 hover:bg-rose-100 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin text-rose-600" />
                        <span>Cancelling...</span>
                      </>
                    ) : (
                      <span>Cancel Booking</span>
                    )}
                  </button>
                </div>
              </div>
            ) : loadingEligibility ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-3 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-brand" />
                <p className="text-sm font-semibold text-slate-500">
                  Checking cancellation policy...
                </p>
              </div>
            ) : eligibility && !eligibility.isEligible ? (
              // Ineligible Screen
              <div className="py-4 space-y-4">
                <div className="rounded-2xl bg-rose-50 border border-rose-200/80 p-4 flex items-start gap-3">
                  <ShieldAlert className="h-6 w-6 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-rose-900">
                      Cancellation Not Available
                    </h4>
                    <p className="text-xs font-medium text-rose-700 mt-1 leading-relaxed">
                      {eligibility.reason || 'This booking cannot be cancelled through the regular flow.'}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4 text-xs text-slate-600 space-y-1.5 font-medium">
                  <p className="font-bold text-slate-800">What can you do?</p>
                  <p>• If the service partner has already arrived or started, please coordinate directly with them.</p>
                  <p>• For urgent assistance or disputes, reach out to customer support with your booking reference #{shortCode}.</p>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full rounded-xl bg-slate-900 py-3 text-sm font-bold text-white shadow-sm hover:bg-slate-800 transition"
                  >
                    Back to Booking
                  </button>
                </div>
              </div>
            ) : (
              // Cancellation Form
              <>
                {/* Error Banner */}
                {error && (
                  <div className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 flex items-center gap-2 text-rose-800 text-xs font-semibold">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Repeat Policy Banner */}
                {customerPolicy?.policyEnabled && (customerPolicy?.approachingThreshold || customerPolicy?.warningActive) && (
                  <div className="rounded-2xl bg-amber-50 border border-amber-200/90 p-3.5 flex items-start gap-2.5 text-xs text-amber-900">
                    <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Cancellation Policy Notice: </span>
                      <span className="font-medium">
                        {customerPolicy.warningActive
                          ? `You have cancelled ${customerPolicy.eligibleCount} bookings recently. Additional cancellations may trigger account restrictions.`
                          : `You have cancelled ${customerPolicy.eligibleCount} bookings recently. Another cancellation will trigger a policy warning.`}
                      </span>
                    </div>
                  </div>
                )}

                {/* Reason Selection */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Why do you want to cancel?
                  </label>
                  <div className="space-y-2">
                    {(eligibility?.allowedReasons || STANDARD_REASONS).map((reason) => {
                      const isSelected = selectedReason === reason
                      return (
                        <label
                          key={reason}
                          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                            isSelected
                              ? 'border-brand bg-brand/5 shadow-sm text-brand-900'
                              : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                          }`}
                        >
                          <input
                            type="radio"
                            name="cancelReason"
                            value={reason}
                            checked={isSelected}
                            onChange={() => {
                              setSelectedReason(reason)
                              if (error) setError('')
                            }}
                            className="h-4 w-4 text-brand focus:ring-brand border-slate-300"
                          />
                          <span className="text-sm font-semibold">{reason}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>

                {/* Other description textarea */}
                {selectedReason === 'Other' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="space-y-1.5"
                  >
                    <label className="block text-xs font-bold text-slate-600">
                      Please tell us more <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      rows={3}
                      value={reasonNote}
                      onChange={(e) => {
                        setReasonNote(e.target.value)
                        if (error) setError('')
                      }}
                      placeholder="Please describe why you are cancelling..."
                      className="w-full rounded-xl border border-slate-200 p-3 text-sm font-medium text-slate-800 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                    />
                  </motion.div>
                )}

                {/* Policy & Financial Summary Card */}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                    <span>Cancellation Fee</span>
                    <span className={`font-bold ${cancellationFee > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                      {cancellationFee > 0 ? `₹${cancellationFee}` : 'Free (₹0)'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs font-semibold text-slate-600 border-t border-slate-200/60 pt-2">
                    <span>Payment Mode</span>
                    <span className="font-bold text-slate-800 uppercase">{booking.paymentMethod}</span>
                  </div>

                  {booking.paymentMethod === 'ONLINE' && (
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-600 border-t border-slate-200/60 pt-2">
                      <span>Refund Status</span>
                      <span className="font-bold text-brand">
                        {isOnlinePaid ? `₹${estimatedRefund} (Initiated)` : 'Not charged'}
                      </span>
                    </div>
                  )}

                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed pt-1">
                    {eligibility?.refundNote ||
                      (booking.paymentMethod === 'CASH'
                        ? 'Cash booking — no payment was collected.'
                        : isOnlinePaid
                        ? 'Refund will be initiated to your original payment method under platform terms.'
                        : 'No charges will be deducted.')}
                  </p>
                </div>

                {/* Actions */}
                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={submitting}
                    className="flex-1 rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
                  >
                    Go Back
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmCancellation}
                    disabled={submitting || !selectedReason}
                    className="flex-1 rounded-xl bg-rose-600 py-3 text-sm font-bold text-white shadow-sm hover:bg-rose-700 transition disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Cancelling...</span>
                      </>
                    ) : (
                      <span>Confirm Cancellation</span>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )

  return createPortal(modalContent, document.body)
}
