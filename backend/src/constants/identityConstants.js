export const IDENTITY_STATUS = {
  UNVERIFIED: 'UNVERIFIED',
  CONTACT_VERIFIED: 'CONTACT_VERIFIED',
  PENDING_IDENTITY_VERIFICATION: 'PENDING_IDENTITY_VERIFICATION',
  MANUAL_REVIEW: 'MANUAL_REVIEW',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
  SUSPENDED: 'SUSPENDED',
}

export const IDENTITY_STATUS_LIST = Object.values(IDENTITY_STATUS)

/**
 * Permitted status transitions to maintain state machine integrity.
 * Unauthorized transitions are strictly rejected by the backend.
 */
export const ALLOWED_IDENTITY_TRANSITIONS = {
  [IDENTITY_STATUS.UNVERIFIED]: [
    IDENTITY_STATUS.CONTACT_VERIFIED,
    IDENTITY_STATUS.SUSPENDED,
  ],
  [IDENTITY_STATUS.CONTACT_VERIFIED]: [
    IDENTITY_STATUS.PENDING_IDENTITY_VERIFICATION,
    IDENTITY_STATUS.MANUAL_REVIEW,
    IDENTITY_STATUS.SUSPENDED,
  ],
  [IDENTITY_STATUS.PENDING_IDENTITY_VERIFICATION]: [
    IDENTITY_STATUS.VERIFIED,
    IDENTITY_STATUS.MANUAL_REVIEW,
    IDENTITY_STATUS.REJECTED,
    IDENTITY_STATUS.SUSPENDED,
  ],
  [IDENTITY_STATUS.MANUAL_REVIEW]: [
    IDENTITY_STATUS.VERIFIED,
    IDENTITY_STATUS.REJECTED,
    IDENTITY_STATUS.SUSPENDED,
    IDENTITY_STATUS.PENDING_IDENTITY_VERIFICATION,
  ],
  [IDENTITY_STATUS.VERIFIED]: [
    IDENTITY_STATUS.SUSPENDED,
    IDENTITY_STATUS.MANUAL_REVIEW,
  ],
  [IDENTITY_STATUS.REJECTED]: [
    IDENTITY_STATUS.PENDING_IDENTITY_VERIFICATION,
    IDENTITY_STATUS.MANUAL_REVIEW,
    IDENTITY_STATUS.SUSPENDED,
  ],
  [IDENTITY_STATUS.SUSPENDED]: [
    IDENTITY_STATUS.CONTACT_VERIFIED,
    IDENTITY_STATUS.MANUAL_REVIEW,
    IDENTITY_STATUS.VERIFIED,
  ],
}

export const NAME_MATCH_CONFIDENCE = {
  EXACT: 'EXACT',
  HIGH: 'HIGH',
  MODERATE: 'MODERATE',
  LOW: 'LOW',
  MISMATCH: 'MISMATCH',
}

export const IDENTITY_PROVIDERS = {
  MANUAL: 'manual',
  MOCK: 'mock_id_provider',
  DIGILOCKER: 'digilocker',
  HYPERVERGE: 'hyperverge',
  IDFY: 'idfy',
}

export const DOCUMENT_TYPES = {
  AADHAAR: 'aadhaar',
  PAN: 'pan',
  VOTER_ID: 'voter_id',
  DRIVING_LICENCE: 'driving_licence',
  PASSPORT: 'passport',
  OTHER: 'other',
}

/**
 * Reserved system names and clearly prohibited/abusive words
 * Configurable list to prevent malicious or deceptive account names
 */
export const PROHIBITED_NAME_TERMS = [
  'admin',
  'administrator',
  'support',
  'a2z',
  'a2zservice',
  'a2zhelp',
  'system',
  'official',
  'moderator',
  'helpdesk',
  'customer care',
  'security',
  'superuser',
  'root',
  'null',
  'undefined',
  'anonymous',
]
