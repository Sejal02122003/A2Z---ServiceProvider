import { Booking } from '../models/Booking.js'
import { LabourSubcategory } from '../models/LabourSubcategory.js'
import { LabourService } from '../models/LabourService.js'
import { ServicePackage } from '../models/ServicePackage.js'
import { SystemSetting } from '../models/SystemSetting.js'
import { Zone } from '../models/Zone.js'
import { Wallet } from '../models/Wallet.js'
import { AdminWallet } from '../models/AdminWallet.js'
import { Invoice } from '../models/Invoice.js'
import { INVOICE_STATUS } from '../constants/workforceConstants.js'
import { asyncHandler } from '../utils/asyncHandler.js'
import { HTTP_STATUS, sendError, sendSuccess } from '../utils/apiResponse.js'
import { parseISTDateTime } from '../utils/dateHelper.js'
import { recordLateFeeIncident, recordBounceIncident } from '../services/penaltyService.js'
import {
  getCustomerCancellationEligibility,
  processCustomerCancellation,
  checkCustomerBookingRestriction,
} from '../services/bookingCancellationService.js'
import { getMultipleLaboursStats } from '../services/labourStatsService.js'

export function formatDurationHuman(mins) {
  const m = Math.max(1, Math.round(Number(mins) || 45))
  const hrs = Math.floor(m / 60)
  const remainingMins = m % 60
  if (hrs > 0 && remainingMins > 0) {
    return `${hrs} hr ${remainingMins} mins (${m} mins)`
  }
  if (hrs > 0 && remainingMins === 0) {
    return `${hrs} hr${hrs > 1 ? 's' : ''} (${m} mins)`
  }
  return `${m} mins`
}

export const calculateBill = asyncHandler(async (req, res) => {
  const { serviceId, subServiceId, packageId, hours: rawHours = 1, quantity = 1, address, contractorServices } = req.body
  const hours = parseFloat(rawHours) || 1 // supports 0.5 = 30 min

  let matchedZone = null
  if (address) {
    const activeZones = await Zone.find({ isActive: true }).lean()
    matchedZone = activeZones.find(z => address.toLowerCase().includes(z.city.toLowerCase()))
  }

  let settings = await SystemSetting.findOne({ configKey: 'master_config' })
  if (!settings) {
    settings = await SystemSetting.create({ configKey: 'master_config' })
  }

  // ----------------------------------------------------
  // CASE 1: Predefined Service Package Pricing
  // ----------------------------------------------------
  if (packageId) {
    const pkg = await ServicePackage.findById(packageId).lean()
    if (!pkg) {
      return sendError(res, { message: 'Service package not found', statusCode: HTTP_STATUS.NOT_FOUND })
    }
    if (pkg.status !== 'ACTIVE') {
      return sendError(res, { message: 'Selected package is not active or available', statusCode: HTTP_STATUS.BAD_REQUEST })
    }
    const now = new Date()
    if (pkg.validFrom && new Date(pkg.validFrom) > now) {
      return sendError(res, { message: 'This package offer has not started yet', statusCode: HTTP_STATUS.BAD_REQUEST })
    }
    if (pkg.validUntil && new Date(pkg.validUntil) < now) {
      return sendError(res, { message: 'This package offer has expired', statusCode: HTTP_STATUS.BAD_REQUEST })
    }

    // Zone validation if address is supplied
    if (matchedZone && !pkg.isAllZones && pkg.zones && pkg.zones.length > 0) {
      const zoneMatch = pkg.zones.some(z => String(z) === String(matchedZone._id))
      if (!zoneMatch) {
        return sendError(res, { message: 'This package is not available in your selected location', statusCode: HTTP_STATUS.BAD_REQUEST })
      }
    }

    // Verify all inclusion services are currently active
    for (const inc of (pkg.inclusions || [])) {
      if (inc.serviceId) {
        const srv = await LabourService.findById(inc.serviceId).lean()
        if (!srv || !srv.isActive) {
          return sendError(res, {
            message: `Package inclusion "${inc.name || 'Service'}" is currently unavailable`,
            statusCode: HTTP_STATUS.BAD_REQUEST
          })
        }
      }
    }

    const packagePrice = Number(pkg.price) || 0
    const originalPrice = Number(pkg.originalPrice) || packagePrice
    const serviceDiscount = Math.max(0, originalPrice - packagePrice)
    const subTotal = packagePrice
    const originalSubTotal = originalPrice
    const basePrice = subTotal
    const maxHourDiscount = 0

    let platformFee = 0
    if (settings.platformFee.isActive) {
      if (settings.platformFee.type === 'fixed') {
        platformFee = settings.platformFee.value
      } else if (settings.platformFee.type === 'percentage') {
        platformFee = (basePrice * settings.platformFee.value) / 100
      }
    }

    let gstPercentage = 0
    if (pkg.categoryId) {
      const { LabourCategory } = await import('../models/LabourCategory.js')
      const category = await LabourCategory.findById(pkg.categoryId)
      if (category && category.isGstActive) {
        gstPercentage = category.gstPercentage || 0
      }
    } else if (settings.gstPercentage > 0) {
      gstPercentage = settings.gstPercentage
    }

    const taxes = gstPercentage > 0 ? (basePrice * gstPercentage) / 100 : 0
    // Customer does not pay platform fee; customer pays basePrice + taxes
    const totalAmount = basePrice + taxes

    let commissionAmount = 0
    if (settings.commission.isActive && settings.commission.type === 'global') {
      commissionAmount = (basePrice * settings.commission.globalPercentage) / 100
    }

    let walletInfo = {
      enabled: false,
      walletBalance: 0,
      availableBalance: 0,
      maxWalletDiscount: 0,
      actualWalletDiscount: 0,
      discountPercentage: 0,
      percentage: 0,
      minimumBookingAmount: 0,
    }
    if (req.user?._id) {
      try {
        const { calculateWalletDiscount } = await import('../services/userWalletService.js')
        walletInfo = await calculateWalletDiscount(req.user._id, totalAmount)
      } catch (err) {
        console.error('[WALLET_ERROR] Error in calculateBill wallet calculation:', err)
      }
    }

    const breakdown = (pkg.inclusions || []).map(inc => ({
      serviceId: inc.serviceId,
      name: inc.name,
      brand: inc.brand || '',
      quantity: inc.quantity || 1,
      duration: inc.duration || '',
      description: inc.description || '',
      hourlyRate: 0,
      subTotal: 0,
      savings: 0,
    }))

    return sendSuccess(res, {
      data: {
        isPackage: true,
        package: {
          _id: pkg._id,
          name: pkg.name,
          slug: pkg.slug,
          price: pkg.price,
          originalPrice: pkg.originalPrice,
          savings: serviceDiscount,
          inclusions: pkg.inclusions,
          exclusions: pkg.exclusions,
          termsAndConditions: pkg.termsAndConditions,
          badge: pkg.badge,
          imageUrl: pkg.imageUrl,
          estimatedDurationMins: pkg.estimatedDurationMins,
        },
        originalSubTotal,
        serviceDiscount,
        subTotal,
        maxHourDiscount: 0,
        totalSavings: serviceDiscount,
        basePrice,
        platformFee,
        taxes,
        totalAmount,
        totalDurationMins: Number(pkg.estimatedDurationMins || 60) * (Number(quantity) || 1),
        formattedDuration: formatDurationHuman(Number(pkg.estimatedDurationMins || 60) * (Number(quantity) || 1)),
        estimatedDurationMins: Number(pkg.estimatedDurationMins || 60) * (Number(quantity) || 1),
        commissionAmount,
        laborShare: Math.round(Math.max(0, basePrice - commissionAmount - platformFee)),
        paymentModes: settings.paymentModes || { cashEnabled: true, onlineEnabled: true },
        breakdown,
        walletInfo,
        checkout: {
          eligibleOrderAmount: totalAmount,
          walletBalance: walletInfo?.walletBalance ?? 0,
          walletUsagePercentage: walletInfo?.walletUsagePercentage ?? walletInfo?.percentage ?? 0,
          maxWalletUsage: walletInfo?.maxWalletUsage ?? walletInfo?.maxWalletDiscount ?? 0,
          walletDeduction: walletInfo?.walletDeduction ?? walletInfo?.actualWalletDiscount ?? 0,
          remainingPayable: walletInfo?.remainingPayable ?? Math.max(0, totalAmount - (walletInfo?.walletDeduction ?? 0)),
        },
        restriction: await checkCustomerBookingRestriction(req.user?._id),
      }
    })
  }

  // ----------------------------------------------------
  // CASE 2: Individual / Contractor Standard Services
  // ----------------------------------------------------
  const resolveHourlyRate = async (sId, ssId = subServiceId) => {
    const service = await LabourService.findById(sId)
    let hourlyRate = 0
    let originalHourlyRate = 0
    let discountType = 'PERCENTAGE'
    let discountValue = 0
    let offerBadge = ''
    let name = ''
    let categoryId = null
    if (service) {
      const serviceFallbackPrice = Number(service.hourlyPrice || service.basePrice || service.pricePerUnit || 0)
      let hasExplicitSubDiscount = false
      if (ssId && Array.isArray(service.subServices)) {
        const foundSub = service.subServices.find(ss => String(ss._id) === String(ssId))
        if (foundSub) {
          name = `${service.name} (${foundSub.name})`
          const subPrice = Number(foundSub.price) || 0
          const subOrigPrice = Number(foundSub.originalPrice) || 0
          if (subOrigPrice > subPrice && subPrice > 0) {
            originalHourlyRate = subOrigPrice
            hourlyRate = subPrice
            hasExplicitSubDiscount = true
            discountValue = Math.round(((subOrigPrice - subPrice) / subOrigPrice) * 100)
            discountType = 'PERCENTAGE'
          } else if (subPrice > 0) {
            originalHourlyRate = subPrice
          } else {
            originalHourlyRate = serviceFallbackPrice
          }
        } else {
          originalHourlyRate = serviceFallbackPrice
          name = service.name
        }
      } else {
        originalHourlyRate = serviceFallbackPrice
        name = service.name
      }
      if (!hasExplicitSubDiscount) {
        discountType = service.discountType || 'PERCENTAGE'
        discountValue = Number(service.discountValue || 0)
      }
      offerBadge = service.offerBadge || ''
      const sub = await LabourSubcategory.findById(service.subcategoryId)
      if (sub) categoryId = sub.categoryId
      if (matchedZone && service.zones && service.zones.length > 0 && !ssId) {
        const zonePricing = service.zones.find(z => String(z.zone) === String(matchedZone._id))
        if (zonePricing && typeof zonePricing.price === 'number' && Number(zonePricing.price) > 0) {
          originalHourlyRate = Number(zonePricing.price)
        }
      }
      if (!originalHourlyRate || originalHourlyRate <= 0) {
        originalHourlyRate = serviceFallbackPrice
      }
      if (!hasExplicitSubDiscount) {
        if (discountValue > 0) {
          if (discountType === 'PERCENTAGE') {
            hourlyRate = Math.max(0, Math.round(originalHourlyRate * (1 - discountValue / 100)))
          } else {
            hourlyRate = Math.max(0, originalHourlyRate - discountValue)
          }
        } else {
          hourlyRate = originalHourlyRate
        }
      }
      if (!hourlyRate || hourlyRate <= 0) {
        hourlyRate = originalHourlyRate
      }
    } else {
      const subcategory = await LabourSubcategory.findById(sId)
      if (subcategory) {
        originalHourlyRate = subcategory.basePrice || 800
        hourlyRate = originalHourlyRate
        name = subcategory.name
        categoryId = subcategory.categoryId
      } else {
        const { LabourCategory } = await import('../models/LabourCategory.js')
        const category = await LabourCategory.findById(sId)
        if (category) {
          originalHourlyRate = 800
          hourlyRate = originalHourlyRate
          name = category.name
          categoryId = category._id
        } else {
          return { error: 'Service or Category not found' }
        }
      }
    }
    return {
      hourlyRate,
      originalHourlyRate,
      discountType,
      discountValue,
      offerBadge,
      name,
      categoryId,
      subcategoryId: service?.subcategoryId,
      iconUrl: service?.iconUrl,
      estimatedDurationMins: Number(
        (ssId && Array.isArray(service?.subServices) && service.subServices.find(ss => String(ss._id) === String(ssId))?.estimatedDurationMins) ||
        service?.estimatedDurationMins ||
        60
      ),
    }
  }

  let subTotal = 0
  let originalSubTotal = 0
  let serviceDiscount = 0
  let breakdown = []

  const isMultiService = Array.isArray(req.body.items) && req.body.items.length > 0
  const servicesToCalculate = isMultiService
    ? req.body.items
    : (contractorServices && contractorServices.length > 0 
      ? contractorServices 
      : [{ serviceId, subServiceId, quantity, hours }])

  let primaryCategoryId = null
  let itemTaxesTotal = 0
  let totalDurationMins = 0

  for (const item of servicesToCalculate) {
    if (!item.serviceId) continue
    const itemHours = Number(item.hours) || hours || 1
    const itemQty = Number(item.quantity) || 1
    const { hourlyRate, originalHourlyRate, discountType, discountValue, offerBadge, name, categoryId, subcategoryId, iconUrl, estimatedDurationMins: resolvedDurationMins, error } = await resolveHourlyRate(item.serviceId, item.subServiceId)
    if (error) return sendError(res, { message: error, statusCode: HTTP_STATUS.NOT_FOUND })
    
    if (!primaryCategoryId && categoryId) primaryCategoryId = categoryId

    const itemUnitDuration = Number(item.estimatedDurationMins || resolvedDurationMins || 45)
    const itemTotalDuration = itemUnitDuration * itemQty
    totalDurationMins += itemTotalDuration

    const itemOriginalTotal = (originalHourlyRate || hourlyRate) * itemHours * itemQty
    const itemTotal = hourlyRate * itemHours * itemQty
    const itemDiscount = Math.max(0, itemOriginalTotal - itemTotal)

    originalSubTotal += itemOriginalTotal
    subTotal += itemTotal
    serviceDiscount += itemDiscount

    // Calculate category GST for this item
    let itemGst = 0
    if (categoryId) {
      const { LabourCategory } = await import('../models/LabourCategory.js')
      const catDoc = await LabourCategory.findById(categoryId)
      if (catDoc && catDoc.isGstActive) {
        itemGst = catDoc.gstPercentage || 0
      }
    }
    if (!itemGst && settings.gstPercentage > 0) {
      itemGst = settings.gstPercentage
    }
    const itemTax = itemGst > 0 ? (itemTotal * itemGst) / 100 : 0
    itemTaxesTotal += itemTax

    breakdown.push({
      serviceId: item.serviceId,
      subServiceId: item.subServiceId || undefined,
      name,
      iconUrl,
      originalHourlyRate: originalHourlyRate || hourlyRate,
      hourlyRate,
      discountType,
      discountValue,
      offerBadge,
      hours: itemHours,
      quantity: itemQty,
      estimatedDurationMins: itemUnitDuration,
      totalDurationMins: itemTotalDuration,
      formattedDuration: formatDurationHuman(itemTotalDuration),
      subTotal: itemTotal,
      savings: itemDiscount,
      taxes: itemTax,
      categoryId,
      subcategoryId,
    })
  }

  // Calculate Subtotal (Hourly Rate * Hours * Quantity)
  let maxHourDiscount = 0

  if (hours >= 8 && settings.maxHourDiscountPercentage > 0 && !isMultiService) {
    maxHourDiscount = (subTotal * settings.maxHourDiscountPercentage) / 100
  }

  let basePrice = subTotal - maxHourDiscount
  let platformFee = 0

  if (settings.platformFee.isActive) {
    if (settings.platformFee.type === 'fixed') {
      platformFee = settings.platformFee.value
    } else if (settings.platformFee.type === 'percentage') {
      platformFee = (basePrice * settings.platformFee.value) / 100
    }
  }

  let taxes = isMultiService ? itemTaxesTotal : 0

  if (!isMultiService) {
    let gstPercentage = 0
    if (primaryCategoryId) {
      const { LabourCategory } = await import('../models/LabourCategory.js')
      const category = await LabourCategory.findById(primaryCategoryId)
      if (category && category.isGstActive) {
        gstPercentage = category.gstPercentage || 0
      }
    } else if (settings.gstPercentage > 0) {
      // Fallback to global if for some reason category is not resolved
      gstPercentage = settings.gstPercentage
    }

    if (gstPercentage > 0) {
      taxes = (basePrice * gstPercentage) / 100
    }
  }

  // Customer does not pay platform fee; customer pays basePrice + taxes
  const totalAmount = basePrice + taxes

  // Also pre-calculate commission to show to admin internally, but user doesn't necessarily need to see it
  let commissionAmount = 0
  if (settings.commission.isActive && settings.commission.type === 'global') {
    commissionAmount = (basePrice * settings.commission.globalPercentage) / 100
  }

  // Calculate wallet discount options if user is authenticated
  let walletInfo = {
    enabled: false,
    walletBalance: 0,
    availableBalance: 0,
    maxWalletDiscount: 0,
    actualWalletDiscount: 0,
    discountPercentage: 0,
    percentage: 0,
    minimumBookingAmount: 0,
  }
  if (req.user?._id) {
    try {
      const { calculateWalletDiscount } = await import('../services/userWalletService.js')
      walletInfo = await calculateWalletDiscount(req.user._id, totalAmount)
    } catch (err) {
      console.error('[WALLET_ERROR] Error in calculateBill wallet calculation:', err)
    }
  }

  return sendSuccess(res, {
    data: {
      originalSubTotal,
      serviceDiscount,
      subTotal,
      maxHourDiscount,
      totalSavings: serviceDiscount + maxHourDiscount,
      basePrice,
      platformFee,
      taxes,
      totalAmount,
      totalDurationMins,
      formattedDuration: formatDurationHuman(totalDurationMins),
      estimatedDurationMins: totalDurationMins,
      totalQuantity: servicesToCalculate.reduce((acc, it) => acc + (Number(it.quantity) || 1), 0),
      commissionAmount, // Internal calculation preview
      laborShare: Math.round(Math.max(0, basePrice - commissionAmount - platformFee)),
      paymentModes: settings.paymentModes || { cashEnabled: true, onlineEnabled: true },
      breakdown,
      isMultiService,
      itemsCount: breakdown.length,
      walletInfo,
      checkout: {
        eligibleOrderAmount: totalAmount,
        walletBalance: walletInfo?.walletBalance ?? 0,
        walletUsagePercentage: walletInfo?.walletUsagePercentage ?? walletInfo?.percentage ?? 0,
        maxWalletUsage: walletInfo?.maxWalletUsage ?? walletInfo?.maxWalletDiscount ?? 0,
        walletDeduction: walletInfo?.walletDeduction ?? walletInfo?.actualWalletDiscount ?? 0,
        remainingPayable: walletInfo?.remainingPayable ?? Math.max(0, totalAmount - (walletInfo?.walletDeduction ?? 0)),
      },
      restriction: await checkCustomerBookingRestriction(req.user?._id),
    }
  })
})

export const createBooking = asyncHandler(async (req, res) => {
  // Check customer booking restriction under repeat cancellation policy
  const restrictionStatus = await checkCustomerBookingRestriction(req.user._id)
  if (restrictionStatus?.isRestricted) {
    return sendError(res, {
      message:
        restrictionStatus.restriction?.reason ||
        'Your account is currently restricted from creating new bookings due to repeated cancellations under our cancellation policy.',
      statusCode: HTTP_STATUS.FORBIDDEN,
      data: {
        isRestricted: true,
        restrictedUntil: restrictionStatus.restriction?.restrictedUntil,
        reason: restrictionStatus.restriction?.reason,
        restrictedBy: restrictionStatus.restriction?.restrictedBy,
      },
    })
  }

  const {
    serviceId,
    packageId,
    type,
    scheduledAt,
    timeSlot,
    endTime,
    locationText,
    lat,
    lng,
    paymentMethod,
    notes,
    hours: rawHours = 1,
    quantity = 1,
    imageNames = [],
    contractorInfo
  } = req.body
  const hours = parseFloat(rawHours) || 1 // supports 0.5 = 30 min

  const isMultiService = (Array.isArray(req.body.items) && req.body.items.length > 0)

  if ((!serviceId && !packageId && !isMultiService) || !type || !locationText || !paymentMethod) {
    return sendError(res, { message: 'Missing required fields', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  if (lat === undefined || lng === undefined) {
    return sendError(res, { message: 'Latitude and Longitude are required for accurate matching', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  if (type === 'SCHEDULED' && (!scheduledAt || !timeSlot)) {
    return sendError(res, { message: 'scheduledAt date and timeSlot (startTime) are required for SCHEDULED bookings', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const parsedLng = parseFloat(lng)
  const parsedLat = parseFloat(lat)

  // Enforce Zone matching
  const activeZones = await Zone.find({ isActive: true })
  let matchingZone = null
  if (activeZones.length > 0) {
    const normalizedLocation = locationText.toLowerCase()
    matchingZone = activeZones.find(z => 
      normalizedLocation.includes(z.city.toLowerCase()) || 
      (z.name && normalizedLocation.includes(z.name.toLowerCase()))
    )
    if (!matchingZone && activeZones.length === 1) {
      matchingZone = activeZones[0]
    }
  }

  if (activeZones.length > 0 && !matchingZone) {
    return sendError(res, { message: 'We currently do not provide service in this area (Zone not found).', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  let settings = await SystemSetting.findOne({ configKey: 'master_config' })

  let bookingSubcategoryId = null
  let bookingServiceId = null
  let subTotal = 0
  let maxHourDiscount = 0
  let packageBookingData = null
  let multiServiceBookingData = null
  let multiServiceTaxes = 0
  let totalQuantity = quantity
  let bookingHours = hours
  let computedTotalDurationMins = 60

  if (isMultiService) {
    // ----------------------------------------------------
    // CASE 0: Multi-Service Unified Booking
    // ----------------------------------------------------
    const rawItems = req.body.items
    const processedItems = []
    let computedSubTotal = 0
    const { LabourCategory } = await import('../models/LabourCategory.js')

    for (const itm of rawItems) {
      if (!itm.serviceId) continue
      const srv = await LabourService.findById(itm.serviceId)
      if (!srv || !srv.isActive) {
        return sendError(res, {
          message: `Service "${itm.serviceName || itm.serviceId}" is unavailable or inactive`,
          statusCode: HTTP_STATUS.BAD_REQUEST,
        })
      }

      let subServiceDoc = null
      let subServiceName = undefined
      let subServicePrice = null
      let subServiceOrigPrice = null
      if (itm.subServiceId && Array.isArray(srv.subServices)) {
        subServiceDoc = srv.subServices.find(ss => String(ss._id) === String(itm.subServiceId))
        if (subServiceDoc) {
          subServiceName = subServiceDoc.name
          if (Number(subServiceDoc.price) > 0) {
            subServicePrice = Number(subServiceDoc.price)
            if (Number(subServiceDoc.originalPrice) > subServicePrice) {
              subServiceOrigPrice = Number(subServiceDoc.originalPrice)
            }
          }
        }
      }

      const srvFallback = Number(srv.hourlyPrice || srv.basePrice || srv.pricePerUnit || 0)
      let baseRate = subServiceOrigPrice || (subServicePrice !== null ? subServicePrice : srvFallback)

      if (matchingZone && srv.zones && srv.zones.length > 0 && !itm.subServiceId) {
        const zonePricing = srv.zones.find(z => String(z.zone) === String(matchingZone._id))
        if (zonePricing && typeof zonePricing.price === 'number' && Number(zonePricing.price) > 0) {
          baseRate = Number(zonePricing.price)
        }
      }
      if (!baseRate || baseRate <= 0) baseRate = srvFallback

      let unitPrice = subServiceOrigPrice ? subServicePrice : baseRate
      if (!subServiceOrigPrice && srv.discountValue > 0) {
        if (srv.discountType === 'PERCENTAGE') {
          unitPrice = Math.max(0, Math.round(baseRate * (1 - srv.discountValue / 100)))
        } else {
          unitPrice = Math.max(0, baseRate - srv.discountValue)
        }
      }
      if (!unitPrice || unitPrice <= 0) unitPrice = baseRate

      const itemQty = Number(itm.quantity) || 1
      const itemHours = Number(itm.hours) || hours || 1
      const itemUnitDuration = Number(subServiceDoc?.estimatedDurationMins || srv.estimatedDurationMins || itm.estimatedDurationMins || 45)
      const itemTotalDuration = itemUnitDuration * itemQty
      computedTotalDurationMins = (computedTotalDurationMins === 60 && processedItems.length === 0 ? 0 : computedTotalDurationMins) + itemTotalDuration

      const itemTotal = unitPrice * itemHours * itemQty
      computedSubTotal += itemTotal

      let catDoc = null
      let subDoc = null
      if (srv.subcategoryId) {
        subDoc = await LabourSubcategory.findById(srv.subcategoryId).lean()
        if (subDoc?.categoryId) {
          catDoc = await LabourCategory.findById(subDoc.categoryId).lean()
        }
      }

      let itmGst = 0
      if (catDoc && catDoc.isGstActive) {
        itmGst = catDoc.gstPercentage || 0
      } else if (settings?.gstPercentage > 0) {
        itmGst = settings.gstPercentage
      }
      if (itmGst > 0) {
        multiServiceTaxes += (itemTotal * itmGst) / 100
      }

      const itemStartOtp = Math.floor(1000 + Math.random() * 9000).toString()
      const itemCompletionOtp = Math.floor(1000 + Math.random() * 9000).toString()

      processedItems.push({
        serviceId: srv._id,
        subServiceId: itm.subServiceId || undefined,
        serviceName: srv.name,
        subServiceName: subServiceName || itm.subServiceName || undefined,
        categoryId: catDoc?._id || undefined,
        subcategoryId: subDoc?._id || srv.subcategoryId || undefined,
        categoryName: catDoc?.name || undefined,
        subcategoryName: subDoc?.name || undefined,
        iconUrl: srv.iconUrl || undefined,
        unitPrice,
        originalPrice: baseRate,
        quantity: itemQty,
        hours: itemHours,
        estimatedDurationMins: itemUnitDuration,
        totalDurationMins: itemTotalDuration,
        formattedDuration: formatDurationHuman(itemTotalDuration),
        itemTotal,
        status: 'PENDING',
        startOtp: itemStartOtp,
        completionOtp: itemCompletionOtp,
      })
    }

    if (processedItems.length === 0) {
      return sendError(res, {
        message: 'No valid services provided for multi-service booking',
        statusCode: HTTP_STATUS.BAD_REQUEST,
      })
    }

    bookingServiceId = processedItems[0].serviceId
    bookingSubcategoryId = processedItems[0].subcategoryId
    subTotal = computedSubTotal
    totalQuantity = processedItems.reduce((acc, it) => acc + it.quantity, 0)
    bookingHours = Math.max(0.5, parseFloat((computedTotalDurationMins / 60).toFixed(1)))
    maxHourDiscount = 0
    multiServiceBookingData = {
      isMultiService: true,
      items: processedItems,
    }
  } else if (packageId) {
    // ----------------------------------------------------
    // CASE 1: Predefined Service Package Booking
    // ----------------------------------------------------
    const pkg = await ServicePackage.findById(packageId)
    if (!pkg || pkg.status !== 'ACTIVE') {
      return sendError(res, { message: 'Selected package is invalid or no longer active', statusCode: HTTP_STATUS.BAD_REQUEST })
    }
    const now = new Date()
    if (pkg.validFrom && new Date(pkg.validFrom) > now) {
      return sendError(res, { message: 'This package offer has not started yet', statusCode: HTTP_STATUS.BAD_REQUEST })
    }
    if (pkg.validUntil && new Date(pkg.validUntil) < now) {
      return sendError(res, { message: 'This package offer has expired', statusCode: HTTP_STATUS.BAD_REQUEST })
    }
    if (!pkg.isAllZones && pkg.zones && pkg.zones.length > 0) {
      const zoneMatch = pkg.zones.some(z => String(z) === String(matchingZone._id))
      if (!zoneMatch) {
        return sendError(res, { message: 'This package is not available in your service area', statusCode: HTTP_STATUS.BAD_REQUEST })
      }
    }

    // Validate each inclusion service is available
    for (const inc of (pkg.inclusions || [])) {
      if (inc.serviceId) {
        const srv = await LabourService.findById(inc.serviceId).lean()
        if (!srv || !srv.isActive) {
          return sendError(res, {
            message: `Package inclusion "${inc.name || 'Service'}" is currently unavailable or disabled`,
            statusCode: HTTP_STATUS.BAD_REQUEST
          })
        }
      }
    }

    // Determine primary service and subcategory for labour partner assignment
    bookingServiceId = (pkg.inclusions && pkg.inclusions[0]?.serviceId) || serviceId
    if (bookingServiceId) {
      const primarySrv = await LabourService.findById(bookingServiceId)
      if (primarySrv) {
        bookingSubcategoryId = pkg.subcategoryId || primarySrv.subcategoryId
      }
    }
    if (!bookingSubcategoryId) {
      bookingSubcategoryId = pkg.subcategoryId
    }

    subTotal = Number(pkg.price) || 0
    maxHourDiscount = 0
    totalQuantity = 1
    const pkgDuration = Number(pkg.estimatedDurationMins || 60) * (Number(quantity) || 1)
    computedTotalDurationMins = pkgDuration
    bookingHours = Math.max(0.5, parseFloat((pkgDuration / 60).toFixed(1)))

    const packageOriginalPrice = Number(pkg.originalPrice) || subTotal
    const packageSavings = Math.max(0, packageOriginalPrice - subTotal)

    packageBookingData = {
      isPackage: true,
      packageId: pkg._id,
      packageName: pkg.name,
      packageSlug: pkg.slug,
      packagePrice: pkg.price,
      originalPrice: packageOriginalPrice,
      savings: packageSavings,
      inclusions: (pkg.inclusions || []).map(inc => ({
        serviceId: inc.serviceId,
        name: inc.name,
        brand: inc.brand || '',
        quantity: inc.quantity || 1,
        duration: inc.duration || '',
        description: inc.description || ''
      })),
      snapshot: {
        name: pkg.name,
        slug: pkg.slug,
        description: pkg.description,
        shortDescription: pkg.shortDescription,
        images: pkg.images || [],
        imageUrl: pkg.imageUrl,
        badge: pkg.badge,
        termsAndConditions: pkg.termsAndConditions,
        exclusions: pkg.exclusions,
        estimatedDurationMins: pkg.estimatedDurationMins,
        price: pkg.price,
        originalPrice: packageOriginalPrice,
        bookedAtPrice: pkg.price,
        bookedAtDate: new Date(),
      }
    }
  } else {
    // ----------------------------------------------------
    // CASE 2: Standard Single / Contractor Service Booking
    // ----------------------------------------------------
    const service = await LabourService.findById(serviceId)
    if (!service || !service.isActive) {
      return sendError(res, { message: 'Valid and active Service required', statusCode: HTTP_STATUS.BAD_REQUEST })
    }
    bookingSubcategoryId = service.subcategoryId
    bookingServiceId = service._id

    const resolveHourlyRate = async (sId, ssId = req.body.subServiceId) => {
      let hrRate = 0
      const srv = await LabourService.findById(sId)
      if (srv) {
        const srvFallback = Number(srv.hourlyPrice || srv.basePrice || srv.pricePerUnit || 0)
        let baseRate = srvFallback
        if (ssId && Array.isArray(srv.subServices)) {
          const foundSub = srv.subServices.find(ss => String(ss._id) === String(ssId))
          if (foundSub && Number(foundSub.price) > 0) {
            const subPrice = Number(foundSub.price)
            const subOrig = Number(foundSub.originalPrice) || 0
            if (subOrig > subPrice) {
              return subPrice // explicit subService discount already applied
            }
            baseRate = subPrice
          } else {
            baseRate = srvFallback
          }
        } else if (matchingZone && srv.zones && srv.zones.length > 0) {
          const zonePricing = srv.zones.find(z => String(z.zone) === String(matchingZone._id))
          if (zonePricing && typeof zonePricing.price === 'number' && Number(zonePricing.price) > 0) {
            baseRate = Number(zonePricing.price)
          }
        }
        if (!baseRate || baseRate <= 0) {
          baseRate = srvFallback
        }
        if (srv.discountValue > 0) {
          if (srv.discountType === 'PERCENTAGE') {
            hrRate = Math.max(0, Math.round(baseRate * (1 - srv.discountValue / 100)))
          } else {
            hrRate = Math.max(0, baseRate - srv.discountValue)
          }
        } else {
          hrRate = baseRate
        }
        if (!hrRate || hrRate <= 0) {
          hrRate = baseRate
        }
      }
      return hrRate
    }

    if (contractorInfo && contractorInfo.services && contractorInfo.services.length > 0) {
      let contractorDuration = 0
      for (const item of contractorInfo.services) {
        const hrRate = await resolveHourlyRate(item.serviceId)
        item.price = hrRate // Store the unit hourly rate
        subTotal += hrRate * hours * (item.quantity || 1)
        const srvDoc = await LabourService.findById(item.serviceId).select('estimatedDurationMins').lean()
        contractorDuration += Number(srvDoc?.estimatedDurationMins || 60) * (item.quantity || 1)
      }
      totalQuantity = contractorInfo.services.reduce((acc, curr) => acc + (curr.quantity || 1), 0)
      computedTotalDurationMins = contractorDuration || (hours * 60)
      bookingHours = Math.max(0.5, parseFloat((computedTotalDurationMins / 60).toFixed(1)))
    } else {
      const hrRate = await resolveHourlyRate(serviceId)
      subTotal = hrRate * hours * quantity
      totalQuantity = quantity
      const srvUnitDuration = Number(service.estimatedDurationMins || 60)
      computedTotalDurationMins = srvUnitDuration * (Number(quantity) || 1)
      bookingHours = Math.max(0.5, parseFloat((computedTotalDurationMins / 60).toFixed(1)))
    }

    if (hours >= 8 && settings?.maxHourDiscountPercentage > 0) {
      maxHourDiscount = (subTotal * settings.maxHourDiscountPercentage) / 100
    }
  }

  const basePrice = subTotal - maxHourDiscount
  let platformFee = 0
  if (settings?.platformFee?.isActive) {
    platformFee = settings.platformFee.type === 'fixed' 
      ? settings.platformFee.value 
      : (basePrice * settings.platformFee.value) / 100
  }

  let taxes = isMultiService ? multiServiceTaxes : 0

  if (!isMultiService) {
    let gstPercentage = 0
    if (bookingSubcategoryId) {
      const subcategory = await LabourSubcategory.findById(bookingSubcategoryId)
      if (subcategory) {
        const { LabourCategory } = await import('../models/LabourCategory.js')
        const category = await LabourCategory.findById(subcategory.categoryId)
        if (category && category.isGstActive) {
          gstPercentage = category.gstPercentage || 0
        }
      }
    }
    if (!gstPercentage && settings?.gstPercentage > 0) {
      gstPercentage = settings.gstPercentage
    }

    if (gstPercentage > 0) {
      taxes = (basePrice * gstPercentage) / 100
    }
  }

  // Customer does not pay platform fee; customer pays basePrice + taxes
  const rawTotalAmount = basePrice + taxes
  let finalPayableAmount = rawTotalAmount
  let walletDiscountData = { applied: false, amount: 0, percentage: 0, eligibleAmount: 0, walletTransactionId: null }

  if (req.body.useWallet && req.user?._id) {
    try {
      const { deductWalletForBooking } = await import('../services/userWalletService.js')
      const deductionRes = await deductWalletForBooking({
        userId: req.user._id,
        bookingId: null,
        eligibleBillAmount: rawTotalAmount,
        requestedUseWallet: true,
      })
      if (deductionRes.applied && deductionRes.amount > 0) {
        walletDiscountData = {
          applied: true,
          amount: deductionRes.amount,
          percentage: deductionRes.percentage || deductionRes.walletUsagePercentage || 0,
          eligibleAmount: rawTotalAmount,
          walletTransactionId: deductionRes.walletTransactionId,
        }
        finalPayableAmount = Math.max(0, rawTotalAmount - deductionRes.amount)
      }
    } catch (err) {
      console.error('[WALLET_ERROR] Error applying wallet discount during booking creation:', err)
    }
  }

  let commissionAmount = 0
  if (settings?.commission?.isActive && settings.commission.type === 'global') {
    commissionAmount = (basePrice * settings.commission.globalPercentage) / 100
  }

  const laborShare = Math.round(Math.max(0, basePrice - commissionAmount - platformFee))

  const startOtp = Math.floor(1000 + Math.random() * 9000).toString()
  const completionOtp = Math.floor(1000 + Math.random() * 9000).toString()

  let booking
  try {
    booking = await Booking.create({
      userId: req.user._id,
      subcategoryId: bookingSubcategoryId,
      serviceId: bookingServiceId,
      subServiceId: req.body.subServiceId || undefined,
      subServiceName: req.body.subServiceName || undefined,
      type,
      scheduledAt: type === 'SCHEDULED' ? parseISTDateTime(scheduledAt, timeSlot) : undefined,
      timeSlot: type === 'SCHEDULED' ? timeSlot : (type === 'INSTANT' ? timeSlot : undefined),
      endTime: type === 'SCHEDULED' ? endTime : undefined,
      images: Array.isArray(imageNames) ? imageNames : [],
      notes,
      hours: bookingHours,
      quantity: totalQuantity,
      totalDurationMins: computedTotalDurationMins,
      formattedDuration: formatDurationHuman(computedTotalDurationMins),
      contractorInfo,
      maxHourDiscount,
      packageBooking: packageBookingData,
      multiServiceBooking: multiServiceBookingData,
      address: { 
        locationText,
        coordinates: {
          type: 'Point',
          coordinates: [parsedLng, parsedLat] // GeoJSON uses [longitude, latitude]
        }
      },
      basePrice,
      platformFee,
      taxes,
      walletDiscount: walletDiscountData,
      totalAmount: finalPayableAmount,
      commissionAmount,
      laborShare,
      paymentMethod,
      status: 'CREATED',
      startOtp,
      completionOtp
    })
  } catch (createErr) {
    // Critical rollback: if wallet deduction was already made, refund customer wallet immediately
    if (walletDiscountData.applied && walletDiscountData.amount > 0) {
      try {
        const { refundWalletForBooking } = await import('../services/userWalletService.js')
        await refundWalletForBooking({
          userId: req.user._id,
          bookingId: null,
          amount: walletDiscountData.amount,
          reason: 'Rollback due to booking creation failure',
        })
      } catch (rollbackErr) {
        console.error('[WALLET_ROLLBACK_ERROR] Failed to rollback wallet deduction on booking creation failure:', rollbackErr)
      }
    }
    throw createErr
  }

  // Increment booking count on the package if applicable
  if (packageId) {
    ServicePackage.findByIdAndUpdate(packageId, { $inc: { bookingCount: 1 } }).catch(err => {
      console.error('[PACKAGE_COUNT_ERROR] Failed to increment booking count on package:', err)
    })
  }

  // Link transaction referenceId & bookingId to created booking
  if (walletDiscountData.walletTransactionId) {
    import('../models/WalletTransaction.js').then(({ WalletTransaction }) => {
      WalletTransaction.findByIdAndUpdate(walletDiscountData.walletTransactionId, {
        bookingId: booking._id,
        referenceId: booking._id,
        description: `Wallet deduction of ₹${walletDiscountData.amount} (${walletDiscountData.percentage}%) applied on booking #${String(booking._id).slice(-6).toUpperCase()}`,
      }).catch(err => console.error('Error linking wallet tx reference:', err))
    })
  }


  // Phase 3: Trigger the Broadcast Engine asynchronously
  // Trigger immediately for INSTANT bookings OR SCHEDULED bookings that are already within the 1-hour window (<= 60 mins)
  const isScheduled = type === 'SCHEDULED' || type === 'scheduled'
  const isInstant = type === 'INSTANT' || type === 'instant'

  const scheduledAtDate = booking.scheduledAt ? new Date(booking.scheduledAt) : null
  const nowMs = Date.now()
  const minutesUntilScheduled = scheduledAtDate ? Math.round((scheduledAtDate.getTime() - nowMs) / 60000) : 0

  console.log(`[BOOKING_CREATE] Booking ${booking._id} created: type=${booking.type}, scheduledAt=${booking.scheduledAt}, timeSlot="${booking.timeSlot}", minutesUntilJob=${minutesUntilScheduled} mins`)

  console.log(`[BOOKING_CREATE] Triggering immediate broadcast for booking ${booking._id} (type=${booking.type})`)
  import('../services/broadcastService.js').then(({ startBroadcastCycle }) => {
    startBroadcastCycle(booking._id).catch(err => console.error('[BOOKING_CREATE] Broadcast Error:', err))
  })

  if (isScheduled) {
    import('../socket.js').then(({ emitToUser }) => {
      emitToUser(booking.userId, 'BOOKING_SCHEDULED_QUEUED', { bookingId: booking._id, scheduledAt: booking.scheduledAt })
    }).catch(err => console.error(err))

    // Schedule automated Date & Time reminder notifications
    import('../services/bookingReminderService.js').then(({ scheduleRemindersForBooking }) => {
      scheduleRemindersForBooking(booking._id).catch(err => console.error('[Reminder Scheduling Error on Create]', err))
    }).catch(err => console.error('[Import Error]', err))
  }

  // Save the address for future use if requested
  if (req.body.saveAddress) {
    import('../models/User.js').then(({ User }) => {
      User.findByIdAndUpdate(req.user._id, {
        'savedAddress.text': locationText,
        'savedAddress.lat': lat,
        'savedAddress.lng': lng
      }).catch(err => console.error('Update savedAddress error:', err))
    })
  }

  return sendSuccess(res, { message: 'Booking created successfully', statusCode: HTTP_STATUS.CREATED, data: { booking } })
})

export const getBookingStatus = asyncHandler(async (req, res) => {
  const booking = await Booking.findById(req.params.id)
    .populate('subcategoryId')
    .populate('serviceId').populate('contractorInfo.services.serviceId')
    .populate('packageBooking.packageId')
    .populate('packageBooking.inclusions.serviceId')
    .populate('multiServiceBooking.items.serviceId')
    .populate('multiServiceBooking.items.assignedLabourId', 'fullName phone profileImageUrl labourProfile rating experienceYears')
    .populate('laborId', 'fullName phone profileImageUrl labourProfile rating experienceYears')
    .populate('userId', 'fullName phone')
    .populate('assignments.labourId', 'fullName phone profileImageUrl serviceIds labourProfile rating experienceYears')
    .lean()

  if (!booking) {
    return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  // Hide OTPs from labourer
  if (['labour', 'contractor'].includes(req.user.role)) {
    if (String(req.user._id) !== String(booking.userId?._id || booking.userId)) {
      delete booking.startOtp
      delete booking.completionOtp
      if (booking.assignments) {
        booking.assignments.forEach(a => {
          delete a.startOtp;
          delete a.completionOtp;
        })
      }
      if (booking.multiServiceBooking?.items) {
        booking.multiServiceBooking.items.forEach(item => {
          if (String(item.assignedLabourId?._id || item.assignedLabourId) !== String(req.user._id)) {
            delete item.startOtp
            delete item.completionOtp
          }
        })
      }
    }
  }

  // Collect all assigned labour IDs to enrich with real reviews and completed bookings stats
  const labourIds = []
  if (booking.laborId) labourIds.push(booking.laborId._id || booking.laborId)
  if (booking.assignments) {
    booking.assignments.forEach((a) => {
      if (a.labourId) labourIds.push(a.labourId._id || a.labourId)
    })
  }
  if (booking.multiServiceBooking?.items) {
    booking.multiServiceBooking.items.forEach((item) => {
      if (item.assignedLabourId) labourIds.push(item.assignedLabourId._id || item.assignedLabourId)
    })
  }

  if (labourIds.length > 0) {
    const statsMap = await getMultipleLaboursStats(labourIds)
    const enrich = (target) => {
      if (target && typeof target === 'object') {
        const s = statsMap[String(target._id)]
        if (s) {
          target.rating = s.rating || target.labourProfile?.rating || target.rating || null
          target.totalReviews = s.totalReviews || 0
          target.completedBookingsCount = s.completedBookingsCount || 0
        }
      }
    }
    enrich(booking.laborId)
    if (booking.assignments) {
      booking.assignments.forEach((a) => enrich(a.labourId))
    }
    if (booking.multiServiceBooking?.items) {
      booking.multiServiceBooking.items.forEach((item) => enrich(item.assignedLabourId))
    }
  }

  return sendSuccess(res, { data: { booking } })
})

export const getMyBookings = asyncHandler(async (req, res) => {
  const { role, _id } = req.user
  
  let query = {}
  if (role === 'customer' || role === 'contractor') {
    query = { userId: _id }
  } else if (role === 'labour' || role === 'contractor') {
    query = { 
      $or: [
        { userId: _id },
        { laborId: _id, status: { $in: ['ACCEPTED', 'ASSIGNED', 'EN_ROUTE', 'STARTED', 'COMPLETED', 'CANCELLED'] } },
        { acceptedLabourIds: _id },
        { 'multiServiceBooking.items.assignedLabourId': _id }
      ] 
    }
  } else {
    return sendError(res, { message: 'Unauthorized role for fetching bookings', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  const bookings = await Booking.find(query)
    .populate('subcategoryId')
    .populate('serviceId').populate('contractorInfo.services.serviceId')
    .populate('packageBooking.packageId')
    .populate('packageBooking.inclusions.serviceId')
    .populate('multiServiceBooking.items.serviceId')
    .populate('multiServiceBooking.items.assignedLabourId', 'fullName phone profileImageUrl')
    .populate('userId', 'fullName phone')
    .populate('laborId', 'fullName phone profileImageUrl')
    .populate('assignments.labourId', 'fullName phone profileImageUrl serviceIds labourProfile')
    .sort({ createdAt: -1 })
    .lean()

  bookings.forEach(b => {
    // Hide OTPs if the requesting user is NOT the customer
    if (String(_id) !== String(b.userId?._id || b.userId)) {
      delete b.startOtp
      delete b.completionOtp
      if (b.assignments) {
        b.assignments.forEach(a => {
          delete a.startOtp;
          delete a.completionOtp;
        })
      }
      if (b.multiServiceBooking?.items) {
        b.multiServiceBooking.items.forEach(item => {
          if (String(item.assignedLabourId?._id || item.assignedLabourId) !== String(_id)) {
            delete item.startOtp
            delete item.completionOtp
          }
        })
      }
    }

    // Recover display amount if booking was stored with 0 totalAmount
    if ((!b.totalAmount || Number(b.totalAmount) <= 0) && b.serviceId) {
      const srv = b.serviceId
      const base = Number(srv.hourlyPrice || srv.basePrice || srv.pricePerUnit || 0)
      if (base > 0) {
        const discVal = Number(srv.discountValue || 0)
        let discounted = base
        if (discVal > 0) {
          if (srv.discountType === 'PERCENTAGE') {
            discounted = Math.max(0, Math.round(base * (1 - discVal / 100)))
          } else {
            discounted = Math.max(0, base - discVal)
          }
        }
        b.basePrice = discounted * (b.hours || 1) * (b.quantity || 1)
        b.totalAmount = b.basePrice + Number(b.platformFee || 0) + Number(b.taxes || 0)
      }
    }
  })

  // Enrich bookings with labour stats
  const allLabourIds = []
  bookings.forEach((b) => {
    if (b.laborId) allLabourIds.push(b.laborId._id || b.laborId)
    if (b.assignments) {
      b.assignments.forEach((a) => {
        if (a.labourId) allLabourIds.push(a.labourId._id || a.labourId)
      })
    }
  })
  if (allLabourIds.length > 0) {
    const statsMap = await getMultipleLaboursStats(allLabourIds)
    const enrich = (target) => {
      if (target && typeof target === 'object') {
        const s = statsMap[String(target._id)]
        if (s) {
          target.rating = s.rating || target.labourProfile?.rating || target.rating || null
          target.totalReviews = s.totalReviews || 0
          target.completedBookingsCount = s.completedBookingsCount || 0
        }
      }
    }
    bookings.forEach((b) => {
      enrich(b.laborId)
      if (b.assignments) b.assignments.forEach((a) => enrich(a.labourId))
    })
  }

  return sendSuccess(res, { data: { bookings } })
})

// @desc    Update booking payment method
// @route   PATCH /api/v1/bookings/:id/payment-method
// @access  Private (User)
export const updatePaymentMethod = asyncHandler(async (req, res) => {
  const { paymentMethod } = req.body
  const booking = await Booking.findById(req.params.id)

  if (!booking) {
    return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  // Only allow updating if it belongs to the user
  if (booking.userId.toString() !== req.user.id) {
    return sendError(res, { message: 'Not authorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  booking.paymentMethod = paymentMethod
  await booking.save()

  res.json({ success: true, paymentMethod })
})

export const updateBookingStatus = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { status, otp, startWorkImage, endWorkImage, beforeImage, afterImage } = req.body
  const booking = await Booking.findById(id)
  
  if (!booking) return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })
  
  const isLabourer = String(req.user._id) !== String(booking.userId);
  const labourIdStr = String(req.user._id);

  if (isLabourer && !booking.acceptedLabourIds?.includes(labourIdStr) && String(booking.laborId) !== labourIdStr) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  if (status === 'CANCELLED' && isLabourer) {
    try {
      const { processVendorCancellation } = await import('../services/bookingCancellationService.js')
      const cancelResult = await processVendorCancellation({
        bookingId: booking._id,
        vendorId: req.user._id,
        reason: req.body.reason || 'Cancelled by service provider',
        reasonCategory: req.body.reasonCategory || 'Health or Personal Issue',
      })
      return sendSuccess(res, {
        message:
          cancelResult.status === 'CANCELLATION_REQUESTED'
            ? 'Cancellation requested. Sent to Admin Dashboard for approval.'
            : cancelResult.penaltyDeducted > 0
            ? `Booking cancelled. A late penalty of ₹${cancelResult.penaltyDeducted} was deducted.`
            : 'Booking cancelled. Booking will be re-broadcast to nearby service providers.',
        data: cancelResult,
      })
    } catch (err) {
      return sendError(res, { message: err.message, statusCode: HTTP_STATUS.BAD_REQUEST })
    }
  }

  const validTransitions = {
    'ACCEPTED': ['EN_ROUTE', 'CANCELLED'],
    'EN_ROUTE': ['STARTED', 'CANCELLED'],
    'STARTED': ['COMPLETED']
  }

  // Find specific assignment if bulk booking
  let assignment = booking.assignments?.find(a => String(a.labourId) === labourIdStr);
  const currentStatus = assignment ? assignment.status : booking.status;

  if (currentStatus === status) {
    return sendSuccess(res, { message: `Status is already ${status}`, data: { booking } })
  }

  if (!validTransitions[currentStatus]?.includes(status)) {
    return sendError(res, { message: `Invalid transition from ${currentStatus} to ${status}`, statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const startOtp = assignment ? assignment.startOtp : booking.startOtp;
  const completionOtp = assignment ? assignment.completionOtp : booking.completionOtp;

  // OTP Verification
  if (status === 'STARTED') {
    if (!otp) return sendError(res, { message: 'OTP is required to start the job', statusCode: HTTP_STATUS.BAD_REQUEST })
    if (otp !== startOtp) return sendError(res, { message: 'Invalid Start OTP', statusCode: HTTP_STATUS.BAD_REQUEST })
    const finalStartImg = startWorkImage || beforeImage
    
    if (assignment) {
      if (finalStartImg) assignment.startWorkImage = finalStartImg;
      assignment.startedAt = new Date();
    } else {
      if (finalStartImg) booking.startWorkImage = finalStartImg;
      booking.startedAt = new Date();
    }

    // Verify and record Late Fee Incident if partner arrived past grace period
    recordLateFeeIncident({
      booking,
      vendorId: req.user._id,
      arrivalTime: new Date(),
    }).catch((err) => console.warn('[Late Fee Hook Warning]', err?.message))
  }

  if (status === 'COMPLETED') {
    if (!otp) return sendError(res, { message: 'OTP is required to complete the job', statusCode: HTTP_STATUS.BAD_REQUEST })
    if (otp !== completionOtp) return sendError(res, { message: 'Invalid Completion OTP', statusCode: HTTP_STATUS.BAD_REQUEST })
    const finalEndImg = endWorkImage || afterImage
    
    if (assignment) {
      if (finalEndImg) assignment.endWorkImage = finalEndImg;
      assignment.completedAt = new Date();
    } else {
      if (finalEndImg) booking.endWorkImage = finalEndImg;
    }
  }

  if (assignment) {
    assignment.status = status;
  } else {
    booking.status = status;
  }

  // Sync multiServiceBooking item status if applicable
  if (booking.multiServiceBooking?.isMultiService && Array.isArray(booking.multiServiceBooking.items)) {
    const multiItem = booking.multiServiceBooking.items.find(it => 
      String(it.assignedLabourId) === labourIdStr || 
      (assignment && String(it.serviceId) === String(assignment.serviceId))
    )
    if (multiItem) {
      multiItem.status = status
      if (status === 'STARTED') multiItem.startedAt = new Date()
      if (status === 'COMPLETED') multiItem.completedAt = new Date()
    }

    const activeItems = booking.multiServiceBooking.items.filter(it => it.status !== 'CANCELLED')
    const itemStatuses = activeItems.map(it => it.status)
    if (itemStatuses.length > 0 && itemStatuses.every(s => s === 'COMPLETED')) {
      booking.status = 'COMPLETED'
    } else if (itemStatuses.some(s => s === 'COMPLETED')) {
      booking.status = 'PARTIALLY_COMPLETED'
    } else if (itemStatuses.some(s => s === 'STARTED')) {
      booking.status = 'STARTED'
    } else if (itemStatuses.some(s => s === 'EN_ROUTE')) {
      booking.status = 'EN_ROUTE'
    } else if (itemStatuses.length > 0 && itemStatuses.every(s => s === 'ACCEPTED')) {
      booking.status = 'ACCEPTED'
    } else if (itemStatuses.some(s => s === 'ACCEPTED')) {
      booking.status = 'PARTIALLY_ACCEPTED'
    }
  } else if (booking.assignments && booking.assignments.length > 0) {
    // Calculate top-level booking status based on assignments if it's a bulk booking
    const allStatuses = booking.assignments.map(a => a.status);
    const expectedQuantity = booking.quantity || 1;
    if (allStatuses.length > 0 && allStatuses.every(s => s === 'COMPLETED')) {
      booking.status = 'COMPLETED';
    } else if (allStatuses.some(s => s === 'STARTED' || s === 'COMPLETED')) {
      booking.status = 'STARTED';
    } else if (allStatuses.some(s => s === 'EN_ROUTE')) {
      booking.status = 'EN_ROUTE';
    } else if (allStatuses.length === expectedQuantity && allStatuses.every(s => s === 'ACCEPTED')) {
      booking.status = 'ACCEPTED';
    }
  } else if (!assignment) {
    booking.status = status;
  }

  await booking.save()

  // Phase 4: Handle Commission if Cash Payment and Completed
  if (status === 'COMPLETED') {
    let wallet = await Wallet.findOne({ userId: booking.laborId })
    if (!wallet) wallet = new Wallet({ userId: booking.laborId })

    if (booking.paymentMethod === 'CASH') {
      try {
        const { settleCashBookingPayment } = await import('../services/labourWalletService.js')
        const effectiveLabourId = booking.laborId || booking.acceptedLabourId || (booking.assignments && booking.assignments.find(a => a.labourId)?.labourId)
        await settleCashBookingPayment({ bookingId: booking._id, labourId: effectiveLabourId })
      } catch (settleErr) {
        console.error('[Auto Cash Settlement on Job Complete Error]:', settleErr)
      }
    } else if (booking.paymentMethod === 'ONLINE') {
      // ONLY payout if the customer has actually completed the online payment.
      // If they haven't paid yet, the paymentController will handle this payout later once they pay.
      if (booking.paymentStatus === 'PAID') {
        // Add laborShare to labor's self wallet
        wallet.selfBalance += booking.laborShare
        await wallet.save()

        import('../models/WalletTransaction.js').then(({ WalletTransaction }) => {
          WalletTransaction.create({
            walletId: wallet._id,
            amount: booking.laborShare,
            type: 'CREDIT',
            targetWallet: 'SELF',
            context: 'PAYOUT',
            referenceId: booking._id,
            description: 'Payout for Online Booking'
          }).catch(err => console.error('WalletTx error:', err))
        })

        // Log splits to AdminWallet for Platform Fee, Commission and total business
        if (booking.platformFee > 0 || booking.commissionAmount > 0 || booking.basePrice > 0 || booking.taxes > 0) {
          let adminWallet = await AdminWallet.findOne()
          if (!adminWallet) adminWallet = new AdminWallet()
          
          adminWallet.totalPlatformFeesCollected += (booking.platformFee || 0)
          adminWallet.totalCommissionsCollected += (booking.commissionAmount || 0)
          adminWallet.totalTaxesCollected += (booking.taxes || 0)
          adminWallet.totalServiceAmountCollected += (booking.basePrice || 0)
          await adminWallet.save()
        }
      }

      // Trigger Rewards & Incentives evaluation for participating vendors
      import('../services/rewardEvaluationService.js').then(({ evaluateVendorRewardsOnEvent }) => {
        const targetVendors = []
        if (booking.laborId) targetVendors.push(booking.laborId)
        if (booking.acceptedLabourId) targetVendors.push(booking.acceptedLabourId)
        if (booking.assignments && booking.assignments.length > 0) {
          booking.assignments.forEach(a => {
            if (a.labourId) targetVendors.push(typeof a.labourId === 'object' ? a.labourId._id : a.labourId)
          })
        }
        const uniqueVendors = [...new Set(targetVendors.map(String))]
        uniqueVendors.forEach(vId => {
          evaluateVendorRewardsOnEvent({ vendorId: vId, bookingId: booking._id })
        })
      }).catch(err => console.error('Reward evaluation on booking completion error:', err))

      // Cancel any pending reminders for completed booking
      import('../services/bookingReminderService.js').then(({ cancelRemindersForBooking }) => {
        cancelRemindersForBooking(booking._id, 'Booking completed').catch(console.error)
      }).catch(() => {})
    }

    // Award automatic 15% (or configured %) service completion credit to customer wallet
    if (booking.paymentStatus === 'PAID') {
      import('../services/userWalletService.js')
        .then(({ awardServiceCompletionWalletCredit }) => {
          awardServiceCompletionWalletCredit(booking._id).catch((creditErr) =>
            console.error('[Service Completion Wallet Credit Error in updateBookingStatus]:', creditErr)
          )
        })
        .catch((err) => console.error(err))
    }
  }

  // Phase 5: Handle Bounce Penalty if Labourer cancels an accepted/en-route booking
  let penaltyDeducted = 0
  if (status === 'CANCELLED') {
    const { reason = '', waivePenalty = false } = req.body
    booking.cancellationReason = reason || 'Cancelled'
    booking.cancelledAt = new Date()

    if (isLabourer) {
      booking.cancelledBy = 'LABOUR'
      if (assignment) {
        assignment.cancellationReason = reason || 'Cancelled by worker'
      }

      // Check if reason is an exempt fake/bogus customer alert
      const lowerReason = String(reason).toLowerCase()
      const isExempt = Boolean(waivePenalty) || 
                       lowerReason.includes('fake') || 
                       lowerReason.includes('unreachable') || 
                       lowerReason.includes('wrong address') ||
                       lowerReason.includes('customer requested') ||
                       lowerReason.includes('customer cancelled')

      if (!isExempt) {
        // Record Bounce Penalty through central engine (supports review vs auto-deduct, audit, precedence)
        recordBounceIncident({
          booking,
          vendorId: req.user._id,
          reason: reason || 'Worker cancellation',
          cancelledBy: 'LABOUR',
          isExempt,
        }).then((res) => {
          if (res?.created && res.penalty?.deductedAmount) {
            booking.penaltyDeducted = res.penalty.deductedAmount
            if (assignment) assignment.penaltyDeducted = res.penalty.deductedAmount
          }
        }).catch((err) => console.warn('[Bounce Penalty Hook Warning]', err?.message))
      }
    } else {
      booking.cancelledBy = 'CUSTOMER'
    }

    // Refund customer wallet discount if booking cancelled
    if (booking.walletDiscount?.applied && booking.walletDiscount?.amount > 0) {
      import('../services/userWalletService.js').then(({ refundWalletForBooking }) => {
        refundWalletForBooking({
          userId: booking.userId,
          bookingId: booking._id,
          amount: booking.walletDiscount.amount,
          reason: `Refund for cancelled booking #${String(booking._id).slice(-6).toUpperCase()}`,
        }).catch(err => console.error('Error refunding customer wallet on cancellation:', err))
      })
    }

    // Release held cash charges reservation for labourer if cash booking
    if (booking.paymentMethod === 'CASH') {
      const labourIdToRelease = booking.laborId || booking.acceptedLabourId || (assignment ? assignment.labourId : null)
      const expectedCharges = (booking.platformFee || 0) + (booking.taxes || 0) + (booking.commissionAmount || 0)
      if (labourIdToRelease && expectedCharges > 0) {
        import('../services/labourWalletService.js').then(({ releaseCashBookingCharges }) => {
          releaseCashBookingCharges({ labourId: labourIdToRelease, bookingId: booking._id, amount: expectedCharges })
            .catch(err => console.error('Error releasing reservation on cancellation:', err))
        }).catch(() => {})
      }
    }

    // Cancel any scheduled reminders for this cancelled booking
    import('../services/bookingReminderService.js').then(({ cancelRemindersForBooking }) => {
      cancelRemindersForBooking(booking._id, `Booking cancelled by ${booking.cancelledBy || 'User'}: ${booking.cancellationReason || 'Cancelled'}`).catch(console.error)
    }).catch(err => console.error('[Import Error]', err))

    await booking.save()
  }

  // Notify customer
  import('../socket.js').then(({ emitToUser }) => {
    emitToUser(booking.userId, 'BOOKING_STATUS_UPDATE', { 
      bookingId: booking._id, 
      status, 
      cancelledBy: booking.cancelledBy,
      cancellationReason: booking.cancellationReason,
      penaltyDeducted 
    })
    if (booking.assignments && booking.assignments.length > 0) {
      booking.assignments.forEach(a => {
        const lid = typeof a.labourId === 'object' ? a.labourId._id : a.labourId;
        if (lid) emitToUser(lid, 'BOOKING_STATUS_UPDATE', { 
          bookingId: booking._id, 
          status, 
          cancelledBy: booking.cancelledBy,
          cancellationReason: booking.cancellationReason,
          penaltyDeducted 
        })
      });
    }
  }).catch(err => console.error(err))

  // Also send Push Notification
  import('../utils/pushNotificationHelper.js').then(({ sendNotificationToUser }) => {
    // To Customer
    sendNotificationToUser(booking.userId, {
      title: 'Booking Update',
      body: status === 'CANCELLED' 
        ? `Your booking #${String(booking._id).slice(-6).toUpperCase()} was cancelled: ${booking.cancellationReason || 'Cancelled'}`
        : `Your booking status is now ${status}`,
      data: { type: 'booking_update', bookingId: String(booking._id) }
    })
    
    // To Labourers
    if (booking.assignments && booking.assignments.length > 0) {
      booking.assignments.forEach(a => {
        const lid = typeof a.labourId === 'object' ? a.labourId._id : a.labourId;
        if (lid) {
          sendNotificationToUser(lid, {
            title: status === 'CANCELLED' && penaltyDeducted > 0 ? 'Bounce Penalty Applied' : 'Job Status Update',
            body: status === 'CANCELLED' && penaltyDeducted > 0 
              ? `Bounce penalty of ₹${penaltyDeducted} deducted for cancelling job #${String(booking._id).slice(-6).toUpperCase()}`
              : `The job status has been updated to ${status}`,
            data: { type: 'booking_update', bookingId: String(booking._id) }
          })
        }
      });
    } else if (booking.laborId) {
      sendNotificationToUser(booking.laborId, {
        title: status === 'CANCELLED' && penaltyDeducted > 0 ? 'Bounce Penalty Applied' : 'Job Status Update',
        body: status === 'CANCELLED' && penaltyDeducted > 0 
          ? `Bounce penalty of ₹${penaltyDeducted} deducted for cancelling job #${String(booking._id).slice(-6).toUpperCase()}`
          : `The job status has been updated to ${status}`,
        data: { type: 'booking_update', bookingId: String(booking._id) }
      })
    }
  }).catch(err => console.error(err))

  return sendSuccess(res, { 
    message: penaltyDeducted > 0
      ? `Booking marked as ${status}. Bounce penalty of ₹${penaltyDeducted} has been deducted.`
      : `Booking marked as ${status}`, 
    data: { booking, penaltyDeducted } 
  })
})

export const confirmCashPayment = asyncHandler(async (req, res) => {
  const { id } = req.params
  
  const booking = await Booking.findById(id)
  if (!booking) {
    return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }
  
  if (booking.userId.toString() !== req.user._id.toString()) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  if (booking.status !== 'COMPLETED') {
    return sendError(res, { message: 'Booking must be completed before payment', statusCode: HTTP_STATUS.BAD_REQUEST })
  }
  
  if (booking.paymentMethod !== 'CASH') {
    return sendError(res, { message: 'Not a cash booking', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  if (booking.paymentStatus === 'PAID') {
    return sendSuccess(res, { message: 'Already paid', data: { booking } })
  }

  booking.paymentStatus = 'PAID'
  await booking.save()

  // Perform atomic cash booking settlement (recovering exact commission + platform fee + taxes)
  try {
    const { settleCashBookingPayment } = await import('../services/labourWalletService.js')
    await settleCashBookingPayment({ bookingId: booking._id, labourId: booking.laborId || booking.acceptedLabourId })
  } catch (err) {
    console.error('[Cash Settlement Error in confirmCashPayment]:', err)
  }

  // Award automatic 15% (or configured %) service completion credit to customer wallet
  try {
    const { awardServiceCompletionWalletCredit } = await import('../services/userWalletService.js')
    await awardServiceCompletionWalletCredit(booking._id)
  } catch (creditErr) {
    console.error('[Service Completion Wallet Credit Error in confirmCashPayment]:', creditErr)
  }

  // Notify both
  import('../socket.js').then(({ emitToUser }) => {
    emitToUser(booking.laborId, 'BOOKING_STATUS_UPDATE', { bookingId: booking._id, status: booking.status, paymentStatus: 'PAID' })
        emitToUser(booking.userId, 'BOOKING_STATUS_UPDATE', { bookingId: booking._id, status: booking.status, paymentStatus: 'PAID' })
        if (booking.assignments && booking.assignments.length > 0) {
          booking.assignments.forEach(a => {
            const lid = typeof a.labourId === 'object' ? a.labourId._id : a.labourId;
            if (lid) emitToUser(lid, 'BOOKING_STATUS_UPDATE', { bookingId: booking._id, status: booking.status, paymentStatus: 'PAID' })
          });
        }
  }).catch(err => console.error(err))

  return sendSuccess(res, { message: 'Cash payment confirmed', data: { booking } })
})

export const addExtraTime = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { extraHours: rawExtra, assignmentId } = req.body
  const extraHours = parseFloat(rawExtra) || 0 // supports 0.5 = 30 min

  if (extraHours < 0.5) {
    return sendError(res, { message: 'Extra time must be at least 30 minutes (0.5)', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const booking = await Booking.findById(id)
  if (!booking) {
    return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  if (booking.userId.toString() !== req.user._id.toString()) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  if (!['ACCEPTED', 'EN_ROUTE', 'STARTED', 'COMPLETED'].includes(booking.status)) {
    return sendError(res, { message: 'Cannot add extra time at this status', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  if (booking.paymentStatus === 'PAID') {
    return sendError(res, { message: 'Booking is already paid', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const totalExtraAmount = (booking.assignments && booking.assignments.length > 0) 
    ? booking.assignments.reduce((sum, a) => sum + (a.extraAmount || 0), 0) 
    : (booking.extraAmount || 0)
  
  const originalBasePrice = booking.basePrice - totalExtraAmount
  
  let totalProfessionals = booking.quantity || 1
  if (booking.contractorInfo && booking.contractorInfo.services && booking.contractorInfo.services.length > 0) {
    totalProfessionals = booking.contractorInfo.services.reduce((sum, s) => sum + (s.quantity || 1), 0)
  }
  
  let hourlyRate = originalBasePrice / (booking.hours * totalProfessionals)
  
  // If specific assignment is provided, try to find its exact service rate
  if (assignmentId && booking.assignments && booking.contractorInfo && booking.contractorInfo.services) {
    const assignment = booking.assignments.find(a => String(a.labourId) === String(assignmentId) || String(a._id) === String(assignmentId))
    if (assignment && assignment.serviceId) {
      const serviceInfo = booking.contractorInfo.services.find(s => String(s.serviceId) === String(assignment.serviceId))
      if (serviceInfo && serviceInfo.price) {
        hourlyRate = serviceInfo.price
      }
    }
  }

  const addedBasePrice = extraHours * hourlyRate

  let newBasePrice = booking.basePrice + addedBasePrice

  const settings = await SystemSetting.findOne({ configKey: 'master_config' })

  let platformFee = booking.platformFee
  if (settings?.platformFee?.isActive) {
    platformFee = settings.platformFee.type === 'fixed' 
      ? settings.platformFee.value 
      : (newBasePrice * settings.platformFee.value) / 100
  }
  
  const baseAmount = newBasePrice + platformFee
  let taxes = 0

  let gstPercentage = 0
  if (booking.subcategoryId) {
    const subcategory = await LabourSubcategory.findById(booking.subcategoryId)
    if (subcategory) {
      const { LabourCategory } = await import('../models/LabourCategory.js')
      const category = await LabourCategory.findById(subcategory.categoryId)
      if (category && category.isGstActive) {
        gstPercentage = category.gstPercentage || 0
      }
    }
  } else if (settings?.gstPercentage > 0) {
    gstPercentage = settings.gstPercentage
  }

  if (gstPercentage > 0) {
    taxes = (newBasePrice * gstPercentage) / 100
  }

  
  const newTotalAmount = baseAmount + taxes

  let commissionAmount = booking.commissionAmount
  if (settings?.commission?.isActive && settings.commission.type === 'global') {
    commissionAmount = (newBasePrice * settings.commission.globalPercentage) / 100
  }

  const laborShare = Math.round(Math.max(0, newBasePrice - commissionAmount))

  // Update specific assignment or the whole booking
  if (assignmentId && booking.assignments && booking.assignments.length > 0) {
    const assignment = booking.assignments.find(a => String(a.labourId) === String(assignmentId) || String(a._id) === String(assignmentId))
    if (!assignment) return sendError(res, { message: 'Assignment not found', statusCode: HTTP_STATUS.NOT_FOUND })
    assignment.extraHours = (assignment.extraHours || 0) + extraHours
    assignment.extraAmount = (assignment.extraAmount || 0) + addedBasePrice
  } else {
    booking.extraHours = (booking.extraHours || 0) + extraHours
    booking.extraAmount = (booking.extraAmount || 0) + addedBasePrice
  }

  booking.basePrice = newBasePrice
  booking.platformFee = platformFee
  booking.taxes = taxes
  booking.totalAmount = newTotalAmount
  booking.commissionAmount = commissionAmount
  booking.laborShare = laborShare

  await booking.save()

  // Notify socket
  import('../socket.js').then(({ emitToUser }) => {
    emitToUser(booking.userId, 'BOOKING_UPDATED', { bookingId: booking._id })
  }).catch(err => console.error(err))

  return sendSuccess(res, { message: 'Extra time added successfully', data: { booking } })
})

function generateInvoiceNumber() {
  return `INV-${Math.random().toString(36).substring(2, 10).toUpperCase()}`
}

export const generateMyInvoice = asyncHandler(async (req, res) => {
  const { id } = req.params

  const booking = await Booking.findById(id)
    .populate('subcategoryId')
    .populate('serviceId').populate('contractorInfo.services.serviceId')
    .populate('laborId', 'fullName phone profileImageUrl')
    .populate('userId', 'fullName phone')
    .populate('assignments.labourId', 'fullName phone profileImageUrl serviceIds labourProfile')
    .lean()

  if (!booking) {
    return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  // Ensure it's the user's booking
  if (String(booking.userId._id || booking.userId) !== String(req.user._id)) {
    return sendError(res, { message: 'Unauthorized', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  let invoice = await Invoice.findOne({ requestId: id }).lean()

  if (!invoice) {
    let lines = []
    if (booking.contractorInfo?.services?.length > 0) {
      const services = booking.contractorInfo.services || []
      const assignments = booking.assignments || []
      const bookingHours = booking.duration || booking.hours || 1

      let subtotal = 0
      lines = services.map((s, idx) => {
        const sId = s.serviceId?._id ? String(s.serviceId._id) : String(s.serviceId || '')
        let matched = assignments.filter(a => {
          const aSvcId = a.serviceId?._id ? String(a.serviceId._id) : String(a.serviceId || '')
          return aSvcId && aSvcId === sId
        })
        if (matched.length === 0 && assignments.length > 0) {
          let offset = 0
          for (let i = 0; i < idx; i++) offset += Number(services[i].quantity) || 1
          matched = assignments.slice(offset, offset + (Number(s.quantity) || 1))
        }

        const completedAssignments = matched.filter(a => a.status === 'COMPLETED')
        const completedCount = completedAssignments.length
        const extraHours = completedAssignments.reduce((acc, a) => acc + (Number(a.extraHours) || 0), 0)
        const lineAmount = ((s.price || 0) * bookingHours * completedCount) + ((s.price || 0) * extraHours)
        subtotal += lineAmount

        return {
          description: `Service - ${s.serviceId?.name || 'Contractor Service'} (${completedCount}/${s.quantity || 1} completed)`,
          categoryId: booking.subcategoryId,
          billableUnits: completedCount,
          ratePerUnit: s.price || 0,
          amount: lineAmount,
          gstAmount: 0,
        }
      })

      const originalBase = booking.basePrice || subtotal
      const ratio = originalBase > 0 ? subtotal / originalBase : 0
      const gstTotal = Math.round((booking.taxes || 0) * ratio)
      const platformFee = subtotal > 0 ? (booking.platformFee || 0) : 0
      const total = subtotal + gstTotal + platformFee

      invoice = await Invoice.create({
        invoiceNumber: generateInvoiceNumber(),
        contractorId: booking.contractorInfo?.services ? booking.userId._id || booking.userId : undefined,
        requestId: booking._id,
        type: 'attendance',
        billingMode: 'postpaid',
        status: INVOICE_STATUS.ISSUED,
        lines,
        subtotal,
        gstTotal,
        total,
        issuedAt: new Date(),
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      })
    } else {
      lines = [
        {
          description: `Service - ${booking.serviceId?.name || 'Booking Service'}`,
          categoryId: booking.subcategoryId,
          billableUnits: booking.quantity || 1,
          ratePerUnit: booking.basePrice || 0,
          amount: booking.basePrice || 0,
          gstAmount: booking.taxes || 0,
        }
      ]

      invoice = await Invoice.create({
        invoiceNumber: generateInvoiceNumber(),
        contractorId: undefined,
        requestId: booking._id,
        type: 'attendance',
        billingMode: 'postpaid',
        status: INVOICE_STATUS.ISSUED,
        lines,
        subtotal: booking.basePrice || 0,
        gstTotal: booking.taxes || 0,
        total: booking.totalAmount || 0,
        issuedAt: new Date(),
        dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000),
      })
    }
  }

  // Hide OTPs
  delete booking.startOtp
  delete booking.completionOtp
  if (booking.assignments) {
    booking.assignments.forEach(a => {
      delete a.startOtp;
      delete a.completionOtp;
    })
  }

  return sendSuccess(res, { data: { invoice, booking }, statusCode: HTTP_STATUS.CREATED })
})

export const getCustomerCancellationEligibilityController = asyncHandler(async (req, res) => {
  const { id } = req.params
  const eligibility = await getCustomerCancellationEligibility(id, req.user._id)
  return sendSuccess(res, { data: eligibility })
})

export const cancelCustomerBooking = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { reason, reasonNote } = req.body

  if (!reason || !String(reason).trim()) {
    return sendError(res, {
      message: 'Cancellation reason is required',
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
  }

  const result = await processCustomerCancellation({
    bookingId: id,
    customerId: req.user._id,
    reason: String(reason).trim(),
    reasonNote: reasonNote ? String(reasonNote).trim() : '',
  })

  return sendSuccess(res, {
    message: result.message || 'Booking cancelled successfully',
    data: result,
  })
})

export const cancelBookingItem = asyncHandler(async (req, res) => {
  const { id, itemId } = req.params
  const { reason, reasonNote } = req.body

  const booking = await Booking.findById(id)
  if (!booking) {
    return sendError(res, { message: 'Booking not found', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  // Authorization check: must be the booking owner
  if (String(booking.userId) !== String(req.user._id)) {
    return sendError(res, { message: 'Unauthorized to cancel items on this booking', statusCode: HTTP_STATUS.FORBIDDEN })
  }

  if (!booking.multiServiceBooking?.isMultiService || !Array.isArray(booking.multiServiceBooking.items)) {
    return sendError(res, { message: 'This booking is not a multi-service booking', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  const item = booking.multiServiceBooking.items.find(it => String(it._id) === String(itemId))
  if (!item) {
    return sendError(res, { message: 'Service item not found in booking', statusCode: HTTP_STATUS.NOT_FOUND })
  }

  if (item.status === 'CANCELLED') {
    return sendError(res, { message: 'This service item is already cancelled', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  if (item.status === 'COMPLETED') {
    return sendError(res, { message: 'Completed services cannot be cancelled', statusCode: HTTP_STATUS.BAD_REQUEST })
  }

  // Mark item as cancelled
  item.status = 'CANCELLED'
  item.cancellationReason = [reason, reasonNote].filter(Boolean).join(': ')
  item.cancelledAt = new Date()

  // Update corresponding assignment if assigned
  let notifiedLabourId = null
  if (item.assignedLabourId) {
    notifiedLabourId = item.assignedLabourId
    if (Array.isArray(booking.assignments)) {
      const assignment = booking.assignments.find(a => 
        String(a.labourId) === String(item.assignedLabourId) && 
        String(a.serviceId) === String(item.serviceId)
      )
      if (assignment) {
        assignment.status = 'CANCELLED'
        assignment.cancellationReason = item.cancellationReason
      }
    }
  }

  // Recalculate parent booking status
  const activeItems = booking.multiServiceBooking.items.filter(it => it.status !== 'CANCELLED')
  if (activeItems.length === 0) {
    booking.status = 'CANCELLED'
    booking.cancelledBy = 'CUSTOMER'
    booking.cancelledAt = new Date()
    booking.cancellationReason = item.cancellationReason
  } else {
    const activeStatuses = activeItems.map(it => it.status)
    if (activeStatuses.every(s => s === 'COMPLETED')) {
      booking.status = 'COMPLETED'
    } else if (activeStatuses.some(s => s === 'COMPLETED')) {
      booking.status = 'PARTIALLY_COMPLETED'
    } else if (activeStatuses.some(s => s === 'STARTED')) {
      booking.status = 'STARTED'
    } else if (activeStatuses.some(s => s === 'EN_ROUTE')) {
      booking.status = 'EN_ROUTE'
    } else if (activeStatuses.every(s => s === 'ACCEPTED')) {
      booking.status = 'ACCEPTED'
    } else if (activeStatuses.some(s => s === 'ACCEPTED')) {
      booking.status = 'PARTIALLY_ACCEPTED'
    } else {
      booking.status = 'PARTIALLY_CANCELLED'
    }
  }

  // Calculate refund if paid
  let refundAmount = 0
  if (booking.paymentStatus === 'PAID') {
    refundAmount = Number(item.itemTotal) || 0
    if (refundAmount > 0) {
      try {
        let wallet = await Wallet.findOne({ userId: booking.userId })
        if (!wallet) wallet = new Wallet({ userId: booking.userId })
        const balanceBefore = Number(wallet.balance || wallet.selfBalance || 0)
        const balanceAfter = balanceBefore + refundAmount
        wallet.balance = (wallet.balance || 0) + refundAmount
        wallet.selfBalance = (wallet.selfBalance || 0) + refundAmount
        await wallet.save()

        const { WalletTransaction } = await import('../models/WalletTransaction.js')
        const shortCode = String(booking._id).slice(-6).toUpperCase()
        await WalletTransaction.create({
          walletId: wallet._id,
          userId: booking.userId,
          type: 'CREDIT',
          amount: refundAmount,
          balanceBefore,
          balanceAfter,
          description: `Refund for cancelled service "${item.serviceName}" on booking #${shortCode}`,
          context: 'REFUND',
          referenceType: 'BOOKING',
          referenceId: booking._id,
          status: 'COMPLETED',
        })
      } catch (err) {
        console.error('[ITEM_REFUND_ERROR] Failed to credit wallet for item cancellation:', err)
      }
    }
  }

  await booking.save()

  // Notify assigned labourer if applicable
  if (notifiedLabourId) {
    import('../utils/pushNotificationHelper.js').then(({ sendNotificationToUser }) => {
      sendNotificationToUser(notifiedLabourId, {
        title: 'Service Item Cancelled',
        body: `Customer has cancelled service "${item.serviceName}" on booking #${String(booking._id).slice(-6).toUpperCase()}`,
        data: { bookingId: String(booking._id), itemId: String(itemId) }
      }).catch(err => console.error('Push notification error on item cancel:', err))
    })
  }

  // Socket notification
  import('../socket.js').then(({ emitToUser }) => {
    emitToUser(booking.userId, 'BOOKING_ITEM_CANCELLED', {
      bookingId: booking._id,
      itemId,
      status: item.status,
      parentStatus: booking.status,
      refundAmount,
    })
  }).catch(err => console.error('Socket error on item cancel:', err))

  return sendSuccess(res, {
    message: `Service "${item.serviceName}" cancelled successfully`,
    data: { booking, item, refundAmount }
  })
})

export const rescheduleBookingController = asyncHandler(async (req, res) => {
  const { id } = req.params
  const { scheduledAt, timeSlot, endTime, reason, reasonNote } = req.body

  if (!scheduledAt) {
    return sendError(res, {
      message: 'New scheduled date is required to reschedule',
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
  }

  const booking = await Booking.findById(id)
    .populate('serviceId', 'name')
    .populate('subcategoryId', 'name')
    .populate('packageBooking.packageId', 'name')

  if (!booking) {
    return sendError(res, {
      message: 'Booking not found',
      statusCode: HTTP_STATUS.NOT_FOUND,
    })
  }

  // Authorization check: must be owner, contractor, or admin
  const isOwner = String(booking.userId) === String(req.user._id)
  const isAdmin = req.user.role === 'admin'
  const isContractor = req.user.role === 'contractor' && String(booking.userId) === String(req.user._id)

  if (!isOwner && !isAdmin && !isContractor) {
    return sendError(res, {
      message: 'Unauthorized to reschedule this booking',
      statusCode: HTTP_STATUS.FORBIDDEN,
    })
  }

  // Allowed statuses
  const reschedulableStatuses = ['CREATED', 'BROADCASTING', 'ACCEPTED', 'ASSIGNED', 'PARTIALLY_ACCEPTED']
  if (!reschedulableStatuses.includes(booking.status)) {
    return sendError(res, {
      message: `Cannot reschedule booking in status "${booking.status}". Only upcoming/pending bookings can be rescheduled.`,
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
  }

  const effectiveSlot = timeSlot || booking.timeSlot || '09:00 AM'
  const newScheduledDate = parseISTDateTime(scheduledAt, effectiveSlot)

  if (!newScheduledDate || isNaN(newScheduledDate.getTime())) {
    return sendError(res, {
      message: 'Invalid date or time slot provided',
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
  }

  // Ensure scheduled time is not in the deep past (allow 10 minute buffer for local clock differences)
  if (newScheduledDate.getTime() < Date.now() - 10 * 60 * 1000) {
    return sendError(res, {
      message: 'Cannot reschedule to a past date or time. Please select an upcoming slot.',
      statusCode: HTTP_STATUS.BAD_REQUEST,
    })
  }

  const oldScheduledAt = booking.scheduledAt || booking.createdAt
  const oldTimeSlot = booking.timeSlot || ''
  const effectiveReason = [reason, reasonNote].filter(Boolean).join(': ') || 'Customer requested reschedule'
  const rescheduledByRole = isAdmin ? 'ADMIN' : (req.user.role === 'contractor' ? 'CONTRACTOR' : 'CUSTOMER')

  const historyEntry = {
    rescheduledAt: new Date(),
    rescheduledBy: rescheduledByRole,
    oldScheduledAt,
    newScheduledAt: newScheduledDate,
    oldTimeSlot,
    newTimeSlot: effectiveSlot,
    reason: effectiveReason,
  }

  // Update booking fields
  booking.scheduledAt = newScheduledDate
  booking.timeSlot = effectiveSlot
  if (endTime) booking.endTime = endTime
  booking.type = 'SCHEDULED'
  booking.date = typeof scheduledAt === 'string' ? scheduledAt.split('T')[0] : newScheduledDate.toISOString().split('T')[0]
  booking.isRescheduled = true
  booking.rescheduledAt = new Date()
  booking.rescheduledBy = rescheduledByRole
  booking.rescheduleReason = effectiveReason
  booking.rescheduleCount = (booking.rescheduleCount || 0) + 1
  if (!Array.isArray(booking.rescheduleHistory)) {
    booking.rescheduleHistory = []
  }
  booking.rescheduleHistory.push(historyEntry)

  await booking.save()

  // Reschedule reminder jobs asynchronously
  import('../services/bookingReminderService.js')
    .then(({ rescheduleRemindersForBooking }) => {
      rescheduleRemindersForBooking(booking._id).catch(err => {
        console.error('[REMINDER_ENGINE] Failed to reschedule reminders for booking:', err)
      })
    })
    .catch(err => console.error('Failed to import bookingReminderService:', err))

  const shortCode = String(booking._id).slice(-6).toUpperCase()
  const formattedTimeStr = newScheduledDate.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }) + (effectiveSlot ? ` (${effectiveSlot})` : '')

  // Create In-App Notification for customer
  import('../models/InAppNotification.js')
    .then(async ({ InAppNotification }) => {
      await InAppNotification.create({
        userId: booking.userId,
        title: 'Booking Rescheduled 📅',
        body: `Your booking #${shortCode} has been rescheduled to ${formattedTimeStr}.`,
        type: 'BOOKING_UPDATE',
        metadata: { bookingId: booking._id, action: 'RESCHEDULED', newScheduledAt: newScheduledDate },
      }).catch(e => console.warn('InAppNotification error:', e.message))
    })
    .catch(err => console.error(err))

  // Notify assigned labourer/partners if present
  const assignedPartnerIds = new Set()
  if (booking.laborId) assignedPartnerIds.add(String(booking.laborId._id || booking.laborId))
  if (booking.acceptedLabourId) assignedPartnerIds.add(String(booking.acceptedLabourId))
  if (Array.isArray(booking.assignments)) {
    booking.assignments.forEach(a => {
      const lid = a.labourId?._id || a.labourId
      if (lid) assignedPartnerIds.add(String(lid))
    })
  }

  if (assignedPartnerIds.size > 0) {
    import('../utils/pushNotificationHelper.js')
      .then(({ sendNotificationToUser }) => {
        for (const partnerId of assignedPartnerIds) {
          sendNotificationToUser(partnerId, {
            title: 'Customer Rescheduled Booking ⏰',
            body: `Job #${shortCode} has been rescheduled to ${formattedTimeStr}. Please check your calendar.`,
            data: { type: 'booking_rescheduled', bookingId: String(booking._id) },
          }).catch(err => console.error('Push error on reschedule:', err))
        }
      })
      .catch(err => console.error(err))

    import('../models/InAppNotification.js')
      .then(async ({ InAppNotification }) => {
        for (const partnerId of assignedPartnerIds) {
          await InAppNotification.create({
            userId: partnerId,
            title: 'Job Rescheduled By Customer ⏰',
            body: `Booking #${shortCode} rescheduled to ${formattedTimeStr}.`,
            type: 'BOOKING_UPDATE',
            metadata: { bookingId: booking._id, action: 'RESCHEDULED', newScheduledAt: newScheduledDate },
          }).catch(e => console.warn('InAppNotification error for partner:', e.message))
        }
      })
      .catch(err => console.error(err))
  }

  // Socket notification
  import('../socket.js')
    .then(({ emitToUser }) => {
      emitToUser(booking.userId, 'BOOKING_RESCHEDULED', {
        bookingId: booking._id,
        scheduledAt: newScheduledDate,
        timeSlot: effectiveSlot,
        date: booking.date,
        isRescheduled: true,
      })
      for (const partnerId of assignedPartnerIds) {
        emitToUser(partnerId, 'BOOKING_RESCHEDULED', {
          bookingId: booking._id,
          scheduledAt: newScheduledDate,
          timeSlot: effectiveSlot,
          date: booking.date,
          isRescheduled: true,
        })
      }
    })
    .catch(err => console.error('Socket error on reschedule:', err))

  return sendSuccess(res, {
    message: `Booking successfully rescheduled to ${formattedTimeStr}`,
    data: {
      booking,
      scheduledAt: newScheduledDate,
      timeSlot: effectiveSlot,
      formattedTimeStr,
    },
  })
})



