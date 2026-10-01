import { app, messaging } from '../config/firebase.js';
import { getToken, onMessage } from 'firebase/messaging';
import { apiRequest } from '../api/http.js';
import { store } from '../store/index.js';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY;

// Request notification permission
export async function requestNotificationPermission() {
  if ('Notification' in window) {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      console.log('Notification permission granted');
      return true;
    } else {
      console.log('Notification permission denied');
      return false;
    }
  }
  return false;
}

// Register service worker explicitly
async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
      console.log('Service Worker registered:', registration);
      return registration;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      throw error;
    }
  } else {
    throw new Error('Service Workers are not supported in this browser');
  }
}

// Get FCM token
export async function getFCMToken() {
  if (!messaging) {
    console.error('Firebase messaging is not initialized');
    return null;
  }
  try {
    const registration = await registerServiceWorker();
    
    try {
      await registration.update();
    } catch (e) {
      console.warn('SW update failed', e);
    }

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY || undefined,
      serviceWorkerRegistration: registration
    });

    if (token) {
      console.log('FCM Token obtained:', token);
      return token;
    } else {
      console.log('No FCM token available');
      return null;
    }
  } catch (error) {
    console.error('Error getting FCM token:', error);
    throw error;
  }
}

// Register FCM token with backend
export async function registerFCMToken(forceUpdate = false) {
  try {
    const state = store.getState();
    if (!state?.auth?.token) {
      console.log('User not authenticated, skipping FCM registration');
      return null;
    }

    const savedToken = localStorage.getItem('fcm_token_web');
    if (savedToken && !forceUpdate) {
      console.log('FCM token already registered locally');
      return savedToken;
    }

    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      throw new Error('Notification permission was not granted by the browser.');
    }

    const token = await getFCMToken();
    if (!token) {
      throw new Error('Failed to retrieve FCM token from Firebase.');
    }

    const response = await apiRequest('/fcm-tokens/save', {
      method: 'POST',
      body: { token, platform: 'web' }
    });

    if (response?.success) {
      localStorage.setItem('fcm_token_web', token);
      console.log('FCM token registered with backend');
      return token;
    } else {
      throw new Error(response?.message || 'Failed to register token with backend');
    }
  } catch (error) {
    console.error('Error registering FCM token:', error);
    throw error;
  }
}

// Send test push notification to the logged-in user
export async function sendTestNotification() {
  // Ensure token is registered with backend
  await registerFCMToken(true);

  // Trigger backend test notification
  const response = await apiRequest('/fcm-tokens/test', {
    method: 'POST',
  });
  return response;
}

// Setup foreground notification handler
export function setupForegroundNotificationHandler(handler) {
  if (!messaging) return;
  onMessage(messaging, (payload) => {
    console.log('Foreground message received:', payload);
    
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(payload?.notification?.title || 'A2Z Notification', {
          body: payload?.notification?.body || '',
          icon: payload?.notification?.icon || '/favicon.ico',
          data: payload?.data
        });
      } catch (e) {
        console.warn('Could not show system notification in foreground:', e);
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
  } catch (error) {
    console.error('Error initializing push notifications:', error);
  }
}
