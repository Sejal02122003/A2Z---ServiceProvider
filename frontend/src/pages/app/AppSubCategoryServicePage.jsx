import { useState, useCallback, useEffect } from 'react'
import { useLocation, useNavigate, useParams, Navigate } from 'react-router-dom'
import { ArrowLeft, Wrench, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { getCategoryImageUrl } from '../../lib/labourCategoryDisplay.js'
import { BookingTypeSheet } from '../../components/app/booking/BookingTypeSheet.jsx'
import { readBookingDraft, writeBookingDraft } from '../../lib/individualBookingDraft.js'
import { buildBookingFlowPath } from '../../lib/bookingFlowNavigation.js'
import { fetchLabourCategoriesGrouped } from '../../api/labourCategoriesApi.js'
import { readAppUserLocation } from '../../lib/appUserLocationStorage.js'

export function AppSubCategoryServicePage() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useNavigate()

  const [expandedServiceId, setExpandedServiceId] = useState(null)
  const [bookingTypeOpen, setBookingTypeOpen] = useState(false)
  const [bookingService, setBookingService] = useState(null)
  
  const [cat, setCat] = useState(() => location.state?.cat)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    const loc = readAppUserLocation()
    setLoading(true)
    fetchLabourCategoriesGrouped(loc?.lat, loc?.lng, loc?.city, loc?.address)
      .then(res => {
        if (cancelled) return
        const groups = res.data?.groups || []
        for (const g of groups) {
          for (const c of (g.categories || [])) {
            if (String(c._id) === String(id) || String(c._id) === String(cat?._id)) {
              setCat({ ...c, groupId: g._id, groupName: g.name, services: c.services || [] })
            }
          }
        }
      })
      .catch(console.error)
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [id, cat?._id])

  const handleQuickBookType = useCallback(
    (bookingType) => {
      if (!bookingService || !cat) return
      const prev = readBookingDraft() || {}
      writeBookingDraft({
        ...prev,
        entryPoint: 'category',
        groupId: String(cat.groupId || ''),
        groupName: cat.groupName || '',
        categoryId: String(cat._id),
        categoryName: cat.name || '',
        serviceId: String(bookingService._id),
        serviceName: bookingService.name || '',
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

  if (!cat && !loading) {
    // If user refreshes or visits directly, redirect back
    return <Navigate to="/app" replace />
  }

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
        <p className="text-sm font-medium text-slate-500">Loading services...</p>
      </div>
    )
  }

  const services = cat?.services || []

  return (
    <div className="flex flex-col min-h-screen bg-slate-50 -mx-4 -mt-[max(0.5rem,env(safe-area-inset-top,0px))]">
      {/* Header */}
      <div className="sticky top-[max(0.5rem,env(safe-area-inset-top,0.5rem))] z-30 px-4 pt-2 pb-1 bg-slate-50/80 backdrop-blur-md">
        <div className="rounded-3xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3.5">
            <button 
              onClick={() => navigate(-1)}
              className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[14px] border border-slate-200 text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex flex-col justify-center min-w-0">
              <h1 className="text-[20px] font-bold tracking-tight text-slate-900 leading-none truncate">{cat.name}</h1>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 space-y-6">
        <section>
          {cat.subtitle ? (
            <p className="text-sm text-slate-600 leading-relaxed bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
              {cat.subtitle}
            </p>
          ) : (
            <p className="text-sm text-slate-400 italic">No description available for this sub-category.</p>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-slate-500 pl-1">
            Available Services
          </h2>

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
                return (
                  <div
                    key={service._id}
                    className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => setExpandedServiceId(prev => prev === service._id ? null : service._id)}
                      className="w-full p-3 flex items-center gap-4 text-left transition hover:bg-slate-50"
                    >
                      <div className="h-16 w-16 shrink-0 rounded-xl overflow-hidden bg-slate-100 shadow-inner">
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
                      </div>

                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-900 truncate text-sm">{service.name}</h3>
                        {service.description && !isExpanded ? (
                          <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">{service.description}</p>
                        ) : null}
                      </div>

                      <div className="shrink-0 text-right flex items-center gap-2 pr-1">
                        <div>
                          <p className="text-[10px] font-bold uppercase text-slate-400">Price</p>
                          <p className="font-mono text-sm font-bold text-blue-600 mt-0.5">
                            {service.minHours === 0.5 ? `₹${Math.round(service.hourlyPrice / 2)}/30min` : `₹${service.hourlyPrice}/hr`}
                          </p>
                        </div>
                        <ChevronDown className={`h-4 w-4 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-4 pb-4 pt-1 bg-slate-50/50 border-t border-slate-100 space-y-3">
                        {service.description && (
                          <div>
                            <p className="text-[10px] font-bold uppercase text-slate-400">Description</p>
                            <p className="text-sm font-medium text-slate-700 leading-relaxed mt-0.5">{service.description}</p>
                          </div>
                        )}
                        <div className="grid grid-cols-1 gap-4">
                          <div>
                            <p className="text-[10px] font-bold uppercase text-slate-400">Status</p>
                            <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ring-1 ${service.isActive !== false ? 'bg-blue-50 text-blue-700 ring-blue-200' : 'bg-slate-100 text-slate-500 ring-slate-200'
                              }`}>
                              {service.isActive !== false ? 'Active' : 'Hidden'}
                            </span>
                          </div>
                        </div>
                        <div className="flex justify-end pt-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setBookingService(service)
                              setBookingTypeOpen(true)
                            }}
                            className="rounded-xl bg-brand px-6 py-2.5 text-sm font-bold text-white shadow-sm transition active:scale-95"
                          >
                            Book
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
