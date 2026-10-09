import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../../.env') });

import { RewardCampaign, CAMPAIGN_STATUS, REWARD_CATEGORY, APPROVAL_MODE, EVALUATION_PERIOD } from '../models/RewardCampaign.js';
import { VendorReward, VENDOR_REWARD_STATUS } from '../models/VendorReward.js';
import { RewardAuditLog } from '../models/RewardAuditLog.js';
import { User } from '../models/User.js';
import { Booking } from '../models/Booking.js';
import { Review } from '../models/Review.js';
import { Wallet } from '../models/Wallet.js';
import { WalletTransaction } from '../models/WalletTransaction.js';
import {
  evaluateVendorCampaign,
  reconcileAllActiveCampaigns,
  approveVendorReward,
  rejectVendorReward,
  reverseVendorReward
} from '../services/rewardEvaluationService.js';

let passedTests = 0;
let totalTests = 0;

function assert(condition, message) {
  totalTests++;
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTests() {
  console.log('🚀 Starting Rewards & Incentives Engine Test Suite...\n');

  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB.\n');

    // Setup Test Admin, Vendor & Customer
    let testAdmin = await User.findOne({ role: 'admin' });
    if (!testAdmin) {
      testAdmin = await User.create({
        name: 'Test Admin',
        phone: '9888877779',
        email: 'test_admin_reward@appzeto.com',
        role: 'admin',
        status: 'active'
      });
    }

    let testVendor = await User.findOne({ email: 'test_reward_vendor@appzeto.com' });
    if (!testVendor) {
      testVendor = await User.create({
        name: 'Test Reward Partner',
        phone: '9888877770',
        email: 'test_reward_vendor@appzeto.com',
        role: 'labour',
        status: 'active',
        isAadhaarVerified: true
      });
    }

    let testCustomer = await User.findOne({ email: 'test_reward_customer@appzeto.com' });
    if (!testCustomer) {
      testCustomer = await User.create({
        name: 'Test Customer',
        phone: '9888877771',
        email: 'test_reward_customer@appzeto.com',
        role: 'customer',
        status: 'active'
      });
    }

    // Clean any prior test rewards/campaigns
    await RewardCampaign.deleteMany({ code: { $regex: /^TEST_/ } });
    await VendorReward.deleteMany({ vendorId: testVendor._id });

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59);

    // TEST 1: Campaign Creation & Validation
    console.log('--- TEST GROUP 1: Campaign Configuration & Validation ---');
    const validPerfCampaign = await RewardCampaign.create({
      code: 'TEST_PERF_5STAR',
      name: 'Test 5-Star Champion',
      description: 'Performance award for maintaining 4.5+ rating',
      category: REWARD_CATEGORY.PERFORMANCE,
      status: CAMPAIGN_STATUS.ACTIVE,
      approvalMode: APPROVAL_MODE.MANUAL,
      destination: 'WALLET',
      evaluationPeriod: EVALUATION_PERIOD.MONTHLY,
      startDate: startOfMonth,
      endDate: endOfMonth,
      budget: { totalBudget: 5000, usedBudget: 0, maxRewardPerVendor: 500 },
      performanceRules: {
        conditionLogic: 'ALL',
        minAverageRating: 4.5,
        minReviewsCount: 2,
        minCompletedBookings: 2,
        maxCancellationRatePct: 10,
        rewardAmount: 500
      },
      eligibility: { verifiedOnly: false },
      createdBy: testAdmin._id
    });
    assert(validPerfCampaign._id != null, 'Performance campaign created with valid schema');
    assert(validPerfCampaign.status === CAMPAIGN_STATUS.ACTIVE, 'Campaign initialized to ACTIVE status');

    // TEST 2: Business Tiered Campaign
    console.log('\n--- TEST GROUP 2: Business-Based Milestone & Tiered Engine ---');
    const validBizCampaign = await RewardCampaign.create({
      code: 'TEST_BIZ_TIERS',
      name: 'Test Monthly Volume Bonus',
      description: 'Business milestone ladder',
      category: REWARD_CATEGORY.BUSINESS,
      status: CAMPAIGN_STATUS.ACTIVE,
      approvalMode: APPROVAL_MODE.AUTOMATIC,
      destination: 'WALLET',
      evaluationPeriod: EVALUATION_PERIOD.MONTHLY,
      startDate: startOfMonth,
      endDate: endOfMonth,
      budget: { totalBudget: 10000, usedBudget: 0, maxRewardPerVendor: 2500 },
      businessRules: {
        targetType: 'BOOKING_COUNT',
        rewardType: 'TIERED',
        tierPolicy: 'HIGHEST_TIER_ONLY',
        tiers: [
          { tierNumber: 1, targetValue: 2, rewardAmount: 200, label: 'Bronze Tier' },
          { tierNumber: 2, targetValue: 5, rewardAmount: 600, label: 'Silver Tier' },
          { tierNumber: 3, targetValue: 10, rewardAmount: 1500, label: 'Gold Tier' }
        ]
      },
      eligibility: { verifiedOnly: false },
      createdBy: testAdmin._id
    });
    assert(validBizCampaign.businessRules.tiers.length === 3, 'Business campaign created with 3 tiered milestones');

    // TEST 3: Seed Completed Bookings & Reviews for Evaluation
    console.log('\n--- TEST GROUP 3: Metric Calculation & Performance Qualification ---');
    await Booking.deleteMany({ laborId: testVendor._id });
    await Review.deleteMany({ revieweeId: testVendor._id });

    // Create 3 completed bookings
    const subcatId = new mongoose.Types.ObjectId();
    const servId = new mongoose.Types.ObjectId();
    for (let i = 0; i < 3; i++) {
      await Booking.create({
        userId: testCustomer._id,
        laborId: testVendor._id,
        subcategoryId: subcatId,
        serviceId: servId,
        type: 'INSTANT',
        basePrice: 1200,
        totalAmount: 1200,
        laborShare: 1000,
        paymentMethod: 'ONLINE',
        address: { locationText: 'Sector 62, Noida' },
        pricing: { finalTotal: 1200 },
        status: 'COMPLETED',
        paymentStatus: 'PAID',
        completedAt: now,
        createdAt: now
      });
    }

    // Create 2 5-star reviews
    for (let i = 0; i < 2; i++) {
      await Review.create({
        bookingId: new mongoose.Types.ObjectId(),
        revieweeId: testVendor._id,
        reviewerId: testCustomer._id,
        rating: 5.0,
        comment: 'Outstanding and reliable service!',
        createdAt: now
      });
    }

    // Run evaluation for performance campaign
    const evalReward1 = await evaluateVendorCampaign(validPerfCampaign, testVendor);
    assert(evalReward1.status === VENDOR_REWARD_STATUS.PENDING_APPROVAL, 'Vendor qualified for Performance Award with status PENDING_APPROVAL');
    assert(evalReward1.rewardAmount === 500, 'Reward amount snapshot recorded accurately as ₹500');
    assert(evalReward1.qualificationEvidence.criteriaSnapshots.averageRating === 5.0, 'Engine correctly calculated 5.0 average rating');
    assert(evalReward1.qualificationEvidence.criteriaSnapshots.completedBookings === 3, 'Engine correctly calculated 3 completed bookings');

    // TEST 4: Admin Approval & Financial Wallet Crediting
    console.log('\n--- TEST GROUP 4: Admin Approval & Atomic Wallet Credit ---');
    const approveResult = await approveVendorReward(evalReward1._id, testAdmin);
    assert(approveResult.success === true, 'approveVendorReward executed successfully');
    assert(approveResult.vendorReward.status === VENDOR_REWARD_STATUS.CREDITED, 'Reward approved and successfully CREDITED to vendor wallet');
    assert(approveResult.vendorReward.creditDetails.walletTransactionId != null, 'Credit transaction ID attached to VendorReward record');

    const vendorWallet = await Wallet.findOne({ userId: testVendor._id });
    assert(vendorWallet != null && vendorWallet.balance >= 500, 'Existing Wallet balance credited atomically (+₹500)');

    const walletTxn = await WalletTransaction.findOne({
      userId: testVendor._id,
      context: 'INCENTIVE',
      amount: 500
    });
    assert(walletTxn != null, 'WalletTransaction recorded with context: INCENTIVE and reference to VendorReward');

    // TEST 5: Business Tier Evaluation (Automatic Mode)
    console.log('\n--- TEST GROUP 5: Business Tiered Qualification & Auto-Credit ---');
    const evalReward2 = await evaluateVendorCampaign(validBizCampaign, testVendor);
    assert(evalReward2.status === VENDOR_REWARD_STATUS.CREDITED, 'AUTO_CREDIT campaign automatically credited reward to vendor wallet');
    assert(evalReward2.rewardAmount === 200, 'Bronze tier (2 jobs reached, actual 3) credited ₹200');

    // TEST 6: Idempotency & Duplicate Credit Prevention
    console.log('\n--- TEST GROUP 6: Idempotency & Duplicate Claim Safeguards ---');
    const prevBalance = (await Wallet.findOne({ userId: testVendor._id })).balance;
    const reEvalReward2 = await evaluateVendorCampaign(validBizCampaign, testVendor);
    const vendorWalletAfter = await Wallet.findOne({ userId: testVendor._id });
    assert(vendorWalletAfter.balance === prevBalance, 'Duplicate evaluation did not duplicate wallet balance credit');
    assert(reEvalReward2.status === VENDOR_REWARD_STATUS.CREDITED, 'Idempotent response returned existing credited status');

    // TEST 7: Budget Exhaustion Safeguard
    console.log('\n--- TEST GROUP 7: Budget Limit & Exhaustion Enforcement ---');
    const budgetCampaign = await RewardCampaign.create({
      code: 'TEST_BUDGET_CAP',
      name: 'Test Capped Budget Campaign',
      category: REWARD_CATEGORY.BUSINESS,
      status: CAMPAIGN_STATUS.ACTIVE,
      approvalMode: APPROVAL_MODE.AUTOMATIC,
      destination: 'WALLET',
      evaluationPeriod: EVALUATION_PERIOD.MONTHLY,
      startDate: startOfMonth,
      endDate: endOfMonth,
      budget: { totalBudget: 500, usedBudget: 500, maxRewardPerVendor: 500 }, // Exhausted
      businessRules: {
        targetType: 'BOOKING_COUNT',
        rewardType: 'FIXED',
        targetThreshold: 1,
        fixedAmount: 500
      },
      eligibility: { verifiedOnly: false },
      createdBy: testAdmin._id
    });

    const budgetEval = await evaluateVendorCampaign(budgetCampaign, testVendor);
    assert(budgetEval.qualificationEvidence?.notes?.includes('exhausted'), 'Campaign handled budget exhaustion safely without unbacked wallet credit');

    // TEST 8: Full Scheduled Reconciliation Job
    console.log('\n--- TEST GROUP 8: Automated Cron Reconciliation Test ---');
    const reconResults = await reconcileAllActiveCampaigns();
    assert(reconResults.reconciled === true, 'Automated reconciliation job executed successfully across active campaigns');
    assert(reconResults.evaluatedCampaignsCount > 0, `Evaluated ${reconResults.evaluatedCampaignsCount} active campaigns (${reconResults.vendorsProcessed} vendor evaluations)`);

    console.log(`\n========================================`);
    console.log(`🎉 ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
    console.log(`========================================\n`);

    // Clean up test documents
    await RewardCampaign.deleteMany({ code: { $regex: /^TEST_/ } });
    await VendorReward.deleteMany({ vendorId: testVendor._id });
    await Booking.deleteMany({ userId: testCustomer._id });
    await Review.deleteMany({ reviewerId: testCustomer._id });
    await User.deleteMany({ email: { $in: ['test_reward_vendor@appzeto.com', 'test_reward_customer@appzeto.com', 'test_admin_reward@appzeto.com'] } });
    await Wallet.deleteMany({ userId: testVendor._id });
    await WalletTransaction.deleteMany({ userId: testVendor._id });

    process.exit(0);
  } catch (err) {
    console.error('❌ Test suite encountered an error:', err);
    process.exit(1);
  }
}

runTests();
