import React, { useState } from 'react'
import { Package, Check, X, Clock, Calendar, Edit3 } from 'lucide-react'
import { KitStatusBadge, getKitStatusDerived } from './KitStatusBadge.jsx'
import { WelcomeKitModal } from './WelcomeKitModal.jsx'

export function WelcomeKitCard({ user, onUpdate }) {
  const [modalOpen, setModalOpen] = useState(false)
  const kit = user?.welcomeKit || {}
  const status = getKitStatusDerived(kit)

  return (
    <>
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <Package className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Welcome Kit & Uniform</h3>
              <p className="text-xs text-slate-500">Service partner gear collection</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
          >
            <Edit3 className="h-3 w-3 text-slate-500" />
            Manage Kit
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className={`p-3 rounded-xl border text-center ${kit.uniformIssued ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-100 bg-slate-50/50'}`}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Uniform</p>
            <span className={`inline-flex items-center gap-1 text-xs font-black ${kit.uniformIssued ? 'text-emerald-700' : 'text-slate-400'}`}>
              {kit.uniformIssued ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <X className="h-3.5 w-3.5" />}
              {kit.uniformIssued ? 'Issued' : 'Pending'}
            </span>
          </div>

          <div className={`p-3 rounded-xl border text-center ${kit.idCardIssued ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-100 bg-slate-50/50'}`}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">ID Card</p>
            <span className={`inline-flex items-center gap-1 text-xs font-black ${kit.idCardIssued ? 'text-emerald-700' : 'text-slate-400'}`}>
              {kit.idCardIssued ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <X className="h-3.5 w-3.5" />}
              {kit.idCardIssued ? 'Issued' : 'Pending'}
            </span>
          </div>

          <div className={`p-3 rounded-xl border text-center ${kit.bagIssued ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-100 bg-slate-50/50'}`}>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Bag</p>
            <span className={`inline-flex items-center gap-1 text-xs font-black ${kit.bagIssued ? 'text-emerald-700' : 'text-slate-400'}`}>
              {kit.bagIssued ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <X className="h-3.5 w-3.5" />}
              {kit.bagIssued ? 'Issued' : 'Pending'}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-500">Kit Status:</span>
            <KitStatusBadge welcomeKit={kit} />
          </div>
          {status === 'COMPLETE' && kit.issuedAt && (
            <div className="flex items-center gap-1 text-slate-500 font-medium">
              <Calendar className="h-3.5 w-3.5 text-slate-400" />
              <span>{new Date(kit.issuedAt).toLocaleDateString()}</span>
            </div>
          )}
        </div>
      </div>

      {modalOpen && (
        <WelcomeKitModal
          user={user}
          onClose={() => setModalOpen(false)}
          onSuccess={(newKitData) => {
            if (onUpdate) onUpdate(newKitData)
          }}
        />
      )}
    </>
  )
}
