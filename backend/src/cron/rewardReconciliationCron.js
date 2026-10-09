import { reconcileAllActiveCampaigns, getRewardSettings } from '../services/rewardEvaluationService.js'

let intervalId = null

export function initRewardReconciliationCron() {
  if (intervalId) {
    clearInterval(intervalId)
  }

  // Run initial reconciliation after server boot delay (30 seconds)
  setTimeout(() => {
    reconcileAllActiveCampaigns().catch((err) => {
      console.error('[CRON_REWARDS_INIT_ERR]', err.message)
    })
  }, 30000)

  // Recurring reconciliation: runs every 30 minutes
  intervalId = setInterval(async () => {
    try {
      const settings = await getRewardSettings()
      if (settings.enabled && settings.autoReconciliationEnabled && !settings.globalRewardPause) {
        await reconcileAllActiveCampaigns()
      }
    } catch (err) {
      console.error('[CRON_REWARDS_RUN_ERR]', err.message)
    }
  }, 30 * 60 * 1000)

  console.log('[CRON] Reward reconciliation cron initialized (interval: 30m)')
}
