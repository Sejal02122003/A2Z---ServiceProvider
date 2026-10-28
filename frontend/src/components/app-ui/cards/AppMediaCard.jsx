/**
 * Image-led card for services / workers (reference: product tiles).
 */
export function AppMediaCard({
  image,
  imageAlt = '',
  badge,
  title,
  subtitle,
  meta,
  footer,
  className = '',
  onClick,
}) {
  const interactive = Boolean(onClick)
  const Wrapper = interactive ? 'button' : 'div'

  return (
    <Wrapper
      type={interactive ? 'button' : undefined}
      onClick={onClick}
      className={`w-full overflow-hidden rounded-2xl border border-[#E2E8EA] bg-white text-left shadow-[0_8px_24px_-14px_rgba(38,50,56,0.1)] transition hover:border-[#015F6C]/30 hover:shadow-[0_12px_32px_-16px_rgba(1,95,108,0.15)] ${interactive ? 'active:scale-[0.99]' : ''} ${className}`}
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
        {image ? (
          <img src={image} alt={imageAlt} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-slate-100 to-slate-50 text-slate-300" aria-hidden>
            <span className="text-2xl font-black">?</span>
          </div>
        )}
        {badge ? <div className="absolute left-2 top-2">{badge}</div> : null}
      </div>
      <div className="space-y-1 p-3">
        <p className="line-clamp-2 text-sm font-bold leading-snug text-[#263238]">{title}</p>
        {subtitle ? <p className="line-clamp-2 text-xs font-medium text-[#64747B]">{subtitle}</p> : null}
        {meta ? <div className="pt-1">{meta}</div> : null}
        {footer ? <div className="pt-2">{footer}</div> : null}
      </div>
    </Wrapper>
  )
}
