import mongoose from 'mongoose'
import dotenv from 'dotenv'
import { User } from '../models/User.js'
import { KYC_STATUS } from '../constants/roles.js'
import { IDENTITY_STATUS } from '../constants/identityConstants.js'

dotenv.config()

export async function runIdentityBackfill() {
  console.log('[MIGRATION] Starting safe Identity Status backfill...')

  // 1. Backfill verified labours/contractors
  const verifiedResult = await User.updateMany(
    {
      $or: [
        { 'labourProfile.kycStatus': KYC_STATUS.VERIFIED },
        { 'contractorProfile.kycStatus': KYC_STATUS.VERIFIED },
      ],
      identityStatus: { $in: [null, undefined, IDENTITY_STATUS.UNVERIFIED] },
    },
    {
      $set: {
        identityStatus: IDENTITY_STATUS.VERIFIED,
      },
    }
  )
  console.log(`[MIGRATION] Backfilled verified providers: ${verifiedResult.modifiedCount}`)

  // 2. Backfill phone verified accounts
  const phoneVerifiedResult = await User.updateMany(
    {
      isPhoneVerified: true,
      identityStatus: { $in: [null, undefined, IDENTITY_STATUS.UNVERIFIED] },
    },
    {
      $set: {
        identityStatus: IDENTITY_STATUS.CONTACT_VERIFIED,
      },
    }
  )
  console.log(`[MIGRATION] Backfilled contact verified accounts: ${phoneVerifiedResult.modifiedCount}`)

  // 3. Backfill any remaining older accounts
  const remainingResult = await User.updateMany(
    {
      identityStatus: { $exists: false },
    },
    {
      $set: {
        identityStatus: IDENTITY_STATUS.UNVERIFIED,
        identityRiskScore: 0,
        identityRiskFlags: [],
      },
    }
  )
  console.log(`[MIGRATION] Backfilled remaining default unverified accounts: ${remainingResult.modifiedCount}`)

  console.log('[MIGRATION] Identity Status backfill completed successfully.')
}

if (process.argv[1]?.endsWith('backfillIdentityStatus.js')) {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/a2z-service'
  mongoose
    .connect(uri)
    .then(async () => {
      await runIdentityBackfill()
      await mongoose.disconnect()
      process.exit(0)
    })
    .catch((err) => {
      console.error('[MIGRATION ERROR]', err)
      process.exit(1)
    })
}
