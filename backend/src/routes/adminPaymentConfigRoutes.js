import { Router } from 'express'
import multer from 'multer'
import { protect, restrictTo } from '../middleware/auth.js'
import { USER_ROLES } from '../constants/roles.js'
import * as configController from '../controllers/adminPaymentConfigController.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB limit
})

const router = Router()

// All routes here require admin privileges
router.use(protect)
router.use(restrictTo(USER_ROLES.ADMIN))

// GET /api/v1/admin/payments/qr-config
router.get('/qr-config', configController.getAdminQrConfig)

// PUT /api/v1/admin/payments/qr-config (accepts multipart/form-data or JSON)
router.put('/qr-config', upload.single('qrImage'), configController.updateAdminQrConfig)

// PATCH /api/v1/admin/payments/qr-config/status
router.patch('/qr-config/status', configController.toggleQrConfigStatus)

export default router
