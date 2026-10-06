import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronRight, Loader2, Search, X } from 'lucide-react'
import {
  flattenTradeSubcategories,
  getCategoryImageUrl,
  getGroupImageUrl,
} from '../../../lib/labourCategoryDisplay.js'
import { buildBookingFlowPath } from '../../../lib/bookingFlowNavigation.js'
import { readBookingDraft, writeBookingDraft } from '../../../lib/individualBookingDraft.js'
import allCategoryImg from '../../../assets/all-category.jpg'

const ALL_TILE_IMAGE = allCategoryImg

const BTN_CONTINUE =
  'flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3.5 text-sm font-bold text-white transition active:opacity-90 disabled:cursor-not-allowed disabled:opacity-45'

function SwiggyGroupTile({ label, imageSrc, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="lc-swiggy-cat-tile shrink-0 snap-start"
      data-active={active ? 'true' : 'false'}
    >
      <span className="lc-swiggy-cat-img">
        <img
          src={imageSrc}
          alt=""
          className="lc-img-reveal h-full w-full object-cover"
          loading="lazy"
          decoding="async"
          onLoad={(e) => e.currentTarget.classList.add('lc-img-loaded')}
        />
      </span>
      <span className="lc-swiggy-cat-label">{label}</span>
    </button>
  )
}

function SkillCard({ category, active, showGroupName, onClick }) {
  const img = getCategoryImageUrl(category)
  const hasOffers = (category.services || []).some(s => (s.discountValue || 0) > 0)
  const maxDiscount = Math.max(0, ...(category.services || []).map(s => Number(s.discountValue || 0)))

  return (
    <button
      type="button"
      onClick={onClick}
      className="lc-search-skill-card relative group"
      data-active={active ? 'true' : 'false'}
    >
      <div className="relative aspect-[4/3] bg-slate-100 overflow-hidden">
        <img src={img} alt="" className="h-full w-full object-cover transition duration-300 group-hover:scale-105" loading="lazy" decoding="async" />
        {hasOffers && maxDiscount > 0 && (
          <div className="absolute top-1 left-1">
            <span className="rounded-full bg-rose-600 px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider text-white shadow-sm">
              Up to {maxDiscount}% OFF
            </span>
          </div>
        )}
      </div>
      <div className="px-2.5 py-2">
        <p className="line-clamp-2 text-xs font-bold leading-snug text-slate-900 group-hover:text-brand transition">{category.name}</p>
        {showGroupName && category.groupName ? (
          <p className="mt-0.5 line-clamp-1 text-[10px] font-medium text-slate-500">{category.groupName}</p>
        ) : null}
      </div>
    </button>
  )
}

/**
 * Full Search tab — pick trade + skill, then continue to booking flow.
 */
export function IndividualCategorySearchPanel({ tradeGroups, groupsLoading }) {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const searchRef = useRef(null)

  const [query, setQuery] = useState('')
  const [groupId, setGroupId] = useState(searchParams.get('groupId') || null)
  const [categoryId, setCategoryId] = useState(null)

  const allCategories = useMemo(() => flattenTradeSubcategories(tradeGroups), [tradeGroups])

  const selectedGroup = useMemo(() => {
    if (!groupId) return null
    return tradeGroups.find((g) => String(g._id) === groupId) ?? null
  }, [tradeGroups, groupId])

  const selectedCategory = useMemo(() => {
    if (!categoryId) return null
    return allCategories.find((c) => String(c._id) === categoryId) ?? null
  }, [allCategories, categoryId])

  const isSearching = query.trim().length > 0

  const filteredCategories = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return allCategories
    return allCategories.filter(
      (c) =>
        String(c.name || '').toLowerCase().includes(q) ||
        String(c.subtitle || '').toLowerCase().includes(q) ||
        String(c.groupName || '').toLowerCase().includes(q),
    )
  }, [allCategories, query])

  useEffect(() => {
    const draft = readBookingDraft()
    queueMicrotask(() => {
      const urlGroupId = searchParams.get('groupId')
      if (urlGroupId) {
        setGroupId(urlGroupId)
      } else if (draft?.groupId) {
        setGroupId(String(draft.groupId))
      }
      if (draft?.categoryId && !urlGroupId) setCategoryId(String(draft.categoryId))
    })
  }, [searchParams])

  useEffect(() => {
    const t = window.setTimeout(() => searchRef.current?.focus(), 200)
    return () => window.clearTimeout(t)
  }, [])

  const pickGroup = (gid) => {
    setGroupId(gid == null ? null : String(gid))
    setCategoryId(null)
    if (!gid) setQuery('')
  }

  const resolveGroupForCategory = useCallback(
    (cat) => {
      if (!cat) return null
      return tradeGroups.find((g) => String(g._id) === String(cat.groupId)) ?? null
    },
    [tradeGroups],
  )

  const pickCategory = (cat) => {
    navigate(`/app/sub-category/${cat._id}`, { state: { cat } })
  }

  const continueToBooking = useCallback(() => {
    const cat = selectedCategory
    if (!cat) return
    const group = resolveGroupForCategory(cat)
    if (!group) return

    const prev = readBookingDraft() || {}
    writeBookingDraft({
      ...prev,
      entryPoint: 'search',
      groupId: String(group._id),
      groupName: group.name,
      categoryId: String(cat._id),
      categoryName: cat.name || '',
      matchMode: 'smart',
      selectedWorkers: [],
    })

    navigate(
      buildBookingFlowPath('type', {
        categoryId: String(cat._id),
        groupId: String(group._id),
      }),
    )
  }, [navigate, resolveGroupForCategory, selectedCategory])

  const renderCategoryGrid = (items, showGroupName) => (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {items.map((c) => (
        <SkillCard
          key={`${c.groupId}-${c._id}`}
          category={c}
          active={categoryId === String(c._id)}
          showGroupName={showGroupName}
          onClick={() => pickCategory(c)}
        />
      ))}
    </div>
  )

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-4 pb-2 shrink-0">
        <label className="lc-search-field" htmlFor="lc-search-input">
          <Search className="h-5 w-5 shrink-0 text-brand" aria-hidden />
          <input
            ref={searchRef}
            id="lc-search-input"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Plumber, electrician, mason…"
            autoComplete="off"
            enterKeyHint="search"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200/80 text-slate-600"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </label>
      </div>

      <div className="mt-3 flex-1 overflow-y-auto px-4 pb-36">
        {groupsLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-7 w-7 animate-spin text-brand" aria-hidden />
          </div>
        ) : null}

        {!groupsLoading && !isSearching ? (
          <>
            <p className="mb-2 text-sm font-bold text-slate-900">Main categories</p>
            <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1 scrollbar-none [&::-webkit-scrollbar]:hidden">
              <SwiggyGroupTile
                label="All"
                imageSrc={ALL_TILE_IMAGE}
                active={groupId == null}
                onClick={() => pickGroup(null)}
              />
              {tradeGroups.map((g) => (
                <SwiggyGroupTile
                  key={String(g._id)}
                  label={g.name}
                  imageSrc={getGroupImageUrl(g)}
                  active={groupId === String(g._id)}
                  onClick={() => pickGroup(String(g._id))}
                />
              ))}
            </div>
          </>
        ) : null}

        {!groupsLoading && isSearching ? (
          <p className="text-sm font-semibold text-slate-600">
            {filteredCategories.length} result{filteredCategories.length === 1 ? '' : 's'}
          </p>
        ) : null}

        {!groupsLoading && isSearching && filteredCategories.length > 0 ? (
          <section className="mt-4">
            {renderCategoryGrid(filteredCategories, true)}
          </section>
        ) : null}

        {!groupsLoading && isSearching && filteredCategories.length === 0 ? (
          <p className="mt-12 text-center text-sm text-slate-500">No skills match your search.</p>
        ) : null}

        {!groupsLoading && !isSearching && selectedGroup ? (
          <section className="mt-6">
            <p className="mb-2 text-sm font-bold text-slate-900">{selectedGroup.name}</p>
            {renderCategoryGrid(
              (selectedGroup.categories || []).map((c) => ({
                ...c,
                groupId: selectedGroup._id,
                groupName: selectedGroup.name,
              })),
              false,
            )}
          </section>
        ) : null}

        {!groupsLoading && !isSearching && !groupId ? (
          <div className="mt-6 space-y-5">
            {tradeGroups.map((g) => {
              const cats = (g.categories || []).map((c) => ({
                ...c,
                groupId: g._id,
                groupName: g.name,
              }))
              if (!cats.length) return null
              return (
                <section key={String(g._id)}>
                  <p className="mb-2 text-sm font-bold text-slate-900">{g.name}</p>
                  {renderCategoryGrid(cats, false)}
                </section>
              )
            })}
            {allCategories.length === 0 ? (
              <p className="text-center text-sm text-slate-500">No skills available yet.</p>
            ) : null}
          </div>
        ) : null}

        {!groupsLoading && !isSearching && groupId && selectedGroup && !(selectedGroup.categories?.length) ? (
          <p className="mt-12 text-center text-sm text-slate-500">No skills in this area yet.</p>
        ) : null}
      </div>
      {/* Continue button removed because we navigate directly now */}
    </div>
  )
}
