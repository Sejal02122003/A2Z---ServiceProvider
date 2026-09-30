/** Aligns with Work Scope: Individual, Labour, Admin */
export const USER_ROLES = {
  CUSTOMER: 'customer',
  CONTRACTOR: 'contractor',
  LABOUR: 'labour',
  ADMIN: 'admin',
}

export const ROLE_LIST = Object.values(USER_ROLES)

/** Roles that use mobile-first app experience (not web-admin focused) */
export const APP_ROLES = [
  USER_ROLES.CUSTOMER,
  USER_ROLES.LABOUR,
]

export const ADMIN_ROLES = [
  USER_ROLES.ADMIN,
]

export const KYC_STATUS = {
  PENDING: 'pending',
  VERIFIED: 'verified',
  FAILED: 'failed',
}
