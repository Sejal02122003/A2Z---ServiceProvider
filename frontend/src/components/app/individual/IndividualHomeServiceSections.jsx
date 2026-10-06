import { ChevronRight, Loader2, Wrench, Sparkles, Tag, Flame } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { getCategoryImageUrl } from '../../../lib/labourCategoryDisplay.js'
import { getServiceOfferDetails } from '../../../lib/serviceOfferUtils.js'
import { ServiceOfferBadge } from '../services/ServiceOfferBadge.jsx'

const LAYOUTS = [
  {
    variant: 'carousel',
    title: (g) => `Popular in ${g.name}`,
    subtitle: 'Swipe to explore services',
  },
  {
    variant: 'list',
    title: (g) => `${g.name} — quick book`,
    subtitle: 'Tap a role to start booking',
  },
  {
    variant: 'featured',
    title: (g) => `Top ${g.name} picks`,
    subtitle: 'Featured roles on your site',
  },
  {
    variant: 'strip',
    title: (g) => `Explore ${g.name}`,
    subtitle: 'Wide cards · fast selection',
  },
]

function toCategoryItem(c, group) {
  return {
    _id: c._id,
    name: c.name,
    slug: c.slug,
    subtitle: c.subtitle,
    imageUrl: c.imageUrl || '',
    groupId: group._id,
    groupName: group.name,
    services: c.services || [],
  }
}

function SectionHead({ titleId, title, subtitle, onViewAll }) {
  return (
    <div className="lc-home-section-head items-end">
      <div className="min-w-0">
        <h3 id={titleId}>{title}</h3>
        {subtitle ? <p className="mt-0.5 text-xs font-medium text-slate-500">{subtitle}</p> : null}
      </div>
      {onViewAll ? (
        <button type="button" onClick={onViewAll} className="lc-home-view-all shrink-0">
          See all
        </button>
      ) : null}
    </div>
  )
}

function ServiceImage({ src, alt, className = '' }) {
  return (
    <img
      src={src}
      alt={alt}
      className={`lc-img-reveal object-cover ${className}`}
      loading="lazy"
      decoding="async"
      onLoad={(e) => e.currentTarget.classList.add('lc-img-loaded')}
    />
  )
}

function CarouselLayout({ categories, onQuickBook }) {
  const items = categories.slice(0, 8)
  return (
    <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 scrollbar-none [&::-webkit-scrollbar]:hidden">
      {items.map((cat) => {
        const topOffer = (cat.services || [])
          .map(s => getServiceOfferDetails(s))
          .filter(o => o.hasOffer)
          .sort((a, b) => b.discountValue - a.discountValue)[0]

        return (
          <button
            key={String(cat._id)}
            type="button"
            onClick={() => onQuickBook?.(cat)}
            className="lc-home-service-card snap-start relative group"
          >
            <div className="relative h-28 w-full overflow-hidden rounded-t-[1.15rem]">
              <ServiceImage src={getCategoryImageUrl(cat)} alt="" className="lc-home-service-card-img" />
              {topOffer && (
                <div className="absolute top-1.5 left-1.5">
                  <ServiceOfferBadge label={topOffer.offerBadge} variant="ribbon" className="!text-[8px]" />
                </div>
              )}
            </div>
            <div className="lc-home-service-card-body">
              <p className="line-clamp-2 text-sm font-bold text-slate-900 group-hover:text-brand transition">{cat.name}</p>
              {cat.subtitle ? (
                <p className="mt-0.5 line-clamp-1 text-[11px] font-medium text-slate-500">{cat.subtitle}</p>
              ) : null}
              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-[10px] font-bold text-brand">Book now</span>
                {topOffer && (
                  <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.2 rounded">
                    Offers on
                  </span>
                )}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function ListLayout({ categories, onQuickBook }) {
  const navigate = useNavigate();
  const allServices = categories.flatMap(cat =>
    (cat.services || []).map(s => ({ ...s, parentCat: cat }))
  );
  const items = allServices.slice(0, 4);

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {items.map((svc) => {
          const offer = getServiceOfferDetails(svc);

          return (
            <li key={String(svc._id)}>
              <button
                type="button"
                onClick={() => onQuickBook?.(svc.parentCat)}
                className="lc-home-service-list-row group"
              >
                <div className="relative h-14 w-14 shrink-0 rounded-xl bg-slate-100 flex items-center justify-center overflow-hidden">
                  {svc.iconUrl ? (
                    <img src={getCategoryImageUrl({ name: svc.name, imageUrl: svc.iconUrl })} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ServiceImage
                      src={getCategoryImageUrl(svc.parentCat)}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded-xl"
                    />
                  )}
                  {offer.hasOffer && (
                    <div className="absolute top-0.5 left-0.5">
                      <span className="rounded bg-rose-600 px-1 py-0.2 text-[7px] font-black uppercase text-white shadow">
                        %{offer.discountValue}
                      </span>
                    </div>
                  )}
                </div>
                <span className="min-w-0 flex-1 text-left ml-1">
                  <div className="flex items-center gap-1.5">
                    <span className="block truncate text-sm font-bold text-slate-900 group-hover:text-brand transition">{svc.name}</span>
                    {offer.hasOffer && (
                      <ServiceOfferBadge label={offer.offerBadge} variant="compact" className="!text-[9px] !py-0" />
                    )}
                  </div>
                  <span className="block truncate text-xs font-medium text-slate-500">
                    {svc.parentCat.name}
                  </span>
                </span>
                <span className="shrink-0 text-right pr-1">
                  {offer.hasOffer ? (
                    <div>
                      <span className="block text-[10px] text-slate-400 line-through">
                        {offer.displayOriginalPrice}
                      </span>
                      <span className="text-sm font-bold text-blue-600">
                        {offer.displayPrice}
                      </span>
                    </div>
                  ) : (
                    <span className="text-sm font-bold text-blue-600">
                      {offer.displayPrice}
                    </span>
                  )}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 ml-1.5" aria-hidden />
              </button>
            </li>
          )
        })}
        {items.length === 0 && (
          <li className="text-sm text-slate-500 py-4 text-center">No services available.</li>
        )}
      </ul>
      <div className="flex justify-end pr-1 pt-1">
        <button
          type="button"
          onClick={() => navigate('/app/search')}
          className="text-xs font-bold text-brand transition hover:underline"
        >
          See more
        </button>
      </div>
    </div>
  )
}

function FeaturedLayout({ categories, onQuickBook }) {
  const items = categories.slice(0, 5)
  if (items.length === 0) return null
  const [hero, ...rest] = items

  return (
    <div className="space-y-3">
      <button type="button" onClick={() => onQuickBook?.(hero)} className="lc-home-service-featured">
        <ServiceImage src={getCategoryImageUrl(hero)} alt="" className="absolute inset-0 h-full w-full" />
        <span className="absolute inset-0 bg-slate-900/45" aria-hidden />
        <span className="relative p-4 text-left text-white">
          <span className="text-[10px] font-bold uppercase tracking-wide text-white/80">Featured</span>
          <span className="mt-1 block text-lg font-extrabold leading-tight">{hero.name}</span>
          {hero.subtitle ? (
            <span className="mt-1 block max-w-[14rem] text-xs text-white/85">{hero.subtitle}</span>
          ) : null}
          <span className="mt-3 inline-flex rounded-lg bg-brand px-3 py-1.5 text-xs font-bold">Book</span>
        </span>
      </button>
      {rest.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          {rest.map((cat) => (
            <button
              key={String(cat._id)}
              type="button"
              onClick={() => onQuickBook?.(cat)}
              className="lc-home-service-mini-tile"
            >
              <ServiceImage src={getCategoryImageUrl(cat)} alt="" className="h-20 w-full" />
              <span className="block truncate px-2 py-2 text-left text-xs font-bold text-slate-900">
                {cat.name}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function StripLayout({ categories, onQuickBook }) {
  const items = categories.slice(0, 5)
  return (
    <div className="space-y-2">
      {items.map((cat) => (
        <button
          key={String(cat._id)}
          type="button"
          onClick={() => onQuickBook?.(cat)}
          className="lc-home-service-strip"
        >
          <ServiceImage src={getCategoryImageUrl(cat)} alt="" className="h-full w-28 shrink-0 sm:w-32" />
          <span className="flex min-w-0 flex-1 items-center justify-between gap-2 px-3 py-3">
            <span className="min-w-0 text-left">
              <span className="block truncate text-sm font-bold text-slate-900">{cat.name}</span>
              {cat.subtitle ? (
                <span className="block truncate text-[11px] font-medium text-slate-500">{cat.subtitle}</span>
              ) : null}
            </span>
            <span className="shrink-0 rounded-lg bg-brand/10 px-2.5 py-1 text-[10px] font-bold text-brand">
              Book
            </span>
          </span>
        </button>
      ))}
    </div>
  )
}

function GroupSection({ group, layoutIndex, onQuickBook, onViewAll }) {
  const categories = (group.categories || []).map((c) => toCategoryItem(c, group))
  if (categories.length === 0) return null

  const layout = LAYOUTS[layoutIndex % LAYOUTS.length]
  const title = layout.title(group)
  const subtitle = layout.subtitle

  return (
    <section className="space-y-3" aria-labelledby={`home-services-${group._id}`}>
      <SectionHead
        titleId={`home-services-${group._id}`}
        title={title}
        subtitle={subtitle}
        onViewAll={categories.length > 4 ? onViewAll : undefined}
      />
      {layout.variant === 'carousel' ? (
        <CarouselLayout categories={categories} onQuickBook={onQuickBook} />
      ) : null}
      {layout.variant === 'list' ? <ListLayout categories={categories} onQuickBook={onQuickBook} /> : null}
      {layout.variant === 'featured' ? (
        <FeaturedLayout categories={categories} onQuickBook={onQuickBook} />
      ) : null}
      {layout.variant === 'strip' ? <StripLayout categories={categories} onQuickBook={onQuickBook} /> : null}
    </section>
  )
}

/** One section per work area — alternating layouts and headings. */
export function IndividualHomeServiceSections({ tradeGroups, loading, onQuickBook, onSelectGroup }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 rounded-3xl border border-slate-100 bg-slate-50 py-14 text-sm text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin text-brand" aria-hidden />
        Loading services…
      </div>
    )
  }

  const groups = (tradeGroups || []).filter((g) => (g.categories?.length ?? 0) > 0)
  if (groups.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
        <Wrench className="mx-auto h-8 w-8 text-slate-300" aria-hidden />
        <p className="mt-2 text-sm font-semibold text-slate-700">Services catalogue coming soon</p>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {groups.map((group, index) => (
        <GroupSection
          key={String(group._id)}
          group={group}
          layoutIndex={index}
          onQuickBook={onQuickBook}
          onViewAll={() => onSelectGroup?.(String(group._id))}
        />
      ))}
    </div>
  )
}
