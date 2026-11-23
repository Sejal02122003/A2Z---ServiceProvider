const TAB_META = {
  offers: { label: 'Requests', hint: 'New assignments' },
  active: { label: 'Active', hint: 'On site now' },
  history: { label: 'History', hint: 'Completed' },
}

export function LabourJobsTabBar({ tab, onChange, counts }) {
  return (
    <div className="sticky top-[62px] z-20 pt-1 pb-1.5 bg-slate-50/95 backdrop-blur-md">
      <div className="rounded-2xl border border-slate-200/90 bg-white/95 p-1.5 shadow-sm ring-1 ring-slate-100/90">
      <div className="grid grid-cols-3 gap-1" role="tablist" aria-label="Job lists">
        {Object.entries(TAB_META).map(([id, meta]) => {
          const active = tab === id
          const count = counts[id] ?? 0
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(id)}
              className={`relative flex flex-col items-center rounded-xl px-2 py-2.5 transition ${
                active
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <span className="text-xs font-extrabold">{meta.label}</span>
                {count > 0 ? (
                  <span
                    className={`flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-black tabular-nums ${
                      active ? 'bg-white/20 text-white' : 'bg-brand/12 text-brand'
                    }`}
                  >
                    {count > 9 ? '9+' : count}
                  </span>
                ) : null}
              </span>
              <span className={`mt-0.5 text-[9px] font-medium ${active ? 'text-white/70' : 'text-slate-400'}`}>
                {meta.hint}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  </div>
  )
}
