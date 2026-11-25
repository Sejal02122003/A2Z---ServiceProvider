import { Fragment } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useLocation, useOutlet } from 'react-router-dom'
import { useAutoRefreshKey } from '../../hooks/useAutoRefreshKey.js'

export function AppPageTransition() {
  const location = useLocation()
  const outlet = useOutlet()
  const reduce = useReducedMotion()
  // Bumping this key remounts the current page, so it re-runs its data fetching.
  const refreshKey = useAutoRefreshKey(location.pathname)

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        className="min-h-0 w-full"
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={reduce ? undefined : { opacity: 0 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      >
        <Fragment key={refreshKey}>{outlet}</Fragment>
      </motion.div>
    </AnimatePresence>
  )
}
