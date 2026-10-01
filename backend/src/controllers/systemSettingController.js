import { SystemSetting } from '../models/SystemSetting.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { uploadBufferToCloudinary } from '../services/cloudinaryService.js'

export const getSystemSettings = asyncHandler(async (req, res) => {
  let settings = await SystemSetting.findOne({ configKey: 'master_config' })
  if (!settings) {
    settings = await SystemSetting.create({ configKey: 'master_config' })
  }
  return sendSuccess(res, { data: { settings } })
})

export const updatePlatformFees = asyncHandler(async (req, res) => {
  const { type, value, isActive } = req.body
  let settings = await SystemSetting.findOne({ configKey: 'master_config' })
  if (!settings) settings = new SystemSetting({ configKey: 'master_config' })
  
  const targetObj = settings.platformFee
  
  if (type) targetObj.type = type
  if (value !== undefined) targetObj.value = Number(value)
  if (isActive !== undefined) targetObj.isActive = Boolean(isActive)
  
  await settings.save()
  return sendSuccess(res, { message: 'Platform fees updated', data: { settings } })
})

export const updateCommission = asyncHandler(async (req, res) => {
  const { type, globalPercentage, isActive, bookingType = 'B2C' } = req.body
  let settings = await SystemSetting.findOne({ configKey: 'master_config' })
  if (!settings) settings = new SystemSetting({ configKey: 'master_config' })
  
  const targetObj = settings.commission
  
  if (type) targetObj.type = type
  if (globalPercentage !== undefined) targetObj.globalPercentage = Number(globalPercentage)
  if (isActive !== undefined) targetObj.isActive = Boolean(isActive)
  
  await settings.save()
  return sendSuccess(res, { message: 'Commission updated', data: { settings } })
})

export const updateLabourCashLimit = asyncHandler(async (req, res) => {
  const { labourCashLimit } = req.body
  let settings = await SystemSetting.findOne({ configKey: 'master_config' })
  if (!settings) settings = new SystemSetting({ configKey: 'master_config' })
  
  if (labourCashLimit !== undefined) settings.labourCashLimit = Number(labourCashLimit)
  
  await settings.save()
  return sendSuccess(res, { message: 'Labour cash limit updated', data: { settings } })
})



export const updateGstPercentage = asyncHandler(async (req, res) => {
  const { gstPercentage } = req.body
  let settings = await SystemSetting.findOne({ configKey: 'master_config' })
  if (!settings) settings = new SystemSetting({ configKey: 'master_config' })
  
  if (gstPercentage !== undefined) settings.gstPercentage = Number(gstPercentage)
  
  await settings.save()
  return sendSuccess(res, { message: 'GST percentage updated', data: { settings } })
})

export const updateCancellationPenalty = asyncHandler(async (req, res) => {
  const { cancellationPenalty } = req.body
  let settings = await SystemSetting.findOne({ configKey: 'master_config' })
  if (!settings) settings = new SystemSetting({ configKey: 'master_config' })
  
  if (cancellationPenalty !== undefined) settings.cancellationPenalty = Number(cancellationPenalty)
  
  await settings.save()
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

export const updatePaymentModes = asyncHandler(async (req, res) => {
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
