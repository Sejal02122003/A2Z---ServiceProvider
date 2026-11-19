import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
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
  ShieldCheck,
  ArrowRight,
  FileText,
  ZoomIn,
} from 'lucide-react'
import { adminQrPaymentsApi } from '../../api/adminQrPaymentsApi.js'
import { walletsApi } from '../../api/walletsApi.js'

function formatInr(val) {
  return `₹${Number(val || 0).toLocaleString('en-IN')}`
}

const QUICK_AMOUNTS = [200, 500, 1000, 2000]

export function WalletRechargeModal({ isOpen, onClose, onSuccess, defaultAmount = 500 }) {
  // Steps: 'details' (enter amount & view QR & enter UTR/upload) | 'success'
  const [step, setStep] = useState('details')

  // Form State
  const [amount, setAmount] = useState(String(defaultAmount || '500'))
  const [amountError, setAmountError] = useState('')
  const [utr, setUtr] = useState('')
  const [utrError, setUtrError] = useState('')
  const [receiptFile, setReceiptFile] = useState(null)
  const [receiptPreview, setReceiptPreview] = useState(null)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submittedRequest, setSubmittedRequest] = useState(null)

  // Active QR Config State
  const [qrConfig, setQrConfig] = useState(null)
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [configError, setConfigError] = useState('')
  const [copiedUpi, setCopiedUpi] = useState(false)
  const [zoomQr, setZoomQr] = useState(false)

  // Load Admin QR configuration
  const loadQrConfig = useCallback(async () => {
    try {
      setLoadingConfig(true)
      const res = await adminQrPaymentsApi.fetchActiveQrConfig('ALL')
      if (res.data?.config && res.data?.isActive) {
        setQrConfig(res.data.config)
        setConfigError('')
      } else {
        setQrConfig(null)
        setConfigError('Admin UPI QR code is currently not configured or disabled. Please contact support.')
      }
    } catch (err) {
      setConfigError('Could not load payment QR code. Please check your connection and try again.')
    } finally {
      setLoadingConfig(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      setStep('details')
      setAmount(String(defaultAmount || '500'))
      setAmountError('')
      setUtr('')
      setUtrError('')
      setReceiptFile(null)
      setReceiptPreview(null)
      setNotes('')
      setSubmitError('')
      setSubmittedRequest(null)
      loadQrConfig()
    }
  }, [isOpen, defaultAmount, loadQrConfig])

  // Prevent background scrolling when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleCopyUpi = () => {
    if (!qrConfig?.upiId) return
    navigator.clipboard.writeText(qrConfig.upiId)
    setCopiedUpi(true)
    setTimeout(() => setCopiedUpi(false), 2000)
  }

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!['image/jpeg', 'image/png', 'image/webp', 'application/pdf'].includes(file.type)) {
      setSubmitError('Supported receipt formats are JPG, PNG, WebP, or PDF.')
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      setSubmitError('Receipt file size must be less than 10MB.')
      return
    }

    setReceiptFile(file)
    setSubmitError('')

    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = () => setReceiptPreview(reader.result)
      reader.readAsDataURL(file)
    } else {
      setReceiptPreview(null)
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validate amount
    const numAmount = Number(amount)
    if (isNaN(numAmount) || numAmount < 1) {
      setAmountError('Please enter a valid amount of at least ₹1.')
      return
    }
    setAmountError('')

    // Validate UTR
    const cleanUtr = String(utr || '').trim().toUpperCase()
    if (!cleanUtr || cleanUtr.length < 6) {
      setUtrError('Please enter a valid 12-digit UTR or Transaction Reference Number.')
      return
    }
    setUtrError('')

    // Validate Screenshot
    if (!receiptFile) {
      setSubmitError('Please upload a screenshot or receipt of your completed payment.')
      return
    }

    try {
      setSubmitting(true)
      setSubmitError('')

      const formData = new FormData()
      formData.append('amount', String(numAmount))
      formData.append('utrNumber', cleanUtr)
      formData.append('paymentMode', 'UPI_QR')
      if (notes) formData.append('notes', notes)
      formData.append('paymentScreenshot', receiptFile)

      const res = await walletsApi.submitRechargeRequest(formData)
      if (res.data?.request) {
        setSubmittedRequest(res.data.request)
        setStep('success')
        if (onSuccess) onSuccess(res.data.request)
      } else {
        throw new Error(res.message || 'Submission failed')
      }
    } catch (err) {
      setSubmitError(err.message || 'Failed to submit recharge request. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const modalContent = (
    <div
      className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-xs flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4 overflow-hidden pointer-events-auto"
      role="dialog"
      aria-modal="true"
    >
      {/* Background click dismiss */}
      <div className="absolute inset-0 -z-10" onClick={onClose} aria-hidden />

      {/* Dialog Card */}
      <div className="relative flex flex-col w-full sm:max-w-lg h-[90dvh] max-h-[90dvh] sm:h-auto sm:max-h-[88vh] bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in slide-in-from-bottom-4 sm:zoom-in-95 duration-200">
        {/* Header - Fixed at Top */}
        <div className="shrink-0 p-4 sm:p-5 bg-gradient-to-r from-teal-800 to-teal-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-white/10 text-teal-200">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-tight">Recharge Wallet via UPI QR</h2>
              <p className="text-xs text-teal-200">Scan, pay, and submit for instant admin verification</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition active:scale-95"
            aria-label="Close dialog"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body - Fully Scrollable */}
        {step === 'details' ? (
          <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 h-full overflow-hidden">
            <div
              className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-5 space-y-4 overscroll-contain touch-pan-y"
              style={{ WebkitOverflowScrolling: 'touch' }}
            >
              {/* Step 1: Amount input */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>1. Enter Recharge Amount</span>
                  <span className="text-[11px] font-semibold text-slate-400">Min: ₹1</span>
                </label>

                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-lg">₹</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value)
                      if (amountError) setAmountError('')
                    }}
                    placeholder="500"
                    className="w-full pl-8 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-black text-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                </div>

                {/* Quick Amount Chips */}
                <div className="flex flex-wrap gap-1.5 pt-0.5">
                  {QUICK_AMOUNTS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => {
                        setAmount(String(q))
                        setAmountError('')
                      }}
                      className={`px-3 py-1 rounded-lg text-xs font-bold transition ${
                        amount === String(q)
                          ? 'bg-teal-700 text-white shadow-xs'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      +₹{q}
                    </button>
                  ))}
                </div>
                {amountError && <p className="text-xs font-bold text-rose-600">{amountError}</p>}
              </div>

              {/* Step 2: Admin QR Code Box */}
              <div className="p-3.5 rounded-2xl bg-teal-50/60 dark:bg-teal-950/20 border border-teal-200/80 dark:border-teal-800/40 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-teal-900 dark:text-teal-200">
                    2. Scan & Make Payment
                  </span>
                  <span className="text-[10px] font-semibold text-teal-700 dark:text-teal-400 flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" /> Verified Admin QR
                  </span>
                </div>

                {loadingConfig ? (
                  <div className="py-8 flex flex-col items-center justify-center gap-2">
                    <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
                    <p className="text-xs text-slate-500">Loading payment QR code...</p>
                  </div>
                ) : configError ? (
                  <div className="p-3 rounded-xl bg-amber-50 text-amber-800 text-xs font-medium space-y-1">
                    <p className="font-bold flex items-center gap-1">
                      <AlertTriangle className="w-4 h-4 text-amber-600" /> Payment QR Notice
                    </p>
                    <p>{configError}</p>
                  </div>
                ) : qrConfig ? (
                  <div className="flex flex-col sm:flex-row items-center gap-3.5">
                    {/* QR Image */}
                    <div className="relative group shrink-0">
                      <img
                        src={qrConfig.qrImageUrl}
                        alt="UPI QR Code"
                        className="w-28 h-28 sm:w-32 sm:h-32 rounded-xl border border-slate-200 bg-white p-1.5 object-contain shadow-xs cursor-zoom-in"
                        onClick={() => setZoomQr(true)}
                      />
                      <button
                        type="button"
                        onClick={() => setZoomQr(true)}
                        className="absolute inset-0 bg-slate-900/30 rounded-xl opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white"
                        title="Click to zoom QR"
                      >
                        <ZoomIn className="w-4 h-4" />
                      </button>
                    </div>

                    {/* QR Details */}
                    <div className="space-y-1.5 text-xs flex-1 text-center sm:text-left">
                      <div>
                        <span className="text-slate-400 font-bold block text-[10px] uppercase">Beneficiary Name</span>
                        <p className="font-extrabold text-slate-900 dark:text-white text-xs sm:text-sm">{qrConfig.displayName}</p>
                      </div>

                      {qrConfig.upiId && (
                        <div>
                          <span className="text-slate-400 font-bold block text-[10px] uppercase">UPI ID</span>
                          <div className="flex items-center justify-center sm:justify-start gap-1.5 mt-0.5">
                            <code className="bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700 font-mono font-bold text-slate-800 dark:text-slate-200 text-xs select-all">
                              {qrConfig.upiId}
                            </code>
                            <button
                              type="button"
                              onClick={handleCopyUpi}
                              className="px-2 py-0.5 rounded bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-200 hover:bg-teal-200 transition font-bold flex items-center gap-1 text-[11px]"
                            >
                              {copiedUpi ? <Check className="w-3 h-3 text-emerald-700" /> : <Copy className="w-3 h-3" />}
                              {copiedUpi ? 'Copied' : 'Copy'}
                            </button>
                          </div>
                        </div>
                      )}

                      <p className="text-[11px] text-slate-500 leading-tight">
                        Scan with GPay, PhonePe, Paytm, or BHIM. Pay exactly{' '}
                        <strong className="text-slate-900 dark:text-white">{formatInr(amount || 0)}</strong>.
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Step 3: Enter UTR and Upload Screenshot */}
              <div className="space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 block">
                  3. Submit Transaction Proof
                </span>

                {/* UTR Input */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                    <span>
                      UTR / Transaction ID <span className="text-rose-600">*</span>
                    </span>
                    <span className="text-[10px] font-semibold text-slate-400">12-digit reference number</span>
                  </label>
                  <input
                    type="text"
                    value={utr}
                    onChange={(e) => {
                      setUtr(e.target.value)
                      if (utrError) setUtrError('')
                    }}
                    placeholder="e.g. 432109876543 or UPI reference ID"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-mono text-xs font-bold uppercase focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  />
                  {utrError && <p className="text-xs font-bold text-rose-600">{utrError}</p>}
                </div>

                {/* Screenshot Upload Dropzone */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                    Payment Screenshot / Receipt <span className="text-rose-600">*</span>
                  </label>

                  <div className="relative border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-teal-500 rounded-2xl p-3.5 transition text-center bg-slate-50/50 dark:bg-slate-800/40">
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />

                    {receiptPreview ? (
                      <div className="flex items-center justify-center gap-3">
                        <img src={receiptPreview} alt="Receipt preview" className="w-12 h-12 object-cover rounded-xl border" />
                        <div className="text-left">
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-xs">
                            {receiptFile?.name}
                          </p>
                          <p className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" /> Ready to submit
                          </p>
                          <span className="text-[10px] text-teal-700 underline font-semibold">Click to replace</span>
                        </div>
                      </div>
                    ) : receiptFile ? (
                      <div className="flex items-center justify-center gap-2 text-xs font-bold text-slate-700">
                        <FileText className="w-5 h-5 text-teal-600" />
                        <span>{receiptFile.name}</span>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Upload className="w-5 h-5 text-slate-400 mx-auto" />
                        <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
                          Click or drag receipt screenshot here
                        </p>
                        <p className="text-[10px] text-slate-400">JPG, PNG, WebP or PDF (Max 10MB)</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Optional Notes */}
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-600 dark:text-slate-400">Note for Admin (Optional)</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Paid via PhonePe from registered number"
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-medium"
                  />
                </div>

                {submitError && (
                  <div className="p-2.5 rounded-xl bg-rose-50 text-rose-800 text-xs font-semibold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Actions - Fixed and Always Visible Above Mobile Nav */}
            <div className="shrink-0 p-3 sm:p-4 pb-[max(1rem,env(safe-area-inset-bottom))] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-end gap-2.5 z-20 shadow-lg">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-100 transition active:scale-95 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs transition shadow-sm active:scale-95 disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    Submit Recharge Request
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* SUCCESS SCREEN */
          <div className="p-6 text-center space-y-4 overflow-y-auto">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>

            <div className="space-y-1">
              <h3 className="text-xl font-black text-slate-900 dark:text-white">Recharge Request Submitted!</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                Your wallet recharge request of{' '}
                <strong className="text-slate-900 dark:text-white font-black">{formatInr(amount)}</strong> has been
                submitted for administrator verification.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs space-y-2 max-w-md mx-auto text-left">
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <span className="inline-flex items-center gap-1 font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded text-[11px]">
                  <Clock className="w-3 h-3" /> PENDING ADMIN VERIFICATION
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">UTR / Ref:</span>
                <span className="font-mono font-bold text-slate-900 dark:text-white">{utr}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Requested Amount:</span>
                <span className="font-bold text-slate-900 dark:text-white">{formatInr(amount)}</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 max-w-md mx-auto">
              Your wallet balance will be credited as soon as our verification team approves your payment proof. You will
              receive a push notification once approved.
            </p>

            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-bold text-xs transition active:scale-95 shadow-sm"
            >
              Done & Return to Wallet
            </button>
          </div>
        )}
      </div>

      {/* Zoom QR Modal */}
      {zoomQr && qrConfig && (
        <div
          className="fixed inset-0 z-[10000] bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setZoomQr(false)}
        >
          <div className="bg-white p-4 rounded-2xl max-w-xs w-full space-y-3" onClick={(e) => e.stopPropagation()}>
            <img src={qrConfig.qrImageUrl} alt="QR Zoom" className="w-full aspect-square object-contain rounded-xl" />
            <p className="text-center font-bold text-xs text-slate-800">{qrConfig.displayName}</p>
            <button
              type="button"
              onClick={() => setZoomQr(false)}
              className="w-full py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent
}
