import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Headphones, LifeBuoy } from 'lucide-react'
import { PartnerOnboardingStepper } from '../../components/labour/PartnerOnboardingStepper.jsx'

export function PartnerOnboardingPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen w-full bg-slate-50 text-slate-900 pb-24 overflow-y-visible">
      {/* Top Navigation Bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur-md">
        <button
          type="button"
          onClick={() => {
            if (window.history.length > 2) {
              navigate(-1)
            } else {
              navigate('/serviceprovider')
            }
          }}
          className="flex items-center gap-1.5 rounded-full p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-xs font-bold sm:inline">Back</span>
        </button>

        <div className="text-center">
          <p className="text-xs font-black tracking-tight text-slate-900">Partner Registration Flow</p>
          <p className="text-[10px] text-slate-500 font-medium">Step-by-step verification</p>
        </div>

        <button
          type="button"
          onClick={() => navigate('/serviceprovider/support')}
          className="flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700 hover:bg-slate-200 transition"
        >
          <Headphones className="h-3.5 w-3.5 text-brand" />
          <span className="hidden sm:inline">Help Desk</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="mx-auto max-w-xl px-3.5 pt-4 sm:px-4">
        <PartnerOnboardingStepper onFinish={() => navigate('/serviceprovider/jobs', { replace: true })} />
      </div>
    </div>
  )
}
export default PartnerOnboardingPage
