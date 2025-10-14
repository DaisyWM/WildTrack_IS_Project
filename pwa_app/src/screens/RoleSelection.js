import React, { useState } from "react";
import "../styles/AuthScreen.css"; // Reuse the same styles

export default function RoleSelection({ onRoleSelected }) {
  const [selectedRole, setSelectedRole] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedRole) {
      setMessage("❌ Please select a role");
      return;
    }

    setLoading(true);
    setMessage("…updating role");

    try {
      const tempAuth = JSON.parse(localStorage.getItem("tempAuth") || "{}");
      const token = tempAuth.token;

      if (!token) {
        setMessage("❌ Authentication error. Please try signing in again.");
        return;
      }

      const res = await fetch(`${API}/api/auth/select-role`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({ role: selectedRole }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(data?.message || "❌ Failed to update role");
        return;
      }

      // Save updated auth data
      localStorage.removeItem("tempAuth");
      localStorage.setItem("auth", JSON.stringify(data));
      
      setMessage("✅ Role selected!");
      onRoleSelected?.(data);
    } catch (err) {
      console.error("Role selection error:", err);
      setMessage("⚠️ Could not reach server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-form-panel">
        <div className="auth-form-container">
          <h2 className="form-title">Select Your Role</h2>
          <p style={{ textAlign: "center", marginBottom: "2rem", color: "#666" }}>
            Choose the role that best describes you
          </p>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="role-selection-grid">
              <label className={`role-card ${selectedRole === "farmer" ? "selected" : ""}`}>
                <input
                  type="radio"
                  name="role"
                  value="farmer"
                  checked={selectedRole === "farmer"}
                  onChange={(e) => setSelectedRole(e.target.value)}
                />
                <div className="role-content">
                  <div className="role-icon">🌾</div>
                  <h3>Farmer</h3>
                  <p>I own or manage farmland near wildlife areas</p>
                </div>
              </label>

              <label className={`role-card ${selectedRole === "ranger" ? "selected" : ""}`}>
                <input
                  type="radio"
                  name="role"
                  value="ranger"
                  checked={selectedRole === "ranger"}
                  onChange={(e) => setSelectedRole(e.target.value)}
                />
                <div className="role-content">
                  <div className="role-icon">🛡️</div>
                  <h3>Ranger</h3>
                  <p>I work in wildlife conservation or park management</p>
                </div>
              </label>
            </div>

            <button 
              type="submit" 
              className="auth-button primary" 
              disabled={loading || !selectedRole}
            >
              {loading ? "Setting up..." : "Continue"}
            </button>
          </form>

          {message && (
            <div
              className={`auth-message ${
                message.includes("✅") ? "success" : "error"
              }`}
            >
              {message}
            </div>
          )}
        </div>
      </div>

      <div className="auth-image-panel">
        <div className="leaf-decoration">
          <div className="leaf-bg"></div>
        </div>
      </div>
    </div>
  );
}