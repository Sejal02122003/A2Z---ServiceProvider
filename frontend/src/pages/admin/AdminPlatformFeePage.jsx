import { useEffect, useState, useMemo } from 'react'
import { Landmark, TrendingUp, Calendar, Download, Search, Filter, X, ChevronLeft, ChevronRight, UserCircle, Wrench, Wallet, Percent, HandCoins, Settings, Save } from 'lucide-react'
import { adminBookingsApi } from '../../api/adminBookingsApi.js'
import { adminSettingsApi } from '../../api/adminSettingsApi.js'

export function AdminPlatformFeePage() {
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState('ALL') // ALL, TODAY, WEEK, MONTH
  const [searchTerm, setSearchTerm] = useState('')

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 10

  // Modal State
  const [selectedBooking, setSelectedBooking] = useState(null)
  
  // Settings State
  const [settings, setSettings] = useState(null)
  const [isEditingSettings, setIsEditingSettings] = useState(false)
  const [feeType, setFeeType] = useState('fixed')
  const [feeValue, setFeeValue] = useState(0)
  const [savingSettings, setSavingSettings] = useState(false)

  useEffect(() => {
    const fetchBookings = async () => {
      try {
        const res = await adminBookingsApi.getAllBookings({ limit: 5000 })
        const all = res?.data?.bookings || res?.bookings || res || []
        setBookings(Array.isArray(all) ? all : [])
        
        const settingsRes = await adminSettingsApi.getSettings()
        const fetchedSettings = settingsRes?.data?.settings || settingsRes?.settings
        if (fetchedSettings) {
          setSettings(fetchedSettings)
          setFeeType(fetchedSettings.platformFee?.type || 'fixed')
          setFeeValue(fetchedSettings.platformFee?.value || 0)
        }
      } catch (err) {
        console.error('Failed to fetch bookings:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchBookings()
  }, [])

  // Filter Bookings based on Status, Search, and Date
  const filteredBookings = useMemo(() => {
    const now = new Date()
    return bookings.filter(b => {
      if (b.status !== 'COMPLETED') return false
      if (!b.platformFee || b.platformFee <= 0) return false

      // Date Filter
      const bDate = new Date(b.createdAt)
      if (dateFilter === 'TODAY') {
        if (bDate.toDateString() !== now.toDateString()) return false
      } else if (dateFilter === 'WEEK') {
        const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        if (bDate < oneWeekAgo) return false
      } else if (dateFilter === 'MONTH') {
        if (bDate.getMonth() !== now.getMonth() || bDate.getFullYear() !== now.getFullYear()) return false
      }

      // Search Filter
      if (searchTerm) {
        const lowerSearch = searchTerm.toLowerCase()
        const idMatch = b._id?.toLowerCase().includes(lowerSearch)
        const userMatch = b.userId?.fullName?.toLowerCase().includes(lowerSearch)
        const laborMatch = b.laborId?.fullName?.toLowerCase().includes(lowerSearch)
        const serviceMatch = b.serviceId?.name?.toLowerCase().includes(lowerSearch)
        if (!idMatch && !userMatch && !laborMatch && !serviceMatch) return false
      }

      return true
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  }, [bookings, dateFilter, searchTerm])

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1)
  }, [dateFilter, searchTerm])

  // Pagination Logic
  const totalPages = Math.ceil(filteredBookings.length / itemsPerPage)
  const currentBookings = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filteredBookings.slice(start, start + itemsPerPage)
  }, [filteredBookings, currentPage])

  // Calculate Metrics
  const metrics = useMemo(() => {
    let allTime = 0
    let currentMonth = 0
    
    const now = new Date()
    
    bookings.forEach(b => {
      if (b.status === 'COMPLETED' && b.platformFee > 0) {
        const fee = b.platformFee || 0
        allTime += fee
        
        const bDate = new Date(b.createdAt)
        if (bDate.getMonth() === now.getMonth() && bDate.getFullYear() === now.getFullYear()) {
          currentMonth += fee
        }
      }
    })

    const filteredTotal = filteredBookings.reduce((sum, b) => sum + (b.platformFee || 0), 0)

    return { allTime, currentMonth, filteredTotal }
  }, [bookings, filteredBookings])

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredBookings.length === 0) return
    
    const headers = ['Booking ID', 'Date', 'Customer Name', 'Service Provider Name', 'Service', 'Total Amount', 'Platform Fee', 'Commission', 'Service Provider Share']
    const rows = filteredBookings.map(b => [
      b._id,
      new Date(b.createdAt).toLocaleDateString(),
      b.user?.name || b.customer?.name || 'N/A',
      b.labor?.name || b.provider?.name || 'N/A',
      b.service?.name || b.category?.name || b.workCategory || 'N/A',
      b.totalAmount || 0,
      b.platformFee || 0,
      b.commissionAmount || 0,
      b.laborShare || 0
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.map(cell => `"${cell}"`).join(','))
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `platform_fees_${dateFilter.toLowerCase()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleSaveSettings = async () => {
    setSavingSettings(true)
    try {
      await adminSettingsApi.updatePlatformFees({ type: feeType, value: Number(feeValue), isActive: true })
      setSettings(prev => ({
        ...prev,
        platformFee: { ...prev?.platformFee, type: feeType, value: Number(feeValue) }
      }))
      setIsEditingSettings(false)
    } catch (err) {
      console.error('Failed to update platform fee settings', err)
      alert('Failed to update settings')
    } finally {
      setSavingSettings(false)
    }
  }

  return (
    <div className="space-y-6 relative">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
            Platform Fee Ledger
            <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800">
              {settings?.platformFee?.type === 'percentage' ? `${settings.platformFee.value}%` : `₹${settings?.platformFee?.value || 0}`}
            </span>
          </h1>
          <p className="text-sm text-slate-500">Analytics and history of platform fees collected.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsEditingSettings(true)}
            className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            <Settings className="h-4 w-4" /> Edit Config
          </button>
          <button 
            onClick={handleExportCSV}
            disabled={filteredBookings.length === 0}
            className="flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            <Download className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="overflow-hidden rounded-2xl border border-blue-100 bg-blue-50/50 p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-800/70">All-Time Revenue</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-blue-700">₹{loading ? '...' : metrics.allTime.toLocaleString('en-IN')}</span>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-blue-100 bg-blue-50/50 p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-800/70">This Month</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-blue-700">₹{loading ? '...' : metrics.currentMonth.toLocaleString('en-IN')}</span>
          </div>
        </div>
        
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:col-span-2 lg:col-span-1">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Filtered Total</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">₹{loading ? '...' : metrics.filteredTotal.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select 
            value={dateFilter} 
            onChange={(e) => setDateFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-200"
          >
            <option value="ALL">All Time</option>
            <option value="TODAY">Today</option>
            <option value="WEEK">Past 7 Days</option>
            <option value="MONTH">This Month</option>
          </select>
        </div>

        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search ID, customer, service provider, service..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-4 text-sm font-medium text-slate-900 outline-none focus:border-blue-600 focus:bg-white focus:ring-2 focus:ring-blue-200"
          />
        </div>
      </div>

      {/* Ledger */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 bg-slate-50/50 px-6 py-4 flex justify-between items-center">
          <h3 className="font-bold text-slate-900">Transactions Ledger</h3>
          <span className="text-xs font-semibold text-slate-500">Click a row for details</span>
        </div>
        <div className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-sm font-medium text-slate-500 animate-pulse">Loading data...</div>
          ) : (
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="border-b border-slate-100 bg-slate-50/80 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-6 py-3 font-semibold">Booking ID & Date</th>
                  <th className="px-6 py-3 font-semibold">Customer</th>
                  <th className="px-6 py-3 font-semibold">Service Provider</th>
                  <th className="px-6 py-3 font-semibold">Service</th>
                  <th className="px-6 py-3 font-semibold text-right">Booking Total</th>
                  <th className="px-6 py-3 font-semibold text-right">Platform Fee</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {currentBookings.length > 0 ? (
                  currentBookings.map(b => (
                    <tr 
                      key={b._id} 
                      onClick={() => setSelectedBooking(b)}
                      className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                    >
                      <td className="px-6 py-4">
                        <p className="font-bold text-slate-900">#{b._id.slice(-6)}</p>
                        <p className="text-xs text-slate-400">{new Date(b.createdAt).toLocaleString()}</p>
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-700">
                        {b.userId?.fullName || 'N/A'}
                      </td>
                      <td className="px-6 py-4 font-medium text-slate-700">
                        {b.assignments && b.assignments.length > 0 ? (
                          <div className="flex flex-col gap-1">
                            {b.assignments.map((a, i) => (
                              <span key={i} className="whitespace-nowrap">
                                {a.labourId?.fullName || a.labourId?.name || 'N/A'}
                              </span>
                            ))}
                          </div>
                        ) : (
                          b.laborId?.fullName || 'N/A'
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-flex rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                          {b.serviceId?.name || 'Service'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="font-bold text-slate-900">₹{(b.totalAmount || 0).toLocaleString('en-IN')}</p>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <p className="font-bold text-blue-600">+ ₹{(b.platformFee || 0).toLocaleString('en-IN')}</p>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-slate-500">
                      No matching platform fee transactions found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
        
        {/* Pagination Controls */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-3">
            <p className="text-sm text-slate-500">
              Showing <span className="font-semibold text-slate-700">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-semibold text-slate-700">{Math.min(currentPage * itemsPerPage, filteredBookings.length)}</span> of <span className="font-semibold text-slate-700">{filteredBookings.length}</span> entries
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm font-semibold text-slate-700">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Booking Details Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div 
            className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200"
          >
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
              <div>
                <h3 className="font-bold text-slate-900">Booking Breakdown</h3>
                <p className="text-xs font-semibold text-slate-500">#{selectedBooking._id}</p>
              </div>
              <button 
                onClick={() => setSelectedBooking(null)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6">
              <div className="grid gap-4 sm:grid-cols-2 mb-6">
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                    <UserCircle className="h-3.5 w-3.5" /> Customer
                  </p>
                  <p className="font-semibold text-slate-900">{selectedBooking.userId?.fullName || 'N/A'}</p>
                  <p className="text-xs text-slate-500">{selectedBooking.userId?.phone || 'No phone'}</p>
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
                    <Wrench className="h-3.5 w-3.5" /> Service Provider
                  </p>
                  {selectedBooking.assignments && selectedBooking.assignments.length > 0 ? (
                    <div className="flex flex-col gap-2">
                      {selectedBooking.assignments.map((a, i) => (
                        <div key={i} className="flex flex-col border-b border-slate-200/50 pb-2 last:border-0 last:pb-0">
                          <span className="font-semibold text-slate-900">{a.labourId?.fullName || a.labourId?.name || 'N/A'}</span>
                          <span className="text-xs text-slate-500">{a.labourId?.phone || 'No phone'}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      <p className="font-semibold text-slate-900">{selectedBooking.laborId?.fullName || 'N/A'}</p>
                      <p className="text-xs text-slate-500">{selectedBooking.laborId?.phone || 'No phone'}</p>
                    </>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="bg-slate-900 px-5 py-4">
                  <p className="text-sm font-semibold text-white/80">Total Amount Paid</p>
                  <p className="text-3xl font-black text-white">₹{(selectedBooking.totalAmount || 0).toLocaleString('en-IN')}</p>
                </div>
                
                <div className="divide-y divide-slate-100 bg-white">
                  <div className="flex items-center justify-between px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                        <HandCoins className="h-4 w-4" />
                      </div>
                      <span className="font-semibold text-slate-700">Platform Fee</span>
                    </div>
                    <span className="font-bold text-blue-600">₹{(selectedBooking.platformFee || 0).toLocaleString('en-IN')}</span>
                  </div>
                  
                  <div className="flex items-center justify-between px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600">
                        <Percent className="h-4 w-4" />
                      </div>
                      <span className="font-semibold text-slate-700">Commission</span>
                    </div>
                    <span className="font-bold text-blue-600">₹{(selectedBooking.commissionAmount || 0).toLocaleString('en-IN')}</span>
                  </div>
                  
                  <div className="flex items-center justify-between px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
                        <Wallet className="h-4 w-4" />
                      </div>
                      <span className="font-semibold text-slate-700">Service Provider Share</span>
                    </div>
                    <span className="font-bold text-amber-600">₹{(selectedBooking.laborShare || 0).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="border-t border-slate-100 bg-slate-50/80 px-6 py-4">
              <button 
                onClick={() => setSelectedBooking(null)}
                className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {isEditingSettings && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-6 py-4">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <Settings className="h-4 w-4 text-blue-600" /> Platform Fee Config
              </h3>
              <button 
                onClick={() => setIsEditingSettings(false)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-bold text-slate-700">Fee Type</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFeeType('fixed')}
                    className={`rounded-xl border p-3 text-sm font-bold transition ${feeType === 'fixed' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                  >
                    Fixed Amount (₹)
                  </button>
                  <button
                    type="button"
                    onClick={() => setFeeType('percentage')}
                    className={`rounded-xl border p-3 text-sm font-bold transition ${feeType === 'percentage' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                  >
                    Percentage (%)
                  </button>
                </div>
              </div>
              
              <div>
                <label className="mb-1.5 block text-sm font-bold text-slate-700">
                  {feeType === 'fixed' ? 'Amount (₹)' : 'Percentage (%)'}
                </label>
                <input
                  type="number"
                  min="0"
                  step={feeType === 'percentage' ? "0.1" : "1"}
                  value={feeValue}
                  onChange={(e) => setFeeValue(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none transition focus:border-blue-600 focus:bg-white focus:ring-4 focus:ring-blue-600/10"
                />
              </div>
            </div>
            
            <div className="border-t border-slate-100 bg-slate-50/80 px-6 py-4 flex gap-3">
              <button 
                onClick={() => setIsEditingSettings(false)}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveSettings}
                disabled={savingSettings}
                className="flex-1 rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Save className="h-4 w-4" /> {savingSettings ? 'Saving...' : 'Save Config'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
