// src/utils/pushSubscription.js

// Your VAPID public key (copy from your .env file)
const VAPID_PUBLIC_KEY = 'BK-O_nsz9JXgvn6Lqxxrs8Gpks5fwE2yuxMc1lTB2DCxes7oGb2jFcubGZ39yTKxwOZ7Mg_ijWlUhSuqYOevWnA';

// Helper function to convert VAPID key to Uint8Array
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Subscribe user to push notifications
export async function subscribeToPushNotifications() {
  try {
    // Check if service worker and push manager are supported
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.log('⚠️ Push notifications not supported');
      return null;
    }

    // Wait for service worker to be ready
    const registration = await navigator.serviceWorker.ready;
    console.log('✅ Service Worker ready for push subscription');

    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      console.log('✅ Already subscribed to push notifications');
      return subscription;
    }

    // Subscribe to push notifications
    console.log('📝 Subscribing to push notifications...');
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });

    console.log('✅ Push subscription created:', subscription);

    // Send subscription to backend
    await sendSubscriptionToBackend(subscription);

    return subscription;

  } catch (error) {
    console.error('❌ Error subscribing to push notifications:', error);
    return null;
  }
}

// Send subscription to backend
async function sendSubscriptionToBackend(subscription) {
  try {
    const response = await fetch('http://localhost:5000/api/push/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(subscription)
    });

    if (response.ok) {
      console.log('✅ Subscription sent to backend');
    } else {
      console.error('❌ Failed to send subscription to backend');
    }
  } catch (error) {
    console.error('❌ Error sending subscription to backend:', error);
  }
}

// Unsubscribe from push notifications
export async function unsubscribeFromPushNotifications() {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();
      console.log('✅ Unsubscribed from push notifications');
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ Error unsubscribing:', error);
    return false;
  }
}