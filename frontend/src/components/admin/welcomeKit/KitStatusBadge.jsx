import React from 'react'
import { Check, X, ShieldAlert, CheckCircle2, Clock } from 'lucide-react'

export function getKitStatusDerived(welcomeKit) {
  if (!welcomeKit) return 'NOT_ISSUED'
  const u = Boolean(welcomeKit.uniformIssued)
  const i = Boolean(welcomeKit.idCardIssued)
  const b = Boolean(welcomeKit.bagIssued)

  if (u && i && b) return 'COMPLETE'
  if (u || i || b) return 'PARTIAL'
  return 'NOT_ISSUED'
}

export function KitStatusBadge({ welcomeKit, showItems = false }) {
  const status = getKitStatusDerived(welcomeKit)
  const u = Boolean(welcomeKit?.uniformIssued)
  const i = Boolean(welcomeKit?.idCardIssued)
  const b = Boolean(welcomeKit?.bagIssued)

  return (
    <div className="inline-flex flex-col gap-1">
      {status === 'COMPLETE' && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-emerald-800 ring-1 ring-emerald-200/80">
          <CheckCircle2 className="h-3 w-3 text-emerald-600" />
          Complete
        </span>
      )}
      {status === 'PARTIAL' && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-amber-900 ring-1 ring-amber-200/80">
          <Clock className="h-3 w-3 text-amber-600" />
          Partially Issued
        </span>
      )}
      {status === 'NOT_ISSUED' && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-600 ring-1 ring-slate-200/80">
          <X className="h-3 w-3 text-slate-400" />
          Not Issued
        </span>
      )}

      {showItems && (
        <div className="flex items-center gap-2 text-[10px] font-medium text-slate-500">
          <span className={`flex items-center gap-0.5 ${u ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
            Uniform {u ? '✓' : '✗'}
          </span>
          <span>•</span>
          <span className={`flex items-center gap-0.5 ${i ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
            ID Card {i ? '✓' : '✗'}
          </span>
          <span>•</span>
          <span className={`flex items-center gap-0.5 ${b ? 'text-emerald-700 font-bold' : 'text-slate-400'}`}>
            Bag {b ? '✓' : '✗'}
          </span>
        </div>
      )}
    </div>
  )
}
