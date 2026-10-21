import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { HardHat } from 'lucide-react'
import { SplashAnimatedBrand } from '../../components/boot/splash/SplashAnimatedBrand.jsx'
import { AppRouteLoader } from '../../components/app/AppRouteLoader.jsx'
import { BOOT_ROUTES } from '../../constants/bootFlow.js'
import { useAuth } from '../../hooks/useAuth.js'
import { readBootRole } from '../../lib/bootPersona.js'
import { getRoleHomePath } from '../../lib/roleHomePath.js'

/**
 * Boot splash — brand animation; Next → role select (or /app if role remembered).
 */
export function SplashPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isAuthenticated, user, loading, token, realUser } = useAuth()
  const [brandReady, setBrandReady] = useState(false)
  const continuedRef = useRef(false)

  const continueToNext = useCallback(() => {
    if (continuedRef.current) return
    continuedRef.current = true

    const remembered = readBootRole()
    if (remembered && !token) {
      navigate(getRoleHomePath(remembered), {
        replace: true,
        state: location.state,
      })
      return
    }

    navigate(BOOT_ROUTES.ROLE_SELECT, {
      replace: true,
      state: location.state,
    })
  }, [location.state, navigate, token])

  useEffect(() => {
    if (loading) return undefined

    if (token && realUser?.role) {
      navigate(getRoleHomePath(realUser.role), { replace: true })
      return undefined
    }

    if (isAuthenticated && user?.role) {
      navigate(getRoleHomePath(user.role), { replace: true })
      return undefined
    }

    const remembered = readBootRole()
    if (remembered && !token) {
      navigate(getRoleHomePath(remembered), { replace: true })
      return undefined
    }

    return undefined
  }, [isAuthenticated, loading, navigate, realUser?.role, token, user?.role])

  if (loading) {
    return <AppRouteLoader />
  }

  if (isAuthenticated) {
    return null
  }

  return (
    <div className="lc-splash-page relative min-h-dvh w-full overflow-hidden">
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center px-6 pb-[max(6rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))]">
        <span className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 text-white ring-2 ring-white/30">
          <HardHat className="h-8 w-8" strokeWidth={2} aria-hidden />
        </span>

        <p className="text-sm font-semibold tracking-wide text-white/90">Welcome to</p>

        <SplashAnimatedBrand className="mt-3 w-full px-1" onReady={() => setBrandReady(true)} />

        <p className="mt-5 max-w-[18rem] text-center text-sm font-medium leading-relaxed text-white/85">
          Verified service providers, bookings, and fast payouts.
        </p>

        <button
          type="button"
          className="lc-splash-next mt-10"
          disabled={!brandReady}
          onClick={continueToNext}
        >
          Next
        </button>

        <button
          type="button"
          onClick={continueToNext}
          className="lc-splash-skip absolute bottom-[max(1.25rem,env(safe-area-inset-bottom))]"
        >
          Skip
        </button>
      </div>
    </div>
  )
}
