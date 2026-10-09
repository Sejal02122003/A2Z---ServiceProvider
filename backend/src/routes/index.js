import { Router } from 'express'
import authRoutes from './authRoutes.js'
import userRoutes from './userRoutes.js'
import labourCategoryRoutes from './labourCategoryRoutes.js'
import adminLabourCategoryRoutes from './adminLabourCategoryRoutes.js'

import servicePartnerRoutes from './servicePartnerRoutes.js'
import uploadRoutes from './uploadRoutes.js'
import workforceRoutes from './workforceRoutes.js'
import adminWorkforceRoutes from './adminWorkforceRoutes.js'
import systemSettingRoutes from './systemSettingRoutes.js'
import bookingRoutes from './bookingRoutes.js'
import walletRoutes from './walletRoutes.js'
import broadcastRoutes from './broadcastRoutes.js'
import paymentRoutes from './paymentRoutes.js'
import reviewRoutes from './reviewRoutes.js'
import userSubscriptionRoutes from './userSubscriptionRoutes.js'

import adminZoneRoutes from './adminZoneRoutes.js'
import locationRoutes from './locationRoutes.js'
import adminWalletRoutes from './adminWalletRoutes.js'
import complaintRoutes from './complaintRoutes.js'
import adminComplaintRoutes from './adminComplaintRoutes.js'
import adminDashboardRoutes from './adminDashboardRoutes.js'
import bannerRoutes from './bannerRoutes.js'
import adminBannerRoutes from './adminBannerRoutes.js'
import adminReportsRoutes from './adminReportsRoutes.js'
import adminBookingRoutes from './adminBookingRoutes.js'
import adminSubscriptionRoutes from './adminSubscriptionRoutes.js'
import policyRoutes from './policyRoutes.js'
import fcmTokenRoutes from './fcmTokenRoutes.js'
import adminProfileRoutes from './adminProfileRoutes.js'
import notificationsRoutes from './notificationsRoutes.js'
import simulatedOpportunityRoutes from './simulatedOpportunityRoutes.js'

import productRoutes from './productRoutes.js'
import serviceProductRoutes from './serviceProductRoutes.js'
import inventoryRoutes from './inventoryRoutes.js'
import materialRequestRoutes from './materialRequestRoutes.js'
import trialRoutes from './trialRoutes.js'
import rewardRoutes from './rewardRoutes.js'
import bookingReminderRoutes from './bookingReminderRoutes.js'
import penaltyRoutes from './penaltyRoutes.js'
import bookingCancellationRoutes from './bookingCancellationRoutes.js'

const router = Router()

router.use('/', trialRoutes)
router.use('/', rewardRoutes)
router.use('/reminders', bookingReminderRoutes)
router.use('/penalties', penaltyRoutes)
router.use('/booking-cancellations', bookingCancellationRoutes)

router.use('/auth', authRoutes)
router.use('/users', userRoutes)
router.use('/service-partners', servicePartnerRoutes)
router.use('/uploads', uploadRoutes)
router.use('/labour-categories', labourCategoryRoutes)

router.use('/products', productRoutes)
router.use('/', serviceProductRoutes)
router.use('/inventory', inventoryRoutes)
router.use('/material-requests', materialRequestRoutes)

router.use('/workforce', workforceRoutes)
router.use('/bookings', bookingRoutes)
router.use('/wallets', walletRoutes)
router.use('/broadcasts', broadcastRoutes)
router.use('/payments', paymentRoutes)
router.use('/reviews', reviewRoutes)
router.use('/complaints', complaintRoutes)
router.use('/banners', bannerRoutes)
router.use('/user-subscriptions', userSubscriptionRoutes)
router.use('/policies', policyRoutes)
router.use('/fcm-tokens', fcmTokenRoutes)
router.use('/notifications', notificationsRoutes)
router.use('/simulated-opportunities', simulatedOpportunityRoutes)

router.use('/admin/settings', systemSettingRoutes)
router.use('/admin/zones', adminZoneRoutes)
router.use('/admin/workforce', adminWorkforceRoutes)
router.use('/admin/wallets', adminWalletRoutes)
router.use('/admin/complaints', adminComplaintRoutes)
router.use('/admin/dashboard', adminDashboardRoutes)
router.use('/admin/banners', adminBannerRoutes)
router.use('/admin/reports', adminReportsRoutes)
router.use('/admin/bookings', adminBookingRoutes)
router.use('/admin/labour-subscriptions', adminSubscriptionRoutes)
router.use('/admin/profile', adminProfileRoutes)
router.use('/admin', adminLabourCategoryRoutes)

router.use('/labour/location', locationRoutes)

import { getCollectedCommissionAmount } from '../controllers/adminWalletController.js'
import { protect, restrictTo } from '../middleware/auth.js'
import { USER_ROLES } from '../constants/roles.js'
router.get('/admin/commission-fee', protect, restrictTo(USER_ROLES.ADMIN), getCollectedCommissionAmount)

export default router

