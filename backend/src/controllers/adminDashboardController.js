import { Booking } from '../models/Booking.js'
import { User } from '../models/User.js'
import { WithdrawalRequest } from '../models/WithdrawalRequest.js'
import { Complaint } from '../models/Complaint.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { sendSuccess } from '../utils/apiResponse.js'
import { USER_ROLES } from '../constants/roles.js'
import { LabourCategory } from '../models/LabourCategory.js'

import { Product } from '../models/Product.js'
import { MaterialRequest } from '../models/MaterialRequest.js'
import { InventoryTransaction } from '../models/InventoryTransaction.js'

export const getDashboardStats = asyncHandler(async (req, res) => {
  // Revenue calculation: Sum of platform fees from completed bookings
  const completedBookings = await Booking.find({ status: 'COMPLETED' })
  
  let totalRevenue = 0
  let totalTaxesCollected = 0
  let totalGrossVolume = 0
  let totalCommissionsCollected = 0

  completedBookings.forEach(booking => {
    totalRevenue += booking.platformFee || 0
    totalTaxesCollected += booking.taxes || 0
    totalGrossVolume += booking.totalAmount || 0
    totalCommissionsCollected += booking.commissionAmount || 0
  })

  // User Counts
  const totalCustomers = await User.countDocuments({ role: USER_ROLES.CUSTOMER || USER_ROLES.USER })
  const totalLabourers = await User.countDocuments({ role: USER_ROLES.LABOUR })
  const totalContractors = await User.countDocuments({ role: USER_ROLES.CONTRACTOR })
  const totalCategories = await LabourCategory.countDocuments()

  // Actionable Pending Items
  const pendingWithdrawals = await WithdrawalRequest.countDocuments({ status: 'PENDING' })
  const openComplaints = await Complaint.countDocuments({ status: 'OPEN' })

  // Bookings Stats
  const activeBookings = await Booking.countDocuments({ status: { $in: ['SEARCHING', 'ACCEPTED', 'ASSIGNED', 'EN_ROUTE', 'STARTED'] } })
  const totalBookingsCount = await Booking.countDocuments()

  // Inventory & Material Stats
  const totalProducts = await Product.countDocuments()
  const activeProducts = await Product.countDocuments({ isActive: true })
  const lowStockProducts = await Product.countDocuments({
    isActive: true,
    $expr: { $lte: ['$currentStock', '$minimumStock'] },
  })
  const pendingMaterialRequests = await MaterialRequest.countDocuments({
    status: { $in: ['REQUESTED', 'WAITING_FOR_STOCK', 'READY_FOR_ISSUE', 'PARTIALLY_ISSUED'] },
  })

  const startOfDay = new Date()
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date()
  endOfDay.setHours(23, 59, 59, 999)

  const todayTransactions = await InventoryTransaction.find({
    createdAt: { $gte: startOfDay, $lte: endOfDay },
  }).lean()

  let materialsIssuedToday = 0
  let materialsUsedToday = 0
  let materialsReturnedToday = 0

  todayTransactions.forEach((txn) => {
    if (txn.type === 'ISSUED_TO_VENDOR' || txn.type === 'ALTERNATIVE_PRODUCT_ISSUED') {
      materialsIssuedToday += txn.quantity || 0
    } else if (txn.type === 'USED_BY_VENDOR') {
      materialsUsedToday += txn.quantity || 0
    } else if (txn.type === 'RETURNED_BY_VENDOR') {
      materialsReturnedToday += txn.quantity || 0
    }
  })

  const allActiveProducts = await Product.find({ isActive: true }).select('currentStock price').lean()
  const totalInventoryValue = allActiveProducts.reduce((sum, p) => sum + (p.currentStock || 0) * (p.price || 0), 0)

  return sendSuccess(res, {
    data: {
      revenue: {
        platformEarnings: totalRevenue,
        taxesCollected: totalTaxesCollected,
        commissionsCollected: totalCommissionsCollected,
        grossTransactionVolume: totalGrossVolume,
      },
      users: {
        customers: totalCustomers,
        labourers: totalLabourers,
        contractors: totalContractors,
      },
      actionable: {
        pendingWithdrawals,
        openComplaints,
      },
      system: {
        categories: totalCategories,
      },
      bookings: {
        active: activeBookings,
        completed: completedBookings.length,
        total: totalBookingsCount,
      },
      inventory: {
        totalProducts,
        activeProducts,
        lowStockProducts,
        pendingMaterialRequests,
        materialsIssuedToday,
        materialsUsedToday,
        materialsReturnedToday,
        totalInventoryValue,
      },
    },
  })
})

