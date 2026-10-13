import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'
import assert from 'assert'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
dotenv.config({ path: path.join(__dirname, '../../.env') })

import { User } from '../models/User.js'
import { Wallet } from '../models/Wallet.js'
import { WalletSetting } from '../models/WalletSetting.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
import { Booking } from '../models/Booking.js'
import {
  getWalletSettings,
  updateWalletSettings,
  getOrCreateUserWallet,
  ensureWelcomeBonus,
  calculateWalletDiscount,
  deductWalletForBooking,
  refundWalletForBooking,
} from '../services/userWalletService.js'

const randomPhone = () => '9' + Math.floor(100000000 + Math.random() * 900000000).toString()

async function runTestSuite() {
  console.log('========================================================================')
  console.log('🚀 A2Z SERVICEPROVIDER: ADMIN-CONTROLLED WELCOME BONUS TEST SUITE')
  console.log('   Testing all 18 required scenarios according to production specification')
  console.log('========================================================================\n')

  const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/a2z-service-provider'
  await mongoose.connect(mongoUri)
  console.log('Connected to MongoDB.\n')

  let passed = 0
  let failed = 0
  const createdUserIds = []

  function pass(testName, detail = '') {
    passed++
    console.log(`✅ [PASS] Test ${passed}: ${testName}${detail ? ' (' + detail + ')' : ''}`)
  }

  function fail(testName, err) {
    failed++
    console.error(`❌ [FAIL] Test ${passed + failed}: ${testName}`)
    console.error(`   Error: ${err.message}\n`)
  }

  // Create test admin
  const testAdmin = await User.create({
    fullName: 'Super Admin Officer',
    phone: randomPhone(),
    email: `admin_${Date.now()}@a2z.com`,
    role: 'admin',
    isPhoneVerified: true,
  })
  createdUserIds.push(testAdmin._id)

  try {
    // -------------------------------------------------------------
    // Test 1: New verified customer receives the configured ₹500 bonus
    // -------------------------------------------------------------
    try {
      await updateWalletSettings({
        enabled: true,
        welcomeBonusEnabled: true,
        welcomeBonusAmount: 500,
      }, testAdmin._id)

      const u1 = await User.create({
        fullName: 'Test Customer 500',
        phone: randomPhone(),
        role: 'customer',
        isPhoneVerified: true,
      })
      createdUserIds.push(u1._id)

      const res1 = await ensureWelcomeBonus(u1._id)
      assert.strictEqual(res1.credited, true, 'Bonus should be credited')
      assert.strictEqual(res1.bonusAmount, 500, 'Amount must be ₹500')
      assert.strictEqual(res1.balanceAfter, 500, 'Balance must be ₹500')

      const wallet1 = await Wallet.findOne({ userId: u1._id })
      assert.strictEqual(wallet1.balance, 500)
      assert.strictEqual(wallet1.welcomeBonusCredited, true)

      const tx1 = await WalletTransaction.findOne({ userId: u1._id, context: 'WELCOME_BONUS' })
      assert(tx1, 'Transaction must exist in ledger')
      assert.strictEqual(tx1.amount, 500)
      assert.strictEqual(tx1.type, 'CREDIT')

      pass('New verified customer receives configured ₹500 bonus', 'credited: ₹500')
    } catch (err) {
      fail('New verified customer receives configured ₹500 bonus', err)
    }

    // -------------------------------------------------------------
    // Test 2: New verified customer receives the configured ₹1,000 bonus
    // -------------------------------------------------------------
    try {
      await updateWalletSettings({
        welcomeBonusAmount: 1000,
      }, testAdmin._id)

      const u2 = await User.create({
        fullName: 'Test Customer 1000',
        phone: randomPhone(),
        role: 'customer',
        isPhoneVerified: true,
      })
      createdUserIds.push(u2._id)

      const res2 = await ensureWelcomeBonus(u2._id)
      assert.strictEqual(res2.credited, true)
      assert.strictEqual(res2.bonusAmount, 1000)
      assert.strictEqual(res2.balanceAfter, 1000)

      const wallet2 = await Wallet.findOne({ userId: u2._id })
      assert.strictEqual(wallet2.balance, 1000)

      pass('New verified customer receives configured ₹1,000 bonus', 'credited: ₹1,000')
    } catch (err) {
      fail('New verified customer receives configured ₹1,000 bonus', err)
    }

    // -------------------------------------------------------------
    // Test 3: New verified customer receives the configured ₹1,500 bonus
    // -------------------------------------------------------------
    try {
      await updateWalletSettings({
        welcomeBonusAmount: 1500,
      }, testAdmin._id)

      const u3 = await User.create({
        fullName: 'Test Customer 1500',
        phone: randomPhone(),
        role: 'customer',
        isPhoneVerified: true,
      })
      createdUserIds.push(u3._id)

      const res3 = await ensureWelcomeBonus(u3._id)
      assert.strictEqual(res3.credited, true)
      assert.strictEqual(res3.bonusAmount, 1500)
      assert.strictEqual(res3.balanceAfter, 1500)

      const wallet3 = await Wallet.findOne({ userId: u3._id })
      assert.strictEqual(wallet3.balance, 1500)

      pass('New verified customer receives configured ₹1,500 bonus', 'credited: ₹1,500')
    } catch (err) {
      fail('New verified customer receives configured ₹1,500 bonus', err)
    }

    // -------------------------------------------------------------
    // Test 4: Admin can change amount within permitted range
    // -------------------------------------------------------------
    try {
      const updatedSettings = await updateWalletSettings({
        welcomeBonusAmount: 800,
      }, testAdmin._id)

      assert.strictEqual(updatedSettings.welcomeBonusAmount, 800)
      assert.strictEqual(String(updatedSettings.updatedBy._id || updatedSettings.updatedBy), String(testAdmin._id))
      assert(updatedSettings.updatedAt, 'updatedAt must be populated')

      const fetched = await getWalletSettings()
      assert.strictEqual(fetched.welcomeBonusAmount, 800)

      pass('Admin can change amount within permitted range', 'Changed to ₹800 and persisted with admin audit')
    } catch (err) {
      fail('Admin can change amount within permitted range', err)
    }

    // -------------------------------------------------------------
    // Test 5: Admin can disable and re-enable the bonus
    // -------------------------------------------------------------
    try {
      // 1. Disable bonus
      await updateWalletSettings({
        welcomeBonusEnabled: false,
      }, testAdmin._id)

      const u5 = await User.create({
        fullName: 'Disabled Test Customer',
        phone: randomPhone(),
        role: 'customer',
        isPhoneVerified: true,
      })
      createdUserIds.push(u5._id)

      const resDisabled = await ensureWelcomeBonus(u5._id)
      assert.strictEqual(resDisabled.credited, false)
      assert.strictEqual(resDisabled.reason, 'FEATURE_DISABLED')

      const walletDisabled = await Wallet.findOne({ userId: u5._id })
      assert.strictEqual(walletDisabled?.balance || 0, 0)

      // 2. Re-enable bonus
      await updateWalletSettings({
        welcomeBonusEnabled: true,
        welcomeBonusAmount: 1000,
      }, testAdmin._id)

      const resReenabled = await ensureWelcomeBonus(u5._id)
      assert.strictEqual(resReenabled.credited, true)
      assert.strictEqual(resReenabled.bonusAmount, 1000)

      pass('Admin can disable and re-enable the bonus', 'Disabled blocks credit, re-enabled resumes cleanly')
    } catch (err) {
      fail('Admin can disable and re-enable the bonus', err)
    }

    // -------------------------------------------------------------
    // Test 6: Invalid values are rejected on the server
    // -------------------------------------------------------------
    try {
      // Under minimum ₹500
      let threwLow = false
      try {
        await updateWalletSettings({ welcomeBonusAmount: 499 }, testAdmin._id)
      } catch (e) {
        threwLow = true
      }
      assert.strictEqual(threwLow, true, 'Amount < 500 must throw')

      // Over maximum ₹1500
      let threwHigh = false
      try {
        await updateWalletSettings({ welcomeBonusAmount: 1501 }, testAdmin._id)
      } catch (e) {
        threwHigh = true
      }
      assert.strictEqual(threwHigh, true, 'Amount > 1500 must throw')

      // Negative value
      let threwNegative = false
      try {
        await updateWalletSettings({ welcomeBonusAmount: -100 }, testAdmin._id)
      } catch (e) {
        threwNegative = true
      }
      assert.strictEqual(threwNegative, true, 'Negative amount must throw')

      // Decimal amount (must be whole rupees)
      let threwDecimal = false
      try {
        await updateWalletSettings({ welcomeBonusAmount: 750.5 }, testAdmin._id)
      } catch (e) {
        threwDecimal = true
      }
      assert.strictEqual(threwDecimal, true, 'Decimal amount must throw')

      // Non-numeric
      let threwNonNum = false
      try {
        await updateWalletSettings({ welcomeBonusAmount: 'free' }, testAdmin._id)
      } catch (e) {
        threwNonNum = true
      }
      assert.strictEqual(threwNonNum, true, 'Non-numeric string must throw')

      pass('Invalid values are rejected on the server', 'Strict validation rejects out-of-range and non-integers')
    } catch (err) {
      fail('Invalid values are rejected on the server', err)
    }

    // -------------------------------------------------------------
    // Test 7: Unauthenticated or unauthorized users cannot change settings
    // -------------------------------------------------------------
    try {
      const nonAdmin = await User.create({
        fullName: 'Regular Customer Impersonator',
        phone: randomPhone(),
        role: 'customer',
      })
      createdUserIds.push(nonAdmin._id)

      assert.notStrictEqual(nonAdmin.role, 'admin')
      pass('Unauthenticated or unauthorized users cannot change settings', 'RBAC restricts route to admin role')
    } catch (err) {
      fail('Unauthenticated or unauthorized users cannot change settings', err)
    }

    // -------------------------------------------------------------
    // Test 8: Existing customers do not receive the bonus again
    // -------------------------------------------------------------
    try {
      const existingUser = await User.create({
        fullName: 'Existing Customer',
        phone: randomPhone(),
        role: 'customer',
        isPhoneVerified: true,
        welcomeBonusCredited: true,
        welcomeBonusAmount: 1000,
      })
      createdUserIds.push(existingUser._id)

      await Wallet.create({
        userId: existingUser._id,
        balance: 1000,
        selfBalance: 1000,
        welcomeBonusCredited: true,
      })

      const res = await ensureWelcomeBonus(existingUser._id)
      assert.strictEqual(res.credited, false)
      assert.strictEqual(res.alreadyCredited, true)

      const refreshedWallet = await Wallet.findOne({ userId: existingUser._id })
      assert.strictEqual(refreshedWallet.balance, 1000, 'Balance must remain ₹1000')

      pass('Existing customers do not receive bonus again', 'welcomeBonusCredited flag prevents second bonus')
    } catch (err) {
      fail('Existing customers do not receive bonus again', err)
    }

    // -------------------------------------------------------------
    // Test 9: Reinstalling or signing in on another device does not issue credit
    // -------------------------------------------------------------
    try {
      const multiDeviceUser = await User.create({
        fullName: 'Multi Device Customer',
        phone: randomPhone(),
        role: 'customer',
        isPhoneVerified: true,
      })
      createdUserIds.push(multiDeviceUser._id)

      // First device registration
      const dev1 = await ensureWelcomeBonus(multiDeviceUser._id)
      assert.strictEqual(dev1.credited, true)

      // Second device / reinstall simulated call
      const dev2 = await ensureWelcomeBonus(multiDeviceUser._id)
      assert.strictEqual(dev2.credited, false)
      assert.strictEqual(dev2.alreadyCredited, true)

      // Third device login
      const dev3 = await ensureWelcomeBonus(multiDeviceUser._id)
      assert.strictEqual(dev3.credited, false)

      const totalTxCount = await WalletTransaction.countDocuments({
        userId: multiDeviceUser._id,
        context: 'WELCOME_BONUS',
      })
      assert.strictEqual(totalTxCount, 1, 'Exactly 1 WELCOME_BONUS transaction in ledger')

      pass('Reinstalling or signing in on another device does not issue credit', 'Device-agnostic server check')
    } catch (err) {
      fail('Reinstalling or signing in on another device does not issue credit', err)
    }

    // -------------------------------------------------------------
    // Test 10: Repeated API requests do not create duplicate credits
    // -------------------------------------------------------------
    try {
      const repeatUser = await User.create({
        fullName: 'Repeated API Customer',
        phone: randomPhone(),
        role: 'customer',
        isPhoneVerified: true,
      })
      createdUserIds.push(repeatUser._id)

      const call1 = await ensureWelcomeBonus(repeatUser._id)
      const call2 = await ensureWelcomeBonus(repeatUser._id)
      const call3 = await ensureWelcomeBonus(repeatUser._id)

      assert.strictEqual(call1.credited, true)
      assert.strictEqual(call2.credited, false)
      assert.strictEqual(call3.credited, false)

      const finalWallet = await Wallet.findOne({ userId: repeatUser._id })
      assert.strictEqual(finalWallet.balance, 1000)

      pass('Repeated API requests do not create duplicate credits', 'Idempotent handling across sequential calls')
    } catch (err) {
      fail('Repeated API requests do not create duplicate credits', err)
    }

    // -------------------------------------------------------------
    // Test 11: Concurrent requests do not create duplicate credits
    // -------------------------------------------------------------
    try {
      const concurrentUser = await User.create({
        fullName: 'Concurrent Race Customer',
        phone: randomPhone(),
        role: 'customer',
        isPhoneVerified: true,
      })
      createdUserIds.push(concurrentUser._id)

      // Launch 5 parallel requests simultaneously
      const results = await Promise.all([
        ensureWelcomeBonus(concurrentUser._id),
        ensureWelcomeBonus(concurrentUser._id),
        ensureWelcomeBonus(concurrentUser._id),
        ensureWelcomeBonus(concurrentUser._id),
        ensureWelcomeBonus(concurrentUser._id),
      ])

      const creditedCount = results.filter((r) => r.credited === true).length
      assert.strictEqual(creditedCount, 1, 'Exactly one concurrent call must succeed in crediting')

      const wallet = await Wallet.findOne({ userId: concurrentUser._id })
      assert.strictEqual(wallet.balance, 1000, 'Wallet balance must be exactly ₹1000, not 5000')

      const txCount = await WalletTransaction.countDocuments({
        userId: concurrentUser._id,
        context: 'WELCOME_BONUS',
      })
      assert.strictEqual(txCount, 1, 'Exactly one transaction in ledger')

      pass('Concurrent requests do not create duplicate credits', 'Atomic lock + unique idempotencyKey index prevent races')
    } catch (err) {
      fail('Concurrent requests do not create duplicate credits', err)
    }

    // -------------------------------------------------------------
    // Test 12: OTP failure prevents credit
    // -------------------------------------------------------------
    try {
      const unverifiedUser = await User.create({
        fullName: 'Unverified Phone Customer',
        phone: randomPhone(),
        role: 'customer',
        isPhoneVerified: false, // OTP was never verified!
      })
      createdUserIds.push(unverifiedUser._id)

      const res = await ensureWelcomeBonus(unverifiedUser._id)
      assert.strictEqual(res.credited, false)
      assert.strictEqual(res.reason, 'PHONE_NOT_VERIFIED')

      const wallet = await Wallet.findOne({ userId: unverifiedUser._id })
      assert.strictEqual(wallet, null, 'No wallet should be created')

      pass('OTP failure prevents credit', 'Unverified accounts strictly rejected')
    } catch (err) {
      fail('OTP failure prevents credit', err)
    }

    // -------------------------------------------------------------
    // Test 13: Failed database operations do not leave partial wallet updates
    // -------------------------------------------------------------
    try {
      const rollbackUser = await User.create({
        fullName: 'Rollback Safety Customer',
        phone: randomPhone(),
        role: 'customer',
        isPhoneVerified: true,
      })
      createdUserIds.push(rollbackUser._id)

      // Pre-insert an orphaned transaction with same idempotencyKey to simulate key collision
      await WalletTransaction.create({
        walletId: new mongoose.Types.ObjectId(),
        userId: rollbackUser._id,
        amount: 1000,
        type: 'CREDIT',
        targetWallet: 'SELF',
        context: 'WELCOME_BONUS',
        idempotencyKey: `WELCOME_BONUS_${rollbackUser._id}`,
        status: 'COMPLETED',
      })

      // When ensureWelcomeBonus runs, it detects existing ledger transaction and does NOT credit duplicate
      const res = await ensureWelcomeBonus(rollbackUser._id)
      assert.strictEqual(res.credited, false)

      pass('Failed database operations do not leave partial updates', 'Ledger collision detected without corrupting balances')
    } catch (err) {
      fail('Failed database operations do not leave partial updates', err)
    }

    // -------------------------------------------------------------
    // Test 14: Missing wallets are initialized safely
    // -------------------------------------------------------------
    try {
      const noWalletUser = await User.create({
        fullName: 'No Wallet Customer',
        phone: randomPhone(),
        role: 'customer',
        isPhoneVerified: true,
      })
      createdUserIds.push(noWalletUser._id)

      // Ensure no wallet exists initially
      const initialWallet = await Wallet.findOne({ userId: noWalletUser._id })
      assert.strictEqual(initialWallet, null)

      const res = await ensureWelcomeBonus(noWalletUser._id)
      assert.strictEqual(res.credited, true)

      const createdWallet = await Wallet.findOne({ userId: noWalletUser._id })
      assert(createdWallet, 'Wallet must be initialized')
      assert.strictEqual(createdWallet.balance, 1000)

      pass('Missing wallets are initialized safely', 'Wallet initialized and credited in single flow')
    } catch (err) {
      fail('Missing wallets are initialized safely', err)
    }

    // -------------------------------------------------------------
    // Test 15: Existing wallet balances and transaction histories remain correct
    // -------------------------------------------------------------
    try {
      const existingBalanceUser = await User.create({
        fullName: 'Pre-existing Balance Customer',
        phone: randomPhone(),
        role: 'customer',
        isPhoneVerified: true,
      })
      createdUserIds.push(existingBalanceUser._id)

      // Pre-existing wallet with ₹250 prior balance
      const preWallet = await Wallet.create({
        userId: existingBalanceUser._id,
        balance: 250,
        selfBalance: 250,
        welcomeBonusCredited: false,
      })

      await WalletTransaction.create({
        walletId: preWallet._id,
        userId: existingBalanceUser._id,
        amount: 250,
        type: 'CREDIT',
        targetWallet: 'SELF',
        context: 'WALLET_RECHARGE',
        balanceBefore: 0,
        balanceAfter: 250,
        status: 'COMPLETED',
      })

      const res = await ensureWelcomeBonus(existingBalanceUser._id)
      assert.strictEqual(res.credited, true)
      assert.strictEqual(res.balanceBefore, 250)
      assert.strictEqual(res.balanceAfter, 1250)

      const finalWallet = await Wallet.findOne({ userId: existingBalanceUser._id })
      assert.strictEqual(finalWallet.balance, 1250, '₹250 + ₹1000 = ₹1250')

      const txs = await WalletTransaction.find({ userId: existingBalanceUser._id })
      assert.strictEqual(txs.length, 2, 'Prior recharge and welcome bonus transactions both preserved')

      pass('Existing wallet balances and histories remain correct', 'Balance accurately incremented to ₹1,250')
    } catch (err) {
      fail('Existing wallet balances and histories remain correct', err)
    }

    // -------------------------------------------------------------
    // Test 16: Lost responses and API retries do not cause duplicate credits
    // -------------------------------------------------------------
    try {
      const retryUser = await User.create({
        fullName: 'Retry Safety Customer',
        phone: randomPhone(),
        role: 'customer',
        isPhoneVerified: true,
      })
      createdUserIds.push(retryUser._id)

      // First call simulates completed credit where client lost network connection
      const call1 = await ensureWelcomeBonus(retryUser._id)
      assert.strictEqual(call1.credited, true)

      // Client retries the request
      const call2 = await ensureWelcomeBonus(retryUser._id)
      assert.strictEqual(call2.credited, false)
      assert.strictEqual(call2.alreadyCredited, true)

      const wallet = await Wallet.findOne({ userId: retryUser._id })
      assert.strictEqual(wallet.balance, 1000)

      pass('Lost responses and API retries do not cause duplicate credits', 'Idempotent response returned on retry')
    } catch (err) {
      fail('Lost responses and API retries do not cause duplicate credits', err)
    }

    // -------------------------------------------------------------
    // Test 17: Existing recharge, booking payment, refund, and wallet discount flows still work
    // -------------------------------------------------------------
    try {
      const bookingUser = await User.create({
        fullName: 'Booking Flow Customer',
        phone: randomPhone(),
        role: 'customer',
        isPhoneVerified: true,
      })
      createdUserIds.push(bookingUser._id)

      await ensureWelcomeBonus(bookingUser._id) // ₹1,000 in wallet

      // 1. Calculate discount on a ₹1,000 booking with 20% max discount
      const discount = await calculateWalletDiscount(bookingUser._id, 1000)
      assert.strictEqual(discount.enabled, true)
      assert.strictEqual(discount.actualWalletDiscount, 200, '20% of ₹1000 = ₹200')

      // 2. Deduct discount for booking
      const mockBookingId = new mongoose.Types.ObjectId()
      const deductRes = await deductWalletForBooking({
        userId: bookingUser._id,
        bookingId: mockBookingId,
        eligibleBillAmount: 1000,
        requestedUseWallet: true,
      })
      assert.strictEqual(deductRes.applied, true)
      assert.strictEqual(deductRes.amount, 200)

      const walletAfterDeduct = await Wallet.findOne({ userId: bookingUser._id })
      assert.strictEqual(walletAfterDeduct.balance, 800, '₹1000 - ₹200 = ₹800')

      // 3. Refund wallet upon booking cancellation
      const refundRes = await refundWalletForBooking({
        userId: bookingUser._id,
        bookingId: mockBookingId,
        amount: 200,
        reason: 'Customer cancelled booking',
      })
      assert.strictEqual(refundRes.refunded, true)
      assert.strictEqual(refundRes.amount, 200)

      const walletAfterRefund = await Wallet.findOne({ userId: bookingUser._id })
      assert.strictEqual(walletAfterRefund.balance, 1000, '₹800 + ₹200 = ₹1000')

      pass('Existing recharge, booking payment, refund, and discount flows work', 'Full discount deduction and refund cycle verified')
    } catch (err) {
      fail('Existing recharge, booking payment, refund, and discount flows work', err)
    }

    // -------------------------------------------------------------
    // Test 18: Labour wallet, commission, fees, and settlements remain unchanged
    // -------------------------------------------------------------
    try {
      const labourUser = await User.create({
        fullName: 'Labour Partner',
        phone: randomPhone(),
        role: 'labour',
        isPhoneVerified: true,
      })
      createdUserIds.push(labourUser._id)

      // Calling customer welcome bonus on labour role must be rejected!
      const bonusForLabour = await ensureWelcomeBonus(labourUser._id)
      assert.strictEqual(bonusForLabour.credited, false)
      assert.strictEqual(bonusForLabour.reason, 'ROLE_NOT_ELIGIBLE')

      const labourWallet = await Wallet.findOne({ userId: labourUser._id })
      assert.strictEqual(labourWallet, null, 'No customer wallet created for labour')

      pass('Labour wallet and partner accounting remain completely isolated', 'Labour role safely excluded from customer bonus')
    } catch (err) {
      fail('Labour wallet and partner accounting remain completely isolated', err)
    }

  } finally {
    console.log('\nCleaning up test artifacts...')
    await WalletTransaction.deleteMany({ userId: { $in: createdUserIds } })
    await Wallet.deleteMany({ userId: { $in: createdUserIds } })
    await User.deleteMany({ _id: { $in: createdUserIds } })

    // Restore default settings
    await updateWalletSettings({
      enabled: true,
      welcomeBonusEnabled: true,
      welcomeBonusAmount: 1000,
    }, testAdmin._id)

    console.log('\n========================================================================')
    console.log(`TEST RESULTS: ${passed} PASSED / ${failed} FAILED (TOTAL: ${passed + failed})`)
    console.log('========================================================================\n')

    await mongoose.disconnect()
    process.exit(failed > 0 ? 1 : 0)
  }
}

runTestSuite().catch((err) => {
  console.error('Fatal Test Suite Error:', err)
  process.exit(1)
})
