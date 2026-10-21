import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertCircle, FileText, Loader2, Star, User, Trash2 } from 'lucide-react'
import { reviewsApi } from '../../api/reviewsApi.js'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { AppBadge } from '../../components/app-ui/data-display/AppBadge.jsx'

export function AdminReviewsRatingsPage() {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  const [deleteConfirmId, setDeleteConfirmId] = useState(null)

  useEffect(() => {
    let cancelled = false
    const fetchReviews = async () => {
      try {
        const res = await reviewsApi.getAllReviews()
        if (!cancelled) {
          setReviews(res.data.reviews || [])
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load reviews')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchReviews()
    return () => {
      cancelled = true
    }
  }, [])

  const handleDeleteReview = async () => {
    if (!deleteConfirmId) return
    const id = deleteConfirmId
    setDeletingId(id)
    setDeleteConfirmId(null)
    try {
      await reviewsApi.deleteReview(id)
      setReviews(prev => prev.filter(r => r._id !== id))
    } catch (err) {
      alert(err.message || 'Failed to delete review')
    } finally {
      setDeletingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    )
  }

  if (error) {
    return (
      <GlassPanel className="p-6 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-rose-500" />
        <p className="mt-4 text-lg font-bold text-slate-900">Error Loading Reviews</p>
        <p className="mt-2 text-sm text-slate-500">{error}</p>
      </GlassPanel>
    )
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassPanel className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <Star className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total Reviews</p>
              <p className="text-2xl font-black text-slate-900">{reviews.length}</p>
            </div>
          </div>
        </GlassPanel>

        {/* Can add average rating, etc in the future */}
      </div>

      <GlassPanel className="overflow-hidden p-0">
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
          <h2 className="text-base font-bold text-slate-900">All Reviews</h2>
        </div>

        {reviews.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-slate-300" />
            <p className="mt-4 text-lg font-bold text-slate-900">No Reviews Yet</p>
            <p className="mt-1 text-sm text-slate-500">When users submit reviews, they will appear here.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {reviews.map((review) => (
              <div key={review._id} className="p-5 transition hover:bg-slate-50/50">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-4 w-4 ${star <= review.rating ? 'fill-amber-400 text-amber-400' : 'fill-slate-100 text-slate-200'
                              }`}
                          />
                        ))}
                      </div>
                      <AppBadge variant={review.rating >= 4 ? 'success' : review.rating <= 2 ? 'danger' : 'warning'}>
                        {review.rating} / 5
                      </AppBadge>
                      <span className="text-xs font-semibold text-slate-500">
                        {new Date(review.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    {review.comment ? (
                      <p className="text-sm text-slate-700 font-medium bg-white border border-slate-100 p-3 rounded-xl shadow-sm">
                        "{review.comment}"
                      </p>
                    ) : (
                      <p className="text-sm italic text-slate-400">No comment provided</p>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                      <div className="flex items-start gap-2">
                        <User className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Reviewer</p>
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {review.reviewerId?.fullName || review.reviewerId?.name || 'Unknown User'}
                          </p>
                          <p className="text-xs text-slate-500 truncate">{review.reviewerId?.phone}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2">
                        <User className="h-4 w-4 text-brand mt-0.5 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-brand/60">Reviewed (Service Provider/Vendor)</p>
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {review.revieweeId?.fullName || review.revieweeId?.name || 'Unknown Worker'}
                          </p>
                          <p className="text-xs text-slate-500 truncate">{review.revieweeId?.phone}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-3 shrink-0 sm:min-w-[140px]">
                    {review.bookingId && (
                      <div className="w-full rounded-xl bg-slate-50 p-3 text-right border border-slate-100">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Booking Ref</p>
                        <p className="text-sm font-bold text-slate-900 mt-1">#{review.bookingId._id.substring(review.bookingId._id.length - 6).toUpperCase()}</p>
                        <AppBadge variant="neutral" className="mt-2 text-[10px]">
                          {review.bookingId.type}
                        </AppBadge>
                      </div>
                    )}
                    <button
                      onClick={() => setDeleteConfirmId(review._id)}
                      disabled={deletingId === review._id}
                      className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-bold text-rose-600 transition hover:bg-rose-100 disabled:opacity-50"
                    >
                      {deletingId === review._id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassPanel>

      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100">
              <AlertCircle className="h-6 w-6 text-rose-600" />
            </div>
            <h3 className="mb-2 text-lg font-bold text-slate-900">Delete Review</h3>
            <p className="mb-6 text-sm text-slate-500">Are you sure you want to delete this review? This action cannot be undone.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteReview}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-rose-600 py-3 text-sm font-bold text-white hover:bg-rose-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
