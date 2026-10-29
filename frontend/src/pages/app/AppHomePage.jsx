import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useLocation } from 'react-router-dom'
import { AlertCircle, Clock, ShieldCheck } from 'lucide-react'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import { USER_ROLES, KYC_STATUS } from '../../constants/userRoles.js'
import { getRoleHomePath } from '../../lib/roleHomePath.js'
import { IndividualHomeScreen } from './home/IndividualHomeScreen.jsx'
import { LabourHomeScreen } from './home/LabourHomeScreen.jsx'
import { userSubscriptionApi } from '../../api/userSubscriptionApi.js'

import { AppRouteLoader } from '../../components/app/AppRouteLoader.jsx'

function LabourGate({ user }) {
  return <LabourHomeScreen user={user} />
}

export function AppHomePage() {
  const { user, loading, token } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  if (loading || (token && !user)) {
    return <AppRouteLoader />
  }

  // If visiting /serviceprovider or logged in as labour on serviceprovider route
  if (user?.role === USER_ROLES.LABOUR || location.pathname.startsWith('/serviceprovider')) {
    const kitReceived = Boolean(
      user?.welcomeKit?.isReceived ||
      user?.welcomeKit?.status === 'DELIVERED' ||
      (user?.welcomeKit?.uniformIssued && user?.welcomeKit?.idCardIssued && user?.welcomeKit?.bagIssued)
    )
    const labourCategories = user?.labourProfile?.categoryIds
    const hasCategories = Array.isArray(labourCategories) && labourCategories.length > 0
    if (!kitReceived || !hasCategories) {
      return <Navigate to="/serviceprovider/partner-onboarding" replace />
    }
    return <LabourGate user={user} />
  }

  if (!user || !user.role || user.role === USER_ROLES.CUSTOMER) {
    return <IndividualHomeScreen user={user} />
  }

  if (user.role === USER_ROLES.CONTRACTOR) {
    const kycStatus = user?.contractorProfile?.kycStatus

    if (kycStatus === KYC_STATUS.VERIFIED) {
      return <IndividualHomeScreen user={user} />
    }

    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center p-4">
        <GlassPanel className="w-full max-w-md overflow-hidden bg-white/60 p-8 text-center ring-1 ring-slate-200/60 shadow-xl">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 shadow-inner">
            {kycStatus === KYC_STATUS.PENDING ? (
              <Clock className="h-8 w-8 text-brand" />
            ) : kycStatus === KYC_STATUS.FAILED ? (
              <AlertCircle className="h-8 w-8 text-rose-500" />
            ) : (
              <ShieldCheck className="h-8 w-8 text-slate-400" />
            )}
          </div>
          
          <h2 className="mb-3 text-xl font-bold tracking-tight text-slate-900">
            Account Verification Required
          </h2>
          
          <p className="mb-8 text-sm leading-relaxed text-slate-600">
            {kycStatus === KYC_STATUS.PENDING ? (
              "Your business documents are currently under review by our administrative team. We appreciate your patience as we ensure a secure platform for all users. You will have full access once the verification is complete."
            ) : kycStatus === KYC_STATUS.FAILED ? (
              "We were unable to verify your submitted documents. Please visit your profile to review the feedback and resubmit your details."
            ) : (
              "To access the A2Z contractor dashboard and services, you must complete your business verification. Please navigate to your profile to upload the required documents."
            )}
          </p>
          
          <button
            onClick={() => navigate('/user/profile')}
            className="inline-flex w-full items-center justify-center rounded-xl bg-brand px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 active:scale-[0.98]"
          >
            Go to Profile
          </button>
        </GlassPanel>
      </div>
    )
  }

  return <Navigate to={getRoleHomePath(user.role)} replace />
}
