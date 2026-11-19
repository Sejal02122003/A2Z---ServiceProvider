import { WalletRechargeRequest, RECHARGE_STATUS } from '../models/WalletRechargeRequest.js'
import { createRechargeRequest } from '../services/walletRechargeService.js'
import { uploadBufferToCloudinary } from '../services/cloudinaryService.js'
import { UPLOAD_FOLDERS } from '../constants/uploadFolders.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'

const ALLOWED_IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
const MAX_SCREENSHOT_SIZE = 10 * 1024 * 1024 // 10MB

/**
 * POST /api/v1/wallets/recharge-request
 * Submit a wallet recharge request by User or Worker.
 */
export const submitRechargeRequest = asyncHandler(async (req, res) => {
  const userId = req.user._id
  const { amount, utrNumber, paymentMode = 'UPI_QR', notes } = req.body

  let paymentScreenshot = req.body.paymentScreenshot || ''
  let paymentScreenshotPublicId = req.body.paymentScreenshotPublicId || ''

  // If a file was uploaded via multipart/form-data
  if (req.file) {
    if (!ALLOWED_IMAGE_MIMES.has(req.file.mimetype)) {
      return sendError(res, {
        message: 'Invalid receipt file type. Supported formats are JPG, PNG, WebP, and PDF.',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'INVALID_FILE_TYPE',
      })
    }

    if (req.file.size > MAX_SCREENSHOT_SIZE) {
      return sendError(res, {
        message: 'Receipt file must be under 10MB',
        statusCode: HTTP_STATUS.BAD_REQUEST,
        code: 'FILE_TOO_LARGE',
      })
    }

    try {
      const uploadResult = await uploadBufferToCloudinary({
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        folder: UPLOAD_FOLDERS.PAYMENT_RECEIPTS || 'payment-receipts',
        userId: userId.toString(),
        originalName: req.file.originalname || `recharge-${Date.now()}`,
        resourceType: req.file.mimetype === 'application/pdf' ? 'raw' : 'image',
      })
      paymentScreenshot = uploadResult.url
      paymentScreenshotPublicId = uploadResult.publicId
    } catch (uploadErr) {
      // In offline / dev mode without cloudinary keys, provide fallback
      console.warn('[Cloudinary Warning] Upload failed, falling back to data URL or dummy path:', uploadErr.message)
      if (!paymentScreenshot) {
        paymentScreenshot = `https://storage.googleapis.com/a2z-receipts/mock-${Date.now()}.png`
      }
    }
  }

  if (!paymentScreenshot) {
    return sendError(res, {
      message: 'Payment screenshot receipt is required.',
      statusCode: HTTP_STATUS.BAD_REQUEST,
      code: 'MISSING_SCREENSHOT',
    })
  }

  try {
    const request = await createRechargeRequest({
      userId,
      amount,
      utrNumber,
      paymentScreenshot,
      paymentScreenshotPublicId,
      paymentMode,
      metadata: notes ? { notes: String(notes).trim() } : {},
    })

    return sendSuccess(res, {
      message: 'Your wallet recharge request has been submitted and is awaiting admin approval.',
      data: { request },
      statusCode: HTTP_STATUS.CREATED,
    })
  } catch (err) {
    const statusCode = err.statusCode || HTTP_STATUS.BAD_REQUEST
    return sendError(res, {
      message: err.message,
      statusCode,
      code: err.code || 'SUBMISSION_FAILED',
    })
  }
})

/**
 * GET /api/v1/wallets/recharge-requests/my
 * Fetch authenticated user or worker's own recharge requests.
 */
export const getMyRechargeRequests = asyncHandler(async (req, res) => {
  const userId = req.user._id
  const { status, page = 1, limit = 20 } = req.query

  const query = { userId }
  if (status && status !== 'ALL') {
    const upperStatus = String(status).toUpperCase()
    if (Object.values(RECHARGE_STATUS).includes(upperStatus)) {
      query.status = upperStatus
    }
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1)
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 20))
  const skip = (pageNum - 1) * limitNum

  const [requests, total] = await Promise.all([
    WalletRechargeRequest.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean(),
    WalletRechargeRequest.countDocuments(query),
  ])

  return sendSuccess(res, {
    data: {
      requests,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum) || 1,
      },
    },
  })
})
