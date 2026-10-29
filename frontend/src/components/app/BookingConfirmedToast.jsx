import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { CheckCircle2, ChevronRight, KeyRound, MapPin, Phone, Sparkles, User, X } from 'lucide-react'
import { useSelector } from 'react-redux'
import { useSocket } from '../../context/SocketContext.jsx'
import { USER_ROLES } from '../../constants/userRoles.js'

export function BookingConfirmedToast() {
  const socket = useSocket()
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const user = useSelector((s) => s.auth.user)
  const timerRef = useRef(null)

  const [confirmation, setConfirmation] = useState(null)

  // Only render for customer or contractor roles (the buyers who created the booking)
  const isCustomer = !user?.role || user?.role === USER_ROLES.CUSTOMER || user?.role === USER_ROLES.CONTRACTOR || user?.role === 'customer' || user?.role === 'contractor'

  const handleDismiss = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    setConfirmation(null)
  }, [])

  useEffect(() => {
    if (!isCustomer || !socket) return

    const handleBookingAccepted = (data) => {
      if (!data?.bookingId) return

      const payload = {
        bookingId: data.bookingId,
        partnerId: data.laborId || data.partner?.id,
        partnerName: data.partnerName || data.partner?.name || 'Service Partner',
        partnerPhone: data.partnerPhone || data.partner?.phone || '',
        partnerAvatar: data.partnerAvatar || data.partner?.profileImageUrl || '',
        serviceName: data.serviceName || data.partner?.serviceName || 'Requested Service',
        startOtp: data.startOtp || '',
        completionOtp: data.completionOtp || '',
        scheduledAt: data.scheduledAt,
        timeSlot: data.timeSlot,
        bookingType: data.bookingType || 'INSTANT',
      }

      setConfirmation(payload)

      // Auto dismiss after 30 seconds
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        setConfirmation(null)
      }, 30000)
    }

    socket.on('BOOKING_ACCEPTED', handleBookingAccepted)

    return () => {
      socket.off('BOOKING_ACCEPTED', handleBookingAccepted)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [socket, isCustomer])

  if (!isCustomer || !confirmation) return null

  const {
    bookingId,
    partnerName,
    partnerPhone,
    partnerAvatar,
    serviceName,
    startOtp,
    bookingType,
  } = confirmation

  return (
    <AnimatePresence>
      <motion.div
        initial={reduce ? false : { opacity: 0, y: -40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduce ? undefined : { opacity: 0, y: -30, scale: 0.95 }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
        className="fixed inset-x-4 top-4 z-[400] mx-auto max-w-md overflow-hidden rounded-3xl border border-emerald-300 bg-white shadow-2xl shadow-emerald-950/20"
      >
        {/* Top Header Banner */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-3 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
                <CheckCircle2 className="h-4 w-4 text-white" />
              </span>
              <div>
                <h4 className="text-sm font-black tracking-tight leading-none">Booking Confirmed!</h4>
                <p className="text-[11px] font-medium text-emerald-100 mt-0.5">
                  {bookingType === 'INSTANT' ? 'Service provider is on the way' : 'Service provider confirmed for your slot'}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleDismiss}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-emerald-100 hover:bg-white/20 hover:text-white transition"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Worker Details Card */}
        <div className="p-4 space-y-3.5">
          <div className="flex items-center gap-3.5">
            <div className="relative">
              {partnerAvatar ? (
                <img
                  src={partnerAvatar}
                  alt={partnerName}
                  className="h-14 w-14 rounded-2xl object-cover ring-2 ring-emerald-100 shadow-sm"
                />
              ) : (
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-teal-100 text-emerald-700 ring-2 ring-emerald-100 font-black text-lg">
                  {partnerName ? partnerName.charAt(0).toUpperCase() : <User className="h-6 w-6" />}
                </div>
              )}
              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white ring-2 ring-white">
                <Sparkles className="h-2.5 w-2.5" />
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <h5 className="text-base font-extrabold text-slate-900 truncate">{partnerName}</h5>
                <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-200">
                  Assigned
                </span>
              </div>
              <p className="text-xs font-semibold text-slate-500 truncate mt-0.5">{serviceName}</p>
              {partnerPhone && (
                <p className="text-xs font-bold text-emerald-700 mt-0.5">
                  📞 {partnerPhone}
                </p>
              )}
            </div>
          </div>

          {/* Security OTP section */}
          {startOtp && (
            <div className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50/70 px-3.5 py-2.5">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-500 text-white shadow-sm">
                  <KeyRound className="h-3.5 w-3.5" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700">Start Job OTP</p>
                  <p className="text-[11px] font-medium text-amber-800">Share with partner upon arrival</p>
                </div>
              </div>
              <div className="rounded-xl bg-white px-3 py-1 font-mono text-base font-black tracking-widest text-slate-900 shadow-sm ring-1 ring-amber-300">
                {startOtp}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2.5 pt-1">
            {partnerPhone ? (
              <a
                href={`tel:${partnerPhone}`}
                className="flex items-center justify-center gap-1.5 rounded-2xl border-2 border-emerald-600 bg-emerald-50/50 px-3 py-2.5 text-xs font-black text-emerald-700 transition hover:bg-emerald-100 active:scale-95"
              >
                <Phone className="h-3.5 w-3.5" />
                Call Partner
              </a>
            ) : (
              <div />
            )}

            <button
              type="button"
              onClick={() => {
                handleDismiss()
                navigate(`/app/tracking/${bookingId}`)
              }}
              className="flex items-center justify-center gap-1.5 rounded-2xl bg-emerald-600 px-3 py-2.5 text-xs font-black text-white shadow-md shadow-emerald-600/30 transition hover:bg-emerald-700 active:scale-95"
            >
              Track Live
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
