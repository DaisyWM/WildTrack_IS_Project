// pwa_app/src/App.js
import "./styles/App.css";
import React, { useEffect, useState } from "react";

import AuthScreen from "./screens/AuthScreen";
import DashboardScreen from "./screens/DashboardScreen"; // ← Farmer dashboard
import AlertScreen from "./screens/AlertScreen";
import RangerDashboard from "./screens/RangerDashboard";
import AdminDashboard from "./screens/AdminDashboard";

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeScreen, setActiveScreen] = useState("dashboard"); // "dashboard" | "alerts"
  const [role, setRole] = useState(null); // "farmer" | "ranger" | "admin"

  // Hydrate from localStorage on first load
  useEffect(() => {
    try {
      const raw = localStorage.getItem("auth");
      if (!raw) return;
      const data = JSON.parse(raw);
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
      localStorage.setItem("auth", JSON.stringify(data));
    } catch {}
    const r = data?.user?.role ?? data?.role ?? "farmer";
    setRole(r);
    setIsLoggedIn(true);
    setActiveScreen("dashboard");
  };

  const handleLogout = () => {
    localStorage.removeItem("auth");
    setIsLoggedIn(false);
    setRole(null);
    setActiveScreen("dashboard");
  };

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