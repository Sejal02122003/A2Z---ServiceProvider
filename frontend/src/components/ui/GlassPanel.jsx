export function GlassPanel({ children, className = '', ...rest }) {
  return (
    <div
      className={`relative rounded-3xl border border-[#E2E8EA] bg-white shadow-[0_8px_30px_-12px_rgba(38,50,56,0.08)] ${className}`}
      {...rest}
    >
      {children}
    </div>
  )
}
