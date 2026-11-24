import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package,
  Clock,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Plus,
  ArrowRight,
  ShieldAlert,
  ChevronRight,
  XCircle,
  RefreshCw,
  Boxes,
  ClipboardList,
  Wrench,
  Sparkles,
  Info,
  Check,
  AlertCircle,
} from 'lucide-react'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { AppStackScreenHeader } from '../../components/app/AppStackScreenHeader.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import { bookingsApi } from '../../api/bookingsApi.js'
import {
  fetchVendorMaterialRequests,
  fetchVendorMaterialRequestById,
  createVendorMaterialRequest,
  requestAdditionalMaterial,
  recordMaterialUsage,
  fetchProducts,
  fetchBookingMaterialOptions,
} from '../../api/inventoryApi.js'

export function VendorMaterialsPage() {
  const [activeTab, setActiveTab] = useState('requests')
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [toastMsg, setToastMsg] = useState('')

  // Modals
  const [usageModalReq, setUsageModalReq] = useState(null)
  const [additionalModalReq, setAdditionalModalReq] = useState(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const presetBookingId = searchParams.get('newRequest') || ''
  const [newRequestOpen, setNewRequestOpen] = useState(Boolean(presetBookingId))
  const [availableProducts, setAvailableProducts] = useState([])

  const showToast = (msg) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 4000)
  }

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetchVendorMaterialRequests({ limit: 50 })
      setRequests(res?.requests || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadRequests()
    fetchProducts({ limit: 50, status: 'active' }).then((res) => {
      setAvailableProducts(res?.products || [])
    }).catch(console.error)
  }, [loadRequests])

  const pendingCollection = requests.filter((r) =>
    ['REQUESTED', 'APPROVED', 'WAITING_FOR_STOCK', 'READY_FOR_ISSUE', 'PARTIALLY_ISSUED'].includes(r.status)
  )

  const activeHeld = requests.filter((r) =>
    ['ISSUED', 'PARTIALLY_ISSUED', 'IN_USE'].includes(r.status)
  )

  const usagePending = requests.filter((r) =>
    ['ISSUED', 'PARTIALLY_ISSUED', 'IN_USE'].includes(r.status)
  )

  const history = requests.filter((r) =>
    ['COMPLETED', 'RETURNED', 'REJECTED', 'CANCELLED'].includes(r.status)
  )

  const handleQuickRequest = async (bookingId) => {
    try {
      await createVendorMaterialRequest({ bookingId })
      showToast('Material request submitted to admin for approval')
      loadRequests()
    } catch (err) {
      alert(err.message || 'Failed to submit request')
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-3 pb-8 pt-1 sm:px-6 animate-in fade-in duration-300">
      <AppStackScreenHeader title="Materials & Inventory" backTo="/serviceprovider" />

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-5 right-5 z-50 flex items-center gap-2.5 rounded-2xl bg-slate-900 px-4 py-3 text-xs font-bold text-white shadow-2xl ring-1 ring-white/20"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-slate-900 via-indigo-950 to-blue-900 p-6 text-white shadow-xl">
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-cyan-300">
              <Package className="h-4 w-4" />
              <span>Service Provider Materials & Inventory</span>
            </div>
            <h1 className="mt-1 text-xl font-black text-white sm:text-2xl">
              Job Materials & Central Stock
            </h1>
            <p className="mt-1 text-xs text-slate-300">
              Collect required products before visiting users, record material usage, and return unused items.
            </p>
          </div>

          <div className="flex items-center gap-2">
          <button
            onClick={() => setNewRequestOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-900 shadow-sm hover:bg-slate-100 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            New Request
          </button>
          <button
            onClick={loadRequests}
            className="rounded-xl border border-white/20 bg-white/10 p-2 text-white hover:bg-white/20 active:scale-95"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          </div>
        </div>

        {/* Quick Tabs Grid */}
        <div className="relative z-10 mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <button
            onClick={() => setActiveTab('requests')}
            className={`rounded-2xl p-3 text-left transition ${
              activeTab === 'requests' ? 'bg-white text-slate-900 shadow-md font-bold' : 'bg-white/10 text-white hover:bg-white/15'
            }`}
          >
            <div className="text-[10px] font-semibold uppercase tracking-wider opacity-75">Pending Collection</div>
            <div className="mt-1 text-lg font-black">{pendingCollection.length}</div>
          </button>

          <button
            onClick={() => setActiveTab('active')}
            className={`rounded-2xl p-3 text-left transition ${
              activeTab === 'active' ? 'bg-white text-slate-900 shadow-md font-bold' : 'bg-white/10 text-white hover:bg-white/15'
            }`}
          >
            <div className="text-[10px] font-semibold uppercase tracking-wider opacity-75">My Held Stock</div>
            <div className="mt-1 text-lg font-black">{activeHeld.length}</div>
          </button>

          <button
            onClick={() => setActiveTab('usage')}
            className={`rounded-2xl p-3 text-left transition ${
              activeTab === 'usage' ? 'bg-white text-slate-900 shadow-md font-bold' : 'bg-white/10 text-white hover:bg-white/15'
            }`}
          >
            <div className="text-[10px] font-semibold uppercase tracking-wider opacity-75">Record Usage & Return</div>
            <div className="mt-1 text-lg font-black">{usagePending.length}</div>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`rounded-2xl p-3 text-left transition ${
              activeTab === 'history' ? 'bg-white text-slate-900 shadow-md font-bold' : 'bg-white/10 text-white hover:bg-white/15'
            }`}
          >
            <div className="text-[10px] font-semibold uppercase tracking-wider opacity-75">Past History</div>
            <div className="mt-1 text-lg font-black">{history.length}</div>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <GlassPanel className="p-12 text-center text-slate-400">
          <RefreshCw className="mx-auto h-6 w-6 animate-spin text-slate-400" />
          <p className="mt-2 text-xs">Loading material requirements...</p>
        </GlassPanel>
      ) : activeTab === 'requests' ? (
        <PendingCollectionSection
          requests={pendingCollection}
          onRequest={handleQuickRequest}
          onOpenAdditional={(req) => setAdditionalModalReq(req)}
        />
      ) : activeTab === 'active' ? (
        <ActiveHeldMaterialsSection
          requests={activeHeld}
          onOpenUsage={(req) => setUsageModalReq(req)}
        />
      ) : activeTab === 'usage' ? (
        <MaterialUsageSection
          requests={usagePending}
          onOpenUsage={(req) => setUsageModalReq(req)}
        />
      ) : (
        <MaterialHistorySection requests={history} />
      )}

      {/* Record Usage & Return Modal */}
      {usageModalReq && (
        <RecordUsageModal
          request={usageModalReq}
          onClose={() => setUsageModalReq(null)}
          onSuccess={() => {
            setUsageModalReq(null)
            loadRequests()
            showToast('Material usage and central return recorded successfully')
          }}
        />
      )}

      {/* New Material Request Modal */}
      {newRequestOpen && (
        <NewMaterialRequestModal
          products={availableProducts}
          initialBookingId={presetBookingId}
          onClose={() => {
            setNewRequestOpen(false)
            if (presetBookingId) setSearchParams({}, { replace: true })
          }}
          onSuccess={() => {
            setNewRequestOpen(false)
            if (presetBookingId) setSearchParams({}, { replace: true })
            loadRequests()
            showToast('Material request submitted to admin for approval')
          }}
        />
      )}

      {/* Additional Material Request Modal */}
      {additionalModalReq && (
        <RequestAdditionalMaterialModal
          request={additionalModalReq}
          products={availableProducts}
          onClose={() => setAdditionalModalReq(null)}
          onSuccess={() => {
            setAdditionalModalReq(null)
            loadRequests()
            showToast('Additional material request submitted to admin')
          }}
        />
      )}
    </div>
  )
}

function PendingCollectionSection({ requests, onRequest, onOpenAdditional }) {
  if (requests.length === 0) {
    return (
      <GlassPanel className="p-12 text-center text-slate-400">
        <Boxes className="mx-auto h-10 w-10 text-slate-300" />
        <h3 className="mt-2 text-sm font-bold text-slate-700">No Pending Material Collections</h3>
        <p className="text-xs text-slate-500">
          When you receive bookings that require materials, they will appear here for collection.
        </p>
      </GlassPanel>
    )
  }

  return (
    <div className="space-y-4">
      {requests.map((req) => {
        const isWaiting = req.status === 'WAITING_FOR_STOCK'
        const hasOutStock = req.items?.some((i) => i.itemStatus === 'OUT_OF_STOCK')

        return (
          <GlassPanel key={req._id} className="p-4 space-y-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-indigo-600">
                    REQ: {req.requestId}
                  </span>
                  <VendorStatusBadge status={req.status} />
                </div>
                <h3 className="mt-1 text-sm font-bold text-slate-900">
                  {req.serviceId?.name || 'Service Job'}
                </h3>
                <p className="text-[11px] text-slate-500">
                  Booking #{req.bookingId?._id ? String(req.bookingId._id).slice(-6).toUpperCase() : '—'} • Location:{' '}
                  <span className="font-medium text-slate-700">{req.bookingId?.address?.locationText || 'Service Address'}</span>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onOpenAdditional(req)}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 shadow-xs hover:bg-slate-50"
                >
                  + Request Extra Material
                </button>
              </div>
            </div>

            {/* Out-of-Stock Warning Notice (Section 24A & 24M) */}
            {(isWaiting || hasOutStock) && (
              <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900">
                <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
                <div className="space-y-0.5">
                  <span className="font-bold">⚠️ Material Unavailable / Stock Shortage</span>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Some materials for this job are currently being replenished by the admin. You cannot collect unavailable items until stock is restocked or an alternative is issued by admin.
                  </p>
                </div>
              </div>
            )}

            {/* Materials List */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Required Materials for Job
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {req.items?.map((item, idx) => {
                  const isOut = item.itemStatus === 'OUT_OF_STOCK'
                  return (
                    <div
                      key={idx}
                      className={`flex items-center justify-between rounded-xl border p-3 text-xs ${
                        isOut ? 'border-rose-200 bg-rose-50/60' : 'border-slate-200 bg-slate-50/70'
                      }`}
                    >
                      <div>
                        <div className="font-bold text-slate-900">{item.productId?.name || 'Material Item'}</div>
                        <div className="text-[11px] text-slate-500">
                          Required: <b className="text-slate-800">{item.quantityRequired} {item.unit}</b>
                        </div>
                        {item.alternativeIssuedProductId && (
                          <div className="text-[10px] font-bold text-purple-700">
                            Substituted: {item.alternativeIssuedProductId.name}
                          </div>
                        )}
                      </div>

                      <div className="text-right">
                        {isOut ? (
                          <span className="rounded-md bg-rose-100 px-2 py-0.5 text-[10px] font-black text-rose-700">
                            WAITING STOCK
                          </span>
                        ) : (
                          <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                            Issued: {item.quantityIssued || 0} / {item.quantityRequired}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </GlassPanel>
        )
      })}
    </div>
  )
}

function ActiveHeldMaterialsSection({ requests, onOpenUsage }) {
  if (requests.length === 0) {
    return (
      <GlassPanel className="p-12 text-center text-slate-400">
        <Package className="mx-auto h-10 w-10 text-slate-300" />
        <h3 className="mt-2 text-sm font-bold text-slate-700">No Active Materials Currently Held</h3>
        <p className="text-xs text-slate-500">
          Materials issued to you by the admin for ongoing jobs will appear here.
        </p>
      </GlassPanel>
    )
  }

  return (
    <div className="space-y-4">
      {requests.map((req) => (
        <GlassPanel key={req._id} className="p-4 space-y-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-indigo-600">REQ: {req.requestId}</span>
                <VendorStatusBadge status={req.status} />
              </div>
              <h3 className="mt-1 text-sm font-bold text-slate-900">{req.serviceId?.name || 'Service Job'}</h3>
              <p className="text-[11px] text-slate-500">
                Booking #{req.bookingId?._id ? String(req.bookingId._id).slice(-6).toUpperCase() : '—'}
              </p>
            </div>

            <button
              type="button"
              onClick={() => onOpenUsage(req)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-indigo-700 active:scale-95"
            >
              <RotateCcw className="h-4 w-4" />
              <span>Record Usage & Return</span>
            </button>
          </div>

          <div className="space-y-2">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Materials in Your Possession
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {req.items?.map((item, idx) => {
                const prod = item.alternativeIssuedProductId || item.productId
                const remaining = (item.quantityIssued || 0) - (item.quantityUsed || 0) - (item.quantityReturned || 0)
                return (
                  <div key={idx} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
                    <div>
                      <div className="font-bold text-slate-900">{prod?.name || 'Material Item'}</div>
                      <div className="text-[11px] text-slate-500">
                        Issued: {item.quantityIssued} {item.unit}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-black text-emerald-800">
                        Held: {Math.max(0, remaining)} {item.unit}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </GlassPanel>
      ))}
    </div>
  )
}

function MaterialUsageSection({ requests, onOpenUsage }) {
  if (requests.length === 0) {
    return (
      <GlassPanel className="p-12 text-center text-slate-400">
        <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-400" />
        <h3 className="mt-2 text-sm font-bold text-slate-700">All Material Usages Recorded</h3>
        <p className="text-xs text-slate-500">
          No pending jobs needing material reconciliation.
        </p>
      </GlassPanel>
    )
  }

  return (
    <div className="space-y-4">
      {requests.map((req) => (
        <GlassPanel key={req._id} className="p-4 space-y-3 sm:p-5">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-mono text-xs font-bold text-indigo-600">REQ: {req.requestId}</span>
              <h3 className="text-sm font-bold text-slate-900">{req.serviceId?.name}</h3>
            </div>
            <button
              onClick={() => onOpenUsage(req)}
              className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700"
            >
              Record Used & Returned
            </button>
          </div>
        </GlassPanel>
      ))}
    </div>
  )
}

function MaterialHistorySection({ requests }) {
  if (requests.length === 0) {
    return (
      <GlassPanel className="p-12 text-center text-slate-400">
        <ClipboardList className="mx-auto h-10 w-10 text-slate-300" />
        <h3 className="mt-2 text-sm font-bold text-slate-700">No Past Material History</h3>
      </GlassPanel>
    )
  }

  return (
    <div className="space-y-3">
      {requests.map((req) => (
        <GlassPanel key={req._id} className="p-4 text-xs space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <span className="font-mono font-bold text-slate-900">{req.requestId}</span>
              <div className="text-[11px] font-semibold text-slate-600">{req.serviceId?.name}</div>
            </div>
            <VendorStatusBadge status={req.status} />
          </div>
          <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
            {req.items?.map((i, idx) => (
              <span key={idx} className="rounded-md bg-slate-100 px-2 py-0.5">
                {i.productId?.name}: Used {i.quantityUsed || 0}, Ret {i.quantityReturned || 0}
              </span>
            ))}
          </div>
        </GlassPanel>
      ))}
    </div>
  )
}

function VendorStatusBadge({ status }) {
  const MAP = {
    REQUESTED: { bg: 'bg-blue-100 text-blue-800', label: 'Requested' },
    APPROVED: { bg: 'bg-indigo-100 text-indigo-800', label: 'Approved' },
    READY_FOR_ISSUE: { bg: 'bg-teal-100 text-teal-800', label: 'Ready for Collection' },
    WAITING_FOR_STOCK: { bg: 'bg-amber-100 text-amber-800', label: 'Waiting for Admin Stock' },
    PARTIALLY_ISSUED: { bg: 'bg-sky-100 text-sky-800', label: 'Partially Issued' },
    ISSUED: { bg: 'bg-emerald-100 text-emerald-800', label: 'Issued / In Possession' },
    IN_USE: { bg: 'bg-cyan-100 text-cyan-800', label: 'In Use on Job' },
    COMPLETED: { bg: 'bg-slate-100 text-slate-800', label: 'Completed' },
    RETURNED: { bg: 'bg-purple-100 text-purple-800', label: 'Returned to Admin' },
    REJECTED: { bg: 'bg-rose-100 text-rose-800', label: 'Rejected' },
  }

  const s = MAP[status] || { bg: 'bg-slate-100 text-slate-600', label: status }
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${s.bg}`}>
      {s.label}
    </span>
  )
}

function RecordUsageModal({ request, onClose, onSuccess }) {
  const [itemsUsage, setItemsUsage] = useState(() =>
    (request.items || []).map((i) => {
      const issued = i.quantityIssued || 0
      return {
        itemId: i._id,
        productName: i.alternativeIssuedProductId?.name || i.productId?.name || 'Item',
        unit: i.unit,
        quantityIssued: issued,
        usedQuantity: issued,
        returnedQuantity: 0,
      }
    })
  )

  const [remarks, setRemarks] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const handleUsageChange = (idx, field, val) => {
    const copy = [...itemsUsage]
    const num = Math.max(0, Number(val) || 0)
    copy[idx][field] = num

    // Auto calculate return if used is modified
    if (field === 'usedQuantity') {
      const issued = copy[idx].quantityIssued
      if (num <= issued) {
        copy[idx].returnedQuantity = issued - num
      }
    }
    setItemsUsage(copy)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    // Validate
    for (const item of itemsUsage) {
      if (item.usedQuantity > item.quantityIssued) {
        setError(`Used quantity for ${item.productName} cannot exceed issued quantity (${item.quantityIssued})`)
        return
      }
      if (item.returnedQuantity > item.quantityIssued - item.usedQuantity) {
        setError(`Returned quantity for ${item.productName} exceeds remaining unconsumed quantity`)
        return
      }
    }

    setBusy(true)
    try {
      await recordMaterialUsage(request._id, {
        itemsUsage,
        remarks,
      })
      onSuccess()
    } catch (err) {
      setError(err.message || 'Failed to record usage')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Record Job Material Usage & Returns</h3>
            <p className="text-xs text-slate-500">Service: {request.serviceId?.name}</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-3">
            {itemsUsage.map((item, idx) => (
              <div key={item.itemId} className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-900">{item.productName}</span>
                  <span className="font-mono font-bold text-blue-700">Total Issued: {item.quantityIssued} {item.unit}</span>
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700">Actually Used / Consumed</label>
                    <input
                      type="number"
                      min="0"
                      max={item.quantityIssued}
                      value={item.usedQuantity}
                      onChange={(e) => handleUsageChange(idx, 'usedQuantity', e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2 text-center text-xs font-bold text-slate-900 focus:border-blue-600"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700">Unused Returned to Admin</label>
                    <input
                      type="number"
                      min="0"
                      max={item.quantityIssued - item.usedQuantity}
                      value={item.returnedQuantity}
                      onChange={(e) => handleUsageChange(idx, 'returnedQuantity', e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-300 bg-white p-2 text-center text-xs font-bold text-emerald-700 focus:border-emerald-600"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700">Remarks / Usage Notes</label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Job completed smoothly, 1 cloth returned"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800 focus:bg-white"
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {busy ? 'Saving...' : 'Submit Usage & Returns'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function RequestAdditionalMaterialModal({ request, products, onClose, onSuccess }) {
  const [productId, setProductId] = useState(products[0]?._id || '')
  const [quantityRequested, setQuantityRequested] = useState(1)
  const [remarks, setRemarks] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!productId || Number(quantityRequested) <= 0) {
      setError('Please choose a valid product and quantity')
      return
    }
    setError('')
    setBusy(true)

    try {
      await requestAdditionalMaterial(request._id, {
        productId,
        quantityRequested: Number(quantityRequested),
        remarks,
      })
      onSuccess()
    } catch (err) {
      setError(err.message || 'Failed to submit additional request')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Request Additional Material</h3>
            <p className="text-xs text-slate-500">Requires Admin Approval</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700">Select Material Product *</label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-semibold text-slate-900 focus:bg-white"
            >
              {products.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} ({p.sku}) — Available: {p.currentStock} {p.unit}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700">Quantity Needed *</label>
            <input
              type="number"
              min="1"
              required
              value={quantityRequested}
              onChange={(e) => setQuantityRequested(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold text-slate-900 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700">Reason / Justification *</label>
            <textarea
              rows="2"
              required
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Unforeseen pipe leakage requires extra copper pipe"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:bg-white"
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? 'Submitting...' : 'Submit Request to Admin'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function NewMaterialRequestModal({ products, initialBookingId = '', onClose, onSuccess }) {
  const { user } = useAuth()
  const [bookings, setBookings] = useState([])
  const [loadingBookings, setLoadingBookings] = useState(true)
  const [bookingId, setBookingId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [remarks, setRemarks] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Materials required for the services this provider accepted on the selected booking
  const [services, setServices] = useState([])
  const [loadingMaterials, setLoadingMaterials] = useState(false)
  // Only used when the admin has not set any materials for the service
  const [manualLines, setManualLines] = useState([{ productId: '' }])

  useEffect(() => {
    let cancelled = false
    const myId = String(user?._id || user?.id || '')
    const idOf = (v) => String(v?._id || v || '')
    const isMine = (b) =>
      idOf(b.laborId) === myId ||
      idOf(b.acceptedLabourId) === myId ||
      (b.assignments || []).some((a) => idOf(a.labourId) === myId) ||
      (b.multiServiceBooking?.items || []).some((it) => idOf(it.assignedLabourId) === myId)
    const OPEN = ['ACCEPTED', 'ASSIGNED', 'EN_ROUTE', 'STARTED', 'PARTIALLY_ACCEPTED']

    Promise.all([
      bookingsApi.getMyBookings().catch(() => null),
      // When opened from a job, load that job directly so it is always selectable
      initialBookingId ? bookingsApi.getBookingStatus(initialBookingId).catch(() => null) : Promise.resolve(null),
    ])
      .then(([listRes, oneRes]) => {
        if (cancelled) return
        const all = listRes?.data?.bookings || listRes?.bookings || []
        const mine = all.filter((b) => OPEN.includes(b.status) && isMine(b))
        const loadedJob = oneRes?.data?.booking
        if (loadedJob && OPEN.includes(loadedJob.status) && !mine.some((b) => String(b._id) === String(loadedJob._id))) {
          mine.unshift(loadedJob)
        }
        setBookings(mine)
        const preset = initialBookingId && mine.find((b) => String(b._id) === String(initialBookingId))
        if (preset) setBookingId(preset._id)
        else if (mine[0]) setBookingId(mine[0]._id)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingBookings(false)
      })
    return () => {
      cancelled = true
    }
  }, [user, initialBookingId])

  useEffect(() => {
    if (!bookingId) {
      setServices([])
      return undefined
    }
    let cancelled = false
    setLoadingMaterials(true)
    fetchBookingMaterialOptions(bookingId)
      .then((data) => {
        if (!cancelled) setServices(data?.services || [])
      })
      .catch(() => {
        if (!cancelled) setServices([])
      })
      .finally(() => {
        if (!cancelled) setLoadingMaterials(false)
      })
    return () => {
      cancelled = true
    }
  }, [bookingId])

  const jobInfo = (b) => ({
    code: String(b._id).slice(-6).toUpperCase(),
    name:
      b.serviceId?.name ||
      b.serviceName ||
      b.multiServiceBooking?.items?.[0]?.serviceName ||
      b.packageBooking?.packageName ||
      'Service job',
    when: b.type === 'INSTANT' ? 'Instant booking' : b.scheduledAt ? 'Scheduled ' + new Date(b.scheduledAt).toLocaleString() : 'Scheduled booking',
    where: b.address?.locationText || '',
  })

  // One row per distinct product across the provider's services (quantities add up)
  const requiredMaterials = useMemo(() => {
    const byProduct = new Map()
    services.forEach((svc) => {
      svc.materials.forEach((m) => {
        const key = String(m._id)
        const prev = byProduct.get(key)
        if (prev) {
          prev.perUnitQty += Number(m.requiredQty) || 1
          if (!prev.serviceNames.includes(svc.serviceName)) prev.serviceNames.push(svc.serviceName)
        } else {
          byProduct.set(key, { ...m, perUnitQty: Number(m.requiredQty) || 1, serviceNames: [svc.serviceName] })
        }
      })
    })
    return [...byProduct.values()]
  }, [services])

  const hasRequired = requiredMaterials.length > 0
  const qty = Math.max(1, Number(quantity) || 0)

  // Catalogue for the manual fallback (distinct materials only)
  const uniqueProducts = useMemo(() => {
    const seen = new Set()
    return (products || []).filter((p) => {
      const key = [p.name, p.unit, p.currentStock].join('|').toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [products])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!bookingId) return setError('Select the job this material is for')
    if (!(Number(quantity) > 0)) return setError('Enter a quantity of 1 or more')

    const items = hasRequired
      ? requiredMaterials.map((m) => ({ productId: m._id, quantityRequested: m.perUnitQty * qty }))
      : manualLines.filter((l) => l.productId).map((l) => ({ productId: l.productId, quantityRequested: qty }))
    if (items.length === 0) return setError('Select at least one material')

    setError('')
    setBusy(true)
    try {
      await createVendorMaterialRequest({ bookingId, items, remarks })
      onSuccess()
    } catch (err) {
      setError(err.message || 'Failed to submit material request')
    } finally {
      setBusy(false)
    }
  }

  const multi = services.length > 1

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-3 backdrop-blur-xs sm:p-4">
      <div className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-md flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 pb-3 pt-5">
          <div>
            <h3 className="text-base font-bold text-slate-900">New Material Request</h3>
            <p className="text-xs text-slate-500">Requires Admin Approval</p>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-6 py-4">
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-slate-700">For which job? *</label>
            {loadingBookings ? (
              <p className="mt-1 text-xs text-slate-500">Loading your jobs...</p>
            ) : bookings.length === 0 ? (
              <p className="mt-1 rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800">
                You have no active job to request materials for. Accept a job first.
              </p>
            ) : (
              <div className="mt-1 space-y-2">
                {bookings.map((b) => {
                  const active = String(b._id) === String(bookingId)
                  const info = jobInfo(b)
                  return (
                    <button
                      key={b._id}
                      type="button"
                      onClick={() => setBookingId(b._id)}
                      className={`flex w-full items-start gap-3 rounded-xl border p-3 text-left transition ${
                        active ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200' : 'border-slate-200 bg-slate-50 hover:bg-white'
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                          active ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-300 bg-white'
                        }`}
                      >
                        {active && <Check className="h-3 w-3" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-xs font-bold text-slate-900">{info.name}</span>
                          <span className="shrink-0 rounded-md bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold text-indigo-600 ring-1 ring-slate-200">
                            #{info.code}
                          </span>
                        </span>
                        <span className="mt-0.5 block text-[11px] text-slate-500">
                          {info.when}
                          {info.where ? ` • ${info.where}` : ''}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          {bookingId && (
            <div>
              <label className="block text-xs font-bold text-slate-700">Quantity *</label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold text-slate-900 focus:bg-white"
              />
            </div>
          )}

          {bookingId && (
            <div className="space-y-2">
              <label className="block text-xs font-bold text-slate-700">Required materials</label>
              {loadingMaterials ? (
                <p className="text-[11px] text-slate-500">Loading required materials...</p>
              ) : hasRequired ? (
                <div className="space-y-3">
                  {services
                    .filter((svc) => svc.materials.length > 0)
                    .map((svc) => (
                      <div key={svc.serviceId} className="space-y-1.5">
                        {multi && <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{svc.serviceName}</p>}
                        {svc.materials.map((m) => {
                          const tone = stockTone(Number(m.currentStock) || 0)
                          const perUnit = Number(m.requiredQty) || 1
                          return (
                            <div
                              key={`${svc.serviceId}-${m._id}`}
                              className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                            >
                              <span className="min-w-0">
                                <span className="block truncate text-xs font-bold text-slate-900">{m.name}</span>
                                <span className="block text-[10px] text-slate-500">
                                  Needed: {perUnit * qty} {m.unit}
                                </span>
                              </span>
                              <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${tone.cls}`}>
                                {tone.label}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    ))}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800">
                    The admin has not set materials for {multi ? 'these services' : 'this service'} yet. Choose what you need from the list.
                  </p>
                  {manualLines.map((line, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <ProductPicker
                          products={uniqueProducts}
                          value={line.productId}
                          onChange={(id) =>
                            setManualLines((prev) => prev.map((l, i) => (i === idx ? { ...l, productId: id } : l)))
                          }
                        />
                      </div>
                      {manualLines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setManualLines((prev) => prev.filter((_, i) => i !== idx))}
                          className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"
                          aria-label="Remove material"
                        >
                          <XCircle className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setManualLines((prev) => [...prev, { productId: '' }])}
                    className="text-xs font-bold text-blue-600 hover:underline"
                  >
                    + Add another material
                  </button>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700">Remarks</label>
            <textarea
              rows="2"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Anything the admin should know about this request"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:bg-white"
            />
          </div>
        </div>

          <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-100 bg-white px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || bookings.length === 0 || loadingMaterials}
              className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50"
            >
              {busy ? 'Submitting...' : 'Submit Request to Admin'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function stockTone(stock) {
  if (stock <= 0) return { label: 'Out of stock', cls: 'bg-rose-50 text-rose-700 border-rose-200' }
  if (stock <= 5) return { label: 'Low stock', cls: 'bg-amber-50 text-amber-700 border-amber-200' }
  return { label: 'In stock', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
}

function ProductPicker({ products, value, onChange, jobMaterialIds = new Set(), categoryMaterialIds = new Set(), categoryLabel = '' }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selected = products.find((p) => p._id === value)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? products.filter((p) => `${p.name} ${p.sku || ''}`.toLowerCase().includes(q))
      : products
    // This job's materials first, then available items, out-of-stock last
    const rank = (p) =>
      jobMaterialIds.has(String(p._id)) ? 0 : categoryMaterialIds.has(String(p._id)) ? 1 : p.currentStock > 0 ? 2 : 3
    return [...list].sort((a, b) => rank(a) - rank(b))
  }, [products, query, jobMaterialIds, categoryMaterialIds])

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 p-2.5 text-left"
      >
        {selected ? (
          <span className="min-w-0">
            <span className="block truncate text-xs font-bold text-slate-900">{selected.name}</span>
            <span className="block text-[10px] text-slate-500">
              Available: {selected.currentStock} {selected.unit}
            </span>
          </span>
        ) : (
          <span className="text-xs font-semibold text-slate-500">Select material</span>
        )}
        <ChevronRight className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <div className="border-t border-slate-200 bg-white p-2">
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search material or SKU"
            className="mb-2 w-full rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-900 outline-none focus:border-blue-400 focus:bg-white"
          />
          <ul className="max-h-52 space-y-1 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-2 py-3 text-center text-xs text-slate-500">No materials found</li>
            ) : (
              filtered.map((p) => {
                const tone = stockTone(Number(p.currentStock) || 0)
                const active = p._id === value
                return (
                  <li key={p._id}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(p._id)
                        setOpen(false)
                        setQuery('')
                      }}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-left transition ${
                        active ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-slate-50'
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-xs font-bold text-slate-900">{p.name}</span>
                        <span className="block text-[10px] text-slate-500">
                          {p.sku ? `${p.sku} • ` : ''}
                          {p.currentStock} {p.unit} available
                        </span>
                      </span>
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        {jobMaterialIds.has(String(p._id)) ? (
                          <span className="rounded-full bg-blue-600 px-2 py-0.5 text-[10px] font-bold text-white">
                            For this job
                          </span>
                        ) : categoryMaterialIds.has(String(p._id)) ? (
                          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">
                            {categoryLabel || 'Category'}
                          </span>
                        ) : null}
                        <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${tone.cls}`}>
                          {tone.label}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </div>
      )}
    </div>
  )
}
