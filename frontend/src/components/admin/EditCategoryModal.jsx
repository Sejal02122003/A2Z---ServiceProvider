import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { X } from 'lucide-react'
import { patchAdminLabourCategory } from '../../api/adminLabourCategoriesApi.js'
import { ApiError } from '../../api/http.js'
import { AppPrimaryButton } from '../app/AppPrimaryButton.jsx'
import { getCategoryImageUrl } from '../../lib/labourCategoryDisplay.js'
import { UPLOAD_FOLDERS } from '../../constants/uploadFolders.js'
import { assetUrlFromUpload, uploadMedia } from '../../api/uploadApi.js'

export function EditCategoryModal({ open, category, onClose, onSaved, busy, setBusy }) {
  const [name, setName] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [sortOrder, setSortOrder] = useState(0)
  const [isActive, setIsActive] = useState(true)
  const [gstPercentage, setGstPercentage] = useState('')
  const [isGstActive, setIsGstActive] = useState(true)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open && category) {
      setName(category.name || '')
      setSubtitle(category.subtitle || '')
      setImageUrl(category.imageUrl || '')
      setSortOrder(category.sortOrder ?? 0)
      setIsActive(category.isActive ?? true)
      setGstPercentage(category.gstPercentage != null ? String(category.gstPercentage) : '0')
      setIsGstActive(category.isGstActive !== false)
      setError('')
    }
  }, [open, category])

  if (!open || !category) return null

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
      if (url) setImageUrl(url)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Upload failed')
    } finally {
      setUploadBusy(false)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) {
      setError('Name is required.')
      return
    }
    setError('')
    setBusy(true)
    try {
      const payload = {
        name: name.trim(),
        subtitle: subtitle.trim(),
        imageUrl: imageUrl.trim() || undefined,
        sortOrder: Number(sortOrder),
        isActive,
        gstPercentage: gstPercentage !== '' ? Number(gstPercentage) : 0,
        isGstActive: Boolean(isGstActive),
      }
      await patchAdminLabourCategory(category._id, payload)
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save category')
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
        className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl"
      >
        <div className="border-b border-slate-100 px-5 py-4 flex justify-between items-center">
          <h3 className="text-lg font-extrabold text-slate-900">Edit Category</h3>
          <button onClick={() => !busy && !uploadBusy && onClose()} className="p-1 text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 p-5 max-h-[80vh] overflow-y-auto">
          {error && <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-900">{error}</p>}
          
          <div className="grid grid-cols-2 gap-4">
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
              <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Subtitle</label>
              <input
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/35"
                placeholder="Optional short description"
              />
            </div>

            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500">Sort Order</label>
              <input
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/35"
              />
            </div>

            <div className="flex items-center pt-5">
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

            <div>
              <label className="mb-1 block text-[11px] font-bold uppercase text-slate-500">GST Rate (%)</label>
              <input
                type="number"
                min={0}
                max={100}
                value={gstPercentage}
                onChange={(e) => setGstPercentage(e.target.value)}
                placeholder="e.g. 18"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand/35"
              />
            </div>

            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isGstActive}
                  onChange={(e) => setIsGstActive(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/35"
                />
                <span className="text-sm font-semibold text-slate-700">GST Active</span>
              </label>
            </div>

            <div className="col-span-2 space-y-2">
              <label className="block text-[11px] font-bold uppercase text-slate-500">Image</label>
              <div className="flex items-center gap-3">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-slate-100 ring-2 ring-slate-200">
                  {imageUrl ? (
                    <img src={getCategoryImageUrl({ name, imageUrl })} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-[10px] text-slate-400">None</span>
                  )}
                </div>
                <div className="flex flex-col gap-1 flex-1">
                  <div className="flex gap-2">
                    <input type="file" accept="image/*" onChange={handleFilePick} className="hidden" id="edit-cat-img" />
                    <label
                      htmlFor="edit-cat-img"
                      className="cursor-pointer rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-bold text-slate-700 hover:bg-slate-50"
                    >
                      {uploadBusy ? 'Uploading...' : 'Upload'}
                    </label>
                    {imageUrl && (
                      <button
                        type="button"
                        onClick={() => setImageUrl('')}
                        className="text-[11px] font-bold text-rose-600"
                      >
                        Clear
                      </button>
                    )}
                  </div>
                  <input
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="Or paste URL"
                    className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-brand/35"
                  />
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
