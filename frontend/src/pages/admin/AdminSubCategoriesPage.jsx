import { useCallback, useEffect, useState, useMemo } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Plus, Search, RefreshCw, Edit2, Trash2, Tag, Eye, X, AlertTriangle } from 'lucide-react'
import {
  fetchAdminLabourCategoryTree,
  createAdminLabourSubcategory,
  updateAdminLabourSubcategory,
  deleteAdminLabourSubcategory,
  getAdminLabourSubcategoryById,
} from '../../api/adminLabourCategoriesApi.js'
import { ApiError } from '../../api/http.js'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { SearchableSelect } from '../../components/ui/SearchableSelect.jsx'
import { AppPrimaryButton } from '../../components/app/AppPrimaryButton.jsx'
import { getCategoryImageUrl } from '../../lib/labourCategoryDisplay.js'
import { UPLOAD_FOLDERS } from '../../constants/uploadFolders.js'
import { assetUrlFromUpload, uploadMedia } from '../../api/uploadApi.js'

function AddSubCategoryModal({ open, categories, onClose, onSaved, busy, setBusy }) {
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState('')
  const [iconUrl, setIconUrl] = useState('')
  const [uploadBusy, setUploadBusy] = useState(false)
  const [isActive, setIsActive] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setName('')
      setCategoryId(categories[0]?._id ?? '')
      setDescription('')
      setIconUrl('')
      setIsActive(true)
      setError('')
    }
  }, [open, categories])

  if (!open) return null

  async function handleFilePick(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.')
      return
    }
    setError('')
    setUploadBusy(true)
    try {
      const uploaded = await uploadMedia(file, UPLOAD_FOLDERS.LABOUR_CATEGORIES)
      const url = assetUrlFromUpload(uploaded)
      if (url) setIconUrl(url)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed')
    } finally {
      setUploadBusy(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !categoryId) {
      setError('Name and category are required.')
      return
    }
    setError('')
    setBusy(true)
    try {
      const payload = {
        name: name.trim(),
        categoryId,
        description: description.trim(),
        iconUrl,
        isActive
      }
      await createAdminLabourSubcategory(payload)
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save sub-category')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
        onClick={() => !busy && onClose()}
      />
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl"
      >
        <div className="border-b border-slate-100 px-5 py-4 flex justify-between items-center">
          <h3 className="text-lg font-extrabold text-slate-900">Add Sub-Category</h3>
          <button onClick={() => !busy && onClose()} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-5 max-h-[80vh] overflow-y-auto">
          {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">{error}</p>}
          
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Category</label>
              <SearchableSelect
                value={categoryId}
                onChange={setCategoryId}
                options={categories.map(c => ({ value: c._id, label: c.name }))}
                placeholder="Select a category"
              />
            </div>
            
            <div className="col-span-2">
              <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/35"
                required
              />
            </div>

            <div className="col-span-2">
              <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/35"
                placeholder="Optional description"
              />
            </div>


            <div className="flex items-center pt-5 col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/35"
                />
                <span className="text-sm font-semibold text-slate-700">Active</span>
              </label>
            </div>

            <div className="col-span-2 space-y-2">
              <label className="block text-[11px] font-bold uppercase text-slate-500">Image</label>
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100 ring-2 ring-slate-200">
                  {iconUrl ? (
                    <img src={getCategoryImageUrl({ iconUrl, imageUrl: iconUrl })} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-[10px] text-slate-400">None</span>
                  )}
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  <div className="flex gap-2">
                    <input type="file" accept="image/*" onChange={handleFilePick} className="hidden" id="add-subcat-img" />
                    <label
                      htmlFor="add-subcat-img"
                      className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                    >
                      {uploadBusy ? 'Uploading...' : 'Upload'}
                    </label>
                    {iconUrl && (
                      <button
                        type="button"
                        onClick={() => setIconUrl('')}
                        className="text-[11px] font-bold text-rose-600"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => !busy && !uploadBusy && onClose()}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <AppPrimaryButton type="submit" disabled={busy || uploadBusy} className="!w-auto px-6">
              {busy ? 'Creating...' : 'Create Sub-Category'}
            </AppPrimaryButton>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

function EditSubCategoryModal({ open, subcategory, categories, onClose, onSaved, busy, setBusy }) {
  const [name, setName] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [description, setDescription] = useState('')

  const [iconUrl, setIconUrl] = useState('')
  const [uploadBusy, setUploadBusy] = useState(false)
  const [isActive, setIsActive] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open && subcategory) {
      setName(subcategory.name || '')
      setCategoryId(subcategory.categoryId || (categories[0]?._id ?? ''))
      setDescription(subcategory.description || '')
      setIconUrl(subcategory.iconUrl || '')
      setIsActive(subcategory.isActive ?? true)
      setError('')
    }
  }, [open, subcategory, categories])

  if (!open || !subcategory) return null

  async function handleFilePick(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.')
      return
    }
    setError('')
    setUploadBusy(true)
    try {
      const uploaded = await uploadMedia(file, UPLOAD_FOLDERS.LABOUR_CATEGORIES)
      const url = assetUrlFromUpload(uploaded)
      if (url) setIconUrl(url)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed')
    } finally {
      setUploadBusy(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim() || !categoryId) {
      setError('Name and category are required.')
      return
    }
    setError('')
    setBusy(true)
    try {
      const payload = {
        name: name.trim(),
        categoryId,
        description: description.trim(),
        iconUrl,
        isActive
      }
      await updateAdminLabourSubcategory(subcategory._id, payload)
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save sub-category')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-slate-950/45 backdrop-blur-sm"
        onClick={() => !busy && onClose()}
      />
      <motion.div
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl"
      >
        <div className="border-b border-slate-100 px-5 py-4 flex justify-between items-center">
          <h3 className="text-lg font-extrabold text-slate-900">Edit Sub-Category</h3>
          <button onClick={() => !busy && onClose()} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-5 max-h-[80vh] overflow-y-auto">
          {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">{error}</p>}
          
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Category</label>
              <SearchableSelect
                value={categoryId}
                onChange={setCategoryId}
                options={categories.map(c => ({ value: c._id, label: c.name }))}
                placeholder="Select a category"
              />
            </div>
            
            <div className="col-span-2">
              <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/35"
                required
              />
            </div>

            <div className="col-span-2">
              <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/35"
                placeholder="Optional description"
              />
            </div>


            <div className="flex items-center pt-5 col-span-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/35"
                />
                <span className="text-sm font-semibold text-slate-700">Active</span>
              </label>
            </div>

            <div className="col-span-2 space-y-2">
              <label className="block text-[11px] font-bold uppercase text-slate-500">Image</label>
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100 ring-2 ring-slate-200">
                  {iconUrl ? (
                    <img src={getCategoryImageUrl({ iconUrl, imageUrl: iconUrl })} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-[10px] text-slate-400">None</span>
                  )}
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  <div className="flex gap-2">
                    <input type="file" accept="image/*" onChange={handleFilePick} className="hidden" id="edit-subcat-img" />
                    <label
                      htmlFor="edit-subcat-img"
                      className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                    >
                      {uploadBusy ? 'Uploading...' : 'Upload'}
                    </label>
                    {iconUrl && (
                      <button
                        type="button"
                        onClick={() => setIconUrl('')}
                        className="text-[11px] font-bold text-rose-600"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => !busy && !uploadBusy && onClose()}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <AppPrimaryButton type="submit" disabled={busy || uploadBusy} className="!w-auto px-6">
              {busy ? 'Saving...' : 'Save Changes'}
            </AppPrimaryButton>
          </div>
        </form>
      </motion.div>
    </div>
  )
}

function ViewSubCategoryModal({ open, subcategory, onClose }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open && subcategory?._id) {
      setLoading(true)
      setError('')
      getAdminLabourSubcategoryById(subcategory._id)
        .then(res => setData(res.data.subcategory))
        .catch(err => setError(err instanceof ApiError ? err.message : 'Failed to fetch details'))
        .finally(() => setLoading(false))
    } else {
      setData(null)
    }
  }, [open, subcategory])

  if (!open || !subcategory) return null
  
  const displayData = data || subcategory
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
        <div className="bg-slate-50 border-b border-slate-100 px-5 py-4 flex justify-between items-center">
          <h3 className="text-lg font-extrabold text-slate-900">Sub-Category Details</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          {loading ? (
            <div className="text-center py-10 text-slate-500">Loading details...</div>
          ) : error ? (
            <div className="text-center py-10 text-rose-500">{error}</div>
          ) : (
            <>
              <div className="text-center space-y-1">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 ring-4 ring-slate-50 shadow-sm mb-3 overflow-hidden">
                  {displayData.iconUrl ? (
                    <img src={getCategoryImageUrl({ iconUrl: displayData.iconUrl, imageUrl: displayData.iconUrl })} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Tag className="h-6 w-6 text-slate-400" />
                  )}
                </div>
                <h4 className="text-xl font-bold text-slate-900">{displayData.name}</h4>
                <p className="text-sm font-semibold text-brand">{displayData.categoryName}</p>
              </div>
              
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 space-y-3">
                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-400">Description</p>
                  <p className="text-sm font-medium text-slate-700">{displayData.description || '—'}</p>
                </div>

                <div>
                  <p className="text-[10px] font-bold uppercase text-slate-400">Status</p>
                  <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${
                    displayData.isActive ? 'bg-blue-50 text-blue-700 ring-blue-200' : 'bg-slate-100 text-slate-500 ring-slate-200'
                  }`}>
                    {displayData.isActive ? 'Active' : 'Hidden'}
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
        <div className="bg-slate-50 px-5 py-4 text-right">
          <button
            onClick={onClose}
            className="rounded-xl bg-white border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  )
}

function DeleteSubCategoryModal({ open, subcategory, onClose, onDeleted, busy, setBusy }) {
  if (!open || !subcategory) return null

  async function handleConfirm() {
    setBusy(true)
    try {
      await deleteAdminLabourSubcategory(subcategory._id)
      onDeleted()
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Delete failed')
      setBusy(false)
    }
  }

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
        className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6 text-center"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 mb-4">
          <AlertTriangle className="h-6 w-6 text-rose-600" />
        </div>
        <h3 className="text-lg font-extrabold text-slate-900">Delete Sub-Category?</h3>
        <p className="mt-2 text-sm text-slate-600">
          Are you sure you want to delete <span className="font-bold text-slate-900">{subcategory.name}</span>? This action cannot be undone.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => !busy && onClose()}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={busy}
            className="flex-1 rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-rose-500 disabled:opacity-50"
          >
            {busy ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

function BulkDeleteSubCategoryModal({ open, count, onClose, onConfirmed, busy }) {
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
        className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl p-6 text-center"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 mb-4">
          <AlertTriangle className="h-6 w-6 text-rose-600" />
        </div>
        <h3 className="text-lg font-extrabold text-slate-900">Delete {count} {count === 1 ? 'Sub-Category' : 'Sub-Categories'}?</h3>
        <p className="mt-2 text-sm text-slate-600">
          Are you sure you want to delete <span className="font-bold text-slate-900">{count} selected {count === 1 ? 'sub-category' : 'sub-categories'}</span>? This action cannot be undone.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => !busy && onClose()}
            className="flex-1 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirmed}
            disabled={busy}
            className="flex-1 rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-rose-500 disabled:opacity-50"
          >
            {busy ? 'Deleting...' : 'Delete All'}
          </button>
        </div>
      </motion.div>
    </div>
  )
}

export function AdminSubCategoriesPage() {
  const reduce = useReducedMotion()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  
  const [categories, setCategories] = useState([])
  const [subcategories, setSubcategories] = useState([])

  // Selection state for multiple delete
  const [selectedIds, setSelectedIds] = useState([])
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false)
  const [bulkDeleteBusy, setBulkDeleteBusy] = useState(false)
  
  // Filters & Search
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('all')

  // Pagination
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(10)

  // Modals state
  const [modalBusy, setModalBusy] = useState(false)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [editSubCategory, setEditSubCategory] = useState(null)
  const [viewSubCategory, setViewSubCategory] = useState(null)
  const [deleteSubCategory, setDeleteSubCategory] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetchAdminLabourCategoryTree()
      const fetchedCategories = res.data?.categories || []
      setCategories(fetchedCategories)
      
      const flatSubcategories = fetchedCategories.flatMap(c => 
        (c.subcategories || []).map(sc => ({
          ...sc,
          categoryId: c._id,
          categoryName: c.name
        }))
      )
      setSubcategories(flatSubcategories)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load sub-categories')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Debounce search
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search)
      setPage(1)
    }, 300)
    return () => clearTimeout(handler)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [statusFilter, categoryFilter, limit])

  const filteredSubCategories = useMemo(() => {
    let result = subcategories

    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase()
      result = result.filter(sc => 
        sc.name.toLowerCase().includes(q) || 
        sc.categoryName.toLowerCase().includes(q) ||
        (sc.description || '').toLowerCase().includes(q)
      )
    }

    if (statusFilter === 'active') result = result.filter(sc => sc.isActive)
    else if (statusFilter === 'hidden') result = result.filter(sc => !sc.isActive)

    if (categoryFilter !== 'all') {
      result = result.filter(sc => sc.categoryId === categoryFilter)
    }

    return result
  }, [subcategories, debouncedSearch, statusFilter, categoryFilter])

  const totalPages = Math.ceil(filteredSubCategories.length / limit) || 1
  const paginatedSubCategories = filteredSubCategories.slice((page - 1) * limit, page * limit)
  const activeCount = subcategories.filter(sc => sc.isActive).length

  const isAllCurrentSelected = paginatedSubCategories.length > 0 && paginatedSubCategories.every(sc => selectedIds.includes(sc._id))

  const toggleSelectAll = () => {
    if (isAllCurrentSelected) {
      setSelectedIds(prev => prev.filter(id => !paginatedSubCategories.some(sc => sc._id === id)))
    } else {
      setSelectedIds(prev => Array.from(new Set([...prev, ...paginatedSubCategories.map(sc => sc._id)])))
    }
  }

  const toggleSelectOne = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function handleBulkDelete() {
    if (!selectedIds.length) return
    setBulkDeleteBusy(true)
    try {
      const results = await Promise.allSettled(
        selectedIds.map(id => deleteAdminLabourSubcategory(id))
      )
      const failed = results.filter(r => r.status === 'rejected')
      if (failed.length > 0) {
        alert(`Failed to delete ${failed.length} sub-categories. Note: sub-categories with linked services cannot be deleted until services are removed.`)
      }
      setSelectedIds([])
      setBulkDeleteModalOpen(false)
      load()
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Bulk delete failed')
    } finally {
      setBulkDeleteBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-10">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <h2 className="text-xl font-extrabold text-slate-900">Sub-Categories</h2>
          <p className="mt-1 text-sm text-slate-600">Manage sub-categories mapping to main categories.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-brand/30 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <AppPrimaryButton onClick={() => setAddModalOpen(true)} className="!w-auto px-4 shadow-md">
            <Plus className="h-4 w-4" />
            Add Sub-Category
          </AppPrimaryButton>
        </div>
      </motion.div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <GlassPanel className="p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">Total Sub-Categories</p>
          <p className="mt-2 text-3xl font-black text-slate-900">{subcategories.length}</p>
        </GlassPanel>
        <GlassPanel className="p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">Active</p>
          <p className="mt-2 text-3xl font-black text-blue-600">{activeCount}</p>
        </GlassPanel>
        <GlassPanel className="p-5">
          <p className="text-xs font-semibold uppercase text-slate-500">Parent Categories</p>
          <p className="mt-2 text-3xl font-black text-brand">{categories.length}</p>
        </GlassPanel>
      </div>

      <GlassPanel className="relative z-20 p-4 md:p-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search sub-categories..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-brand/35"
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-[220px]">
            <SearchableSelect
              value={categoryFilter}
              onChange={setCategoryFilter}
              options={[{ value: 'all', label: 'All Categories' }, ...categories.map(c => ({ value: c._id, label: c.name }))]}
            />
          </div>
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-brand/35"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="hidden">Hidden Only</option>
          </select>
          <select
            value={limit}
            onChange={e => setLimit(Number(e.target.value))}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-brand/35"
          >
            <option value={10}>10 / page</option>
            <option value={20}>20 / page</option>
            <option value={50}>50 / page</option>
          </select>
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
                {selectedIds.length === 1 ? '1 sub-category selected' : `${selectedIds.length} sub-categories selected`}
              </span>
              {selectedIds.length < filteredSubCategories.length && (
                <button
                  type="button"
                  onClick={() => setSelectedIds(filteredSubCategories.map(sc => sc._id))}
                  className="text-xs font-semibold text-rose-700 underline hover:text-rose-900 transition ml-1"
                >
                  Select all {filteredSubCategories.length} matching
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

      {error ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</p>
      ) : null}

      <GlassPanel className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={isAllCurrentSelected}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/35 cursor-pointer accent-brand"
                    title="Select all on current page"
                  />
                </th>
                <th className="px-4 py-3 w-12 text-center"></th>
                <th className="px-4 py-3">Name & Desc</th>
                <th className="px-4 py-3">Category</th>

                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && subcategories.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">Loading...</td>
                </tr>
              ) : paginatedSubCategories.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-500">No sub-categories found.</td>
                </tr>
              ) : (
                paginatedSubCategories.map(s => (
                  <tr
                    key={s._id}
                    className={`border-b border-slate-100 transition ${
                      selectedIds.includes(s._id) ? 'bg-rose-50/40 hover:bg-rose-50/60' : 'hover:bg-slate-50/60'
                    }`}
                  >
                    <td className="px-4 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(s._id)}
                        onChange={() => toggleSelectOne(s._id)}
                        className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/35 cursor-pointer accent-brand"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 overflow-hidden">
                        {s.iconUrl ? (
                          <img src={getCategoryImageUrl({ iconUrl: s.iconUrl, imageUrl: s.iconUrl })} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <Tag className="h-4 w-4 text-slate-400" />
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{s.name}</p>
                      {s.description && <p className="text-xs text-slate-500 truncate max-w-[200px]">{s.description}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                        {s.categoryName}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${
                        s.isActive ? 'bg-blue-50 text-blue-700 ring-blue-200' : 'bg-slate-100 text-slate-500 ring-slate-200'
                      }`}>
                        {s.isActive ? 'Active' : 'Hidden'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setViewSubCategory(s)}
                          title="View Details"
                          className="rounded-lg border border-transparent p-1.5 text-slate-400 hover:border-slate-200 hover:bg-slate-50 hover:text-sky-600 transition"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setEditSubCategory(s)}
                          title="Edit Sub-Category"
                          className="rounded-lg border border-transparent p-1.5 text-slate-400 hover:border-slate-200 hover:bg-slate-50 hover:text-brand transition"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeleteSubCategory(s)}
                          title="Delete Sub-Category"
                          className="rounded-lg border border-transparent p-1.5 text-slate-400 hover:border-slate-200 hover:bg-rose-50 hover:text-rose-600 transition"
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
          
          {totalPages > 1 && (
             <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-4 py-3">
               <p className="text-xs font-semibold text-slate-500">
                 Showing {(page - 1) * limit + 1} to {Math.min(page * limit, filteredSubCategories.length)} of {filteredSubCategories.length}
               </p>
               <div className="flex items-center gap-2">
                 <button
                   onClick={() => setPage(p => Math.max(1, p - 1))}
                   disabled={page === 1}
                   className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                 >
                   Prev
                 </button>
                 <span className="text-xs font-bold text-slate-700">
                   {page} / {totalPages}
                 </span>
                 <button
                   onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                   disabled={page === totalPages}
                   className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                 >
                   Next
                 </button>
               </div>
             </div>
          )}
        </div>
      </GlassPanel>

      <AddSubCategoryModal
        open={addModalOpen}
        categories={categories}
        onClose={() => setAddModalOpen(false)}
        onSaved={() => {
          setAddModalOpen(false)
          setModalBusy(false)
          load()
        }}
        busy={modalBusy}
        setBusy={setModalBusy}
      />

      <EditSubCategoryModal
        open={!!editSubCategory}
        subcategory={editSubCategory}
        categories={categories}
        onClose={() => setEditSubCategory(null)}
        onSaved={() => {
          setEditSubCategory(null)
          setModalBusy(false)
          load()
        }}
        busy={modalBusy}
        setBusy={setModalBusy}
      />

      <ViewSubCategoryModal
        open={!!viewSubCategory}
        subcategory={viewSubCategory}
        onClose={() => setViewSubCategory(null)}
      />

      <DeleteSubCategoryModal
        open={!!deleteSubCategory}
        subcategory={deleteSubCategory}
        onClose={() => setDeleteSubCategory(null)}
        onDeleted={() => {
          setDeleteSubCategory(null)
          setModalBusy(false)
          load()
        }}
        busy={modalBusy}
        setBusy={setModalBusy}
      />

      <BulkDeleteSubCategoryModal
        open={bulkDeleteModalOpen}
        count={selectedIds.length}
        onClose={() => setBulkDeleteModalOpen(false)}
        onConfirmed={handleBulkDelete}
        busy={bulkDeleteBusy}
      />
    </div>
  )
}
