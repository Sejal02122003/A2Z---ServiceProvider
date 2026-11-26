import { useLayoutEffect } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useLocation, useNavigationType, useOutlet } from 'react-router-dom'

/**
 * Mounts with each new page. On forward navigation (link / navigate()) start the
 * page at the top; on back/forward (POP) leave the browser's own scroll behaviour alone.
 */
function ScrollToTopOnEnter() {
  const navType = useNavigationType()
  useLayoutEffect(() => {
    if (navType === 'POP') return
    // html has `scroll-behavior: smooth`; force an instant jump so the animation
    // can't be interrupted by the page transition / layout and leave us mid-page.
    const toTop = () => window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
    toTop()
    const raf = requestAnimationFrame(toTop) // once more after first paint (content may have grown)
    return () => cancelAnimationFrame(raf)
  }, [navType])
  return null
}

export function AppPageTransition() {
  const location = useLocation()
  const outlet = useOutlet()
  const reduce = useReducedMotion()

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
        <ScrollToTopOnEnter />
        {outlet}
      </motion.div>
    </AnimatePresence>
  )
}
