import 'dotenv/config'
import { connectDb } from '../config/db.js'
import { TrialConfiguration } from '../models/TrialConfiguration.js'
import { VendorTrial, VENDOR_TRIAL_STATUS } from '../models/VendorTrial.js'
import { User } from '../models/User.js'

async function run() {
  await connectDb()

  // Set default_trial_config freeTrialCount to 1 (as configured by user)
  const config = await TrialConfiguration.findOneAndUpdate(
    { configKey: 'default_trial_config' },
    { $set: { freeTrialCount: 1 } },
    { new: true, upsert: true }
  )

  console.log('Global Config updated to freeTrialCount:', config?.freeTrialCount)

  const activeStatuses = [
    VENDOR_TRIAL_STATUS.NOT_STARTED,
    VENDOR_TRIAL_STATUS.TRIAL_ACTIVE,
    VENDOR_TRIAL_STATUS.TRIAL_PAUSED,
    VENDOR_TRIAL_STATUS.WARNING,
    VENDOR_TRIAL_STATUS.ADMIN_REVIEW_REQUIRED,
  ]

  const result = await VendorTrial.updateMany(
    { status: { $in: activeStatuses } },
    { $set: { configuredTrialCount: 1 } }
  )

  console.log('Updated active VendorTrials configuredTrialCount to 1:', result)

  const allTrials = await VendorTrial.find().populate('vendorId', 'fullName phone').lean()
  console.log('All VendorTrials after sync:')
  for (const t of allTrials) {
    console.log(`- ${t.vendorId?.fullName || 'Vendor'}: status=${t.status}, progress=${t.completedTrialCount}/${t.configuredTrialCount}`)
  }

  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
