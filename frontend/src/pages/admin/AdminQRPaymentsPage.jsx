import { useEffect, useState, useMemo, useCallback } from 'react'
import {
  QrCode,
  Upload,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Search,
  Filter,
  Eye,
  RefreshCw,
  FileText,
  Check,
  Copy,
  ExternalLink,
  ShieldCheck,
  History,
  Sparkles,
  ArrowUpRight,
  User,
  Phone,
  Calendar,
  IndianRupee,
  Sliders,
  ChevronDown,
  X,
  Loader2,
  Power,
  Image as ImageIcon,
} from 'lucide-react'
import { adminQrPaymentsApi } from '../../api/adminQrPaymentsApi.js'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { useAuth } from '../../hooks/useAuth.js'

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

const PURPOSE_LABELS = {
  ALL: 'All Purposes (Global)',
  WALLET_TOPUP: 'Wallet Top-up',
  WALLET_CLEARANCE: 'Dues / Commission Clearance',
  SUBSCRIPTION: 'Vendor Subscription',
  TRIAL_PENALTY: 'Trial Penalty / Final Chance',
  BOOKING_COMMISSION: 'Booking Commission',
}

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: Clock },
  submitted: { label: 'Submitted (New)', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: Clock },
  under_review: { label: 'Under Review', color: 'bg-purple-50 text-purple-700 border-purple-200', icon: AlertTriangle },
  approved: { label: 'Approved', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 },
  rejected: { label: 'Rejected', color: 'bg-rose-50 text-rose-700 border-rose-200', icon: XCircle },
  cancelled: { label: 'Cancelled', color: 'bg-slate-50 text-slate-600 border-slate-200', icon: XCircle },
}

export function AdminQRPaymentsPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('config') // 'config' | 'verifications'

  // ==========================================
  // TAB 1: QR CONFIGURATION STATE
  // ==========================================
  const [configLoading, setConfigLoading] = useState(true)
  const [savingConfig, setSavingConfig] = useState(false)
  const [togglingStatus, setTogglingStatus] = useState(false)
  const [currentConfig, setCurrentConfig] = useState(null)
  const [configStats, setConfigStats] = useState(null)
  const [configFeedback, setConfigFeedback] = useState({ type: '', message: '' })
  const [showAuditModal, setShowAuditModal] = useState(false)

  // Form Fields
  const [displayName, setDisplayName] = useState('')
  const [upiId, setUpiId] = useState('')
  const [instructions, setInstructions] = useState('')
  const [selectedPurpose, setSelectedPurpose] = useState('ALL')
  const [qrFile, setQrFile] = useState(null)
  const [filePreview, setFilePreview] = useState(null)
  const [changeReason, setChangeReason] = useState('')

  // ==========================================
  // TAB 2: VERIFICATION & REVIEW STATE
  // ==========================================
  const [paymentsLoading, setPaymentsLoading] = useState(false)
  const [payments, setPayments] = useState([])
  const [paymentStats, setPaymentStats] = useState({
    total: 0,
    pendingCount: 0,
    submittedCount: 0,
    underReviewCount: 0,
    approvedCount: 0,
    rejectedCount: 0,
    totalApprovedAmount: 0,
  })

  // Review Filters
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [purposeFilter, setPurposeFilter] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  // Review Modal State
  const [selectedPayment, setSelectedPayment] = useState(null)
  const [reviewAction, setReviewAction] = useState(null) // 'approve' | 'reject'
  const [verifiedAmount, setVerifiedAmount] = useState('')
  const [bankReference, setBankReference] = useState('')
  const [rejectionReason, setRejectionReason] = useState('')
  const [reviewNotes, setReviewNotes] = useState('')
  const [submittingReview, setSubmittingReview] = useState(false)
  const [reviewFeedback, setReviewFeedback] = useState({ type: '', message: '' })

  // Receipt Preview Lightbox
  const [previewReceiptUrl, setPreviewReceiptUrl] = useState(null)

  // ==========================================
  // LOAD QR CONFIGURATION
  // ==========================================
  const loadConfig = useCallback(async () => {
    try {
      setConfigLoading(true)
      const res = await adminQrPaymentsApi.fetchAdminQrConfig(selectedPurpose)
      const cfg = res.data?.config
      setCurrentConfig(cfg)
      setConfigStats(res.data?.stats)

      if (cfg) {
        setDisplayName(cfg.displayName || '')
        setUpiId(cfg.upiId || '')
        setInstructions(cfg.instructions || '')
      } else {
        setDisplayName('A2Z Service Provider Operations')
        setUpiId('')
        setInstructions(
          'Scan this QR code using any UPI app (Google Pay, PhonePe, Paytm, BHIM, etc.). After making the payment, enter the 12-digit UTR / Reference Number below and upload the payment receipt for instant verification.'
        )
      }
      setQrFile(null)
      setFilePreview(null)
      setChangeReason('')
    } catch (err) {
      setConfigFeedback({ type: 'error', message: err.message || 'Failed to load QR configuration' })
    } finally {
      setConfigLoading(false)
    }
  }, [selectedPurpose])

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  // ==========================================
  // LOAD PAYMENTS FOR REVIEW
  // ==========================================
  const loadPayments = useCallback(async () => {
    try {
      setPaymentsLoading(true)
      const params = {
        page,
        limit: 15,
      }
      if (statusFilter && statusFilter !== 'ALL') params.status = statusFilter
      if (purposeFilter && purposeFilter !== 'ALL') params.purpose = purposeFilter
      if (searchQuery.trim()) params.search = searchQuery.trim()
      if (startDate) params.startDate = startDate
      if (endDate) params.endDate = endDate

      const res = await adminQrPaymentsApi.fetchAdminProviderPayments(params)
      setPayments(res.data?.payments || [])
      setPaymentStats(res.data?.stats || {})
      setTotalPages(res.data?.pagination?.totalPages || 1)
    } catch (err) {
      setReviewFeedback({ type: 'error', message: err.message || 'Failed to load payments' })
    } finally {
      setPaymentsLoading(false)
    }
  }, [statusFilter, purposeFilter, searchQuery, startDate, endDate, page])

  useEffect(() => {
    if (activeTab === 'verifications') {
      loadPayments()
    }
  }, [activeTab, loadPayments])

  // File selection
  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setConfigFeedback({ type: 'error', message: 'Please upload a PNG, JPEG, or WebP image file.' })
      return
    }

    if (file.size > 8 * 1024 * 1024) {
      setConfigFeedback({ type: 'error', message: 'QR image must be under 8MB in size.' })
      return
    }

    setQrFile(file)
    setFilePreview(URL.createObjectURL(file))
    setConfigFeedback({ type: '', message: '' })
  }

  // Handle Save QR Config
  const handleSaveConfig = async (e) => {
    e.preventDefault()
    if (!displayName.trim()) {
      setConfigFeedback({ type: 'error', message: 'Display name is required.' })
      return
    }

    if (!currentConfig && !qrFile) {
      setConfigFeedback({ type: 'error', message: 'Please upload a payment QR code image.' })
      return
    }

    setSavingConfig(true)
    setConfigFeedback({ type: '', message: '' })

    try {
      const fd = new FormData()
      fd.append('displayName', displayName.trim())
      fd.append('upiId', upiId.trim())
      fd.append('instructions', instructions.trim())
      fd.append('paymentPurpose', selectedPurpose)
      if (currentConfig?.version) {
        fd.append('expectedVersion', String(currentConfig.version))
      }
      if (changeReason.trim()) {
        fd.append('changeReason', changeReason.trim())
      }
      if (qrFile) {
        fd.append('qrImage', qrFile)
      }

      const res = await adminQrPaymentsApi.updateAdminQrConfig(fd, true)
      setConfigFeedback({ type: 'success', message: res.message || 'QR configuration saved and broadcasted successfully!' })
      await loadConfig()
      setTimeout(() => setConfigFeedback({ type: '', message: '' }), 5000)
    } catch (err) {
      setConfigFeedback({ type: 'error', message: err.message || 'Failed to save configuration.' })
    } finally {
      setSavingConfig(false)
    }
  }

  // Toggle Active/Inactive Status
  const handleToggleStatus = async () => {
    if (!currentConfig) return
    const nextState = !currentConfig.isActive
    const promptMsg = nextState
      ? 'Are you sure you want to ACTIVATE this payment QR? Service providers will immediately see and pay using this QR code.'
      : 'Are you sure you want to DEACTIVATE this payment QR? Service providers will not be able to initiate UPI QR payments until re-activated.'

    if (!window.confirm(promptMsg)) return

    setTogglingStatus(true)
    try {
      const res = await adminQrPaymentsApi.toggleQrConfigStatus(nextState, `Admin toggled status via control panel`)
      setCurrentConfig((prev) => ({ ...prev, isActive: nextState }))
      setConfigFeedback({
        type: 'success',
        message: res.message || `QR payment status updated to ${nextState ? 'ACTIVE' : 'INACTIVE'}!`,
      })
      setTimeout(() => setConfigFeedback({ type: '', message: '' }), 5000)
    } catch (err) {
      setConfigFeedback({ type: 'error', message: err.message || 'Failed to update status' })
    } finally {
      setTogglingStatus(false)
    }
  }

  // Open Review Dialog
  const handleOpenReview = (payment, action = 'approve') => {
    setSelectedPayment(payment)
    setReviewAction(action)
    setVerifiedAmount(String(payment.amount || ''))
    setBankReference('')
    setRejectionReason('')
    setReviewNotes('')
    setReviewFeedback({ type: '', message: '' })
  }

  // Submit Review Decision
  const handleExecuteReview = async () => {
    if (!selectedPayment) return

    if (reviewAction === 'reject' && !rejectionReason.trim()) {
      setReviewFeedback({ type: 'error', message: 'A rejection reason is required so the provider knows what to correct.' })
      return
    }

    if (reviewAction === 'approve') {
      const amt = Number(verifiedAmount)
      if (isNaN(amt) || amt <= 0) {
        setReviewFeedback({ type: 'error', message: 'Verified amount must be a positive number.' })
        return
      }

      const confirmMsg = `CONFIRM APPROVAL:\n\nAre you sure you have verified the receipt of ₹${amt} in the bank / UPI account?\n\nThis will immediately execute the financial action (e.g. Wallet Credit of ₹${amt}) for ${selectedPayment.providerId?.fullName || 'the provider'}.`
      if (!window.confirm(confirmMsg)) return
    }

    setSubmittingReview(true)
    setReviewFeedback({ type: '', message: '' })

    try {
      const payload = {
        decision: reviewAction,
        verifiedAmount: Number(verifiedAmount) || selectedPayment.amount,
        bankReference: bankReference.trim(),
        rejectionReason: rejectionReason.trim(),
        notes: reviewNotes.trim(),
      }

      const res = await adminQrPaymentsApi.reviewProviderPayment(selectedPayment._id, payload)
      setReviewFeedback({
        type: 'success',
        message: res.message || `Payment ${reviewAction === 'approve' ? 'approved and credited' : 'rejected'} successfully!`,
      })

      // Refresh payments list and close modal after short delay
      setTimeout(() => {
        setSelectedPayment(null)
        loadPayments()
      }, 1200)
    } catch (err) {
      setReviewFeedback({ type: 'error', message: err.message || 'Payment review action failed.' })
    } finally {
      setSubmittingReview(false)
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4 md:p-6 lg:p-8 animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-linear-to-tr from-[#015F6C] to-[#01C7D0] text-white shadow-md">
              <QrCode className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-slate-900">
                Admin QR Payment Management & Verification
              </h1>
              <p className="text-sm text-slate-500">
                Configure official UPI QR codes, publish real-time payment coordinates, and manually verify service provider transfers.
              </p>
            </div>
          </div>
        </div>

        {/* Global Tab Switcher */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('config')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all ${
              activeTab === 'config'
                ? 'bg-white text-[#015F6C] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sliders className="h-4 w-4" />
            QR Configuration
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('verifications')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all relative ${
              activeTab === 'verifications'
                ? 'bg-white text-[#015F6C] shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShieldCheck className="h-4 w-4" />
            Payment Verifications
            {paymentStats.submittedCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] font-black rounded-full bg-amber-500 text-white animate-pulse">
                {paymentStats.submittedCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: QR CONFIGURATION                                                  */}
      {/* ========================================================================= */}
      {activeTab === 'config' && (
        <div className="space-y-6">
          {/* Feedback banner */}
          {configFeedback.message && (
            <div
              className={`p-4 rounded-xl border flex items-center justify-between gap-3 ${
                configFeedback.type === 'error'
                  ? 'bg-rose-50 border-rose-200 text-rose-800'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-800'
              }`}
            >
              <div className="flex items-center gap-2 text-sm font-semibold">
                {configFeedback.type === 'error' ? <AlertTriangle className="h-5 w-5 shrink-0" /> : <CheckCircle2 className="h-5 w-5 shrink-0" />}
                {configFeedback.message}
              </div>
              <button
                type="button"
                onClick={() => setConfigFeedback({ type: '', message: '' })}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase text-slate-500">Publish Status</p>
                <div className="mt-1 flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-black ${
                      currentConfig?.isActive
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        currentConfig?.isActive ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                      }`}
                    />
                    {currentConfig?.isActive ? 'Active (Live in App)' : 'Deactivated'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                disabled={togglingStatus || !currentConfig}
                onClick={handleToggleStatus}
                className={`p-2.5 rounded-xl border text-xs font-bold transition flex items-center gap-1 ${
                  currentConfig?.isActive
                    ? 'border-rose-200 text-rose-700 bg-rose-50 hover:bg-rose-100'
                    : 'border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                }`}
                title={currentConfig?.isActive ? 'Deactivate QR payments' : 'Activate QR payments'}
              >
                <Power className="h-4 w-4" />
                {currentConfig?.isActive ? 'Deactivate' : 'Activate'}
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <p className="text-xs font-semibold uppercase text-slate-500">Configuration Version</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-slate-800">
                  v{currentConfig?.version || 1}
                </span>
                <span className="text-xs text-slate-400">
                  {currentConfig?.auditLog?.length || 0} historical changes
                </span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <p className="text-xs font-semibold uppercase text-slate-500">Total QR Submissions</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-[#015F6C]">
                  {configStats?.totalSubmissions || 0}
                </span>
                <span className="text-xs text-slate-400">payments linked</span>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
              <p className="text-xs font-semibold uppercase text-slate-500">Verified Revenue</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-2xl font-black text-emerald-600">
                  {formatInr(configStats?.totalApprovedAmount || 0)}
                </span>
              </div>
            </div>
          </div>

          {/* Main Configuration Card */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column: Live QR Preview & Metadata */}
            <div className="lg:col-span-5 space-y-6">
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 text-center space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                    Live Provider View
                  </span>
                  <span className="text-xs font-semibold text-slate-500 flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    v{currentConfig?.version || 1}
                  </span>
                </div>

                {/* QR Display */}
                <div className="relative mx-auto w-64 h-64 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center overflow-hidden p-3 shadow-inner group">
                  {filePreview ? (
                    <div className="relative w-full h-full">
                      <img
                        src={filePreview}
                        alt="New QR Preview"
                        className="w-full h-full object-contain"
                      />
                      <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-600 text-white shadow-xs">
                        New (Unpublished)
                      </span>
                    </div>
                  ) : currentConfig?.qrImageUrl ? (
                    <div className="relative w-full h-full flex items-center justify-center">
                      <img
                        src={currentConfig.qrImageUrl}
                        alt="Current QR Code"
                        className="w-full h-full object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => setPreviewReceiptUrl(currentConfig.qrImageUrl)}
                        className="absolute inset-0 bg-slate-950/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity rounded-xl font-bold text-xs gap-1.5"
                      >
                        <Eye className="h-4 w-4" />
                        Click to Zoom
                      </button>
                    </div>
                  ) : (
                    <div className="text-center p-4 text-slate-400 space-y-2">
                      <QrCode className="h-12 w-12 mx-auto stroke-1 text-slate-300" />
                      <p className="text-xs font-medium">No QR code uploaded yet</p>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <h3 className="font-extrabold text-slate-800 text-base">
                    {displayName || 'Account Name Display'}
                  </h3>
                  {upiId ? (
                    <p className="text-xs font-mono font-semibold text-[#015F6C] bg-cyan-50 px-2.5 py-1 rounded-lg inline-block">
                      {upiId}
                    </p>
                  ) : (
                    <p className="text-xs text-slate-400 italic">No UPI ID configured</p>
                  )}
                </div>

                {/* Last update attribution */}
                {currentConfig && (
                  <div className="text-left text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-100 space-y-1 text-slate-500">
                    <p>
                      <strong className="text-slate-700">Last Updated:</strong>{' '}
                      {formatDate(currentConfig.updatedAt)}
                    </p>
                    <p>
                      <strong className="text-slate-700">Updated By:</strong>{' '}
                      {currentConfig.updatedBy?.fullName || currentConfig.updatedBy?.email || 'Administrator'}
                    </p>
                    {currentConfig.auditLog?.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowAuditModal(true)}
                        className="mt-2 text-[#015F6C] font-bold hover:underline flex items-center gap-1 text-xs"
                      >
                        <History className="h-3.5 w-3.5" />
                        View Version Audit Trail ({currentConfig.auditLog.length})
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Edit / Upload Form */}
            <div className="lg:col-span-7">
              <form onSubmit={handleSaveConfig} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-6">
                <div>
                  <h2 className="text-lg font-black text-slate-800">Edit Payment Coordinates</h2>
                  <p className="text-xs text-slate-500">
                    These settings are shown directly to service providers whenever they top up their wallet or clear dues via UPI.
                  </p>
                </div>

                {/* Upload QR Image Box */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    {currentConfig?.qrImageUrl ? 'Replace Payment QR Image' : 'Upload Payment QR Image'}
                  </label>
                  <div className="relative border-2 border-dashed border-slate-300 hover:border-[#015F6C] transition-colors rounded-2xl p-6 text-center cursor-pointer bg-slate-50/50">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <Upload className="h-8 w-8 mx-auto text-[#015F6C] mb-2" />
                    <p className="text-xs font-bold text-slate-700">
                      {qrFile ? qrFile.name : 'Click to select or drag and drop QR code image'}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">PNG, JPG, or WebP up to 8MB</p>
                  </div>
                  {qrFile && (
                    <p className="text-xs text-blue-600 font-semibold flex items-center gap-1">
                      <Sparkles className="h-3.5 w-3.5" /> Selected new file: {qrFile.name} ({(qrFile.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                </div>

                {/* Account Display Name */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Payment Account Display Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. A2Z Services Operations / Labour Chowck"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#015F6C]/20 focus:border-[#015F6C] font-semibold text-slate-800"
                  />
                  <p className="text-[11px] text-slate-400">
                    The business or account name the provider will verify in their UPI app before paying.
                  </p>
                </div>

                {/* UPI ID */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    UPI ID / VPA <span className="text-slate-400 font-normal">(Optional for direct copy-paste)</span>
                  </label>
                  <input
                    type="text"
                    maxLength={100}
                    value={upiId}
                    onChange={(e) => setUpiId(e.target.value)}
                    placeholder="e.g. a2zservices@okicici or 9876543210@paytm"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#015F6C]/20 focus:border-[#015F6C] font-mono text-slate-800"
                  />
                  <p className="text-[11px] text-slate-400">
                    Provides a convenient 1-tap &quot;Copy UPI ID&quot; button for providers on mobile devices.
                  </p>
                </div>

                {/* Payment Instructions */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Payment Instructions for Service Providers
                  </label>
                  <textarea
                    rows={4}
                    maxLength={800}
                    value={instructions}
                    onChange={(e) => setInstructions(e.target.value)}
                    placeholder="Provide clear steps for scanning, entering reference number, and uploading proof..."
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#015F6C]/20 focus:border-[#015F6C] text-slate-700"
                  />
                </div>

                {/* Change Reason / Audit Note */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Change Summary / Reason <span className="text-slate-400 font-normal">(Recorded in audit log)</span>
                  </label>
                  <input
                    type="text"
                    maxLength={200}
                    value={changeReason}
                    onChange={(e) => setChangeReason(e.target.value)}
                    placeholder="e.g. Switched to new ICICI Current Account QR code"
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#015F6C]/20 focus:border-[#015F6C] text-slate-700"
                  />
                </div>

                {/* Buttons */}
                <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={loadConfig}
                    disabled={savingConfig}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                  >
                    Reset Changes
                  </button>
                  <button
                    type="submit"
                    disabled={savingConfig}
                    className="px-6 py-2.5 rounded-xl bg-[#015F6C] hover:bg-[#014d57] text-white text-xs font-extrabold shadow-sm transition flex items-center gap-2 disabled:opacity-60"
                  >
                    {savingConfig ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Saving & Uploading...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        Publish QR Configuration
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PAYMENT VERIFICATIONS & REVIEW DASHBOARD                           */}
      {/* ========================================================================= */}
      {activeTab === 'verifications' && (
        <div className="space-y-6">
          {/* Review Stats Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
              <p className="text-[11px] font-bold uppercase text-slate-400">Total Submissions</p>
              <p className="text-2xl font-black text-slate-800 mt-1">{paymentStats.total || 0}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-amber-200 bg-amber-50/20 shadow-xs">
              <p className="text-[11px] font-bold uppercase text-amber-700">Pending Review</p>
              <div className="flex items-baseline gap-1 mt-1">
                <p className="text-2xl font-black text-amber-600">
                  {(paymentStats.submittedCount || 0) + (paymentStats.pendingCount || 0) + (paymentStats.underReviewCount || 0)}
                </p>
                <span className="text-[10px] font-semibold text-amber-600">action required</span>
              </div>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-emerald-200 bg-emerald-50/20 shadow-xs">
              <p className="text-[11px] font-bold uppercase text-emerald-700">Approved Payments</p>
              <p className="text-2xl font-black text-emerald-600 mt-1">{paymentStats.approvedCount || 0}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-rose-200 bg-rose-50/20 shadow-xs">
              <p className="text-[11px] font-bold uppercase text-rose-700">Rejected Payments</p>
              <p className="text-2xl font-black text-rose-600 mt-1">{paymentStats.rejectedCount || 0}</p>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-cyan-200 bg-cyan-50/20 shadow-xs col-span-2 lg:col-span-1">
              <p className="text-[11px] font-bold uppercase text-cyan-800">Total Revenue Verified</p>
              <p className="text-xl font-black text-[#015F6C] mt-1">{formatInr(paymentStats.totalApprovedAmount || 0)}</p>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by provider name, phone, UTR..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#015F6C]"
                />
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#015F6C] bg-white font-medium"
              >
                <option value="ALL">All Statuses</option>
                <option value="submitted">Submitted (Pending Action)</option>
                <option value="under_review">Under Review</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="pending">Pending Submission</option>
              </select>

              {/* Purpose Filter */}
              <select
                value={purposeFilter}
                onChange={(e) => setPurposeFilter(e.target.value)}
                className="px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-1 focus:ring-[#015F6C] bg-white font-medium"
              >
                <option value="ALL">All Purposes</option>
                <option value="WALLET_TOPUP">Wallet Top-up</option>
                <option value="WALLET_CLEARANCE">Dues Clearance</option>
                <option value="SUBSCRIPTION">Subscription</option>
                <option value="TRIAL_PENALTY">Trial Penalty</option>
              </select>

              {/* Refresh Button */}
              <button
                type="button"
                onClick={loadPayments}
                disabled={paymentsLoading}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition flex items-center justify-center gap-1.5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${paymentsLoading ? 'animate-spin' : ''}`} />
                Refresh Data
              </button>
            </div>
          </div>

          {/* Submissions Table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="py-3 px-4">Provider Details</th>
                    <th className="py-3 px-4">Purpose</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">UTR / Ref No.</th>
                    <th className="py-3 px-4">Proof Receipt</th>
                    <th className="py-3 px-4">Submitted At</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paymentsLoading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-[#015F6C]" />
                        Loading payment submissions...
                      </td>
                    </tr>
                  ) : payments.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-slate-400">
                        <FileText className="h-8 w-8 mx-auto mb-2 text-slate-300 stroke-1" />
                        No payments found matching the current filters.
                      </td>
                    </tr>
                  ) : (
                    payments.map((p) => {
                      const st = STATUS_CONFIG[p.status] || STATUS_CONFIG.pending
                      const StIcon = st.icon

                      return (
                        <tr key={p._id} className="hover:bg-slate-50/70 transition">
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-xs shrink-0 overflow-hidden">
                                {p.providerId?.avatar ? (
                                  <img src={p.providerId.avatar} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  p.providerId?.fullName?.[0]?.toUpperCase() || 'P'
                                )}
                              </div>
                              <div>
                                <p className="font-extrabold text-slate-800">
                                  {p.providerId?.fullName || 'Provider'}
                                </p>
                                <p className="text-[11px] text-slate-400">{p.providerId?.phone || '—'}</p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-semibold text-slate-700">
                            {PURPOSE_LABELS[p.purpose] || p.purpose}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="font-black text-slate-900 text-sm">{formatInr(p.amount)}</span>
                            {p.paymentVerificationDetails?.verifiedAmount && p.paymentVerificationDetails.verifiedAmount !== p.amount && (
                              <p className="text-[10px] text-emerald-600 font-bold">
                                Verified: {formatInr(p.paymentVerificationDetails.verifiedAmount)}
                              </p>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            {p.utr ? (
                              <span className="font-mono font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-800 text-[11px]">
                                {p.utr}
                              </span>
                            ) : (
                              <span className="text-slate-400 italic">Not submitted</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4">
                            {p.receiptUrl ? (
                              <button
                                type="button"
                                onClick={() => setPreviewReceiptUrl(p.receiptUrl)}
                                className="group relative w-9 h-9 rounded-lg border border-slate-200 overflow-hidden bg-slate-100 inline-flex items-center justify-center hover:ring-2 hover:ring-[#015F6C]"
                                title="View Receipt Screenshot"
                              >
                                {p.receiptUrl.endsWith('.pdf') ? (
                                  <FileText className="h-5 w-5 text-red-500" />
                                ) : (
                                  <img src={p.receiptUrl} alt="Receipt" className="w-full h-full object-cover" />
                                )}
                              </button>
                            ) : (
                              <span className="text-slate-400 italic">No receipt</span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 text-[11px]">{formatDate(p.createdAt)}</td>
                          <td className="py-3.5 px-4">
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-bold ${st.color}`}>
                              <StIcon className="h-3 w-3" />
                              {st.label}
                            </span>
                            {p.rejectionReason && (
                              <p className="text-[10px] text-rose-600 mt-0.5 max-w-[140px] truncate" title={p.rejectionReason}>
                                Reason: {p.rejectionReason}
                              </p>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            {p.status === 'approved' ? (
                              <span className="text-[11px] font-bold text-emerald-600 flex items-center justify-end gap-1">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Credited
                              </span>
                            ) : (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenReview(p, 'approve')}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs shadow-xs transition"
                                >
                                  Approve
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenReview(p, 'reject')}
                                  className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg font-bold text-xs transition"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span>Page {page} of {totalPages}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="px-3 py-1.5 border rounded-lg hover:bg-slate-50 disabled:opacity-40 font-semibold"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="px-3 py-1.5 border rounded-lg hover:bg-slate-50 disabled:opacity-40 font-semibold"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* REVIEW & APPROVAL MODAL                                                   */}
      {/* ========================================================================= */}
      {selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className={`p-5 border-b flex items-center justify-between ${
              reviewAction === 'approve' ? 'bg-emerald-50/70 border-emerald-100' : 'bg-rose-50/70 border-rose-100'
            }`}>
              <div className="flex items-center gap-2.5">
                {reviewAction === 'approve' ? (
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                ) : (
                  <XCircle className="h-6 w-6 text-rose-600" />
                )}
                <div>
                  <h3 className="text-base font-extrabold text-slate-800">
                    {reviewAction === 'approve' ? 'Approve & Credit Payment' : 'Reject Payment Submission'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Payment ID: #{String(selectedPayment._id).slice(-6).toUpperCase()}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPayment(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {reviewFeedback.message && (
                <div className={`p-3 rounded-xl text-xs font-semibold ${
                  reviewFeedback.type === 'error' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-emerald-50 text-emerald-700'
                }`}>
                  {reviewFeedback.message}
                </div>
              )}

              {/* Provider Summary Card */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Service Provider:</span>
                  <span className="font-extrabold text-slate-800">{selectedPayment.providerId?.fullName} ({selectedPayment.providerId?.phone})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Purpose:</span>
                  <span className="font-bold text-slate-800">{PURPOSE_LABELS[selectedPayment.purpose] || selectedPayment.purpose}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Declared Amount:</span>
                  <span className="font-black text-slate-900 text-sm">{formatInr(selectedPayment.amount)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Submitted UTR:</span>
                  <span className="font-mono font-bold bg-white px-2 py-0.5 rounded border text-slate-800">
                    {selectedPayment.utr || 'N/A'}
                  </span>
                </div>
              </div>

              {/* Receipt Preview Thumbnail */}
              {selectedPayment.receiptUrl && (
                <div className="space-y-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Uploaded Payment Receipt Proof
                  </label>
                  <div
                    onClick={() => setPreviewReceiptUrl(selectedPayment.receiptUrl)}
                    className="relative h-32 rounded-xl overflow-hidden border border-slate-200 cursor-pointer group bg-slate-100 flex items-center justify-center"
                  >
                    <img
                      src={selectedPayment.receiptUrl}
                      alt="Receipt Proof"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                    <div className="absolute inset-0 bg-slate-950/40 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity font-bold text-xs gap-1">
                      <Eye className="h-4 w-4" /> Click to View Fullscreen
                    </div>
                  </div>
                </div>
              )}

              {/* Approval Fields */}
              {reviewAction === 'approve' && (
                <>
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Verified Amount Received (INR) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <IndianRupee className="h-4 w-4 absolute left-3 top-3 text-slate-400" />
                      <input
                        type="number"
                        min="1"
                        step="any"
                        value={verifiedAmount}
                        onChange={(e) => setVerifiedAmount(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 text-sm font-extrabold rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                      />
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Match against your bank account statement. This exact amount will be credited to the provider&apos;s wallet.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Bank Settlement Ref / Transaction ID
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. HDFC-IMPS-9382104"
                      value={bankReference}
                      onChange={(e) => setBankReference(e.target.value)}
                      className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#015F6C]/20"
                    />
                  </div>
                </>
              )}

              {/* Rejection Fields */}
              {reviewAction === 'reject' && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold uppercase tracking-wider text-rose-700">
                    Rejection Reason <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={3}
                    required
                    placeholder="e.g. UTR number not found in bank statement, amount mismatch, or illegible receipt. Please double check and resubmit."
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-rose-300 focus:outline-none focus:ring-2 focus:ring-rose-400/20 text-slate-800"
                  />
                  <p className="text-[11px] text-slate-400">
                    This reason is sent via notification and displayed to the service provider with a safe resubmit option.
                  </p>
                </div>
              )}

              {/* Review Notes */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Internal Verification Notes <span className="text-slate-400 font-normal">(Admin only)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Verified by phone with accountant"
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#015F6C]/20 text-slate-700"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedPayment(null)}
                disabled={submittingReview}
                className="px-4 py-2 border rounded-xl text-xs font-bold text-slate-600 hover:bg-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteReview}
                disabled={submittingReview}
                className={`px-5 py-2 rounded-xl text-xs font-extrabold text-white shadow-xs transition flex items-center gap-1.5 ${
                  reviewAction === 'approve'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {submittingReview ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : reviewAction === 'approve' ? (
                  <>
                    <Check className="h-4 w-4" />
                    Confirm & Credit Wallet
                  </>
                ) : (
                  <>
                    <X className="h-4 w-4" />
                    Confirm Rejection
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* RECEIPT / QR LIGHTBOX MODAL                                               */}
      {/* ========================================================================= */}
      {previewReceiptUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in"
          onClick={() => setPreviewReceiptUrl(null)}
        >
          <div
            className="relative max-w-2xl max-h-[90vh] bg-white rounded-3xl p-3 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setPreviewReceiptUrl(null)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-slate-900/70 text-white hover:bg-slate-900 transition"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={previewReceiptUrl}
              alt="Preview"
              className="w-full h-auto max-h-[82vh] object-contain rounded-2xl"
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* AUDIT TRAIL MODAL                                                         */}
      {/* ========================================================================= */}
      {showAuditModal && currentConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-[#015F6C]" />
                <h3 className="font-extrabold text-slate-800 text-sm">QR Code Version History & Audit Log</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAuditModal(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-5 space-y-3 max-h-[65vh] overflow-y-auto">
              {(currentConfig.auditLog || [])
                .slice()
                .reverse()
                .map((log, idx) => (
                  <div key={idx} className="p-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 space-y-2 text-xs">
                    <div className="flex items-center justify-between font-bold">
                      <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px]">
                        Version {log.version}
                      </span>
                      <span className="text-slate-400 text-[11px]">{formatDate(log.changedAt)}</span>
                    </div>
                    <p className="font-semibold text-slate-800">
                      Action: <span className="text-[#015F6C]">{log.action || 'UPDATED'}</span>
                    </p>
                    {log.reason && (
                      <p className="text-slate-600">
                        Reason: <em>&quot;{log.reason}&quot;</em>
                      </p>
                    )}
                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-100">
                      <span>Name: {log.displayName}</span>
                      <span>By: {log.updatedBy?.fullName || 'Admin'}</span>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default AdminQRPaymentsPage
