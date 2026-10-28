export function AppField({ label, optional, hint, error, children, className = '' }) {
  return (
    <div className={className}>
      {label ? (
        <label className="mb-1.5 flex items-baseline gap-1 text-[11px] font-bold uppercase tracking-wide text-[#4D5960]">
          <span>{label}</span>
          {optional ? <span className="font-normal normal-case text-[#64747B]">(optional)</span> : null}
        </label>
      ) : null}
      {children}
      {hint && !error ? <p className="mt-1 text-[11px] font-medium text-[#64747B]">{hint}</p> : null}
      {error ? <p className="mt-1 text-[11px] font-semibold text-[#DC2626]">{error}</p> : null}
    </div>
  )
}
