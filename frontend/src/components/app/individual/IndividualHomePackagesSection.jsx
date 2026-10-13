import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Package, Sparkles, ArrowRight, Check, Clock, ChevronRight } from 'lucide-react'
import { fetchPublicPackages } from '../../../api/packagesApi.js'
import { readAppUserLocation } from '../../../lib/appUserLocationStorage.js'

export function IndividualHomePackagesSection() {
  const navigate = useNavigate()
  const [packages, setPackages] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const loc = readAppUserLocation()
    const params = { limit: 6 }
    if (loc?.city) params.city = loc.city
    if (loc?.lat && loc?.lng) {
      params.lat = loc.lat
      params.lng = loc.lng
    }

    fetchPublicPackages(params)
      .then((res) => {
        if (!cancelled) {
          setPackages(res.data?.packages || [])
        }
      })
      .catch((err) => {
        console.error('Failed to load home packages:', err)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  if (!loading && packages.length === 0) {
    return null
  }

  return (
    <section className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between px-1">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-brand">
            <Sparkles className="h-3.5 w-3.5" />
            Curated Bundles
          </div>
          <h2 className="text-base font-black text-slate-900 tracking-tight">
            Service Packages
          </h2>
        </div>
        <button
          type="button"
          onClick={() => navigate('/app/packages')}
          className="flex items-center gap-1 text-xs font-bold text-brand hover:underline"
        >
          <span>See all</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Horizontal Carousel */}
      <div className="flex gap-3.5 overflow-x-auto pb-2 pt-0.5 scrollbar-none -mx-4 px-4">
        {loading
          ? [1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-56 w-64 shrink-0 rounded-2xl bg-slate-100 animate-pulse border border-slate-200/60"
              />
            ))
          : packages.map((pkg) => {
              const savings =
                pkg.originalPrice && pkg.originalPrice > pkg.price
                  ? pkg.originalPrice - pkg.price
                  : 0
              const discountPct =
                pkg.discountPercentage ||
                (pkg.originalPrice ? Math.round((savings / pkg.originalPrice) * 100) : 0)

              return (
                <div
                  key={pkg._id}
                  onClick={() => navigate(`/app/packages/${pkg.slug || pkg._id}`)}
                  className="group relative flex w-64 shrink-0 cursor-pointer flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs hover:shadow-md transition-all active:scale-[0.99]"
                >
                  <div>
                    {/* Image Header */}
                    <div className="relative h-28 w-full overflow-hidden bg-slate-100">
                      <img
                        src={pkg.imageUrl || 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80'}
                        alt={pkg.name}
                        className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-transparent" />

                      {pkg.badge && (
                        <span className="absolute left-2.5 top-2.5 rounded-full bg-amber-500 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-slate-900 shadow-xs">
                          {pkg.badge}
                        </span>
                      )}

                      {discountPct > 0 && (
                        <span className="absolute right-2.5 top-2.5 rounded-full bg-emerald-600 px-2 py-0.5 text-[9px] font-bold text-white shadow-xs">
                          {discountPct}% OFF
                        </span>
                      )}

                      <div className="absolute bottom-2 left-2.5 right-2.5 text-white">
                        <p className="text-[10px] font-semibold text-indigo-200">
                          {pkg.categoryId?.name || 'Bundle'}
                        </p>
                        <h3 className="truncate text-xs font-black drop-shadow-sm">
                          {pkg.name}
                        </h3>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-3 space-y-2">
                      {pkg.inclusions && pkg.inclusions.length > 0 && (
                        <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                          <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-700">
                            <Check className="h-2.5 w-2.5 text-brand stroke-[3]" />
                            {pkg.inclusions.length} services included
                          </span>
                          {pkg.estimatedDurationMins && (
                            <span className="text-[10px] text-slate-400 font-medium">
                              • ~{pkg.estimatedDurationMins}m
                            </span>
                          )}
                        </div>
                      )}

                      {pkg.shortDescription && (
                        <p className="text-[11px] text-slate-500 line-clamp-1 font-medium">
                          {pkg.shortDescription}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Footer Price & Action */}
                  <div className="border-t border-slate-100 bg-slate-50/60 p-3 pt-2.5 flex items-center justify-between">
                    <div>
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm font-black text-slate-900">
                          ₹{Number(pkg.price).toLocaleString('en-IN')}
                        </span>
                        {pkg.originalPrice && pkg.originalPrice > pkg.price && (
                          <span className="text-[10px] font-semibold text-slate-400 line-through">
                            ₹{Number(pkg.originalPrice).toLocaleString('en-IN')}
                          </span>
                        )}
                      </div>
                      {savings > 0 && (
                        <p className="text-[9px] font-bold text-emerald-600">
                          Save ₹{savings.toLocaleString('en-IN')}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      className="rounded-lg bg-brand px-2.5 py-1 text-[11px] font-bold text-white shadow-2xs hover:opacity-95"
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
