import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, Eye, Image as ImageIcon, Loader2, Video as VideoIcon } from 'lucide-react'
import { AppPrimaryButton } from '../../components/app/AppPrimaryButton.jsx'
import { fetchAdminBanners, createAdminBanner, deleteAdminBanner } from '../../api/adminBannersApi.js'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'

export function AdminBannersPage() {
  const [activeTab, setActiveTab] = useState('APP')
  const [banners, setBanners] = useState([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef = useRef(null)

  const loadBanners = async () => {
    try {
      setLoading(true)
      const res = await fetchAdminBanners(activeTab)
      setBanners(res.data?.banners ?? [])
      setError('')
    } catch (e) {
      setError(e.message || 'Failed to load banners')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadBanners()
  }, [activeTab])

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      setUploading(true)
      setError('')
      const formData = new FormData()
      formData.append('file', file)
      formData.append('panel', activeTab)
      
      await createAdminBanner(formData)
      await loadBanners()
    } catch (err) {
      setError(err.message || 'Failed to upload banner')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this item?')) return
    try {
      setError('')
      await deleteAdminBanner(id)
      await loadBanners()
    } catch (err) {
      setError(err.message || 'Failed to delete banner')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Banners</h1>
        <input 
          type="file" 
          accept={activeTab === 'EXPLORE' ? "image/*,video/mp4,video/webm,video/quicktime" : "image/*"} 
          className="hidden" 
          ref={fileInputRef}
          onChange={handleFileChange}
        />
        <AppPrimaryButton onClick={() => fileInputRef.current?.click()} disabled={uploading}>
          {uploading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plus className="mr-2 h-4 w-4" />
          )}
          Upload {activeTab === 'EXPLORE' ? 'Media' : 'Banner'}
        </AppPrimaryButton>
      </div>

      <div className="flex border-b border-slate-200">
        <button
          className={`px-4 py-2 font-medium text-sm ${activeTab === 'APP' ? 'border-b-2 border-brand text-brand' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('APP')}
        >
          App Banners
        </button>
        <button
          className={`px-4 py-2 font-medium text-sm ${activeTab === 'EXPLORE' ? 'border-b-2 border-brand text-brand' : 'text-slate-500 hover:text-slate-700'}`}
          onClick={() => setActiveTab('EXPLORE')}
        >
          Explore Media
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
        </div>
      ) : banners.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 py-12 text-slate-500">
          <ImageIcon className="mb-2 h-10 w-10 opacity-20" />
          <p>No {activeTab === 'EXPLORE' ? 'media' : 'banners'} uploaded yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {banners.map((banner) => (
            <GlassPanel key={banner._id} className="group relative overflow-hidden">
              <div className="aspect-video w-full flex items-center justify-center bg-slate-100">
                {banner.mediaType === 'video' ? (
                  <video src={banner.imageUrl} className="h-full w-full object-cover" controls preload="metadata" />
                ) : (
                  <img 
                    src={banner.imageUrl} 
                    alt="Banner" 
                    className="h-full w-full object-cover"
                  />
                )}
              </div>
              <div className="flex items-center justify-between gap-2 border-t border-slate-100 px-3 py-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {banner.mediaType === 'video' ? 'Video' : 'Image'}
                </span>
                <div className="flex items-center gap-1">
                  <a
                    href={banner.imageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 hover:text-brand"
                    title="View"
                    aria-label="View"
                  >
                    <Eye className="h-4 w-4" />
                  </a>
                  <button
                    type="button"
                    onClick={() => handleDelete(banner._id)}
                    className="rounded-lg p-2 text-red-600 transition hover:bg-red-50"
                    title="Delete"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </GlassPanel>
          ))}
        </div>
      )}
    </div>
  )
}
