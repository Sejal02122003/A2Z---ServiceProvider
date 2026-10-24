import { useState, useCallback, useEffect } from 'react'
import { useLocation, useNavigate, useParams, Navigate } from 'react-router-dom'
import { ArrowLeft, Wrench, ChevronDown, ChevronUp, Loader2, Sparkles, Tag, Flame, Clock, CheckCircle2, XCircle, Check, X, ShoppingBag, Plus, Minus } from 'lucide-react'
import { getCategoryImageUrl } from '../../lib/labourCategoryDisplay.js'
import { BookingTypeSheet } from '../../components/app/booking/BookingTypeSheet.jsx'
import { readBookingDraft, writeBookingDraft } from '../../lib/individualBookingDraft.js'
import { buildBookingFlowPath } from '../../lib/bookingFlowNavigation.js'
import { fetchLabourCategoriesGrouped } from '../../api/labourCategoriesApi.js'
import { readAppUserLocation } from '../../lib/appUserLocationStorage.js'
import { getServiceOfferDetails } from '../../lib/serviceOfferUtils.js'
import { ServiceOfferBadge } from '../../components/app/services/ServiceOfferBadge.jsx'
import { useBookingCart } from '../../context/BookingCartContext.jsx'

export function AppSubCategoryServicePage() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()

  const [expandedServiceId, setExpandedServiceId] = useState(null)
  const [bookingTypeOpen, setBookingTypeOpen] = useState(false)
  const [bookingService, setBookingService] = useState(null)
  
  const [cat, setCat] = useState(() => location.state?.cat || null)
  const [loading, setLoading] = useState(() => !(location.state?.cat?.services?.length > 0))
  const [fetchDone, setFetchDone] = useState(() => !!(location.state?.cat?.services?.length > 0))

  const {
    cartCount,
    cartSubtotal,
    addToCart,
    removeFromCart,
    updateQuantity,
    isInCart,
    getItemQuantity,
  } = useBookingCart()

  useEffect(() => {
    let cancelled = false
    const loc = readAppUserLocation()
    if (!cat?.services?.length) {
      setLoading(true)
    }
    fetchLabourCategoriesGrouped(loc?.lat, loc?.lng, loc?.city, loc?.address)
      .then(res => {
        if (cancelled) return
        const groups = res.data?.groups || []
        let matched = null
        for (const g of groups) {
          for (const c of (g.categories || [])) {
            if (String(c._id) === String(id) || String(c._id) === String(cat?._id)) {
              matched = { ...c, groupId: g._id, groupName: g.name, services: c.services || [] }
              break
            }
          }
          if (matched) break
          if (String(g._id) === String(id)) {
            matched = { ...g, groupId: g._id, groupName: g.name, services: g.services || [] }
            break
          }
        }
        if (matched) {
          setCat(matched)
        }
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) {
          setLoading(false)
          setFetchDone(true)
        }
      })
    return () => { cancelled = true }
  }, [id])

  const handleQuickBookType = useCallback(
    (bookingType) => {
      if (!bookingService || !cat) return
      const prev = readBookingDraft() || {}
      const subSvc = bookingService.selectedSubService
      const sName = subSvc ? `${bookingService.name} (${subSvc.name})` : (bookingService.name || '')
      writeBookingDraft({
        ...prev,
        entryPoint: 'category',
        groupId: String(cat.groupId || ''),
        groupName: cat.groupName || '',
        categoryId: String(cat._id),
        categoryName: cat.name || '',
        serviceId: String(bookingService._id),
        serviceName: sName,
        servicePrice: subSvc ? Number(subSvc.price) : Number(bookingService.hourlyPrice || bookingService.basePrice || 0),
        subServiceId: subSvc ? String(subSvc._id) : undefined,
        subServiceName: subSvc ? subSvc.name : undefined,
        subServicePrice: subSvc ? subSvc.price : undefined,
        bookingType,
        matchMode: 'smart',
        selectedWorkers: [],
        minHours: bookingService.minHours || 1,
        maxHours: bookingService.maxHours || 24,
      })
      setBookingTypeOpen(false)
      setBookingService(null)
      navigate(buildBookingFlowPath('details', { categoryId: cat._id }))
    },
    [navigate, cat, bookingService]
  )

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
        <p className="text-sm font-medium text-slate-500">Loading services...</p>
      </div>
    )
  }

  if (!cat && fetchDone) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 gap-4 p-6 text-center">
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100 max-w-sm w-full">
          <Wrench className="mx-auto h-10 w-10 text-slate-300 mb-3" />
          <h2 className="text-base font-bold text-slate-800">Category Not Found</h2>
          <p className="text-xs text-slate-500 mt-1 mb-4">The requested service category is currently not available.</p>
          <button
            onClick={() => navigate('/app', { replace: true })}
            className="w-full rounded-xl bg-brand py-2.5 text-xs font-bold text-white shadow transition hover:bg-brand/90"
          >
            Back to Home
          </button>
        </div>
      </div>
    )
  }

  if (!cat) {
    return null
  }

  const services = useMemo(
    () =>
      [...(cat.services || [])].sort(
        (a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0) || a.name.localeCompare(b.name)
      ),
    [cat.services]
  )

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 w-full overflow-x-hidden">
      {/* Header */}
      <div className="sticky top-0 z-30 px-4 pt-[max(0.75rem,env(safe-area-inset-top,0.75rem))] pb-2 bg-slate-50/90 backdrop-blur-md">
        <div className="rounded-3xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3.5">
              <button 
                onClick={() => navigate(-1)}
                className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[14px] border border-slate-200 text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="flex flex-col justify-center min-w-0">
                <h1 className="text-[20px] font-bold tracking-tight text-slate-900 leading-none truncate">{cat.name || 'Services'}</h1>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/app/cart')}
              className="relative flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[14px] border border-slate-200 text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
              title="View Booking Cart"
            >
              <ShoppingBag className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[10px] font-black text-white shadow-xs">
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 px-3 sm:px-4 py-4 space-y-5 w-full min-w-0 box-border">
        <section>
          {cat.subtitle ? (
            <p className="text-sm text-slate-600 leading-relaxed bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
              {cat.subtitle}
            </p>
          ) : (
            <p className="text-sm text-slate-400 italic">No description available for this category.</p>
          )}
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between pl-1">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Available Services
            </h2>
            {services.some(s => s.discountValue > 0) && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
                <Flame className="h-3 w-3 fill-amber-500 text-amber-500" />
                Active Offers Available
              </span>
            )}
          </div>

          {services.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center">
              <Wrench className="mx-auto h-8 w-8 text-slate-300 mb-3" />
              <p className="text-sm font-medium text-slate-600">No services found for your selected location.</p>
              <p className="text-xs text-slate-400 mt-1">Please try changing your location or check back later.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {services.map((service) => {
                const isExpanded = expandedServiceId === service._id;
                const offer = getServiceOfferDetails(service);

                return (
                  <div
                    key={service._id}
                    className={`bg-white rounded-2xl shadow-sm border transition ${
                      offer.hasOffer ? 'border-amber-200/80 ring-1 ring-amber-100' : 'border-slate-100'
                    } overflow-hidden`}
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedServiceId(prev => prev === service._id ? null : service._id)}
                      className="w-full p-3.5 flex items-center gap-4 text-left transition hover:bg-slate-50/80"
                    >
                      {/* Image Thumbnail */}
                      <div className="relative h-16 w-16 shrink-0 rounded-xl overflow-hidden bg-slate-100 shadow-inner">
                        {service.iconUrl ? (
                          <img
                            src={getCategoryImageUrl({ name: service.name, imageUrl: service.iconUrl })}
                            alt={service.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center">
                            <Wrench className="h-6 w-6 text-slate-300" />
                          </div>
                        )}
                        {offer.hasOffer && (
                          <div className="absolute top-1 left-1">
                            <ServiceOfferBadge label={offer.offerBadge} variant="ribbon" className="!px-1.5 !text-[8px]" />
                          </div>
                        )}
                      </div>

                      {/* Name & Offer Details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <h3 className="font-bold text-slate-900 text-sm leading-snug line-clamp-2">{service.name}</h3>
                          {offer.hasOffer && (
                            <ServiceOfferBadge label={offer.offerBadge} variant="compact" />
                          )}
                          {Array.isArray(service.subServices) && service.subServices.length > 0 && (
                            <span className="rounded-md bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700 border border-indigo-200/60">
                              {service.subServices.filter(ss => ss.isActive !== false).length} options
                            </span>
                          )}
                        </div>
                        {service.description && !isExpanded ? (
                          <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{service.description}</p>
                        ) : null}
                        {offer.hasOffer && !isExpanded && (
                          <p className="text-[11px] font-bold text-emerald-600 mt-0.5">
                            Save {offer.displaySavings}{offer.unitLabel}
                          </p>
                        )}
                      </div>

                      {/* Pricing Tag */}
                      <div className="shrink-0 text-right flex items-center gap-2 pr-1">
                        <div>
                          <p className="text-[10px] font-bold uppercase text-slate-400">Price</p>
                          {offer.hasOffer ? (
                            <div className="mt-0.5">
                              <span className="block text-[11px] font-medium text-slate-400 line-through">
                                {offer.displayOriginalPrice}
                              </span>
                              <span className="font-mono text-sm font-bold text-blue-600">
                                {offer.displayPrice}
                              </span>
                            </div>
                          ) : (
                            <p className="font-mono text-sm font-bold text-blue-600 mt-0.5">
                              {offer.displayPrice}
                            </p>
                          )}
                        </div>
                        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-3 sm:px-4 pb-4 pt-2 bg-slate-50/50 border-t border-slate-100 space-y-3 w-full min-w-0 box-border">
                        {/* Offer Highlight Banner in Expanded View */}
                        {offer.hasOffer && (
                          <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-orange-500/10 border border-amber-300/40 p-3">
                            <div className="flex items-center gap-2.5">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white shadow-sm">
                                <Sparkles className="h-4 w-4" />
                              </div>
                              <div>
                                <p className="text-xs font-bold text-amber-950">
                                  {offer.offerDescription || `Special Discount: ${offer.offerBadge}`}
                                </p>
                                <p className="text-[11px] text-amber-800 font-medium">
                                  Original rate was {offer.displayOriginalPrice}{offer.unitLabel}. You get it for only <strong className="text-emerald-700">{offer.displayPrice}</strong>!
                                </p>
                              </div>
                            </div>
                            <span className="shrink-0 font-extrabold text-xs text-emerald-700 bg-emerald-100/80 px-2 py-1 rounded-lg">
                              Save {offer.displaySavings}
                            </span>
                          </div>
                        )}

                        {service.description && (
                          <div>
                            <p className="text-[10px] font-bold uppercase text-slate-400">Description</p>
                            <p className="text-sm font-medium text-slate-700 leading-relaxed mt-0.5">{service.description}</p>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-[10px] font-bold uppercase text-slate-400">Pricing Breakdown</p>
                            <p className="text-xs font-semibold text-slate-700 mt-1">
                              {offer.hasOffer ? (
                                <>
                                  <span className="line-through text-slate-400 mr-1.5">{offer.displayOriginalPrice}</span>
                                  <span className="text-blue-600 font-bold">{offer.displayPrice}</span>
                                </>
                              ) : (
                                <span className="text-blue-600 font-bold">{offer.displayPrice}</span>
                              )}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold uppercase text-slate-400">Status</p>
                            <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${service.isActive !== false ? 'bg-blue-50 text-blue-700 ring-blue-200' : 'bg-slate-100 text-slate-500 ring-slate-200'
                              }`}>
                              {service.isActive !== false ? 'Active' : 'Hidden'}
                            </span>
                          </div>
                        </div>

                        {/* What's Included & Excluded (Inclusions / Exclusions) */}
                        {((Array.isArray(service.inclusions) && service.inclusions.length > 0) || (Array.isArray(service.exclusions) && service.exclusions.length > 0)) && (
                          <div className="space-y-3 pt-3 border-t border-slate-200/80">
                            {Array.isArray(service.inclusions) && service.inclusions.length > 0 && (
                              <div className="rounded-2xl border border-emerald-200/60 bg-emerald-50/40 p-3.5 space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-600 text-white">
                                      <Check className="h-3 w-3 stroke-[3]" />
                                    </div>
                                    <h4 className="text-xs font-black uppercase tracking-wider text-emerald-950">
                                      What's Included
                                    </h4>
                                  </div>
                                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                                    {service.inclusions.length} items
                                  </span>
                                </div>
                                <div className="grid gap-1.5 sm:grid-cols-2 pt-1">
                                  {service.inclusions.map((item, idx) => (
                                    <div key={idx} className="flex items-start gap-2 rounded-xl bg-white border border-emerald-100/80 px-2.5 py-1.5 text-xs font-semibold text-slate-800 shadow-2xs">
                                      <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0 mt-0.5 stroke-[2.5]" />
                                      <span className="leading-tight">{item}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {Array.isArray(service.exclusions) && service.exclusions.length > 0 && (
                              <div className="rounded-2xl border border-rose-200/60 bg-rose-50/40 p-3.5 space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1.5">
                                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-white">
                                      <X className="h-3 w-3 stroke-[3]" />
                                    </div>
                                    <h4 className="text-xs font-black uppercase tracking-wider text-rose-950">
                                      Not Included / Excluded
                                    </h4>
                                  </div>
                                  <span className="text-[10px] font-bold text-rose-700 bg-rose-100/80 px-2 py-0.5 rounded-full">
                                    {service.exclusions.length} excluded
                                  </span>
                                </div>
                                <div className="grid gap-1.5 sm:grid-cols-2 pt-1">
                                  {service.exclusions.map((item, idx) => (
                                    <div key={idx} className="flex items-start gap-2 rounded-xl bg-white border border-rose-100/80 px-2.5 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs">
                                      <X className="h-3.5 w-3.5 text-rose-500 shrink-0 mt-0.5 stroke-[2.5]" />
                                      <span className="leading-tight">{item}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Sub-Services / Variants List */}
                        {Array.isArray(service.subServices) && service.subServices.filter(ss => ss.isActive !== false).length > 0 && (
                          <div className="space-y-2 pt-3 border-t border-slate-200/80 w-full min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                                Choose Option / Sub-Service
                              </p>
                              <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200/60">
                                {service.subServices.filter(ss => ss.isActive !== false).length} options
                              </span>
                            </div>
                            <div className="grid grid-cols-1 gap-2.5 w-full min-w-0">
                              {[...service.subServices]
                                .filter((ss) => ss.isActive !== false)
                                .sort(
                                  (a, b) =>
                                    (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0) ||
                                    a.name.localeCompare(b.name)
                                )
                                .map((subItem) => (
                                <div
                                  key={subItem._id}
                                  className="flex items-center justify-between gap-2.5 rounded-2xl border border-slate-200/90 bg-white p-3 shadow-xs transition hover:border-brand/50 hover:shadow-sm w-full min-w-0 box-border"
                                >
                                  <div className="flex-1 min-w-0 pr-1">
                                    <h4 className="text-sm font-bold text-slate-900 truncate leading-snug">{subItem.name}</h4>
                                    {subItem.description && (
                                      <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{subItem.description}</p>
                                    )}
                                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400 mt-1">
                                      <Clock className="h-3 w-3 text-slate-400 shrink-0" />
                                      <span>{subItem.estimatedDurationMins || 30} mins</span>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="font-mono text-sm font-black text-blue-600 block text-right mr-1">
                                      ₹{subItem.price}
                                    </span>
                                    {isInCart(service._id, subItem._id) ? (
                                      <div className="flex items-center border border-emerald-300 rounded-xl bg-emerald-50 shadow-2xs overflow-hidden">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            const curr = getItemQuantity(service._id, subItem._id)
                                            updateQuantity(`${service._id}_${subItem._id}`, curr - 1)
                                          }}
                                          className="p-1 text-emerald-700 hover:bg-emerald-100 transition"
                                        >
                                          <Minus className="h-3 w-3" />
                                        </button>
                                        <span className="px-1.5 text-xs font-bold text-emerald-900 font-mono">
                                          {getItemQuantity(service._id, subItem._id)}
                                        </span>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            const curr = getItemQuantity(service._id, subItem._id)
                                            updateQuantity(`${service._id}_${subItem._id}`, curr + 1)
                                          }}
                                          className="p-1 text-emerald-700 hover:bg-emerald-100 transition"
                                        >
                                          <Plus className="h-3 w-3" />
                                        </button>
                                      </div>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          addToCart(service, subItem, {
                                            categoryId: cat?._id,
                                            categoryName: cat?.name,
                                            subcategoryId: cat?._id,
                                            subcategoryName: cat?.name,
                                          })
                                        }}
                                        className="inline-flex items-center justify-center rounded-xl border border-brand/40 bg-brand/5 px-2.5 py-1.5 text-xs font-bold text-brand shadow-2xs hover:bg-brand hover:text-white transition active:scale-95"
                                      >
                                        + Add
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        setBookingService({
                                          ...service,
                                          selectedSubService: subItem,
                                        })
                                        setBookingTypeOpen(true)
                                      }}
                                      className="inline-flex items-center justify-center rounded-xl bg-brand px-3 py-1.5 text-xs font-black uppercase tracking-wider text-white shadow-sm shadow-brand/25 transition active:scale-95 hover:bg-brand/90 hover:shadow-md whitespace-nowrap cursor-pointer shrink-0"
                                    >
                                      Book
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-end gap-2.5 pt-2">
                          {isInCart(service._id) ? (
                            <div className="flex items-center border border-emerald-300 rounded-xl bg-emerald-50 px-3 py-2 shadow-2xs">
                              <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                                <Check className="h-3.5 w-3.5 text-emerald-600 stroke-[3]" />
                                In Cart ({getItemQuantity(service._id)})
                              </span>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                addToCart(service, null, {
                                  categoryId: cat?._id,
                                  categoryName: cat?.name,
                                  subcategoryId: cat?._id,
                                  subcategoryName: cat?.name,
                                })
                              }}
                              className="rounded-xl border border-brand bg-brand/5 px-4 py-2 text-xs font-bold text-brand transition active:scale-95 hover:bg-brand hover:text-white shadow-2xs"
                            >
                              + Add to Booking
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setBookingService(service)
                              setBookingTypeOpen(true)
                            }}
                            className="rounded-xl bg-brand px-6 py-2 text-xs font-black uppercase tracking-wider text-white shadow-sm transition active:scale-95 hover:bg-brand/90"
                          >
                            Book Now
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
      <BookingTypeSheet
        open={bookingTypeOpen}
        onClose={() => {
          setBookingTypeOpen(false)
          setBookingService(null)
        }}
        value={null}
        categoryLabel={bookingService?.name || cat?.name}
        onSelect={handleQuickBookType}
      />

      {/* Floating Bottom Cart Bar */}
      {cartCount > 0 && (
        <div className="fixed bottom-4 inset-x-4 z-40 max-w-md mx-auto">
          <div className="flex items-center justify-between rounded-2xl bg-slate-900/95 text-white p-3.5 shadow-2xl backdrop-blur-md border border-slate-800">
            <div className="flex items-center gap-3">
              <div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-white shadow-sm">
                <ShoppingBag className="h-5 w-5" />
                <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-black text-white ring-2 ring-slate-900">
                  {cartCount}
                </span>
              </div>
              <div>
                <p className="text-xs font-bold leading-tight">
                  {cartCount} {cartCount === 1 ? 'Service in Cart' : 'Services in Cart'}
                </p>
                <p className="text-[11px] font-semibold text-slate-400">
                  Subtotal: <span className="font-mono text-emerald-400 font-bold">₹{cartSubtotal.toLocaleString('en-IN')}</span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => navigate('/app/cart')}
              className="rounded-xl bg-brand px-4 py-2 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-brand/30 hover:bg-brand/90 active:scale-95 transition"
            >
              View Cart &rarr;
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
