import { Router } from 'express'
import * as packageController from '../controllers/packageController.js'

const router = Router()

router.get('/', packageController.getPublicServicePackages)
router.get('/:idOrSlug', packageController.getPublicServicePackageDetails)

export default router
