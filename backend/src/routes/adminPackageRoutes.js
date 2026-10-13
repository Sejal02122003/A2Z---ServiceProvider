import { Router } from 'express'
import { body, param } from 'express-validator'
import { protect, restrictTo } from '../middleware/auth.js'
import { validateRequest } from '../middleware/validateRequest.js'
import { USER_ROLES } from '../constants/roles.js'
import * as packageController from '../controllers/packageController.js'

const router = Router()

router.use(protect, restrictTo(USER_ROLES.ADMIN))

router.get('/', packageController.getAdminServicePackages)
router.get('/:id', [param('id').isMongoId().withMessage('Invalid package ID')], validateRequest, packageController.getAdminServicePackageDetails)

router.post(
  '/',
  [
    body('name').isString().trim().notEmpty().withMessage('Package name is required'),
    body('description').isString().trim().notEmpty().withMessage('Package description is required'),
    body('categoryId').isMongoId().withMessage('Valid categoryId is required'),
    body('price').isFloat({ min: 0 }).withMessage('Package price must be >= 0'),
    body('inclusions').isArray({ min: 1 }).withMessage('At least one service inclusion is required'),
    body('inclusions.*.serviceId').isMongoId().withMessage('Each inclusion must have a valid serviceId'),
  ],
  validateRequest,
  packageController.createAdminServicePackage
)

router.put(
  '/:id',
  [
    param('id').isMongoId().withMessage('Invalid package ID'),
    body('name').optional().isString().trim().notEmpty().withMessage('Package name cannot be empty'),
    body('description').optional().isString().trim().notEmpty().withMessage('Package description cannot be empty'),
    body('categoryId').optional().isMongoId().withMessage('Valid categoryId is required'),
    body('price').optional().isFloat({ min: 0 }).withMessage('Package price must be >= 0'),
    body('inclusions').optional().isArray({ min: 1 }).withMessage('At least one service inclusion is required'),
  ],
  validateRequest,
  packageController.updateAdminServicePackage
)

router.patch(
  '/:id/status',
  [
    param('id').isMongoId().withMessage('Invalid package ID'),
    body('status').isIn(['DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED']).withMessage('Status must be DRAFT, ACTIVE, INACTIVE, or ARCHIVED'),
  ],
  validateRequest,
  packageController.changeAdminPackageStatus
)

router.delete(
  '/:id',
  [param('id').isMongoId().withMessage('Invalid package ID')],
  validateRequest,
  packageController.deleteAdminServicePackage
)

export default router
