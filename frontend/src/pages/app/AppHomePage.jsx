import { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { AlertCircle, Clock, ShieldCheck } from 'lucide-react'
import { GlassPanel } from '../../components/ui/GlassPanel.jsx'
import { useAuth } from '../../hooks/useAuth.js'
import { USER_ROLES, KYC_STATUS } from '../../constants/userRoles.js'
import { getRoleHomePath } from '../../lib/roleHomePath.js'
import { IndividualHomeScreen } from './home/IndividualHomeScreen.jsx'
import { LabourHomeScreen } from './home/LabourHomeScreen.jsx'
import { userSubscriptionApi } from '../../api/userSubscriptionApi.js'

/**
 * For labour users — check trial/subscription gate before rendering dashboard
 */
function LabourGate({ user }) {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    // Only gate if KYC is verified
    if (user?.labourProfile?.kycStatus !== KYC_STATUS.VERIFIED) {
      setChecking(false)
      return
    }

    userSubscriptionApi.checkAccess()
      .then((res) => {
        const data = res?.data
        if (!data?.hasAccess) {
          navigate('/app/subscription', { replace: true })
        } else {
          setChecking(false)
        }
      })
      .catch(() => {
        // On error, allow access (fail-open)
        setChecking(false)
      })
  }, [user, navigate])

  if (checking) {
    // Brief loading — prevents flash of dashboard before gate redirect
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand/20 border-t-brand" />
      </div>
    )
  }

  return <LabourHomeScreen user={user} />
}

export function AppHomePage() {
  const { user } = useAuth()

  const labourCategories = user?.labourProfile?.categoryIds
  const needsWorkCategories =
    user?.role === USER_ROLES.LABOUR && !(Array.isArray(labourCategories) && labourCategories.length > 0)

  if (needsWorkCategories) {
    return <Navigate to="/app/work-categories" replace />
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
            onClick={() => window.location.href = '/app/profile'}
            className="inline-flex w-full items-center justify-center rounded-xl bg-brand px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-600 active:scale-[0.98]"
          >
            Go to Profile
          </button>
        </GlassPanel>
      </div>
    )
  }

  if (user.role === USER_ROLES.LABOUR) {
    return <LabourGate user={user} />
  }

  return <Navigate to={getRoleHomePath(user.role)} replace />
}
