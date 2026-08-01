// Disaster Response Hub - Service Worker for Web Push Notifications

self.addEventListener('push', (event) => {
  let data = {
    title: '🚨 EMERGENCY DISASTER ALERT',
    body: 'New emergency notification received from Disaster Response Hub.',
    urgency: 'Critical',
    url: '/'
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const urgencyIcons = {
    Critical: '🚨',
    Warning: '⚠️',
    Advisory: '📢',
    Info: 'ℹ️'
  };

  const badgeIcon = urgencyIcons[data.urgency] || '🚨';
  const fullTitle = `${badgeIcon} ${data.title || 'Disaster Alert'}`;

  const options = {
    body: data.body || 'Immediate action or awareness advised for your region.',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    vibrate: data.urgency === 'Critical' ? [400, 100, 400, 100, 400] : [200, 100, 200],
    data: {
      url: data.url || '/',
      urgency: data.urgency || 'Critical',
      timestamp: data.timestamp || new Date().toISOString()
    },
    actions: [
      { action: 'open_app', title: 'Open Response Hub' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
    tag: `dh-push-alert-${Date.now()}`,
    renotify: true,
    requireInteraction: data.urgency === 'Critical'
  };

  event.waitUntil(
    self.registration.showNotification(fullTitle, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let client of windowClients) {
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
    })
  );
});
