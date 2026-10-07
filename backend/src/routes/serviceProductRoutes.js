import { Router } from 'express'
import { protect, restrictTo } from '../middleware/auth.js'
import { USER_ROLES } from '../constants/roles.js'
import * as serviceProductController from '../controllers/serviceProductController.js'

const router = Router()

router.get('/service-products', protect, serviceProductController.getAllServiceProductMappings)
router.get('/services/:serviceId/products', protect, serviceProductController.getServiceProductMappings)
router.post('/services/:serviceId/products', protect, restrictTo(USER_ROLES.ADMIN), serviceProductController.addServiceProductMapping)
router.put('/service-products/:id', protect, restrictTo(USER_ROLES.ADMIN), serviceProductController.updateServiceProductMapping)
router.delete('/service-products/:id', protect, restrictTo(USER_ROLES.ADMIN), serviceProductController.deleteServiceProductMapping)

export default router

