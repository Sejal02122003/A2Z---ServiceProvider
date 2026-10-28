const variants = {
  neutral: 'bg-slate-100 text-[#4D5960] ring-[#E2E8EA]',
  brand: 'bg-[#E5F9FA] text-[#015F6C] ring-[#01C7D0]/30 font-bold',
  accent: 'bg-[#E5F9FA] text-[#015F6C] ring-[#01C7D0]/50 font-bold',
  amber: 'bg-amber-50 text-[#B45309] ring-amber-200/90 font-bold',
  emerald: 'bg-emerald-50 text-[#15803D] ring-emerald-200/90 font-bold',
  rose: 'bg-rose-50 text-[#DC2626] ring-rose-200/90 font-bold',
  blue: 'bg-blue-50 text-[#1D4ED8] ring-blue-200/90 font-bold',
  purple: 'bg-purple-50 text-[#7C3AED] ring-purple-200/90 font-bold',
}

/**
 * Status / label chip aligned with app shell chips.
 */
export function AppBadge({ children, variant = 'neutral', className = '', uppercase = true }) {
  const uc = uppercase ? 'uppercase tracking-wide' : ''
  return (
    <span
      className={`inline-flex max-w-full truncate rounded-full px-2.5 py-0.5 text-[10px] font-semibold shadow-sm ring-1 backdrop-blur-sm ${uc} ${variants[variant] || variants.neutral} ${className}`}
    >
      {children}
    </span>
  )
}
