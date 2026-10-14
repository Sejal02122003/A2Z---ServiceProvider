import cron from 'node-cron'
import { Booking } from '../models/Booking.js'
import { WorkforceRequest } from '../models/WorkforceRequest.js'
import { startBroadcastCycle } from '../services/broadcastService.js'
import { emitToUser } from '../socket.js'
import { User } from '../models/User.js'
import { SystemSetting } from '../models/SystemSetting.js'

export function initBroadcastCron() {
  console.log('[CRON] Scheduled Broadcast Cron initialized (running every 60s).')

  // Run every minute
  cron.schedule('* * * * *', async () => {
    try {
      const now = new Date()
      const nowIST = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'medium' }).format(now)

      // Clean up stuck BROADCASTING bookings
      // If a booking has been BROADCASTING for more than 10 minutes, mark as FAILED
      const tenMinsAgo = new Date(now.getTime() - 10 * 60 * 1000)
      const stuckRes = await Booking.updateMany(
        { status: 'BROADCASTING', updatedAt: { $lt: tenMinsAgo } },
        { $set: { status: 'FAILED' } }
      )
      if (stuckRes.modifiedCount > 0) {
        console.log(`[CRON ${nowIST}] Cleaned up ${stuckRes.modifiedCount} stuck BROADCASTING bookings to FAILED`)
      }

      // 65 mins from now gives a 5-minute buffer so it reliably triggers before or exactly at the 1-hour mark
      const sixtyFiveMinsFromNow = new Date(now.getTime() + 65 * 60 * 1000)
      const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000)
      
      // Find all scheduled bookings that are in CREATED status
      // where the scheduledAt is <= exactly 65 mins from now, but > 12 hours ago
      const bookingsToBroadcast = await Booking.find({
        type: { $in: ['SCHEDULED', 'scheduled'] },
        status: { $in: ['CREATED', 'created'] },
        scheduledAt: { 
          $lte: sixtyFiveMinsFromNow,
          $gt: twelveHoursAgo
        }
      })

      // Count any future scheduled bookings still waiting (> 65 mins away)
      const futureWaitingCount = await Booking.countDocuments({
        type: { $in: ['SCHEDULED', 'scheduled'] },
        status: { $in: ['CREATED', 'created'] },
        scheduledAt: { $gt: sixtyFiveMinsFromNow }
      })

      const broadcastingCount = await Booking.countDocuments({
        type: { $in: ['SCHEDULED', 'scheduled'] },
        status: { $in: ['BROADCASTING', 'broadcasting'] }
      })

      console.log(`[CRON ${nowIST}] Broadcast Check: ${bookingsToBroadcast.length} booking(s) due (<= 65m away), ${futureWaitingCount} future booking(s) queued (${broadcastingCount} active BROADCASTING)`)

      for (const booking of bookingsToBroadcast) {
        const schedIST = new Intl.DateTimeFormat('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'short', timeStyle: 'medium' }).format(new Date(booking.scheduledAt))
        const minsLeft = Math.round((new Date(booking.scheduledAt).getTime() - now.getTime()) / 60000)
        console.log(`[CRON] >>> Triggering broadcast for booking ${booking._id}: scheduled for ${schedIST} (${minsLeft} mins from now), slot: "${booking.timeSlot}"`)
        
        // The broadcast service will change status to BROADCASTING internally
        await startBroadcastCycle(booking._id).catch(err => {
          console.error(`[CRON] Failed to broadcast booking ${booking._id}:`, err)
        })
      }

      // --- B2B WorkforceRequest Cron (3 hours before shift) ---
      // 3 hours from now
      const threeHoursFromNow = new Date(now.getTime() + 3 * 60 * 60 * 1000)
      
      // Find all approved B2B requests waiting to be broadcasted to general pool
      const b2bRequests = await WorkforceRequest.find({
        status: 'broadcasted', // Assuming admin set it to broadcasted but it hasn't actually been sent yet
        isSocketEmitted: { $ne: true }, // We need to add this flag to schema or just use it flexibly
        preferredVendorId: { $exists: false } // Only general pool
      })

      for (const req of b2bRequests) {
        if (!req.shiftStart) continue
        
        // Parse shiftStart (e.g. "09:00 AM") and combine with startDate
        const [time, modifier] = req.shiftStart.split(' ')
        let [hours, minutes] = time.split(':')
        hours = parseInt(hours, 10)
        if (hours === 12 && modifier === 'AM') hours = 0
        if (modifier === 'PM' && hours < 12) hours += 12

        const scheduledTime = new Date(req.startDate)
        scheduledTime.setHours(hours, parseInt(minutes, 10), 0, 0)

        // If scheduled time is within 3 hours from now
        if (scheduledTime <= threeHoursFromNow && scheduledTime > now) {
          console.log(`[CRON] Broadcasting B2B Request ${req._id} starting at ${scheduledTime}`)
          
          // Mark as emitted so we don't spam
          req.set('isSocketEmitted', true) // Mongoose will allow this if strict: false, or we should add to schema. Better to just update DB directly.
          await WorkforceRequest.updateOne({ _id: req._id }, { $set: { isSocketEmitted: true } })

          // Find vendors in radius
          let vendors = await User.find({
            role: 'contractor',
            isActive: true,
            'contractorProfile.verificationStatus': 'approved',
            'contractorProfile.isAcceptingRequests': { $ne: false } // Only those accepting requests
          }).lean()

          if (req.siteId) {
             // In a real scenario, we'd get site coordinates and filter by radius.
             // For now, emit to all approved vendors as fallback
          }

          vendors.forEach(vendor => {
            emitToUser(vendor._id, 'B2B_GENERAL_BROADCAST', {
              requestId: req._id,
              lines: req.lines,
              startDate: req.startDate,
              shiftStart: req.shiftStart
            })
          })
        }
      }

    } catch (err) {
      console.error('[CRON] Error running scheduled broadcast cron:', err)
    }
  })

  console.log('Scheduled Broadcast Cron initialized.')
}
