import { API_BASE } from '../config/pushConfig';

// Helper function to send push notification
export function sendDetectionNotification(detection) {
  if (Notification.permission !== 'granted') {
    return;
  }

  // Get species from snapshots (new format)
  const species = detection.snapshots?.[0]?.detections?.[0]?.species || 'Unknown';
  const confidence = detection.snapshots?.[0]?.detections?.[0]?.confidence || 0;
  const alertLevel = detection.snapshots?.[0]?.alertLevel || 'medium';
  
  const title = alertLevel === 'high' 
    ? `🚨 HIGH ALERT: ${species.toUpperCase()} Detected!`
    : `⚠️ ${species.charAt(0).toUpperCase() + species.slice(1)} Detected`;
  
  const body = `Confidence: ${Math.round(confidence * 100)}% | Video: ${detection.video.originalName || detection.video.filename}`;
  
  const notification = new Notification(title, {
    body: body,
    icon: '/logo192.png',
    badge: '/logo192.png',
    tag: `detection-${detection._id}`,
    requireInteraction: false, // 🆕 Allow closing all notifications
    vibrate: alertLevel === 'high' ? [200, 100, 200] : [200],
  });

  // Auto-close after 10 seconds (for all alerts)
  setTimeout(() => notification.close(), 10000);
  
  console.log(`📢 Notification sent: ${species}`);
}

// Check for new detections periodically
export async function checkForNewDetections(lastSeenId, onNewDetection) {
  try {
    const response = await fetch(`${API_BASE}/api/detections/history`);
    const detections = await response.json();
    
    // Backend now returns array directly
    if (Array.isArray(detections) && detections.length > 0) {
      // Get the most recent detection ID
      const mostRecentId = detections[0]._id;
      
      // If this is the first check, just save the ID and don't notify
      if (!lastSeenId) {
        onNewDetection(mostRecentId);
        return;
      }
      
      // Only notify for detections newer than last seen
      const newDetections = [];
      for (const detection of detections) {
        if (detection._id === lastSeenId) {
          break; // Stop when we reach the last seen one
        }
        newDetections.push(detection);
      }
      
      // Send notifications for new detections
      if (newDetections.length > 0) {
        newDetections.forEach(detection => {
          sendDetectionNotification(detection);
        });
        
        // Update last seen ID to the most recent
        onNewDetection(mostRecentId);
      }
    }
  } catch (error) {
    console.error('Error checking for new detections:', error);
  }
}