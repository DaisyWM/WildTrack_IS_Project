import React, { useEffect, useState, useMemo } from "react";
import "../styles/Alert.css";

export default function AlertScreen({ goBack }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // 🆕 Filter state
  const [filterPriority, setFilterPriority] = useState("all"); // "all" | "high" | "medium"
  const [filterSpecies, setFilterSpecies] = useState("all"); // "all" | specific species

  // Auto-detect: use localhost on computer, IP address on phone
  const hostname = window.location.hostname;
  const API_BASE = 
    hostname === 'localhost' || hostname === '127.0.0.1'
      ? "http://localhost:5000"
      : "http://192.168.0.100:5000";

  useEffect(() => {
    // Fetch detection history from backend
    fetch(`${API_BASE}/api/detections/history`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          // Transform detections into alert format
          const formattedAlerts = data.detections.map((detection) => {
            const primarySpecies =
              detection.snapshot.detections[0]?.species || "Unknown";
            const confidence =
              detection.snapshot.detections[0]?.confidence || 0;
            const alertLevel = detection.snapshot.alert_level;

            const detectionTime = new Date(detection.timestamp);
            const timeStr = detectionTime.toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            });

            return {
              id: detection.id,
              animal:
                primarySpecies.charAt(0).toUpperCase() + primarySpecies.slice(1),
              message: `${
                alertLevel === "high" ? "🚨" : "⚠️"
              } ${primarySpecies.charAt(0).toUpperCase() + primarySpecies.slice(1)
                } detected (${Math.round(confidence * 100)}% confidence)`,
              time: timeStr,
              snapshot: detection.snapshot.path,
              video: detection.video,
              alertLevel: alertLevel,
              species: primarySpecies.toLowerCase(),
            };
          });

          setAlerts(formattedAlerts.reverse()); // newest first
          setLoading(false);
        } else {
          setError("Failed to load detections");
          setLoading(false);
        }
      })
      .catch((err) => {
        console.error("Error fetching detections:", err);
        setError("Failed to connect to server");
        setLoading(false);
      });
  }, [API_BASE]);

  // 🆕 Get unique species list for filter dropdown
  const speciesList = useMemo(() => {
    const unique = [...new Set(alerts.map(a => a.species))];
    return unique.sort();
  }, [alerts]);

  // 🆕 Filter alerts based on selected filters
  const filteredAlerts = useMemo(() => {
    return alerts.filter(alert => {
      // Priority filter
      if (filterPriority !== "all" && alert.alertLevel !== filterPriority) {
        return false;
      }
      
      // Species filter
      if (filterSpecies !== "all" && alert.species !== filterSpecies) {
        return false;
      }
      
      return true;
    });
  }, [alerts, filterPriority, filterSpecies]);

  if (loading) {
    return (
      <div className="alerts-screen">
        <div className="alerts-header">
          <button onClick={goBack} className="back-button">
            ← Back
          </button>
          <h2>📢 Wildlife Alerts</h2>
        </div>
        <p>Loading alerts...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="alerts-screen">
        <div className="alerts-header">
          <button onClick={goBack} className="back-button">
            ← Back
          </button>
          <h2>📢 Wildlife Alerts</h2>
        </div>
        <p style={{ color: "red" }}>Error: {error}</p>
      </div>
    );
  }

  return (
    <div className="alerts-screen">
      <div className="alerts-header">
        <button onClick={goBack} className="back-button">
          ← Back
        </button>
        <h2>📢 Wildlife Alerts</h2>
      </div>

      {/* 🆕 Filter Controls */}
      <div className="alert-filters">
        <div className="filter-group">
          <label htmlFor="priority-filter">Priority:</label>
          <select 
            id="priority-filter"
            value={filterPriority} 
            onChange={(e) => setFilterPriority(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Priorities</option>
            <option value="high">🚨 High Priority</option>
            <option value="medium">⚠️ Medium Priority</option>
          </select>
        </div>

        <div className="filter-group">
          <label htmlFor="species-filter">Species:</label>
          <select 
            id="species-filter"
            value={filterSpecies} 
            onChange={(e) => setFilterSpecies(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Species</option>
            {speciesList.map(species => (
              <option key={species} value={species}>
                {species.charAt(0).toUpperCase() + species.slice(1)}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-stats">
          Showing {filteredAlerts.length} of {alerts.length} alerts
        </div>
      </div>

      {/* Alerts List */}
      {filteredAlerts.length === 0 ? (
        <p>
          {alerts.length === 0 
            ? "No alerts available. Upload and process a video to see detections!"
            : "No alerts match the selected filters."
          }
        </p>
      ) : (
        <ul className="alerts-list">
          {filteredAlerts.map((alert) => (
            <li key={alert.id} className={`alert-item alert-${alert.alertLevel}`}>
              <div className="alert-image">
                <img
                  src={`${API_BASE}${alert.snapshot}`}
                  alt={`${alert.animal} detection`}
                  onError={(e) => {
                    e.target.src =
                      "https://via.placeholder.com/400x300?text=Image+Not+Found";
                  }}
                />
              </div>

              <div className="alert-content">
                <div className="alert-message">{alert.message}</div>
                <div className="alert-time">{alert.time}</div>
                <div className="alert-meta">
                  <small>Video: {alert.video}</small>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}