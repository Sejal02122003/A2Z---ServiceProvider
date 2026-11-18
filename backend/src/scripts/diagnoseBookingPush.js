/**
 * Read-only: explain why a provider did / did not get the push for a customer's recent bookings.
 *
 * Usage:
 *   node src/scripts/diagnoseBookingPush.js <customer-phone> <provider-phone> [count=3]
 */
import mongoose from 'mongoose'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(__dirname, '../../.env') })

const { User } = await import('../models/User.js')
const { Booking } = await import('../models/Booking.js')
const { InAppNotification } = await import('../models/InAppNotification.js')

const clean = (p) => String(p || '').replace(/\D/g, '').slice(-10)
const customerPhone = clean(process.argv[2])
const providerPhone = clean(process.argv[3])
const count = Number(process.argv[4] || 3)

if (customerPhone.length !== 10 || providerPhone.length !== 10) {
  console.error('Usage: node src/scripts/diagnoseBookingPush.js <customer-phone> <provider-phone> [count]')
  process.exit(1)
}

const ist = (d) => (d ? new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : '-')
const km = (lat1, lng1, lat2, lng2) => {
  const R = 6371, toRad = (x) => (x * Math.PI) / 180
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

await mongoose.connect(process.env.MONGODB_URI)
try {
  const customer = await User.findOne({ phone: customerPhone }).lean()
  const provider = await User.findOne({ phone: providerPhone }).lean()
  if (!customer || !provider) {
    console.log('Customer found:', Boolean(customer), '| Provider found:', Boolean(provider))
    process.exit(0)
  }
  const lp = provider.labourProfile || {}
  const providerServiceIds = (lp.serviceIds || []).map(String)
  const providerSubcatIds = (lp.subcategoryIds || []).map(String)

  console.log(`Customer ${customerPhone} → ${customer._id} (${customer.role})`)
  console.log(`Provider ${providerPhone} → ${provider._id} (${provider.role}), status=${lp.availabilityStatus}, tokens: mobile=${(provider.fcmTokenMobile || []).length} web=${(provider.fcmTokens || []).length}`)

  const busy = await Booking.find({
    status: { $in: ['EN_ROUTE', 'STARTED'] },
    $or: [{ acceptedLabourId: provider._id }, { laborId: provider._id }, { acceptedLabourIds: provider._id }],
    updatedAt: { $gte: new Date(Date.now() - 4 * 60 * 60 * 1000) },
  }).select('_id status updatedAt').lean()
  console.log(`Provider busy (EN_ROUTE/STARTED in last 4h → excluded from ALL broadcasts): ${busy.length ? busy.map((b) => `${b._id} ${b.status}`).join(', ') : 'no'}`)

  const bookings = await Booking.find({ userId: customer._id }).sort({ createdAt: -1 }).limit(count).lean()
  for (const b of bookings) {
    const bLng = b.address?.coordinates?.coordinates?.[0] ?? b.address?.lng ?? b.address?.longitude
    const bLat = b.address?.coordinates?.coordinates?.[1] ?? b.address?.lat ?? b.address?.latitude
    const dist = bLat && lp.currentLatitude ? km(bLat, bLng, lp.currentLatitude, lp.currentLongitude).toFixed(1) : '?'

    const svcIds = [
      b.serviceId,
      ...(b.contractorInfo?.services || []).map((s) => s.serviceId),
      ...(b.multiServiceBooking?.items || []).map((i) => i.serviceId),
      ...(b.packageBooking?.inclusions || []).map((i) => i.serviceId),
    ].filter(Boolean).map(String)
    const offers = svcIds.some((id) => providerServiceIds.includes(id)) ||
      (providerServiceIds.length === 0 && b.subcategoryId && providerSubcatIds.includes(String(b.subcategoryId)))

    const notif = await InAppNotification.findOne({ userId: provider._id, bookingId: b._id }).sort({ createdAt: 1 }).lean()
    const rejected = (b.rejectedBy || []).map(String).includes(String(provider._id))

    console.log('\n------------------------------------------------------------')
    console.log(`Booking ${b._id}  created ${ist(b.createdAt)}`)
    console.log(`  type=${b.type} status=${b.status} scheduledAt=${ist(b.scheduledAt)} slot="${b.timeSlot || ''}"`)
    console.log(`  service ids: ${svcIds.join(', ') || '(none)'} | subcategory: ${b.subcategoryId || '-'}`)
    console.log(`  provider offers this service: ${offers ? 'YES' : 'NO  ← provider is skipped'}`)
    console.log(`  distance booking↔provider: ${dist} km (radius ${b.broadcastRadius ?? '?'} km)`)
    console.log(`  eligibleLabourCount=${b.eligibleLabourCount} | provider rejected before: ${rejected}`)
    if (notif) {
      const delaySec = Math.round((new Date(notif.createdAt) - new Date(b.createdAt)) / 1000)
      console.log(`  ✅ provider job-offer record created ${ist(notif.createdAt)} (${delaySec}s after booking) → push WAS sent at that time`)
    } else {
      console.log('  ❌ NO job-offer record for provider → backend never sent this provider a push for this booking')
    }
  }
} finally {
  await mongoose.disconnect()
}
