import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
let messaging;

try {
  messaging = getMessaging(app);
} catch (error) {
  console.error("Firebase Messaging failed to initialize", error);
}

export const requestFirebaseToken = async () => {
  if (!messaging) {
    console.error('Firebase messaging is not initialized. Check your environment variables.');
    return null;
  }
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      let swRegistration;
      try {
        swRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        console.log('Service Worker registered successfully:', swRegistration);
      } catch (err) {
        console.error('Service Worker registration failed:', err);
      }

      const currentToken = await getToken(messaging, { 
        vapidKey: import.meta.env.VITE_FIREBASE_VAPID_KEY || undefined,
        serviceWorkerRegistration: swRegistration 
      });
      
      if (currentToken) {
        return currentToken;
      } else {
        console.log('No registration token available. Request permission to generate one.');
      }
    } else {
      console.log('Notification permission denied.');
    }
  } catch (err) {
    console.error('An error occurred while retrieving token. ', err);
  }
  return null;
};

export const setupOnMessageListener = (callback) => {
  if (!messaging) return null;
  return onMessage(messaging, (payload) => {
    callback(payload);
  });
};

export { app, messaging };
