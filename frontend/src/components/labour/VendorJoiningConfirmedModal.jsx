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
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3.5 sm:p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm"
        />

        {/* Modal Container */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: 'spring', stiffness: 380, damping: 26 }}
          className="relative z-10 w-full max-w-sm sm:max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-100 max-h-[88vh] flex flex-col"
        >
          {/* Header Banner */}
          <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-emerald-600 via-teal-700 to-slate-900 px-5 pt-4 pb-3.5 text-white text-center">
            {/* Background Accent Blur */}
            <div className="pointer-events-none absolute -left-6 -top-6 h-28 w-28 rounded-full bg-emerald-400/20 blur-2xl" />
            <div className="pointer-events-none absolute -right-6 -bottom-6 h-28 w-28 rounded-full bg-teal-300/20 blur-2xl" />

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="absolute right-3.5 top-3.5 rounded-full bg-white/10 p-1.5 text-white/80 backdrop-blur-md transition hover:bg-white/20 hover:text-white"
              aria-label="Close modal"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Floating Trophy Icon */}
            <motion.div
              initial={{ scale: 0, rotate: -15 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 450, damping: 20 }}
              className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-amber-400 to-yellow-300 text-slate-900 shadow-lg shadow-amber-500/25"
            >
              <Award className="h-7 w-7 text-slate-900" />
            </motion.div>

            {/* Title & Tag */}
            <div className="mt-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-emerald-200 backdrop-blur-md">
                <Sparkles className="h-3 w-3 text-yellow-300" /> Joining Confirmed
              </span>
              <h2 className="mt-1 text-lg sm:text-xl font-black tracking-tight text-white">
                Congratulations, {vendorName.split(' ')[0]}!
              </h2>
              <p className="mt-0.5 text-[11px] text-emerald-100 font-medium">
                Your trial evaluation is passed. You are now an official A2Z Service Provider!
              </p>
            </div>
          </div>

          {/* Scrollable Content Body */}
          <div className="flex-1 overflow-y-auto px-4 py-3.5 space-y-3 text-slate-800 scrollbar-thin">
            {/* Verified Status Pill */}
            <div className="flex items-center gap-2.5 rounded-xl bg-emerald-50 border border-emerald-200/80 px-3 py-2 text-xs text-emerald-900">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1 leading-tight">
                <p className="text-[11px] font-bold text-emerald-950">Official Verified Provider</p>
                <p className="text-[10px] text-emerald-700">Account is active to receive customer bookings</p>
              </div>
            </div>

            {/* Welcome Kit Card */}
            <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50/70 via-orange-50/30 to-white p-3.5 shadow-2xs">
              <div className="flex items-center justify-between pb-2 border-b border-amber-100/90">
                <div className="flex items-center gap-2 text-amber-950">
                  <Package className="h-4 w-4 text-amber-600" />
                  <h3 className="text-xs font-extrabold uppercase tracking-wide">Collect Welcome Kit</h3>
                </div>
                <span
                  className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${
                    allIssued
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-amber-200/80 text-amber-900'
                  }`}
                >
                  {allIssued ? 'Issued' : 'Ready for Pickup'}
                </span>
              </div>

              <p className="mt-2 text-[11px] text-slate-600 leading-snug">
                Please collect your official partner onboarding kit before starting on-site jobs:
              </p>

              {/* Kit Items List */}
              <div className="mt-2.5 space-y-1.5">
                {/* Uniform */}
                <div className="flex items-center justify-between rounded-xl bg-white p-2 border border-slate-100 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
                      <Shirt className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 leading-none">Official Service Uniform</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">Branded T-Shirt / Apron</p>
                    </div>
                  </div>
                  {isUniformIssued ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                      <CheckCircle2 className="h-3 w-3" /> Issued
                    </span>
                  ) : (
                    <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 border border-amber-200">
                      To Collect
                    </span>
                  )}
                </div>

                {/* ID Card */}
                <div className="flex items-center justify-between rounded-xl bg-white p-2 border border-slate-100 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                      <CreditCard className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 leading-none">Partner ID Card & Lanyard</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">Verified partner credential</p>
                    </div>
                  </div>
                  {isIdCardIssued ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                      <CheckCircle2 className="h-3 w-3" /> Issued
                    </span>
                  ) : (
                    <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 border border-amber-200">
                      To Collect
                    </span>
                  )}
                </div>

                {/* Bag */}
                <div className="flex items-center justify-between rounded-xl bg-white p-2 border border-slate-100 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                      <Briefcase className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-slate-800 leading-none">Tool & Equipment Bag</p>
                      <p className="text-[9px] text-slate-400 mt-0.5">Professional gear kit bag</p>
                    </div>
                  </div>
                  {isBagIssued ? (
                    <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600">
                      <CheckCircle2 className="h-3 w-3" /> Issued
                    </span>
                  ) : (
                    <span className="rounded-md bg-amber-50 px-1.5 py-0.5 text-[9px] font-bold text-amber-700 border border-amber-200">
                      To Collect
                    </span>
                  )}
                </div>
              </div>

              {/* Pickup Instructions */}
              <div className="mt-2.5 flex items-start gap-2 rounded-xl bg-amber-100/70 p-2 text-amber-950">
                <MapPin className="h-3.5 w-3.5 shrink-0 text-amber-700 mt-0.5" />
                <p className="text-[10px] leading-tight">
                  <strong>Where to collect:</strong> Visit your registered <strong>A2Z Partner City Hub</strong> or local field office (10 AM – 6 PM) to collect your kit.
                </p>
              </div>
            </div>
          </div>

          {/* Modal Footer */}
          <div className="shrink-0 border-t border-slate-100 bg-slate-50/90 px-4 py-3 space-y-1.5">
            <button
              type="button"
              onClick={onClose}
              className="w-full flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md shadow-emerald-600/20 transition hover:brightness-105 active:scale-[0.99]"
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
                className="w-full flex items-center justify-center gap-1 py-1 text-[11px] font-semibold text-slate-500 hover:text-slate-800 transition"
              >
                <span>View Full Trial Details</span>
                <ChevronRight className="h-3 w-3" />
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
