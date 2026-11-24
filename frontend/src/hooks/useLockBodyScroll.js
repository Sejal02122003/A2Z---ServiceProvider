import { useEffect } from 'react'

// Shared across all callers so two modals open at once cannot unlock each other.
let lockCount = 0
let previous = null

function lock() {
  if (typeof document === 'undefined') return
  if (lockCount === 0) {
    const html = document.documentElement
    const body = document.body
    previous = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      htmlOverscroll: html.style.overscrollBehavior,
      bodyOverscroll: body.style.overscrollBehavior,
    }
    html.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    html.style.overscrollBehavior = 'none'
    body.style.overscrollBehavior = 'none'
  }
  lockCount += 1
}

function unlock() {
  if (typeof document === 'undefined') return
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount === 0 && previous) {
    const html = document.documentElement
    const body = document.body
    html.style.overflow = previous.htmlOverflow
    body.style.overflow = previous.bodyOverflow
    html.style.overscrollBehavior = previous.htmlOverscroll
    body.style.overscrollBehavior = previous.bodyOverscroll
    previous = null
  }
}

/**
 * Stops the page behind a modal from scrolling while `active` is true.
 * Restores the previous scroll behaviour when the modal closes or unmounts.
 */
export function useLockBodyScroll(active) {
  useEffect(() => {
    if (!active) return undefined
    lock()
    return unlock
  }, [active])
}
