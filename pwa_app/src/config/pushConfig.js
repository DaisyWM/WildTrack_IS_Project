// src/config/pushConfig.js
export const VAPID_PUBLIC_KEY =
  "BK-O_nsz9JXgvn6Lqxxrs8Gpks5fwE2yuxMc1lTB2DCxes7oGb2jFcubGZ39yTKxwOZ7Mg_ijWlUhSuqYOevWnA";

// Your ngrok URL (permanent until you restart ngrok)
const NGROK_URL = "https://60d9a40d5a41.ngrok-free.app";

// Detect if running on localhost or deployed
const hostname = window.location.hostname;
const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

// Use localhost for local development, ngrok URL for deployed app
export const API_BASE = isLocalhost
  ? "http://localhost:5000"           // Local development
  : NGROK_URL;                         // Deployed frontend (uses ngrok)