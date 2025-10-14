import React, { useEffect, useState } from "react";
import "../styles/Alert.css";

export default function AlertScreen({ goBack }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 🔹 Simulate fetching alerts (replace with API later)
    setTimeout(() => {
      const sampleAlerts = [
        { id: 1, animal: "Lion", message: "⚠️ Lion detected near waterhole", time: "10:30 AM" },
        { id: 2, animal: "Elephant", message: "⚠️ Elephant herd crossing farms", time: "9:15 AM" },
        { id: 3, animal: "Rhino", message: "⚠️ Rhino spotted at north sector", time: "8:50 AM" },
      ];
      setAlerts(sampleAlerts);
      setLoading(false);
    }, 1000); // simulate network delay
  }, []);

  if (loading) {
    return (
      <div className="alerts-screen">
        <div className="alerts-header">
          <button onClick={goBack} className="back-button">← Back</button>
          <h2>📢 Wildlife Alerts</h2>
        </div>
        <p>Loading alerts...</p>
      </div>
    );
  }

  return (
    <div className="alerts-screen">
      <div className="alerts-header">
        <button onClick={goBack} className="back-button">← Back</button>
        <h2>📢 Wildlife Alerts</h2>
      </div>
      {alerts.length === 0 ? (
        <p>No alerts available.</p>
      ) : (
        <ul className="alerts-list">
          {alerts.map((alert) => (
            <li key={alert.id} className="alert-item">
              <div className="alert-message">{alert.message}</div>
              <div className="alert-time">{alert.time}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}