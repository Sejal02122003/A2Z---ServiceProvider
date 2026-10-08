import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { vendorTrialApi } from '../../api/vendorTrialApi.js'
import {
  Award,
  Star,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ShieldAlert,
  CreditCard,
  Ban,
  ArrowRight,
  RefreshCw,
  Sparkles,
  HelpCircle,
  TrendingUp,
} from 'lucide-react'

export function VendorTrialStatusPage() {
  const [loading, setLoading] = useState(true)
  const [trialData, setTrialData] = useState(null)
  const [history, setHistory] = useState({ evaluations: [], warnings: [] })
  const [requesting, setRequesting] = useState(false)
  const [toast, setToast] = useState({ type: '', message: '' })

  useEffect(() => {
    loadTrial()
  }, [])

  const loadTrial = async () => {
    setLoading(true)
    try {
      const [resTrial, resHistory] = await Promise.all([
        vendorTrialApi.getMyTrial(),
        vendorTrialApi.getMyTrialHistory().catch(() => ({ data: { evaluations: [], warnings: [] } })),
      ])
      if (resTrial?.data) {
        setTrialData(resTrial.data)
      }
      if (resHistory?.data) {
        setHistory(resHistory.data)
      }
    } catch (err) {
      showToast('error', err?.message || 'Failed to load trial status')
    } finally {
      setLoading(false)
    }
  }

  const showToast = (type, message) => {
    setToast({ type, message })
    setTimeout(() => setToast({ type: '', message: '' }), 4500)
  }

  const handleRequestFinalChance = async () => {
    setRequesting(true)
    try {
      const res = await vendorTrialApi.requestFinalChance()
      const data = res?.data
      showToast('success', 'Final chance requested. Please complete penalty payment.')

      if (data?.razorpayOrder) {
        const order = data.razorpayOrder
        const fcRequest = data.finalChanceRequest

        const loadScript = () => {
          return new Promise((resolve) => {
            if (window.Razorpay) return resolve(true)
            const script = document.createElement('script')
            script.src = 'https://checkout.razorpay.com/v1/checkout.js'
            script.onload = () => resolve(true)
            script.onerror = () => resolve(false)
            document.body.appendChild(script)
          })
        }

        const loaded = await loadScript()
        if (loaded && window.Razorpay) {
          const options = {
            key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_placeholder',
            amount: order.amount,
            currency: order.currency || 'INR',
            name: 'A2Z Service Provider',
            description: 'Trial Final Chance Penalty Fee',
            order_id: order.id,
            handler: async function (response) {
              try {
                await vendorTrialApi.verifyPenaltyPayment({
                  finalChanceRequestId: fcRequest._id,
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                })
                showToast('success', 'Penalty paid! Final chance opportunity is now active.')
                loadTrial()
              } catch (verifyErr) {
                showToast('error', verifyErr?.message || 'Payment verification failed')
              }
            },
            prefill: {
              name: trialData?.vendor?.fullName || 'Service Provider',
              contact: trialData?.vendor?.phone || '',
            },
            theme: { color: '#f59e0b' },
          }
          const rzp = new window.Razorpay(options)
          rzp.open()
        }
      }
      loadTrial()
    } catch (err) {
      showToast('error', err?.message || 'Failed to request final chance')
    } finally {
      setRequesting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-72 items-center justify-center">
        <div className="flex items-center gap-3 text-slate-600">
          <RefreshCw className="h-6 w-6 animate-spin text-amber-500" />
          <span className="text-sm font-medium">Checking trial status...</span>
        </div>
      </div>
    )
  }

  const { trial, stats, vendor } = trialData || {}
  const status = trial?.status || 'NOT_STARTED'
  const totalRequired = (trial?.configuredTrialCount || 5) + (trial?.adminGrantedAdditionalTrials || 0)
  const completed = trial?.completedTrialCount || 0
  const progressPct = totalRequired > 0 ? Math.min(100, Math.round((completed / totalRequired) * 100)) : 0

  return (
    <div className="mx-auto max-w-lg space-y-5 px-4 pb-20 pt-4">
      {/* Toast Notification */}
      {toast.message && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex items-center gap-2 rounded-2xl p-4 text-xs font-semibold shadow-lg border ${
            toast.type === 'success'
              ? 'bg-emerald-500 text-white border-emerald-600'
              : 'bg-rose-500 text-white border-rose-600'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
          )}
          <span>{toast.message}</span>
        </motion.div>
      )}

      {/* Header Banner */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Trial Services & Status</h1>
          <p className="text-xs text-slate-500">Track your service trial ratings and performance</p>
        </div>
        <button
          type="button"
          onClick={loadTrial}
          className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 shadow-sm transition hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" />
        </button>
      </div>

      {/* STATUS BANNER CARDS */}

      {/* State: CONFIRMED */}
      {status === 'CONFIRMED' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-800 p-6 text-white shadow-xl shadow-emerald-600/10"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md">
              <Award className="h-6 w-6 text-white" />
            </div>
            <div>
              <span className="inline-block rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase backdrop-blur-md">
                Confirmed Partner
              </span>
              <h2 className="mt-0.5 text-lg font-extrabold">Fully Confirmed Provider</h2>
            </div>
          </div>
          <p className="mt-3 text-xs text-emerald-100 leading-relaxed">
            Congratulations! You have successfully completed your trial period and have been confirmed as an official A2Z Service Provider.
          </p>
        </motion.div>
      )}

      {/* State: PENDING_ADMIN_CONFIRMATION or ADMIN_REVIEW_REQUIRED */}
      {(status === 'PENDING_ADMIN_CONFIRMATION' || status === 'ADMIN_REVIEW_REQUIRED' || status === 'TRIAL_COMPLETED') && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="overflow-hidden rounded-3xl bg-gradient-to-br from-purple-700 to-indigo-900 p-6 text-white shadow-xl shadow-purple-600/10"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md">
              <Sparkles className="h-6 w-6 text-amber-300" />
            </div>
            <div>
              <span className="inline-block rounded-full bg-amber-400/20 px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase text-amber-300 backdrop-blur-md">
                Trial Completed
              </span>
              <h2 className="mt-0.5 text-lg font-extrabold">Pending Admin Confirmation</h2>
            </div>
          </div>
          <p className="mt-3 text-xs text-purple-100 leading-relaxed">
            You have successfully completed the required trial services. An administrator is currently reviewing your profile for final joining confirmation.
          </p>
        </motion.div>
      )}

      {/* State: WARNING */}
      {status === 'WARNING' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 to-orange-600 p-6 text-white shadow-xl shadow-amber-500/15"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md">
              <AlertTriangle className="h-6 w-6 text-white" />
            </div>
            <div>
              <span className="inline-block rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase backdrop-blur-md">
                Performance Warning
              </span>
              <h2 className="mt-0.5 text-lg font-extrabold">Warning Opportunity Active</h2>
            </div>
          </div>
          <p className="mt-3 text-xs text-amber-100 leading-relaxed">
            Your recent service performance received a low rating. You have <strong>one additional chance</strong> to improve your performance. Please deliver 4–5 star service on your next job!
          </p>
        </motion.div>
      )}

      {/* State: FINAL_FAILURE or FINAL_CHANCE_PAYMENT_PENDING */}
      {(status === 'FINAL_FAILURE' || status === 'FINAL_CHANCE_PAYMENT_PENDING') && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="overflow-hidden rounded-3xl border border-orange-200 bg-white p-6 shadow-xl shadow-orange-500/5"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100 text-orange-600">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <div>
              <span className="inline-block rounded-full bg-orange-100 px-2.5 py-0.5 text-[10px] font-bold text-orange-800 uppercase">
                Final Chance Required
              </span>
              <h2 className="mt-0.5 text-base font-bold text-slate-900">Trial Performance Review</h2>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-600 leading-relaxed">
            Your trial performance did not meet the required rating standard. You may request <strong>one final additional chance</strong> by paying the applicable penalty fee.
          </p>

          <div className="mt-4 rounded-2xl bg-slate-50 p-4 border border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-[11px] text-slate-500 uppercase font-bold">Applicable Penalty</p>
              <p className="text-xl font-extrabold text-slate-900">₹{trial?.finalChancePenaltyAmount || 500}</p>
            </div>
            <button
              type="button"
              onClick={handleRequestFinalChance}
              disabled={requesting}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-amber-500/20 transition hover:brightness-105 active:scale-95 disabled:opacity-50"
            >
              <CreditCard className="h-4 w-4" />
              {requesting ? 'Processing...' : 'Request Final Chance'}
            </button>
          </div>
        </motion.div>
      )}

      {/* State: FINAL_CHANCE_ACTIVE */}
      {status === 'FINAL_CHANCE_ACTIVE' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 to-blue-800 p-6 text-white shadow-xl shadow-indigo-600/15"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md">
              <CheckCircle2 className="h-6 w-6 text-emerald-300" />
            </div>
            <div>
              <span className="inline-block rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase backdrop-blur-md">
                Active Opportunity
              </span>
              <h2 className="mt-0.5 text-lg font-extrabold">Final Chance Active</h2>
            </div>
          </div>
          <p className="mt-3 text-xs text-indigo-100 leading-relaxed">
            Your final trial opportunity has been activated. You must achieve a <strong>4 or 5-star rating</strong> on your next service to be eligible for confirmation.
          </p>
        </motion.div>
      )}

      {/* State: BLOCKED */}
      {status === 'BLOCKED' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="overflow-hidden rounded-3xl bg-gradient-to-br from-rose-600 to-red-800 p-6 text-white shadow-xl shadow-rose-600/15"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md">
              <Ban className="h-6 w-6 text-white" />
            </div>
            <div>
              <span className="inline-block rounded-full bg-white/20 px-2.5 py-0.5 text-[10px] font-bold tracking-wider uppercase backdrop-blur-md">
                Account Blocked
              </span>
              <h2 className="mt-0.5 text-lg font-extrabold">Access Restricted</h2>
            </div>
          </div>
          <p className="mt-3 text-xs text-rose-100 leading-relaxed">
            Your service provider account has been blocked due to trial performance requirements. Please contact A2Z Support.
          </p>
        </motion.div>
      )}

      {/* State: TRIAL_ACTIVE (Default Active state) */}
      {status === 'TRIAL_ACTIVE' && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="overflow-hidden rounded-3xl bg-gradient-to-br from-amber-500 to-amber-600 p-6 text-white shadow-xl shadow-amber-500/20"
        >
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-white/20 px-3 py-0.5 text-[10px] font-bold tracking-wider uppercase backdrop-blur-md">
              Trial Active
            </span>
            <span className="text-xs font-semibold text-amber-100">
              {completed} of {totalRequired} Completed
            </span>
          </div>

          <h2 className="mt-2 text-xl font-black">Free Trial Period</h2>
          <p className="mt-1 text-xs text-amber-100">
            Maintain ratings of 4⭐ or 5⭐ on your trial jobs to qualify for admin confirmation.
          </p>

          <div className="mt-4">
            <div className="flex justify-between text-xs font-bold text-amber-100 mb-1.5">
              <span>Progress</span>
              <span>{progressPct}%</span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-black/10 backdrop-blur-sm">
              <div
                className="h-full rounded-full bg-white transition-all duration-500 shadow-sm"
                style={{ width: `${progressPct}%` }}
              ></div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Performance Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 text-center shadow-sm">
          <p className="text-[11px] font-semibold text-slate-500">Passed</p>
          <p className="mt-1 text-lg font-black text-emerald-600">{trial?.passedTrialCount || 0}</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 text-center shadow-sm">
          <p className="text-[11px] font-semibold text-slate-500">Average</p>
          <div className="mt-1 flex items-center justify-center gap-0.5">
            <span className="text-lg font-black text-amber-600">{stats?.averageRating || '—'}</span>
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 text-center shadow-sm">
          <p className="text-[11px] font-semibold text-slate-500">Remaining</p>
          <p className="mt-1 text-lg font-black text-slate-800">
            {Math.max(0, totalRequired - completed)}
          </p>
        </div>
      </div>

      {/* Trial Rating History */}
      <div className="space-y-3">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Star className="h-4 w-4 text-amber-500" /> Service Rating History
        </h3>

        {history.evaluations?.length === 0 ? (
          <div className="rounded-2xl border border-slate-200/70 bg-white p-6 text-center shadow-sm">
            <p className="text-xs text-slate-400">No completed trial ratings recorded yet.</p>
            <p className="mt-1 text-[11px] text-slate-500">
              When you complete bookings, customer ratings and feedback will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {history.evaluations.map((ev) => (
              <div
                key={ev._id}
                className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded-md bg-slate-900 px-2 py-0.5 text-[10px] font-bold text-white">
                      Trial #{ev.trialNumber}
                    </span>
                    <span
                      className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                        ev.result === 'PASSED'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {ev.result}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    <span className="text-sm font-extrabold text-amber-600">{ev.rating}</span>
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                  </div>
                </div>

                {ev.ratingComment && (
                  <p className="mt-2 text-xs text-slate-700 italic">
                    "{ev.ratingComment}"
                  </p>
                )}

                <p className="mt-2 text-[10px] text-slate-400">
                  {new Date(ev.evaluatedAt).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Warnings List if any */}
      {history.warnings?.length > 0 && (
        <div className="space-y-2.5">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Warnings Received
          </h3>
          {history.warnings.map((w) => (
            <div key={w._id} className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 text-xs">
              <p className="font-bold text-amber-900">Warning #{w.warningNumber} ({w.rating}⭐)</p>
              <p className="mt-1 text-amber-800">{w.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
