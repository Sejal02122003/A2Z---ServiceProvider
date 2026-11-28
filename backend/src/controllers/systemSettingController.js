import { SystemSetting } from '../models/SystemSetting.js'
import { BookingCancellationSetting } from '../models/BookingCancellationSetting.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { uploadBufferToCloudinary } from '../services/cloudinaryService.js'
import { resolveChargeConfig } from '../utils/chargeCalculator.js'

function formatSettingsResponse(settingsDoc) {
  const plain = settingsDoc?.toObject ? settingsDoc.toObject() : { ...(settingsDoc || {}) }
  const normalized = resolveChargeConfig(plain)
  return {
    ...plain,
    platformFee: normalized.platformFee,
    gst: normalized.gst,
    gstPercentage: normalized.gst.defaultPercentage,
    commission: normalized.commission,
  }
}

export const getSystemSettings = asyncHandler(async (req, res) => {
  let settings = await SystemSetting.findOne({ configKey: 'master_config' })
  if (!settings) {
    settings = await SystemSetting.create({ configKey: 'master_config' })
  }
  return sendSuccess(res, { data: { settings: formatSettingsResponse(settings) } })
})

export const updatePlatformFees = asyncHandler(async (req, res) => {
  const { type, value, isActive, applyToUser, applyToProvider } = req.body
  let settings = await SystemSetting.findOne({ configKey: 'master_config' })
  if (!settings) settings = new SystemSetting({ configKey: 'master_config' })

  const current = resolveChargeConfig(settings).platformFee
  const targetObj = settings.platformFee || (settings.platformFee = {})

  if (type) targetObj.type = type
  if (value !== undefined) targetObj.value = Math.max(0, Number(value) || 0)

  let nextUser = applyToUser !== undefined ? Boolean(applyToUser) : current.applyToUser
  let nextProvider = applyToProvider !== undefined ? Boolean(applyToProvider) : current.applyToProvider

  if (isActive !== undefined && applyToUser === undefined && applyToProvider === undefined) {
    if (!isActive) {
      nextUser = false
      nextProvider = false
    } else if (!nextUser && !nextProvider) {
      nextUser = true
    }
  }

  targetObj.applyToUser = nextUser
  targetObj.applyToProvider = nextProvider
  targetObj.isActive = nextUser || nextProvider

  await settings.save()
  return sendSuccess(res, { message: 'Platform fees updated', data: { settings: formatSettingsResponse(settings) } })
})

export const updateCommission = asyncHandler(async (req, res) => {
  const { type, globalPercentage, isActive, applyToUser, applyToProvider } = req.body
  let settings = await SystemSetting.findOne({ configKey: 'master_config' })
  if (!settings) settings = new SystemSetting({ configKey: 'master_config' })

  const current = resolveChargeConfig(settings).commission
  const targetObj = settings.commission || (settings.commission = {})

  if (type) targetObj.type = type
  if (globalPercentage !== undefined) {
    targetObj.globalPercentage = Math.max(0, Math.min(100, Number(globalPercentage) || 0))
  }

  let nextUser = applyToUser !== undefined ? Boolean(applyToUser) : current.applyToUser
  let nextProvider = applyToProvider !== undefined ? Boolean(applyToProvider) : current.applyToProvider

  if (isActive !== undefined && applyToUser === undefined && applyToProvider === undefined) {
    if (!isActive) {
      nextUser = false
      nextProvider = false
    } else if (!nextUser && !nextProvider) {
      nextProvider = true
    }
  }

  targetObj.applyToUser = nextUser
  targetObj.applyToProvider = nextProvider
  targetObj.isActive = nextUser || nextProvider

  await settings.save()
  return sendSuccess(res, { message: 'Commission updated', data: { settings: formatSettingsResponse(settings) } })
})

export const updateLabourCashLimit = asyncHandler(async (req, res) => {
  const { labourCashLimit } = req.body
  let settings = await SystemSetting.findOne({ configKey: 'master_config' })
  if (!settings) settings = new SystemSetting({ configKey: 'master_config' })
  
  if (labourCashLimit !== undefined) settings.labourCashLimit = Number(labourCashLimit)
  
  await settings.save()
  return sendSuccess(res, { message: 'Labour cash limit updated', data: { settings: formatSettingsResponse(settings) } })
})



export const updateGstPercentage = asyncHandler(async (req, res) => {
  const { gstPercentage, defaultPercentage, isActive, applyToUser, applyToProvider } = req.body
  let settings = await SystemSetting.findOne({ configKey: 'master_config' })
  if (!settings) settings = new SystemSetting({ configKey: 'master_config' })

  const current = resolveChargeConfig(settings).gst
  if (!settings.gst) settings.gst = {}

  const nextPctRaw = defaultPercentage !== undefined ? defaultPercentage : gstPercentage
  if (nextPctRaw !== undefined) {
    const clampedPct = Math.max(0, Math.min(100, Number(nextPctRaw) || 0))
    settings.gstPercentage = clampedPct
    settings.gst.defaultPercentage = clampedPct
  }

  let nextUser = applyToUser !== undefined ? Boolean(applyToUser) : current.applyToUser
  let nextProvider = applyToProvider !== undefined ? Boolean(applyToProvider) : current.applyToProvider

  if (isActive !== undefined && applyToUser === undefined && applyToProvider === undefined) {
    if (!isActive) {
      nextUser = false
      nextProvider = false
    } else if (!nextUser && !nextProvider) {
      nextUser = true
    }
  }

  settings.gst.applyToUser = nextUser
  settings.gst.applyToProvider = nextProvider
  settings.gst.isActive = nextUser || nextProvider

  await settings.save()
  return sendSuccess(res, { message: 'GST settings updated', data: { settings: formatSettingsResponse(settings) } })
})

export const updateCancellationPenalty = asyncHandler(async (req, res) => {
  const { cancellationPenalty } = req.body
  let settings = await SystemSetting.findOne({ configKey: 'master_config' })
  if (!settings) settings = new SystemSetting({ configKey: 'master_config' })
  
  if (cancellationPenalty !== undefined) {
    const penaltyNum = Math.max(0, Number(cancellationPenalty) || 0)
    settings.cancellationPenalty = penaltyNum
    await settings.save()

    // Keep BookingCancellationSetting in sync for both customer and service provider cancellation
    try {
      let cancelSetting = await BookingCancellationSetting.findOne({
        configKey: 'master_cancellation_config',
      })
      if (!cancelSetting) {
        cancelSetting = new BookingCancellationSetting({
          configKey: 'master_cancellation_config',
        })
      }
      cancelSetting.fixedPenaltyAmount = penaltyNum
      cancelSetting.customerPenaltyValue = penaltyNum
      cancelSetting.customerPenaltyType = 'FIXED'
      await cancelSetting.save()
    } catch (err) {
      console.error('Failed to sync cancellation penalty to BookingCancellationSetting:', err)
    }
  }
  
  return sendSuccess(res, { message: 'Cancellation penalty updated', data: { settings } })
})

export const updateTimeSlots = asyncHandler(async (req, res) => {
  const { timeSlots } = req.body
  if (!Array.isArray(timeSlots)) {
    return sendError(res, { message: 'timeSlots must be an array', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  let settings = await SystemSetting.findOne({ configKey: 'master_config' })
  if (!settings) settings = new SystemSetting({ configKey: 'master_config' })
  
  settings.timeSlots = timeSlots
  await settings.save()
  return sendSuccess(res, { message: 'Time slots updated', data: { settings } })
})

export const updateUserSubscriptionToggle = asyncHandler(async (req, res) => {
  const { isUserSubscriptionEnabled } = req.body
  let settings = await SystemSetting.findOne({ configKey: 'master_config' })
  if (!settings) settings = new SystemSetting({ configKey: 'master_config' })
  
  if (isUserSubscriptionEnabled !== undefined) {
    settings.isUserSubscriptionEnabled = Boolean(isUserSubscriptionEnabled)
  }
  
  await settings.save()
  return sendSuccess(res, { message: 'User subscription toggle updated', data: { settings } })
})

export const updateDynamicSubscriptionSettings = asyncHandler(async (req, res) => {
  const { dailySubscriptionPrice, freeTrialDays, freeTrialMessage, subscriptionStartHour, subscriptionEndHour } = req.body
  let settings = await SystemSetting.findOne({ configKey: 'master_config' })
  if (!settings) settings = new SystemSetting({ configKey: 'master_config' })

  if (dailySubscriptionPrice !== undefined) settings.dailySubscriptionPrice = Number(dailySubscriptionPrice)
  if (freeTrialDays !== undefined) settings.freeTrialDays = Number(freeTrialDays)
  if (freeTrialMessage !== undefined) settings.freeTrialMessage = String(freeTrialMessage)
  if (subscriptionStartHour !== undefined) settings.subscriptionStartHour = Number(subscriptionStartHour)
  if (subscriptionEndHour !== undefined) settings.subscriptionEndHour = Number(subscriptionEndHour)

  await settings.save()
  return sendSuccess(res, { message: 'Dynamic subscription settings updated', data: { settings } })
})

export const updateMaxHourDiscount = asyncHandler(async (req, res) => {
  const { maxHourDiscountPercentage } = req.body
  let settings = await SystemSetting.findOne({ configKey: 'master_config' })
  if (!settings) settings = new SystemSetting({ configKey: 'master_config' })

  if (maxHourDiscountPercentage !== undefined) settings.maxHourDiscountPercentage = Number(maxHourDiscountPercentage)

  await settings.save()
  return sendSuccess(res, { message: 'Max-hour discount updated', data: { settings } })
})

export const updateWelcomeKitFee = asyncHandler(async (req, res) => {
  const fee = Number(req.body.welcomeKitFee)
  if (!Number.isFinite(fee) || fee < 0) {
    return sendError(res, { message: 'Welcome kit fee must be a number of 0 or more', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  let settings = await SystemSetting.findOne({ configKey: 'master_config' })
  if (!settings) settings = new SystemSetting({ configKey: 'master_config' })
  settings.welcomeKitFee = Math.round(fee)
  await settings.save()
  return sendSuccess(res, { message: 'Welcome kit fee updated', data: { settings } })
})

export const updateSupportContact = asyncHandler(async (req, res) => {
  let settings = await SystemSetting.findOne({ configKey: 'master_config' })
  if (!settings) settings = new SystemSetting({ configKey: 'master_config' })

  for (const field of ['supportPhone', 'emergencyPhone', 'whatsappNumber', 'supportEmail']) {
    if (req.body[field] !== undefined) settings.supportContact[field] = req.body[field]
  }
  settings.updatedBy = req.user._id

  await settings.save()
  return sendSuccess(res, { message: 'Support contact updated', data: { settings } })
})

export const updatePaymentModes =asyncHandler(async (req, res) => {
  const { cashEnabled, onlineEnabled } = req.body
  let settings = await SystemSetting.findOne({ configKey: 'master_config' })
  if (!settings) settings = new SystemSetting({ configKey: 'master_config' })

  if (!settings.paymentModes) {
    settings.paymentModes = { cashEnabled: true, onlineEnabled: true }
  }

  if (cashEnabled !== undefined) settings.paymentModes.cashEnabled = Boolean(cashEnabled)
  if (onlineEnabled !== undefined) settings.paymentModes.onlineEnabled = Boolean(onlineEnabled)

  await settings.save()
  return sendSuccess(res, { message: 'Payment modes updated', data: { settings } })
})

export const uploadBranding = asyncHandler(async (req, res) => {
  const { type } = req.body // 'logo' or 'favicon'
  if (!['logo', 'favicon'].includes(type)) {
    return sendError(res, { message: 'Invalid branding type. Must be logo or favicon.', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  if (!req.file) {
    return sendError(res, { message: 'No file uploaded', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const uploadResult = await uploadBufferToCloudinary({
    buffer: req.file.buffer,
    mimetype: req.file.mimetype,
    folder: `a2z/branding/${type}`,
    userId: req.user?._id,
    originalName: req.file.originalname,
  })

  let settings = await SystemSetting.findOne({ configKey: 'master_config' })
  if (!settings) settings = new SystemSetting({ configKey: 'master_config' })

  if (!settings.branding) {
    settings.branding = { logoUrl: null, faviconUrl: null }
  }

  if (type === 'logo') {
    settings.branding.logoUrl = uploadResult.url
  } else {
    settings.branding.faviconUrl = uploadResult.url
  }

  await settings.save()

  return sendSuccess(res, { message: `${type} uploaded successfully`, data: { branding: settings.branding } })
})

export const deleteBranding = asyncHandler(async (req, res) => {
  const { type } = req.params
  if (!['logo', 'favicon'].includes(type)) {
    return sendError(res, { message: 'Invalid branding type. Must be logo or favicon.', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  let settings = await SystemSetting.findOne({ configKey: 'master_config' })
  if (!settings) settings = new SystemSetting({ configKey: 'master_config' })

  if (!settings.branding) {
    settings.branding = { logoUrl: null, faviconUrl: null }
  }

  if (type === 'logo') {
    settings.branding.logoUrl = null
  } else {
    settings.branding.faviconUrl = null
  }

  await settings.save()

  return sendSuccess(res, { message: `${type} deleted successfully`, data: { branding: settings.branding } })
})

export const updateSimulatedOpportunitiesToggle = asyncHandler(async (req, res) => {
  const { simulatedOpportunitiesEnabled } = req.body
  let settings = await SystemSetting.findOne({ configKey: 'master_config' })
  if (!settings) {
    settings = new SystemSetting({ configKey: 'master_config' })
  }
  settings.simulatedOpportunitiesEnabled = Boolean(simulatedOpportunitiesEnabled)
  settings.updatedBy = req.user._id
  await settings.save()

  return sendSuccess(res, {
    message: 'Simulated opportunities setting updated successfully',
    data: { simulatedOpportunitiesEnabled: settings.simulatedOpportunitiesEnabled },
  })
})

