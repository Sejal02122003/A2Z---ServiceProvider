import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import { BOOT_ROUTES } from '../../constants/bootFlow.js'
import { getRoleHomePath } from '../../lib/roleHomePath.js'
import { AppRouteLoader } from '../app/AppRouteLoader.jsx'

export function ProtectedRoute({ children, roles, allowGuest }) {
  const { isAuthenticated, user, loading, token } = useAuth()
  const location = useLocation()
  const role = user?.role

  if (loading || (token && !user)) {
    return <AppRouteLoader />
  }

  if (!isAuthenticated && !allowGuest) {
    return <Navigate to={BOOT_ROUTES.SPLASH} replace state={{ from: location.pathname + location.search }} />
  }

  if (isAuthenticated && roles?.length && role && !roles.includes(role)) {
    return <Navigate to={getRoleHomePath(role)} replace />
  }

  return children
}
