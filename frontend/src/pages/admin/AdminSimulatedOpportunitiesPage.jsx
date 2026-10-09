import { useCallback, useEffect, useState } from 'react'
import { motion, useReducedMotion, AnimatePresence } from 'framer-motion'
import {
  Zap,
  Radio,
  Plus,
  Clock,
  MapPin,
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Calendar,
  IndianRupee,
  ShieldAlert,
  Eye,
  Ban,
  RefreshCw,
  Search,
  Filter,
  Check,
  X,
} from 'lucide-react'
import { simulatedOpportunitiesApi } from '../../api/simulatedOpportunitiesApi.js'
import { fetchAdminLabourCategoryTree } from '../../api/adminLabourCategoriesApi.js'
import { adminZonesApi } from '../../api/adminZonesApi.js'
import { ApiError } from '../../api/http.js'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { AppPrimaryButton } from '../../components/app/AppPrimaryButton.jsx'

function formatInr(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatZoneDisplay(z) {
  if (!z) return ''
  const parts = [z.city, z.state].filter(Boolean).map((s) => String(s).trim()).filter(Boolean)
  return parts.length > 0 ? `${z.name} (${parts.join(', ')})` : z.name || 'Unnamed Zone'
}

function formatZoneLocation(z) {
  if (!z) return ''
  const parts = [z.name, z.city, z.state].filter(Boolean).map((s) => String(s).trim()).filter(Boolean)
  return parts.join(', ') || z.name || ''
}

function StatusBadge({ status }) {
  const map = {
    OPEN: { bg: 'bg-sky-50 text-sky-700 border-sky-200', label: 'OPEN' },
    ACCEPTED: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200', label: 'ACCEPTED' },
    EXPIRED: { bg: 'bg-slate-100 text-slate-600 border-slate-200', label: 'EXPIRED' },
    CANCELLED: { bg: 'bg-rose-50 text-rose-700 border-rose-200', label: 'CANCELLED' },
  }
  const curr = map[status] || { bg: 'bg-slate-100 text-slate-600 border-slate-200', label: status }
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-black border ${curr.bg}`}>
      {curr.label}
    </span>
  )
}

export function AdminSimulatedOpportunitiesPage() {
  const reduce = useReducedMotion()
  const [enabled, setEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(false)
  const [opportunities, setOpportunities] = useState([])
  const [selectedStatus, setSelectedStatus] = useState('ALL')
  const [categoryTree, setCategoryTree] = useState([])
  const [zones, setZones] = useState([])
  const [toast, setToast] = useState({ message: '', variant: 'success' })

  // Create Modal State
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formCategory, setFormCategory] = useState('')
  const [formCategoryId, setFormCategoryId] = useState('')
  const [formServiceType, setFormServiceType] = useState('')
  const [selectedZoneIds, setSelectedZoneIds] = useState([])
  const [isAllZones, setIsAllZones] = useState(true)
  const [formLocation, setFormLocation] = useState('All Operational Zones')
  const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0])
  const [formTime, setFormTime] = useState('05:00 PM')
  const [formAmount, setFormAmount] = useState('799')
  const [formVendorCount, setFormVendorCount] = useState('10')
  const [formExpiryMinutes, setFormExpiryMinutes] = useState('10')
  const [formPriority, setFormPriority] = useState('NORMAL')

  // Details Modal State
  const [detailItem, setDetailItem] = useState(null)
  const [cancellingId, setCancellingId] = useState(null)

  const showToast = (message, variant = 'success') => {
    setToast({ message, variant })
    setTimeout(() => setToast({ message: '', variant: 'success' }), 4000)
  }

  const loadData = useCallback(async () => {
    try {
      const [settingsRes, listRes, catRes, zonesRes] = await Promise.all([
        simulatedOpportunitiesApi.getSettings().catch(() => ({ data: { enabled: true } })),
        simulatedOpportunitiesApi.getAdminOpportunities({ status: selectedStatus !== 'ALL' ? selectedStatus : undefined }),
        fetchAdminLabourCategoryTree().catch(() => ({ data: [] })),
        adminZonesApi.getActiveZones().catch(() => adminZonesApi.getAllZones({ limit: 100 }).catch(() => ({ data: [] }))),
      ])
      setEnabled(settingsRes.data?.enabled ?? true)
      setOpportunities(listRes.data?.opportunities || [])
      setCategoryTree(catRes.data?.categories || catRes.data || [])
      
      const loadedZones = zonesRes.data?.zones || (Array.isArray(zonesRes.data) ? zonesRes.data : [])
      setZones(loadedZones)

      if (loadedZones.length > 0 && selectedZoneIds.length === 0) {
        setSelectedZoneIds(loadedZones.map((z) => z._id))
      }
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Failed to load data', 'error')
    } finally {
      setLoading(false)
    }
  }, [selectedStatus])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleToggleGlobal = async () => {
    setToggling(true)
    const nextState = !enabled
    try {
      const res = await simulatedOpportunitiesApi.updateSettings(nextState)
      setEnabled(res.data?.enabled ?? nextState)
      showToast(res.message || `Simulated opportunities turned ${nextState ? 'ON' : 'OFF'}`)
    } catch (err) {
      showToast(err.message || 'Failed to update setting', 'error')
    } finally {
      setToggling(false)
    }
  }

  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    if (!formServiceType || !formAmount) {
      showToast('Please provide service type and estimated amount', 'error')
      return
    }

    setSubmitting(true)
    try {
      const res = await simulatedOpportunitiesApi.createOpportunity({
        serviceCategory: formCategory || 'General Service',
        categoryId: formCategoryId || undefined,
        serviceType: formServiceType,
        isAllZones,
        zoneIds: isAllZones ? [] : selectedZoneIds,
        location: { address: formLocation },
        serviceDate: formDate,
        serviceTime: formTime,
        estimatedAmount: Number(formAmount),
        notifyVendorCount: Number(formVendorCount),
        expiryMinutes: Number(formExpiryMinutes),
        priority: formPriority,
      })
      showToast(res.message || 'Simulated opportunity sent successfully!')
      setShowCreateModal(false)
      // Reset form
      setFormServiceType('')
      setFormAmount('799')
      loadData()
    } catch (err) {
      showToast(err.message || 'Failed to create simulated opportunity', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancelOpportunity = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this simulated opportunity?')) return
    setCancellingId(id)
    try {
      await simulatedOpportunitiesApi.cancelOpportunity(id)
      showToast('Opportunity cancelled successfully.')
      loadData()
      if (detailItem?._id === id) {
        setDetailItem((prev) => ({ ...prev, status: 'CANCELLED' }))
      }
    } catch (err) {
      showToast(err.message || 'Failed to cancel opportunity', 'error')
    } finally {
      setCancellingId(null)
    }
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast.message && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className={`fixed left-4 right-4 top-20 z-[400] mx-auto flex max-w-md items-center gap-2 rounded-2xl border px-4 py-3 text-sm font-bold shadow-xl ${
              toast.variant === 'error'
                ? 'border-rose-200 bg-rose-50 text-rose-800'
                : 'border-emerald-200 bg-emerald-50 text-emerald-800'
            }`}
          >
            {toast.variant === 'error' ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <CheckCircle2 className="h-4 w-4 shrink-0" />}
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Banner & Global Toggle */}
      <GlassPanel className="p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 ring-1 ring-amber-500/20">
              <Radio className="h-6 w-6 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-black text-slate-900">Simulated Opportunity Alerts</h1>
                <span className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'}`}>
                  {enabled ? 'Status: ON 🟢' : 'Status: OFF 🔴'}
                </span>
              </div>
              <p className="mt-1 text-xs text-slate-500 max-w-xl">
                Send controlled simulated booking opportunities to vendors to boost engagement without affecting real bookings, payments, or commission logs.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={toggling}
              onClick={handleToggleGlobal}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition ${
                enabled
                  ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              {toggling ? <Loader2 className="h-4 w-4 animate-spin" /> : enabled ? <Ban className="h-4 w-4" /> : <Check className="h-4 w-4" />}
              {enabled ? 'Disable System' : 'Enable System'}
            </button>

            <button
              type="button"
              disabled={!enabled}
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-xs font-extrabold text-white shadow-md shadow-brand/20 transition hover:bg-brand/90 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Create Simulated Opportunity
            </button>
          </div>
        </div>
      </GlassPanel>

      {/* Filter Tabs & Refresh */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto rounded-2xl bg-slate-100 p-1">
          {['ALL', 'OPEN', 'ACCEPTED', 'EXPIRED', 'CANCELLED'].map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setSelectedStatus(st)}
              className={`rounded-xl px-3.5 py-1.5 text-xs font-bold transition ${
                selectedStatus === st
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={loadData}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* Opportunities List / Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
        </div>
      ) : opportunities.length === 0 ? (
        <GlassPanel className="p-12 text-center border-dashed">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 mb-3">
            <Radio className="h-6 w-6" />
          </div>
          <h3 className="text-sm font-bold text-slate-800">No Simulated Opportunities Found</h3>
          <p className="mt-1 text-xs text-slate-500">
            {selectedStatus === 'ALL'
              ? 'Click "Create Simulated Opportunity" above to send alerts to eligible vendors.'
              : `No opportunities with status ${selectedStatus}.`}
          </p>
        </GlassPanel>
      ) : (
        <div className="space-y-3">
          {opportunities.map((item) => {
            const shortCode = String(item._id).slice(-6).toUpperCase()
            const isWinner = item.status === 'ACCEPTED' && item.acceptedBy
            const viewCount = item.vendorResponses?.filter((r) => r.response === 'VIEWED').length || 0
            const rejectCount = item.vendorResponses?.filter((r) => r.response === 'REJECTED').length || 0

            return (
              <GlassPanel key={item._id} className="p-4 transition hover:shadow-md border-slate-200/80">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 font-black text-xs">
                      #{shortCode}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-extrabold text-slate-900 truncate">
                          {item.serviceType}
                        </h4>
                        <span className="text-xs font-semibold text-slate-500">
                          ({item.serviceCategory})
                        </span>
                        <StatusBadge status={item.status} />
                        {item.priority && item.priority !== 'NORMAL' && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-amber-100 text-amber-800">
                            {item.priority}
                          </span>
                        )}
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1 font-bold text-slate-700">
                          <IndianRupee className="h-3.5 w-3.5 text-blue-600" />
                          {formatInr(item.estimatedAmount)}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-slate-400" />
                          {item.location?.address || 'City Area'}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3.5 w-3.5 text-slate-400" />
                          Notified: {item.targetVendorCount || item.notifiedVendors?.length || 0}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-slate-400" />
                          Expires: {formatDate(item.expiresAt)}
                        </span>
                      </div>

                      {/* Winner or responses snapshot */}
                      {isWinner ? (
                        <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 border border-emerald-200">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                          Won by: {item.acceptedBy?.fullName || item.acceptedBy?.phone || 'Vendor'} ({formatDate(item.acceptedAt)})
                        </div>
                      ) : (
                        <div className="mt-1.5 flex items-center gap-2 text-[11px] font-semibold text-slate-500">
                          <span>👁️ Viewed: {viewCount}</span>
                          <span>•</span>
                          <span>🚫 Rejected: {rejectCount}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    <button
                      type="button"
                      onClick={() => setDetailItem(item)}
                      className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Details
                    </button>

                    {item.status === 'OPEN' && (
                      <button
                        type="button"
                        disabled={cancellingId === item._id}
                        onClick={() => handleCancelOpportunity(item._id)}
                        className="flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
                      >
                        {cancellingId === item._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Ban className="h-3.5 w-3.5" />}
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </GlassPanel>
            )
          })}
        </div>
      )}

      {/* CREATE MODAL */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-[350] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-[2rem] bg-white shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 p-6 pb-4 shrink-0 bg-white">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-brand/10 text-brand">
                    <Zap className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      Create Simulated Opportunity
                    </h3>
                    <p className="text-xs text-slate-500">
                      Broadcast realistic alert to engage workforce
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Scrollable Form Body */}
              <form onSubmit={handleCreateSubmit} className="flex-1 min-h-0 flex flex-col">
                <div className="flex-1 min-h-0 overflow-y-auto p-6 pt-4 space-y-4 overscroll-contain">
                {/* Category Selection */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-1 block">
                    Service Category
                  </label>
                  <select
                    value={formCategoryId}
                    onChange={(e) => {
                      const cid = e.target.value
                      setFormCategoryId(cid)
                      const found = categoryTree.find((c) => String(c._id) === cid)
                      if (found) setFormCategory(found.name)
                    }}
                    className="w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold outline-none focus:border-brand"
                  >
                    <option value="">-- Choose Category or Enter Custom --</option>
                    {categoryTree.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Service Type / Title */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-1 block">
                    Service Name / Type *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. AC Repair & Service, Deep Cleaning"
                    value={formServiceType}
                    onChange={(e) => setFormServiceType(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold outline-none focus:border-brand"
                  />
                </div>

                {/* Operational Zone Selection (All Zones & Multi-Zone Support) */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600">
                      Operational Zone / City Target
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setIsAllZones(true)
                          setSelectedZoneIds(zones.map((z) => z._id))
                          setFormLocation('All Operational Zones')
                        }}
                        className={`text-[11px] font-extrabold px-2.5 py-1 rounded-lg transition ${
                          isAllZones
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        🌐 Select All Zones
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setIsAllZones(false)
                          setSelectedZoneIds([])
                          setFormLocation('')
                        }}
                        className="text-[11px] font-bold text-slate-500 hover:text-slate-800 underline"
                      >
                        Clear
                      </button>
                    </div>
                  </div>

                  {/* Multi-Zone Selection Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2.5 rounded-2xl bg-slate-50 border border-slate-200/80">
                    <button
                      type="button"
                      onClick={() => {
                        const nextAll = !isAllZones
                        setIsAllZones(nextAll)
                        if (nextAll) {
                          setSelectedZoneIds(zones.map((z) => z._id))
                          setFormLocation('All Operational Zones')
                        } else {
                          setSelectedZoneIds([])
                          setFormLocation('')
                        }
                      }}
                      className={`flex items-center justify-between p-2.5 rounded-xl text-xs font-bold text-left transition border ${
                        isAllZones
                          ? 'bg-blue-50 border-blue-400 text-blue-900 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <span className="flex items-center gap-1.5 truncate">
                        <span>🌐</span>
                        <span>All Zones (Everywhere)</span>
                      </span>
                      {isAllZones && <Check className="h-4 w-4 text-blue-600 shrink-0" />}
                    </button>

                    {zones.map((z) => {
                      const isSelected = isAllZones || selectedZoneIds.includes(z._id)
                      return (
                        <button
                          key={z._id}
                          type="button"
                          onClick={() => {
                            let nextSelected = []
                            if (isAllZones) {
                              setIsAllZones(false)
                              nextSelected = zones.map((zone) => zone._id).filter((id) => id !== z._id)
                            } else if (selectedZoneIds.includes(z._id)) {
                              nextSelected = selectedZoneIds.filter((id) => id !== z._id)
                            } else {
                              nextSelected = [...selectedZoneIds, z._id]
                            }

                            setSelectedZoneIds(nextSelected)
                            if (nextSelected.length === zones.length && zones.length > 0) {
                              setIsAllZones(true)
                              setFormLocation('All Operational Zones')
                            } else {
                              setIsAllZones(false)
                              const selectedObj = zones.filter((zone) => nextSelected.includes(zone._id))
                              setFormLocation(selectedObj.map((zone) => formatZoneLocation(zone)).join(', '))
                            }
                          }}
                          className={`flex items-center justify-between p-2.5 rounded-xl text-xs font-bold text-left transition border ${
                            isSelected
                              ? 'bg-amber-50 border-amber-400 text-amber-900 shadow-xs'
                              : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <span className="truncate pr-1">📍 {formatZoneDisplay(z)}</span>
                          {isSelected && <Check className="h-4 w-4 text-amber-600 shrink-0" />}
                        </button>
                      )
                    })}
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-500 font-medium px-1">
                    <span>
                      {isAllZones
                        ? '🟢 Alert will broadcast across ALL operational zones'
                        : `${selectedZoneIds.length} zone(s) selected for broadcast`}
                    </span>
                    {selectedZoneIds.length > 0 && !isAllZones && (
                      <span className="text-amber-700 font-bold">Multi-Zone Filter Active</span>
                    )}
                  </div>
                </div>

                {/* Specific Location / Address */}
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-1 block">
                    Specific Location / Address Text *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Vijay Nagar, Scheme 54, Indore"
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold outline-none focus:border-brand"
                  />
                  <p className="text-[11px] text-slate-400 mt-1 font-medium">
                    Auto-populated based on selected zone(s), or enter a custom address note.
                  </p>
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-1 block">
                      Preferred Date
                    </label>
                    <input
                      type="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold outline-none focus:border-brand"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-1 block">
                      Preferred Time
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 5:00 PM"
                      value={formTime}
                      onChange={(e) => setFormTime(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold outline-none focus:border-brand"
                    />
                  </div>
                </div>

                {/* Amount & Vendor Count */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-1 block">
                      Estimated Earning (₹) *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      placeholder="e.g. 799"
                      value={formAmount}
                      onChange={(e) => setFormAmount(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold outline-none focus:border-brand"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-1 block">
                      Notify Vendors Count
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      value={formVendorCount}
                      onChange={(e) => setFormVendorCount(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold outline-none focus:border-brand"
                    />
                  </div>
                </div>

                {/* Expiry Minutes & Priority */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-1 block">
                      Expires After (Minutes)
                    </label>
                    <select
                      value={formExpiryMinutes}
                      onChange={(e) => setFormExpiryMinutes(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold outline-none focus:border-brand"
                    >
                      <option value="5">5 Minutes</option>
                      <option value="10">10 Minutes</option>
                      <option value="15">15 Minutes</option>
                      <option value="30">30 Minutes</option>
                      <option value="60">1 Hour</option>
                      <option value="120">2 Hours</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-1 block">
                      Priority
                    </label>
                    <select
                      value={formPriority}
                      onChange={(e) => setFormPriority(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 p-3 text-sm font-semibold outline-none focus:border-brand"
                    >
                      <option value="NORMAL">Normal</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent ⚡</option>
                    </select>
                  </div>
                </div>

                </div>

                {/* Actions Footer */}
                <div className="p-6 pt-3 border-t border-slate-100 shrink-0 bg-white flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center gap-2 rounded-xl bg-brand px-6 py-2.5 text-xs font-extrabold text-white shadow-lg shadow-brand/20 transition hover:bg-brand/90 disabled:opacity-50"
                  >
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radio className="h-4 w-4" />}
                    {submitting ? 'Sending Alert...' : 'Send Alert Now'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* DETAILS MODAL */}
      <AnimatePresence>
        {detailItem && (
          <div className="fixed inset-0 z-[350] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-lg rounded-[2rem] bg-white shadow-2xl border border-slate-100 max-h-[90vh] flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 p-6 pb-4 shrink-0 bg-white">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    Opportunity #{String(detailItem._id).slice(-6).toUpperCase()}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Created at {formatDate(detailItem.createdAt)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDetailItem(null)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Scrollable Body */}
              <div className="flex-1 min-h-0 overflow-y-auto p-6 pt-4 space-y-4 overscroll-contain">
                <div className="rounded-2xl bg-slate-50 p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Service:</span>
                    <span className="font-bold text-slate-900">{detailItem.serviceType} ({detailItem.serviceCategory})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Estimated Amount:</span>
                    <span className="font-bold text-blue-700">{formatInr(detailItem.estimatedAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Location:</span>
                    <span className="font-bold text-slate-900">{detailItem.location?.address}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Status:</span>
                    <StatusBadge status={detailItem.status} />
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-medium">Expires At:</span>
                    <span className="font-semibold text-slate-700">{formatDate(detailItem.expiresAt)}</span>
                  </div>
                </div>

                {/* Accepted By */}
                {detailItem.status === 'ACCEPTED' && detailItem.acceptedBy && (
                  <div className="rounded-2xl bg-emerald-50 border border-emerald-200 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-800 mb-1">
                      Secured By Vendor
                    </p>
                    <p className="text-sm font-black text-emerald-950">
                      {detailItem.acceptedBy?.fullName || 'Vendor'}
                    </p>
                    <p className="text-xs font-semibold text-emerald-700">
                      Phone: {detailItem.acceptedBy?.phone || '—'} · Won at: {formatDate(detailItem.acceptedAt)}
                    </p>
                  </div>
                )}

                {/* Vendor Responses List */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                    Vendor Activity Logs ({detailItem.vendorResponses?.length || 0})
                  </h4>
                  {(!detailItem.vendorResponses || detailItem.vendorResponses.length === 0) ? (
                    <p className="text-xs text-slate-400 italic">No responses recorded yet.</p>
                  ) : (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {detailItem.vendorResponses.map((r, i) => (
                        <div key={i} className="flex items-center justify-between text-xs p-2.5 rounded-xl border border-slate-100 bg-slate-50/50">
                          <span className="font-bold text-slate-700">
                            {r.vendorId?.fullName || r.vendorId?.phone || 'Vendor'}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                              r.response === 'REJECTED' ? 'bg-rose-100 text-rose-700' : 'bg-slate-200 text-slate-700'
                            }`}>
                              {r.response}
                            </span>
                            <span className="text-slate-400 text-[10px]">
                              {formatDate(r.respondedAt)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="p-6 pt-3 border-t border-slate-100 shrink-0 bg-white flex justify-end">
                <button
                  type="button"
                  onClick={() => setDetailItem(null)}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
