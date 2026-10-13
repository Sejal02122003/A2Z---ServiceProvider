import { useCallback, useEffect, useState, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import {
  Package,
  Clock,
  CheckCircle2,
  XCircle,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  AlertCircle,
  Loader2,
  ChevronLeft,
  Calendar,
  Share2,
  MapPin,
  Check,
  Info,
} from 'lucide-react'
import { fetchPublicPackageDetails } from '../../api/packagesApi.js'
import { AppStackScreenHeader } from '../../components/app/AppStackScreenHeader.jsx'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { writeBookingDraft, readBookingDraft } from '../../lib/individualBookingDraft.js'

export function PackageDetailsPage() {
  const { idOrSlug } = useParams()
  const navigate = useNavigate()
  const reduce = useReducedMotion()

  const [pkg, setPkg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeImageIndex, setActiveImageIndex] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError('')
    fetchPublicPackageDetails(idOrSlug)
      .then((res) => {
        if (cancelled) return
        setPkg(res.data?.package || null)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('Failed to load package details:', err)
        setError(err.message || 'Service package not found or no longer active.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [idOrSlug])

  const savings = useMemo(() => {
    if (!pkg) return 0
    return pkg.originalPrice && pkg.originalPrice > pkg.price
      ? pkg.originalPrice - pkg.price
      : 0
  }, [pkg])

  const discountPct = useMemo(() => {
    if (!pkg) return 0
    if (pkg.discountPercentage) return pkg.discountPercentage
    if (pkg.originalPrice && pkg.originalPrice > pkg.price) {
      return Math.round(((pkg.originalPrice - pkg.price) / pkg.originalPrice) * 100)
    }
    return 0
  }, [pkg])

  const allImages = useMemo(() => {
    if (!pkg) return []
    const list = []
    if (pkg.imageUrl) list.push(pkg.imageUrl)
    if (Array.isArray(pkg.images)) {
      pkg.images.forEach((img) => {
        if (img && !list.includes(img)) list.push(img)
      })
    }
    if (list.length === 0) {
      list.push('https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80')
    }
    return list
  }, [pkg])

  const handleBookNow = useCallback(() => {
    if (!pkg) return
    const currentDraft = readBookingDraft() || {}
    writeBookingDraft({
      ...currentDraft,
      packageId: pkg._id,
      packageName: pkg.name,
      packagePrice: pkg.price,
      categoryId: pkg.categoryId?._id || pkg.categoryId,
      subcategoryId: pkg.subcategoryId?._id || pkg.subcategoryId,
      serviceId: pkg.inclusions?.[0]?.serviceId?._id || pkg.inclusions?.[0]?.serviceId,
      bookingType: 'scheduled',
    })
    navigate(`/app/booking/flow?step=details&packageId=${pkg._id}`)
  }, [pkg, navigate])

  if (loading) {
    return (
      <div className="space-y-4 pb-12">
        <AppStackScreenHeader title="Package Details" backTo="/app/packages" />
        <div className="flex flex-col items-center justify-center py-24 space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
          <p className="text-xs font-semibold text-slate-500">Loading package details...</p>
        </div>
      </div>
    )
  }

  if (error || !pkg) {
    return (
      <div className="space-y-4 pb-12">
        <AppStackScreenHeader title="Package Details" backTo="/app/packages" />
        <GlassPanel className="p-8 text-center space-y-3">
          <AlertCircle className="mx-auto h-10 w-10 text-rose-500" />
          <h3 className="text-base font-extrabold text-slate-800">
            {error || 'Package Not Found'}
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            This package might have expired, been deactivated, or is unavailable in your area.
          </p>
          <button
            type="button"
            onClick={() => navigate('/app/packages')}
            className="rounded-xl bg-brand px-4 py-2 text-xs font-bold text-white shadow hover:opacity-95"
          >
            Explore Other Packages
          </button>
        </GlassPanel>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-28">
      <AppStackScreenHeader title={pkg.name} backTo="/app/packages" />

      {/* Main Image Gallery */}
      <div className="relative overflow-hidden rounded-2xl bg-slate-900 shadow-md">
        <div className="relative aspect-[16/10] w-full">
          <img
            src={allImages[activeImageIndex] || allImages[0]}
            alt={pkg.name}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />

          {/* Badges on Hero */}
          <div className="absolute left-3 top-3 flex items-center gap-2">
            {pkg.badge && (
              <span className="rounded-full bg-amber-500 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-slate-900 shadow-md">
                {pkg.badge}
              </span>
            )}
            {discountPct > 0 && (
              <span className="rounded-full bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white shadow-md">
                {discountPct}% SAVINGS
              </span>
            )}
          </div>

          {/* Title on Image bottom */}
          <div className="absolute bottom-3 left-4 right-4 text-white">
            <span className="inline-block rounded-md bg-white/20 px-2 py-0.5 text-[11px] font-bold backdrop-blur-md text-indigo-100">
              {pkg.categoryId?.name || 'Bundle Service'}
            </span>
            <h1 className="mt-1 text-xl font-black leading-tight drop-shadow-md">
              {pkg.name}
            </h1>
          </div>
        </div>

        {/* Multi-image thumbnail strip if > 1 image */}
        {allImages.length > 1 && (
          <div className="flex gap-2 p-2.5 bg-slate-950/60 overflow-x-auto scrollbar-none">
            {allImages.map((img, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveImageIndex(idx)}
                className={`relative h-12 w-16 shrink-0 overflow-hidden rounded-lg border-2 transition-all ${
                  activeImageIndex === idx ? 'border-brand scale-105' : 'border-transparent opacity-60'
                }`}
              >
                <img src={img} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Pricing and Key Highlights Card */}
      <GlassPanel className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Guaranteed Bundle Price
            </p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-black text-slate-900">
                ₹{Number(pkg.price).toLocaleString('en-IN')}
              </span>
              {pkg.originalPrice && pkg.originalPrice > pkg.price && (
                <span className="text-sm font-semibold text-slate-400 line-through">
                  ₹{Number(pkg.originalPrice).toLocaleString('en-IN')}
                </span>
              )}
            </div>
          </div>

          {savings > 0 && (
            <div className="rounded-xl bg-emerald-50 px-3 py-1.5 border border-emerald-200 text-right">
              <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wide">
                Total Savings
              </p>
              <p className="text-sm font-black text-emerald-700">
                ₹{savings.toLocaleString('en-IN')}
              </p>
            </div>
          )}
        </div>

        {/* Feature Badges */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs text-slate-700">
          {pkg.estimatedDurationMins && (
            <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-2.5">
              <Clock className="h-4 w-4 text-brand shrink-0" />
              <div>
                <p className="text-[10px] font-bold text-slate-400">Est. Duration</p>
                <p className="font-bold text-slate-800">~{pkg.estimatedDurationMins} Mins</p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-2.5">
            <ShieldCheck className="h-4 w-4 text-brand shrink-0" />
            <div>
              <p className="text-[10px] font-bold text-slate-400">Service Assurance</p>
              <p className="font-bold text-slate-800">Verified Pros</p>
            </div>
          </div>
        </div>

        {pkg.description && (
          <div className="pt-2 border-t border-slate-100">
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              {pkg.description}
            </p>
          </div>
        )}
      </GlassPanel>

      {/* Included Services Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-brand" />
            Included in this Package ({pkg.inclusions?.length || 0})
          </h2>
        </div>

        <div className="space-y-2.5">
          {pkg.inclusions?.map((inc, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs flex items-start justify-between gap-3"
            >
              <div className="flex items-start gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 font-bold text-xs border border-emerald-100">
                  <Check className="h-3.5 w-3.5 stroke-[3]" />
                </span>
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900 leading-tight">
                    {inc.name}
                  </h4>
                  {inc.description && (
                    <p className="text-xs text-slate-500 mt-1 leading-snug font-medium">
                      {inc.description}
                    </p>
                  )}
                </div>
              </div>
              <span className="shrink-0 rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-700">
                Qty: {inc.quantity || 1}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Exclusions Section */}
      {pkg.exclusions && pkg.exclusions.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5 px-1">
            <XCircle className="h-4 w-4 text-rose-500" />
            What is Not Included
          </h2>
          <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-3.5 space-y-2">
            {pkg.exclusions.map((exc, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs text-rose-800 font-semibold">
                <span className="text-rose-400 font-bold">•</span>
                <span>{exc}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Terms and Conditions */}
      {pkg.termsAndConditions && pkg.termsAndConditions.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5 px-1">
            <Info className="h-4 w-4 text-slate-500" />
            Terms & Validity
          </h2>
          <div className="rounded-2xl border border-slate-200 bg-white p-3.5 space-y-2">
            {pkg.termsAndConditions.map((term, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs text-slate-600 font-medium">
                <span className="text-slate-400 font-bold">•</span>
                <span>{term}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Location / Availability Note */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 flex items-center gap-3">
        <MapPin className="h-4 w-4 text-brand shrink-0" />
        <p className="text-xs text-slate-600 font-medium">
          {pkg.isAllZones
            ? 'Available across all supported service cities & zones.'
            : 'Available in select service areas. Address checked at booking.'}
        </p>
      </div>

      {/* Fixed Sticky Bottom Checkout Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200/80 bg-white/95 p-3.5 backdrop-blur-md shadow-lg max-w-lg mx-auto">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Total Package Price
            </p>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-black text-slate-900">
                ₹{Number(pkg.price).toLocaleString('en-IN')}
              </span>
              {savings > 0 && (
                <span className="text-xs font-bold text-emerald-600">
                  (Save ₹{savings.toLocaleString('en-IN')})
                </span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleBookNow}
            className="flex-1 rounded-xl bg-brand py-3 px-5 text-sm font-black text-white shadow-md hover:opacity-95 active:scale-[0.99] transition flex items-center justify-center gap-2"
          >
            <span>Book This Package</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
export default PackageDetailsPage
