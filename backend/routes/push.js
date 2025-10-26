// routes/push.js
const express = require('express');
const webpush = require('web-push');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Path to subscriptions file
const SUBSCRIPTIONS_FILE = path.join(__dirname, '..', 'push_subscriptions.json');

// Configure web-push with VAPID keys
const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY,
  privateKey: process.env.VAPID_PRIVATE_KEY,
  subject: process.env.VAPID_SUBJECT
};

webpush.setVapidDetails(
  vapidKeys.subject,
  vapidKeys.publicKey,
  vapidKeys.privateKey
);

console.log('✅ Web Push configured with VAPID keys');

// Helper function to read subscriptions
function readSubscriptions() {
  try {
    if (fs.existsSync(SUBSCRIPTIONS_FILE)) {
      const data = fs.readFileSync(SUBSCRIPTIONS_FILE, 'utf8');
      return JSON.parse(data);
    }
    return [];
  } catch (error) {
    console.error('Error reading subscriptions:', error);
    return [];
  }
}

// Helper function to save subscriptions
function saveSubscriptions(subscriptions) {
  try {
    fs.writeFileSync(SUBSCRIPTIONS_FILE, JSON.stringify(subscriptions, null, 2));
    console.log(`✅ Saved ${subscriptions.length} subscription(s)`);
  } catch (error) {
    console.error('Error saving subscriptions:', error);
  }
}

// POST /api/push/subscribe - Save a new push subscription
router.post('/subscribe', (req, res) => {
  const subscription = req.body;

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({
      success: false,
      error: 'Invalid subscription object'
    });
  }

  try {
    const subscriptions = readSubscriptions();
    
    // Check if subscription already exists
    const exists = subscriptions.some(sub => sub.endpoint === subscription.endpoint);
    
    if (!exists) {
      subscriptions.push(subscription);
      saveSubscriptions(subscriptions);
      console.log('✅ New subscription added:', subscription.endpoint);
    } else {
      console.log('ℹ️ Subscription already exists');
    }

    res.json({
      success: true,
      message: 'Subscription saved successfully'
    });
  } catch (error) {
    console.error('Error saving subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save subscription'
    });
  }
});

// POST /api/push/send - Send push notification to all subscribers
router.post('/send', async (req, res) => {
  const { title, body, data } = req.body;

  if (!title || !body) {
    return res.status(400).json({
      success: false,
      error: 'Title and body are required'
    });
  }

  try {
    const subscriptions = readSubscriptions();

    if (subscriptions.length === 0) {
      return res.json({
        success: true,
        message: 'No subscriptions to send to',
        sent: 0
      });
    }

    const payload = JSON.stringify({
      title,
      body,
      icon: '/logo192.png',
      badge: '/logo192.png',
      data: data || {},
      tag: data?.tag || 'wildlife-detection',
      requireInteraction: data?.requireInteraction || false
    });

    let successCount = 0;
    let failCount = 0;
    const validSubscriptions = [];

    // Send notification to all subscriptions
    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification(subscription, payload);
        successCount++;
        validSubscriptions.push(subscription);
        console.log('✅ Notification sent to:', subscription.endpoint.substring(0, 50) + '...');
      } catch (error) {
        failCount++;
        console.error('❌ Failed to send notification:', error.message);
        // Don't add invalid subscriptions back
      }
    }

    // Update subscriptions file (remove invalid ones)
    if (validSubscriptions.length !== subscriptions.length) {
      saveSubscriptions(validSubscriptions);
      console.log(`🧹 Removed ${subscriptions.length - validSubscriptions.length} invalid subscription(s)`);
    }

    res.json({
      success: true,
      message: 'Notifications sent',
      sent: successCount,
      failed: failCount
    });

  } catch (error) {
    console.error('Error sending notifications:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send notifications'
    });
  }
});

// GET /api/push/subscriptions - Get all subscriptions (for debugging)
router.get('/subscriptions', (req, res) => {
  const subscriptions = readSubscriptions();
  res.json({
    success: true,
    count: subscriptions.length,
    subscriptions: subscriptions
  });
});

// POST /api/push/unsubscribe - Remove a push subscription
router.post('/unsubscribe', (req, res) => {
  const subscription = req.body;

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({
      success: false,
      error: 'Invalid subscription object'
    });
  }

  try {
    const subscriptions = readSubscriptions();
    
    // Filter out the subscription to remove
    const filtered = subscriptions.filter(sub => sub.endpoint !== subscription.endpoint);
    
    if (filtered.length < subscriptions.length) {
      saveSubscriptions(filtered);
      console.log('✅ Subscription removed:', subscription.endpoint);
      return res.json({
        success: true,
        message: 'Subscription removed successfully'
      });
    } else {
      return res.json({
        success: true,
        message: 'Subscription not found (may already be removed)'
      });
    }
  } catch (error) {
    console.error('Error removing subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to remove subscription'
    });
  }
});

module.exports = router;