import { motion, useReducedMotion } from 'framer-motion'

export function ConstructionIllustration() {
  const reduce = useReducedMotion()

  const float = reduce
    ? {}
    : {
        animate: { y: [0, -10, 0] },
        transition: { duration: 5, repeat: Infinity, ease: 'easeInOut' },
      }

  return (
    <div className="relative mx-auto aspect-[5/4] w-full max-w-lg">
      <div className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-brand/15 via-brand-muted/50 to-transparent blur-3xl" />
      <motion.svg
        role="img"
        aria-label="Stylised construction site with workers and safety gear"
        viewBox="0 0 480 400"
        className="relative h-full w-full drop-shadow-[0_20px_50px_rgba(15,23,42,0.08)]"
        initial={reduce ? false : { opacity: 0, scale: 0.96 }}
        animate={reduce ? undefined : { opacity: 1, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      >
        <defs>
          <linearGradient id="lc-sky" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#eff6ff" />
            <stop offset="100%" stopColor="#d1fae5" />
          </linearGradient>
          <linearGradient id="lc-glow" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#009eb3" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#009eb3" stopOpacity="0.08" />
          </linearGradient>
          <linearGradient id="lc-beam" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#00c5d6" stopOpacity="0" />
            <stop offset="50%" stopColor="#009eb3" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#00c5d6" stopOpacity="0" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width="480" height="400" rx="32" fill="url(#lc-sky)" />
        <rect x="24" y="48" width="432" height="304" rx="28" fill="white" fillOpacity="0.55" />
        <rect x="40" y="120" width="400" height="8" rx="4" fill="url(#lc-glow)" />

        <motion.g {...float}>
          <rect x="56" y="200" width="120" height="140" rx="12" fill="#cbd5e1" stroke="#94a3b8" />
          <rect x="200" y="160" width="100" height="180" rx="12" fill="#e2e8f0" stroke="#cbd5e1" />
          <rect x="330" y="220" width="90" height="120" rx="12" fill="#f1f5f9" stroke="#cbd5e1" />
          <path
            d="M 120 200 L 120 96 L 200 120 L 120 200 Z"
            fill="#009eb3"
            fillOpacity="0.2"
            stroke="#009eb3"
            strokeWidth="2"
          />
          <rect x="60" y="88" width="4" height="120" fill="#94a3b8" />
        </motion.g>

        <motion.circle
          cx="380"
          cy="92"
          r="28"
          fill="url(#lc-glow)"
          animate={reduce ? undefined : { scale: [1, 1.06, 1], opacity: [0.5, 0.75, 0.5] }}
          transition={{ duration: 4, repeat: Infinity }}
        />

        <motion.g
          animate={reduce ? undefined : { x: [0, 6, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ellipse cx="140" cy="318" rx="36" ry="10" fill="#0f172a" fillOpacity="0.12" />
          <circle cx="140" cy="268" r="22" fill="#fde68a" />
          <path d="M 118 288 L 162 288 L 156 332 L 124 332 Z" fill="#004e64" />
          <rect x="126" y="246" width="28" height="16" rx="4" fill="#009eb3" />
        </motion.g>

        <motion.g
          animate={reduce ? undefined : { x: [0, -5, 0] }}
          transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ellipse cx="280" cy="328" rx="40" ry="11" fill="#0f172a" fillOpacity="0.12" />
          <circle cx="280" cy="276" r="24" fill="#fdba74" />
          <path d="M 252 298 L 308 298 L 300 348 L 260 348 Z" fill="#004e64" fillOpacity="0.95" />
          <rect x="268" y="252" width="32" height="18" rx="5" fill="#ffffff" />
        </motion.g>

        <rect x="32" y="332" width="416" height="36" rx="12" fill="#0f172a" fillOpacity="0.06" />
        <rect x="48" y="340" width="384" height="6" rx="3" fill="url(#lc-beam)" />

        <text
          x="240"
          y="78"
          textAnchor="middle"
          fill="#0f172a"
          fontSize="13"
          fontFamily="Inter, system-ui, sans-serif"
          fontWeight="700"
          letterSpacing="0.08em"
        >
          LIVE SITE · DELHI NCR
        </text>
      </motion.svg>
    </div>
  )
}
