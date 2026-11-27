import { User } from '../models/User.js'
import { USER_ROLES } from '../constants/roles.js'
import { permissionsForAdminLink } from '../constants/adminPermissions.js'

/**
 * Mongo filter for who receives an admin alert: every main admin, plus the active sub-admins who
 * were given the section the alert links to.
 */
export function adminRecipientFilter(link) {
  const or = [{ role: USER_ROLES.ADMIN, isActive: { $ne: false } }]
  const permissions = permissionsForAdminLink(link)
  if (permissions.length) {
    or.push({ role: USER_ROLES.SUB_ADMIN, isActive: true, adminPermissions: { $in: permissions } })
  }
  return { $or: or }
}

export function findAdminRecipients(link, select = '_id') {
  return User.find(adminRecipientFilter(link)).select(select).lean()
}
