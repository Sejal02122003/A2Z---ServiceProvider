import { useEffect, useState } from 'react'
import { Ban } from 'lucide-react'
import { apiRequest } from '../../api/http.js'
import { useAuth } from '../../hooks/useAuth.js'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { AppStackScreenHeader } from '../../components/app/AppStackScreenHeader.jsx'

export function AppCancellationPolicyPage() {
  const { user } = useAuth()
  const [content, setContent] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    if (!user?.role) return

    setIsLoading(true)
    // Fetch the cancellation policy for the current user's role
    // Type should match what was seeded: 'cancellation'
    apiRequest(`/policies/cancellation/${user.role}`)
      .then((res) => {
        if (mounted) setContent(res.data?.content || 'No cancellation policy available.')
      })
      .catch(() => {
        if (mounted) setError('Failed to load cancellation policy.')
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
      <AppStackScreenHeader title="Cancellation Policy" />
      <div className="mb-2 px-1">
        <p className="text-sm font-medium text-slate-500">
          Rules and regulations regarding booking cancellations.
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
