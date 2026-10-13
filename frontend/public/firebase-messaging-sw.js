importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyDRxk3hpYDa53V8gVaFd568A3Z5UeslDaE",
  authDomain: "kaamexpert.firebaseapp.com",
  projectId: "kaamexpert",
  storageBucket: "kaamexpert.firebasestorage.app",
  messagingSenderId: "669163351420",
  appId: "1:669163351420:web:7c0240103ce80aa034c8f9",
  measurementId: "G-LVC8GXB1JM"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload?.notification?.title || 'Notification';
  const link = payload?.data?.link || (payload?.data?.bookingId ? `/app/tracking/${payload.data.bookingId}` : '/app');
  
  const notificationOptions = {
    body: payload?.notification?.body || '',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: {
      ...payload?.data,
      link,
    },
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.link || '/app';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

