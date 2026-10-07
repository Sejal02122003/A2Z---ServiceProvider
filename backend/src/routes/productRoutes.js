import { Router } from 'express'
import { protect, restrictTo } from '../middleware/auth.js'
import { USER_ROLES } from '../constants/roles.js'
import * as productController from '../controllers/productController.js'

const router = Router()

router.use(protect)

router.get('/categories', productController.getProductCategories)
router.get('/', productController.getProducts)
router.get('/:id', productController.getProductById)

router.post('/', restrictTo(USER_ROLES.ADMIN), productController.createProduct)
router.put('/:id', restrictTo(USER_ROLES.ADMIN), productController.updateProduct)
router.patch('/:id/status', restrictTo(USER_ROLES.ADMIN), productController.toggleProductStatus)

export default router
