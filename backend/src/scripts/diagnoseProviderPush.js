/**
 * Diagnose why a service provider is not receiving booking push notifications.
 *
 * Usage:
 *   node src/scripts/diagnoseProviderPush.js <10-digit-phone>          # read-only + FCM dry-run
 *   node src/scripts/diagnoseProviderPush.js <10-digit-phone> --send   # also sends a REAL test booking push
 *
 * Dry-run asks Firebase to validate each token WITHOUT delivering anything to the device.
 */
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../../.env') })

const { User } = await import('../models/User.js')
const { getFirebaseAdmin } = await import('../config/firebase.js')

const phone = String(process.argv[2] || '').replace(/\D/g, '').slice(-10)
const shouldSend = process.argv.includes('--send')

if (phone.length !== 10) {
  console.error('Usage: node src/scripts/diagnoseProviderPush.js <10-digit-phone> [--send]')
  process.exit(1)
}

const short = (t) => (t ? `${t.slice(0, 12)}…${t.slice(-8)} (len ${t.length})` : '(empty)')

await mongoose.connect(process.env.MONGODB_URI)

try {
  const user = await User.findOne({ phone }).lean()
  if (!user) {
    console.log(`❌ No user found with phone ${phone}`)
    process.exit(0)
  }

  const lp = user.labourProfile || {}
  const todayName = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'long' }).format(new Date())
  const todaySchedule = (lp.schedule || []).find((s) => s.day === todayName)

  console.log('================ ACCOUNT ================')
  console.log('userId              :', String(user._id))
  console.log('role                :', user.role)
  console.log('isActive            :', user.isActive)
  console.log('vendorStatus        :', user.vendorStatus)
  console.log('availabilityStatus  :', lp.availabilityStatus)
  console.log(`schedule (${todayName}) :`, todaySchedule ? JSON.stringify(todaySchedule) : '(none)')
  console.log('location            :', lp.currentLatitude, lp.currentLongitude, 'updated', lp.lastLocationUpdatedAt)
  console.log('serviceIds count    :', (lp.serviceIds || []).length)

  const web = Array.isArray(user.fcmTokens) ? user.fcmTokens : []
  const mobile = Array.isArray(user.fcmTokenMobile) ? user.fcmTokenMobile : []
  const all = [...new Set([...mobile, ...web])]

  console.log('\n================ TOKENS ================')
  console.log(`fcmTokenMobile (${mobile.length}):`)
  mobile.forEach((t, i) => console.log(`  [${i}] ${short(t)}`))
  console.log(`fcmTokens (${web.length}):`)
  web.forEach((t, i) => console.log(`  [${i}] ${short(t)}${mobile.includes(t) ? '  (also in mobile)' : ''}`))

  if (all.length === 0) {
    console.log('\n❌ No tokens saved for this account → backend has nowhere to send the push.')
  }

  const admin = getFirebaseAdmin()
  console.log('\n================ FCM DRY-RUN (nothing delivered) ================')
  for (const token of all) {
    try {
      await admin.messaging().send(
        { token, notification: { title: 'dry-run', body: 'dry-run' }, android: { priority: 'high' } },
        true,
      )
      console.log(`  ✅ VALID   ${short(token)}`)
    } catch (err) {
      console.log(`  ❌ INVALID ${short(token)} → ${err.code || ''} ${err.message}`)
    }
  }

  if (shouldSend) {
    const { sendNotificationToUser } = await import('../utils/pushNotificationHelper.js')
    console.log('\n================ REAL TEST PUSH ================')
    const result = await sendNotificationToUser(user._id, {
      title: 'Test Booking ⚡',
      body: 'Diagnostic push – if you see this with the app closed, push works.',
      isBookingOffer: true,
      data: { type: 'NEW_BOOKING', bookingId: `diag_${Date.now()}`, isBookingAlert: 'true' },
    })
    console.log(result)
  }
} finally {
  await mongoose.disconnect()
}
