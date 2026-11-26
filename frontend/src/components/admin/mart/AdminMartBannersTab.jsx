import { useState, useEffect } from 'react'
import { Plus, Edit, Trash2, X, Image as ImageIcon, Tag } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { GlassPanel } from '../../ui/GlassPanel.jsx'
import { 
  fetchAdminMartBanners, 
  createAdminMartBanner, 
  updateAdminMartBanner, 
  deleteAdminMartBanner, 
  patchAdminMartBanner,
  fetchAdminMartCategories
} from '../../../api/adminBuildmartApi.js'
import { uploadMedia, assetUrlFromUpload } from '../../../api/uploadApi.js'

export function AdminMartBannersTab() {
  const [banners, setBanners] = useState([])
  const [categories, setCategories] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pages, setPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setIsModalOpen] = useState(false)
  
  const [editBanner, setEditBanner] = useState(null)
  
  const [newBanner, setNewBanner] = useState({ id: '', title: '', subtitle: '', cta: '', categoryId: '', active: true })
  const [newBannerFile, setNewBannerFile] = useState(null)
  const [newBannerPreview, setNewBannerPreview] = useState('')
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [pendingDelete, setPendingDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [data, cats] = await Promise.all([
        fetchAdminMartBanners({ page, limit: 12 }),
        fetchAdminMartCategories({ page: 1, limit: 500 }) // Load all for dropdown
      ])
      const bData = data?.data ?? data ?? {}
      const cData = cats?.data?.items ?? cats?.data ?? cats ?? []

      setBanners(Array.isArray(bData.items) ? bData.items : (Array.isArray(bData) ? bData : []))
      setTotal(bData.total ?? 0)
      setPages(bData.pages ?? 1)
      setCategories(Array.isArray(cData) ? cData : [])
    } catch (err) {
      console.error('Failed to load banners:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [page])

  const handleSave = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      let imageUrl = ''
      if (newBannerFile) {
        const res = await uploadMedia(newBannerFile, 'general-media')
        imageUrl = assetUrlFromUpload(res)
      }
      const payload = {
        id: newBanner.id,
        title: newBanner.title,
        subtitle: newBanner.subtitle,
        cta: newBanner.cta,
        categoryId: newBanner.categoryId,
        active: newBanner.active,
        image: imageUrl || '',
        imageUrl: imageUrl || ''
      }
      await createAdminMartBanner(payload)
      
      setIsModalOpen(false)
      setNewBanner({ id: '', title: '', subtitle: '', cta: '', categoryId: '', active: true })
      setNewBannerFile(null)
      setNewBannerPreview('')
      load()
    } catch (err) {
      setErrorMsg(err.message || 'Error creating banner')
    } finally {
      setBusy(false)
    }
  }

  const handleEditSave = async (e) => {
    e.preventDefault()
    setBusy(true)
    try {
      let imageUrl = editBanner.imageUrl || editBanner.image || ''
      if (newBannerFile) {
        const res = await uploadMedia(newBannerFile, 'general-media')
        imageUrl = assetUrlFromUpload(res)
      }
      
      const payload = {
        id: editBanner.id,
        title: editBanner.title,
        subtitle: editBanner.subtitle,
        cta: editBanner.cta,
        categoryId: editBanner.categoryId,
        active: editBanner.active,
        image: imageUrl || '',
        imageUrl: imageUrl || ''
      }
      
      const backendId = editBanner._id || editBanner.id
      await updateAdminMartBanner(backendId, payload)
      
      setEditBanner(null)
      setNewBannerFile(null)
      setNewBannerPreview('')
      load()
    } catch (err) {
      setErrorMsg(err.message || 'Error updating banner')
    } finally {
      setBusy(false)
    }
  }

  // In-page confirm (native confirm()/alert() trigger the OS alert tone)
  const handleDelete = (banner) => setPendingDelete(banner)

  const confirmDelete = async () => {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      const backendId = pendingDelete._id || pendingDelete.id
      await deleteAdminMartBanner(backendId)
      setErrorMsg('')
      setPendingDelete(null)
      load()
    } catch (err) {
      setErrorMsg(err.message || 'Error deleting banner')
      setPendingDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  const toggleActive = async (banner) => {
    try {
      const backendId = banner._id || banner.id
      await patchAdminMartBanner(backendId, { active: !banner.active })
      setErrorMsg('')
      load()
    } catch (err) {
      setErrorMsg(err.message || 'Error updating banner status')
    }
  }

  return (
    <div className="space-y-4">
      {/* Header & Actions */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-bold text-slate-800">Promotional Banners</h3>
          <p className="text-sm text-slate-500">Manage banners displayed on the Mart home page.</p>
        </div>
        <button
          onClick={() => {
            setNewBanner({ id: '', title: '', subtitle: '', cta: '', categoryId: '', active: true })
            setNewBannerFile(null)
            setNewBannerPreview('')
            setIsModalOpen(true)
          }}
          className="flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-dark"
        >
          <Plus className="h-4 w-4" />
          Create Banner
        </button>
      </div>

      {errorMsg && (
        <div className="flex items-start justify-between gap-3 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <span>{errorMsg}</span>
          <button type="button" onClick={() => setErrorMsg('')} aria-label="Dismiss">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {pendingDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => !deleting && setPendingDelete(null)}
          />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <h3 className="text-lg font-bold text-slate-800">Delete this banner?</h3>
            <p className="mt-1 text-sm text-slate-500">
              "{pendingDelete.title || 'Banner'}" will be removed. This cannot be undone.
            </p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setPendingDelete(null)}
                className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={confirmDelete}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="py-8 text-center text-sm text-slate-500">Loading banners...</div>
      ) : (
      <div className="grid gap-4 sm:grid-cols-2">
        {banners.map((banner) => (
          <GlassPanel key={banner._id || banner.id} className="overflow-hidden">
            <div className="aspect-[3/1] w-full bg-slate-100">
              {banner.image || banner.imageUrl ? (
                <img src={banner.image || banner.imageUrl} alt={banner.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-slate-300">
                  <ImageIcon className="h-8 w-8" />
                </div>
              )}
            </div>
            <div className="flex items-center justify-between p-4">
              <div>
                <p className="font-bold text-slate-800">{banner.title}</p>
                <p className="text-xs text-slate-500">{banner.subtitle}</p>
                {banner.cta && <p className="mt-1 text-[11px] font-semibold text-brand">{banner.cta}</p>}
                {banner.categoryId && (
                  <p className="mt-1 flex items-center gap-1 text-[10px] uppercase font-bold text-slate-400">
                    <Tag className="h-3 w-3" />
                    {categories.find(c => c.id === banner.categoryId || c._id === banner.categoryId)?.name || banner.categoryId}
                  </p>
                )}
                <div className="mt-2">
                  <button
                    onClick={() => toggleActive(banner)}
                    className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide hover:opacity-80 transition ${
                      banner.active ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {banner.active ? 'Active' : 'Inactive'}
                  </button>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button 
                  onClick={() => {
                    setEditBanner({ ...banner })
                    setNewBannerPreview(banner.image || banner.imageUrl || '')
                    setNewBannerFile(null)
                  }}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-brand"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button 
                  onClick={() => handleDelete(banner)}
                  className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-red-500"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </GlassPanel>
        ))}
        {banners.length === 0 && (
          <div className="col-span-full py-8 text-center text-sm text-slate-500">
            No banners found.
          </div>
        )}
      </div>
      )}

      {pages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <p className="text-sm text-slate-500">
            Showing <span className="font-semibold">{banners.length}</span> of <span className="font-semibold">{total}</span>
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Previous
            </button>
            <span className="text-sm font-semibold text-slate-600">
              Page {page} of {pages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page === pages}
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Modal for Create/Edit */}
      <AnimatePresence>
        {(isModalOpen || editBanner) && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => { setIsModalOpen(false); setEditBanner(null); }}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                <h3 className="text-lg font-bold text-slate-800">{editBanner ? 'Edit Banner' : 'Create Banner'}</h3>
                <button
                  type="button"
                  onClick={() => { setIsModalOpen(false); setEditBanner(null); }}
                  className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={editBanner ? handleEditSave : handleSave} className="p-5 max-h-[80vh] overflow-y-auto">
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">
                      ID (Slug)
                    </label>
                    <input
                      required
                      type="text"
                      disabled={!!editBanner}
                      value={editBanner ? editBanner.id : newBanner.id}
                      onChange={(e) => {
                        if (editBanner) setEditBanner({ ...editBanner, id: e.target.value })
                        else setNewBanner({ ...newBanner, id: e.target.value })
                      }}
                      placeholder="e.g. bulk-discount"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">
                      Title
                    </label>
                    <input
                      required
                      type="text"
                      value={editBanner ? editBanner.title : newBanner.title}
                      onChange={(e) => {
                        if (editBanner) setEditBanner({ ...editBanner, title: e.target.value })
                        else setNewBanner({ ...newBanner, title: e.target.value })
                      }}
                      placeholder="e.g. Winter Sale"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">
                      Subtitle
                    </label>
                    <input
                      type="text"
                      value={editBanner ? editBanner.subtitle : newBanner.subtitle}
                      onChange={(e) => {
                        if (editBanner) setEditBanner({ ...editBanner, subtitle: e.target.value })
                        else setNewBanner({ ...newBanner, subtitle: e.target.value })
                      }}
                      placeholder="e.g. Up to 50% off"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-700">
                        CTA Text
                      </label>
                      <input
                        type="text"
                        value={editBanner ? editBanner.cta : newBanner.cta}
                        onChange={(e) => {
                          if (editBanner) setEditBanner({ ...editBanner, cta: e.target.value })
                          else setNewBanner({ ...newBanner, cta: e.target.value })
                        }}
                        placeholder="e.g. Shop Now"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-semibold text-slate-700">
                        Category
                      </label>
                      <select
                        value={editBanner ? editBanner.categoryId : newBanner.categoryId}
                        onChange={(e) => {
                          if (editBanner) setEditBanner({ ...editBanner, categoryId: e.target.value })
                          else setNewBanner({ ...newBanner, categoryId: e.target.value })
                        }}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
                      >
                        <option value="">Select a category</option>
                        {categories.map(c => (
                          <option key={c.id || c._id} value={c.id}>{c.name || c.id}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-semibold text-slate-700">
                      Upload Image
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          setNewBannerFile(e.target.files[0])
                          setNewBannerPreview(URL.createObjectURL(e.target.files[0]))
                        }
                      }}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-brand/10 file:px-4 file:py-1.5 file:text-sm file:font-semibold file:text-brand hover:file:bg-brand/20"
                    />
                    {newBannerPreview && (
                      <div className="mt-3 aspect-[3/1] w-full overflow-hidden rounded-xl border border-slate-200">
                        <img src={newBannerPreview} alt="Preview" className="h-full w-full object-cover" />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <input
                      type="checkbox"
                      id="banner-active"
                      checked={editBanner ? editBanner.active : newBanner.active}
                      onChange={(e) => {
                        if (editBanner) setEditBanner({ ...editBanner, active: e.target.checked })
                        else setNewBanner({ ...newBanner, active: e.target.checked })
                      }}
                      className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                    />
                    <label htmlFor="banner-active" className="text-sm font-medium text-slate-700">
                      Make this banner active
                    </label>
                  </div>
                </div>
                <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-100 pt-5">
                  <button
                    type="button"
                    onClick={() => { setIsModalOpen(false); setEditBanner(null); }}
                    className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={busy}
                    className="rounded-xl bg-brand px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-brand-dark disabled:opacity-50"
                  >
                    {busy ? 'Saving...' : 'Save Banner'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
