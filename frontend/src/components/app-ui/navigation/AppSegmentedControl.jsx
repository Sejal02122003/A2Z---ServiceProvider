/**
 * Two-option segmented control (reference: pill segment).
 */
export function AppSegmentedControl({ left, right, value, onChange, className = '', brandAccent = false }) {
  const activeTone = brandAccent ? 'text-[#015F6C]' : 'text-[#263238]'
  return (
    <div
      className={`flex rounded-2xl border border-[#E2E8EA] bg-[#F5FAFA] p-1 shadow-inner ${className}`}
      role="group"
    >
      <button
        type="button"
        aria-pressed={value === 'left'}
        onClick={() => onChange('left')}
        className={`min-w-0 flex-1 rounded-xl py-2.5 text-xs font-bold transition ${
          value === 'left' ? `bg-white shadow-sm ring-1 ring-[#E2E8EA] ${activeTone}` : 'text-[#64747B] hover:text-[#263238]'
        }`}
      >
        {left}
      </button>
      <button
        type="button"
        aria-pressed={value === 'right'}
        onClick={() => onChange('right')}
        className={`min-w-0 flex-1 rounded-xl py-2.5 text-xs font-bold transition ${
          value === 'right' ? `bg-white shadow-sm ring-1 ring-[#E2E8EA] ${activeTone}` : 'text-[#64747B] hover:text-[#263238]'
        }`}
      >
        {right}
      </button>
    </div>
  )
}
