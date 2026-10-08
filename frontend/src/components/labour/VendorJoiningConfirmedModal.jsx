import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Award,
  CheckCircle2,
  Package,
  Sparkles,
  Shirt,
  CreditCard,
  Briefcase,
  MapPin,
  ChevronRight,
  X,
  PhoneCall,
  Clock,
  ShieldCheck,
} from 'lucide-react'

export function VendorJoiningConfirmedModal({
  isOpen,
  onClose,
  user,
  trialData,
  onViewTrialDetails,
}) {
  if (!isOpen) return null

  const vendorName = user?.fullName || trialData?.vendor?.fullName || 'Partner'
  const welcomeKit = user?.welcomeKit || trialData?.vendor?.welcomeKit || {}
  const isUniformIssued = Boolean(welcomeKit.uniformIssued)
  const isIdCardIssued = Boolean(welcomeKit.idCardIssued)
  const isBagIssued = Boolean(welcomeKit.bagIssued)
  const allIssued = isUniformIssued && isIdCardIssued && isBagIssued

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/70 backdrop-blur-md"
        />

        {/* Modal Dialog */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ type: 'spring', stiffness: 350, damping: 25 }}
          className="relative z-10 w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-100 max-h-[92vh] flex flex-col"
        >
          {/* Festive Top Banner */}
          <div className="relative overflow-hidden bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-900 p-6 text-white text-center">
            {/* Background Decorative Sparkles */}
            <div className="pointer-events-none absolute -left-6 -top-6 h-32 w-32 rounded-full bg-emerald-400/20 blur-2xl" />
            <div className="pointer-events-none absolute -right-6 -bottom-6 h-32 w-32 rounded-full bg-teal-300/20 blur-2xl" />

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white/80 backdrop-blur-md transition hover:bg-white/20 hover:text-white"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Floating Trophy / Badge */}
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.15, type: 'spring', stiffness: 400, damping: 20 }}
              className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-300 text-slate-900 shadow-xl shadow-amber-500/30"
            >
              <Award className="h-9 w-9 text-slate-900" />
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="mt-3"
            >
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-emerald-200 backdrop-blur-md">
                <Sparkles className="h-3 w-3 text-yellow-300" /> Joining Confirmed
              </span>
              <h2 className="mt-2 text-xl font-black tracking-tight text-white sm:text-2xl">
                Congratulations!
              </h2>
              <p className="mt-1 text-xs text-emerald-100 font-medium">
                Dear <strong className="text-white">{vendorName}</strong>, your joining has been successfully confirmed.
              </p>
            </motion.div>
          </div>

          {/* Modal Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4 text-slate-800">
            {/* Status Announcement Card */}
            <div className="rounded-2xl bg-emerald-50/80 border border-emerald-200/80 p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-md shadow-emerald-600/20">
                  <ShieldCheck className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-emerald-950">
                    Official A2Z Service Provider
                  </h3>
                  <p className="mt-0.5 text-xs text-emerald-800 leading-relaxed">
                    You have successfully cleared your trial period! Your account is now fully active with verified status to receive direct customer bookings.
                  </p>
                </div>
              </div>
            </div>

            {/* Welcome Kit Collection Highlight Box */}
            <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50/80 via-orange-50/40 to-white p-4 shadow-sm">
              <div className="flex items-center justify-between pb-3 border-b border-amber-100">
                <div className="flex items-center gap-2 text-amber-900">
                  <Package className="h-5 w-5 text-amber-600" />
                  <h3 className="text-sm font-black">Collect Your Welcome Kit</h3>
                </div>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold ${
                    allIssued
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-200/80 text-amber-900 animate-pulse'
                  }`}
                >
                  {allIssued ? 'Kit Issued' : 'Ready for Pickup'}
                </span>
              </div>

              <p className="mt-2.5 text-xs text-slate-600 leading-relaxed">
                Please collect your official partner onboarding kit before attending on-site customer service calls:
              </p>

              {/* Kit Items List */}
              <div className="mt-3 space-y-2">
                {/* Uniform */}
                <div className="flex items-center justify-between rounded-xl bg-white p-2.5 border border-slate-100 shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                      <Shirt className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Official Service Uniform</p>
                      <p className="text-[10px] text-slate-400">Branded T-Shirt / Apron</p>
                    </div>
                  </div>
                  {isUniformIssued ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Issued
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-amber-600">To Collect</span>
                  )}
                </div>

                {/* ID Card */}
                <div className="flex items-center justify-between rounded-xl bg-white p-2.5 border border-slate-100 shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                      <CreditCard className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Partner ID Card & Lanyard</p>
                      <p className="text-[10px] text-slate-400">Verified identity badge</p>
                    </div>
                  </div>
                  {isIdCardIssued ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Issued
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-amber-600">To Collect</span>
                  )}
                </div>

                {/* Bag */}
                <div className="flex items-center justify-between rounded-xl bg-white p-2.5 border border-slate-100 shadow-2xs">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                      <Briefcase className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800">Tool & Equipment Kit Bag</p>
                      <p className="text-[10px] text-slate-400">Professional gear carrying bag</p>
                    </div>
                  </div>
                  {isBagIssued ? (
                    <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-600">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Issued
                    </span>
                  ) : (
                    <span className="text-[11px] font-semibold text-amber-600">To Collect</span>
                  )}
                </div>
              </div>

              {/* Pickup Location & Instructions */}
              <div className="mt-3.5 flex items-start gap-2.5 rounded-xl bg-amber-100/60 p-2.5 text-xs text-amber-950">
                <MapPin className="h-4 w-4 shrink-0 text-amber-700 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <strong>How to collect:</strong> Visit your registered <strong>A2Z Partner City Hub</strong> or local field coordinator office during business hours (10 AM – 6 PM) to collect your kit.
                </div>
              </div>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="border-t border-slate-100 bg-slate-50/90 p-4 space-y-2">
            <button
              type="button"
              onClick={onClose}
              className="w-full flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-600/25 transition hover:brightness-105 active:scale-[0.99]"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Got It, Collect Kit</span>
            </button>

            {onViewTrialDetails && (
              <button
                type="button"
                onClick={() => {
                  onClose()
                  onViewTrialDetails()
                }}
                className="w-full flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 transition"
              >
                <span>View Full Trial Details & History</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
