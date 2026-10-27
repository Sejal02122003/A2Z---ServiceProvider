import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { CalendarClock, ChevronRight, Sparkles, X, Zap } from 'lucide-react'
import {
  AppBottomSheetBackdrop,
  AppBottomSheetChrome,
  AppBottomSheetPanel,
} from '../../app-ui/feedback/AppBottomSheet.jsx'
import { appSpring } from '../appMotion.js'

import { useAuth } from '../../../hooks/useAuth.js'

const OPTIONS = [
  {
    id: 'instant',
    label: 'Instant booking',
    desc: 'ASAP — we match available labour near you',
    icon: Zap,
    tone: 'from-amber-500/15 to-orange-50',
  },
  {
    id: 'scheduled',
    label: 'Schedule booking',
    desc: 'Pick date & time slot that works for you',
    icon: CalendarClock,
    tone: 'from-sky-500/12 to-cyan-50',
  },
]

export function BookingTypeSheet({ open, onClose, value, onSelect, categoryLabel }) {
  const reduce = useReducedMotion()
  const { user } = useAuth()

  const sheet = (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="booking-type-sheet-modal"
          className="fixed inset-0 z-[210] flex items-end justify-center sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <AppBottomSheetBackdrop onClose={onClose} />
          <motion.div
            className="relative z-10 w-full max-w-md"
            initial={reduce ? false : { y: 40 }}
            animate={{ y: 0 }}
            exit={reduce ? undefined : { y: 28 }}
            transition={reduce ? { duration: 0.2 } : appSpring}
          >
            <AppBottomSheetPanel className="rounded-t-[1.75rem] sm:rounded-3xl">
              <AppBottomSheetChrome
                onClose={onClose}
                title={
                  <h2 className="text-base font-black text-slate-900">How would you like to book?</h2>
                }
                subtitle={
                  categoryLabel ? (
                    <p className="mt-0.5 text-xs font-medium text-brand">{categoryLabel}</p>
                  ) : (
                    <p className="mt-0.5 text-xs text-slate-500">Choose instant or scheduled</p>
                  )
                }
              />
              <motion.div layout className="space-y-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                {OPTIONS.filter(opt => {
                  if (opt.id === 'instant' && (user?.role === 'contractor' || user?.role === 'corporate')) {
                    return false;
                  }
                  return true;
                }).map((opt) => {
                  const Icon = opt.icon
                  const active = value === opt.id
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onSelect(opt.id)}
                      className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left transition active:scale-[0.99] ${
                        active
                          ? 'border-brand/40 bg-brand/8 ring-2 ring-brand/20'
                          : 'border-slate-200/90 bg-white hover:border-brand/25'
                      }`}
                    >
                      <span
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br ${opt.tone} text-brand ring-1 ring-slate-200/80`}
                      >
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900">{opt.label}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{opt.desc}</p>
                      </span>
                      <ChevronRight className="h-5 w-5 shrink-0 text-slate-300" aria-hidden />
                    </button>
                  )
                })}
                <p className="flex items-center justify-center gap-1.5 pt-2 text-center text-[11px] font-medium text-slate-500">
                  <Sparkles className="h-3.5 w-3.5 text-brand" aria-hidden />
                  Verified workers · clear pricing
                </p>
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
