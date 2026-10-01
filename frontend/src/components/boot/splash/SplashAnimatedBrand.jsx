import { useEffect } from 'react'
import './splashBrand.css'

const BRAND_LABEL = 'A2Z'
/** Same 3s timeline as screen.html */
export const SPLASH_BRAND_ANIMATION_MS = 3000

/**
 * SVG stroke → fill → glow — same layers and timing as screen.html.
 */
export function SplashAnimatedBrand({ className = '', onReady }) {
  useEffect(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const delay = reduced ? 0 : SPLASH_BRAND_ANIMATION_MS + 200
    const timer = window.setTimeout(() => onReady?.(), delay)
    return () => window.clearTimeout(timer)
  }, [onReady])

  return (
    <div
      className={`lc-brand-splash ${className}`.trim()}
      aria-label={BRAND_LABEL}
    >
      <svg viewBox="0 0 650 100" role="img" aria-hidden="true">
        <text x="50%" y="70%" textAnchor="middle" className="text-glow">
          {BRAND_LABEL}
        </text>
        <text x="50%" y="70%" textAnchor="middle" className="text-stroke">
          {BRAND_LABEL}
        </text>
        <text x="50%" y="70%" textAnchor="middle" className="text-fill">
          {BRAND_LABEL}
        </text>
      </svg>
    </div>
  )
}
