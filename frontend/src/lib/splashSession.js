/**
 * The brand splash is only for a *fresh* app launch.
 *
 * It must NOT show when:
 *  - the app/tab is already open (reloads, switching back from recents / other tabs), or
 *  - the app was opened by tapping a notification.
 *
 * sessionStorage lives as long as the tab / WebView session does and is cleared when the app
 * is truly closed, so it is a reliable "already launched in this session" marker.
 */
const LAUNCHED_KEY = 'a2z_app_launched'

// Query params that mean "opened from a notification" (set by the service worker / push links)
const NOTIFICATION_PARAMS = ['from_notification', 'fromNotification', 'incoming_booking', 'notification_id']

export function launchedFromNotification() {
  if (typeof window === 'undefined') return false
  try {
    const params = new URLSearchParams(window.location.search)
    return NOTIFICATION_PARAMS.some((p) => params.has(p))
  } catch {
    return false
  }
}

export function hasLaunchedThisSession() {
  try {
    return sessionStorage.getItem(LAUNCHED_KEY) === '1'
  } catch {
    return false
  }
}

export function markAppLaunched() {
  try {
    sessionStorage.setItem(LAUNCHED_KEY, '1')
  } catch {
    /* storage unavailable: splash may show again, which is harmless */
  }
}

export function shouldShowSplash() {
  return !hasLaunchedThisSession() && !launchedFromNotification()
}
