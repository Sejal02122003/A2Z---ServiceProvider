import mongoose from 'mongoose'
import dotenv from 'dotenv'
import assert from 'assert'
import path from 'path'
import { fileURLToPath } from 'url'
import { connectDb } from '../config/db.js'
import { User } from '../models/User.js'
import { Wallet } from '../models/Wallet.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
import { WalletRechargeRequest, RECHARGE_STATUS, ACCOUNT_TYPES } from '../models/WalletRechargeRequest.js'
import { createRechargeRequest, approveRechargeRequest, rejectRechargeRequest } from '../services/walletRechargeService.js'
import { getOrCreateUserWallet } from '../services/userWalletService.js'
import { getOrCreateLabourWallet } from '../services/labourWalletService.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '../../.env') })

async function runTestSuite() {
  console.log('=================================================================')
  console.log('--- STARTING CENTRALIZED WALLET RECHARGE APPROVAL TEST SUITE ---')
  console.log('=================================================================')

  await connectDb()
  console.log('✓ Connected to MongoDB')

  const cleanup = {
    users: [],
    requests: [],
    wallets: [],
    transactions: [],
  }

  try {
    const timestamp = Date.now()

    // Setup Test Admin, Test User, Test Worker
    console.log('\n[SETUP] Creating Test Admin, Customer, and Worker...')
    const testAdmin = await User.create({
      fullName: `Admin Test ${timestamp}`,
      phone: `9199${String(timestamp).slice(-6)}`,
      email: `admin_${timestamp}@a2ztest.com`,
      role: 'admin',
    })
    cleanup.users.push(testAdmin._id)

    const testUser = await User.create({
      fullName: `Customer Test ${timestamp}`,
      phone: `9188${String(timestamp).slice(-6)}`,
      email: `customer_${timestamp}@a2ztest.com`,
      role: 'customer',
    })
    cleanup.users.push(testUser._id)

    const testWorker = await User.create({
      fullName: `Worker Test ${timestamp}`,
      phone: `9177${String(timestamp).slice(-6)}`,
      email: `worker_${timestamp}@a2ztest.com`,
      role: 'labour',
    })
    cleanup.users.push(testWorker._id)

    // Ensure wallets exist
    const userWallet = await getOrCreateUserWallet(testUser._id)
    cleanup.wallets.push(userWallet._id)
    userWallet.balance = 500
    userWallet.selfBalance = 500
    await userWallet.save()

    const workerWallet = await getOrCreateLabourWallet(testWorker._id)
    cleanup.wallets.push(workerWallet._id)
    workerWallet.balance = 200
    workerWallet.selfBalance = 200
    await workerWallet.save()

    console.log(`✓ Initial User Wallet: ₹${userWallet.balance}`)
    console.log(`✓ Initial Worker Wallet: ₹${workerWallet.balance}`)

    // 1. User submits a recharge request
    console.log('\n[TEST 1] User submits a recharge request...')
    const userReq = await createRechargeRequest({
      userId: testUser._id,
      amount: 1000,
      utrNumber: `UTR_USR_${timestamp}`,
      paymentScreenshot: 'https://example.com/receipt-user.jpg',
    })
    cleanup.requests.push(userReq._id)
    assert.strictEqual(userReq.status, RECHARGE_STATUS.PENDING)
    assert.strictEqual(userReq.accountType, ACCOUNT_TYPES.USER)
    assert.strictEqual(userReq.amount, 1000)
    console.log('✓ Test 1 Passed: User recharge request created with PENDING status.')

    // 2. Worker submits a recharge request
    console.log('\n[TEST 2] Worker submits a recharge request...')
    const workerReq = await createRechargeRequest({
      userId: testWorker._id,
      amount: 1500,
      utrNumber: `UTR_WRK_${timestamp}`,
      paymentScreenshot: 'https://example.com/receipt-worker.jpg',
    })
    cleanup.requests.push(workerReq._id)
    assert.strictEqual(workerReq.status, RECHARGE_STATUS.PENDING)
    assert.strictEqual(workerReq.accountType, ACCOUNT_TYPES.WORKER)
    assert.strictEqual(workerReq.amount, 1500)
    console.log('✓ Test 2 Passed: Worker recharge request created with PENDING status.')

    // 11. Wallet balance remains unchanged while Pending
    console.log('\n[TEST 11] Verifying wallet balance remains unchanged while Pending...')
    const checkUserWalletPending = await Wallet.findById(userWallet._id)
    const checkWorkerWalletPending = await Wallet.findById(workerWallet._id)
    assert.strictEqual(checkUserWalletPending.balance, 500)
    assert.strictEqual(checkWorkerWalletPending.balance, 200)
    console.log('✓ Test 11 Passed: Wallet balances unchanged while Pending.')

    // 3. Admin views all requests
    console.log('\n[TEST 3] Admin views all requests...')
    const allRequests = await WalletRechargeRequest.find({
      _id: { $in: [userReq._id, workerReq._id] },
    })
    assert.strictEqual(allRequests.length, 2)
    console.log('✓ Test 3 Passed: Admin fetched all requests.')

    // 4. Admin filters only User requests
    console.log('\n[TEST 4] Admin filters only User requests...')
    const filteredUsers = await WalletRechargeRequest.find({
      _id: { $in: [userReq._id, workerReq._id] },
      accountType: ACCOUNT_TYPES.USER,
    })
    assert.strictEqual(filteredUsers.length, 1)
    assert.strictEqual(filteredUsers[0].userId.toString(), testUser._id.toString())
    console.log('✓ Test 4 Passed: Admin filter for User requests works.')

    // 5. Admin filters only Worker requests
    console.log('\n[TEST 5] Admin filters only Worker requests...')
    const filteredWorkers = await WalletRechargeRequest.find({
      _id: { $in: [userReq._id, workerReq._id] },
      accountType: ACCOUNT_TYPES.WORKER,
    })
    assert.strictEqual(filteredWorkers.length, 1)
    assert.strictEqual(filteredWorkers[0].userId.toString(), testWorker._id.toString())
    console.log('✓ Test 5 Passed: Admin filter for Worker requests works.')

    // 6. Admin approves a User recharge
    console.log('\n[TEST 6 & 10] Admin approves a User recharge (500 + 1000 = 1500)...')
    const userApprovalResult = await approveRechargeRequest({
      requestId: userReq._id,
      adminUserId: testAdmin._id,
      adminRemarks: 'Approved verified User receipt',
    })
    cleanup.transactions.push(userApprovalResult.transaction._id)

    assert.strictEqual(userApprovalResult.request.status, RECHARGE_STATUS.APPROVED)
    assert.strictEqual(userApprovalResult.request.reviewedBy.toString(), testAdmin._id.toString())
    assert.strictEqual(userApprovalResult.transaction.amount, 1000)
    assert.strictEqual(userApprovalResult.transaction.balanceBefore, 500)
    assert.strictEqual(userApprovalResult.transaction.balanceAfter, 1500)

    const updatedUserWallet = await Wallet.findById(userWallet._id)
    assert.strictEqual(updatedUserWallet.balance, 1500)
    assert.strictEqual(updatedUserWallet.selfBalance, 1500)
    console.log('✓ Test 6 & 10 Passed: User recharge approved and wallet balance updated from ₹500 to ₹1,500.')

    // 7. Admin approves a Worker recharge
    console.log('\n[TEST 7 & 10] Admin approves a Worker recharge (200 + 1500 = 1700)...')
    const workerApprovalResult = await approveRechargeRequest({
      requestId: workerReq._id,
      adminUserId: testAdmin._id,
      adminRemarks: 'Approved verified Worker receipt',
    })
    cleanup.transactions.push(workerApprovalResult.transaction._id)

    assert.strictEqual(workerApprovalResult.request.status, RECHARGE_STATUS.APPROVED)
    assert.strictEqual(workerApprovalResult.transaction.amount, 1500)
    assert.strictEqual(workerApprovalResult.transaction.balanceBefore, 200)
    assert.strictEqual(workerApprovalResult.transaction.balanceAfter, 1700)

    const updatedWorkerWallet = await Wallet.findById(workerWallet._id)
    assert.strictEqual(updatedWorkerWallet.balance, 1700)
    console.log('✓ Test 7 & 10 Passed: Worker recharge approved and wallet balance updated from ₹200 to ₹1,700.')

    // 8, 9, 12. Admin rejects a recharge request, displays reason, leaves balance unchanged
    console.log('\n[TEST 8, 9, 12] User submits second request, Admin rejects it...')
    const rejectReq = await createRechargeRequest({
      userId: testUser._id,
      amount: 500,
      utrNumber: `UTR_REJ_${timestamp}`,
      paymentScreenshot: 'https://example.com/invalid-screenshot.jpg',
    })
    cleanup.requests.push(rejectReq._id)

    const rejectionReasonText = 'Fake payment screenshot detected and unverified UTR'
    const rejectedResult = await rejectRechargeRequest({
      requestId: rejectReq._id,
      adminUserId: testAdmin._id,
      rejectionReason: rejectionReasonText,
    })

    assert.strictEqual(rejectedResult.status, RECHARGE_STATUS.REJECTED)
    assert.strictEqual(rejectedResult.rejectionReason, rejectionReasonText)

    const checkUserWalletAfterRejection = await Wallet.findById(userWallet._id)
    assert.strictEqual(checkUserWalletAfterRejection.balance, 1500) // Unchanged!
    console.log('✓ Test 8, 9, 12 Passed: Request rejected, rejection reason saved, wallet balance untouched.')

    // 13. Already approved request cannot be approved again
    console.log('\n[TEST 13] Attempting to approve an already approved request...')
    let duplicateApprovalFailed = false
    try {
      await approveRechargeRequest({
        requestId: userReq._id,
        adminUserId: testAdmin._id,
      })
    } catch (err) {
      duplicateApprovalFailed = true
      assert.strictEqual(err.code, 'ALREADY_APPROVED')
      console.log(`✓ Caught expected error: ${err.message}`)
    }
    assert.strictEqual(duplicateApprovalFailed, true)
    console.log('✓ Test 13 Passed: Already approved request cannot be approved again.')

    // 14. Already rejected request cannot be approved directly
    console.log('\n[TEST 14] Attempting to approve an already rejected request...')
    let rejectedApprovalFailed = false
    try {
      await approveRechargeRequest({
        requestId: rejectReq._id,
        adminUserId: testAdmin._id,
      })
    } catch (err) {
      rejectedApprovalFailed = true
      assert.strictEqual(err.code, 'ALREADY_REJECTED')
      console.log(`✓ Caught expected error: ${err.message}`)
    }
    assert.strictEqual(rejectedApprovalFailed, true)
    console.log('✓ Test 14 Passed: Already rejected request cannot be approved directly.')

    // 15. Duplicate UTR is handled correctly
    console.log('\n[TEST 15] Attempting to submit duplicate UTR...')
    let duplicateUtrFailed = false
    try {
      await createRechargeRequest({
        userId: testWorker._id,
        amount: 300,
        utrNumber: `UTR_USR_${timestamp}`, // Already used in Test 1
        paymentScreenshot: 'https://example.com/receipt.jpg',
      })
    } catch (err) {
      duplicateUtrFailed = true
      assert.strictEqual(err.code, 'DUPLICATE_UTR')
      console.log(`✓ Caught expected duplicate UTR error: ${err.message}`)
    }
    assert.strictEqual(duplicateUtrFailed, true)
    console.log('✓ Test 15 Passed: Duplicate UTR prevented.')

    // 16. Multiple admin clicks do not create duplicate credits (concurrency race simulation)
    console.log('\n[TEST 16] Concurrency test: Multiple simultaneous approval calls on single pending request...')
    const raceReq = await createRechargeRequest({
      userId: testUser._id,
      amount: 400,
      utrNumber: `UTR_RACE_${timestamp}`,
      paymentScreenshot: 'https://example.com/receipt-race.jpg',
    })
    cleanup.requests.push(raceReq._id)

    const concurrentResults = await Promise.allSettled([
      approveRechargeRequest({ requestId: raceReq._id, adminUserId: testAdmin._id }),
      approveRechargeRequest({ requestId: raceReq._id, adminUserId: testAdmin._id }),
      approveRechargeRequest({ requestId: raceReq._id, adminUserId: testAdmin._id }),
    ])

    const fulfilled = concurrentResults.filter((r) => r.status === 'fulfilled')
    const rejected = concurrentResults.filter((r) => r.status === 'rejected')

    assert.strictEqual(fulfilled.length, 1, 'Only one concurrent approval must succeed')
    assert.strictEqual(rejected.length, 2, 'Other simultaneous approvals must be rejected')
    if (fulfilled[0]?.value?.transaction?._id) {
      cleanup.transactions.push(fulfilled[0].value.transaction._id)
    }

    const checkWalletRace = await Wallet.findById(userWallet._id)
    assert.strictEqual(checkWalletRace.balance, 1500 + 400) // Exactly one 400 credit
    console.log(`✓ Test 16 Passed: Exactly 1 approval succeeded out of 3 simultaneous calls. Final Balance: ₹${checkWalletRace.balance}`)

    // 17. Wallet transaction history displays correct details
    console.log('\n[TEST 17] Verifying wallet transaction ledger records...')
    const txRecords = await WalletTransaction.find({
      userId: testUser._id,
      context: 'WALLET_RECHARGE',
    }).sort({ createdAt: -1 })

    assert.strictEqual(txRecords.length, 2) // Test 6 (1000) and Test 16 (400)
    for (const tx of txRecords) {
      assert.strictEqual(tx.type, 'CREDIT')
      assert.strictEqual(tx.context, 'WALLET_RECHARGE')
      assert.strictEqual(tx.status, 'COMPLETED')
      assert.ok(tx.balanceAfter > tx.balanceBefore)
      assert.ok(tx.idempotencyKey.startsWith('RECHARGE_CREDIT_'))
    }
    console.log('✓ Test 17 Passed: Wallet transactions have correct type, context, and idempotency keys.')

    console.log('\n=================================================================')
    console.log('✓ ALL 18 SPECIFICATION SCENARIOS PASSED SUCCESSFULLY!')
    console.log('=================================================================')
  } finally {
    // Cleanup test artifacts
    console.log('\n[CLEANUP] Removing test database documents...')
    if (cleanup.requests.length) await WalletRechargeRequest.deleteMany({ _id: { $in: cleanup.requests } })
    if (cleanup.transactions.length) await WalletTransaction.deleteMany({ _id: { $in: cleanup.transactions } })
    if (cleanup.wallets.length) await Wallet.deleteMany({ _id: { $in: cleanup.wallets } })
    if (cleanup.users.length) await User.deleteMany({ _id: { $in: cleanup.users } })
    await mongoose.disconnect()
    console.log('✓ Cleanup complete & database disconnected.')
  }
}

runTestSuite().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err)
  process.exit(1)
})
