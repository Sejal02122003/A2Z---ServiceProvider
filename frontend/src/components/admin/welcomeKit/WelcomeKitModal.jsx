import { useState } from 'react'
import {
  X,
  Package,
  Check,
  Loader2,
  AlertCircle,
  Eye,
  ExternalLink,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ZoomIn,
  CreditCard,
  Clock,
} from 'lucide-react'
import { updatePartnerWelcomeKit, verifyPartnerWelcomeKitPayment } from '../../../api/servicePartnerApi.js'
import { KitStatusBadge, getKitStatusDerived } from './KitStatusBadge.jsx'

const COMMON_REJECTION_REASONS = [
  'Screenshot is blurry or unreadable',
  'Incorrect payment amount (₹999 required)',
  'UTR / Transaction ID not visible or invalid',
  'Duplicate receipt or previously used screenshot',
  'Payment not credited to company bank account',
]

export function WelcomeKitModal({ user, onClose, onSuccess }) {
  const [currentKit, setCurrentKit] = useState(user?.welcomeKit || {})
  const [uniformIssued, setUniformIssued] = useState(Boolean(user?.welcomeKit?.uniformIssued))
  const [idCardIssued, setIdCardIssued] = useState(Boolean(user?.welcomeKit?.idCardIssued))
  const [bagIssued, setBagIssued] = useState(Boolean(user?.welcomeKit?.bagIssued))

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  // Payment Verification State
  const [paymentActionBusy, setPaymentActionBusy] = useState(false)
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [customRejectionNote, setCustomRejectionNote] = useState('')
  const [showFullReceipt, setShowFullReceipt] = useState(false)

  if (!user) return null

  const tempKit = { ...currentKit, uniformIssued, idCardIssued, bagIssued }
  const derivedStatus = getKitStatusDerived(tempKit)
  const existingIssuedAt = currentKit?.issuedAt

  const paymentStatus = currentKit?.status || 'PENDING_PAYMENT'
  const receiptUrl = currentKit?.paymentReceiptUrl

  // Save Welcome Kit Items (Uniform, ID Card, Bag)
  async function handleSaveKit() {
    setError(null)
    setSuccessMsg(null)
    setBusy(true)
    try {
      const res = await updatePartnerWelcomeKit(user._id, {
        uniformIssued,
        idCardIssued,
        bagIssued,
      })
      const updated = res.data?.welcomeKit || {
        ...currentKit,
        uniformIssued,
        idCardIssued,
        bagIssued,
        issuedAt: res.data?.issuedAt,
      }
      setCurrentKit(updated)
      setSuccessMsg('Welcome kit checklist updated successfully')
      if (onSuccess) {
        onSuccess(updated)
      }
      setTimeout(() => {
        onClose()
      }, 700)
    } catch (err) {
      setError(err?.message || 'Failed to update welcome kit status')
    } finally {
      setBusy(false)
    }
  }

  // Handle Admin Payment Decision (APPROVE or REJECT)
  async function handlePaymentDecision(action) {
    setError(null)
    setSuccessMsg(null)

    if (action === 'REJECT') {
      const finalReason = customRejectionNote.trim() || rejectionReason || 'Payment receipt was rejected by admin.'
      if (!finalReason) {
        setError('Please select or specify a reason for rejecting the payment.')
        return
      }
      setPaymentActionBusy(true)
      try {
        const res = await verifyPartnerWelcomeKitPayment(user._id, {
          action: 'REJECT',
          rejectionReason: finalReason,
        })
        const updated = res?.welcomeKit || {
          ...currentKit,
          status: 'PAYMENT_REJECTED',
          paymentRejectionReason: finalReason,
        }
        setCurrentKit(updated)
        setShowRejectForm(false)
        setSuccessMsg('Payment slip marked as REJECTED. Partner notified to re-upload.')
        if (onSuccess) onSuccess(updated)
      } catch (err) {
        setError(err?.message || 'Failed to reject payment')
      } finally {
        setPaymentActionBusy(false)
      }
    } else {
      // APPROVE
      setPaymentActionBusy(true)
      try {
        const res = await verifyPartnerWelcomeKitPayment(user._id, {
          action: 'APPROVE',
        })
        const updated = res?.welcomeKit || {
          ...currentKit,
          status: 'PAID',
          paymentRejectionReason: '',
          paidAt: new Date(),
        }
        setCurrentKit(updated)
        setShowRejectForm(false)
        setSuccessMsg('Payment verified & approved successfully!')
        if (onSuccess) onSuccess(updated)
      } catch (err) {
        setError(err?.message || 'Failed to approve payment')
      } finally {
        setPaymentActionBusy(false)
      }
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-100">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 p-4 sm:p-5 shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Welcome Kit & Payment Slip</h2>
                <p className="text-xs text-slate-500">
                  {user.fullName || 'Service Partner'} • +91 {user.phone}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={busy || paymentActionBusy}
              className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              title="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-5">
            {error && (
              <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <span className="flex-1">{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* SECTION 1: Welcome Kit Payment & Screenshot Verification */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-brand" />
                  <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                    Kit Payment Slip Verification
                  </span>
                </div>

                {/* Status Badge */}
                {paymentStatus === 'PAID' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-300">
                    <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                    Payment Approved (₹999)
                  </span>
                )}
                {paymentStatus === 'PAYMENT_SUBMITTED' && (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-bold text-amber-900 ring-1 ring-amber-300 animate-pulse">
                    <Clock className="h-3 w-3 text-amber-600" />
                    Slip Uploaded • Needs Review
                  </span>
                )}
                {paymentStatus === 'PAYMENT_REJECTED' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-[11px] font-bold text-rose-800 ring-1 ring-rose-300">
                    <XCircle className="h-3 w-3 text-rose-600" />
                    Payment Slip Rejected
                  </span>
                )}
                {paymentStatus === 'PENDING_PAYMENT' && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2.5 py-0.5 text-[11px] font-bold text-slate-600">
                    Not Paid Yet
                  </span>
                )}
              </div>

              {/* Payment Meta Info */}
              <div className="grid grid-cols-2 gap-2 text-xs bg-white p-3 rounded-xl border border-slate-200/80">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Method</span>
                  <span className="font-semibold text-slate-800">
                    {currentKit?.paymentMethod === 'ONLINE' ? 'Online (UPI / Card)' : 'Offline / Hub QR Slip'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Required Fee</span>
                  <span className="font-semibold text-slate-800">₹{currentKit?.paymentAmount || 999}</span>
                </div>
                {currentKit?.paidAt && (
                  <div className="col-span-2 pt-1 border-t border-slate-100 text-[11px] text-slate-500">
                    Submitted on: <span className="text-slate-700 font-medium">{new Date(currentKit.paidAt).toLocaleString()}</span>
                  </div>
                )}
                {currentKit?.deliveryAddress && (
                  <div className="col-span-2 text-[11px] text-slate-500">
                    Delivery Address: <span className="text-slate-700 font-medium">{currentKit.deliveryAddress}</span>
                  </div>
                )}
              </div>

              {/* Screenshot Preview / Full View */}
              {receiptUrl ? (
                <div className="space-y-3">
                  <div className="relative group overflow-hidden rounded-xl border border-slate-200 bg-slate-900/5 aspect-video flex items-center justify-center">
                    <img
                      src={receiptUrl}
                      alt="Welcome kit payment slip"
                      className="w-full h-full object-contain cursor-pointer transition group-hover:scale-102"
                      onClick={() => setShowFullReceipt(true)}
                    />
                    <div
                      onClick={() => setShowFullReceipt(true)}
                      className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 text-white font-bold text-xs transition cursor-pointer"
                    >
                      <ZoomIn className="h-4 w-4" />
                      <span>Click to Enlarge</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => setShowFullReceipt(true)}
                      className="inline-flex items-center gap-1.5 font-bold text-brand hover:underline"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      View Full Resolution Slip
                    </button>
                    <a
                      href={receiptUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800"
                    >
                      <span>Open in new tab</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>

                  {/* Rejection notice if previously rejected */}
                  {paymentStatus === 'PAYMENT_REJECTED' && currentKit?.paymentRejectionReason && (
                    <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3 text-xs text-rose-900 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-rose-800">
                        <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                        <span>Rejection Reason Sent to Partner:</span>
                      </div>
                      <p className="pl-5 italic">{currentKit.paymentRejectionReason}</p>
                    </div>
                  )}

                  {/* Verification Action Buttons */}
                  <div className="pt-1">
                    {!showRejectForm ? (
                      <div className="flex items-center gap-2">
                        {/* Accept Button */}
                        <button
                          type="button"
                          onClick={() => handlePaymentDecision('APPROVE')}
                          disabled={paymentActionBusy || paymentStatus === 'PAID'}
                          className={`flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 px-3 text-xs font-bold transition shadow-sm ${
                            paymentStatus === 'PAID'
                              ? 'bg-emerald-100 text-emerald-800 cursor-default'
                              : 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98]'
                          }`}
                        >
                          {paymentActionBusy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                          <span>{paymentStatus === 'PAID' ? 'Payment Approved ✓' : 'Accept Payment'}</span>
                        </button>

                        {/* Reject Button */}
                        <button
                          type="button"
                          onClick={() => {
                            setShowRejectForm(true)
                            setRejectionReason(COMMON_REJECTION_REASONS[0])
                          }}
                          disabled={paymentActionBusy}
                          className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white py-2.5 px-3 text-xs font-bold text-rose-700 hover:bg-rose-50 active:scale-[0.98] transition"
                        >
                          <XCircle className="h-4 w-4 text-rose-600" />
                          <span>{paymentStatus === 'PAYMENT_REJECTED' ? 'Change Rejection' : 'Reject Payment'}</span>
                        </button>
                      </div>
                    ) : (
                      /* Rejection Form */
                      <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 space-y-3 animate-in fade-in">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                            <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                            Specify Rejection Reason:
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowRejectForm(false)}
                            className="text-xs text-slate-500 hover:text-slate-800"
                          >
                            Cancel
                          </button>
                        </div>

                        {/* Preset reasons */}
                        <div className="space-y-1.5">
                          {COMMON_REJECTION_REASONS.map((reason) => (
                            <label
                              key={reason}
                              className={`flex items-start gap-2 p-2 rounded-lg border text-xs cursor-pointer transition ${
                                rejectionReason === reason && !customRejectionNote
                                  ? 'border-rose-300 bg-white shadow-2xs text-rose-950 font-semibold'
                                  : 'border-slate-200/80 bg-white/60 text-slate-700 hover:bg-white'
                              }`}
                            >
                              <input
                                type="radio"
                                name="rejectionReason"
                                checked={rejectionReason === reason && !customRejectionNote}
                                onChange={() => {
                                  setRejectionReason(reason)
                                  setCustomRejectionNote('')
                                }}
                                className="mt-0.5 text-rose-600 focus:ring-rose-500"
                              />
                              <span className="leading-tight">{reason}</span>
                            </label>
                          ))}
                        </div>

                        {/* Custom note */}
                        <div>
                          <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                            Or Custom Reason / Message:
                          </label>
                          <textarea
                            value={customRejectionNote}
                            onChange={(e) => setCustomRejectionNote(e.target.value)}
                            placeholder="e.g. Transaction date does not match; please upload receipt showing today's date."
                            rows={2}
                            className="w-full rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-800 placeholder-slate-400 focus:border-rose-400 focus:ring-1 focus:ring-rose-200 outline-none"
                          />
                        </div>

                        <div className="flex gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setShowRejectForm(false)}
                            className="flex-1 rounded-lg border border-slate-200 bg-white py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                          >
                            Back
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePaymentDecision('REJECT')}
                            disabled={paymentActionBusy}
                            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 py-2 text-xs font-bold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50"
                          >
                            {paymentActionBusy ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5" />
                            )}
                            <span>Confirm Rejection</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                /* No Screenshot State */
                <div className="rounded-xl border border-dashed border-slate-200 bg-white p-4 text-center space-y-2">
                  <p className="text-xs text-slate-500">
                    No payment slip or screenshot uploaded yet by this service partner.
                  </p>
                  <button
                    type="button"
                    onClick={() => handlePaymentDecision('APPROVE')}
                    disabled={paymentActionBusy || paymentStatus === 'PAID'}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Mark Paid Manually (Direct Hub Cash)</span>
                  </button>
                </div>
              )}
            </div>

            {/* SECTION 2: Kit Checklist (Uniform, ID, Bag) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Welcome Kit Hardware Checklist
                </label>
                {paymentStatus !== 'PAID' && (
                  <span className="text-[10px] font-semibold text-amber-600 flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Payment pending
                  </span>
                )}
              </div>

              {/* Uniform Item */}
              <label
                className={`flex items-center justify-between p-3.5 rounded-xl border transition cursor-pointer ${
                  uniformIssued ? 'border-brand/40 bg-brand/5 ring-1 ring-brand/20' : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={uniformIssued}
                    onChange={(e) => setUniformIssued(e.target.checked)}
                    disabled={busy}
                    className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/30"
                  />
                  <div>
                    <span className="text-sm font-bold text-slate-900">Service Uniform</span>
                    <p className="text-xs text-slate-500">Official company t-shirt / apron kit</p>
                  </div>
                </div>
                <span className={`text-xs font-semibold ${uniformIssued ? 'text-brand' : 'text-slate-400'}`}>
                  {uniformIssued ? 'Issued' : 'Not Issued'}
                </span>
              </label>

              {/* ID Card Item */}
              <label
                className={`flex items-center justify-between p-3.5 rounded-xl border transition cursor-pointer ${
                  idCardIssued ? 'border-brand/40 bg-brand/5 ring-1 ring-brand/20' : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={idCardIssued}
                    onChange={(e) => setIdCardIssued(e.target.checked)}
                    disabled={busy}
                    className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/30"
                  />
                  <div>
                    <span className="text-sm font-bold text-slate-900">ID Card & Lanyard</span>
                    <p className="text-xs text-slate-500">Verified partner credential badge</p>
                  </div>
                </div>
                <span className={`text-xs font-semibold ${idCardIssued ? 'text-brand' : 'text-slate-400'}`}>
                  {idCardIssued ? 'Issued' : 'Not Issued'}
                </span>
              </label>

              {/* Bag Item */}
              <label
                className={`flex items-center justify-between p-3.5 rounded-xl border transition cursor-pointer ${
                  bagIssued ? 'border-brand/40 bg-brand/5 ring-1 ring-brand/20' : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={bagIssued}
                    onChange={(e) => setBagIssued(e.target.checked)}
                    disabled={busy}
                    className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/30"
                  />
                  <div>
                    <span className="text-sm font-bold text-slate-900">Tool / Service Bag</span>
                    <p className="text-xs text-slate-500">Official branded equipment bag</p>
                  </div>
                </div>
                <span className={`text-xs font-semibold ${bagIssued ? 'text-brand' : 'text-slate-400'}`}>
                  {bagIssued ? 'Issued' : 'Not Issued'}
                </span>
              </label>
            </div>

            {/* Derived Kit Status Preview */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-500">Kit Distribution Status:</span>
                <KitStatusBadge welcomeKit={tempKit} />
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-500">Complete Issuance Date:</span>
                <span className="font-mono text-slate-700">
                  {derivedStatus === 'COMPLETE'
                    ? existingIssuedAt
                      ? new Date(existingIssuedAt).toLocaleDateString()
                      : 'Current Timestamp (On Save)'
                    : '—'}
                </span>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="border-t border-slate-100 bg-white p-4 sm:p-5 flex gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={busy || paymentActionBusy}
              className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-center text-sm font-bold text-slate-700 shadow-xs hover:bg-slate-50 transition disabled:opacity-50"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handleSaveKit}
              disabled={busy || paymentActionBusy}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-center text-sm font-bold text-white shadow-md shadow-brand/20 hover:bg-brand/90 transition disabled:opacity-50"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Kit Checklist'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* FULLSCREEN LIGHTBOX FOR RECEIPT SCREENSHOT */}
      {showFullReceipt && receiptUrl && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/85 p-4 backdrop-blur-md animate-in fade-in duration-200">
          <div className="relative max-w-4xl max-h-[92vh] w-full flex flex-col items-center">
            {/* Top Bar */}
            <div className="w-full flex items-center justify-between py-2 px-3 text-white">
              <div className="text-xs font-bold">
                Payment Slip Proof • {user.fullName || 'Service Partner'} (₹{currentKit?.paymentAmount || 999})
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={receiptUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg bg-white/10 hover:bg-white/20 p-2 text-white transition flex items-center gap-1.5 text-xs font-semibold"
                >
                  <ExternalLink className="h-4 w-4" />
                  <span>Open Full URL</span>
                </a>
                <button
                  type="button"
                  onClick={() => setShowFullReceipt(false)}
                  className="rounded-full bg-white/10 hover:bg-white/20 p-2 text-white transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Image Container */}
            <div className="overflow-auto max-h-[82vh] w-full flex items-center justify-center p-2">
              <img
                src={receiptUrl}
                alt="Welcome kit payment slip proof"
                className="max-h-[80vh] w-auto max-w-full rounded-xl object-contain shadow-2xl border border-white/10"
              />
            </div>
          </div>
        </div>
      )}
    </>
  )
}
