// src/components/PushSubscribeButton.js
import React, { useState } from "react";
import { VAPID_PUBLIC_KEY, API_BASE } from "../config/pushConfig";

/* helper: convert VAPID key */
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export default function PushSubscribeButton() {
  const [status, setStatus] = useState("idle"); // idle | registering | subscribed | error

  async function subscribe() {
    try {
      if (!("serviceWorker" in navigator)) {
        setStatus("error");
        alert("Service workers not supported in this browser.");
        return;
      }
      // Register SW (scope is root because file is in public/)
      setStatus("registering");
      const reg = await navigator.serviceWorker.register("/service-worker.js");
      console.log("Service Worker registered:", reg);

      // Request permission
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setStatus("error");
        alert("Notifications permission not granted.");
        return;
      }

      // Subscribe to push
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
      console.log("Push subscription:", subscription);

      // Send subscription to backend - CORRECTED ENDPOINT
      const res = await fetch(`${API_BASE}/api/push/subscribe`, { // **FIXED: changed /notifications to /push**
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      });

      const json = await res.json();
      console.log("Subscribe response:", json);
      if (json.success) {
        setStatus("subscribed");
        alert("Subscribed to push notifications ✅");
        window.dispatchEvent(new Event("push-subscription-updated"));
      } else {
        setStatus("error");
        alert("Failed to save subscription on server");
      }
    } catch (err) {
      console.error("Subscribe error:", err);
      setStatus("error");
      alert("Subscription failed — see console for details");
    }
  }

  async function unsubscribe() {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) return;

      await sub.unsubscribe();
      console.log("✅ Unsubscribed old push subscription");

      // Remove subscription from backend - CORRECTED ENDPOINT
      await fetch(`${API_BASE}/api/push/unsubscribe`, { // **FIXED: changed /notifications to /push**
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });

      setStatus("idle");
      alert("Unsubscribed from push notifications");
      window.dispatchEvent(new Event("push-subscription-updated"));
    } catch (err) {
      console.error("Unsubscribe error:", err);
      alert("Failed to unsubscribe — see console for details");
    }
  }

  return (
    <div>
      <button 
        onClick={subscribe} 
        disabled={status === "registering" || status === "subscribed"}
        style={{
          background: status === "subscribed" ? "#10b981" : "#2563eb",
          color: "white",
          border: "none",
          padding: "0.5rem 0.9rem",
          borderRadius: 6,
          cursor: status === "registering" || status === "subscribed" ? "not-allowed" : "pointer",
          opacity: status === "registering" || status === "subscribed" ? 0.6 : 1
        }}
      >
        {status === "registering" 
          ? "Enabling..." 
          : status === "subscribed" 
            ? "Notifications Enabled ✓" 
            : "Enable Notifications"}
      </button>
      {status === "error" && (
        <div style={{ color: "#dc2626", marginTop: 8, fontSize: "0.9rem" }}>
          Error: Check console for details
        </div>
      )}
    </div>
  );
}