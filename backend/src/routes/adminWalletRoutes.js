import { Router } from 'express'
import { body, param } from 'express-validator'
import { protect, restrictTo } from '../middleware/auth.js'
import { validateRequest } from '../middleware/validateRequest.js'
import { USER_ROLES } from '../constants/roles.js'
import * as adminWallet from '../controllers/adminWalletController.js'
import * as adminRecharge from '../controllers/adminWalletRechargeController.js'

const router = Router()

router.use(protect, restrictTo(USER_ROLES.ADMIN))

router.get('/settings', adminWallet.getAdminWalletSettings)
router.put(
  '/settings',
  [
    body('welcomeBonusAmount')
      .optional()
      .custom((val) => {
        const num = Number(val)
        if (isNaN(num) || !Number.isInteger(num) || num < 500 || num > 1500) {
          throw new Error('Welcome bonus amount must be a whole rupee amount between ₹500 and ₹1,500')
        }
        return true
      }),
    body('welcomeBonusEnabled')
      .optional()
      .isBoolean()
      .withMessage('welcomeBonusEnabled must be a boolean'),
    body('enabled')
      .optional()
      .isBoolean()
      .withMessage('enabled must be a boolean'),
    body('walletDiscountPercentage')
      .optional()
      .custom((val) => {
        if (val === null || val === '' || typeof val === 'boolean') {
          throw new Error('Wallet deduction percentage must be a valid number between 0 and 100')
        }
        const num = Number(val)
        if (isNaN(num) || !isFinite(num) || num < 0 || num > 100) {
          throw new Error('Wallet deduction percentage must be a valid number between 0 and 100')
        }
        return true
      }),
    body('minimumBookingAmount')
      .optional()
      .custom((val) => {
        if (val === null || val === '' || typeof val === 'boolean') {
          throw new Error('Minimum booking amount must be a non-negative number')
        }
        const num = Number(val)
        if (isNaN(num) || !isFinite(num) || num < 0) {
          throw new Error('Minimum booking amount must be a non-negative number')
        }
        return true
      }),
    body('serviceCreditEnabled')
      .optional()
      .isBoolean()
      .withMessage('serviceCreditEnabled must be a boolean'),
    body('serviceCreditPercentage')
      .optional()
      .isFloat({ min: 0, max: 100 })
      .withMessage('serviceCreditPercentage must be a number between 0 and 100'),
    body('serviceCreditMaxAmount')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('serviceCreditMaxAmount must be a non-negative number'),
    body('serviceCreditMinBookingAmount')
      .optional()
      .isFloat({ min: 0 })
      .withMessage('serviceCreditMinBookingAmount must be a non-negative number'),
    body('serviceCreditApplicablePaymentMethods')
      .optional()
      .isArray()
      .withMessage('serviceCreditApplicablePaymentMethods must be an array of payment methods'),
    body('reason')
      .optional()
      .isString()
      .trim(),
  ],
  validateRequest,
  adminWallet.updateAdminWalletSettings
)

router.post(
  '/service-credit/retry/:bookingId',
  [param('bookingId').isMongoId().withMessage('Invalid bookingId')],
  validateRequest,
  adminWallet.retryBookingServiceCredit
)

router.post(
  '/service-credit/reverse/:bookingId',
  [
    param('bookingId').isMongoId().withMessage('Invalid bookingId'),
    body('reason').optional().isString().trim(),
  ],
  validateRequest,
  adminWallet.reverseBookingServiceCredit
)

router.get('/labour-stats', adminWallet.getLabourWalletStats)
router.get('/transactions', adminWallet.getAllWalletTransactions)

// ==========================================
// CENTRALIZED WALLET RECHARGE APPROVAL ROUTES
// ==========================================
router.get('/recharge-requests', adminRecharge.getRechargeRequests)
router.get(
  '/recharge-requests/:requestId',
  [param('requestId').isMongoId().withMessage('Invalid requestId')],
  validateRequest,
  adminRecharge.getRechargeRequestById,
)
router.patch(
  '/recharge-requests/:requestId/approve',
  [param('requestId').isMongoId().withMessage('Invalid requestId')],
  validateRequest,
  adminRecharge.approveRequest,
)
router.patch(
  '/recharge-requests/:requestId/reject',
  [
    param('requestId').isMongoId().withMessage('Invalid requestId'),
    body('rejectionReason').isString().trim().notEmpty().withMessage('Rejection reason is mandatory'),
  ],
  validateRequest,
  adminRecharge.rejectRequest,
)
router.get('/statistics', adminRecharge.getWalletStatistics)

router.post(
  '/reconcile-settlement/:bookingId',
  [param('bookingId').isMongoId().withMessage('Invalid bookingId')],
  validateRequest,
  adminWallet.reconcileBookingSettlement,
)

router.get('/users', adminWallet.getAdminUserWallets)
router.get('/users/:userId', adminWallet.getAdminUserWalletDetails)
router.post(
  '/users/:userId/adjust',
  // Some admin screens send the direction as `action`, others as `type`. Accept both.
  (req, _res, next) => {
    const raw = req.body?.type ?? req.body?.action
    if (req.body && typeof raw === 'string') req.body.type = raw.trim().toUpperCase()
    next()
  },
  [
    param('userId').isMongoId().withMessage('Invalid userId'),
    body('amount').isFloat({ min: 0.01 }).withMessage('Amount must be positive number'),
    body('type').isIn(['CREDIT', 'DEBIT']).withMessage('Type must be CREDIT or DEBIT'),
    body('reason').isString().trim().notEmpty().withMessage('Reason is required'),
  ],
  validateRequest,
  adminWallet.adjustAdminUserWallet,
)

router.get('/withdrawals', adminWallet.getAllWithdrawalRequests)
router.get('/vendor-withdrawals', adminWallet.getAllVendorWithdrawalRequests)
router.get('/vendor-stats', adminWallet.getVendorWalletStats)

router.patch(
  '/withdrawals/:id',
  [
    param('id').isMongoId().withMessage('Invalid id'),
    body('status').isIn(['APPROVED', 'REJECTED']).withMessage('Status must be APPROVED or REJECTED'),
    body('adminRemarks').optional().isString(),
  ],
  validateRequest,
  adminWallet.processWithdrawalRequest,
)

router.delete(
  '/withdrawals/:id',
  [
    param('id').isMongoId().withMessage('Invalid id'),
  ],
  validateRequest,
  adminWallet.deleteWithdrawalRequest,
)

export default router
