import React, { useState } from 'react'
import { motion } from 'framer-motion'
import {
  ShieldCheck,
  Award,
  Phone,
  MapPin,
  RotateCw,
  Printer,
  Sparkles,
  CheckCircle2,
  Calendar,
  Building2,
  Lock,
} from 'lucide-react'

export function resolvePartnerCity(user) {
  if (!user) return 'Noida, NCR'

  const candidates = [
    user.city,
    user.welcomeKit?.confirmedAddressSnapshot?.city,
    user.welcomeKit?.address?.city,
    user.welcomeKit?.deliveryCity,
    user.savedAddresses?.find((a) => a.isDefault && a.city?.trim())?.city,
    user.savedAddresses?.find((a) => a.city?.trim())?.city,
    user.currentLocation,
    user.permanentAddress,
  ]

  for (const raw of candidates) {
    if (typeof raw === 'string') {
      const val = raw.trim()
      if (val && val !== '—' && val !== '-' && val !== 'Noida, NCR') {
        if (val.length > 35 && val.includes(',')) {
          const parts = val.split(',').map((p) => p.trim()).filter(Boolean)
          if (parts.length >= 2) {
            const likelyCity = parts.slice(-3, -1).find((p) => !/\d{5,}/.test(p) && p.length < 25)
            if (likelyCity) return likelyCity
          }
        }
        return val
      }
    }
  }

  return user.city?.trim() || user.currentLocation?.trim() || 'Noida, NCR'
}

export function resolvePartnerPhoto(user) {
  if (!user) return ''

  const candidates = [
    user.profileImageUrl,
    user.avatar,
    user.profilePicture,
    user.profilePic,
    user.photoUrl,
    user.labourProfile?.profilePhotoUrl,
    user.contractorProfile?.profilePhotoUrl,
  ]

  for (const raw of candidates) {
    if (typeof raw === 'string' && raw.trim()) {
      return raw.trim()
    }
  }

  return ''
}

export function ServiceProviderIdCard({ user, onPrint, className = '' }) {
  const [isFlipped, setIsFlipped] = useState(false)
  const [imgError, setImgError] = useState(false)

  const partnerName = user?.fullName || 'Verified Service Provider'
  const partnerCode =
    user?.partnerIdCode ||
    (user?._id ? `A2Z-SP-${String(user._id).slice(-6).toUpperCase()}` : 'A2Z-SP-847291')
  const phone = user?.phone ? String(user.phone).slice(-10) : '9876543210'
  const city = resolvePartnerCity(user)
  const roleTitle =
    user?.labourProfile?.skills?.[0] ||
    user?.labourProfile?.categoryIds?.[0]?.name ||
    user?.labourProfile?.categories?.[0]?.name ||
    user?.labourProfile?.serviceIds?.[0]?.name ||
    'Certified Service Partner'
  const photoUrl = resolvePartnerPhoto(user)

  // Reset imgError whenever photoUrl changes so new uploaded photo displays immediately
  React.useEffect(() => {
    setImgError(false)
  }, [photoUrl])

  const issueDate = user?.idCardGeneratedAt
    ? new Date(user.idCardGeneratedAt).toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })

  const qrData = encodeURIComponent(
    `A2Z Verified Partner\nID: ${partnerCode}\nName: ${partnerName}\nPhone: +91 ${phone}\nCity: ${city}\nTrade: ${roleTitle}\nStatus: Active & Verified`
  )
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&margin=3&data=${qrData}`

  const handlePrint = () => {
    if (onPrint) {
      onPrint()
      return
    }
    window.print()
  }

  return (
    <div className={`flex flex-col items-center ${className}`}>
      {/* Action Bar (Flip & Print) */}
      <div className="flex items-center justify-between w-full max-w-[340px] mb-2 px-1 text-xs">
        <button
          type="button"
          onClick={() => setIsFlipped((prev) => !prev)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 font-bold transition cursor-pointer border border-slate-200 shadow-2xs active:scale-95"
        >
          <RotateCw className="h-3.5 w-3.5 text-emerald-600" />
          <span>{isFlipped ? 'Show Front' : 'Flip to Back'}</span>
        </button>

        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold transition cursor-pointer shadow-xs active:scale-95"
        >
          <Printer className="h-3.5 w-3.5 text-white" />
          <span>Print / Save</span>
        </button>
      </div>

      {/* 3D Card Container */}
      <div
        className="w-full max-w-[340px] [perspective:1000px] cursor-pointer"
        onClick={() => setIsFlipped((prev) => !prev)}
        title="Click to flip card"
      >
        <motion.div
          animate={{ rotateY: isFlipped ? 180 : 0 }}
          transition={{ duration: 0.6, type: 'spring', stiffness: 260, damping: 25 }}
          className="relative w-full [transform-style:preserve-3d]"
          style={{ minHeight: '530px' }}
        >
          {/* ==================== FRONT OF CARD ==================== */}
          <div
            className="w-full rounded-3xl overflow-hidden border border-emerald-200/80 bg-gradient-to-b from-white via-emerald-50/20 to-slate-50 text-slate-900 shadow-xl shadow-emerald-950/5 [backface-visibility:hidden] relative flex flex-col justify-between"
            style={{ minHeight: '530px' }}
          >
            {/* Lanyard Cutout Slot */}
            <div className="pt-2.5 pb-1 flex justify-center bg-slate-100/70 border-b border-slate-200/40">
              <div className="h-2 w-12 rounded-full bg-slate-300/80 border border-slate-400/50 shadow-inner" />
            </div>

            {/* Top Brand Banner */}
            <div className="relative px-4 pt-3.5 pb-3 bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-500 text-white overflow-hidden shadow-sm">
              {/* Decorative Glow */}
              <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/20 blur-xl" />
              <div className="pointer-events-none absolute left-10 -bottom-8 h-20 w-20 rounded-full bg-emerald-300/20 blur-lg" />

              <div className="flex items-center justify-between relative z-10">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/20 backdrop-blur-md shadow-xs border border-white/30">
                    <ShieldCheck className="h-4.5 w-4.5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xs font-black tracking-wider uppercase text-white leading-tight">
                      A2Z SERVICES
                    </h2>
                    <p className="text-[8px] font-bold tracking-widest text-emerald-100 uppercase">
                      Official Partner Badge
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-0.5 backdrop-blur-md text-[9px] font-extrabold text-amber-200 border border-white/30 shadow-2xs">
                  <Sparkles className="h-2.5 w-2.5 text-amber-300" />
                  <span>VERIFIED</span>
                </div>
              </div>

              {/* Gold Separation Bar */}
              <div className="mt-2.5 h-[2px] w-full bg-gradient-to-r from-emerald-300 via-amber-300 to-teal-200 rounded-full opacity-80" />
            </div>

            {/* Card Body */}
            <div className="p-4 flex-1 flex flex-col items-center text-center">
              {/* Partner Avatar / Photo */}
              <div className="relative mt-1 mb-2.5">
                <div className="h-22 w-22 rounded-2xl p-0.5 bg-gradient-to-tr from-emerald-500 via-teal-400 to-amber-300 shadow-md shadow-emerald-600/15">
                  <div className="h-full w-full rounded-2xl overflow-hidden bg-slate-50 flex items-center justify-center border-2 border-white">
                    {photoUrl && !imgError ? (
                      <img
                        key={photoUrl}
                        src={photoUrl}
                        alt={partnerName}
                        className="h-full w-full object-cover"
                        onError={() => setImgError(true)}
                      />
                    ) : (
                      <span className="text-2xl font-black text-emerald-700">
                        {partnerName
                          .split(' ')
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('')
                          .toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>

                {/* Active Indicator Pin */}
                <div
                  className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 border-2 border-white text-white shadow-xs"
                  title="Active Partner"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 stroke-[3]" />
                </div>
              </div>

              {/* Partner Name & Trade */}
              <h3 className="text-base font-black text-slate-900 tracking-tight leading-snug line-clamp-1">
                {partnerName}
              </h3>
              <div className="mt-1 flex items-center gap-1.5 flex-wrap justify-center">
                <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-800 border border-emerald-200">
                  {roleTitle}
                </span>
              </div>

              {/* Partner ID Monospace Tag */}
              <div className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-100/90 px-2.5 py-1 text-[11px] font-mono font-bold text-slate-800 shadow-2xs">
                <span className="text-[9px] uppercase tracking-wider text-slate-400">ID:</span>
                <span className="text-slate-900 font-extrabold">{partnerCode}</span>
              </div>

              {/* Info Grid (Fresh Light Colors) */}
              <div className="mt-3.5 w-full grid grid-cols-2 gap-2 text-left bg-white/95 p-2.5 rounded-2xl border border-slate-200/80 shadow-2xs text-[10px]">
                <div className="p-1">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Phone className="h-2.5 w-2.5 text-emerald-600" /> Phone
                  </span>
                  <span className="font-bold text-slate-800 font-mono mt-0.5 block truncate">
                    +91 {phone}
                  </span>
                </div>

                <div className="p-1">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <MapPin className="h-2.5 w-2.5 text-emerald-600" /> City
                  </span>
                  <span className="font-bold text-slate-800 mt-0.5 block truncate">
                    {city}
                  </span>
                </div>

                <div className="p-1">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Calendar className="h-2.5 w-2.5 text-emerald-600" /> Issued On
                  </span>
                  <span className="font-semibold text-slate-700 mt-0.5 block truncate">
                    {issueDate}
                  </span>
                </div>

                <div className="p-1">
                  <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                    <Award className="h-2.5 w-2.5 text-emerald-600" /> KYC Status
                  </span>
                  <span className="font-extrabold text-emerald-700 mt-0.5 block truncate">
                    Govt. Verified ✓
                  </span>
                </div>
              </div>

              {/* QR Code Verification Section (Light & Fresh) */}
              <div className="mt-3 w-full flex items-center gap-3 bg-gradient-to-r from-emerald-50/70 via-teal-50/50 to-white p-2.5 rounded-2xl border border-emerald-200/80 shadow-xs">
                <div className="h-16 w-16 shrink-0 rounded-xl overflow-hidden border border-emerald-200/90 bg-white p-1 flex items-center justify-center shadow-2xs">
                  <img
                    src={qrUrl}
                    alt="Verification QR Code"
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="min-w-0 text-left">
                  <p className="text-[10px] font-black uppercase text-slate-900 leading-tight">
                    Scan to Verify Partner
                  </p>
                  <p className="text-[9px] text-slate-600 mt-0.5 leading-snug">
                    Scan with any camera or scanner to verify technician authenticity.
                  </p>
                  <div className="mt-1 flex items-center gap-1 text-[8px] font-extrabold text-emerald-700 uppercase">
                    <ShieldCheck className="h-3 w-3 text-emerald-600" />
                    <span>A2Z Official Trust Seal</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Security Strip */}
            <div className="px-3 py-1.5 bg-gradient-to-r from-emerald-100 via-teal-100 to-amber-100 text-emerald-950 text-[8px] font-black uppercase tracking-widest text-center border-t border-emerald-200/60">
              ★ OFFICIAL PARTNER CREDENTIAL • NON-TRANSFERABLE ★
            </div>
          </div>

          {/* ==================== BACK OF CARD ==================== */}
          <div
            className="absolute inset-0 w-full rounded-3xl overflow-hidden border border-emerald-200/80 bg-gradient-to-b from-white via-slate-50/80 to-slate-100 text-slate-800 shadow-xl [transform:rotateY(180deg)] [backface-visibility:hidden] flex flex-col justify-between"
            style={{ minHeight: '530px' }}
          >
            {/* Lanyard Cutout Slot */}
            <div className="pt-2.5 pb-1 flex justify-center bg-slate-100/70 border-b border-slate-200/40">
              <div className="h-2 w-12 rounded-full bg-slate-300/80 border border-slate-400/50 shadow-inner" />
            </div>

            {/* Back Header */}
            <div className="px-4 py-2.5 bg-gradient-to-r from-emerald-50 via-teal-50 to-white border-b border-emerald-100 text-center">
              <p className="text-[10px] font-black uppercase tracking-widest text-emerald-900">
                Partner Deployment Terms & Guidelines
              </p>
            </div>

            {/* Back Content Body */}
            <div className="p-4 flex-1 space-y-3 text-left text-xs">
              {/* Guidelines / Terms */}
              <div className="space-y-1.5 text-[10px] text-slate-600 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-2xs">
                <div className="flex items-start gap-1.5">
                  <span className="font-bold text-emerald-600">•</span>
                  <p className="leading-snug">
                    This credential is the property of <strong className="text-slate-900">A2Z Services India</strong> and is strictly non-transferable.
                  </p>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="font-bold text-emerald-600">•</span>
                  <p className="leading-snug">
                    Service partner must display this ID card and wear official uniform on all customer visits.
                  </p>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="font-bold text-emerald-600">•</span>
                  <p className="leading-snug">
                    All criminal background checks and Government Aadhaar / PAN KYC verifications have been duly completed.
                  </p>
                </div>
                <div className="flex items-start gap-1.5">
                  <span className="font-bold text-emerald-600">•</span>
                  <p className="leading-snug">
                    If found, please return to any nearest A2Z Partner Center or notify via 24x7 helpline.
                  </p>
                </div>
              </div>

              {/* Emergency & Support Card */}
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-2.5 space-y-1.5 text-[10px]">
                <div className="flex items-center justify-between pb-1 border-b border-emerald-100">
                  <span className="font-bold uppercase text-slate-500">24x7 Partner Helpline</span>
                  <span className="font-mono font-black text-emerald-700">1800-A2Z-HELP</span>
                </div>
                <div className="flex items-center justify-between pb-1 border-b border-emerald-100">
                  <span className="font-bold uppercase text-slate-500">Support Email</span>
                  <span className="font-semibold text-slate-800">partner@a2zservice.com</span>
                </div>
                <div className="flex items-start gap-1.5 pt-0.5">
                  <Building2 className="h-3 w-3 text-emerald-700 shrink-0 mt-0.5" />
                  <span className="text-[9px] text-slate-600 leading-tight">
                    A2Z Training & Evaluation Center, Sector 18, Noida, Uttar Pradesh 201301
                  </span>
                </div>
              </div>

              {/* Barcode Simulation */}
              <div className="rounded-2xl bg-white border border-slate-200/90 p-2 text-center shadow-2xs">
                {/* SVG Barcode */}
                <div className="h-9 w-full flex items-center justify-center gap-0.5 px-4 overflow-hidden">
                  {[3, 1, 4, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1, 3, 1, 4, 2, 3, 1, 2, 4, 1, 3, 2, 1, 4, 1, 3, 2, 4, 1, 2].map((w, i) => (
                    <div
                      key={i}
                      className="h-full bg-slate-800"
                      style={{ width: `${w * 1.5}px` }}
                    />
                  ))}
                </div>
                <span className="font-mono text-[9px] font-black tracking-widest text-slate-800 mt-1 block">
                  {partnerCode}
                </span>
              </div>
            </div>

            {/* Back Footer */}
            <div className="p-3 bg-white text-center border-t border-slate-200">
              <p className="text-[9px] text-slate-500">
                Authorized by <strong className="text-slate-800">A2Z Operations & Safety Board</strong>
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
