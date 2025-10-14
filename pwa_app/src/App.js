// pwa_app/src/App.js
import "./styles/App.css";
import React, { useEffect, useState } from "react";

import AuthScreen from "./screens/AuthScreen";
import RoleSelection from "./screens/RoleSelection";
import DashboardScreen from "./screens/DashboardScreen"; // ← Farmer dashboard
import AlertScreen from "./screens/AlertScreen";
import RangerDashboard from "./screens/RangerDashboard";
import AdminDashboard from "./screens/AdminDashboard";

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [needsRoleSelection, setNeedsRoleSelection] = useState(false);
  const [activeScreen, setActiveScreen] = useState("dashboard"); // "dashboard" | "alerts"
  const [role, setRole] = useState(null); // "farmer" | "ranger" | "admin"

  // Hydrate from localStorage on first load
  useEffect(() => {
    try {
      const raw = localStorage.getItem("auth");
      if (!raw) return;
      const data = JSON.parse(raw);
      
      // Check if user needs to select role
      if (data?.user?.roleSelected === false || data?.needsRoleSelection) {
        setNeedsRoleSelection(true);
        setIsLoggedIn(false);
        return;
      }
      
      const r = data?.user?.role ?? data?.role ?? "farmer";
      setRole(r);
      setIsLoggedIn(Boolean(data?.token));
    } catch {
      // ignore parse errors
    }
  }, []);

  // Called by AuthScreen after successful login/signup
  const handleAuthSuccess = (data) => {
    try {
      // Check if role selection is needed
      if (data?.needsRoleSelection || data?.user?.roleSelected === false) {
        localStorage.setItem("tempAuth", JSON.stringify(data));
        setNeedsRoleSelection(true);
        setIsLoggedIn(false);
        return;
      }
      
      localStorage.setItem("auth", JSON.stringify(data));
    } catch {}
    const r = data?.user?.role ?? data?.role ?? "farmer";
    setRole(r);
    setIsLoggedIn(true);
    setNeedsRoleSelection(false);
    setActiveScreen("dashboard");
  };

  // Called by RoleSelection after user selects their role
  const handleRoleSelected = (data) => {
    try {
      localStorage.removeItem("tempAuth");
      localStorage.setItem("auth", JSON.stringify(data));
    } catch {}
    const r = data?.user?.role ?? data?.role ?? "farmer";
    setRole(r);
    setIsLoggedIn(true);
    setNeedsRoleSelection(false);
    setActiveScreen("dashboard");
  };

  const handleLogout = () => {
    localStorage.removeItem("auth");
    localStorage.removeItem("tempAuth");
    setIsLoggedIn(false);
    setNeedsRoleSelection(false);
    setRole(null);
    setActiveScreen("dashboard");
  };

  // Show role selection screen if needed
  if (needsRoleSelection) {
    return (
      <div className="App">
        <RoleSelection onRoleSelected={handleRoleSelected} />
      </div>
    );
  }

  // Show login screen if not logged in
  if (!isLoggedIn) {
    return (
      <div className="App">
        <AuthScreen onLogin={handleAuthSuccess} onSignup={handleAuthSuccess} />
      </div>
    );
  }

  // Choose dashboard by role (Farmer uses your existing DashboardScreen)
  const renderDashboardByRole = () => {
    if (role === "admin") {
      return (
        <AdminDashboard
          onLogout={handleLogout}
        />
      );
    }
    if (role === "ranger") {
      return (
        <RangerDashboard
          onLogout={handleLogout}
        />
      );
    }
    // default: farmer
    return (
      <DashboardScreen
        onLogout={handleLogout}
      />
    );
  };

  return (
    <div className="App">
      {renderDashboardByRole()}
    </div>
  );
}