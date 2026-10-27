import { useEffect, useMemo, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { FileText, Loader2, Sparkles, Menu, IndianRupee, Printer } from 'lucide-react'
import { bookingsApi } from '../../api/bookingsApi.js'
import { ApiError } from '../../api/http.js'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import InvoicePrintView from '../../components/admin/InvoicePrintView.jsx'
import { calculateCompletedBookingBill } from '../../lib/completedBillingHelper.js'
import { AppStackScreenHeader } from '../../components/app/AppStackScreenHeader.jsx'

export function AppBillingPage() {
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  // Generating state
  const [generatingId, setGeneratingId] = useState(null)
  const [printInvoiceData, setPrintInvoiceData] = useState(null)
  const printRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    bookingsApi.getMyBookings()
      .then((res) => {
        if (cancelled) return
        setBookings(res.data?.bookings ?? [])
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load bookings')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [])

  const handleGenerateInvoice = async (bookingId) => {
    setGeneratingId(bookingId)
    try {
      const res = await bookingsApi.generateInvoice(bookingId)
      const invoice = res.data?.invoice
      const bookingDetails = res.data?.booking
      
      if (invoice && bookingDetails) {
        setPrintInvoiceData({ invoice, booking: bookingDetails })
        setTimeout(() => {
          window.print()
        }, 500)
      }
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Invoice generation failed')
    } finally {
      setGeneratingId(null)
    }
  }

  // Filter only completed or paid bookings if needed, but we'll show all and allow generating invoice.
  // We can sort them so newest is first.
  const displayed = useMemo(() => {
    return [...bookings].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }, [bookings])

  return (
    <>
      <div className="space-y-4 pb-8 hide-on-print pt-2">
        <AppStackScreenHeader title="Invoice & Billing" backTo="/app" />

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-brand" />
          </div>
        ) : error ? (
          <GlassPanel className="p-6 text-center">
            <p className="text-sm font-semibold text-rose-700">{error}</p>
          </GlassPanel>
        ) : displayed.length === 0 ? (
          <GlassPanel className="p-8 text-center">
            <Sparkles className="mx-auto h-10 w-10 text-slate-300" aria-hidden />
            <p className="mt-3 text-sm font-semibold text-slate-600">No transactions yet</p>
            <p className="mt-1 text-xs text-slate-500">Your billing history will appear here.</p>
          </GlassPanel>
        ) : (
          <div className="space-y-3">
            {displayed.map((booking, i) => {
              const status = (booking.status || 'CREATED').toUpperCase()
              const isPaid = (booking.paymentStatus || '').toUpperCase() === 'PAID'

              return (
                <motion.div
                  key={booking._id}
                  initial={reduce ? false : { opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm"
                >
                  <div className="flex justify-between items-start mb-3 border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm">
                        {booking.contractorInfo?.services?.length > 0 
                          ? 'Contractor Bulk Booking' 
                          : booking.serviceId?.name || 'Service Booking'}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {new Date(booking.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                      </p>
                    </div>
                    <div className="text-right">
                      {(() => {
                        const bill = calculateCompletedBookingBill(booking)
                        const amount = bill.isContractorBooking ? bill.completedTotalAmount : (booking.totalAmount || 0)
                        return (
                          <>
                            <div className="flex items-center justify-end font-bold text-slate-900">
                              <IndianRupee className="w-3.5 h-3.5 mr-0.5" />
                              {amount.toLocaleString('en-IN')}
                            </div>
                            {bill.isContractorBooking && bill.deductedBasePrice > 0 && (
                              <p className="text-[10px] font-semibold text-rose-600">
                                -₹{bill.deductedBasePrice.toLocaleString('en-IN')} cut
                              </p>
                            )}
                          </>
                        )
                      })()}
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase mt-1 inline-block ${
                        isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {booking.paymentStatus || 'PENDING'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="text-xs font-semibold text-slate-600">
                      Status: <span className="text-slate-900">{status}</span>
                    </div>
                    
                    <button
                      disabled={generatingId === booking._id}
                      onClick={() => handleGenerateInvoice(booking._id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-brand/10 text-brand font-bold text-xs rounded-lg hover:bg-brand/20 transition-colors disabled:opacity-50"
                    >
                      {generatingId === booking._id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Printer className="w-3.5 h-3.5" />
                      )}
                      <span>View Invoice</span>
                    </button>
                  </div>
                </motion.div>
              )
            })}
          </div>
        )}
      </div>

      {printInvoiceData && (
        <div className="print-only" ref={printRef}>
          <InvoicePrintView data={printInvoiceData} />
        </div>
      )}
    </>
  )
}
