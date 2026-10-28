import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'

export function AppSectionHeader({ title, actionLabel, actionTo, onActionClick, className = '' }) {
  const actionContent = (
    <span className="inline-flex items-center gap-0.5 text-xs font-bold text-brand">
      {actionLabel}
      <ChevronRight className="h-4 w-4" aria-hidden />
    </span>
  )

  return (
    <div className={`flex items-end justify-between gap-3 ${className}`}>
      <h2 className="text-base font-extrabold tracking-tight text-[#263238]">{title}</h2>
      {actionLabel && actionTo ? (
        <Link to={actionTo} className="shrink-0 py-0.5">
          {actionContent}
        </Link>
      ) : null}
      {actionLabel && onActionClick ? (
        <button type="button" onClick={onActionClick} className="shrink-0 py-0.5">
          {actionContent}
        </button>
      ) : null}
    </div>
  )
}
