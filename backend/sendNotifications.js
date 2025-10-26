// backend/sendNotification.js
// Helper script to send push notifications (called by Python)

const fetch = require('node-fetch');

// Read command line arguments
const args = process.argv.slice(2);

if (args.length < 2) {
  console.error('Usage: node sendNotification.js <species> <snapshot_path> [alert_level]');
  process.exit(1);
}

const species = args[0];
const snapshotPath = args[1];
const alertLevel = args[2] || 'medium';

// Determine if high priority
const isHighPriority = alertLevel === 'high';

// Create notification payload
const title = isHighPriority 
  ? `🚨 HIGH ALERT: ${species.toUpperCase()} Detected!`
  : `⚠️ Wildlife Alert: ${species.charAt(0).toUpperCase() + species.slice(1)}`;

const body = isHighPriority
  ? `Dangerous animal detected! Take immediate precautions.`
  : `A ${species} has been detected near your farm.`;

const payload = {
  title: title,
  body: body,
  data: {
    species: species,
    snapshot: snapshotPath,
    alert_level: alertLevel,
    tag: `detection-${species}-${Date.now()}`,
    requireInteraction: isHighPriority, // High alerts stay until dismissed
    image: `http://localhost:5000${snapshotPath}` // Full image URL
  }
};

// Send to backend API
fetch('http://localhost:5000/api/push/send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
})
  .then(res => res.json())
  .then(data => {
    if (data.success) {
      console.log(`✅ Push notification sent: ${species} (${data.sent} recipients)`);
    } else {
      console.error('❌ Failed to send notification:', data.error);
    }
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Error sending notification:', error.message);
    process.exit(1);
  });