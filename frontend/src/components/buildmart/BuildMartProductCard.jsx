import { Link, useLocation } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { ChevronRight, Package, Truck } from 'lucide-react'
import { formatBuildMartPrice } from '../../data/buildmartCatalog.js'

export function BuildMartProductCard({ product, index = 0 }) {
  const reduce = useReducedMotion()
  const primaryVariant = product.variants?.[0]
  const { pathname } = useLocation()
  const basePath = pathname.includes('/contractor/mart') ? '/contractor/mart' : '/user/buildmart'

  return (
    <motion.article
      className="group overflow-hidden rounded-3xl border border-orange-100/90 bg-white shadow-[0_14px_40px_-24px_rgba(232,93,42,0.35)] ring-1 ring-slate-100/80 transition hover:shadow-[0_18px_48px_-22px_rgba(232,93,42,0.4)]"
      initial={reduce ? false : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.05, 0.25) }}
      whileHover={reduce ? undefined : { y: -3 }}
    >
      <Link to={`${basePath}/product/${product.id || product._id}`} className="block">
        <motion.div
          className="relative aspect-[16/10] overflow-hidden bg-slate-100"
          whileHover={reduce ? undefined : { scale: 1.02 }}
          transition={{ duration: 0.35 }}
        >
          <img
            src={product.images?.[0]}
            alt={product.name}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/50 via-transparent to-transparent" />
          <span className="absolute left-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-bm-terracotta ring-1 ring-orange-100">
            {product.brand}
          </span>
          {product.variantCount > 1 ? (
            <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-slate-900/80 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-sm">
              <Package className="h-3 w-3" aria-hidden />
              {product.variantCount} variants
            </span>
          ) : null}
        </motion.div>

        <motion.div className="space-y-2 p-4">
          <h3 className="text-base font-extrabold leading-snug tracking-tight text-slate-900">
            {product.name}
          </h3>
          <p className="line-clamp-2 text-xs leading-relaxed text-slate-600">{product.shortDescription}</p>

          <motion.div
            className="flex flex-wrap items-center gap-2"
            initial={false}
            whileHover={reduce ? undefined : { x: 2 }}
          >
            <span className="text-lg font-black text-bm-terracotta">
              {primaryVariant
                ? formatBuildMartPrice(primaryVariant.retailPrice, primaryVariant.unit)
                : product.priceLabel}
            </span>
            {primaryVariant?.bulkPrice ? (
              <span className="rounded-lg bg-orange-50 px-2 py-0.5 text-[10px] font-bold text-orange-800 ring-1 ring-orange-200/80">
                Bulk pricing available
              </span>
            ) : null}
          </motion.div>

          <p className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500">
            <Truck className="h-3.5 w-3.5 shrink-0 text-bm-orange" aria-hidden />
            {product.deliveryInfo}
          </p>

          <span className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-orange-200/80 bg-gradient-to-r from-orange-50 to-white py-2.5 text-sm font-extrabold text-bm-terracotta transition group-hover:border-orange-300 group-hover:from-orange-100">
            View Details
            <ChevronRight className="h-4 w-4" aria-hidden />
          </span>
        </motion.div>
      </Link>
    </motion.article>
  )
}
