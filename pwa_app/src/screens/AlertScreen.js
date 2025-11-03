import React, { useEffect, useState, useMemo } from "react";
import { API_BASE, getHeaders } from '../config/pushConfig';
import SafeImage from '../components/SafeImage'; // 🆕 Import SafeImage
import "../styles/Alert.css";

export default function AlertScreen({ goBack }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // 🆕 Filter state
  const [filterPriority, setFilterPriority] = useState("all"); // "all" | "high" | "medium"
  const [filterSpecies, setFilterSpecies] = useState("all"); // "all" | specific species

  useEffect(() => {
    const fetchAlerts = () => {
      // Use the SAME endpoint that works for dashboard
      fetch(`${API_BASE}/api/stats/recent-detections?limit=50`, {
        headers: getHeaders()
      })
        .then((res) => res.json())
        .then((response) => {
          console.log('🔍 Received data:', response);
          
          if (!response.data || !Array.isArray(response.data)) {
            setError("Invalid response format");
            setLoading(false);
            return;
          }

          const detections = response.data;
          
          // Transform detections into alert format
          const formattedAlerts = detections.map((det) => ({
            id: det._id || det.id,
            animal: det.species.charAt(0).toUpperCase() + det.species.slice(1),
            message: `${det.alertLevel === "high" ? "🚨" : "⚠️"} ${det.species.charAt(0).toUpperCase() + det.species.slice(1)} detected`,
            time: new Date(det.time).toLocaleTimeString("en-US", {
              hour: "numeric",
              minute: "2-digit",
              hour12: true,
            }),
            snapshot: det.image,
            video: det.video || 'Unknown',
            alertLevel: det.alertLevel || 'medium',
            species: det.species.toLowerCase(),
          }));

          setAlerts(formattedAlerts);
          setLoading(false);
        })
        .catch((err) => {
          console.error("Error fetching detections:", err);
          setError("Failed to connect to server");
          setLoading(false);
        });
    };

    // Fetch immediately on mount
    fetchAlerts();

    // Then fetch every 10 seconds for auto-refresh
    const interval = setInterval(fetchAlerts, 10000);

    // Cleanup on unmount
    return () => clearInterval(interval);
  }, []);

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
                {/* 🆕 USE SafeImage instead of regular img */}
                <SafeImage
                  src={alert.snapshot}
                  alt={`${alert.animal} detection`}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover'
                  }}
                  onError={(e) => {
                    console.error('Image load error:', alert.snapshot);
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