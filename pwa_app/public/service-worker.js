// Service Worker for PWA with Push Notifications

// Install event - fires when service worker is first installed
self.addEventListener('install', function(event) {
  console.log('Service Worker: Installing...');
  // Force the waiting service worker to become the active service worker
  self.skipWaiting();
});

// Activate event - fires when service worker takes control
self.addEventListener('activate', function(event) {
  console.log('Service Worker: Activated');
  // Claim all clients immediately
  event.waitUntil(self.clients.claim());
});

// Handle incoming push notifications
self.addEventListener('push', function(event) {
  console.log('Push notification received:', event);
  
  if (event.data) {
    const data = event.data.json();
    
    // Determine vibration pattern based on alert level
    const isHighAlert = data.data?.alertLevel === 'high';
    const vibrationPattern = isHighAlert 
      ? [200, 100, 200, 100, 200] // Shorter vibration
      : [200, 100, 200];
    
    const options = {
      body: data.body,
      icon: data.icon || '/logo192.png',
      badge: data.badge || '/logo192.png',
      image: data.data?.image, // Show snapshot image
      data: data.data,
      vibrate: vibrationPattern,
      tag: data.data?.species || 'wildlife-detection', // 🆕 Use species as tag to prevent duplicates
      requireInteraction: false, // 🆕 CHANGED: Allow closing all notifications
      actions: [
        {
          action: 'view',
          title: 'View Details',
          icon: '/logo192.png'
        },
        {
          action: 'close',
          title: 'Dismiss'
        }
      ],
      silent: false,
      renotify: false // 🆕 CHANGED: Don't re-alert for same species
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', function(event) {
  console.log('Notification clicked:', event.notification);
  event.notification.close();
  
  const action = event.action;
  const notificationData = event.notification.data || {};
  
  if (action === 'close') {
    // Just close, do nothing
    return;
  }
  
  // Default action or 'view' action - open the app to alerts page
  event.waitUntil(
    clients.matchAll({ 
      type: 'window',
      includeUncontrolled: true 
    }).then(function(clientList) {
      // If a window is already open, focus it and navigate to alerts
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url.indexOf(self.location.origin) !== -1) {
          // Tell the client to open the alerts screen
          client.postMessage({
            type: 'OPEN_ALERTS',
            data: notificationData
          });
          return client.focus();
        }
      }
      // If no window is open, open a new one with alerts page
      if (clients.openWindow) {
        // Add query parameter to auto-open alerts
        const urlToOpen = self.location.origin + '/?openAlerts=true';
        return clients.openWindow(urlToOpen);
      }
    }).catch(function(error) {
      console.error('Error handling notification click:', error);
    })
  );
});

console.log('Service Worker loaded successfully');