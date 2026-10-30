import { Router } from 'express'
import multer from 'multer'
import { protect, restrictTo } from '../middleware/auth.js'
import { USER_ROLES } from '../constants/roles.js'
import * as paymentCtrl from '../controllers/providerPaymentController.js'

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
})

const router = Router()

// All provider payment routes require authentication
router.use(protect)

// Provider routes
router.post('/', paymentCtrl.createPayment)
router.post('/:id/submit', upload.single('receipt'), paymentCtrl.submitPayment)
router.get('/my', paymentCtrl.getMyPayments)

// Admin-only routes for reviewing payments
router.get('/admin', restrictTo(USER_ROLES.ADMIN), paymentCtrl.getAdminPayments)
router.patch('/admin/:id/review', restrictTo(USER_ROLES.ADMIN), paymentCtrl.reviewPayment)

// Detail route (accessible to payment owner or admin)
router.get('/:id', paymentCtrl.getPaymentById)

export default router
