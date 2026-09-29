import { useCallback, useEffect, useState, useRef, useMemo } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import {
  AlertCircle,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle2,
  ImagePlus,
  IndianRupee,
  MapPin,
  MapPinned,
  MessageCircle,
  Navigation,
  Phone,
  Star,
  Wallet,
  Zap,
  Trash2,
} from 'lucide-react'
import { AppStackScreenHeader } from '../../../components/app/AppStackScreenHeader.jsx'
import { AppButton } from '../../../components/app-ui/buttons/AppButton.jsx'
import { AppTextInput } from '../../../components/app-ui/inputs/AppTextInput.jsx'
import { AppSearchableSelect } from '../../../components/app-ui/inputs/AppSearchableSelect.jsx'
import { GlassPanel } from '../../../components/ui/GlassPanel.jsx'
import { fetchLabourCategoriesGrouped } from '../../../api/labourCategoriesApi.js'
import { bookingsApi } from '../../../api/bookingsApi.js'
import { paymentsApi } from '../../../api/paymentsApi.js'
import { getPublicSettings } from '../../../api/adminSettingsApi.js'
import { calculateCompletedBookingBill } from '../../../lib/completedBillingHelper.js'

function loadRazorpay() {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return }
    const script = document.createElement('script')
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'
    script.onload = () => resolve(true)
    script.onerror = () => resolve(false)
    document.body.appendChild(script)
  })
}
import { uploadMedia, assetUrlFromUpload } from '../../../api/uploadApi.js'
import { BookingFindingScreen } from '../../../components/app/booking/BookingFindingScreen.jsx'
import { BookingTypeSheet } from '../../../components/app/booking/BookingTypeSheet.jsx'
import { BookingStepProgress } from '../../../components/app/booking/BookingStepProgress.jsx'
import { BookingServiceHighlight } from '../../../components/app/booking/BookingServiceHighlight.jsx'
import { BookingReviewModal } from '../../../components/app/booking/BookingReviewModal.jsx'
import { useBookingSocket } from '../../../hooks/useBookingSocket.js'
import { useAuth } from '../../../hooks/useAuth.js'
import {
  PAYMENT_METHODS,
  durationKindLabel,
  durationKindToDays,
  formatDuration,
  formatInr,
  todayISODate,
  maxISODate,
} from '../../../lib/individualBookings.js'
import {
  clearBookingDraft,
  patchBookingDraft,
  readBookingDraft,
  writeBookingDraft,
} from '../../../lib/individualBookingDraft.js'
import { readAppUserLocation, writeAppUserLocation } from '../../../lib/appUserLocationStorage.js'
import {
  APP_HOME_LOCATION,
  BOOKING_FLOW_PATH,
  buildBookingFlowPath,
} from '../../../lib/bookingFlowNavigation.js'

const TIME_SLOTS = ['9:00 AM – 12:00 PM', '12:00 PM – 3:00 PM', '3:00 PM – 6:00 PM', '6:00 PM – 9:00 PM']

function FieldLabel({ children, optional, htmlFor }) {
  const Tag = htmlFor ? 'label' : 'div'
  return (
    <Tag className="lc-booking-flow-label" htmlFor={htmlFor}>
      {children}
      {optional ? <span className="lc-booking-flow-muted font-normal"> (optional)</span> : null}
    </Tag>
  )
}

function BookingPrimaryButton({ children, className = '', ...rest }) {
  return (
    <button type="button" className={`lc-booking-btn-primary ${className}`} {...rest}>
      {children}
    </button>
  )
}

export function IndividualBookingFlowPage() {
  const navigate = useNavigate()
  const { realUser } = useAuth()
  const location = useLocation()
  const reduce = useReducedMotion()
  const [searchParams] = useSearchParams()
  const step = searchParams.get('step') || 'type'

  const categoryIdParam = searchParams.get('categoryId')?.trim() || ''
  const groupIdParam = searchParams.get('groupId')?.trim() || ''
  const bookingIdParam = searchParams.get('bookingId')?.trim() || ''

  const [draft, setDraft] = useState(() => readBookingDraft() || {})
  const [formError, setFormError] = useState('')
  const [typeSheetOpen, setTypeSheetOpen] = useState(false)
  const [activeBookingId, setActiveBookingId] = useState(() => bookingIdParam || readBookingDraft()?.lastRef || null)
  const [activeBooking, setActiveBooking] = useState(null)
  
  useEffect(() => {
    if (bookingIdParam && bookingIdParam !== activeBookingId) {
      setActiveBookingId(bookingIdParam)
    }
  }, [bookingIdParam, activeBookingId])

  const [noMatch, setNoMatch] = useState(false)
  const [imageFiles, setImageFiles] = useState([])
  const [availableServicesList, setAvailableServicesList] = useState([])

  const contractorServiceNames = useMemo(() => {
    if (realUser?.role !== 'contractor' || !draft.contractorServices) return ''
    return draft.contractorServices
      .map(cs => {
        const found = availableServicesList.find(s => s.value === cs.serviceId)
        return found ? found.name : ''
      })
      .filter(Boolean)
      .join(', ')
  }, [realUser, draft.contractorServices, availableServicesList])

  const [calculatedBill, setCalculatedBill] = useState(null)
  const [isCalculating, setIsCalculating] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [reviewQueue, setReviewQueue] = useState([])
  const [currentReviewIndex, setCurrentReviewIndex] = useState(0)
  const [paymentSuccess, setPaymentSuccess] = useState(false)

  const handleOpenReview = useCallback(() => {
    if (realUser?.role === 'contractor' && activeBooking?.assignments?.length > 0) {
      setReviewQueue(activeBooking.assignments.map(a => a.labourId).filter(Boolean))
      setCurrentReviewIndex(0)
    } else {
      setReviewQueue([])
    }
    setReviewOpen(true)
  }, [realUser, activeBooking])

  const handleReviewSubmitted = useCallback(() => {
    if (reviewQueue.length > 0 && currentReviewIndex < reviewQueue.length - 1) {
      // Force modal to briefly close and reopen for animation / reset
      setReviewOpen(false)
      setTimeout(() => {
        setCurrentReviewIndex(prev => prev + 1)
        setReviewOpen(true)
      }, 300)
    } else {
      setReviewOpen(false)
      clearBookingDraft()
      navigate('/app', { replace: true })
    }
  }, [reviewQueue, currentReviewIndex, navigate, clearBookingDraft])


  const inputRef = useRef(null)
  const autocompleteRef = useRef(null)
  const [mapsLoaded, setMapsLoaded] = useState(false)
  const [forceInput, setForceInput] = useState(false)
  const mapRef = useRef(null)
  const mapInstance = useRef(null)
  const markerInstance = useRef(null)


  const { bookingEvent } = useBookingSocket(activeBookingId)

  const syncDraft = useCallback((patch) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch }
      writeBookingDraft(next)
      return next
    })
  }, [])

  const flowQuery = useCallback(
    () => ({
      categoryId: draft.categoryId || categoryIdParam,
      groupId: draft.groupId || groupIdParam,
    }),
    [categoryIdParam, draft.categoryId, draft.groupId, groupIdParam],
  )

  const goStep = useCallback(
    (nextStep) => {
      navigate(buildBookingFlowPath(nextStep, flowQuery()), { replace: true })
    },
    [flowQuery, navigate],
  )

  const leaveFlow = useCallback(() => {
    navigate(APP_HOME_LOCATION, { replace: true })
  }, [navigate])

  useEffect(() => {
    const stored = readBookingDraft()
    if (stored) queueMicrotask(() => setDraft(stored))
  }, [])

  useEffect(() => {
    if (!autocompleteRef.current) return
    const handleSelect = async (e) => {
      if (!e.place) return
      await e.place.fetchFields({ fields: ['location', 'formattedAddress', 'displayName'] })
      if (e.place.location) {
        syncDraft({
          lat: e.place.location.lat(),
          lng: e.place.location.lng(),
          address: e.place.formattedAddress || e.place.displayName || ''
        })
        setForceInput(true)
      }
    }
    const current = autocompleteRef.current
    current.addEventListener('gmp-placeselect', handleSelect)
    return () => current.removeEventListener('gmp-placeselect', handleSelect)
  }, [mapsLoaded, syncDraft])

  useEffect(() => {
    if (draft.address) setForceInput(true)
  }, [draft.address])

  useEffect(() => {
    if (!categoryIdParam && !groupIdParam) return
    const patch = {}
    if (categoryIdParam) patch.categoryId = categoryIdParam
    if (groupIdParam) patch.groupId = groupIdParam
    syncDraft(patch)
  }, [categoryIdParam, groupIdParam, syncDraft])

  useEffect(() => {
    if (activeBookingId && !activeBooking && realUser) {
      bookingsApi.getBookingStatus(activeBookingId).then(res => {
        if (res.data?.booking) setActiveBooking(res.data.booking)
      }).catch(err => console.error(err))
    }
  }, [activeBookingId, activeBooking, realUser])


  useEffect(() => {
    if (!bookingEvent) return
    if (bookingEvent.type === 'BOOKING_ACCEPTED') {
      goStep('active')
      if (realUser) {
        bookingsApi.getBookingStatus(activeBookingId).then(res => {
          if (res.data?.booking) setActiveBooking(res.data.booking)
        }).catch(err => console.error(err))
      }
    } else if (bookingEvent.type === 'BOOKING_FAILED') {
      setNoMatch(true)
    } else if (bookingEvent.type === 'BOOKING_STATUS_UPDATE') {
      const newStatus = bookingEvent.data?.status
      setActiveBooking(prev => prev ? { ...prev, status: newStatus } : null)
      if (newStatus === 'COMPLETED') {
        // Refresh booking details
        if (realUser) {
          bookingsApi.getBookingStatus(activeBookingId).then(res => {
            if (res.data?.booking) {
              setActiveBooking(res.data.booking)
              const b = res.data.booking
              if (b.paymentStatus === 'PAID') {
                handleOpenReview()
              }
            }
          }).catch(() => { })
        }
      }
    }
  }, [bookingEvent, activeBookingId, goStep, realUser])

  useEffect(() => {
    const cid = categoryIdParam
    const gid = groupIdParam
    if (!cid) return

    const current = readBookingDraft()
    if (current?.categoryName && (!gid || current?.groupName) && current?.minHours !== undefined) return

    let cancelled = false
    const loc = readAppUserLocation()
    fetchLabourCategoriesGrouped(loc?.lat, loc?.lng, loc?.city, loc?.address)
      .then((res) => {
        if (cancelled) return
        const groups = res.data?.groups ?? []
        for (const g of groups) {
          if (gid && String(g._id) !== gid) continue
          const cat = (g.categories || []).find((c) => String(c._id) === String(cid))
          if (cat) {
            const srv = current?.serviceId ? (cat.services || []).find(s => String(s._id) === current.serviceId) : (cat.services || [])[0]
            syncDraft({
              categoryId: String(cat._id),
              serviceId: srv ? String(srv._id) : String(cat._id),
              categoryName: cat.name || '',
              serviceName: srv ? srv.name : '',
              groupId: String(g._id),
              groupName: g.name || '',
              minHours: srv?.minHours ?? 1,
              maxHours: srv?.maxHours ?? 24,
            })
            return
          }
        }
      })
      .catch(() => { })

    return () => {
      cancelled = true
    }
  }, [categoryIdParam, groupIdParam, syncDraft])

  useEffect(() => {
    if (realUser?.role !== 'contractor') return
    let cancelled = false
    const loc = readAppUserLocation()
    fetchLabourCategoriesGrouped(loc?.lat, loc?.lng, loc?.city, loc?.address)
      .then((res) => {
        if (cancelled) return
        const groups = res.data?.groups ?? []
        let allServices = []
        for (const g of groups) {
          for (const c of (g.categories || [])) {
            for (const s of (c.services || [])) {
              allServices.push({ 
                ...s, 
                categoryName: c.name, 
                groupName: g.name,
                label: `${s.name} - ₹${s.minHours === 0.5 ? Math.round((s.hourlyPrice || s.basePrice || 0) / 2) + '/30min' : (s.hourlyPrice || s.basePrice || 0) + '/hr'}`,
                value: String(s._id)
              })
            }
          }
        }
        setAvailableServicesList(allServices)
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [realUser])

  const [paymentModes, setPaymentModes] = useState({ cashEnabled: true, onlineEnabled: true })
  
  useEffect(() => {
    let cancelled = false
    getPublicSettings().then(res => {
      if (!cancelled && res.data?.paymentModes) {
        setPaymentModes(res.data.paymentModes)
      }
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (location.pathname !== BOOKING_FLOW_PATH) return
    if (step === 'active' || step === 'payment' || step === 'billing') return // allow active flows without a draft
    if (!draft.categoryId && !categoryIdParam) {
      // If they somehow enter without a category, they need to pick one.
      navigate('/app/search', { replace: true })
    }
  }, [categoryIdParam, draft.categoryId, navigate, location.pathname, step])

  useEffect(() => {
    if (location.pathname !== BOOKING_FLOW_PATH) return
    if (step !== 'type' || !draft.bookingType) return
    if (draft.entryPoint !== 'category') return
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled) return
      goStep('details')
    })
    return () => {
      cancelled = true
    }
  }, [draft.bookingType, draft.entryPoint, goStep, location.pathname, step])

  useEffect(() => {
    if (step !== 'details') return
    if (window.google?.maps?.places && window.google?.maps?.Map) {
      initMaps()
      return
    }

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    if (!apiKey) return

    if (!document.querySelector('#google-maps-script')) {
      const script = document.createElement('script')
      script.id = 'google-maps-script'
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`
      script.async = true
      script.onload = initMaps
      document.head.appendChild(script)
    } else {
      const script = document.querySelector('#google-maps-script')
      script.addEventListener('load', initMaps)
    }

    function initMaps() {
      setMapsLoaded(true)

      if (mapRef.current && !mapInstance.current) {
        const currentPos = {
          lat: draft.lat || 28.7041,
          lng: draft.lng || 77.1025
        }

        mapInstance.current = new window.google.maps.Map(mapRef.current, {
          center: currentPos,
          zoom: 15,
          disableDefaultUI: true,
          zoomControl: true,
        })

        markerInstance.current = new window.google.maps.Marker({
          position: currentPos,
          map: mapInstance.current,
          draggable: true,
          animation: window.google.maps.Animation.DROP,
        })

        markerInstance.current.addListener('dragend', () => {
          const pos = markerInstance.current.getPosition()
          const lat = pos.lat()
          const lng = pos.lng()

          const geocoder = new window.google.maps.Geocoder()
          geocoder.geocode({ location: pos }, (results, status) => {
            if (status === 'OK' && results[0]) {
              syncDraft({ lat, lng, address: results[0].formatted_address })
            } else {
              syncDraft({ lat, lng })
            }
          })
        })
      }
    }
  }, [step, syncDraft])

  useEffect(() => {
    if (step === 'summary' && !calculatedBill) {
      if (!draft.categoryId && !draft.serviceId) {
        goStep('type')
        return
      }
      let cancelled = false
      setIsCalculating(true)
      const days = durationKindToDays(draft.durationKind, draft.durationDays)
      const kind = draft.durationKind || 'few_hours'
      const hours = draft.bookingType === 'instant' ? (draft.hours || draft.minHours || 1) : (days > 0 ? days * 8 : (kind === 'few_hours' ? (draft.hours || draft.minHours || 1) : (kind === 'half_day' ? 4 : 8)))
      bookingsApi.calculateBill({
        serviceId: draft.serviceId || draft.categoryId,
        hours,
        quantity: draft.quantity || 1,
        address: draft.address,
        ...(realUser?.role === 'contractor' ? { contractorServices: draft.contractorServices } : {})
      }).then(res => {
        if (!cancelled) {
          setCalculatedBill(res.data)
          syncDraft({ billAmount: res.data.totalAmount })
        }
      }).catch(err => {
        if (!cancelled) {
          setFormError(err.message || 'Failed to calculate bill.')
          goStep('details')
        }
      }).finally(() => {
        if (!cancelled) setIsCalculating(false)
      })
      return () => { cancelled = true }
    }
  }, [step, calculatedBill, draft.categoryId, draft.serviceId, draft.durationKind, draft.durationDays, goStep])

  useEffect(() => {
    if (mapInstance.current && markerInstance.current && draft.lat && draft.lng) {
      const pos = { lat: draft.lat, lng: draft.lng }
      mapInstance.current.panTo(pos)
      markerInstance.current.setPosition(pos)
    }
  }, [draft.lat, draft.lng])

  const pickLocation = () => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        if (window.google?.maps?.Geocoder) {
          const geocoder = new window.google.maps.Geocoder()
          geocoder.geocode({ location: { lat, lng } }, (results, status) => {
            if (status === 'OK' && results[0]) {
              syncDraft({ lat, lng, address: results[0].formatted_address })
              setForceInput(true)
            } else {
              syncDraft({ lat, lng })
            }
          })
        } else {
          syncDraft({ lat, lng })
        }
      },
      () => { },
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  const applySavedAddress = () => {
    const saved = readAppUserLocation()
    if (saved && (saved.address || (saved.lat && saved.lng))) {
      const displayAddress = saved.address || `GPS ${saved.lat.toFixed(5)}, ${saved.lng.toFixed(5)}`
      syncDraft({ address: displayAddress, lat: saved.lat, lng: saved.lng })
      setForceInput(true)
      setFormError('') // clear any existing error
    } else {
      setFormError('No saved address found. Please save one in your profile first.')
    }
  }

  const validateDetails = () => {
    if (realUser?.role === 'contractor') {
      if (!draft.companyName?.trim()) {
        setFormError('Please enter a Company Name.')
        return false
      }
      if (!draft.gstNumber?.trim()) {
        setFormError('Please enter a GST Number.')
        return false
      }
      if (!draft.projectName?.trim()) {
        setFormError('Please enter a Project Name.')
        return false
      }
      if (!draft.siteContactNumber?.trim()) {
        setFormError('Please enter a Site Contact Number.')
        return false
      }
    }

    if (!draft.address?.trim()) {
      setFormError('Add your work location to continue.')
      return false
    }

    const now = new Date()
    const hh = String(now.getHours()).padStart(2, '0')
    const mm = String(now.getMinutes()).padStart(2, '0')
    const currentIstStr = `${hh}:${mm}`

    if (draft.bookingType === 'scheduled') {
      if (!draft.serviceDate) {
        setFormError('Choose a date for scheduled booking.')
        return false
      }
      if (draft.serviceDate < todayISODate()) {
        setFormError('Date cannot be in the past.')
        return false
      }
      if (!draft.timeSlot) {
        setFormError('Pick a start time.')
        return false
      }
      if (draft.serviceDate === todayISODate() && draft.timeSlot < currentIstStr) {
        setFormError('Start time cannot be in the past.')
        return false
      }
    }
    setFormError('')
    return true
  }

  const [isPaying, setIsPaying] = useState(false)
  const completedBill = useMemo(() => calculateCompletedBookingBill(activeBooking), [activeBooking])

  const handlePayNow = async () => {
    if (!activeBooking) return
    setIsPaying(true)
    try {
      const razorpayLoaded = await loadRazorpay()
      if (!razorpayLoaded) {
        alert('Payment gateway failed to load. Please try again.')
        return
      }
      const payAmount = completedBill.isContractorBooking
        ? completedBill.completedTotalAmount
        : activeBooking.totalAmount

      const payRes = await paymentsApi.initPayment({
        amount: payAmount,
        purpose: 'BOOKING',
        bookingId: activeBooking._id,
      })
      const order = payRes.data?.order
      if (!order) throw new Error('Payment initialization failed')

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_placeholder',
        amount: order.amount,
        currency: order.currency || 'INR',
        order_id: order.id,
        name: 'KaamExpert',
        description: `Payment for Booking`,
        prefill: {
          name: realUser?.fullName || '',
          contact: realUser?.phone || '',
          email: realUser?.email || ''
        },
        handler: async function (response) {
          try {
            await paymentsApi.verifyPayment({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            })
            // Payment successful!
            setActiveBooking(prev => prev ? { ...prev, paymentStatus: 'PAID' } : null)
            if (activeBooking?.type === 'SCHEDULED') {
              setPaymentSuccess(true)
            } else {
              handleOpenReview()
            }
          } catch (err) {
            alert('Payment verification failed. Contact support.')
          }
        },
        modal: {
          ondismiss: () => {
            setIsPaying(false)
          }
        },
        theme: { color: '#002b5c' },
      }

      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (err) {
      alert(err.message || 'Payment failed')
    } finally {
      setIsPaying(false)
    }
  }

  const handleReviewBooking = async () => {
    if (!validateDetails()) return
    setIsCalculating(true)
    try {
      const days = durationKindToDays(draft.durationKind, draft.durationDays)
      const kind = draft.durationKind || 'few_hours'
      const hours = draft.bookingType === 'instant' ? (draft.hours || draft.minHours || 1) : (days > 0 ? days * 8 : (kind === 'few_hours' ? (draft.hours || draft.minHours || 1) : (kind === 'half_day' ? 4 : 8)))
      const res = await bookingsApi.calculateBill({
        serviceId: draft.serviceId || draft.categoryId, // Fallback
        hours,
        quantity: draft.quantity || 1,
        address: draft.address,
        ...(realUser?.role === 'contractor' ? { contractorServices: draft.contractorServices } : {})
      })
      setCalculatedBill(res.data)
      syncDraft({ billAmount: res.data.totalAmount })

      const modes = res.data.paymentModes || { cashEnabled: true, onlineEnabled: true }
      let currentPaymentMethod = draft.paymentMethod || 'CASH'
      
      if (realUser?.role === 'contractor') {
        currentPaymentMethod = 'ONLINE'
      } else {
        if (currentPaymentMethod === 'CASH' && !modes.cashEnabled && modes.onlineEnabled) {
          currentPaymentMethod = 'ONLINE'
        } else if (currentPaymentMethod === 'ONLINE' && !modes.onlineEnabled && modes.cashEnabled) {
          currentPaymentMethod = 'CASH'
        }
      }
      
      if (currentPaymentMethod !== draft.paymentMethod) {
        syncDraft({ paymentMethod: currentPaymentMethod })
      }

      goStep('summary')
    } catch (err) {
      setFormError(err.message || 'Failed to calculate bill.')
    } finally {
      setIsCalculating(false)
    }
  }

  const confirmBooking = async () => {
    if (!validateDetails()) return
    if (!realUser) {
      navigate('/auth', { replace: true, state: { from: location.pathname + location.search } })
      return
    }
    writeAppUserLocation({ address: draft.address.trim(), lat: draft.lat, lng: draft.lng })

    try {
      const uploadedImageUrls = []
      for (const file of imageFiles) {
        const res = await uploadMedia(file, 'job-posters')
        const url = assetUrlFromUpload(res)
        if (url) uploadedImageUrls.push(url)
      }

      const days = durationKindToDays(draft.durationKind, draft.durationDays)
      const kind = draft.durationKind || 'few_hours'
      const hours = draft.bookingType === 'instant' ? (draft.hours || draft.minHours || 1) : (days > 0 ? days * 8 : (kind === 'few_hours' ? (draft.hours || draft.minHours || 1) : (kind === 'half_day' ? 4 : 8)))
      const payload = {
        serviceId: draft.serviceId || draft.categoryId,
        type: draft.bookingType === 'scheduled' ? 'SCHEDULED' : 'INSTANT',
        locationText: draft.address.trim(),
        lat: draft.lat || 28.6139,
        lng: draft.lng || 77.2090,
        paymentMethod: realUser?.role === 'contractor' ? 'ONLINE' : (draft.paymentMethod || 'CASH'),
        notes: draft.notes,
        durationKind: draft.durationKind,
        durationDays: days,
        hours,
        quantity: draft.quantity || 1,
        timeSlot: draft.timeSlot,
        scheduledAt: draft.serviceDate,
        imageNames: uploadedImageUrls,
        ...(realUser?.role === 'contractor' ? {
          contractorInfo: {
            companyName: draft.companyName,
            gstNumber: draft.gstNumber,
            projectName: draft.projectName,
            siteContactNumber: draft.siteContactNumber,
            services: draft.contractorServices || [{ serviceId: draft.serviceId || draft.categoryId, quantity: draft.quantity || 1 }]
          }
        } : {})
      }

      const res = await bookingsApi.createBooking(payload)
      const createdBooking = res.data.booking
      setActiveBookingId(createdBooking._id)
      patchBookingDraft({ lastRef: createdBooking._id })
      setNoMatch(false)
      goStep(draft.bookingType === 'scheduled' ? 'scheduled_success' : 'searching')
    } catch (err) {
      console.error(err)
      alert(err.message || 'Failed to create booking')
    } finally {
      setIsCreating(false)
    }
  }

  const wizardIndex = step === 'type' ? 0 : step === 'details' ? 1 : step === 'summary' ? 2 : 3

  if (step === 'scheduled_success') {
    return (
      <div className="space-y-4 pb-8">
        <AppStackScreenHeader title="Booking confirmed" onBack={() => navigate('/app/my-bookings')} />
        <GlassPanel className="p-6 text-center">
          <CheckCircle2 className="mx-auto h-16 w-16 text-blue-600" aria-hidden />
          <p className="mt-4 text-lg font-black text-slate-900">Your job is scheduled!</p>
          <p className="mt-2 text-sm font-medium text-slate-600">
            We have confirmed your requirement. A worker will be assigned to you before your scheduled time.
          </p>
          <div className="mt-4 text-left rounded-xl bg-slate-50 border border-slate-100 p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 font-semibold">Date</span>
              <span className="text-slate-900 font-bold">{new Date(draft.serviceDate).toLocaleDateString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 font-semibold">Time</span>
              <span className="text-slate-900 font-bold">{draft.timeSlot}</span>
            </div>
          </div>
          <motion.div className="mt-6 flex flex-col gap-2">
            <BookingPrimaryButton type="button" onClick={() => { window.scrollTo(0, 0); clearBookingDraft(); navigate('/app/my-bookings', { replace: true }) }}>
              View my bookings
            </BookingPrimaryButton>
            <AppButton type="button" variant="secondary" onClick={() => { window.scrollTo(0, 0); clearBookingDraft(); navigate('/app', { replace: true }) }}>
              Back to home
            </AppButton>
          </motion.div>
        </GlassPanel>
      </div>
    )
  }

  if (step === 'searching' && !noMatch) {
    return (
      <div className="pb-8">
        <AppStackScreenHeader title="Matching labour" onBack={() => goStep('summary')} />
        <BookingServiceHighlight categoryName={draft.categoryName} serviceName={realUser?.role === 'contractor' && contractorServiceNames ? contractorServiceNames : draft.serviceName} />

        <div className="px-4 mt-6">
          <div className="lc-booking-flow-card">
            <p className="lc-booking-flow-label mb-2">Booking Details</p>
            <div className="space-y-2 text-sm text-slate-700">
              <div className="flex justify-between">
                <span className="font-semibold text-slate-500">Date</span>
                <span className="font-medium text-slate-900">{draft.bookingType === 'scheduled' ? new Date(draft.serviceDate).toLocaleDateString() : 'ASAP'}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-semibold text-slate-500">Time</span>
                <span className="font-medium text-slate-900">{draft.bookingType === 'scheduled' ? draft.timeSlot : 'Earliest available'}</span>
              </div>
              <div className="flex flex-col">
                <span className="font-semibold text-slate-500">Location</span>
                <span className="line-clamp-2 mt-0.5 text-slate-900 font-medium">{draft.address}</span>
              </div>
              <div className="flex justify-between border-t border-slate-100 pt-2 font-bold text-slate-900 mt-2">
                <span>Total Bill</span>
                <span>₹{draft.billAmount?.toLocaleString('en-IN') || 0}</span>
              </div>
            </div>
          </div>
        </div>

        <BookingFindingScreen
          categoryLabel={draft.categoryName}
          onComplete={() => { }}
          onNoMatch={() => { }}
        />
      </div>
    )
  }

  if (noMatch) {
    return (
      <div className="space-y-4 pb-8">
        <AppStackScreenHeader title="No match" onBack={() => { window.scrollTo(0, 0); navigate('/app') }} />
        <GlassPanel className="p-6 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-amber-500" aria-hidden />
          <p className="mt-3 text-sm font-bold text-slate-900">Labourers are currently not available</p>
          <p className="mt-2 text-xs text-slate-600">Please try searching again in a few minutes.</p>
          <motion.div className="mt-5 flex flex-col gap-2">
            <BookingPrimaryButton type="button" onClick={() => { setNoMatch(false); confirmBooking() }}>
              Retry search
            </BookingPrimaryButton>
            <AppButton type="button" variant="secondary" onClick={() => { window.scrollTo(0, 0); navigate('/app') }}>
              Cancel
            </AppButton>
          </motion.div>
        </GlassPanel>
      </div>
    )
  }

  if (step === 'active' || step === 'payment' || step === 'billing') {
    const booking = activeBooking
    const worker = booking?.laborId
    const statusSequence = ['CREATED', 'BROADCASTING', 'ACCEPTED', 'EN_ROUTE', 'STARTED', 'COMPLETED']
    const timelineIdx = booking ? statusSequence.indexOf(booking.status) - 2 : 0

    return (
      <div className="space-y-4 pb-8">
        <AppStackScreenHeader
          title={step === 'payment' ? 'Payment' : (step === 'billing' || booking?.status === 'COMPLETED') ? 'Billing' : 'Worker on the way'}
          onBack={() => (step === 'payment' ? goStep(booking?.status === 'COMPLETED' ? 'billing' : 'active') : navigate('/app/my-bookings', { replace: true }))}
        />
        <BookingServiceHighlight categoryName={draft.categoryName} serviceName={realUser?.role === 'contractor' && contractorServiceNames ? contractorServiceNames : draft.serviceName} />

        {step !== 'billing' && booking && booking.quantity > 1 ? (
          <div className="space-y-4">
            <div className="lc-booking-flow-card">
              <p className="lc-booking-flow-label font-bold">Assigned Labourers ({booking.assignments?.length || 0} / {booking.quantity})</p>
            </div>
            {booking.assignments?.map((assignment, idx) => {
              const worker = assignment.labourId;
              const assignTimelineIdx = statusSequence.indexOf(assignment.status) - 2;
              return (
                <div key={worker?._id || idx} className="space-y-4">
                  <GlassPanel className="overflow-hidden border-slate-200/90 p-0">
                    <motion.div className="flex gap-4 p-4">
                      <img
                        src={worker?.profileImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(worker?.fullName || 'W')}`}
                        alt=""
                        className="h-16 w-16 rounded-2xl object-cover ring-2 ring-white"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-lg font-black text-slate-900">{worker?.fullName || 'Unknown'}</p>
                        <p className="text-xs font-semibold text-brand">{worker?.phone}</p>
                        <p className="mt-1 text-[11px] text-slate-500">{draft.categoryName}</p>
                      </div>
                    </motion.div>
                    <div className="grid grid-cols-1 gap-2 border-t border-slate-100 bg-slate-50/80 p-3">
                      <a
                        href={`tel:${worker?.phone}`}
                        className="flex flex-col items-center justify-center gap-1 rounded-xl bg-white py-2.5 text-[10px] font-bold text-slate-800 ring-1 ring-slate-200/90"
                      >
                        <Phone className="h-4 w-4 text-brand" aria-hidden />
                        Call
                      </a>
                    </div>
                  </GlassPanel>

                  <div className="lc-booking-flow-card">
                    <p className="lc-booking-flow-label">Status</p>
                    <ol className="mt-3 space-y-2">
                      {[
                        { id: 'accepted', label: 'Accepted' },
                        { id: 'en_route', label: 'En Route' },
                        { id: 'started', label: 'Job Started' },
                        { id: 'completed', label: 'Completed' },
                      ].map((t, i) => {
                        const done = i <= Math.max(0, assignTimelineIdx);
                        return (
                          <li key={t.id} className="flex items-center gap-3">
                            <span
                              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${done ? 'bg-brand text-white' : 'bg-slate-100 text-slate-400'
                                }`}
                            >
                              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                            </span>
                            <span className={`text-sm font-semibold ${done ? 'text-black' : 'text-black/40'}`}>{t.label}</span>
                          </li>
                        )
                      })}
                    </ol>
                  </div>

                  {assignment.status !== 'COMPLETED' && assignment.startOtp && (
                    <div className="lc-booking-flow-card">
                      <p className="lc-booking-flow-label mb-2">Security OTPs</p>
                      <div className="flex gap-4">
                        <div className="flex-1 rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
                          <p className="text-[10px] text-slate-500 font-semibold">Start OTP</p>
                          <p className="text-xl font-black text-slate-800 tracking-widest">{assignment.startOtp}</p>
                        </div>
                        <div className="flex-1 rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
                          <p className="text-[10px] text-slate-500 font-semibold">Completion OTP</p>
                          <p className="text-xl font-black text-slate-800 tracking-widest">{assignment.completionOtp}</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ) : (
          worker && step !== 'billing' ? (
            <div className="space-y-4">
              <GlassPanel className="overflow-hidden border-slate-200/90 p-0">
                <motion.div className="flex gap-4 p-4">
                  <img
                    src={worker.profileImageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(worker.fullName || 'W')}`}
                    alt=""
                    className="h-16 w-16 rounded-2xl object-cover ring-2 ring-white"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-lg font-black text-slate-900">{worker.fullName || 'Unknown'}</p>
                    <p className="text-xs font-semibold text-brand">{worker.phone}</p>
                    <p className="mt-1 text-[11px] text-slate-500">{draft.categoryName}</p>
                  </div>
                </motion.div>
                <div className="grid grid-cols-1 gap-2 border-t border-slate-100 bg-slate-50/80 p-3">
                  <a
                    href={`tel:${worker.phone}`}
                    className="flex flex-col items-center justify-center gap-1 rounded-xl bg-white py-2.5 text-[10px] font-bold text-slate-800 ring-1 ring-slate-200/90"
                  >
                    <Phone className="h-4 w-4 text-brand" aria-hidden />
                    Call
                  </a>
                </div>
              </GlassPanel>

              <div className="lc-booking-flow-card">
                <p className="lc-booking-flow-label">Status</p>
                <ol className="mt-3 space-y-2">
                  {[
                    { id: 'accepted', label: 'Accepted' },
                    { id: 'en_route', label: 'En Route' },
                    { id: 'started', label: 'Job Started' },
                    { id: 'completed', label: 'Completed' },
                  ].map((t, i) => {
                    const done = i <= Math.max(0, timelineIdx)
                    return (
                      <li key={t.id} className="flex items-center gap-3">
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-black ${done ? 'bg-brand text-white' : 'bg-slate-100 text-slate-400'
                            }`}
                        >
                          {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                        </span>
                        <span className={`text-sm font-semibold ${done ? 'text-black' : 'text-black/40'}`}>{t.label}</span>
                      </li>
                    )
                  })}
                </ol>
              </div>

              {booking.status !== 'COMPLETED' && (booking.assignments?.[0]?.startOtp || booking.startOtp) && (
                <div className="lc-booking-flow-card">
                  <p className="lc-booking-flow-label mb-2">Security OTPs</p>
                  <div className="flex gap-4">
                    <div className="flex-1 rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
                      <p className="text-[10px] text-slate-500 font-semibold">Start OTP</p>
                      <p className="text-xl font-black text-slate-800 tracking-widest">{booking.assignments?.[0]?.startOtp || booking.startOtp}</p>
                    </div>
                    <div className="flex-1 rounded-xl bg-slate-50 border border-slate-200 p-3 text-center">
                      <p className="text-[10px] text-slate-500 font-semibold">Completion OTP</p>
                      <p className="text-xl font-black text-slate-800 tracking-widest">{booking.assignments?.[0]?.completionOtp || booking.completionOtp}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : null
        )}

        {booking && step !== 'billing' && (
          <div className="space-y-4">
            <div className="lc-booking-flow-card">
              <p className="lc-booking-flow-label mb-2">Booking Details</p>
              <div className="space-y-2 text-sm text-slate-700">
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-500">Date</span>
                  <span className="font-medium text-slate-900">{booking.type === 'SCHEDULED' ? new Date(booking.scheduledAt).toLocaleDateString() : 'ASAP'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-500">Time</span>
                  <span className="font-medium text-slate-900">{booking.type === 'SCHEDULED' ? booking.timeSlot : 'Earliest available'}</span>
                </div>
                <div className="flex flex-col">
                  <span className="font-semibold text-slate-500">Location</span>
                  <span className="line-clamp-2 mt-0.5 text-slate-900 font-medium">{booking.address?.locationText}</span>
                </div>
                <div className="flex justify-between border-t border-slate-100 pt-2 font-bold text-slate-900 mt-2">
                  <span>Total Bill</span>
                  <span>₹{booking.totalAmount?.toLocaleString('en-IN') || 0}</span>
                </div>
              </div>
            </div>
          </div>
        )}
            
            {(step === 'billing' || booking?.status === 'COMPLETED') && (
              <div className="lc-booking-flow-card space-y-4 text-sm lc-booking-flow-body">
                {completedBill.isContractorBooking ? (
                  <div>
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <span className="font-extrabold text-slate-900 text-sm">Contractor Services Breakdown</span>
                      <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                        {completedBill.totalCompletedLabours} / {completedBill.totalRequestedLabours} Labours Completed
                      </span>
                    </div>

                    <div className="mt-3 space-y-3">
                      {completedBill.serviceBreakdown.map((item, idx) => (
                        <div key={item.serviceId || idx} className="rounded-xl border border-slate-200/90 bg-slate-50/70 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-bold text-slate-900 text-sm">{item.name}</p>
                              <p className="text-xs text-slate-500">
                                ₹{item.pricePerHour}/hr × {item.bookingHours} hr(s)
                                {item.extraHours > 0 && <span className="text-brand font-semibold"> + {item.extraHours} extra hr(s)</span>}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-black text-slate-900 text-sm">₹{item.completedAmount.toLocaleString('en-IN')}</p>
                              {item.deductedAmount > 0 && (
                                <p className="text-[10px] font-bold text-rose-600">-₹{item.deductedAmount.toLocaleString('en-IN')} cut</p>
                              )}
                            </div>
                          </div>

                          <div className="mt-2 flex items-center justify-between pt-2 border-t border-slate-200/60 text-xs">
                            <span className="text-slate-600 font-medium">Labour Attendance:</span>
                            {item.isFullyCompleted ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                                <Check className="h-3 w-3" /> {item.completedQty} / {item.requestedQty} Completed
                              </span>
                            ) : item.isPartiallyCompleted ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                                <AlertCircle className="h-3 w-3" /> {item.completedQty} / {item.requestedQty} Completed ({item.pendingQty} Incomplete)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-md bg-rose-100 px-2 py-0.5 text-[11px] font-bold text-rose-800">
                                ✕ 0 / {item.requestedQty} Completed (Unfulfilled)
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex justify-between gap-2">
                    <span className="lc-booking-flow-muted">Service</span>
                    <span className="text-right font-bold text-black">
                      <span className="lc-booking-highlight-title block text-base">{booking?.category?.name || draft.categoryName}</span>
                      {booking?.service?.name || draft.serviceName ? <span className="text-xs font-semibold">{booking?.service?.name || draft.serviceName}</span> : null}
                    </span>
                  </div>
                )}

                <div className="space-y-2 pt-1">
                  <div className="flex justify-between">
                    <span className="lc-booking-flow-muted">Booking</span>
                    <span className="font-bold capitalize text-black">{booking?.type?.toLowerCase() || 'scheduled'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="lc-booking-flow-muted">Date</span>
                    <span className="font-bold text-black">
                      {booking?.type === 'INSTANT' ? 'Today (ASAP)' : booking?.scheduledAt ? new Date(booking.scheduledAt).toLocaleDateString() : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="lc-booking-flow-muted">Time</span>
                    <span className="font-bold text-black">
                      {booking?.type === 'INSTANT' ? 'Earliest Available' : booking?.timeSlot || 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="lc-booking-flow-muted">Duration</span>
                    <span className="font-bold text-black">
                      {booking?.duration != null || booking?.hours != null
                        ? formatDuration(booking.duration ?? booking.hours)
                        : 'Few hours'}
                    </span>
                  </div>

                  <p className="flex items-start gap-2 font-medium text-black pt-1">
                    <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
                    {booking?.address?.locationText || 'N/A'}
                  </p>
                </div>

                <div className="border-t border-slate-200 pt-3 mt-2">
                  <div className="flex justify-between font-semibold text-black">
                    <span className="flex flex-col">
                      <span>{completedBill.isContractorBooking ? 'Completed Service Fee' : 'Service fee'}</span>
                      {completedBill.extraHours > 0 && (
                        <span className="text-xs text-brand font-medium">Includes {completedBill.extraHours} extra hour(s)</span>
                      )}
                    </span>
                    <span>₹{completedBill.completedBasePrice.toLocaleString('en-IN')}</span>
                  </div>

                  {completedBill.isContractorBooking && completedBill.deductedBasePrice > 0 && (
                    <div className="mt-1.5 flex justify-between text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-100">
                      <span>Deductions (Unfulfilled / Pending)</span>
                      <span>-₹{completedBill.deductedBasePrice.toLocaleString('en-IN')}</span>
                    </div>
                  )}

                  <div className="mt-1 flex justify-between lc-booking-flow-muted">
                    <span>Platform fee</span>
                    <span>₹{completedBill.completedPlatformFee.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between lc-booking-flow-muted">
                    <span>Taxes</span>
                    <span>₹{completedBill.completedTaxes.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="mt-2 flex justify-between text-base font-extrabold text-black border-t border-slate-100 pt-2">
                    <span>Total</span>
                    <span>₹{completedBill.completedTotalAmount.toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            )}
            {step === 'billing' && (
              <div className="lc-booking-flow-card space-y-3 mt-4">
                <p className="lc-booking-flow-label font-bold text-slate-800">Payment Method</p>
                <div className="grid grid-cols-1 gap-3">
                  <button
                    type="button"
                    onClick={() => syncDraft({ paymentMethod: 'ONLINE' })}
                    className={`flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 font-bold transition-all ${(draft.paymentMethod || booking?.paymentMethod) === 'ONLINE'
                        ? 'border-brand bg-brand/5 text-brand'
                        : 'border-slate-200 text-slate-500 hover:border-brand/30 hover:bg-slate-50'
                      }`}
                  >
                    <Zap className="h-5 w-5" />
                    Online
                  </button>
                </div>
              </div>
            )}
        {step === 'payment' ? (
          <motion.div className="space-y-4">
            <FieldLabel>Select Payment Method</FieldLabel>
            <motion.div className={`grid gap-2 ${paymentModes?.cashEnabled && paymentModes?.onlineEnabled ? 'grid-cols-2' : 'grid-cols-1'}`}>
              {[
                paymentModes?.cashEnabled !== false ? { id: 'CASH', label: 'Cash' } : null,
                paymentModes?.onlineEnabled !== false ? { id: 'ONLINE', label: 'Online' } : null
              ].filter(Boolean).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => syncDraft({ paymentMethod: m.id })}
                  className="lc-booking-slot"
                  data-active={draft.paymentMethod === m.id ? 'true' : 'false'}
                >
                  {m.label}
                </button>
              ))}
            </motion.div>
            <div className="lc-booking-flow-card text-sm lc-booking-flow-body">
              <div className="flex justify-between font-semibold">
                <span className="flex flex-col">
                  <span>{completedBill.isContractorBooking ? 'Completed Subtotal' : 'Subtotal'}</span>
                  {completedBill.extraHours > 0 && (
                    <span className="text-xs text-brand font-medium">Includes {completedBill.extraHours} extra hour(s)</span>
                  )}
                </span>
                <span>{formatInr(completedBill.completedBasePrice)}</span>
              </div>
              {completedBill.isContractorBooking && completedBill.deductedBasePrice > 0 && (
                <div className="mt-1.5 flex justify-between text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-100">
                  <span>Deductions (Unfulfilled slots)</span>
                  <span>-₹{completedBill.deductedBasePrice.toLocaleString('en-IN')}</span>
                </div>
              )}
              <div className="mt-1 flex justify-between lc-booking-flow-muted">
                <span>Platform fee</span>
                <span>{formatInr(completedBill.completedPlatformFee)}</span>
              </div>
              <div className="mt-1 flex justify-between lc-booking-flow-muted">
                <span>Taxes (GST)</span>
                <span>{formatInr(completedBill.completedTaxes)}</span>
              </div>
              <div className="mt-2 flex justify-between border-t border-slate-200 pt-2 text-base font-extrabold text-black">
                <span>Total</span>
                <span>{formatInr(completedBill.completedTotalAmount)}</span>
              </div>
            </div>
            <BookingPrimaryButton
              type="button"
              onClick={async () => {
                if (activeBookingId) {
                  try {
                    await bookingsApi.updatePaymentMethod(activeBookingId, draft.paymentMethod || 'CASH')
                  } catch (e) {
                    console.error('Failed to update payment method:', e)
                  }
                }
                clearBookingDraft()
                navigate(`/app/my-bookings`)
              }}
            >
              <CheckCircle2 className="h-4 w-4" aria-hidden />
              Confirm payment
            </BookingPrimaryButton>
          </motion.div>
        ) : (
          <div className="sticky bottom-2 z-10 space-y-2 pt-2">
            {activeBooking?.paymentStatus !== 'PAID' ? (
              (draft.paymentMethod || activeBooking?.paymentMethod) === 'ONLINE' ? (
                <BookingPrimaryButton type="button" onClick={handlePayNow} disabled={isPaying}>
                  <IndianRupee className="h-4 w-4" aria-hidden />
                  {isPaying ? 'Processing...' : 'Proceed to pay'}
                </BookingPrimaryButton>
              ) : activeBooking?.status === 'COMPLETED' ? (
                <BookingPrimaryButton type="button" onClick={handleOpenReview}>
                  <Star className="h-4 w-4" aria-hidden />
                  Rate your experience
                </BookingPrimaryButton>
              ) : null
            ) : activeBooking?.status === 'COMPLETED' && activeBooking?.paymentStatus === 'PAID' ? (
              !reviewOpen ? (
                <BookingPrimaryButton type="button" onClick={handleOpenReview}>
                  <Star className="h-4 w-4" aria-hidden />
                  Rate your experience
                </BookingPrimaryButton>
              ) : null
            ) : activeBooking?.status === 'COMPLETED' ? (
              <BookingPrimaryButton type="button" onClick={handleOpenReview}>
                <Star className="h-4 w-4" aria-hidden />
                Rate your experience
              </BookingPrimaryButton>
            ) : null}
            {activeBooking?.status !== 'COMPLETED' && step !== 'billing' ? (
              <BookingPrimaryButton type="button" onClick={() => goStep('payment')}>
                <Wallet className="h-4 w-4" aria-hidden />
                Change payment method
              </BookingPrimaryButton>
            ) : null}
          </div>
        )}

        <BookingReviewModal
          open={reviewOpen}
          bookingId={activeBookingId}
          workerName={
            (reviewQueue[currentReviewIndex]?.fullName || reviewQueue[currentReviewIndex]?.name) ||
            (activeBooking?.laborId?.fullName || activeBooking?.laborId?.name) || ''
          }
          revieweeId={reviewQueue[currentReviewIndex]?._id || reviewQueue[currentReviewIndex]}
          onClose={() => setReviewOpen(false)}
          onSubmitted={handleReviewSubmitted}
        />

        {paymentSuccess && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl text-center"
            >
              <div className="relative mx-auto mb-8 mt-4 flex h-24 w-24 items-center justify-center">
                <motion.div
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", bounce: 0.5, duration: 0.6 }}
                  className="relative z-10 flex h-full w-full items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-xl shadow-blue-500/40"
                >
                  <CheckCircle2 className="h-12 w-12 text-white" strokeWidth={2.5} />
                </motion.div>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Payment Successful!</h3>
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                Thank you for your payment. Your transaction has been successfully processed.
              </p>
              <button
                type="button"
                onClick={() => {
                  setPaymentSuccess(false)
                  handleOpenReview()
                }}
                className="w-full rounded-xl bg-brand py-3 text-sm font-bold text-white transition hover:bg-brand/90 active:scale-95"
              >
                Continue to Review
              </button>
            </motion.div>
          </div>
        )}



        {activeBooking?.status === 'COMPLETED' && (draft.paymentMethod || activeBooking?.paymentMethod) === 'CASH' && activeBooking?.paymentStatus !== 'PAID' && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl text-center"
            >
              <div className="relative mx-auto mb-8 mt-4 flex h-24 w-24 items-center justify-center">
                <div className="absolute inset-0 rounded-full bg-blue-400 opacity-75 animate-ping" style={{ animationDuration: '2s' }} />
                <div className="absolute inset-0 rounded-full bg-indigo-400 opacity-50 animate-ping" style={{ animationDuration: '2s', animationDelay: '1s' }} />
                <div className="relative z-10 flex h-full w-full items-center justify-center rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 shadow-xl shadow-blue-500/40">
                  <Wallet className="h-10 w-10 text-white" strokeWidth={2} />
                </div>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">Cash Payment</h3>
              <p className="text-sm text-slate-500 mb-6 leading-relaxed">
                Please hand over <span className="font-bold text-slate-900">₹{activeBooking?.totalAmount?.toLocaleString('en-IN') || 0}</span> in cash to the worker. Click the button below once paid.
              </p>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await bookingsApi.confirmCashPayment(activeBookingId)
                    setActiveBooking(prev => prev ? { ...prev, paymentStatus: 'PAID' } : null)
                    if (activeBooking?.type === 'SCHEDULED') {
                      setPaymentSuccess(true)
                    } else {
                      handleOpenReview()
                    }
                  } catch (e) {
                    alert('Failed to confirm cash payment')
                  }
                }}
                className="w-full rounded-xl bg-brand py-3 text-sm font-bold text-white transition hover:bg-brand/90 active:scale-95"
              >
                Paid
              </button>
            </motion.div>
          </div>
        )}
      </div>
    )
  }

  const flowTitle =
    step === 'type' ? 'Booking type' : step === 'details' ? 'Job details' : step === 'summary' ? 'Billing' : 'Review & confirm'

  return (
    <div className="-mx-4 space-y-4 bg-white pb-8">
      <AppStackScreenHeader
        className="mx-4"
        title={flowTitle}
        onBack={() => {
          if (step === 'type') leaveFlow()
          else if (step === 'details') {
            if (draft.entryPoint === 'category') navigate(-1)
            else goStep('type')
          }
          else goStep('details')
        }}
      />

      <div className="space-y-4 px-4">
        <BookingServiceHighlight categoryName={draft.categoryName} serviceName={realUser?.role === 'contractor' && contractorServiceNames ? contractorServiceNames : draft.serviceName} />

        {step !== 'searching' ? (
          <div className="lc-booking-flow-card py-3">
            <BookingStepProgress step={wizardIndex} total={3} />
          </div>
        ) : null}

        {step === 'type' ? (
          <motion.div initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <button
              type="button"
              onClick={() => setTypeSheetOpen(true)}
              className="flex w-full items-center gap-3 rounded-2xl border border-slate-200/90 bg-white p-4 text-left shadow-sm"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
                {draft.bookingType === 'scheduled' ? (
                  <Calendar className="h-5 w-5" aria-hidden />
                ) : (
                  <Zap className="h-5 w-5" aria-hidden />
                )}
              </span>
              <span className="flex-1">
                <p className="text-sm font-bold text-black">
                  {draft.bookingType === 'scheduled' ? 'Schedule booking' : draft.bookingType === 'instant' ? 'Instant booking' : 'Choose booking type'}
                </p>
                <p className="text-xs text-black/55">Tap to change</p>
              </span>
              <ArrowRight className="h-5 w-5 text-slate-300" aria-hidden />
            </button>
            <BookingPrimaryButton type="button" disabled={!draft.bookingType} onClick={() => goStep('details')}>
              Continue
              <ArrowRight className="h-4 w-4" aria-hidden />
            </BookingPrimaryButton>
          </motion.div>
        ) : null}

        {step === 'details' ? (
          <motion.div className="space-y-4">
            <div>
              <FieldLabel htmlFor="work-location">Work location</FieldLabel>
              {!mapsLoaded ? (
                <input
                  id="work-location"
                  name="workLocation"
                  ref={inputRef}
                  type="text"
                  value={draft.address || ''}
                  onChange={(e) => syncDraft({ address: e.target.value })}
                  placeholder="House, street, area, city"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20"
                />
              ) : (
                <div className="relative w-full">
                  <div className="w-full rounded-xl border border-slate-200 overflow-hidden focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20 [&>gmp-place-autocomplete]:w-full [&>gmp-place-autocomplete]:block">
                    <gmp-place-autocomplete
                      id="work-location"
                      name="workLocation"
                      ref={autocompleteRef}
                    ></gmp-place-autocomplete>
                  </div>

                  {forceInput && (
                    <input
                      id="work-location-display"
                      name="workLocationDisplay"
                      type="text"
                      value={draft.address || ''}
                      readOnly
                      onClick={() => setForceInput(false)}
                      placeholder="House, street, area, city"
                      className="absolute top-0 left-0 h-full w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none cursor-text"
                    />
                  )}
                </div>
              )}
              <div
                ref={mapRef}
                className="mt-3 h-48 w-full rounded-xl bg-slate-100 ring-1 ring-black/5 overflow-hidden"
              />
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={pickLocation}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-brand/25 bg-brand/5 py-2.5 text-[11px] font-bold text-brand"
                >
                  <Navigation className="h-3.5 w-3.5" aria-hidden />
                  Current location
                </button>
                <button
                  type="button"
                  onClick={applySavedAddress}
                  className="lc-booking-btn-secondary py-2.5 text-[11px]"
                >
                  Saved address
                </button>
              </div>
            </div>

            <motion.div>
              <FieldLabel optional htmlFor="work-note">Work note</FieldLabel>
              <textarea
                id="work-note"
                name="workNote"
                value={draft.notes || ''}
                onChange={(e) => syncDraft({ notes: e.target.value })}
                rows={2}
                placeholder="Describe the work briefly…"
                className="w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium text-black outline-none focus:border-brand focus:ring-0 placeholder:text-black/40"
              />
            </motion.div>

            <motion.div>
              <FieldLabel optional>Photos</FieldLabel>
              <label htmlFor="job-photos" className="flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 py-4 text-xs font-bold text-black">
                <ImagePlus className="h-4 w-4 text-brand" aria-hidden />
                Upload images
                <input
                  id="job-photos"
                  name="jobPhotos"
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  onChange={(e) => setImageFiles([...(e.target.files || [])])}
                />
              </label>
              {imageFiles.length ? (
                <p className="mt-1 text-[11px] text-slate-500">{imageFiles.length} file(s) selected</p>
              ) : null}
            </motion.div>

              {realUser?.role === 'contractor' ? (
                <>
                  <motion.div className="mb-4">
                    <FieldLabel>Company Name *</FieldLabel>
                    <input
                      value={draft.companyName || ''}
                      onChange={(e) => syncDraft({ companyName: e.target.value })}
                      placeholder="Enter company name"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-black outline-none focus:border-brand focus:ring-1"
                    />
                  </motion.div>
                  <motion.div className="mb-4">
                    <FieldLabel>GST Number *</FieldLabel>
                    <input
                      value={draft.gstNumber || ''}
                      onChange={(e) => syncDraft({ gstNumber: e.target.value })}
                      placeholder="Enter GST number"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-black outline-none focus:border-brand focus:ring-1"
                    />
                  </motion.div>
                  <motion.div className="mb-4">
                    <FieldLabel>Project Name *</FieldLabel>
                    <input
                      value={draft.projectName || ''}
                      onChange={(e) => syncDraft({ projectName: e.target.value })}
                      placeholder="Enter project name"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-black outline-none focus:border-brand focus:ring-1"
                    />
                  </motion.div>
                  <motion.div className="mb-4">
                    <FieldLabel>Site Contact Number *</FieldLabel>
                    <input
                      type="tel"
                      value={draft.siteContactNumber || ''}
                      onChange={(e) => syncDraft({ siteContactNumber: e.target.value })}
                      placeholder="Enter site contact number"
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-black outline-none focus:border-brand focus:ring-1"
                    />
                  </motion.div>
                  <motion.div className="mb-4">
                    <FieldLabel>Services Required *</FieldLabel>
                    {(draft.contractorServices?.length ? draft.contractorServices : [{ serviceId: draft.serviceId || draft.categoryId, quantity: draft.quantity || 1 }]).map((cs, idx) => (
                      <div key={idx} className="flex gap-2 items-start mb-2">
                        <div className="flex-1">
                          <AppSearchableSelect
                            value={cs.serviceId}
                            onChange={(val) => {
                              const newList = [...(draft.contractorServices?.length ? draft.contractorServices : [{ serviceId: draft.serviceId || draft.categoryId, quantity: draft.quantity || 1 }])]
                              const selectedService = availableServicesList.find(s => s.value === val)
                              newList[idx] = { ...newList[idx], serviceId: val, price: selectedService?.basePrice || selectedService?.hourlyPrice || 0 }
                              syncDraft({ contractorServices: newList })
                            }}
                            options={availableServicesList}
                            placeholder="Select Service"
                          />
                        </div>
                        <div className="w-32">
                          <input
                            type="number"
                            min="1"
                            value={cs.quantity || ''}
                            onChange={(e) => {
                              const newList = [...(draft.contractorServices?.length ? draft.contractorServices : [{ serviceId: draft.serviceId || draft.categoryId, quantity: draft.quantity || 1 }])]
                              newList[idx] = { ...newList[idx], quantity: parseInt(e.target.value, 10) || 1 }
                              syncDraft({ contractorServices: newList })
                            }}
                            placeholder="No. of Labour"
                            className="w-full rounded-xl border border-slate-200 px-3 py-3 text-sm font-semibold text-black outline-none focus:border-brand focus:ring-1 h-[46px]"
                          />
                        </div>
                        {idx > 0 && (
                          <button
                            type="button"
                            onClick={() => {
                              const newList = [...(draft.contractorServices?.length ? draft.contractorServices : [{ serviceId: draft.serviceId || draft.categoryId, quantity: draft.quantity || 1 }])]
                              newList.splice(idx, 1)
                              syncDraft({ contractorServices: newList })
                            }}
                            className="h-[46px] px-3 flex items-center justify-center rounded-xl bg-red-50 text-red-500 font-bold hover:bg-red-100"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={() => {
                        const newList = [...(draft.contractorServices?.length ? draft.contractorServices : [{ serviceId: draft.serviceId || draft.categoryId, quantity: draft.quantity || 1 }])]
                        newList.push({ serviceId: '', quantity: 1, price: 0 })
                        syncDraft({ contractorServices: newList })
                      }}
                      className="text-brand font-semibold text-sm mt-1 hover:underline text-left block"
                    >
                      + Add more services
                    </button>
                  </motion.div>
                </>
              ) : null}
              <motion.div>
                <FieldLabel>Required Duration</FieldLabel>
                <div className="relative">
                  <AppSearchableSelect
                    value={parseFloat(draft.hours) || parseFloat(draft.minHours) || 1}
                    onChange={(val) => syncDraft({ hours: parseFloat(val) || parseFloat(draft.minHours) || 1 })}
                    hideSearch
                    options={(() => {
                      const min = parseFloat(draft.minHours) || 1
                      const max = draft.maxHours || 24
                      const opts = []
                      // 30-min option only when the service explicitly allows it
                      if (min <= 0.5) {
                        opts.push({ value: 0.5, label: '30 Minutes' })
                      }
                      const startHour = min <= 0.5 ? 1 : Math.ceil(min)
                      for (let h = startHour; h <= max; h++) {
                        opts.push({ value: h, label: `${h} ${h === 1 ? 'Hour' : 'Hours'}` })
                      }
                      return opts
                    })()}
                  />
                </div>
              </motion.div>

            {draft.bookingType === 'instant' ? (
              <div className="space-y-4">
                <div className="lc-booking-highlight flex items-center gap-2">
                  <Zap className="h-5 w-5 text-brand" aria-hidden />
                  <div>
                    <p className="text-sm font-bold text-black">ASAP</p>
                    <p className="text-xs font-medium text-black/70">Earliest available slot</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <motion.div>
                  <FieldLabel htmlFor="service-date">Date</FieldLabel>
                  <input
                    id="service-date"
                    name="serviceDate"
                    type="date"
                    min={todayISODate()}
                    max={maxISODate(5)}
                    value={draft.serviceDate || ''}
                    onChange={(e) => syncDraft({ serviceDate: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-black"
                  />
                </motion.div>
                <div className="grid grid-cols-1 gap-4">
                  <motion.div>
                    <FieldLabel htmlFor="scheduled-time">Start Time</FieldLabel>
                    <input
                      id="scheduled-time"
                      name="timeSlot"
                      type="time"
                      value={draft.timeSlot || ''}
                      onChange={(e) => syncDraft({ timeSlot: e.target.value })}
                      className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-black outline-none focus:border-brand focus:ring-1"
                    />
                  </motion.div>
                </div>
              </div>
            )}

            {formError ? (
              <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-950">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                {formError}
              </p>
            ) : null}

            <BookingPrimaryButton type="button" onClick={handleReviewBooking} disabled={isCalculating}>
              {isCalculating ? 'Calculating...' : 'Review booking'}
              <ArrowRight className="h-4 w-4" aria-hidden />
            </BookingPrimaryButton>
          </motion.div>
        ) : null}

        {step === 'summary' ? (
          !calculatedBill ? (
            <div className="flex flex-col items-center justify-center p-8 gap-3">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-t-transparent" />
              <span className="text-sm font-semibold text-slate-500">Loading billing details...</span>
            </div>
          ) : (
            <motion.div className="space-y-4">
              <div className="lc-booking-flow-card space-y-3 text-sm lc-booking-flow-body">
                <div className="flex justify-between gap-2">
                  <span className="lc-booking-flow-muted">Service</span>
                  <span className="text-right font-bold text-black">
                    <span className="lc-booking-highlight-title block text-base">{draft.categoryName}</span>
                    {realUser?.role === 'contractor' && contractorServiceNames ? (
                      <span className="text-xs font-semibold">{contractorServiceNames}</span>
                    ) : draft.serviceName ? (
                      <span className="text-xs font-semibold">{draft.serviceName}</span>
                    ) : null}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="lc-booking-flow-muted">Booking</span>
                  <span className="font-bold capitalize text-black">{draft.bookingType}</span>
                </div>
                <div className="flex justify-between">
                  <span className="lc-booking-flow-muted">Date</span>
                  <span className="font-bold text-black">
                    {draft.bookingType === 'instant' ? 'Today (ASAP)' : new Date(draft.serviceDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="lc-booking-flow-muted">Time</span>
                  <span className="font-bold text-black">
                    {draft.bookingType === 'instant' ? 'Earliest Available' : draft.timeSlot}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="lc-booking-flow-muted">Duration</span>
                  <span className="font-bold text-black">
                    {draft.bookingType === 'instant'
                      ? formatDuration(parseFloat(draft.hours) || parseFloat(draft.minHours) || 1)
                      : durationKindLabel(draft.durationKind)}
                  </span>
                </div>

                <p className="flex items-start gap-2 font-medium text-black">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
                  {draft.address}
                </p>
                {draft.notes ? (
                  <div className="flex flex-col gap-1 pt-2 border-t border-slate-100">
                    <span className="lc-booking-flow-muted">Instructions</span>
                    <span className="text-sm font-medium text-slate-800 bg-slate-50/50 p-2.5 rounded-lg border border-slate-100">
                      {draft.notes}
                    </span>
                  </div>
                ) : null}
                <div className="border-t border-slate-200 pt-3 mt-2">
                  {realUser?.role === 'contractor' && calculatedBill.breakdown && calculatedBill.breakdown.length > 0 ? (
                    calculatedBill.breakdown.map((item, idx) => (
                      <div key={idx} className="flex justify-between font-semibold text-black mb-2">
                        <span className="flex flex-col">
                          <span>{item.name || 'Service fee'}</span>
                          <span className="text-[11px] text-slate-500 font-medium">
                            {`Hourly rate (${formatInr(item.hourlyRate)}/hr) × ${item.hours === 0.5 ? '30 min' : `${item.hours} hrs`}${item.quantity > 1 ? ` × ${item.quantity} workers` : ''}`}
                          </span>
                        </span>
                        <span>{formatInr(item.subTotal)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="flex justify-between font-semibold text-black">
                      <span className="flex flex-col">
                        <span>Service fee</span>
                        <span className="text-[11px] text-slate-500 font-medium">
                          {(() => {
                            const h = draft.durationKind === 'few_hours' ? (parseFloat(draft.hours) || parseFloat(draft.minHours) || 1) : 
                                     draft.durationKind === 'half_day' ? 4 : 
                                     draft.durationKind === 'full_day' ? 8 : 
                                     draft.durationKind === 'multi_day' ? ((draft.durationDays || 1) * 8) : 
                                     (parseFloat(draft.hours) || parseFloat(draft.minHours) || 1);
                            const q = draft.quantity || 1;
                            const hLabel = h === 0.5 ? '30 min' : `${h} hrs`
                            return `Hourly rate (${formatInr((calculatedBill.subTotal || calculatedBill.basePrice) / (h * q))}/hr) × ${hLabel}${q > 1 ? ` × ${q} workers` : ''}`;
                          })()}
                        </span>
                      </span>
                      <span>{formatInr(calculatedBill.subTotal || calculatedBill.basePrice)}</span>
                    </div>
                  )}
                  {calculatedBill.maxHourDiscount > 0 ? (
                    <div className="mt-1 flex justify-between font-semibold text-emerald-600">
                      <span>Discount</span>
                      <span>-{formatInr(calculatedBill.maxHourDiscount)}</span>
                    </div>
                  ) : null}
                  <div className="mt-1 flex justify-between lc-booking-flow-muted">
                    <span>Platform fee</span>
                    <span>{formatInr(calculatedBill.platformFee)}</span>
                  </div>
                  <div className="flex justify-between lc-booking-flow-muted">
                    <span>Taxes</span>
                    <span>{formatInr(calculatedBill.taxes)}</span>
                  </div>
                  <div className="mt-2 flex justify-between text-base font-extrabold text-black">
                    <span>Total</span>
                    <span>{formatInr(calculatedBill.totalAmount)}</span>
                  </div>
                </div>
              </div>

              <div className="lc-booking-flow-card space-y-3">
                <p className="lc-booking-flow-label font-bold text-slate-800">Payment Method</p>
                <div className={`grid gap-3 ${calculatedBill?.paymentModes?.cashEnabled && calculatedBill?.paymentModes?.onlineEnabled && realUser?.role !== 'contractor' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                  {calculatedBill?.paymentModes?.cashEnabled !== false && realUser?.role !== 'contractor' && (
                    <button
                      type="button"
                      onClick={() => syncDraft({ paymentMethod: 'CASH' })}
                      className={`flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 font-bold transition-all ${(draft.paymentMethod || 'CASH') === 'CASH'
                          ? 'border-brand bg-brand/5 text-brand'
                          : 'border-slate-200 text-slate-500 hover:border-brand/30 hover:bg-slate-50'
                        }`}
                    >
                      <IndianRupee className="h-5 w-5" />
                      Cash
                    </button>
                  )}
                  {calculatedBill?.paymentModes?.onlineEnabled !== false && (
                    <button
                      type="button"
                      onClick={() => syncDraft({ paymentMethod: 'ONLINE' })}
                      className={`flex items-center justify-center gap-2 rounded-xl border-2 px-4 py-3 font-bold transition-all ${draft.paymentMethod === 'ONLINE' || (realUser?.role === 'contractor' && !draft.paymentMethod)
                          ? 'border-brand bg-brand/5 text-brand'
                          : 'border-slate-200 text-slate-500 hover:border-brand/30 hover:bg-slate-50'
                        }`}
                    >
                      <Zap className="h-5 w-5" />
                      Online
                    </button>
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <button type="button" className="lc-booking-btn-secondary flex-1" onClick={() => goStep('details')}>
                  Edit details
                </button>
                <BookingPrimaryButton type="button" className="flex-1" onClick={confirmBooking} disabled={isCreating}>
                  {isCreating ? 'Sending req...' : 'Send req'}
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                </BookingPrimaryButton>
              </div>
            </motion.div>
          )
        ) : null}

        <BookingTypeSheet
          open={typeSheetOpen}
          onClose={() => setTypeSheetOpen(false)}
          value={draft.bookingType}
          categoryLabel={draft.categoryName}
          onSelect={(id) => {
            syncDraft({ bookingType: id })
            setTypeSheetOpen(false)
            goStep('details')
          }}
        />
      </div>
    </div>
  )
}

