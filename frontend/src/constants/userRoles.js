/** Keep in sync with backend `src/constants/roles.js` */
export const USER_ROLES = {
  CUSTOMER: 'customer',
  LABOUR: 'labour',
  ADMIN: 'admin',
}

/** Same as backend `ROLE_LIST` */
export const ROLE_LIST = Object.values(USER_ROLES)

export const REGISTERABLE_ROLES = [
  USER_ROLES.CUSTOMER,
  USER_ROLES.LABOUR,
]

/** Mobile-first app roles */
export const APP_ROLES = [
  USER_ROLES.CUSTOMER,
  USER_ROLES.LABOUR,
]

export const ROLE_LABELS = {
  [USER_ROLES.CUSTOMER]: 'Customer',
  [USER_ROLES.LABOUR]: 'Vendor / Service Partner',
  [USER_ROLES.ADMIN]: 'Administrator',
}

export const KYC_STATUS = {
  PENDING: 'pending',
  VERIFIED: 'verified',
  FAILED: 'failed',
}

