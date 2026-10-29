import { Star } from 'lucide-react'
import { AppListSkeleton } from '../../app-ui/feedback/AppListSkeleton.jsx'
import { hashSeed } from '../../../lib/discoverLabourDummyUi.js'

export function IndividualHomeWorkerCarousel({
  title = 'Nearby service providers',
  workers,
  loading,
  error,
  emptyAction,
  onSelectWorker,
  onEmptyAction,
}) {
  return (
    <section className="mb-6" aria-label={title}>
      <div className="lc-home-section-head">
        <h3>{title}</h3>
        {emptyAction && !loading && !error && workers.length === 0 ? (
          <button
            type="button"
            onClick={onEmptyAction}
            className="rounded-full bg-brand px-3.5 py-1.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-brand-bright"
          >
            {emptyAction}
          </button>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-center text-xs font-medium text-amber-900">
          {error}
        </p>
      ) : null}

      {loading ? <AppListSkeleton rows={1} className="h-44" /> : null}

      {!loading && workers.length > 0 ? (
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 scrollbar-none [&::-webkit-scrollbar]:hidden">
          {workers.map((l) => {
            const ui = l._ui
            const firstCat = (l.tradeCategories || [])[0]
            const dayRate = 380 + hashSeed(String(l.id), 220)
            const reviewCount = ui.ratingCount >= 1000 ? `${(ui.ratingCount / 1000).toFixed(1)}K` : ui.ratingCount

            return (
              <button
                key={l.id}
                type="button"
                onClick={() => onSelectWorker?.(l.id)}
                className="lc-home-service-card snap-start"
              >
                <img src={ui.photoUrl} alt="" className="lc-home-service-card-img" loading="lazy" />
                <div className="lc-home-service-card-body">
                  <div className="flex items-start justify-between gap-1">
                    <p className="line-clamp-1 text-sm font-bold text-slate-900">{firstCat?.name || 'Service provider'}</p>
                    <span className="shrink-0 text-xs font-bold text-slate-900">₹{dayRate}/day</span>
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-[11px] font-medium text-slate-500">{l.displayName}</p>
                  <p className="mt-1 flex items-center gap-1 text-[10px] font-semibold text-slate-600">
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" aria-hidden />
                    {ui.rating.toFixed(1)} ({reviewCount} reviews)
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      ) : null}
    </section>
  )
}
