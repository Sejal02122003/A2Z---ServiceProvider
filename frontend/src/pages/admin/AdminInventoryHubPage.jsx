import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Package,
  Plus,
  Search,
  Filter,
  RefreshCw,
  AlertTriangle,
  Boxes,
  ClipboardCheck,
  Tag,
  Wrench,
  Users,
  BarChart3,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  TrendingDown,
  TrendingUp,
  RotateCcw,
  Edit2,
  Eye,
  Trash2,
  ShieldCheck,
  ChevronRight,
  AlertCircle,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
  Info,
  Check,
} from 'lucide-react'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { AppPrimaryButton } from '../../components/app/AppPrimaryButton.jsx'
import { SearchableSelect } from '../../components/ui/SearchableSelect.jsx'
import {
  fetchProducts,
  fetchProductById,
  createProduct,
  updateProduct,
  toggleProductStatus,
  fetchProductCategories,
  fetchAllServiceProductMappings,
  fetchServiceProductMappings,
  addServiceProductMapping,
  updateServiceProductMapping,
  deleteServiceProductMapping,
  fetchInventoryList,
  addInventoryStock,
  adjustInventoryStock,
  fetchLowStockProducts,
  fetchInventoryTransactions,
  fetchVendorInventory,
  fetchInventoryDashboardStats,
  fetchAdminMaterialRequests,
  fetchAdminMaterialRequestById,
  approveMaterialRequest,
  rejectMaterialRequest,
  issueMaterialsToVendor,
  markRequestWaitingStock,
} from '../../api/inventoryApi.js'
import { fetchAdminLabourCategoryTree } from '../../api/adminLabourCategoriesApi.js'

export function AdminInventoryHubPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') || 'products'

  const [stats, setStats] = useState(null)
  const [loadingStats, setLoadingStats] = useState(false)
  const [toastMsg, setToastMsg] = useState('')

  const showToast = (msg) => {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(''), 4000)
  }

  const loadStats = useCallback(async () => {
    try {
      setLoadingStats(true)
      const data = await fetchInventoryDashboardStats()
      setStats(data)
    } catch (err) {
      console.error('Failed to load inventory stats', err)
    } finally {
      setLoadingStats(false)
    }
  }, [])

  useEffect(() => {
    loadStats()
  }, [loadStats])

  const setTab = (tabKey) => {
    setSearchParams({ tab: tabKey })
  }

  const TABS = [
    { key: 'products', label: 'Products', icon: Tag, count: stats?.totalProducts },
    { key: 'service-materials', label: 'Service Materials', icon: Wrench },
    { key: 'material-requests', label: 'Material Requests', icon: ClipboardCheck, badge: stats?.pendingMaterialRequests },
    { key: 'stock', label: 'Stock Management', icon: Boxes },
    { key: 'vendor-inventory', label: 'Vendor Inventory', icon: Users },
    { key: 'transactions', label: 'Ledger Audit', icon: BarChart3 },
    { key: 'low-stock', label: 'Low Stock Alerts', icon: AlertTriangle, badge: stats?.lowStockProducts, badgeColor: 'bg-rose-500' },
  ]

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-16 animate-in fade-in duration-300">
      {/* Toast Notification */}
      <AnimatePresence>
        {toastMsg && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-6 right-6 z-50 flex items-center gap-3 rounded-2xl bg-slate-900 px-5 py-3.5 text-sm font-semibold text-white shadow-2xl ring-1 ring-white/20"
          >
            <CheckCircle2 className="h-5 w-5 text-emerald-400" />
            <span>{toastMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-slate-900 via-indigo-950 to-blue-900 p-6 text-white shadow-xl md:p-8">
        <div className="absolute top-0 right-0 -mt-10 -mr-10 h-64 w-64 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 -mb-10 h-48 w-48 rounded-full bg-indigo-500/10 blur-2xl" />

        <div className="relative z-10 flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-cyan-300">
              <Package className="h-4 w-4" />
              <span>Central Material & Inventory Management</span>
            </div>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-white md:text-3xl">
              Inventory Control & Material Ledger
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-slate-300">
              Manage central products, map service materials, approve vendor requests, track stock movements, handle shortages, and inspect the real-time inventory ledger.
            </p>
          </div>

          <button
            onClick={loadStats}
            disabled={loadingStats}
            className="inline-flex items-center gap-2 self-start rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold text-white backdrop-blur-md transition hover:bg-white/20 active:scale-95 disabled:opacity-50 md:self-auto"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loadingStats ? 'animate-spin' : ''}`} />
            Refresh Overview
          </button>
        </div>

        {/* Stats Grid */}
        <div className="relative z-10 mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          <StatMiniCard label="Total Products" value={stats?.totalProducts ?? '—'} tone="blue" />
          <StatMiniCard label="Active Items" value={stats?.activeProducts ?? '—'} tone="emerald" />
          <StatMiniCard label="Low Stock" value={stats?.lowStockProducts ?? '—'} alert={stats?.lowStockProducts > 0} tone="amber" />
          <StatMiniCard label="Pending Reqs" value={stats?.pendingMaterialRequests ?? '—'} alert={stats?.pendingMaterialRequests > 0} tone="purple" />
          <StatMiniCard label="Issued Today" value={stats?.materialsIssuedToday ?? 0} tone="cyan" />
          <StatMiniCard label="Used Today" value={stats?.materialsUsedToday ?? 0} tone="teal" />
          <StatMiniCard label="Returned Today" value={stats?.materialsReturnedToday ?? 0} tone="indigo" />
          <StatMiniCard label="Inventory Value" value={`₹${Number(stats?.totalInventoryValue || 0).toLocaleString('en-IN')}`} tone="gold" isCurrency />
        </div>
      </div>

      {/* Navigation Tabs Bar */}
      <div className="flex overflow-x-auto rounded-2xl border border-slate-200 bg-white/80 p-1.5 shadow-xs backdrop-blur-md scrollbar-none">
        <div className="flex min-w-full gap-1 sm:min-w-0">
          {TABS.map((tab) => {
            const Icon = tab.icon
            const active = activeTab === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setTab(tab.key)}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all ${
                  active
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`h-4 w-4 ${active ? 'text-cyan-400' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className={`ml-1 rounded-full px-2 py-0.5 text-[10px] font-black text-white ${tab.badgeColor || 'bg-cyan-500'}`}>
                    {tab.badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Tab Contents */}
      {activeTab === 'products' && <ProductsTab onReloadStats={loadStats} onToast={showToast} />}
      {activeTab === 'service-materials' && <ServiceMaterialsTab onToast={showToast} />}
      {activeTab === 'material-requests' && <MaterialRequestsTab onReloadStats={loadStats} onToast={showToast} />}
      {activeTab === 'stock' && <StockManagementTab onReloadStats={loadStats} onToast={showToast} />}
      {activeTab === 'vendor-inventory' && <VendorInventoryTab onToast={showToast} />}
      {activeTab === 'transactions' && <TransactionsTab />}
      {activeTab === 'low-stock' && <LowStockTab onReloadStats={loadStats} onToast={showToast} onSwitchToStock={() => setTab('stock')} />}
    </div>
  )
}

function StatMiniCard({ label, value, tone = 'blue', alert = false, isCurrency = false }) {
  return (
    <div className={`rounded-xl border border-white/10 bg-white/10 p-3 backdrop-blur-sm ${alert ? 'ring-2 ring-amber-400/70' : ''}`}>
      <div className="text-[11px] font-medium text-slate-300 truncate">{label}</div>
      <div className={`mt-1 font-black text-white ${isCurrency ? 'text-sm' : 'text-lg'}`}>
        {value}
      </div>
    </div>
  )
}

// ==========================================
// 1. PRODUCTS TAB
// ==========================================
function ProductsTab({ onReloadStats, onToast }) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('ALL')
  const [status, setStatus] = useState('all')
  const [stockStatus, setStockStatus] = useState('all')
  const [categories, setCategories] = useState([])

  const [modalOpen, setModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)
  const [viewProduct, setViewProduct] = useState(null)

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const [prodRes, cats] = await Promise.all([
        fetchProducts({ search, category, status, stockStatus, limit: 100 }),
        fetchProductCategories(),
      ])
      setProducts(prodRes?.products || [])
      setCategories(cats || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [search, category, status, stockStatus])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleToggle = async (id) => {
    try {
      await toggleProductStatus(id)
      onToast('Product status updated')
      loadData()
      onReloadStats()
    } catch (err) {
      alert(err.message || 'Failed to toggle status')
    }
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <GlassPanel className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1 max-w-xs">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search products, SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:border-brand focus:outline-hidden"
              />
            </div>

            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            <select
              value={stockStatus}
              onChange={(e) => setStockStatus(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
            >
              <option value="all">All Stock Levels</option>
              <option value="in_stock">In Stock</option>
              <option value="low_stock">Low Stock</option>
              <option value="out_of_stock">Out of Stock</option>
            </select>

            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
            >
              <option value="all">Active & Inactive</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>

          <button
            onClick={() => {
              setEditingProduct(null)
              setModalOpen(true)
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md transition hover:from-blue-700 hover:to-indigo-700 active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>Add New Product</span>
          </button>
        </div>
      </GlassPanel>

      {/* Table */}
      <GlassPanel className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3.5">Product & SKU</th>
                <th className="px-4 py-3.5">Category</th>
                <th className="px-4 py-3.5">Unit</th>
                <th className="px-4 py-3.5">Price / Cost</th>
                <th className="px-4 py-3.5 text-center">Current Stock</th>
                <th className="px-4 py-3.5 text-center">Min Stock</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    <RefreshCw className="mx-auto h-6 w-6 animate-spin text-slate-400" />
                    <p className="mt-2 text-xs">Loading products...</p>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan="8" className="py-12 text-center text-slate-400">
                    <Package className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-2 font-semibold">No products found</p>
                    <p className="text-[11px]">Add products or adjust filters</p>
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const isOut = p.currentStock <= 0
                  const isLow = !isOut && p.currentStock <= p.minimumStock
                  return (
                    <tr key={p._id} className="hover:bg-slate-50/60 transition">
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900">{p.name}</div>
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-600">
                          <span>SKU: {p.sku}</span>
                          {p.alternativeProductIds?.length > 0 && (
                            <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] text-indigo-700">
                              {p.alternativeProductIds.length} Alt
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-600">{p.category}</td>
                      <td className="px-4 py-3.5 font-medium text-slate-600">{p.unit}</td>
                      <td className="px-4 py-3.5 font-bold text-slate-800">₹{p.price}</td>
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black ${
                            isOut
                              ? 'bg-rose-100 text-rose-700'
                              : isLow
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {p.currentStock} {p.unit}
                          {isOut && ' (OUT)'}
                          {isLow && ' (LOW)'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center font-semibold text-slate-500">{p.minimumStock}</td>
                      <td className="px-4 py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggle(p._id)}
                          className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase transition ${
                            p.isActive
                              ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          {p.isActive ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setViewProduct(p)}
                            title="View Details"
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-600"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingProduct(p)
                              setModalOpen(true)
                            }}
                            title="Edit Product"
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </GlassPanel>

      {/* Product Add/Edit Modal */}
      {modalOpen && (
        <ProductFormModal
          product={editingProduct}
          categories={categories}
          allProducts={products}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setModalOpen(false)
            loadData()
            onReloadStats()
            onToast(editingProduct ? 'Product updated successfully' : 'Product created successfully')
          }}
        />
      )}

      {/* Product View Modal */}
      {viewProduct && (
        <ProductDetailsModal
          productId={viewProduct._id}
          onClose={() => setViewProduct(null)}
          onEdit={() => {
            setEditingProduct(viewProduct)
            setViewProduct(null)
            setModalOpen(true)
          }}
        />
      )}
    </div>
  )
}

function ProductFormModal({ product, categories, allProducts, onClose, onSaved }) {
  const [name, setName] = useState(product?.name || '')
  const [sku, setSku] = useState(product?.sku || '')
  const [description, setDescription] = useState(product?.description || '')
  const [category, setCategory] = useState(product?.category || 'General')
  const [unit, setUnit] = useState(product?.unit || 'Piece')
  const [price, setPrice] = useState(product?.price || 0)
  const [currentStock, setCurrentStock] = useState(product?.currentStock || 0)
  const [minimumStock, setMinimumStock] = useState(product?.minimumStock || 5)
  const [alternativeProductIds, setAlternativeProductIds] = useState(
    product?.alternativeProductIds?.map((a) => a._id || a) || []
  )
  const [isActive, setIsActive] = useState(product?.isActive ?? true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const availableAlternatives = allProducts.filter((p) => p._id !== product?._id)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim() || !sku.trim()) {
      setError('Product Name and SKU are required')
      return
    }
    setError('')
    setBusy(true)

    try {
      const payload = {
        name: name.trim(),
        sku: sku.trim().toUpperCase(),
        description: description.trim(),
        category: category.trim(),
        unit: unit.trim(),
        price: Number(price),
        minimumStock: Number(minimumStock),
        alternativeProductIds,
        isActive,
      }

      if (product) {
        await updateProduct(product._id, payload)
      } else {
        payload.currentStock = Number(currentStock)
        await createProduct(payload)
      }
      onSaved()
    } catch (err) {
      setError(err.message || 'Operation failed')
    } finally {
      setBusy(false)
    }
  }

  const toggleAlt = (pId) => {
    if (alternativeProductIds.includes(pId)) {
      setAlternativeProductIds(alternativeProductIds.filter((id) => id !== pId))
    } else {
      setAlternativeProductIds([...alternativeProductIds, pId])
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-xl bg-blue-50 p-2 text-blue-600">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                {product ? 'Edit Central Product' : 'Create New Central Product'}
              </h2>
              <p className="text-xs text-slate-500">Configure catalog details, SKU, units, and alternatives</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-slate-700">Product Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. AC Cleaner Foam Spray"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700">SKU Code *</label>
              <input
                type="text"
                required
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="e.g. PRD-ACC-01"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-mono font-bold uppercase text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs font-bold text-slate-700">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. AC Cleaning"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700">Unit of Measure</label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="e.g. Bottle, Piece, Can, Kg"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-semibold text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700">Price / Cost (₹)</label>
              <input
                type="number"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {!product && (
              <div>
                <label className="block text-xs font-bold text-slate-700">Initial Stock Quantity</label>
                <input
                  type="number"
                  min="0"
                  value={currentStock}
                  onChange={(e) => setCurrentStock(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-bold text-slate-700">Minimum Stock Alert Level</label>
              <input
                type="number"
                min="0"
                value={minimumStock}
                onChange={(e) => setMinimumStock(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold text-slate-900 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700">Description</label>
            <textarea
              rows="2"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Material details, specifications, usage guidelines..."
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-800 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Alternative Product Substitution Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700">
              Authorized Substitute / Alternative Products (Section 24E)
            </label>
            <p className="text-[11px] text-slate-500">
              Admin can issue these substitutes when original item is out of stock.
            </p>
            <div className="mt-2 max-h-36 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2 space-y-1">
              {availableAlternatives.length === 0 ? (
                <div className="py-2 text-center text-xs text-slate-400">No other products available</div>
              ) : (
                availableAlternatives.map((alt) => {
                  const selected = alternativeProductIds.includes(alt._id)
                  return (
                    <div
                      key={alt._id}
                      onClick={() => toggleAlt(alt._id)}
                      className={`flex cursor-pointer items-center justify-between rounded-lg p-2 text-xs transition ${
                        selected ? 'bg-blue-100 text-blue-900 font-bold' : 'hover:bg-slate-100 text-slate-700 font-medium'
                      }`}
                    >
                      <div>
                        <span>{alt.name}</span>
                        <span className="ml-2 font-mono text-[10px] text-slate-500 font-normal">({alt.sku})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-600">Stock: {alt.currentStock}</span>
                        <div className={`flex h-4 w-4 items-center justify-center rounded-sm border ${selected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300'}`}>
                          {selected && <Check className="h-3 w-3" />}
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-slate-100 pt-4">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded-sm text-blue-600"
              />
              <span>Product is Active</span>
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy}
                className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700 disabled:opacity-50"
              >
                {busy ? 'Saving...' : product ? 'Update Product' : 'Create Product'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

function ProductDetailsModal({ productId, onClose, onEdit }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProductById(productId)
      .then((res) => setData(res))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false))
  }, [productId])

  const p = data?.product
  const history = data?.recentTransactions || []

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-600">
              SKU: {p?.sku}
            </span>
            <h2 className="text-lg font-black text-slate-900">{p?.name || 'Product Details'}</h2>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-xs text-slate-400">Loading details...</div>
        ) : (
          <div className="mt-4 space-y-5">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <div className="text-[11px] font-semibold text-slate-500">Current Stock</div>
                <div className="mt-1 text-lg font-black text-slate-900">{p?.currentStock} {p?.unit}</div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <div className="text-[11px] font-semibold text-slate-500">Min Threshold</div>
                <div className="mt-1 text-lg font-black text-slate-900">{p?.minimumStock} {p?.unit}</div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <div className="text-[11px] font-semibold text-slate-500">Unit Price</div>
                <div className="mt-1 text-lg font-black text-slate-900">₹{p?.price}</div>
              </div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <div className="text-[11px] font-semibold text-slate-500">Stock Value</div>
                <div className="mt-1 text-lg font-black text-emerald-700">₹{(p?.currentStock || 0) * (p?.price || 0)}</div>
              </div>
            </div>

            {p?.description && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Description</h4>
                <p className="mt-1 text-xs leading-relaxed text-slate-700">{p.description}</p>
              </div>
            )}

            {/* Alternatives */}
            {p?.alternativeProductIds?.length > 0 && (
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Approved Alternative Substitutes
                </h4>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {p.alternativeProductIds.map((alt) => (
                    <div key={alt._id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div>
                        <div className="text-xs font-bold text-slate-900">{alt.name}</div>
                        <div className="text-[10px] font-mono text-slate-500">{alt.sku}</div>
                      </div>
                      <span className="rounded-lg bg-white px-2 py-1 text-xs font-black text-blue-700 shadow-xs">
                        Stock: {alt.currentStock} {alt.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent Ledger History */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Recent Stock Transactions</h4>
              <div className="mt-2 max-h-48 overflow-y-auto divide-y divide-slate-100 rounded-xl border border-slate-200">
                {history.length === 0 ? (
                  <div className="p-4 text-center text-xs text-slate-400">No stock transactions recorded yet</div>
                ) : (
                  history.map((h) => (
                    <div key={h._id} className="flex items-center justify-between p-2.5 text-xs">
                      <div>
                        <span className="font-bold text-slate-800">{h.type.replace(/_/g, ' ')}</span>
                        <div className="text-[10px] text-slate-500">
                          {new Date(h.createdAt).toLocaleString()} • {h.remarks || 'No remarks'}
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`font-black ${h.newStock > h.previousStock ? 'text-emerald-600' : 'text-slate-800'}`}>
                          {h.newStock > h.previousStock ? `+${h.quantity}` : `-${h.quantity}`}
                        </span>
                        <div className="text-[10px] text-slate-500">
                          {h.previousStock} → {h.newStock}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Close
              </button>
              <button
                type="button"
                onClick={onEdit}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:bg-blue-700"
              >
                Edit Product
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ==========================================
// 2. SERVICE MATERIALS MAPPING TAB
// ==========================================
function ServiceMaterialsTab({ onToast }) {
  const [services, setServices] = useState([])
  const [selectedServiceId, setSelectedServiceId] = useState('')
  const [mappings, setMappings] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  // Load services tree
  useEffect(() => {
    fetchAdminLabourCategoryTree()
      .then((res) => {
        const tree = res?.tree || []
        const flatServices = []
        tree.forEach((cat) => {
          cat.subcategories?.forEach((sub) => {
            sub.services?.forEach((svc) => {
              flatServices.push({
                ...svc,
                subName: sub.name,
                catName: cat.name,
              })
            })
          })
        })
        setServices(flatServices)
        if (flatServices.length > 0 && !selectedServiceId) {
          setSelectedServiceId(flatServices[0]._id)
        }
      })
      .catch((err) => console.error(err))

    fetchProducts({ limit: 100, status: 'active' }).then((res) => setProducts(res?.products || []))
  }, [])

  const loadMappings = useCallback(async () => {
    if (!selectedServiceId) return
    try {
      setLoading(true)
      const data = await fetchServiceProductMappings(selectedServiceId)
      setMappings(data || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [selectedServiceId])

  useEffect(() => {
    loadMappings()
  }, [loadMappings])

  const handleDelete = async (mappingId) => {
    if (!confirm('Remove this product requirement from the service?')) return
    try {
      await deleteServiceProductMapping(mappingId)
      onToast('Product mapping removed')
      loadMappings()
    } catch (err) {
      alert(err.message || 'Failed to remove')
    }
  }

  const currentService = services.find((s) => s._id === selectedServiceId)

  return (
    <div className="space-y-4">
      {/* Service Selector Header */}
      <GlassPanel className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 items-center gap-3">
            <div className="min-w-[280px] flex-1 max-w-md">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Select Service to Configure Required Materials
              </label>
              <select
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white p-2.5 text-xs font-bold text-slate-900 focus:border-brand"
              >
                {services.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} ({s.subName})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={() => setModalOpen(true)}
            disabled={!selectedServiceId}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-linear-to-r from-blue-600 to-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-md hover:from-blue-700 hover:to-indigo-700 active:scale-95 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" />
            <span>Map Material to this Service</span>
          </button>
        </div>
      </GlassPanel>

      {/* Mapped Materials for this Service */}
      <GlassPanel className="overflow-hidden p-0">
        <div className="border-b border-slate-200 bg-slate-50/80 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-blue-600" />
            <span className="text-xs font-bold text-slate-900">
              Required Materials for: <span className="text-blue-600">{currentService?.name}</span>
            </span>
          </div>
          <span className="text-xs font-semibold text-slate-500">
            {mappings.length} material(s) configured
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="border-b border-slate-200 bg-slate-50/50 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3.5">Material / Product</th>
                <th className="px-4 py-3.5">SKU</th>
                <th className="px-4 py-3.5 text-center">Required Qty</th>
                <th className="px-4 py-3.5">Unit</th>
                <th className="px-4 py-3.5 text-center">Mandatory</th>
                <th className="px-4 py-3.5 text-center">Central Stock Status</th>
                <th className="px-4 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    <RefreshCw className="mx-auto h-6 w-6 animate-spin text-slate-400" />
                    <p className="mt-2 text-xs">Loading mappings...</p>
                  </td>
                </tr>
              ) : mappings.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    <Wrench className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-2 font-semibold">No materials mapped to this service yet</p>
                    <p className="text-[11px]">Click "Map Material to this Service" above</p>
                  </td>
                </tr>
              ) : (
                mappings.map((m) => {
                  const prod = m.productId
                  const stock = prod?.currentStock ?? 0
                  const isOut = stock <= 0
                  const isLow = !isOut && stock <= (prod?.minimumStock || 5)

                  return (
                    <tr key={m._id} className="hover:bg-slate-50/60 transition">
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900">{prod?.name || 'Unknown Product'}</div>
                        <div className="text-[11px] text-slate-500">{prod?.category || 'General'}</div>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-[11px] font-bold text-indigo-600">
                        {prod?.sku || '—'}
                      </td>
                      <td className="px-4 py-3.5 text-center font-black text-slate-900 text-sm">
                        {m.quantityRequired}
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-600">{m.unit}</td>
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                            m.isMandatory ? 'bg-indigo-50 text-indigo-700' : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {m.isMandatory ? 'Mandatory' : 'Optional'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
                            isOut
                              ? 'bg-rose-100 text-rose-700'
                              : isLow
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {stock} in central stock
                          {isOut && ' (SHORTAGE)'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(m._id)}
                          className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50"
                          title="Remove Mapping"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </GlassPanel>

      {/* Add Mapping Modal */}
      {modalOpen && (
        <AddServiceMappingModal
          service={currentService}
          products={products}
          onClose={() => setModalOpen(false)}
          onSaved={() => {
            setModalOpen(false)
            loadMappings()
            onToast('Material mapped successfully')
          }}
        />
      )}
    </div>
  )
}

function AddServiceMappingModal({ service, products, onClose, onSaved }) {
  const [productId, setProductId] = useState(products[0]?._id || '')
  const [quantityRequired, setQuantityRequired] = useState(1)
  const [unit, setUnit] = useState('Piece')
  const [isMandatory, setIsMandatory] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const selectedProd = products.find((p) => p._id === productId)

  useEffect(() => {
    if (selectedProd) {
      setUnit(selectedProd.unit || 'Piece')
    }
  }, [selectedProd])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!productId || Number(quantityRequired) <= 0) {
      setError('Please select a product and valid quantity')
      return
    }
    setError('')
    setBusy(true)

    try {
      await addServiceProductMapping(service._id, {
        productId,
        quantityRequired: Number(quantityRequired),
        unit,
        isMandatory,
      })
      onSaved()
    } catch (err) {
      setError(err.message || 'Failed to map material')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Map Material to Service</h3>
            <p className="text-xs text-blue-600 font-semibold">{service?.name}</p>
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
            <label className="block text-xs font-bold text-slate-700">Select Product *</label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-semibold text-slate-900 focus:bg-white"
            >
              {products.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} ({p.sku}) — Stock: {p.currentStock} {p.unit}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700">Quantity Required *</label>
              <input
                type="number"
                step="any"
                min="0.01"
                required
                value={quantityRequired}
                onChange={(e) => setQuantityRequired(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold text-slate-900 focus:bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700">Unit</label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-semibold text-slate-900 focus:bg-white"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={isMandatory}
              onChange={(e) => setIsMandatory(e.target.checked)}
              className="rounded-sm text-blue-600"
            />
            <span>This material is strictly mandatory for the job</span>
          </label>

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
              {busy ? 'Saving...' : 'Add Mapping'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ==========================================
// 3. MATERIAL REQUESTS TAB (ADMIN WORKFLOW)
// ==========================================
function MaterialRequestsTab({ onReloadStats, onToast }) {
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [search, setSearch] = useState('')

  const [issueModalReq, setIssueModalReq] = useState(null)
  const [viewDetailReq, setViewDetailReq] = useState(null)

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetchAdminMaterialRequests({ status: statusFilter, search, limit: 50 })
      setRequests(res?.requests || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [statusFilter, search])

  useEffect(() => {
    loadRequests()
  }, [loadRequests])

  const handleApprove = async (id) => {
    try {
      const res = await approveMaterialRequest(id)
      onToast(res.message || 'Request approved')
      loadRequests()
      onReloadStats()
    } catch (err) {
      alert(err.message || 'Failed to approve')
    }
  }

  const handleReject = async (id) => {
    const reason = prompt('Enter reason for rejection:', 'Not required for this booking')
    if (reason === null) return
    try {
      await rejectMaterialRequest(id, { adminRemarks: reason })
      onToast('Request rejected')
      loadRequests()
      onReloadStats()
    } catch (err) {
      alert(err.message || 'Failed to reject')
    }
  }

  const handleWaitingStock = async (id) => {
    try {
      await markRequestWaitingStock(id)
      onToast('Marked as waiting for central stock replenishment')
      loadRequests()
      onReloadStats()
    } catch (err) {
      alert(err.message || 'Failed')
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <GlassPanel className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1 max-w-xs">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search Request ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs font-medium text-slate-800 focus:outline-hidden"
              />
            </div>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
            >
              <option value="ALL">All Statuses</option>
              <option value="PENDING">All Actionable (Requested / Waiting / Ready)</option>
              <option value="REQUESTED">REQUESTED</option>
              <option value="WAITING_FOR_STOCK">WAITING_FOR_STOCK (Shortage)</option>
              <option value="READY_FOR_ISSUE">READY_FOR_ISSUE</option>
              <option value="PARTIALLY_ISSUED">PARTIALLY_ISSUED</option>
              <option value="ISSUED">ISSUED</option>
              <option value="COMPLETED">COMPLETED</option>
              <option value="RETURNED">RETURNED</option>
              <option value="REJECTED">REJECTED</option>
            </select>
          </div>

          <button
            onClick={loadRequests}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </GlassPanel>

      {/* Requests Table */}
      <GlassPanel className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3.5">Request & Date</th>
                <th className="px-4 py-3.5">Vendor / Technician</th>
                <th className="px-4 py-3.5">Booking & Service</th>
                <th className="px-4 py-3.5">Requested Materials</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5 text-right">Admin Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    <RefreshCw className="mx-auto h-6 w-6 animate-spin text-slate-400" />
                    <p className="mt-2 text-xs">Loading material requests...</p>
                  </td>
                </tr>
              ) : requests.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-400">
                    <ClipboardCheck className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-2 font-semibold">No material requests found</p>
                  </td>
                </tr>
              ) : (
                requests.map((req) => {
                  const hasShortage = req.items?.some((i) => i.shortageQuantity > 0 || i.itemStatus === 'OUT_OF_STOCK')
                  return (
                    <tr key={req._id} className="hover:bg-slate-50/60 transition">
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900">{req.requestId}</div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(req.createdAt).toLocaleDateString()} {new Date(req.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900">{req.vendorId?.fullName || 'Technician'}</div>
                        <div className="text-[10px] text-slate-500">{req.vendorId?.phone || '—'}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-blue-700">{req.serviceId?.name || 'Service'}</div>
                        <div className="text-[10px] text-slate-500">
                          Booking #{req.bookingId?._id ? String(req.bookingId._id).slice(-6).toUpperCase() : '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="space-y-1">
                          {req.items?.map((item, idx) => {
                            const prod = item.productId
                            const stock = prod?.currentStock ?? 0
                            return (
                              <div key={idx} className="flex items-center gap-2 text-[11px]">
                                <span className="font-medium text-slate-800">
                                  {prod?.name || 'Material'} × <b className="text-slate-900">{item.quantityRequested}</b>
                                </span>
                                {item.alternativeIssuedProductId && (
                                  <span className="rounded-md bg-purple-50 px-1.5 py-0.5 text-[10px] font-bold text-purple-700">
                                    Alt: {item.alternativeIssuedProductId.name}
                                  </span>
                                )}
                                {item.itemStatus === 'OUT_OF_STOCK' && (
                                  <span className="rounded-md bg-rose-100 px-1.5 py-0.2 text-[10px] font-black text-rose-700">
                                    OUT OF STOCK
                                  </span>
                                )}
                                {item.itemStatus === 'PARTIALLY_AVAILABLE' && (
                                  <span className="rounded-md bg-amber-100 px-1.5 py-0.2 text-[10px] font-black text-amber-800">
                                    Shortage: {item.shortageQuantity}
                                  </span>
                                )}
                              </div>
                            )
                          })}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <StatusBadge status={req.status} />
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setViewDetailReq(req)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
                            title="Inspect Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          {['REQUESTED', 'APPROVED', 'WAITING_FOR_STOCK', 'READY_FOR_ISSUE', 'PARTIALLY_ISSUED'].includes(req.status) && (
                            <>
                              <button
                                type="button"
                                onClick={() => setIssueModalReq(req)}
                                className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-xs hover:bg-emerald-700"
                              >
                                Issue / Fulfill
                              </button>

                              {req.status === 'REQUESTED' && (
                                <button
                                  type="button"
                                  onClick={() => handleApprove(req._id)}
                                  className="rounded-lg bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-xs hover:bg-blue-700"
                                >
                                  Approve
                                </button>
                              )}

                              {hasShortage && req.status !== 'WAITING_FOR_STOCK' && (
                                <button
                                  type="button"
                                  onClick={() => handleWaitingStock(req._id)}
                                  className="rounded-lg bg-amber-500 px-2.5 py-1 text-[11px] font-bold text-white shadow-xs hover:bg-amber-600"
                                  title="Mark waiting for stock"
                                >
                                  Wait Stock
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => handleReject(req._id)}
                                className="rounded-lg p-1 text-rose-500 hover:bg-rose-50"
                                title="Reject Request"
                              >
                                <XCircle className="h-4 w-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </GlassPanel>

      {/* Issue Modal */}
      {issueModalReq && (
        <AdminIssueMaterialsModal
          request={issueModalReq}
          onClose={() => setIssueModalReq(null)}
          onIssued={() => {
            setIssueModalReq(null)
            loadRequests()
            onReloadStats()
            onToast('Materials issued to vendor successfully')
          }}
        />
      )}

      {/* Details Modal */}
      {viewDetailReq && (
        <RequestDetailsModal
          request={viewDetailReq}
          onClose={() => setViewDetailReq(null)}
        />
      )}
    </div>
  )
}

function StatusBadge({ status }) {
  const MAP = {
    REQUESTED: { bg: 'bg-blue-100 text-blue-800', label: 'REQUESTED' },
    APPROVED: { bg: 'bg-indigo-100 text-indigo-800', label: 'APPROVED' },
    READY_FOR_ISSUE: { bg: 'bg-teal-100 text-teal-800', label: 'READY FOR ISSUE' },
    WAITING_FOR_STOCK: { bg: 'bg-amber-100 text-amber-800 border border-amber-300', label: 'WAITING FOR STOCK' },
    PARTIALLY_ISSUED: { bg: 'bg-sky-100 text-sky-800', label: 'PARTIALLY ISSUED' },
    ISSUED: { bg: 'bg-emerald-100 text-emerald-800', label: 'ISSUED' },
    IN_USE: { bg: 'bg-cyan-100 text-cyan-800', label: 'IN USE' },
    COMPLETED: { bg: 'bg-slate-100 text-slate-800', label: 'COMPLETED' },
    RETURNED: { bg: 'bg-purple-100 text-purple-800', label: 'RETURNED' },
    REJECTED: { bg: 'bg-rose-100 text-rose-800', label: 'REJECTED' },
  }

  const s = MAP[status] || { bg: 'bg-slate-100 text-slate-600', label: status }
  return (
    <span className={`inline-block rounded-full px-2.5 py-1 text-[10px] font-black tracking-wide ${s.bg}`}>
      {s.label}
    </span>
  )
}

function AdminIssueMaterialsModal({ request, onClose, onIssued }) {
  const [itemsPayload, setItemsPayload] = useState(() =>
    (request.items || []).map((i) => {
      const remaining = Math.max(0, i.quantityRequested - (i.quantityIssued || 0))
      const prod = i.productId
      const stock = prod?.currentStock || 0
      const defaultIssue = Math.min(remaining, stock)

      return {
        itemId: i._id,
        productId: prod?._id || i.productId,
        productName: prod?.name || 'Item',
        unit: i.unit,
        quantityRequired: i.quantityRequired,
        quantityRequested: i.quantityRequested,
        quantityIssued: i.quantityIssued || 0,
        currentStock: stock,
        issueQuantity: defaultIssue,
        useAlternative: false,
        alternativeProductId: prod?.alternativeProductIds?.[0]?._id || '',
        alternativeReason: 'Original product out of stock',
        alternativesList: prod?.alternativeProductIds || [],
      }
    })
  )

  const [adminRemarks, setAdminRemarks] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const handleItemChange = (idx, field, val) => {
    const copy = [...itemsPayload]
    copy[idx][field] = val
    setItemsPayload(copy)
  }

  const handleIssueSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)

    try {
      const payload = {
        adminRemarks,
        items: itemsPayload.map((item) => ({
          itemId: item.itemId,
          issueQuantity: Number(item.issueQuantity) || 0,
          useAlternative: item.useAlternative,
          alternativeProductId: item.useAlternative ? item.alternativeProductId : undefined,
          alternativeReason: item.useAlternative ? item.alternativeReason : undefined,
        })),
      }

      await issueMaterialsToVendor(request._id, payload)
      onIssued()
    } catch (err) {
      setError(err.message || 'Failed to issue materials')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Issue Central Materials to Vendor</h3>
            <p className="text-xs text-slate-500">
              Request <span className="font-mono font-bold text-blue-600">{request.requestId}</span> • Vendor:{' '}
              <b>{request.vendorId?.fullName}</b>
            </p>
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

        <form onSubmit={handleIssueSubmit} className="mt-4 space-y-4">
          <div className="space-y-3">
            {itemsPayload.map((item, idx) => {
              const remaining = Math.max(0, item.quantityRequested - item.quantityIssued)
              const hasShortage = item.currentStock < remaining

              return (
                <div key={item.itemId} className="rounded-2xl border border-slate-200 bg-slate-50/50 p-3.5 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold text-slate-900">{item.productName}</div>
                      <div className="text-[11px] text-slate-500">
                        Required: {item.quantityRequired} • Requested: {item.quantityRequested} • Already Issued: {item.quantityIssued}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-bold ${item.currentStock > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                        Central Stock: {item.currentStock} {item.unit}
                      </span>
                    </div>
                  </div>

                  {/* Shortage & Alternative Switcher */}
                  {hasShortage && (
                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900">
                      <div className="flex items-center gap-1.5 font-bold">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <span>Stock Shortage: Needed {remaining}, Available only {item.currentStock}</span>
                      </div>
                      {item.alternativesList?.length > 0 && (
                        <div className="mt-2 flex items-center gap-2">
                          <label className="flex items-center gap-1.5 font-semibold text-amber-900 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={item.useAlternative}
                              onChange={(e) => handleItemChange(idx, 'useAlternative', e.target.checked)}
                              className="rounded-sm"
                            />
                            <span>Use Alternative Product Substitution</span>
                          </label>
                        </div>
                      )}
                    </div>
                  )}

                  {item.useAlternative && item.alternativesList?.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-purple-200 bg-purple-50/70 p-3">
                      <div>
                        <label className="block text-[11px] font-bold text-purple-900">Choose Approved Alternative</label>
                        <select
                          value={item.alternativeProductId}
                          onChange={(e) => handleItemChange(idx, 'alternativeProductId', e.target.value)}
                          className="mt-1 w-full rounded-lg border border-purple-200 bg-white p-2 text-xs font-bold text-purple-900"
                        >
                          {item.alternativesList.map((alt) => (
                            <option key={alt._id} value={alt._id}>
                              {alt.name} (Stock: {alt.currentStock} {alt.unit})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-purple-900">Reason for Substitution</label>
                        <input
                          type="text"
                          value={item.alternativeReason}
                          onChange={(e) => handleItemChange(idx, 'alternativeReason', e.target.value)}
                          className="mt-1 w-full rounded-lg border border-purple-200 bg-white p-2 text-xs text-purple-900"
                        />
                      </div>
                    </div>
                  )}

                  {/* Quantity to Issue Input */}
                  <div className="flex items-center justify-between border-t border-slate-200 pt-2.5">
                    <span className="text-xs font-semibold text-slate-700">Quantity to Issue now:</span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max={item.useAlternative ? 999 : item.currentStock}
                        value={item.issueQuantity}
                        onChange={(e) => handleItemChange(idx, 'issueQuantity', e.target.value)}
                        className="w-24 rounded-lg border border-slate-300 bg-white p-1.5 text-center text-xs font-bold text-slate-900 focus:border-blue-600"
                      />
                      <span className="text-xs font-semibold text-slate-500">{item.unit}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700">Admin Remarks</label>
            <input
              type="text"
              value={adminRemarks}
              onChange={(e) => setAdminRemarks(e.target.value)}
              placeholder="e.g. Issued 1 full bottle and 2 cloths to vendor"
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
              className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy ? 'Processing Issue...' : 'Confirm & Issue Materials'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function RequestDetailsModal({ request, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <span className="text-[10px] font-mono font-bold text-blue-600">ID: {request.requestId}</span>
            <h3 className="text-base font-bold text-slate-900">Material Request Summary</h3>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <XCircle className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-xs">
            <div>
              <span className="text-slate-500 font-semibold block">Status</span>
              <StatusBadge status={request.status} />
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">Technician</span>
              <span className="font-bold text-slate-900">{request.vendorId?.fullName || '—'}</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">Service</span>
              <span className="font-bold text-blue-700">{request.serviceId?.name || '—'}</span>
            </div>
            <div>
              <span className="text-slate-500 font-semibold block">Booking ID</span>
              <span className="font-mono font-bold text-slate-800">
                {request.bookingId?._id ? String(request.bookingId._id).slice(-8).toUpperCase() : '—'}
              </span>
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Items Detail</h4>
            <div className="mt-2 divide-y divide-slate-100 rounded-xl border border-slate-200">
              {request.items?.map((item, idx) => (
                <div key={idx} className="p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">
                      {item.productId?.name || 'Item'}
                    </span>
                    <span className="font-mono text-[11px] font-bold text-indigo-600">
                      Req: {item.quantityRequested} | Issued: {item.quantityIssued} | Used: {item.quantityUsed} | Returned: {item.quantityReturned}
                    </span>
                  </div>
                  {item.alternativeIssuedProductId && (
                    <div className="text-[11px] text-purple-700 font-semibold">
                      Substitute Issued: {item.alternativeIssuedProductId.name} ({item.alternativeIssuedProductId.sku})
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {request.requestRemarks && (
            <div className="text-xs">
              <span className="font-bold text-slate-700">Vendor Remarks: </span>
              <span className="text-slate-600">{request.requestRemarks}</span>
            </div>
          )}
          {request.adminRemarks && (
            <div className="text-xs">
              <span className="font-bold text-slate-700">Admin Remarks: </span>
              <span className="text-slate-600">{request.adminRemarks}</span>
            </div>
          )}

          <div className="flex justify-end border-t border-slate-100 pt-3">
            <button
              onClick={onClose}
              className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white shadow-xs"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ==========================================
// 4. STOCK MANAGEMENT TAB
// ==========================================
function StockManagementTab({ onReloadStats, onToast }) {
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [restockModalProd, setRestockModalProd] = useState(null)
  const [adjustModalProd, setAdjustModalProd] = useState(null)

  const loadStock = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetchInventoryList({ search, limit: 100 })
      setProducts(res?.products || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [search])

  useEffect(() => {
    loadStock()
  }, [loadStock])

  return (
    <div className="space-y-4">
      <GlassPanel className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative min-w-[200px] flex-1 max-w-xs">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search product inventory..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-xs font-medium text-slate-800 focus:outline-hidden"
            />
          </div>
          <button
            onClick={loadStock}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Refresh
          </button>
        </div>
      </GlassPanel>

      <GlassPanel className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3.5">Product & SKU</th>
                <th className="px-4 py-3.5">Category</th>
                <th className="px-4 py-3.5 text-center">Current Stock</th>
                <th className="px-4 py-3.5 text-center">Min Level</th>
                <th className="px-4 py-3.5">Unit Value</th>
                <th className="px-4 py-3.5">Total Value</th>
                <th className="px-4 py-3.5 text-right">Quick Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    <RefreshCw className="mx-auto h-6 w-6 animate-spin text-slate-400" />
                    <p className="mt-2 text-xs">Loading stock...</p>
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    <Boxes className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-2 font-semibold">No products found</p>
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const isOut = p.currentStock <= 0
                  const isLow = !isOut && p.currentStock <= p.minimumStock

                  return (
                    <tr key={p._id} className="hover:bg-slate-50/60 transition">
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900">{p.name}</div>
                        <div className="font-mono text-[10px] text-indigo-600 font-bold">{p.sku}</div>
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-600">{p.category}</td>
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-black ${
                            isOut
                              ? 'bg-rose-100 text-rose-700'
                              : isLow
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {p.currentStock} {p.unit}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center font-bold text-slate-500">{p.minimumStock}</td>
                      <td className="px-4 py-3.5 font-bold text-slate-800">₹{p.price}</td>
                      <td className="px-4 py-3.5 font-black text-emerald-700">₹{p.stockValue || 0}</td>
                      <td className="px-4 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setRestockModalProd(p)}
                            className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-xs hover:bg-emerald-700"
                          >
                            + Add Stock
                          </button>
                          <button
                            type="button"
                            onClick={() => setAdjustModalProd(p)}
                            className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                          >
                            Adjust
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </GlassPanel>

      {/* Restock Modal */}
      {restockModalProd && (
        <RestockModal
          product={restockModalProd}
          onClose={() => setRestockModalProd(null)}
          onAdded={() => {
            setRestockModalProd(null)
            loadStock()
            onReloadStats()
            onToast('Stock added successfully')
          }}
        />
      )}

      {/* Adjust Modal */}
      {adjustModalProd && (
        <AdjustStockModal
          product={adjustModalProd}
          onClose={() => setAdjustModalProd(null)}
          onAdjusted={() => {
            setAdjustModalProd(null)
            loadStock()
            onReloadStats()
            onToast('Stock adjusted successfully')
          }}
        />
      )}
    </div>
  )
}

function RestockModal({ product, onClose, onAdded }) {
  const [quantity, setQuantity] = useState('')
  const [remarks, setRemarks] = useState('Stock replenishment')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const handleRestock = async (e) => {
    e.preventDefault()
    if (!quantity || Number(quantity) <= 0) {
      setError('Please enter a valid stock quantity')
      return
    }
    setError('')
    setBusy(true)

    try {
      await addInventoryStock({
        productId: product._id,
        quantity: Number(quantity),
        remarks,
      })
      onAdded()
    } catch (err) {
      setError(err.message || 'Failed to add stock')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Restock Central Product</h3>
            <p className="text-xs text-slate-500">{product.name} ({product.sku})</p>
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

        <form onSubmit={handleRestock} className="mt-4 space-y-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs flex justify-between">
            <span className="text-slate-500 font-semibold">Current Available Stock:</span>
            <span className="font-black text-slate-900">{product.currentStock} {product.unit}</span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700">Quantity to Add ({product.unit}) *</label>
            <input
              type="number"
              min="1"
              required
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g. 50"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold text-slate-900 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700">Remarks / Supplier Note</label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Received new shipment from vendor"
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-900 focus:bg-white"
            />
          </div>

          <div className="rounded-xl bg-blue-50 p-3 text-[11px] text-blue-800 leading-relaxed">
            <b>Note (Section 24D):</b> Adding stock will automatically recheck all waiting material requests and notify when ready for issue.
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
              className="rounded-xl bg-emerald-600 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700 disabled:opacity-50"
            >
              {busy ? 'Adding Stock...' : 'Confirm Restock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function AdjustStockModal({ product, onClose, onAdjusted }) {
  const [targetStock, setTargetStock] = useState(product.currentStock)
  const [remarks, setRemarks] = useState('Manual stock reconciliation')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const handleAdjust = async (e) => {
    e.preventDefault()
    setError('')
    setBusy(true)

    try {
      await adjustInventoryStock({
        productId: product._id,
        targetStock: Number(targetStock),
        remarks,
      })
      onAdjusted()
    } catch (err) {
      setError(err.message || 'Failed to adjust stock')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Manual Stock Adjustment</h3>
            <p className="text-xs text-slate-500">{product.name} ({product.sku})</p>
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

        <form onSubmit={handleAdjust} className="mt-4 space-y-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs flex justify-between">
            <span className="text-slate-500 font-semibold">Previous Stock:</span>
            <span className="font-black text-slate-900">{product.currentStock} {product.unit}</span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700">New Target Stock ({product.unit}) *</label>
            <input
              type="number"
              min="0"
              required
              value={targetStock}
              onChange={(e) => setTargetStock(e.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs font-bold text-slate-900 focus:bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700">Audit Remarks / Reason *</label>
            <input
              type="text"
              required
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Physical inventory count correction"
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
              className="rounded-xl bg-slate-900 px-5 py-2 text-xs font-bold text-white shadow-md hover:bg-slate-800 disabled:opacity-50"
            >
              {busy ? 'Saving...' : 'Save Stock Adjustment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ==========================================
// 5. VENDOR INVENTORY TAB
// ==========================================
function VendorInventoryTab() {
  const [vendorData, setVendorData] = useState([])
  const [loading, setLoading] = useState(true)

  const loadVendorInv = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetchVendorInventory()
      setVendorData(res?.vendorInventories || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadVendorInv()
  }, [loadVendorInv])

  return (
    <div className="space-y-4">
      <GlassPanel className="p-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Materials Held by Active Vendors</h3>
          <p className="text-xs text-slate-500">
            Real-time balance of items issued to technicians for active service requests
          </p>
        </div>
        <button
          onClick={loadVendorInv}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </GlassPanel>

      {loading ? (
        <GlassPanel className="p-12 text-center text-slate-400">
          <RefreshCw className="mx-auto h-6 w-6 animate-spin text-slate-400" />
          <p className="mt-2 text-xs">Loading vendor inventories...</p>
        </GlassPanel>
      ) : vendorData.length === 0 ? (
        <GlassPanel className="p-12 text-center text-slate-400">
          <Users className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 font-semibold">No materials currently held by vendors</p>
        </GlassPanel>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {vendorData.map((vi) => (
            <GlassPanel key={vi.vendor?._id || Math.random()} className="p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 font-bold text-indigo-700">
                    {vi.vendor?.fullName?.[0] || 'V'}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">{vi.vendor?.fullName || 'Technician'}</h4>
                    <p className="text-[10px] text-slate-500">{vi.vendor?.phone || '—'}</p>
                  </div>
                </div>
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-[10px] font-black text-blue-700">
                  {vi.totalHeldQuantity} item(s) held
                </span>
              </div>

              <div className="space-y-1.5 text-xs">
                <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Held Material Items</div>
                {vi.heldItems?.length === 0 ? (
                  <p className="text-slate-400 text-[11px]">All materials used or returned</p>
                ) : (
                  vi.heldItems.map((hi, i) => (
                    <div key={i} className="flex items-center justify-between rounded-xl bg-slate-50 p-2 text-[11px]">
                      <span className="font-bold text-slate-800">{hi.product?.name || 'Item'}</span>
                      <div className="text-right">
                        <span className="font-black text-blue-700">Held: {hi.currentHeld}</span>
                        <div className="text-[9px] text-slate-400">
                          Issued {hi.totalIssued} • Used {hi.totalUsed} • Ret {hi.totalReturned}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </GlassPanel>
          ))}
        </div>
      )}
    </div>
  )
}

// ==========================================
// 6. LEDGER AUDIT TRANSACTIONS TAB
// ==========================================
function TransactionsTab() {
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState('ALL')

  const loadTransactions = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetchInventoryTransactions({ type: typeFilter, limit: 100 })
      setTransactions(res?.transactions || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [typeFilter])

  useEffect(() => {
    loadTransactions()
  }, [loadTransactions])

  return (
    <div className="space-y-4">
      <GlassPanel className="p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Inventory Ledger & Stock Audit Trail</h3>
            <p className="text-xs text-slate-500">
              Complete, immutable ledger of all stock additions, issues, usage, and vendor returns
            </p>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700"
            >
              <option value="ALL">All Transaction Types</option>
              <option value="STOCK_ADDED">STOCK_ADDED</option>
              <option value="ISSUED_TO_VENDOR">ISSUED_TO_VENDOR</option>
              <option value="ALTERNATIVE_PRODUCT_ISSUED">ALTERNATIVE_PRODUCT_ISSUED</option>
              <option value="USED_BY_VENDOR">USED_BY_VENDOR</option>
              <option value="RETURNED_BY_VENDOR">RETURNED_BY_VENDOR</option>
              <option value="STOCK_ADJUSTMENT">STOCK_ADJUSTMENT</option>
              <option value="STOCK_REMOVED">STOCK_REMOVED</option>
            </select>
            <button
              onClick={loadTransactions}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </GlassPanel>

      <GlassPanel className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3.5">Txn ID & Date</th>
                <th className="px-4 py-3.5">Product & SKU</th>
                <th className="px-4 py-3.5">Type</th>
                <th className="px-4 py-3.5 text-center">Change Qty</th>
                <th className="px-4 py-3.5 text-center">Stock Flow</th>
                <th className="px-4 py-3.5">Vendor / Context</th>
                <th className="px-4 py-3.5">Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    <RefreshCw className="mx-auto h-6 w-6 animate-spin text-slate-400" />
                    <p className="mt-2 text-xs">Loading ledger transactions...</p>
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    <BarChart3 className="mx-auto h-8 w-8 text-slate-300" />
                    <p className="mt-2 font-semibold">No transactions recorded</p>
                  </td>
                </tr>
              ) : (
                transactions.map((t) => {
                  const isPositive = ['STOCK_ADDED', 'RETURNED_BY_VENDOR'].includes(t.type)
                  const isNegative = ['ISSUED_TO_VENDOR', 'ALTERNATIVE_PRODUCT_ISSUED', 'STOCK_REMOVED'].includes(t.type)

                  return (
                    <tr key={t._id} className="hover:bg-slate-50/60 transition">
                      <td className="px-4 py-3.5">
                        <div className="font-mono text-[11px] font-bold text-slate-900">{t.transactionId}</div>
                        <div className="text-[10px] text-slate-400">
                          {new Date(t.createdAt).toLocaleDateString()} {new Date(t.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900">{t.productId?.name || 'Product'}</div>
                        <div className="font-mono text-[10px] text-indigo-600 font-bold">{t.productId?.sku || '—'}</div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-black uppercase ${
                            isPositive
                              ? 'bg-emerald-100 text-emerald-800'
                              : isNegative
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {t.type.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center font-black text-sm">
                        <span className={isPositive ? 'text-emerald-600' : isNegative ? 'text-rose-600' : 'text-slate-800'}>
                          {isPositive ? `+${t.quantity}` : isNegative ? `-${t.quantity}` : t.quantity}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center font-mono text-[11px] font-bold text-slate-600">
                        {t.previousStock} → {t.newStock}
                      </td>
                      <td className="px-4 py-3.5">
                        {t.vendorId && (
                          <div className="font-semibold text-slate-900">{t.vendorId.fullName}</div>
                        )}
                        {t.bookingId && (
                          <div className="text-[10px] text-blue-600 font-mono">
                            Booking #{String(t.bookingId._id || t.bookingId).slice(-6).toUpperCase()}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-slate-600 font-medium">{t.remarks || '—'}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </GlassPanel>
    </div>
  )
}

// ==========================================
// 7. LOW STOCK ALERTS TAB
// ==========================================
function LowStockTab({ onReloadStats, onToast, onSwitchToStock }) {
  const [lowStockList, setLowStockList] = useState([])
  const [loading, setLoading] = useState(true)
  const [restockProd, setRestockProd] = useState(null)

  const loadLowStock = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetchLowStockProducts({ limit: 100 })
      setLowStockList(res?.products || [])
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadLowStock()
  }, [loadLowStock])

  return (
    <div className="space-y-4">
      <GlassPanel className="p-4 flex items-center justify-between border-l-4 border-l-amber-500">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Low Stock & Shortage Inventory Alerts</h3>
          <p className="text-xs text-slate-500">
            Products that are currently at or below their configured minimum threshold
          </p>
        </div>
        <button
          onClick={loadLowStock}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </GlassPanel>

      <GlassPanel className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-4 py-3.5">Product & SKU</th>
                <th className="px-4 py-3.5">Category</th>
                <th className="px-4 py-3.5 text-center">Current Stock</th>
                <th className="px-4 py-3.5 text-center">Minimum Threshold</th>
                <th className="px-4 py-3.5 text-center">Shortage to Minimum</th>
                <th className="px-4 py-3.5 text-center">Status</th>
                <th className="px-4 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-slate-400">
                    <RefreshCw className="mx-auto h-6 w-6 animate-spin text-slate-400" />
                    <p className="mt-2 text-xs">Loading low stock items...</p>
                  </td>
                </tr>
              ) : lowStockList.length === 0 ? (
                <tr>
                  <td colSpan="7" className="py-12 text-center text-emerald-600">
                    <CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" />
                    <p className="mt-2 font-bold text-sm">All products have healthy inventory levels!</p>
                    <p className="text-xs text-slate-500">No products below minimum stock threshold</p>
                  </td>
                </tr>
              ) : (
                lowStockList.map((p) => {
                  const isOut = p.currentStock <= 0
                  return (
                    <tr key={p._id} className="hover:bg-slate-50/60 transition">
                      <td className="px-4 py-3.5">
                        <div className="font-bold text-slate-900">{p.name}</div>
                        <div className="font-mono text-[10px] text-indigo-600 font-bold">{p.sku}</div>
                      </td>
                      <td className="px-4 py-3.5 font-medium text-slate-600">{p.category}</td>
                      <td className="px-4 py-3.5 text-center font-black text-sm">
                        <span className={isOut ? 'text-rose-600' : 'text-amber-600'}>
                          {p.currentStock} {p.unit}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-center font-bold text-slate-600">
                        {p.minimumStock} {p.unit}
                      </td>
                      <td className="px-4 py-3.5 text-center font-black text-rose-600">
                        +{p.shortageToMinimum} {p.unit} needed
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase ${
                            isOut ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {isOut ? 'OUT OF STOCK' : 'LOW STOCK'}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => setRestockProd(p)}
                          className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-700"
                        >
                          Restock Now
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </GlassPanel>

      {/* Restock Modal */}
      {restockProd && (
        <RestockModal
          product={restockProd}
          onClose={() => setRestockProd(null)}
          onAdded={() => {
            setRestockProd(null)
            loadLowStock()
            onReloadStats()
            onToast('Stock replenished successfully')
          }}
        />
      )}
    </div>
  )
}
