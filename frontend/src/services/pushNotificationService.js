import { app, messaging } from '../config/firebase.js';
import { getToken, onMessage } from 'firebase/messaging';
import { apiRequest } from '../api/http.js';
import { store } from '../store/index.js';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

// Check current notification permission status
export function getNotificationPermissionStatus() {
  if (!('Notification' in window)) return 'unsupported';
  return Notification.permission; // 'granted' | 'denied' | 'default'
}

// Request notification permission from browser
export async function requestNotificationPermission() {
  if ('Notification' in window) {
    try {
      const permission = await Notification.requestPermission();
      console.log('[PUSH] Permission requested, result:', permission);
      return permission === 'granted';
    } catch (err) {
      console.warn('[PUSH] Error requesting notification permission:', err);
      return false;
    }
  }
  return false;
}

// Register service worker explicitly with ready assurance
export async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
        scope: '/'
      });
      // Wait until active/ready
      await navigator.serviceWorker.ready;
      return registration;
    } catch (error) {
      console.error('[PUSH] Service Worker registration failed:', error);
      throw error;
    }
  } else {
    throw new Error('Service Workers are not supported in this browser');
  }
}

// Get FCM token
export async function getFCMToken() {
  if (!messaging) {
    console.error('[PUSH] Firebase messaging is not initialized');
    return null;
  }
  try {
    const registration = await registerServiceWorker();
    
    try {
      await registration.update();
    } catch (e) {
      // SW update failure is non-fatal
    }

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY || undefined,
      serviceWorkerRegistration: registration
    });

    if (token) {
      console.log('[PUSH] FCM Token successfully generated');
      return token;
    } else {
      console.warn('[PUSH] No FCM token available from getToken');
      return null;
    }
  } catch (error) {
    console.error('[PUSH] Error getting FCM token:', error);
    throw error;
  }
}

// Register FCM token with backend
export async function registerFCMToken(forceUpdate = false) {
  try {
    const state = store.getState();
    if (!state?.auth?.token) {
      console.log('[PUSH] User not authenticated, skipping FCM registration');
      return null;
    }

    if (!('Notification' in window)) {
      console.warn('[PUSH] Notifications not supported in this browser');
      return null;
    }

    if (Notification.permission !== 'granted') {
      if (forceUpdate) {
        const granted = await requestNotificationPermission();
        if (!granted) {
          console.warn('[PUSH] Browser notification permission was not granted.');
          return null;
        }
      } else {
        // If not forceUpdate and permission not yet granted, do not prompt spontaneously
        return null;
      }
    }

    const currentUserId = state?.auth?.user?._id;
    const savedToken = localStorage.getItem('fcm_token_web');
    
    // Check if this token was already confirmed synced for THIS specific user
    if (
      savedToken &&
      !forceUpdate &&
      currentUserId &&
      localStorage.getItem(`fcm_synced_user_${currentUserId}`) === savedToken &&
      sessionStorage.getItem(`fcm_synced_${currentUserId}`)
    ) {
      return savedToken;
    }

    let token = null;
    try {
      token = await getFCMToken();
    } catch (swErr) {
      console.warn('[PUSH] getFCMToken error, checking cached token:', swErr);
      if (savedToken) token = savedToken;
    }

    if (!token && savedToken) {
      token = savedToken;
    }

    if (!token) {
      console.warn('[PUSH] Could not retrieve FCM token from Firebase.');
      return null;
    }

    const response = await apiRequest('/fcm-tokens/save', {
      method: 'POST',
      body: { token, platform: 'web' }
    });

    if (response?.success) {
      localStorage.setItem('fcm_token_web', token);
      if (currentUserId) {
        sessionStorage.setItem(`fcm_synced_${currentUserId}`, 'true');
        localStorage.setItem(`fcm_synced_user_${currentUserId}`, token);
      }
      console.log(`[PUSH] FCM token registered with backend successfully for user ${currentUserId}`);
      return token;
    } else {
      console.warn('[PUSH] Failed to register FCM token with backend:', response?.message);
      return null;
    }
  } catch (error) {
    console.warn('[PUSH] FCM token registration skipped or failed:', error?.message || error);
    return null;
  }
}

// Unregister and disassociate FCM token from backend upon logout
export async function unregisterFCMToken() {
  try {
    const savedToken = localStorage.getItem('fcm_token_web');
    if (savedToken) {
      await apiRequest('/fcm-tokens/remove', {
        method: 'DELETE',
        body: { token: savedToken, platform: 'web' },
      }).catch((err) => console.warn('[PUSH] Token removal request failed:', err?.message || err));
    }
  } catch (err) {
    console.warn('[PUSH] unregisterFCMToken error:', err?.message || err);
  } finally {
    localStorage.removeItem('fcm_token_web');
    // Clear all cached fcm sync flags
    try {
      for (let i = localStorage.length - 1; i >= 0; i--) {
        const key = localStorage.key(i);
        if (key && key.startsWith('fcm_synced_user_')) {
          localStorage.removeItem(key);
        }
      }
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i);
        if (key && key.startsWith('fcm_synced_')) {
          sessionStorage.removeItem(key);
        }
      }
    } catch {}
  }
}

// Send test push notification to the logged-in user
export async function sendTestNotification() {
  const token = await registerFCMToken(true);
  if (!token) {
    throw new Error('Please enable browser notification permissions in your browser address bar to receive push notifications.');
  }

  const response = await apiRequest('/fcm-tokens/test', {
    method: 'POST',
  });
  return response;
}

// Display native OS desktop notification directly
export function showDesktopNotification({
  title,
  body,
  icon = '/logo.png',
  link = '/',
  tag = 'a2z-alert',
  sound = '/alert.mp3',
  vibrate = [500, 200, 500, 200, 500, 200, 800],
  requireInteraction = true,
  playAlert = true,
}) {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return null;
  }
  try {
    if (playAlert) {
      import('../utils/bookingSound.js').then(({ playBookingAlertSound }) => {
        playBookingAlertSound();
      }).catch(() => {});
    }

    const notif = new Notification(title || 'A2Z Service Hub', {
      body: body || '',
      icon: icon || '/logo.png',
      badge: '/logo.png',
      tag,
      renotify: true,
      sound,
      silent: false,
      vibrate,
      requireInteraction,
      data: { link },
    });
    notif.onclick = (e) => {
      e.preventDefault();
      window.focus();
      if (link && window.location.pathname !== link) {
        window.location.href = link;
      }
    };
    return notif;
  } catch (err) {
    console.warn('[PUSH] Native desktop notification display warning:', err);
    return null;
  }
}

// Setup foreground notification handler
export function setupForegroundNotificationHandler(handler) {
  if (!messaging) return () => {};
  return onMessage(messaging, (payload) => {
    console.log('[PUSH] Foreground message received:', payload);
    
    // Show system notification banner even in foreground if user is in another tab or minimized
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        const title = payload?.notification?.title || payload?.data?.title || 'A2Z Notification';
        const body = payload?.notification?.body || payload?.data?.body || '';
        const icon = payload?.notification?.icon || payload?.notification?.imageUrl || '/favicon.ico';
        const link = payload?.data?.link || '/';

        showDesktopNotification({ title, body, icon, link, tag: payload?.data?.type || 'a2z-push' });
      } catch (e) {
        console.warn('[PUSH] Could not show system notification in foreground:', e);
      }
    }

    if (handler) {
      handler(payload);
    }
  });
}

// Initialize push notifications (call this on app load)
export async function initializePushNotifications() {
  try {
    await registerServiceWorker();
    // If permission was already granted previously, auto-sync token with backend
    if ('Notification' in window && Notification.permission === 'granted') {
      registerFCMToken(false).catch((e) => console.warn('[PUSH] Auto-sync skipped:', e));
    }
  } catch (error) {
    console.warn('[PUSH] Error initializing push notifications:', error);
  }
}
