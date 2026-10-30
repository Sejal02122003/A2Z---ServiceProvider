import { Router } from 'express'
import { body } from 'express-validator'
import { protect } from '../middleware/auth.js'
import { validateRequest } from '../middleware/validateRequest.js'
import { getActiveQrConfig } from '../controllers/adminPaymentConfigController.js'
import * as payment from '../controllers/paymentController.js'

const router = Router()

router.use(protect)

// GET /api/v1/payments/qr-config - Fetch latest active QR configuration
router.get('/qr-config', getActiveQrConfig)


router.post(
  '/init',
  [
    body('amount').isNumeric().withMessage('Amount is required'),
    body('purpose').isIn(['BOOKING', 'WALLET_CLEARANCE', 'INVOICE', 'SUBSCRIPTION', 'WORKFORCE_REQUEST', 'TRIAL_PENALTY', 'WALLET_TOPUP']).withMessage('Invalid purpose'),
    body('bookingId').optional().isMongoId(),
    body('invoiceId').optional().isMongoId(),
    body('planId').optional().isMongoId(),
    body('requestId').optional().isMongoId()
  ],
  validateRequest,
  payment.initPayment,
)

router.post(
  '/verify',
  [
    body('razorpayOrderId').notEmpty().withMessage('razorpayOrderId is required'),
    body('razorpayPaymentId').optional(), // Option in mock mode
    body('razorpaySignature').optional(), // Option in mock mode
  ],
  validateRequest,
  payment.verifyPayment,
)

export default router
