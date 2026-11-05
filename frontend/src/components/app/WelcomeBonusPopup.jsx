import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  Gift,
  PartyPopper,
  Sparkles,
  Wallet,
  ArrowRight,
  CheckCircle2,
  X,
  ShieldCheck,
  Zap,
} from 'lucide-react'
import { useSelector } from 'react-redux'
import { USER_ROLES } from '../../constants/userRoles.js'

export function WelcomeBonusPopup() {
  const navigate = useNavigate()
  const location = useLocation()
  const reduce = useReducedMotion()
  const user = useSelector((s) => s.auth.user)
  const audioCtxRef = useRef(null)

  const [isOpen, setIsOpen] = useState(false)
  const [bonusData, setBonusData] = useState({
    amount: 1000,
    balance: 1000,
    message: '',
  })

  // Play a pleasant celebratory chime when popup opens
  const playCelebrationChime = useCallback(() => {
    try {
      const AudioCtxClass = window.AudioContext || window.webkitAudioContext
      if (!AudioCtxClass) return
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioCtxClass()
      }
      const ctx = audioCtxRef.current
      if (ctx.state === 'suspended') {
        ctx.resume()
      }

      const now = ctx.currentTime
      const notes = [
        { freq: 523.25, time: 0.00, dur: 0.22 }, // C5
        { freq: 659.25, time: 0.12, dur: 0.22 }, // E5
        { freq: 783.99, time: 0.24, dur: 0.26 }, // G5
        { freq: 1046.50, time: 0.38, dur: 0.55 }, // C6 (long ring)
      ]

      notes.forEach(({ freq, time, dur }) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(freq, now + time)
        gain.gain.setValueAtTime(0.28, now + time)
        gain.gain.exponentialRampToValueAtTime(0.001, now + time + dur)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(now + time)
        osc.stop(now + time + dur)
      })
    } catch {
      // Audio autoplay policy fallback
    }
  }, [])

  const triggerOpen = useCallback(
    (data = {}) => {
      const amt = Number(data.amount || data.bonusAmount || user?.welcomeBonusAmount || 1000)
      const bal = Number(data.balance || data.balanceAfter || amt)
      const msg = data.message || `₹${amt.toLocaleString('en-IN')} welcome bonus added to your wallet`

      setBonusData({ amount: amt, balance: bal, message: msg })
      setIsOpen(true)
      playCelebrationChime()

      // Mark celebrated in localStorage so customer is not spammed again
      const userKey = user?._id || user?.phone || 'customer'
      try {
        localStorage.setItem(`a2z_welcome_bonus_celebrated_${userKey}`, 'true')
        sessionStorage.removeItem('a2z_pending_welcome_bonus')
      } catch {}
    },
    [user, playCelebrationChime],
  )

  const handleDismiss = useCallback(() => {
    setIsOpen(false)
    const userKey = user?._id || user?.phone || 'customer'
    try {
      localStorage.setItem(`a2z_welcome_bonus_celebrated_${userKey}`, 'true')
      sessionStorage.removeItem('a2z_pending_welcome_bonus')
    } catch {}
  }, [user])

  const handleViewWallet = useCallback(() => {
    handleDismiss()
    navigate('/user/wallet')
  }, [handleDismiss, navigate])

  const handleExploreServices = useCallback(() => {
    handleDismiss()
    navigate('/user')
  }, [handleDismiss, navigate])

  // 1. Check for imperative custom event trigger
  useEffect(() => {
    const handleCustomEvent = (e) => {
      if (e?.detail) {
        triggerOpen(e.detail)
      }
    }
    window.addEventListener('a2z-show-welcome-bonus', handleCustomEvent)
    return () => window.removeEventListener('a2z-show-welcome-bonus', handleCustomEvent)
  }, [triggerOpen])

  // 2. Check for navigation state trigger
  useEffect(() => {
    if (location.state?.welcomeBonus?.credited) {
      triggerOpen(location.state.welcomeBonus)
    }
  }, [location.state, triggerOpen])

  // 3. Check for pending bonus in sessionStorage
  useEffect(() => {
    try {
      const pendingRaw = sessionStorage.getItem('a2z_pending_welcome_bonus')
      if (pendingRaw) {
        const parsed = JSON.parse(pendingRaw)
        if (parsed?.credited) {
          triggerOpen(parsed)
        }
      }
    } catch {}
  }, [triggerOpen])

  // 4. Check for newly registered customer user who hasn't seen the celebration popup yet
  useEffect(() => {
    if (!user || user.role === USER_ROLES.LABOUR || user.role === USER_ROLES.ADMIN) return

    const userKey = user._id || user.phone
    if (!userKey) return

    try {
      const alreadyCelebrated = localStorage.getItem(`a2z_welcome_bonus_celebrated_${userKey}`)
      if (!alreadyCelebrated && user.welcomeBonusCredited) {
        // Small delay so page transition completes smoothly
        const t = setTimeout(() => {
          triggerOpen({
            amount: user.welcomeBonusAmount || 1000,
            balance: user.welcomeBonusAmount || 1000,
          })
        }, 600)
        return () => clearTimeout(t)
      }
    } catch {}
  }, [user, triggerOpen])

  if (!isOpen) return null

  // Confetti particles for celebration effect
  const confettiPieces = [
    { top: '10%', left: '12%', color: 'bg-amber-400', size: 'w-2.5 h-2.5', rotate: 'rotate-12' },
    { top: '16%', right: '14%', color: 'bg-emerald-400', size: 'w-3 h-2', rotate: '-rotate-45' },
    { top: '24%', left: '8%', color: 'bg-rose-400', size: 'w-2 h-3', rotate: 'rotate-45' },
    { top: '30%', right: '10%', color: 'bg-indigo-400', size: 'w-2.5 h-2.5', rotate: 'rotate-6' },
    { top: '50%', left: '10%', color: 'bg-teal-400', size: 'w-3 h-1.5', rotate: '-rotate-12' },
    { top: '65%', right: '8%', color: 'bg-amber-300', size: 'w-2 h-2.5', rotate: 'rotate-30' },
    { top: '75%', left: '14%', color: 'bg-purple-400', size: 'w-2.5 h-2', rotate: '-rotate-24' },
    { top: '82%', right: '15%', color: 'bg-emerald-400', size: 'w-3 h-3 rounded-full', rotate: '' },
  ]

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        {/* Backdrop Blur */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={handleDismiss}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-md transition-opacity"
          aria-hidden="true"
        />

        {/* Modal Card */}
        <motion.div
          initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.85, y: 20 }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 15 }}
          transition={{ type: 'spring', damping: 24, stiffness: 300 }}
          className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-900/10 text-center z-10"
          role="dialog"
          aria-modal="true"
          aria-labelledby="welcome-bonus-title"
        >
          {/* Confetti Elements */}
          {confettiPieces.map((p, idx) => (
            <span
              key={idx}
              className={`absolute pointer-events-none rounded-sm shadow-xs ${p.size} ${p.color} ${p.rotate}`}
              style={{ top: p.top, left: p.left, right: p.right }}
            />
          ))}

          {/* Top Decorative Header with Radial Glow */}
          <div className="relative bg-gradient-to-br from-amber-500 via-amber-600 to-yellow-600 px-6 pt-9 pb-8 text-white overflow-hidden">
            {/* Background radiant circles */}
            <div className="absolute -top-12 -left-12 h-40 w-40 rounded-full bg-white/15 blur-2xl pointer-events-none" />
            <div className="absolute -bottom-10 -right-10 h-44 w-44 rounded-full bg-yellow-300/20 blur-2xl pointer-events-none" />

            {/* Close Button */}
            <button
              type="button"
              onClick={handleDismiss}
              className="absolute top-3.5 right-3.5 rounded-full bg-white/20 p-1.5 text-white/90 hover:bg-white/30 hover:text-white transition focus:outline-none focus:ring-2 focus:ring-white"
              aria-label="Close Congratulations popup"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Congratulations Pill Badge */}
            <div className="inline-flex items-center gap-1.5 rounded-full bg-white/25 px-4 py-1 text-xs font-black tracking-wider uppercase text-white shadow-xs backdrop-blur-xs mb-3 border border-white/20">
              <PartyPopper className="h-3.5 w-3.5 text-amber-200" />
              <span>Congratulations!</span>
              <Sparkles className="h-3.5 w-3.5 text-yellow-200" />
            </div>

            {/* Hero Icon with Pulsing Halo */}
            <div className="relative mx-auto my-1 flex h-20 w-20 items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-white/20 animate-ping pointer-events-none opacity-60" />
              <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-white shadow-xl shadow-amber-900/30 ring-4 ring-white/30">
                <Gift className="h-10 w-10 text-amber-600 animate-bounce" />
              </div>
            </div>

            <h2 id="welcome-bonus-title" className="text-2xl font-black tracking-tight text-white mt-3">
              Welcome Bonus Credited!
            </h2>
            <p className="text-xs font-semibold text-amber-100 max-w-xs mx-auto mt-1">
              Your exclusive registration reward is now ready in your A2Z Wallet.
            </p>
          </div>

          {/* Modal Body */}
          <div className="px-6 py-5 space-y-4">
            {/* Bonus Amount Card */}
            <div className="rounded-2xl bg-gradient-to-b from-emerald-50/90 to-teal-50/50 p-4 border border-emerald-200/80 shadow-2xs space-y-1">
              <p className="text-[11px] font-black uppercase tracking-wider text-emerald-800 flex items-center justify-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-emerald-600" /> Welcome Wallet Credit
              </p>
              <div className="text-4xl sm:text-5xl font-black text-emerald-700 tracking-tight">
                ₹{bonusData.amount.toLocaleString('en-IN')}
              </div>
              <p className="text-xs font-bold text-slate-600">
                Added directly to your A2Z Balance
              </p>
            </div>

            {/* Value Highlights */}
            <div className="rounded-xl bg-slate-50 p-3 text-left space-y-2 border border-slate-100">
              <div className="flex items-start gap-2.5">
                <div className="rounded-md bg-emerald-100 p-1 text-emerald-700 shrink-0 mt-0.5">
                  <Zap className="h-3.5 w-3.5" />
                </div>
                <div className="text-xs text-slate-700 leading-snug">
                  <span className="font-extrabold text-slate-900">Instant Checkout Savings:</span> Automatically applied on your upcoming service bookings.
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="rounded-md bg-teal-100 p-1 text-teal-700 shrink-0 mt-0.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </div>
                <div className="text-xs text-slate-700 leading-snug">
                  <span className="font-extrabold text-slate-900">All Categories Included:</span> Valid on Salon, Cleaning, AC, Electrical, Plumbing & more.
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <div className="rounded-md bg-blue-100 p-1 text-blue-700 shrink-0 mt-0.5">
                  <ShieldCheck className="h-3.5 w-3.5" />
                </div>
                <div className="text-xs text-slate-700 leading-snug">
                  <span className="font-extrabold text-slate-900">No Expiry:</span> Your bonus remains safe in your wallet until you use it.
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={handleExploreServices}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-teal-700 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-teal-700/25 hover:from-emerald-700 hover:to-teal-800 transition active:scale-[0.98]"
              >
                <span>Book Service & Save Now</span>
                <ArrowRight className="h-4 w-4" />
              </button>

              <button
                type="button"
                onClick={handleViewWallet}
                className="w-full flex items-center justify-center gap-2 rounded-2xl bg-slate-100 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition"
              >
                <Wallet className="h-3.5 w-3.5 text-slate-500" />
                <span>View Wallet Balance</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
