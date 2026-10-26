import { useState, useCallback, useEffect, useMemo } from 'react'
import { useLocation, useNavigate, useParams, Navigate } from 'react-router-dom'
import { ArrowLeft, Wrench, ChevronDown, ChevronUp, Loader2, Sparkles, Tag, Flame, Clock, CheckCircle2, XCircle, Check, X, Plus, Minus, Wallet } from 'lucide-react'
import { getCategoryImageUrl } from '../../lib/labourCategoryDisplay.js'
import { BookingTypeSheet } from '../../components/app/booking/BookingTypeSheet.jsx'
import { readBookingDraft, writeBookingDraft } from '../../lib/individualBookingDraft.js'
import { buildBookingFlowPath } from '../../lib/bookingFlowNavigation.js'
import { fetchLabourCategoriesGrouped } from '../../api/labourCategoriesApi.js'
import { readAppUserLocation } from '../../lib/appUserLocationStorage.js'
import { getServiceOfferDetails } from '../../lib/serviceOfferUtils.js'
import { ServiceOfferBadge } from '../../components/app/services/ServiceOfferBadge.jsx'
import { useBookingCart } from '../../context/BookingCartContext.jsx'
import { walletsApi } from '../../api/walletsApi.js'
import { useAuth } from '../../hooks/useAuth.js'

export function AppSubCategoryServicePage() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()

  const [expandedServiceId, setExpandedServiceId] = useState(null)
  const [bookingTypeOpen, setBookingTypeOpen] = useState(false)
  const [bookingService, setBookingService] = useState(null)
  
  const { user, isAuthenticated } = useAuth()
  const [walletSettings, setWalletSettings] = useState({
    enabled: true,
    walletDiscountPercentage: 20,
    welcomeBonusAmount: 1000,
    serviceCreditEnabled: true,
    serviceCreditPercentage: 15,
  })
  const [userWallet, setUserWallet] = useState(null)

  useEffect(() => {
    let isMounted = true
    walletsApi
      .getPublicWalletSettings()
      .then((res) => {
        if (isMounted && res?.data) {
          setWalletSettings((prev) => ({ ...prev, ...res.data }))
        }
      })
      .catch(() => {})

    if (isAuthenticated) {
      walletsApi
        .getMyUserWallet()
        .then((res) => {
          if (isMounted && res?.data?.wallet) {
            setUserWallet(res.data.wallet)
          }
        })
        .catch(() => {})
    }
    return () => {
      isMounted = false
    }
  }, [isAuthenticated])

  const [cat, setCat] = useState(() => location.state?.cat || null)
  const [loading, setLoading] = useState(() => !(location.state?.cat?.services?.length > 0))
  const [fetchDone, setFetchDone] = useState(() => !!(location.state?.cat?.services?.length > 0))

  const {
    cartCount,
    cartSubtotal,
    addToCart,
    updateQuantity,
    isInCart,
    getItemQuantity,
  } = useBookingCart()

  const services = useMemo(
    () =>
      [...(cat?.services || [])].sort(
        (a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0) || a.name.localeCompare(b.name)
      ),
    [cat?.services]
  )

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
      
      let effectiveSubPrice = 0
      if (subSvc) {
        const sPrice = Number(subSvc.price) || 0
        const sOrig = Number(subSvc.originalPrice) || 0
        if (sOrig > sPrice && sPrice > 0) {
          effectiveSubPrice = sPrice
        } else if (Number(bookingService.discountValue) > 0 && sPrice > 0) {
          effectiveSubPrice = bookingService.discountType === 'PERCENTAGE'
            ? Math.max(0, Math.round(sPrice * (1 - Number(bookingService.discountValue) / 100)))
            : Math.max(0, sPrice - Number(bookingService.discountValue))
        } else {
          effectiveSubPrice = sPrice
        }
      } else {
        effectiveSubPrice = Number(bookingService.hourlyPrice || bookingService.basePrice || 0)
      }

      writeBookingDraft({
        ...prev,
        entryPoint: 'category',
        groupId: String(cat.groupId || ''),
        groupName: cat.groupName || '',
        categoryId: String(cat._id),
        categoryName: cat.name || '',
        serviceId: String(bookingService._id),
        serviceName: sName,
        servicePrice: effectiveSubPrice,
        subServiceId: subSvc ? String(subSvc._id) : undefined,
        subServiceName: subSvc ? subSvc.name : undefined,
        subServicePrice: effectiveSubPrice,
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

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 w-full overflow-x-hidden">
      {/* Header */}
      <div className="sticky top-0 z-30 px-4 pt-[max(0.75rem,env(safe-area-inset-top,0.75rem))] pb-2 bg-slate-50/90 backdrop-blur-md">
        <div className="rounded-3xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3.5">
            <button 
              onClick={() => navigate(-1)}
              className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[14px] border border-slate-200 text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex flex-col justify-center min-w-0">
              <h1 className="text-[20px] font-bold tracking-tight text-slate-900 leading-tight break-words">{cat.name || 'Services'}</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className={`flex-1 px-3 sm:px-4 py-4 space-y-5 w-full min-w-0 box-border ${cartCount > 0 ? 'pb-28' : 'pb-8'}`}>
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
          <div className="flex items-center justify-between pl-1 flex-wrap gap-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Available Services
            </h2>
            <div className="flex items-center gap-1.5 flex-wrap">
              {services.some(s => s.discountValue > 0) && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
                  <Flame className="h-3 w-3 fill-amber-500 text-amber-500" />
                  Active Offers Available
                </span>
              )}
              {walletSettings?.enabled !== false && (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60 shadow-2xs">
                  <Wallet className="h-3 w-3 text-emerald-600" />
                  {walletSettings?.walletDiscountPercentage || 20}% Wallet Offers
                </span>
              )}
            </div>
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
                const serviceRawPrice = Number(offer.discountedPrice || offer.originalPrice || service.price || 0);
                const walletDiscountPct = Number(walletSettings?.walletDiscountPercentage || 20);
                const serviceCreditPct = Number(walletSettings?.serviceCreditPercentage || 15);
                const walletSavingsAmount = Math.round((serviceRawPrice * walletDiscountPct) / 100);
                const effectiveWalletPrice = Math.max(0, serviceRawPrice - walletSavingsAmount);
                const walletCashbackAmount = Math.round((serviceRawPrice * serviceCreditPct) / 100);
                const hasWalletOffer = Boolean(walletSettings?.enabled !== false && walletDiscountPct > 0 && serviceRawPrice > 0);

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
                          <h3 className="font-bold text-slate-900 text-sm leading-snug break-words">{service.name}</h3>
                          {offer.hasOffer && (
                            <ServiceOfferBadge label={offer.offerBadge} variant="compact" />
                          )}
                          {hasWalletOffer && (
                            <ServiceOfferBadge label={`${walletDiscountPct}% Wallet OFF`} variant="wallet" />
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
                        <div className="flex items-center gap-2 flex-wrap mt-0.5">
                          {offer.hasOffer && !isExpanded && (
                            <p className="text-[11px] font-bold text-amber-600">
                              Save {offer.displaySavings}{offer.unitLabel}
                            </p>
                          )}
                          {hasWalletOffer && !isExpanded && (
                            <p className="text-[11px] font-bold text-emerald-600 flex items-center gap-1">
                              {offer.hasOffer && <span>•</span>}
                              <span>Save up to ₹{walletSavingsAmount} with Wallet</span>
                            </p>
                          )}
                        </div>
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
                        {/* Special Discount Offer Banner in Expanded View */}
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

                        {/* Wallet Offer Highlight Banner in Expanded View */}
                        {hasWalletOffer && (
                          <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-emerald-500/15 via-teal-500/10 to-cyan-500/10 border border-emerald-400/40 p-3 shadow-2xs">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
                                <Wallet className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="text-xs font-bold text-emerald-950">
                                    Wallet Offer: Save up to {walletDiscountPct}% OFF
                                  </p>
                                  <span className="rounded bg-emerald-100/90 text-emerald-800 text-[9px] font-black px-1.5 py-0.5 border border-emerald-300/60">
                                    A2Z Wallet
                                  </span>
                                  {userWallet?.balance > 0 && (
                                    <span className="text-[10px] font-bold text-emerald-700 bg-white/80 px-1.5 py-0.2 rounded border border-emerald-200">
                                      Balance: ₹{userWallet.balance.toLocaleString('en-IN')}
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-emerald-800 font-medium mt-0.5 leading-snug">
                                  Pay with Wallet balance to get it for only <strong className="text-emerald-950 font-bold">₹{effectiveWalletPrice}{offer.unitLabel}</strong>!
                                  {walletSettings?.serviceCreditEnabled !== false && (
                                    <span className="text-teal-900 font-semibold ml-1">
                                      + Earn {serviceCreditPct}% (₹{walletCashbackAmount}) cashback after service.
                                    </span>
                                  )}
                                </p>
                              </div>
                            </div>
                            <span className="shrink-0 font-extrabold text-xs text-emerald-800 bg-emerald-100/90 px-2.5 py-1 rounded-lg border border-emerald-300/60 shadow-2xs">
                              Save ₹{walletSavingsAmount}
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
                            {hasWalletOffer && walletSavingsAmount > 0 && (
                              <p className="text-[11px] font-bold text-emerald-700 mt-1 flex items-center gap-1">
                                <Wallet className="h-3 w-3 text-emerald-600 shrink-0" />
                                <span>₹{effectiveWalletPrice}{offer.unitLabel} with Wallet (Save ₹{walletSavingsAmount})</span>
                              </p>
                            )}
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
                                .map((subItem) => {
                                  const subOrigPrice = Number(subItem.originalPrice) || 0
                                  const subPrice = Number(subItem.price) || 0
                                  let origPrice = subPrice
                                  let finalPrice = subPrice
                                  let hasSubOffer = false
                                  let discountPercent = 0

                                  if (subOrigPrice > subPrice && subPrice > 0) {
                                    origPrice = subOrigPrice
                                    finalPrice = subPrice
                                    hasSubOffer = true
                                    discountPercent = Math.round(((origPrice - finalPrice) / origPrice) * 100)
                                  } else if (Number(service.discountValue) > 0 && subPrice > 0) {
                                    origPrice = subPrice
                                    if (service.discountType === 'PERCENTAGE') {
                                      finalPrice = Math.max(0, Math.round(subPrice * (1 - Number(service.discountValue) / 100)))
                                      discountPercent = Number(service.discountValue)
                                    } else {
                                      finalPrice = Math.max(0, subPrice - Number(service.discountValue))
                                      discountPercent = Math.round(((origPrice - finalPrice) / origPrice) * 100)
                                    }
                                    hasSubOffer = finalPrice < origPrice
                                  }

                                  const subWalletSavings = Math.round((finalPrice * walletDiscountPct) / 100);
                                  const subPriceWithWallet = Math.max(0, finalPrice - subWalletSavings);

                                  return (
                                    <div
                                      key={subItem._id}
                                      className="rounded-2xl border border-slate-200/90 bg-white p-3.5 shadow-xs transition hover:border-brand/50 hover:shadow-sm w-full min-w-0 box-border"
                                    >
                                      {/* Sub-Service Name & Details */}
                                      <div className="w-full min-w-0">
                                        <h4 className="text-sm font-bold text-slate-900 leading-snug break-words">
                                          {subItem.name}
                                        </h4>
                                        {subItem.description && (
                                          <p className="text-xs text-slate-500 mt-1 leading-relaxed break-words">
                                            {subItem.description}
                                          </p>
                                        )}
                                        <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-400 mt-1.5">
                                          <Clock className="h-3 w-3 text-slate-400 shrink-0" />
                                          <span>{subItem.estimatedDurationMins || 30} mins</span>
                                        </div>
                                      </div>

                                      {/* Pricing & Action Buttons */}
                                      <div className="flex items-center justify-between gap-2 pt-2.5 mt-2.5 border-t border-slate-100">
                                        <div className="flex flex-col min-w-0">
                                          <div className="flex items-baseline gap-1.5 flex-wrap">
                                            {hasSubOffer ? (
                                              <>
                                                <span className="font-mono text-base font-black text-blue-600">
                                                  ₹{finalPrice}
                                                </span>
                                                <span className="font-mono text-xs font-medium text-slate-400 line-through">
                                                  ₹{origPrice}
                                                </span>
                                                {discountPercent > 0 && (
                                                  <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[9px] font-black text-rose-600 border border-rose-200/60 leading-none">
                                                    {discountPercent}% OFF
                                                  </span>
                                                )}
                                              </>
                                            ) : (
                                              <span className="font-mono text-base font-black text-blue-600">
                                                ₹{finalPrice}
                                              </span>
                                            )}
                                          </div>
                                          {hasWalletOffer && subWalletSavings > 0 && (
                                            <div className="flex items-center gap-1 mt-1">
                                              <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200/70">
                                                <Wallet className="h-2.5 w-2.5 text-emerald-600 shrink-0" />
                                                ₹{subPriceWithWallet} with Wallet (Save ₹{subWalletSavings})
                                              </span>
                                            </div>
                                          )}
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                          {isInCart(service._id, subItem._id) ? (
                                            <div className="flex items-center border border-emerald-300 rounded-xl bg-emerald-50 shadow-2xs overflow-hidden">
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  const curr = getItemQuantity(service._id, subItem._id)
                                                  updateQuantity(`${service._id}_${subItem._id}`, curr - 1)
                                                }}
                                                className="p-1.5 text-emerald-700 hover:bg-emerald-100 transition"
                                                title="Decrease quantity"
                                              >
                                                <Minus className="h-3 w-3" />
                                              </button>
                                              <span className="px-2 text-xs font-bold text-emerald-900 font-mono">
                                                {getItemQuantity(service._id, subItem._id)}
                                              </span>
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation()
                                                  const curr = getItemQuantity(service._id, subItem._id)
                                                  updateQuantity(`${service._id}_${subItem._id}`, curr + 1)
                                                }}
                                                className="p-1.5 text-emerald-700 hover:bg-emerald-100 transition"
                                                title="Increase quantity"
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
                                              className="inline-flex items-center justify-center rounded-xl border border-brand/40 bg-brand/5 px-3 py-1.5 text-xs font-bold text-brand shadow-2xs hover:bg-brand hover:text-white transition active:scale-95 cursor-pointer"
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
                                            className="inline-flex items-center justify-center rounded-xl bg-brand px-3.5 py-1.5 text-xs font-black uppercase tracking-wider text-white shadow-sm shadow-brand/25 transition active:scale-95 hover:bg-brand/90 hover:shadow-md whitespace-nowrap cursor-pointer shrink-0"
                                          >
                                            Book
                                          </button>
                                        </div>
                                      </div>
                                    </div>
                                  )
                                })}
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
    </div>
  )
}
