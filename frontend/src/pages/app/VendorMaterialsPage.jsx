import { useState, useEffect, useCallback } from 'react'
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
import {
  fetchVendorMaterialRequests,
  fetchVendorMaterialRequestById,
  createVendorMaterialRequest,
  requestAdditionalMaterial,
  recordMaterialUsage,
  fetchProducts,
} from '../../api/inventoryApi.js'

export function VendorMaterialsPage() {
  const [activeTab, setActiveTab] = useState('requests')
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [toastMsg, setToastMsg] = useState('')

  // Modals
  const [usageModalReq, setUsageModalReq] = useState(null)
  const [additionalModalReq, setAdditionalModalReq] = useState(null)
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
    <div className="mx-auto max-w-4xl space-y-5 px-3 py-4 sm:px-6 animate-in fade-in duration-300">
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

          <button
            onClick={loadRequests}
            className="rounded-xl border border-white/20 bg-white/10 p-2 text-white hover:bg-white/20 active:scale-95"
            title="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
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
