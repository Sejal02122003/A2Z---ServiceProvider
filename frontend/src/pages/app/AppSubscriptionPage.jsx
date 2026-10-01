import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Crown,
  Gift,
  IndianRupee,
  Info,
  Loader2,
  Lock,
  Shield,
  RotateCcw,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { userSubscriptionApi } from '../../api/userSubscriptionApi'
import { useSelector } from 'react-redux'

function Toast({ message, variant = 'success' }) {
  if (!message) return null
  const styles =
    variant === 'error'
      ? 'border-rose-200 bg-rose-50 text-rose-900'
      : 'border-emerald-200 bg-emerald-50 text-emerald-900'
  const Icon = variant === 'error' ? AlertTriangle : CheckCircle2
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className={`fixed left-4 right-4 top-20 z-50 mx-auto flex max-w-lg items-center gap-2 rounded-xl border px-4 py-3 text-sm font-semibold shadow-lg ${styles}`}
    >
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {message}
    </motion.div>
  )
}

function formatHour(h) {
  if (h == null) return '—'
  const suffix = h >= 12 ? 'PM' : 'AM'
  const display = h % 12 || 12
  return `${display}:00 ${suffix}`
}

function getCurrentISTHour() {
  return parseInt(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false }))
}

export function AppSubscriptionPage() {
  const [activeSubscription, setActiveSubscription] = useState(null)
  const [settings, setSettings] = useState({
    dailySubscriptionPrice: 19,
    subscriptionStartHour: 8,
    subscriptionEndHour: 20,
    isUserSubscriptionEnabled: true,
    freeTrialDays: 3,
  })
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)
  const [showBuyAnotherPlan, setShowBuyAnotherPlan] = useState(false)
  const [currentHour, setCurrentHour] = useState(getCurrentISTHour())
  const [toast, setToast] = useState({ message: '', variant: 'success' })
  const [showSuccessPopup, setShowSuccessPopup] = useState(false)
  const navigate = useNavigate()
  const user = useSelector((s) => s.auth.user)

  const trialEndsAt = user?.labourProfile?.trialEndsAt
  const trialStartedAt = user?.labourProfile?.trialStartedAt
  const now = new Date()
  const trialActive = trialEndsAt ? new Date(trialEndsAt) > now : false

  // Compute trial info
  const trialDaysRemaining = trialActive
    ? Math.ceil((new Date(trialEndsAt) - now) / (1000 * 60 * 60 * 24))
    : 0

  const totalTrialDays = settings.freeTrialDays

  const showToast = (message, variant = 'success') => {
    setToast({ message, variant })
    setTimeout(() => setToast({ message: '', variant: 'success' }), 4000)
  }

  const [plans, setPlans] = useState([])
  const [recentRejectedRefund, setRecentRejectedRefund] = useState(null)
  const [hideRejectedRefund, setHideRejectedRefund] = useState(false)

  const loadData = async () => {
    try {
      setLoading(true)
      const [res, plansRes] = await Promise.all([
        userSubscriptionApi.getMySubscription(),
        userSubscriptionApi.getPlans()
      ])
      setActiveSubscription(res?.data?.subscription || null)
      setRecentRejectedRefund(res?.data?.recentRejectedRefund || null)
      if (res?.data?.settings) {
        setSettings(res.data.settings)
      }
      setPlans(plansRes?.data?.plans || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // Update current hour every minute
    const interval = setInterval(() => setCurrentHour(getCurrentISTHour()), 60_000)
    return () => clearInterval(interval)
  }, [])

  const { subscriptionStartHour, subscriptionEndHour, dailySubscriptionPrice } = settings
  const isWithinWindow = currentHour >= subscriptionStartHour && currentHour < subscriptionEndHour
  const windowOpensInHours = !isWithinWindow && currentHour < subscriptionStartHour
    ? subscriptionStartHour - currentHour
    : null

  const loadRazorpay = () =>
    new Promise((resolve) => {
      if (window.Razorpay) { resolve(true); return }
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.onload = () => resolve(true)
      script.onerror = () => resolve(false)
      document.body.appendChild(script)
    })

  const handleSubscribe = async (planId = null) => {
    try {
      setProcessing(true)

      const sdkLoaded = await loadRazorpay()
      if (!sdkLoaded) {
        showToast('Payment SDK failed to load. Check your connection.', 'error')
        return
      }

      const orderRes = await userSubscriptionApi.createOrder(planId ? { planId } : {})
      const { order, keyId, price } = orderRes.data

      const options = {
        key: keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'A2Z',
        description: planId ? `Marketplace Subscription Access (₹${price})` : `Daily Marketplace Access (₹${price})`,
        order_id: order.id,
        handler: async (response) => {
          try {
            await userSubscriptionApi.verifyPayment({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              planId: planId || undefined,
            })
            setShowSuccessPopup(true)
            setTimeout(() => {
              navigate('/app', { replace: true })
            }, 3000)
          } catch {
            showToast('Payment verification failed. Contact support.', 'error')
          }
        },
        prefill: {
          name: user?.fullName || '',
          contact: user?.phone || '',
          email: user?.email || '',
        },
        theme: { color: '#002B5C' },
      }

      const rzp = new window.Razorpay(options)
      rzp.on('payment.failed', (r) => showToast(r.error.description || 'Payment failed', 'error'))
      rzp.open()
    } catch (err) {
      showToast(err?.response?.data?.message || err?.message || 'Could not start payment', 'error')
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    )
  }

  const isSubscribedToday = activeSubscription?.status === 'active'

  return (
    <div className="min-h-screen bg-slate-50 pb-28 pt-4">
      <AnimatePresence>
        {toast.message && <Toast message={toast.message} variant={toast.variant} />}
        {showSuccessPopup && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              transition={{ type: 'spring', bounce: 0.5 }}
              className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl"
            >
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="mb-2 text-xl font-black text-slate-900">Payment Successful!</h3>
              <p className="mb-6 text-sm leading-relaxed text-slate-500">
                Your daily marketplace access has been successfully activated. You are now ready to receive job opportunities.
              </p>
              <button
                onClick={() => navigate('/app', { replace: true })}
                className="w-full rounded-xl bg-gradient-to-r from-brand to-blue-800 py-3.5 text-sm font-bold text-white shadow-lg transition hover:from-brand/90"
              >
                Continue to Dashboard
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mx-auto max-w-lg space-y-4 px-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-blue-900 shadow-lg shadow-brand/30">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Marketplace Access</h1>
          <p className="mt-1 text-sm text-slate-500">
            Your daily gateway to job opportunities
          </p>
        </motion.div>

        {/* ── REJECTED REFUND ALERT ── */}
        {recentRejectedRefund && !hideRejectedRefund && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative overflow-hidden rounded-2xl border border-rose-200 bg-rose-50 p-4 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
              <div className="flex-1 pr-6">
                <p className="text-sm font-bold text-rose-900">
                  Refund Rejected (₹{recentRejectedRefund.amountPaid})
                </p>
                <p className="mt-1 text-xs text-rose-800 leading-relaxed">
                  Your refund request for the subscription on <strong>{recentRejectedRefund.date}</strong> was rejected by the admin.
                </p>
                {recentRejectedRefund.adminActionNote && (
                  <div className="mt-2 rounded-xl bg-white/60 p-2.5 text-xs font-semibold text-rose-900 border border-rose-100">
                    "{recentRejectedRefund.adminActionNote}"
                  </div>
                )}
                <p className="mt-2 text-[10px] text-rose-500 font-medium">
                  Processed on {new Date(recentRejectedRefund.refundProcessedAt).toLocaleDateString()}
                </p>
              </div>
            </div>
            <button
              onClick={() => setHideRejectedRefund(true)}
              className="absolute top-2 right-2 rounded-full p-1.5 text-rose-400 hover:bg-rose-100 hover:text-rose-600"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
            </button>
          </motion.div>
        )}

        {/* ── TRIAL ACTIVE ── */}
        {trialActive && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="overflow-hidden rounded-2xl border border-emerald-200 bg-white shadow-sm"
          >
            <div className="flex items-center gap-3 bg-emerald-500 px-5 py-3">
              <Gift className="h-5 w-5 text-white" />
              <h2 className="text-base font-bold text-white">Free Trial Active</h2>
              <span className="ml-auto rounded-full bg-white/25 px-2.5 py-0.5 text-xs font-bold text-white">
                {trialDaysRemaining} day{trialDaysRemaining !== 1 ? 's' : ''} left
              </span>
            </div>
            <div className="p-5">
              {/* Trial progress bar */}
              <div className="mb-4">
                <div className="flex justify-between text-xs font-semibold text-slate-500 mb-1">
                  <span>Day 1</span>
                  <span>Day {totalTrialDays}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all"
                    style={{ width: `${Math.max(5, ((totalTrialDays - trialDaysRemaining) / totalTrialDays) * 100)}%` }}
                  />
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {totalTrialDays - trialDaysRemaining} of {totalTrialDays} days used
                </p>
              </div>
              <p className="text-sm text-slate-600">
                You're on your <strong>{totalTrialDays}-day free trial</strong>. After it ends, a daily subscription of{' '}
                <strong>₹{dailySubscriptionPrice}</strong> will be required to access the marketplace.
              </p>
              {trialEndsAt && (
                <div className="mt-3 rounded-xl bg-emerald-50 p-3 border border-emerald-100">
                  <p className="text-xs font-semibold text-emerald-800">
                    ✓ Trial ends:{' '}
                    {new Date(trialEndsAt).toLocaleDateString('en-IN', {
                      weekday: 'long', day: 'numeric', month: 'long',
                    })}
                  </p>
                  {trialStartedAt && (
                    <p className="mt-0.5 text-xs text-emerald-700">
                      Started:{' '}
                      {new Date(trialStartedAt).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'long',
                      })}
                    </p>
                  )}
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowBuyAnotherPlan((prev) => !prev)}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 py-3 text-sm font-bold text-white shadow-md shadow-emerald-600/20 transition hover:brightness-105 active:scale-[0.99]"
              >
                <Crown className="h-4 w-4" />
                {showBuyAnotherPlan ? 'Hide Available Plans' : 'Buy a Plan / Upgrade'}
              </button>
            </div>
          </motion.div>
        )}

        {/* ── SUBSCRIBED TODAY ── */}
        {!trialActive && isSubscribedToday && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="overflow-hidden rounded-2xl border border-brand/20 bg-white shadow-sm"
          >
            <div className="flex items-center gap-3 bg-gradient-to-r from-brand to-blue-900 px-5 py-3">
              <CheckCircle2 className="h-5 w-5 text-white" />
              <h2 className="text-base font-bold text-white">Subscription Active Today</h2>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-xl bg-brand/5 p-3">
                  <p className="text-xs font-semibold text-slate-500">Paid</p>
                  <p className="mt-0.5 text-lg font-black text-brand">₹{activeSubscription.amountPaid}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-500">Bookings</p>
                  <p className="mt-0.5 text-lg font-black text-slate-900">{activeSubscription.bookingsReceived || 0}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-500">Offers</p>
                  <p className="mt-0.5 text-lg font-black text-slate-900">{activeSubscription.bookingOpportunitiesOffered || 0}</p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 p-3">
                <Clock className="h-4 w-4 shrink-0 text-slate-400" />
                <p className="text-xs font-semibold text-slate-700">
                  Active window: <strong>{formatHour(subscriptionStartHour)}</strong> – <strong>{formatHour(subscriptionEndHour)}</strong>
                  {isWithinWindow
                    ? <span className="ml-2 text-emerald-600">● Open now</span>
                    : <span className="ml-2 text-amber-600">● Closed now</span>}
                </p>
              </div>

              {/* Refund info */}
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50 p-3">
                <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <p className="text-xs font-medium text-amber-800">
                  If you receive <strong>zero bookings</strong> today, your ₹{activeSubscription.amountPaid} will be automatically refunded to your wallet after {formatHour(subscriptionEndHour)}.
                </p>
              </div>

              {/* Buy Another Plan Action */}
              <button
                type="button"
                onClick={() => setShowBuyAnotherPlan((prev) => !prev)}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-brand to-blue-800 py-3 text-sm font-bold text-white shadow-md shadow-brand/20 transition hover:brightness-105 active:scale-[0.99]"
              >
                <Crown className="h-4 w-4" />
                {showBuyAnotherPlan ? 'Hide Available Plans' : 'Buy Another Plan / Extend Access'}
              </button>
            </div>
          </motion.div>
        )}

        {/* ── PLANS & PACKAGES LIST ── */}
        {((!trialActive && !isSubscribedToday) || showBuyAnotherPlan) && (
          <div className="space-y-8">
            {showBuyAnotherPlan && (
              <div className="text-center">
                <h3 className="text-lg font-black text-slate-900">Choose a Plan to Extend</h3>
                <p className="text-xs text-slate-500 mt-0.5">Your new plan will activate after your current subscription.</p>
              </div>
            )}
            {settings.isUserSubscriptionEnabled && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="p-6">
                  {/* Price display */}
                  <div className="mb-5 text-center">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">Daily Access</p>
                    <div className="mt-2 flex items-baseline justify-center gap-1">
                      <span className="text-5xl font-black text-brand">₹{dailySubscriptionPrice}</span>
                      <span className="text-lg font-bold text-slate-400">/day</span>
                    </div>
                  </div>

                  {/* Window info */}
                  <div className="mb-5 rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4 text-brand" />
                      <p className="text-xs font-bold uppercase text-slate-500">Subscription Window</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-center">
                        <p className="text-xs text-slate-400">Opens</p>
                        <p className="text-lg font-black text-slate-900">{formatHour(subscriptionStartHour)}</p>
                      </div>
                      <div className="flex-1 mx-3 h-0.5 bg-slate-200 relative">
                        <div
                          className="absolute inset-y-0 left-0 bg-brand rounded-full"
                          style={{
                            width: isWithinWindow
                              ? `${Math.min(100, ((currentHour - subscriptionStartHour) / (subscriptionEndHour - subscriptionStartHour)) * 100)}%`
                              : '0%'
                          }}
                        />
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-slate-400">Closes</p>
                        <p className="text-lg font-black text-slate-900">{formatHour(subscriptionEndHour)}</p>
                      </div>
                    </div>
                    {isWithinWindow ? (
                      <p className="mt-2 text-center text-xs font-semibold text-emerald-700">
                        ● Window is currently open — subscribe now!
                      </p>
                    ) : windowOpensInHours != null ? (
                      <p className="mt-2 text-center text-xs font-semibold text-amber-700">
                        ● Opens in {windowOpensInHours} hour{windowOpensInHours !== 1 ? 's' : ''}
                      </p>
                    ) : (
                      <p className="mt-2 text-center text-xs font-semibold text-slate-500">
                        ● Window closed for today
                      </p>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="mb-5 space-y-2.5">
                    {[
                      { icon: CheckCircle2, text: 'Unlimited job offers for today', tone: 'text-emerald-600' },
                      { icon: IndianRupee, text: 'Keep 100% of your earnings', tone: 'text-brand' },
                      { icon: RotateCcw, text: 'Full refund if you get 0 bookings today', tone: 'text-amber-600' },
                      { icon: Lock, text: 'Only pay on days you want to work', tone: 'text-slate-500' },
                    ].map(({ icon: Icon, text, tone }) => (
                      <li key={text} className="flex items-center gap-3">
                        <Icon className={`h-4 w-4 shrink-0 ${tone}`} />
                        <span className="text-sm font-medium text-slate-700">{text}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Pay button */}
                  <button
                    type="button"
                    onClick={() => handleSubscribe(null)}
                    disabled={processing || !isWithinWindow}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand to-blue-800 py-4 text-base font-bold text-white shadow-lg shadow-brand/30 transition hover:from-brand/90 disabled:opacity-60"
                  >
                    {processing ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <Shield className="h-5 w-5" />
                        Pay ₹{dailySubscriptionPrice} — Start Earning
                      </>
                    )}
                  </button>

                  {!isWithinWindow && (
                    <p className="mt-2 text-center text-xs text-slate-500">
                      {windowOpensInHours != null
                        ? `Subscription opens at ${formatHour(subscriptionStartHour)}`
                        : `Today's window is closed. Come back tomorrow from ${formatHour(subscriptionStartHour)}`}
                    </p>
                  )}
                </div>
              </motion.div>
            )}

            <div>
              <h2 className="mb-4 text-xl font-black text-slate-800 text-center">Or Choose a Package</h2>
              <div className="space-y-4">
            {plans.map(plan => (
              <motion.div
                key={plan._id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="overflow-hidden rounded-2xl border border-brand/20 bg-white shadow-sm hover:border-brand transition"
              >
                <div className="p-6">
                  {/* Price display */}
                  <div className="mb-4 text-center">
                    <p className="text-xs font-bold uppercase tracking-wide text-brand">{plan.name}</p>
                    <div className="mt-2 flex items-baseline justify-center gap-1">
                      <span className="text-4xl font-black text-slate-900">₹{plan.price}</span>
                      <span className="text-sm font-bold text-slate-400">/ {plan.durationDays} days</span>
                    </div>
                  </div>

                  {/* Window info */}
                  <div className="mb-5 rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="h-4 w-4 text-brand" />
                      <p className="text-xs font-bold uppercase text-slate-500">Subscription Window</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-center">
                        <p className="text-xs text-slate-400">Opens</p>
                        <p className="text-lg font-black text-slate-900">{formatHour(subscriptionStartHour)}</p>
                      </div>
                      <div className="flex-1 mx-3 h-0.5 bg-slate-200 relative">
                        <div
                          className="absolute inset-y-0 left-0 bg-brand rounded-full"
                          style={{
                            width: isWithinWindow
                              ? `${Math.min(100, ((currentHour - subscriptionStartHour) / (subscriptionEndHour - subscriptionStartHour)) * 100)}%`
                              : '0%'
                          }}
                        />
                      </div>
                      <div className="text-center">
                        <p className="text-xs text-slate-400">Closes</p>
                        <p className="text-lg font-black text-slate-900">{formatHour(subscriptionEndHour)}</p>
                      </div>
                    </div>
                    {isWithinWindow ? (
                      <p className="mt-2 text-center text-xs font-semibold text-emerald-700">
                        ● Window is currently open — subscribe now!
                      </p>
                    ) : windowOpensInHours != null ? (
                      <p className="mt-2 text-center text-xs font-semibold text-amber-700">
                        ● Opens in {windowOpensInHours} hour{windowOpensInHours !== 1 ? 's' : ''}
                      </p>
                    ) : (
                      <p className="mt-2 text-center text-xs font-semibold text-slate-500">
                        ● Window closed for today
                      </p>
                    )}
                  </div>

                  {/* Features */}
                  <ul className="mb-5 space-y-2 text-sm text-slate-600">
                    {plan.features?.map((f, i) => (
                      <li key={i} className="flex gap-2">
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-brand" /> {f}
                      </li>
                    ))}
                  </ul>

                  {/* Pay button */}
                  <button
                    type="button"
                    onClick={() => handleSubscribe(plan._id)}
                    disabled={processing}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 text-sm font-bold text-white shadow-lg shadow-brand/20 transition hover:bg-brand/90 disabled:opacity-60"
                  >
                    {processing ? <Loader2 className="h-5 w-5 animate-spin" /> : `Select ${plan.name}`}
                  </button>
                </div>
              </motion.div>
            ))}
              </div>
            </div>
          </div>
        )}

        {/* Refund Policy Card */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl border border-blue-100 bg-blue-50 p-4"
        >
          <div className="flex items-start gap-3">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
            <div>
              <p className="text-xs font-bold text-blue-900">Refund Policy</p>
              <p className="mt-1 text-xs text-blue-800 leading-relaxed">
                If you pay the daily subscription but receive <strong>zero bookings</strong> during the{' '}
                {formatHour(subscriptionStartHour)}–{formatHour(subscriptionEndHour)} window,
                your ₹{dailySubscriptionPrice} will be automatically refunded to your A2Z wallet.
              </p>
              <p className="mt-1.5 text-xs text-blue-700">
                Refund is processed at <strong>{formatHour(subscriptionEndHour)}</strong> daily.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
