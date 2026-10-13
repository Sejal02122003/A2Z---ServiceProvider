import { useCallback, useEffect, useState, useMemo } from 'react'
import {
  Package,
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  Eye,
  X,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  Upload,
  Loader2,
  Calendar,
  MapPin,
  Sparkles,
  Tag,
  DollarSign,
  ChevronDown,
} from 'lucide-react'
import {
  fetchAdminPackages,
  fetchAdminPackageDetails,
  createAdminPackage,
  updateAdminPackage,
  updateAdminPackageStatus,
  deleteAdminPackage,
} from '../../api/packagesApi.js'
import { fetchAdminLabourCategoryTree } from '../../api/adminLabourCategoriesApi.js'
import { adminZonesApi } from '../../api/adminZonesApi.js'
import { uploadMedia, assetUrlFromUpload } from '../../api/uploadApi.js'
import { UPLOAD_FOLDERS } from '../../constants/uploadFolders.js'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { ApiError } from '../../api/http.js'

export function AdminPackagesPage() {
  const [packages, setPackages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [categoryFilter, setCategoryFilter] = useState('ALL')

  // Metadata for categories, subcategories, services and zones
  const [categoryTree, setCategoryTree] = useState([])
  const [allServices, setAllServices] = useState([])
  const [activeZones, setActiveZones] = useState([])

  // Modal states
  const [formModalOpen, setFormModalOpen] = useState(false)
  const [editingPackageId, setEditingPackageId] = useState(null)
  const [previewPackage, setPreviewPackage] = useState(null)
  const [previewModalOpen, setPreviewModalOpen] = useState(false)
  const [deleteConfirmPkg, setDeleteConfirmPkg] = useState(null)

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    shortDescription: '',
    imageUrl: '',
    images: [],
    categoryId: '',
    subcategoryId: '',
    price: '',
    originalPrice: '',
    estimatedDurationMins: '',
    badge: '',
    status: 'ACTIVE',
    isAllZones: true,
    zones: [],
    validFrom: '',
    validUntil: '',
    inclusions: [],
    exclusions: ['Parts and spare materials if required are charged separately'],
    termsAndConditions: ['Standard service guarantee applies', 'Rescheduling available up to 2 hours prior'],
    sortOrder: 0,
  })
  const [formBusy, setFormBusy] = useState(false)
  const [formError, setFormError] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)

  // Load Tree & Zones
  useEffect(() => {
    fetchAdminLabourCategoryTree()
      .then((res) => {
        const groups = res.data?.tree || []
        const cats = []
        const services = []
        groups.forEach((g) => {
          ;(g.categories || []).forEach((c) => {
            cats.push(c)
            ;(c.subcategories || []).forEach((sc) => {
              ;(sc.services || []).forEach((srv) => {
                services.push({
                  _id: srv._id,
                  name: srv.name,
                  categoryId: c._id,
                  categoryName: c.name,
                  subcategoryId: sc._id,
                  subcategoryName: sc.name,
                  basePrice: srv.basePrice || srv.hourlyPrice || 0,
                  isActive: srv.isActive,
                })
              })
            })
          })
        })
        setCategoryTree(cats)
        setAllServices(services)
      })
      .catch((err) => console.error('Failed to load category tree:', err))

    adminZonesApi
      .getZones()
      .then((res) => {
        setActiveZones(res.data?.zones || [])
      })
      .catch((err) => console.error('Failed to load zones:', err))
  }, [])

  // Load packages list
  const loadPackagesList = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = {}
      if (statusFilter !== 'ALL') params.status = statusFilter
      if (categoryFilter !== 'ALL') params.categoryId = categoryFilter
      if (search.trim()) params.search = search.trim()

      const res = await fetchAdminPackages(params)
      setPackages(res.data?.packages || [])
    } catch (err) {
      console.error('Failed to fetch packages:', err)
      setError(err.message || 'Failed to load packages.')
    } finally {
      setLoading(false)
    }
  }, [statusFilter, categoryFilter, search])

  useEffect(() => {
    loadPackagesList()
  }, [loadPackagesList])

  // Open Create Modal
  const openCreateModal = () => {
    setEditingPackageId(null)
    setFormData({
      name: '',
      slug: '',
      description: '',
      shortDescription: '',
      imageUrl: '',
      images: [],
      categoryId: categoryTree[0]?._id || '',
      subcategoryId: '',
      price: '',
      originalPrice: '',
      estimatedDurationMins: '120',
      badge: 'POPULAR',
      status: 'ACTIVE',
      isAllZones: true,
      zones: [],
      validFrom: '',
      validUntil: '',
      inclusions: [
        {
          serviceId: allServices[0]?._id || '',
          name: allServices[0]?.name || '',
          quantity: 1,
          description: '',
        },
      ],
      exclusions: ['Parts and spare materials if required are charged separately'],
      termsAndConditions: ['Standard service guarantee applies', 'Rescheduling available up to 2 hours prior'],
      sortOrder: 0,
    })
    setFormError('')
    setFormModalOpen(true)
  }

  // Open Edit Modal
  const openEditModal = async (pkg) => {
    setEditingPackageId(pkg._id)
    setFormError('')
    setFormBusy(true)
    setFormModalOpen(true)
    try {
      const res = await fetchAdminPackageDetails(pkg._id)
      const data = res.data?.package
      if (data) {
        setFormData({
          name: data.name || '',
          slug: data.slug || '',
          description: data.description || '',
          shortDescription: data.shortDescription || '',
          imageUrl: data.imageUrl || '',
          images: data.images || [],
          categoryId: data.categoryId?._id || data.categoryId || '',
          subcategoryId: data.subcategoryId?._id || data.subcategoryId || '',
          price: data.price !== undefined ? String(data.price) : '',
          originalPrice: data.originalPrice !== undefined ? String(data.originalPrice) : '',
          estimatedDurationMins: data.estimatedDurationMins ? String(data.estimatedDurationMins) : '',
          badge: data.badge || '',
          status: data.status || 'ACTIVE',
          isAllZones: data.isAllZones !== false,
          zones: (data.zones || []).map((z) => (typeof z === 'object' ? z._id : z)),
          validFrom: data.validFrom ? new Date(data.validFrom).toISOString().slice(0, 10) : '',
          validUntil: data.validUntil ? new Date(data.validUntil).toISOString().slice(0, 10) : '',
          inclusions: (data.inclusions || []).map((inc) => ({
            serviceId: inc.serviceId?._id || inc.serviceId,
            name: inc.name || inc.serviceId?.name || '',
            quantity: inc.quantity || 1,
            description: inc.description || '',
          })),
          exclusions: data.exclusions || [],
          termsAndConditions: data.termsAndConditions || [],
          sortOrder: data.sortOrder || 0,
        })
      }
    } catch (err) {
      setFormError(err.message || 'Failed to load package details')
    } finally {
      setFormBusy(false)
    }
  }

  // Handle Image Upload
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingImage(true)
    try {
      const uploadRes = await uploadMedia(file, UPLOAD_FOLDERS.LABOUR_CATEGORIES)
      const url = assetUrlFromUpload(uploadRes)
      if (url) {
        setFormData((prev) => ({
          ...prev,
          imageUrl: url,
          images: [url, ...prev.images.filter((i) => i !== url)],
        }))
      }
    } catch (err) {
      alert(err.message || 'Image upload failed')
    } finally {
      setUploadingImage(false)
    }
  }

  // Inclusion handlers
  const addInclusion = () => {
    const defaultSrv = allServices.find((s) => !formData.categoryId || s.categoryId === formData.categoryId) || allServices[0]
    setFormData((prev) => ({
      ...prev,
      inclusions: [
        ...prev.inclusions,
        {
          serviceId: defaultSrv?._id || '',
          name: defaultSrv?.name || '',
          quantity: 1,
          description: '',
        },
      ],
    }))
  }

  const updateInclusion = (index, field, value) => {
    setFormData((prev) => {
      const updated = [...prev.inclusions]
      if (field === 'serviceId') {
        const srv = allServices.find((s) => s._id === value)
        updated[index] = {
          ...updated[index],
          serviceId: value,
          name: srv ? srv.name : updated[index].name,
        }
      } else {
        updated[index] = {
          ...updated[index],
          [field]: value,
        }
      }
      return { ...prev, inclusions: updated }
    })
  }

  const removeInclusion = (index) => {
    setFormData((prev) => ({
      ...prev,
      inclusions: prev.inclusions.filter((_, idx) => idx !== index),
    }))
  }

  // Save package handler
  const handleSavePackage = async (e) => {
    e.preventDefault()
    setFormError('')

    if (!formData.name.trim()) {
      setFormError('Package Name is required.')
      return
    }
    if (!formData.categoryId) {
      setFormError('Please select a Category.')
      return
    }
    if (!formData.price || Number(formData.price) <= 0) {
      setFormError('Valid Package Price is required.')
      return
    }
    if (formData.inclusions.length === 0) {
      setFormError('At least one included service is required.')
      return
    }

    setFormBusy(true)
    try {
      const payload = {
        name: formData.name.trim(),
        slug: formData.slug.trim() || undefined,
        description: formData.description.trim(),
        shortDescription: formData.shortDescription.trim(),
        imageUrl: formData.imageUrl.trim(),
        images: formData.images,
        categoryId: formData.categoryId,
        subcategoryId: formData.subcategoryId || undefined,
        price: Number(formData.price),
        originalPrice: formData.originalPrice ? Number(formData.originalPrice) : undefined,
        estimatedDurationMins: formData.estimatedDurationMins ? Number(formData.estimatedDurationMins) : undefined,
        badge: formData.badge.trim(),
        status: formData.status,
        isAllZones: formData.isAllZones,
        zones: formData.isAllZones ? [] : formData.zones,
        validFrom: formData.validFrom || null,
        validUntil: formData.validUntil || null,
        inclusions: formData.inclusions.map((inc) => ({
          serviceId: inc.serviceId,
          name: inc.name,
          quantity: Number(inc.quantity) || 1,
          description: inc.description || '',
        })),
        exclusions: formData.exclusions.filter(Boolean),
        termsAndConditions: formData.termsAndConditions.filter(Boolean),
        sortOrder: Number(formData.sortOrder) || 0,
      }

      if (editingPackageId) {
        await updateAdminPackage(editingPackageId, payload)
      } else {
        await createAdminPackage(payload)
      }

      setFormModalOpen(false)
      loadPackagesList()
    } catch (err) {
      console.error('Failed to save package:', err)
      setFormError(err.message || 'Failed to save package.')
    } finally {
      setFormBusy(false)
    }
  }

  // Quick Status Change
  const handleStatusChange = async (pkgId, newStatus) => {
    try {
      await updateAdminPackageStatus(pkgId, newStatus)
      setPackages((prev) =>
        prev.map((p) => (p._id === pkgId ? { ...p, status: newStatus } : p))
      )
    } catch (err) {
      alert(err.message || 'Failed to update status')
    }
  }

  // Delete / Archive Handler
  const confirmDeletePackage = async () => {
    if (!deleteConfirmPkg) return
    try {
      await deleteAdminPackage(deleteConfirmPkg._id)
      setDeleteConfirmPkg(null)
      loadPackagesList()
    } catch (err) {
      alert(err.message || 'Failed to delete package')
    }
  }

  // Calculate sum of individual service prices for savings insight
  const estimatedSumPrice = useMemo(() => {
    let sum = 0
    formData.inclusions.forEach((inc) => {
      const srv = allServices.find((s) => s._id === inc.serviceId)
      if (srv) {
        sum += (srv.basePrice || 0) * (Number(inc.quantity) || 1)
      }
    })
    return sum
  }, [formData.inclusions, allServices])

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-brand">
            <Package className="h-4 w-4" />
            Service Packages Management
          </div>
          <h1 className="mt-1 text-2xl font-black text-slate-900 tracking-tight">
            Predefined Service Packages
          </h1>
          <p className="mt-1 text-xs text-slate-500">
            Create and configure multi-service bundles, promotional pricing, inclusions, and availability.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadPackagesList}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs font-black text-white shadow-sm hover:opacity-95"
          >
            <Plus className="h-4 w-4" />
            Create Package
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <GlassPanel className="p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Packages</p>
          <p className="text-2xl font-black text-slate-900 mt-1">{packages.length}</p>
        </GlassPanel>
        <GlassPanel className="p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Active</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">
            {packages.filter((p) => p.status === 'ACTIVE').length}
          </p>
        </GlassPanel>
        <GlassPanel className="p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-500">Draft / Inactive</p>
          <p className="text-2xl font-black text-amber-600 mt-1">
            {packages.filter((p) => ['DRAFT', 'INACTIVE'].includes(p.status)).length}
          </p>
        </GlassPanel>
        <GlassPanel className="p-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-brand">Total Bookings</p>
          <p className="text-2xl font-black text-brand mt-1">
            {packages.reduce((acc, curr) => acc + (curr.bookingCount || 0), 0)}
          </p>
        </GlassPanel>
      </div>

      {/* Search and Filters Bar */}
      <GlassPanel className="p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by package name, slug, or inclusion..."
              className="w-full rounded-xl border border-slate-200 pl-10 pr-4 py-2 text-xs font-medium text-slate-800 outline-none focus:border-brand focus:ring-1 focus:ring-brand/20"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-brand"
            >
              <option value="ALL">All Categories</option>
              {categoryTree.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-brand"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="DRAFT">Draft</option>
              <option value="INACTIVE">Inactive</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>
        </div>
      </GlassPanel>

      {/* Table Listing */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3 px-4">Package</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4">Inclusions</th>
                <th className="py-3 px-4">Pricing</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Bookings</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-brand mb-2" />
                    Loading packages...
                  </td>
                </tr>
              ) : packages.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No service packages found.
                  </td>
                </tr>
              ) : (
                packages.map((pkg) => (
                  <tr key={pkg._id} className="hover:bg-slate-50/50 transition">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={pkg.imageUrl || 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=400&q=80'}
                          alt=""
                          className="h-10 w-12 rounded-lg object-cover border border-slate-200 shrink-0"
                        />
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-slate-900">{pkg.name}</span>
                            {pkg.badge && (
                              <span className="rounded bg-amber-100 px-1.5 py-0.2 text-[9px] font-black text-amber-800">
                                {pkg.badge}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-slate-400 font-mono">{pkg.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      {pkg.categoryId?.name || '—'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <span className="font-bold text-slate-900">
                          {pkg.inclusions?.length || 0} services
                        </span>
                        <span className="text-[10px] text-slate-400 truncate max-w-[180px]">
                          {pkg.inclusions?.map((i) => i.name).join(', ')}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="flex flex-col">
                        <span className="font-black text-slate-900">
                          ₹{Number(pkg.price).toLocaleString('en-IN')}
                        </span>
                        {pkg.originalPrice && pkg.originalPrice > pkg.price && (
                          <span className="text-[10px] text-slate-400 line-through">
                            ₹{Number(pkg.originalPrice).toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <select
                        value={pkg.status}
                        onChange={(e) => handleStatusChange(pkg._id, e.target.value)}
                        className={`rounded-lg px-2 py-1 text-[11px] font-bold border transition ${
                          pkg.status === 'ACTIVE'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : pkg.status === 'DRAFT'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : pkg.status === 'INACTIVE'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}
                      >
                        <option value="ACTIVE">ACTIVE</option>
                        <option value="DRAFT">DRAFT</option>
                        <option value="INACTIVE">INACTIVE</option>
                        <option value="ARCHIVED">ARCHIVED</option>
                      </select>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-800">
                      {pkg.bookingCount || 0}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setPreviewPackage(pkg)
                            setPreviewModalOpen(true)
                          }}
                          title="Preview"
                          className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 transition"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditModal(pkg)}
                          title="Edit"
                          className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50 transition"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmPkg(pkg)}
                          title="Delete / Archive"
                          className="rounded-lg p-1.5 text-rose-500 hover:bg-rose-50 transition"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT MODAL */}
      {formModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs overflow-y-auto">
          <div className="relative w-full max-w-3xl rounded-2xl bg-white p-6 shadow-2xl my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
              <h2 className="text-lg font-black text-slate-900">
                {editingPackageId ? 'Edit Service Package' : 'Create New Service Package'}
              </h2>
              <button
                type="button"
                onClick={() => setFormModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formError && (
              <div className="mb-4 rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-bold text-rose-700 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSavePackage} className="space-y-4 text-xs">
              {/* Row 1: Name & Slug */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Package Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Complete AC Deep Clean & Gas Check"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:border-brand"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Custom Slug (Optional)
                  </label>
                  <input
                    type="text"
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                    placeholder="e.g. complete-ac-deep-clean"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-mono outline-none focus:border-brand"
                  />
                </div>
              </div>

              {/* Row 2: Category & Badge */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Category *
                  </label>
                  <select
                    required
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-brand"
                  >
                    <option value="">Select Category</option>
                    {categoryTree.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Badge / Tag
                  </label>
                  <input
                    type="text"
                    value={formData.badge}
                    onChange={(e) => setFormData({ ...formData, badge: e.target.value })}
                    placeholder="e.g. POPULAR, BEST VALUE"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold outline-none focus:border-brand"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-brand"
                  >
                    <option value="ACTIVE">ACTIVE (Published)</option>
                    <option value="DRAFT">DRAFT (Hidden)</option>
                    <option value="INACTIVE">INACTIVE</option>
                    <option value="ARCHIVED">ARCHIVED</option>
                  </select>
                </div>
              </div>

              {/* Descriptions */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Short Summary (Shows in cards)
                </label>
                <input
                  type="text"
                  value={formData.shortDescription}
                  onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
                  placeholder="e.g. Includes jet wash, filter sterilisation and gas inspection"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium outline-none focus:border-brand"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Detailed Description
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detailed explanation of what the package covers..."
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-medium outline-none focus:border-brand"
                />
              </div>

              {/* Image Upload */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Package Image
                </label>
                <div className="flex items-center gap-3">
                  {formData.imageUrl && (
                    <img
                      src={formData.imageUrl}
                      alt=""
                      className="h-14 w-20 rounded-xl object-cover border border-slate-200"
                    />
                  )}
                  <div className="flex-1">
                    <input
                      type="text"
                      value={formData.imageUrl}
                      onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                      placeholder="Image URL or upload from device"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-brand mb-1.5"
                    />
                    <label className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-[11px] font-bold text-slate-700 cursor-pointer hover:bg-slate-100">
                      <Upload className="h-3.5 w-3.5" />
                      {uploadingImage ? 'Uploading...' : 'Upload Media File'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleImageUpload}
                        disabled={uploadingImage}
                      />
                    </label>
                  </div>
                </div>
              </div>

              {/* Pricing Section */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-3">
                <p className="font-extrabold text-slate-800 flex items-center gap-1.5">
                  <DollarSign className="h-4 w-4 text-emerald-600" />
                  Package Pricing Configuration
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Final Package Price (₹) *
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      placeholder="e.g. 1499"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-900 outline-none focus:border-brand"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Original / Strikethrough Price (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={formData.originalPrice}
                      onChange={(e) => setFormData({ ...formData, originalPrice: e.target.value })}
                      placeholder="e.g. 1999"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 outline-none focus:border-brand"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Estimated Duration (Mins)
                    </label>
                    <input
                      type="number"
                      min={15}
                      value={formData.estimatedDurationMins}
                      onChange={(e) => setFormData({ ...formData, estimatedDurationMins: e.target.value })}
                      placeholder="e.g. 120"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold outline-none focus:border-brand"
                    />
                  </div>
                </div>

                {estimatedSumPrice > 0 && (
                  <div className="text-[11px] font-bold text-slate-600 flex items-center justify-between pt-1 border-t border-slate-200">
                    <span>Individual services sum: ₹{estimatedSumPrice}</span>
                    {formData.price && Number(formData.price) < estimatedSumPrice && (
                      <span className="text-emerald-600">
                        Customer saves ₹{estimatedSumPrice - Number(formData.price)} (
                        {Math.round(((estimatedSumPrice - Number(formData.price)) / estimatedSumPrice) * 100)}% off)
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Service Inclusions Builder */}
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-slate-900">Included Services *</h3>
                    <p className="text-[10px] text-slate-400">
                      Select which existing services from the catalog make up this package.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addInclusion}
                    className="rounded-lg bg-indigo-50 border border-indigo-200 px-2.5 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100"
                  >
                    + Add Service
                  </button>
                </div>

                <div className="space-y-2">
                  {formData.inclusions.map((inc, idx) => (
                    <div
                      key={idx}
                      className="flex flex-col sm:flex-row items-center gap-2 p-2.5 rounded-xl border border-slate-100 bg-slate-50/70"
                    >
                      <div className="flex-1 w-full">
                        <select
                          value={inc.serviceId}
                          onChange={(e) => updateInclusion(idx, 'serviceId', e.target.value)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-800"
                        >
                          <option value="">Choose Service</option>
                          {allServices
                            .filter((s) => !formData.categoryId || s.categoryId === formData.categoryId)
                            .map((srv) => (
                              <option key={srv._id} value={srv._id}>
                                {srv.name} ({srv.categoryName} - ₹{srv.basePrice})
                              </option>
                            ))}
                        </select>
                      </div>
                      <div className="w-24 shrink-0">
                        <input
                          type="number"
                          min={1}
                          value={inc.quantity}
                          onChange={(e) => updateInclusion(idx, 'quantity', e.target.value)}
                          placeholder="Qty"
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-bold text-center"
                        />
                      </div>
                      <div className="flex-1 w-full">
                        <input
                          type="text"
                          value={inc.description}
                          onChange={(e) => updateInclusion(idx, 'description', e.target.value)}
                          placeholder="Optional notes e.g. 1 unit / 1.5 ton AC"
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs"
                        />
                      </div>
                      {formData.inclusions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeInclusion(idx)}
                          className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Zones and Availability */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-800">Geographic Availability</p>
                    <p className="text-[10px] text-slate-400">
                      Determine which cities/zones this package is valid for.
                    </p>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-700">
                    <input
                      type="checkbox"
                      checked={formData.isAllZones}
                      onChange={(e) => setFormData({ ...formData, isAllZones: e.target.checked })}
                      className="rounded text-brand"
                    />
                    Available in All Zones
                  </label>
                </div>

                {!formData.isAllZones && (
                  <div className="pt-2 flex flex-wrap gap-2">
                    {activeZones.map((z) => {
                      const checked = formData.zones.includes(z._id)
                      return (
                        <button
                          key={z._id}
                          type="button"
                          onClick={() => {
                            setFormData((prev) => ({
                              ...prev,
                              zones: checked
                                ? prev.zones.filter((id) => id !== z._id)
                                : [...prev.zones, z._id],
                            }))
                          }}
                          className={`rounded-lg px-2.5 py-1 text-[11px] font-bold border transition ${
                            checked
                              ? 'bg-brand text-white border-brand'
                              : 'bg-white text-slate-700 border-slate-200'
                          }`}
                        >
                          {z.city} ({z.name})
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Form Buttons */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setFormModalOpen(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formBusy}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-5 py-2 text-xs font-black text-white shadow-sm hover:opacity-95 disabled:opacity-50"
                >
                  {formBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {editingPackageId ? 'Update Package' : 'Create & Publish'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PREVIEW MODAL */}
      {previewModalOpen && previewPackage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="relative w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">
                Customer App Preview
              </span>
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="overflow-hidden rounded-2xl border border-slate-200 shadow-sm bg-white">
              <div className="relative h-44 w-full bg-slate-900">
                <img
                  src={previewPackage.imageUrl || 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=600&q=80'}
                  alt=""
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                {previewPackage.badge && (
                  <span className="absolute left-3 top-3 rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-black uppercase text-slate-900">
                    {previewPackage.badge}
                  </span>
                )}
                <div className="absolute bottom-3 left-3 right-3 text-white">
                  <h3 className="text-base font-extrabold">{previewPackage.name}</h3>
                </div>
              </div>
              <div className="p-4 space-y-3">
                <p className="text-xs text-slate-600">{previewPackage.shortDescription || previewPackage.description}</p>
                <div className="rounded-xl bg-slate-50 p-3 space-y-1.5 border border-slate-100 text-xs">
                  <p className="font-bold text-slate-700">Included Services:</p>
                  {previewPackage.inclusions?.map((inc, i) => (
                    <div key={i} className="flex justify-between text-slate-600">
                      <span>✓ {inc.name}</span>
                      <span className="font-bold text-slate-400">x{inc.quantity || 1}</span>
                    </div>
                  ))}
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                  <div>
                    <span className="text-xl font-black text-slate-900">
                      ₹{previewPackage.price}
                    </span>
                    {previewPackage.originalPrice && (
                      <span className="text-xs text-slate-400 line-through ml-2">
                        ₹{previewPackage.originalPrice}
                      </span>
                    )}
                  </div>
                  <button className="rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white shadow">
                    Book Now
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE / ARCHIVE CONFIRM MODAL */}
      {deleteConfirmPkg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-xl space-y-3">
            <h3 className="text-sm font-black text-slate-900">
              Archive / Delete Service Package
            </h3>
            <p className="text-xs text-slate-500 leading-relaxed">
              Are you sure you want to delete <span className="font-bold text-slate-800">"{deleteConfirmPkg.name}"</span>?
              If previous bookings exist, it will be safely archived without affecting past customer records.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmPkg(null)}
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDeletePackage}
                className="rounded-xl bg-rose-600 px-4 py-1.5 text-xs font-bold text-white shadow hover:bg-rose-700"
              >
                Confirm Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default AdminPackagesPage
