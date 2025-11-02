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
import { API_BASE, getHeaders } from '../config/pushConfig';

export default function DashboardScreen({ title = "Dashboard", onLogout }) {
  const [activeScreen, setActiveScreen] = useState("dashboard");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [timeframe, setTimeframe] = useState("7d"); // 24h | 7d | 30d

  // NEW: mobile drawer toggle
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Real data from API
  const [summary, setSummary] = useState({ totalDetections: 0, totalAlerts: 0, uploadsProcessed: 0 });
  const [timelineData, setTimelineData] = useState([]);
  const [speciesData, setSpeciesData] = useState([]);
  const [alertData, setAlertData] = useState([]);
  const [recentDetections, setRecentDetections] = useState([]);
  const [loading, setLoading] = useState(true);

  // Auto-detect: use localhost on computer, IP address on phone
  const API_URL = API_BASE;

  // Read logged-in user from localStorage
  const auth = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("auth")); } catch { return null; }
  }, []);
  const user = auth?.user ?? auth ?? {};
  const name = user?.name || user?.username || "User";
  const role = user?.role || "unknown";

  // 🆕 Check if we should auto-open alerts (from notification click)
  useEffect(() => {
    const openScreen = sessionStorage.getItem('openScreen');
    if (openScreen === 'alerts') {
      setActiveScreen('alerts');
      sessionStorage.removeItem('openScreen'); // Clear it so it doesn't persist
    }
  }, []);

  // Fetch data from API
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
          fetch(`${API_URL}/api/stats/species-breakdown`, {
            headers: getHeaders()
          }),
          fetch(`${API_URL}/api/stats/alert-outcomes`, {
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
    setSidebarOpen(false); // close drawer on navigation (mobile)
  };

  // Format labels based on timeframe
  const formatLabel = useCallback((label) => {
    if (timeframe === "24h") {
      const parts = label.split(" ");
      return parts[1] || label;
    } else {
      const date = new Date(label);
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
  }, [timeframe]);

  // Format timeline data for charts
  const formattedTimeline = useMemo(() => {
    return timelineData.map(item => ({
      ...item,
      label: formatLabel(item.label),
    }));
  }, [timelineData, formatLabel]);

  return (
    <div className="dashboard">
      {/* Top Navbar */}
      <div className="top-navbar">
        <button
          className="hamburger-btn"
          aria-label="Open menu"
          onClick={() => setSidebarOpen(true)}
        >
          ☰
        </button>

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

      {/* Overlay for mobile */}
      {sidebarOpen && <div className="overlay" onClick={() => setSidebarOpen(false)} />}

      {/* Main area: Sidebar + Main Content */}
      <div className="main-area">
        {/* Sidebar */}
        <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
          <button className="close-sidebar" onClick={() => setSidebarOpen(false)}>✕</button>
          <h2>{title}</h2>
          <nav>
            <ul>
              <li
                onClick={() => { setActiveScreen("dashboard"); setSidebarOpen(false); }}
                className={activeScreen === "dashboard" ? "active" : ""}
              >
                Dashboard
              </li>
              <li
                onClick={() => { setActiveScreen("uploads"); setSidebarOpen(false); }}
                className={activeScreen === "uploads" ? "active" : ""}
              >
                Uploads
              </li>
              <li
                onClick={handleAlertsClick}
                className={activeScreen === "alerts" ? "active" : ""}
              >
                Alerts
              </li>
              <li
                onClick={() => { setActiveScreen("settings"); setSidebarOpen(false); }}
                className={activeScreen === "settings" ? "active" : ""}
              >
                Settings
              </li>
            </ul>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="main-content">
          {activeScreen === "dashboard" && (
            <>
              {loading && <div className="loading">Loading stats...</div>}
              {!loading && (
                <>
                  {/* Summary Cards - REAL DATA */}
                  <div className="summary-cards">
                    <div className="card">
                      <h3>Total Detections ({timeframe})</h3>
                      <p>{summary.totalDetections}</p>
                    </div>
                    <div className="card">
                      <h3>Total Alerts ({timeframe})</h3>
                      <p>{summary.totalAlerts}</p>
                    </div>
                    <div className="card">
                      <h3>Total Uploads Processed</h3>
                      <p>{summary.uploadsProcessed}</p>
                    </div>
                  </div>

                  {/* Timeframe Toggle */}
                  <div className="timeframe-toggle">
                    <button className={timeframe === "24h" ? "active" : ""} onClick={() => setTimeframe("24h")}>
                      Last 24h
                    </button>
                    <button className={timeframe === "7d" ? "active" : ""} onClick={() => setTimeframe("7d")}>
                      Last 7 days
                    </button>
                    <button className={timeframe === "30d" ? "active" : ""} onClick={() => setTimeframe("30d")}>
                      Last 30 days
                    </button>
                  </div>

                  {/* Analytics Grid - REAL DATA */}
                  <div className="charts-grid">
                    {/* 1) Detections vs Alerts - REAL DATA */}
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
                      ) : (
                        <div className="no-data">No data available for this timeframe</div>
                      )}
                    </ChartCard>

                    {/* 2) Species - REAL DATA */}
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
                      ) : (
                        <div className="no-data">No species data available</div>
                      )}
                    </ChartCard>

                    {/* 3) Alerts Over Time - REAL DATA */}
                    <ChartCard title="Alerts Over Time">
                      {formattedTimeline.length > 0 ? (
                        <ResponsiveContainer width="100%" height={260}>
                          <AreaChart data={formattedTimeline} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorAlerts" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#e63946" stopOpacity={0.45} />
                                <stop offset="95%" stopColor="#e63946" stopOpacity={0.06} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="label" height={36} minTickGap={10} tickMargin={8} />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Area type="monotone" dataKey="alerts" name="Alerts" stroke="#e63946" strokeWidth={2} fill="url(#colorAlerts)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="no-data">No alert data available</div>
                      )}
                    </ChartCard>

                    {/* 4) Alert Outcomes - REAL DATA */}
                    <ChartCard title="Alert Outcomes">
                      {alertData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={260}>
                          <PieChart>
                            <Tooltip />
                            <Legend />
                            <Pie data={alertData} dataKey="value" nameKey="name" outerRadius={90} label>
                              {alertData.map((_, i) => (
                                <Cell key={i} fill={["#e63946", "#457b9d", "#ffb703"][i % 3]} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="no-data">No alert outcome data</div>
                      )}
                    </ChartCard>
                  </div>

                  {/* Recent Detections - REAL DATA */}
                  <div className="recent-detections">
                    <h3>Recent Detections</h3>
                    {recentDetections.length > 0 ? (
                      <ul>
                        {recentDetections.map((det, idx) => (
                          <li key={idx}>
                            <img
                              src={det.image ? `${API_URL}${det.image}` : "https://via.placeholder.com/40"}
                              alt={det.species}
                              onError={(e) => e.target.src = "https://via.placeholder.com/40"}
                            />
                            <span>{det.species} - {new Date(det.time).toLocaleTimeString()}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p>No recent detections</p>
                    )}
                  </div>

                  {/* Quick Actions */}
                  <div className="quick-actions">
                    <button className="upload-btn" onClick={() => { setActiveScreen("uploads"); setSidebarOpen(false); }}>+ Quick Upload</button>
                    <button className="alerts-btn" onClick={handleAlertsClick}>View All Alerts</button>
                  </div>

                  {/* Mini Alerts Panel */}
                  <div className="alerts-panel">
                    <h3>Recent Alerts</h3>
                    {summary.totalAlerts > 0 ? (
                      <ul>
                        <li>⚠️ {summary.totalAlerts} alert(s) in the last {timeframe}</li>
                      </ul>
                    ) : (
                      <p>No recent alerts</p>
                    )}
                    <button className="view-all-alerts" onClick={handleAlertsClick}>View All →</button>
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

/** Simple content wrapper for charts */
function ChartCard({ title, children }) {
  return (
    <div className="chart-card">
      <div className="chart-card-header"><h3>{title}</h3></div>
      <div className="chart-card-body">{children}</div>
    </div>
  );
}