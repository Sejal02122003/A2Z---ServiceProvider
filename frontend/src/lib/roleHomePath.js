import { USER_ROLES } from '../constants/userRoles.js'

/** Post-login / wrong-panel redirect target per role */
export function getRoleHomePath(role) {
  switch (role) {
    case USER_ROLES.ADMIN:
      return '/admin'
    case USER_ROLES.LABOUR:
      return '/serviceprovider'
    case USER_ROLES.CUSTOMER:
    case USER_ROLES.CONTRACTOR:
    default:
      return '/user'
  }
}
