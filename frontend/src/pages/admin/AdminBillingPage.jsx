import { useState, useEffect, useCallback, useRef } from 'react'
import {
  FileText,
  Loader2,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  IndianRupee,
  Clock,
  XCircle,
  CheckSquare,
  FilePlus,
  ChevronDown,
} from 'lucide-react'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { AppPrimaryButton } from '../../components/app/AppPrimaryButton.jsx'
import { apiRequest } from '../../api/http.js'
import InvoicePrintView from '../../components/admin/InvoicePrintView.jsx'

const BOOKING_STATUSES = ['ALL', 'CREATED', 'ACCEPTED', 'STARTED', 'COMPLETED', 'CANCELLED']

export function AdminBillingPage() {
  const [bookings, setBookings] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [typeFilter, setTypeFilter] = useState('ALL') // ALL, contractor, individual
  const [page, setPage] = useState(1)
  const limit = 15

  // Generate invoice form
  const [generatingId, setGeneratingId] = useState(null)
  const [genMsg, setGenMsg] = useState({ type: '', text: '' })
  const [printInvoiceData, setPrintInvoiceData] = useState(null)
  
  const printRef = useRef(null)

  const loadBookings = useCallback(async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ page, limit })
      if (statusFilter && statusFilter !== 'ALL') params.set('status', statusFilter)
      if (typeFilter && typeFilter !== 'ALL') params.set('type', typeFilter)
      
      const res = await apiRequest(`/admin/bookings?${params}`)
      setBookings(res.data?.bookings ?? [])
      setTotal(res.data?.pagination?.total ?? 0)
    } catch {
      // silent — show empty state
    } finally {
      setLoading(false)
    }
  }, [statusFilter, typeFilter, page])

  useEffect(() => {
    loadBookings()
  }, [loadBookings])

  const showGenMsg = (type, text) => {
    setGenMsg({ type, text })
    setTimeout(() => setGenMsg({ type: '', text: '' }), 6000)
  }

  const handleGenerateInvoice = async (bookingId) => {
    setGeneratingId(bookingId)
    try {
      // 1. Generate Invoice (POST)
      const res = await apiRequest(`/admin/bookings/${bookingId}/invoice`, {
        method: 'POST',
      })
      const invoice = res.data?.invoice
      
      // 2. Fetch Booking full details for printing (GET by ID)
      const bookingRes = await apiRequest(`/admin/bookings/${bookingId}`)
      const bookingDetails = bookingRes.data?.booking
      
      if (invoice && bookingDetails) {
        setPrintInvoiceData({ invoice, booking: bookingDetails })
        showGenMsg('success', `Invoice ${invoice.invoiceNumber} generated successfully!`)
        // Slight delay to allow React to render the print component in DOM
        setTimeout(() => {
          window.print()
        }, 500)
      }
    } catch (err) {
      showGenMsg('error', err?.data?.message || err?.message || 'Invoice generation failed')
    } finally {
      setGeneratingId(null)
    }
  }

  const totalPages = Math.ceil(total / limit)

  return (
    <>
      <div className="p-6 md:p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 hide-on-print">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Payments & Billing Transactions</h1>
        <p className="text-gray-500 mt-1">Manage transaction details, customer and contractor bookings, and generate invoices</p>
      </div>

      {genMsg.text && (
        <div
          className={`p-3 rounded-lg text-sm flex items-start gap-2 ${
            genMsg.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'
          }`}
        >
          {genMsg.type === 'success' ? (
            <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          )}
          {genMsg.text}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {BOOKING_STATUSES.map((s) => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1) }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                statusFilter === s ? 'bg-brand text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {s.toLowerCase()}
            </button>
          ))}
        </div>
        
        <div className="flex gap-2">
           <select 
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none"
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
           >
             <option value="ALL">All Clients</option>
             <option value="individual">Customer (Individual)</option>
             <option value="contractor">Contractor (Bulk)</option>
           </select>
          <button
            onClick={loadBookings}
            className="p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-white border border-gray-200 transition-colors bg-white shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      <GlassPanel className="overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="w-8 h-8 animate-spin text-brand" />
          </div>
        ) : bookings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-gray-400">
            <FileText className="w-10 h-10 mb-2" />
            <p className="text-sm">No transactions found.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm whitespace-nowrap">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/70">
                  <th className="text-left px-4 py-3.5 font-semibold text-gray-600">ID & Date</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-gray-600">Client</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-gray-600">Service Provider(s)</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-gray-600">Service Info</th>
                  <th className="text-right px-4 py-3.5 font-semibold text-gray-600">Amount Info</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-gray-600">Status</th>
                  <th className="text-left px-4 py-3.5 font-semibold text-gray-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {bookings.map((b) => (
                  <tr key={b._id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-4 py-3.5">
                      <p className="font-mono text-xs text-gray-500">{b._id.slice(-6).toUpperCase()}</p>
                      <p className="text-sm font-medium text-gray-900 mt-0.5">
                        {new Date(b.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </p>
                      <p className="text-xs text-gray-400">
                        {new Date(b.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="text-sm text-gray-800 font-medium">
                         {b.userId?.fullName || 'Unknown'} 
                         {b.contractorInfo?.services?.length > 0 ? <span className="ml-1 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Contractor</span> : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="max-w-[150px] whitespace-normal">
                        <p className="text-sm text-gray-600">
                          {b.assignments?.length > 0 
                            ? b.assignments.map(a => a.labourId?.fullName).filter(Boolean).join(', ') 
                            : (b.laborId?.fullName || (b.quantity > 1 ? `${b.quantity} Service Providers` : 'Unassigned'))
                          }
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      {b.contractorInfo?.services?.length > 0 ? (
                        <div className="space-y-1.5">
                          {b.contractorInfo.services.map((s, idx) => (
                            <div key={idx}>
                              <p className="text-sm text-gray-800">{s.serviceId?.name || 'Service'}</p>
                              <p className="text-xs text-gray-500">Qty: {s.quantity || 1}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <>
                          <p className="text-sm text-gray-800">{b.serviceId?.name || 'Service'}</p>
                          <p className="text-xs text-gray-500 mt-0.5">Qty: {b.quantity || 1}</p>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <p className="font-semibold text-gray-900">₹{(b.totalAmount || 0).toLocaleString('en-IN')}</p>
                      <p className="text-xs text-gray-500 mt-0.5">Base: ₹{b.basePrice || 0}</p>
                      <p className="text-xs text-gray-500">GST: ₹{b.taxes || 0}</p>
                      <p className="text-xs text-gray-500">Fee: ₹{b.platformFee || 0}</p>
                    </td>
                    <td className="px-4 py-3.5">
                       <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                         b.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                         b.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                         'bg-blue-100 text-blue-700'
                       }`}>
                         {b.status}
                       </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => handleGenerateInvoice(b._id)}
                        disabled={generatingId === b._id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand text-white text-xs font-medium rounded-lg hover:bg-brand-dark transition-colors disabled:opacity-50"
                      >
                        {generatingId === b._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FilePlus className="w-3.5 h-3.5" />}
                        Create Invoice
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassPanel>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Page {page} of {totalPages} ({total} total)</span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => p - 1)}
              className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Prev
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage(p => p + 1)}
              className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
    
    {/* Print View Component (Hidden by default, shown via CSS on print) */}
    {printInvoiceData && (
      <div className="print-only" ref={printRef}>
         <InvoicePrintView data={printInvoiceData} />
      </div>
    )}
  </>
  )
}
