import cron from 'node-cron'
import { processDueReminders, recoverStaleLeases } from '../services/bookingReminderService.js'

let isRunning = false

export function initBookingReminderCron() {
  // Run every 1 minute: * * * * *
  cron.schedule('* * * * *', async () => {
    if (isRunning) {
      console.log('[BOOKING_REMINDER_CRON] Previous cycle still running, skipping overlap.')
      return
    }

    isRunning = true
    try {
      const result = await processDueReminders()
      if (result.processed > 0) {
        console.log(`[BOOKING_REMINDER_CRON] Cycle completed: ${result.processed} processed, ${result.sent} sent, ${result.failed} failed.`)
      }
    } catch (err) {
      console.error('[BOOKING_REMINDER_CRON] Error during reminder cycle:', err)
    } finally {
      isRunning = false
    }
  })

  console.log('[BOOKING_REMINDER_CRON] Initialized Booking Date & Time Reminder scheduler (interval: 1m)')
}
