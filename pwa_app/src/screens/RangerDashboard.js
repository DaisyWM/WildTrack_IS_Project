import React, { useMemo, useState, useCallback, useEffect } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
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
import Security2FA from "./Security2FA";

export default function RangerDashboard({ onLogout, goToAlerts }) {
  const [activeScreen, setActiveScreen] = useState("dashboard");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dangerOnlyFeed, setDangerOnlyFeed] = useState(true);
  const [timeframe, setTimeframe] = useState("7d");
  const [kwsOnly, setKwsOnly] = useState(true);

  // Real data from API
  const [summary, setSummary] = useState({ totalDetections: 0, totalAlerts: 0, uploadsProcessed: 0 });
  const [timelineData, setTimelineData] = useState([]);
  const [speciesData, setSpeciesData] = useState([]);
  const [alertData, setAlertData] = useState([]);
  const [loading, setLoading] = useState(true);

  const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

  // Read auth safely
  const auth = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("auth")); } catch { return null; }
  }, []);
  const user = auth?.user ?? {};
  const name = user?.name || "Ranger";
  const role = user?.role || "ranger";

useEffect(() => {
  const fetchData = async () => {
    setLoading(true);
    try {
      const [summaryRes, timelineRes, speciesRes, alertRes] = await Promise.all([
        fetch(`${API_URL}/api/stats/summary?timeframe=${timeframe}&dangerOnly=true`), // ← ADDED dangerOnly=true
        fetch(`${API_URL}/api/stats/detections-timeline?timeframe=${timeframe}`),
        fetch(`${API_URL}/api/stats/species-breakdown?dangerOnly=true`), // ← ADDED dangerOnly=true
        fetch(`${API_URL}/api/stats/alert-outcomes`),
      ]);

      const summaryData = await summaryRes.json();
      const timelineDataRes = await timelineRes.json();
      const speciesDataRes = await speciesRes.json();
      const alertDataRes = await alertRes.json();

      setSummary(summaryData.data || { totalDetections: 0, totalAlerts: 0, uploadsProcessed: 0 });
      setTimelineData(timelineDataRes.data || []);
      setSpeciesData(speciesDataRes.data || []);
      setAlertData(alertDataRes.data || []);
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setLoading(false);
    }
  };

  fetchData();
}, [timeframe, API_URL]);
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
      danger: item.alerts, // Rangers see all alerts as "danger"
    }));
  }, [timelineData, formatLabel]);

  // Alert outcomes + palette
  const outcomeColors = ["#e63946", "#457b9d", "#ffb703", "#2a9d8f"];

  const gotoSettings = () => { setActiveScreen("settings"); setDropdownOpen(false); };

  return (
    <div className="dashboard">
      {/* Top Navbar */}
      <div className="top-navbar">
        <div className="logo">WildTrack</div>
        <div className="right-side">
          <div className="welcome-message">Ranger / KWS Ops</div>
          <div className="profile-name" onClick={() => setDropdownOpen(!dropdownOpen)}>
            {name} ({role}) ⌄
          </div>
          {dropdownOpen && (
            <ul className="dropdown-menu">
              <li>Profile</li>
              <li onClick={gotoSettings}>Settings</li>
              <li className="logout" onClick={onLogout}>Logout</li>
            </ul>
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="main-area">
        {/* Sidebar */}
        <aside className="sidebar">
          <h2>Ranger Menu</h2>
          <nav>
            <ul>
              <li className={activeScreen === "dashboard" ? "active" : ""} onClick={() => setActiveScreen("dashboard")}>Dashboard</li>
              <li className={activeScreen === "alerts" ? "active" : ""} onClick={() => setActiveScreen("alerts")}>Alerts</li>
              <li className={activeScreen === "reports" ? "active" : ""} onClick={() => setActiveScreen("reports")}>Reports</li>
              <li className={activeScreen === "settings" ? "active" : ""} onClick={gotoSettings}>Settings</li>
            </ul>
          </nav>
        </aside>

        {/* Content */}
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
                      <h3>Uploads Processed</h3>
                      <p>{summary.uploadsProcessed}</p>
                    </div>
                  </div>

                  {/* Timeframe Toggle */}
                  <div className="timeframe-toggle" style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
                    <button className={timeframe === "24h" ? "active" : ""} onClick={() => setTimeframe("24h")}>Last 24h</button>
                    <button className={timeframe === "7d" ? "active" : ""} onClick={() => setTimeframe("7d")}>Last 7 days</button>
                    <button className={timeframe === "30d" ? "active" : ""} onClick={() => setTimeframe("30d")}>Last 30 days</button>
                  </div>

                  {/* Analytics Grid - REAL DATA */}
                  <div className="charts-grid">
                    {/* Alerts over time */}
                    <ChartCard title="Alerts Over Time">
                      {formattedTimeline.length > 0 ? (
                        <ResponsiveContainer width="100%" height={260}>
                          <LineChart data={formattedTimeline} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="label" height={36} tickMargin={8} />
                            <YAxis allowDecimals={false} />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="danger" name="Alerts" stroke="#e63946" strokeWidth={2} dot={false} />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="no-data">No alert data available</div>
                      )}
                    </ChartCard>

                    {/* Detections by species - REAL DATA */}
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

                    {/* Alert outcomes - REAL DATA */}
                    <ChartCard title="Alert Outcomes">
                      {alertData.length > 0 ? (
                        <ResponsiveContainer width="100%" height={260}>
                          <PieChart>
                            <Tooltip />
                            <Legend />
                            <Pie data={alertData} dataKey="value" nameKey="name" outerRadius={90} label>
                              {alertData.map((_, index) => (
                                <Cell key={index} fill={outcomeColors[index % outcomeColors.length]} />
                              ))}
                            </Pie>
                          </PieChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="no-data">No alert outcome data</div>
                      )}
                    </ChartCard>
                  </div>

                  {/* Live Alerts Feed */}
                  <div className="alerts-panel">
                    <h3>Recent Activity</h3>
                    <div style={{ marginBottom: 10 }}>
                      <p>Total Alerts: {summary.totalAlerts}</p>
                      <p>Species Detected: {speciesData.length}</p>
                      <button className="alerts-btn" onClick={() => setActiveScreen("alerts")}>View All Alerts</button>
                    </div>
                  </div>
                </>
              )}
            </>
          )}

          {activeScreen === "alerts" && (
            <div className="alerts-panel">
              <h3>All Alerts</h3>
              {summary.totalAlerts > 0 ? (
                <p>{summary.totalAlerts} alert(s) in the last {timeframe}</p>
              ) : (
                <p>No alerts in this timeframe</p>
              )}
              <button className="view-all-alerts" onClick={() => setActiveScreen("dashboard")}>Back to Dashboard</button>
            </div>
          )}

          {activeScreen === "reports" && (
            <div className="recent-detections">
              <h3>Detection Reports</h3>
              <p>Total Uploads: {summary.uploadsProcessed}</p>
              <p>Total Detections: {summary.totalDetections}</p>
              {speciesData.length > 0 && (
                <div>
                  <h4>Species Summary:</h4>
                  <ul>
                    {speciesData.map((s, i) => (
                      <li key={i}>{s.species}: {s.count}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

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