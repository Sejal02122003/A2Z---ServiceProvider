import { useState } from 'react'
import {
  Package,
  Check,
  X,
  Calendar,
  Edit3,
  CreditCard,
  CheckCircle2,
  XCircle,
  Eye,
  Clock,
} from 'lucide-react'
import { KitStatusBadge, getKitStatusDerived } from './KitStatusBadge.jsx'
import { WelcomeKitModal } from './WelcomeKitModal.jsx'

export function WelcomeKitCard({ user, onUpdate }) {
  const [modalOpen, setModalOpen] = useState(false)
  const kit = user?.welcomeKit || {}
  const status = getKitStatusDerived(kit)
  const paymentStatus = kit.status || 'PENDING_PAYMENT'
  const isApproved = paymentStatus === 'PAID' || paymentStatus === 'DELIVERED' || paymentStatus === 'DISPATCHED'
  const receiptUrl = kit.paymentReceiptUrl

  return (
    <>
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <Package className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Welcome Kit & Payment Slip</h3>
              <p className="text-xs text-slate-500">Service partner gear and payment slip verification</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition shadow-2xs"
          >
            <Edit3 className="h-3 w-3 text-slate-500" />
            Manage & Review
          </button>
        </div>

        {/* Payment Verification Banner */}
        <div
          className={`mb-4 rounded-xl border p-3 flex items-center justify-between gap-3 ${
            isApproved
              ? 'border-emerald-200 bg-emerald-50/60'
              : paymentStatus === 'PAYMENT_SUBMITTED'
              ? 'border-amber-200 bg-amber-50/70 ring-1 ring-amber-200/80'
              : paymentStatus === 'PAYMENT_REJECTED'
              ? 'border-rose-200 bg-rose-50/70'
              : 'border-slate-100 bg-slate-50'
          }`}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {receiptUrl ? (
              <div
                onClick={() => setModalOpen(true)}
                className="relative h-11 w-11 shrink-0 cursor-pointer overflow-hidden rounded-lg border-2 border-brand/40 bg-white shadow-2xs group"
                title="Click to view full payment slip"
              >
                <img src={receiptUrl} alt="Payment slip" className="h-full w-full object-cover group-hover:scale-105 transition" />
                <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition">
                  <Eye className="h-4 w-4" />
                </div>
              </div>
            ) : (
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-400">
                <CreditCard className="h-5 w-5" />
              </div>
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Fee: ₹{kit.paymentAmount || 999}
                </span>
                <span>•</span>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {kit.paymentMethod === 'ONLINE' ? 'Online' : 'Offline / Hub Slip'}
                </span>
              </div>
              <div className="text-xs font-black truncate text-slate-800">
                {isApproved && (
                  <span className="text-emerald-700 flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Payment Approved & Verified
                  </span>
                )}
                {paymentStatus === 'PAYMENT_SUBMITTED' && (
                  <span className="text-amber-800 flex items-center gap-1 animate-pulse">
                    <Clock className="h-3.5 w-3.5 text-amber-600" />
                    Payment Slip Uploaded (Pending Review)
                  </span>
                )}
                {paymentStatus === 'PAYMENT_REJECTED' && (
                  <span className="text-rose-700 flex items-center gap-1">
                    <XCircle className="h-3.5 w-3.5" />
                    Payment Slip Rejected
                  </span>
                )}
                {!isApproved && paymentStatus !== 'PAYMENT_SUBMITTED' && paymentStatus !== 'PAYMENT_REJECTED' && (
                  <span className="text-slate-500">Not Paid Yet</span>
                )}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-bold transition shadow-2xs ${
              paymentStatus === 'PAYMENT_SUBMITTED'
                ? 'bg-amber-600 text-white hover:bg-amber-700 ring-2 ring-amber-300'
                : receiptUrl
                ? 'border border-brand/30 bg-brand/10 text-brand hover:bg-brand/15'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {paymentStatus === 'PAYMENT_SUBMITTED' ? 'Review Slip' : receiptUrl ? 'View Slip' : 'Details'}
          </button>
        </div>

        {/* 3 Checklist Items */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          <div
            className={`p-3 rounded-xl border text-center ${
              kit.uniformIssued ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-100 bg-slate-50/50'
            }`}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Uniform</p>
            <span
              className={`inline-flex items-center gap-1 text-xs font-black ${
                kit.uniformIssued ? 'text-emerald-700' : 'text-slate-400'
              }`}
            >
              {kit.uniformIssued ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <X className="h-3.5 w-3.5" />}
              {kit.uniformIssued ? 'Issued' : 'Pending'}
            </span>
          </div>

          <div
            className={`p-3 rounded-xl border text-center ${
              kit.idCardIssued ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-100 bg-slate-50/50'
            }`}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">ID Card</p>
            <span
              className={`inline-flex items-center gap-1 text-xs font-black ${
                kit.idCardIssued ? 'text-emerald-700' : 'text-slate-400'
              }`}
            >
              {kit.idCardIssued ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <X className="h-3.5 w-3.5" />}
              {kit.idCardIssued ? 'Issued' : 'Pending'}
            </span>
          </div>

          <div
            className={`p-3 rounded-xl border text-center ${
              kit.bagIssued ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-100 bg-slate-50/50'
            }`}
          >
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Bag</p>
            <span
              className={`inline-flex items-center gap-1 text-xs font-black ${
                kit.bagIssued ? 'text-emerald-700' : 'text-slate-400'
              }`}
            >
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
