// src/config/pushConfig.js
export const VAPID_PUBLIC_KEY =
  "BK-O_nsz9JXgvn6Lqxxrs8Gpks5fwE2yuxMc1lTB2DCxes7oGb2jFcubGZ39yTKxwOZ7Mg_ijWlUhSuqYOevWnA";

// Your NEW ngrok URL
//const NGROK_URL = "https://nontheosophic-lieselotte-morphogenetic.ngrok-free.dev";
const NGROK_URL = "https://a95c-197-232-244-180.ngrok-free.app";

// Detect if running on localhost or deployed
const hostname = window.location.hostname;
const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';

export const API_BASE = isLocalhost
  ? "http://localhost:5001"           // Local development
  : NGROK_URL;                         // Deployed on Vercel

console.log(`🔗 API Base URL: ${API_BASE}`);
console.log(`📱 Detected hostname: ${hostname}`);

// Helper function to get headers
export const getHeaders = (additionalHeaders = {}) => {
  return {
    'ngrok-skip-browser-warning': 'true',
    'Content-Type': 'application/json',
    ...additionalHeaders
  };
};