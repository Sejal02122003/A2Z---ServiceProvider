import '../config/env.js'
import { connectDb } from '../config/db.js'
import { RewardCampaign, CAMPAIGN_STATUS, REWARD_CATEGORY, APPROVAL_MODE, EVALUATION_PERIOD } from '../models/RewardCampaign.js'
import { RewardSetting } from '../models/RewardSetting.js'
import { User } from '../models/User.js'
import { USER_ROLES } from '../constants/roles.js'
import { reconcileAllActiveCampaigns } from '../services/rewardEvaluationService.js'

async function seed() {
  await connectDb()
  console.log('Connected to DB for seeding reward campaigns...')

  // Initialize master settings
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
    console.log('Created default reward settings.')
  }

  const admin = await User.findOne({ role: USER_ROLES.ADMIN })
  const adminId = admin ? admin._id : null

  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59)

  const campaigns = [
    {
      name: 'Top Performer 5-Star Service Award',
      code: 'PRF_5STAR_EXCELLENCE_2026',
      description: 'Reward for service providers maintaining stellar customer feedback and zero fault records throughout the month.',
      category: REWARD_CATEGORY.PERFORMANCE,
      status: CAMPAIGN_STATUS.ACTIVE,
      approvalMode: APPROVAL_MODE.AUTOMATIC,
      destination: 'WALLET',
      evaluationPeriod: EVALUATION_PERIOD.MONTHLY,
      startDate: startOfMonth,
      endDate: endOfMonth,
      termsAndConditions: 'Must maintain minimum 4.8 rating across at least 5 customer reviews and complete 5 jobs.',
      performanceRules: {
        conditionLogic: 'ALL',
        minAverageRating: 4.8,
        minReviewsCount: 5,
        minCompletedBookings: 5,
        maxCancellationRatePct: 5,
        minOnTimeCompletionRatePct: 90,
        consecutivePeriodsRequired: 1,
        rewardAmount: 1000,
      },
      eligibility: {
        verifiedOnly: true,
      },
      budget: {
        totalBudget: 50000,
        usedBudget: 0,
        maxRewardPerVendor: 1000,
        maxEligibleVendors: 50,
      },
      createdBy: adminId,
    },
    {
      name: 'Zero Cancellation Consistency Bonus',
      code: 'PRF_ZERO_CANCEL_2026',
      description: 'Monthly incentive for reliable service professionals with 0% cancellation rate and active attendance.',
      category: REWARD_CATEGORY.PERFORMANCE,
      status: CAMPAIGN_STATUS.ACTIVE,
      approvalMode: APPROVAL_MODE.MANUAL,
      destination: 'WALLET',
      evaluationPeriod: EVALUATION_PERIOD.MONTHLY,
      startDate: startOfMonth,
      endDate: endOfMonth,
      termsAndConditions: 'Must complete at least 10 service jobs with zero worker-attributable cancellations.',
      performanceRules: {
        conditionLogic: 'ALL',
        minAverageRating: 4.2,
        minReviewsCount: 3,
        minCompletedBookings: 10,
        maxCancellationRatePct: 0,
        rewardAmount: 600,
      },
      eligibility: {
        verifiedOnly: true,
      },
      budget: {
        totalBudget: 30000,
        usedBudget: 0,
        maxRewardPerVendor: 600,
      },
      createdBy: adminId,
    },
    {
      name: 'Monthly Booking Super Milestone',
      code: 'BIZ_MONTHLY_GROWTH_2026',
      description: 'Tiered performance bonuses for escalating job volumes delivered during the monthly cycle.',
      category: REWARD_CATEGORY.BUSINESS,
      status: CAMPAIGN_STATUS.ACTIVE,
      approvalMode: APPROVAL_MODE.AUTOMATIC,
      destination: 'WALLET',
      evaluationPeriod: EVALUATION_PERIOD.MONTHLY,
      startDate: startOfMonth,
      endDate: endOfMonth,
      termsAndConditions: 'Tier 1: 10 jobs = ₹300, Tier 2: 25 jobs = ₹900, Tier 3: 50 jobs = ₹2,500. Cumulative payout.',
      businessRules: {
        targetType: 'BOOKING_COUNT',
        rewardType: 'TIERED',
        tierPolicy: 'CUMULATIVE',
        tiers: [
          { tierNumber: 1, targetValue: 10, rewardAmount: 300, label: 'Silver Tier (10 Jobs)' },
          { tierNumber: 2, targetValue: 25, rewardAmount: 600, label: 'Gold Tier (25 Jobs)' },
          { tierNumber: 3, targetValue: 50, rewardAmount: 1600, label: 'Diamond Tier (50 Jobs)' },
        ],
      },
      eligibility: {
        verifiedOnly: true,
      },
      budget: {
        totalBudget: 100000,
        usedBudget: 0,
        maxRewardPerVendor: 2500,
      },
      createdBy: adminId,
    },
    {
      name: 'New Customer Acquisition Booster',
      code: 'BIZ_NEW_CLIENTS_2026',
      description: 'Earn extra rewards by successfully servicing and onboarding brand new unique customers.',
      category: REWARD_CATEGORY.BUSINESS,
      status: CAMPAIGN_STATUS.ACTIVE,
      approvalMode: APPROVAL_MODE.MANUAL,
      destination: 'WALLET',
      evaluationPeriod: EVALUATION_PERIOD.MONTHLY,
      startDate: startOfMonth,
      endDate: endOfMonth,
      termsAndConditions: 'Complete jobs for at least 8 unique first-time customers to earn ₹800 bonus.',
      businessRules: {
        targetType: 'NEW_CUSTOMERS',
        rewardType: 'FIXED',
        targetThreshold: 8,
        fixedAmount: 800,
      },
      eligibility: {
        verifiedOnly: true,
      },
      budget: {
        totalBudget: 40000,
        usedBudget: 0,
        maxRewardPerVendor: 800,
      },
      createdBy: adminId,
    },
  ]

  for (const c of campaigns) {
    await RewardCampaign.findOneAndUpdate({ code: c.code }, { $set: c }, { upsert: true, new: true })
    console.log(`Seeded campaign: ${c.name} (${c.code})`)
  }

  // Run initial reconciliation
  console.log('Running initial reconciliation...')
  await reconcileAllActiveCampaigns()
  console.log('Seeding completed successfully!')
  process.exit(0)
}

seed().catch((err) => {
  console.error('Seed error:', err)
  process.exit(1)
})
