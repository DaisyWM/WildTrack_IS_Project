// Helper function to send push notification
export function sendDetectionNotification(detection) {
  if (Notification.permission !== 'granted') {
    return;
  }

  const species = detection.snapshot.detections[0]?.species || 'Unknown';
  const confidence = detection.snapshot.detections[0]?.confidence || 0;
  const alertLevel = detection.snapshot.alert_level;
  
  const title = alertLevel === 'high' 
    ? `🚨 HIGH ALERT: ${species.toUpperCase()} Detected!`
    : `⚠️ ${species.charAt(0).toUpperCase() + species.slice(1)} Detected`;
  
  const body = `Confidence: ${Math.round(confidence * 100)}% | Video: ${detection.video}`;
  
  const notification = new Notification(title, {
    body: body,
    icon: '/logo192.png',
    badge: '/logo192.png',
    tag: `detection-${detection.id}`,
    requireInteraction: alertLevel === 'high', // High alerts stay until dismissed
    vibrate: alertLevel === 'high' ? [200, 100, 200, 100, 200] : [200],
  });

  // Auto-close after 10 seconds (for non-high alerts)
  if (alertLevel !== 'high') {
    setTimeout(() => notification.close(), 10000);
  }
  
  console.log(`📢 Notification sent: ${species}`);
}

// Check for new detections periodically
export async function checkForNewDetections(lastDetectionId, onNewDetection) {
  try {
    const response = await fetch('http://localhost:5000/api/detections/history');
    const data = await response.json();
    
    if (data.success && data.detections.length > 0) {
      // Find new detections (IDs greater than last seen)
      const newDetections = data.detections.filter(d => d.id > lastDetectionId);
      
      if (newDetections.length > 0) {
        newDetections.forEach(detection => {
          sendDetectionNotification(detection);
          onNewDetection(detection.id); // Update last seen ID
        });
      }
    }
  } catch (error) {
    console.error('Error checking for new detections:', error);
  }
}