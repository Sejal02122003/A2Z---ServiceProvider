import { useCallback, useEffect, useState, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import {
  Package,
  Sparkles,
  Search,
  Clock,
  CheckCircle2,
  Tag,
  ArrowRight,
  AlertCircle,
  Loader2,
  Filter,
  Check,
  ShieldCheck,
} from 'lucide-react'
import { fetchPublicPackages } from '../../api/packagesApi.js'
import { readAppUserLocation } from '../../lib/appUserLocationStorage.js'
import { AppStackScreenHeader } from '../../components/app/AppStackScreenHeader.jsx'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'

export function ServicePackagesPage() {
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const [searchParams, setSearchParams] = useSearchParams()

  const [packages, setPackages] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('categoryId') || 'ALL')

  const userLocation = useMemo(() => readAppUserLocation(), [])

  const loadPackages = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = {}
      if (userLocation?.city) params.city = userLocation.city
      if (userLocation?.lat && userLocation?.lng) {
        params.lat = userLocation.lat
        params.lng = userLocation.lng
      }
      if (searchQuery.trim()) params.search = searchQuery.trim()

      const res = await fetchPublicPackages(params)
      setPackages(res.data?.packages || [])
    } catch (err) {
      console.error('Failed to load packages:', err)
      setError(err.message || 'Unable to load service packages. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [userLocation, searchQuery])

  useEffect(() => {
    loadPackages()
  }, [loadPackages])

  // Extract unique categories from packages for filter tabs
  const categories = useMemo(() => {
    const map = new Map()
    packages.forEach((pkg) => {
      if (pkg.categoryId) {
        const cat = pkg.categoryId
        const id = typeof cat === 'object' ? cat._id : cat
        const name = typeof cat === 'object' ? cat.name : 'Other'
        if (id && !map.has(String(id))) {
          map.set(String(id), { id: String(id), name })
        }
      }
    })
    return Array.from(map.values())
  }, [packages])

  // Filter packages based on active category tab
  const filteredPackages = useMemo(() => {
    if (selectedCategory === 'ALL') return packages
    return packages.filter((pkg) => {
      const catId = typeof pkg.categoryId === 'object' ? pkg.categoryId?._id : pkg.categoryId
      return String(catId) === selectedCategory
    })
  }, [packages, selectedCategory])

  const handleBookNow = (pkg) => {
    navigate(`/app/booking/flow?step=details&packageId=${pkg._id}`)
  }

  return (
    <div className="space-y-4 pb-12">
      <AppStackScreenHeader title="Service Packages" backTo="/app" />

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900 via-indigo-800 to-slate-900 p-5 text-white shadow-lg">
        <div className="absolute right-0 top-0 translate-x-4 -translate-y-4 opacity-10">
          <Package className="h-44 w-44" />
        </div>
        <div className="relative z-10 max-w-sm">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-bold backdrop-blur-md text-amber-300">
            <Sparkles className="h-3.5 w-3.5" />
            Curated Bundles
          </div>
          <h2 className="mt-2 text-xl font-black leading-tight">
            All-In-One Service Packages
          </h2>
          <p className="mt-1 text-xs text-indigo-100/90 leading-relaxed">
            Combine multiple services into one appointment and save more with fixed-rate, guaranteed pricing.
          </p>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search packages by service or bundle..."
          className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm font-medium text-slate-800 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 shadow-sm"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 hover:text-slate-600"
          >
            Clear
          </button>
        )}
      </div>

      {/* Category Pills */}
      {categories.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedCategory('ALL')}
            className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all shadow-sm ${
              selectedCategory === 'ALL'
                ? 'bg-brand text-white shadow-brand/20'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            All Packages
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setSelectedCategory(cat.id)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all shadow-sm ${
                selectedCategory === cat.id
                  ? 'bg-brand text-white shadow-brand/20'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-64 rounded-2xl bg-slate-100 animate-pulse border border-slate-200/60"
            />
          ))}
        </div>
      )}

      {/* Error State */}
      {!loading && error && (
        <GlassPanel className="p-6 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-rose-500 mb-2" />
          <p className="text-sm font-semibold text-rose-700">{error}</p>
          <button
            type="button"
            onClick={loadPackages}
            className="mt-3 rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white shadow hover:opacity-95"
          >
            Try Again
          </button>
        </GlassPanel>
      )}

      {/* Empty State */}
      {!loading && !error && filteredPackages.length === 0 && (
        <GlassPanel className="p-8 text-center space-y-3">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-brand">
            <Package className="h-7 w-7" />
          </div>
          <div>
            <h3 className="text-base font-extrabold text-slate-800">
              No service packages found
            </h3>
            <p className="text-xs text-slate-500 max-w-xs mx-auto mt-1">
              {searchQuery
                ? `No packages matched "${searchQuery}". Try different keywords or browse all categories.`
                : 'There are currently no active packages available for your selected area.'}
            </p>
          </div>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="rounded-xl border border-slate-300 px-4 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              Clear Search
            </button>
          )}
        </GlassPanel>
      )}

      {/* Package Cards Grid */}
      {!loading && !error && filteredPackages.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPackages.map((pkg) => {
            const savings =
              pkg.originalPrice && pkg.originalPrice > pkg.price
                ? pkg.originalPrice - pkg.price
                : 0
            const discountPct = pkg.discountPercentage || (pkg.originalPrice ? Math.round((savings / pkg.originalPrice) * 100) : 0)

            return (
              <motion.div
                key={pkg._id}
                whileHover={reduce ? {} : { y: -3 }}
                transition={{ duration: 0.2 }}
                className="group flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm hover:shadow-md transition-all"
              >
                <div>
                  {/* Card Image Banner */}
                  <div className="relative h-44 w-full overflow-hidden bg-slate-100">
                    <img
                      src={pkg.imageUrl || 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80'}
                      alt={pkg.name}
                      className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/70 via-slate-900/20 to-transparent" />

                    {/* Badge */}
                    {pkg.badge && (
                      <span className="absolute left-3 top-3 rounded-full bg-amber-500 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-900 shadow">
                        {pkg.badge}
                      </span>
                    )}

                    {/* Discount Pill */}
                    {discountPct > 0 && (
                      <span className="absolute right-3 top-3 rounded-full bg-emerald-600 px-2.5 py-0.5 text-[10px] font-bold text-white shadow">
                        {discountPct}% OFF
                      </span>
                    )}

                    {/* Bottom Title on Image */}
                    <div className="absolute bottom-3 left-3 right-3 text-white">
                      <p className="text-xs font-semibold text-indigo-200">
                        {pkg.categoryId?.name || 'Package Bundle'}
                      </p>
                      <h3 className="text-base font-extrabold leading-tight drop-shadow-sm">
                        {pkg.name}
                      </h3>
                    </div>
                  </div>

                  {/* Body Info */}
                  <div className="p-4 space-y-3">
                    {pkg.shortDescription && (
                      <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed font-medium">
                        {pkg.shortDescription}
                      </p>
                    )}

                    {/* Inclusions summary preview */}
                    {pkg.inclusions && pkg.inclusions.length > 0 && (
                      <div className="rounded-xl bg-slate-50 p-2.5 space-y-1.5 border border-slate-100">
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5 text-brand" />
                            {pkg.inclusions.length} Services Included:
                          </span>
                          {pkg.estimatedDurationMins && (
                            <span className="flex items-center gap-1 text-slate-500 font-semibold">
                              <Clock className="h-3 w-3" />
                              ~{pkg.estimatedDurationMins} min
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {pkg.inclusions.slice(0, 3).map((inc, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700 border border-slate-200/80 shadow-2xs"
                            >
                              <Check className="h-2.5 w-2.5 text-emerald-600 stroke-[3]" />
                              {inc.name} {inc.quantity > 1 ? `(x${inc.quantity})` : ''}
                            </span>
                          ))}
                          {pkg.inclusions.length > 3 && (
                            <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-bold text-slate-400 border border-slate-200/60">
                              +{pkg.inclusions.length - 3} more
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Section: Pricing and CTA */}
                <div className="border-t border-slate-100 p-4 pt-3 bg-slate-50/50 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Package Price
                    </p>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-lg font-black text-slate-900">
                        ₹{Number(pkg.price).toLocaleString('en-IN')}
                      </span>
                      {pkg.originalPrice && pkg.originalPrice > pkg.price && (
                        <span className="text-xs font-semibold text-slate-400 line-through">
                          ₹{Number(pkg.originalPrice).toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>
                    {savings > 0 && (
                      <p className="text-[10px] font-bold text-emerald-600">
                        You save ₹{savings.toLocaleString('en-IN')}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => navigate(`/app/packages/${pkg.slug || pkg._id}`)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 transition shadow-2xs"
                    >
                      Details
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBookNow(pkg)}
                      className="rounded-xl bg-brand px-3.5 py-2 text-xs font-bold text-white shadow hover:opacity-95 flex items-center gap-1 transition"
                    >
                      <span>Book</span>
                      <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
export default ServicePackagesPage
