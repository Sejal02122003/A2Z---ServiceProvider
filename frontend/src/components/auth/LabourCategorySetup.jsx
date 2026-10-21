import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useDispatch } from 'react-redux'
import {
  ArrowLeft,
  Check,
  CheckCheck,
  ChevronRight,
  HardHat,
  Sparkles,
  Wrench,
  X,
  Plus,
} from 'lucide-react'
import { AppSearchBar } from '../app-ui/inputs/AppSearchBar.jsx'
import { AppPrimaryButton } from '../app/AppPrimaryButton.jsx'
import { GlassPanel } from '../ui/GlassPanel.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import { setUser } from '../../store/slices/authSlice.js'
import { fetchLabourCategoriesGrouped } from '../../api/labourCategoriesApi.js'
import { updateMyLabourCategories } from '../../api/userLabourApi.js'
import { ApiError } from '../../api/http.js'

function categoryId(c) {
  return String(c._id)
}

function SelectRow({ label, subtitle, selected, onToggle }) {
  return (
    <div
      className={`flex w-full flex-col overflow-hidden rounded-2xl border transition-all ${
        selected
          ? 'border-brand/40 bg-gradient-to-r from-brand/10 via-white to-blue-50/60 shadow-xs ring-2 ring-brand/20'
          : 'border-slate-200/90 bg-white hover:border-brand/30 hover:bg-slate-50/50'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center gap-3 px-3.5 py-3 text-left active:scale-[0.99]"
      >
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition-all ${
            selected
              ? 'border-brand bg-brand text-white shadow-xs'
              : 'border-slate-300 bg-white group-hover:border-slate-400'
          }`}
          aria-hidden
        >
          {selected ? <Check className="h-3.5 w-3.5 stroke-[3]" /> : null}
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block text-sm font-bold ${selected ? 'text-brand-900 font-extrabold' : 'text-slate-900'}`}>
            {label}
          </span>
          {subtitle ? (
            <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">
              {subtitle}
            </span>
          ) : null}
        </span>
      </button>
    </div>
  )
}

function AreaCard({ group, selectedInGroup, onOpen }) {
  const initial = group.name.replace(/[^a-zA-Z0-9]/g, '').charAt(0).toUpperCase() || '?'
  const isSelected = selectedInGroup > 0

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex w-full items-stretch gap-3 rounded-2xl border p-3.5 text-left shadow-xs transition-all active:scale-[0.99] ${
        isSelected
          ? 'border-brand/40 bg-gradient-to-r from-brand/5 via-white to-blue-50/30 ring-1 ring-brand/20'
          : 'border-slate-200/90 bg-white hover:border-brand/30 hover:shadow-sm'
      }`}
    >
      <div
        className={`flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl text-lg font-black transition-colors ${
          isSelected
            ? 'bg-brand text-white shadow-sm shadow-brand/30'
            : 'bg-gradient-to-br from-brand/10 via-blue-50 to-white text-brand ring-1 ring-brand/15'
        }`}
      >
        {initial}
      </div>

      <div className="min-w-0 flex-1 py-0.5">
        <div className="flex items-center gap-1.5">
          <p className="font-bold leading-snug text-slate-900">{group.name}</p>
        </div>
        {group.description ? (
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{group.description}</p>
        ) : null}
        <p className="mt-1.5 text-[11px] font-semibold text-brand">
          {(group.categories || []).length} services available
        </p>
      </div>

      <div className="flex shrink-0 flex-col items-end justify-center pl-1">
        {selectedInGroup > 0 ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-1 text-[11px] font-black text-white shadow-xs">
            <Check className="h-3 w-3 stroke-[3]" />
            {selectedInGroup} selected
          </span>
        ) : (
          <ChevronRight className="h-5 w-5 text-slate-300" aria-hidden />
        )}
      </div>
    </button>
  )
}

/**
 * Worker trade + role picker (onboarding or profile update).
 * Allows selecting multiple categories and services.
 * @param {{ variant?: 'auth' | 'app', onComplete?: () => void }} props
 */
export function LabourCategorySetup({ variant = 'app', onComplete }) {
  const reduce = useReducedMotion()
  const dispatch = useDispatch()
  const { user } = useAuth()

  const [groups, setGroups] = useState([])
  const [meta, setMeta] = useState({ profileKind: 'profile', tradeKind: 'trade' })
  const [selected, setSelected] = useState(() => new Map())
  const [hubSearch, setHubSearch] = useState('')
  const [roleSearch, setRoleSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [step, setStep] = useState('areas')
  const [activeGroupId, setActiveGroupId] = useState(null)

  const tradeCategoryIds = useMemo(() => {
    const s = new Set()
    for (const g of groups) {
      if (g.kind !== meta.tradeKind) continue
      for (const c of g.categories || []) s.add(categoryId(c))
    }
    return s
  }, [groups, meta.tradeKind])

  const tradeSelectedCount = useMemo(
    () => [...selected.keys()].filter((id) => tradeCategoryIds.has(id)).length,
    [selected, tradeCategoryIds],
  )

  const hasTradeSelected = tradeSelectedCount > 0
  const hasExistingCategories =
    (user?.labourProfile?.serviceIds?.length ??
      user?.labourProfile?.subcategoryIds?.length ??
      user?.labourProfile?.categoryIds?.length ??
      0) > 0

  const tradeGroups = useMemo(() => groups.filter((g) => g.kind === meta.tradeKind), [groups, meta.tradeKind])

  const activeGroup = useMemo(
    () => tradeGroups.find((g) => String(g._id) === String(activeGroupId)),
    [tradeGroups, activeGroupId],
  )

  const countInGroup = useCallback(
    (g) => {
      let n = 0
      for (const c of g.categories || []) {
        if (selected.has(categoryId(c))) n += 1
      }
      return n
    },
    [selected],
  )

  const areasWithPicks = useMemo(() => tradeGroups.filter((g) => countInGroup(g) > 0).length, [tradeGroups, countInGroup])

  const filteredTradeGroups = useMemo(() => {
    const q = hubSearch.trim().toLowerCase()
    if (!q) return tradeGroups
    return tradeGroups.filter((g) => {
      if (g.name.toLowerCase().includes(q) || (g.description || '').toLowerCase().includes(q)) return true
      return (g.categories || []).some((c) => `${c.name} ${c.subtitle || ''}`.toLowerCase().includes(q))
    })
  }, [tradeGroups, hubSearch])

  // Flat list of all selected items for quick chips overview
  const selectedItemsList = useMemo(() => {
    const list = []
    for (const g of tradeGroups) {
      for (const c of g.categories || []) {
        const id = categoryId(c)
        if (selected.has(id)) {
          list.push({
            id,
            name: c.name,
            groupName: g.name,
            subcategoryId: c.subcategoryId,
          })
        }
      }
    }
    return list
  }, [tradeGroups, selected])

  const syncFromUser = useCallback(() => {
    let raw = user?.labourProfile?.serviceIds
    if (!raw || raw.length === 0) {
      raw = user?.labourProfile?.subcategoryIds
      if (!raw || raw.length === 0) raw = user?.labourProfile?.categoryIds ?? []
    }
    const m = new Map()

    raw.forEach((x) => {
      const id = typeof x === 'object' && x?._id ? String(x._id) : String(x)
      m.set(id, true)
    })
    setSelected(m)
  }, [user])

  useEffect(() => {
    queueMicrotask(() => syncFromUser())
  }, [syncFromUser])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) setLoading(true)
    })
    fetchLabourCategoriesGrouped()
      .then((res) => {
        if (!cancelled) {
          const rawGroups = res.data?.groups ?? []

          // Flatten subcategories to services for Labour UI
          const modifiedGroups = rawGroups.map((group) => {
            const flattenedServices = []
            for (const sub of group.categories || []) {
              if (sub.services && sub.services.length > 0) {
                for (const srv of sub.services) {
                  flattenedServices.push({
                    _id: srv._id,
                    name: srv.name,
                    subtitle: sub.name, // Display subcategory name as subtitle
                    subcategoryId: sub._id,
                  })
                }
              } else {
                // If no nested services, allow picking the subcategory directly
                flattenedServices.push({
                  _id: sub._id,
                  name: sub.name,
                  subtitle: group.name,
                  subcategoryId: sub._id,
                })
              }
            }
            return {
              ...group,
              categories: flattenedServices,
            }
          })

          setGroups(modifiedGroups)
          if (res.data?.meta) setMeta((m) => ({ ...m, ...res.data.meta }))
        }
      })
      .catch(() => {
        if (!cancelled) setError('Could not load work categories. Pull to refresh or try again.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (step !== 'roles' || !activeGroupId || activeGroup) return
    queueMicrotask(() => {
      setStep('areas')
      setActiveGroupId(null)
    })
  }, [step, activeGroupId, activeGroup])

  // MULTI-SELECTION TOGGLE: does not clear previous selections!
  function toggle(id) {
    const key = String(id)
    setSelected((prev) => {
      const next = new Map(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.set(key, true)
      }
      return next
    })
  }

  function selectAllInActiveGroup() {
    if (!activeGroup?.categories) return
    setSelected((prev) => {
      const next = new Map(prev)
      for (const c of activeGroup.categories) {
        next.set(categoryId(c), true)
      }
      return next
    })
  }

  function deselectAllInActiveGroup() {
    if (!activeGroup?.categories) return
    setSelected((prev) => {
      const next = new Map(prev)
      for (const c of activeGroup.categories) {
        next.delete(categoryId(c))
      }
      return next
    })
  }

  function clearAllSelections() {
    setSelected(new Map())
  }

  function openGroup(g) {
    setActiveGroupId(String(g._id))
    setRoleSearch('')
    setStep('roles')
  }

  function closeRoles() {
    setStep('areas')
    setActiveGroupId(null)
    setRoleSearch('')
  }

  async function handleSave() {
    setError('')
    if (!hasTradeSelected) {
      setError('Choose at least one category or service to continue.')
      return
    }

    const servicesPayload = []
    for (const [id] of selected.entries()) {
      let subcategoryId = id
      for (const group of tradeGroups) {
        for (const cat of group.categories || []) {
          if (String(cat._id) === id) {
            if (cat.subcategoryId) subcategoryId = String(cat.subcategoryId)
          }
        }
      }

      servicesPayload.push({
        serviceId: id,
        subcategoryId: subcategoryId,
        minPrice: 0,
        maxPrice: 0,
      })
    }

    setSaving(true)
    try {
      const res = await updateMyLabourCategories(servicesPayload)
      dispatch(setUser(res.data.user))
      onComplete?.()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not save your work types')
    } finally {
      setSaving(false)
    }
  }

  const roleQ = roleSearch.trim().toLowerCase()
  const visibleRoles =
    activeGroup?.categories?.filter((c) => {
      if (!roleQ) return true
      return `${c.name} ${c.subtitle || ''}`.toLowerCase().includes(roleQ)
    }) ?? []

  const activeGroupSelectedCount = activeGroup ? countInGroup(activeGroup) : 0
  const allActiveRolesSelected =
    visibleRoles.length > 0 && visibleRoles.every((c) => selected.has(categoryId(c)))

  const showBack = variant === 'app' && hasExistingCategories && step === 'areas'

  return (
    <div className="flex min-h-0 flex-1 flex-col pb-28">
      <header className="mb-4">
        <div className="flex items-center gap-2">
          {step === 'roles' ? (
            <button
              type="button"
              onClick={closeRoles}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200/90 bg-white text-slate-800 shadow-xs transition hover:border-brand/35"
              aria-label="Back to work areas"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden />
            </button>
          ) : showBack ? (
            <Link
              to="/app"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-200/90 bg-white text-slate-800 shadow-xs transition hover:border-brand/35"
              aria-label="Back to app"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden />
            </Link>
          ) : (
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-brand ring-1 ring-brand/20">
              <Wrench className="h-5 w-5" aria-hidden />
            </span>
          )}

          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-brand">
              {variant === 'auth' ? 'Service Provider setup' : 'Work Categories & Services'}
            </p>
            <h2 className="text-lg font-black tracking-tight text-slate-900">
              {step === 'areas' ? 'Select Categories & Services' : activeGroup?.name}
            </h2>
          </div>

          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand px-3 py-1 text-xs font-black text-white shadow-xs">
            <Check className="h-3.5 w-3.5 stroke-[3]" />
            {tradeSelectedCount}
          </span>
        </div>

        <div className="mt-3 flex items-center gap-1.5">
          <button
            type="button"
            onClick={closeRoles}
            className={`rounded-full px-3 py-1 text-[10px] font-bold transition ${
              step === 'areas' ? 'bg-brand text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            1 · Work Categories
          </button>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" aria-hidden />
          <span
            className={`rounded-full px-3 py-1 text-[10px] font-bold ${
              step === 'roles' ? 'bg-brand text-white shadow-xs' : 'bg-slate-100 text-slate-500'
            }`}
          >
            2 · Services & Roles
          </span>
        </div>

        {step === 'areas' ? (
          <p className="mt-2 text-xs leading-relaxed text-slate-600">
            Select all the categories and services you can perform. You can select multiple skills across different areas to receive more matching jobs.
          </p>
        ) : activeGroup?.description ? (
          <p className="mt-2 text-xs leading-relaxed text-slate-600">{activeGroup.description}</p>
        ) : null}
      </header>

      {variant === 'auth' ? (
        <GlassPanel className="mb-4 flex items-start gap-2.5 border-brand/20 bg-brand/5 p-3 ring-1 ring-brand/15">
          <HardHat className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
          <p className="text-[11px] leading-relaxed text-slate-700">
            <span className="font-bold text-slate-900">Select Multiple Skills:</span> Choose all the services you offer to maximize job opportunities.
          </p>
        </GlassPanel>
      ) : null}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand/20 border-t-brand" />
          <p className="mt-3 text-xs font-medium text-slate-500">Loading work categories…</p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {step === 'areas' ? (
            <motion.div
              key="areas"
              initial={reduce ? false : { opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? false : { opacity: 0, x: 12 }}
              className="space-y-4"
            >
              {/* Selected Skills Preview Drawer */}
              {selectedItemsList.length > 0 && (
                <div className="rounded-2xl border border-brand/20 bg-gradient-to-br from-blue-50/70 via-indigo-50/30 to-white p-3.5 shadow-xs">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-800">
                      Selected Skills ({selectedItemsList.length})
                    </span>
                    <button
                      type="button"
                      onClick={clearAllSelections}
                      className="text-[11px] font-bold text-rose-600 hover:text-rose-700"
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto pr-1">
                    {selectedItemsList.map((item) => (
                      <span
                        key={item.id}
                        className="inline-flex items-center gap-1 rounded-full border border-brand/30 bg-white px-2.5 py-1 text-xs font-semibold text-brand shadow-xs"
                      >
                        <span>{item.name}</span>
                        <button
                          type="button"
                          onClick={() => toggle(item.id)}
                          className="ml-0.5 rounded-full p-0.5 text-slate-400 hover:bg-slate-100 hover:text-rose-600"
                          aria-label={`Remove ${item.name}`}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <AppSearchBar
                value={hubSearch}
                onChange={(e) => setHubSearch(e.target.value)}
                placeholder="Search categories or services…"
                className="border-slate-200/90 shadow-xs ring-1 ring-slate-200/80"
              />

              {areasWithPicks > 0 ? (
                <p className="text-center text-[11px] font-semibold text-slate-500">
                  {areasWithPicks} categor{areasWithPicks === 1 ? 'y' : 'ies'} with selected services
                </p>
              ) : null}

              <div className="space-y-2.5">
                {filteredTradeGroups.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">No categories match your search.</p>
                ) : (
                  filteredTradeGroups.map((g) => {
                    if ((g.categories || []).length === 0) return null
                    return (
                      <AreaCard
                        key={g._id}
                        group={g}
                        selectedInGroup={countInGroup(g)}
                        onOpen={() => openGroup(g)}
                      />
                    )
                  })
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="roles"
              initial={reduce ? false : { opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduce ? false : { opacity: 0, x: -12 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <AppSearchBar
                  value={roleSearch}
                  onChange={(e) => setRoleSearch(e.target.value)}
                  placeholder="Filter services in this category…"
                  className="flex-1 border-slate-200/90 shadow-xs ring-1 ring-slate-200/80"
                />
                <button
                  type="button"
                  onClick={allActiveRolesSelected ? deselectAllInActiveGroup : selectAllInActiveGroup}
                  className="inline-flex shrink-0 items-center gap-1 rounded-xl border border-brand/30 bg-brand/5 px-3 py-2.5 text-xs font-bold text-brand transition hover:bg-brand/10 active:scale-95"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  {allActiveRolesSelected ? 'Deselect all' : 'Select all'}
                </button>
              </div>

              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-semibold text-slate-500">
                  {visibleRoles.length} services available
                </span>
                {activeGroupSelectedCount > 0 && (
                  <span className="text-xs font-bold text-brand">
                    {activeGroupSelectedCount} selected in this category
                  </span>
                )}
              </div>

              <ul className="space-y-2">
                {visibleRoles.length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">No services match your search.</p>
                ) : (
                  visibleRoles.map((c) => {
                    const id = categoryId(c)
                    return (
                      <li key={id}>
                        <SelectRow
                          label={c.name}
                          subtitle={c.subtitle || undefined}
                          selected={selected.has(id)}
                          onToggle={() => toggle(id)}
                        />
                      </li>
                    )
                  })
                )}
              </ul>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Sticky Bottom Actions */}
      <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200/80 bg-white/95 px-4 pt-3 shadow-[0_-12px_40px_-12px_rgba(15,23,42,0.12)] backdrop-blur-xl pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto w-full max-w-lg">
          {error ? <p className="mb-2 text-center text-xs font-semibold text-rose-700">{error}</p> : null}

          {step === 'areas' ? (
            <AppPrimaryButton
              type="button"
              disabled={saving || loading || !hasTradeSelected}
              className="w-full py-3.5 text-[15px]"
              onClick={() => void handleSave()}
            >
              {saving
                ? 'Saving…'
                : variant === 'auth'
                ? `Finish & Enter App (${tradeSelectedCount} selected)`
                : `Save & Continue (${tradeSelectedCount} selected)`}
              <Sparkles className="h-4 w-4" aria-hidden />
            </AppPrimaryButton>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={closeRoles}
                className="flex-1 rounded-2xl border border-slate-200/90 bg-white py-3.5 text-sm font-bold text-slate-800 shadow-xs transition hover:border-brand/30 hover:bg-slate-50 active:scale-[0.99]"
              >
                Done (Back to Categories)
              </button>

              <AppPrimaryButton
                type="button"
                disabled={saving || loading || !hasTradeSelected}
                className="flex-1 py-3.5 text-sm"
                onClick={() => void handleSave()}
              >
                {saving ? 'Saving…' : `Save (${tradeSelectedCount})`}
                <Sparkles className="h-4 w-4" aria-hidden />
              </AppPrimaryButton>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
