/**
 * Horizontal pill tabs with optional scroll-snap.
 * @param {{ id: string, label: string }[]} props.items
 * @param {string} props.value
 * @param {(id: string) => void} props.onChange
 */
export function AppPillTabs({ items, value, onChange, className = '' }) {
  return (
    <div
      className={`flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className}`}
      role="tablist"
      aria-label="Tabs"
    >
      {items.map((item) => {
        const active = item.id === value
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.id)}
            className={`shrink-0 snap-start rounded-full px-4 py-2 text-xs font-bold tracking-wide transition ${
              active
                ? 'bg-[#015F6C] text-white shadow-md'
                : 'bg-white text-[#64747B] ring-1 ring-[#E2E8EA] hover:text-[#263238]'
            }`}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
