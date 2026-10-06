import { useMemo } from 'react'
import { Sparkles, Flame, ChevronRight, Tag } from 'lucide-react'
import { getCategoryImageUrl } from '../../../lib/labourCategoryDisplay.js'
import { getServiceOfferDetails } from '../../../lib/serviceOfferUtils.js'
import { ServiceOfferBadge } from '../services/ServiceOfferBadge.jsx'

/**
 * Promotional Service Offers Carousel on User Home Screen.
 * Displays all services that have active discounts and deals.
 */
export function IndividualHomeServiceOffers({ tradeGroups, loading, onSelectService }) {
  // Extract all services across groups & categories that have active offers
  const offeredServices = useMemo(() => {
    if (!tradeGroups || !Array.isArray(tradeGroups)) return []
    const list = []

    for (const group of tradeGroups) {
      for (const cat of (group.categories || [])) {
        for (const svc of (cat.services || [])) {
          const offer = getServiceOfferDetails(svc)
          if (offer.hasOffer) {
            list.push({
              ...svc,
              parentCat: cat,
              groupName: group.name,
              offer,
            })
          }
        }
      }
    }

    // Sort by highest percentage or savings
    return list.sort((a, b) => (b.offer.discountValue || 0) - (a.offer.discountValue || 0)).slice(0, 10)
  }, [tradeGroups])

  if (loading || offeredServices.length === 0) return null

  return (
    <section className="space-y-3" aria-label="Exclusive Service Offers">
      <div className="lc-home-section-head items-end">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="flex h-5 w-5 items-center justify-center rounded-md bg-amber-500/15 text-amber-600">
              <Flame className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
            </span>
            <h3 className="text-base font-extrabold text-slate-900 tracking-tight">Special Offers & Deals</h3>
          </div>
          <p className="mt-0.5 text-xs font-medium text-slate-500">
            Limited time discounted prices on top services
          </p>
        </div>
      </div>

      <div className="-mx-4 flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-4 pb-2 scrollbar-none [&::-webkit-scrollbar]:hidden">
        {offeredServices.map((item) => {
          const { offer, parentCat } = item
          const imgUrl = item.iconUrl 
            ? getCategoryImageUrl({ name: item.name, imageUrl: item.iconUrl })
            : getCategoryImageUrl(parentCat)

          return (
            <div
              key={String(item._id)}
              className="group relative flex w-[230px] shrink-0 snap-start flex-col justify-between rounded-2xl border border-amber-200/60 bg-gradient-to-b from-amber-50/40 via-white to-white p-3 shadow-sm transition hover:shadow-md hover:border-amber-300"
            >
              {/* Top Image + Offer Ribbon */}
              <div className="relative h-28 w-full overflow-hidden rounded-xl bg-slate-100 shadow-inner">
                <img
                  src={imgUrl}
                  alt={item.name}
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute top-2 left-2">
                  <ServiceOfferBadge label={offer.offerBadge} variant="ribbon" />
                </div>
              </div>

              {/* Body */}
              <div className="mt-2.5 flex-1 min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 truncate">
                  {parentCat.name}
                </p>
                <h4 className="text-sm font-extrabold text-slate-900 line-clamp-1 mt-0.5 group-hover:text-brand transition">
                  {item.name}
                </h4>
                {item.description ? (
                  <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                    {item.description}
                  </p>
                ) : null}
              </div>

              {/* Price & Action */}
              <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xs text-slate-400 line-through">
                      {offer.displayOriginalPrice}
                    </span>
                    <span className="text-sm font-black text-blue-600">
                      {offer.displayPrice}
                    </span>
                  </div>
                  <p className="text-[10px] font-bold text-emerald-600">
                    Save {offer.displaySavings}{offer.unitLabel}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => onSelectService?.(parentCat, item)}
                  className="rounded-xl bg-brand px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition active:scale-95 hover:bg-brand/90"
                >
                  Book
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
