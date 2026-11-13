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

// Force immediate activation and client claiming so background tabs receive sound triggers instantly
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

/**
 * Native push event listener: Runs for EVERY incoming Web Push event,
 * even when the payload contains a top-level notification object that would otherwise
 * bypass onBackgroundMessage.
 */
self.addEventListener('push', (event) => {
  let payload = {};
  if (event.data) {
    try {
      payload = event.data.json();
    } catch {
      try {
        payload = { data: { text: event.data.text() } };
      } catch {
        payload = {};
      }
    }
  }

  const dataObj = payload.data || {};
  const notifObj = payload.notification || {};

  const rawType = (dataObj.type || '').toUpperCase();
  const isBookingAlert =
    rawType === 'NEW_BOOKING' ||
    rawType === 'BOOKING_RECEIVED' ||
    rawType === 'NEW_BROADCAST_JOB' ||
    rawType === 'BOOKING_REBROADCASTING';

  // Instantly wake up all open tabs to play the /alert.mp3 chime for service provider booking offers
  if (isBookingAlert && self.clients) {
    const wakePromise = self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        windowClients.forEach((client) => {
          client.postMessage({
            type: 'PLAY_BOOKING_ALERT_SOUND',
            bookingId: dataObj.bookingId,
            eventId: dataObj.eventId || dataObj.notificationId,
            sound: '/alert.mp3',
          });
        });
      })
      .catch((err) => console.warn('[SW push] wake clients warning:', err));

    event.waitUntil(wakePromise);
  }

  // Display rich notification with vibration and action buttons
  const title =
    dataObj.title ||
    notifObj.title ||
    (isBookingAlert ? 'New Booking Received! ⚡' : 'A2Z Service Hub');

  const body =
    dataObj.body ||
    notifObj.body ||
    (isBookingAlert
      ? 'You have received a new booking. Open the app to view details.'
      : 'You have a new update.');

  const icon = notifObj.icon || notifObj.imageUrl || dataObj.icon || '/logo.png';

  let targetLink = dataObj.link || dataObj.click_action;
  if (!targetLink) {
    if (isBookingAlert && dataObj.bookingId) {
      targetLink = `/serviceprovider?incoming_booking=${dataObj.bookingId}`;
    } else if (dataObj.bookingId) {
      targetLink = `/booking-details/${dataObj.bookingId}`;
    } else {
      targetLink = '/';
    }
  }

  const notificationTag =
    dataObj.tag ||
    (dataObj.bookingId ? `booking-${dataObj.bookingId}` : (notifObj.tag || (isBookingAlert ? 'new_booking_alerts' : 'a2z-push')));

  const notificationOptions = {
    body,
    icon,
    badge: '/logo.png',
    tag: notificationTag,
    renotify: true,
    requireInteraction: isBookingAlert,
    silent: false,
    sound: isBookingAlert ? '/alert.mp3' : undefined,
    vibrate: isBookingAlert ? [500, 200, 500, 200, 500, 200, 800] : [200, 100, 200],
    data: {
      ...dataObj,
      isBookingAlert,
      link: targetLink,
      sound: isBookingAlert ? '/alert.mp3' : undefined,
    },
    actions: isBookingAlert
      ? [
          { action: 'open_booking', title: '⚡ View & Accept Job' },
          { action: 'dismiss', title: 'Dismiss' },
        ]
      : [],
  };

  const showPromise = self.registration
    .showNotification(title, notificationOptions)
    .catch((err) => {
      console.warn('[SW push] Rich showNotification failed, retrying simple:', err);
      return self.registration.showNotification(title, {
        body,
        icon: '/logo.png',
        badge: '/logo.png',
        tag: notificationTag,
        data: { link: targetLink, isBookingAlert },
      });
    });

  event.waitUntil(showPromise);
});

// Firebase background message handler (fallback/compat logger)
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] onBackgroundMessage received:', payload);
  return Promise.resolve();
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  // If user tapped 'dismiss', stop audio in any open clients
  if (event.action === 'dismiss') {
    if (self.clients) {
      event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
          windowClients.forEach((client) => {
            client.postMessage({ type: 'STOP_BOOKING_ALERT_SOUND' });
          });
        }).catch(() => {})
      );
    }
    return;
  }

  const notifData = event.notification.data || {};
  let targetUrlStr = notifData.link || '/';
  if (notifData.isBookingAlert && notifData.bookingId && !targetUrlStr.includes('incoming_booking=')) {
    targetUrlStr = `/serviceprovider?incoming_booking=${notifData.bookingId}`;
  }
  const targetUrl = new URL(targetUrlStr, self.location.origin).href;

  if (!self.clients) return;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          if (notifData.isBookingAlert) {
            client.postMessage({
              type: 'PLAY_BOOKING_ALERT_SOUND',
              bookingId: notifData.bookingId,
              eventId: notifData.eventId || notifData.notificationId,
              sound: '/alert.mp3',
            });
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl).then((newClient) => {
          if (newClient && notifData.isBookingAlert) {
            setTimeout(() => {
              newClient.postMessage({
                type: 'PLAY_BOOKING_ALERT_SOUND',
                bookingId: notifData.bookingId,
                eventId: notifData.eventId || notifData.notificationId,
                sound: '/alert.mp3',
              });
            }, 800);
          }
        });
      }
    })
  );
});

