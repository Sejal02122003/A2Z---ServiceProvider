import { Router } from 'express'
import { protect, restrictTo } from '../middleware/auth.js'
import { USER_ROLES } from '../constants/roles.js'
import * as materialRequestController from '../controllers/materialRequestController.js'

const router = Router()

router.use(protect)

// Vendor Routes (accessible by labour and admin)
router.get(
  '/vendor',
  restrictTo(USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR, USER_ROLES.ADMIN),
  materialRequestController.getVendorMaterialRequests
)
router.get(
  '/vendor/:id',
  restrictTo(USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR, USER_ROLES.ADMIN),
  materialRequestController.getVendorMaterialRequestById
)
router.post(
  '/vendor',
  restrictTo(USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR, USER_ROLES.ADMIN),
  materialRequestController.createVendorMaterialRequest
)
router.post(
  '/vendor/:id/additional',
  restrictTo(USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR, USER_ROLES.ADMIN),
  materialRequestController.requestAdditionalMaterial
)
router.post(
  '/vendor/:id/usage',
  restrictTo(USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR, USER_ROLES.ADMIN),
  materialRequestController.recordMaterialUsage
)

// Admin Routes
router.get('/admin', restrictTo(USER_ROLES.ADMIN), materialRequestController.getAdminMaterialRequests)
router.get('/admin/:id', restrictTo(USER_ROLES.ADMIN), materialRequestController.getAdminMaterialRequestById)
router.patch('/admin/:id/approve', restrictTo(USER_ROLES.ADMIN), materialRequestController.approveMaterialRequest)
router.patch('/admin/:id/reject', restrictTo(USER_ROLES.ADMIN), materialRequestController.rejectMaterialRequest)
router.post('/admin/:id/issue', restrictTo(USER_ROLES.ADMIN), materialRequestController.issueMaterials)
router.patch('/admin/:id/waiting-stock', restrictTo(USER_ROLES.ADMIN), materialRequestController.markWaitingForStock)

export default router
