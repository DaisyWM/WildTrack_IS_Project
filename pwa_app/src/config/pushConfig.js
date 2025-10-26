// src/config/pushConfig.js
export const VAPID_PUBLIC_KEY =
  "BK-O_nsz9JXgvn6Lqxxrs8Gpks5fwE2yuxMc1lTB2DCxes7oGb2jFcubGZ39yTKxwOZ7Mg_ijWlUhSuqYOevWnA";

// Detect if running on localhost or network
const hostname = window.location.hostname;

// Use HTTP (not HTTPS) since your backend is on HTTP
export const API_BASE = 
  hostname === 'localhost' || hostname === '127.0.0.1'
    ? "http://localhost:5000"  // When testing on same computer
    : "http://192.168.0.100:5000";  // When testing on phone or other device