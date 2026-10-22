import { useState, useId, useEffect, useRef } from 'react'
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
  MapPin,
  Truck,
  History,
  Send,
  FileText,
  ShieldCheck,
  Calendar,
  Building2,
  Phone,
  User as UserIcon,
  Upload,
  Sparkles,
  RefreshCw,
  Image as ImageIcon,
} from 'lucide-react'
import {
  updatePartnerWelcomeKit,
  verifyPartnerWelcomeKitPayment,
  requestPartnerAddressCorrection,
  confirmPartnerWelcomeKitAddress,
  dispatchPartnerWelcomeKit,
  confirmPartnerWelcomeKitDeliveryAdmin,
} from '../../../api/servicePartnerApi.js'
import { fetchAdminUserById } from '../../../api/adminUsersApi.js'
import { uploadMedia } from '../../../api/uploadApi.js'
import { UPLOAD_FOLDERS } from '../../../constants/uploadFolders.js'
import { KitStatusBadge, getKitStatusDerived } from './KitStatusBadge.jsx'

const SAMPLE_SLIP_URL =
  'https://res.cloudinary.com/tvtogzo3/image/upload/v1792661202/A2Z/general-media/6ad2103d6862c25f09edc6f2/1792661201054-28c64558a120-scaled-207623.jpg'

const COMMON_REJECTION_REASONS = [
  'Screenshot is blurry or unreadable',
  'Incorrect payment amount (₹999 required)',
  'UTR / Transaction ID not visible or invalid',
  'Duplicate receipt or previously used screenshot',
  'Payment not credited to company bank account',
]

const COMMON_ADDRESS_CORRECTION_REASONS = [
  'Incomplete house/flat number or missing building name',
  'Invalid 6-digit Indian PIN code for this city',
  'Recipient mobile number is incorrect or unreachable',
  'Missing street name or landmark for courier delivery',
  'Service area outside current delivery zone',
]

export function WelcomeKitModal({ user, onClose, onSuccess }) {
  const [activeTab, setActiveTab] = useState('verification') // 'verification' | 'address' | 'dispatch' | 'delivery' | 'audit'
  const [currentKit, setCurrentKit] = useState(user?.welcomeKit || {})
  const [uniformIssued, setUniformIssued] = useState(Boolean(user?.welcomeKit?.uniformIssued))
  const [idCardIssued, setIdCardIssued] = useState(Boolean(user?.welcomeKit?.idCardIssued))
  const [bagIssued, setBagIssued] = useState(Boolean(user?.welcomeKit?.bagIssued))

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  // Payment Verification State
  const fileInputRef = useRef(null)
  const [uploadingSlip, setUploadingSlip] = useState(false)
  const [fetchingFresh, setFetchingFresh] = useState(false)
  const [paymentActionBusy, setPaymentActionBusy] = useState(false)
  const [showRejectForm, setShowRejectForm] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [customRejectionNote, setCustomRejectionNote] = useState('')
  const [showFullReceipt, setShowFullReceipt] = useState(false)

  // Address Review & Correction State
  const [showCorrectionForm, setShowCorrectionForm] = useState(false)
  const [correctionReason, setCorrectionReason] = useState('')
  const [customCorrectionReason, setCustomCorrectionReason] = useState('')
  const [addressActionBusy, setAddressActionBusy] = useState(false)

  // Dispatch Form State
  const [dispatchCourierName, setDispatchCourierName] = useState(currentKit?.dispatch?.courierName || '')
  const [dispatchTrackingNumber, setDispatchTrackingNumber] = useState(currentKit?.dispatch?.trackingNumber || '')
  const [dispatchTrackingUrl, setDispatchTrackingUrl] = useState(currentKit?.dispatch?.trackingUrl || '')
  const [dispatchDate, setDispatchDate] = useState(
    currentKit?.dispatch?.dispatchDate
      ? new Date(currentKit.dispatch.dispatchDate).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10)
  )
  const [estimatedDeliveryDate, setEstimatedDeliveryDate] = useState(
    currentKit?.dispatch?.estimatedDeliveryDate
      ? new Date(currentKit.dispatch.estimatedDeliveryDate).toISOString().slice(0, 10)
      : ''
  )
  const [dispatchNotes, setDispatchNotes] = useState(currentKit?.dispatch?.notes || '')
  const [dispatchActionBusy, setDispatchActionBusy] = useState(false)

  // Delivery Confirmation State
  const [showDeliveryConfirmDialog, setShowDeliveryConfirmDialog] = useState(false)
  const [deliveryActionBusy, setDeliveryActionBusy] = useState(false)

  // Synchronize state when user prop updates
  useEffect(() => {
    if (user?.welcomeKit) {
      setCurrentKit(user.welcomeKit)
      setUniformIssued(Boolean(user.welcomeKit.uniformIssued))
      setIdCardIssued(Boolean(user.welcomeKit.idCardIssued))
      setBagIssued(Boolean(user.welcomeKit.bagIssued))
      if (user.welcomeKit.dispatch) {
        setDispatchCourierName(user.welcomeKit.dispatch.courierName || '')
        setDispatchTrackingNumber(user.welcomeKit.dispatch.trackingNumber || '')
        setDispatchTrackingUrl(user.welcomeKit.dispatch.trackingUrl || '')
      }
    }
  }, [user])

  // Always fetch latest data on modal mount so fresh DB receipts are immediately visible
  async function refreshUserData() {
    if (!user?._id) return
    setFetchingFresh(true)
    try {
      const freshUser = await fetchAdminUserById(user._id)
      if (freshUser?.welcomeKit) {
        setCurrentKit(freshUser.welcomeKit)
        setUniformIssued(Boolean(freshUser.welcomeKit.uniformIssued))
        setIdCardIssued(Boolean(freshUser.welcomeKit.idCardIssued))
        setBagIssued(Boolean(freshUser.welcomeKit.bagIssued))
        if (freshUser.welcomeKit.dispatch) {
          setDispatchCourierName(freshUser.welcomeKit.dispatch.courierName || '')
          setDispatchTrackingNumber(freshUser.welcomeKit.dispatch.trackingNumber || '')
          setDispatchTrackingUrl(freshUser.welcomeKit.dispatch.trackingUrl || '')
        }
      }
    } catch (err) {
      console.warn('Could not refresh partner data in modal:', err)
    } finally {
      setFetchingFresh(false)
    }
  }

  useEffect(() => {
    refreshUserData()
  }, [user?._id])

  if (!user) return null

  const tempKit = { ...currentKit, uniformIssued, idCardIssued, bagIssued }
  const derivedStatus = getKitStatusDerived(tempKit)
  const existingIssuedAt = currentKit?.issuedAt

  const paymentStatus = currentKit?.status || 'PENDING_PAYMENT'
  const isPaymentApproved = ['PAID', 'READY_FOR_DISPATCH', 'DISPATCHED', 'DELIVERED'].includes(paymentStatus)
  const receiptUrl = currentKit?.paymentReceiptUrl

  const address = currentKit?.address
  const addressStatus = address?.status || 'NOT_SUBMITTED'
  const isAddressSubmitted = Boolean(address?.recipientName && addressStatus !== 'NOT_SUBMITTED')
  const isAddressConfirmed = addressStatus === 'CONFIRMED' || paymentStatus === 'READY_FOR_DISPATCH'

  const isDispatched = paymentStatus === 'DISPATCHED' || Boolean(currentKit?.dispatch?.courierName)
  const isDelivered = paymentStatus === 'DELIVERED' || Boolean(currentKit?.deliveryConfirmation?.isConfirmed)

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
    } catch (err) {
      setError(err?.message || 'Failed to update welcome kit status')
    } finally {
      setBusy(false)
    }
  }

  // Upload or replace payment slip on partner's behalf
  async function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setError(null)
    setSuccessMsg(null)
    setUploadingSlip(true)
    try {
      const uploadedUrl = await uploadMedia(file, UPLOAD_FOLDERS.GENERAL_MEDIA || 'general-media')
      if (!uploadedUrl) {
        throw new Error('Failed to obtain image URL from upload service')
      }

      const res = await verifyPartnerWelcomeKitPayment(user._id, {
        action: 'ATTACH_SLIP',
        paymentReceiptUrl: uploadedUrl,
      })

      const updated = res?.welcomeKit || {
        ...currentKit,
        paymentReceiptUrl: uploadedUrl,
        paymentMethod: 'OFFLINE',
        status: 'PAYMENT_SUBMITTED',
        paidAt: new Date(),
        paymentRejectionReason: '',
      }
      setCurrentKit(updated)
      setShowRejectForm(false)
      setSuccessMsg('Payment slip uploaded successfully! You can now verify, approve, or reject it.')
      if (onSuccess) onSuccess(updated)
    } catch (err) {
      setError(err?.message || 'Failed to upload payment slip')
    } finally {
      setUploadingSlip(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // One-click attach of verified demo receipt for immediate testing
  async function handleAttachSampleSlip() {
    setError(null)
    setSuccessMsg(null)
    setUploadingSlip(true)
    try {
      const res = await verifyPartnerWelcomeKitPayment(user._id, {
        action: 'ATTACH_SLIP',
        paymentReceiptUrl: SAMPLE_SLIP_URL,
      })

      const updated = res?.welcomeKit || {
        ...currentKit,
        paymentReceiptUrl: SAMPLE_SLIP_URL,
        paymentMethod: 'OFFLINE',
        status: 'PAYMENT_SUBMITTED',
        paidAt: new Date(),
        paymentRejectionReason: '',
      }
      setCurrentKit(updated)
      setShowRejectForm(false)
      setSuccessMsg('Sample payment slip attached! Admin can now test verifying, approving, or rejecting it.')
      if (onSuccess) onSuccess(updated)
    } catch (err) {
      setError(err?.message || 'Failed to attach sample slip')
    } finally {
      setUploadingSlip(false)
    }
  }

  // Reset payment slip status back to Review Pending
  async function handleResetToReview() {
    setError(null)
    setSuccessMsg(null)
    setPaymentActionBusy(true)
    try {
      const res = await verifyPartnerWelcomeKitPayment(user._id, {
        action: 'RESET_TO_REVIEW',
      })
      const updated = res?.welcomeKit || {
        ...currentKit,
        status: 'PAYMENT_SUBMITTED',
        paymentRejectionReason: '',
      }
      setCurrentKit(updated)
      setShowRejectForm(false)
      setSuccessMsg('Status reset to "Review Pending". Admin can now re-evaluate and approve or reject.')
      if (onSuccess) onSuccess(updated)
    } catch (err) {
      setError(err?.message || 'Failed to reset status')
    } finally {
      setPaymentActionBusy(false)
    }
  }

  // Handle Admin Payment Decision (APPROVE or REJECT)
  async function handlePaymentDecision(action) {
    setError(null)
    setSuccessMsg(null)

    if (action === 'REJECT') {
      const finalReason = customRejectionNote.trim() || rejectionReason || 'Payment receipt was rejected by admin.'
      if (!finalReason.trim()) {
        setError('Please select or specify a reason for rejecting the payment.')
        return
      }
      setPaymentActionBusy(true)
      try {
        const res = await verifyPartnerWelcomeKitPayment(user._id, {
          action: 'REJECT',
          rejectionReason: finalReason.trim(),
        })
        const updated = res?.welcomeKit || {
          ...currentKit,
          status: 'PAYMENT_REJECTED',
          paymentRejectionReason: finalReason.trim(),
        }
        setCurrentKit(updated)
        setShowRejectForm(false)
        setSuccessMsg('Payment slip marked as REJECTED. Service partner notified to resubmit.')
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
          paidAt: currentKit.paidAt || new Date(),
        }
        setCurrentKit(updated)
        setShowRejectForm(false)
        setSuccessMsg('Payment slip approved successfully! Delivery address form unlocked for partner.')
        if (onSuccess) onSuccess(updated)
      } catch (err) {
        setError(err?.message || 'Failed to approve payment')
      } finally {
        setPaymentActionBusy(false)
      }
    }
  }

  // Handle Address Correction Request
  async function handleRequestAddressCorrection() {
    setError(null)
    setSuccessMsg(null)
    const finalReason = customCorrectionReason.trim() || correctionReason || 'Please review and correct your shipping address.'
    if (!finalReason.trim()) {
      setError('Please provide a specific reason for requesting address correction.')
      return
    }

    setAddressActionBusy(true)
    try {
      const res = await requestPartnerAddressCorrection(user._id, { reason: finalReason.trim() })
      const updated = res?.welcomeKit || {
        ...currentKit,
        address: {
          ...(currentKit.address || {}),
          status: 'CORRECTION_REQUESTED',
          correctionReason: finalReason.trim(),
        },
      }
      setCurrentKit(updated)
      setShowCorrectionForm(false)
      setSuccessMsg('Address correction requested. Service partner notified to update shipping details.')
      if (onSuccess) onSuccess(updated)
    } catch (err) {
      setError(err?.message || 'Failed to request address correction')
    } finally {
      setAddressActionBusy(false)
    }
  }

  // Handle Address Confirmation (Marks ready for dispatch)
  async function handleConfirmAddress() {
    setError(null)
    setSuccessMsg(null)
    setAddressActionBusy(true)
    try {
      const res = await confirmPartnerWelcomeKitAddress(user._id)
      const updated = res?.welcomeKit || {
        ...currentKit,
        status: 'READY_FOR_DISPATCH',
        address: {
          ...(currentKit.address || {}),
          status: 'CONFIRMED',
        },
      }
      setCurrentKit(updated)
      setSuccessMsg('Address confirmed & snapshot saved! Welcome kit marked READY FOR DISPATCH.')
      if (onSuccess) onSuccess(updated)
    } catch (err) {
      setError(err?.message || 'Failed to confirm address')
    } finally {
      setAddressActionBusy(false)
    }
  }

  // Handle Dispatch Details Submission
  async function handleSaveDispatch(e) {
    if (e) e.preventDefault()
    setError(null)
    setSuccessMsg(null)

    if (!dispatchCourierName.trim()) {
      setError('Courier Company Name is required.')
      return
    }

    if (dispatchTrackingUrl.trim()) {
      if (!/^https:\/\/[^\s$.?#].[^\s]*$/i.test(dispatchTrackingUrl.trim())) {
        setError('Tracking URL must be a valid, secure HTTPS URL (e.g. https://www.bluedart.com/track?awb=...).')
        return
      }
    }

    setDispatchActionBusy(true)
    try {
      const payload = {
        courierName: dispatchCourierName.trim(),
        trackingNumber: dispatchTrackingNumber.trim(),
        trackingUrl: dispatchTrackingUrl.trim(),
        dispatchDate: dispatchDate,
        estimatedDeliveryDate: estimatedDeliveryDate || undefined,
        notes: dispatchNotes.trim(),
      }

      const res = await dispatchPartnerWelcomeKit(user._id, payload)
      const updated = res?.welcomeKit || {
        ...currentKit,
        status: 'DISPATCHED',
        dispatch: {
          ...payload,
          dispatchedAt: new Date(),
        },
      }
      setCurrentKit(updated)
      setSuccessMsg('Welcome kit marked as DISPATCHED! Partner notified with dispatch details.')
      if (onSuccess) onSuccess(updated)
    } catch (err) {
      setError(err?.message || 'Failed to record dispatch details')
    } finally {
      setDispatchActionBusy(false)
    }
  }

  // Handle Manual Delivery Confirmation (Admin only)
  async function handleConfirmDeliveryAdmin() {
    setError(null)
    setSuccessMsg(null)
    setDeliveryActionBusy(true)
    try {
      const res = await confirmPartnerWelcomeKitDeliveryAdmin(user._id, {
        notes: 'Admin manual verification of delivery completion',
      })
      const updated = res?.welcomeKit || {
        ...currentKit,
        status: 'DELIVERED',
        deliveryConfirmation: {
          isConfirmed: true,
          confirmedAt: new Date(),
        },
        uniformIssued: true,
        idCardIssued: true,
        bagIssued: true,
      }
      setCurrentKit(updated)
      setUniformIssued(true)
      setIdCardIssued(true)
      setBagIssued(true)
      setShowDeliveryConfirmDialog(false)
      setSuccessMsg('Welcome kit confirmed DELIVERED! Partner is now fully active for bookings.')
      if (onSuccess) onSuccess(updated)
    } catch (err) {
      setError(err?.message || 'Failed to confirm delivery')
    } finally {
      setDeliveryActionBusy(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-200">
        <div className="w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-100">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/90 px-4 sm:px-6 py-4 shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-slate-900">Welcome Kit & Dispatch Manager</h2>
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-mono text-slate-700">
                    ID: {String(user._id).slice(-6)}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {user.fullName || 'Service Partner'} • +91 {user.phone} • {user.city || 'Partner'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={busy || paymentActionBusy || addressActionBusy || dispatchActionBusy || deliveryActionBusy}
              className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              title="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-slate-200 bg-slate-100/70 px-2 sm:px-4 shrink-0 overflow-x-auto text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('verification')}
              className={`flex items-center gap-1.5 py-3 px-3 border-b-2 transition whitespace-nowrap ${
                activeTab === 'verification'
                  ? 'border-brand text-brand bg-white'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <CreditCard className="h-4 w-4" />
              <span>1. Payment Slip</span>
              {paymentStatus === 'PAYMENT_SUBMITTED' && (
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              )}
              {isPaymentApproved && (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('address')}
              className={`flex items-center gap-1.5 py-3 px-3 border-b-2 transition whitespace-nowrap ${
                activeTab === 'address'
                  ? 'border-brand text-brand bg-white'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <MapPin className="h-4 w-4" />
              <span>2. Delivery Address</span>
              {addressStatus === 'SUBMITTED' && (
                <span className="h-2 w-2 rounded-full bg-blue-500 animate-pulse" />
              )}
              {isAddressConfirmed && (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('dispatch')}
              className={`flex items-center gap-1.5 py-3 px-3 border-b-2 transition whitespace-nowrap ${
                activeTab === 'dispatch'
                  ? 'border-brand text-brand bg-white'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Truck className="h-4 w-4" />
              <span>3. Dispatch Details</span>
              {paymentStatus === 'READY_FOR_DISPATCH' && (
                <span className="rounded-full bg-amber-100 px-1.5 py-0.2 text-[9px] text-amber-900 font-bold">
                  Ready
                </span>
              )}
              {isDispatched && (
                <CheckCircle2 className="h-3.5 w-3.5 text-indigo-600" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('delivery')}
              className={`flex items-center gap-1.5 py-3 px-3 border-b-2 transition whitespace-nowrap ${
                activeTab === 'delivery'
                  ? 'border-brand text-brand bg-white'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Package className="h-4 w-4" />
              <span>4. Delivery & Items</span>
              {isDelivered && (
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('audit')}
              className={`flex items-center gap-1.5 py-3 px-3 border-b-2 transition whitespace-nowrap ${
                activeTab === 'audit'
                  ? 'border-brand text-brand bg-white'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <History className="h-4 w-4" />
              <span>Audit Log ({(currentKit?.auditTrail || []).length})</span>
            </button>
          </div>

          {/* Scrollable Body */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
            {error && (
              <div className="flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                <span className="flex-1">{error}</span>
              </div>
            )}

            {successMsg && (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                <span className="flex-1 font-semibold">{successMsg}</span>
              </div>
            )}

            {/* TAB 1: PAYMENT VERIFICATION */}
            {activeTab === 'verification' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Payment Slip Verification</h3>
                    <p className="text-xs text-slate-500">
                      Verify proof of ₹{currentKit?.paymentAmount || 999} welcome kit fee before unlocking delivery address.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={refreshUserData}
                      disabled={fetchingFresh}
                      title="Refresh partner status from database"
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
                    >
                      <RefreshCw className={`h-3 w-3 ${fetchingFresh ? 'animate-spin text-brand' : ''}`} />
                      <span>{fetchingFresh ? 'Refreshing...' : 'Refresh'}</span>
                    </button>

                    {/* Status Badge */}
                    {isPaymentApproved && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 ring-1 ring-emerald-300">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        Approved ✓
                      </span>
                    )}
                    {paymentStatus === 'PAYMENT_SUBMITTED' && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900 ring-1 ring-amber-300 animate-pulse">
                        <Clock className="h-3.5 w-3.5 text-amber-600" />
                        Needs Review
                      </span>
                    )}
                    {paymentStatus === 'PAYMENT_REJECTED' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-xs font-bold text-rose-800 ring-1 ring-rose-300">
                        <XCircle className="h-3.5 w-3.5 text-rose-600" />
                        Slip Rejected
                      </span>
                    )}
                    {!isPaymentApproved && paymentStatus !== 'PAYMENT_SUBMITTED' && paymentStatus !== 'PAYMENT_REJECTED' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-600">
                        Payment Pending
                      </span>
                    )}
                  </div>
                </div>

                {/* Hidden File Input for uploading / replacing slip */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/jpg"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                {/* Payment Meta Info */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs bg-slate-50 p-3.5 rounded-xl border border-slate-200">
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
                  <div>
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Submitted At</span>
                    <span className="font-semibold text-slate-800">
                      {currentKit?.paidAt ? new Date(currentKit.paidAt).toLocaleDateString() : 'Not Paid'}
                    </span>
                  </div>
                </div>

                {/* Screenshot Preview */}
                {receiptUrl ? (
                  <div className="space-y-3">
                    <div className="relative group overflow-hidden rounded-2xl border-2 border-slate-200 bg-slate-900/5 aspect-video max-h-72 flex items-center justify-center shadow-inner">
                      <img
                        src={receiptUrl}
                        alt="Welcome kit payment slip"
                        className="w-full h-full object-contain cursor-pointer transition duration-300 group-hover:scale-102"
                        onClick={() => setShowFullReceipt(true)}
                      />
                      <div
                        onClick={() => setShowFullReceipt(true)}
                        className="absolute inset-0 bg-slate-950/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 text-white font-bold text-xs transition duration-200 cursor-pointer backdrop-blur-[1px]"
                      >
                        <ZoomIn className="h-5 w-5" />
                        <span>Click to Enlarge Full Slip Screenshot</span>
                      </div>
                      <div className="absolute top-2 left-2 pointer-events-none">
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-900/80 px-2 py-0.5 text-[10px] font-bold text-white shadow-xs backdrop-blur-xs">
                          <Eye className="h-3 w-3 text-brand" />
                          Proof Slip ₹{currentKit?.paymentAmount || 999}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setShowFullReceipt(true)}
                          className="inline-flex items-center gap-1.5 font-bold text-brand hover:underline cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          View Full Resolution Slip
                        </button>
                        <span className="text-slate-300">•</span>
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

                      <button
                        type="button"
                        disabled={uploadingSlip || paymentActionBusy}
                        onClick={() => fileInputRef.current?.click()}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                      >
                        {uploadingSlip ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
                        ) : (
                          <Upload className="h-3.5 w-3.5 text-slate-500" />
                        )}
                        <span>{uploadingSlip ? 'Uploading...' : 'Replace / Change Slip'}</span>
                      </button>
                    </div>

                    {/* Rejection notice if previously rejected */}
                    {paymentStatus === 'PAYMENT_REJECTED' && currentKit?.paymentRejectionReason && (
                      <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-900 space-y-1">
                        <div className="flex items-center gap-1.5 font-bold text-rose-800">
                          <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
                          <span>Active Rejection Reason:</span>
                        </div>
                        <p className="pl-5 italic font-medium">"{currentKit.paymentRejectionReason}"</p>
                      </div>
                    )}

                    {/* Verification Action Buttons */}
                    <div className="pt-2 border-t border-slate-100">
                      {!showRejectForm ? (
                        <div className="space-y-2">
                          <div className="flex flex-col sm:flex-row items-center gap-3">
                            {/* Accept / Approve Button */}
                            <button
                              type="button"
                              onClick={() => handlePaymentDecision('APPROVE')}
                              disabled={paymentActionBusy || isPaymentApproved}
                              className={`w-full sm:flex-1 flex items-center justify-center gap-2 rounded-xl py-3 px-4 text-xs font-bold transition shadow-sm cursor-pointer ${
                                isPaymentApproved
                                  ? 'bg-emerald-100 text-emerald-800 cursor-default ring-1 ring-emerald-300'
                                  : 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98]'
                              }`}
                            >
                              {paymentActionBusy ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4" />
                              )}
                              <span>{isPaymentApproved ? 'Payment Slip Approved & Verified ✓' : 'Approve Payment Slip'}</span>
                            </button>

                            {/* Reject Button */}
                            <button
                              type="button"
                              onClick={() => {
                                setShowRejectForm(true)
                                setRejectionReason(COMMON_REJECTION_REASONS[0])
                              }}
                              disabled={paymentActionBusy}
                              className="w-full sm:flex-1 flex items-center justify-center gap-2 rounded-xl border border-rose-200 bg-white py-3 px-4 text-xs font-bold text-rose-700 hover:bg-rose-50 active:scale-[0.98] transition cursor-pointer"
                            >
                              <XCircle className="h-4 w-4 text-rose-600" />
                              <span>{paymentStatus === 'PAYMENT_REJECTED' ? 'Change Rejection Reason' : 'Reject Slip'}</span>
                            </button>
                          </div>

                          {/* Extra Reset option if already approved or rejected */}
                          {(isPaymentApproved || paymentStatus === 'PAYMENT_REJECTED') && (
                            <div className="flex justify-end pt-1">
                              <button
                                type="button"
                                onClick={handleResetToReview}
                                disabled={paymentActionBusy}
                                className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
                              >
                                <RefreshCw className="h-3 w-3" />
                                <span>Reset slip status back to Review Pending</span>
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        /* Rejection Form */
                        <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-4 space-y-3 animate-in fade-in">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                              <AlertTriangle className="h-4 w-4 text-rose-600" />
                              Specify Rejection Reason (Required):
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowRejectForm(false)}
                              className="text-xs text-slate-500 hover:text-slate-800 cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>

                          {/* Preset reasons */}
                          <div className="space-y-1.5">
                            {COMMON_REJECTION_REASONS.map((reason) => (
                              <label
                                key={reason}
                                className={`flex items-start gap-2 p-2.5 rounded-lg border text-xs cursor-pointer transition ${
                                  rejectionReason === reason && !customRejectionNote
                                    ? 'border-rose-400 bg-white shadow-2xs text-rose-950 font-bold'
                                    : 'border-slate-200 bg-white/70 text-slate-700 hover:bg-white'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="adminRejectionReason"
                                  checked={rejectionReason === reason && !customRejectionNote}
                                  onChange={() => {
                                    setRejectionReason(reason)
                                    setCustomRejectionNote('')
                                  }}
                                  className="mt-0.5 text-rose-600 focus:ring-rose-500 cursor-pointer"
                                />
                                <span className="leading-tight">{reason}</span>
                              </label>
                            ))}
                          </div>

                          {/* Custom note */}
                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                              Or Enter Custom Rejection Reason:
                            </label>
                            <textarea
                              value={customRejectionNote}
                              onChange={(e) => setCustomRejectionNote(e.target.value)}
                              placeholder="e.g. Transaction date does not match; please upload receipt showing today's date."
                              rows={2}
                              className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-rose-400 focus:ring-1 focus:ring-rose-200 outline-none"
                            />
                          </div>

                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setShowRejectForm(false)}
                              className="flex-1 rounded-lg border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => handlePaymentDecision('REJECT')}
                              disabled={paymentActionBusy}
                              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-rose-600 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
                            >
                              {paymentActionBusy ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <XCircle className="h-3.5 w-3.5" />
                              )}
                              <span>Send Rejection to Partner</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  /* No Screenshot State */
                  <div className="rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-6 text-center space-y-4">
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600 ring-1 ring-amber-200">
                        <Upload className="h-6 w-6" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">No Payment Slip Uploaded Yet</h4>
                      <p className="text-xs text-slate-500 max-w-md mx-auto">
                        This service partner has not uploaded their ₹999 payment screenshot yet. You can upload or attach a slip on their behalf, or approve direct hub cash.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 pt-2">
                      {/* Upload Slip on Partner Behalf */}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploadingSlip}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-brand/90 transition cursor-pointer"
                      >
                        {uploadingSlip ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Upload className="h-4 w-4" />
                        )}
                        <span>{uploadingSlip ? 'Uploading Slip...' : 'Upload Slip on Partner Behalf'}</span>
                      </button>

                      {/* Attach Demo Slip (1-click testing) */}
                      <button
                        type="button"
                        onClick={handleAttachSampleSlip}
                        disabled={uploadingSlip}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-xs font-bold text-indigo-700 hover:bg-indigo-100 transition cursor-pointer"
                      >
                        <Sparkles className="h-4 w-4 text-indigo-600" />
                        <span>Attach Demo Slip (Test Receipt)</span>
                      </button>

                      {/* Direct Cash Approval */}
                      <button
                        type="button"
                        onClick={() => handlePaymentDecision('APPROVE')}
                        disabled={paymentActionBusy || isPaymentApproved}
                        className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        <span>{isPaymentApproved ? 'Payment Already Verified ✓' : 'Direct Hub Cash Approval'}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: DELIVERY ADDRESS REVIEW */}
            {activeTab === 'address' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Partner Delivery Address Review</h3>
                    <p className="text-xs text-slate-500">
                      Review submitted shipping destination and confirm accuracy before dispatch.
                    </p>
                  </div>

                  {/* Address Status Pill */}
                  {addressStatus === 'CONFIRMED' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 ring-1 ring-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      Address Confirmed ✓
                    </span>
                  )}
                  {addressStatus === 'SUBMITTED' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800 ring-1 ring-blue-300">
                      <Clock className="h-3.5 w-3.5 text-blue-600" />
                      Submitted • Awaiting Confirmation
                    </span>
                  )}
                  {addressStatus === 'CORRECTION_REQUESTED' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800 ring-1 ring-amber-300">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                      Correction Requested
                    </span>
                  )}
                  {addressStatus === 'NOT_SUBMITTED' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-3 py-1 text-xs font-bold text-slate-600">
                      Not Submitted Yet
                    </span>
                  )}
                </div>

                {!isPaymentApproved && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>Payment slip must be approved in Tab 1 before welcome kit address can be processed.</span>
                  </div>
                )}

                {isAddressSubmitted ? (
                  <div className="space-y-3">
                    {/* 8-Field Address Details Card */}
                    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100 text-xs">
                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                          <UserIcon className="h-3.5 w-3.5 text-brand" />
                          <span>Recipient: {address.recipientName}</span>
                        </div>
                        <span className="font-semibold text-slate-500 flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          +91 {address.mobileNumber}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">House / Flat / Building</span>
                          <span className="font-semibold text-slate-800">{address.houseBuilding || '—'}</span>
                        </div>

                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Street & Area</span>
                          <span className="font-semibold text-slate-800">{address.streetArea || '—'}</span>
                        </div>

                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Landmark</span>
                          <span className="font-semibold text-slate-800">{address.landmark || 'None specified'}</span>
                        </div>

                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">City & State</span>
                          <span className="font-semibold text-slate-800">{address.city}, {address.state}</span>
                        </div>

                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">PIN Code</span>
                          <span className="font-mono font-bold text-slate-900">{address.pincode}</span>
                        </div>

                        <div>
                          <span className="text-[10px] uppercase font-bold text-slate-400 block">Submission Date</span>
                          <span className="text-slate-600">
                            {address.submittedAt ? new Date(address.submittedAt).toLocaleString() : '—'}
                          </span>
                        </div>
                      </div>

                      {/* Display active correction note if any */}
                      {addressStatus === 'CORRECTION_REQUESTED' && address.correctionReason && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 space-y-1">
                          <div className="flex items-center gap-1.5 font-bold text-amber-800">
                            <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                            <span>Current Correction Request Note:</span>
                          </div>
                          <p className="pl-5 italic font-medium">"{address.correctionReason}"</p>
                        </div>
                      )}
                    </div>

                    {/* Address Review Actions */}
                    <div className="pt-2">
                      {!showCorrectionForm ? (
                        <div className="flex flex-col sm:flex-row items-center gap-3">
                          {/* Confirm Address Button */}
                          <button
                            type="button"
                            onClick={handleConfirmAddress}
                            disabled={addressActionBusy || isAddressConfirmed || isDispatched}
                            className={`flex-1 w-full flex items-center justify-center gap-2 rounded-xl py-3 px-4 text-xs font-bold transition shadow-sm cursor-pointer ${
                              isAddressConfirmed
                                ? 'bg-emerald-100 text-emerald-800 cursor-default ring-1 ring-emerald-300'
                                : 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-[0.98]'
                            }`}
                          >
                            {addressActionBusy ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4" />
                            )}
                            <span>
                              {isAddressConfirmed ? 'Address Confirmed (Ready for Dispatch) ✓' : 'Confirm Address & Mark Ready for Dispatch'}
                            </span>
                          </button>

                          {/* Request Correction Button */}
                          {!isDispatched && (
                            <button
                              type="button"
                              onClick={() => {
                                setShowCorrectionForm(true)
                                setCorrectionReason(COMMON_ADDRESS_CORRECTION_REASONS[0])
                              }}
                              disabled={addressActionBusy}
                              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-amber-300 bg-amber-50/70 py-3 px-4 text-xs font-bold text-amber-900 hover:bg-amber-100 transition cursor-pointer"
                            >
                              <AlertTriangle className="h-4 w-4 text-amber-600" />
                              <span>Request Correction</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        /* Address Correction Request Form */
                        <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-4 space-y-3 animate-in fade-in">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                              <AlertTriangle className="h-4 w-4 text-amber-600" />
                              Specify Address Correction Reason (Required):
                            </span>
                            <button
                              type="button"
                              onClick={() => setShowCorrectionForm(false)}
                              className="text-xs text-slate-500 hover:text-slate-800"
                            >
                              Cancel
                            </button>
                          </div>

                          <div className="space-y-1.5">
                            {COMMON_ADDRESS_CORRECTION_REASONS.map((reason) => (
                              <label
                                key={reason}
                                className={`flex items-start gap-2 p-2.5 rounded-lg border text-xs cursor-pointer transition ${
                                  correctionReason === reason && !customCorrectionReason
                                    ? 'border-amber-400 bg-white shadow-2xs text-amber-950 font-bold'
                                    : 'border-slate-200 bg-white/70 text-slate-700 hover:bg-white'
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="adminAddressCorrection"
                                  checked={correctionReason === reason && !customCorrectionReason}
                                  onChange={() => {
                                    setCorrectionReason(reason)
                                    setCustomCorrectionReason('')
                                  }}
                                  className="mt-0.5 text-amber-600 focus:ring-amber-500"
                                />
                                <span className="leading-tight">{reason}</span>
                              </label>
                            ))}
                          </div>

                          <div>
                            <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block mb-1">
                              Or Enter Custom Address Issue Note:
                            </label>
                            <textarea
                              value={customCorrectionReason}
                              onChange={(e) => setCustomCorrectionReason(e.target.value)}
                              placeholder="e.g. Please specify your apartment tower or nearest landmark."
                              rows={2}
                              className="w-full rounded-lg border border-slate-200 bg-white p-2.5 text-xs text-slate-800 placeholder-slate-400 focus:border-amber-400 focus:ring-1 focus:ring-amber-200 outline-none"
                            />
                          </div>

                          <div className="flex gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => setShowCorrectionForm(false)}
                              className="flex-1 rounded-lg border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleRequestAddressCorrection}
                              disabled={addressActionBusy}
                              className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-amber-600 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-amber-700 disabled:opacity-50 cursor-pointer"
                            >
                              {addressActionBusy ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Send className="h-3.5 w-3.5" />
                              )}
                              <span>Send Correction Request</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center space-y-2">
                    <MapPin className="h-8 w-8 text-slate-300 mx-auto" />
                    <p className="text-xs font-semibold text-slate-600">
                      No delivery address submitted yet by the service partner.
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Once payment is approved, the service provider dashboard prompts them to provide their 8-field shipping address.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* TAB 3: DISPATCH DETAILS */}
            {activeTab === 'dispatch' && (
              <form onSubmit={handleSaveDispatch} className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Manual Courier Dispatch Details</h3>
                    <p className="text-xs text-slate-500">
                      Record informational shipment details for the partner. No live courier API polling or webhook synchronization is used.
                    </p>
                  </div>

                  {isDispatched && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-800 ring-1 ring-indigo-300">
                      <Truck className="h-3.5 w-3.5 text-indigo-600" />
                      Dispatched
                    </span>
                  )}
                </div>

                {/* Notice banner */}
                <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-3 text-[11px] text-blue-900 leading-relaxed">
                  <strong>Informational Dispatch Phase:</strong> All courier fields entered here are informational. Service providers will be notified with your recorded details and HTTPS tracking link.
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Courier Name */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                        Courier Partner Name *
                      </label>
                      <input
                        type="text"
                        value={dispatchCourierName}
                        onChange={(e) => setDispatchCourierName(e.target.value)}
                        placeholder="e.g. Blue Dart, Delhivery, DTDC, India Post"
                        required
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-brand"
                      />
                    </div>

                    {/* AWB / Tracking Number */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                        AWB / Tracking Number (Optional)
                      </label>
                      <input
                        type="text"
                        value={dispatchTrackingNumber}
                        onChange={(e) => setDispatchTrackingNumber(e.target.value)}
                        placeholder="e.g. BD891230495IN"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-brand font-mono"
                      />
                    </div>

                    {/* Official Tracking URL */}
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                        Official Courier Tracking URL (Optional - Must start with https://)
                      </label>
                      <input
                        type="url"
                        value={dispatchTrackingUrl}
                        onChange={(e) => setDispatchTrackingUrl(e.target.value)}
                        placeholder="https://www.bluedart.com/tracking?awb=..."
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-brand"
                      />
                    </div>

                    {/* Dispatch Date */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                        Dispatch Date *
                      </label>
                      <input
                        type="date"
                        value={dispatchDate}
                        onChange={(e) => setDispatchDate(e.target.value)}
                        required
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-brand"
                      />
                    </div>

                    {/* Estimated Delivery Date */}
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                        Estimated Delivery Date (Optional)
                      </label>
                      <input
                        type="date"
                        value={estimatedDeliveryDate}
                        onChange={(e) => setEstimatedDeliveryDate(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium text-slate-800 outline-none focus:border-brand"
                      />
                    </div>

                    {/* Admin Notes */}
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700 mb-1">
                        Admin Dispatch Notes (Optional)
                      </label>
                      <textarea
                        value={dispatchNotes}
                        onChange={(e) => setDispatchNotes(e.target.value)}
                        placeholder="Add packaging notes or dispatch reference ID..."
                        rows={2}
                        className="w-full rounded-xl border border-slate-200 p-2.5 text-xs font-medium text-slate-800 outline-none focus:border-brand"
                      />
                    </div>
                  </div>
                </div>

                {/* Submit Dispatch Details Button */}
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={dispatchActionBusy}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-brand py-3 text-xs font-bold text-white shadow-md shadow-indigo-600/20 hover:brightness-105 active:scale-[0.98] transition cursor-pointer"
                  >
                    {dispatchActionBusy ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Saving Dispatch Details...</span>
                      </>
                    ) : (
                      <>
                        <Truck className="h-4 w-4" />
                        <span>{isDispatched ? 'Update Dispatch Details & Notify Partner' : 'Save Dispatch Details & Notify Partner'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}

            {/* TAB 4: DELIVERY & KIT ITEMS */}
            {activeTab === 'delivery' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Delivery Confirmation & Hardware Items</h3>
                    <p className="text-xs text-slate-500">
                      Explicit manual admin delivery confirmation and kit items checklist.
                    </p>
                  </div>

                  {isDelivered && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-800 ring-1 ring-emerald-300">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      Delivered ✓
                    </span>
                  )}
                </div>

                {/* Manual Admin Delivery Confirmation Section */}
                <div className="rounded-2xl border-2 border-emerald-200 bg-gradient-to-br from-emerald-50/70 via-teal-50/30 to-white p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-emerald-600" />
                      <span className="text-xs font-bold text-emerald-950 uppercase tracking-wide">
                        Admin Delivery Confirmation (Manual Action)
                      </span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">
                    This action records that an authorized administrator has verified the physical receipt of the welcome kit. It is labeled as an <strong>admin-confirmed delivery event</strong>, not an automated courier API webhook.
                  </p>

                  {isDelivered ? (
                    <div className="rounded-xl border border-emerald-300 bg-white p-3 text-xs text-emerald-900 space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-800">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                        <span>Welcome Kit Officially Marked Delivered</span>
                      </div>
                      <p className="text-[11px] text-slate-600 pl-5">
                        Confirmed on:{' '}
                        <strong>
                          {currentKit?.deliveryConfirmation?.confirmedAt
                            ? new Date(currentKit.deliveryConfirmation.confirmedAt).toLocaleString()
                            : new Date().toLocaleString()}
                        </strong>
                      </p>
                    </div>
                  ) : !showDeliveryConfirmDialog ? (
                    <button
                      type="button"
                      onClick={() => setShowDeliveryConfirmDialog(true)}
                      disabled={deliveryActionBusy}
                      className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 active:scale-[0.98] transition cursor-pointer"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Confirm Welcome Kit Delivered (Admin Action)</span>
                    </button>
                  ) : (
                    <div className="rounded-xl border border-emerald-300 bg-white p-4 space-y-3 animate-in fade-in">
                      <p className="text-xs font-bold text-slate-900">
                        Are you sure you want to confirm delivery of this Welcome Kit?
                      </p>
                      <p className="text-[11px] text-slate-500">
                        This will update the partner's status to DELIVERED, record your Admin ID and timestamp in the immutable audit log, notify the partner, and automatically mark all kit hardware items as issued.
                      </p>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setShowDeliveryConfirmDialog(false)}
                          className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleConfirmDeliveryAdmin}
                          disabled={deliveryActionBusy}
                          className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
                        >
                          {deliveryActionBusy ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          )}
                          <span>Yes, Confirm Delivery</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Welcome Kit Hardware Checklist */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                      Welcome Kit Hardware Checklist
                    </label>
                    <span className="text-[10px] text-slate-400">
                      Check items issued physically or dispatched in the box
                    </span>
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
                        className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/30 cursor-pointer"
                      />
                      <div>
                        <span className="text-sm font-bold text-slate-900">Service Uniform</span>
                        <p className="text-xs text-slate-500">Official company t-shirt / apron kit</p>
                      </div>
                    </div>
                    <span className={`text-xs font-semibold ${uniformIssued ? 'text-brand' : 'text-slate-400'}`}>
                      {uniformIssued ? 'Issued ✓' : 'Not Issued'}
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
                        className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/30 cursor-pointer"
                      />
                      <div>
                        <span className="text-sm font-bold text-slate-900">ID Card & Lanyard</span>
                        <p className="text-xs text-slate-500">Verified partner credential badge</p>
                      </div>
                    </div>
                    <span className={`text-xs font-semibold ${idCardIssued ? 'text-brand' : 'text-slate-400'}`}>
                      {idCardIssued ? 'Issued ✓' : 'Not Issued'}
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
                        className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/30 cursor-pointer"
                      />
                      <div>
                        <span className="text-sm font-bold text-slate-900">Tool / Service Bag</span>
                        <p className="text-xs text-slate-500">Official branded equipment bag</p>
                      </div>
                    </div>
                    <span className={`text-xs font-semibold ${bagIssued ? 'text-brand' : 'text-slate-400'}`}>
                      {bagIssued ? 'Issued ✓' : 'Not Issued'}
                    </span>
                  </label>

                  <button
                    type="button"
                    onClick={handleSaveKit}
                    disabled={busy}
                    className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-800 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-slate-900 transition disabled:opacity-50 cursor-pointer"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    <span>Save Hardware Checklist</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 5: AUDIT HISTORY TIMELINE */}
            {activeTab === 'audit' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Audit Trail & Workflow History</h3>
                    <p className="text-xs text-slate-500">
                      Chronological log of all approvals, rejections, address changes, dispatch details, and deliveries.
                    </p>
                  </div>
                </div>

                {Array.isArray(currentKit?.auditTrail) && currentKit.auditTrail.length > 0 ? (
                  <div className="relative pl-6 space-y-4 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                    {[...currentKit.auditTrail].reverse().map((entry, idx) => (
                      <div key={idx} className="relative group">
                        <div className="absolute -left-6 top-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-brand shadow-xs" />
                        <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs space-y-1">
                          <div className="flex items-center justify-between text-slate-500 text-[11px]">
                            <span className="font-bold text-slate-900 uppercase tracking-wide">
                              {entry.action}
                            </span>
                            <span>{entry.timestamp ? new Date(entry.timestamp).toLocaleString() : '—'}</span>
                          </div>
                          <p className="text-slate-700 font-medium">{entry.details || 'State transition'}</p>
                          <div className="text-[10px] text-slate-400 pt-0.5">
                            By: <span className="font-semibold text-slate-600">{entry.performedByName || 'Admin'}</span> ({entry.performedByRole || 'admin'})
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
                    No audit records logged yet for this welcome kit.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="border-t border-slate-100 bg-slate-50 p-3 sm:p-4 flex items-center justify-between shrink-0">
            <div className="text-xs font-semibold text-slate-500 flex items-center gap-1.5">
              <span>Overall Status:</span>
              <span className="font-bold text-slate-800 uppercase font-mono">{paymentStatus}</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-5 py-2 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-100 transition cursor-pointer"
            >
              Done / Close
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
                  className="rounded-full bg-white/10 hover:bg-white/20 p-2 text-white transition cursor-pointer"
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
