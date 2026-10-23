import { Router } from 'express'
import { body, param, query } from 'express-validator'
import { protect, restrictTo } from '../middleware/auth.js'
import { validateRequest } from '../middleware/validateRequest.js'
import * as user from '../controllers/userController.js'
import { USER_ROLES } from '../constants/roles.js'
import { validateUserIdParam } from '../validators/authValidators.js'

const router = Router()

router.get(
  '/discover/labours',
  [
    query('groupId').optional().isMongoId().withMessage('groupId must be a valid id'),
    query('categoryId').optional().isMongoId().withMessage('categoryId must be a valid id'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('limit must be 1–50'),
  ],
  validateRequest,
  user.listDiscoverLabours,
)

router.get(
  '/discover/labours/:id',
  [param('id').isMongoId().withMessage('Invalid user id')],
  validateRequest,
  user.getDiscoverLabour,
)

router.post('/test-notification', user.testNotification)

// Publicly available trial slots and evaluation hub address (used during onboarding & registration)
router.get(
  '/trial-slots',
  user.getAvailableTrialSlots,
)

router.use(protect)

router.get('/me', user.getProfile)
router.delete('/me', user.deleteMe)
router.patch(
  '/me',
  [
    body('fullName').optional().trim().isLength({ min: 2, max: 120 }),
    body('phone').optional().trim().matches(/^\d{10}$/).withMessage('Enter a valid 10-digit phone number'),
    body('email').optional({ checkFalsy: true }).trim().isEmail().withMessage('Enter a valid email address'),
    body('labourProfile.skills').optional().isArray(),
    body('labourProfile.skills.*').optional().trim().isLength({ min: 1, max: 64 }),
    body('labourProfile.experienceYears').optional().isNumeric(),
  ],
  validateRequest,
  user.updateMe,
)

router.patch(
  '/me/labour-categories',
  [
    body('services').optional().isArray(),
    body('services.*.serviceId').optional().isMongoId().withMessage('Invalid service ID'),
    body('services.*.subcategoryId').optional().isMongoId(),
    body('services.*.minPrice').optional().isNumeric(),
    body('services.*.maxPrice').optional().isNumeric(),
    body('categoryIds').optional().isArray(),
    body('subcategoryIds').optional().isArray(),
  ],
  validateRequest,
  user.updateLabourCategories,
)

router.patch(
  '/me/labour/schedule',
  restrictTo(USER_ROLES.LABOUR),
  [
    body('schedule').isArray({ min: 7, max: 7 }).withMessage('Schedule must contain exactly 7 days'),
    body('schedule.*.day').isIn(['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']).withMessage('Invalid day'),
    body('schedule.*.startTime').isString().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid start time format (HH:mm)'),
    body('schedule.*.endTime').isString().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Invalid end time format (HH:mm)'),
    body('schedule.*.isAvailable').isBoolean().withMessage('isAvailable must be boolean'),
  ],
  validateRequest,
  user.updateLabourSchedule,
)

router.post(
  '/me/labour/kyc/submit',
  restrictTo(USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR),
  [
    body('aadhaar').optional({ values: 'falsy' }).isString().trim(),
    body('pan').optional({ values: 'falsy' }).isString().trim(),
    body('videoUrl').optional({ values: 'falsy' }).isString().trim(),
    body('documentUrl').optional({ values: 'falsy' }).isString().trim(),
    body('frontImageUrl').optional({ values: 'falsy' }).isString().trim(),
    body('backImageUrl').optional({ values: 'falsy' }).isString().trim(),
    body('documentUrls').optional().isArray(),
    body('videoMeta').optional().isObject().withMessage('videoMeta must be an object'),
  ],
  validateRequest,
  user.submitLabourKycDocuments,
)

// Partner Onboarding Flow Routes
router.get(
  '/me/onboarding-status',
  (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private')
    res.set('Pragma', 'no-cache')
    res.set('Expires', '0')
    next()
  },
  restrictTo(USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR),
  user.getPartnerOnboardingStatus,
)

router.patch(
  '/me/trial-slot',
  restrictTo(USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR),
  [
    body('date').isString().notEmpty().withMessage('Date is required'),
    body('timeSlot').isString().notEmpty().withMessage('Time slot is required'),
    body('location').optional().isString(),
  ],
  validateRequest,
  user.schedulePartnerTrialSlot,
)

router.post(
  '/me/trial-complete',
  restrictTo(USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR),
  user.completePartnerTrial,
)

router.post(
  '/me/welcome-kit/payment',
  restrictTo(USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR),
  user.submitPartnerWelcomeKitPayment,
)

router.post(
  '/me/welcome-kit/confirm-receipt',
  restrictTo(USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR),
  user.confirmPartnerWelcomeKitReceipt,
)

router.post(
  '/me/welcome-kit/address',
  restrictTo(USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR),
  user.submitPartnerWelcomeKitAddress,
)

router.put(
  '/me/welcome-kit/address',
  restrictTo(USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR),
  user.submitPartnerWelcomeKitAddress,
)

router.get('/', restrictTo(USER_ROLES.ADMIN), user.listUsers)

router.patch(
  '/:id/labour-kyc-review',
  restrictTo(USER_ROLES.ADMIN),
  validateUserIdParam,
  [
    body('decision').isIn(['approved', 'rejected']).withMessage('decision must be approved or rejected'),
    body('note').optional().trim().isLength({ max: 500 }),
  ],
  validateRequest,
  user.reviewLabourKyc,
)

router.patch(
  '/:id/welcome-kit',
  restrictTo(USER_ROLES.ADMIN),
  validateUserIdParam,
  [
    body('uniformIssued').isBoolean().withMessage('uniformIssued must be a boolean'),
    body('idCardIssued').isBoolean().withMessage('idCardIssued must be a boolean'),
    body('bagIssued').isBoolean().withMessage('bagIssued must be a boolean'),
  ],
  validateRequest,
  user.updatePartnerWelcomeKit,
)

router.patch(
  '/:id/welcome-kit/verify-payment',
  restrictTo(USER_ROLES.ADMIN),
  validateUserIdParam,
  [
    body('action').isIn(['APPROVE', 'REJECT', 'ACCEPT']).withMessage('action must be APPROVE or REJECT'),
    body('rejectionReason').optional().trim().isLength({ max: 500 }),
    body('notes').optional().trim().isLength({ max: 500 }),
  ],
  validateRequest,
  user.verifyPartnerWelcomeKitPayment,
)

router.patch(
  '/:id/trial-evaluate',
  restrictTo(USER_ROLES.ADMIN),
  validateUserIdParam,
  [
    body('decision').isIn(['passed', 'failed']).withMessage('decision must be passed or failed'),
    body('notes').optional().trim().isLength({ max: 1000 }),
  ],
  validateRequest,
  user.evaluatePartnerTrialAdmin,
)

router.get('/:id', restrictTo(USER_ROLES.ADMIN), validateUserIdParam, validateRequest, user.getUserById)

router.delete('/:id', restrictTo(USER_ROLES.ADMIN), validateUserIdParam, validateRequest, user.deleteUser)

export default router
