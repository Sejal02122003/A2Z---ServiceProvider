import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Trash2,
  Plus,
  Minus,
  Sparkles,
  ShoppingBag,
  Clock,
  MapPin,
  Calendar,
  CreditCard,
  Banknote,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  ShieldCheck,
  Tag,
  Wallet as WalletIcon
} from 'lucide-react'
import { useBookingCart } from '../../../context/BookingCartContext.jsx'
import { useAuth } from '../../../hooks/useAuth.js'
import { bookingsApi } from '../../../api/bookingsApi.js'
import { paymentsApi } from '../../../api/paymentsApi.js'
import { readAppUserLocation } from '../../../lib/appUserLocationStorage.js'
import { GlassPanel } from '../../../components/ui/GlassPanel.jsx'
import { getCategoryImageUrl } from '../../../lib/labourCategoryDisplay.js'

export function MultiServiceCartPage() {
  const navigate = useNavigate()
  const { realUser } = useAuth()
  const {
    cartItems,
    cartCount,
    removeFromCart,
    updateQuantity,
    clearCart,
  } = useBookingCart()

  // Booking settings state
  const [bookingType, setBookingType] = useState('INSTANT')
  const [scheduledDate, setScheduledDate] = useState(() => {
    const tomorrow = new Date()
    tomorrow.setDate(tomorrow.getDate() + 1)
    return tomorrow.toISOString().split('T')[0]
  })
  const [timeSlot, setTimeSlot] = useState('10:00 AM - 01:00 PM')
  const [notes, setNotes] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('CASH')
  const [useWallet, setUseWallet] = useState(false)

  // Address state
  const [locationText, setLocationText] = useState('')
  const [coordinates, setCoordinates] = useState({ lat: null, lng: null })

  // Authoritative calculation state
  const [billData, setBillData] = useState(null)
  const [calcLoading, setCalcLoading] = useState(false)
  const [calcError, setCalcError] = useState('')

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [bookingSuccessData, setBookingSuccessData] = useState(null)

  // Auto-fill user location / address
  useEffect(() => {
    const saved = readAppUserLocation()
    if (saved?.address) {
      setLocationText(saved.address)
    } else if (realUser?.savedAddress?.text) {
      setLocationText(realUser.savedAddress.text)
    }

    if (saved?.lat && saved?.lng) {
      setCoordinates({ lat: saved.lat, lng: saved.lng })
    } else if (realUser?.savedAddress?.lat && realUser?.savedAddress?.lng) {
      setCoordinates({ lat: realUser.savedAddress.lat, lng: realUser.savedAddress.lng })
    }
  }, [realUser])

  // Call authoritative backend calculateBill whenever cartItems change
  useEffect(() => {
    if (cartItems.length === 0) {
      setBillData(null)
      return
    }

    let isMounted = true
    setCalcLoading(true)
    setCalcError('')

    const payload = {
      items: cartItems.map((it) => ({
        serviceId: it.serviceId,
        subServiceId: it.subServiceId || undefined,
        quantity: it.quantity || 1,
        hours: it.hours || 1,
      })),
      lat: coordinates.lat || 28.6139,
      lng: coordinates.lng || 77.2090,
      useWallet,
    }

    bookingsApi
      .calculateBill(payload)
      .then((res) => {
        if (!isMounted) return
        setBillData(res.data)
      })
      .catch((err) => {
        if (!isMounted) return
        console.error('Calculate bill error:', err)
        setCalcError(err?.message || 'Failed to calculate bill accurately from server.')
      })
      .finally(() => {
        if (isMounted) setCalcLoading(false)
      })

    return () => {
      isMounted = false
    }
  }, [cartItems, coordinates.lat, coordinates.lng, useWallet])

  // Wallet discount calculations
  const walletInfo = billData?.walletInfo
  const walletAvailable = Number(walletInfo?.walletBalance || 0)
  const maxWalletDiscount = Number(walletInfo?.maxWalletDiscount || 0)
  const canUseWallet = walletInfo?.enabled && maxWalletDiscount > 0

  const subTotal = billData?.subTotal ?? 0
  const originalSubTotal = billData?.originalSubTotal ?? subTotal
  const savings = billData?.totalSavings ?? Math.max(0, originalSubTotal - subTotal)
  const taxes = billData?.taxes ?? 0
  const platformFee = billData?.platformFee ?? 0

  const walletDiscountApplied = useWallet && canUseWallet ? maxWalletDiscount : 0
  const totalAmount = Math.max(0, (billData?.totalAmount ?? subTotal + taxes) - (useWallet ? walletDiscountApplied : 0))

  const handleCheckout = async () => {
    setSubmitError('')

    if (cartItems.length === 0) {
      setSubmitError('Cart is empty. Please add services first.')
      return
    }

    if (!locationText.trim()) {
      setSubmitError('Please provide a complete service address.')
      return
    }

    if (bookingType === 'SCHEDULED' && (!scheduledDate || !timeSlot)) {
      setSubmitError('Please choose a preferred schedule date and time slot.')
      return
    }

    // Require authentication
    if (!realUser?._id) {
      navigate('/users/auth?redirect=/app/cart')
      return
    }

    setIsSubmitting(true)

    try {
      const payload = {
        items: cartItems.map((it) => ({
          serviceId: it.serviceId,
          subServiceId: it.subServiceId || undefined,
          serviceName: it.serviceName,
          subServiceName: it.subServiceName || undefined,
          quantity: it.quantity || 1,
          hours: it.hours || 1,
        })),
        type: bookingType,
        scheduledAt: bookingType === 'SCHEDULED' ? scheduledDate : undefined,
        timeSlot: bookingType === 'SCHEDULED' ? timeSlot : 'INSTANT',
        locationText: locationText.trim(),
        lat: coordinates.lat || 28.6139,
        lng: coordinates.lng || 77.2090,
        paymentMethod,
        useWallet,
        notes: notes.trim() || undefined,
      }

      const res = await bookingsApi.createBooking(payload)
      const createdBooking = res.data?.booking

      if (!createdBooking) {
        throw new Error('Booking could not be created.')
      }

      // If payment is ONLINE, trigger Razorpay
      if (paymentMethod === 'ONLINE' && createdBooking.totalAmount > 0) {
        try {
          const payRes = await paymentsApi.initPayment({
            amount: createdBooking.totalAmount,
            purpose: 'BOOKING',
            bookingId: createdBooking._id,
          })
          const order = payRes.data?.order

          if (order && window.Razorpay) {
            const rzp = new window.Razorpay({
              key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_placeholder',
              amount: order.amount,
              currency: order.currency || 'INR',
              order_id: order.id,
              name: 'A2Z Service Provider',
              description: `Multi-Service Booking #${String(createdBooking._id).slice(-6).toUpperCase()}`,
              prefill: {
                name: realUser?.fullName || '',
                contact: realUser?.phone || '',
                email: realUser?.email || '',
              },
              handler: async function (response) {
                try {
                  await paymentsApi.verifyPayment({
                    razorpayOrderId: response.razorpay_order_id,
                    razorpayPaymentId: response.razorpay_payment_id,
                    razorpaySignature: response.razorpay_signature,
                  })
                } catch (verifyErr) {
                  console.error('Payment verification error:', verifyErr)
                } finally {
                  clearCart()
                  navigate(`/app/tracking/${createdBooking._id}`)
                }
              },
              modal: {
                ondismiss: () => {
                  clearCart()
                  navigate(`/app/tracking/${createdBooking._id}`)
                },
              },
              theme: { color: '#009eb3' },
            })
            rzp.open()
            return
          }
        } catch (payErr) {
          console.warn('Payment init issue, proceeding with booking confirmation:', payErr)
        }
      }

      // Successful Cash Booking
      clearCart()
      setBookingSuccessData(createdBooking)
    } catch (err) {
      console.error('Booking submission error:', err)
      setSubmitError(err?.message || 'Failed to confirm booking. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Success Confirmation Screen
  if (bookingSuccessData) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center px-4 py-12">
        <div className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 text-center shadow-xl border border-slate-100 space-y-4">
          <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-sm animate-bounce">
            <CheckCircle2 className="h-10 w-10 stroke-[2.5]" />
          </div>
          <h2 className="text-xl font-black text-slate-900">Multi-Service Booking Confirmed!</h2>
          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            All <strong>{bookingSuccessData.multiServiceBooking?.items?.length || cartCount}</strong> services have been scheduled under Booking{' '}
            <span className="font-mono font-bold text-slate-800">
              #{String(bookingSuccessData._id).slice(-6).toUpperCase()}
            </span>. Our top-rated experts are being assigned!
          </p>

          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 text-left space-y-2">
            <div className="flex justify-between text-xs font-semibold text-slate-700">
              <span>Total Services:</span>
              <span className="font-bold text-slate-900">
                {bookingSuccessData.multiServiceBooking?.items?.length || 1} Services
              </span>
            </div>
            <div className="flex justify-between text-xs font-semibold text-slate-700">
              <span>Payment Mode:</span>
              <span className="font-bold text-slate-900">{bookingSuccessData.paymentMethod}</span>
            </div>
            <div className="flex justify-between text-xs font-semibold text-slate-700">
              <span>Total Payable:</span>
              <span className="font-extrabold text-blue-600 text-sm font-mono">
                ₹{bookingSuccessData.totalAmount?.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          <div className="pt-2 flex flex-col gap-2.5">
            <button
              type="button"
              onClick={() => navigate(`/app/tracking/${bookingSuccessData._id}`)}
              className="w-full rounded-2xl bg-brand py-3 text-sm font-black uppercase tracking-wider text-white shadow-md shadow-brand/25 transition active:scale-98 hover:bg-brand/90"
            >
              Track Live Booking
            </button>
            <button
              type="button"
              onClick={() => navigate('/app')}
              className="w-full rounded-2xl border border-slate-200 bg-white py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Empty Cart State
  if (cartItems.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 pb-20">
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-2xs hover:bg-slate-50"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-base font-black tracking-tight text-slate-900">Booking Cart</h1>
          </div>
        </header>

        <div className="flex flex-col items-center justify-center px-4 py-24 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-4">
            <ShoppingBag className="h-10 w-10 stroke-[1.5]" />
          </div>
          <h2 className="text-lg font-black text-slate-900">Your Booking Cart is Empty</h2>
          <p className="mt-1.5 max-w-xs text-xs font-medium text-slate-500 leading-relaxed">
            Explore our categories and add multiple home services to book them together in a single unified checkout!
          </p>
          <button
            type="button"
            onClick={() => navigate('/app')}
            className="mt-6 rounded-2xl bg-brand px-6 py-3 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-brand/25 transition active:scale-95 hover:bg-brand/90"
          >
            Explore Services
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-36">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 shadow-2xs hover:bg-slate-50"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-base font-black tracking-tight text-slate-900 leading-none">
                Booking Cart
              </h1>
              <p className="text-[11px] font-semibold text-slate-500 mt-0.5">
                {cartCount} {cartCount === 1 ? 'service item' : 'service items'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={clearCart}
            className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 transition"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Clear
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Selected Services Section */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-500">
              Selected Services ({cartItems.length})
            </h2>
            <button
              type="button"
              onClick={() => navigate('/app')}
              className="text-xs font-bold text-brand hover:underline flex items-center gap-0.5"
            >
              <span>+ Add more services</span>
            </button>
          </div>

          <div className="space-y-2.5">
            {cartItems.map((item) => (
              <div
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-3.5 shadow-xs transition hover:border-slate-300"
              >
                <div className="flex items-start gap-3">
                  {/* Thumbnail */}
                  <div className="h-14 w-14 shrink-0 rounded-xl overflow-hidden bg-slate-100 border border-slate-100">
                    {item.iconUrl ? (
                      <img
                        src={getCategoryImageUrl({ name: item.serviceName, imageUrl: item.iconUrl })}
                        alt={item.serviceName}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-slate-300">
                        <ShoppingBag className="h-6 w-6" />
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="flex-1 min-w-0 pr-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-1">
                        {item.displayName || item.serviceName}
                      </h3>
                      {item.offerBadge && (
                        <span className="text-[9px] font-extrabold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-md border border-amber-200">
                          {item.offerBadge}
                        </span>
                      )}
                    </div>
                    {item.categoryName && (
                      <p className="text-[11px] text-slate-400 font-medium line-clamp-1">
                        {item.categoryName}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500 font-medium">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-slate-400" />
                        {item.estimatedDurationMins || 45} mins
                      </span>
                    </div>

                    {/* Price and Stepper */}
                    <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-mono text-sm font-black text-blue-600">
                          ₹{(item.price * (item.quantity || 1)).toLocaleString('en-IN')}
                        </span>
                        {item.originalPrice > item.price && (
                          <span className="text-[11px] font-medium text-slate-400 line-through">
                            ₹{(item.originalPrice * (item.quantity || 1)).toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Quantity Stepper */}
                        <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50 overflow-hidden shadow-2xs">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, (item.quantity || 1) - 1)}
                            className="p-1.5 text-slate-600 hover:bg-slate-200 transition"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="px-2.5 text-xs font-bold text-slate-800 font-mono">
                            {item.quantity || 1}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, (item.quantity || 1) + 1)}
                            className="p-1.5 text-slate-600 hover:bg-slate-200 transition"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>

                        {/* Remove Action */}
                        <button
                          type="button"
                          onClick={() => removeFromCart(item.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                          title="Remove service"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Schedule & Fulfillment Details */}
        <section className="bg-white rounded-3xl border border-slate-200/80 p-4 shadow-xs space-y-4">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <Calendar className="h-4 w-4 text-brand" />
            Scheduling & Timing
          </h2>

          {/* Type Toggle */}
          <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl">
            <button
              type="button"
              onClick={() => setBookingType('INSTANT')}
              className={`py-2 text-xs font-extrabold rounded-xl transition ${
                bookingType === 'INSTANT'
                  ? 'bg-white text-brand shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              ⚡ Instant (30-45 mins)
            </button>
            <button
              type="button"
              onClick={() => setBookingType('SCHEDULED')}
              className={`py-2 text-xs font-extrabold rounded-xl transition ${
                bookingType === 'SCHEDULED'
                  ? 'bg-white text-brand shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📅 Schedule for Later
            </button>
          </div>

          {bookingType === 'SCHEDULED' && (
            <div className="space-y-3 pt-1">
              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase">Select Date</label>
                <input
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs font-bold text-slate-800 focus:border-brand focus:bg-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-500 uppercase">Select Preferred Time Slot</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  {[
                    '08:00 AM - 11:00 AM',
                    '11:00 AM - 02:00 PM',
                    '02:00 PM - 05:00 PM',
                    '05:00 PM - 08:00 PM',
                  ].map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setTimeSlot(slot)}
                      className={`p-2.5 text-xs font-bold rounded-xl border text-center transition ${
                        timeSlot === slot
                          ? 'border-brand bg-brand/5 text-brand ring-1 ring-brand/30'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Service Address */}
          <div className="pt-2 border-t border-slate-100">
            <label className="text-[11px] font-bold text-slate-500 uppercase flex items-center gap-1 mb-1">
              <MapPin className="h-3.5 w-3.5 text-brand" />
              Service Address
            </label>
            <input
              type="text"
              placeholder="Enter complete house/flat no., street, locality"
              value={locationText}
              onChange={(e) => setLocationText(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs font-semibold text-slate-800 focus:border-brand focus:bg-white focus:outline-hidden"
            />
          </div>

          {/* Additional Instructions */}
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase mb-1 block">
              Instructions or Landmark (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="e.g. Near city park, call before arrival"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-2.5 text-xs font-medium text-slate-800 focus:border-brand focus:bg-white focus:outline-hidden resize-none"
            />
          </div>
        </section>

        {/* Wallet Discount Option */}
        {canUseWallet && (
          <section className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-3xl border border-amber-200/80 p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs">
                  <WalletIcon className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-xs font-bold text-amber-950">A2Z Customer Wallet</h3>
                  <p className="text-[11px] font-medium text-amber-800">
                    Balance: ₹{walletAvailable} • Save ₹{maxWalletDiscount} on this booking
                  </p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={useWallet}
                  onChange={(e) => setUseWallet(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-600"></div>
              </label>
            </div>
          </section>
        )}

        {/* Payment Method Section */}
        <section className="bg-white rounded-3xl border border-slate-200/80 p-4 shadow-xs space-y-3">
          <h2 className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
            <CreditCard className="h-4 w-4 text-brand" />
            Payment Mode
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPaymentMethod('CASH')}
              className={`p-3 rounded-2xl border flex items-center gap-2.5 text-left transition ${
                paymentMethod === 'CASH'
                  ? 'border-brand bg-brand/5 text-slate-900 ring-1 ring-brand/30'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              <Banknote className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-xs font-bold leading-tight">Cash on Service</p>
                <p className="text-[10px] text-slate-500 font-medium">Pay after completion</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setPaymentMethod('ONLINE')}
              className={`p-3 rounded-2xl border flex items-center gap-2.5 text-left transition ${
                paymentMethod === 'ONLINE'
                  ? 'border-brand bg-brand/5 text-slate-900 ring-1 ring-brand/30'
                  : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
              }`}
            >
              <CreditCard className="h-5 w-5 text-blue-600 shrink-0" />
              <div>
                <p className="text-xs font-bold leading-tight">Pay Online</p>
                <p className="text-[10px] text-slate-500 font-medium">UPI, Cards, Netbanking</p>
              </div>
            </button>
          </div>
        </section>

        {/* Price Breakdown Section */}
        <section className="bg-white rounded-3xl border border-slate-200/80 p-4 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-700">
              Bill Summary (Validated by Server)
            </h2>
            {calcLoading && (
              <span className="flex items-center gap-1 text-[11px] font-bold text-brand">
                <Loader2 className="h-3 w-3 animate-spin" />
                Calculating...
              </span>
            )}
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600 font-medium">
              <span>Items Total ({cartCount})</span>
              <span className="font-semibold text-slate-900 font-mono">
                ₹{originalSubTotal.toLocaleString('en-IN')}
              </span>
            </div>

            {savings > 0 && (
              <div className="flex justify-between text-emerald-600 font-bold">
                <span>Special Offer Savings</span>
                <span className="font-mono">-₹{savings.toLocaleString('en-IN')}</span>
              </div>
            )}

            <div className="flex justify-between text-slate-600 font-medium">
              <span>Subtotal</span>
              <span className="font-semibold text-slate-900 font-mono">
                ₹{subTotal.toLocaleString('en-IN')}
              </span>
            </div>

            {taxes > 0 && (
              <div className="flex justify-between text-slate-600 font-medium">
                <span>Taxes & GST (Calculated per Category)</span>
                <span className="font-semibold text-slate-900 font-mono">
                  +₹{Math.round(taxes).toLocaleString('en-IN')}
                </span>
              </div>
            )}

            {useWallet && walletDiscountApplied > 0 && (
              <div className="flex justify-between text-amber-700 font-bold">
                <span>Wallet Discount</span>
                <span className="font-mono">-₹{walletDiscountApplied.toLocaleString('en-IN')}</span>
              </div>
            )}

            <div className="border-t border-slate-200/80 pt-2.5 flex justify-between items-baseline">
              <span className="text-sm font-black text-slate-900">Total Payable Amount</span>
              <span className="text-lg font-black text-blue-600 font-mono">
                ₹{Math.round(totalAmount).toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        </section>

        {/* Error message */}
        {(calcError || submitError) && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 flex items-center gap-2 text-rose-700 text-xs font-semibold">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{submitError || calcError}</span>
          </div>
        )}

        {/* Trust Badge */}
        <div className="flex items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-400 py-1">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span>100% Verified Partners • Safe & Secure Booking</span>
        </div>
      </main>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 border-t border-slate-200 px-4 py-3 backdrop-blur-md shadow-lg">
        <div className="max-w-2xl mx-auto flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase text-slate-400">Total Payable</p>
            <p className="text-xl font-black text-blue-600 font-mono leading-none">
              ₹{Math.round(totalAmount).toLocaleString('en-IN')}
            </p>
          </div>

          <button
            type="button"
            disabled={isSubmitting || calcLoading}
            onClick={handleCheckout}
            className="flex-1 max-w-xs rounded-2xl bg-brand py-3.5 px-4 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-brand/25 transition active:scale-98 hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <span>Confirm Booking ({cartCount})</span>
                <ChevronRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
export default MultiServiceCartPage
