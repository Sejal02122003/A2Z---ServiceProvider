import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Sparkles, Download, CheckCircle2, Award } from 'lucide-react'
import { ServiceProviderIdCard } from './ServiceProviderIdCard.jsx'

export function ServiceProviderIdCardModal({
  isOpen,
  onClose,
  user,
  isNewlyGenerated = false,
}) {
  if (!isOpen) return null

  const partnerName = user?.fullName || 'Service Provider'

  const handlePrint = () => {
    window.print()
  }

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          className="relative z-10 w-full max-w-md rounded-3xl bg-white shadow-2xl border border-slate-100 overflow-hidden flex flex-col my-auto max-h-[92vh]"
        >
          {/* Header */}
          <div className="relative shrink-0 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 p-4 text-white text-center shadow-xs">
            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3 top-3 rounded-full bg-white/20 p-1.5 text-white hover:bg-white/30 transition cursor-pointer backdrop-blur-md"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            {isNewlyGenerated ? (
              <div className="space-y-1">
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-300/25 px-3 py-0.5 text-[10px] font-black uppercase tracking-wider text-amber-200 border border-amber-300/40">
                  <Sparkles className="h-3 w-3 text-amber-300 animate-spin" /> Registration Complete
                </span>
                <h3 className="text-base sm:text-lg font-black tracking-tight text-white">
                  Congratulations, {partnerName.split(' ')[0]}!
                </h3>
                <p className="text-[11px] text-emerald-100">
                  Your Official Service Provider ID Card has been generated!
                </p>
              </div>
            ) : (
              <div className="space-y-0.5">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-100">
                  <Award className="h-3.5 w-3.5 text-emerald-200" /> Official Verified Credential
                </span>
                <h3 className="text-base font-black text-white">
                  Service Provider ID Card
                </h3>
              </div>
            )}
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center bg-slate-50/50">
            {isNewlyGenerated && (
              <div className="w-full max-w-[340px] mb-3 flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-900">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="text-[11px] font-semibold leading-tight">
                  You are now fully onboarded. Carry this badge or show it from your phone on customer visits.
                </span>
              </div>
            )}

            {/* ID Card Display */}
            <ServiceProviderIdCard user={user} onPrint={handlePrint} />

            <div className="mt-3 text-center text-[10px] text-slate-400">
              * Tap on the card anytime to flip between front and back sides.
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-3 bg-white border-t border-slate-100 flex items-center justify-between gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
            >
              Close
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-xs font-bold text-white shadow-md shadow-emerald-600/20 hover:brightness-105 transition cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download / Print</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
