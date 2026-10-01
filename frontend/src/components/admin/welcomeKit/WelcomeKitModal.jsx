import React, { useState } from 'react'
import { X, Package, Check, Loader2, Calendar, ShieldCheck, AlertCircle } from 'lucide-react'
import { updatePartnerWelcomeKit } from '../../../api/servicePartnerApi.js'
import { KitStatusBadge, getKitStatusDerived } from './KitStatusBadge.jsx'

export function WelcomeKitModal({ user, onClose, onSuccess }) {
  const [uniformIssued, setUniformIssued] = useState(Boolean(user?.welcomeKit?.uniformIssued))
  const [idCardIssued, setIdCardIssued] = useState(Boolean(user?.welcomeKit?.idCardIssued))
  const [bagIssued, setBagIssued] = useState(Boolean(user?.welcomeKit?.bagIssued))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  if (!user) return null

  const tempKit = { uniformIssued, idCardIssued, bagIssued }
  const derivedStatus = getKitStatusDerived(tempKit)
  const existingIssuedAt = user?.welcomeKit?.issuedAt

  async function handleSave() {
    setError(null)
    setSuccessMsg(null)
    setBusy(true)
    try {
      const res = await updatePartnerWelcomeKit(user._id, {
        uniformIssued,
        idCardIssued,
        bagIssued,
      })
      setSuccessMsg('Welcome kit updated successfully')
      if (onSuccess) {
        onSuccess(res.data)
      }
      setTimeout(() => {
        onClose()
      }, 700)
    } catch (err) {
      setError(err?.message || 'Failed to update welcome kit status')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-100">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/70 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
              <Package className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Welcome Kit & Uniform</h2>
              <p className="text-xs text-slate-500">{user.fullName || 'Service Partner'} • +91 {user.phone}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={busy}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {error && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
              <Check className="h-4 w-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="space-y-3">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Kit Checklist
            </label>

            {/* Uniform Item */}
            <label
              className={`flex items-center justify-between p-3.5 rounded-xl border transition cursor-pointer ${
                uniformIssued ? 'border-brand/40 bg-brand/5 ring-1 ring-brand/20' : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={uniformIssued}
                  onChange={(e) => setUniformIssued(e.target.checked)}
                  disabled={busy}
                  className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/30"
                />
                <div>
                  <span className="text-sm font-bold text-slate-900">Service Uniform</span>
                  <p className="text-xs text-slate-500">Official company t-shirt / apron kit</p>
                </div>
              </div>
              <span className={`text-xs font-semibold ${uniformIssued ? 'text-brand' : 'text-slate-400'}`}>
                {uniformIssued ? 'Issued' : 'Not Issued'}
              </span>
            </label>

            {/* ID Card Item */}
            <label
              className={`flex items-center justify-between p-3.5 rounded-xl border transition cursor-pointer ${
                idCardIssued ? 'border-brand/40 bg-brand/5 ring-1 ring-brand/20' : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={idCardIssued}
                  onChange={(e) => setIdCardIssued(e.target.checked)}
                  disabled={busy}
                  className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/30"
                />
                <div>
                  <span className="text-sm font-bold text-slate-900">ID Card & Lanyard</span>
                  <p className="text-xs text-slate-500">Verified partner credential badge</p>
                </div>
              </div>
              <span className={`text-xs font-semibold ${idCardIssued ? 'text-brand' : 'text-slate-400'}`}>
                {idCardIssued ? 'Issued' : 'Not Issued'}
              </span>
            </label>

            {/* Bag Item */}
            <label
              className={`flex items-center justify-between p-3.5 rounded-xl border transition cursor-pointer ${
                bagIssued ? 'border-brand/40 bg-brand/5 ring-1 ring-brand/20' : 'border-slate-200 bg-white hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={bagIssued}
                  onChange={(e) => setBagIssued(e.target.checked)}
                  disabled={busy}
                  className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/30"
                />
                <div>
                  <span className="text-sm font-bold text-slate-900">Tool / Service Bag</span>
                  <p className="text-xs text-slate-500">Official branded equipment bag</p>
                </div>
              </div>
              <span className={`text-xs font-semibold ${bagIssued ? 'text-brand' : 'text-slate-400'}`}>
                {bagIssued ? 'Issued' : 'Not Issued'}
              </span>
            </label>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-500">Derived Status:</span>
              <KitStatusBadge welcomeKit={tempKit} />
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-500">Complete Issuance Date:</span>
              <span className="font-mono text-slate-700">
                {derivedStatus === 'COMPLETE'
                  ? existingIssuedAt
                    ? new Date(existingIssuedAt).toLocaleDateString()
                    : 'Current Timestamp (On Save)'
                  : '—'}
              </span>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="flex-1 rounded-xl border border-slate-200 bg-white py-2.5 text-center text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 transition disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={busy}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-center text-sm font-bold text-white shadow-md shadow-brand/20 hover:bg-brand/90 transition disabled:opacity-50"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                'Update Kit'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
