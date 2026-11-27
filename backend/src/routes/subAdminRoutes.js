import { Router } from 'express'
import { body, param } from 'express-validator'
import { protect, mainAdminOnly } from '../middleware/auth.js'
import { validateRequest } from '../middleware/validateRequest.js'
import { ADMIN_PERMISSION_KEYS } from '../constants/adminPermissions.js'
import * as subAdmin from '../controllers/subAdminController.js'

const router = Router()

// Only the main admin manages sub-admins
router.use(protect, mainAdminOnly)

const validateId = param('id').isMongoId().withMessage('Invalid sub-admin id')

const fields = (required) => {
  const field = (name) => (required ? body(name) : body(name).optional())
  return [
    field('fullName').isString().trim().isLength({ min: 2, max: 120 }).withMessage('Name must be 2-120 characters'),
    field('email').isString().trim().isEmail().withMessage('Enter a valid email address'),
    (required ? body('password') : body('password').optional({ values: 'falsy' }))
      .isString()
      .isLength({ min: 8, max: 128 })
      .withMessage('Password must be at least 8 characters'),
    field('permissions').isArray({ min: 1 }).withMessage('Select at least one section'),
    body('permissions.*').isIn(ADMIN_PERMISSION_KEYS).withMessage('Unknown section selected'),
  ]
}

router.get('/', subAdmin.listSubAdmins)
router.post('/', fields(true), validateRequest, subAdmin.createSubAdmin)
router.patch(
  '/:id',
  [validateId, ...fields(false), body('isActive').optional().isBoolean({ strict: true })],
  validateRequest,
  subAdmin.updateSubAdmin,
)
router.delete('/:id', validateId, validateRequest, subAdmin.deleteSubAdmin)

export default router
