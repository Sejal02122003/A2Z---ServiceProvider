import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronRight, Sparkles, UserRound, Users } from 'lucide-react'
import {
  AppBottomSheetBackdrop,
  AppBottomSheetChrome,
  AppBottomSheetPanel,
} from '../../app-ui/feedback/AppBottomSheet.jsx'
import { appSpring } from '../appMotion.js'

const OPTIONS = [
  {
    id: 'manual',
    label: 'Select service provider manually',
    desc: 'Pick one or more service providers you like from the list',
    icon: UserRound,
  },
  {
    id: 'smart',
    label: 'Best service provider for you',
    desc: 'Smart match based on rating, distance & availability',
    icon: Sparkles,
  },
]

export function BookingModeSheet({ open, onClose, value, onSelect, categoryLabel }) {
  const reduce = useReducedMotion()

  const sheet = (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="booking-mode-sheet-modal"
          className="fixed inset-0 z-[205] flex items-end justify-center sm:items-center sm:p-4"
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
                title={<h2 className="text-base font-black text-slate-900">How would you like to book?</h2>}
                subtitle={
                  <p className="mt-0.5 text-xs text-slate-500">
                    {categoryLabel ? `${categoryLabel} · ` : ''}
                    Choose manual or smart match
                  </p>
                }
              />
              <motion.div layout className="space-y-2 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
                {OPTIONS.map((opt) => {
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
                          : 'border-slate-200/90 hover:border-brand/25'
                      }`}
                    >
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand/10 text-brand ring-1 ring-brand/20">
                        <Icon className="h-5 w-5" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-slate-900">{opt.label}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{opt.desc}</p>
                      </span>
                      <ChevronRight className="h-5 w-5 text-slate-300" aria-hidden />
                    </button>
                  )
                })}
                <p className="flex items-center justify-center gap-1.5 pt-1 text-[11px] text-slate-500">
                  <Users className="h-3.5 w-3.5" aria-hidden />
                  Multiple service providers supported
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
