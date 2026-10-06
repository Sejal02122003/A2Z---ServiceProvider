import { Sparkles, Tag, Flame } from 'lucide-react'

/**
 * Premium Offer Badge component for service cards, lists, and headers.
 */
export function ServiceOfferBadge({ 
  label, 
  variant = 'compact', // 'compact' | 'ribbon' | 'pill' | 'highlight'
  className = '',
  icon: Icon = Tag
}) {
  if (!label) return null

  if (variant === 'ribbon') {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-500 via-rose-500 to-pink-500 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white shadow-sm ${className}`}>
        <Flame className="h-3 w-3 fill-amber-200 text-amber-200 animate-pulse" />
        <span>{label}</span>
      </span>
    )
  }

  if (variant === 'pill') {
    return (
      <span className={`inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-inset ring-emerald-600/20 ${className}`}>
        <Sparkles className="h-3 w-3 text-emerald-600" />
        <span>{label}</span>
      </span>
    )
  }

  if (variant === 'highlight') {
    return (
      <div className={`flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-50 via-rose-50 to-orange-50 border border-amber-200/80 p-2.5 ${className}`}>
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white shadow-sm">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-amber-950">{label}</p>
        </div>
      </div>
    )
  }

  // Default compact badge
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-700 ring-1 ring-inset ring-amber-500/20 ${className}`}>
      <Tag className="h-2.5 w-2.5 text-amber-600" />
      <span>{label}</span>
    </span>
  )
}
