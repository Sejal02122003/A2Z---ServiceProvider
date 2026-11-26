import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Briefcase, ChevronRight, HardHat, Hammer, LayoutGrid, Loader2, PaintRoller, Sparkles, Wrench } from 'lucide-react'
import {
  AppBottomSheetBackdrop,
  AppBottomSheetChrome,
  AppBottomSheetPanel,
} from '../../app-ui/feedback/AppBottomSheet.jsx'
import { appSpring } from '../appMotion.js'
import { getCategoryImageUrl, onCategoryImgError } from '../../../lib/labourCategoryDisplay.js'
import { buildBookingFlowPath } from '../../../lib/bookingFlowNavigation.js'
import { readBookingDraft, writeBookingDraft } from '../../../lib/individualBookingDraft.js'

const GROUP_ICONS = [HardHat, Wrench, PaintRoller, Hammer, Sparkles]

/**
 * Lightweight category picker — main group + subcategory only (no location).
 */
export function CategoryPickBottomSheet({ open, onClose, tradeGroups, groupsLoading }) {
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const [groupId, setGroupId] = useState(null)
  const [categoryId, setCategoryId] = useState(null)

  const selectedGroup = useMemo(() => {
    if (!groupId) return null
    return tradeGroups.find((g) => String(g._id) === groupId) ?? null
  }, [tradeGroups, groupId])

  useEffect(() => {
    if (!open) return
    const draft = readBookingDraft()
    queueMicrotask(() => {
      setGroupId(draft?.groupId ? String(draft.groupId) : null)
      setCategoryId(draft?.categoryId ? String(draft.categoryId) : null)
    })
  }, [open])

  const pickGroup = (gid) => {
    const next = gid == null ? null : String(gid)
    setGroupId(next)
    setCategoryId(null)
  }

  const pickCategory = (cat) => {
    const cid = String(cat._id)
    const active = categoryId === cid
    setCategoryId(active ? null : cid)
    if (!active) {
      setGroupId(String(cat.groupId || groupId || ''))
    }
  }

  const continueToBooking = useCallback(() => {
    if (!categoryId || !selectedGroup) return
    const cat = (selectedGroup.categories || []).find((c) => String(c._id) === categoryId)
    const prev = readBookingDraft() || {}
    writeBookingDraft({
      ...prev,
      entryPoint: 'search',
      groupId: String(selectedGroup._id),
      groupName: selectedGroup.name,
      categoryId,
      categoryName: cat?.name || '',
      matchMode: 'smart',
      selectedWorkers: [],
    })
    navigate(
      buildBookingFlowPath('type', {
        categoryId,
        groupId: String(selectedGroup._id),
      }),
    )
    onClose()
  }, [categoryId, navigate, onClose, selectedGroup])

  const sheet = (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="category-pick"
          className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="presentation"
        >
          <AppBottomSheetBackdrop onClose={onClose} />
          <motion.div
            className="relative z-10 flex max-h-[min(88dvh,720px)] w-full max-w-md flex-col"
            initial={reduce ? false : { y: 48 }}
            animate={{ y: 0 }}
            exit={reduce ? undefined : { y: 32 }}
            transition={reduce ? { duration: 0.2 } : appSpring}
          >
            <AppBottomSheetPanel className="flex max-h-[min(88dvh,720px)] flex-col rounded-t-[1.75rem] sm:rounded-3xl">
              <AppBottomSheetChrome
                onClose={onClose}
                title={
                  <h2 id="category-pick-title" className="text-base font-black tracking-tight text-slate-900">
                    What work do you need?
                  </h2>
                }
                subtitle={
                  <p className="mt-0.5 text-xs font-medium text-slate-500">Pick a trade — then continue to book</p>
                }
              />
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Main category</p>
                <motion.div
                  className="-mx-1 mt-2 flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 scrollbar-none"
                  layout
                >
                  <button
                    type="button"
                    onClick={() => pickGroup(null)}
                    className={`flex min-w-[4.75rem] shrink-0 snap-start flex-col items-center gap-2 rounded-2xl border px-2.5 pb-2.5 pt-2.5 transition active:scale-[0.98] ${
                      groupId == null
                        ? 'border-brand/40 bg-brand/10 ring-2 ring-brand/20'
                        : 'border-slate-200/90 bg-slate-50'
                    }`}
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-inner ring-1 ring-slate-200/80">
                      <LayoutGrid className="h-5 w-5 text-brand" aria-hidden />
                    </span>
                    <span className="text-center text-[10px] font-bold text-slate-800">All</span>
                  </button>
                  {tradeGroups.map((g, idx) => {
                    const gid = String(g._id)
                    const active = groupId === gid
                    const Icon = GROUP_ICONS[idx % GROUP_ICONS.length]
                    return (
                      <button
                        key={gid}
                        type="button"
                        onClick={() => pickGroup(gid)}
                        className={`flex min-w-[4.75rem] shrink-0 snap-start flex-col items-center gap-2 rounded-2xl border px-2.5 pb-2.5 pt-2.5 transition active:scale-[0.98] ${
                          active
                            ? 'border-brand/40 bg-brand/10 ring-2 ring-brand/20'
                            : 'border-slate-200/90 bg-slate-50'
                        }`}
                      >
                        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white shadow-inner ring-1 ring-slate-200/80">
                          <Icon className="h-5 w-5 text-brand" aria-hidden />
                        </span>
                        <span className="max-w-[4.75rem] text-center text-[10px] font-bold leading-tight text-slate-800 line-clamp-2">
                          {g.name}
                        </span>
                      </button>
                    )
                  })}
                </motion.div>

                {groupsLoading ? (
                  <motion.div layout className="mt-6 flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-brand" aria-hidden />
                  </motion.div>
                ) : null}

                <AnimatePresence initial={false}>
                  {selectedGroup && (selectedGroup.categories?.length ?? 0) > 0 ? (
                    <motion.section
                      key={String(selectedGroup._id)}
                      initial={reduce ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduce ? undefined : { opacity: 0 }}
                      className="mt-6"
                    >
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Sub category · {selectedGroup.name}
                      </p>
                      <div className="mt-2.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {(selectedGroup.categories || []).map((c) => {
                          const cid = String(c._id)
                          const active = categoryId === cid
                          const img = getCategoryImageUrl(c)
                          return (
                            <button
                              key={cid}
                              type="button"
                              onClick={() => pickCategory({ ...c, groupId: selectedGroup._id })}
                              className={`overflow-hidden rounded-2xl border text-left transition active:scale-[0.98] ${
                                active ? 'border-brand ring-2 ring-brand/25 shadow-md' : 'border-slate-200/90'
                              }`}
                            >
                              <motion.div className="relative aspect-[4/3] bg-slate-100">
                                <img src={img} alt="" className="h-full w-full object-cover" loading="lazy" onError={onCategoryImgError} />
                                <span className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-lg bg-white/90 text-brand shadow-sm">
                                  <Briefcase className="h-3.5 w-3.5" aria-hidden />
                                </span>
                              </motion.div>
                              <div className="bg-white px-2 py-2">
                                <p className="line-clamp-2 text-[11px] font-bold leading-snug text-slate-900">{c.name}</p>
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </motion.section>
                  ) : null}
                </AnimatePresence>
              </div>

              <motion.div
                layout
                className="shrink-0 border-t border-slate-100 bg-white px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3"
              >
                <button
                  type="button"
                  disabled={!categoryId}
                  onClick={continueToBooking}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-linear-to-r from-brand to-blue-800 py-3.5 text-sm font-black text-white shadow-lg shadow-brand/25 transition enabled:hover:brightness-[1.03] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  Continue to book
                  <ChevronRight className="h-4 w-4" aria-hidden />
                </button>
              </motion.div>
            </AppBottomSheetPanel>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )

  if (typeof document === 'undefined') return null
  return createPortal(sheet, document.body)
}
