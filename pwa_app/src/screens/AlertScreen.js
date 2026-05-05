import React, { useEffect, useState, useMemo } from "react";
import { API_BASE, getHeaders } from '../config/pushConfig';
import SafeImage from '../components/SafeImage'; 
import "../styles/Alert.css";

export default function AlertScreen({ goBack }) {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterSpecies, setFilterSpecies] = useState("all");

  const speciesMapping = {
    "elephant": "Elephant",
    "lion": "Lion", 
    "baboon": "Baboon",
    "zebra": "Zebra",
    "warthog": "Warthog",
    "background": "Background"
  };

  const normalizeSpecies = (species) => {
    if (!species) return "Unknown";
    const normalized = species.toLowerCase().trim();
    
    // Check for direct mapping or compound names (e.g., "elephant, elephant")
    for (const key in speciesMapping) {
      if (normalized.includes(key)) return speciesMapping[key];
    }
    return species.charAt(0).toUpperCase() + species.slice(1);
  };

  useEffect(() => {
    const fetchAlerts = () => {
      // CHANGED: Use /api/uploads/detections as it matches your working Dashboard
      fetch(`${API_BASE}/api/uploads/detections?limit=50`, {
        headers: getHeaders()
      })
        .then((res) => res.json())
        .then((response) => {
          // Changed to match the "detections" array structure from your backend
          const rawData = response.detections || response.data || [];
          
          if (!Array.isArray(rawData)) {
            setError("Invalid response format");
            setLoading(false);
            return;
          }

          // Replace the previous 'time' logic with this more robust version:
          const formattedAlerts = [];

          rawData.forEach((det) => {
            if (det.alerts && Array.isArray(det.alerts)) {
              det.alerts.forEach((alert, index) => {
                const normalizedSpecies = normalizeSpecies(alert.species);
                
                // Use the detection's creation date as the fallback
                const alertDate = alert.timestamp ? new Date(alert.timestamp) : new Date(det.createdAt);

                formattedAlerts.push({
                  id: `${det._id}-${index}`,
                  animal: normalizedSpecies,
                  message: `${alert.priority === "high" ? "🚨" : "ℹ️"} ${normalizedSpecies} detected`,
                  
                  // This will now show the actual time of the upload
                  time: alertDate.toLocaleTimeString("en-US", {
                    hour: "numeric", 
                    minute: "2-digit", 
                    hour12: true,
                  }),
                  
                  snapshot: alert.image, 
                  video: det.video?.originalName || 'Processed Video',
                  alertLevel: alert.priority || 'medium',
                  species: normalizedSpecies.toLowerCase(),
                });
              });
            }
          });
          
          setAlerts(formattedAlerts);
          setLoading(false);
        })
        .catch((err) => {
          setError("Failed to connect to server");
          setLoading(false);
        });
    };

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 15000); // 15s interval for better performance
    return () => clearInterval(interval);
  }, []);

  const speciesList = useMemo(() => {
    const preferredOrder = ["elephant", "lion", "baboon", "zebra", "warthog"];
    const uniqueFromAlerts = [...new Set(alerts.map(a => a.species))];
    return preferredOrder.filter(s => uniqueFromAlerts.includes(s));
  }, [alerts]);

  const filteredAlerts = useMemo(() => {
    return alerts.filter(alert => {
      if (filterPriority !== "all" && alert.alertLevel !== filterPriority) return false;
      if (filterSpecies !== "all" && alert.species !== filterSpecies) return false;
      return true;
    });
  }, [alerts, filterPriority, filterSpecies]);

  if (loading) return <div className="alerts-screen"><p>Loading alerts...</p></div>;
  if (error) return <div className="alerts-screen"><p style={{ color: "red" }}>Error: {error}</p></div>;

  return (
    <div className="alerts-screen">
      <div className="alerts-header">
        <button onClick={goBack} className="back-button">← Back</button>
        <h2>📢 Wildlife Alerts</h2>
      </div>

      <div className="alert-filters">
        <div className="filter-group">
          <label>Priority:</label>
          <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} className="filter-select">
            <option value="all">All Priorities</option>
            <option value="high">🚨 High</option>
            <option value="medium">⚠️ Medium</option>
            <option value="low">ℹ️ Low</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Species:</label>
          <select value={filterSpecies} onChange={(e) => setFilterSpecies(e.target.value)} className="filter-select">
            <option value="all">All Species</option>
            {speciesList.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
          </select>
        </div>
      </div>

      {filteredAlerts.length === 0 ? (
        <div className="no-alerts-container">
          <p>No alerts available. Try uploading a video to trigger detections.</p>
        </div>
      ) : (
        <ul className="alerts-list">
          {filteredAlerts.map((alert) => (
            <li key={alert.id} className={`alert-item alert-${alert.alertLevel}`}>
              <div className="alert-image">
                <SafeImage
                  src={alert.snapshot}
                  alt={alert.animal}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <div className="alert-content">
                <div className="alert-message">{alert.message}</div>
                <div className="alert-time">{alert.time}</div>
                <div className="alert-meta"><small>Source: {alert.video}</small></div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}