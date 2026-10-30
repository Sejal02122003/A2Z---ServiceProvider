import { AdminPaymentConfig } from '../models/AdminPaymentConfig.js'
import { ProviderPayment } from '../models/ProviderPayment.js'
import { uploadBufferToCloudinary, deleteCloudinaryAsset } from '../services/cloudinaryService.js'
import { UPLOAD_FOLDERS } from '../constants/uploadFolders.js'
import { getIo } from '../socket.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'

const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_IMAGE_SIZE = 8 * 1024 * 1024 // 8MB

function sanitizePublicConfig(config) {
  if (!config) return null
  return {
    id: config._id,
    paymentMethod: config.paymentMethod || 'UPI_QR',
    paymentPurpose: config.paymentPurpose || 'ALL',
    displayName: config.displayName,
    upiId: config.upiId || '',
    qrImageUrl: config.qrImageUrl,
    instructions: config.instructions || '',
    version: config.version || 1,
    isActive: Boolean(config.isActive),
    updatedAt: config.updatedAt,
  }
}

/**
 * GET /api/v1/payments/qr-config
 * Public / Provider endpoint: Fetches current active QR configuration.
 */
export const getActiveQrConfig = asyncHandler(async (req, res) => {
  const purpose = req.query.purpose || 'ALL'
  const config = await AdminPaymentConfig.getActiveConfig(purpose)

  if (!config || !config.isActive) {
    return sendSuccess(res, {
      data: {
        config: null,
        isActive: false,
      },
      message: 'No active payment QR configuration is currently available.',
    })
  }

  return sendSuccess(res, {
    data: {
      config: sanitizePublicConfig(config),
      isActive: true,
    },
    message: 'Active payment QR configuration retrieved successfully.',
  })
})

/**
 * GET /api/v1/admin/payments/qr-config
 * Admin endpoint: Fetches complete QR configuration with audit log and usage stats.
 */
export const getAdminQrConfig = asyncHandler(async (req, res) => {
  const purpose = req.query.purpose || 'ALL'
  let config = await AdminPaymentConfig.findOne({
    paymentMethod: 'UPI_QR',
    paymentPurpose: purpose,
  })
    .sort({ version: -1 })
    .populate('updatedBy', 'fullName email phone')
    .populate('auditLog.updatedBy', 'fullName email')

  if (!config) {
    // If not found for specific, check for ALL
    config = await AdminPaymentConfig.findOne({
      paymentMethod: 'UPI_QR',
      paymentPurpose: 'ALL',
    })
      .sort({ version: -1 })
      .populate('updatedBy', 'fullName email phone')
      .populate('auditLog.updatedBy', 'fullName email')
  }

  // Get total submissions using this QR config
  let submissionStats = { totalSubmissions: 0, totalApprovedAmount: 0 }
  if (config) {
    const [subCount, approvedAgg] = await Promise.all([
      ProviderPayment.countDocuments({ qrConfigId: config._id }),
      ProviderPayment.aggregate([
        { $match: { qrConfigId: config._id, status: 'approved' } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ])
    submissionStats = {
      totalSubmissions: subCount,
      totalApprovedAmount: approvedAgg[0]?.total || 0,
    }
  }

  return sendSuccess(res, {
    data: {
      config: config || null,
      stats: submissionStats,
    },
  })
})

/**
 * PUT /api/v1/admin/payments/qr-config
 * Admin endpoint: Uploads, replaces, or modifies payment QR configuration.
 */
export const updateAdminQrConfig = asyncHandler(async (req, res) => {
  const {
    displayName,
    upiId,
    instructions,
    isActive,
    paymentPurpose = 'ALL',
    expectedVersion,
    changeReason,
  } = req.body

  // Validation
  if (!displayName || String(displayName).trim().length < 2) {
    return sendError(res, {
      message: 'Display name is required (minimum 2 characters)',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'INVALID_DISPLAY_NAME',
    })
  }

  if (upiId && String(upiId).trim().length > 0) {
    const trimmedUpi = String(upiId).trim()
    // Valid UPI format: e.g. name@bank or number@bank
    const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/
    if (!upiRegex.test(trimmedUpi)) {
      return sendError(res, {
        message: 'Invalid UPI ID format. Expected format: username@bank (e.g. a2z@okaxis)',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'INVALID_UPI_ID',
      })
    }
  }

  // Find existing config for the purpose
  let config = await AdminPaymentConfig.findOne({
    paymentMethod: 'UPI_QR',
    paymentPurpose,
  }).sort({ version: -1 })

  // Concurrency check if expectedVersion was supplied
  if (config && expectedVersion !== undefined && expectedVersion !== null) {
    if (Number(config.version) !== Number(expectedVersion)) {
      return sendError(res, {
        message: `Conflict: The configuration was modified by another administrator (Current version: ${config.version}, Provided: ${expectedVersion}). Please refresh and try again.`,
        statusCode: HTTP_STATUS.CONFLICT,
        code: 'CONCURRENCY_CONFLICT',
      })
    }
  }

  let uploadedAsset = null
  let newQrImageUrl = req.body.qrImageUrl
  let newStorageIdentifier = req.body.storageIdentifier

  // Handle uploaded file if present
  if (req.file) {
    if (!ALLOWED_IMAGE_MIMES.has(req.file.mimetype)) {
      return sendError(res, {
        message: 'Invalid image format. Supported formats are PNG, JPEG, and WebP.',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'INVALID_FILE_TYPE',
      })
    }

    if (req.file.size > MAX_IMAGE_SIZE) {
      return sendError(res, {
        message: 'QR code image must be less than 8MB in size.',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'FILE_TOO_LARGE',
      })
    }

    try {
      uploadedAsset = await uploadBufferToCloudinary({
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        folder: UPLOAD_FOLDERS.PAYMENT_QR || 'payment-qr',
        userId: req.user._id,
        originalName: req.file.originalname || 'admin-payment-qr',
        resourceType: 'image',
      })
      newQrImageUrl = uploadedAsset.url
      newStorageIdentifier = uploadedAsset.publicId
    } catch (uploadErr) {
      return sendError(res, {
        message: `Image upload failed: ${uploadErr.message}`,
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'UPLOAD_FAILED',
      })
    }
  }

  // If creating new config, image is required
  if (!config && (!newQrImageUrl || !newStorageIdentifier)) {
    return sendError(res, {
      message: 'A QR code image is required for initial configuration.',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'MISSING_QR_IMAGE',
    })
  }

  try {
    const isImageChanged = Boolean(
      uploadedAsset ||
      (newQrImageUrl && config && newQrImageUrl !== config.qrImageUrl)
    )

    if (!config) {
      // First time initialization
      config = new AdminPaymentConfig({
        paymentMethod: 'UPI_QR',
        paymentPurpose,
        displayName: String(displayName).trim(),
        upiId: upiId ? String(upiId).trim() : '',
        qrImageUrl: newQrImageUrl,
        storageIdentifier: newStorageIdentifier,
        instructions: instructions ? String(instructions).trim() : undefined,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        version: 1,
        updatedBy: req.user._id,
        auditLog: [
          {
            version: 1,
            qrImageUrl: newQrImageUrl,
            storageIdentifier: newStorageIdentifier,
            displayName: String(displayName).trim(),
            upiId: upiId ? String(upiId).trim() : '',
            instructions: instructions ? String(instructions).trim() : '',
            isActive: isActive !== undefined ? Boolean(isActive) : true,
            updatedBy: req.user._id,
            action: 'CREATED',
            reason: changeReason || 'Initial QR payment configuration created',
            changedAt: new Date(),
          },
        ],
      })
      await config.save()
    } else {
      // Snapshot previous version into auditLog
      config.auditLog.push({
        version: config.version,
        qrImageUrl: config.qrImageUrl,
        storageIdentifier: config.storageIdentifier,
        displayName: config.displayName,
        upiId: config.upiId,
        instructions: config.instructions,
        isActive: config.isActive,
        updatedBy: config.updatedBy,
        action: isImageChanged ? 'REPLACED_QR' : 'UPDATED',
        reason: changeReason || (isImageChanged ? 'Replaced QR code image' : 'Updated payment details'),
        changedAt: new Date(),
      })

      config.version += 1
      config.displayName = String(displayName).trim()
      config.upiId = upiId ? String(upiId).trim() : ''
      if (instructions !== undefined) config.instructions = String(instructions).trim()
      if (isActive !== undefined) config.isActive = Boolean(isActive)
      if (newQrImageUrl && newStorageIdentifier) {
        config.qrImageUrl = newQrImageUrl
        config.storageIdentifier = newStorageIdentifier
      }
      config.updatedBy = req.user._id

      await config.save()
    }

    // Real-time broadcast to connected clients
    try {
      const io = getIo()
      if (io) {
        io.emit('PAYMENT_CONFIG_UPDATED', sanitizePublicConfig(config))
      }
    } catch (socketErr) {
      console.warn('[Socket Warning] Could not broadcast PAYMENT_CONFIG_UPDATED:', socketErr?.message)
    }

    const populatedConfig = await AdminPaymentConfig.findById(config._id)
      .populate('updatedBy', 'fullName email phone')
      .populate('auditLog.updatedBy', 'fullName email')

    return sendSuccess(res, {
      message: 'Admin QR payment configuration saved successfully.',
      data: { config: populatedConfig },
    })
  } catch (dbErr) {
    // If DB save failed but a new Cloudinary asset was created, clean it up to prevent orphaned files
    if (uploadedAsset?.publicId) {
      await deleteCloudinaryAsset(uploadedAsset.publicId)
    }
    throw dbErr
  }
})

/**
 * PATCH /api/v1/admin/payments/qr-config/status
 * Admin endpoint: Activates or deactivates the QR payment configuration.
 */
export const toggleQrConfigStatus = asyncHandler(async (req, res) => {
  const { isActive, purpose = 'ALL', reason } = req.body

  if (isActive === undefined) {
    return sendError(res, {
      message: 'isActive status is required',
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
  }

  const config = await AdminPaymentConfig.findOne({
    paymentMethod: 'UPI_QR',
    paymentPurpose: purpose,
  }).sort({ version: -1 })

  if (!config) {
    return sendError(res, {
      message: 'Payment QR configuration not found. Please create one first.',
      statusCode: HTTP_STATUS.NOT_FOUND,
    })
  }

  const newStatus = Boolean(isActive)
  if (config.isActive === newStatus) {
    return sendSuccess(res, {
      message: `Configuration is already ${newStatus ? 'active' : 'inactive'}.`,
      data: { config },
    })
  }

  // Snapshot before changing status
  config.auditLog.push({
    version: config.version,
    qrImageUrl: config.qrImageUrl,
    storageIdentifier: config.storageIdentifier,
    displayName: config.displayName,
    upiId: config.upiId,
    instructions: config.instructions,
    isActive: config.isActive,
    updatedBy: config.updatedBy,
    action: newStatus ? 'ACTIVATED' : 'DEACTIVATED',
    reason: reason || `Admin toggled status to ${newStatus ? 'ACTIVE' : 'INACTIVE'}`,
    changedAt: new Date(),
  })

  config.isActive = newStatus
  config.updatedBy = req.user._id
  config.version += 1
  await config.save()

  // Real-time broadcast
  try {
    const io = getIo()
    if (io) {
      io.emit('PAYMENT_CONFIG_UPDATED', sanitizePublicConfig(config))
    }
  } catch (socketErr) {
    console.warn('[Socket Warning] Could not broadcast PAYMENT_CONFIG_UPDATED:', socketErr?.message)
  }

  return sendSuccess(res, {
    message: `Payment QR successfully ${newStatus ? 'activated' : 'deactivated'}.`,
    data: { config },
  })
})
