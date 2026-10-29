import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { MapPin, Search, Navigation, UserCheck } from 'lucide-react'

const MESSAGES = [
  'Broadcasting request to nearby service providers...',
  'Scanning your area...',
  'Waiting for service providers to accept...',
  'Matching skills and pricing...',
]

export function BookingFindingScreen({ categoryLabel }) {
  const reduce = useReducedMotion()
  const [msgIndex, setMsgIndex] = useState(0)

  useEffect(() => {
    const msgTimer = window.setInterval(() => {
      setMsgIndex((i) => (i + 1) % MESSAGES.length)
    }, 3000)

    return () => {
      window.clearInterval(msgTimer)
    }
  }, [])

  return (
    <motion.div
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-10 text-center"
    >
      <div className="relative flex h-56 w-56 items-center justify-center rounded-full bg-slate-50 shadow-inner overflow-hidden ring-4 ring-slate-50/50">
        {/* Radar circles */}
        <div className="absolute inset-4 rounded-full border border-brand/20"></div>
        <div className="absolute inset-12 rounded-full border border-brand/20"></div>
        <div className="absolute inset-20 rounded-full border border-brand/20"></div>
        
        {/* Radar sweep */}
        <div
          className="absolute inset-0 rounded-full origin-center animate-[spin_2s_linear_infinite]"
          style={{
            background: 'conic-gradient(from 0deg, transparent 70%, rgba(16, 185, 129, 0.4) 100%)',
          }}
        />
        
        {/* Center Pin */}
        <span className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-brand text-white shadow-lg shadow-brand/40 ring-4 ring-white">
          <MapPin className="h-6 w-6" aria-hidden />
        </span>
        
        {/* Ping blips - random dots that appear and fade */}
        <motion.div
          className="absolute top-12 right-16 h-3 w-3 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(16,185,129,0.8)]"
          animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5] }}
          transition={{ duration: 3, repeat: Infinity, delay: 0.5 }}
        />
        <motion.div
          className="absolute bottom-16 left-12 h-2 w-2 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(16,185,129,0.8)]"
          animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5] }}
          transition={{ duration: 2.5, repeat: Infinity, delay: 1.2 }}
        />
        <motion.div
          className="absolute top-24 left-10 h-2 w-2 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(16,185,129,0.8)]"
          animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5] }}
          transition={{ duration: 4, repeat: Infinity, delay: 0.8 }}
        />
      </div>

      <h2 className="mt-10 text-2xl font-black tracking-tight text-slate-900">Scanning for service providers</h2>
      {categoryLabel ? (
        <p className="mt-2 text-xs font-bold text-brand bg-brand/10 px-4 py-1.5 rounded-full uppercase tracking-wider">{categoryLabel}</p>
      ) : null}
      
      <div className="mt-4 h-6">
        <motion.p
          key={msgIndex}
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="max-w-xs text-sm font-medium text-slate-600"
        >
          {MESSAGES[msgIndex]}
        </motion.p>
      </div>

      <div className="mt-10 flex flex-wrap justify-center gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-[11px] font-bold text-slate-700 shadow-sm ring-1 ring-slate-200">
          <Search className="h-3.5 w-3.5 text-brand" aria-hidden />
          Broadcasting
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-[11px] font-bold text-slate-700 shadow-sm ring-1 ring-slate-200">
          <Navigation className="h-3.5 w-3.5 text-blue-600" aria-hidden />
          Up to 5 min wait
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-[11px] font-bold text-slate-700 shadow-sm ring-1 ring-slate-200">
          <UserCheck className="h-3.5 w-3.5 text-blue-500" aria-hidden />
          Verified profiles
        </span>
      </div>
    </motion.div>
  )
}
