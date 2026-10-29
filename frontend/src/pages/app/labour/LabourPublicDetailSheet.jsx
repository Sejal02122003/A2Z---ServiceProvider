import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, CheckCircle2, Loader2, X } from 'lucide-react'
import { AppBadge } from '../../../components/app-ui/data-display/AppBadge.jsx'
import { AppButton } from '../../../components/app-ui/buttons/AppButton.jsx'
import { AppBottomSheetBackdrop, AppBottomSheetPanel } from '../../../components/app-ui/feedback/AppBottomSheet.jsx'
import { enrichDiscoverLabourUi } from '../../../lib/discoverLabourDummyUi.js'
import { patchBookingDraft } from '../../../lib/individualBookingDraft.js'
import { initialsFromName } from '../../../lib/initialsFromName.js'
import { buildBookingFlowPath } from '../../../lib/bookingFlowNavigation.js'

export function LabourPublicDetailSheet({ labour, loading, onClose }) {
  const navigate = useNavigate()
  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-end justify-center p-4 sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <AppBottomSheetBackdrop onClose={onClose} />
      <AppBottomSheetPanel titleId="labour-sheet-title">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
          <h2 id="labour-sheet-title" className="text-base font-bold text-slate-900">
            Service Provider profile
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="max-h-[min(72vh,520px)] overflow-y-auto px-4 py-4 sm:px-5 sm:py-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-slate-500">
              <Loader2 className="h-8 w-8 animate-spin text-brand" aria-hidden />
              <p className="text-sm font-medium">Loading…</p>
            </div>
          ) : labour ? (
            <div className="space-y-5">
              <div className="flex items-start gap-3">
                <div
                  className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-linear-to-br from-brand-bright/35 via-white to-brand-muted text-lg font-black text-brand shadow-md ring-2 ring-white"
                  aria-hidden
                >
                  {initialsFromName(labour.displayName)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-extrabold text-slate-900">{labour.displayName}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {labour.kycVerified ? (
                      <AppBadge variant="emerald" uppercase={false} className="inline-flex items-center gap-1">
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                        KYC verified
                      </AppBadge>
                    ) : (
                      <AppBadge variant="neutral" uppercase={false}>
                        KYC pending
                      </AppBadge>
                    )}
                    {labour.memberSinceYear ? (
                      <span className="text-[11px] font-medium text-slate-400">Member since {labour.memberSinceYear}</span>
                    ) : null}
                  </div>
                </div>
              </div>

              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Roles offered</p>
                <ul className="mt-2 space-y-2">
                  {labour.tradeCategories.map((c) => (
                    <li
                      key={c._id}
                      className="rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 ring-1 ring-slate-100"
                    >
                      <p className="text-sm font-semibold text-slate-900">{c.name}</p>
                      <p className="text-[11px] text-slate-500">{c.groupName}</p>
                      {c.subtitle ? <p className="mt-0.5 text-xs text-slate-600">{c.subtitle}</p> : null}
                    </li>
                  ))}
                </ul>
              </div>

              <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600 ring-1 ring-slate-100">
                Phone and exact address are shared only after you confirm a booking with our team.
              </p>

              <div className="flex flex-col gap-2 sm:flex-row">
                <AppButton
                  type="button"
                  variant="primary"
                  className="sm:flex-1"
                  onClick={() => {
                    const cats = labour.tradeCategories || []
                    const first = cats[0]
                    const ui = labour._ui ?? enrichDiscoverLabourUi(labour)
                    patchBookingDraft({
                      matchMode: 'manual',
                      selectedWorkers: [
                        {
                          id: labour.id,
                          displayName: labour.displayName,
                          photoUrl: ui.photoUrl,
                        },
                      ],
                      categoryId: first?._id ? String(first._id) : '',
                      categoryName: first?.name || '',
                      groupName: first?.groupName || '',
                    })
                    onClose()
                    navigate(buildBookingFlowPath('type'))
                  }}
                >
                  Book this service provider
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </AppButton>
                <AppButton type="button" onClick={onClose} variant="secondary" className="sm:flex-1">
                  Close
                </AppButton>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-6 text-center">
              <p className="text-sm font-medium text-slate-600">This profile could not be loaded.</p>
              <AppButton type="button" onClick={onClose} variant="secondary" className="max-w-xs" fullWidth={false}>
                Close
              </AppButton>
            </div>
          )}
        </div>
      </AppBottomSheetPanel>
    </motion.div>
  )
}
