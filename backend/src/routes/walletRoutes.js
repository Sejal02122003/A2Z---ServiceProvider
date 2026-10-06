import { Router } from 'express'
import { body } from 'express-validator'
import { protect, restrictTo } from '../middleware/auth.js'
import { validateRequest } from '../middleware/validateRequest.js'
import { USER_ROLES } from '../constants/roles.js'
import * as wallet from '../controllers/walletController.js'

const router = Router()

router.use(protect)

// Both LABOUR and ADMIN can view wallets, but we restrict endpoints accordingly
router.get('/me', restrictTo(USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR), wallet.getMyWallet)

router.get(
  '/earnings-summary',
  restrictTo(USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR),
  wallet.getEarningsSummary,
)

router.post(
  '/clear',
  restrictTo(USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR),
  [
    body('amount').isNumeric().withMessage('Amount is required'),
  ],
  validateRequest,
  wallet.clearAdminDues,
)

router.post(
  '/withdraw',
  restrictTo(USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR),
  wallet.requestWithdrawal,
)

router.get(
  '/withdrawals',
  restrictTo(USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR),
  wallet.getMyWithdrawals,
)

router.get(
  '/transactions',
  restrictTo(USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR),
  wallet.getMyTransactions,
)

export default router
