// server.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");
require("dotenv").config();
const statsRoutes = require("./routes/stats");
const newStatsRoutes = require("./routes/newstats");

// Load environment variables
const {
  MONGO_URI,
  PORT = 5000,
  JWT_SECRET = "dev-secret-change-me",
  GOOGLE_CLIENT_ID,
  FRONTEND_URL = "http://localhost:3000",
  FRONTEND_URL_ALT = "http://localhost:5173",
} = process.env;

// Log env keys (for debugging)
console.log("Loaded env keys:", {
  MONGO_URI: !!MONGO_URI,
  PORT,
  JWT_SECRET: JWT_SECRET ? "***" : "(missing, using default)",
  GOOGLE_CLIENT_ID: !!GOOGLE_CLIENT_ID,
  FRONTEND_URL,
  FRONTEND_URL_ALT,
  VAPID_PUBLIC_KEY: !!process.env.VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY: !!process.env.VAPID_PRIVATE_KEY,
});

// Import route files
const authRoutes = require("./routes/auth");
const uploadsRoutes = require("./routes/uploads");
const userRoutes = require("./routes/users");
const twoFARoutes = require("./routes/2fa");
const pushRoutes = require("./routes/push");

const app = express();

// ---------- Middleware ----------
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:5173",
      // Add Vercel domains (regex to match any Vercel subdomain)
      /https:\/\/.*\.vercel\.app$/,
      // Add ngrok domains (regex to match any ngrok subdomain)
      /https:\/\/.*\.ngrok-free\.app$/,
      /https:\/\/.*\.ngrok\.app$/,
      FRONTEND_URL,
      FRONTEND_URL_ALT,
    ].filter(Boolean),
    credentials: true,
  })
);
app.use(express.json());

// ---------- Health check ----------
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

// ---------- Routes ----------
app.use("/api/auth", authRoutes);
app.use("/api/uploads", uploadsRoutes);
app.use("/api/users", userRoutes);

// MFA routes (accessible via /api/2fa and /api/auth/mfa)
app.use("/api/2fa", twoFARoutes);
app.use("/api/auth/mfa", twoFARoutes);

// Push notification routes
app.use("/api/push", pushRoutes);

// GET detection history
app.get("/api/detections/history", (req, res) => {
  const historyPath = path.join(__dirname, "detection_history.json");

  // Check if history file exists
  if (!fs.existsSync(historyPath)) {
    return res.json({ success: true, detections: [] });
  }

  // Read and return history
  try {
    const historyData = fs.readFileSync(historyPath, "utf8");
    const history = JSON.parse(historyData);

    res.json({
      success: true,
      detections: history,
    });
  } catch (error) {
    console.error("Error reading history:", error);
    res.status(500).json({
      success: false,
      error: "Failed to load detection history",
    });
  }
});

// Serve snapshots folder as static files
app.use("/snapshots", express.static("snapshots"));
app.use("/api/stats", statsRoutes);
app.use("/api/newstats", newStatsRoutes);

// ---------- MongoDB connection and server start ----------
mongoose
  .connect(MONGO_URI)
  .then(() => {
    console.log("✅ Connected to MongoDB");
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err);
    process.exit(1);
  });