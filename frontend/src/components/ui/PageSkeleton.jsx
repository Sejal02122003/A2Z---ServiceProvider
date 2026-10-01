import { motion, AnimatePresence } from 'framer-motion'

function Bar({ className }) {
  return (
    <div
      className={`animate-pulse rounded-lg bg-gradient-to-r from-zinc-800 via-zinc-700/80 to-zinc-800 ${className}`}
      aria-hidden
    />
  )
}

export function PageSkeleton({ visible }) {
  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          key="skeleton"
          className="fixed inset-0 z-[100] flex items-center justify-center bg-page"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45 }}
          role="status"
          aria-live="polite"
          aria-label="Loading A2Z"
        >
          <div className="w-full max-w-md space-y-6 px-6">
            <div className="flex items-center gap-3">
              <Bar className="h-10 w-10 rounded-2xl" />
              <div className="flex-1 space-y-2">
                <Bar className="h-4 w-40" />
                <Bar className="h-3 w-56 opacity-70" />
              </div>
            </div>
            <Bar className="h-36 w-full rounded-3xl" />
            <div className="grid grid-cols-2 gap-3">
              <Bar className="h-12 w-full rounded-2xl" />
              <Bar className="h-12 w-full rounded-2xl" />
            </div>
            <div className="space-y-2">
              <Bar className="h-3 w-full" />
              <Bar className="h-3 w-5/6" />
              <Bar className="h-3 w-4/6" />
            </div>
            <p className="text-center text-xs text-zinc-500">Preparing your experience…</p>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
