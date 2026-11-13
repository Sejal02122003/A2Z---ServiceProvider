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
  const isBookingAlert =
    dataObj.type === 'NEW_BOOKING' ||
    dataObj.type === 'booking_received' ||
    dataObj.type === 'NEW_BROADCAST_JOB' ||
    dataObj.type === 'booking_rebroadcasting' ||
    Boolean(dataObj.bookingId);

  // Instantly wake up all open tabs (foreground or background) to play the /alert.mp3 chime
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

  // Display rich notification with vibration, interaction, and action buttons
  const isPlainData = !notifObj.title && (dataObj.title || dataObj.bookingId);
  if (isBookingAlert || isPlainData) {
    const title = dataObj.title || notifObj.title || (isBookingAlert ? 'New Booking Received! ⚡' : 'A2Z Service Hub');
    const body = dataObj.body || notifObj.body || 'You have received a new booking. Open the app to view details.';
    const showPromise = self.registration.showNotification(title, {
      body,
      icon: notifObj.icon || '/logo.png',
      badge: '/logo.png',
      tag: dataObj.bookingId ? `booking-${dataObj.bookingId}` : (notifObj.tag || 'new_booking_alerts'),
      renotify: true,
      requireInteraction: isBookingAlert,
      silent: false,
      sound: '/alert.mp3',
      vibrate: isBookingAlert ? [500, 200, 500, 200, 500, 200, 800] : [200, 100, 200],
      data: {
        ...dataObj,
        channelId: isBookingAlert ? 'new_booking_alerts' : 'high_importance_channel',
        link: dataObj.link || (dataObj.bookingId ? `/serviceprovider?incoming_booking=${dataObj.bookingId}` : '/serviceprovider'),
      },
      actions: isBookingAlert
        ? [
            { action: 'open_booking', title: '⚡ View & Accept Job' },
            { action: 'dismiss', title: 'Dismiss' },
          ]
        : [],
    });

    event.waitUntil(showPromise);
  }
});

// Firebase background message handler (fallback)
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] onBackgroundMessage received:', payload);

  const title = payload?.notification?.title || payload?.data?.title || 'New Booking Received! ⚡';
  const body = payload?.notification?.body || payload?.data?.body || 'You have received a new booking. Open the app to view details.';
  const icon = payload?.notification?.icon || payload?.notification?.imageUrl || '/logo.png';
  const targetLink = payload?.data?.link || (payload?.data?.bookingId ? `/serviceprovider?incoming_booking=${payload.data.bookingId}` : '/serviceprovider');

  const isBookingAlert =
    payload?.data?.type === 'NEW_BOOKING' ||
    payload?.data?.type === 'booking_received' ||
    payload?.data?.type === 'NEW_BROADCAST_JOB' ||
    payload?.data?.type === 'booking_rebroadcasting' ||
    Boolean(payload?.data?.bookingId);

  const notificationOptions = {
    body,
    icon,
    badge: '/logo.png',
    tag: payload?.data?.bookingId ? `booking-${payload.data.bookingId}` : (payload?.data?.type || 'new_booking_alerts'),
    renotify: true,
    requireInteraction: isBookingAlert,
    silent: false,
    sound: '/alert.mp3',
    vibrate: isBookingAlert ? [500, 200, 500, 200, 500, 200, 800] : [200, 100, 200],
    data: {
      ...payload?.data,
      channelId: isBookingAlert ? 'new_booking_alerts' : 'high_importance_channel',
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

  // Signal all open client windows to play audio
  if (isBookingAlert && self.clients) {
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      windowClients.forEach((client) => {
        client.postMessage({
          type: 'PLAY_BOOKING_ALERT_SOUND',
          bookingId: payload?.data?.bookingId,
          eventId: payload?.data?.eventId || payload?.data?.notificationId,
          sound: '/alert.mp3',
        });
      });
    }).catch(() => {});
  }

  return self.registration.showNotification(title, notificationOptions);
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

  const bId = event.notification.data?.bookingId;
  let rawLink = event.notification.data?.link || '/serviceprovider';
  if (bId && !rawLink.includes('incoming_booking=')) {
    rawLink = `${rawLink}${rawLink.includes('?') ? '&' : '?'}incoming_booking=${bId}`;
  }
  const targetUrl = new URL(rawLink, self.location.origin).href;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if ('navigate' in client) {
            client.navigate(targetUrl);
          }
          client.postMessage({
            type: 'PLAY_BOOKING_ALERT_SOUND',
            bookingId: event.notification.data?.bookingId,
            eventId: event.notification.data?.eventId || event.notification.data?.notificationId,
            sound: '/alert.mp3',
          });
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl).then((newClient) => {
          if (newClient) {
            setTimeout(() => {
              newClient.postMessage({
                type: 'PLAY_BOOKING_ALERT_SOUND',
                bookingId: event.notification.data?.bookingId,
                eventId: event.notification.data?.eventId || event.notification.data?.notificationId,
                sound: '/alert.mp3',
              });
            }, 800);
          }
        });
      }
    })
  );
});

