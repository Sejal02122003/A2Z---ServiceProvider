import { Router } from 'express'
import { body } from 'express-validator'
import { protect, optionalAuth, restrictTo } from '../middleware/auth.js'
import { requireLabourSubscription } from '../middleware/requireLabourSubscription.js'
import { validateRequest } from '../middleware/validateRequest.js'
import { USER_ROLES } from '../constants/roles.js'
import * as booking from '../controllers/bookingController.js'

const router = Router()

router.post(
  '/calculate',
  optionalAuth,
  [
    body('serviceId').optional().isMongoId().withMessage('Valid service ID required'),
    body('packageId').optional().isMongoId().withMessage('Valid package ID required'),
    body('items').optional().isArray().withMessage('Items must be an array'),
    body().custom((val) => {
      const hasItems = Array.isArray(val.items) && val.items.length > 0
      if (!val.serviceId && !val.packageId && !hasItems) {
        throw new Error('Either serviceId, packageId, or items must be provided')
      }
      return true
    }),
  ],
  validateRequest,
  booking.calculateBill,
)

router.use(protect)

router.post(
  '/',
  [
    body('serviceId').optional().isMongoId().withMessage('Valid service ID required'),
    body('packageId').optional().isMongoId().withMessage('Valid package ID required'),
    body('items').optional().isArray().withMessage('Items must be an array'),
    body().custom((val) => {
      const hasItems = Array.isArray(val.items) && val.items.length > 0
      if (!val.serviceId && !val.packageId && !hasItems) {
        throw new Error('Either serviceId, packageId, or items must be provided')
      }
      return true
    }),
    body('type').isIn(['INSTANT', 'SCHEDULED']).withMessage('Invalid booking type'),
    body('locationText').trim().notEmpty().withMessage('Location is required'),
    body('paymentMethod').isIn(['ONLINE', 'CASH']).withMessage('Invalid payment method'),
  ],
  validateRequest,
  booking.createBooking,
)

router.get('/me', booking.getMyBookings)
router.get('/:id', booking.getBookingStatus)

router.post(
  '/:id/confirm-cash',
  restrictTo(USER_ROLES.CUSTOMER),
  booking.confirmCashPayment
)

router.get(
  '/:id/cancel-eligibility',
  restrictTo(USER_ROLES.CUSTOMER, USER_ROLES.CONTRACTOR),
  booking.getCustomerCancellationEligibilityController
)

router.post(
  '/:id/cancel',
  restrictTo(USER_ROLES.CUSTOMER, USER_ROLES.CONTRACTOR),
  [
    body('reason').trim().notEmpty().withMessage('Cancellation reason is required'),
    body('reasonNote').optional().trim(),
  ],
  validateRequest,
  booking.cancelCustomerBooking
)

router.post(
  '/:id/reschedule',
  restrictTo(USER_ROLES.CUSTOMER, USER_ROLES.CONTRACTOR),
  [
    body('scheduledAt').notEmpty().withMessage('scheduledAt date is required'),
    body('timeSlot').optional().trim(),
    body('reason').optional().trim(),
    body('reasonNote').optional().trim(),
  ],
  validateRequest,
  booking.rescheduleBookingController
)

router.post(
  '/:id/items/:itemId/cancel',
  restrictTo(USER_ROLES.CUSTOMER, USER_ROLES.CONTRACTOR),
  [
    body('reason').trim().notEmpty().withMessage('Cancellation reason is required'),
    body('reasonNote').optional().trim(),
  ],
  validateRequest,
  booking.cancelBookingItem
)
router.patch(
  '/:id/status',
  [
    body('status').isIn(['EN_ROUTE', 'STARTED', 'COMPLETED', 'CANCELLED']).withMessage('Invalid status'),
  ],
  validateRequest,
  requireLabourSubscription,
  booking.updateBookingStatus,
)

router.patch(
  '/:id/payment-method',
  [
    body('paymentMethod').isIn(['ONLINE', 'CASH']).withMessage('Invalid payment method'),
  ],
  validateRequest,
  booking.updatePaymentMethod,
)

router.post(
  '/:id/extra-time',
  [
    body('extraHours').isNumeric().withMessage('extraHours must be a number'),
    // Optional assignmentId if it's for a specific worker
    body('assignmentId').optional().isMongoId().withMessage('Valid assignment ID required'),
  ],
  validateRequest,
  booking.addExtraTime,
)

router.post(
  '/:id/invoice',
  booking.generateMyInvoice
)

export default router
