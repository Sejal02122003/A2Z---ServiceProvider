import { useCallback, useEffect, useState, useRef, useMemo } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  AlertCircle,
  ArrowRight,
  CreditCard,
  IndianRupee,
  Loader2,
  MapPin,
  Wallet,
} from 'lucide-react'
import { bookingsApi } from '../../api/bookingsApi.js'
import { paymentsApi } from '../../api/paymentsApi.js'
import { adminSettingsApi, getPublicSettings } from '../../api/adminSettingsApi.js'
import { ApiError } from '../../api/http.js'
import { AppStackScreenHeader } from '../../components/app/AppStackScreenHeader.jsx'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { useAuth } from '../../hooks/useAuth.js'

const inputClass =
  'w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20'

function formatInr(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`
}

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

const getNext5Days = () => {
  const days = []
  const now = new Date()
  for (let i = 0; i < 5; i++) {
    const date = new Date(now)
    date.setDate(now.getDate() + i)
    days.push(date)
  }
  return days
}

export function Checkout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isGuest, user } = useAuth()
  const reduce = useReducedMotion()
  const [searchParams] = useSearchParams()
  const subcategoryId = searchParams.get('subcategoryId') || ''
  const subcategoryName = searchParams.get('name') || 'Service'
  const type = searchParams.get('type') || 'INSTANT'

  const [billLoading, setBillLoading] = useState(true)
  const [bill, setBill] = useState(null)
  const [billError, setBillError] = useState('')

  const [address, setAddress] = useState(user?.savedAddress?.text || '')
  const [lat, setLat] = useState(user?.savedAddress?.lat || 28.7041)
  const [lng, setLng] = useState(user?.savedAddress?.lng || 77.1025)
  const [scheduledTime, setScheduledTime] = useState('')
  const [saveAddress, setSaveAddress] = useState(true)
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [useWallet, setUseWallet] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const inputRef = useRef(null)
  const mapRef = useRef(null)
  const mapInstance = useRef(null)
  const markerInstance = useRef(null)

  const next5Days = useState(() => getNext5Days())[0]
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedTimeSlot, setSelectedTimeSlot] = useState('')
  const [timeSlots, setTimeSlots] = useState([])
  const [timeSlotsLoading, setTimeSlotsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    getPublicSettings()
      .then((res) => {
        if (!cancelled) {
          const slots = res.data?.timeSlots
          if (Array.isArray(slots) && slots.length > 0) {
            setTimeSlots(slots)
          } else {
            // Fallback
            setTimeSlots(['08:00 AM', '10:00 AM', '12:00 PM', '02:00 PM', '04:00 PM', '06:00 PM'])
          }
          setTimeSlotsLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTimeSlots(['08:00 AM', '10:00 AM', '12:00 PM', '02:00 PM', '04:00 PM', '06:00 PM'])
          setTimeSlotsLoading(false)
        }
      })
    return () => { cancelled = true }
  }, [])

  const filteredTimeSlots = useMemo(() => {
    if (!selectedDate) return timeSlots
    const now = new Date()
    const isToday = selectedDate.toDateString() === now.toDateString()
    if (!isToday) return timeSlots

    const currentMinutes = now.getHours() * 60 + now.getMinutes()
    
    return timeSlots.filter(slot => {
      const match = slot.match(/(\d+):(\d+) (AM|PM)/)
      if (!match) return true
      let [ , h, m, ampm ] = match
      h = parseInt(h, 10)
      m = parseInt(m, 10)
      if (ampm === 'PM' && h < 12) h += 12
      if (ampm === 'AM' && h === 12) h = 0
      
      const slotMinutes = h * 60 + m
      return slotMinutes > currentMinutes + 30 // Allow booking only if the slot is at least 30 mins from now
    })
  }, [selectedDate, timeSlots])

  useEffect(() => {
    if (selectedDate && selectedTimeSlot) {
      const dateStr = selectedDate.toISOString().split('T')[0]
      const match = selectedTimeSlot.match(/(\d+):(\d+) (AM|PM)/)
      if (match) {
        let [ , h, m, ampm ] = match
        h = parseInt(h, 10)
        if (ampm === 'PM' && h < 12) h += 12
        if (ampm === 'AM' && h === 12) h = 0
        const hours = String(h).padStart(2, '0')
        const datetime = new Date(`${dateStr}T${hours}:${m}:00`)
        setScheduledTime(datetime.toISOString())
      }
    }
  }, [selectedDate, selectedTimeSlot])

  // Initialize Google Maps Places Autocomplete and Map
  useEffect(() => {
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
      // 1. Autocomplete
      if (inputRef.current) {
        const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current, {
          fields: ['formatted_address', 'geometry', 'name'],
          types: ['geocode', 'establishment'],
        })
        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace()
          if (place.geometry && place.geometry.location) {
            setLat(place.geometry.location.lat())
            setLng(place.geometry.location.lng())
            setAddress(place.formatted_address || place.name || '')
          }
        })
      }

      // 2. Map
      if (mapRef.current && !mapInstance.current) {
        const currentPos = { 
          lat: user?.savedAddress?.lat || 28.7041, 
          lng: user?.savedAddress?.lng || 77.1025 
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

        // Update address on drag end
        markerInstance.current.addListener('dragend', () => {
          const pos = markerInstance.current.getPosition()
          setLat(pos.lat())
          setLng(pos.lng())
          
          const geocoder = new window.google.maps.Geocoder()
          geocoder.geocode({ location: pos }, (results, status) => {
            if (status === 'OK' && results[0]) {
              setAddress(results[0].formatted_address)
            }
          })
        })
      }
    }
  }, [user])

  // Sync map center if lat/lng change from outside (e.g. autocomplete)
  useEffect(() => {
    if (mapInstance.current && markerInstance.current) {
      const pos = { lat, lng }
      mapInstance.current.panTo(pos)
      markerInstance.current.setPosition(pos)
    }
  }, [lat, lng])

  // Calculate bill on mount
  useEffect(() => {
    if (!subcategoryId) {
      setBillError('No service selected')
      setBillLoading(false)
      return
    }
    let cancelled = false
    bookingsApi.calculateBill({ serviceId: subcategoryId })
      .then((res) => {
        if (cancelled) return
        setBill(res.data || {})
      })
      .catch((err) => {
        if (!cancelled) setBillError(err instanceof ApiError ? err.message : 'Failed to calculate bill')
      })
      .finally(() => {
        if (!cancelled) setBillLoading(false)
      })
    return () => { cancelled = true }
  }, [subcategoryId])

  const handleSubmit = useCallback(async () => {
    if (isGuest) {
      navigate('/auth', { replace: true, state: { from: location.pathname + location.search } })
      return
    }
    if (!address.trim()) {
      setSubmitError('Please enter your work location')
      return
    }
    if (type === 'SCHEDULED' && !scheduledTime) {
      setSubmitError('Please select a scheduled date and time')
      return
    }
    setSubmitError('')
    setSubmitting(true)

    try {
      const res = await bookingsApi.createBooking({
        serviceId: subcategoryId,
        type,
        scheduledAt: type === 'SCHEDULED' ? scheduledTime : undefined,
        timeSlot: type === 'SCHEDULED' ? 'MORNING' : undefined, // Provide a default timeslot or parse it from time
        locationText: address.trim(),
        lat,
        lng,
        saveAddress,
        paymentMethod,
        useWallet: Boolean(useWallet && bill?.walletInfo?.actualWalletDiscount > 0),
      })

      const booking = res.data?.booking
      if (!booking) throw new Error('Booking creation failed')

      if (paymentMethod === 'CASH') {
        navigate(`/app/tracking/${booking._id}`, { replace: true })
        return
      }

      // Online payment — Razorpay flow
      const razorpayLoaded = await loadRazorpay()
      if (!razorpayLoaded) {
        setSubmitError('Payment gateway failed to load. Please try again.')
        setSubmitting(false)
        return
      }

      const payRes = await paymentsApi.initPayment({
        amount: booking.totalAmount,
        purpose: 'BOOKING',
        bookingId: booking._id,
      })

      const order = payRes.data?.order
      if (!order) throw new Error('Payment initialization failed')

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_placeholder',
        amount: order.amount,
        currency: order.currency || 'INR',
        order_id: order.id,
        name: 'A2Z',
        description: `Booking: ${subcategoryName}`,
        handler: async function (response) {
          try {
            await paymentsApi.verifyPayment({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            })
            navigate(`/app/tracking/${booking._id}`, { replace: true })
          } catch (err) {
            setSubmitError('Payment verification failed. Contact support.')
            setSubmitting(false)
          }
        },
        modal: {
          ondismiss: () => {
            setSubmitting(false)
          },
        },
        theme: { color: '#009eb3' },
      }

      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : err.message || 'Booking failed')
      setSubmitting(false)
    }
  }, [address, lat, lng, paymentMethod, subcategoryId, subcategoryName, navigate, isGuest, location, scheduledTime, type])

  return (
    <div className="space-y-4 pb-8">
      <AppStackScreenHeader title="Checkout" onBack={() => navigate(-1)} />

      {/* Service Header */}
      <GlassPanel className="border-brand/20 bg-brand/5 px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-wider text-brand">Service</p>
        <p className="mt-1 text-base font-extrabold text-slate-900">{subcategoryName}</p>
      </GlassPanel>

      {/* Bill Breakdown */}
      <GlassPanel className="p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Bill Breakdown</p>
        {billLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-brand" />
          </div>
        ) : billError ? (
          <p className="mt-2 text-sm font-semibold text-rose-700">{billError}</p>
        ) : bill ? (
          <div className="mt-3 space-y-2 text-sm">
            {bill.originalSubTotal && bill.serviceDiscount > 0 ? (
              <div className="flex justify-between">
                <span className="text-slate-600">Original Rate</span>
                <span className="text-slate-400 line-through">{formatInr(bill.originalSubTotal)}</span>
              </div>
            ) : null}
            <div className="flex justify-between">
              <span className="text-slate-600">Base Price</span>
              <span className="font-bold text-slate-900">{formatInr(bill.basePrice)}</span>
            </div>
            {bill.serviceDiscount > 0 && (
              <div className="flex justify-between font-semibold text-emerald-600">
                <span>Special Service Offer</span>
                <span>-{formatInr(bill.serviceDiscount)}</span>
              </div>
            )}
            {bill.maxHourDiscount > 0 && (
              <div className="flex justify-between font-semibold text-emerald-600">
                <span>Duration Discount</span>
                <span>-{formatInr(bill.maxHourDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-600">Platform Fee</span>
              <span className="font-bold text-slate-900">{formatInr(bill.platformFee)}</span>
            </div>
            {bill.taxes != null && (
              <div className="flex justify-between">
                <span className="text-slate-600">Taxes (GST)</span>
                <span className="font-bold text-slate-900">{formatInr(bill.taxes)}</span>
              </div>
            )}

            {/* Wallet Balance & Discount Section */}
            {bill.walletInfo?.enabled && bill.walletInfo?.availableBalance > 0 && bill.walletInfo?.actualWalletDiscount > 0 && (
              <div className="mt-3 p-3 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded-lg bg-amber-500/10 text-amber-600">
                      <Wallet className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-900 dark:text-white">Use Wallet Balance</p>
                      <p className="text-[11px] text-slate-500">Available: {formatInr(bill.walletInfo.availableBalance)}</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useWallet}
                      onChange={(e) => setUseWallet(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>
                {useWallet && (
                  <div className="flex justify-between text-xs font-bold text-emerald-600 dark:text-emerald-400 pt-1 border-t border-amber-200/60">
                    <span>Wallet Discount Applied ({bill.walletInfo.percentage}% max):</span>
                    <span>-{formatInr(bill.walletInfo.actualWalletDiscount)}</span>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-between border-t border-slate-200 pt-2 text-base">
              <span className="font-extrabold text-slate-900">Total Payable</span>
              <span className="font-extrabold text-brand">
                {formatInr(
                  useWallet && bill.walletInfo?.actualWalletDiscount > 0
                    ? Math.max(0, bill.totalAmount - bill.walletInfo.actualWalletDiscount)
                    : bill.totalAmount
                )}
              </span>
            </div>
            {((bill.totalSavings > 0 || bill.serviceDiscount > 0) || (useWallet && bill.walletInfo?.actualWalletDiscount > 0)) && (
              <div className="mt-2.5 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200/80 p-2 text-center text-xs font-bold text-emerald-800">
                🎉 Total savings on this booking: {formatInr((bill.totalSavings || bill.serviceDiscount || 0) + (useWallet ? bill.walletInfo?.actualWalletDiscount || 0 : 0))}!
              </div>
            )}
          </div>
        ) : null}
      </GlassPanel>

      {/* Scheduled Time */}
      {type === 'SCHEDULED' && (
        <GlassPanel className="p-4">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Select Date
          </label>
          <div className="-mx-4 mt-3 flex gap-3 overflow-x-auto px-4 pb-2 scrollbar-none [&::-webkit-scrollbar]:hidden">
            {next5Days.map((d, i) => {
              const isSelected = selectedDate?.toDateString() === d.toDateString()
              const isToday = i === 0
              const dayName = isToday ? 'Today' : d.toLocaleDateString(undefined, { weekday: 'short' })
              const dateNum = d.getDate()
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  onClick={() => setSelectedDate(d)}
                  className={`flex h-16 w-14 shrink-0 flex-col items-center justify-center rounded-2xl border transition ${
                    isSelected
                      ? 'border-brand bg-brand text-white shadow-md shadow-brand/25'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-brand/30 hover:bg-brand/5'
                  }`}
                >
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${isSelected ? 'text-white/90' : 'text-slate-400'}`}>
                    {dayName}
                  </span>
                  <span className="text-lg font-extrabold">{dateNum}</span>
                </button>
              )
            })}
          </div>

          <AnimatePresence>
            {selectedDate && (
              <motion.div
                initial={reduce ? false : { opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 overflow-hidden"
              >
                <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Select Time Slot
                </label>
                {timeSlotsLoading ? (
                  <div className="mt-3 flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-brand" />
                  </div>
                ) : filteredTimeSlots.length === 0 ? (
                  <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-center text-sm font-semibold text-rose-800">
                    No time slots available for today. Please select tomorrow.
                  </div>
                ) : (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {filteredTimeSlots.map((slot) => {
                      const isSelected = selectedTimeSlot === slot
                      return (
                        <button
                          key={slot}
                          type="button"
                          onClick={() => setSelectedTimeSlot(slot)}
                          className={`rounded-xl border px-2 py-2.5 text-xs font-bold transition ${
                            isSelected
                              ? 'border-brand bg-brand text-white shadow-md shadow-brand/25'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-brand/30 hover:bg-brand/5'
                          }`}
                        >
                          {slot}
                        </button>
                      )
                    })}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </GlassPanel>
      )}

      {/* Address */}
      <GlassPanel className="p-4">
        <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
          <MapPin className="mr-1 inline h-3.5 w-3.5" aria-hidden />
          Work Location
        </label>
        <input
          ref={inputRef}
          type="text"
          className={inputClass + ' mt-2'}
          placeholder="House, street, area, city"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
        <div 
          ref={mapRef} 
          className="mt-3 w-full h-48 rounded-xl border border-slate-200 overflow-hidden bg-slate-100"
        />
        <label className="mt-4 flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
            checked={saveAddress}
            onChange={(e) => setSaveAddress(e.target.checked)}
          />
          Save this address for future bookings
        </label>
      </GlassPanel>

      {/* Error */}
      {submitError && (
        <motion.p
          initial={reduce ? false : { opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
          {submitError}
        </motion.p>
      )}

      {/* Submit */}
      <button
        type="button"
        disabled={submitting || billLoading || !bill}
        onClick={handleSubmit}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand px-6 py-4 text-base font-extrabold text-white shadow-lg shadow-brand/25 transition hover:bg-brand/90 active:scale-[0.98] disabled:opacity-50"
      >
        {submitting ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <>
            <ArrowRight className="h-5 w-5" aria-hidden />
            Confirm Booking
          </>
        )}
      </button>
    </div>
  )
}
