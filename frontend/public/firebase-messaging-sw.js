importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyACAX1jfRAIT2gmJ78gCqi6xUv-JLEX6JY",
  authDomain: "a2z-service-hub.firebaseapp.com",
  projectId: "a2z-service-hub",
  storageBucket: "a2z-service-hub.firebasestorage.app",
  messagingSenderId: "824076739452",
  appId: "1:824076739452:web:978c87166cc954cd7bfaf9",
  measurementId: "G-E8ZH0LPGM1"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background push message:', payload);
  
  const title = payload?.notification?.title || payload?.data?.title || 'A2Z Service Hub';
  const body = payload?.notification?.body || payload?.data?.body || 'You have a new update';
  const icon = payload?.notification?.icon || payload?.notification?.imageUrl || '/logo.png';
  const targetLink = payload?.data?.link || (payload?.data?.bookingId ? `/serviceprovider` : '/');

  const isBookingAlert =
    payload?.data?.type === 'booking_received' ||
    payload?.data?.type === 'NEW_BROADCAST_JOB' ||
    payload?.data?.type === 'booking_rebroadcasting';

  const notificationOptions = {
    body,
    icon,
    badge: '/logo.png',
    tag: payload?.data?.bookingId ? `booking-${payload.data.bookingId}` : (payload?.data?.type || 'a2z-background-notification'),
    renotify: true,
    requireInteraction: isBookingAlert,
    sound: '/alert.mp3',
    vibrate: isBookingAlert ? [500, 200, 500, 200, 500, 200, 800] : [200, 100, 200],
    data: {
      ...payload?.data,
      link: targetLink,
      sound: '/alert.mp3',
    },
    actions: isBookingAlert
      ? [
          { action: 'open_booking', title: '⚡ View & Accept Job' },
          { action: 'dismiss', title: 'Dismiss' },
        ]
      : [],
  };

  // If app is open in any background/minimized tab, signal it to play audio
  if (isBookingAlert && self.clients) {
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      windowClients.forEach((client) => {
        client.postMessage({
          type: 'PLAY_BOOKING_ALERT_SOUND',
          bookingId: payload?.data?.bookingId,
          sound: '/alert.mp3',
        });
      });
    }).catch(() => {});
  }

  return self.registration.showNotification(title, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  const rawLink = event.notification.data?.link || '/serviceprovider';
  const targetUrl = new URL(rawLink, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

