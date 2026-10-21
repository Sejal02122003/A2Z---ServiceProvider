import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useDispatch } from 'react-redux'
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Award,
  Briefcase,
  Building2,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  CreditCard,
  FileCheck,
  FileText,
  HardHat,
  HelpCircle,
  Home,
  Info,
  MapPin,
  Package,
  Phone,
  QrCode,
  RefreshCw,
  Scissors,
  ShieldAlert,
  ShieldCheck,
  Shirt,
  Sparkles,
  Truck,
  Tv,
  Upload,
  UploadCloud,
  User,
  Wrench,
  X,
  HeartHandshake,
  Layers,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth.js'
import { setUser } from '../../store/slices/authSlice.js'
import {
  fetchPartnerOnboardingStatus,
  fetchAvailableTrialSlots,
  submitPartnerApplication,
  schedulePartnerTrialSlot,
  completePartnerTrial,
  submitWelcomeKitPayment,
  confirmWelcomeKitReceipt,
} from '../../api/partnerOnboardingApi.js'
import { submitLabourKycDocuments } from '../../api/userKycApi.js'
import { fetchLabourCategoriesGrouped } from '../../api/labourCategoriesApi.js'
import { uploadMedia, uploadDocument } from '../../api/uploadApi.js'
import { UPLOAD_FOLDERS } from '../../constants/uploadFolders.js'
import { KYC_STATUS, USER_ROLES } from '../../constants/userRoles.js'

function maskAadhaar(str) {
  if (!str) return '•••• •••• ••••'
  const digits = String(str).replace(/\D/g, '')
  if (digits.length >= 4) {
    return `•••• •••• ${digits.slice(-4)}`
  }
  return str
}

function maskPan(str) {
  if (!str) return '••••• •••• •'
  const s = String(str).toUpperCase().trim()
  if (s.length >= 4) {
    return `••••••${s.slice(-4)}`
  }
  return str
}

function getCategoryVisual(name) {
  const lower = String(name || '').toLowerCase()
  if (lower.includes('salon') || lower.includes('beauty') || lower.includes('hair') || lower.includes('spa')) {
    return {
      Icon: Scissors,
      color: 'text-rose-600',
      bg: 'bg-rose-50 border-rose-200',
      badgeBg: 'bg-rose-100 text-rose-700',
    }
  }
  if (lower.includes('appliance') || lower.includes('repair') || lower.includes('electric') || lower.includes('ac')) {
    return {
      Icon: Tv,
      color: 'text-blue-600',
      bg: 'bg-blue-50 border-blue-200',
      badgeBg: 'bg-blue-100 text-blue-700',
    }
  }
  if (lower.includes('care') || lower.includes('nurse') || lower.includes('patient') || lower.includes('elderly')) {
    return {
      Icon: HeartHandshake,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 border-emerald-200',
      badgeBg: 'bg-emerald-100 text-emerald-700',
    }
  }
  return {
    Icon: Layers,
    color: 'text-indigo-600',
    bg: 'bg-indigo-50 border-indigo-200',
    badgeBg: 'bg-indigo-100 text-indigo-700',
  }
}

export function PartnerOnboardingStepper({ onFinish }) {
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const { user } = useAuth()

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [data, setData] = useState(null)
  const [expandedStep, setExpandedStep] = useState(null)
  const [toast, setToast] = useState({ type: '', message: '' })

  // Step 1 Form State
  const [categoryGroups, setCategoryGroups] = useState([])
  const [selectedCategoryIds, setSelectedCategoryIds] = useState([])
  const [selectedSubcategoryIds, setSelectedSubcategoryIds] = useState([])
  const [expandedCategoryIds, setExpandedCategoryIds] = useState([])
  const [experienceYears, setExperienceYears] = useState(
    user?.labourProfile?.experienceYears ?? 3
  )

  // Step 2 Form State
  const [aadhaarInput, setAadhaarInput] = useState('')
  const [panInput, setPanInput] = useState('')
  const [kycDocUrl, setKycDocUrl] = useState('')
  const [uploadingKyc, setUploadingKyc] = useState(false)

  // Step 4 Form State
  const [trialDate, setTrialDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0]
  })
  const [trialTimeSlot, setTrialTimeSlot] = useState('')
  const [trialLocation, setTrialLocation] = useState(
    'A2Z Partner Training & Evaluation Center, Sector 18, Noida'
  )
  const [dynamicSlots, setDynamicSlots] = useState([])
  const [loadingSlots, setLoadingSlots] = useState(false)

  // Payment Form State
  const [paymentTab, setPaymentTab] = useState('OFFLINE')
  const [billReceiptUrl, setBillReceiptUrl] = useState('')
  const [uploadingBill, setUploadingBill] = useState(false)
  const [paymentNotes, setPaymentNotes] = useState('')

  // Delivery Address State
  const [deliveryAddress, setDeliveryAddress] = useState(
    user?.savedAddress?.text || user?.permanentAddress || ''
  )
  const [deliveryCity, setDeliveryCity] = useState(user?.city || 'Noida')
  const [deliveryPincode, setDeliveryPincode] = useState('201301')

  const showToast = (type, message) => {
    setToast({ type, message })
    setTimeout(() => setToast({ type: '', message: '' }), 4500)
  }

  // Refresh slots directly from admin configuration
  const handleRefreshSlots = useCallback(async () => {
    try {
      setLoadingSlots(true)
      const data = await fetchAvailableTrialSlots()
      if (Array.isArray(data?.availableTrialSlots) && data.availableTrialSlots.length > 0) {
        setDynamicSlots(data.availableTrialSlots)
        setTrialTimeSlot((current) => {
          const exists = data.availableTrialSlots.some(
            (s) => s.id === current || s.label === current
          )
          return exists ? current : data.availableTrialSlots[0].id
        })
      } else {
        setDynamicSlots([])
        setTrialTimeSlot('')
      }
      if (data?.defaultHubLocation) {
        setTrialLocation(data.defaultHubLocation)
      }
    } catch (err) {
      console.warn('Could not refresh trial slots:', err)
    } finally {
      setLoadingSlots(false)
    }
  }, [])

  // Load Status
  const loadStatus = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetchPartnerOnboardingStatus()
      setData(res)

      // Auto-expand current active step
      const stepNum = res.currentStep <= 5 ? res.currentStep : 5
      setExpandedStep((prev) => (prev === null ? stepNum : prev))

      // Dynamic Trial Slots & Hub Location from Admin
      if (res.step4) {
        if (Array.isArray(res.step4.availableTrialSlots) && res.step4.availableTrialSlots.length > 0) {
          setDynamicSlots(res.step4.availableTrialSlots)
          if (!res.step4.trialSlot?.timeSlot) {
            setTrialTimeSlot(res.step4.availableTrialSlots[0].id)
          }
        } else {
          setDynamicSlots([])
          if (!res.step4.trialSlot?.timeSlot) {
            setTrialTimeSlot('')
          }
        }
        if (res.step4.trialSlot?.timeSlot) {
          setTrialTimeSlot(res.step4.trialSlot.timeSlot)
        }
        if (res.step4.trialSlot?.date) {
          setTrialDate(res.step4.trialSlot.date)
        }
        if (res.step4.trialSlot?.location) {
          setTrialLocation(res.step4.trialSlot.location)
        } else if (res.step4.defaultHubLocation) {
          setTrialLocation(res.step4.defaultHubLocation)
        }
      }

      if (res.user) {
        dispatch(
          setUser({
            ...user,
            ...res.user,
            role: res.user.role || user?.role || USER_ROLES.LABOUR,
          })
        )
        if (res.user.labourProfile?.categoryIds) {
          const catIds = res.user.labourProfile.categoryIds.map(String)
          setSelectedCategoryIds(catIds)
          setExpandedCategoryIds((prev) => Array.from(new Set([...prev, ...catIds])))
        }
        if (res.user.labourProfile?.subcategoryIds) {
          setSelectedSubcategoryIds(res.user.labourProfile.subcategoryIds.map(String))
        }
        if (res.user.labourProfile?.experienceYears !== undefined) {
          setExperienceYears(res.user.labourProfile.experienceYears)
        }
        if (res.user.welcomeKit?.deliveryAddress) {
          setDeliveryAddress(res.user.welcomeKit.deliveryAddress)
        }
      }
    } catch (err) {
      console.error('Failed to load onboarding status:', err)
      showToast('error', err?.message || 'Could not load registration steps')
    } finally {
      setLoading(false)
    }
  }, [dispatch])

  // Auto-refresh trial slots whenever Step 4 is expanded
  useEffect(() => {
    if (expandedStep === 4) {
      handleRefreshSlots()
    }
  }, [expandedStep, handleRefreshSlots])

  // Auto-refresh when tab / window gains focus or real-time broadcast arrives from Admin
  useEffect(() => {
    let bc
    try {
      bc = new BroadcastChannel('a2z_trial_slots_channel')
      bc.onmessage = () => {
        handleRefreshSlots()
      }
    } catch {}

    const onStorage = (e) => {
      if (e.key === 'a2z_slots_last_updated') {
        handleRefreshSlots()
      }
    }

    const onFocus = () => {
      handleRefreshSlots()
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        handleRefreshSlots()
      }
    }

    window.addEventListener('focus', onFocus)
    window.addEventListener('storage', onStorage)
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      if (bc) bc.close()
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('storage', onStorage)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [handleRefreshSlots])

  // Load Categories on mount
  useEffect(() => {
    loadStatus()
    fetchLabourCategoriesGrouped()
      .then((res) => {
        const groups = res?.data?.groups || []
        setCategoryGroups(groups)
      })
      .catch((err) => console.warn('Could not load categories:', err))
  }, [loadStatus])

  // Step 1: Submit Application
  const handleSubmitStep1 = async (e) => {
    e?.preventDefault()
    if (selectedCategoryIds.length === 0 && selectedSubcategoryIds.length === 0) {
      showToast('error', 'Please select at least one service category.')
      return
    }
    if (selectedSubcategoryIds.length === 0) {
      showToast('error', 'Please select at least one subcategory under your selected categories.')
      return
    }
    if (experienceYears < 0) {
      showToast('error', 'Please enter valid experience years.')
      return
    }

    try {
      setSubmitting(true)
      const services = []
      categoryGroups.forEach((group) => {
        (group.categories || []).forEach((subcat) => {
          if (selectedSubcategoryIds.includes(String(subcat._id))) {
            if (Array.isArray(subcat.services) && subcat.services.length > 0) {
              subcat.services.forEach((s) => {
                services.push({
                  serviceId: String(s._id),
                  subcategoryId: String(subcat._id),
                  minPrice: s.hourlyPrice || 0,
                  maxPrice: s.hourlyPrice || 0,
                })
              })
            } else {
              services.push({
                serviceId: String(subcat._id),
                subcategoryId: String(subcat._id),
              })
            }
          }
        })
      })

      const activeCatIds = Array.from(new Set([
        ...selectedCategoryIds,
        ...categoryGroups
          .filter((g) => (g.categories || []).some((sc) => selectedSubcategoryIds.includes(String(sc._id))))
          .map((g) => String(g._id)),
      ]))

      await submitPartnerApplication({
        categoryIds: activeCatIds,
        subcategoryIds: selectedSubcategoryIds,
        services,
        experienceYears: Number(experienceYears),
      })

      showToast('success', 'Application & service experience submitted!')
      await loadStatus()
      setExpandedStep(2) // Move to Step 2
    } catch (err) {
      showToast('error', err?.message || 'Failed to submit application')
    } finally {
      setSubmitting(false)
    }
  }

  // Step 2: Submit KYC
  const handleSubmitStep2 = async (e) => {
    e?.preventDefault()
    const rawAadhaar = aadhaarInput.replace(/\D/g, '')
    const rawPan = panInput.trim().toUpperCase()

    if (rawAadhaar.length !== 12) {
      showToast('error', 'Please enter a valid 12-digit Aadhaar number.')
      return
    }
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(rawPan)) {
      showToast('error', 'Please enter a valid 10-character PAN number.')
      return
    }

    try {
      setSubmitting(true)
      const docUrl = kycDocUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80'

      await submitLabourKycDocuments({
        aadhaar: rawAadhaar,
        pan: rawPan,
        videoUrl: docUrl,
        videoMeta: {
          publicId: `kyc_${user?._id || 'partner'}`,
          uploadedAt: new Date(),
        },
      })

      showToast('success', 'Aadhaar & PAN KYC submitted for Admin Approval!')
      await loadStatus()
      setExpandedStep(3) // Move to Step 3
    } catch (err) {
      showToast('error', err?.message || 'Failed to submit KYC verification')
    } finally {
      setSubmitting(false)
    }
  }

  // Step 2 Document upload
  const handleKycFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setUploadingKyc(true)
      let res
      try {
        res = await uploadDocument(file, UPLOAD_FOLDERS.KYC_DOCUMENTS)
      } catch (docErr) {
        res = await uploadMedia(file, UPLOAD_FOLDERS.KYC_DOCUMENTS)
      }
      const url =
        res?.data?.asset?.secureUrl ||
        res?.data?.asset?.url ||
        res?.asset?.secureUrl ||
        res?.asset?.url ||
        res?.url ||
        res?.data?.url
      if (url) {
        setKycDocUrl(url)
        showToast('success', 'KYC document uploaded successfully!')
      } else {
        throw new Error('Upload succeeded but no file URL returned')
      }
    } catch (err) {
      console.error('KYC upload failed:', err)
      showToast('error', err?.message || 'Upload failed')
    } finally {
      setUploadingKyc(false)
    }
  }

  // Step 4: Schedule Trial Slot
  const handleScheduleTrial = async (e) => {
    e?.preventDefault()
    if (dynamicSlots.length === 0) {
      showToast('error', 'No trial slots are currently available. Please wait for admin to create slots.')
      return
    }
    if (!trialDate || !trialTimeSlot) {
      showToast('error', 'Please select trial date and time slot.')
      return
    }

    try {
      setSubmitting(true)
      await schedulePartnerTrialSlot({
        date: trialDate,
        timeSlot: trialTimeSlot,
        location: trialLocation,
      })

      showToast('success', 'Trial slot scheduled successfully!')
      await loadStatus()
    } catch (err) {
      showToast('error', err?.message || 'Failed to schedule trial slot')
    } finally {
      setSubmitting(false)
    }
  }

  // Step 4: Simulate / Complete Trial Evaluation
  const handleCompleteTrialEvaluation = async () => {
    try {
      setSubmitting(true)
      await completePartnerTrial('Practical trial evaluation completed. Candidate verified.')
      showToast('success', '🎉 Trial evaluated! Joining confirmed. Please proceed to Welcome Kit.')
      await loadStatus()
    } catch (err) {
      showToast('error', err?.message || 'Failed to evaluate trial')
    } finally {
      setSubmitting(false)
    }
  }

  // Step 4: Welcome Kit Payment
  const handleBillFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      setUploadingBill(true)
      const res = await uploadMedia(file, UPLOAD_FOLDERS.GENERAL_MEDIA)
      const url =
        res?.data?.asset?.secureUrl ||
        res?.data?.asset?.url ||
        res?.asset?.secureUrl ||
        res?.asset?.url ||
        res?.url ||
        res?.data?.url
      if (url) {
        setBillReceiptUrl(url)
        showToast('success', 'Payment bill screenshot uploaded!')
      } else {
        throw new Error('Upload succeeded but no file URL returned')
      }
    } catch (err) {
      console.error('Bill upload failed:', err)
      showToast('error', err?.message || 'Failed to upload bill')
    } finally {
      setUploadingBill(false)
    }
  }

  const handleSubmitWelcomeKitPayment = async (e) => {
    e?.preventDefault()
    if (paymentTab === 'OFFLINE' && !billReceiptUrl) {
      showToast('error', 'Please upload a bill or payment screenshot.')
      return
    }

    try {
      setSubmitting(true)
      await submitWelcomeKitPayment({
        paymentMethod: paymentTab,
        paymentReceiptUrl: billReceiptUrl,
        paymentNotes,
        deliveryAddress,
        deliveryCity,
        deliveryPincode,
      })

      showToast('success', 'Welcome kit payment submitted! Tracking ready.')
      await loadStatus()
      setExpandedStep(5) // Move to Step 5
    } catch (err) {
      showToast('error', err?.message || 'Failed to submit payment')
    } finally {
      setSubmitting(false)
    }
  }

  // Step 5: Confirm Welcome Kit Received
  const handleConfirmKitReceipt = async () => {
    try {
      setSubmitting(true)
      await confirmWelcomeKitReceipt()
      showToast('success', '🎉 Welcome kit confirmed! You are now ready to accept bookings!')
      await loadStatus()
    } catch (err) {
      showToast('error', err?.message || 'Failed to confirm kit receipt')
    } finally {
      setSubmitting(false)
    }
  }

  // Derived Values
  const currentStep = data?.currentStep || 1
  const step1 = data?.step1 || {}
  const step2 = data?.step2 || {}
  const step3 = data?.step3 || {}
  const step4 = data?.step4 || {}
  const step5 = data?.step5 || {}

  const stepsMeta = [
    {
      num: 1,
      badge: 'STEP 1 • 2 MIN',
      title: 'Submit Application & Service Experience',
      completed: Boolean(step1.completed),
      locked: false,
    },
    {
      num: 2,
      badge: 'STEP 2 • 3 MIN',
      title: 'Complete KYC Verification (Aadhaar & PAN)',
      completed: Boolean(step2.completed),
      locked: !step1.completed,
    },
    {
      num: 3,
      badge: 'STEP 3 • 24 HRS',
      title: 'Approval & Verification by Admin',
      completed: Boolean(step3.isApproved),
      locked: !step2.completed,
    },
    {
      num: 4,
      badge: 'STEP 4 • TRIAL SLOT',
      title: 'Trial Slot & Joining Confirmation',
      completed: Boolean(step4.completed && step4.paymentComplete),
      locked: !step3.isApproved,
    },
    {
      num: 5,
      badge: 'STEP 5 • WELCOME KIT',
      title: 'Welcome Kit & Booking Activation',
      completed: Boolean(step5.completed),
      locked: !(step4.completed && step4.paymentComplete),
    },
  ]

  const completedCount = stepsMeta.filter((s) => s.completed).length
  const progressPct = Math.round((completedCount / 5) * 100)

  if (loading && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[350px] p-6 text-center">
        <RefreshCw className="h-8 w-8 text-brand animate-spin mb-3" />
        <p className="text-sm font-semibold text-slate-700">Loading partner registration steps...</p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-xl pb-28">
      {/* Toast Alert */}
      {toast.message && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold shadow-xl transition-all ${
            toast.type === 'error'
              ? 'bg-rose-600 text-white shadow-rose-600/30'
              : 'bg-emerald-600 text-white shadow-emerald-600/30'
          }`}
        >
          {toast.type === 'error' ? (
            <AlertCircle className="h-4 w-4 shrink-0" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header Section */}
      <div className="mb-5 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-brand-900 p-5 text-white shadow-xl relative overflow-hidden">
        {/* Glow backdrop */}
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-brand/30 blur-3xl" />
        <div className="pointer-events-none absolute -left-8 -bottom-8 h-32 w-32 rounded-full bg-amber-400/20 blur-3xl" />

        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-amber-300 backdrop-blur-md">
              <Sparkles className="h-3 w-3" /> Partner Onboarding
            </span>
            <span className="text-xs font-bold text-slate-300">
              {progressPct}% Completed
            </span>
          </div>

          <h1 className="mt-2 text-xl sm:text-2xl font-black tracking-tight text-white">
            Steps for Service Partner Registration
          </h1>
          <p className="mt-1 text-xs text-slate-300 leading-relaxed">
            Follow the 5 simple steps below to get verified and become ready to accept live customer bookings.
          </p>

          {/* Progress Bar */}
          <div className="mt-4">
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-white/10 p-0.5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-400 via-orange-400 to-emerald-400 transition-all duration-500 shadow-sm"
                style={{ width: `${Math.max(5, progressPct)}%` }}
              />
            </div>
            <div className="mt-2 flex items-center justify-between text-[11px] font-semibold text-slate-300">
              <span>Step {Math.min(5, currentStep)} of 5</span>
              <span>{5 - completedCount} steps remaining</span>
            </div>
          </div>
        </div>
      </div>

      {/* Verified Partner Entry Bar */}
      <div className="mb-4 flex items-center justify-between rounded-2xl border border-emerald-200/80 bg-emerald-50/70 p-3.5 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-xs">
            <User className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-bold text-emerald-950">
                {user?.fullName || 'Registered Partner'}
              </p>
              <span className="rounded-md bg-emerald-200/80 px-1.5 py-0.2 text-[9px] font-extrabold text-emerald-800 uppercase">
                Verified
              </span>
            </div>
            <p className="text-[11px] text-emerald-700 flex items-center gap-1 mt-0.5">
              <Phone className="h-3 w-3" /> +91 {user?.phone || '—'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-700">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>Entry Done</span>
        </div>
      </div>

      {/* Vertical Stepper Timeline matching reference screenshot */}
      <div className="relative space-y-4 pl-3 sm:pl-4">
        {/* Continuous connector line behind nodes */}
        <div className="absolute left-[23px] sm:left-[27px] top-6 bottom-6 w-[2.5px] bg-slate-200 z-0" />

        {/* STEP 1: Submit Application & Experience */}
        <div className="relative z-10">
          <div className="flex items-start gap-3 sm:gap-4">
            {/* Stepper Node Icon */}
            <div
              className={`flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full border-2 transition-all shadow-xs ${
                step1.completed
                  ? 'border-emerald-500 bg-emerald-500 text-white'
                  : currentStep === 1
                  ? 'border-orange-500 bg-orange-500 text-white ring-4 ring-orange-100'
                  : 'border-slate-300 bg-white text-slate-400'
              }`}
            >
              {step1.completed ? (
                <Check className="h-4 w-4 stroke-[3]" />
              ) : currentStep === 1 ? (
                <Clock className="h-4 w-4 stroke-[2.5] animate-pulse" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-slate-300" />
              )}
            </div>

            {/* Stepper Content */}
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setExpandedStep(expandedStep === 1 ? null : 1)}
                className="flex w-full items-center justify-between text-left group"
              >
                <div>
                  <p className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    STEP 1 • 2 MIN
                  </p>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 group-hover:text-brand transition">
                    Submit Application & Experience
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  {step1.completed ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      Completed
                    </span>
                  ) : (
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-800">
                      In Progress
                    </span>
                  )}
                  {expandedStep === 1 ? (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  )}
                </div>
              </button>

              {/* Collapsible Card */}
              <AnimatePresence>
                {expandedStep === 1 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm"
                  >
                    <p className="text-xs text-slate-600 mb-3 leading-relaxed">
                      Select your service categories and provide your hands-on field experience.
                    </p>

                    <form onSubmit={handleSubmitStep1} className="space-y-3.5">
                      {/* Service Category & Subcategory Picker */}
                      <div>
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-2.5">
                          <div>
                            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-700">
                              Service Categories & Subcategories
                            </label>
                            <p className="text-[11px] text-slate-400">
                              Select your categories, then choose the subcategories you can provide.
                            </p>
                          </div>
                          {selectedCategoryIds.length > 0 || selectedSubcategoryIds.length > 0 ? (
                            <span className="self-start sm:self-auto inline-flex items-center gap-1.5 rounded-full bg-brand/10 border border-brand/20 px-2.5 py-0.5 text-[10px] font-extrabold text-brand">
                              <Check className="h-3 w-3 stroke-[3]" />
                              {selectedCategoryIds.length} {selectedCategoryIds.length === 1 ? 'Category' : 'Categories'} • {selectedSubcategoryIds.length} {selectedSubcategoryIds.length === 1 ? 'Subcategory' : 'Subcategories'}
                            </span>
                          ) : (
                            <span className="self-start sm:self-auto rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-500">
                              0 Selected
                            </span>
                          )}
                        </div>

                        <div className="space-y-2.5">
                          {categoryGroups.length === 0 ? (
                            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center">
                              <RefreshCw className="h-5 w-5 text-brand animate-spin mx-auto mb-2" />
                              <p className="text-xs font-medium text-slate-500">Loading service categories...</p>
                            </div>
                          ) : (
                            categoryGroups.map((group) => {
                              const gId = String(group._id)
                              const isCatSelected = selectedCategoryIds.includes(gId)
                              const isCatExpanded = expandedCategoryIds.includes(gId) || isCatSelected
                              const subcats = group.categories || []
                              const selectedSubcatsInGroup = subcats.filter((sc) =>
                                selectedSubcategoryIds.includes(String(sc._id))
                              )
                              const visual = getCategoryVisual(group.name)
                              const CategoryIcon = visual.Icon

                              return (
                                <div
                                  key={group._id}
                                  className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                                    isCatSelected
                                      ? 'border-brand/40 bg-gradient-to-b from-brand/5 via-white to-white shadow-xs ring-1 ring-brand/20'
                                      : 'border-slate-200 bg-white hover:border-slate-300'
                                  }`}
                                >
                                  {/* Category Header Row */}
                                  <div
                                    onClick={() => {
                                      if (!isCatSelected) {
                                        setSelectedCategoryIds((prev) => [...prev, gId])
                                        setExpandedCategoryIds((prev) => Array.from(new Set([...prev, gId])))
                                      } else {
                                        setExpandedCategoryIds((prev) =>
                                          prev.includes(gId) ? prev.filter((id) => id !== gId) : [...prev, gId]
                                        )
                                      }
                                    }}
                                    className="flex items-center justify-between p-3 sm:p-3.5 cursor-pointer select-none gap-2.5"
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                      {/* Category Multi-select Checkbox */}
                                      <button
                                        type="button"
                                        aria-label={`Select category ${group.name}`}
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          if (isCatSelected) {
                                            const subcatIdsToRemove = new Set(subcats.map((s) => String(s._id)))
                                            setSelectedCategoryIds((prev) => prev.filter((id) => id !== gId))
                                            setSelectedSubcategoryIds((scPrev) =>
                                              scPrev.filter((id) => !subcatIdsToRemove.has(id))
                                            )
                                            setExpandedCategoryIds((prev) => prev.filter((id) => id !== gId))
                                          } else {
                                            setSelectedCategoryIds((prev) => [...prev, gId])
                                            setExpandedCategoryIds((prev) => Array.from(new Set([...prev, gId])))
                                          }
                                        }}
                                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-lg border transition ${
                                          isCatSelected
                                            ? 'bg-brand border-brand text-white shadow-xs'
                                            : 'border-slate-300 bg-white hover:border-slate-400'
                                        }`}
                                      >
                                        {isCatSelected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                                      </button>

                                      {/* Category Icon Badge */}
                                      <div
                                        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border ${visual.bg} ${visual.color} shadow-xs`}
                                      >
                                        <CategoryIcon className="h-4 w-4" />
                                      </div>

                                      {/* Category Title & Info */}
                                      <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                          <h4 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug">
                                            {group.name}
                                          </h4>
                                          {isCatSelected && (
                                            <span className="rounded-full bg-brand/15 px-2 py-0.2 text-[10px] font-extrabold text-brand">
                                              {selectedSubcatsInGroup.length}/{subcats.length} Selected
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-[11px] text-slate-400 mt-0.5">
                                          {subcats.length} subcategories available
                                        </p>
                                      </div>
                                    </div>

                                    {/* Chevron expand/collapse toggle */}
                                    <button
                                      type="button"
                                      aria-label="Toggle subcategories"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setExpandedCategoryIds((prev) =>
                                          prev.includes(gId) ? prev.filter((id) => id !== gId) : [...prev, gId]
                                        )
                                      }}
                                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg hover:bg-slate-100 transition text-slate-400 hover:text-slate-600"
                                    >
                                      <ChevronDown
                                        className={`h-4 w-4 transition-transform duration-200 ${
                                          isCatExpanded ? 'rotate-180 text-brand' : ''
                                        }`}
                                      />
                                    </button>
                                  </div>

                                  {/* Subcategories Container (Shown when Category is Expanded/Selected) */}
                                  <AnimatePresence>
                                    {isCatExpanded && (
                                      <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className="border-t border-slate-100 bg-slate-50/75 p-2.5 sm:p-3"
                                      >
                                        <div className="flex items-center justify-between mb-2 px-1">
                                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                            Choose Subcategories ({selectedSubcatsInGroup.length} of {subcats.length})
                                          </span>
                                          <div className="flex items-center gap-2">
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                const allIds = subcats.map((s) => String(s._id))
                                                setSelectedSubcategoryIds((prev) =>
                                                  Array.from(new Set([...prev, ...allIds]))
                                                )
                                                setSelectedCategoryIds((prev) =>
                                                  Array.from(new Set([...prev, gId]))
                                                )
                                                setExpandedCategoryIds((prev) =>
                                                  Array.from(new Set([...prev, gId]))
                                                )
                                              }}
                                              className="text-[10px] font-bold text-brand hover:underline"
                                            >
                                              Select All
                                            </button>
                                            <span className="text-slate-300">|</span>
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation()
                                                const removeSet = new Set(subcats.map((s) => String(s._id)))
                                                setSelectedSubcategoryIds((prev) =>
                                                  prev.filter((id) => !removeSet.has(id))
                                                )
                                              }}
                                              className="text-[10px] font-bold text-slate-500 hover:text-slate-800 hover:underline"
                                            >
                                              Clear
                                            </button>
                                          </div>
                                        </div>

                                        <div className="space-y-1.5">
                                          {subcats.map((sc) => {
                                            const scId = String(sc._id)
                                            const isSubChecked = selectedSubcategoryIds.includes(scId)
                                            const servicesCount = sc.services?.length || 0

                                            return (
                                              <button
                                                type="button"
                                                key={sc._id}
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  setSelectedSubcategoryIds((prev) => {
                                                    const next = prev.includes(scId)
                                                      ? prev.filter((x) => x !== scId)
                                                      : [...prev, scId]
                                                    if (!prev.includes(scId)) {
                                                      // Auto-select parent category if not selected
                                                      setSelectedCategoryIds((catPrev) =>
                                                        Array.from(new Set([...catPrev, gId]))
                                                      )
                                                    }
                                                    return next
                                                  })
                                                }}
                                                className={`w-full flex items-center justify-between gap-2.5 rounded-xl border p-2.5 text-left transition ${
                                                  isSubChecked
                                                    ? 'border-brand/40 bg-white text-slate-900 shadow-xs ring-1 ring-brand/15'
                                                    : 'border-slate-200/90 bg-white/90 hover:border-slate-300 text-slate-700'
                                                }`}
                                              >
                                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                  <div
                                                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-md border transition ${
                                                      isSubChecked
                                                        ? 'bg-brand border-brand text-white'
                                                        : 'border-slate-300 bg-white'
                                                    }`}
                                                  >
                                                    {isSubChecked && <Check className="h-3 w-3 stroke-[3]" />}
                                                  </div>

                                                  <span className="text-xs font-semibold leading-snug text-slate-800 break-words">
                                                    {sc.name}
                                                  </span>
                                                </div>

                                                {servicesCount > 0 && (
                                                  <span className="shrink-0 rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">
                                                    {servicesCount} {servicesCount === 1 ? 'service' : 'services'}
                                                  </span>
                                                )}
                                              </button>
                                            )
                                          })}
                                        </div>
                                      </motion.div>
                                    )}
                                  </AnimatePresence>
                                </div>
                              )
                            })
                          )}
                        </div>
                      </div>

                      {/* Experience in Years */}
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                          Years of Service Experience
                        </label>
                        <div className="grid grid-cols-5 gap-1 sm:gap-2">
                          {[1, 2, 3, 5, 8].map((yr) => (
                            <button
                              type="button"
                              key={yr}
                              onClick={() => setExperienceYears(yr)}
                              className={`rounded-xl py-2 text-[10px] sm:text-xs font-bold border transition text-center ${
                                experienceYears === yr
                                  ? 'border-brand bg-brand text-white shadow-xs'
                                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              {yr} {yr === 1 ? 'Yr' : 'Yrs'}
                            </button>
                          ))}
                        </div>
                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                          <span className="text-xs text-slate-500">Or custom years:</span>
                          <input
                            type="number"
                            min="0"
                            max="50"
                            value={experienceYears}
                            onChange={(e) => setExperienceYears(Number(e.target.value))}
                            className="w-20 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-bold text-slate-800 outline-none focus:border-brand"
                          />
                          <span className="text-xs font-medium text-slate-400">years</span>
                        </div>
                      </div>

                      {/* Submit Action */}
                      <button
                        type="submit"
                        disabled={submitting || selectedCategoryIds.length === 0}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-xs font-bold text-white shadow-md shadow-brand/20 transition hover:bg-brand-600 disabled:opacity-50"
                      >
                        {submitting ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        <span>{step1.completed ? 'Update Application' : 'Submit Application (Step 1)'}</span>
                      </button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* STEP 2: Complete KYC Verification */}
        <div className="relative z-10">
          <div className="flex items-start gap-3 sm:gap-4">
            {/* Stepper Node Icon */}
            <div
              className={`flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full border-2 transition-all shadow-xs ${
                step2.completed
                  ? 'border-emerald-500 bg-emerald-500 text-white'
                  : currentStep === 2
                  ? 'border-orange-500 bg-orange-500 text-white ring-4 ring-orange-100'
                  : 'border-slate-300 bg-white text-slate-400'
              }`}
            >
              {step2.completed ? (
                <Check className="h-4 w-4 stroke-[3]" />
              ) : currentStep === 2 ? (
                <Clock className="h-4 w-4 stroke-[2.5] animate-pulse" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-slate-300" />
              )}
            </div>

            {/* Stepper Content */}
            <div className="min-w-0 flex-1">
              <button
                type="button"
                disabled={!step1.completed}
                onClick={() => setExpandedStep(expandedStep === 2 ? null : 2)}
                className={`flex w-full items-center justify-between text-left group ${
                  !step1.completed ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <div>
                  <p className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    STEP 2 • 3 MIN
                  </p>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 group-hover:text-brand transition">
                    Aadhaar & PAN KYC Verification
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  {step2.completed ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      Submitted
                    </span>
                  ) : !step1.completed ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                      Locked
                    </span>
                  ) : (
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-800">
                      Action Required
                    </span>
                  )}
                  {expandedStep === 2 ? (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  )}
                </div>
              </button>

              {/* Collapsible Card */}
              <AnimatePresence>
                {expandedStep === 2 && step1.completed && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm"
                  >
                    <p className="text-xs text-slate-600 mb-3 leading-relaxed">
                      Enter your Government Aadhaar and PAN card details for legal identity verification.
                    </p>

                    <form onSubmit={handleSubmitStep2} className="space-y-3">
                      {/* Aadhaar Input */}
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                          Aadhaar Number (12 Digits)
                        </label>
                        <input
                          type="text"
                          maxLength={12}
                          value={aadhaarInput}
                          onChange={(e) => setAadhaarInput(e.target.value.replace(/\D/g, ''))}
                          placeholder="e.g. 5432 8765 1290"
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono font-bold tracking-wider text-slate-800 outline-none focus:border-brand"
                        />
                      </div>

                      {/* PAN Input */}
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                          PAN Card Number (10 Characters)
                        </label>
                        <input
                          type="text"
                          maxLength={10}
                          value={panInput}
                          onChange={(e) => setPanInput(e.target.value.toUpperCase())}
                          placeholder="e.g. ABCDE1234F"
                          className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono font-bold tracking-wider text-slate-800 uppercase outline-none focus:border-brand"
                        />
                      </div>

                      {/* Document / Photo Upload */}
                      <div>
                        <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                          Document Proof / Card Photo
                        </label>
                        <div className="flex items-center gap-2">
                          <label className="flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 p-2.5 text-xs text-slate-600 hover:border-brand hover:bg-slate-50">
                            {uploadingKyc ? (
                              <RefreshCw className="h-4 w-4 animate-spin text-brand" />
                            ) : (
                              <UploadCloud className="h-4 w-4 text-brand" />
                            )}
                            <span>{kycDocUrl ? 'Document Attached ✓' : 'Upload Card Photo'}</span>
                            <input
                              type="file"
                              accept="image/*,video/*"
                              onChange={handleKycFileUpload}
                              className="hidden"
                            />
                          </label>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={submitting || aadhaarInput.length !== 12 || panInput.length !== 10}
                        className="w-full flex items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-xs font-bold text-white shadow-md shadow-brand/20 transition hover:bg-brand-600 disabled:opacity-50"
                      >
                        {submitting ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <ShieldCheck className="h-4 w-4" />
                        )}
                        <span>Complete KYC Verification</span>
                      </button>
                    </form>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* STEP 3: Approval and Verification by Admin */}
        <div className="relative z-10">
          <div className="flex items-start gap-3 sm:gap-4">
            {/* Stepper Node Icon */}
            <div
              className={`flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full border-2 transition-all shadow-xs ${
                step3.isApproved
                  ? 'border-emerald-500 bg-emerald-500 text-white'
                  : step3.isPending
                  ? 'border-orange-500 bg-orange-500 text-white ring-4 ring-orange-100'
                  : 'border-slate-300 bg-white text-slate-400'
              }`}
            >
              {step3.isApproved ? (
                <Check className="h-4 w-4 stroke-[3]" />
              ) : step3.isPending ? (
                <Clock className="h-4 w-4 stroke-[2.5] animate-pulse" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-slate-300" />
              )}
            </div>

            {/* Stepper Content */}
            <div className="min-w-0 flex-1">
              <button
                type="button"
                disabled={!step2.completed}
                onClick={() => setExpandedStep(expandedStep === 3 ? null : 3)}
                className={`flex w-full items-center justify-between text-left group ${
                  !step2.completed ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <div>
                  <p className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    STEP 3 • APPROVAL
                  </p>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 group-hover:text-brand transition">
                    Admin Approval & Verification
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  {step3.isApproved ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      Approved ✓
                    </span>
                  ) : step3.isPending ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                      Pending
                    </span>
                  ) : step3.isFailed ? (
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                      Action Needed
                    </span>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                      Locked
                    </span>
                  )}
                  {expandedStep === 3 ? (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  )}
                </div>
              </button>

              {/* Collapsible Card */}
              <AnimatePresence>
                {expandedStep === 3 && step2.completed && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm space-y-3"
                  >
                    {step3.isApproved ? (
                      /* Approved State */
                      <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3.5 text-emerald-950">
                        <div className="flex items-center gap-2 font-bold text-xs text-emerald-900">
                          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                          <span>Notification: Approved by Admin!</span>
                        </div>
                        <p className="mt-1 text-[11px] text-emerald-700 leading-snug">
                          Your profile, trade categories, Aadhaar, and PAN have been verified. You can now schedule your practical trial slot.
                        </p>
                      </div>
                    ) : step3.isFailed ? (
                      /* Failed State */
                      <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3.5 text-rose-950">
                        <div className="flex items-center gap-2 font-bold text-xs text-rose-900">
                          <AlertTriangle className="h-4 w-4 text-rose-600" />
                          <span>Notification: Document Resubmission Needed</span>
                        </div>
                        <p className="mt-1 text-[11px] text-rose-700 leading-snug">
                          {step3.reviewNote || 'The admin team requested a clearer document scan. Please resubmit in Step 2.'}
                        </p>
                        <button
                          type="button"
                          onClick={() => setExpandedStep(2)}
                          className="mt-2 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-rose-700"
                        >
                          Resubmit KYC Documents
                        </button>
                      </div>
                    ) : (
                      /* Pending State */
                      <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5 text-amber-950">
                        <div className="flex items-center gap-2 font-bold text-xs text-amber-900">
                          <Clock className="h-4 w-4 text-amber-600" />
                          <span>Notification: Verification Pending</span>
                        </div>
                        <p className="mt-1 text-[11px] text-amber-700 leading-snug">
                          Our administrative verification desk is actively evaluating your Aadhaar and PAN documents. Approval typically takes under 24 hours.
                        </p>
                        <div className="mt-3 flex items-center justify-between pt-2 border-t border-amber-200/60">
                          <span className="text-[10px] text-amber-800">Checked just now</span>
                          <button
                            type="button"
                            onClick={loadStatus}
                            className="inline-flex items-center gap-1 rounded-md bg-amber-200/70 px-2.5 py-1 text-[11px] font-bold text-amber-900 hover:bg-amber-300"
                          >
                            <RefreshCw className="h-3 w-3" /> Refresh Status
                          </button>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* STEP 4: Trial Slot & Joining Confirmation */}
        <div className="relative z-10">
          <div className="flex items-start gap-3 sm:gap-4">
            {/* Stepper Node Icon */}
            <div
              className={`flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full border-2 transition-all shadow-xs ${
                step4.completed && step4.paymentComplete
                  ? 'border-emerald-500 bg-emerald-500 text-white'
                  : step3.isApproved
                  ? 'border-orange-500 bg-orange-500 text-white ring-4 ring-orange-100'
                  : 'border-slate-300 bg-white text-slate-400'
              }`}
            >
              {step4.completed && step4.paymentComplete ? (
                <Check className="h-4 w-4 stroke-[3]" />
              ) : step3.isApproved ? (
                <Clock className="h-4 w-4 stroke-[2.5] animate-pulse" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-slate-300" />
              )}
            </div>

            {/* Stepper Content */}
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={() => setExpandedStep(expandedStep === 4 ? null : 4)}
                className="flex w-full items-center justify-between text-left group"
              >
                <div>
                  <p className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    STEP 4 • TRIAL & CONFIRMATION
                  </p>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 group-hover:text-brand transition">
                    Trial Slot & Joining Confirmation
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  {step4.completed && step4.paymentComplete ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      Paid & Confirmed
                    </span>
                  ) : step4.completed ? (
                    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                      Kit Payment Due
                    </span>
                  ) : step4.trialSlot?.status === 'SCHEDULED' ? (
                    <span className="rounded-full bg-cyan-100 px-2 py-0.5 text-[10px] font-bold text-cyan-800">
                      Slot Booked
                    </span>
                  ) : (
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-800">
                      Schedule Slot
                    </span>
                  )}
                  {expandedStep === 4 ? (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  )}
                </div>
              </button>

              {/* Collapsible Card */}
              <AnimatePresence>
                {expandedStep === 4 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm space-y-4"
                  >
                    {!step3.isApproved && (
                      <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200/80 p-2.5 text-xs text-amber-900">
                        <Info className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                        <span className="text-[11px] font-medium leading-snug">
                          Your KYC documents are in review. You can select and book your preferred trial timing slot below in advance.
                        </span>
                      </div>
                    )}
                    {/* Trial Slot Section */}
                    <div>
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-extrabold uppercase tracking-wide text-slate-700 flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-brand" /> Trial Slot Details
                        </h4>
                        <button
                          type="button"
                          onClick={handleRefreshSlots}
                          className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-bold text-brand hover:bg-brand/10 transition"
                          title="Refresh slots from admin"
                        >
                          <RefreshCw className={`h-3 w-3 ${loadingSlots ? 'animate-spin' : ''}`} />
                          <span>Refresh</span>
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        Schedule your practical demonstration slot at an A2Z partner evaluation hub.
                      </p>

                      {step4.trialSlot?.status === 'SCHEDULED' && !step4.completed && (
                        <div className="mt-3 rounded-xl border border-cyan-200 bg-cyan-50/70 p-3 text-cyan-950">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-xs font-bold text-cyan-900">
                              <Clock className="h-4 w-4 text-cyan-600" /> Appointment Booked
                            </span>
                            <span className="rounded-full bg-cyan-200/80 px-2 py-0.5 text-[9px] font-extrabold uppercase text-cyan-800">
                              Scheduled
                            </span>
                          </div>
                          <div className="mt-2 text-[11px] text-cyan-900 space-y-0.5 bg-white/70 p-2 rounded-lg border border-cyan-100">
                            <p><span className="font-semibold text-slate-600">Date:</span> {step4.trialSlot.date}</p>
                            <p><span className="font-semibold text-slate-600">Timing:</span> {step4.trialSlot.timeSlot}</p>
                            <p><span className="font-semibold text-slate-600">Hub:</span> {step4.trialSlot.location || step4.defaultHubLocation}</p>
                          </div>
                          <p className="mt-2 text-[10px] text-cyan-700 leading-snug">
                            Please visit the evaluation hub at your scheduled timing for your practical demo. The center evaluator will grade your demo and approve your joining from the Admin panel.
                          </p>
                        </div>
                      )}

                      <form onSubmit={handleScheduleTrial} className="mt-3 space-y-3.5">
                        {/* Slot Date */}
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                            Slot Date
                          </label>
                          <input
                            type="date"
                            value={trialDate}
                            onChange={(e) => setTrialDate(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-brand shadow-xs"
                          />
                        </div>

                        {/* Time Slot Selection (Stays 100% inside screen & dynamic from Admin) */}
                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                            Select Time Slot
                          </label>
                          <div className="space-y-1.5">
                            {dynamicSlots.length > 0 ? (
                              dynamicSlots.map((slot) => {
                                const isSelected = trialTimeSlot === slot.id || trialTimeSlot === slot.label
                                return (
                                  <button
                                    type="button"
                                    key={slot.id}
                                    onClick={() => setTrialTimeSlot(slot.id)}
                                    className={`w-full flex items-center justify-between rounded-xl border p-2.5 text-left transition ${
                                      isSelected
                                        ? 'border-brand bg-brand/10 text-brand ring-1 ring-brand/20 shadow-xs'
                                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                      <div
                                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition ${
                                          isSelected
                                            ? 'border-brand bg-brand text-white'
                                            : 'border-slate-300 bg-white'
                                        }`}
                                      >
                                        {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-xs font-bold leading-tight">{slot.label}</p>
                                        {slot.desc && <p className="text-[10px] text-slate-400 mt-0.5">{slot.desc}</p>}
                                      </div>
                                    </div>
                                    {isSelected && (
                                      <span className="shrink-0 rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-extrabold text-brand">
                                        Selected
                                      </span>
                                    )}
                                  </button>
                                )
                              })
                            ) : (
                              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-center">
                                <Clock className="mx-auto h-5 w-5 text-slate-400 mb-1" />
                                <p className="text-xs font-bold text-slate-700">No Trial Slots Available</p>
                                <p className="text-[11px] text-slate-500 mt-0.5">
                                  No slots are currently configured. Please check back shortly as the admin schedules evaluation timings.
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                            Hub / Center Location Address
                          </label>
                          <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50/70 p-2.5 text-xs text-slate-700">
                            <MapPin className="h-4 w-4 shrink-0 text-brand mt-0.5" />
                            <span className="text-[11px] font-medium leading-snug break-words">
                              {trialLocation}
                            </span>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                          <button
                            type="submit"
                            disabled={submitting || dynamicSlots.length === 0}
                            className="flex-1 rounded-xl bg-slate-900 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {dynamicSlots.length === 0
                              ? 'No Slots Available'
                              : step4.trialSlot?.status === 'SCHEDULED'
                              ? 'Update Trial Slot'
                              : 'Confirm Trial Slot'}
                          </button>

                          {/* Check Evaluation Status button (evaluation is performed by Admin) */}
                          {step4.trialSlot?.status === 'SCHEDULED' && !step4.completed && (
                            <button
                              type="button"
                              onClick={loadStatus}
                              disabled={loading}
                              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-cyan-200 bg-cyan-50 px-3.5 py-2.5 text-[11px] font-bold text-cyan-900 hover:bg-cyan-100 transition text-center"
                              title="Check if Admin has completed your practical evaluation"
                            >
                              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                              <span>Check Evaluation Status</span>
                            </button>
                          )}
                        </div>
                      </form>
                    </div>

                    {/* After the Trial: Joining Confirmation Notice */}
                    {step4.completed && (
                      <div className="rounded-2xl border border-emerald-300 bg-gradient-to-br from-emerald-50 via-teal-50 to-white p-3.5 shadow-2xs">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white">
                            <Award className="h-4 w-4" />
                          </div>
                          <div>
                            <span className="rounded-full bg-emerald-200/80 px-2 py-0.2 text-[9px] font-extrabold uppercase text-emerald-800">
                              Joining Confirmed
                            </span>
                            <h4 className="text-xs font-bold text-emerald-950 mt-0.5">
                              Joining Confirmation Notification
                            </h4>
                          </div>
                        </div>

                        <div className="mt-2.5 rounded-xl bg-white/80 p-2.5 text-[11px] text-emerald-900 border border-emerald-200/60 leading-relaxed">
                          <strong>Your account will be activated;</strong> however, you will not receive any bookings until you have your welcome kit.
                        </div>
                      </div>
                    )}

                    {/* Payment for Welcome Kit */}
                    {step4.completed && (
                      <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50/60 via-orange-50/30 to-white p-3.5">
                        <div className="flex items-center justify-between pb-2 border-b border-amber-100">
                          <div className="flex items-center gap-1.5 text-amber-950">
                            <Package className="h-4 w-4 text-amber-600" />
                            <h4 className="text-xs font-black uppercase tracking-wide">
                              Make Payment for Welcome Kit
                            </h4>
                          </div>
                          <span className="text-xs font-black text-amber-700">₹999</span>
                        </div>

                        <p className="mt-2 text-[11px] text-slate-600 leading-snug">
                          Covers branded uniform, partner ID lanyard, toolkit gear bag, and starter consumables kit.
                        </p>

                        {/* Payment Method Tabs */}
                        <div className="mt-3 grid grid-cols-2 gap-1 rounded-xl border border-amber-200 bg-amber-50/50 p-1">
                          <button
                            type="button"
                            onClick={() => setPaymentTab('OFFLINE')}
                            className={`rounded-lg py-1.5 px-1 text-[11px] sm:text-xs font-bold transition text-center truncate ${
                              paymentTab === 'OFFLINE'
                                ? 'bg-white text-slate-900 shadow-xs'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            Offline / Hub Bill
                          </button>
                          <button
                            type="button"
                            onClick={() => setPaymentTab('ONLINE')}
                            className={`rounded-lg py-1.5 px-1 text-[11px] sm:text-xs font-bold transition text-center truncate ${
                              paymentTab === 'ONLINE'
                                ? 'bg-white text-slate-900 shadow-xs'
                                : 'text-slate-500 hover:text-slate-800'
                            }`}
                          >
                            Online (UPI / Card)
                          </button>
                        </div>

                        {paymentTab === 'OFFLINE' ? (
                          <div className="mt-3 space-y-2.5">
                            <div className="flex items-start gap-2 rounded-xl bg-white p-2.5 border border-slate-200 text-xs text-slate-700">
                              <QrCode className="h-8 w-8 text-slate-800 shrink-0" />
                              <div className="text-[11px] leading-tight">
                                <p className="font-bold text-slate-900">Center QR / Hub Payment</p>
                                <p className="text-slate-500 mt-0.5">Pay ₹999 at the center desk or scan QR, then upload the receipt screenshot.</p>
                              </div>
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                Upload Bill or Screenshot
                              </label>
                              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-amber-300 bg-white p-3 text-xs text-amber-900 hover:bg-amber-50">
                                {uploadingBill ? (
                                  <RefreshCw className="h-4 w-4 animate-spin text-amber-600" />
                                ) : (
                                  <Upload className="h-4 w-4 text-amber-600" />
                                )}
                                <span>{billReceiptUrl ? 'Screenshot Uploaded ✓' : 'Tap to Upload Screenshot'}</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={handleBillFileUpload}
                                  className="hidden"
                                />
                              </label>
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                Delivery Address for Kit Dispatch
                              </label>
                              <input
                                type="text"
                                value={deliveryAddress}
                                onChange={(e) => setDeliveryAddress(e.target.value)}
                                placeholder="House/Flat No, Street, Area"
                                className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-brand"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={handleSubmitWelcomeKitPayment}
                              disabled={submitting || !billReceiptUrl}
                              className="w-full rounded-xl bg-amber-500 py-2.5 text-xs font-bold text-white shadow-md shadow-amber-500/20 hover:bg-amber-600 disabled:opacity-50"
                            >
                              Submit Payment & Proceed
                            </button>
                          </div>
                        ) : (
                          <div className="mt-3 space-y-2.5">
                            <div className="rounded-xl bg-white p-2.5 border border-slate-200 text-xs text-slate-700">
                              <p className="font-bold text-slate-900">Instant Online Activation</p>
                              <p className="text-[11px] text-slate-500 mt-0.5">Pay ₹999 securely via UPI or Card to immediately authorize welcome kit dispatch.</p>
                            </div>

                            <div>
                              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                                Delivery Address for Kit Dispatch
                              </label>
                              <input
                                type="text"
                                value={deliveryAddress}
                                onChange={(e) => setDeliveryAddress(e.target.value)}
                                placeholder="House/Flat No, Street, Area"
                                className="w-full rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-brand"
                              />
                            </div>

                            <button
                              type="button"
                              onClick={handleSubmitWelcomeKitPayment}
                              disabled={submitting}
                              className="w-full flex items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700 disabled:opacity-50"
                            >
                              <CreditCard className="h-4 w-4" />
                              <span>Pay ₹999 & Authorize Dispatch</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* STEP 5: Welcome Kit & Booking Readiness */}
        <div className="relative z-10">
          <div className="flex items-start gap-3 sm:gap-4">
            {/* Stepper Node Icon */}
            <div
              className={`flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full border-2 transition-all shadow-xs ${
                step5.completed
                  ? 'border-emerald-500 bg-emerald-500 text-white'
                  : step4.completed && step4.paymentComplete
                  ? 'border-orange-500 bg-orange-500 text-white ring-4 ring-orange-100'
                  : 'border-slate-300 bg-white text-slate-400'
              }`}
            >
              {step5.completed ? (
                <Check className="h-4 w-4 stroke-[3]" />
              ) : step4.completed && step4.paymentComplete ? (
                <Clock className="h-4 w-4 stroke-[2.5] animate-pulse" />
              ) : (
                <span className="h-2 w-2 rounded-full bg-slate-300" />
              )}
            </div>

            {/* Stepper Content */}
            <div className="min-w-0 flex-1">
              <button
                type="button"
                disabled={!(step4.completed && step4.paymentComplete)}
                onClick={() => setExpandedStep(expandedStep === 5 ? null : 5)}
                className={`flex w-full items-center justify-between text-left group ${
                  !(step4.completed && step4.paymentComplete) ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <div>
                  <p className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                    STEP 5 • FINAL ACTIVATION
                  </p>
                  <h3 className="text-sm sm:text-base font-black text-slate-900 group-hover:text-brand transition">
                    Welcome Kit & Booking Activation
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  {step5.completed ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                      Active for Bookings 🚀
                    </span>
                  ) : !(step4.completed && step4.paymentComplete) ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                      Locked
                    </span>
                  ) : (
                    <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-800">
                      Dispatched
                    </span>
                  )}
                  {expandedStep === 5 ? (
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  )}
                </div>
              </button>

              {/* Collapsible Card */}
              <AnimatePresence>
                {expandedStep === 5 && step4.completed && step4.paymentComplete && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 overflow-hidden rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm space-y-4"
                  >
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-wide text-slate-800">
                        Official Welcome Kit Contents
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Once you receive the welcome kit, you are ready to accept bookings.
                      </p>

                      {/* 4 Items Grid */}
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {/* Uniform */}
                        <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                            <Shirt className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 leading-tight">Service Uniform</p>
                            <p className="text-[9px] text-slate-400">Branded T-Shirt / Apron</p>
                          </div>
                        </div>

                        {/* Tool Bag */}
                        <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                            <Briefcase className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 leading-tight">Gear Kit Bag</p>
                            <p className="text-[9px] text-slate-400">Heavy-duty Tool Bag</p>
                          </div>
                        </div>

                        {/* ID Card */}
                        <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                            <CreditCard className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 leading-tight">Partner ID Card</p>
                            <p className="text-[9px] text-slate-400">Credential & Lanyard</p>
                          </div>
                        </div>

                        {/* Products */}
                        <div className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600">
                            <Package className="h-4 w-4" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 leading-tight">Starter Products</p>
                            <p className="text-[9px] text-slate-400">Consumables & Supplies</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Delivery Address Details */}
                    <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs text-slate-700">
                      <div className="flex items-center gap-1.5 font-bold text-slate-800">
                        <Truck className="h-3.5 w-3.5 text-brand" />
                        <span>Delivery & Dispatch Address</span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1">
                        {deliveryAddress || 'Registered Hub Pickup / Current Partner Address'}
                      </p>
                    </div>

                    {/* Receipt Status / Confirm Action */}
                    {step5.completed ? (
                      <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-center">
                        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-white shadow-md">
                          <Sparkles className="h-5 w-5" />
                        </div>
                        <h4 className="mt-2 text-sm font-black text-emerald-950">
                          You Are Ready to Accept Bookings!
                        </h4>
                        <p className="mt-1 text-xs text-emerald-700">
                          Your profile is 100% verified and active. Customer bookings matching your trade will now appear in your live feed.
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            if (onFinish) onFinish()
                            else navigate('/app/jobs')
                          }}
                          className="mt-3 inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:bg-emerald-700"
                        >
                          <span>Go to Bookings Dashboard</span>
                          <ArrowRight className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={handleConfirmKitReceipt}
                          disabled={submitting}
                          className="w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 py-3 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:brightness-105"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                          <span>I Have Received My Welcome Kit</span>
                        </button>
                        <p className="text-center text-[10px] text-slate-400">
                          Tap after receiving your kit package or picking it up from the hub.
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
