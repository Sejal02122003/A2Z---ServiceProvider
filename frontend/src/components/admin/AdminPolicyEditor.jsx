import { useEffect, useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { adminPoliciesApi } from '../../api/adminPoliciesApi.js'
import { AppPillTabs } from '../app-ui/navigation/AppPillTabs.jsx'

const TABS = [
  { id: 'customer', label: 'Customer' },
  { id: 'contractor', label: 'Contractor' },
  { id: 'labour', label: 'Service Provider' },
]

export function AdminPolicyEditor({ type, title }) {
  const [activeTab, setActiveTab] = useState(TABS[0].id)
  const [content, setContent] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    setIsLoading(true)
    setError('')
    
    adminPoliciesApi
      .getPolicy(type, activeTab)
      .then((data) => {
        if (mounted) {
          setContent(data?.data?.content || '')
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err.response?.data?.message || 'Failed to fetch policy content.')
        }
      })
      .finally(() => {
        if (mounted) setIsLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [type, activeTab])

  const handleSave = async () => {
    setIsSaving(true)
    setIsSuccess(false)
    setError('')
    
    try {
      await adminPoliciesApi.updatePolicy(type, activeTab, { content })
      setIsSuccess(true)
      setTimeout(() => setIsSuccess(false), 3000)
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save policy content.')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage {title.toLowerCase()} for different user roles.
        </p>
      </div>

      <AppPillTabs items={TABS} value={activeTab} onChange={setActiveTab} />

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900 capitalize">
            {activeTab} Content
          </h2>
          {isSuccess && (
            <span className="flex items-center gap-1 text-sm font-medium text-emerald-600">
              <Check className="h-4 w-4" /> Saved
            </span>
          )}
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-rose-50 p-4 text-sm text-rose-600">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-brand/50" />
          </div>
        ) : (
          <div className="space-y-4">
            <textarea
              className="min-h-[400px] w-full rounded-xl border-slate-200 p-4 text-sm focus:border-brand focus:ring-brand"
              placeholder={`Enter HTML or Markdown content for ${activeTab}...`}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
            
            <div className="flex justify-end">
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSave}
                className="flex items-center justify-center rounded-xl bg-brand px-6 py-2.5 text-sm font-bold text-white transition hover:bg-brand-dark focus:outline-none focus:ring-2 focus:ring-brand focus:ring-offset-2 disabled:opacity-70"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                  </>
                ) : (
                  'Save Content'
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
