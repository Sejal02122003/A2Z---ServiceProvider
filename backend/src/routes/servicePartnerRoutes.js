import { Router } from 'express'
import { body, param } from 'express-validator'
import { protect, restrictTo } from '../middleware/auth.js'
import { validateRequest } from '../middleware/validateRequest.js'
import * as user from '../controllers/userController.js'
import { USER_ROLES } from '../constants/roles.js'

const router = Router()

router.use(protect)
router.use(restrictTo(USER_ROLES.ADMIN))

/**
 * GET /api/service-partners/welcome-kit-stats
 */
router.get('/welcome-kit-stats', user.getPartnerWelcomeKitStats)

/**
 * PATCH /api/service-partners/:partnerId/welcome-kit
 */
router.patch(
  '/:partnerId/welcome-kit',
  [
    param('partnerId').isMongoId().withMessage('partnerId must be a valid MongoDB ObjectId'),
    body('uniformIssued').isBoolean().withMessage('uniformIssued must be a boolean (true or false)'),
    body('idCardIssued').isBoolean().withMessage('idCardIssued must be a boolean (true or false)'),
    body('bagIssued').isBoolean().withMessage('bagIssued must be a boolean (true or false)'),
  ],
  validateRequest,
  user.updatePartnerWelcomeKit,
)

/**
 * PATCH /api/service-partners/:partnerId/welcome-kit/verify-payment
 * Admin accepts or rejects the welcome kit offline payment screenshot
 */
router.patch(
  '/:partnerId/welcome-kit/verify-payment',
  [
    param('partnerId').isMongoId().withMessage('partnerId must be a valid MongoDB ObjectId'),
    body('action').isIn(['APPROVE', 'REJECT', 'ACCEPT']).withMessage('action must be APPROVE or REJECT'),
    body('rejectionReason').optional().trim().isLength({ max: 500 }),
    body('notes').optional().trim().isLength({ max: 500 }),
  ],
  validateRequest,
  user.verifyPartnerWelcomeKitPayment,
)

/**
 * POST /api/service-partners/:partnerId/welcome-kit/address
 * PUT /api/service-partners/:partnerId/welcome-kit/address
 * PATCH /api/service-partners/:partnerId/welcome-kit/address
 * Admin enters or updates welcome kit delivery address on behalf of partner
 */
router.post(
  ['/:partnerId/welcome-kit/address', '/:partnerId/welcome-kit/delivery-address'],
  [param('partnerId').isMongoId().withMessage('partnerId must be a valid MongoDB ObjectId')],
  validateRequest,
  user.adminSubmitPartnerWelcomeKitAddress,
)
router.put(
  ['/:partnerId/welcome-kit/address', '/:partnerId/welcome-kit/delivery-address'],
  [param('partnerId').isMongoId().withMessage('partnerId must be a valid MongoDB ObjectId')],
  validateRequest,
  user.adminSubmitPartnerWelcomeKitAddress,
)
router.patch(
  ['/:partnerId/welcome-kit/address', '/:partnerId/welcome-kit/delivery-address'],
  [param('partnerId').isMongoId().withMessage('partnerId must be a valid MongoDB ObjectId')],
  validateRequest,
  user.adminSubmitPartnerWelcomeKitAddress,
)

/**
 * POST & PATCH /api/service-partners/:partnerId/welcome-kit/request-address-correction
 * Admin requests address correction from service provider (supports /address/request-correction alias)
 */
router.post(
  ['/:partnerId/welcome-kit/request-address-correction', '/:partnerId/welcome-kit/address/request-correction'],
  [
    param('partnerId').isMongoId().withMessage('partnerId must be a valid MongoDB ObjectId'),
    body('reason').trim().notEmpty().withMessage('reason is required to request address correction'),
  ],
  validateRequest,
  user.requestPartnerAddressCorrection,
)
router.patch(
  ['/:partnerId/welcome-kit/request-address-correction', '/:partnerId/welcome-kit/address/request-correction'],
  [
    param('partnerId').isMongoId().withMessage('partnerId must be a valid MongoDB ObjectId'),
    body('reason').trim().notEmpty().withMessage('reason is required to request address correction'),
  ],
  validateRequest,
  user.requestPartnerAddressCorrection,
)

/**
 * POST & PATCH /api/service-partners/:partnerId/welcome-kit/confirm-address
 * Admin confirms shipping address & marks kit ready for dispatch (supports /address/confirm alias)
 */
router.post(
  ['/:partnerId/welcome-kit/confirm-address', '/:partnerId/welcome-kit/address/confirm'],
  [
    param('partnerId').isMongoId().withMessage('partnerId must be a valid MongoDB ObjectId'),
  ],
  validateRequest,
  user.confirmPartnerWelcomeKitAddress,
)
router.patch(
  ['/:partnerId/welcome-kit/confirm-address', '/:partnerId/welcome-kit/address/confirm'],
  [
    param('partnerId').isMongoId().withMessage('partnerId must be a valid MongoDB ObjectId'),
  ],
  validateRequest,
  user.confirmPartnerWelcomeKitAddress,
)

/**
 * POST /api/service-partners/:partnerId/welcome-kit/dispatch
 * Admin records manual dispatch details (Informational only — No live tracking)
 */
router.post(
  '/:partnerId/welcome-kit/dispatch',
  [
    param('partnerId').isMongoId().withMessage('partnerId must be a valid MongoDB ObjectId'),
    body().custom((val, { req }) => {
      const courier = req.body.courierCompany || req.body.courierName
      if (!courier || typeof courier !== 'string' || courier.trim().length === 0) {
        throw new Error('Courier company name is required')
      }
      return true
    }),
    body('trackingNumber').optional().trim(),
    body('trackingUrl').optional().trim(),
    body('dispatchDate').optional().isISO8601().toDate(),
    body('estimatedDeliveryDate').optional().isISO8601().toDate(),
    body('notes').optional().trim(),
  ],
  validateRequest,
  user.dispatchPartnerWelcomeKit,
)

/**
 * POST /api/service-partners/:partnerId/welcome-kit/confirm-delivery
 * Admin confirms delivery manually
 */
router.post(
  '/:partnerId/welcome-kit/confirm-delivery',
  [
    param('partnerId').isMongoId().withMessage('partnerId must be a valid MongoDB ObjectId'),
    body('notes').optional().trim(),
  ],
  validateRequest,
  user.confirmPartnerWelcomeKitDeliveryAdmin,
)

export default router
