import { Router } from 'express'
import { validateRequest } from '../middleware/validateRequest.js'
import { protect } from '../middleware/auth.js'
import * as auth from '../controllers/authController.js'
import {
  validatePhoneBody,
  validateRoleRegister,
  validateOtpCode,
  validateOtpChallengeId,
  validateFullNameOptional,
  validateFullNameRequired,
  validateAdminLogin,
  validateAuthGroup,
} from '../validators/authValidators.js'

const router = Router()

router.post(
  '/register/request-otp',
  [validatePhoneBody, validateRoleRegister, validateFullNameOptional, validateAuthGroup],
  validateRequest,
  auth.registerRequestOtp,
)

router.post(
  '/register/verify',
  [
    validatePhoneBody,
    validateRoleRegister,
    validateOtpChallengeId,
    validateOtpCode,
    validateFullNameRequired,
    validateAuthGroup,
  ],
  validateRequest,
  auth.registerVerify,
)

router.post('/login/request-otp', [validatePhoneBody, validateAuthGroup], validateRequest, auth.loginRequestOtp)

router.post(
  '/login/verify',
  [validatePhoneBody, validateOtpChallengeId, validateOtpCode, validateAuthGroup],
  validateRequest,
  auth.loginVerify,
)

router.post('/admin/login', validateAdminLogin, validateRequest, auth.adminLogin)

router.get('/me', protect, auth.getMe)

router.post('/logout', auth.logout)

export default router
