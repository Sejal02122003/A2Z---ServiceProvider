import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth.js'
import { AppRouteLoader } from '../app/AppRouteLoader.jsx'
import { USER_ROLES } from '../../constants/userRoles.js'
import { getRoleHomePath } from '../../lib/roleHomePath.js'

/**
 * Restricts a route to specific `user.role` values (matches backend User.role enum).
 * If `allowGuest` is true, unauthenticated users can access the route.
 */
export function RoleRoute({ allow, allowGuest, children }) {
  const { isAuthenticated, user, loading, token } = useAuth()
  const location = useLocation()

  if (loading || (token && !user)) {
    return <AppRouteLoader />
  }

  if (!isAuthenticated) {
    if (allowGuest) return children
    const targetAuth =
      allow?.includes(USER_ROLES.LABOUR) && !allow?.includes(USER_ROLES.CUSTOMER)
        ? '/labours/auth'
        : '/users/auth'
    return <Navigate to={targetAuth} replace state={{ from: location.pathname + location.search }} />
  }

  if (!allow?.length || !user?.role || !allow.includes(user.role)) {
    return <Navigate to={getRoleHomePath(user?.role)} replace />
  }
  
  return children
}
