// pwa_app/src/screens/RangerDashboard.js
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
import AlertScreen from "./AlertScreen";
import { API_BASE, getHeaders } from '../config/pushConfig';

export default function RangerDashboard({ onLogout }) {
  const [activeScreen, setActiveScreen] = useState("dashboard");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [timeframe, setTimeframe] = useState("7d");

  // mobile drawer toggle
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Data states
  const [summary, setSummary] = useState({ totalDetections: 0, totalAlerts: 0, uploadsProcessed: 0 });
  const [timelineData, setTimelineData] = useState([]);
  const [speciesData, setSpeciesData] = useState([]);
  const [alertData, setAlertData] = useState([]);
  const [loading, setLoading] = useState(true);

  // recent detections and image blobs (for thumbnails)
  const [recentDetections, setRecentDetections] = useState([]);
  const [imageBlobs, setImageBlobs] = useState({}); // { [detId]: objectUrl | null }

  // Auto-detect: use localhost on computer, IP address on phone
  const API_URL = API_BASE;

  // Auth / user
  const auth = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("auth")); } catch { return null; }
  }, []);
  const user = auth?.user ?? {};
  const name = user?.name || "Ranger";
  const role = user?.role || "ranger";

  // Check if we should auto-open alerts (from notification click)
  useEffect(() => {
    const openScreen = sessionStorage.getItem('openScreen');
    if (openScreen === 'alerts') {
      setActiveScreen('alerts');
      sessionStorage.removeItem('openScreen');
    }
  }, []);

  // Helper: build absolute image URL safely
  function buildImageUrl(apiBase, snapshot) {
    if (!snapshot) return null;
    // If already absolute, prefer https when possible
    if (/^https?:\/\//i.test(snapshot)) {
      if (snapshot.startsWith('http://') && apiBase?.startsWith('https://')) {
        return snapshot.replace(/^http:\/\//i, 'https://');
      }
      return snapshot;
    }
    const base = apiBase ? apiBase.replace(/\/$/, '') : '';
    const path = snapshot.startsWith('/') ? snapshot : `/${snapshot}`;
    return `${base}${path}`;
  }

  // Fetch stats + recent detections
  useEffect(() => {
    let mounted = true;

    const fetchData = async () => {
      if (!mounted) return;
      setLoading(true);
      try {
        const [summaryRes, timelineRes, speciesRes, alertRes, recentRes] = await Promise.all([
          fetch(`${API_URL}/api/stats/summary?timeframe=${timeframe}&dangerOnly=true`, { headers: getHeaders() }),
          fetch(`${API_URL}/api/stats/detections-timeline?timeframe=${timeframe}`, { headers: getHeaders() }),
          fetch(`${API_URL}/api/stats/species-breakdown?dangerOnly=true`, { headers: getHeaders() }),
          fetch(`${API_URL}/api/stats/alert-outcomes`, { headers: getHeaders() }),
          fetch(`${API_URL}/api/stats/recent-detections?limit=3`, { headers: getHeaders() }),
        ]);

        const summaryData = summaryRes.ok ? await summaryRes.json() : {};
        const timelineDataRes = timelineRes.ok ? await timelineRes.json() : {};
        const speciesDataRes = speciesRes.ok ? await speciesRes.json() : {};
        const alertDataRes = alertRes.ok ? await alertRes.json() : {};
        const recentDataRes = recentRes.ok ? await recentRes.json() : {};

        if (!mounted) return;

        setSummary(summaryData.data || { totalDetections: 0, totalAlerts: 0, uploadsProcessed: 0 });
        setTimelineData(timelineDataRes.data || []);
        setSpeciesData(speciesDataRes.data || []);
        setAlertData(alertDataRes.data || []);
        setRecentDetections(recentDataRes.data || []);
      } catch (err) {
        console.error("Failed to fetch ranger dashboard data:", err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 10000); // refresh occasionally
    return () => { mounted = false; clearInterval(interval); };
  }, [timeframe, API_URL]);

  // Fetch images for recentDetections (convert to blob object URLs so auth works)
  useEffect(() => {
    let cancelled = false;
    async function fetchAllImages() {
      if (!recentDetections || recentDetections.length === 0) return;

      // iterate detections
      for (const det of recentDetections) {
        const id = det._id || det.id;
        if (!id) continue;
        // skip if already have value (even null)
        if (Object.prototype.hasOwnProperty.call(imageBlobs, id)) continue;

        const snapshotPath = det.image || det.snapshot || null;
        const imgUrl = buildImageUrl(API_URL, snapshotPath);
        if (!imgUrl) {
          setImageBlobs(prev => ({ ...prev, [id]: null }));
          continue;
        }

        try {
          const res = await fetch(imgUrl, { headers: getHeaders() });
          if (!res.ok) {
            console.warn('Image fetch failed', imgUrl, res.status);
            setImageBlobs(prev => ({ ...prev, [id]: null }));
            continue;
          }
          const blob = await res.blob();
          const objectUrl = URL.createObjectURL(blob);
          if (cancelled) {
            // cleanup if cancelled
            URL.revokeObjectURL(objectUrl);
            break;
          }
          setImageBlobs(prev => ({ ...prev, [id]: objectUrl }));
        } catch (err) {
          console.error('Error fetching image blob', imgUrl, err);
          setImageBlobs(prev => ({ ...prev, [id]: null }));
        }
      }
    }

    fetchAllImages();

    // cleanup on unmount: revoke object URLs
    return () => {
      cancelled = true;
      Object.values(imageBlobs).forEach((obj) => {
        if (obj) URL.revokeObjectURL(obj);
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recentDetections, API_URL]); // note: imageBlobs intentionally not in deps to avoid refetch loop

  // Format timeline labels
  const formatLabel = useCallback((label) => {
    if (timeframe === "24h") {
      const parts = String(label).split(" ");
      return parts[1] || label;
    } else {
      const date = new Date(label);
      return isNaN(date.getTime()) ? label : date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
  }, [timeframe]);

  const formattedTimeline = useMemo(() => {
    return (timelineData || []).map(item => ({
      ...item,
      label: formatLabel(item.label),
      danger: item.alerts,
    }));
  }, [timelineData, formatLabel]);

  const outcomeColors = ["#e63946", "#457b9d", "#ffb703", "#2a9d8f"];

  const gotoSettings = () => { setActiveScreen("settings"); setDropdownOpen(false); };

  // --- Render --- //
  // Settings
  if (activeScreen === "settings") {
    return (
      <div className="dashboard">
        <div className="top-navbar">
          <button className="hamburger-btn" aria-label="Open menu" onClick={() => setSidebarOpen(true)}>☰</button>
          <div className="logo">WildTrack</div>
          <div className="right-side">
            <div className="welcome-message">Ranger / KWS Ops</div>
            <div className="profile-name" onClick={() => setDropdownOpen(!dropdownOpen)}>{name} ({role}) ⌄</div>
            {dropdownOpen && (
              <ul className="dropdown-menu">
                <li>Profile</li>
                <li onClick={gotoSettings}>Settings</li>
                <li className="logout" onClick={onLogout}>Logout</li>
              </ul>
            )}
          </div>
        </div>

        {sidebarOpen && <div className="overlay" onClick={() => setSidebarOpen(false)} />}

        <div className="main-area">
          <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
            <button className="close-sidebar" onClick={() => setSidebarOpen(false)}>✕</button>
            <h2>Ranger Menu</h2>
            <nav>
              <ul>
                <li className={activeScreen === "dashboard" ? "active" : ""} onClick={() => { setActiveScreen("dashboard"); setSidebarOpen(false); }}>Dashboard</li>
                <li className={activeScreen === "alerts" ? "active" : ""} onClick={() => { setActiveScreen("alerts"); setSidebarOpen(false); }}>Alerts</li>
                <li className={activeScreen === "reports" ? "active" : ""} onClick={() => { setActiveScreen("reports"); setSidebarOpen(false); }}>Reports</li>
                <li className={activeScreen === "settings" ? "active" : ""} onClick={() => { gotoSettings(); setSidebarOpen(false); }}>Settings</li>
              </ul>
            </nav>
          </aside>

          <main className="main-content">
            <Security2FA goBack={() => setActiveScreen("dashboard")} />
          </main>
        </div>
      </div>
    );
  }

  // Alerts page
  if (activeScreen === "alerts") {
    return (
      <div className="dashboard">
        <div className="top-navbar">
          <button className="hamburger-btn" aria-label="Open menu" onClick={() => setSidebarOpen(true)}>☰</button>
          <div className="logo">WildTrack</div>
          <div className="right-side">
            <div className="welcome-message">Ranger / KWS Ops</div>
            <div className="profile-name" onClick={() => setDropdownOpen(!dropdownOpen)}>{name} ({role}) ⌄</div>
            {dropdownOpen && (
              <ul className="dropdown-menu">
                <li>Profile</li>
                <li onClick={gotoSettings}>Settings</li>
                <li className="logout" onClick={onLogout}>Logout</li>
              </ul>
            )}
          </div>
        </div>

        {sidebarOpen && <div className="overlay" onClick={() => setSidebarOpen(false)} />}

        <div className="main-area">
          <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
            <button className="close-sidebar" onClick={() => setSidebarOpen(false)}>✕</button>
            <h2>Ranger Menu</h2>
            <nav>
              <ul>
                <li className={activeScreen === "dashboard" ? "active" : ""} onClick={() => { setActiveScreen("dashboard"); setSidebarOpen(false); }}>Dashboard</li>
                <li className={activeScreen === "alerts" ? "active" : ""} onClick={() => { setActiveScreen("alerts"); setSidebarOpen(false); }}>Alerts</li>
                <li className={activeScreen === "reports" ? "active" : ""} onClick={() => { setActiveScreen("reports"); setSidebarOpen(false); }}>Reports</li>
                <li className={activeScreen === "settings" ? "active" : ""} onClick={() => { gotoSettings(); setSidebarOpen(false); }}>Settings</li>
              </ul>
            </nav>
          </aside>

          <main className="main-content">
            <AlertScreen goBack={() => setActiveScreen("dashboard")} />
          </main>
        </div>
      </div>
    );
  }

  // Default Dashboard rendering
  return (
    <div className="dashboard">
      {/* Top Navbar */}
      <div className="top-navbar">
        <button className="hamburger-btn" aria-label="Open menu" onClick={() => setSidebarOpen(true)}>☰</button>
        <div className="logo">WildTrack</div>
        <div className="right-side">
          <div className="welcome-message">Ranger / KWS Ops</div>
          <div className="profile-name" onClick={() => setDropdownOpen(!dropdownOpen)}>{name} ({role}) ⌄</div>
          {dropdownOpen && (
            <ul className="dropdown-menu">
              <li>Profile</li>
              <li onClick={gotoSettings}>Settings</li>
              <li className="logout" onClick={onLogout}>Logout</li>
            </ul>
          )}
        </div>
      </div>

      {sidebarOpen && <div className="overlay" onClick={() => setSidebarOpen(false)} />}

      <div className="main-area">
        <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
          <button className="close-sidebar" onClick={() => setSidebarOpen(false)}>✕</button>
          <h2>Ranger Menu</h2>
          <nav>
            <ul>
              <li className={activeScreen === "dashboard" ? "active" : ""} onClick={() => { setActiveScreen("dashboard"); setSidebarOpen(false); }}>Dashboard</li>
              <li className={activeScreen === "alerts" ? "active" : ""} onClick={() => { setActiveScreen("alerts"); setSidebarOpen(false); }}>Alerts</li>
              <li className={activeScreen === "reports" ? "active" : ""} onClick={() => { setActiveScreen("reports"); setSidebarOpen(false); }}>Reports</li>
              <li className={activeScreen === "settings" ? "active" : ""} onClick={() => { gotoSettings(); setSidebarOpen(false); }}>Settings</li>
            </ul>
          </nav>
        </aside>

        <main className="main-content">
          {loading && <div className="loading">Loading stats...</div>}

          {!loading && (
            <>
              {/* Summary cards */}
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

              {/* Timeframe toggle */}
              <div className="timeframe-toggle">
                <button className={timeframe === "24h" ? "active" : ""} onClick={() => setTimeframe("24h")}>Last 24h</button>
                <button className={timeframe === "7d" ? "active" : ""} onClick={() => setTimeframe("7d")}>Last 7 days</button>
                <button className={timeframe === "30d" ? "active" : ""} onClick={() => setTimeframe("30d")}>Last 30 days</button>
              </div>

              {/* Charts grid */}
              <div className="charts-grid">
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
                  ) : <div className="no-data">No alert data available</div>}
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
                  ) : <div className="no-data">No species data available</div>}
                </ChartCard>

                <ChartCard title="Alert Outcomes">
                  {alertData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={260}>
                      <PieChart>
                        <Tooltip />
                        <Legend />
                        <Pie data={alertData} dataKey="value" nameKey="name" outerRadius={90} label>
                          {alertData.map((_, index) => <Cell key={index} fill={outcomeColors[index % outcomeColors.length]} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <div className="no-data">No alert outcome data</div>}
                </ChartCard>
              </div>

              {/* Recent Detections - show thumbnails (fetch with auth) */}
              <div className="recent-detections">
                <h3>Recent Detections</h3>
                {recentDetections.length > 0 ? (
                  <ul>
                    {recentDetections.map((det, idx) => {
                      const id = det._id || det.id || idx;
                      const objectUrl = imageBlobs[id];
                      const fallback = "https://via.placeholder.com/40";
                      return (
                        <li key={id} className="recent-det-item">
                          <img
                            src={objectUrl || fallback}
                            alt={det.species || "detection"}
                            onError={(e) => { e.currentTarget.src = fallback; }}
                            style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 4 }}
                          />
                          <span style={{ marginLeft: 8 }}>{det.species} - {det.time ? new Date(det.time).toLocaleTimeString() : ''}</span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p>No recent detections</p>
                )}
              </div>

              {/* Alerts panel with button to open Alerts page */}
              <div className="alerts-panel">
                <h3>Recent Activity</h3>
                <div style={{ marginBottom: 10 }}>
                  <p>Total Alerts: {summary.totalAlerts}</p>
                  <p>Species Detected: {speciesData.length}</p>
                  <button className="alerts-btn" onClick={() => { setActiveScreen("alerts"); setSidebarOpen(false); }}>View All Alerts</button>
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}

// Small wrapper for chart cards
function ChartCard({ title, children }) {
  return (
    <div className="chart-card">
      <div className="chart-card-header"><h3>{title}</h3></div>
      <div className="chart-card-body">{children}</div>
    </div>
  );
}
