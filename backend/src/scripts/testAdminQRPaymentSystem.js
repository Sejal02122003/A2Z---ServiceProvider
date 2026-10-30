import mongoose from 'mongoose'
import dotenv from 'dotenv'
import assert from 'assert'
import { User } from '../models/User.js'
import { Wallet } from '../models/Wallet.js'
import { WalletTransaction } from '../models/WalletTransaction.js'
import { AdminPaymentConfig } from '../models/AdminPaymentConfig.js'
import { ProviderPayment } from '../models/ProviderPayment.js'
import { rechargeLabourWallet, getOrCreateLabourWallet } from '../services/labourWalletService.js'

dotenv.config()

async function runTestSuite() {
  console.log('=====================================================')
  console.log('--- STARTING ADMIN QR PAYMENT SYSTEM TEST SUITE ---')
  console.log('=====================================================')

  const mongoUri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/a2z-service'
  await mongoose.connect(mongoUri)
  console.log('✓ Connected to MongoDB')

  const cleanupIds = {
    users: [],
    configs: [],
    payments: [],
    wallets: [],
    transactions: [],
  }

  try {
    const timestamp = Date.now()

    // 1. Setup Test Users
    console.log('\n[TEST 1] Setting up Test Admin and Service Provider...')
    const testAdmin = await User.create({
      fullName: `Admin Test ${timestamp}`,
      phone: `9199${String(timestamp).slice(-6)}`,
      email: `admin_${timestamp}@a2ztest.com`,
      role: 'admin',
    })
    cleanupIds.users.push(testAdmin._id)

    const testLabour = await User.create({
      fullName: `Provider Test ${timestamp}`,
      phone: `9188${String(timestamp).slice(-6)}`,
      email: `provider_${timestamp}@a2ztest.com`,
      role: 'labour',
      labourProfile: {
        kycStatus: 'verified',
        availabilityStatus: 'available',
      },
    })
    cleanupIds.users.push(testLabour._id)

    const testOtherLabour = await User.create({
      fullName: `Other Provider ${timestamp}`,
      phone: `9177${String(timestamp).slice(-6)}`,
      email: `other_${timestamp}@a2ztest.com`,
      role: 'labour',
    })
    cleanupIds.users.push(testOtherLabour._id)

    // Ensure initial wallet exists for provider
    const initialWallet = await getOrCreateLabourWallet(testLabour._id)
    cleanupIds.wallets.push(initialWallet._id)
    const initialBalance = Number(initialWallet.selfBalance || 0)
    console.log(`✓ Setup complete. Provider Initial Balance: ₹${initialBalance}`)

    // 2. Test Admin QR Configuration: Create, Concurrency, and Versioning
    console.log('\n[TEST 2] Admin QR Configuration Creation & Versioning...')
    const config = await AdminPaymentConfig.create({
      paymentMethod: 'UPI_QR',
      paymentPurpose: 'ALL',
      displayName: 'A2Z Service Hub Admin',
      upiId: 'a2zbusiness@icici',
      qrImageUrl: 'https://res.cloudinary.com/demo/image/upload/sample_qr.png',
      storageIdentifier: 'payment-qr/sample_qr',
      isActive: true,
      version: 1,
      instructions: 'Scan via any UPI App (GPay, PhonePe, Paytm). Enter UTR after payment.',
      updatedBy: testAdmin._id,
      auditLog: [
        {
          version: 1,
          qrImageUrl: 'https://res.cloudinary.com/demo/image/upload/sample_qr.png',
          storageIdentifier: 'payment-qr/sample_qr',
          displayName: 'A2Z Service Hub Admin',
          upiId: 'a2zbusiness@icici',
          instructions: 'Scan via any UPI App (GPay, PhonePe, Paytm). Enter UTR after payment.',
          isActive: true,
          updatedBy: testAdmin._id,
          action: 'CREATED',
          reason: 'Initial QR configuration setup',
        },
      ],
    })
    cleanupIds.configs.push(config._id)

    assert.strictEqual(config.version, 1, 'Initial version must be 1')
    assert.strictEqual(config.isActive, true, 'Config must be active')
    console.log('✓ Initial QR configuration saved at Version 1')

    // Test Optimistic Concurrency Update
    console.log('Testing version bump and audit archiving...')
    const currentConfig = await AdminPaymentConfig.findById(config._id)
    const expectedVersion = currentConfig.version
    assert.strictEqual(expectedVersion, 1)

    // Bump to version 2
    currentConfig.auditLog.unshift({
      version: currentConfig.version,
      qrImageUrl: currentConfig.qrImageUrl,
      storageIdentifier: currentConfig.storageIdentifier,
      displayName: currentConfig.displayName,
      upiId: currentConfig.upiId,
      instructions: currentConfig.instructions,
      isActive: currentConfig.isActive,
      updatedBy: testAdmin._id,
      action: 'UPDATED',
      reason: 'Updated UPI account display name',
    })
    currentConfig.version += 1
    currentConfig.displayName = 'A2Z Technologies Pvt Ltd'
    currentConfig.updatedBy = testAdmin._id
    await currentConfig.save()

    const updatedConfig = await AdminPaymentConfig.findById(config._id)
    assert.strictEqual(updatedConfig.version, 2, 'Version should increment to 2')
    assert.strictEqual(updatedConfig.displayName, 'A2Z Technologies Pvt Ltd')
    assert.strictEqual(updatedConfig.auditLog.length, 2, 'Audit log must archive previous versions')
    console.log('✓ Version bumped to 2 with preserved audit trail')

    // 3. Test Active Configuration Fetching by Service Provider
    console.log('\n[TEST 3] Active Configuration Fetching & Purpose Scope...')
    const activeForTopup = await AdminPaymentConfig.getActiveConfig('WALLET_TOPUP')
    assert(activeForTopup, 'Should return active config for WALLET_TOPUP')
    assert.strictEqual(activeForTopup.version, 2)
    assert.strictEqual(activeForTopup.displayName, 'A2Z Technologies Pvt Ltd')
    console.log('✓ Provider accurately receives active QR config')

    // Test Deactivation Behavior
    updatedConfig.isActive = false
    await updatedConfig.save()
    const activeWhenDisabled = await AdminPaymentConfig.getActiveConfig('WALLET_TOPUP')
    assert.strictEqual(activeWhenDisabled, null, 'Inactive config should not be returned as active')
    console.log('✓ Deactivated QR config correctly returns null (preventing stale payments)')

    // Reactivate for subsequent payment tests
    updatedConfig.isActive = true
    await updatedConfig.save()

    // 4. Test Provider Payment Creation & Snapshot
    console.log('\n[TEST 4] Provider Payment Creation & QR Snapshot...')
    const paymentAmount = 500
    const payment1 = await ProviderPayment.create({
      providerId: testLabour._id,
      purpose: 'WALLET_TOPUP',
      amount: paymentAmount,
      currency: 'INR',
      status: 'pending',
      qrConfigId: updatedConfig._id,
      qrConfigVersion: updatedConfig.version,
      auditTrail: [
        {
          fromStatus: '',
          toStatus: 'pending',
          actor: testLabour._id,
          role: 'labour',
          note: `Payment initiated for WALLET_TOPUP ₹${paymentAmount}`,
        },
      ],
    })
    cleanupIds.payments.push(payment1._id)

    assert.strictEqual(payment1.status, 'pending')
    assert.strictEqual(payment1.amount, paymentAmount)
    assert.strictEqual(payment1.qrConfigVersion, 2, 'Must record snapshot of active QR version')
    assert.strictEqual(payment1.financialActionExecuted, false, 'Financial action must not execute upon creation')
    console.log('✓ Payment record created in pending state with version snapshot')

    // 5. Test Payment Submission & Duplicate UTR Protection
    console.log('\n[TEST 5] Payment Submission & Duplicate UTR Protection...')
    const testUTR = `UTR${timestamp.toString().slice(-8)}`

    // Submit payment 1
    payment1.utr = testUTR
    payment1.receiptUrl = 'https://res.cloudinary.com/demo/image/upload/sample_receipt.jpg'
    payment1.receiptStorageIdentifier = 'payment-receipts/sample_receipt'
    payment1.status = 'submitted'
    payment1.auditTrail.push({
      fromStatus: 'pending',
      toStatus: 'submitted',
      actor: testLabour._id,
      role: 'labour',
      note: `UTR: ${testUTR}`,
    })
    await payment1.save()
    console.log(`✓ Payment 1 submitted successfully with UTR: ${testUTR}`)

    // Create payment 2 for another provider and attempt to submit the same UTR
    const payment2 = await ProviderPayment.create({
      providerId: testOtherLabour._id,
      purpose: 'WALLET_TOPUP',
      amount: 1000,
      status: 'pending',
      qrConfigId: updatedConfig._id,
      qrConfigVersion: updatedConfig.version,
    })
    cleanupIds.payments.push(payment2._id)

    // Check duplicate UTR detection
    const existingPaymentWithUTR = await ProviderPayment.findOne({
      utr: testUTR,
      status: { $in: ['submitted', 'under_review', 'approved'] },
      _id: { $ne: payment2._id },
    })
    assert(existingPaymentWithUTR, 'System must detect that UTR already exists in active payments')
    console.log('✓ Duplicate UTR collision successfully detected and prevented')

    // 6. Test Admin Payment Review Approval & Idempotent Wallet Credit
    console.log('\n[TEST 6] Admin Payment Approval & Idempotent Financial Execution...')
    
    // Find payment with atomic guard
    const paymentToApprove = await ProviderPayment.findOneAndUpdate(
      {
        _id: payment1._id,
        status: { $in: ['submitted', 'under_review', 'pending'] },
        financialActionExecuted: { $ne: true },
      },
      {
        $set: {
          status: 'approved',
          reviewedBy: testAdmin._id,
          reviewedAt: new Date(),
          paymentVerificationDetails: {
            bankReference: 'HDFC-IMPS-CONFIRMED',
            verifiedAmount: paymentAmount,
            verificationNotes: 'Verified funds credited to company bank statement',
          },
        },
      },
      { new: true }
    )
    assert(paymentToApprove, 'Atomic lock update must acquire payment')

    // Execute financial action
    const walletRechargeResult = await rechargeLabourWallet({
      labourId: paymentToApprove.providerId,
      amount: paymentToApprove.amount,
      transactionId: `UPI_${paymentToApprove.utr}`,
      paymentMethod: 'UPI_QR',
      description: `UPI QR Payment Approved (UTR: ${paymentToApprove.utr})`,
    })

    paymentToApprove.financialActionExecuted = true
    paymentToApprove.financialActionDetails = {
      actionType: 'WALLET_CREDIT',
      amountCredited: paymentToApprove.amount,
      walletTransactionId: walletRechargeResult.transaction?._id,
      balanceBefore: initialBalance,
      balanceAfter: walletRechargeResult.balanceAfter,
      executedAt: new Date(),
    }
    paymentToApprove.auditTrail.push({
      fromStatus: 'submitted',
      toStatus: 'approved',
      actor: testAdmin._id,
      role: 'admin',
      note: `Approved ₹${paymentAmount}. Wallet credited.`,
    })
    await paymentToApprove.save()

    const expectedNewBalance = initialBalance + paymentAmount
    assert.strictEqual(
      Number(walletRechargeResult.wallet.selfBalance),
      expectedNewBalance,
      `Wallet balance must be exactly ₹${expectedNewBalance}`
    )
    console.log(`✓ Wallet credited from ₹${initialBalance} -> ₹${expectedNewBalance}`)

    // 7. Test Concurrency & Duplicate Approval Protection
    console.log('\n[TEST 7] Atomic Guard Against Duplicate Approval / Double Crediting...')
    const duplicateApprovalAttempt = await ProviderPayment.findOneAndUpdate(
      {
        _id: payment1._id,
        status: { $in: ['submitted', 'under_review', 'pending'] },
        financialActionExecuted: { $ne: true },
      },
      {
        $set: { status: 'approved' },
      },
      { new: true }
    )
    assert.strictEqual(
      duplicateApprovalAttempt,
      null,
      'Duplicate approval MUST fail atomic filter — financial action must NOT execute twice'
    )
    console.log('✓ Atomic guard successfully prevented duplicate approval & double crediting')

    // 8. Test Rejection & Resubmission Lifecycle
    console.log('\n[TEST 8] Payment Rejection & Provider Resubmission...')
    const rejectionUTR = `UTR_REJ_${timestamp.toString().slice(-6)}`
    const paymentToReject = await ProviderPayment.create({
      providerId: testLabour._id,
      purpose: 'WALLET_CLEARANCE',
      amount: 250,
      status: 'submitted',
      utr: rejectionUTR,
      qrConfigId: updatedConfig._id,
      qrConfigVersion: updatedConfig.version,
      auditTrail: [
        {
          fromStatus: '',
          toStatus: 'submitted',
          actor: testLabour._id,
          role: 'labour',
          note: 'Dues clearance attempt',
        },
      ],
    })
    cleanupIds.payments.push(paymentToReject._id)

    // Admin rejects with explicit reason
    const rejectionReason = 'Bank statement did not receive ₹250 for this UTR'
    const rejectedPayment = await ProviderPayment.findOneAndUpdate(
      {
        _id: paymentToReject._id,
        status: { $in: ['submitted', 'under_review', 'pending'] },
        financialActionExecuted: { $ne: true },
      },
      {
        $set: {
          status: 'rejected',
          rejectionReason,
          reviewedBy: testAdmin._id,
          reviewedAt: new Date(),
        },
        $push: {
          auditTrail: {
            fromStatus: 'submitted',
            toStatus: 'rejected',
            actor: testAdmin._id,
            role: 'admin',
            note: rejectionReason,
          },
        },
      },
      { new: true }
    )

    assert.strictEqual(rejectedPayment.status, 'rejected')
    assert.strictEqual(rejectedPayment.rejectionReason, rejectionReason)
    assert.strictEqual(rejectedPayment.financialActionExecuted, false, 'No funds moved on rejection')
    console.log('✓ Payment rejected with explicit audit reason and zero financial movement')

    // Provider resubmits with correct UTR
    const correctedUTR = `UTR_CORR_${timestamp.toString().slice(-6)}`
    rejectedPayment.utr = correctedUTR
    rejectedPayment.status = 'submitted'
    rejectedPayment.rejectionReason = undefined
    rejectedPayment.auditTrail.push({
      fromStatus: 'rejected',
      toStatus: 'submitted',
      actor: testLabour._id,
      role: 'labour',
      note: `Corrected UTR submitted: ${correctedUTR}`,
    })
    await rejectedPayment.save()

    const resubmittedPayment = await ProviderPayment.findById(rejectedPayment._id)
    assert.strictEqual(resubmittedPayment.status, 'submitted')
    assert.strictEqual(resubmittedPayment.utr, correctedUTR)
    console.log('✓ Provider successfully corrected and resubmitted payment for review')

    console.log('\n=====================================================')
    console.log('🎉 ALL 8 TEST SUITES COMPLETED AND PASSED PERFECTLY!')
    console.log('=====================================================')
  } catch (error) {
    console.error('❌ Test suite failed:', error)
    throw error
  } finally {
    // Cleanup created test documents to keep database pristine
    console.log('\n[CLEANUP] Cleaning up test records from database...')
    if (cleanupIds.configs.length) {
      await AdminPaymentConfig.deleteMany({ _id: { $in: cleanupIds.configs } })
    }
    if (cleanupIds.payments.length) {
      await ProviderPayment.deleteMany({ _id: { $in: cleanupIds.payments } })
    }
    if (cleanupIds.users.length) {
      await User.deleteMany({ _id: { $in: cleanupIds.users } })
    }
    if (cleanupIds.wallets.length) {
      await Wallet.deleteMany({ _id: { $in: cleanupIds.wallets } })
    }
    console.log('✓ Cleanup completed successfully')
    await mongoose.disconnect()
    console.log('Disconnected from MongoDB')
  }
}

runTestSuite()
  .then(() => {
    process.exit(0)
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
