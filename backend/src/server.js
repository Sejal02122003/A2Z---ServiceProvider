import './config/env.js'
import http from 'http'
import app from './app.js'
import { connectDb } from './config/db.js'
import { initSocket } from './socket.js'
import { initBroadcastCron } from './cron/broadcastCron.js'
import { initSubscriptionRefundCron } from './cron/subscriptionRefund.js'
import { initRewardReconciliationCron } from './cron/rewardReconciliationCron.js'
import { initBookingReminderCron } from './cron/bookingReminderCron.js'
import { initPenaltyCron } from './cron/penaltyCron.js'

const port = Number(process.env.PORT) || 5005

async function main() {
  await connectDb()
  
  const server = http.createServer(app)
  initSocket(server)
  console.log('Cron jobs initialized')
  initBroadcastCron()
  initSubscriptionRefundCron()
  initRewardReconciliationCron()
  initBookingReminderCron()
  initPenaltyCron()

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n[FATAL] Port ${port} is already in use.`)
      if (port === 5000) {
        console.error(`Note: On macOS, port 5000 is used by AirPlay Receiver (ControlCenter).`)
        console.error(`Turn off 'AirPlay Receiver' in System Settings > AirDrop & AirPlay or set PORT=5005 in .env.\n`)
      }
    } else {
      console.error('[FATAL] Server error:', err)
    }
    process.exit(1)
  })

  server.listen(port, () => {
    console.log(`A2Z API listening on :${port}`)
  })
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})

