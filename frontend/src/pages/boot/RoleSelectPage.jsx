import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowLeft, HardHat, Home } from 'lucide-react'
import { AppRouteLoader } from '../../components/app/AppRouteLoader.jsx'
import { BOOT_ROUTES } from '../../constants/bootFlow.js'
import { USER_ROLES } from '../../constants/userRoles.js'
import { useAuth } from '../../hooks/useAuth.js'
import { getRoleHomePath } from '../../lib/roleHomePath.js'

const ROLES = [
  {
    role: USER_ROLES.CUSTOMER,
    label: 'User',
    hint: 'Hire labour',
    icon: Home,
  },
  {
    role: USER_ROLES.LABOUR,
    label: 'Labour',
    hint: 'Find work',
    icon: HardHat,
  },
]

export function RoleSelectPage() {
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const { isAuthenticated, user, loading, setBootRole, token, realUser } = useAuth()

  useEffect(() => {
    if (loading) return undefined

    if (token && realUser?.role) {
      navigate(getRoleHomePath(realUser.role), { replace: true })
      return undefined
    }

    if (isAuthenticated && user?.role) {
      navigate(getRoleHomePath(user.role), { replace: true })
    }

    return undefined
  }, [isAuthenticated, loading, navigate, realUser?.role, token, user?.role])

  function handleSelect(role) {
    if (role === USER_ROLES.LABOUR) {
      navigate('/labours/auth', { replace: true, state: { defaultRole: role } })
      return
    }
    setBootRole(role)
    navigate(getRoleHomePath(role), { replace: true })
  }

  if (loading) {
    return <AppRouteLoader />
  }

  if (isAuthenticated) {
    return null
  }

  return (
    <div className="lc-splash-page lc-role-page relative min-h-dvh w-full overflow-hidden text-white">
      <div
        className="pointer-events-none absolute -right-16 top-24 h-48 w-48 rounded-full bg-white/10"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-12 bottom-32 h-40 w-40 rounded-full bg-white/8"
        aria-hidden
      />

      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-lg flex-col px-5 pb-[max(1.75rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
        <header className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate(BOOT_ROUTES.SPLASH, { replace: true })}
            className="lc-role-back"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" strokeWidth={2} aria-hidden />
          </button>
          <div className="flex items-center gap-1.5" aria-hidden>
            <span className="h-1 w-6 rounded-full bg-white/35" />
            <span className="h-1.5 w-8 rounded-full bg-white" />
          </div>
        </header>

        <main className="flex flex-1 flex-col justify-center">
          <motion.div
            className="text-center"
            initial={reduce ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-[1.15rem] bg-white/15 ring-1 ring-white/25">
              <HardHat className="h-7 w-7" strokeWidth={2} aria-hidden />
            </span>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-white/80">A2Z</p>
            <h1 className="mt-2 text-[1.75rem] font-black leading-tight tracking-tight sm:text-[2rem]">
              Continue as
            </h1>
          </motion.div>

          <div className="mt-9 grid grid-cols-2 gap-3.5 sm:gap-4">
            {ROLES.map(({ role, label, hint, icon: Icon }, index) => (
              <motion.button
                key={role}
                type="button"
                onClick={() => handleSelect(role)}
                className="lc-role-tile"
                initial={reduce ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06 + index * 0.07, duration: 0.38 }}
                whileTap={reduce ? undefined : { scale: 0.97 }}
              >
                <span className="lc-role-tile-icon">
                  <Icon className="h-7 w-7" strokeWidth={2} aria-hidden />
                </span>
                <span className="mt-4 block text-[1.0625rem] font-bold leading-none text-slate-900">{label}</span>
                <span className="mt-1.5 block text-xs font-medium text-slate-500">{hint}</span>
              </motion.button>
            ))}
          </div>
        </main>
      </div>
    </div>
  )
}
