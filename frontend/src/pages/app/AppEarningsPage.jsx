import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Wallet, CheckCircle2, UploadCloud, Landmark, FileText, UserCircle, QrCode } from 'lucide-react'
import { Link } from 'react-router-dom'
import { bookingsApi } from '../../api/bookingsApi.js'
import { uploadDocument, assetUrlFromUpload } from '../../api/uploadApi.js'
import { withdrawalsApi } from '../../api/withdrawalsApi.js'
import { walletsApi } from '../../api/walletsApi.js'
import { paymentsApi } from '../../api/paymentsApi.js'
import { useSelector } from 'react-redux'
import { AppPrimaryButton } from '../../components/app/AppPrimaryButton.jsx'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { formatInrFromPaise } from '../../lib/labourEarningsFlow.js'

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

export function AppEarningsPage() {
  const user = useSelector((state) => state.auth.user)
  const [totalEarnings, setTotalEarnings] = useState(0)
  const [totalCashEarnings, setTotalCashEarnings] = useState(0)
  const [totalRefunds, setTotalRefunds] = useState(0)
  const [totalPaid, setTotalPaid] = useState(0)
  const [dueAmount, setDueAmount] = useState(0)
  const [maxWithdrawable, setMaxWithdrawable] = useState(0)
  const [withdrawals, setWithdrawals] = useState([])
  const [adminDues, setAdminDues] = useState(0)
  const [loading, setLoading] = useState(true)

  // Form State
  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [accountName, setAccountName] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [confirmAccountNumber, setConfirmAccountNumber] = useState('')
  const [ifscCode, setIfscCode] = useState('')
  const [bankName, setBankName] = useState('')
  const [qrFile, setQrFile] = useState(null)
  const [qrPreview, setQrPreview] = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const fetchEarnings = async () => {
    setLoading(true)
    try {
      // Fetch bookings for earnings display
      const bookingsRes = await bookingsApi.getMyBookings().catch(() => null)
      
      const allBookings = bookingsRes?.data?.bookings || bookingsRes?.bookings || bookingsRes || []
      let onlineSum = 0
      let cashSum = 0
      allBookings.forEach(b => {
        if (b.paymentStatus === 'PAID') {
          let share = b.laborShare || b.basePrice || 0
          
          // Bulk booking share split logic
          if (b.assignments && b.assignments.length > 0) {
            if (b.contractorInfo?.services?.length > 0) {
              let subTotal = 0
              b.contractorInfo.services.forEach(s => {
                subTotal += (s.price || 0) * (b.hours || 1) * (s.quantity || 1)
              })
              const ratio = subTotal > 0 ? (b.laborShare || 0) / subTotal : 0
              
              let availableServices = []
              b.contractorInfo.services.forEach(s => {
                const sShare = (s.price || 0) * (b.hours || 1) * ratio
                for (let i = 0; i < (s.quantity || 1); i++) {
                  availableServices.push({ serviceId: String(s.serviceId?._id || s.serviceId), share: sShare, assigned: false })
                }
              })

              b.assignments.forEach(a => {
                const labour = a.labourId;
                if (!labour) return;
                const labServiceIds = [
                  ...(labour.serviceIds || []),
                  ...(labour.labourProfile?.serviceIds || [])
                ].map(id => String(id));
                let matchedService = availableServices.find(as => !as.assigned && labServiceIds.includes(as.serviceId));
                if (!matchedService) matchedService = availableServices.find(as => !as.assigned);
                if (matchedService) {
                  matchedService.assigned = true;
                  matchedService.labourIdStr = String(labour._id || labour);
                }
              })
              
              const myService = availableServices.find(as => as.labourIdStr === String(user?._id));
              if (myService) {
                share = myService.share;
              } else {
                share = b.laborShare / b.assignments.length;
              }
            } else {
              const mainLabId = typeof b.laborId === 'object' ? b.laborId?._id : b.laborId
              if (String(mainLabId) !== String(user?._id) && !b.acceptedLabourIds?.includes(user?._id)) {
                share = 0
              }
            }
          }

          if (b.paymentMethod === 'CASH') {
            cashSum += share * 100
          } else {
            onlineSum += share * 100 
          }
        }
      })

      // Add Refunds from Wallet Summary
      let refundAmountPaise = 0
      const summaryRes = await walletsApi.getEarningsSummary().catch(() => null)
      if (summaryRes?.data?.earnings?.refundsPaise) {
        refundAmountPaise = summaryRes.data.earnings.refundsPaise
        onlineSum += refundAmountPaise
      }

      setTotalRefunds(refundAmountPaise)
      setTotalEarnings(onlineSum)
      setTotalCashEarnings(cashSum)

      // Fetch withdrawal history
      const withdrawalsRes = await withdrawalsApi.getWithdrawals().catch(() => null)
      const wList = withdrawalsRes?.data?.requests || withdrawalsRes?.requests || []
      setWithdrawals(wList)
      
      const paid = wList
        .filter(w => w.status === 'APPROVED')
        .reduce((acc, curr) => acc + (curr.amount || 0), 0)
      
      const pending = wList
        .filter(w => w.status === 'PENDING')
        .reduce((acc, curr) => acc + (curr.amount || 0), 0)
        
      setTotalPaid(paid)
      
      const totalEarnedInr = Math.floor(onlineSum / 100)
      const calculatedDue = totalEarnedInr - paid
      setDueAmount(calculatedDue)
      
      // Prevent overdrawing if there are pending requests
      setMaxWithdrawable(Math.max(0, calculatedDue - pending))
      // Fetch wallet for admin dues
      const walletRes = await walletsApi.getMyWallet().catch(() => null)
      setAdminDues(walletRes?.data?.wallet?.adminBalance || 0)

    } catch (err) {
      console.error('Failed to load wallet data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handlePayAdmin = async () => {
    if (adminDues <= 0) return
    
    setLoading(true)
    try {
      const razorpayLoaded = await loadRazorpay()
      if (!razorpayLoaded) {
        alert('Payment gateway failed to load')
        setLoading(false)
        return
      }

      const payRes = await paymentsApi.initPayment({
        amount: adminDues,
        purpose: 'WALLET_CLEARANCE',
      })

      const order = payRes.data?.order
      if (!order) throw new Error('Payment initialization failed')

      const options = {
        key: import.meta.env.VITE_RAZORPAY_KEY_ID || 'rzp_test_8sYbzHWidwe5Zw',
        amount: order.amount,
        currency: order.currency || 'INR',
        order_id: order.id,
        name: 'KaamExpert',
        description: 'Clear wallet dues',
        handler: async function (response) {
          try {
            await paymentsApi.verifyPayment({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            })
            // Refetch wallet
            await fetchEarnings()
          } catch {
            alert('Payment verification failed. Contact support.')
          } finally {
            setLoading(false)
          }
        },
        modal: {
          ondismiss: () => {
            setLoading(false)
          },
        },
        theme: { color: '#002b5c' },
      }

      const rzp = new window.Razorpay(options)
      rzp.open()
    } catch (err) {
      alert('Payment failed: ' + (err.message || 'Unknown error'))
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEarnings()
  }, [])

  const handleQrUpload = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      setQrFile(file)
      setQrPreview(URL.createObjectURL(file))
    }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setSubmitting(true)

    try {
      if (!accountName || !accountNumber || !confirmAccountNumber || !ifscCode || !bankName) {
        throw new Error('Please fill in all bank details.')
      }
      if (accountNumber !== confirmAccountNumber) {
        throw new Error('The entered account numbers do not match. Please verify and try again.')
      }

      const numAmount = Number(withdrawAmount)
      if (!numAmount || numAmount <= 0) {
        throw new Error('Please enter a valid withdrawal amount.')
      }
      if (numAmount > maxWithdrawable) {
        throw new Error(`You can only withdraw up to ₹${maxWithdrawable}. (Any pending requests are deducted from your max withdrawable limit)`)
      }

      let qrCodeUrl = qrPreview
      if (qrFile) {
        const uploadRes = await uploadDocument(qrFile, 'kyc-documents')
        qrCodeUrl = assetUrlFromUpload(uploadRes)
      }

      const payload = {
        amount: numAmount, 
        bankDetails: {
          accountNumber,
          ifscCode,
          accountHolderName: accountName,
          bankName,
          qrCodeUrl: qrCodeUrl
        }
      }

      await withdrawalsApi.createWithdrawal(payload)
      setSuccess(true)
    } catch (err) {
      setErrorMsg(err.message || 'Failed to submit request')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center"
        >
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-blue-100">
            <CheckCircle2 className="h-10 w-10 text-blue-600" />
          </div>
          <h2 className="mt-6 text-2xl font-extrabold text-slate-900">Request Sent!</h2>
          <p className="mt-2 text-sm text-slate-500">
            Your withdrawal request has been sent to the admin. We will process it shortly.
          </p>
          <button
            onClick={() => {
               setSuccess(false)
               fetchEarnings()
            }}
            className="mt-8 inline-block rounded-xl bg-slate-100 px-6 py-3 text-sm font-bold text-slate-900 transition hover:bg-slate-200"
          >
            Back to Wallet
          </button>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-8">
      <section className="relative -mx-4 px-4 pb-1">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative overflow-hidden rounded-[1.65rem] border border-white/15 bg-linear-to-br from-blue-900 via-slate-900 to-slate-950 text-white shadow-[0_22px_48px_-20px_rgba(0,0,0,0.55)]"
        >
          <div
            className="pointer-events-none absolute inset-0 bg-[url('https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=800&q=60')] bg-cover bg-center opacity-20"
            aria-hidden
          />
          <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-slate-950/85 via-slate-900/80 to-brand/20" aria-hidden />

          <div className="relative p-5 sm:p-6">
            <div className="flex items-start gap-3">
              <Link
                to="/app"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/25 bg-white/10 backdrop-blur-sm transition hover:bg-white/20"
                aria-label="Back to home"
              >
                <ArrowLeft className="h-5 w-5" aria-hidden />
              </Link>
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600/20 ring-1 ring-blue-400/30">
                <Wallet className="h-5 w-5 text-blue-200" aria-hidden />
              </span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/55">Account</p>
                <h1 className="text-xl font-extrabold tracking-tight">Earnings & Withdraw</h1>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-4 gap-2 divide-x divide-white/20 rounded-2xl bg-black/20 p-3 backdrop-blur-md border border-white/10">
              <div className="flex flex-col items-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-200 text-center">Online<br/>Earning</p>
                {loading ? (
                  <div className="mt-1 h-6 w-12 animate-pulse rounded bg-white/10"></div>
                ) : (
                  <p className="mt-1 font-mono text-base font-black tracking-tight text-white">
                    {formatInrFromPaise(totalEarnings)}
                  </p>
                )}
              </div>
              
              <div className="flex flex-col items-center px-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-200 text-center">Total<br/>Paid</p>
                {loading ? (
                  <div className="mt-1 h-6 w-12 animate-pulse rounded bg-white/10"></div>
                ) : (
                  <p className="mt-1 font-mono text-base font-black tracking-tight text-blue-400">
                    ₹{totalPaid.toLocaleString('en-IN')}
                  </p>
                )}
              </div>
              
              <div className="flex flex-col items-center px-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-200 text-center">Refund<br/>Amount</p>
                {loading ? (
                  <div className="mt-1 h-6 w-12 animate-pulse rounded bg-white/10"></div>
                ) : (
                  <p className="mt-1 font-mono text-base font-black tracking-tight text-purple-300">
                    ₹{Math.floor(totalRefunds / 100).toLocaleString('en-IN')}
                  </p>
                )}
              </div>

              <div className="flex flex-col items-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-200 text-center">Due<br/>Amount</p>
                {loading ? (
                  <div className="mt-1 h-6 w-12 animate-pulse rounded bg-white/10"></div>
                ) : (
                  <p className="mt-1 font-mono text-base font-black tracking-tight text-amber-400">
                    ₹{dueAmount.toLocaleString('en-IN')}
                  </p>
                )}
              </div>
            </div>
            
            {/* Cash Earnings Section */}
            <div className="mt-3 rounded-2xl bg-black/20 p-3 border border-white/10 backdrop-blur-md">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-200">Total Cash Booking Earning</p>
                  {loading ? (
                    <div className="mt-1 h-6 w-16 animate-pulse rounded bg-white/10"></div>
                  ) : (
                    <p className="mt-1 font-mono text-xl font-black tracking-tight text-amber-400">
                      {formatInrFromPaise(totalCashEarnings)}
                    </p>
                  )}
                </div>
              </div>

              {/* Stats Row */}
              <div className="mt-3 grid grid-cols-2 gap-4 border-t border-white/10 pt-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-blue-200">Total Earned</p>
                  {loading ? (
                    <div className="mt-1 h-6 w-20 animate-pulse rounded bg-white/10"></div>
                  ) : (
                    <p className="mt-1 font-mono text-lg font-black tracking-tight text-white">
                      ₹{Math.floor(totalEarnings / 100).toLocaleString('en-IN')}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-200">Withdrawn</p>
                  {loading ? (
                    <div className="mt-1 h-6 w-16 animate-pulse rounded bg-white/10"></div>
                  ) : (
                    <p className="mt-1 font-mono text-lg font-black tracking-tight text-emerald-400">
                      ₹{totalPaid.toLocaleString('en-IN')}
                    </p>
                  )}
                </div>
              </div>
            </div>
              
              {(adminDues > 0 || !loading) && (
                <div className="flex items-center justify-between gap-3 rounded-xl bg-linear-to-br from-rose-500/10 to-rose-900/20 p-3 border border-rose-500/20 shadow-inner mt-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-extrabold uppercase tracking-widest text-rose-300 truncate">
                      Admin Dues (Cash)
                    </p>
                    <p className="mt-1 text-[10px] font-medium text-rose-300/60 truncate">
                      Remaining amount to be paid
                    </p>
                    <p className="mt-1 font-mono text-xl font-black tracking-tight text-rose-400 drop-shadow-sm">
                      ₹{adminDues.toLocaleString('en-IN')}
                    </p>
                  </div>
                  {adminDues > 0 && (
                    <button 
                      onClick={handlePayAdmin}
                      disabled={loading}
                      className="shrink-0 rounded-xl bg-linear-to-b from-rose-500 to-rose-600 px-5 py-2.5 text-sm font-extrabold text-white shadow-lg shadow-rose-500/20 ring-1 ring-white/10 transition-all hover:scale-105 hover:shadow-rose-500/40 active:scale-95 disabled:pointer-events-none disabled:opacity-50"
                    >
                      Pay Admin
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </section>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="px-1"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Request Withdrawal</h2>
            <p className="mt-1 text-sm text-slate-500">Provide your bank or UPI details to receive your earnings.</p>
          </div>
        </div>

        {errorMsg && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <GlassPanel className="space-y-4 border-slate-200/80 p-5 shadow-sm">
            
            <div>
              <label className="mb-1.5 flex items-center gap-2 text-sm font-bold text-slate-700">
                <Wallet className="h-4 w-4 text-brand" /> Amount to Withdraw (Max ₹{maxWithdrawable})
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-500">₹</span>
                <input
                  required
                  type="number"
                  min="1"
                  max={maxWithdrawable}
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder={`Enter up to ${maxWithdrawable}`}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 py-3 pl-8 pr-4 text-sm font-medium outline-none transition focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/10"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-2 text-sm font-bold text-slate-700">
                <UserCircle className="h-4 w-4 text-brand" /> Account Name
              </label>
              <input
                required
                type="text"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="Name on bank account"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-medium outline-none transition focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/10"
              />
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-2 text-sm font-bold text-slate-700">
                <Landmark className="h-4 w-4 text-brand" /> Bank Name
              </label>
              <input
                required
                type="text"
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g. State Bank of India"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-medium outline-none transition focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/10"
              />
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-2 text-sm font-bold text-slate-700">
                <FileText className="h-4 w-4 text-brand" /> Account Number
              </label>
              <input
                required
                type="text"
                inputMode="numeric"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value)}
                placeholder="Enter account number"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-medium outline-none transition focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/10"
              />
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-2 text-sm font-bold text-slate-700">
                <FileText className="h-4 w-4 text-brand" /> Confirm Account Number
              </label>
              <input
                required
                type="text"
                inputMode="numeric"
                value={confirmAccountNumber}
                onChange={(e) => setConfirmAccountNumber(e.target.value)}
                placeholder="Re-enter account number"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-medium outline-none transition focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/10"
              />
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-2 text-sm font-bold text-slate-700">
                <FileText className="h-4 w-4 text-brand" /> IFSC Code
              </label>
              <input
                required
                type="text"
                value={ifscCode}
                onChange={(e) => setIfscCode(e.target.value.toUpperCase())}
                placeholder="e.g. SBIN0001234"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm font-medium uppercase outline-none transition focus:border-brand focus:bg-white focus:ring-4 focus:ring-brand/10"
              />
            </div>

            <div className="pt-2">
              <label className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                <QrCode className="h-4 w-4 text-brand" /> QR Code (Optional)
              </label>
              <div className="relative overflow-hidden rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 transition-colors hover:border-brand/40 hover:bg-slate-100">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleQrUpload}
                  className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
                />
                <div className="flex flex-col items-center justify-center p-6 text-center">
                  {qrPreview ? (
                    <div className="flex flex-col items-center gap-3">
                      <img src={qrPreview} alt="QR Code Preview" className="h-24 w-24 rounded-lg object-contain shadow-sm" />
                      <p className="text-xs font-semibold text-brand">Tap to change QR code</p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand/10">
                        <UploadCloud className="h-5 w-5 text-brand" />
                      </div>
                      <p className="text-sm font-semibold text-slate-600">Upload UPI QR Code Image</p>
                      <p className="text-[10px] text-slate-400">JPG, PNG up to 5MB</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </GlassPanel>

          <AppPrimaryButton
            type="submit"
            className="w-full py-3.5 text-base shadow-lg shadow-brand/20"
            disabled={submitting || loading || maxWithdrawable <= 0 || !withdrawAmount || Number(withdrawAmount) > maxWithdrawable}
          >
            {submitting ? 'Processing...' : 'Send Request'}
          </AppPrimaryButton>
        </form>

        {withdrawals.length > 0 && (
          <div className="mt-8 space-y-4">
            <h2 className="text-lg font-bold text-slate-900">Recent Withdrawals</h2>
            {withdrawals.map((w) => (
              <GlassPanel key={w._id} className="p-4 border-slate-200/80 shadow-sm space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-bold text-slate-900 text-lg">₹{(w.amount || 0).toLocaleString('en-IN')}</p>
                    <p className="text-xs text-slate-500 mt-1">{new Date(w.createdAt).toLocaleDateString()}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                    w.status === 'APPROVED' ? 'bg-blue-100 text-blue-700' :
                    w.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' :
                    'bg-amber-100 text-amber-700'
                  }`}>
                    {w.status}
                  </span>
                </div>
                {w.status === 'REJECTED' && w.adminRemarks && (
                  <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
                    <p className="text-xs font-bold text-rose-800 mb-1">Reason for Rejection:</p>
                    <p className="text-sm text-rose-700">{w.adminRemarks}</p>
                  </div>
                )}
              </GlassPanel>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  )
}
