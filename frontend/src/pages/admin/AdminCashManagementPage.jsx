import { useState, useEffect } from 'react'
import { Landmark, AlertCircle, CheckCircle2, Search, Calendar } from 'lucide-react'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { AppPrimaryButton } from '../../components/app/AppPrimaryButton.jsx'
import { adminSettingsApi } from '../../api/adminSettingsApi.js'
import { adminBookingsApi } from '../../api/adminBookingsApi.js'

export function AdminCashManagementPage() {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  
  const [labourLimit, setLabourLimit] = useState('')
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [successMsg, setSuccessMsg] = useState('')

  // Bookings state
  const [bookings, setBookings] = useState([])
  const [loadingBookings, setLoadingBookings] = useState(true)
  const [settlementFilter, setSettlementFilter] = useState('ALL')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const fetchSettings = async () => {
    try {
      const res = await adminSettingsApi.getSettings()
      const data = res.data?.settings
      if (data) {
        setSettings(data)
        setLabourLimit(data.labourCashLimit?.toString() || '500')
      }
    } catch (err) {
      console.error(err)
      setErrorMsg('Failed to load settings')
    }
  }

  const fetchBookings = async () => {
    setLoadingBookings(true)
    try {
      const res = await adminBookingsApi.getAllBookings({
        paymentMethod: 'CASH',
        adminSettlementStatus: settlementFilter,
        search: searchTerm,
        startDate,
        endDate,
        page,
        limit: 20
      })
      if (res.data) {
        setBookings(res.data.bookings || [])
        setTotalPages(Math.ceil((res.data.pagination?.total || 0) / 20) || 1)
      }
    } catch (err) {
      console.error('Failed to load bookings:', err)
    } finally {
      setLoadingBookings(false)
    }
  }

  useEffect(() => {
    Promise.all([fetchSettings(), fetchBookings()]).then(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!loading) {
      const delay = setTimeout(() => {
        fetchBookings()
      }, 300)
      return () => clearTimeout(delay)
    }
  }, [settlementFilter, page, searchTerm, startDate, endDate])

  const handleSave = async (e) => {
    e.preventDefault()
    setErrorMsg('')
    setSuccessMsg('')
    setSaving(true)
    try {
      await adminSettingsApi.updateLabourCashLimit({ labourCashLimit: Number(labourLimit) })
      setSuccessMsg('Limit updated successfully!')
      fetchSettings()
      setTimeout(() => setSuccessMsg(''), 3000)
    } catch (err) {
      setErrorMsg('Failed to update limit')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-20">
      <div className="flex items-center gap-3 mb-6">
        <span className="flex items-center justify-center h-10 w-10 bg-brand/10 text-brand rounded-xl">
          <Landmark className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Cash Management</h1>
          <p className="text-sm text-slate-500 font-medium">Control limits and view cash flow details</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <GlassPanel className="p-6">
              <h2 className="text-lg font-bold text-slate-800 mb-4">Service Provider Cash Limit</h2>
              <p className="text-sm text-slate-600 mb-6">
                When a Service Provider collects cash, admin commission is added to their dues. 
                If total dues exceed this limit, they cannot accept new bookings.
              </p>

              {errorMsg && (
                <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-100 flex items-center gap-3 text-rose-700">
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  <p className="text-sm font-semibold">{errorMsg}</p>
                </div>
              )}

              {successMsg && (
                <div className="mb-6 p-4 rounded-xl bg-blue-50 border border-blue-100 flex items-center gap-3 text-blue-700">
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
                  <p className="text-sm font-semibold">{successMsg}</p>
                </div>
              )}

              <form onSubmit={handleSave} className="space-y-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Max Outstanding Dues (₹)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">₹</span>
                    <input
                      type="number"
                      required
                      min="0"
                      value={labourLimit}
                      onChange={(e) => setLabourLimit(e.target.value)}
                      className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand font-semibold text-slate-800"
                      placeholder="Enter limit"
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end">
                  <AppPrimaryButton type="submit" disabled={saving}>
                    {saving ? 'Saving...' : 'Save Limit'}
                  </AppPrimaryButton>
                </div>
              </form>
            </GlassPanel>
          </div>

          <div className="lg:col-span-2 space-y-6">
            <GlassPanel className="p-0 overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-white">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800">Cash Flow Details</h2>
                    <p className="text-sm text-slate-500">Monitor cash bookings and admin dues</p>
                  </div>
                  
                  <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1 overflow-x-auto">
                    {['ALL', 'PENDING', 'SETTLED'].map(status => (
                      <button
                        key={status}
                        onClick={() => { setPage(1); setSettlementFilter(status) }}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition-all whitespace-nowrap ${settlementFilter === status ? 'bg-white text-brand shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                      >
                        {status === 'ALL' ? 'All' : status === 'PENDING' ? 'Unpaid' : 'Paid'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                  <div className="relative w-full sm:flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search Service Provider or ID..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9 pr-4 py-2 w-full bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand"
                    />
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-center gap-2 w-full sm:w-auto">
                    <div className="relative w-full sm:w-40">
                      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="pl-9 pr-2 py-2 w-full bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand text-slate-600"
                      />
                    </div>
                    <span className="hidden sm:inline text-slate-400 text-sm font-medium">to</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="px-3 py-2 w-full sm:w-40 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/50 focus:border-brand text-slate-600"
                    />
                  </div>
                </div>
              </div>

              {loadingBookings ? (
                <div className="py-20 flex justify-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
                </div>
              ) : bookings.length === 0 ? (
                <div className="py-20 text-center text-slate-500 font-medium">
                  No cash bookings found.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse min-w-[700px]">
                    <thead>
                      <tr className="border-b border-slate-200 text-sm text-slate-500">
                        <th className="pb-3 font-semibold px-4">Booking Info</th>
                        <th className="pb-3 font-semibold px-4">Service Provider</th>
                        <th className="pb-3 font-semibold px-4">Service</th>
                        <th className="pb-3 font-semibold px-4 text-right">Total Cash</th>
                        <th className="pb-3 font-semibold px-4 text-right" title="Amount added to Service Provider's wallet liability">Admin Dues</th>
                        <th className="pb-3 font-semibold px-4 text-center">Settlement Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {bookings.map(booking => {
                        const adminDues = (booking.platformFee || 0) + (booking.commissionAmount || 0) + (booking.taxes || 0)
                        return (
                          <tr key={booking._id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-4 px-4 align-top">
                              <div className="font-bold text-slate-900 text-sm truncate max-w-[120px]">
                                {booking._id.slice(-6).toUpperCase()}
                              </div>
                              <div className="text-xs text-slate-500 mt-1">
                                {new Date(booking.createdAt).toLocaleDateString()}
                              </div>
                            </td>
                            <td className="py-4 px-4 align-top">
                              {booking.laborId ? (
                                <div className="flex items-center gap-3">
                                  {booking.laborId.profileImageUrl ? (
                                    <img src={booking.laborId.profileImageUrl} alt="" className="w-8 h-8 rounded-full object-cover bg-slate-100" />
                                  ) : (
                                    <div className="w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center text-xs font-bold">
                                      {booking.laborId.fullName?.charAt(0) || 'L'}
                                    </div>
                                  )}
                                  <div>
                                    <div className="font-bold text-slate-900 text-sm">{booking.laborId.fullName}</div>
                                    <div className="text-xs text-slate-500">{booking.laborId.phone}</div>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-sm text-slate-400 italic">Unassigned</span>
                              )}
                            </td>
                            <td className="py-4 px-4 align-top">
                              <div className="font-bold text-slate-800 text-sm truncate max-w-[180px]">{booking.serviceId?.name || 'Unknown'}</div>
                              <div className="text-xs text-slate-500 truncate max-w-[150px]">{booking.subcategoryId?.name}</div>
                            </td>
                            <td className="py-4 px-4 align-top text-right">
                              <div className="font-black text-slate-900">₹{booking.totalAmount?.toLocaleString('en-IN') || 0}</div>
                            </td>
                            <td className="py-4 px-4 align-top text-right">
                              <div className="font-bold text-rose-600">₹{adminDues.toLocaleString('en-IN')}</div>
                            </td>
                            <td className="py-4 px-4 align-top text-center">
                              <span className={`inline-flex items-center justify-center px-2.5 py-1 text-xs font-bold rounded-full ${
                                booking.adminSettlementStatus === 'SETTLED' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                              }`}>
                                {booking.adminSettlementStatus === 'SETTLED' ? 'PAID' : 'UNPAID'}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  
                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="mt-6 flex items-center justify-center gap-2 border-t border-slate-100 pt-6">
                      <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-semibold disabled:opacity-50"
                      >
                        Prev
                      </button>
                      <span className="text-sm font-medium text-slate-600">
                        Page {page} of {totalPages}
                      </span>
                      <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm font-semibold disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              )}
            </GlassPanel>
          </div>
        </div>
      )}
    </div>
  )
}
