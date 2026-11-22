/**
 * Utility to prevent pinch-to-zoom, gesture zoom, and keyboard/wheel zoom
 * across both User and Service Provider mobile & desktop views.
 */
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  const preventDefault = (e) => {
    if (typeof e?.preventDefault === 'function') {
      e.preventDefault()
    }
  }

  // 1. Prevent Safari gesture zoom (pinch on iOS WebKit)
  document.addEventListener('gesturestart', preventDefault, { passive: false })
  document.addEventListener('gesturechange', preventDefault, { passive: false })
  document.addEventListener('gestureend', preventDefault, { passive: false })

  // 2. Prevent multi-touch pinch to zoom (Android Chrome, iOS Safari)
  document.addEventListener(
    'touchstart',
    (e) => {
      if (e.touches && e.touches.length > 1) {
        e.preventDefault()
      }
    },
    { passive: false }
  )

  // 3. Prevent double-tap to zoom on quick successive taps
  let lastTouchEndTime = 0
  document.addEventListener(
    'touchend',
    (e) => {
      const now = Date.now()
      if (now - lastTouchEndTime <= 300) {
        const target = e.target
        const tag = target?.tagName?.toUpperCase?.()
        const isInput =
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          target?.isContentEditable
        if (!isInput) {
          e.preventDefault()
        }
      }
      lastTouchEndTime = now
    },
    { passive: false }
  )

  // 4. Prevent Ctrl + Mouse wheel / trackpad pinch zoom
  document.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey) {
        e.preventDefault()
      }
    },
    { passive: false }
  )

  // 5. Prevent Ctrl + '+', '-', '=', '_' keyboard zooming
  document.addEventListener('keydown', (e) => {
    if (
      e.ctrlKey &&
      (e.key === '+' ||
        e.key === '-' ||
        e.key === '=' ||
        e.key === '_' ||
        e.key === '0')
    ) {
      e.preventDefault()
    }
  })
}
