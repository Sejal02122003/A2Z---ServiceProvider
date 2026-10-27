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
  Zap,
  Calendar,
  X,
} from 'lucide-react'
import { fetchPublicPackages } from '../../api/packagesApi.js'
import { readAppUserLocation } from '../../lib/appUserLocationStorage.js'
import { AppStackScreenHeader } from '../../components/app/AppStackScreenHeader.jsx'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { readBookingDraft, writeBookingDraft } from '../../lib/individualBookingDraft.js'
import { todayISODate } from '../../lib/individualBookings.js'

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

  const [bookingModalPkg, setBookingModalPkg] = useState(null)
  const [bookingMode, setBookingMode] = useState('scheduled')

  const proceedToBook = (pkg, mode = 'scheduled') => {
    if (!pkg) return
    const currentDraft = readBookingDraft() || {}
    const userLoc = readAppUserLocation() || {}
    const today = todayISODate()

    const nextHour = new Date()
    nextHour.setHours(nextHour.getHours() + 2, 0, 0, 0)
    const timeStr = `${String(nextHour.getHours()).padStart(2, '0')}:00`

    const newDraft = {
      ...currentDraft,
      entryPoint: 'package',
      isPackage: true,
      packageId: pkg._id,
      packageName: pkg.name,
      packageDescription: pkg.description || pkg.shortDescription || '',
      packagePrice: pkg.price,
      packageOriginalPrice: pkg.originalPrice,
      packageInclusions: pkg.inclusions || [],
      packageDuration: pkg.estimatedDurationMins || 60,
      packageBadge: pkg.badge,
      packageImage: pkg.imageUrl,
      categoryId: pkg.categoryId?._id || pkg.categoryId,
      categoryName: pkg.categoryId?.name || 'Service Package',
      subcategoryId: pkg.subcategoryId?._id || pkg.subcategoryId,
      serviceId: pkg.inclusions?.[0]?.serviceId?._id || pkg.inclusions?.[0]?.serviceId,
      serviceName: pkg.name,
      bookingType: mode,
      durationKind: 'few_hours',
      hours: pkg.estimatedDurationMins ? parseFloat((pkg.estimatedDurationMins / 60).toFixed(1)) : 1,
      address: currentDraft.address || userLoc.address || userLoc.city || '',
      lat: currentDraft.lat || userLoc.lat || 28.6139,
      lng: currentDraft.lng || userLoc.lng || 77.2090,
      serviceDate: currentDraft.serviceDate || today,
      timeSlot: currentDraft.timeSlot || (mode === 'scheduled' ? timeStr : ''),
    }

    writeBookingDraft(newDraft)
    setBookingModalPkg(null)
    navigate(`/app/booking/flow?step=details&packageId=${pkg._id}`)
  }

  const handleBookNow = (pkg) => {
    setBookingMode('scheduled')
    setBookingModalPkg(pkg)
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

      {/* Booking Mode Bottom Sheet / Modal */}
      {bookingModalPkg && (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-t-3xl sm:rounded-3xl bg-white shadow-2xl flex flex-col max-h-[88vh] sm:max-h-[85vh] overflow-hidden">
            {/* 1. Header (Fixed Top) */}
            <div className="shrink-0 flex items-center justify-between border-b border-slate-100 p-4 pb-3 bg-white">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 text-brand">
                  <Package className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 leading-tight">Book Service Package</h3>
                  <p className="text-xs text-slate-500 truncate max-w-[240px]">{bookingModalPkg.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBookingModalPkg(null)}
                className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* 2. Scrollable Body Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 overscroll-contain">
              {/* Package snapshot banner */}
              <div className="rounded-2xl border border-brand/20 bg-gradient-to-br from-brand/5 via-white to-indigo-50/40 p-3.5 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-brand">
                      {bookingModalPkg.badge || 'Package Deal'}
                    </span>
                    <h4 className="mt-1 text-sm font-extrabold text-slate-900 leading-snug">{bookingModalPkg.name}</h4>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-black text-slate-900">₹{Number(bookingModalPkg.price).toLocaleString('en-IN')}</p>
                    {bookingModalPkg.originalPrice && bookingModalPkg.originalPrice > bookingModalPkg.price && (
                      <p className="text-[10px] font-bold text-emerald-600">Save ₹{(bookingModalPkg.originalPrice - bookingModalPkg.price).toLocaleString('en-IN')}</p>
                    )}
                  </div>
                </div>

                {/* Package Details & Description */}
                {(bookingModalPkg.description || bookingModalPkg.shortDescription) && (
                  <div className="rounded-xl bg-white/80 p-2.5 text-xs text-slate-700 border border-slate-200/70 shadow-2xs space-y-0.5">
                    <span className="font-extrabold text-slate-900 block text-[10px] uppercase tracking-wider text-slate-500">
                      Description & Details:
                    </span>
                    <p className="leading-relaxed text-slate-600 font-medium">
                      {bookingModalPkg.description || bookingModalPkg.shortDescription}
                    </p>
                  </div>
                )}

                {bookingModalPkg.inclusions && bookingModalPkg.inclusions.length > 0 && (
                  <div className="space-y-1.5 pt-1.5 border-t border-slate-100">
                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-600">
                      <span>Includes {bookingModalPkg.inclusions.length} Services:</span>
                      {bookingModalPkg.estimatedDurationMins && (
                        <span className="flex items-center gap-1 text-slate-500 font-semibold text-[10px]">
                          <Clock className="h-3 w-3" />
                          ~{bookingModalPkg.estimatedDurationMins} min
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {bookingModalPkg.inclusions.map((inc, i) => (
                        <span key={i} className="inline-flex items-center gap-1 rounded-md bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700 border border-slate-200 shadow-2xs">
                          <Check className="h-2.5 w-2.5 text-emerald-600 stroke-[3]" />
                          {inc.name} {inc.quantity > 1 ? `(x${inc.quantity})` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Choose Booking Mode */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-wide">
                    Choose Booking Method
                  </p>
                  <span className="text-[10px] font-semibold text-slate-400">
                    Select to proceed to next step
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2.5">
                  {/* Scheduled Option */}
                  <div
                    onClick={() => proceedToBook(bookingModalPkg, 'scheduled')}
                    className="relative rounded-2xl border-2 border-slate-200 bg-white p-3.5 transition-all cursor-pointer shadow-xs hover:shadow-md hover:border-brand hover:bg-brand/5 active:scale-[0.99] group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand group-hover:bg-brand group-hover:text-white transition shadow-xs">
                          <Calendar className="h-5 w-5" />
                        </span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-extrabold text-sm text-slate-900 group-hover:text-brand transition">Scheduled Booking</p>
                            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[9px] font-bold text-brand">
                              Pick Slot
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Pick date & time slot of your choice
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          proceedToBook(bookingModalPkg, 'scheduled')
                        }}
                        className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-brand px-3 py-2 text-xs font-bold text-white shadow-xs hover:opacity-95 transition"
                      >
                        <span>Schedule</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Instant Option */}
                  <div
                    onClick={() => proceedToBook(bookingModalPkg, 'instant')}
                    className="relative rounded-2xl border-2 border-slate-200 bg-white p-3.5 transition-all cursor-pointer shadow-xs hover:shadow-md hover:border-amber-400 hover:bg-amber-50/50 active:scale-[0.99] group"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-slate-950 font-black shadow-xs group-hover:bg-amber-400 transition">
                          <Zap className="h-5 w-5" />
                        </span>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="font-extrabold text-sm text-slate-900 group-hover:text-amber-700 transition">Instant (ASAP)</p>
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-900">
                              Fastest
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Immediate dispatch • Partner arrives earliest
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          proceedToBook(bookingModalPkg, 'instant')
                        }}
                        className="shrink-0 inline-flex items-center gap-1 rounded-xl bg-amber-500 px-3 py-2 text-xs font-extrabold text-slate-950 shadow-xs hover:bg-amber-400 transition"
                      >
                        <span>Book Instant</span>
                        <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 3. Sticky Bottom Action Bar (ALWAYS 100% VISIBLE) */}
            <div className="shrink-0 border-t border-slate-100 bg-white p-4 pt-3 flex items-center gap-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]">
              <button
                type="button"
                onClick={() => setBookingModalPkg(null)}
                className="rounded-xl border border-slate-200 px-4 py-3 text-xs font-bold text-slate-600 hover:bg-slate-50 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => proceedToBook(bookingModalPkg, bookingMode)}
                className="flex-1 rounded-xl bg-brand py-3.5 px-4 text-xs sm:text-sm font-black text-white shadow hover:opacity-95 active:scale-[0.99] transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Continue to Booking Details</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default ServicePackagesPage
