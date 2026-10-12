import mongoose from 'mongoose'
import dotenv from 'dotenv'
import { User } from '../models/User.js'
import { KYC_STATUS } from '../constants/roles.js'
import { IDENTITY_STATUS } from '../constants/identityConstants.js'

dotenv.config()

/**
 * Migration & Backfill script for Identity Verification status.
 * Safe, idempotent, non-destructive, and supports dry-run mode.
 * 
 * Rules:
 * 1. Accounts with existing verified KYC (labour/contractor) -> VERIFIED
 * 2. Accounts with verified phone and no prior identity status -> CONTACT_VERIFIED
 * 3. Accounts missing identityStatus -> UNVERIFIED (with clean defaults)
 * 4. NEVER overwrites existing VERIFIED, REJECTED, or SUSPENDED decisions.
 */
export async function runIdentityBackfill({ isDryRun = false } = {}) {
  console.log(`\n[MIGRATION] Starting Identity Status Migration ${isDryRun ? '(DRY-RUN SIMULATION)' : '(APPLYING CHANGES)'}...`)

  // Filter 1: Existing verified providers lacking explicit VERIFIED status
  const verifiedFilter = {
    $or: [
      { 'labourProfile.kycStatus': KYC_STATUS.VERIFIED },
      { 'contractorProfile.kycStatus': KYC_STATUS.VERIFIED },
    ],
    identityStatus: { $in: [null, undefined, IDENTITY_STATUS.UNVERIFIED] },
  }

  // Filter 2: Phone-verified accounts lacking explicit status
  const phoneVerifiedFilter = {
    isPhoneVerified: true,
    identityStatus: { $in: [null, undefined, IDENTITY_STATUS.UNVERIFIED] },
    // Ensure we don't double count if they have verified KYC
    $nor: [
      { 'labourProfile.kycStatus': KYC_STATUS.VERIFIED },
      { 'contractorProfile.kycStatus': KYC_STATUS.VERIFIED },
    ],
  }

  // Filter 3: Remaining legacy accounts missing identityStatus
  const remainingFilter = {
    identityStatus: { $exists: false },
    isPhoneVerified: { $ne: true },
    $nor: [
      { 'labourProfile.kycStatus': KYC_STATUS.VERIFIED },
      { 'contractorProfile.kycStatus': KYC_STATUS.VERIFIED },
    ],
  }

  const [verifiedCount, phoneVerifiedCount, remainingCount, totalAccounts] = await Promise.all([
    User.countDocuments(verifiedFilter),
    User.countDocuments(phoneVerifiedFilter),
    User.countDocuments(remainingFilter),
    User.countDocuments({}),
  ])

  console.log(`[MIGRATION AUDIT] Total user accounts scanned: ${totalAccounts}`)
  console.log(`[MIGRATION PLAN] Verified KYC providers to mark as VERIFIED: ${verifiedCount}`)
  console.log(`[MIGRATION PLAN] Phone-verified accounts to mark as CONTACT_VERIFIED: ${phoneVerifiedCount}`)
  console.log(`[MIGRATION PLAN] Legacy unverified accounts to initialize as UNVERIFIED: ${remainingCount}`)

  if (isDryRun) {
    console.log(`\n[DRY-RUN COMPLETE] No database modifications were written to disk. Total records to change: ${verifiedCount + phoneVerifiedCount + remainingCount}`)
    return {
      isDryRun: true,
      totalScanned: totalAccounts,
      wouldModify: {
        verified: verifiedCount,
        contactVerified: phoneVerifiedCount,
        unverified: remainingCount,
        total: verifiedCount + phoneVerifiedCount + remainingCount,
      },
    }
  }

  // 1. Backfill verified labours/contractors
  const verifiedResult = await User.updateMany(verifiedFilter, {
    $set: {
      identityStatus: IDENTITY_STATUS.VERIFIED,
    },
  })
  console.log(`[MIGRATION] Updated verified providers: ${verifiedResult.modifiedCount}`)

  // 2. Backfill phone verified accounts
  const phoneVerifiedResult = await User.updateMany(phoneVerifiedFilter, {
    $set: {
      identityStatus: IDENTITY_STATUS.CONTACT_VERIFIED,
    },
  })
  console.log(`[MIGRATION] Updated contact-verified accounts: ${phoneVerifiedResult.modifiedCount}`)

  // 3. Backfill any remaining older accounts
  const remainingResult = await User.updateMany(remainingFilter, {
    $set: {
      identityStatus: IDENTITY_STATUS.UNVERIFIED,
      identityRiskScore: 0,
      identityRiskFlags: [],
    },
  })
  console.log(`[MIGRATION] Initialized remaining accounts: ${remainingResult.modifiedCount}`)

  console.log('\n[MIGRATION COMPLETE] Identity Status backfill applied successfully.\n')

  return {
    isDryRun: false,
    totalScanned: totalAccounts,
    modified: {
      verified: verifiedResult.modifiedCount,
      contactVerified: phoneVerifiedResult.modifiedCount,
      unverified: remainingResult.modifiedCount,
      total: verifiedResult.modifiedCount + phoneVerifiedResult.modifiedCount + remainingResult.modifiedCount,
    },
  }
}

if (process.argv[1]?.endsWith('backfillIdentityStatus.js')) {
  const isDryRun = process.argv.includes('--dry-run') || process.argv.includes('-d')
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/a2z-service'

  mongoose
    .connect(uri)
    .then(async () => {
      await runIdentityBackfill({ isDryRun })
      await mongoose.disconnect()
      process.exit(0)
    })
    .catch((err) => {
      console.error('[MIGRATION ERROR]', err)
      process.exit(1)
    })
}
