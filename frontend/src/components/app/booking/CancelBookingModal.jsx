import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  HelpCircle,
  Loader2,
  ShieldAlert,
  X,
  CreditCard,
  RotateCcw,
  IndianRupee,
  RefreshCw,
  Sparkles,
  Info,
} from 'lucide-react'
import { bookingsApi } from '../../../api/bookingsApi.js'
import { bookingCancellationApi } from '../../../api/bookingCancellationApi.js'
import { ApiError } from '../../../api/http.js'
import { useAuth } from '../../../hooks/useAuth.js'
import { getRoleHomePath } from '../../../lib/roleHomePath.js'
import { clearBookingDraft } from '../../../lib/individualBookingDraft.js'

const STANDARD_REASONS = [
  'Booked by mistake',
  'Wrong date or time',
  'Service no longer required',
  'Vendor response delay',
  'Found another service provider',
  'Other',
]

function loadRazorpay() {
  return new Promise((resolve) => {
    if (window.Razorpay) {
      resolve(true)
      return
    }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}

/**
 * CancelBookingModal with Admin-Managed Cancellation Penalty & Automatic Policy Restart
 */
export function CancelBookingModal({ open, booking, onClose, onSuccess }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [loadingEligibility, setLoadingEligibility] = useState(true)
  const [eligibility, setEligibility] = useState(null)
  const [selectedReason, setSelectedReason] = useState('')
  const [reasonNote, setReasonNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [successResult, setSuccessResult] = useState(null)

  // Penalty payment & restart states
  const [payingPenalty, setPayingPenalty] = useState(false)
  const [paymentError, setPaymentError] = useState('')
  const [restartedPolicyResult, setRestartedPolicyResult] = useState(null)

  const [showPolicyConfirmDialog, setShowPolicyConfirmDialog] = useState(false)

  // Fetch eligibility
  const fetchEligibility = useCallback(async () => {
    if (!booking?._id) return
    setLoadingEligibility(true)
    setError('')
    setPaymentError('')
    try {
      const res = await bookingsApi.getCancellationEligibility(booking._id)
      setEligibility(res.data)
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Unable to check cancellation eligibility'
      setError(msg)
    } finally {
      setLoadingEligibility(false)
    }
  }, [booking?._id])

  useEffect(() => {
    if (!open || !booking?._id) {
      setSelectedReason('')
      setReasonNote('')
      setError('')
      setPaymentError('')
      setSubmitting(false)
      setPayingPenalty(false)
      setSuccessResult(null)
      setRestartedPolicyResult(null)
      setShowPolicyConfirmDialog(false)
      return
    }

    fetchEligibility()
  }, [open, booking?._id, fetchEligibility])

  if (!open || !booking) return null

  const shortCode = String(booking._id).slice(-6).toUpperCase()
  const isOnlinePaid = booking.paymentMethod === 'ONLINE' && (booking.paymentStatus || '').toUpperCase() === 'PAID'
  const cancellationFee = eligibility?.cancellationFee || 0
  const estimatedRefund = Math.max(0, (booking.totalAmount || 0) - cancellationFee)
  const customerPolicy = eligibility?.customerPolicy
  const isPenaltyApplicable = Boolean(eligibility?.penaltyApplicable)
  const penaltyDetails = eligibility?.penaltyDetails
  const billingSummary = eligibility?.billingSummary || penaltyDetails?.billingSummary

  // Execute standard cancellation (when no penalty applies)
  const executeCancellation = async () => {
    setError('')
    setSubmitting(true)

    try {
      const res = await bookingsApi.cancelBooking(booking._id, {
        reason: selectedReason,
        reasonNote: selectedReason === 'Other' ? reasonNote.trim() : undefined,
      })

      const cancellationData = res.data || {}

      // If backend responded that penalty is required
      if (cancellationData.penaltyRequired) {
        setEligibility((prev) => ({
          ...prev,
          penaltyApplicable: true,
          penaltyDetails: cancellationData.penalty,
          billingSummary: cancellationData.billingSummary,
        }))
        setSubmitting(false)
        setShowPolicyConfirmDialog(false)
        return
      }

      const updatedBooking = cancellationData.booking || {
        ...booking,
        status: 'CANCELLED',
        cancelledBy: 'CUSTOMER',
        cancellationReason: selectedReason === 'Other' ? `Other: ${reasonNote.trim()}` : selectedReason,
        cancelledAt: new Date().toISOString(),
      }

      setSuccessResult(cancellationData)
      setShowPolicyConfirmDialog(false)
      clearBookingDraft()

      if (onSuccess) {
        onSuccess(updatedBooking, cancellationData)
      }
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Failed to cancel booking. Please try again.'
      setError(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // Handle Pay Penalty to Restart Policy
  const handlePayPenalty = async () => {
    setPaymentError('')
    setPayingPenalty(true)

    try {
      // 1. Initialize payment
      const initRes = await bookingCancellationApi.initCustomerPenaltyPayment(booking._id, {
        penaltyId: penaltyDetails?.penaltyId,
      })

      const { order, penalty } = initRes.data || {}

      if (!order) {
        throw new Error('Failed to initialize payment gateway order')
      }

      // If mock order (testing or dev mode fallback without live keys)
      if (order.mock || String(order.id).startsWith('order_mock_')) {
        const verifyRes = await bookingCancellationApi.verifyCustomerPenaltyPayment(booking._id, {
          razorpayOrderId: order.id,
          razorpayPaymentId: `pay_mock_${Date.now()}`,
          razorpaySignature: 'mock_signature_valid',
        })

        const verifiedData = verifyRes.data || {}
        setRestartedPolicyResult(verifiedData)
        setPayingPenalty(false)
        return
      }

      // Live Razorpay Checkout
      const razorpayLoaded = await loadRazorpay()
      if (!razorpayLoaded || !window.Razorpay) {
        throw new Error('Razorpay SDK failed to load. Please check your internet connection.')
      }

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_placeholder',
        amount: order.amount,
        currency: order.currency || 'INR',
        name: 'A2Z Service Provider',
        description: `Cancellation Penalty Fee - Booking #${shortCode}`,
        order_id: order.id,
        prefill: {
          name: user?.fullName || '',
          contact: user?.phone || '',
          email: user?.email || '',
        },
        theme: {
          color: '#0F172A',
        },
        handler: async (response) => {
          try {
            const verifyRes = await bookingCancellationApi.verifyCustomerPenaltyPayment(booking._id, {
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            })

            const verifiedData = verifyRes.data || {}
            setRestartedPolicyResult(verifiedData)
          } catch (verErr) {
            const msg = verErr instanceof ApiError ? verErr.message : 'Payment verification failed'
            setPaymentError(msg)
          } finally {
            setPayingPenalty(false)
          }
        },
        modal: {
          ondismiss: () => {
            setPayingPenalty(false)
            setPaymentError('Payment window closed. You can retry paying the penalty to restart your policy.')
          },
        },
      }

      const rzp = new window.Razorpay(options)
      rzp.on('payment.failed', (failResp) => {
        setPayingPenalty(false)
        setPaymentError(failResp.error?.description || 'Payment transaction failed. Please retry.')
      })
      rzp.open()
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : err.message || 'Unable to process penalty payment'
      setPaymentError(msg)
      setPayingPenalty(false)
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

    if (isPenaltyApplicable) {
      await handlePayPenalty()
      return
    }

    // Check if customer is approaching or at warning threshold
    if (
      customerPolicy?.policyEnabled &&
      (customerPolicy?.approachingThreshold || customerPolicy?.warningActive) &&
      !showPolicyConfirmDialog
    ) {
      setShowPolicyConfirmDialog(true)
      return
    }

    await executeCancellation()
  }

  // Handle restarting cancellation flow under the newly created policy cycle
  const handleInitiateNewCancellation = async () => {
    setRestartedPolicyResult(null)
    setSuccessResult(null)
    setSelectedReason('')
    setReasonNote('')
    setError('')
    setPaymentError('')
    await fetchEligibility()
  }

  const modalContent = (
    <AnimatePresence>
      <div
        key="cancel-booking-wrapper"
        className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-sm"
      >
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
                {restartedPolicyResult
                  ? 'Policy Restart Confirmed'
                  : isPenaltyApplicable
                  ? 'Cancellation Penalty & Policy Restart'
                  : 'Cancel Booking'}
              </h2>
              <p className="text-xs font-semibold text-slate-400 mt-0.5">
                Booking #{shortCode} • {booking.serviceId?.name || booking.subcategoryId?.name || 'Service'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={submitting || payingPenalty}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 transition disabled:opacity-50"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-5 overflow-y-auto space-y-4 flex-1">
            {/* SCREEN 1: Policy Restarted Confirmation Screen */}
            {restartedPolicyResult ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-6 flex flex-col items-center text-center space-y-4"
              >
                <div className="h-16 w-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
                  <CheckCircle2 className="h-9 w-9" />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-900">Cancellation Policy Restarted</h3>
                  <p className="text-sm font-medium text-slate-600 mt-1 max-w-sm">
                    Cancellation penalty payment successful. Your cancellation policy has been restarted. You can now
                    initiate another cancellation request according to the updated policy cycle.
                  </p>
                </div>

                {/* Policy Cycle Details Card */}
                <div className="w-full rounded-2xl bg-emerald-50/60 border border-emerald-200/80 p-4 text-left space-y-2">
                  <div className="flex items-center justify-between text-xs font-bold text-emerald-950">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="h-4 w-4 text-emerald-600" />
                      Current Policy Cycle:
                    </span>
                    <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-emerald-900 font-black">
                      Cycle #{restartedPolicyResult.newCycle?.cycleNumber || 2}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs font-semibold text-emerald-900 border-t border-emerald-200/50 pt-2">
                    <span>Booking Status:</span>
                    <span className="font-bold text-emerald-800 uppercase">
                      {booking.status || 'ACTIVE'} (Kept Active)
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs font-semibold text-emerald-900 border-t border-emerald-200/50 pt-2">
                    <span>Penalty Paid:</span>
                    <span className="font-bold text-emerald-800">
                      ₹{restartedPolicyResult.penalty?.calculatedPenaltyAmount || billingSummary?.cancellationPenalty || 0}
                    </span>
                  </div>

                  <p className="text-[11px] font-medium text-emerald-800/90 pt-1 leading-snug">
                    Important: Your booking has not been cancelled. You now have a fresh opportunity to submit a
                    cancellation request under the restarted policy.
                  </p>
                </div>

                {/* Actions */}
                <div className="w-full space-y-2.5 pt-2">
                  <button
                    type="button"
                    onClick={handleInitiateNewCancellation}
                    className="w-full rounded-xl bg-brand py-3 text-sm font-bold text-white shadow-sm hover:bg-brand-600 transition flex items-center justify-center gap-2"
                  >
                    <RotateCcw className="h-4 w-4" />
                    <span>Initiate New Cancellation Request</span>
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="w-full rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition"
                  >
                    Keep Booking & Close
                  </button>
                </div>
              </motion.div>
            ) : successResult ? (
              // SCREEN 2: Booking Cancelled Success Screen (Free Cancellation)
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-6 flex flex-col items-center text-center space-y-3"
              >
                <div className="h-16 w-16 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shadow-sm">
                  <CheckCircle2 className="h-9 w-9" />
                </div>
                <h3 className="text-xl font-black text-slate-900">Booking Cancelled</h3>
                <p className="text-sm font-medium text-slate-600 max-w-xs">
                  Your booking #{shortCode} has been cancelled successfully.
                </p>

                {/* Refund Status */}
                {booking.paymentMethod === 'ONLINE' && isOnlinePaid && (
                  <div className="w-full mt-3 rounded-2xl bg-blue-50/70 border border-blue-100 p-4 text-left">
                    <p className="text-xs font-bold text-blue-900 uppercase tracking-wider mb-1">
                      Refund Information
                    </p>
                    <p className="text-sm font-semibold text-blue-800">
                      Refund Status:{' '}
                      <span className="uppercase font-bold">{successResult.refund?.status || 'PENDING REVIEW'}</span>
                    </p>
                    <p className="text-xs text-blue-600 mt-0.5">
                      Estimated Amount: ₹{successResult.refund?.amount ?? estimatedRefund}
                    </p>
                  </div>
                )}

                <div className="w-full pt-4">
                  <button
                    type="button"
                    onClick={() => {
                      clearBookingDraft()
                      if (onClose) onClose()
                      navigate(getRoleHomePath(user?.role), { replace: true })
                    }}
                    className="w-full rounded-xl bg-slate-900 py-3 text-sm font-bold text-white shadow-sm hover:bg-slate-800 transition"
                  >
                    Return to Home
                  </button>
                </div>
              </motion.div>
            ) : showPolicyConfirmDialog ? (
              // SCREEN 3: Repeat Policy Warning Confirmation Dialog
              <div className="py-4 space-y-4">
                <div className="rounded-2xl bg-amber-50 border border-amber-200 p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700 shrink-0">
                      <ShieldAlert className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-amber-950">Please Note Before Cancelling</h4>
                      <p className="text-[11px] font-bold text-amber-800 uppercase tracking-wider mt-0.5">
                        A2Z Cancellation Policy Warning
                      </p>
                    </div>
                  </div>

                  <p className="text-xs text-amber-900 font-medium leading-relaxed">
                    You have cancelled several bookings recently. Another cancellation may trigger an account warning or
                    temporary booking restriction under the A2Z cancellation policy.
                  </p>
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
              // Loading Screen
              <div className="py-12 flex flex-col items-center justify-center space-y-3 text-center">
                <Loader2 className="h-8 w-8 animate-spin text-brand" />
                <p className="text-sm font-semibold text-slate-500">Checking cancellation policy...</p>
              </div>
            ) : eligibility && !eligibility.isEligible ? (
              // Ineligible Screen
              <div className="py-4 space-y-4">
                <div className="rounded-2xl bg-rose-50 border border-rose-200/80 p-4 flex items-start gap-3">
                  <ShieldAlert className="h-6 w-6 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-rose-900">Cancellation Not Available</h4>
                    <p className="text-xs font-medium text-rose-700 mt-1 leading-relaxed">
                      {eligibility.reason || 'This booking cannot be cancelled through the regular flow.'}
                    </p>
                  </div>
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
              // SCREEN 4: Active Cancellation / Penalty Form
              <>
                {/* Error Banner */}
                {(error || paymentError) && (
                  <div className="rounded-xl bg-rose-50 border border-rose-200 px-3.5 py-2.5 flex items-center gap-2 text-rose-800 text-xs font-semibold">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                    <span>{error || paymentError}</span>
                  </div>
                )}

                {/* PENALTY APPLICABLE BANNER */}
                {isPenaltyApplicable ? (
                  <div className="rounded-2xl bg-amber-50 border border-amber-200 p-4 space-y-3 text-left">
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                        <IndianRupee className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-sm font-extrabold text-amber-950">
                          Cancellation Penalty Applicable
                        </h4>
                        <p className="text-xs font-medium text-amber-900 mt-0.5 leading-relaxed">
                          Your cancellation request requires a penalty payment according to the applicable cancellation
                          policy. After successful payment, your cancellation policy will restart, and you will receive
                          another cancellation opportunity.
                        </p>
                      </div>
                    </div>

                    <div className="rounded-xl bg-amber-100/70 p-3 text-xs text-amber-950 font-semibold flex items-center justify-between">
                      <span>Policy Cycle:</span>
                      <span className="font-bold">Cycle #{eligibility.cycle?.cycleNumber || 1}</span>
                    </div>
                  </div>
                ) : null}

                {/* BILLING BREAKDOWN CARD */}
                {isPenaltyApplicable && billingSummary ? (
                  <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2.5 shadow-xs">
                    <p className="text-xs font-black uppercase tracking-wider text-slate-700 pb-1 border-b border-slate-100">
                      Updated Booking Billing Summary
                    </p>

                    <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                      <span>Original Booking Amount</span>
                      <span className="font-bold text-slate-800">
                        ₹{billingSummary.originalBookingAmount || booking.totalAmount || 0}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs font-semibold text-rose-600 bg-rose-50/60 p-2 rounded-lg">
                      <span className="flex items-center gap-1.5">
                        <span>Cancellation Penalty ({penaltyDetails?.penaltyCalculationType === 'PERCENTAGE' ? `${penaltyDetails?.configuredPenaltyValue}%` : 'Fixed'})</span>
                      </span>
                      <span className="font-black text-rose-700">
                        +₹{billingSummary.cancellationPenalty || penaltyDetails?.calculatedPenaltyAmount || 0}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                      <span>Total Booking Value</span>
                      <span className="font-bold text-slate-800">
                        ₹{billingSummary.totalBookingValue || 0}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs font-medium text-slate-600">
                      <span>Previously Paid</span>
                      <span className="font-bold text-emerald-700">
                        ₹{billingSummary.previouslyPaidAmount || 0}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-sm font-black text-slate-900 border-t border-slate-200 pt-2">
                      <span>Additional Amount Payable</span>
                      <span className="text-base text-brand font-black">
                        ₹{billingSummary.additionalAmountPayable || billingSummary.cancellationPenalty || 0}
                      </span>
                    </div>
                  </div>
                ) : (
                  /* Standard Policy Card */
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
                      <span>Cancellation Fee</span>
                      <span className="font-bold text-emerald-600">Free (₹0)</span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-600 border-t border-slate-200/60 pt-2">
                      <span>Payment Mode</span>
                      <span className="font-bold text-slate-800 uppercase">{booking.paymentMethod}</span>
                    </div>
                  </div>
                )}

                {/* Reason Selection */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
                    Reason for Cancellation
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
                              if (paymentError) setPaymentError('')
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
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-600">
                      Please tell us more <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      rows={3}
                      value={reasonNote}
                      onChange={(e) => {
                        setReasonNote(e.target.value)
                        if (error) setError('')
                        if (paymentError) setPaymentError('')
                      }}
                      placeholder="Please describe why you are cancelling..."
                      className="w-full rounded-xl border border-slate-200 p-3 text-sm font-medium text-slate-800 focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
                    />
                  </motion.div>
                )}

                {/* Modal Action Buttons */}
                <div className="pt-2 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    disabled={submitting || payingPenalty}
                    className="flex-1 rounded-xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 transition disabled:opacity-50"
                  >
                    Go Back
                  </button>

                  {isPenaltyApplicable ? (
                    <button
                      type="button"
                      onClick={handleConfirmCancellation}
                      disabled={payingPenalty || !selectedReason}
                      className="flex-1 rounded-xl bg-slate-900 py-3 text-sm font-bold text-white shadow-sm hover:bg-slate-800 transition disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {payingPenalty ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
                          <span>Processing Payment...</span>
                        </>
                      ) : (
                        <>
                          <CreditCard className="h-4 w-4 text-amber-400" />
                          <span>Pay ₹{billingSummary?.additionalAmountPayable || penaltyDetails?.calculatedPenaltyAmount || 0} & Restart</span>
                        </>
                      )}
                    </button>
                  ) : (
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
                  )}
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
