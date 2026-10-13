import { Router } from 'express'
import { body, param } from 'express-validator'
import { protect, restrictTo } from '../middleware/auth.js'
import { validateRequest } from '../middleware/validateRequest.js'
import { USER_ROLES } from '../constants/roles.js'
import * as adminWallet from '../controllers/adminWalletController.js'

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
  ],
  validateRequest,
  adminWallet.updateAdminWalletSettings
)

router.get('/labour-stats', adminWallet.getLabourWalletStats)
router.get('/transactions', adminWallet.getAllWalletTransactions)
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
