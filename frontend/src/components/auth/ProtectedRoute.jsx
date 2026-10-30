import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import { getRoleHomePath } from '../../lib/roleHomePath.js'
import { AppRouteLoader } from '../app/AppRouteLoader.jsx'
import { USER_ROLES } from '../../constants/userRoles.js'

export function ProtectedRoute({ children, roles, allowGuest }) {
  const { isAuthenticated, user, loading, token } = useAuth()
  const location = useLocation()
  const role = user?.role

  if (loading || (token && !user)) {
    return <AppRouteLoader />
  }

  if (!isAuthenticated && !allowGuest) {
    const isLabour =
      roles?.includes(USER_ROLES.LABOUR) ||
      location.pathname.startsWith('/serviceprovider') ||
      location.pathname.startsWith('/labour')
    const targetAuth = isLabour ? '/labours/auth' : '/users/auth'
    return <Navigate to={targetAuth} replace state={{ from: location.pathname + location.search }} />
  }

  if (isAuthenticated && roles?.length && role && !roles.includes(role)) {
    return <Navigate to={getRoleHomePath(role)} replace />
  }

  return children
}
