// pwa_app/src/screens/AuthScreen.js
import React, { useState, useEffect, useRef } from "react";
import "../styles/AuthScreen.css";
import { API_BASE, getHeaders } from '../config/pushConfig';

export default function AuthScreen({ onLogin, onSignup }) {
  const [activeTab, setActiveTab] = useState("signup"); // "login" | "signup"
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [signupForm, setSignupForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "farmer",
  });
  const [message, setMessage] = useState("");

  // MFA (OTP) stage after password login
  const [mfaStage, setMfaStage] = useState({ required: false, tempToken: null });
  const [otp, setOtp] = useState("");

  // === ENV & API ===
  const API = API_BASE;
  
  const GOOGLE_CLIENT_ID =
    (typeof import.meta !== "undefined" && import.meta.env?.VITE_GOOGLE_CLIENT_ID) ||
    process.env.REACT_APP_GOOGLE_CLIENT_ID;

  // Refs to mount Google buttons + readiness flag
  const googleBtnRefLogin = useRef(null);
  const googleBtnRefSignup = useRef(null);
  const [googleReady, setGoogleReady] = useState(false);

  const switchTab = (tab) => {
    setActiveTab(tab);
    setMessage("");
    setMfaStage({ required: false, tempToken: null });
    setOtp("");
  };

  const handleLoginChange = (e) => {
    const { name, value } = e.target;
    setLoginForm((s) => ({ ...s, [name]: value }));
  };

  const handleSignupChange = (e) => {
    const { name, value } = e.target;
    setSignupForm((s) => ({ ...s, [name]: value }));
  };

  // --------- AUTH: LOGIN (password first) ----------
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setMessage("…signing in");
    setMfaStage({ required: false, tempToken: null });
    setOtp("");

    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify(loginForm),
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }

      if (!res.ok) {
        setMessage(data?.message || data?.error || `❌ Login failed (${res.status})`);
        return;
      }

      // MFA required?
      if (data?.mfaRequired && data?.tempToken) {
        setMessage("🔐 Enter the 6-digit code from your Authenticator app");
        setMfaStage({ required: true, tempToken: data.tempToken });
        return; // don't call onLogin yet
      }

      // Normal login success
      try {
        localStorage.setItem("auth", JSON.stringify(data));
      } catch {}
      setMessage("✅ Login successful!");
      onLogin?.(data);
    } catch (err) {
      console.error("[LOGIN] fetch failed:", err);
      setMessage("⚠️ Could not reach server.");
    }
  };

  // --------- AUTH: MFA VERIFY (OTP) ----------
  const handleMfaVerify = async (e) => {
    e.preventDefault();
    if (!mfaStage.tempToken) {
      setMessage("❌ Missing MFA token. Please try logging in again.");
      setMfaStage({ required: false, tempToken: null });
      return;
    }

    setMessage("…verifying code");
    try {
      const res = await fetch(`${API}/api/auth/mfa/verify`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ code: otp, tempToken: mfaStage.tempToken }),
      });

      const data = await res.json();
      if (!res.ok) {
        setMessage(data?.message || "❌ Invalid code");
        return;
      }

      try {
        localStorage.setItem("auth", JSON.stringify(data));
      } catch {}
      setMessage("✅ MFA verified!");
      setMfaStage({ required: false, tempToken: null });
      setOtp("");
      onLogin?.(data);
    } catch (err) {
      console.error("[MFA VERIFY] fetch failed:", err);
      setMessage("⚠️ Could not reach server.");
    }
  };

  // --------- AUTH: SIGNUP ----------
  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setMessage("…creating account");
    setMfaStage({ required: false, tempToken: null });
    setOtp("");

    try {
      const res = await fetch(`${API}/api/auth/signup`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
          username: signupForm.name, // backend expects "username"
          email: signupForm.email,
          password: signupForm.password,
          role: signupForm.role,
        }),
      });

      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { raw: text };
      }

      if (!res.ok) {
        setMessage(data?.message || data?.error || `❌ Signup failed (${res.status})`);
        return;
      }

      try {
        localStorage.setItem("auth", JSON.stringify(data));
      } catch {}
      setMessage("✅ Signup successful!");
      onSignup?.(data);
    } catch (err) {
      console.error("[SIGNUP] fetch failed:", err);
      setMessage("⚠️ Could not reach server.");
    }
  };

  const handleGoogleCredential = async (resp) => {
    if (!resp?.credential) {
      setMessage("❌ Google didn't return a token");
      return;
    }
    try {
      setMessage("…signing in with Google");
      const r = await fetch(`${API}/api/auth/google`, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({ token: resp.credential }),
      });
      const data = await r.json();
      
      console.log("🔍 Backend response:", data);
      console.log("🔍 needsRoleSelection:", data.needsRoleSelection);
      console.log("🔍 user.roleSelected:", data.user?.roleSelected);
      
      if (!r.ok) {
        setMessage(data?.error || data?.message || "❌ Google sign-in failed");
        return;
      }
      
      // Check if role selection is needed
      if (data.needsRoleSelection) {
        console.log("✅ SHOWING ROLE SELECTION!");
        try {
          localStorage.setItem("tempAuth", JSON.stringify(data));
        } catch {}
        setMessage("✅ Signed in! Please select your role.");
        onLogin?.({ ...data, needsRoleSelection: true });
      } else {
        console.log("❌ Skipping role selection");
        try {
          localStorage.setItem("auth", JSON.stringify(data));
        } catch {}
        setMessage("✅ Signed in with Google!");
        onLogin?.(data);
      }
    } catch (e) {
      console.error("[GOOGLE SIGN-IN] fetch failed:", e);
      setMessage("⚠️ Could not reach server.");
    }
  };

  // Initialize + render Google buttons when tab changes; fallback to placeholder
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || typeof window === "undefined" || !window.google) {
      setGoogleReady(false);
      return;
    }

    try {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
        ux_mode: "popup",
        auto_select: false,
      });

      if (googleBtnRefLogin.current) {
        window.google.accounts.id.renderButton(googleBtnRefLogin.current, {
          type: "standard",
          shape: "pill",
          theme: "outline",
          size: "large",
          text: "continue_with",
          logo_alignment: "left",
        });
      }
      if (googleBtnRefSignup.current) {
        window.google.accounts.id.renderButton(googleBtnRefSignup.current, {
          type: "standard",
          shape: "pill",
          theme: "outline",
          size: "large",
          text: "signup_with",
          logo_alignment: "left",
        });
      }
      setGoogleReady(true);
    } catch {
      setGoogleReady(false);
    }
  }, [activeTab, GOOGLE_CLIENT_ID]);

  return (
    <div className="auth-screen">
      {/* Left Panel - Form */}
      <div className="auth-form-panel">
        <div className="auth-form-container">
          {/* Tabs */}
          <div className="tab-navigation">
            <button
              onClick={() => switchTab("login")}
              className={`tab-button ${activeTab === "login" ? "active" : ""}`}
            >
              Sign In
            </button>
            <button
              onClick={() => switchTab("signup")}
              className={`tab-button ${activeTab === "signup" ? "active" : ""}`}
            >
              Sign Up
            </button>
          </div>

          {/* LOGIN */}
          {activeTab === "login" && (
            <div className="form-content">
              <h2 className="form-title">Welcome Back</h2>

              {/* Password stage */}
              {!mfaStage.required && (
                <>
                  <form onSubmit={handleLoginSubmit} className="auth-form">
                    <div className="input-group">
                      <label htmlFor="login-email" className="input-label">Email address</label>
                      <input
                        id="login-email"
                        name="email"
                        type="email"
                        required
                        value={loginForm.email}
                        onChange={handleLoginChange}
                        placeholder="Enter your email"
                        className="auth-input"
                      />
                    </div>

                    <div className="input-group">
                      <label htmlFor="login-password" className="input-label">Password</label>
                      <input
                        id="login-password"
                        name="password"
                        type="password"
                        required
                        value={loginForm.password}
                        onChange={handleLoginChange}
                        placeholder="Enter your password"
                        className="auth-input"
                      />
                    </div>

                    <button type="submit" className="auth-button primary">Sign In</button>
                  </form>

                  {/* OR + Google */}
                  <div className="or-divider"><span>OR</span></div>
                  {googleReady ? (
                    <div ref={googleBtnRefLogin} className="google-btn-slot" />
                  ) : (
                    <button
                      type="button"
                      className="auth-button"
                      onClick={() => alert("Google sign-in: Add REACT_APP_GOOGLE_CLIENT_ID to .env")}
                    >
                      Continue with Google
                    </button>
                  )}
                </>
              )}

              {/* MFA stage */}
              {mfaStage.required && (
                <form onSubmit={handleMfaVerify} className="auth-form" style={{ marginTop: 12 }}>
                  <div className="input-group">
                    <label htmlFor="otp" className="input-label">Authenticator Code</label>
                    <input
                      id="otp"
                      name="otp"
                      inputMode="numeric"
                      pattern="\d*"
                      maxLength={6}
                      className="auth-input"
                      placeholder="123456"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      required
                    />
                  </div>
                  <button type="submit" className="auth-button primary">Verify</button>
                </form>
              )}
            </div>
          )}

          {/* SIGNUP */}
          {activeTab === "signup" && (
            <div className="form-content">
              <h2 className="form-title">Get Started Now</h2>

              <form onSubmit={handleSignupSubmit} className="auth-form">
                <div className="input-group">
                  <label htmlFor="signup-name" className="input-label">Name</label>
                  <input
                    id="signup-name"
                    name="name"
                    type="text"
                    required
                    value={signupForm.name}
                    onChange={handleSignupChange}
                    placeholder="Enter your name"
                    className="auth-input"
                  />
                </div>

                <div className="input-group">
                  <label htmlFor="signup-email" className="input-label">Email address</label>
                  <input
                    id="signup-email"
                    name="email"
                    type="email"
                    required
                    value={signupForm.email}
                    onChange={handleSignupChange}
                    placeholder="Enter your email"
                    className="auth-input"
                  />
                </div>

                <div className="input-group">
                  <label htmlFor="signup-role" className="input-label">Role</label>
                  <select
                    id="signup-role"
                    name="role"
                    value={signupForm.role}
                    onChange={handleSignupChange}
                    className="auth-input"
                  >
                    <option value="farmer">Farmer</option>
                    <option value="ranger">Ranger</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>

                <div className="input-group">
                  <label htmlFor="signup-password" className="input-label">Password</label>
                  <input
                    id="signup-password"
                    name="password"
                    type="password"
                    required
                    value={signupForm.password}
                    onChange={handleSignupChange}
                    placeholder="••••••••"
                    className="auth-input"
                  />
                </div>

                <button type="submit" className="auth-button primary">Signup</button>
              </form>

              {/* Google button BELOW the form */}
              <div className="or-divider"><span>OR</span></div>
              {googleReady ? (
                <div ref={googleBtnRefSignup} className="google-btn-slot" />
              ) : (
                <button
                  type="button"
                  className="auth-button"
                  onClick={() => alert("Google sign-in: Add REACT_APP_GOOGLE_CLIENT_ID to .env")}
                >
                  Continue with Google
                </button>
              )}

              <div className="signin-link">
                <span>
                  Have an account?{" "}
                  <button onClick={() => switchTab("login")} className="link-button">
                    Sign in
                  </button>
                </span>
              </div>
            </div>
          )}

          {/* Message */}
          {message && (
            <div
              className={`auth-message ${
                message.includes("✅") || message.includes("🔐") ? "success" : "error"
              }`}
            >
              {message}
            </div>
          )}
        </div>
      </div>

      {/* Right Panel - Image / decoration */}
      <div className="auth-image-panel">
        <div className="leaf-decoration">
          <div className="leaf-bg"></div>
        </div>
      </div>
    </div>
  );
}