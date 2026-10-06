import { Router } from 'express'
import { body } from 'express-validator'
import { protect, restrictTo } from '../middleware/auth.js'
import { validateRequest } from '../middleware/validateRequest.js'
import { USER_ROLES } from '../constants/roles.js'
import { uploadMediaMulter } from '../middleware/uploadMiddleware.js'
import * as settings from '../controllers/systemSettingController.js'

const router = Router()

// Public route — returns only the time slots (no auth required)
router.get('/public', async (req, res) => {
  try {
    const { SystemSetting } = await import('../models/SystemSetting.js')
    const { sendSuccess } = await import('../utils/apiResponse.js')
    let settings = await SystemSetting.findOne({ configKey: 'master_config' })
    const timeSlots = settings?.timeSlots || ['08:00 AM', '10:00 AM', '12:00 PM', '02:00 PM', '04:00 PM', '06:00 PM']
    const freeTrialMessage = settings?.freeTrialMessage || 'Welcome! Enjoy your free trial period.'
    const paymentModes = settings?.paymentModes || { cashEnabled: true, onlineEnabled: true }
    const branding = settings?.branding || { logoUrl: null, faviconUrl: null }
    return sendSuccess(res, { data: { timeSlots, freeTrialMessage, paymentModes, branding } })
  } catch (e) {
    res.status(500).json({ success: false, message: 'Could not load public settings' })
  }
})

// Only Admins can manage System Settings
router.use(protect, restrictTo(USER_ROLES.ADMIN))

router.get('/', settings.getSystemSettings)

router.patch(
  '/platform-fees',
  [
    body('type').optional().isIn(['fixed', 'percentage']),
    body('value').optional().isNumeric(),
    body('isActive').optional().isBoolean(),
  ],
  validateRequest,
  settings.updatePlatformFees,
)

router.patch(
  '/commission',
  [
    body('type').optional().isIn(['global', 'category', 'service']),
    body('globalPercentage').optional().isNumeric(),
    body('isActive').optional().isBoolean(),
  ],
  validateRequest,
  settings.updateCommission,
)

router.patch(
  '/labour-cash-limit',
  [
    body('labourCashLimit').isNumeric().withMessage('Labour cash limit is required'),
  ],
  validateRequest,
  settings.updateLabourCashLimit,
)



router.patch(
  '/gst',
  [
    body('gstPercentage').isNumeric().withMessage('GST percentage is required'),
  ],
  validateRequest,
  settings.updateGstPercentage,
)

router.patch(
  '/penalty',
  [
    body('cancellationPenalty').isNumeric().withMessage('Cancellation penalty is required'),
  ],
  validateRequest,
  settings.updateCancellationPenalty,
)

router.patch(
  '/time-slots',
  [
    body('timeSlots').isArray({ min: 1 }).withMessage('timeSlots must be a non-empty array'),
    body('timeSlots.*').isString().trim().notEmpty().withMessage('Each time slot must be a non-empty string'),
  ],
  validateRequest,
  settings.updateTimeSlots,
)

router.patch(
  '/user-subscription-toggle',
  [
    body('isUserSubscriptionEnabled').isBoolean().withMessage('isUserSubscriptionEnabled must be a boolean'),
  ],
  validateRequest,
  settings.updateUserSubscriptionToggle,
)

router.patch(
  '/dynamic-subscription',
  [
    body('dailySubscriptionPrice').optional().isNumeric(),
    body('freeTrialDays').optional().isNumeric(),
    body('freeTrialMessage').optional().isString().trim(),
    body('subscriptionStartHour').optional().isNumeric(),
    body('subscriptionEndHour').optional().isNumeric(),
  ],
  validateRequest,
  settings.updateDynamicSubscriptionSettings,
)

router.patch(
  '/max-hour-discount',
  [
    body('maxHourDiscountPercentage').isNumeric().withMessage('maxHourDiscountPercentage is required'),
  ],
  validateRequest,
  settings.updateMaxHourDiscount,
)

router.patch(
  '/payment-modes',
  [
    body('cashEnabled').optional().isBoolean(),
    body('onlineEnabled').optional().isBoolean(),
  ],
  validateRequest,
  settings.updatePaymentModes,
)

router.patch(
  '/simulated-opportunities-toggle',
  [
    body('simulatedOpportunitiesEnabled').isBoolean().withMessage('simulatedOpportunitiesEnabled must be a boolean'),
  ],
  validateRequest,
  settings.updateSimulatedOpportunitiesToggle,
)

router.post(
  '/branding',
  uploadMediaMulter,
  [
    body('type').isIn(['logo', 'favicon']).withMessage('type must be logo or favicon'),
  ],
  validateRequest,
  settings.uploadBranding
)

router.delete(
  '/branding/:type',
  settings.deleteBranding
)

export default router
