import { Router } from 'express'
import { protect, restrictTo } from '../middleware/auth.js'
import { USER_ROLES } from '../constants/roles.js'
import * as inventoryController from '../controllers/inventoryController.js'

const router = Router()

router.use(protect)
router.use(restrictTo(USER_ROLES.ADMIN))

router.post('/add-stock', inventoryController.addStock)
router.post('/adjust-stock', inventoryController.adjustStock)
router.get('/', inventoryController.getInventoryList)
router.get('/low-stock', inventoryController.getLowStockProducts)
router.get('/transactions', inventoryController.getInventoryTransactions)
router.get('/vendor-inventory', inventoryController.getVendorInventory)
router.get('/dashboard-stats', inventoryController.getInventoryDashboardStats)

export default router
