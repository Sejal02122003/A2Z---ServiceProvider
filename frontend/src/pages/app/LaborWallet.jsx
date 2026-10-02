import { useCallback, useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  CreditCard,
  IndianRupee,
  Loader2,
  Wallet,
} from 'lucide-react'
import { walletsApi } from '../../api/walletsApi.js'
import { adminSettingsApi } from '../../api/adminSettingsApi.js'
import { paymentsApi } from '../../api/paymentsApi.js'
import { ApiError } from '../../api/http.js'
import { AppStackScreenHeader } from '../../components/app/AppStackScreenHeader.jsx'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'

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

export function LaborWallet() {
  const reduce = useReducedMotion()
  const [wallet, setWallet] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [clearing, setClearing] = useState(false)
  const [clearError, setClearError] = useState('')
  const [clearSuccess, setClearSuccess] = useState(false)

  useEffect(() => {
    let cancelled = false

    Promise.all([
      walletsApi.getMyWallet(),
      adminSettingsApi.getSettings().catch(() => ({ data: {} })),
    ])
      .then(([walletRes]) => {
        if (cancelled) return
        setWallet(walletRes.data?.wallet || {})
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load wallet')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  const handleClearDues = useCallback(async () => {
    if (!wallet || (wallet.adminBalance || 0) <= 0) return
    setClearing(true)
    setClearError('')

    try {
      const razorpayLoaded = await loadRazorpay()
      if (!razorpayLoaded) {
        setClearError('Payment gateway failed to load')
        setClearing(false)
        return
      }

      const payRes = await paymentsApi.initPayment({
        amount: wallet.adminBalance,
        purpose: 'WALLET_CLEARANCE',
      })

      const order = payRes.data?.order
      if (!order) throw new Error('Payment initialization failed')

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_8sYbzHWidwe5Zw',
        amount: order.amount,
        currency: order.currency || 'INR',
        order_id: order.id,
        name: 'A2Z',
        description: 'Clear wallet dues',
        handler: async function (response) {
          try {
            await paymentsApi.verifyPayment({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            })
            setClearSuccess(true)
            // Refetch wallet
            walletsApi.getMyWallet()
              .then((res) => setWallet(res.data?.wallet || {}))
              .catch(() => {})
            setTimeout(() => setClearSuccess(false), 4000)
          } catch {
            setClearError('Payment verification failed. Contact support.')
          } finally {
            setClearing(false)
          }
        },
        modal: {
          ondismiss: () => {
            setClearing(false)
          },
        },
        theme: { color: '#009eb3' },
      }

      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (err) {
      setClearError(err instanceof ApiError ? err.message : err.message || 'Payment failed')
      setClearing(false)
    }
  }, [wallet])

  if (loading) {
    return (
      <div className="space-y-4">
        <AppStackScreenHeader title="Wallet" backTo="/app" />
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <AppStackScreenHeader title="Wallet" backTo="/app" />
        <GlassPanel className="p-6 text-center">
          <p className="text-sm font-semibold text-rose-700">{error}</p>
        </GlassPanel>
      </div>
    )
  }

  const selfBalance = wallet?.selfBalance || 0
  const adminBalance = wallet?.adminBalance || 0

  return (
    <div className="space-y-4 pb-8">
      <AppStackScreenHeader title="My Wallet" backTo="/app" />

      {/* Balance Cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* Earnings */}
        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <GlassPanel className="relative overflow-hidden border-blue-200/50 p-4">
            <div className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-blue-600/10 blur-2xl" />
            <div className="flex items-center gap-2">
              <ArrowDown className="h-4 w-4 text-blue-600" aria-hidden />
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Earnings</p>
            </div>
            <p className="mt-2 text-2xl font-extrabold text-blue-700">{formatInr(selfBalance)}</p>
            <p className="mt-1 text-[10px] text-slate-500">Online payment earnings</p>
          </GlassPanel>
        </motion.div>

        {/* Dues */}
        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <GlassPanel className={`relative overflow-hidden p-4 ${adminBalance > 0 ? 'border-rose-200/50' : 'border-slate-200/50'}`}>
            <div className="pointer-events-none absolute -right-4 -top-4 h-16 w-16 rounded-full bg-rose-500/10 blur-2xl" />
            <div className="flex items-center gap-2">
              <ArrowUp className="h-4 w-4 text-rose-500" aria-hidden />
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Dues</p>
            </div>
            <p className={`mt-2 text-2xl font-extrabold ${adminBalance > 0 ? 'text-rose-700' : 'text-slate-900'}`}>
              {formatInr(adminBalance)}
            </p>
            <p className="mt-1 text-[10px] text-slate-500">Cash payment dues to platform</p>
          </GlassPanel>
        </motion.div>
      </div>

      {/* Wallet Info */}
      <GlassPanel className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <Wallet className="h-4 w-4 text-brand" aria-hidden />
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">How it works</p>
        </div>
        <div className="flex items-start gap-3 rounded-xl bg-slate-50 border border-slate-200/60 p-4">
          <Info className="h-5 w-5 text-slate-400 shrink-0 mt-0.5" />
          <div className="text-sm text-slate-600 space-y-2">
            <p><b className="text-slate-700">Earnings:</b> Your completed bookings (excluding commission).</p>
            <p><b className="text-slate-700">Dues (Admin Balance):</b> Unpaid commissions from cash payments.</p>
          </div>
        </div>
      </GlassPanel>

      {/* Clear Dues */}
      {adminBalance > 0 && (
        <div className="space-y-2">
          {clearSuccess && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
              Dues cleared successfully!
            </motion.p>
          )}

          {clearError && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800"
            >
              <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
              {clearError}
            </motion.p>
          )}

          <button
            type="button"
            disabled={clearing}
            onClick={handleClearDues}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand to-blue-800 px-6 py-4 text-base font-extrabold text-white shadow-lg shadow-brand/25 transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
          >
            {clearing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <CreditCard className="h-5 w-5" aria-hidden />
                Clear Dues — {formatInr(adminBalance)}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
