import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Headphones, LogOut } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../hooks/useAuth.js'
import { PartnerOnboardingStepper } from '../../components/labour/PartnerOnboardingStepper.jsx'

export function PartnerOnboardingPage() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [showExitModal, setShowExitModal] = useState(false)

  // Intercept hardware / browser back button to show exit modal
  useEffect(() => {
    window.history.pushState({ partnerOnboardingBackGuard: true }, '')

    const handlePopState = () => {
      setShowExitModal(true)
      window.history.pushState({ partnerOnboardingBackGuard: true }, '')
    }

    window.addEventListener('popstate', handlePopState)
    return () => {
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  const handleExitApp = async () => {
    setShowExitModal(false)
    try {
      await logout()
    } catch {
      // Ignore
    }
    if (window.navigator?.app?.exitApp) {
      window.navigator.app.exitApp()
    } else if (window.Capacitor?.App?.exitApp) {
      window.Capacitor.App.exitApp()
    } else {
      try {
        window.close()
      } catch {}
      navigate('/labours/auth', { replace: true })
    }
  }

  return (
    <div className="min-h-screen w-full bg-slate-50 text-slate-900 pb-24 overflow-y-visible">
      {/* Top Navigation Bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-slate-200/80 bg-white/90 px-4 py-3 backdrop-blur-md">
        <button
          type="button"
          onClick={() => setShowExitModal(true)}
          className="flex items-center gap-1.5 rounded-full p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition cursor-pointer"
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
          onClick={() => navigate('/serviceprovider/support?from=onboarding')}
          className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-200 transition cursor-pointer"
        >
          <Headphones className="h-4 w-4 text-brand" />
          <span>Support</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="mx-auto max-w-xl px-3.5 pt-4 sm:px-4">
        <PartnerOnboardingStepper onFinish={() => navigate('/serviceprovider/jobs', { replace: true })} />
      </div>

      {/* Exit App Confirmation Modal */}
      <AnimatePresence>
        {showExitModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowExitModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="relative w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl z-10 text-center"
            >
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 ring-8 ring-rose-50/50">
                <LogOut className="h-7 w-7 stroke-[2.25]" />
              </div>

              <h3 className="text-lg font-black text-slate-900">
                Exit Service Provider App?
              </h3>
              <p className="mt-2 text-xs font-medium leading-relaxed text-slate-500">
                Are you sure you want to exit? Your registration details are saved. You can log in anytime to complete your partner onboarding.
              </p>

              <div className="mt-6 flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={handleExitApp}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-600 py-3 text-xs font-black uppercase tracking-wider text-white shadow-md shadow-rose-600/25 transition active:scale-95 hover:bg-rose-700 cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  Exit App
                </button>

                <button
                  type="button"
                  onClick={() => setShowExitModal(false)}
                  className="flex w-full items-center justify-center rounded-2xl border border-slate-200 bg-white py-3 text-xs font-bold text-slate-700 transition hover:bg-slate-50 active:scale-95 cursor-pointer"
                >
                  Stay & Continue Registration
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
export default PartnerOnboardingPage
