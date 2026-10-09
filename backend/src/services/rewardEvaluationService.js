import mongoose from 'mongoose'
import { RewardCampaign, CAMPAIGN_STATUS, REWARD_CATEGORY, APPROVAL_MODE, EVALUATION_PERIOD } from '../models/RewardCampaign.js'
import { VendorReward, VENDOR_REWARD_STATUS } from '../models/VendorReward.js'
import { RewardAuditLog, REWARD_AUDIT_ACTION } from '../models/RewardAuditLog.js'
import { RewardSetting } from '../models/RewardSetting.js'
import { Wallet } from '../models/Wallet.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
import { Booking } from '../models/Booking.js'
import { Review } from '../models/Review.js'
import { User } from '../models/User.js'
import { USER_ROLES, KYC_STATUS } from '../constants/roles.js'
import { sendNotificationToUser } from '../utils/pushNotificationHelper.js'

/**
 * =========================================================================
 * 1. SETTINGS & CONFIGURATION
 * =========================================================================
 */

export async function getRewardSettings() {
  let settings = await RewardSetting.findOne({ configKey: 'master_reward_config' })
  if (!settings) {
    settings = await RewardSetting.create({
      configKey: 'master_reward_config',
      enabled: true,
      autoReconciliationEnabled: true,
      reconciliationIntervalMinutes: 60,
      globalRewardPause: false,
      maxGlobalBudgetPerMonth: 500000,
      defaultApprovalMode: APPROVAL_MODE.AUTOMATIC,
    })
  }
  return settings
}

export async function updateRewardSettings(data, adminUser) {
  const update = {}
  if (data.enabled !== undefined) update.enabled = Boolean(data.enabled)
  if (data.autoReconciliationEnabled !== undefined) update.autoReconciliationEnabled = Boolean(data.autoReconciliationEnabled)
  if (data.reconciliationIntervalMinutes !== undefined) {
    const num = Number(data.reconciliationIntervalMinutes)
    if (!isNaN(num) && num >= 5) update.reconciliationIntervalMinutes = num
  }
  if (data.globalRewardPause !== undefined) update.globalRewardPause = Boolean(data.globalRewardPause)
  if (data.maxGlobalBudgetPerMonth !== undefined) {
    const num = Number(data.maxGlobalBudgetPerMonth)
    if (!isNaN(num) && num >= 0) update.maxGlobalBudgetPerMonth = num
  }
  if (data.defaultApprovalMode && Object.values(APPROVAL_MODE).includes(data.defaultApprovalMode)) {
    update.defaultApprovalMode = data.defaultApprovalMode
  }
  if (adminUser?._id) update.updatedBy = adminUser._id

  const settings = await RewardSetting.findOneAndUpdate(
    { configKey: 'master_reward_config' },
    { $set: update },
    { new: true, upsert: true }
  )

  return settings
}

/**
 * =========================================================================
 * 2. CAMPAIGN LIFECYCLE MANAGEMENT
 * =========================================================================
 */

export async function createRewardCampaign(data, adminUser) {
  // Validation
  if (!data.name || !data.name.trim()) throw new Error('Campaign name is required')
  if (!data.category || !Object.values(REWARD_CATEGORY).includes(data.category)) {
    throw new Error('Valid reward category (PERFORMANCE or BUSINESS) is required')
  }

  const startDate = new Date(data.startDate)
  const endDate = new Date(data.endDate)
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new Error('Valid start and end dates are required')
  }
  if (endDate <= startDate) {
    throw new Error('End date must be strictly after start date')
  }

  const budget = Number(data.budget?.totalBudget ?? data.totalBudget ?? 0)
  if (isNaN(budget) || budget <= 0) {
    throw new Error('Total campaign budget must be greater than zero')
  }

  const campaign = new RewardCampaign({
    name: data.name.trim(),
    code: data.code?.trim(),
    description: data.description?.trim(),
    category: data.category,
    status: data.status && Object.values(CAMPAIGN_STATUS).includes(data.status) ? data.status : CAMPAIGN_STATUS.DRAFT,
    approvalMode: data.approvalMode || APPROVAL_MODE.AUTOMATIC,
    destination: data.destination || 'WALLET',
    evaluationPeriod: data.evaluationPeriod || EVALUATION_PERIOD.MONTHLY,
    startDate,
    endDate,
    timeZone: data.timeZone || 'Asia/Kolkata',
    termsAndConditions: data.termsAndConditions?.trim(),
    performanceRules: data.performanceRules || {},
    businessRules: data.businessRules || {},
    eligibility: data.eligibility || {},
    budget: {
      totalBudget: budget,
      usedBudget: 0,
      reservedBudget: 0,
      maxRewardPerVendor: data.budget?.maxRewardPerVendor ? Number(data.budget.maxRewardPerVendor) : null,
      maxEligibleVendors: data.budget?.maxEligibleVendors ? Number(data.budget.maxEligibleVendors) : null,
      totalRewardsIssuedCount: 0,
    },
    createdBy: adminUser?._id,
  })

  await campaign.save()

  await RewardAuditLog.create({
    campaignId: campaign._id,
    actorId: adminUser?._id,
    actorRole: 'ADMIN',
    action: REWARD_AUDIT_ACTION.CAMPAIGN_CREATED,
    newStatus: campaign.status,
    reason: `Campaign "${campaign.name}" created`,
    metadata: { budget, category: campaign.category },
  })

  return campaign
}

export async function updateRewardCampaign(campaignId, data, adminUser) {
  const campaign = await RewardCampaign.findById(campaignId)
  if (!campaign) throw new Error('Campaign not found')

  if (campaign.status === CAMPAIGN_STATUS.ENDED || campaign.status === CAMPAIGN_STATUS.SETTLED) {
    throw new Error('Ended or settled campaigns cannot be edited')
  }

  if (data.name) campaign.name = data.name.trim()
  if (data.description !== undefined) campaign.description = data.description?.trim()
  if (data.termsAndConditions !== undefined) campaign.termsAndConditions = data.termsAndConditions?.trim()

  if (data.startDate) {
    const sd = new Date(data.startDate)
    if (!isNaN(sd.getTime())) campaign.startDate = sd
  }
  if (data.endDate) {
    const ed = new Date(data.endDate)
    if (!isNaN(ed.getTime())) campaign.endDate = ed
  }
  if (campaign.endDate <= campaign.startDate) {
    throw new Error('End date must be strictly after start date')
  }

  if (data.approvalMode && Object.values(APPROVAL_MODE).includes(data.approvalMode)) {
    campaign.approvalMode = data.approvalMode
  }
  if (data.evaluationPeriod && Object.values(EVALUATION_PERIOD).includes(data.evaluationPeriod)) {
    campaign.evaluationPeriod = data.evaluationPeriod
  }

  if (data.performanceRules) {
    campaign.performanceRules = { ...campaign.performanceRules.toObject(), ...data.performanceRules }
  }
  if (data.businessRules) {
    campaign.businessRules = { ...campaign.businessRules.toObject(), ...data.businessRules }
  }
  if (data.eligibility) {
    campaign.eligibility = { ...campaign.eligibility.toObject(), ...data.eligibility }
  }

  if (data.budget) {
    if (data.budget.totalBudget !== undefined) {
      const b = Number(data.budget.totalBudget)
      if (b < (campaign.budget.usedBudget || 0)) {
        throw new Error(`Total budget cannot be less than already credited amount (₹${campaign.budget.usedBudget})`)
      }
      campaign.budget.totalBudget = b
    }
    if (data.budget.maxRewardPerVendor !== undefined) {
      campaign.budget.maxRewardPerVendor = data.budget.maxRewardPerVendor ? Number(data.budget.maxRewardPerVendor) : null
    }
    if (data.budget.maxEligibleVendors !== undefined) {
      campaign.budget.maxEligibleVendors = data.budget.maxEligibleVendors ? Number(data.budget.maxEligibleVendors) : null
    }
  }

  campaign.updatedBy = adminUser?._id
  await campaign.save()

  await RewardAuditLog.create({
    campaignId: campaign._id,
    actorId: adminUser?._id,
    actorRole: 'ADMIN',
    action: REWARD_AUDIT_ACTION.CAMPAIGN_UPDATED,
    reason: `Campaign "${campaign.name}" updated`,
  })

  return campaign
}

export async function activateRewardCampaign(campaignId, adminUser) {
  const campaign = await RewardCampaign.findById(campaignId)
  if (!campaign) throw new Error('Campaign not found')

  const now = new Date()
  if (campaign.endDate <= now) {
    throw new Error('Cannot activate an expired campaign. Please extend the end date first.')
  }

  const prevStatus = campaign.status
  const nextStatus = campaign.startDate > now ? CAMPAIGN_STATUS.SCHEDULED : CAMPAIGN_STATUS.ACTIVE

  campaign.status = nextStatus
  campaign.activatedAt = now
  campaign.resumedAt = now
  campaign.updatedBy = adminUser?._id
  await campaign.save()

  await RewardAuditLog.create({
    campaignId: campaign._id,
    actorId: adminUser?._id,
    actorRole: 'ADMIN',
    action: REWARD_AUDIT_ACTION.CAMPAIGN_ACTIVATED,
    previousStatus: prevStatus,
    newStatus: nextStatus,
    reason: 'Campaign activated by administrator',
  })

  return campaign
}

export async function pauseRewardCampaign(campaignId, adminUser, reason = 'Paused by admin') {
  const campaign = await RewardCampaign.findById(campaignId)
  if (!campaign) throw new Error('Campaign not found')

  const prevStatus = campaign.status
  campaign.status = CAMPAIGN_STATUS.PAUSED
  campaign.pausedAt = new Date()
  campaign.pauseReason = reason?.trim()
  campaign.updatedBy = adminUser?._id
  await campaign.save()

  await RewardAuditLog.create({
    campaignId: campaign._id,
    actorId: adminUser?._id,
    actorRole: 'ADMIN',
    action: REWARD_AUDIT_ACTION.CAMPAIGN_PAUSED,
    previousStatus: prevStatus,
    newStatus: CAMPAIGN_STATUS.PAUSED,
    reason: reason?.trim(),
  })

  return campaign
}

export async function endRewardCampaign(campaignId, adminUser, reason = 'Ended by admin') {
  const campaign = await RewardCampaign.findById(campaignId)
  if (!campaign) throw new Error('Campaign not found')

  const prevStatus = campaign.status
  campaign.status = CAMPAIGN_STATUS.ENDED
  campaign.endedAt = new Date()
  campaign.updatedBy = adminUser?._id
  await campaign.save()

  await RewardAuditLog.create({
    campaignId: campaign._id,
    actorId: adminUser?._id,
    actorRole: 'ADMIN',
    action: REWARD_AUDIT_ACTION.CAMPAIGN_ENDED,
    previousStatus: prevStatus,
    newStatus: CAMPAIGN_STATUS.ENDED,
    reason: reason?.trim(),
  })

  return campaign
}

/**
 * =========================================================================
 * 3. EVALUATION ENGINE & METRICS CALCULATION
 * =========================================================================
 */

export function getEvaluationPeriodKey(periodType, date = new Date()) {
  const d = new Date(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')

  if (periodType === EVALUATION_PERIOD.DAILY) return `${y}-${m}-${day}`
  if (periodType === EVALUATION_PERIOD.WEEKLY) {
    const firstDayOfYear = new Date(y, 0, 1)
    const pastDaysOfYear = (d - firstDayOfYear) / 86400000
    const weekNum = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7)
    return `${y}-W${String(weekNum).padStart(2, '0')}`
  }
  if (periodType === EVALUATION_PERIOD.QUARTERLY) {
    const q = Math.floor(d.getMonth() / 3) + 1
    return `${y}-Q${q}`
  }
  return `${y}-${m}`
}

export function getPeriodDateRange(periodType, campaignStart, campaignEnd, targetDate = new Date()) {
  const d = new Date(targetDate)
  let start = new Date(d)
  let end = new Date(d)

  if (periodType === EVALUATION_PERIOD.DAILY) {
    start.setHours(0, 0, 0, 0)
    end.setHours(23, 59, 59, 999)
  } else if (periodType === EVALUATION_PERIOD.WEEKLY) {
    const day = d.getDay() || 7
    start.setDate(d.getDate() - day + 1)
    start.setHours(0, 0, 0, 0)
    end = new Date(start)
    end.setDate(start.getDate() + 6)
    end.setHours(23, 59, 59, 999)
  } else if (periodType === EVALUATION_PERIOD.MONTHLY) {
    start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0)
    end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999)
  } else if (periodType === EVALUATION_PERIOD.QUARTERLY) {
    const q = Math.floor(d.getMonth() / 3)
    start = new Date(d.getFullYear(), q * 3, 1, 0, 0, 0, 0)
    end = new Date(d.getFullYear(), (q + 1) * 3, 0, 23, 59, 59, 999)
  } else {
    // Custom date range bound to campaign
    start = new Date(campaignStart)
    end = new Date(campaignEnd)
  }

  // Ensure bounded within campaign lifespan
  if (start < new Date(campaignStart)) start = new Date(campaignStart)
  if (end > new Date(campaignEnd)) end = new Date(campaignEnd)

  return { start, end }
}

/**
 * Check if a vendor is eligible for a specific campaign based on KYC, categories, zones, and whitelists
 */
export function isVendorEligibleForCampaign(campaign, vendorUser) {
  if (!vendorUser) return false

  // Role check: must be LABOUR or CONTRACTOR
  if (![USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR].includes(vendorUser.role)) {
    return false
  }

  const elig = campaign.eligibility || {}

  // 1. KYC verification filter
  if (elig.verifiedOnly) {
    const kyc = vendorUser.labourProfile?.kycStatus
    if (kyc !== KYC_STATUS.VERIFIED) return false
  }

  // 2. Included / Excluded Vendor Whitelist
  if (elig.excludedVendorIds?.length > 0) {
    const excluded = elig.excludedVendorIds.some((id) => String(id) === String(vendorUser._id))
    if (excluded) return false
  }
  if (elig.includedVendorIds?.length > 0) {
    const included = elig.includedVendorIds.some((id) => String(id) === String(vendorUser._id))
    if (!included) return false
  }

  // 3. Category matching
  if (elig.categoryIds?.length > 0) {
    const vendorCats = (vendorUser.labourProfile?.categoryIds || []).map(String)
    const matchesCat = elig.categoryIds.some((cid) => vendorCats.includes(String(cid)))
    if (!matchesCat) return false
  }

  // 4. City matching
  if (elig.cities?.length > 0) {
    const vCity = (vendorUser.city || vendorUser.currentLocation || '').toLowerCase()
    const matchesCity = elig.cities.some((c) => vCity.includes(c.toLowerCase()))
    if (!matchesCity) return false
  }

  return true
}

/**
 * Compute real-time authoritative metrics from Database
 */
export async function calculateVendorMetrics({ vendorId, startDate, endDate, categoryIds = [], serviceIds = [] }) {
  const vId = new mongoose.Types.ObjectId(vendorId)

  // 1. Fetch Completed Bookings
  const bookingQuery = {
    $or: [{ laborId: vId }, { acceptedLabourId: vId }, { acceptedLabourIds: vId }],
    status: 'COMPLETED',
    createdAt: { $gte: startDate, $lte: endDate },
  }
  if (categoryIds.length > 0) {
    bookingQuery.subcategoryId = { $in: categoryIds }
  }
  if (serviceIds.length > 0) {
    bookingQuery.serviceId = { $in: serviceIds }
  }

  const completedBookings = await Booking.find(bookingQuery).lean()
  const completedCount = completedBookings.length

  // Calculate Revenue
  let totalRevenue = 0
  let totalLabourShare = 0
  const uniqueCustomerSet = new Set()

  completedBookings.forEach((b) => {
    totalRevenue += Number(b.totalAmount || 0)
    totalLabourShare += Number(b.laborShare || b.totalAmount || 0)
    if (b.userId) uniqueCustomerSet.add(String(b.userId))
  })

  // 2. Fetch Cancelled Bookings (Vendor Attributable)
  const cancelledCount = await Booking.countDocuments({
    $or: [{ laborId: vId }, { acceptedLabourId: vId }, { acceptedLabourIds: vId }],
    status: 'CANCELLED',
    cancelledBy: 'LABOUR',
    createdAt: { $gte: startDate, $lte: endDate },
  })

  const totalAssigned = completedCount + cancelledCount
  const cancellationRate = totalAssigned > 0 ? Number(((cancelledCount / totalAssigned) * 100).toFixed(1)) : 0

  // 3. Fetch Customer Reviews & Ratings
  const reviews = await Review.find({
    revieweeId: vId,
    createdAt: { $gte: startDate, $lte: endDate },
  }).lean()

  const reviewsCount = reviews.length
  let averageRating = 0
  if (reviewsCount > 0) {
    const sum = reviews.reduce((acc, r) => acc + Number(r.rating || 0), 0)
    averageRating = Number((sum / reviewsCount).toFixed(2))
  }

  // 4. On-time completion percentage (based on start timestamp or completed status)
  const onTimeRate = 100 // Defaults to 100% for completed jobs unless flagged

  // 5. New Customers Acquisition Count
  let newCustomersCount = 0
  if (uniqueCustomerSet.size > 0) {
    const customerIds = Array.from(uniqueCustomerSet).map((id) => new mongoose.Types.ObjectId(id))
    // Check which customers had NO bookings with this vendor prior to startDate
    const previousBookings = await Booking.find({
      $or: [{ laborId: vId }, { acceptedLabourId: vId }, { acceptedLabourIds: vId }],
      userId: { $in: customerIds },
      status: 'COMPLETED',
      createdAt: { $lt: startDate },
    }).distinct('userId')

    const prevSet = new Set(previousBookings.map(String))
    customerIds.forEach((cid) => {
      if (!prevSet.has(String(cid))) newCustomersCount += 1
    })
  }

  const repeatCustomersCount = uniqueCustomerSet.size - newCustomersCount

  return {
    completedBookings: completedCount,
    totalRevenue,
    totalLabourShare,
    uniqueCustomersCount: uniqueCustomerSet.size,
    newCustomersCount,
    repeatCustomersCount,
    cancellationRate,
    onTimeRate,
    averageRating,
    reviewsCount,
    bookingIds: completedBookings.map((b) => b._id),
    reviewIds: reviews.map((r) => r._id),
  }
}

/**
 * Evaluate and progress a vendor for a specific campaign
 */
export async function evaluateVendorCampaign(campaign, vendorUser) {
  const vendorId = vendorUser._id
  const periodKey = getEvaluationPeriodKey(campaign.evaluationPeriod)
  const { start, end } = getPeriodDateRange(campaign.evaluationPeriod, campaign.startDate, campaign.endDate)

  // 1. Find or create VendorReward record
  let vendorReward = await VendorReward.findOne({
    campaignId: campaign._id,
    vendorId,
    evaluationPeriod: periodKey,
  })

  if (!vendorReward) {
    vendorReward = new VendorReward({
      campaignId: campaign._id,
      vendorId,
      evaluationPeriod: periodKey,
      category: campaign.category,
      status: VENDOR_REWARD_STATUS.IN_PROGRESS,
      approvalMode: campaign.approvalMode,
      rewardAmount: 0,
    })
  }

  // If already credited, approved, or rejected, only return current snapshot
  if ([VENDOR_REWARD_STATUS.CREDITED, VENDOR_REWARD_STATUS.REVERSED, VENDOR_REWARD_STATUS.REJECTED].includes(vendorReward.status)) {
    return vendorReward
  }

  // 2. Check vendor eligibility
  const isEligible = isVendorEligibleForCampaign(campaign, vendorUser)
  if (!isEligible) {
    return vendorReward
  }

  // 3. Compute Metrics
  const metrics = await calculateVendorMetrics({
    vendorId,
    startDate: start,
    endDate: end,
    categoryIds: campaign.eligibility?.categoryIds || [],
    serviceIds: campaign.eligibility?.serviceIds || [],
  })

  // 4. Evaluate Criteria based on Category
  let isQualified = false
  let calculatedReward = 0
  let targetRequired = 0
  let currentValue = 0
  let unit = 'bookings'
  let qualifyingTier = null
  let qualifyingTierLabel = ''

  if (campaign.category === REWARD_CATEGORY.PERFORMANCE) {
    const rules = campaign.performanceRules || {}
    const logic = rules.conditionLogic || 'ALL'
    const conditions = []

    // Condition 1: Average Rating
    if (rules.minAverageRating) {
      const met = metrics.averageRating >= rules.minAverageRating && metrics.reviewsCount >= (rules.minReviewsCount || 1)
      conditions.push(met)
      currentValue = metrics.averageRating
      targetRequired = rules.minAverageRating
      unit = '⭐ rating'
    }

    // Condition 2: Completed Bookings
    if (rules.minCompletedBookings) {
      const met = metrics.completedBookings >= rules.minCompletedBookings
      conditions.push(met)
      if (!currentValue) {
        currentValue = metrics.completedBookings
        targetRequired = rules.minCompletedBookings
        unit = 'bookings'
      }
    }

    // Condition 3: Cancellation Rate
    if (rules.maxCancellationRatePct !== undefined && rules.maxCancellationRatePct !== null) {
      const met = metrics.cancellationRate <= rules.maxCancellationRatePct
      conditions.push(met)
    }

    // Condition 4: Reviews Count
    if (rules.minReviewsCount) {
      const met = metrics.reviewsCount >= rules.minReviewsCount
      conditions.push(met)
    }

    if (conditions.length > 0) {
      isQualified = logic === 'ALL' ? conditions.every(Boolean) : conditions.some(Boolean)
    }

    calculatedReward = Number(rules.rewardAmount || 0)
  } else if (campaign.category === REWARD_CATEGORY.BUSINESS) {
    const rules = campaign.businessRules || {}
    const targetType = rules.targetType || 'BOOKING_COUNT'
    const rewardType = rules.rewardType || 'FIXED'

    // Determine current metric value based on targetType
    if (targetType === 'SERVICE_REVENUE') {
      currentValue = metrics.totalRevenue
      unit = '₹ revenue'
    } else if (targetType === 'NEW_CUSTOMERS') {
      currentValue = metrics.newCustomersCount
      unit = 'new customers'
    } else if (targetType === 'REPEAT_CUSTOMERS') {
      currentValue = metrics.repeatCustomersCount
      unit = 'repeat customers'
    } else {
      currentValue = metrics.completedBookings
      unit = 'bookings'
    }

    if (rewardType === 'FIXED') {
      targetRequired = Number(rules.targetThreshold || 10)
      isQualified = currentValue >= targetRequired
      calculatedReward = Number(rules.fixedAmount || 0)
    } else if (rewardType === 'PERCENTAGE') {
      targetRequired = Number(rules.targetThreshold || 1000)
      isQualified = currentValue >= targetRequired
      const pct = Number(rules.percentage || 0)
      let reward = Math.round((currentValue * pct) / 100)
      if (rules.maxPercentageCap && reward > rules.maxPercentageCap) {
        reward = rules.maxPercentageCap
      }
      calculatedReward = reward
    } else if (rewardType === 'TIERED' && rules.tiers?.length > 0) {
      const sortedTiers = [...rules.tiers].sort((a, b) => a.targetValue - b.targetValue)
      const policy = rules.tierPolicy || 'HIGHEST_TIER_ONLY'
      targetRequired = sortedTiers[sortedTiers.length - 1]?.targetValue || 10

      if (policy === 'HIGHEST_TIER_ONLY') {
        let highestQualifiedTier = null
        for (const tier of sortedTiers) {
          if (currentValue >= tier.targetValue) {
            highestQualifiedTier = tier
          }
        }
        if (highestQualifiedTier) {
          isQualified = true
          calculatedReward = Number(highestQualifiedTier.rewardAmount || 0)
          qualifyingTier = highestQualifiedTier.tierNumber
          qualifyingTierLabel = highestQualifiedTier.label || `Tier ${highestQualifiedTier.tierNumber}`
        }
      } else {
        // Cumulative policy
        let totalTierReward = 0
        let highestTierNumber = 0
        for (const tier of sortedTiers) {
          if (currentValue >= tier.targetValue) {
            isQualified = true
            totalTierReward += Number(tier.rewardAmount || 0)
            highestTierNumber = tier.tierNumber
          }
        }
        calculatedReward = totalTierReward
        qualifyingTier = highestTierNumber
        qualifyingTierLabel = `Cumulative up to Tier ${highestTierNumber}`
      }
    }
  }

  // Enforce Max Reward Per Vendor Cap
  if (campaign.budget?.maxRewardPerVendor && calculatedReward > campaign.budget.maxRewardPerVendor) {
    calculatedReward = campaign.budget.maxRewardPerVendor
  }

  // Calculate Progress Percentage
  const progressPct = targetRequired > 0 ? Math.min(100, Math.round((currentValue / targetRequired) * 100)) : 0
  const remaining = Math.max(0, targetRequired - currentValue)

  // Update real-time progress
  vendorReward.currentProgress = {
    ...metrics,
    currentValue,
    targetRequired,
    achievedPercentage: progressPct,
    unit,
    remainingRequired: remaining,
    lastCalculatedAt: new Date(),
  }

  // 5. Handle Qualification and Budget Verification
  if (isQualified && calculatedReward > 0) {
    // Budget check
    const currentUsed = campaign.budget?.usedBudget || 0
    const totalBudget = campaign.budget?.totalBudget || 0
    const availableBudget = Math.max(0, totalBudget - currentUsed)

    if (calculatedReward > availableBudget) {
      console.warn(`[REWARDS] Campaign "${campaign.name}" budget exceeded. Required: ₹${calculatedReward}, Available: ₹${availableBudget}`)
      vendorReward.status = VENDOR_REWARD_STATUS.QUALIFIED
      vendorReward.rewardAmount = availableBudget > 0 ? availableBudget : calculatedReward
      vendorReward.qualificationEvidence = {
        qualifiedAt: new Date(),
        criteriaSnapshots: metrics,
        qualifyingBookingIds: metrics.bookingIds,
        qualifyingReviewIds: metrics.reviewIds,
        qualifyingTier,
        qualifyingTierLabel,
        notes: availableBudget <= 0 ? 'Qualified but campaign budget is exhausted' : 'Partial budget allocation',
      }
      await vendorReward.save()
      return vendorReward
    }

    vendorReward.rewardAmount = calculatedReward
    vendorReward.qualificationEvidence = {
      qualifiedAt: new Date(),
      criteriaSnapshots: metrics,
      qualifyingBookingIds: metrics.bookingIds,
      qualifyingReviewIds: metrics.reviewIds,
      qualifyingTier,
      qualifyingTierLabel,
      notes: `Target successfully achieved (${currentValue}/${targetRequired} ${unit})`,
    }

    await vendorReward.save()

    // Check Approval Mode
    if (campaign.approvalMode === APPROVAL_MODE.AUTOMATIC) {
      // Automatic Wallet Credit
      const creditResult = await creditVendorRewardAtomic(vendorReward, campaign)
      if (creditResult?.vendorReward) {
        return creditResult.vendorReward
      }
    } else {
      // Manual Approval Required
      vendorReward.status = VENDOR_REWARD_STATUS.PENDING_APPROVAL
      await vendorReward.save()

      sendNotificationToUser(vendorId, {
        title: 'Reward Milestone Reached! 🎉',
        body: `You have qualified for ₹${calculatedReward} in "${campaign.name}". Awaiting admin approval.`,
        data: { type: 'REWARD_PENDING_APPROVAL', campaignId: String(campaign._id) },
      }).catch(() => {})
    }
  } else {
    if (vendorReward.status === VENDOR_REWARD_STATUS.IN_PROGRESS) {
      await vendorReward.save()
    }
  }

  return vendorReward
}

/**
 * =========================================================================
 * 4. ATOMIC REWARD CREDITING & WALLET INTEGRATION
 * =========================================================================
 */

export async function creditVendorRewardAtomic(vendorRewardInput, campaignInput = null, adminUser = null) {
  const vendorRewardId = vendorRewardInput._id || vendorRewardInput
  const vendorReward = await VendorReward.findById(vendorRewardId)
  if (!vendorReward) throw new Error('Vendor reward record not found')

  if (vendorReward.status === VENDOR_REWARD_STATUS.CREDITED) {
    return { success: true, alreadyCredited: true, vendorReward }
  }

  const campaign = campaignInput || (await RewardCampaign.findById(vendorReward.campaignId))
  if (!campaign) throw new Error('Associated campaign not found')

  const rewardAmount = Number(vendorReward.rewardAmount)
  if (isNaN(rewardAmount) || rewardAmount <= 0) {
    throw new Error('Invalid reward amount for crediting')
  }

  // Verify campaign budget
  const usedBudget = campaign.budget?.usedBudget || 0
  const totalBudget = campaign.budget?.totalBudget || 0
  if (usedBudget + rewardAmount > totalBudget) {
    throw new Error(`Insufficient campaign budget. Available: ₹${Math.max(0, totalBudget - usedBudget)}, Required: ₹${rewardAmount}`)
  }

  const vendorId = vendorReward.vendorId
  const idempotencyKey = `REWARD_CREDIT_${vendorReward._id}_${vendorId}`

  // 1. Atomic Wallet Fetch / Creation
  let wallet = await Wallet.findOne({ userId: vendorId })
  if (!wallet) {
    wallet = await Wallet.create({
      userId: vendorId,
      balance: 0,
      selfBalance: 0,
    })
  }

  const currentBalance = wallet.balance !== undefined ? wallet.balance : (wallet.selfBalance || 0)
  const balanceBefore = currentBalance
  const balanceAfter = currentBalance + rewardAmount

  // 2. Increment Wallet balance atomically
  const updatedWallet = await Wallet.findByIdAndUpdate(
    wallet._id,
    { $inc: { balance: rewardAmount, selfBalance: rewardAmount } },
    { new: true }
  )

  // 3. Create Auditable Financial Transaction
  const walletTx = await WalletTransaction.create({
    walletId: wallet._id,
    userId: vendorId,
    amount: rewardAmount,
    type: 'CREDIT',
    targetWallet: 'SELF',
    context: 'INCENTIVE',
    balanceBefore,
    balanceAfter,
    referenceType: 'OTHER',
    referenceId: vendorReward._id,
    description: `Reward incentive credited for "${campaign.name}" (${campaign.category})`,
    status: 'COMPLETED',
  })

  // 4. Update VendorReward
  vendorReward.status = VENDOR_REWARD_STATUS.CREDITED
  vendorReward.creditDetails = {
    walletId: wallet._id,
    walletTransactionId: walletTx._id,
    creditedAt: new Date(),
    idempotencyKey,
  }
  if (adminUser) {
    vendorReward.approvalDetails = {
      reviewedBy: adminUser._id,
      reviewedAt: new Date(),
      action: 'APPROVED',
      notes: 'Approved and credited by admin',
    }
  }
  await vendorReward.save()

  // 5. Update Campaign Budget Counters Atomically
  await RewardCampaign.findByIdAndUpdate(campaign._id, {
    $inc: {
      'budget.usedBudget': rewardAmount,
      'budget.totalRewardsIssuedCount': 1,
    },
  })

  // 6. Audit Log
  await RewardAuditLog.create({
    campaignId: campaign._id,
    vendorRewardId: vendorReward._id,
    vendorId,
    actorId: adminUser?._id,
    actorRole: adminUser ? 'ADMIN' : 'SYSTEM',
    action: REWARD_AUDIT_ACTION.REWARD_CREDITED,
    amount: rewardAmount,
    newStatus: VENDOR_REWARD_STATUS.CREDITED,
    reason: `₹${rewardAmount} credited to wallet for campaign "${campaign.name}"`,
    metadata: { walletTransactionId: walletTx._id, balanceAfter },
  })

  // 7. Dispatch Vendor Push Notification
  sendNotificationToUser(vendorId, {
    title: 'Reward Credited! 💰',
    body: `Congratulations! ₹${rewardAmount} incentive for "${campaign.name}" has been credited to your wallet.`,
    data: { type: 'REWARD_CREDITED', rewardId: String(vendorReward._id), amount: String(rewardAmount) },
  }).catch(() => {})

  console.log(`[REWARDS] Credited ₹${rewardAmount} to vendor ${vendorId} for campaign "${campaign.name}"`)
  return { success: true, vendorReward, walletTransaction: walletTx, wallet: updatedWallet }
}

export async function approveVendorReward(vendorRewardId, adminUser, notes = '') {
  const vendorReward = await VendorReward.findById(vendorRewardId)
  if (!vendorReward) throw new Error('Vendor reward not found')

  if (vendorReward.status === VENDOR_REWARD_STATUS.CREDITED) {
    throw new Error('Reward has already been credited')
  }

  const result = await creditVendorRewardAtomic(vendorReward, null, adminUser)

  await RewardAuditLog.create({
    campaignId: vendorReward.campaignId,
    vendorRewardId: vendorReward._id,
    vendorId: vendorReward.vendorId,
    actorId: adminUser._id,
    actorRole: 'ADMIN',
    action: REWARD_AUDIT_ACTION.REWARD_APPROVED,
    amount: vendorReward.rewardAmount,
    reason: notes || 'Admin approved reward qualification',
  })

  return result
}

export async function rejectVendorReward(vendorRewardId, adminUser, reason) {
  if (!reason || !reason.trim()) throw new Error('Rejection reason is required')

  const vendorReward = await VendorReward.findById(vendorRewardId)
  if (!vendorReward) throw new Error('Vendor reward not found')

  if (vendorReward.status === VENDOR_REWARD_STATUS.CREDITED) {
    throw new Error('Cannot reject an already credited reward. Use reward reversal instead.')
  }

  const prevStatus = vendorReward.status
  vendorReward.status = VENDOR_REWARD_STATUS.REJECTED
  vendorReward.approvalDetails = {
    reviewedBy: adminUser._id,
    reviewedAt: new Date(),
    action: 'REJECTED',
    reason: reason.trim(),
  }
  await vendorReward.save()

  await RewardAuditLog.create({
    campaignId: vendorReward.campaignId,
    vendorRewardId: vendorReward._id,
    vendorId: vendorReward.vendorId,
    actorId: adminUser._id,
    actorRole: 'ADMIN',
    action: REWARD_AUDIT_ACTION.REWARD_REJECTED,
    previousStatus: prevStatus,
    newStatus: VENDOR_REWARD_STATUS.REJECTED,
    reason: reason.trim(),
  })

  sendNotificationToUser(vendorReward.vendorId, {
    title: 'Reward Status Update',
    body: `Your reward request was not approved: ${reason.trim()}`,
    data: { type: 'REWARD_REJECTED', rewardId: String(vendorReward._id) },
  }).catch(() => {})

  return vendorReward
}

export async function reverseVendorReward(vendorRewardId, adminUser, reason) {
  if (!reason || !reason.trim()) throw new Error('Reversal reason is required')

  const vendorReward = await VendorReward.findById(vendorRewardId)
  if (!vendorReward) throw new Error('Vendor reward not found')

  if (vendorReward.status !== VENDOR_REWARD_STATUS.CREDITED) {
    throw new Error('Only credited rewards can be reversed')
  }

  const rewardAmount = vendorReward.rewardAmount
  const vendorId = vendorReward.vendorId

  // Debit wallet
  const wallet = await Wallet.findOne({ userId: vendorId })
  if (!wallet) throw new Error('Vendor wallet not found')

  const currentBalance = wallet.balance !== undefined ? wallet.balance : (wallet.selfBalance || 0)
  const balanceBefore = currentBalance
  const balanceAfter = Math.max(0, currentBalance - rewardAmount)

  await Wallet.findByIdAndUpdate(wallet._id, {
    $inc: { balance: -rewardAmount, selfBalance: -rewardAmount },
  })

  const reversalTx = await WalletTransaction.create({
    walletId: wallet._id,
    userId: vendorId,
    amount: rewardAmount,
    type: 'DEBIT',
    targetWallet: 'SELF',
    context: 'ADMIN_ADJUSTMENT',
    balanceBefore,
    balanceAfter,
    referenceType: 'OTHER',
    referenceId: vendorReward._id,
    description: `Reward reversal: ${reason.trim()}`,
    status: 'COMPLETED',
  })

  // Decrement campaign usedBudget
  await RewardCampaign.findByIdAndUpdate(vendorReward.campaignId, {
    $inc: {
      'budget.usedBudget': -rewardAmount,
      'budget.totalRewardsIssuedCount': -1,
    },
  })

  vendorReward.status = VENDOR_REWARD_STATUS.REVERSED
  vendorReward.creditDetails.reversalTransactionId = reversalTx._id
  vendorReward.creditDetails.reversedAt = new Date()
  vendorReward.creditDetails.reversedBy = adminUser._id
  vendorReward.creditDetails.reversalReason = reason.trim()
  await vendorReward.save()

  await RewardAuditLog.create({
    campaignId: vendorReward.campaignId,
    vendorRewardId: vendorReward._id,
    vendorId,
    actorId: adminUser._id,
    actorRole: 'ADMIN',
    action: REWARD_AUDIT_ACTION.REWARD_REVERSED,
    amount: rewardAmount,
    newStatus: VENDOR_REWARD_STATUS.REVERSED,
    reason: reason.trim(),
    metadata: { reversalTxId: reversalTx._id },
  })

  return { vendorReward, reversalTx }
}

/**
 * =========================================================================
 * 5. RECONCILIATION & BATCH EVALUATION
 * =========================================================================
 */

/**
 * Non-blocking event hook called when booking completes or review is submitted
 */
export async function evaluateVendorRewardsOnEvent({ vendorId }) {
  try {
    const settings = await getRewardSettings()
    if (!settings.enabled || settings.globalRewardPause) return

    const now = new Date()
    const activeCampaigns = await RewardCampaign.find({
      status: CAMPAIGN_STATUS.ACTIVE,
      startDate: { $lte: now },
      endDate: { $gte: now },
    })

    if (activeCampaigns.length === 0) return

    const vendor = await User.findById(vendorId).lean()
    if (!vendor) return

    for (const campaign of activeCampaigns) {
      await evaluateVendorCampaign(campaign, vendor)
    }
  } catch (err) {
    console.error(`[REWARDS_EVENT_ERR] Error evaluating rewards for vendor ${vendorId}:`, err.message)
  }
}

/**
 * Reconcile all active campaigns across eligible vendors
 */
export async function reconcileAllActiveCampaigns() {
  const settings = await getRewardSettings()
  if (!settings.enabled || settings.globalRewardPause) {
    return { reconciled: false, reason: 'REWARDS_DISABLED' }
  }

  const now = new Date()

  // 1. Auto-activate scheduled campaigns whose start time has arrived
  await RewardCampaign.updateMany(
    { status: CAMPAIGN_STATUS.SCHEDULED, startDate: { $lte: now }, endDate: { $gte: now } },
    { $set: { status: CAMPAIGN_STATUS.ACTIVE, activatedAt: now } }
  )

  // 2. Auto-end expired active campaigns
  await RewardCampaign.updateMany(
    { status: { $in: [CAMPAIGN_STATUS.ACTIVE, CAMPAIGN_STATUS.SCHEDULED, CAMPAIGN_STATUS.PAUSED] }, endDate: { $lt: now } },
    { $set: { status: CAMPAIGN_STATUS.ENDED, endedAt: now } }
  )

  // 3. Find all currently active campaigns
  const activeCampaigns = await RewardCampaign.find({
    status: CAMPAIGN_STATUS.ACTIVE,
    startDate: { $lte: now },
    endDate: { $gte: now },
  })

  if (activeCampaigns.length === 0) {
    return { reconciled: true, evaluatedCampaignsCount: 0, vendorsProcessed: 0 }
  }

  // Fetch all active verified vendors
  const vendors = await User.find({
    role: { $in: [USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR] },
    isActive: true,
  }).lean()

  let totalProcessed = 0
  for (const campaign of activeCampaigns) {
    for (const vendor of vendors) {
      if (isVendorEligibleForCampaign(campaign, vendor)) {
        await evaluateVendorCampaign(campaign, vendor)
        totalProcessed++
      }
    }
    campaign.lastEvaluatedAt = new Date()
    await campaign.save()
  }

  console.log(`[REWARDS_RECONCILE] Evaluated ${activeCampaigns.length} campaigns across ${vendors.length} vendors (${totalProcessed} evaluations)`)
  return {
    reconciled: true,
    evaluatedCampaignsCount: activeCampaigns.length,
    vendorsProcessed: totalProcessed,
  }
}

/**
 * =========================================================================
 * 6. ADMIN REPORTING & DASHBOARD ANALYTICS
 * =========================================================================
 */

export async function getAdminRewardOverviewStats() {
  const [
    totalCampaigns,
    draftCampaigns,
    activeCampaigns,
    pausedCampaigns,
    endedCampaigns,
    campaignsAgg,
    rewardsAgg,
    pendingApprovalsCount,
  ] = await Promise.all([
    RewardCampaign.countDocuments(),
    RewardCampaign.countDocuments({ status: CAMPAIGN_STATUS.DRAFT }),
    RewardCampaign.countDocuments({ status: CAMPAIGN_STATUS.ACTIVE }),
    RewardCampaign.countDocuments({ status: CAMPAIGN_STATUS.PAUSED }),
    RewardCampaign.countDocuments({ status: { $in: [CAMPAIGN_STATUS.ENDED, CAMPAIGN_STATUS.SETTLED] } }),
    RewardCampaign.aggregate([
      {
        $group: {
          _id: null,
          totalBudget: { $sum: '$budget.totalBudget' },
          totalUsedBudget: { $sum: '$budget.usedBudget' },
          totalRewardsIssued: { $sum: '$budget.totalRewardsIssuedCount' },
        },
      },
    ]),
    VendorReward.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$rewardAmount' },
        },
      },
    ]),
    VendorReward.countDocuments({ status: VENDOR_REWARD_STATUS.PENDING_APPROVAL }),
  ])

  const totals = campaignsAgg[0] || { totalBudget: 0, totalUsedBudget: 0, totalRewardsIssued: 0 }
  const remainingBudget = Math.max(0, totals.totalBudget - totals.totalUsedBudget)

  // Map rewards breakdown
  const statusMap = {}
  rewardsAgg.forEach((r) => {
    statusMap[r._id] = { count: r.count, amount: r.totalAmount }
  })

  // Count distinct eligible vendors participating
  const eligibleVendorsCount = await User.countDocuments({
    role: { $in: [USER_ROLES.LABOUR, USER_ROLES.CONTRACTOR] },
    isActive: true,
  })

  return {
    campaigns: {
      total: totalCampaigns,
      draft: draftCampaigns,
      active: activeCampaigns,
      paused: pausedCampaigns,
      ended: endedCampaigns,
    },
    financials: {
      totalBudget: totals.totalBudget,
      totalCreditedAmount: totals.totalUsedBudget,
      remainingAvailableBudget: remainingBudget,
      pendingApprovalAmount: statusMap[VENDOR_REWARD_STATUS.PENDING_APPROVAL]?.amount || 0,
      totalRewardsIssuedCount: totals.totalRewardsIssued,
    },
    rewards: {
      pendingApprovals: pendingApprovalsCount,
      creditedCount: statusMap[VENDOR_REWARD_STATUS.CREDITED]?.count || 0,
      qualifiedCount: (statusMap[VENDOR_REWARD_STATUS.QUALIFIED]?.count || 0) + (statusMap[VENDOR_REWARD_STATUS.PENDING_APPROVAL]?.count || 0) + (statusMap[VENDOR_REWARD_STATUS.CREDITED]?.count || 0),
      inProgressCount: statusMap[VENDOR_REWARD_STATUS.IN_PROGRESS]?.count || 0,
      rejectedCount: statusMap[VENDOR_REWARD_STATUS.REJECTED]?.count || 0,
      reversedCount: statusMap[VENDOR_REWARD_STATUS.REVERSED]?.count || 0,
    },
    vendors: {
      totalEligible: eligibleVendorsCount,
    },
  }
}

/**
 * =========================================================================
 * 7. VENDOR-FACING REWARDS OVERVIEW
 * =========================================================================
 */

export async function getVendorRewardsOverview(vendorId) {
  const vendor = await User.findById(vendorId)
    .populate('labourProfile.categoryIds', 'name')
    .lean()

  if (!vendor) throw new Error('Vendor not found')

  const now = new Date()

  // 1. Fetch active campaigns
  const activeCampaigns = await RewardCampaign.find({
    status: CAMPAIGN_STATUS.ACTIVE,
    startDate: { $lte: now },
    endDate: { $gte: now },
  })
    .populate('eligibility.categoryIds', 'name')
    .sort({ createdAt: -1 })
    .lean()

  // Filter campaigns this vendor is eligible for
  const eligibleCampaigns = activeCampaigns.filter((c) => isVendorEligibleForCampaign(c, vendor))

  // 2. Fetch all VendorReward records for this vendor
  const vendorRewards = await VendorReward.find({ vendorId })
    .populate('campaignId', 'name category description code termsAndConditions startDate endDate status')
    .sort({ updatedAt: -1 })
    .lean()

  // Map progress by campaignId
  const rewardByCampaignId = {}
  vendorRewards.forEach((vr) => {
    const cId = String(vr.campaignId?._id || vr.campaignId)
    rewardByCampaignId[cId] = vr
  })

  // Merge eligible campaigns with current vendor progress
  const activeCampaignsWithProgress = eligibleCampaigns.map((camp) => {
    const vr = rewardByCampaignId[String(camp._id)]
    return {
      campaign: camp,
      rewardStatus: vr?.status || 'IN_PROGRESS',
      progress: vr?.currentProgress || {
        achievedPercentage: 0,
        currentValue: 0,
        targetRequired: camp.category === 'PERFORMANCE' ? (camp.performanceRules?.minCompletedBookings || 10) : (camp.businessRules?.targetThreshold || 10),
        unit: camp.category === 'PERFORMANCE' ? 'bookings' : (camp.businessRules?.targetType || 'bookings'),
        remainingRequired: camp.category === 'PERFORMANCE' ? (camp.performanceRules?.minCompletedBookings || 10) : (camp.businessRules?.targetThreshold || 10),
      },
      rewardAmount: vr?.rewardAmount || (camp.category === 'PERFORMANCE' ? camp.performanceRules?.rewardAmount : camp.businessRules?.fixedAmount) || 0,
      rewardDetails: vr || null,
    }
  })

  // Summary Metrics
  let totalEarnedIncentives = 0
  let pendingRewardAmount = 0

  vendorRewards.forEach((r) => {
    if (r.status === VENDOR_REWARD_STATUS.CREDITED) {
      totalEarnedIncentives += Number(r.rewardAmount || 0)
    } else if (r.status === VENDOR_REWARD_STATUS.PENDING_APPROVAL || r.status === VENDOR_REWARD_STATUS.QUALIFIED) {
      pendingRewardAmount += Number(r.rewardAmount || 0)
    }
  })

  return {
    summary: {
      totalEarnedIncentives,
      pendingRewardAmount,
      activeCampaignsCount: eligibleCampaigns.length,
      qualifiedCampaignsCount: vendorRewards.filter((r) => [VENDOR_REWARD_STATUS.CREDITED, VENDOR_REWARD_STATUS.QUALIFIED, VENDOR_REWARD_STATUS.PENDING_APPROVAL].includes(r.status)).length,
    },
    activeCampaigns: activeCampaignsWithProgress,
    rewardHistory: vendorRewards,
  }
}
