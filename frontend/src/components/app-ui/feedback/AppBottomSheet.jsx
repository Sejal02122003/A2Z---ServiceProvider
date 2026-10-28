import { motion, useReducedMotion } from 'framer-motion'
import { appSpring } from '../../app/appMotion.js'

/**
 * Bottom sheet shell — parent controls open state and AnimatePresence if needed.
 */
export function AppBottomSheetBackdrop({ onClose }) {
  return (
    <button
      type="button"
      className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm"
      aria-label="Close"
      onClick={onClose}
    />
  )
}

export function AppBottomSheetPanel({ children, titleId, className = '' }) {
  const reduce = useReducedMotion()

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className={`relative z-10 w-full max-w-md overflow-hidden rounded-t-[1.75rem] rounded-b-none sm:rounded-3xl border border-[#E2E8EA] bg-white shadow-2xl ${className}`}
      initial={reduce ? false : { y: 28, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={reduce ? undefined : { y: 20, opacity: 0 }}
      transition={reduce ? { duration: 0.2 } : appSpring}
    >
      {children}
    </motion.div>
  )
}

export function AppBottomSheetChrome({ onClose, title, subtitle }) {
  return (
    <div className="border-b border-[#E2E8EA] px-4 pb-3 pt-2">
      <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-[#E2E8EA]" aria-hidden />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {title}
          {subtitle}
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-[#64747B] hover:bg-[#F5FAFA] hover:text-[#263238]"
          >
            Close
          </button>
        ) : null}
      </div>
    </div>
  )
}
