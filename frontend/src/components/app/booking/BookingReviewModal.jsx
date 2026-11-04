import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Star, Send, X, CheckCircle2, User } from 'lucide-react'
import { reviewsApi } from '../../../api/reviewsApi.js'

const RATING_CONFIG = {
  1: { label: 'VERY POOR', emoji: '😞', color: 'text-rose-600' },
  2: { label: 'POOR', emoji: '🙁', color: 'text-orange-500' },
  3: { label: 'AVERAGE', emoji: '😐', color: 'text-amber-500' },
  4: { label: 'GOOD', emoji: '😊', color: 'text-emerald-600' },
  5: { label: 'VERY GOOD', emoji: '😍', color: 'text-emerald-700' },
}

const POSITIVE_TAGS = [
  { id: 'friendly', label: 'Friendly', icon: '🤝' },
  { id: 'timely', label: 'Timely', icon: '⏰' },
  { id: 'polite', label: 'Polite', icon: '🙂' },
  { id: 'other', label: 'Other', icon: '' },
]

const NEGATIVE_TAGS = [
  { id: 'late', label: 'Arrived Late', icon: '⏰' },
  { id: 'unprofessional', label: 'Unprofessional', icon: '🙁' },
  { id: 'quality', label: 'Work Quality', icon: '🛠️' },
  { id: 'other', label: 'Other', icon: '' },
]

/**
 * BookingReviewModal
 * Displays two stacked white popup cards as requested:
 *  - Top Card: 5 big golden stars with dynamic rating label & emoji (e.g. "VERY GOOD 😍")
 *  - Bottom Card: "What did you like?" with pill tags (Friendly, Timely, Polite, Other)
 */
export function BookingReviewModal({
  open,
  bookingId,
  workerName,
  workerAvatar,
  serviceName,
  revieweeId,
  onClose,
  onSubmitted,
}) {
  const [rating, setRating] = useState(5)
  const [hoveredRating, setHoveredRating] = useState(0)
  const [selectedTags, setSelectedTags] = useState([])
  const [comment, setComment] = useState('')
  const [showCommentBox, setShowCommentBox] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (open) {
      setRating(5)
      setHoveredRating(0)
      setSelectedTags([])
      setComment('')
      setShowCommentBox(false)
      setSubmitting(false)
      setError('')
      setSubmitted(false)
    }
  }, [open, bookingId, revieweeId])

  const activeRating = hoveredRating || rating
  const currentConfig = RATING_CONFIG[activeRating] || {
    label: 'TAP TO RATE',
    emoji: '⭐',
    color: 'text-slate-400',
  }

  const tagsList = activeRating >= 4 || activeRating === 0 ? POSITIVE_TAGS : NEGATIVE_TAGS

  const toggleTag = (tag) => {
    if (tag.id === 'other') {
      setShowCommentBox((prev) => !prev)
      if (!selectedTags.includes('Other')) {
        setSelectedTags((prev) => [...prev, 'Other'])
      } else {
        setSelectedTags((prev) => prev.filter((t) => t !== 'Other'))
      }
      return
    }

    if (selectedTags.includes(tag.label)) {
      setSelectedTags((prev) => prev.filter((t) => t !== tag.label))
    } else {
      setSelectedTags((prev) => [...prev, tag.label])
    }
  }

  const handleSubmit = async () => {
    if (rating === 0) {
      setError('Please tap a star to give a rating.')
      return
    }
    setError('')
    setSubmitting(true)
    try {
      await reviewsApi.submitReview({
        bookingId,
        rating,
        tags: selectedTags,
        comment: comment.trim() || undefined,
        revieweeId,
      })
      setSubmitted(true)
      setTimeout(() => {
        onSubmitted?.()
      }, 1600)
    } catch (err) {
      // If already reviewed, still notify completion gracefully
      if (err?.message?.includes('already reviewed')) {
        setSubmitted(true)
        setTimeout(() => {
          onSubmitted?.()
        }, 1200)
      } else {
        setError(err?.message || 'Failed to submit review. Please try again.')
      }
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            key="review-backdrop"
            className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
          />

          {/* Modal Container */}
          <motion.div
            key="review-cards-container"
            className="relative z-[201] w-full max-w-sm sm:max-w-md space-y-3"
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="absolute -top-3.5 -right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-500 shadow-md border border-slate-200 transition hover:bg-slate-100 hover:text-slate-800"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            {submitted ? (
              /* Success State */
              <div className="rounded-3xl bg-white p-8 text-center shadow-xl border border-slate-100">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 240 }}
                  className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-3"
                >
                  <CheckCircle2 className="h-10 w-10" />
                </motion.div>
                <h3 className="text-xl font-black text-slate-900">Thank you!</h3>
                <p className="mt-1 text-sm font-medium text-slate-500">
                  Your feedback helps us provide the best service experience.
                </p>
              </div>
            ) : (
              <>
                {/* ── CARD 1: Star Rating Card (Top) ── */}
                <div className="rounded-3xl bg-white px-6 py-7 text-center shadow-xl border border-slate-100/90">
                  {/* Worker / Service Context */}
                  {(workerName || serviceName) && (
                    <div className="mb-4 flex items-center justify-center gap-2.5">
                      {workerAvatar ? (
                        <img
                          src={workerAvatar}
                          alt={workerName || 'Partner'}
                          className="h-9 w-9 rounded-full object-cover border border-slate-200 shadow-xs"
                        />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                          <User className="h-4 w-4" />
                        </div>
                      )}
                      <div className="text-left">
                        <p className="text-sm font-extrabold text-slate-900 leading-tight">
                          {workerName || 'Service Partner'}
                        </p>
                        {serviceName && (
                          <p className="text-[11px] font-semibold text-slate-500 leading-tight">
                            {serviceName}
                          </p>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 5 Stars */}
                  <div className="flex items-center justify-center gap-2 sm:gap-3 py-1">
                    {[1, 2, 3, 4, 5].map((starVal) => {
                      const isFilled = starVal <= activeRating
                      return (
                        <button
                          key={starVal}
                          type="button"
                          onClick={() => {
                            setRating(starVal)
                            setError('')
                          }}
                          onMouseEnter={() => setHoveredRating(starVal)}
                          onMouseLeave={() => setHoveredRating(0)}
                          className="group relative transition-transform duration-150 hover:scale-115 active:scale-90 focus:outline-hidden"
                          aria-label={`Rate ${starVal} star${starVal > 1 ? 's' : ''}`}
                        >
                          <Star
                            className={`h-10 w-10 sm:h-11 sm:w-11 transition-all duration-150 ${
                              isFilled
                                ? 'fill-[#EAB308] text-[#EAB308] drop-shadow-[0_2px_8px_rgba(234,179,8,0.35)]'
                                : 'fill-slate-100 text-slate-200 hover:text-slate-300'
                            }`}
                          />
                        </button>
                      )
                    })}
                  </div>

                  {/* Rating Label with Emoji */}
                  <div className="mt-4 flex items-center justify-center gap-1.5">
                    <span className={`text-base sm:text-lg font-black tracking-wider ${currentConfig.color}`}>
                      {currentConfig.label}
                    </span>
                    <span className="text-xl sm:text-2xl leading-none">
                      {currentConfig.emoji}
                    </span>
                  </div>
                </div>

                {/* ── CARD 2: "What did you like?" Card (Bottom) ── */}
                <div className="rounded-3xl bg-white px-6 py-6 shadow-xl border border-slate-100/90 text-center">
                  <h3 className="text-base sm:text-lg font-black text-slate-800 mb-4">
                    {activeRating >= 4 || activeRating === 0
                      ? 'What did you like?'
                      : 'What could be improved?'}
                  </h3>

                  {/* Tag Pills */}
                  <div className="grid grid-cols-2 gap-2.5 sm:gap-3 mb-4">
                    {tagsList.map((tag) => {
                      const isSelected =
                        tag.id === 'other'
                          ? showCommentBox || selectedTags.includes('Other')
                          : selectedTags.includes(tag.label)

                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => toggleTag(tag)}
                          className={`flex items-center justify-center gap-2 rounded-2xl py-3 px-3 text-xs sm:text-sm font-bold transition-all duration-150 active:scale-95 border ${
                            isSelected
                              ? 'bg-emerald-50 text-emerald-800 border-emerald-400 ring-2 ring-emerald-500/20 shadow-xs'
                              : 'bg-[#F1F3F5] hover:bg-slate-200/70 text-slate-700 border-transparent'
                          }`}
                        >
                          {tag.icon ? <span className="text-base leading-none">{tag.icon}</span> : null}
                          <span>{tag.label}</span>
                        </button>
                      )
                    })}
                  </div>

                  {/* Expandable / Optional Comment box */}
                  {(showCommentBox || selectedTags.length > 0) && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-4 text-left"
                    >
                      <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        rows={2}
                        placeholder="Share more details (optional)..."
                        maxLength={400}
                        className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs sm:text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:outline-hidden"
                      />
                    </motion.div>
                  )}

                  {/* Error Notification */}
                  {error && (
                    <p className="mb-3 rounded-xl bg-rose-50 p-2 text-xs font-bold text-rose-700">
                      {error}
                    </p>
                  )}

                  {/* Action Buttons */}
                  <div className="flex flex-col gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleSubmit}
                      disabled={submitting || rating === 0}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 hover:bg-emerald-700 py-3.5 text-sm font-extrabold text-white shadow-lg shadow-emerald-600/25 transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
                    >
                      {submitting ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      <span>{submitting ? 'Submitting...' : 'Submit Review'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleClose}
                      disabled={submitting}
                      className="py-1.5 text-xs font-bold text-slate-400 hover:text-slate-600 transition"
                    >
                      Skip for now
                    </button>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  )

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent
}
