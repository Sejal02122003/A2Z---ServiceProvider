import { useEffect, useState, useMemo } from 'react'
import { Percent, Download, Search, Filter, X, ChevronLeft, ChevronRight, UserCircle, Wrench, Wallet, HandCoins, Trophy, Briefcase, Settings, Save } from 'lucide-react'
import { adminBookingsApi } from '../../api/adminBookingsApi.js'
import { adminSettingsApi } from '../../api/adminSettingsApi.js'

export function AdminCommissionFeePage() {
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
  const [commissionValue, setCommissionValue] = useState(0)
  const [savingSettings, setSavingSettings] = useState(false)
  const [actualAmounts, setActualAmounts] = useState({ commissionAmount: 0, platformFeesAmount: 0, serviceAmount: 0 })

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
          setCommissionValue(fetchedSettings.commission?.globalPercentage || 0)
        }

        const amountsRes = await adminSettingsApi.getCommissionFeeAmounts()
        const fetchedAmounts = amountsRes?.data || amountsRes || {}
        setActualAmounts(fetchedAmounts)
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
      if (b.paymentMethod !== 'ONLINE' || b.status !== 'COMPLETED') return false
      if (!b.commissionAmount) return false

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

  // Calculate Metrics and Groupings
  const { metrics, topLabourers, topServices } = useMemo(() => {
    let allTime = 0
    let currentMonth = 0
    let totalPlatformFees = 0
    let totalServiceAmount = 0
    let validCount = 0
    
    const now = new Date()
    const labourMap = new Map()
    const serviceMap = new Map()
    
    bookings.forEach(b => {
      if (b.paymentMethod === 'ONLINE' && b.status === 'COMPLETED' && b.commissionAmount) {
        const fee = b.commissionAmount
        allTime += fee
        totalPlatformFees += (b.platformFee || 0)
        totalServiceAmount += (b.basePrice || 0)
        validCount++
        
        const bDate = new Date(b.createdAt)
        if (bDate.getMonth() === now.getMonth() && bDate.getFullYear() === now.getFullYear()) {
          currentMonth += fee
        }

        // Group by Labourer
        if (b.assignments && b.assignments.length > 0) {
          const splitFee = fee / b.assignments.length
          b.assignments.forEach(a => {
            const labourName = a.labourId?.fullName || a.labourId?.name || 'Unknown Service Provider'
            labourMap.set(labourName, (labourMap.get(labourName) || 0) + splitFee)
          })
        } else {
          const labourName = b.laborId?.fullName || 'Unknown Service Provider'
          labourMap.set(labourName, (labourMap.get(labourName) || 0) + fee)
        }

        // Group by Service
        const serviceName = b.serviceId?.name || 'Unknown Service'
        serviceMap.set(serviceName, (serviceMap.get(serviceName) || 0) + fee)
      }
    })

    const filteredTotal = filteredBookings.reduce((sum, b) => sum + (b.commissionAmount || 0), 0)
    const average = validCount > 0 ? Math.round(allTime / validCount) : 0

    const topLabourersArray = Array.from(labourMap.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 1) // Only show the SINGLE top earner as requested

    const topServicesArray = Array.from(serviceMap.entries())
      .map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 5)

    return { 
      metrics: { allTime, currentMonth, filteredTotal, average, totalPlatformFees, totalServiceAmount },
      topLabourers: topLabourersArray,
      topServices: topServicesArray
    }
  }, [bookings, filteredBookings])

  // Export to CSV
  const handleExportCSV = () => {
    if (filteredBookings.length === 0) return
    
    const headers = ['Booking ID', 'Date', 'Customer Name', 'Service Provider Name', 'Service', 'Total Amount', 'Platform Fee', 'Commission', 'Service Provider Share']
    const rows = filteredBookings.map(b => [
      b._id,
      new Date(b.createdAt).toLocaleDateString(),
      b.userId?.fullName || 'N/A',
      b.laborId?.fullName || 'N/A',
      b.serviceId?.name || 'N/A',
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
    link.setAttribute('download', `commission_fees_${dateFilter.toLowerCase()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const handleSaveSettings = async () => {
    setSavingSettings(true)
    try {
      await adminSettingsApi.updateCommission({ type: 'global', globalPercentage: Number(commissionValue), isActive: true })
      setSettings(prev => ({
        ...prev,
        commission: { ...prev?.commission, type: 'global', globalPercentage: Number(commissionValue) }
      }))
      setIsEditingSettings(false)
    } catch (err) {
      console.error('Failed to update commission settings', err)
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
            Commission Ledger
            <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-800">
              {settings?.commission?.globalPercentage || 0}%
            </span>
          </h1>
          <p className="text-sm text-slate-500">Analytics and history of commission fees collected from jobs.</p>
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="overflow-hidden rounded-2xl border border-blue-100 bg-blue-50/50 p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-800/70">Total Commission</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-blue-700">₹{loading ? '...' : metrics.allTime.toLocaleString('en-IN')}</span>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-indigo-100 bg-indigo-50/50 p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-indigo-800/70">Platform Fees</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-indigo-700">₹{loading ? '...' : metrics.totalPlatformFees.toLocaleString('en-IN')}</span>
          </div>
        </div>
        
        <div className="overflow-hidden rounded-2xl border border-blue-100 bg-blue-50/50 p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-800/70">Service Amount</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-blue-700">₹{loading ? '...' : metrics.totalServiceAmount.toLocaleString('en-IN')}</span>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Avg. Comm. / Booking</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-black text-slate-900">₹{loading ? '...' : metrics.average.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      {/* Leaderboards */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-amber-200 bg-amber-50/30 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Trophy className="h-5 w-5 text-amber-500" />
            <h3 className="font-bold text-slate-900">Top Earner (Service Provider)</h3>
          </div>
          {loading ? (
            <div className="animate-pulse text-sm text-slate-400">Loading leaderboard...</div>
          ) : topLabourers.length === 0 ? (
            <div className="text-sm text-slate-500">No data available yet.</div>
          ) : (
            <div className="space-y-3">
              {topLabourers.map((l, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 text-xs font-bold text-amber-700">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-slate-700">{l.name}</span>
                  </div>
                  <span className="font-bold text-slate-900">₹{l.total.toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Briefcase className="h-5 w-5 text-blue-500" />
            <h3 className="font-bold text-slate-900">Top Services</h3>
          </div>
          {loading ? (
            <div className="animate-pulse text-sm text-slate-400">Loading services...</div>
          ) : topServices.length === 0 ? (
            <div className="text-sm text-slate-500">No data available yet.</div>
          ) : (
            <div className="space-y-3">
              {topServices.map((s, idx) => (
                <div key={idx} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-slate-700">{s.name}</span>
                  </div>
                  <span className="font-bold text-slate-900">₹{s.total.toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <select 
            value={dateFilter} 
            onChange={(e) => setDateFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
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
            className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-9 pr-4 text-sm font-medium text-slate-900 outline-none focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-200"
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
                  <th className="px-6 py-3 font-semibold text-right">Commission</th>
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
                        <p className="font-bold text-blue-600">+ ₹{(b.commissionAmount || 0).toLocaleString('en-IN')}</p>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center text-slate-500">
                      No matching commission transactions found.
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
                <Settings className="h-4 w-4 text-blue-600" /> Commission Config
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
                <label className="mb-1.5 block text-sm font-bold text-slate-700">Global Commission (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={commissionValue}
                  onChange={(e) => setCommissionValue(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium outline-none transition focus:border-blue-500 focus:bg-white focus:ring-4 focus:ring-blue-500/10"
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
