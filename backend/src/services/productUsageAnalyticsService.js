import mongoose from 'mongoose'
import { Product } from '../models/Product.js'
import { ServiceProduct } from '../models/ServiceProduct.js'
import { MaterialRequest } from '../models/MaterialRequest.js'
import { Booking } from '../models/Booking.js'

const idOf = (v) => String(v?._id || v || '')
const pairKey = (vendorId, productId) => `${idOf(vendorId)}::${idOf(productId)}`

function toObjectIds(ids) {
  return [...new Set((ids || []).map(idOf).filter((id) => mongoose.Types.ObjectId.isValid(id)))]
    .map((id) => new mongoose.Types.ObjectId(id))
}

/**
 * Pure helper to determine whether a real booking corresponds to a given service provider & product,
 * and whether this provider's portion of the booking is completed or still active.
 */
export function evaluateBookingForVendorProduct(booking, vendorId, mappedServiceSet, issuedBookingSet) {
  const vid = idOf(vendorId)
  if (!booking || !vid) return { belongs: false }

  const bId = idOf(booking._id)
  const assignments = Array.isArray(booking.assignments) ? booking.assignments : []
  const myAssignments = assignments.filter((a) => idOf(a.labourId) === vid && a.status !== 'CANCELLED')

  const multiItems = Array.isArray(booking.multiServiceBooking?.items) ? booking.multiServiceBooking.items : []
  const myMultiItems = multiItems.filter((it) => idOf(it.assignedLabourId) === vid && it.status !== 'CANCELLED')

  const isDirectWorker = idOf(booking.laborId) === vid || idOf(booking.acceptedLabourId) === vid
  if (!isDirectWorker && myAssignments.length === 0 && myMultiItems.length === 0) {
    return { belongs: false }
  }

  // Collect serviceIds this provider handled in this booking
  const handledServiceIds = new Set()
  if (myMultiItems.length > 0) {
    myMultiItems.forEach((it) => {
      if (it.serviceId) handledServiceIds.add(idOf(it.serviceId))
    })
  } else if (myAssignments.some((a) => a.serviceId)) {
    myAssignments.forEach((a) => {
      if (a.serviceId) handledServiceIds.add(idOf(a.serviceId))
    })
  } else {
    if (booking.serviceId) handledServiceIds.add(idOf(booking.serviceId))
    ;(booking.packageBooking?.inclusions || []).forEach((inc) => {
      if (inc.serviceId) handledServiceIds.add(idOf(inc.serviceId))
    })
    ;(booking.contractorInfo?.services || []).forEach((sv) => {
      if (sv.serviceId) handledServiceIds.add(idOf(sv.serviceId))
    })
  }

  const matchedByService = [...handledServiceIds].some((sid) => mappedServiceSet.has(sid))
  const matchedByIssue = issuedBookingSet.has(bId)
  if (!matchedByService && !matchedByIssue) {
    return { belongs: false }
  }

  let workerStatus = String(booking.status || '').toUpperCase()
  if (myMultiItems.length > 0) {
    if (myMultiItems.every((it) => String(it.status || '').toUpperCase() === 'COMPLETED')) {
      workerStatus = 'COMPLETED'
    }
  } else if (myAssignments.length > 0) {
    if (myAssignments.every((a) => String(a.status || '').toUpperCase() === 'COMPLETED')) {
      workerStatus = 'COMPLETED'
    }
  }

  if (workerStatus === 'CANCELLED' || workerStatus === 'REJECTED') {
    return { belongs: false }
  }

  const isCompleted = workerStatus === 'COMPLETED'
  const isActive = ['ACCEPTED', 'ASSIGNED', 'EN_ROUTE', 'STARTED', 'PARTIALLY_ACCEPTED', 'PARTIALLY_COMPLETED'].includes(workerStatus)
  const eventDate = new Date(
    booking.completedAt || booking.startedAt || booking.scheduledAt || booking.createdAt || Date.now()
  )

  return {
    belongs: true,
    isCompleted,
    isActive,
    workerStatus,
    eventDate,
    shortCode: bId.slice(-6).toUpperCase(),
    serviceName:
      booking.serviceId?.name ||
      booking.serviceName ||
      myMultiItems[0]?.serviceName ||
      booking.packageBooking?.packageName ||
      'Service Booking',
    customerName: booking.userId?.fullName || 'Customer',
  }
}

/**
 * Compute authoritative capacity vs real-booking consumption metrics from gathered assignment & booking arrays.
 */
export function buildUsageAnalysisSummary({
  product = null,
  totalIssuedUnits = 0,
  totalReturnedUnits = 0,
  totalReportedUsedUnits = 0,
  lastIssuedUnits = 0,
  firstAssignedAt = null,
  lastAssignedAt = null,
  bookingsDoneSinceFirstAssign = 0,
  bookingsDoneSinceLastIssue = 0,
  activeBookingsCount = 0,
  lifetimeBookingsCount = 0,
  mappedServicesCount = 0,
  recentBookings = [],
  requestedQty = 0,
}) {
  const usesPerAssignment = Math.max(1, Math.round(Number(product?.usesPerAssignment) || 1))
  const netAssignedUnits = Math.max(0, Number(totalIssuedUnits || 0) - Number(totalReturnedUnits || 0))
  const totalAllowedUses = netAssignedUnits * usesPerAssignment
  const remainingUses = Math.max(0, totalAllowedUses - bookingsDoneSinceFirstAssign)

  const lastBatchAllowedUses = Math.max(0, Number(lastIssuedUnits || 0)) * usesPerAssignment
  const lastBatchRemainingUses = Math.max(0, lastBatchAllowedUses - bookingsDoneSinceLastIssue)

  let status = 'NEEDS_ASSIGNMENT'
  let isLikelyNeeded = true
  let verdictLabel = 'Needed — Not Assigned Yet'
  let summary = 'Provider has not been issued any units of this product yet.'

  if (netAssignedUnits > 0) {
    if (remainingUses > 0) {
      status = 'CAPACITY_REMAINING'
      isLikelyNeeded = false
      verdictLabel = `May Not Need — ${remainingUses} Booking Use(s) Left`
      summary = `${netAssignedUnits} unit(s) assigned allow ${totalAllowedUses} booking(s) (${usesPerAssignment} use/unit). ${bookingsDoneSinceFirstAssign} real booking(s) completed since assignment; ~${remainingUses} use(s) remaining.`
    } else {
      status = 'REFILL_NEEDED'
      isLikelyNeeded = true
      verdictLabel = 'Needed — Assigned Uses Exhausted'
      summary = `${netAssignedUnits} unit(s) covered ${totalAllowedUses} booking(s) and ${bookingsDoneSinceFirstAssign} real booking(s) are already completed. Fresh stock is needed.`
    }
  } else if (lifetimeBookingsCount > 0) {
    summary = `No units previously issued for this product (${lifetimeBookingsCount} lifetime booking(s) completed on mapped service).`
  }

  return {
    productId: idOf(product?._id),
    productName: product?.name || '',
    unit: product?.unit || 'Piece',
    usesPerAssignment,
    totalIssuedUnits,
    totalReturnedUnits,
    totalReportedUsedUnits,
    netAssignedUnits,
    totalAllowedUses,
    bookingsDoneOnProduct: bookingsDoneSinceFirstAssign,
    bookingsSinceLastIssue: bookingsDoneSinceLastIssue,
    activeBookingsOnProduct: activeBookingsCount,
    lifetimeBookingsOnProduct: lifetimeBookingsCount,
    remainingUses,
    lastAssignedAt,
    lastIssuedUnits,
    lastBatchAllowedUses,
    lastBatchRemainingUses,
    firstAssignedAt,
    mappedServicesCount,
    requestedQty,
    recentBookings: recentBookings.slice(0, 8),
    recommendation: {
      status,
      isLikelyNeeded,
      verdictLabel,
      summary,
    },
  }
}

/**
 * Batch fetch real booking & assignment usage analytics for (vendorId, productId) pairs.
 * Used by Material Requests Hub and Vendor Inventory Hub so Admin sees live booking proofs.
 */
export async function getVendorProductUsageMap({
  vendorIds = [],
  productIds = [],
  excludeBookingIdsByVendor = null,
}) {
  const vObjIds = toObjectIds(vendorIds)
  const pObjIds = toObjectIds(productIds)
  const result = new Map()
  if (vObjIds.length === 0 || pObjIds.length === 0) return result

  const [products, serviceMappings, issuedRequests, bookings] = await Promise.all([
    Product.find({ _id: { $in: pObjIds } })
      .select('name sku unit usesPerAssignment currentStock')
      .lean(),
    ServiceProduct.find({ productId: { $in: pObjIds }, isActive: true })
      .select('serviceId productId quantityRequired')
      .lean(),
    MaterialRequest.find({
      vendorId: { $in: vObjIds },
      status: { $in: ['ISSUED', 'PARTIALLY_ISSUED', 'IN_USE', 'COMPLETED', 'RETURNED'] },
      $or: [
        { 'items.productId': { $in: pObjIds } },
        { 'items.alternativeIssuedProductId': { $in: pObjIds } },
      ],
    })
      .select('vendorId bookingId issuedAt createdAt items')
      .sort({ issuedAt: 1, createdAt: 1 })
      .lean(),
    Booking.find({
      status: { $nin: ['CANCELLED'] },
      $or: [
        { laborId: { $in: vObjIds } },
        { acceptedLabourId: { $in: vObjIds } },
        { 'assignments.labourId': { $in: vObjIds } },
        { 'multiServiceBooking.items.assignedLabourId': { $in: vObjIds } },
      ],
    })
      .select('status completedAt startedAt scheduledAt createdAt serviceId serviceName laborId acceptedLabourId assignments multiServiceBooking packageBooking contractorInfo userId')
      .populate('serviceId', 'name')
      .populate('userId', 'fullName')
      .sort({ completedAt: -1, createdAt: -1 })
      .lean(),
  ])

  const productById = new Map(products.map((p) => [idOf(p._id), p]))
  const mappedServicesByProduct = new Map()
  pObjIds.forEach((pid) => mappedServicesByProduct.set(idOf(pid), new Set()))
  serviceMappings.forEach((m) => {
    const pid = idOf(m.productId)
    if (mappedServicesByProduct.has(pid) && m.serviceId) {
      mappedServicesByProduct.get(pid).add(idOf(m.serviceId))
    }
  })

  // Aggregate issuance stats per vendor+product
  const issueAgg = new Map()
  for (const mr of issuedRequests) {
    const vid = idOf(mr.vendorId)
    const issuedAt = new Date(mr.issuedAt || mr.createdAt || Date.now())
    for (const item of mr.items || []) {
      const qtyIssued = Number(item.quantityIssued || 0)
      if (qtyIssued <= 0) continue
      const effectivePid = idOf(item.alternativeIssuedProductId || item.productId)
      if (!productById.has(effectivePid)) continue

      const key = pairKey(vid, effectivePid)
      if (!issueAgg.has(key)) {
        issueAgg.set(key, {
          totalIssuedUnits: 0,
          totalReturnedUnits: 0,
          totalReportedUsedUnits: 0,
          firstAssignedAt: issuedAt,
          lastAssignedAt: issuedAt,
          lastIssuedUnits: qtyIssued,
          issuedBookingSet: new Set(),
        })
      }
      const entry = issueAgg.get(key)
      entry.totalIssuedUnits += qtyIssued
      entry.totalReturnedUnits += Number(item.quantityReturned || 0)
      entry.totalReportedUsedUnits += Number(item.quantityUsed || 0)
      if (issuedAt < entry.firstAssignedAt) entry.firstAssignedAt = issuedAt
      if (issuedAt >= entry.lastAssignedAt) {
        entry.lastAssignedAt = issuedAt
        entry.lastIssuedUnits = qtyIssued
      }
      if (mr.bookingId) entry.issuedBookingSet.add(idOf(mr.bookingId))
    }
  }

  for (const vIdObj of vObjIds) {
    const vid = idOf(vIdObj)
    const excludedSet = excludeBookingIdsByVendor?.get(vid) || null

    for (const pIdObj of pObjIds) {
      const pid = idOf(pIdObj)
      const product = productById.get(pid)
      if (!product) continue

      const mappedServiceSet = mappedServicesByProduct.get(pid) || new Set()
      const agg = issueAgg.get(pairKey(vid, pid)) || {
        totalIssuedUnits: 0,
        totalReturnedUnits: 0,
        totalReportedUsedUnits: 0,
        firstAssignedAt: null,
        lastAssignedAt: null,
        lastIssuedUnits: 0,
        issuedBookingSet: new Set(),
      }

      let bookingsDoneSinceFirstAssign = 0
      let bookingsDoneSinceLastIssue = 0
      let activeBookingsCount = 0
      let lifetimeBookingsCount = 0
      const recentBookings = []
      const countedFirstBookingIds = new Set()
      const countedLastBookingIds = new Set()
      const activeBookingIds = new Set()
      const lifetimeBookingIds = new Set()

      for (const b of bookings) {
        if (excludedSet && excludedSet.has(idOf(b._id))) continue
        const evalRes = evaluateBookingForVendorProduct(b, vid, mappedServiceSet, agg.issuedBookingSet)
        if (!evalRes.belongs) continue

        const bid = idOf(b._id)
        if (evalRes.isCompleted) {
          lifetimeBookingsCount += 1
          lifetimeBookingIds.add(bid)
          if (agg.firstAssignedAt && evalRes.eventDate >= agg.firstAssignedAt) {
            bookingsDoneSinceFirstAssign += 1
            countedFirstBookingIds.add(bid)
          }
          if (agg.lastAssignedAt && evalRes.eventDate >= agg.lastAssignedAt) {
            bookingsDoneSinceLastIssue += 1
            countedLastBookingIds.add(bid)
          }
        } else if (evalRes.isActive) {
          activeBookingsCount += 1
          activeBookingIds.add(bid)
        }

        if (recentBookings.length < 10) {
          recentBookings.push({
            bookingId: bid,
            shortCode: evalRes.shortCode,
            serviceName: evalRes.serviceName,
            customerName: evalRes.customerName,
            status: evalRes.workerStatus,
            date: evalRes.eventDate,
            countedAgainstAssigned: Boolean(
              evalRes.isCompleted && agg.firstAssignedAt && evalRes.eventDate >= agg.firstAssignedAt
            ),
          })
        }
      }

      const summary = buildUsageAnalysisSummary({
        product,
        totalIssuedUnits: agg.totalIssuedUnits,
        totalReturnedUnits: agg.totalReturnedUnits,
        totalReportedUsedUnits: agg.totalReportedUsedUnits,
        lastIssuedUnits: agg.lastIssuedUnits,
        firstAssignedAt: agg.firstAssignedAt,
        lastAssignedAt: agg.lastAssignedAt,
        bookingsDoneSinceFirstAssign,
        bookingsDoneSinceLastIssue,
        activeBookingsCount,
        lifetimeBookingsCount,
        mappedServicesCount: mappedServiceSet.size,
        recentBookings,
      })

      result.set(pairKey(vid, pid), {
        ...summary,
        _meta: {
          product,
          agg,
          mappedServicesCount: mappedServiceSet.size,
          recentBookings,
          countedFirstBookingIds,
          countedLastBookingIds,
          activeBookingIds,
          lifetimeBookingIds,
        },
      })
    }
  }

  return result
}

export function getUsageKey(vendorId, productId) {
  return pairKey(vendorId, productId)
}

/**
 * Attach real booking usage analysis to each item of a list of MaterialRequests.
 * Excludes each request's own bookingId so the pending booking isn't counted against itself.
 */
export async function attachUsageAnalyticsToRequests(requests = []) {
  if (!Array.isArray(requests) || requests.length === 0) return requests

  const vendorIds = []
  const productIds = []

  requests.forEach((req) => {
    const vid = idOf(req.vendorId)
    if (vid) vendorIds.push(vid)
    ;(req.items || []).forEach((it) => {
      const pid = idOf(it.alternativeIssuedProductId || it.productId)
      if (pid) productIds.push(pid)
    })
  })

  const usageMap = await getVendorProductUsageMap({ vendorIds, productIds })

  for (const req of requests) {
    const vid = idOf(req.vendorId)
    const reqBookingId = idOf(req.bookingId)
    let needsRefillOrAssignment = 0
    let stockRemainingCount = 0

    for (const item of req.items || []) {
      const pid = idOf(item.alternativeIssuedProductId || item.productId)
      const entry = usageMap.get(pairKey(vid, pid))
      if (!entry) continue

      const m = entry._meta
      const exclFirst = reqBookingId && m.countedFirstBookingIds.has(reqBookingId) ? 1 : 0
      const exclLast = reqBookingId && m.countedLastBookingIds.has(reqBookingId) ? 1 : 0
      const exclActive = reqBookingId && m.activeBookingIds.has(reqBookingId) ? 1 : 0
      const exclLife = reqBookingId && m.lifetimeBookingIds.has(reqBookingId) ? 1 : 0

      const analysis = buildUsageAnalysisSummary({
        product: m.product,
        totalIssuedUnits: m.agg.totalIssuedUnits,
        totalReturnedUnits: m.agg.totalReturnedUnits,
        totalReportedUsedUnits: m.agg.totalReportedUsedUnits,
        lastIssuedUnits: m.agg.lastIssuedUnits,
        firstAssignedAt: m.agg.firstAssignedAt,
        lastAssignedAt: m.agg.lastAssignedAt,
        bookingsDoneSinceFirstAssign: Math.max(0, entry.bookingsDoneOnProduct - exclFirst),
        bookingsDoneSinceLastIssue: Math.max(0, entry.bookingsSinceLastIssue - exclLast),
        activeBookingsCount: Math.max(0, entry.activeBookingsOnProduct - exclActive),
        lifetimeBookingsCount: Math.max(0, entry.lifetimeBookingsOnProduct - exclLife),
        mappedServicesCount: m.mappedServicesCount,
        recentBookings: m.recentBookings.filter((rb) => rb.bookingId !== reqBookingId),
        requestedQty: Number(item.quantityRequested || item.quantityRequired || 1),
      })

      item.usageAnalysis = analysis
      if (analysis.recommendation.isLikelyNeeded) needsRefillOrAssignment += 1
      else stockRemainingCount += 1
    }

    req.usageSummary = {
      itemsCount: (req.items || []).length,
      needsRefillOrAssignment,
      stockRemainingCount,
      overallRecommendation:
        stockRemainingCount > 0 && needsRefillOrAssignment === 0
          ? 'CHECK_CAPACITY_REMAINING'
          : needsRefillOrAssignment > 0
            ? 'APPROVAL_RECOMMENDED'
            : 'REVIEW_REQUIRED',
    }
  }

  return requests
}

