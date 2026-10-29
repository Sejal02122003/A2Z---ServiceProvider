export const REQUEST_STATUS = {
  PENDING_REVIEW: 'pending_review',
  CONFIRMED: 'confirmed',
  ALLOCATING: 'allocating',
  ASSIGNED: 'assigned',
  IN_PROGRESS: 'in_progress',
  ATTENDANCE: 'attendance_tracking',
  BILLING: 'billing',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
}

export const CONTRACTOR_WORKFLOW = [
  { id: 'approved', label: 'Account approved', statuses: [] },
  { id: 'submitted', label: 'Bulk requirement', statuses: [REQUEST_STATUS.PENDING_REVIEW] },
  { id: 'review', label: 'Admin review', statuses: [REQUEST_STATUS.CONFIRMED, REQUEST_STATUS.ALLOCATING] },
  { id: 'deploy', label: 'Deployed', statuses: [REQUEST_STATUS.ASSIGNED, REQUEST_STATUS.IN_PROGRESS] },
  { id: 'attendance', label: 'Attendance', statuses: [REQUEST_STATUS.ATTENDANCE] },
  { id: 'billing', label: 'Billing', statuses: [REQUEST_STATUS.BILLING, REQUEST_STATUS.COMPLETED] },
]

export const INDIVIDUAL_WORKFLOW = [
  { id: 'submitted', label: 'Request raised', statuses: [REQUEST_STATUS.PENDING_REVIEW] },
  { id: 'review', label: 'Admin review', statuses: [REQUEST_STATUS.CONFIRMED, REQUEST_STATUS.ALLOCATING] },
  { id: 'assigned', label: 'Service Providers assigned', statuses: [REQUEST_STATUS.ASSIGNED] },
  { id: 'work', label: 'Work on site', statuses: [REQUEST_STATUS.IN_PROGRESS, REQUEST_STATUS.ATTENDANCE] },
  { id: 'payment', label: 'Payment processed', statuses: [REQUEST_STATUS.BILLING, REQUEST_STATUS.COMPLETED] },
]

export const LABOUR_WORKFLOW = [
  { id: 'alert', label: 'Assignment alert', statuses: ['offered'] },
  { id: 'accept', label: 'Accept / decline', statuses: ['accepted'] },
  { id: 'onsite', label: 'Check-in', statuses: ['on_site'] },
  { id: 'complete', label: 'Shift complete', statuses: ['completed'] },
]

export function sourceTypeLabel(sourceType) {
  if (sourceType === 'contractor') return 'Contractor bulk'
  if (sourceType === 'customer') return 'Homeowner'
  return 'Request'
}

export function individualWorkflowStepIndex(status) {
  const steps = INDIVIDUAL_WORKFLOW
  for (let i = 0; i < steps.length; i++) {
    if (steps[i].statuses.includes(status)) return i
  }
  return 0
}

export function labourWorkflowStepIndex(status) {
  const steps = LABOUR_WORKFLOW
  for (let i = 0; i < steps.length; i++) {
    if (steps[i].statuses.includes(status)) return i
  }
  return 0
}

export function requestWorkflowStepIndex(sourceType, status) {
  const steps = sourceType === 'contractor' ? CONTRACTOR_WORKFLOW : INDIVIDUAL_WORKFLOW
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].statuses.includes(status)) return i
  }
  return 0
}

export function mapRequestStatusToIndividualBooking(status) {
  const map = {
    pending_review: 'pending',
    confirmed: 'confirmed',
    allocating: 'finding',
    assigned: 'assigned',
    in_progress: 'in_progress',
    attendance_tracking: 'in_progress',
    billing: 'completed',
    completed: 'completed',
    cancelled: 'cancelled',
  }
  return map[status] || 'pending'
}
