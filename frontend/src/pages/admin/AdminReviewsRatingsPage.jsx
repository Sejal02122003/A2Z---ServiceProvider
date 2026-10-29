import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  FileText,
  Loader2,
  Star,
  User,
  Trash2,
  Search,
  Wrench,
  Phone,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Filter,
  Users,
  Sparkles,
  Calendar,
  X,
  Package,
} from 'lucide-react'
import { reviewsApi } from '../../api/reviewsApi.js'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { AppBadge } from '../../components/app-ui/data-display/AppBadge.jsx'

function getServiceProvided(review) {
  const b = review?.bookingId
  if (!b) return 'General Service'
  if (b.packageBooking?.isPackage && b.packageBooking.packageName) {
    return b.packageBooking.packageName
  }
  if (b.multiServiceBooking?.isMultiService && Array.isArray(b.multiServiceBooking.items) && b.multiServiceBooking.items.length > 0) {
    const names = b.multiServiceBooking.items.map((i) => i.serviceName).filter(Boolean)
    if (names.length > 0) return names.join(', ')
  }
  if (b.serviceId?.name) {
    return b.serviceId.name + (b.subServiceName ? ` (${b.subServiceName})` : '')
  }
  if (b.subcategoryId?.name) {
    return b.subcategoryId.name
  }
  return b.type === 'INSTANT' ? 'Instant Service' : 'Scheduled Service'
}

function getCustomerDetails(review) {
  const bUser = review?.bookingId?.userId
  const reviewer = review?.reviewerId
  const reviewee = review?.revieweeId

  // If reviewee is labour, reviewer is customer
  if (reviewee?.role === 'labour' || reviewee?.labourProfile) {
    return {
      name: reviewer?.fullName || reviewer?.name || bUser?.fullName || bUser?.name || 'Customer',
      phone: reviewer?.phone || bUser?.phone || '',
      email: reviewer?.email || bUser?.email || '',
    }
  }

  return {
    name: bUser?.fullName || bUser?.name || reviewer?.fullName || reviewer?.name || 'Customer',
    phone: bUser?.phone || reviewer?.phone || '',
    email: bUser?.email || reviewer?.email || '',
  }
}

function getProviderDetails(review) {
  const bLabor = review?.bookingId?.laborId
  const reviewee = review?.revieweeId
  const reviewer = review?.reviewerId

  if (reviewee?.role === 'labour' || reviewee?.labourProfile) {
    return {
      id: String(reviewee._id || ''),
      name: reviewee.fullName || reviewee.name || bLabor?.fullName || bLabor?.name || 'Service Provider',
      phone: reviewee.phone || bLabor?.phone || '',
      email: reviewee.email || bLabor?.email || '',
    }
  }

  if (reviewer?.role === 'labour' || reviewer?.labourProfile) {
    return {
      id: String(reviewer._id || ''),
      name: reviewer.fullName || reviewer.name || bLabor?.fullName || bLabor?.name || 'Service Provider',
      phone: reviewer.phone || bLabor?.phone || '',
      email: reviewer.email || bLabor?.email || '',
    }
  }

  return {
    id: String(reviewee?._id || bLabor?._id || ''),
    name: reviewee?.fullName || reviewee?.name || bLabor?.fullName || bLabor?.name || 'Service Provider',
    phone: reviewee?.phone || bLabor?.phone || '',
    email: reviewee?.email || bLabor?.email || '',
  }
}

export function AdminReviewsRatingsPage() {
  const [reviews, setReviews] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)

  // Filters & Search State
  const [searchQuery, setSearchQuery] = useState('')
  const [ratingFilter, setRatingFilter] = useState('ALL')
  const [viewMode, setViewMode] = useState('grouped') // 'grouped' (by provider) or 'feed' (all reviews)
  const [collapsedProviders, setCollapsedProviders] = useState({})

  useEffect(() => {
    let cancelled = false
    const fetchReviews = async () => {
      try {
        const res = await reviewsApi.getAllReviews()
        if (!cancelled) {
          setReviews(res.data?.reviews || [])
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load reviews')
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    fetchReviews()
    return () => {
      cancelled = true
    }
  }, [])

  const handleDeleteReview = async () => {
    if (!deleteConfirmId) return
    const id = deleteConfirmId
    setDeletingId(id)
    setDeleteConfirmId(null)
    try {
      await reviewsApi.deleteReview(id)
      setReviews((prev) => prev.filter((r) => r._id !== id))
    } catch (err) {
      alert(err.message || 'Failed to delete review')
    } finally {
      setDeletingId(null)
    }
  }

  // Summary Metrics
  const stats = useMemo(() => {
    const total = reviews.length
    if (total === 0) {
      return { total: 0, avgRating: 0, fiveStarCount: 0, providerCount: 0 }
    }
    const sum = reviews.reduce((acc, r) => acc + (Number(r.rating) || 0), 0)
    const fiveStars = reviews.filter((r) => Number(r.rating) === 5).length
    const uniqueProviders = new Set(
      reviews.map((r) => getProviderDetails(r).id || getProviderDetails(r).phone).filter(Boolean)
    )
    return {
      total,
      avgRating: (sum / total).toFixed(1),
      fiveStarCount: fiveStars,
      providerCount: uniqueProviders.size,
    }
  }, [reviews])

  // Grouped by Service Provider
  const providersGrouped = useMemo(() => {
    const map = new Map()

    for (const review of reviews) {
      const provider = getProviderDetails(review)
      const key = provider.id || provider.phone || provider.name

      if (!map.has(key)) {
        map.set(key, {
          key,
          provider,
          reviews: [],
          totalRating: 0,
          servicesProvided: new Set(),
        })
      }

      const group = map.get(key)
      group.reviews.push(review)
      group.totalRating += Number(review.rating) || 0
      const svc = getServiceProvided(review)
      if (svc) group.servicesProvided.add(svc)
    }

    const list = []
    for (const [, val] of map.entries()) {
      const count = val.reviews.length
      const avgRating = count > 0 ? (val.totalRating / count).toFixed(1) : 0
      list.push({
        key: val.key,
        provider: val.provider,
        reviews: val.reviews,
        avgRating: Number(avgRating),
        reviewCount: count,
        servicesList: Array.from(val.servicesProvided),
      })
    }

    return list.sort((a, b) => b.reviewCount - a.reviewCount || b.avgRating - a.avgRating)
  }, [reviews])

  // Filtered Groups
  const filteredGroups = useMemo(() => {
    let list = providersGrouped

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter((g) => {
        const matchProvider =
          g.provider.name.toLowerCase().includes(q) || g.provider.phone.toLowerCase().includes(q)
        const matchService = g.servicesList.some((s) => s.toLowerCase().includes(q))
        const matchCustomer = g.reviews.some((r) => {
          const cust = getCustomerDetails(r)
          return cust.name.toLowerCase().includes(q) || cust.phone.toLowerCase().includes(q)
        })
        return matchProvider || matchService || matchCustomer
      })
    }

    if (ratingFilter !== 'ALL') {
      const targetRating = Number(ratingFilter)
      list = list.filter((g) => Math.round(g.avgRating) === targetRating)
    }

    return list
  }, [providersGrouped, searchQuery, ratingFilter])

  // Filtered Flat Reviews (for feed mode)
  const filteredFlatReviews = useMemo(() => {
    let list = reviews

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim()
      list = list.filter((r) => {
        const prov = getProviderDetails(r)
        const cust = getCustomerDetails(r)
        const svc = getServiceProvided(r)
        return (
          prov.name.toLowerCase().includes(q) ||
          prov.phone.toLowerCase().includes(q) ||
          cust.name.toLowerCase().includes(q) ||
          cust.phone.toLowerCase().includes(q) ||
          svc.toLowerCase().includes(q) ||
          (r.comment && r.comment.toLowerCase().includes(q))
        )
      })
    }

    if (ratingFilter !== 'ALL') {
      const targetRating = Number(ratingFilter)
      list = list.filter((r) => Math.round(Number(r.rating) || 0) === targetRating)
    }

    return list
  }, [reviews, searchQuery, ratingFilter])

  const toggleCollapse = (key) => {
    setCollapsedProviders((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }

  if (loading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    )
  }

  if (error) {
    return (
      <GlassPanel className="p-6 text-center">
        <AlertCircle className="mx-auto h-12 w-12 text-rose-500" />
        <p className="mt-4 text-lg font-bold text-slate-900">Error Loading Reviews</p>
        <p className="mt-2 text-sm text-slate-500">{error}</p>
      </GlassPanel>
    )
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header & Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassPanel className="p-5 border-slate-200/80">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600">
              <Star className="h-6 w-6 fill-amber-500" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Average Rating</p>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-2xl font-black text-slate-900">{stats.avgRating}</span>
                <span className="text-xs font-bold text-slate-400">/ 5.0</span>
              </div>
            </div>
          </div>
        </GlassPanel>

        <GlassPanel className="p-5 border-slate-200/80">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-600">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Total Reviews</p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">{stats.total}</p>
            </div>
          </div>
        </GlassPanel>

        <GlassPanel className="p-5 border-slate-200/80">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Providers Reviewed</p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">{stats.providerCount}</p>
            </div>
          </div>
        </GlassPanel>

        <GlassPanel className="p-5 border-slate-200/80">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-purple-500/10 text-purple-600">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">5-Star Feedback</p>
              <p className="text-2xl font-black text-slate-900 mt-0.5">{stats.fiveStarCount}</p>
            </div>
          </div>
        </GlassPanel>
      </div>

      {/* Search & Filter Toolbar */}
      <GlassPanel className="p-4 space-y-3 border-slate-200/80">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Search by Service Provider */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Service Provider (name, phone), Customer, or Service..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-9 text-sm font-semibold text-slate-800 outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/10"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-1 rounded-xl bg-slate-100 p-1 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('grouped')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewMode === 'grouped'
                  ? 'bg-white text-brand shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              By Service Provider
            </button>
            <button
              type="button"
              onClick={() => setViewMode('feed')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                viewMode === 'feed'
                  ? 'bg-white text-brand shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              All Reviews Feed
            </button>
          </div>
        </div>

        {/* Rating Filter Chips */}
        <div className="flex items-center gap-2 overflow-x-auto pt-1 pb-0.5 text-xs">
          <span className="font-bold text-slate-400 shrink-0 flex items-center gap-1">
            <Filter className="h-3 w-3" /> Rating:
          </span>
          {['ALL', '5', '4', '3', '2', '1'].map((r) => {
            const active = ratingFilter === r
            return (
              <button
                key={r}
                type="button"
                onClick={() => setRatingFilter(r)}
                className={`rounded-lg px-2.5 py-1 font-bold transition whitespace-nowrap border ${
                  active
                    ? 'border-brand bg-brand/10 text-brand'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                {r === 'ALL' ? 'All Ratings' : `${r} Star${r !== '1' ? 's' : ''}`}
              </button>
            )
          })}

          <div className="ml-auto text-[11px] font-semibold text-slate-500 whitespace-nowrap">
            {viewMode === 'grouped'
              ? `${filteredGroups.length} Service Provider${filteredGroups.length === 1 ? '' : 's'}`
              : `${filteredFlatReviews.length} Review${filteredFlatReviews.length === 1 ? '' : 's'}`}
          </div>
        </div>
      </GlassPanel>

      {/* VIEW 1: GROUPED BY SERVICE PROVIDER */}
      {viewMode === 'grouped' ? (
        filteredGroups.length === 0 ? (
          <GlassPanel className="p-12 text-center border-slate-200/80">
            <Users className="mx-auto h-12 w-12 text-slate-300" />
            <p className="mt-4 text-lg font-bold text-slate-900">No Service Providers Found</p>
            <p className="mt-1 text-xs text-slate-500">
              {searchQuery ? `No service providers match "${searchQuery}"` : 'No reviews recorded yet.'}
            </p>
          </GlassPanel>
        ) : (
          <div className="space-y-4">
            {filteredGroups.map((group) => {
              const isCollapsed = Boolean(collapsedProviders[group.key])
              const initials = (group.provider.name || 'SP')
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')
                .toUpperCase()

              return (
                <GlassPanel
                  key={group.key}
                  className="overflow-hidden p-0 border border-slate-200/80 shadow-xs hover:border-slate-300 transition-all"
                >
                  {/* Service Provider Header Card */}
                  <div
                    onClick={() => toggleCollapse(group.key)}
                    className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 bg-gradient-to-r from-slate-50 to-white border-b border-slate-100 cursor-pointer select-none"
                  >
                    <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-brand to-brand-bright text-white font-black text-sm shadow-md shadow-brand/20">
                        {initials}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-base font-extrabold text-slate-900 truncate">
                            {group.provider.name}
                          </h3>
                          <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-700 border border-emerald-200 flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Service Partner
                          </span>
                        </div>

                        <div className="mt-1 flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                          {group.provider.phone && (
                            <span className="flex items-center gap-1 font-semibold text-slate-700">
                              <Phone className="h-3 w-3 text-slate-400" />
                              {group.provider.phone}
                            </span>
                          )}
                          <span>•</span>
                          <span className="font-semibold text-slate-600">
                            {group.reviewCount} Review{group.reviewCount === 1 ? '' : 's'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0">
                      {/* Services Provided Badges */}
                      <div className="hidden md:flex flex-wrap gap-1 max-w-sm justify-end">
                        {group.servicesList.slice(0, 3).map((svc, i) => (
                          <span
                            key={i}
                            className="inline-flex items-center gap-1 rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-700"
                          >
                            <Wrench className="h-3 w-3 text-brand" />
                            <span className="truncate max-w-[120px]">{svc}</span>
                          </span>
                        ))}
                        {group.servicesList.length > 3 && (
                          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                            +{group.servicesList.length - 3} more
                          </span>
                        )}
                      </div>

                      {/* Rating Score */}
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 rounded-xl bg-amber-50 border border-amber-200 px-3 py-1.5">
                          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                          <span className="text-sm font-black text-amber-900">{group.avgRating}</span>
                          <span className="text-[10px] font-bold text-amber-700">/ 5</span>
                        </div>
                        <button
                          type="button"
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                          aria-label={isCollapsed ? 'Expand reviews' : 'Collapse reviews'}
                        >
                          {isCollapsed ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Reviews List for this Provider */}
                  {!isCollapsed && (
                    <div className="divide-y divide-slate-100">
                      {group.reviews.map((review) => {
                        const customer = getCustomerDetails(review)
                        const serviceName = getServiceProvided(review)
                        const bookingRef = review.bookingId?._id
                          ? `#${review.bookingId._id.substring(review.bookingId._id.length - 6).toUpperCase()}`
                          : null

                        return (
                          <div
                            key={review._id}
                            className="p-5 transition hover:bg-slate-50/50 flex flex-col md:flex-row md:items-start justify-between gap-4"
                          >
                            <div className="flex-1 space-y-3">
                              {/* Rating & Service Provided Tag */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <div className="flex items-center gap-0.5">
                                  {[1, 2, 3, 4, 5].map((star) => (
                                    <Star
                                      key={star}
                                      className={`h-3.5 w-3.5 ${
                                        star <= review.rating
                                          ? 'fill-amber-400 text-amber-400'
                                          : 'fill-slate-100 text-slate-200'
                                      }`}
                                    />
                                  ))}
                                </div>
                                <AppBadge
                                  variant={
                                    review.rating >= 4 ? 'success' : review.rating <= 2 ? 'danger' : 'warning'
                                  }
                                >
                                  {review.rating} / 5
                                </AppBadge>

                                {/* Service Provided Highlight */}
                                <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-bold text-blue-800">
                                  <Wrench className="h-3 w-3 text-blue-600" />
                                  <span>Service: {serviceName}</span>
                                </span>

                                <span className="text-xs font-semibold text-slate-400">
                                  {new Date(review.createdAt).toLocaleDateString('en-IN', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  })}
                                </span>
                              </div>

                              {/* Customer Feedback Comment */}
                              {review.comment ? (
                                <p className="text-sm text-slate-800 font-medium bg-white border border-slate-200/80 p-3 rounded-xl shadow-2xs">
                                  &ldquo;{review.comment}&rdquo;
                                </p>
                              ) : (
                                <p className="text-xs italic text-slate-400">No written comment provided</p>
                              )}

                              {/* Customer (User to whom service was provided) */}
                              <div className="flex items-center gap-2 pt-1">
                                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                                  <User className="h-3.5 w-3.5" />
                                </div>
                                <div>
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    Service Provided To Customer:
                                  </p>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-900">{customer.name}</span>
                                    {customer.phone && (
                                      <span className="text-xs font-semibold text-slate-500">
                                        ({customer.phone})
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Booking Info & Delete Button */}
                            <div className="flex md:flex-col items-center md:items-end justify-between gap-2 shrink-0 md:min-w-[130px]">
                              {bookingRef && (
                                <div className="rounded-xl bg-slate-50 p-2 text-right border border-slate-100 w-full">
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                    Booking Ref
                                  </p>
                                  <p className="text-xs font-extrabold text-slate-900 mt-0.5">{bookingRef}</p>
                                  {review.bookingId?.type && (
                                    <span className="text-[10px] font-bold text-slate-500 block mt-0.5">
                                      {review.bookingId.type}
                                    </span>
                                  )}
                                </div>
                              )}
                              <button
                                type="button"
                                onClick={() => setDeleteConfirmId(review._id)}
                                disabled={deletingId === review._id}
                                className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-bold text-rose-600 transition hover:bg-rose-100 disabled:opacity-50"
                                title="Delete this review"
                              >
                                {deletingId === review._id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <>
                                    <Trash2 className="h-3.5 w-3.5" />
                                    <span>Delete</span>
                                  </>
                                )}
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </GlassPanel>
              )
            })}
          </div>
        )
      ) : (
        /* VIEW 2: ALL REVIEWS FLAT FEED */
        <GlassPanel className="overflow-hidden p-0 border-slate-200/80">
          <div className="border-b border-slate-200 bg-slate-50/70 px-5 py-3.5 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-900">All Individual Reviews</h2>
            <span className="text-xs font-semibold text-slate-500">
              Showing {filteredFlatReviews.length} reviews
            </span>
          </div>

          {filteredFlatReviews.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="mx-auto h-12 w-12 text-slate-300" />
              <p className="mt-4 text-lg font-bold text-slate-900">No Reviews Match Filters</p>
              <p className="mt-1 text-xs text-slate-500">Try adjusting your search query or rating filter.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {filteredFlatReviews.map((review) => {
                const provider = getProviderDetails(review)
                const customer = getCustomerDetails(review)
                const serviceName = getServiceProvided(review)
                const bookingRef = review.bookingId?._id
                  ? `#${review.bookingId._id.substring(review.bookingId._id.length - 6).toUpperCase()}`
                  : null

                return (
                  <div key={review._id} className="p-5 transition hover:bg-slate-50/50">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="flex items-center gap-0.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`h-4 w-4 ${
                                  star <= review.rating
                                    ? 'fill-amber-400 text-amber-400'
                                    : 'fill-slate-100 text-slate-200'
                                }`}
                              />
                            ))}
                          </div>
                          <AppBadge
                            variant={
                              review.rating >= 4 ? 'success' : review.rating <= 2 ? 'danger' : 'warning'
                            }
                          >
                            {review.rating} / 5
                          </AppBadge>

                          {/* Service Provided */}
                          <span className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-bold text-blue-800">
                            <Wrench className="h-3 w-3 text-blue-600" />
                            <span>{serviceName}</span>
                          </span>

                          <span className="text-xs font-semibold text-slate-400">
                            {new Date(review.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        {review.comment ? (
                          <p className="text-sm text-slate-700 font-medium bg-white border border-slate-100 p-3 rounded-xl shadow-xs">
                            &ldquo;{review.comment}&rdquo;
                          </p>
                        ) : (
                          <p className="text-xs italic text-slate-400">No comment provided</p>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                          {/* Customer */}
                          <div className="flex items-start gap-2">
                            <User className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                Customer (Provided To)
                              </p>
                              <p className="text-sm font-semibold text-slate-900 truncate">
                                {customer.name}
                              </p>
                              <p className="text-xs text-slate-500 truncate">{customer.phone}</p>
                            </div>
                          </div>

                          {/* Service Provider */}
                          <div className="flex items-start gap-2">
                            <User className="h-4 w-4 text-brand mt-0.5 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-brand/60">
                                Service Provider (Reviewed)
                              </p>
                              <p className="text-sm font-semibold text-slate-900 truncate">
                                {provider.name}
                              </p>
                              <p className="text-xs text-slate-500 truncate">{provider.phone}</p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-3 shrink-0 sm:min-w-[140px]">
                        {bookingRef && (
                          <div className="w-full rounded-xl bg-slate-50 p-2.5 text-right border border-slate-100">
                            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Booking Ref</p>
                            <p className="text-xs font-bold text-slate-900 mt-0.5">{bookingRef}</p>
                            {review.bookingId?.type && (
                              <AppBadge variant="neutral" className="mt-1.5 text-[10px]">
                                {review.bookingId.type}
                              </AppBadge>
                            )}
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(review._id)}
                          disabled={deletingId === review._id}
                          className="flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-bold text-rose-600 transition hover:bg-rose-100 disabled:opacity-50"
                        >
                          {deletingId === review._id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </GlassPanel>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-rose-100">
              <AlertCircle className="h-6 w-6 text-rose-600" />
            </div>
            <h3 className="mb-2 text-lg font-bold text-slate-900">Delete Review</h3>
            <p className="mb-6 text-sm text-slate-500">
              Are you sure you want to delete this review? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 rounded-xl bg-slate-100 py-3 text-sm font-bold text-slate-700 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteReview}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-rose-600 py-3 text-sm font-bold text-white hover:bg-rose-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
