// src/components/NotificationPermission.js
import React, { useEffect, useState } from 'react';
import { subscribeToPushNotifications } from '../utils/pushSubscription';

export default function NotificationPermission() {
  const [permission, setPermission] = useState('default');
  const [showPrompt, setShowPrompt] = useState(false);
  const [swRegistration, setSwRegistration] = useState(null);

  useEffect(() => {
    // Check if notifications are supported
    if (!('Notification' in window)) {
      console.log('⚠️ This browser does not support notifications');
      return;
    }

    // Get current permission status
    setPermission(Notification.permission);

    // Get service worker registration
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready
        .then((registration) => {
          console.log('✅ Service Worker is ready');
          setSwRegistration(registration);
        })
        .catch((error) => {
          console.error('❌ Service Worker not ready:', error);
        });
    }

    // Show prompt if permission not granted yet
    if (Notification.permission === 'default') {
      // Wait 2 seconds before showing prompt (better UX)
      setTimeout(() => {
        setShowPrompt(true);
      }, 2000);
    }
  }, []);

  const requestPermission = async () => {
    try {
      // Request notification permission
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted') {
        console.log('✅ Notification permission granted');
        setShowPrompt(false);
        
        // Subscribe to push notifications
        const subscription = await subscribeToPushNotifications();
        
        if (subscription) {
          console.log('✅ Successfully subscribed to push notifications');
          
          // Show a test notification to confirm it works
          if (swRegistration) {
            swRegistration.showNotification('🎉 Notifications Enabled!', {
              body: 'You will now receive wildlife detection alerts',
              icon: '/logo192.png',
              badge: '/logo192.png',
              vibrate: [200, 100, 200],
              tag: 'welcome-notification'
            });
          }
        }
      } else if (result === 'denied') {
        console.log('❌ Notification permission denied');
        alert('Notifications blocked. Please enable them in your browser settings if you change your mind.');
      }
    } catch (error) {
      console.error('❌ Error requesting permission:', error);
    }
  };

  // Don't show if already granted or denied
  if (!showPrompt || permission !== 'default') {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      background: '#fff',
      padding: '1.2rem',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
      zIndex: 9999,
      maxWidth: '320px',
      border: '2px solid #2f855a'
    }}>
      <h4 style={{ margin: '0 0 0.5rem 0', fontSize: '1.1rem', color: '#2f855a' }}>
        🔔 Enable Notifications
      </h4>
      <p style={{ margin: '0 0 1rem 0', fontSize: '0.9rem', color: '#666', lineHeight: '1.4' }}>
        Get instant alerts when wildlife is detected near your farm
      </p>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button 
          onClick={requestPermission}
          style={{
            background: '#2f855a',
            color: 'white',
            border: 'none',
            padding: '0.6rem 1.2rem',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: '600',
            flex: 1
          }}
        >
          Enable
        </button>
        <button 
          onClick={() => setShowPrompt(false)}
          style={{
            background: '#e2e8f0',
            color: '#4a5568',
            border: 'none',
            padding: '0.6rem 1rem',
            borderRadius: '5px',
            cursor: 'pointer',
            fontSize: '0.9rem'
          }}
        >
          Later
        </button>
      </div>
    </div>
  );
}