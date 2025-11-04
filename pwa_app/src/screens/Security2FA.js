import React, { useEffect, useState } from "react";
import PushSubscribeButton from "../components/PushSubscribeButton";

/**
 * Security2FA (with Notifications control)
 * - Keeps your existing 2FA logic
 * - Adds UI and logic to unsubscribe from push notifications
 */
export default function Security2FA() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ enabled: false, method: null });
  const [method, setMethod] = useState("authenticator"); // "authenticator" | "email"
  
  // Authenticator app state
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [base32, setBase32] = useState("");
  
  // OTP state
  const [code, setCode] = useState("");
  
  const [msg, setMsg] = useState("");
  const [step, setStep] = useState(1); // 1: select method, 2: setup/verify

  const [pushSubscribed, setPushSubscribed] = useState(false);
  const [checkingSub, setCheckingSub] = useState(true); // show small spinner if needed

  //const API = process.env.REACT_APP_API_URL || "http://localhost:5000";
  const API = process.env.REACT_APP_API_URL || "https://nontheosophic-lieselotte-morphogenetic.ngrok-free.dev";
  // Read auth token from localStorage
  const auth = (() => {
    try { return JSON.parse(localStorage.getItem("auth")) || null; } catch { return null; }
  })();
  const token = auth?.token;

  // Fetch current 2FA status
  const fetchStatus = async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/2fa/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok) {
        setStatus({
          enabled: data.enabled || false,
          method: data.method || null,
        });
      }
    } catch (e) {
      console.error("Failed to fetch 2FA status:", e);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [token]); // eslint-disable-line

  // Check existing push subscription status (for UI)
  useEffect(() => {
    let mounted = true;
    async function checkSubscription() {
      setCheckingSub(true);
      try {
        if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
          if (mounted) setPushSubscribed(false);
          return;
        }
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        if (mounted) setPushSubscribed(Boolean(sub));
      } catch (err) {
        console.error("Failed to check push subscription:", err);
        if (mounted) setPushSubscribed(false);
      } finally {
        if (mounted) setCheckingSub(false);
      }
    }
    checkSubscription();

    // Listen for a custom event so UI updates after subscribing/unsubscribing elsewhere
    const handler = () => checkSubscription();
    window.addEventListener("push-subscription-updated", handler);

    return () => {
      mounted = false;
      window.removeEventListener("push-subscription-updated", handler);
    };
  }, []);

  // === AUTHENTICATOR APP SETUP ===
  const handleGenerateAuthenticator = async () => {
    if (!token) { setMsg("⚠️ Not logged in"); return; }
    setLoading(true); setMsg("");
    try {
      const res = await fetch(`${API}/api/2fa/setup`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to create secret");
      
      setQrDataUrl(data.qrDataUrl || "");
      setBase32(data.base32 || "");
      setStep(2);
      setMsg("✅ Scan the QR code with your authenticator app, then enter the 6-digit code.");
    } catch (e) {
      setMsg(`❌ ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // === EMAIL OTP SETUP ===
  const handleSendEmailOTP = async () => {
    if (!token) { setMsg("⚠️ Not logged in"); return; }
    setLoading(true); setMsg("");
    try {
      const res = await fetch(`${API}/api/2fa/send-otp/email`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || data?.error || "Failed to send OTP");
      
      setStep(2);
      setMsg("✅ OTP sent to your email! Check your inbox and enter the code.");
    } catch (e) {
      setMsg(`❌ ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // === ENABLE 2FA (Verify Code) ===
  const handleVerifyCode = async (e) => {
    e.preventDefault();
    if (!token) { setMsg("⚠️ Not logged in"); return; }
    if (!code) {
      setMsg("❌ Please enter the code");
      return;
    }

    setLoading(true); setMsg("");
    try {
      let endpoint = "";
      if (method === "authenticator") {
        endpoint = `${API}/api/2fa/enable`;
      } else {
        endpoint = `${API}/api/2fa/verify-otp`;
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ 
          code,
          otp: code // Some endpoints use 'otp' instead of 'code'
        }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Invalid code");

      setMsg(`✅ 2FA enabled via ${method}! Your account is now more secure.`);
      setCode("");
      setQrDataUrl("");
      setBase32("");
      setStep(1);
      
      // Refresh status
      await fetchStatus();
    } catch (e) {
      setMsg(`❌ ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  // === DISABLE 2FA ===
  const handleDisable = async () => {
    if (!token) { setMsg("⚠️ Not logged in"); return; }
    if (!window.confirm("Disable 2FA? Your account will be less secure.")) return;
    
    setLoading(true); setMsg("");
    try {
      const res = await fetch(`${API}/api/2fa/disable`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.message || "Failed to disable");
      
      setMsg("✅ 2FA disabled. Only password required for login.");
      setStep(1);
      setQrDataUrl("");
      setBase32("");
      setCode("");
      
      // Refresh status
      await fetchStatus();
    } catch (e) {
      setMsg(`❌ ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleStartSetup = () => {
    setMsg("");
    setCode("");
    
    if (method === "authenticator") {
      handleGenerateAuthenticator();
    } else if (method === "email") {
      handleSendEmailOTP();
    }
  };

  // === UNSUBSCRIBE (Disable) push notifications ===
  const handleUnsubscribe = async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      alert("Push notifications are not supported in this browser.");
      return;
    }

    if (!window.confirm("Unsubscribe from push notifications on this device?")) return;

    try {
      setCheckingSub(true);

      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (!sub) {
        setPushSubscribed(false);
        alert("No active subscription found.");
        return;
      }

      // Inform backend to remove subscription
      const res = await fetch(`${API}/api/push/unsubscribe`, {        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });

      const json = await res.json().catch(() => ({}));

      // Attempt client side unsubscribe
      const unsubbed = await sub.unsubscribe().catch(err => {
        console.warn("Error unsubscribing client-side:", err);
        return false;
      });

      // Update UI & dispatch event for other components
      setPushSubscribed(false);
      window.dispatchEvent(new Event("push-subscription-updated"));

      if (res.ok && json.success) {
        alert("✅ Unsubscribed from push notifications.");
      } else {
        // still show success if client unsubbed
        if (unsubbed) {
          alert("✅ Unsubscribed locally. Server may have already removed subscription.");
        } else {
          alert("Unsubscribe completed (local). The server response: " + (json.message || JSON.stringify(json)));
        }
      }
    } catch (err) {
      console.error("Failed to unsubscribe:", err);
      alert("Failed to unsubscribe — check console for details.");
    } finally {
      setCheckingSub(false);
    }
  };

  return (
    <div className="main-content">
      <h2>Security · Two-Factor Authentication (2FA)</h2>

      <div className="card" style={{ maxWidth: 720, padding: "2rem" }}>
        <p style={{ marginBottom: "1.5rem" }}>
          Add an extra layer of security to your account. Choose your preferred 2FA method:
        </p>

        {/* ENABLED STATE */}
        {status.enabled ? (
          <>
            <div style={{ 
              padding: "1rem", 
              background: "#e6ffed", 
              borderRadius: "8px", 
              marginBottom: "1rem",
              border: "1px solid #0a7a33"
            }}>
              <strong style={{ color: "#0a7a33" }}>✅ 2FA is enabled</strong>
              <p style={{ margin: "0.5rem 0 0 0", color: "#0a7a33" }}>
                Method: <strong>{status.method === "authenticator" ? "Authenticator App" : "Email OTP"}</strong>
              </p>
            </div>
            <button className="view-all-alerts" onClick={handleDisable} disabled={loading}>
              {loading ? "Disabling..." : "Disable 2FA"}
            </button>
          </>
        ) : (
          <>
            {/* STEP 1: Choose Method */}
            {step === 1 && (
              <>
                <div style={{ marginBottom: "1.5rem" }}>
                  <label style={{ display: "block", fontWeight: "600", marginBottom: "0.5rem" }}>
                    Choose 2FA Method:
                  </label>
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                    <label style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      padding: "1rem", 
                      border: "2px solid", 
                      borderColor: method === "authenticator" ? "#457b9d" : "#ddd",
                      borderRadius: "8px",
                      cursor: "pointer",
                      background: method === "authenticator" ? "#f0f7ff" : "white"
                    }}>
                      <input
                        type="radio"
                        name="method"
                        value="authenticator"
                        checked={method === "authenticator"}
                        onChange={(e) => setMethod(e.target.value)}
                        style={{ marginRight: "1rem" }}
                      />
                      <div>
                        <div style={{ fontWeight: "600" }}>📱 Authenticator App</div>
                        <div style={{ fontSize: "0.9rem", color: "#666", marginTop: "0.25rem" }}>
                          Google Authenticator, Authy, Microsoft Authenticator
                        </div>
                      </div>
                    </label>

                    <label style={{ 
                      display: "flex", 
                      alignItems: "center", 
                      padding: "1rem", 
                      border: "2px solid", 
                      borderColor: method === "email" ? "#457b9d" : "#ddd",
                      borderRadius: "8px",
                      cursor: "pointer",
                      background: method === "email" ? "#f0f7ff" : "white"
                    }}>
                      <input
                        type="radio"
                        name="method"
                        value="email"
                        checked={method === "email"}
                        onChange={(e) => setMethod(e.target.value)}
                        style={{ marginRight: "1rem" }}
                      />
                      <div>
                        <div style={{ fontWeight: "600" }}>📧 Email OTP</div>
                        <div style={{ fontSize: "0.9rem", color: "#666", marginTop: "0.25rem" }}>
                          Receive codes via email
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                <button 
                  className="upload-btn" 
                  onClick={handleStartSetup} 
                  disabled={loading}
                  style={{ marginTop: "1rem" }}
                >
                  {loading ? "Setting up..." : "Continue"}
                </button>
              </>
            )}

            {/* STEP 2: Setup/Verify */}
            {step === 2 && (
              <>
                {/* Authenticator QR Code */}
                {method === "authenticator" && qrDataUrl && (
                  <div style={{ marginBottom: "1.5rem" }}>
                    <div style={{ display: "flex", gap: "1.5rem", alignItems: "flex-start" }}>
                      <img
                        src={qrDataUrl}
                        alt="Scan with authenticator app"
                        style={{ 
                          width: 200, 
                          height: 200, 
                          borderRadius: 8, 
                          border: "1px solid #ddd" 
                        }}
                      />
                      <div>
                        <div style={{ fontWeight: 600, marginBottom: 8 }}>Or enter this key manually:</div>
                        <code style={{
                          display: "inline-block", 
                          background: "#f6f6f6", 
                          padding: "8px 10px",
                          borderRadius: 6, 
                          wordBreak: "break-all",
                          fontSize: "0.9rem"
                        }}>
                          {base32 || "(missing)"}
                        </code>
                      </div>
                    </div>
                  </div>
                )}

                {/* Code Verification Form */}
                <form onSubmit={handleVerifyCode}>
                  <label className="input-label" htmlFor="otp">
                    Enter the 6-digit code
                  </label>
                  <input
                    id="otp"
                    className="auth-input"
                    inputMode="numeric"
                    pattern="\d*"
                    maxLength={6}
                    placeholder="123456"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    style={{ maxWidth: 180 }}
                  />
                  <div style={{ marginTop: "1rem", display: "flex", gap: "1rem" }}>
                    <button 
                      type="submit"
                      className="auth-button primary" 
                      disabled={loading || code.length < 6}
                    >
                      {loading ? "Verifying..." : "Verify & Enable"}
                    </button>
                    <button 
                      type="button"
                      className="view-all-alerts" 
                      onClick={() => {
                        setStep(1);
                        setCode("");
                        setQrDataUrl("");
                        setBase32("");
                        setMsg("");
                      }}
                    >
                      Back
                    </button>
                  </div>
                </form>
              </>
            )}
          </>
        )}

        {/* Notifications control - placed inside Settings near 2FA */}
        <div style={{ marginTop: 24, paddingTop: 16, borderTop: "1px solid #eee" }}>
          <h3 style={{ marginTop: 0 }}>Notifications</h3>
          <p style={{ marginTop: 0, marginBottom: 12, color: "#555" }}>
            Enable browser push notifications to receive real-time wildlife alerts on this device.
          </p>

          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {/* Subscribe button (registers service worker, requests permission, sends subscription to backend) */}
            <PushSubscribeButton />

            {/* Unsubscribe button - visible only when subscribed */}
            <div>
              <button
                onClick={handleUnsubscribe}
                disabled={checkingSub}
                style={{
                  background: pushSubscribed ? "#e53e3e" : "#e2e8f0",
                  color: pushSubscribed ? "#fff" : "#374151",
                  border: "none",
                  padding: "0.5rem 0.9rem",
                  borderRadius: 6,
                  cursor: pushSubscribed ? "pointer" : "not-allowed"
                }}
                title={pushSubscribed ? "Unsubscribe from push notifications" : "No active subscription"}
              >
                {checkingSub ? "…" : (pushSubscribed ? "Disable Notifications" : "Disabled")}
              </button>
            </div>

            {/* Status text */}
            <div style={{ fontSize: 14, color: pushSubscribed ? "#16a34a" : "#6b7280" }}>
              {pushSubscribed ? "Enabled" : "Disabled"}
            </div>
          </div>
        </div>

        {/* Message Display */}
        {msg && (
          <div style={{ 
            marginTop: "1rem", 
            padding: "0.75rem",
            borderRadius: "6px",
            background: msg.includes("✅") ? "#e6ffed" : "#ffebee",
            color: msg.includes("✅") ? "#0a7a33" : "#b00020",
            border: `1px solid ${msg.includes("✅") ? "#0a7a33" : "#b00020"}`
          }}>
            {msg}
          </div>
        )}
      </div>
    </div>
  );
}
