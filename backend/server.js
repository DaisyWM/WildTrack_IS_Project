// server.js
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
require("dotenv").config();
const statsRoutes = require("./routes/stats");

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
});

// Import route files
const authRoutes = require("./routes/auth");
const uploadsRoutes = require("./routes/uploads");
const userRoutes = require("./routes/users");
const twoFARoutes = require("./routes/2fa");

const app = express();

// ---------- Middleware ----------
// FIXED CORS - Allow all localhost ports
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:5173",
      FRONTEND_URL,
      FRONTEND_URL_ALT
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

// Serve snapshots folder as static files
app.use("/snapshots", express.static("snapshots"));
app.use("/api/stats", statsRoutes);

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