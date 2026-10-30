import { useState, useEffect, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  QrCode,
  Copy,
  Check,
  Upload,
  AlertTriangle,
  Clock,
  CheckCircle2,
  X,
  Loader2,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
  Info,
  ChevronRight,
  Sparkles,
  ArrowRight,
  FileText,
  IndianRupee,
} from 'lucide-react'
import { adminQrPaymentsApi } from '../../api/adminQrPaymentsApi.js'
import { useSocket } from '../../context/SocketContext.jsx'

function formatInr(val) {
  return `₹${Number(val || 0).toLocaleString('en-IN')}`
}

export function ProviderQRPaymentModal({
  isOpen,
  onClose,
  purpose = 'WALLET_TOPUP',
  defaultAmount = 500,
  allowCustomAmount = true,
  metadata = {},
  onPaymentSubmitted,
  existingPayment = null, // if resubmitting a rejected payment
}) {
  const socket = useSocket()

  // Steps: 'scan' (1) -> 'submit' (2) -> 'success' (3)
  const [step, setStep] = useState('scan')

  // Amount State
  const [amount, setAmount] = useState(String(defaultAmount || '500'))
  const [amountError, setAmountError] = useState('')

  // QR Config State
  const [config, setConfig] = useState(null)
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [configError, setConfigError] = useState('')
  const [qrUpdatedAlert, setQrUpdatedAlert] = useState(false)
  const initialVersionRef = useRef(null)

  // Copy Feedback
  const [copiedUpi, setCopiedUpi] = useState(false)

  // Submission Form State
  const [utr, setUtr] = useState(existingPayment?.utr || '')
  const [utrError, setUtrError] = useState('')
  const [receiptFile, setReceiptFile] = useState(null)
  const [receiptPreview, setReceiptPreview] = useState(existingPayment?.receiptUrl || null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  // Completed Payment Info
  const [completedPayment, setCompletedPayment] = useState(null)

  // Zoom QR
  const [zoomQr, setZoomQr] = useState(false)

  // Sync Amount when default changes
  useEffect(() => {
    if (defaultAmount) {
      setAmount(String(defaultAmount))
    }
  }, [defaultAmount])

  // Fetch active QR configuration
  const loadQrConfig = useCallback(async (isBackgroundSync = false) => {
    try {
      if (!isBackgroundSync) setLoadingConfig(true)
      const res = await adminQrPaymentsApi.fetchActiveQrConfig(purpose)
      const active = res.data?.config

      if (active && active.isActive) {
        setConfig(active)
        setConfigError('')

        // Version change detection
        if (initialVersionRef.current !== null && initialVersionRef.current !== active.version) {
          setQrUpdatedAlert(true)
        }
        initialVersionRef.current = active.version
      } else {
        setConfig(null)
        setConfigError(
          'UPI QR payments are currently unavailable or disabled by administration. Please use an alternate payment method or contact support.'
        )
      }
    } catch (err) {
      if (!isBackgroundSync) {
        setConfigError(err.message || 'Failed to load official payment QR code.')
      }
    } finally {
      if (!isBackgroundSync) setLoadingConfig(false)
    }
  }, [purpose])

  // Initial load when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep(existingPayment ? 'submit' : 'scan')
      setQrUpdatedAlert(false)
      setSubmitError('')
      setUtrError('')
      initialVersionRef.current = null
      loadQrConfig(false)
    }
  }, [isOpen, loadQrConfig, existingPayment])

  // Dynamic synchronization: Visibility change & Window Focus
  useEffect(() => {
    if (!isOpen) return

    function handleFocus() {
      loadQrConfig(true)
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        loadQrConfig(true)
      }
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [isOpen, loadQrConfig])

  // Real-time synchronization via Socket.IO
  useEffect(() => {
    if (!socket || !isOpen) return

    const handleConfigUpdated = (updatedConfig) => {
      console.log('[Socket] Live PAYMENT_CONFIG_UPDATED received:', updatedConfig)
      if (updatedConfig) {
        setConfig(updatedConfig)
        if (initialVersionRef.current && initialVersionRef.current !== updatedConfig.version) {
          setQrUpdatedAlert(true)
        }
        initialVersionRef.current = updatedConfig.version
      } else {
        loadQrConfig(true)
      }
    }

    socket.on('PAYMENT_CONFIG_UPDATED', handleConfigUpdated)

    return () => {
      socket.off('PAYMENT_CONFIG_UPDATED', handleConfigUpdated)
    }
  }, [socket, isOpen, loadQrConfig])

  // Copy UPI ID to clipboard
  const handleCopyUpi = () => {
    if (!config?.upiId) return
    navigator.clipboard.writeText(config.upiId)
    setCopiedUpi(true)
    setTimeout(() => setCopiedUpi(false), 2500)
  }

  // Handle Receipt File Upload
  const handleReceiptChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) {
      setSubmitError('Invalid file type. Supported formats are JPG, PNG, WebP, and PDF.')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setSubmitError('Receipt file must be under 10MB.')
      return
    }

    setReceiptFile(file)
    setReceiptPreview(file.type.startsWith('image/') ? URL.createObjectURL(file) : null)
    setSubmitError('')
  }

  // Step 1 Validation & Next
  const handleProceedToProof = () => {
    const num = Number(amount)
    if (isNaN(num) || num < 1) {
      setAmountError('Please enter a valid amount of at least ₹1')
      return
    }
    setAmountError('')
    setStep('submit')
  }

  // Step 2 Submission
  const handleSubmitPayment = async (e) => {
    e.preventDefault()

    const cleanUtr = String(utr || '').trim().toUpperCase()
    if (!cleanUtr || cleanUtr.length < 6 || cleanUtr.length > 35) {
      setUtrError('Please enter a valid 6 to 35 digit UTR / UPI Reference Number')
      return
    }
    setUtrError('')
    setSubmitError('')
    setSubmitting(true)

    try {
      let paymentRecordId = existingPayment?._id

      // 1. If not an existing payment, initiate one first
      if (!paymentRecordId) {
        const createRes = await adminQrPaymentsApi.createProviderPayment({
          purpose,
          amount: Number(amount),
          metadata,
        })
        paymentRecordId = createRes.data?.payment?._id
      }

      if (!paymentRecordId) {
        throw new Error('Failed to initialize payment record')
      }

      // 2. Submit the UTR & optional receipt proof
      const fd = new FormData()
      fd.append('utr', cleanUtr)
      if (notes.trim()) fd.append('notes', notes.trim())
      if (receiptFile) fd.append('receipt', receiptFile)

      const submitRes = await adminQrPaymentsApi.submitProviderPayment(paymentRecordId, fd, true)
      const savedPayment = submitRes.data?.payment

      setCompletedPayment(savedPayment)
      setStep('success')

      if (onPaymentSubmitted) {
        onPaymentSubmitted(savedPayment)
      }
    } catch (err) {
      setSubmitError(err.message || 'Payment submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-50 text-[#015F6C] border border-teal-100">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                {step === 'scan' ? 'Scan & Pay via UPI' : step === 'submit' ? 'Submit Payment Details' : 'Payment Submitted'}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                {purpose === 'WALLET_TOPUP'
                  ? 'Recharge Service Provider Wallet'
                  : purpose === 'WALLET_CLEARANCE'
                  ? 'Clear Outstanding Platform Dues'
                  : 'Official Direct UPI Payment'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Live Warning if QR code changed while user has dialog open */}
        {qrUpdatedAlert && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-start gap-2.5 text-xs text-amber-900">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-bold">QR Configuration Just Updated</p>
              <p className="text-[11px] text-amber-800">
                Administration has updated the official payment coordinates. Please verify the destination account before proceeding.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setQrUpdatedAlert(false)}
              className="text-amber-600 hover:text-amber-900 font-bold"
            >
              &times;
            </button>
          </div>
        )}

        {/* Modal Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {/* ========================================================================= */}
          {/* STEP 1: SCAN QR & TRANSFER                                               */}
          {/* ========================================================================= */}
          {step === 'scan' && (
            <div className="space-y-4">
              {/* Amount Box */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-[#012227] to-[#015F6C] text-white shadow-md">
                <div className="flex items-center justify-between text-xs text-teal-100/90 font-bold">
                  <span>Payable Amount</span>
                  {allowCustomAmount && (
                    <span className="text-[11px] font-normal text-teal-200">Instant UPI Direct</span>
                  )}
                </div>

                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-black tracking-tight">{formatInr(amount)}</span>
                </div>

                {allowCustomAmount && (
                  <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-1.5 overflow-x-auto pb-1">
                    <span className="text-[10px] font-bold uppercase text-teal-200 shrink-0">Quick select:</span>
                    {[200, 500, 1000, 2000].map((quick) => (
                      <button
                        key={quick}
                        type="button"
                        onClick={() => {
                          setAmount(String(quick))
                          setAmountError('')
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-bold transition shrink-0 ${
                          amount === String(quick)
                            ? 'bg-[#01C7D0] text-slate-900 shadow-sm'
                            : 'bg-white/10 text-white hover:bg-white/20'
                        }`}
                      >
                        ₹{quick}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {amountError && <p className="text-xs text-rose-600 font-semibold">{amountError}</p>}

              {/* QR Display Area */}
              {loadingConfig ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#015F6C]" />
                  <p className="text-xs font-medium">Fetching verified payment coordinates...</p>
                </div>
              ) : configError ? (
                <div className="p-5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-center space-y-2">
                  <AlertTriangle className="h-8 w-8 mx-auto text-rose-600" />
                  <p className="text-xs font-bold">{configError}</p>
                  <button
                    type="button"
                    onClick={() => loadQrConfig(false)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-rose-300 text-xs font-bold text-rose-700 shadow-xs"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Retry
                  </button>
                </div>
              ) : config ? (
                <div className="space-y-4">
                  {/* QR Card */}
                  <div className="text-center p-4 rounded-2xl border-2 border-slate-200 bg-slate-50/70 space-y-3">
                    <div className="relative mx-auto w-52 h-52 bg-white rounded-2xl p-2.5 shadow-sm border border-slate-200 flex items-center justify-center group cursor-pointer"
                      onClick={() => setZoomQr(true)}
                    >
                      <img
                        src={config.qrImageUrl}
                        alt="UPI Payment QR Code"
                        className="w-full h-full object-contain"
                      />
                      <div className="absolute inset-0 bg-slate-950/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl text-[11px] font-bold">
                        Click to enlarge
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <div className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        <ShieldCheck className="h-3 w-3" />
                        Verified Merchant Account
                      </div>
                      <h4 className="font-extrabold text-slate-800 text-sm mt-1">
                        {config.displayName}
                      </h4>
                    </div>

                    {/* UPI ID copy pill */}
                    {config.upiId && (
                      <div className="flex items-center justify-center gap-2">
                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-mono font-bold text-slate-700 shadow-xs">
                          <span>{config.upiId}</span>
                          <button
                            type="button"
                            onClick={handleCopyUpi}
                            className="p-1 rounded-lg text-slate-400 hover:text-[#015F6C] hover:bg-slate-100 transition"
                            title="Copy UPI ID"
                          >
                            {copiedUpi ? (
                              <Check className="h-3.5 w-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                        {copiedUpi && (
                          <span className="text-[11px] font-bold text-emerald-600 animate-in fade-in">
                            Copied!
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Instructions Callout */}
                  {config.instructions && (
                    <div className="p-3.5 rounded-2xl bg-teal-50/70 border border-teal-100 text-xs text-teal-900 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-teal-950">
                        <Info className="h-4 w-4 text-[#015F6C] shrink-0" />
                        Instructions
                      </div>
                      <p className="text-[11px] leading-relaxed text-teal-800">
                        {config.instructions}
                      </p>
                    </div>
                  )}

                  {/* Proceed to proof button */}
                  <button
                    type="button"
                    onClick={handleProceedToProof}
                    className="w-full py-3.5 px-4 rounded-2xl bg-[#015F6C] hover:bg-[#014d57] text-white font-black text-sm shadow-md transition flex items-center justify-center gap-2 active:scale-[0.99]"
                  >
                    I Have Made This Payment
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: ENTER UTR / PROOF                                                 */}
          {/* ========================================================================= */}
          {step === 'submit' && (
            <form onSubmit={handleSubmitPayment} className="space-y-4">
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs flex items-center justify-between">
                <div>
                  <span className="text-slate-400 font-semibold block text-[10px] uppercase">Payment For</span>
                  <span className="font-extrabold text-slate-800 text-sm">
                    {purpose === 'WALLET_TOPUP'
                      ? 'Wallet Recharge'
                      : purpose === 'WALLET_CLEARANCE'
                      ? 'Commission Clearance'
                      : purpose}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 font-semibold block text-[10px] uppercase">Amount</span>
                  <span className="font-black text-slate-900 text-base">{formatInr(amount)}</span>
                </div>
              </div>

              {submitError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                  {submitError}
                </div>
              )}

              {/* UTR Input */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  12-Digit UPI Reference No. / UTR <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  maxLength={35}
                  placeholder="e.g. 429381749201"
                  value={utr}
                  onChange={(e) => {
                    setUtr(e.target.value.toUpperCase())
                    setUtrError('')
                  }}
                  className="w-full px-3.5 py-2.5 text-sm font-mono font-bold tracking-wider rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#015F6C]/20 focus:border-[#015F6C] text-slate-800"
                />
                {utrError ? (
                  <p className="text-xs text-rose-600 font-semibold">{utrError}</p>
                ) : (
                  <p className="text-[11px] text-slate-400">
                    Find the 12-digit UTR in your Google Pay, PhonePe, or Paytm payment receipt details.
                  </p>
                )}
              </div>

              {/* Optional Receipt Upload */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Upload Payment Screenshot / Receipt <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <div className="relative border-2 border-dashed border-slate-300 hover:border-[#015F6C] rounded-2xl p-4 text-center cursor-pointer bg-slate-50/50 transition">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,application/pdf"
                    onChange={handleReceiptChange}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  {receiptPreview ? (
                    <div className="space-y-2">
                      <img
                        src={receiptPreview}
                        alt="Preview"
                        className="h-28 mx-auto object-contain rounded-xl border border-slate-200"
                      />
                      <p className="text-[11px] font-bold text-emerald-700">Screenshot selected (Click to replace)</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Upload className="h-6 w-6 mx-auto text-[#015F6C]" />
                      <p className="text-xs font-bold text-slate-700">Click or tap to upload receipt proof</p>
                      <p className="text-[10px] text-slate-400">Supports JPG, PNG, WebP up to 10MB</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Additional Notes */}
              <div className="space-y-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Notes / Remark <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  maxLength={200}
                  placeholder="e.g. Sent from Suresh PhonePe"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#015F6C]"
                />
              </div>

              {/* Actions */}
              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setStep('scan')}
                  disabled={submitting}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  &larr; Back to QR
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-3 px-4 rounded-xl bg-[#015F6C] hover:bg-[#014d57] text-white font-black text-xs shadow-md transition flex items-center justify-center gap-2 disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Submitting for Review...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Submit for Verification
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: SUBMISSION SUCCESS / STATUS                                       */}
          {/* ========================================================================= */}
          {step === 'success' && (
            <div className="py-6 text-center space-y-4 animate-in zoom-in-95 duration-200">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full mx-auto flex items-center justify-center">
                <CheckCircle2 className="h-9 w-9" />
              </div>

              <div className="space-y-1">
                <h4 className="text-lg font-black text-slate-900">Payment Submitted for Verification!</h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  Your reference details have been registered. The administration will verify the funds in bank records and credit your wallet.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-left space-y-2 max-w-sm mx-auto">
                <div className="flex justify-between">
                  <span className="text-slate-500">Amount:</span>
                  <span className="font-black text-slate-800">{formatInr(completedPayment?.amount || amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">UTR / Ref:</span>
                  <span className="font-mono font-bold text-slate-800">{completedPayment?.utr || utr}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Status:</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-blue-100 text-blue-800 font-black text-[10px]">
                    Pending Verification
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full max-w-sm py-3 rounded-xl bg-[#015F6C] text-white font-extrabold text-xs hover:bg-[#014d57] transition shadow-md"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen Zoom of QR */}
      {zoomQr && config?.qrImageUrl && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
          onClick={() => setZoomQr(false)}
        >
          <div className="bg-white p-4 rounded-3xl max-w-sm w-full text-center space-y-3" onClick={(e) => e.stopPropagation()}>
            <img src={config.qrImageUrl} alt="" className="w-full h-auto object-contain rounded-2xl" />
            <p className="font-bold text-slate-800 text-xs">{config.displayName}</p>
            <button
              type="button"
              onClick={() => setZoomQr(false)}
              className="px-4 py-2 bg-slate-100 rounded-xl font-bold text-xs text-slate-600 hover:bg-slate-200"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
export default ProviderQRPaymentModal
