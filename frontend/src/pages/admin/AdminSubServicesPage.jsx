import { useCallback, useEffect, useState, useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import {
  Plus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  ListTree,
  Eye,
  X,
  AlertTriangle,
  Clock,
  IndianRupee,
  Layers,
  Tag,
  Wrench,
  CheckCircle2,
  XCircle,
  Upload,
  ArrowRight,
} from 'lucide-react'

import {
  fetchAdminLabourCategoryTree,
  updateAdminLabourService,
} from '../../api/adminLabourCategoriesApi.js'
import { ApiError } from '../../api/http.js'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { SearchableSelect } from '../../components/ui/SearchableSelect.jsx'
import { AppPrimaryButton } from '../../components/app/AppPrimaryButton.jsx'
import { UPLOAD_FOLDERS } from '../../constants/uploadFolders.js'
import { assetUrlFromUpload, uploadMedia } from '../../api/uploadApi.js'

function AddSubServiceModal({
  open,
  categories = [],
  subcategories = [],
  services = [],
  defaultCategoryId = '',
  defaultSubcategoryId = '',
  defaultServiceId = '',
  onClose,
  onSaved,
  busy,
  setBusy,
}) {
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState('')
  const [parentServiceId, setParentServiceId] = useState('')
  const [name, setName] = useState('')
  const [sortOrder, setSortOrder] = useState(0)
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState(0)
  const [originalPrice, setOriginalPrice] = useState(0)
  const [estimatedDurationMins, setEstimatedDurationMins] = useState(30)
  const [iconUrl, setIconUrl] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      let initServiceId = defaultServiceId || ''
      let initCatId = defaultCategoryId || ''
      let initSubcatId = defaultSubcategoryId || ''

      if (initServiceId) {
        const foundSrv = services.find((s) => s._id === initServiceId)
        if (foundSrv) {
          initCatId = initCatId || foundSrv.categoryId || ''
          initSubcatId = initSubcatId || foundSrv.subcategoryId || ''
        }
      } else if (!initCatId && !initSubcatId) {
        const first = services[0]
        if (first) {
          initServiceId = first._id
          initCatId = first.categoryId || ''
          initSubcatId = first.subcategoryId || ''
        }
      } else {
        const matchingSrv = services.find((s) => {
          if (initCatId && String(s.categoryId) !== String(initCatId)) return false
          if (initSubcatId && String(s.subcategoryId) !== String(initSubcatId)) return false
          return true
        })
        initServiceId = matchingSrv?._id || ''
      }

      setSelectedCategoryId(initCatId)
      setSelectedSubcategoryId(initSubcatId)
      setParentServiceId(initServiceId)
      setName('')
      setSortOrder(0)
      setDescription('')
      setPrice(0)
      setOriginalPrice(0)
      setEstimatedDurationMins(30)
      setIconUrl('')
      setIsActive(true)
      setError('')
    }
  }, [open, services, defaultCategoryId, defaultSubcategoryId, defaultServiceId])

  // Subcategories filtered by category
  const availableSubcategories = useMemo(() => {
    if (!selectedCategoryId) return subcategories
    return subcategories.filter((sc) => String(sc.categoryId) === String(selectedCategoryId))
  }, [subcategories, selectedCategoryId])

  // Services filtered by category and/or subcategory
  const availableServices = useMemo(() => {
    return services.filter((s) => {
      if (selectedCategoryId && String(s.categoryId) !== String(selectedCategoryId)) return false
      if (selectedSubcategoryId && String(s.subcategoryId) !== String(selectedSubcategoryId)) return false
      return true
    })
  }, [services, selectedCategoryId, selectedSubcategoryId])

  const handleCategoryChange = (catId) => {
    setSelectedCategoryId(catId)
    let newSubcatId = selectedSubcategoryId
    if (selectedSubcategoryId && catId) {
      const sub = subcategories.find((sc) => sc._id === selectedSubcategoryId)
      if (sub && String(sub.categoryId) !== String(catId)) {
        newSubcatId = ''
        setSelectedSubcategoryId('')
      }
    }

    const isValid = services.some(
      (s) =>
        s._id === parentServiceId &&
        (!catId || String(s.categoryId) === String(catId)) &&
        (!newSubcatId || String(s.subcategoryId) === String(newSubcatId))
    )
    if (!isValid) {
      const firstValid = services.find(
        (s) =>
          (!catId || String(s.categoryId) === String(catId)) &&
          (!newSubcatId || String(s.subcategoryId) === String(newSubcatId))
      )
      setParentServiceId(firstValid?._id || '')
    }
  }

  const handleSubcategoryChange = (subcatId) => {
    setSelectedSubcategoryId(subcatId)
    let newCatId = selectedCategoryId
    if (subcatId) {
      const sub = subcategories.find((sc) => sc._id === subcatId)
      if (sub && sub.categoryId) {
        newCatId = sub.categoryId
        setSelectedCategoryId(sub.categoryId)
      }
    }

    const isValid = services.some(
      (s) =>
        s._id === parentServiceId &&
        (!newCatId || String(s.categoryId) === String(newCatId)) &&
        (!subcatId || String(s.subcategoryId) === String(subcatId))
    )
    if (!isValid) {
      const firstValid = services.find(
        (s) =>
          (!newCatId || String(s.categoryId) === String(newCatId)) &&
          (!subcatId || String(s.subcategoryId) === String(subcatId))
      )
      setParentServiceId(firstValid?._id || '')
    }
  }

  const handleServiceChange = (srvId) => {
    setParentServiceId(srvId)
    if (srvId) {
      const srv = services.find((s) => s._id === srvId)
      if (srv) {
        if (srv.categoryId) setSelectedCategoryId(srv.categoryId)
        if (srv.subcategoryId) setSelectedSubcategoryId(srv.subcategoryId)
      }
    }
  }

  const serviceOptions = useMemo(() => {
    return availableServices.map((s) => ({
      value: s._id,
      label: `${s.name} (${s.subcategoryName} • ${s.categoryName})`,
    }))
  }, [availableServices])

  if (!open) return null

  async function handleFilePick(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please choose a valid image file.')
      return
    }
    setError('')
    setUploadBusy(true)
    try {
      const uploaded = await uploadMedia(file, UPLOAD_FOLDERS.LABOUR_CATEGORIES)
      const url = assetUrlFromUpload(uploaded)
      if (url) setIconUrl(url)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Image upload failed')
    } finally {
      setUploadBusy(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!parentServiceId) {
      setError('Please select a parent service.')
      return
    }
    if (!name.trim()) {
      setError('Sub-service name is required.')
      return
    }
    if (Number(price) < 0) {
      setError('Price cannot be negative.')
      return
    }

    const parent = services.find((s) => s._id === parentServiceId)
    if (!parent) {
      setError('Selected service could not be found.')
      return
    }

    setBusy(true)
    setError('')
    try {
      const currentList = Array.isArray(parent.subServices) ? parent.subServices : []
      const newSubService = {
        name: name.trim(),
        sortOrder: Number(sortOrder) || 0,
        description: description.trim(),
        price: Number(price) || 0,
        originalPrice: Number(originalPrice) || Number(price) || 0,
        estimatedDurationMins: Number(estimatedDurationMins) || 30,
        iconUrl: iconUrl.trim(),
        isActive: Boolean(isActive),
      }

      await updateAdminLabourService(parentServiceId, {
        subServices: [...currentList, newSubService],
      })

      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save sub-service')
    } finally {
      setBusy(false)
    }
  }

  const discountPercent =
    Number(originalPrice) > Number(price) && Number(originalPrice) > 0
      ? Math.round(((Number(originalPrice) - Number(price)) / Number(originalPrice)) * 100)
      : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
        onClick={() => !busy && !uploadBusy && onClose()}
      />
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden"
      >
        <div className="border-b border-slate-100 px-5 py-4 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <ListTree className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Add Sub-Service</h3>
              <p className="text-xs text-slate-500">Attach a granular variant to a service</p>
            </div>
          </div>
          <button
            onClick={() => !busy && !uploadBusy && onClose()}
            className="p-1 text-slate-400 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800 font-medium">
              {error}
            </div>
          )}

          {/* Category & Sub-Category Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <Layers className="h-3.5 w-3.5 text-slate-400" />
                <span>Category</span>
              </label>
              <SearchableSelect
                value={selectedCategoryId}
                onChange={handleCategoryChange}
                options={[
                  { value: '', label: '📁 All Categories' },
                  ...categories.map((c) => ({ value: c._id, label: c.name })),
                ]}
                placeholder="Choose category"
              />
            </div>

            <div>
              <label className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <Tag className="h-3.5 w-3.5 text-slate-400" />
                <span>Sub-Category</span>
              </label>
              <SearchableSelect
                value={selectedSubcategoryId}
                onChange={handleSubcategoryChange}
                options={[
                  { value: '', label: '🏷️ All Sub-Categories' },
                  ...availableSubcategories.map((sc) => ({
                    value: sc._id,
                    label: selectedCategoryId ? sc.name : `${sc.name} (${sc.categoryName})`,
                  })),
                ]}
                placeholder="Choose sub-category"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <Wrench className="h-3.5 w-3.5 text-slate-400" />
              <span>Parent Service</span>
              <span className="text-rose-500">*</span>
            </label>
            <SearchableSelect
              value={parentServiceId}
              onChange={handleServiceChange}
              options={serviceOptions}
              placeholder={
                serviceOptions.length === 0
                  ? 'No services available in this category'
                  : 'Search & choose parent service'
              }
            />
            {serviceOptions.length === 0 ? (
              <p className="mt-1 text-xs text-amber-600 font-medium">
                No services found under this selection. Change category or create a service first.
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-slate-400">
                {availableServices.length} {availableServices.length === 1 ? 'service' : 'services'} available
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Sub-Service Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Split AC Jet Cleaning / Gold Bleach 30 Min"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/35 transition"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Sort Order
              </label>
              <input
                type="number"
                placeholder="0"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/35 transition"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Brief details about what is included in this sub-service variant"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/35 transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Selling Price (₹) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 pl-9 pr-3.5 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-brand/35 transition"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                MRP / Original Price (₹)
              </label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={originalPrice}
                  onChange={(e) => setOriginalPrice(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 pl-9 pr-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/35 transition"
                />
              </div>
            </div>
          </div>

          {discountPercent > 0 && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200/80 px-3 py-1.5 text-xs text-emerald-800 font-bold">
              <span>🎉 Customer saves {discountPercent}% OFF MRP</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Duration (Minutes)
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="number"
                  min="5"
                  step="5"
                  value={estimatedDurationMins}
                  onChange={(e) => setEstimatedDurationMins(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 pl-9 pr-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/35 transition"
                />
              </div>
            </div>

            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 cursor-pointer rounded-xl border border-slate-200 px-3.5 py-2 bg-slate-50/50 hover:bg-slate-50 transition">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                />
                <span className="text-xs font-bold text-slate-700">Active for Booking</span>
              </label>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Icon / Thumbnail
            </label>
            <div className="flex items-center gap-3">
              {iconUrl ? (
                <div className="h-12 w-12 shrink-0 rounded-xl border border-slate-200 bg-slate-100 overflow-hidden relative group">
                  <img src={iconUrl} alt="Icon preview" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setIconUrl('')}
                    className="absolute inset-0 bg-slate-900/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="h-12 w-12 shrink-0 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-400 bg-slate-50">
                  <Upload className="h-5 w-5" />
                </div>
              )}
              <div className="flex-1 space-y-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFilePick}
                  disabled={uploadBusy}
                  className="text-xs text-slate-500 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-100 file:px-2.5 file:py-1 file:text-xs file:font-bold hover:file:bg-slate-200"
                />
                <input
                  type="url"
                  placeholder="Or paste direct image URL"
                  value={iconUrl}
                  onChange={(e) => setIconUrl(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-1 text-xs outline-none focus:ring-1 focus:ring-brand"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={busy || uploadBusy}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <AppPrimaryButton type="submit" disabled={busy || uploadBusy}>
              {busy ? 'Saving...' : 'Add Sub-Service'}
            </AppPrimaryButton>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

function EditSubServiceModal({
  open,
  subService,
  categories = [],
  subcategories = [],
  services = [],
  onClose,
  onSaved,
  busy,
  setBusy,
}) {
  const [selectedCategoryId, setSelectedCategoryId] = useState('')
  const [selectedSubcategoryId, setSelectedSubcategoryId] = useState('')
  const [parentServiceId, setParentServiceId] = useState('')
  const [name, setName] = useState('')
  const [sortOrder, setSortOrder] = useState(0)
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState(0)
  const [originalPrice, setOriginalPrice] = useState(0)
  const [estimatedDurationMins, setEstimatedDurationMins] = useState(30)
  const [iconUrl, setIconUrl] = useState('')
  const [isActive, setIsActive] = useState(true)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open && subService) {
      const parent = services.find((s) => s._id === subService.serviceId)
      setSelectedCategoryId(subService.categoryId || parent?.categoryId || '')
      setSelectedSubcategoryId(subService.subcategoryId || parent?.subcategoryId || '')
      setParentServiceId(subService.serviceId || '')
      setName(subService.name || '')
      setSortOrder(subService.sortOrder ?? 0)
      setDescription(subService.description || '')
      setPrice(subService.price || 0)
      setOriginalPrice(subService.originalPrice || subService.price || 0)
      setEstimatedDurationMins(subService.estimatedDurationMins || 30)
      setIconUrl(subService.iconUrl || '')
      setIsActive(subService.isActive !== false)
      setError('')
    }
  }, [open, subService, services])

  // Subcategories filtered by category
  const availableSubcategories = useMemo(() => {
    if (!selectedCategoryId) return subcategories
    return subcategories.filter((sc) => String(sc.categoryId) === String(selectedCategoryId))
  }, [subcategories, selectedCategoryId])

  // Services filtered by category and/or subcategory
  const availableServices = useMemo(() => {
    return services.filter((s) => {
      if (selectedCategoryId && String(s.categoryId) !== String(selectedCategoryId)) return false
      if (selectedSubcategoryId && String(s.subcategoryId) !== String(selectedSubcategoryId)) return false
      return true
    })
  }, [services, selectedCategoryId, selectedSubcategoryId])

  const handleCategoryChange = (catId) => {
    setSelectedCategoryId(catId)
    let newSubcatId = selectedSubcategoryId
    if (selectedSubcategoryId && catId) {
      const sub = subcategories.find((sc) => sc._id === selectedSubcategoryId)
      if (sub && String(sub.categoryId) !== String(catId)) {
        newSubcatId = ''
        setSelectedSubcategoryId('')
      }
    }

    const isValid = services.some(
      (s) =>
        s._id === parentServiceId &&
        (!catId || String(s.categoryId) === String(catId)) &&
        (!newSubcatId || String(s.subcategoryId) === String(newSubcatId))
    )
    if (!isValid) {
      const firstValid = services.find(
        (s) =>
          (!catId || String(s.categoryId) === String(catId)) &&
          (!newSubcatId || String(s.subcategoryId) === String(newSubcatId))
      )
      setParentServiceId(firstValid?._id || '')
    }
  }

  const handleSubcategoryChange = (subcatId) => {
    setSelectedSubcategoryId(subcatId)
    let newCatId = selectedCategoryId
    if (subcatId) {
      const sub = subcategories.find((sc) => sc._id === subcatId)
      if (sub && sub.categoryId) {
        newCatId = sub.categoryId
        setSelectedCategoryId(sub.categoryId)
      }
    }

    const isValid = services.some(
      (s) =>
        s._id === parentServiceId &&
        (!newCatId || String(s.categoryId) === String(newCatId)) &&
        (!subcatId || String(s.subcategoryId) === String(subcatId))
    )
    if (!isValid) {
      const firstValid = services.find(
        (s) =>
          (!newCatId || String(s.categoryId) === String(newCatId)) &&
          (!subcatId || String(s.subcategoryId) === String(subcatId))
      )
      setParentServiceId(firstValid?._id || '')
    }
  }

  const handleServiceChange = (srvId) => {
    setParentServiceId(srvId)
    if (srvId) {
      const srv = services.find((s) => s._id === srvId)
      if (srv) {
        if (srv.categoryId) setSelectedCategoryId(srv.categoryId)
        if (srv.subcategoryId) setSelectedSubcategoryId(srv.subcategoryId)
      }
    }
  }

  const serviceOptions = useMemo(() => {
    return availableServices.map((s) => ({
      value: s._id,
      label: `${s.name} (${s.subcategoryName} • ${s.categoryName})`,
    }))
  }, [availableServices])

  if (!open || !subService) return null

  async function handleFilePick(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please choose a valid image file.')
      return
    }
    setError('')
    setUploadBusy(true)
    try {
      const uploaded = await uploadMedia(file, UPLOAD_FOLDERS.LABOUR_CATEGORIES)
      const url = assetUrlFromUpload(uploaded)
      if (url) setIconUrl(url)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Image upload failed')
    } finally {
      setUploadBusy(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!parentServiceId) {
      setError('Please select a parent service.')
      return
    }
    if (!name.trim()) {
      setError('Sub-service name is required.')
      return
    }

    setBusy(true)
    setError('')
    try {
      const oldParentId = subService.serviceId
      const newParentId = parentServiceId

      const updatedPayload = {
        _id: subService._id,
        name: name.trim(),
        sortOrder: Number(sortOrder) || 0,
        description: description.trim(),
        price: Number(price) || 0,
        originalPrice: Number(originalPrice) || Number(price) || 0,
        estimatedDurationMins: Number(estimatedDurationMins) || 30,
        iconUrl: iconUrl.trim(),
        isActive: Boolean(isActive),
      }

      if (oldParentId === newParentId) {
        // Same parent service: update in place
        const parent = services.find((s) => s._id === oldParentId)
        const updatedList = (parent?.subServices || []).map((ss) =>
          String(ss._id) === String(subService._id) ? updatedPayload : ss
        )
        await updateAdminLabourService(oldParentId, { subServices: updatedList })
      } else {
        // Moved to a different parent service: remove from old, add to new
        const oldParent = services.find((s) => s._id === oldParentId)
        const newParent = services.find((s) => s._id === newParentId)

        if (oldParent) {
          const filteredOld = (oldParent.subServices || []).filter(
            (ss) => String(ss._id) !== String(subService._id)
          )
          await updateAdminLabourService(oldParentId, { subServices: filteredOld })
        }

        if (newParent) {
          const appendedNew = [...(newParent.subServices || []), updatedPayload]
          await updateAdminLabourService(newParentId, { subServices: appendedNew })
        }
      }

      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update sub-service')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
        onClick={() => !busy && !uploadBusy && onClose()}
      />
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl overflow-hidden"
      >
        <div className="border-b border-slate-100 px-5 py-4 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Edit2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Edit Sub-Service</h3>
              <p className="text-xs text-slate-500">Update variant pricing & details</p>
            </div>
          </div>
          <button
            onClick={() => !busy && !uploadBusy && onClose()}
            className="p-1 text-slate-400 hover:text-slate-600 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-5 max-h-[80vh] overflow-y-auto">
          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-800 font-medium">
              {error}
            </div>
          )}

          {/* Category & Sub-Category Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <Layers className="h-3.5 w-3.5 text-slate-400" />
                <span>Category</span>
              </label>
              <SearchableSelect
                value={selectedCategoryId}
                onChange={handleCategoryChange}
                options={[
                  { value: '', label: '📁 All Categories' },
                  ...categories.map((c) => ({ value: c._id, label: c.name })),
                ]}
                placeholder="Choose category"
              />
            </div>

            <div>
              <label className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <Tag className="h-3.5 w-3.5 text-slate-400" />
                <span>Sub-Category</span>
              </label>
              <SearchableSelect
                value={selectedSubcategoryId}
                onChange={handleSubcategoryChange}
                options={[
                  { value: '', label: '🏷️ All Sub-Categories' },
                  ...availableSubcategories.map((sc) => ({
                    value: sc._id,
                    label: selectedCategoryId ? sc.name : `${sc.name} (${sc.categoryName})`,
                  })),
                ]}
                placeholder="Choose sub-category"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              <Wrench className="h-3.5 w-3.5 text-slate-400" />
              <span>Parent Service</span>
              <span className="text-rose-500">*</span>
            </label>
            <SearchableSelect
              value={parentServiceId}
              onChange={handleServiceChange}
              options={serviceOptions}
              placeholder={
                serviceOptions.length === 0
                  ? 'No services available in this category'
                  : 'Select parent service'
              }
            />
            {serviceOptions.length === 0 ? (
              <p className="mt-1 text-xs text-amber-600 font-medium">
                No services found under this selection. Change category or create a service first.
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-slate-400">
                {availableServices.length} {availableServices.length === 1 ? 'service' : 'services'} available
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Sub-Service Name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/35 transition"
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Sort Order
              </label>
              <input
                type="number"
                placeholder="0"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/35 transition"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/35 transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Selling Price (₹) <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 pl-9 pr-3.5 py-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-brand/35 transition"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                MRP / Original Price (₹)
              </label>
              <div className="relative">
                <IndianRupee className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={originalPrice}
                  onChange={(e) => setOriginalPrice(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 pl-9 pr-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/35 transition"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Duration (Minutes)
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="number"
                  min="5"
                  step="5"
                  value={estimatedDurationMins}
                  onChange={(e) => setEstimatedDurationMins(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 pl-9 pr-3.5 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/35 transition"
                />
              </div>
            </div>

            <div className="flex flex-col justify-end">
              <label className="flex items-center gap-2 cursor-pointer rounded-xl border border-slate-200 px-3.5 py-2 bg-slate-50/50 hover:bg-slate-50 transition">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                />
                <span className="text-xs font-bold text-slate-700">Active for Booking</span>
              </label>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Icon / Thumbnail
            </label>
            <div className="flex items-center gap-3">
              {iconUrl ? (
                <div className="h-12 w-12 shrink-0 rounded-xl border border-slate-200 bg-slate-100 overflow-hidden relative group">
                  <img src={iconUrl} alt="Icon preview" className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => setIconUrl('')}
                    className="absolute inset-0 bg-slate-900/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <div className="h-12 w-12 shrink-0 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center text-slate-400 bg-slate-50">
                  <Upload className="h-5 w-5" />
                </div>
              )}
              <div className="flex-1 space-y-1">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFilePick}
                  disabled={uploadBusy}
                  className="text-xs text-slate-500 file:mr-2 file:rounded-lg file:border-0 file:bg-slate-100 file:px-2.5 file:py-1 file:text-xs file:font-bold hover:file:bg-slate-200"
                />
                <input
                  type="url"
                  placeholder="Or paste direct image URL"
                  value={iconUrl}
                  onChange={(e) => setIconUrl(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-2.5 py-1 text-xs outline-none focus:ring-1 focus:ring-brand"
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={busy || uploadBusy}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <AppPrimaryButton type="submit" disabled={busy || uploadBusy}>
              {busy ? 'Saving...' : 'Update Sub-Service'}
            </AppPrimaryButton>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

function ViewSubServiceModal({ subService, onClose }) {
  if (!subService) return null

  const discountPercent =
    Number(subService.originalPrice) > Number(subService.price) && Number(subService.originalPrice) > 0
      ? Math.round(((Number(subService.originalPrice) - Number(subService.price)) / Number(subService.originalPrice)) * 100)
      : 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden"
      >
        <div className="border-b border-slate-100 px-5 py-4 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-50 text-cyan-600">
              <Eye className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900">Sub-Service Details</h3>
              <p className="text-xs text-slate-500">Overview of variant configuration</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 transition">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {subService.iconUrl && (
            <div className="aspect-video w-full rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
              <img src={subService.iconUrl} alt={subService.name} className="h-full w-full object-cover" />
            </div>
          )}

          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sub-Service Name</span>
            <p className="text-sm font-bold text-slate-900 mt-0.5">{subService.name}</p>
          </div>

          {subService.description && (
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Description</span>
              <p className="text-slate-600 mt-0.5 leading-relaxed">{subService.description}</p>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 space-y-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Hierarchy</span>
            <div className="flex flex-wrap items-center gap-1.5 font-semibold text-slate-700">
              <span className="rounded-md bg-purple-100 text-purple-900 px-2 py-0.5 text-[10px] font-bold">
                {subService.categoryName}
              </span>
              <ArrowRight className="h-3 w-3 text-slate-400" />
              <span className="rounded-md bg-blue-100 text-blue-900 px-2 py-0.5 text-[10px] font-bold">
                {subService.subcategoryName}
              </span>
              <ArrowRight className="h-3 w-3 text-slate-400" />
              <span className="rounded-md bg-emerald-100 text-emerald-900 px-2 py-0.5 text-[10px] font-bold">
                {subService.serviceName}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Selling Price</span>
              <p className="text-base font-extrabold text-brand mt-0.5">₹{subService.price}</p>
              {discountPercent > 0 && (
                <p className="text-[10px] text-slate-400 line-through">MRP: ₹{subService.originalPrice}</p>
              )}
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Duration</span>
              <p className="text-sm font-bold text-slate-800 mt-0.5 flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-slate-500" /> {subService.estimatedDurationMins || 30} mins
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Sort Order</span>
              <p className="text-sm font-bold text-slate-800 mt-0.5">{subService.sortOrder ?? 0}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Status</span>
              <div>
                <span
                  className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${
                    subService.isActive !== false
                      ? 'bg-emerald-50 text-emerald-800 ring-emerald-200'
                      : 'bg-slate-100 text-slate-500 ring-slate-200'
                  }`}
                >
                  {subService.isActive !== false ? 'Active' : 'Hidden'}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  )
}

function DeleteSubServiceModal({ open, subService, onClose, onConfirmed, busy }) {
  if (!open || !subService) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
        onClick={() => !busy && onClose()}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl text-center"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 mb-3">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h3 className="text-base font-extrabold text-slate-900">Delete Sub-Service?</h3>
        <p className="mt-1.5 text-xs text-slate-500">
          Are you sure you want to remove <span className="font-bold text-slate-800">&quot;{subService.name}&quot;</span> from {subService.serviceName}?
        </p>
        <div className="mt-5 flex items-center justify-center gap-2.5">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirmed}
            className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 transition"
          >
            {busy ? 'Deleting...' : 'Yes, Delete'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

function BulkDeleteSubServiceModal({ open, count, onClose, onConfirmed, busy }) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
        onClick={() => !busy && onClose()}
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl text-center"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 mb-4">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h3 className="text-base font-extrabold text-slate-900">
          Delete {count} {count === 1 ? 'Sub-Service' : 'Sub-Services'}?
        </h3>
        <p className="mt-1.5 text-xs text-slate-500">
          Are you sure you want to delete <span className="font-bold text-slate-800">{count} selected {count === 1 ? 'sub-service' : 'sub-services'}</span>? This will remove them from their parent services.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirmed}
            className="flex-1 rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50 transition"
          >
            {busy ? 'Deleting...' : 'Delete All'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export function AdminSubServicesPage() {
  const reduce = useReducedMotion()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [categories, setCategories] = useState([])
  const [subcategories, setSubcategories] = useState([])
  const [services, setServices] = useState([])
  const [subServices, setSubServices] = useState([])

  // Selection state for multiple delete
  const [selectedIds, setSelectedIds] = useState([])
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false)
  const [bulkDeleteBusy, setBulkDeleteBusy] = useState(false)

  // Search & Filters
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [subcategoryFilter, setSubcategoryFilter] = useState('all')
  const [serviceFilter, setServiceFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')

  // Pagination
  const [page, setPage] = useState(1)
  const limit = 12

  // Modals
  const [modalBusy, setModalBusy] = useState(false)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editSubService, setEditSubService] = useState(null)
  const [viewSubService, setViewSubService] = useState(null)
  const [deleteSubService, setDeleteSubService] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchAdminLabourCategoryTree()
      const cats = res.data?.categories || []
      setCategories(cats)

      const flatSubcats = cats.flatMap((c) =>
        (c.subcategories || []).map((sc) => ({
          ...sc,
          categoryId: c._id,
          categoryName: c.name,
        }))
      )
      setSubcategories(flatSubcats)

      const flatServices = flatSubcats.flatMap((sc) =>
        (sc.services || []).map((s) => ({
          ...s,
          subcategoryId: sc._id,
          subcategoryName: sc.name,
          categoryId: sc.categoryId,
          categoryName: sc.categoryName,
        }))
      )
      setServices(flatServices)

      const flatSubServices = flatServices.flatMap((service) =>
        (service.subServices || []).map((ss) => ({
          ...ss,
          serviceId: service._id,
          serviceName: service.name,
          subcategoryId: service.subcategoryId,
          subcategoryName: service.subcategoryName,
          categoryId: service.categoryId,
          categoryName: service.categoryName,
        }))
      )
      setSubServices(flatSubServices)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load sub-services')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Filter cascading
  const availableSubcategories = useMemo(() => {
    if (categoryFilter === 'all') return subcategories
    return subcategories.filter((sc) => String(sc.categoryId) === categoryFilter)
  }, [subcategories, categoryFilter])

  const availableServices = useMemo(() => {
    let list = services
    if (categoryFilter !== 'all') {
      list = list.filter((s) => String(s.categoryId) === categoryFilter)
    }
    if (subcategoryFilter !== 'all') {
      list = list.filter((s) => String(s.subcategoryId) === subcategoryFilter)
    }
    return list
  }, [services, categoryFilter, subcategoryFilter])

  // Filtered sub-services
  const filteredSubServices = useMemo(() => {
    let result = subServices

    if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (ss) =>
          ss.name.toLowerCase().includes(q) ||
          ss.serviceName.toLowerCase().includes(q) ||
          ss.subcategoryName.toLowerCase().includes(q) ||
          (ss.description || '').toLowerCase().includes(q)
      )
    }

    if (categoryFilter !== 'all') {
      result = result.filter((ss) => String(ss.categoryId) === categoryFilter)
    }

    if (subcategoryFilter !== 'all') {
      result = result.filter((ss) => String(ss.subcategoryId) === subcategoryFilter)
    }

    if (serviceFilter !== 'all') {
      result = result.filter((ss) => String(ss.serviceId) === serviceFilter)
    }

    if (statusFilter === 'active') {
      result = result.filter((ss) => ss.isActive !== false)
    } else if (statusFilter === 'inactive') {
      result = result.filter((ss) => ss.isActive === false)
    }

    return [...result].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name))
  }, [subServices, search, categoryFilter, subcategoryFilter, serviceFilter, statusFilter])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredSubServices.length / limit))
  const paginatedItems = useMemo(() => {
    const start = (page - 1) * limit
    return filteredSubServices.slice(start, start + limit)
  }, [filteredSubServices, page, limit])

  // Toggle active status
  async function handleToggleStatus(ss) {
    const parent = services.find((s) => s._id === ss.serviceId)
    if (!parent) return

    const updatedList = (parent.subServices || []).map((item) =>
      String(item._id) === String(ss._id) ? { ...item, isActive: !item.isActive } : item
    )

    try {
      await updateAdminLabourService(parent._id, { subServices: updatedList })
      await loadData()
    } catch (err) {
      console.error('Failed to toggle status:', err)
    }
  }

  // Confirm delete
  async function handleConfirmDelete() {
    if (!deleteSubService) return
    setModalBusy(true)
    try {
      const parent = services.find((s) => s._id === deleteSubService.serviceId)
      if (parent) {
        const filtered = (parent.subServices || []).filter(
          (ss) => String(ss._id) !== String(deleteSubService._id)
        )
        await updateAdminLabourService(parent._id, { subServices: filtered })
      }
      setDeleteSubService(null)
      await loadData()
    } catch (err) {
      console.error('Failed to delete sub-service:', err)
    } finally {
      setModalBusy(false)
    }
  }

  const getSubServiceKey = (ss) => (ss && ss._id ? String(ss._id) : `${ss?.serviceId}:::${ss?.name}`)

  const isAllCurrentSelected = paginatedItems.length > 0 && paginatedItems.every(ss => selectedIds.includes(getSubServiceKey(ss)))

  const toggleSelectAll = () => {
    if (isAllCurrentSelected) {
      setSelectedIds(prev => prev.filter(id => !paginatedItems.some(ss => getSubServiceKey(ss) === id)))
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...paginatedItems.map(ss => getSubServiceKey(ss))])))
    }
  }

  const toggleSelectOne = (key) => {
    setSelectedIds(prev => prev.includes(key) ? prev.filter(x => x !== key) : [...prev, key])
  }

  async function handleBulkDelete() {
    if (!selectedIds.length) return
    setBulkDeleteBusy(true)
    try {
      const selectedItems = subServices.filter(ss => selectedIds.includes(getSubServiceKey(ss)))
      const groupedByService = {}
      selectedItems.forEach(item => {
        if (!groupedByService[item.serviceId]) {
          groupedByService[item.serviceId] = []
        }
        groupedByService[item.serviceId].push(getSubServiceKey(item))
      })

      const updatePromises = Object.entries(groupedByService).map(async ([srvId, keysToDelete]) => {
        const parent = services.find(s => String(s._id) === String(srvId))
        if (!parent) return
        const remaining = (parent.subServices || []).filter(ss => {
          const key = getSubServiceKey(ss)
          return !keysToDelete.includes(key)
        })
        return updateAdminLabourService(parent._id, { subServices: remaining })
      })

      const results = await Promise.allSettled(updatePromises)
      const failed = results.filter(r => r.status === 'rejected')
      if (failed.length > 0) {
        alert(`Failed to remove sub-services from ${failed.length} parent services.`)
      }
      setSelectedIds([])
      setBulkDeleteModalOpen(false)
      await loadData()
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Bulk delete failed')
    } finally {
      setBulkDeleteBusy(false)
    }
  }

  const hasActiveFilters =
    search || categoryFilter !== 'all' || subcategoryFilter !== 'all' || serviceFilter !== 'all' || statusFilter !== 'all'

  function resetFilters() {
    setSearch('')
    setCategoryFilter('all')
    setSubcategoryFilter('all')
    setServiceFilter('all')
    setStatusFilter('all')
    setPage(1)
  }

  // Stats counters
  const activeCount = useMemo(() => subServices.filter((s) => s.isActive !== false).length, [subServices])
  const servicesWithVariantsCount = useMemo(
    () => new Set(subServices.map((s) => s.serviceId)).size,
    [subServices]
  )

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <GlassPanel className="p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
              <ListTree className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
                  Sub-Services
                </h1>
                <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-black text-brand">
                  {subServices.length}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">
                Manage granular variants, add-on options, and pricing linked to individual services.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-2xs hover:bg-slate-50 transition active:scale-95 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <AppPrimaryButton onClick={() => setAddModalOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              <span>Add Sub-Service</span>
            </AppPrimaryButton>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Variants</span>
            <p className="text-xl font-black text-slate-900 mt-0.5">{subServices.length}</p>
          </div>
          <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-3.5 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">Active</span>
            <p className="text-xl font-black text-emerald-800 mt-0.5">{activeCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3.5 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Inactive</span>
            <p className="text-xl font-black text-slate-600 mt-0.5">{subServices.length - activeCount}</p>
          </div>
          <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/40 p-3.5 shadow-2xs">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-700">Services With Variants</span>
            <p className="text-xl font-black text-indigo-900 mt-0.5">{servicesWithVariantsCount}</p>
          </div>
        </div>
      </GlassPanel>

      {/* Filters Bar */}
      <GlassPanel className="p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1 relative">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by sub-service, parent service, or description..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
              className="w-full rounded-xl border border-slate-200 bg-white pl-9 pr-8 py-2 text-xs font-medium text-slate-800 outline-none focus:border-brand focus:ring-1 focus:ring-brand shadow-2xs transition"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value)
                setSubcategoryFilter('all')
                setServiceFilter('all')
                setPage(1)
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-brand shadow-2xs"
            >
              <option value="all">📁 All Categories</option>
              {categories.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Sub-Category Filter */}
            <select
              value={subcategoryFilter}
              onChange={(e) => {
                setSubcategoryFilter(e.target.value)
                setServiceFilter('all')
                setPage(1)
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-brand shadow-2xs"
            >
              <option value="all">🏷️ All Sub-Categories</option>
              {availableSubcategories.map((sc) => (
                <option key={sc._id} value={sc._id}>
                  {sc.name}
                </option>
              ))}
            </select>

            {/* Parent Service Filter */}
            <select
              value={serviceFilter}
              onChange={(e) => {
                setServiceFilter(e.target.value)
                setPage(1)
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-brand shadow-2xs max-w-[200px] truncate"
            >
              <option value="all">🔧 All Services</option>
              {availableServices.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value)
                setPage(1)
              }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 outline-none focus:border-brand shadow-2xs"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs font-bold text-brand hover:underline px-2 py-1"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </GlassPanel>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50/90 px-4 py-3 shadow-xs"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-100 text-rose-700 font-bold text-xs">
              {selectedIds.length}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-rose-950">
                {selectedIds.length === 1 ? '1 sub-service selected' : `${selectedIds.length} sub-services selected`}
              </span>
              {selectedIds.length < filteredSubServices.length && (
                <button
                  type="button"
                  onClick={() => setSelectedIds(filteredSubServices.map(ss => getSubServiceKey(ss)))}
                  className="text-xs font-semibold text-rose-700 underline hover:text-rose-900 transition ml-1"
                >
                  Select all {filteredSubServices.length} matching
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
            >
              Clear Selection
            </button>
            <button
              type="button"
              onClick={() => setBulkDeleteModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-rose-500 transition active:scale-95"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete Selected ({selectedIds.length})
            </button>
          </div>
        </motion.div>
      )}

      {/* Main Table Content */}
      <GlassPanel className="overflow-hidden p-0 shadow-sm border border-slate-200/90 bg-white">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-slate-400">
            <RefreshCw className="h-8 w-8 animate-spin text-brand mb-2" />
            <p className="text-xs font-medium">Loading sub-services...</p>
          </div>
        ) : error ? (
          <div className="p-8 text-center">
            <AlertTriangle className="h-8 w-8 text-rose-500 mx-auto mb-2" />
            <p className="text-xs text-rose-600 font-bold">{error}</p>
            <button
              onClick={loadData}
              className="mt-3 rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white"
            >
              Retry
            </button>
          </div>
        ) : paginatedItems.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <ListTree className="h-7 w-7" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">No sub-services found</h4>
              <p className="text-xs text-slate-500 mt-0.5">
                {hasActiveFilters
                  ? 'No sub-services match the selected filters or search keyword.'
                  : 'Get started by creating your first sub-service variant for a service.'}
              </p>
            </div>
            {hasActiveFilters ? (
              <button
                onClick={resetFilters}
                className="rounded-xl border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-2xs"
              >
                Clear Filters
              </button>
            ) : (
              <AppPrimaryButton onClick={() => setAddModalOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> Add Sub-Service
              </AppPrimaryButton>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                  <th className="py-3.5 pl-5 pr-2 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={isAllCurrentSelected}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/35 cursor-pointer accent-brand"
                      title="Select all on current page"
                    />
                  </th>
                  <th className="py-3.5 px-3">Sub-Service Variant</th>
                  <th className="px-3 py-3.5">Parent Service & Category</th>
                  <th className="px-3 py-3.5 text-center">Sort Order</th>
                  <th className="px-3 py-3.5">Price & MRP</th>
                  <th className="px-3 py-3.5">Duration</th>
                  <th className="px-3 py-3.5 text-center">Status</th>
                  <th className="py-3.5 pl-3 pr-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginatedItems.map((ss) => {
                  const discount =
                    Number(ss.originalPrice) > Number(ss.price) && Number(ss.originalPrice) > 0
                      ? Math.round(((Number(ss.originalPrice) - Number(ss.price)) / Number(ss.originalPrice)) * 100)
                      : 0

                  return (
                    <motion.tr
                      key={ss._id || `${ss.serviceId}_${ss.name}`}
                      initial={reduce ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`hover:bg-slate-50/60 transition group ${
                        selectedIds.includes(getSubServiceKey(ss)) ? 'bg-rose-50/40' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3.5 pl-5 pr-2 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(getSubServiceKey(ss))}
                          onChange={() => toggleSelectOne(getSubServiceKey(ss))}
                          className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/35 cursor-pointer accent-brand"
                        />
                      </td>

                      {/* Name & Thumbnail */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 shrink-0 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center text-slate-400">
                            {ss.iconUrl ? (
                              <img src={ss.iconUrl} alt={ss.name} className="h-full w-full object-cover" />
                            ) : (
                              <ListTree className="h-5 w-5 text-slate-400" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-900 text-xs leading-snug group-hover:text-brand transition">
                              {ss.name}
                            </p>
                            {ss.description && (
                              <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                                {ss.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Parent Service Breadcrumb */}
                      <td className="px-3 py-3.5">
                        <div className="space-y-0.5">
                          <p className="font-bold text-slate-800 text-xs flex items-center gap-1">
                            <Wrench className="h-3 w-3 text-brand shrink-0" />
                            <span className="truncate max-w-[200px]">{ss.serviceName}</span>
                          </p>
                          <p className="text-[10px] text-slate-400 flex items-center gap-1">
                            <span>{ss.categoryName}</span>
                            <span>•</span>
                            <span>{ss.subcategoryName}</span>
                          </p>
                        </div>
                      </td>

                      {/* Sort Order */}
                      <td className="px-3 py-3.5 text-center">
                        <span className="font-bold text-slate-800 rounded-lg bg-slate-100 px-2.5 py-1 text-xs">
                          {ss.sortOrder ?? 0}
                        </span>
                      </td>

                      {/* Pricing */}
                      <td className="px-3 py-3.5">
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-xs font-black text-slate-900">₹{ss.price}</span>
                          {discount > 0 && (
                            <>
                              <span className="text-[10px] text-slate-400 line-through">₹{ss.originalPrice}</span>
                              <span className="rounded bg-rose-50 px-1 py-0.2 text-[9px] font-black text-rose-700">
                                {discount}% OFF
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                      {/* Duration */}
                      <td className="px-3 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                          <Clock className="h-3 w-3 text-slate-400" />
                          {ss.estimatedDurationMins || 30} mins
                        </span>
                      </td>

                      {/* Status Toggle */}
                      <td className="px-3 py-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleStatus(ss)}
                          title="Click to toggle status"
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase transition hover:opacity-85 ${
                            ss.isActive !== false
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {ss.isActive !== false ? (
                            <>
                              <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600" /> Active
                            </>
                          ) : (
                            <>
                              <XCircle className="h-2.5 w-2.5 text-slate-400" /> Inactive
                            </>
                          )}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 pl-3 pr-5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setViewSubService(ss)}
                            title="View Details"
                            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditSubService(ss)}
                            title="Edit Sub-Service"
                            className="p-1.5 text-slate-400 hover:text-brand rounded-lg hover:bg-brand/10 transition"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteSubService(ss)}
                            title="Delete Sub-Service"
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {!loading && filteredSubServices.length > limit && (
          <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/50 px-5 py-3 text-xs text-slate-600">
            <span>
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, filteredSubServices.length)} of{' '}
              {filteredSubServices.length} sub-services
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
              >
                Prev
              </button>
              <span className="px-2 font-bold text-slate-800">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-40 transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </GlassPanel>

      {/* Modals */}
      <AddSubServiceModal
        open={addModalOpen}
        categories={categories}
        subcategories={subcategories}
        services={services}
        defaultCategoryId={categoryFilter !== 'all' ? categoryFilter : ''}
        defaultSubcategoryId={subcategoryFilter !== 'all' ? subcategoryFilter : ''}
        defaultServiceId={serviceFilter !== 'all' ? serviceFilter : ''}
        onClose={() => setAddModalOpen(false)}
        onSaved={async () => {
          setAddModalOpen(false)
          await loadData()
        }}
        busy={modalBusy}
        setBusy={setModalBusy}
      />

      <EditSubServiceModal
        open={Boolean(editSubService)}
        subService={editSubService}
        categories={categories}
        subcategories={subcategories}
        services={services}
        onClose={() => setEditSubService(null)}
        onSaved={async () => {
          setEditSubService(null)
          await loadData()
        }}
        busy={modalBusy}
        setBusy={setModalBusy}
      />

      <ViewSubServiceModal
        subService={viewSubService}
        onClose={() => setViewSubService(null)}
      />

      <DeleteSubServiceModal
        open={Boolean(deleteSubService)}
        subService={deleteSubService}
        onClose={() => setDeleteSubService(null)}
        onConfirmed={handleConfirmDelete}
        busy={modalBusy}
      />

      <BulkDeleteSubServiceModal
        open={bulkDeleteModalOpen}
        count={selectedIds.length}
        onClose={() => setBulkDeleteModalOpen(false)}
        onConfirmed={handleBulkDelete}
        busy={bulkDeleteBusy}
      />
    </div>
  )
}
