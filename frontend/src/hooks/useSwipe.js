import { useRef } from 'react'

/**
 * Touch + mouse-drag swipe detection for carousels.
 * Usage: <div {...useSwipe({ onNext, onPrev })} />
 * Vertical scrolling stays native (touch-action: pan-y); only a clearly
 * horizontal drag past `threshold` px triggers a slide change.
 */
export function useSwipe({ onNext, onPrev, onStart, onEnd, threshold = 40 } = {}) {
  const start = useRef(null)
  const dragged = useRef(false)

  const begin = (x, y) => {
    start.current = { x, y }
    dragged.current = false
    onStart?.()
  }

  const finish = (x, y) => {
    const s = start.current
    start.current = null
    if (!s) return
    const dx = x - s.x
    const dy = y - s.y
    if (Math.abs(dx) >= threshold && Math.abs(dx) > Math.abs(dy)) {
      dragged.current = true
      if (dx < 0) onNext?.()
      else onPrev?.()
    }
    onEnd?.()
  }

  return {
    style: { touchAction: 'pan-y', cursor: 'grab' },
    onTouchStart: (e) => begin(e.touches[0].clientX, e.touches[0].clientY),
    onTouchEnd: (e) => finish(e.changedTouches[0].clientX, e.changedTouches[0].clientY),
    onTouchCancel: () => {
      start.current = null
      onEnd?.()
    },
    onMouseDown: (e) => {
      e.preventDefault() // stop native image/video drag ghost
      begin(e.clientX, e.clientY)
    },
    onMouseUp: (e) => finish(e.clientX, e.clientY),
    onMouseLeave: () => {
      if (start.current) {
        start.current = null
        onEnd?.()
      }
    },
    // swallow the click that follows a drag so links/buttons inside don't fire
    onClickCapture: (e) => {
      if (dragged.current) {
        e.stopPropagation()
        e.preventDefault()
        dragged.current = false
      }
    },
  }
}
