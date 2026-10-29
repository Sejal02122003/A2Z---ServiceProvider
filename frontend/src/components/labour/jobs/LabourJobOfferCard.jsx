import { Link } from 'react-router-dom'
import { Building2, CheckCircle2, ChevronRight, Clock, FileText, Phone, User, X } from 'lucide-react'
import { AppBadge } from '../../app-ui/data-display/AppBadge.jsx'
import { AppButton } from '../../app-ui/buttons/AppButton.jsx'
import { AppPrimaryButton } from '../../app/AppPrimaryButton.jsx'
import { sourceTypeLabel } from '../../../lib/workforceLabels.js'

function UrgencyStripe({ urgency }) {
  if (urgency !== 'high') return null
  return (
    <div
      className="absolute inset-y-0 left-0 w-1 rounded-l-[inherit] bg-linear-to-b from-amber-400 to-orange-500"
      aria-hidden
    />
  )
}

export function LabourJobOfferCard({
  offer,
  kycOk,
  confirming,
  onDecline,
  onStartAccept,
  onConfirmAccept,
  onCancelConfirm,
  onOpenDetail,
}) {
  return (
    <article className="relative overflow-hidden rounded-[1.35rem] border border-slate-200/90 bg-white shadow-[0_8px_30px_-18px_rgba(15,23,42,0.12)] ring-1 ring-slate-100/80">
      <UrgencyStripe urgency={offer.urgency} />
      <div className="relative p-4 sm:p-[1.15rem]">
        <div className="flex items-start justify-between gap-3 pl-1">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {offer.urgency === 'high' ? (
                <AppBadge variant="amber">Priority</AppBadge>
              ) : (
                <AppBadge variant="neutral">New</AppBadge>
              )}
              {offer.sourceType ? (
                <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold text-slate-600">
                  {sourceTypeLabel(offer.sourceType)}
                </span>
              ) : null}
            </div>
            <h3 className="mt-2 line-clamp-2 text-[15px] font-extrabold leading-snug text-slate-900">{offer.title}</h3>
            {offer.requestRef ? (
              <p className="mt-1 font-mono text-[10px] font-bold text-brand/90">{offer.requestRef}</p>
            ) : null}
          </div>
          <div className="shrink-0 rounded-2xl bg-linear-to-br from-brand/15 to-brand/5 px-3 py-2 text-center ring-1 ring-brand/20">
            <p className="text-[9px] font-bold uppercase tracking-wide text-brand/80">Rate</p>
            <p className="text-sm font-black text-brand">{offer.rateLabel}</p>
          </div>
        </div>

        <ul className="mt-3 space-y-2 pl-1 text-sm">
          <li className="flex items-start gap-2 text-slate-700">
            <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
            <span className="font-medium leading-snug">{offer.site}</span>
          </li>
          <li className="flex items-center gap-2 text-slate-600">
            <Clock className="h-4 w-4 shrink-0 text-brand" aria-hidden />
            <span className="text-xs font-semibold">{offer.shiftWindow}</span>
          </li>
        </ul>

        <p className="mt-2 pl-1 text-[11px] font-medium text-slate-500">
          <span className="font-bold text-slate-700">{offer.trade}</span>
          <span className="mx-1 text-slate-300">·</span>
          {offer.headcount}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 px-3 py-2.5 ring-1 ring-slate-100">
          <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <User className="h-3.5 w-3.5 text-slate-400" aria-hidden />
            {offer.supervisor}
          </span>
          <a
            href={`tel:+91${offer.supervisorPhone}`}
            className="ml-auto flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-xs font-bold text-brand ring-1 ring-slate-200/80"
          >
            <Phone className="h-3 w-3" aria-hidden />
            Call
          </a>
        </div>

        <button
          type="button"
          onClick={() => onOpenDetail(offer)}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-slate-200 py-2 text-xs font-bold text-slate-600 transition hover:border-brand/35 hover:bg-brand/5 hover:text-brand"
        >
          <FileText className="h-3.5 w-3.5" aria-hidden />
          Site brief & timeline
          <ChevronRight className="h-3.5 w-3.5" aria-hidden />
        </button>

        {!kycOk ? (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[11px] font-semibold text-amber-950 ring-1 ring-amber-200/70">
            <Link to="/serviceprovider/kyc" className="font-bold text-brand underline underline-offset-2">
              Verify Aadhaar
            </Link>{' '}
            to accept this assignment.
          </p>
        ) : null}

        {confirming ? (
          <div className="mt-4 rounded-2xl border border-brand/30 bg-brand/5 p-4 ring-1 ring-brand/15">
            <p className="text-sm font-extrabold text-slate-900">Confirm this shift?</p>
            <p className="mt-1 text-xs text-slate-600">You agree to report on time with required PPE.</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <AppButton type="button" variant="secondary" onClick={onCancelConfirm}>
                <X className="h-4 w-4" aria-hidden />
                Cancel
              </AppButton>
              <AppPrimaryButton type="button" className="py-2.5 text-xs" onClick={() => onConfirmAccept(offer)}>
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                Accept
              </AppPrimaryButton>
            </div>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-2">
            <AppButton type="button" variant="secondary" className="py-2.5 text-xs" onClick={() => onDecline(offer.id)}>
              Decline
            </AppButton>
            <AppPrimaryButton
              type="button"
              className={`py-2.5 text-xs ${!kycOk ? 'opacity-50' : ''}`}
              onClick={() => onStartAccept(offer.id)}
            >
              Accept job
              <ChevronRight className="h-4 w-4" aria-hidden />
            </AppPrimaryButton>
          </div>
        )}
      </div>
    </article>
  )
}
