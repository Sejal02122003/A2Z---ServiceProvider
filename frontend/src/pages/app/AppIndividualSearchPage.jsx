import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { fetchLabourCategoriesGrouped } from '../../api/labourCategoriesApi.js'
import { readAppUserLocation } from '../../lib/appUserLocationStorage.js'
import { IndividualCategorySearchPanel } from '../../components/app/individual/IndividualCategorySearchPanel.jsx'

export function AppIndividualSearchPage() {
  const navigate = useNavigate()
  const [tradeGroups, setTradeGroups] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    const loc = readAppUserLocation()
    fetchLabourCategoriesGrouped(loc?.lat, loc?.lng, loc?.city, loc?.address)
      .then((res) => {
        if (cancelled) return
        const groups = res.data?.groups ?? []
        const meta = res.data?.meta ?? {}
        const tradeKind = meta.tradeKind ?? 'trade'
        setTradeGroups(groups.filter((g) => g.kind === tradeKind))
      })
      .catch(() => {
        if (!cancelled) setTradeGroups([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="-mx-4 flex h-[100dvh] flex-col bg-white overflow-hidden">
      <div className="shrink-0 px-4 pt-2 pb-4">
        <div className="rounded-3xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center gap-3.5">
            <button 
              onClick={() => navigate('/user')}
              className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-[14px] border border-slate-200 text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex flex-col justify-center">
              <h1 className="text-[20px] font-bold tracking-tight text-slate-900 leading-none mb-1.5">Search</h1>
              <p className="text-[13px] font-medium text-slate-500 leading-none">Find services and workers</p>
            </div>
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        <IndividualCategorySearchPanel tradeGroups={tradeGroups} groupsLoading={loading} />
      </div>
    </div>
  )
}
