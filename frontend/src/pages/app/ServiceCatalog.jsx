import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { ChevronRight, Loader2, Search, Sparkles, Tag, Package } from 'lucide-react'
import { fetchLabourCategoriesGrouped } from '../../api/labourCategoriesApi.js'
import { readAppUserLocation } from '../../lib/appUserLocationStorage.js'
import { ApiError } from '../../api/http.js'
import { AppStackScreenHeader } from '../../components/app/AppStackScreenHeader.jsx'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { buildBookingFlowPath } from '../../lib/bookingFlowNavigation.js'
import { readBookingDraft, writeBookingDraft } from '../../lib/individualBookingDraft.js'
import { getServiceOfferDetails } from '../../lib/serviceOfferUtils.js'
import { ServiceOfferBadge } from '../../components/app/services/ServiceOfferBadge.jsx'

export function ServiceCatalog() {
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const [groups, setGroups] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [expandedGroup, setExpandedGroup] = useState(null)
  const [expandedCategory, setExpandedCategory] = useState(null)

  useEffect(() => {
    let cancelled = false
    const loadCategories = () => {
      setLoading(true)
      const loc = readAppUserLocation()
      fetchLabourCategoriesGrouped(loc?.lat, loc?.lng, loc?.city, loc?.address)
        .then((res) => {
          if (cancelled) return
          setGroups(res.data?.groups ?? [])
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof ApiError ? err.message : 'Failed to load services')
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }
    
    loadCategories()
    window.addEventListener('lc-app-user-location-changed', loadCategories)
    
    return () => { 
      cancelled = true 
      window.removeEventListener('lc-app-user-location-changed', loadCategories)
    }
  }, [])

  const handleSubcategorySelect = useCallback((subcategory, category, group) => {
    navigate(`/user/sub-category/${subcategory._id}`, { state: { cat: subcategory } })
  }, [navigate])

  if (loading) {
    return (
      <div className="space-y-4">
        <AppStackScreenHeader title="Services" backTo="/user" />
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-4">
        <AppStackScreenHeader title="Services" backTo="/user" />
        <GlassPanel className="p-6 text-center">
          <p className="text-sm font-semibold text-rose-700">{error}</p>
        </GlassPanel>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-8">
      <AppStackScreenHeader title="Book a Service" backTo="/user" />

      {/* Service Packages Banner */}
      <div
        onClick={() => navigate('/user/packages')}
        className="group relative cursor-pointer overflow-hidden rounded-2xl bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 p-4 text-white shadow-md hover:shadow-lg transition-all"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 text-amber-300 backdrop-blur-md">
              <Package className="h-6 w-6" />
            </span>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-slate-900">
                  Bundles
                </span>
                <span className="text-xs font-bold text-indigo-200">Save up to 40%</span>
              </div>
              <h3 className="text-sm font-extrabold text-white mt-0.5">
                Explore Service Packages
              </h3>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-indigo-300 group-hover:translate-x-1 transition-transform" />
        </div>
      </div>

      <GlassPanel className="flex items-center gap-3 border-slate-200/80 px-4 py-3">
        <Search className="h-4 w-4 text-slate-400" aria-hidden />
        <p className="text-sm text-slate-500">Browse categories and pick a service</p>
      </GlassPanel>

      {groups.length === 0 ? (
        <GlassPanel className="p-8 text-center">
          <Sparkles className="mx-auto h-10 w-10 text-slate-300" aria-hidden />
          <p className="mt-3 text-sm font-semibold text-slate-600">No services available yet</p>
        </GlassPanel>
      ) : (
        <div className="space-y-3">
          {groups.map((group, gi) => (
            <motion.div
              key={group._id}
              initial={reduce ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: gi * 0.05 }}
            >
              <GlassPanel className="overflow-hidden p-0">
                <button
                  type="button"
                  onClick={() => setExpandedGroup(expandedGroup === group._id ? null : group._id)}
                  className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left transition hover:bg-slate-50"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
                      <Sparkles className="h-5 w-5" aria-hidden />
                    </span>
                    <div>
                      <p className="text-sm font-extrabold text-slate-900">{group.name}</p>
                      <p className="text-xs text-slate-500">
                        {(group.categories || []).length} categories
                      </p>
                    </div>
                  </div>
                  <ChevronRight
                    className={`h-5 w-5 text-slate-400 transition ${expandedGroup === group._id ? 'rotate-90' : ''}`}
                    aria-hidden
                  />
                </button>

                {expandedGroup === group._id && (
                  <div className="border-t border-slate-100 bg-slate-50/50">
                    {(group.categories || []).map((category) => (
                      <div key={category._id}>
                        <button
                          type="button"
                          onClick={() => setExpandedCategory(expandedCategory === category._id ? null : category._id)}
                          className="flex w-full items-center justify-between gap-3 px-6 py-3 text-left transition hover:bg-white"
                        >
                          <p className="text-sm font-bold text-slate-800">{category.name}</p>
                          <ChevronRight
                            className={`h-4 w-4 text-slate-400 transition ${expandedCategory === category._id ? 'rotate-90' : ''}`}
                            aria-hidden
                          />
                        </button>

                        {expandedCategory === category._id && (
                          <div className="bg-white pb-2">
                            {(category.services || []).length === 0 ? (
                              <p className="px-8 py-2 text-xs text-slate-500">No services</p>
                            ) : (
                              (category.services || []).map((sub) => {
                                const offer = getServiceOfferDetails(sub)
                                return (
                                  <button
                                    key={sub._id}
                                    type="button"
                                    onClick={() => handleSubcategorySelect(category, null, group)}
                                    className="flex w-full items-center justify-between gap-3 px-8 py-2.5 text-left transition hover:bg-brand/5 group"
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <p className="text-sm font-semibold text-slate-800 group-hover:text-brand transition truncate">{sub.name}</p>
                                      {offer.hasOffer && (
                                        <ServiceOfferBadge label={offer.offerBadge} variant="compact" className="!text-[9px] !py-0" />
                                      )}
                                    </div>
                                    <div className="shrink-0 text-right flex items-center gap-1.5">
                                      {offer.hasOffer ? (
                                        <>
                                          <span className="text-xs text-slate-400 line-through">
                                            {offer.displayOriginalPrice}
                                          </span>
                                          <span className="rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 ring-1 ring-emerald-600/20">
                                            {offer.displayPrice}
                                          </span>
                                        </>
                                      ) : (
                                        <span className="rounded-lg bg-brand/10 px-2.5 py-1 text-xs font-bold text-brand">
                                          {offer.displayPrice}
                                        </span>
                                      )}
                                    </div>
                                  </button>
                                )
                              })
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </GlassPanel>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  )
}
