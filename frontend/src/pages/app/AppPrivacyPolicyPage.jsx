import { useEffect, useState } from 'react'
import { FileText, ShieldAlert } from 'lucide-react'
import { apiRequest } from '../../api/http.js'
import { useAuth } from '../../hooks/useAuth.js'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { AppStackScreenHeader } from '../../components/app/AppStackScreenHeader.jsx'

export function AppPrivacyPolicyPage() {
  const { user } = useAuth()
  const [content, setContent] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    if (!user?.role) return

    setIsLoading(true)
    // Fetch the privacy policy for the current user's role
    apiRequest(`/policies/privacy/${user.role}`)
      .then((res) => {
        if (mounted) setContent(res.data?.content || 'No privacy policy available.')
      })
      .catch(() => {
        if (mounted) setError('Failed to load privacy policy.')
      })
      .finally(() => {
        if (mounted) setIsLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [user?.role])

  return (
    <div className="mx-auto max-w-3xl pt-2 pb-12 space-y-4">
      <AppStackScreenHeader title="Privacy Policy" backTo="/app" />
      <div className="mb-2 px-1">
        <p className="text-sm font-medium text-slate-500">
          Information regarding how we handle your data.
        </p>
      </div>

      <GlassPanel className="p-5 sm:p-8">
        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand border-r-transparent" />
          </div>
        ) : error ? (
          <div className="rounded-xl bg-rose-50 p-4 text-sm font-medium text-rose-600">
            {error}
          </div>
        ) : (
          <div className="prose prose-sm prose-slate max-w-none">
            {/* Split by newlines and render paragraphs since it's plain text */}
            {content.split('\\n').map((paragraph, i) => (
              <p key={i} className="mb-4 text-slate-700 whitespace-pre-wrap">
                {paragraph}
              </p>
            ))}
          </div>
        )}
      </GlassPanel>
    </div>
  )
}
