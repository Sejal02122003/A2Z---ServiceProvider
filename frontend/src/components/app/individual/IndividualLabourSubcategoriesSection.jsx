import { motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Loader2, Wrench } from 'lucide-react'
import { getCategoryImageUrl, onCategoryImgError } from '../../../lib/labourCategoryDisplay.js'

function CategoryImage({ src, name }) {
  return (
    <div className="relative aspect-[5/4] w-full overflow-hidden rounded-2xl bg-slate-100">
      <img
        src={src}
        alt=""
        className="lc-img-reveal h-full w-full object-cover"
        loading="lazy"
        decoding="async"
        onLoad={(e) => e.currentTarget.classList.add('lc-img-loaded')}
        onError={onCategoryImgError}
      />
      <span
        className="pointer-events-none absolute inset-x-0 bottom-0 bg-slate-900/55 px-2.5 py-2 text-left text-[11px] font-bold leading-tight text-white"
        aria-hidden
      >
        {name}
      </span>
    </div>
  )
}

export function IndividualLabourSubcategoriesSection({ subcategories, loading, onSelect, onQuickBook }) {
  const reduce = useReducedMotion()
  const featured = subcategories.slice(0, 8)

  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.32 }}
      className="space-y-3"
      aria-labelledby="home-subcategories-heading"
    >
      <div className="lc-home-section-head">
        <h3 id="home-subcategories-heading">Book by skill</h3>
        {!loading && subcategories.length > 8 ? (
          <span className="text-xs font-semibold text-slate-400">{subcategories.length} skills</span>
        ) : null}
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-3xl border border-slate-100 bg-slate-50 py-14 text-sm text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin text-brand" aria-hidden />
          Loading…
        </div>
      ) : null}

      {!loading && subcategories.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center">
          <Wrench className="mx-auto h-8 w-8 text-slate-300" aria-hidden />
          <p className="mt-2 text-sm font-semibold text-slate-700">Skills catalogue coming soon</p>
        </div>
      ) : null}

      {!loading && featured.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          {featured.map((cat, idx) => {
            const img = getCategoryImageUrl(cat)

            return (
              <motion.div
                key={String(cat._id)}
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(idx * 0.04, 0.2) }}
              >
                <button
                  type="button"
                  onClick={() => {
                    onSelect?.(cat)
                    onQuickBook?.(cat)
                  }}
                  className="group w-full overflow-hidden rounded-3xl border border-slate-100 bg-white p-2 shadow-[0_6px_24px_-12px_rgba(15,23,42,0.1)] transition hover:-translate-y-0.5 hover:border-brand/20 hover:shadow-[0_12px_32px_-14px_rgba(15,23,42,0.14)] active:scale-[0.98]"
                >
                  <CategoryImage src={img} name={cat.name} />
                  <span className="mt-2 flex items-center justify-center gap-1 text-xs font-bold text-brand opacity-0 transition group-hover:opacity-100">
                    Book
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </span>
                </button>
              </motion.div>
            )
          })}
        </div>
      ) : null}
    </motion.section>
  )
}
