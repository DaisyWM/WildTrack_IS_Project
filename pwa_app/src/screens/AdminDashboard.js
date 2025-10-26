import React, { useEffect, useMemo, useState } from "react";
import "../styles/Dashboard.css";
import Security2FA from "./Security2FA"; // ✅ NEW

export default function AdminDashboard({ onLogout }) {
  const [activeScreen, setActiveScreen] = useState("users"); // land on Users
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [users, setUsers] = useState([]);
  const [editing, setEditing] = useState(null); // id
  const [form, setForm] = useState({ name: "", email: "", role: "farmer", status: "active" });

  const auth = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("auth")); } catch { return null; }
  }, []);
  const token = auth?.token;
  const me = auth?.user ?? {};
  const name = me?.name || "Admin";
  const role = me?.role || "admin";

  const API =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL) ||
    process.env.REACT_APP_API_URL ||
    "http://localhost:5000";

  // Load users
  const loadUsers = async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`${API}/api/users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to load users");
      // map username->name for UI consistency
      const mapped = (data.users || []).map(u => ({
        id: u._id || u.id,
        name: u.username,
        email: u.email,
        role: u.role,
        status: u.status || "active",
      }));
      setUsers(mapped);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadUsers(); /* eslint-disable-next-line */ }, []);

  const startEdit = (u) => {
    setEditing(u.id);
    setForm({ name: u.name, email: u.email, role: u.role, status: u.status });
  };

  const cancelEdit = () => {
    setEditing(null);
    setForm({ name: "", email: "", role: "farmer", status: "active" });
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true); setError("");
    try {
      const res = await fetch(`${API}/api/users/${editing}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          username: form.name,
          email: form.email,
          role: form.role,
          status: form.status,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to save user");
      // reflect change locally
      setUsers(prev => prev.map(u => u.id === editing ? {
        ...u, name: data.user.username, email: data.user.email, role: data.user.role, status: data.user.status
      } : u));
      cancelEdit();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (u) => {
    const newStatus = u.status === "active" ? "disabled" : "active";
    setSaving(true); setError("");
    try {
      const res = await fetch(`${API}/api/users/${u.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to update status");
      setUsers(prev => prev.map(x => x.id === u.id ? { ...x, status: newStatus } : x));
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async (id) => {
    if (!window.confirm("Delete this user?")) return;
    setSaving(true); setError("");
    try {
      const res = await fetch(`${API}/api/users/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to delete user");
      setUsers(prev => prev.filter(u => u.id !== id));
      if (editing === id) cancelEdit();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const goSettings = () => {            // ✅ NEW: shared navigation helper
    setActiveScreen("settings");
    setDropdownOpen(false);
  };

  return (
    <div className="dashboard">
      {/* Top Navbar */}
      <div className="top-navbar">
        <div className="logo">WildTrack</div>
        <div className="right-side">
          <div className="welcome-message">Admin Console</div>
          <div className="profile-name" onClick={() => setDropdownOpen(!dropdownOpen)}>
            {name} ({role}) ⌄
          </div>
          {dropdownOpen && (
            <ul className="dropdown-menu">
              <li>Profile</li>
              <li onClick={goSettings}>Settings</li> {/* ✅ wired to open the Settings screen */}
              <li className="logout" onClick={onLogout}>Logout</li>
            </ul>
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="main-area">
        {/* Sidebar */}
        <aside className="sidebar">
          <h2>Admin Menu</h2>
          <nav>
            <ul>
              <li
                className={activeScreen==="dashboard" ? "active" : ""}
                onClick={() => setActiveScreen("dashboard")}
              >
                Dashboard
              </li>
              <li
                className={activeScreen==="users" ? "active" : ""}
                onClick={() => setActiveScreen("users")}
              >
                Users
              </li>
              <li
                className={activeScreen==="settings" ? "active" : ""}  // ✅ highlight when active
                onClick={goSettings}                                    // ✅ same behavior as dropdown
              >
                Settings
              </li>
            </ul>
          </nav>
        </aside>

        {/* Content */}
        <main className="main-content">
          {activeScreen === "dashboard" && (
            <>
              <div className="summary-cards">
                <div className="card"><h3>Total Users</h3><p>{users.length}</p></div>
                <div className="card"><h3>Active</h3><p>{users.filter(u => u.status === "active").length}</p></div>
                <div className="card"><h3>Rangers</h3><p>{users.filter(u => u.role === "ranger").length}</p></div>
                <div className="card"><h3>Farmers</h3><p>{users.filter(u => u.role === "farmer").length}</p></div>
              </div>
              <div className="recent-detections">
                <h3>Recent Admin Activity</h3>
                <ul>
                  <li>Loaded {users.length} users</li>
                  <li>{saving ? "Saving changes…" : "Idle"}</li>
                </ul>
              </div>
            </>
          )}

          {activeScreen === "users" && (
            <div>
              <h3>Manage Users</h3>

              {error && <div className="auth-message error" style={{ marginBottom: 10 }}>{error}</div>}
              {loading ? <p>Loading users…</p> : (
                <ul style={{ listStyle: "none", padding: 0 }}>
                  {users.map(u => (
                    <li
                      key={u.id}
                      style={{
                        background: "#f5f5f5", padding: 12, borderRadius: 8, marginBottom: 10,
                        display: "grid", gridTemplateColumns: "1fr 1fr 120px 200px 180px",
                        gap: 10, alignItems: "center"
                      }}
                    >
                      <span><strong>{u.name}</strong><br /><small>{u.email}</small></span>
                      <span><small>Role</small><br />{u.role}</span>
                      <span><small>Status</small><br />{u.status}</span>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="upload-btn" onClick={() => startEdit(u)}>Edit</button>
                        <button className="alerts-btn" onClick={() => toggleStatus(u)}>
                          {u.status === "active" ? "Disable" : "Activate"}
                        </button>
                      </div>
                      <div>
                        <button className="view-all-alerts" onClick={() => deleteUser(u.id)}>Delete</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {editing && (
                <div style={{ background: "#fff", border: "1px solid #eee", borderRadius: 8, padding: 16, boxShadow: "0 4px 10px rgba(0,0,0,0.05)" }}>
                  <h4>Edit User</h4>
                  <div style={{ display: "grid", gap: 10, maxWidth: 520 }}>
                    <label>
                      <div>Name</div>
                      <input className="auth-input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                    </label>
                    <label>
                      <div>Email</div>
                      <input className="auth-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                    </label>
                    <label>
                      <div>Role</div>
                      <select className="auth-input" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                        <option value="farmer">Farmer</option>
                        <option value="ranger">Ranger</option>
                        <option value="admin">Admin</option>
                      </select>
                    </label>
                    <label>
                      <div>Status</div>
                      <select className="auth-input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                        <option value="active">Active</option>
                        <option value="disabled">Disabled</option>
                      </select>
                    </label>
                  </div>
                  <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
                    <button className="upload-btn" onClick={saveEdit} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
                    <button className="view-all-alerts" onClick={cancelEdit}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeScreen === "settings" && (
            <Security2FA /> // ✅ show 2FA settings for admin account
          )}
        </main>
      </div>
    </div>
  );
}
