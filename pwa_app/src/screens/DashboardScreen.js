import React, { useMemo, useState, useCallback, useEffect } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import "../styles/Dashboard.css";
import UploadScreen from "./UploadScreen";
import AlertScreen from "./AlertScreen";
import Security2FA from "./Security2FA";
import SafeImage from '../components/SafeImage'; // 🆕 Import SafeImage
import { API_BASE, getHeaders } from '../config/pushConfig';

export default function DashboardScreen({ title = "Dashboard", onLogout }) {
  const [activeScreen, setActiveScreen] = useState("dashboard");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [timeframe, setTimeframe] = useState("7d");

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [summary, setSummary] = useState({ totalDetections: 0, totalAlerts: 0, uploadsProcessed: 0 });
  const [timelineData, setTimelineData] = useState([]);
  const [speciesData, setSpeciesData] = useState([]);
  const [alertData, setAlertData] = useState([]);
  const [recentDetections, setRecentDetections] = useState([]);
  const [loading, setLoading] = useState(true);

  const API_URL = API_BASE;

  const auth = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("auth")); } catch { return null; }
  }, []);
  const user = auth?.user ?? auth ?? {};
  const name = user?.name || user?.username || "User";
  const role = user?.role || "unknown";

  useEffect(() => {
    const openScreen = sessionStorage.getItem('openScreen');
    if (openScreen === 'alerts') {
      setActiveScreen('alerts');
      sessionStorage.removeItem('openScreen');
    }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [summaryRes, timelineRes, speciesRes, alertRes, recentRes] = await Promise.all([
          fetch(`${API_URL}/api/stats/summary?timeframe=${timeframe}`, {
            headers: getHeaders()
          }),
          fetch(`${API_URL}/api/stats/detections-timeline?timeframe=${timeframe}`, {
            headers: getHeaders()
          }),
          fetch(`${API_URL}/api/stats/species-breakdown?timeframe=${timeframe}`, {
            headers: getHeaders()
          }),
          fetch(`${API_URL}/api/stats/alert-outcomes?timeframe=${timeframe}`, {
            headers: getHeaders()
          }),
          fetch(`${API_URL}/api/stats/recent-detections?limit=3`, {
            headers: getHeaders()
          }),
        ]);

        const summaryData = await summaryRes.json();
        const timelineDataRes = await timelineRes.json();
        const speciesDataRes = await speciesRes.json();
        const alertDataRes = await alertRes.json();
        const recentDataRes = await recentRes.json();

        setSummary(summaryData.data || { totalDetections: 0, totalAlerts: 0, uploadsProcessed: 0 });
        setTimelineData(timelineDataRes.data || []);
        setSpeciesData(speciesDataRes.data || []);
        setAlertData(alertDataRes.data || []);
        setRecentDetections(recentDataRes.data || []);
      } catch (error) {
        console.error("Failed to fetch stats:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [timeframe, API_URL]);

  const handleLogout = () => {
    if (onLogout) onLogout();
    else { localStorage.removeItem("auth"); window.location.href = "/"; }
  };
  
  const handleAlertsClick = () => {
    setActiveScreen("alerts");
    setSidebarOpen(false);
  };

  const formatLabel = useCallback((label) => {
    if (timeframe === "24h") {
      const parts = label.split(" ");
      return parts[1] || label;
    } else {
      const date = new Date(label);
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
  }, [timeframe]);

  const formattedTimeline = useMemo(() => {
    return timelineData.map(item => ({
      ...item,
      label: formatLabel(item.label),
    }));
  }, [timelineData, formatLabel]);

  return (
    <div className="dashboard">
      <div className="top-navbar">
        <button className="hamburger-btn" aria-label="Open menu" onClick={() => setSidebarOpen(true)}>☰</button>
        <div className="logo">WildTrack</div>
        <div className="right-side">
          <div className="profile-name" onClick={() => setDropdownOpen(!dropdownOpen)}>
            {name} ({role}) ⌄
          </div>
          {dropdownOpen && (
            <ul className="dropdown-menu">
              <li>Profile</li>
              <li onClick={() => { setActiveScreen("settings"); setDropdownOpen(false); }}>Settings</li>
              <li className="logout" onClick={handleLogout}>Logout</li>
            </ul>
          )}
        </div>
      </div>

      {sidebarOpen && <div className="overlay" onClick={() => setSidebarOpen(false)} />}

      <div className="main-area">
        <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
          <button className="close-sidebar" onClick={() => setSidebarOpen(false)}>✕</button>
          <h2>{title}</h2>
          <nav>
            <ul>
              <li onClick={() => { setActiveScreen("dashboard"); setSidebarOpen(false); }} className={activeScreen === "dashboard" ? "active" : ""}>Dashboard</li>
              <li onClick={() => { setActiveScreen("uploads"); setSidebarOpen(false); }} className={activeScreen === "uploads" ? "active" : ""}>Uploads</li>
              <li onClick={handleAlertsClick} className={activeScreen === "alerts" ? "active" : ""}>Alerts</li>
              <li onClick={() => { setActiveScreen("settings"); setSidebarOpen(false); }} className={activeScreen === "settings" ? "active" : ""}>Settings</li>
            </ul>
          </nav>
        </aside>

        <main className="main-content">
          {activeScreen === "dashboard" && (
            <>
              {loading && <div className="loading">Loading stats...</div>}
              {!loading && (
                <>
                  <div className="summary-cards">
                    <div className="card"><h3>Total Detections ({timeframe})</h3><p>{summary.totalDetections}</p></div>
                    <div className="card"><h3>Total Alerts ({timeframe})</h3><p>{summary.totalAlerts}</p></div>
                    <div className="card"><h3>Total Uploads Processed</h3><p>{summary.uploadsProcessed}</p></div>
                  </div>

                  <div className="timeframe-toggle">
                    {["24h", "7d", "30d"].map(t => (
                      <button key={t} className={timeframe === t ? "active" : ""} onClick={() => setTimeframe(t)}>
                        {t === "24h" ? "Last 24h" : t === "7d" ? "Last 7 days" : "Last 30 days"}
                      </button>
                    ))}
                  </div>

                  <div className="charts-grid">
                    <ChartCard title="Detections vs Alerts (by time)">
                      {formattedTimeline.length > 0 ? (
                        <ResponsiveContainer width="100%" height={260}>
                          <LineChart data={formattedTimeline} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="label" height={36} minTickGap={10} tickMargin={8} />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Legend wrapperStyle={{ paddingTop: 8 }} />
                            <Line type="monotone" dataKey="detections" name="Detections" stroke="#457b9d" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="alerts" name="Alerts" stroke="#e63946" strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : <div className="no-data">No data available</div>}
                    </ChartCard>

                    <ChartCard title="Detections by Species">
                      {speciesData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={260}>
                          <BarChart data={speciesData.slice(0, 5)} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="species" tickMargin={8} />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Bar dataKey="count" name="Detections" fill="#457b9d" />
                          </BarChart>
                        </ResponsiveContainer>
                      ) : <div className="no-data">No species data</div>}
                    </ChartCard>
                  </div>

                  <div className="recent-detections">
                    <h3>Recent Detections</h3>
                    {recentDetections.length > 0 ? (
                      <ul>
                        {recentDetections.map((det, idx) => (
                          <li key={idx}>
                            {/* 🆕 Using SafeImage for cloud-ready thumbnails */}
                            <div style={{ width: 40, height: 40, marginRight: 10, borderRadius: 4, overflow: 'hidden' }}>
                              <SafeImage
                                src={det.image}
                                alt={det.species}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            </div>
                            <span>{det.species} - {new Date(det.time).toLocaleTimeString()}</span>
                          </li>
                        ))}
                      </ul>
                    ) : <p>No recent detections</p>}
                  </div>

                  <div className="quick-actions">
                    <button className="upload-btn" onClick={() => setActiveScreen("uploads")}>+ Quick Upload</button>
                    <button className="alerts-btn" onClick={handleAlertsClick}>View All Alerts</button>
                  </div>
                </>
              )}
            </>
          )}

          {activeScreen === "uploads" && <UploadScreen />}
          {activeScreen === "alerts" && <AlertScreen goBack={() => setActiveScreen("dashboard")} />}
          {activeScreen === "settings" && <Security2FA />}
        </main>
      </div>
    </div>
  );
}

function ChartCard({ title, children }) {
  return (
    <div className="chart-card">
      <div className="chart-card-header"><h3>{title}</h3></div>
      <div className="chart-card-body">{children}</div>
    </div>
  );
}