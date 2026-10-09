import cron from 'node-cron'
import { scanOverdueBookingsJob } from '../services/penaltyService.js'

let isCronRunning = false

export function initPenaltyCron() {
  // Run every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    if (isCronRunning) {
      console.log('[PENALTY_CRON] Previous cycle still running, skipping...')
      return
    }

    isCronRunning = true
    try {
      const result = await scanOverdueBookingsJob()
      if (result.incidentsCreated > 0) {
        console.log(`[PENALTY_CRON] Scanned ${result.scanned} bookings | Created ${result.incidentsCreated} penalty incidents.`)
      }
    } catch (err) {
      console.error('[PENALTY_CRON_ERROR]', err?.message)
    } finally {
      isCronRunning = false
    }
  })

  console.log('[PENALTY_CRON] Initialized penalty & bounce background scheduler (every 5 minutes).')
}
