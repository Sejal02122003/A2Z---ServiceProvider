/**
 * Filter chips — horizontal scroll, optional multi-select via parent.
 */
export function AppChipRow({ children, className = '' }) {
  return (
    <div
      className={`flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
    >
      {children}
    </div>
  )
}

export function AppChip({ active, children, onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 snap-start rounded-full border px-3.5 py-2 text-xs font-semibold transition ${
        active
          ? 'border-[#01C7D0]/40 bg-[#E5F9FA] text-[#015F6C] shadow-sm ring-1 ring-[#01C7D0]/30 font-bold'
          : 'border-[#E2E8EA] bg-white text-[#64747B] hover:border-slate-300'
      } ${className}`}
    >
      {children}
    </button>
  )
}
