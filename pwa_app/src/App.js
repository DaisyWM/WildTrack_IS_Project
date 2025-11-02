// pwa_app/src/App.js
import "./styles/App.css";
import React, { useEffect, useState } from "react";

import AuthScreen from "./screens/AuthScreen";
import RoleSelection from "./screens/RoleSelection";
import DashboardScreen from "./screens/DashboardScreen";
import AlertScreen from "./screens/AlertScreen";
import RangerDashboard from "./screens/RangerDashboard";
import AdminDashboard from "./screens/AdminDashboard";
import NotificationPermission from "./components/NotificationPermission";
import { checkForNewDetections } from "./utils/notifications";

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [needsRoleSelection, setNeedsRoleSelection] = useState(false);
  const [activeScreen, setActiveScreen] = useState("dashboard");
  const [role, setRole] = useState(null);
  const [lastDetectionId, setLastDetectionId] = useState(0);

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

  // 🆕 Listen for messages from service worker (notification clicks)
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data.type === 'OPEN_ALERTS') {
          // Set session storage to open alerts
          sessionStorage.setItem('openScreen', 'alerts');
          // Force reload to apply the change
          window.location.reload();
        }
      });
    }
  }, []);

  // 🆕 Check URL parameters for navigation (e.g., from notification click)
  useEffect(() => {
    if (!isLoggedIn) return;

    const params = new URLSearchParams(window.location.search);
    const screen = params.get('screen');
    const openAlerts = params.get('openAlerts');
    
    if (screen === 'alerts' || openAlerts === 'true') {
      // Store this so dashboards can check it
      sessionStorage.setItem('openScreen', 'alerts');
      
      // Clear URL parameter without reloading
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [isLoggedIn]);

  // Auto-check for new detections
  useEffect(() => {
    if (!isLoggedIn) return;

    // Load last seen detection ID from localStorage
    const savedId = localStorage.getItem('lastDetectionId');
    if (savedId) {
      setLastDetectionId(parseInt(savedId));
    }

    // Check for new detections every 30 seconds
    const interval = setInterval(() => {
      checkForNewDetections(lastDetectionId, (newId) => {
        setLastDetectionId(newId);
        localStorage.setItem('lastDetectionId', newId.toString());
      });
    }, 30000); // 30 seconds

    // Initial check on mount
    checkForNewDetections(lastDetectionId, (newId) => {
      setLastDetectionId(newId);
      localStorage.setItem('lastDetectionId', newId.toString());
    });

    return () => clearInterval(interval);
  }, [lastDetectionId, isLoggedIn]);

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

  // Choose dashboard by role
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
      <NotificationPermission />
      {renderDashboardByRole()}
    </div>
  );
}