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
    "background": "Background",
    "elephant, elephant": "Elephant",
    "lion, lion": "Lion",
    "zebra, zebra": "Zebra", 
    "zebra, zebra, zebra": "Zebra",
    "warthog, warthog": "Warthog",
    "baboon, baboon": "Baboon",
  };

  const normalizeSpecies = (species) => {
    const normalized = species.toLowerCase().trim();
    if (speciesMapping[normalized]) return speciesMapping[normalized];
    
    const standardSpecies = ["elephant", "lion", "baboon", "zebra", "warthog", "background"];
    for (const standard of standardSpecies) {
      if (normalized.includes(standard)) return speciesMapping[standard];
    }
    return species.charAt(0).toUpperCase() + species.slice(1);
  };

  useEffect(() => {
    const fetchAlerts = () => {
      fetch(`${API_BASE}/api/newstats/recent-detections?limit=50`, {
        headers: getHeaders()
      })
        .then((res) => res.json())
        .then((response) => {
          if (!response.data || !Array.isArray(response.data)) {
            setError("Invalid response format");
            setLoading(false);
            return;
          }

          const formattedAlerts = response.data.map((det) => {
            const normalizedSpecies = normalizeSpecies(det.species);
            return {
              id: det.id,
              animal: normalizedSpecies,
              message: `${det.alertLevel === "high" ? "🚨" : det.alertLevel === "medium" ? "⚠️" : "ℹ️"} ${normalizedSpecies} detected`,
              time: new Date(det.time).toLocaleTimeString("en-US", {
                hour: "numeric", minute: "2-digit", hour12: true,
              }),
              snapshot: det.image, // Passed to SafeImage
              video: det.video || 'Unknown',
              alertLevel: det.alertLevel || 'medium',
              species: normalizedSpecies.toLowerCase(),
            };
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
    const interval = setInterval(fetchAlerts, 10000);
    return () => clearInterval(interval);
  }, []);

  const speciesList = useMemo(() => {
    const preferredOrder = ["background", "elephant", "lion", "baboon", "zebra", "warthog"];
    const uniqueFromAlerts = [...new Set(alerts.map(a => a.species))];
    const orderedSpecies = [];
    
    preferredOrder.forEach(species => {
      if (uniqueFromAlerts.includes(species)) orderedSpecies.push(species);
    });
    uniqueFromAlerts.forEach(species => {
      if (!preferredOrder.includes(species) && !orderedSpecies.push(species));
    });
    
    return orderedSpecies;
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
        <p>No alerts available matching filters.</p>
      ) : (
        <ul className="alerts-list">
          {filteredAlerts.map((alert) => (
            <li key={alert.id} className={`alert-item alert-${alert.alertLevel}`}>
              <div className="alert-image">
                {/* 🆕 Cloud-ready image loading */}
                <SafeImage
                  src={alert.snapshot}
                  alt={alert.animal}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
              <div className="alert-content">
                <div className="alert-message">{alert.message}</div>
                <div className="alert-time">{alert.time}</div>
                <div className="alert-meta"><small>Video: {alert.video}</small></div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}