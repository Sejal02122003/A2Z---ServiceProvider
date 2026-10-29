import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Star, Send, X, CheckCircle2 } from 'lucide-react'
import { reviewsApi } from '../../../api/reviewsApi.js'

function StarButton({ filled, onClick, index }) {
  return (
    <button
      type="button"
      onClick={() => onClick(index + 1)}
      className="transition-transform active:scale-90"
      aria-label={`Rate ${index + 1} star${index !== 0 ? 's' : ''}`}
    >
      <Star
        className={`h-9 w-9 transition-colors duration-150 ${
          filled ? 'fill-amber-400 text-amber-400' : 'fill-slate-100 text-slate-300'
        }`}
        aria-hidden
      />
    </button>
  )
}

const RATING_LABELS = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent']

/**
 * BookingReviewModal
 * Props:
 *   open        – boolean, whether the modal is visible
 *   bookingId   – string, _id of the completed booking
 *   workerName  – string, labourer's name to display
 *   revieweeId  – string (optional), specific labourer to review
 *   onClose     – fn(), called when user dismisses without submitting
 *   onSubmitted – fn(), called after successful review submission
 */
export function BookingReviewModal({ open, bookingId, workerName, revieweeId, onClose, onSubmitted }) {
  const [rating, setRating] = useState(0)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (open) {
      setRating(0)
      setHoveredRating(0)
      setComment('')
      setSubmitting(false)
      setError('')
      setSubmitted(false)
    }
  }, [open, revieweeId])

  const displayRating = hoveredRating || rating

  const handleSubmit = async () => {
    if (rating === 0) {
      setError('Please select a star rating.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await reviewsApi.submitReview({ bookingId, rating, comment: comment.trim(), revieweeId })
      setSubmitted(true)
      setTimeout(() => {
        onSubmitted?.()
      }, 1800)
    } catch (err) {
      setError(err?.message || 'Failed to submit review. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    if (submitting) return
    onClose?.()
  }

  const modalContent = (
    <AnimatePresence>
      {open ? (
        <>
          {/* Backdrop */}
          <motion.div
            key="review-backdrop"
            className="fixed inset-0 z-[200] bg-slate-950/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />

          {/* Sheet */}
          <motion.div
            key="review-sheet"
            className="fixed inset-x-0 bottom-0 z-[201] mx-auto max-w-lg rounded-t-3xl bg-white px-5 pb-[max(1.5rem,env(safe-area-inset-bottom,0px))] pt-5 shadow-[0_-16px_48px_-8px_rgba(15,23,42,0.18)]"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 320 }}
          >
            {/* Drag handle */}
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200" aria-hidden />

            {submitted ? (
              /* ── Success state ── */
              <motion.div
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center gap-3 py-6 text-center"
              >
                <CheckCircle2 className="h-14 w-14 text-brand" aria-hidden />
                <p className="text-xl font-black text-slate-900">Thank you!</p>
                <p className="text-sm font-medium text-slate-500">Your review has been submitted.</p>
              </motion.div>
            ) : (
              /* ── Review Form ── */
              <>
                <div className="mb-1 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand">Rate your experience</p>
                    <h2 className="mt-0.5 text-lg font-black text-slate-900">
                      {workerName ? `How was ${workerName}?` : 'How was your service provider?'}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={submitting}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                    aria-label="Dismiss review"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>

                {/* Stars */}
                <div className="my-5 flex items-center justify-center gap-1">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <StarButton
                      key={i}
                      index={i}
                      filled={i < displayRating}
                      onClick={(val) => { setRating(val); setError('') }}
                    />
                  ))}
                </div>

                {/* Rating label */}
                <p
                  className={`mb-4 text-center text-sm font-bold transition-colors duration-150 ${
                    displayRating ? 'text-amber-500' : 'text-slate-300'
                  }`}
                >
                  {RATING_LABELS[displayRating] || 'Tap to rate'}
                </p>

                {/* Comment */}
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  placeholder="Share your experience (optional)…"
                  maxLength={500}
                  className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-brand focus:bg-white focus:ring-0 placeholder:text-slate-400"
                />
                <p className="mb-3 mt-1 text-right text-[10px] text-slate-400">{comment.length}/500</p>

                {/* Error */}
                {error ? (
                  <p className="mb-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p>
                ) : null}

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={submitting}
                    className="flex-1 rounded-2xl border border-slate-200 bg-white py-3.5 text-sm font-bold text-slate-700 transition hover:border-slate-300"
                  >
                    Skip
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting || rating === 0}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-brand py-3.5 text-sm font-bold text-white shadow-[0_6px_20px_-6px_rgba(0,43,92,0.5)] transition disabled:opacity-50"
                  >
                    {submitting ? (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    ) : (
                      <Send className="h-4 w-4" aria-hidden />
                    )}
                    {submitting ? 'Submitting…' : 'Submit Review'}
                  </button>
                </div>
              </>
            )}
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  )

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent
}
