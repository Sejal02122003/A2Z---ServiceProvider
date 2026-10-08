import { SystemSetting } from '../models/SystemSetting.js'
import { UserSubscription } from '../models/UserSubscription.js'
import { HTTP_STATUS, sendError } from '../utils/apiResponse.js'
import { USER_ROLES, KYC_STATUS } from '../constants/roles.js'

export const requireLabourSubscription = async (req, res, next) => {
  if (req.user.role !== USER_ROLES.LABOUR) {
    return next() // Only applies to labours
  }

  // 1. Must be verified & active
  if (req.user.labourProfile?.kycStatus !== KYC_STATUS.VERIFIED) {
    return sendError(res, {
      message: 'Your account must be verified by admin first',
      statusCode: HTTP_STATUS.FORBIDDEN,
      code: 'UNVERIFIED',
    })
  }

  // Check Vendor Trial / Blocked / Inactive Status
  if (req.user.isActive === false || req.user.vendorStatus === 'BLOCKED') {
    return sendError(res, {
      message: 'Your service provider account is currently blocked.',
      statusCode: HTTP_STATUS.FORBIDDEN,
      code: 'ACCOUNT_BLOCKED',
    })
  }

  if (req.user.vendorStatus === 'REJECTED') {
    return sendError(res, {
      message: 'Your service provider application was not approved.',
      statusCode: HTTP_STATUS.FORBIDDEN,
      code: 'ACCOUNT_REJECTED',
    })
  }

  if (req.user.vendorStatus === 'TRIAL_PAUSED') {
    return sendError(res, {
      message: 'Your trial services are temporarily paused by admin.',
      statusCode: HTTP_STATUS.FORBIDDEN,
      code: 'TRIAL_PAUSED',
    })
  }

  if (req.user.vendorStatus === 'FINAL_FAILURE' || req.user.vendorStatus === 'FINAL_CHANCE_PAYMENT_PENDING') {
    return sendError(res, {
      message: 'Your trial requires final chance penalty payment before taking new bookings.',
      statusCode: HTTP_STATUS.FORBIDDEN,
      code: 'FINAL_CHANCE_REQUIRED',
    })
  }

  if (req.user.vendorStatus === 'PENDING_ADMIN_CONFIRMATION' || req.user.vendorStatus === 'ADMIN_REVIEW_REQUIRED') {
    return sendError(res, {
      message: 'Your trial period is completed and your profile is pending final admin confirmation.',
      statusCode: HTTP_STATUS.FORBIDDEN,
      code: 'PENDING_CONFIRMATION',
    })
  }

  const settings = await SystemSetting.findOne({ configKey: 'master_config' })
  const startHour = settings?.subscriptionStartHour || 8
  const endHour = settings?.subscriptionEndHour || 20

  const now = new Date()
  const currentHour = now.getHours()

  // 2. Check operational window
  if (currentHour < startHour || currentHour >= endHour) {
    return sendError(res, {
      message: `The platform is only operational between ${startHour}:00 and ${endHour}:00`,
      statusCode: HTTP_STATUS.FORBIDDEN,
      code: 'OUTSIDE_OPERATIONAL_HOURS',
    })
  }

  // 3. Check Free Trial
  const trialEnds = req.user.labourProfile?.trialEndsAt
  if (trialEnds && now <= new Date(trialEnds)) {
    return next() // Trial is active
  }

  // 4. Check Daily Subscription
  const today = now.toISOString().split('T')[0]
  const activeSub = await UserSubscription.findOne({
    labour: req.user._id,
    date: { $lte: today },
    endDate: { $gte: today },
    status: 'active'
  })

  if (!activeSub) {
    return sendError(res, {
      message: 'You need an active daily subscription to receive bookings today',
      statusCode: HTTP_STATUS.FORBIDDEN,
      code: 'NO_ACTIVE_SUBSCRIPTION',
    })
  }

  next()
}
