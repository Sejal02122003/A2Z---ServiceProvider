import { useCallback, useEffect, useState } from 'react'
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  CreditCard,
  IndianRupee,
  Loader2,
  Wallet,
  Info,
  History,
  ShieldAlert,
  ArrowDownLeft,
  ArrowUpRight,
  Gift,
  PlusCircle,
  X,
  Lock,
  Receipt,
  Sparkles,
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { walletsApi } from '../../api/walletsApi.js'
import { paymentsApi } from '../../api/paymentsApi.js'
import { ApiError } from '../../api/http.js'
import { AppStackScreenHeader } from '../../components/app/AppStackScreenHeader.jsx'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'

function formatInr(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
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

const QUICK_AMOUNTS = [200, 500, 1000, 2000]

export function LaborWallet() {
  const reduce = useReducedMotion()
  const [wallet, setWallet] = useState(null)
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Top Up Modal State
  const [showTopUpModal, setShowTopUpModal] = useState(false)
  const [topUpAmount, setTopUpAmount] = useState('500')
  const [recharging, setRecharging] = useState(false)
  const [topUpError, setTopUpError] = useState('')
  const [topUpSuccess, setTopUpSuccess] = useState('')

  // Clear Dues State
  const [clearing, setClearing] = useState(false)
  const [clearError, setClearError] = useState('')
  const [clearSuccess, setClearSuccess] = useState(false)

  // Selected Transaction for Details Modal / Popover
  const [selectedTx, setSelectedTx] = useState(null)

  const fetchWalletData = useCallback(async () => {
    try {
      const [walletRes, txRes] = await Promise.all([
        walletsApi.getMyWallet(),
        walletsApi.getMyTransactions().catch(() => ({ data: { transactions: [] } })),
      ])
      setWallet(walletRes.data?.wallet || {})
      setTransactions(txRes.data?.transactions || [])
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load wallet')
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    fetchWalletData().finally(() => {
      if (!cancelled) setLoading(false)
    })

    return () => { cancelled = true }
  }, [fetchWalletData])

  const handleTopUp = async () => {
    const num = Number(topUpAmount)
    if (isNaN(num) || num < 1) {
      setTopUpError('Please enter a valid amount of at least ₹1')
      return
    }

    setRecharging(true)
    setTopUpError('')
    setTopUpSuccess('')

    try {
      const razorpayLoaded = await loadRazorpay()
      if (razorpayLoaded) {
        try {
          const payRes = await paymentsApi.initPayment({
            amount: num,
            purpose: 'WALLET_TOPUP',
          })

          const order = payRes.data?.order
          if (order) {
            const options = {
              key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_8sYbzHWidwe5Zw',
              amount: order.amount,
              currency: order.currency || 'INR',
              order_id: order.id,
              name: 'A2Z Service Provider',
              description: `Wallet Top-up ₹${num}`,
              handler: async function (response) {
                try {
                  await paymentsApi.verifyPayment({
                    razorpayOrderId: response.razorpay_order_id,
                    razorpayPaymentId: response.razorpay_payment_id,
                    razorpaySignature: response.razorpay_signature,
                  })
                  setTopUpSuccess(`₹${num} added to your wallet!`)
                  setShowTopUpModal(false)
                  fetchWalletData()
                } catch {
                  setTopUpError('Payment verification failed. Please contact support.')
                } finally {
                  setRecharging(false)
                }
              },
              modal: {
                ondismiss: () => {
                  setRecharging(false)
                },
              },
              theme: { color: '#009eb3' },
            }
            const rzp = new window.Razorpay(options)
            rzp.open()
            return
          }
        } catch (gatewayErr) {
          console.warn('[Razorpay Init Fallback to direct recharge]', gatewayErr)
        }
      }

      // Direct recharge API fallback
      const rechargeRes = await walletsApi.rechargeMyWallet({
        amount: num,
        paymentMethod: 'UPI_DIRECT',
        description: 'Wallet top-up',
      })

      setTopUpSuccess(rechargeRes?.message || `₹${num} added to your wallet!`)
      setShowTopUpModal(false)
      fetchWalletData()
    } catch (err) {
      setTopUpError(err instanceof ApiError ? err.message : err.message || 'Failed to recharge wallet')
    } finally {
      setRecharging(false)
    }
  }

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
        name: 'A2Z Service Provider',
        description: 'Clear wallet dues',
        handler: async function (response) {
          try {
            await paymentsApi.verifyPayment({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            })
            setClearSuccess(true)
            fetchWalletData()
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
  }, [wallet, fetchWalletData])

  if (loading) {
    return (
      <div className="space-y-4">
        <AppStackScreenHeader title="Labour Wallet" backTo="/app" />
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <AppStackScreenHeader title="Labour Wallet" backTo="/app" />
        <GlassPanel className="p-6 text-center">
          <p className="text-sm font-semibold text-rose-700">{error}</p>
        </GlassPanel>
      </div>
    )
  }

  const availableBalance = wallet?.availableBalance ?? (wallet?.selfBalance || 0)
  const currentBalance = wallet?.currentBalance ?? (wallet?.selfBalance || 0)
  const reservedBalance = wallet?.reservedBalance || 0
  const adminBalance = wallet?.adminBalance || 0
  const minRequired = wallet?.minimumRequiredBalance || 0
  const isLowBalance = availableBalance < minRequired

  return (
    <div className="space-y-4 pb-8">
      <AppStackScreenHeader title="Labour Wallet" backTo="/app" />

      {/* Main Available Balance Hero Card */}
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 text-white shadow-xl shadow-slate-950/20"
      >
        <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -left-12 -bottom-12 h-44 w-44 rounded-full bg-blue-500/10 blur-3xl" />

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 backdrop-blur-md">
              <Wallet className="h-4 w-4 text-cyan-300" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300">Available to Accept Jobs</span>
          </div>
          {minRequired > 0 && (
            <span className="rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-slate-300 backdrop-blur-md">
              Min Req: {formatInr(minRequired)}
            </span>
          )}
        </div>

        <div className="mt-4">
          <p className="text-3xl sm:text-4xl font-black tracking-tight text-white">{formatInr(availableBalance)}</p>
          <p className="mt-1 text-xs text-slate-400">
            Booking acceptance rule: Available balance must be ≥ Booking amount
          </p>
        </div>

        {/* Action button inside Hero */}
        <div className="mt-5 flex gap-3">
          <button
            onClick={() => setShowTopUpModal(true)}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-500 py-3 text-sm font-bold text-slate-950 shadow-md shadow-cyan-500/25 transition hover:bg-cyan-400 active:scale-[0.98]"
          >
            <PlusCircle className="h-4 w-4" />
            Recharge Wallet
          </button>
        </div>
      </motion.div>

      {/* Low Balance Alert Banner */}
      {isLowBalance && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex items-start gap-3 rounded-2xl border border-amber-300/80 bg-amber-50 p-4 shadow-sm"
        >
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-xs font-extrabold uppercase tracking-wide text-amber-900">Low Wallet Balance Alert</h4>
            <p className="text-xs text-amber-800 mt-0.5 leading-relaxed">
              Your available balance is below the recommended minimum ({formatInr(minRequired)}). You cannot accept bookings with amounts exceeding your balance.
            </p>
            <button
              onClick={() => setShowTopUpModal(true)}
              className="mt-2 text-xs font-bold text-amber-900 underline underline-offset-2 hover:text-amber-950"
            >
              Recharge now to receive more jobs &rarr;
            </button>
          </div>
        </motion.div>
      )}

      {/* Secondary Balance Breakdown Cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* Total / Ledger Balance */}
        <GlassPanel className="p-4 border-slate-200/70">
          <div className="flex items-center gap-1.5 text-slate-500">
            <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-600" />
            <p className="text-[11px] font-bold uppercase tracking-wider">Total Balance</p>
          </div>
          <p className="mt-1.5 text-xl font-extrabold text-slate-900">{formatInr(currentBalance)}</p>
          <p className="mt-0.5 text-[10px] text-slate-400">Total deposited & earned</p>
        </GlassPanel>

        {/* Reserved Balance for Active Jobs */}
        <GlassPanel className={`p-4 ${reservedBalance > 0 ? 'border-blue-200/80 bg-blue-50/20' : 'border-slate-200/70'}`}>
          <div className="flex items-center gap-1.5 text-slate-500">
            <Lock className="h-3.5 w-3.5 text-blue-600" />
            <p className="text-[11px] font-bold uppercase tracking-wider">Reserved Charges</p>
          </div>
          <p className="mt-1.5 text-xl font-extrabold text-blue-700">{formatInr(reservedBalance)}</p>
          <p className="mt-0.5 text-[10px] text-slate-400">Held for active accepted jobs</p>
        </GlassPanel>
      </div>

      {/* Outstanding Dues (if any) */}
      {adminBalance > 0 && (
        <GlassPanel className="p-4 border-rose-200 bg-rose-50/40">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 text-rose-700 font-bold text-xs">
                <AlertTriangle className="h-4 w-4" />
                <span>Outstanding Platform Dues</span>
              </div>
              <p className="mt-1 text-2xl font-black text-rose-800">{formatInr(adminBalance)}</p>
              <p className="text-[11px] text-rose-600">Pending recovery from previous cash jobs</p>
            </div>
            <button
              disabled={clearing}
              onClick={handleClearDues}
              className="rounded-xl bg-rose-600 px-4 py-2.5 text-xs font-bold text-white shadow-md shadow-rose-600/20 hover:bg-rose-700 active:scale-[0.98] disabled:opacity-50"
            >
              {clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Pay Dues'}
            </button>
          </div>
        </GlassPanel>
      )}

      {/* How Cash Booking Settlement Works Card */}
      <GlassPanel className="p-4 border-slate-200/70">
        <div className="flex items-center gap-2 mb-2">
          <Info className="h-4 w-4 text-cyan-600" />
          <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">Cash Booking Settlement Rules</h3>
        </div>
        <div className="space-y-1.5 text-xs text-slate-600 leading-relaxed">
          <p className="flex items-start gap-1.5">
            <span className="font-bold text-slate-800">• Cash Retention:</span> You receive and retain the 100% cash paid directly by the customer.
          </p>
          <p className="flex items-start gap-1.5">
            <span className="font-bold text-slate-800">• A2Z Recovery:</span> Only applicable platform fee, commission & GST are deducted from your wallet upon completion.
          </p>
          <p className="flex items-start gap-1.5">
            <span className="font-bold text-slate-800">• Eligibility:</span> You must maintain an available balance at least equal to the job amount to accept new jobs.
          </p>
        </div>
      </GlassPanel>

      {/* Penalties & Disputes Shortcut */}
      <Link
        to="/app/labour/penalties"
        className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 transition-all hover:border-slate-300 hover:shadow-sm"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-rose-50 text-rose-600 border border-rose-100">
            <ShieldAlert className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-900">Late Fees & Penalties</p>
            <p className="text-[11px] text-slate-500">Review deductions or raise a dispute</p>
          </div>
        </div>
        <span className="text-xs font-bold text-slate-400">&rarr;</span>
      </Link>

      {/* Transaction History Ledger */}
      <section className="space-y-3 pt-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-slate-500" />
            <h2 className="text-xs font-extrabold uppercase tracking-wider text-slate-700">
              Wallet Transaction Ledger
            </h2>
          </div>
          <span className="text-xs font-semibold text-slate-400">
            {transactions.length} record{transactions.length === 1 ? '' : 's'}
          </span>
        </div>

        {transactions.length === 0 ? (
          <GlassPanel className="p-8 text-center border-dashed border-slate-200">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
              <History className="h-6 w-6" />
            </div>
            <p className="text-sm font-bold text-slate-700">No Transactions Yet</p>
            <p className="text-xs text-slate-400 mt-1">
              Your wallet recharges, booking fee deductions, and payouts will appear here.
            </p>
          </GlassPanel>
        ) : (
          <div className="space-y-2.5">
            {transactions.map((tx) => {
              const isSettlement = tx.context === 'CASH_BOOKING_SETTLEMENT'
              const isRecharge = tx.context === 'WALLET_RECHARGE'
              const isPenalty = tx.context === 'PENALTY'
              const isPayout = tx.context === 'PAYOUT'
              const isClearance = tx.context === 'CLEARANCE'
              const isReversal = tx.context === 'REVERSAL'
              const isCredit = tx.type === 'CREDIT'

              let badgeText = tx.context || tx.type
              let badgeStyle = 'bg-slate-100 text-slate-700 border-slate-200'
              let amountColor = isCredit ? 'text-emerald-600' : 'text-slate-900'
              let prefix = isCredit ? '+' : '-'

              if (isSettlement) {
                badgeText = 'Cash Settlement'
                badgeStyle = 'bg-blue-50 text-blue-700 border-blue-200'
                amountColor = 'text-blue-700'
              } else if (isRecharge) {
                badgeText = 'Wallet Recharge'
                badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200'
              } else if (isPenalty) {
                badgeText = 'Penalty'
                badgeStyle = 'bg-rose-50 text-rose-700 border-rose-200'
                amountColor = 'text-rose-600'
              } else if (isPayout) {
                badgeText = 'Online Payout'
                badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200'
              } else if (isReversal) {
                badgeText = 'Reversal Refund'
                badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }

              const breakdown = tx.chargesBreakdown

              return (
                <GlassPanel
                  key={tx._id}
                  onClick={() => setSelectedTx(selectedTx?._id === tx._id ? null : tx)}
                  className={`p-3.5 border transition-all cursor-pointer hover:border-slate-300 ${
                    isSettlement ? 'border-blue-100 bg-blue-50/10' : 'border-slate-200/70'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${badgeStyle}`}>
                        {isCredit ? (
                          <ArrowDownLeft className="h-4 w-4 text-emerald-600" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4 text-slate-700" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs font-bold text-slate-900">
                            {isSettlement
                              ? 'Job Recovery Deduction'
                              : isRecharge
                              ? 'Wallet Top-up'
                              : isPenalty
                              ? 'Penalty Deduction'
                              : isPayout
                              ? 'Booking Payout'
                              : isReversal
                              ? 'Settlement Reversal'
                              : `${tx.context || 'Transaction'}`}
                          </p>
                          <span className={`inline-flex rounded-md border px-1.5 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${badgeStyle}`}>
                            {badgeText}
                          </span>
                        </div>

                        {tx.description && (
                          <p className="mt-0.5 text-xs text-slate-600 leading-snug line-clamp-2">
                            {tx.description}
                          </p>
                        )}

                        {/* Charges Breakdown Pill if Cash Settlement */}
                        {isSettlement && breakdown && (
                          <div className="mt-2 flex flex-wrap gap-1.5 text-[10px]">
                            {breakdown.commission > 0 && (
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600 border border-slate-200">
                                Comm: ₹{breakdown.commission}
                              </span>
                            )}
                            {breakdown.platformFee > 0 && (
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600 border border-slate-200">
                                Fee: ₹{breakdown.platformFee}
                              </span>
                            )}
                            {breakdown.gst > 0 && (
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-medium text-slate-600 border border-slate-200">
                                GST: ₹{breakdown.gst}
                              </span>
                            )}
                          </div>
                        )}

                        <p className="mt-1 text-[10px] font-medium text-slate-400">
                          {formatDate(tx.createdAt)} {tx.transactionId ? `• ID: ${tx.transactionId}` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className={`text-sm font-black tabular-nums ${amountColor}`}>
                        {prefix}{formatInr(tx.amount)}
                      </p>
                      <span className={`text-[10px] font-semibold uppercase ${tx.status === 'COMPLETED' ? 'text-emerald-600' : tx.status === 'PARTIAL' ? 'text-amber-600' : 'text-slate-400'}`}>
                        {tx.status || 'COMPLETED'}
                      </span>
                    </div>
                  </div>
                </GlassPanel>
              )
            })}
          </div>
        )}
      </section>

      {/* Top-up Modal */}
      <AnimatePresence>
        {showTopUpModal && (
          <div 
            onClick={() => setShowTopUpModal(false)}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-md overflow-y-auto"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, scale: 0.92, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: 15 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="w-full max-w-md rounded-3xl bg-white p-5 sm:p-6 shadow-2xl my-auto border border-slate-100 max-h-[90vh] flex flex-col overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700">
                    <PlusCircle className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base">Recharge Wallet</h3>
                    <p className="text-[11px] font-medium text-slate-500">Instant UPI & Online Payment</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowTopUpModal(false)}
                  className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition active:scale-95"
                  aria-label="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="py-4 space-y-4.5">
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Select or Enter Amount (₹)
                  </label>
                  <div className="relative mt-2">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xl font-bold text-slate-400">₹</span>
                    <input
                      type="number"
                      min="1"
                      value={topUpAmount}
                      onChange={(e) => setTopUpAmount(e.target.value)}
                      placeholder="500"
                      className="w-full rounded-2xl border-2 border-slate-200 bg-slate-50 py-3.5 pl-10 pr-4 text-2xl font-black text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-500/10"
                    />
                  </div>
                </div>

                {/* Quick select buttons */}
                <div>
                  <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-400">Quick amounts</p>
                  <div className="grid grid-cols-4 gap-2">
                    {QUICK_AMOUNTS.map((amt) => {
                      const isSelected = topUpAmount === String(amt)
                      return (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => setTopUpAmount(String(amt))}
                          className={`rounded-xl border py-2.5 text-xs font-black transition active:scale-95 ${
                            isSelected
                              ? 'border-cyan-500 bg-cyan-50 text-cyan-800 ring-2 ring-cyan-500/20 shadow-sm'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          ₹{amt}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {topUpError && (
                  <p className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700 border border-rose-200">
                    {topUpError}
                  </p>
                )}

                <div className="pt-2">
                  <button
                    disabled={recharging || !topUpAmount || Number(topUpAmount) <= 0}
                    onClick={handleTopUp}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-cyan-500 py-4 text-base font-black text-slate-950 shadow-lg shadow-cyan-500/25 transition hover:bg-cyan-400 active:scale-[0.98] disabled:opacity-50"
                  >
                    {recharging ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <>
                        <CreditCard className="h-5 w-5" />
                        Add ₹{topUpAmount || 0} to Wallet
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
