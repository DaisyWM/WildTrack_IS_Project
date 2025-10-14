const express = require("express");
const jwt = require("jsonwebtoken");
const speakeasy = require("speakeasy");
const QRCode = require("qrcode");
const crypto = require("crypto");
const nodemailer = require("nodemailer");
const twilio = require("twilio"); // For SMS
const User = require("../models/User");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;

// Twilio setup for SMS (optional - configure if using SMS)
const twilioClient = process.env.TWILIO_ACCOUNT_SID 
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

// Email transporter
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

/* --- inline authRequired --- */
function authRequired(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Missing token" });
  try {
    const p = jwt.verify(token, JWT_SECRET);
    req.user = { id: p.id || p.sub, role: p.role };
    next();
  } catch {
    return res.status(401).json({ message: "Invalid/expired token" });
  }
}

/* ========== AUTHENTICATOR APP 2FA (Existing) ========== */

/* 1) Start setup: generate secret + QR (does NOT enable yet) */
router.post("/setup", authRequired, async (req, res) => {
  try {
    const me = await User.findById(req.user.id);
    if (!me) return res.status(404).json({ message: "User not found" });

    const label = `WildTrack (${me.username})`;
    const secret = speakeasy.generateSecret({ name: label, length: 20 });

    const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url);

    me.twoFA = me.twoFA || {};
    me.twoFA.secret = secret.base32;
    await me.save();

    res.json({
      message: "2FA secret generated",
      base32: secret.base32,
      otpauth_url: secret.otpauth_url,
      qrDataUrl
    });
  } catch (e) {
    res.status(500).json({ message: e.message || "Failed to create 2FA secret" });
  }
});

/* 2) Enable: verify first code from the authenticator app */
router.post("/enable", authRequired, async (req, res) => {
  try {
    const { code } = req.body;
    const me = await User.findById(req.user.id);
    if (!me) return res.status(404).json({ message: "User not found" });
    if (!me.twoFA?.secret) return res.status(400).json({ message: "No 2FA secret set up" });

    const ok = speakeasy.totp.verify({
      secret: me.twoFA.secret,
      encoding: "base32",
      token: String(code).trim(),
      window: 1
    });
    if (!ok) return res.status(400).json({ message: "Invalid code" });

    me.twoFA.enabled = true;
    me.twoFA.method = "authenticator";
    await me.save();

    res.json({ message: "✅ 2FA enabled" });
  } catch (e) {
    res.status(500).json({ message: e.message || "Failed to enable 2FA" });
  }
});

/* 3) Disable 2FA */
router.post("/disable", authRequired, async (req, res) => {
  try {
    const me = await User.findById(req.user.id);
    if (!me) return res.status(404).json({ message: "User not found" });

    me.twoFA = { enabled: false, secret: null, method: null };
    await me.save();

    res.json({ message: "2FA disabled" });
  } catch (e) {
    res.status(500).json({ message: e.message || "Failed to disable 2FA" });
  }
});

/* ========== EMAIL/SMS 2FA (Issue #4) ========== */

/* 4) Send OTP via Email */
router.post("/send-otp/email", authRequired, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

    // Store OTP with expiry
    user.twoFA = user.twoFA || {};
    user.twoFA.otpHash = otpHash;
    user.twoFA.otpExpires = Date.now() + 600000; // 10 minutes
    user.twoFA.otpMethod = "email";
    await user.save();

    // Send email
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: "Your WildTrack Verification Code",
      html: `
        <h2>Email Verification</h2>
        <p>Your verification code is:</p>
        <h1 style="color: #4CAF50; font-size: 32px; letter-spacing: 5px;">${otp}</h1>
        <p>This code expires in 10 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
    });

    res.json({ message: "✅ OTP sent to your email" });
  } catch (err) {
    console.error("Email OTP error:", err);
    res.status(500).json({ error: "Failed to send OTP" });
  }
});

/* 5) Send OTP via SMS */
router.post("/send-otp/sms", authRequired, async (req, res) => {
  try {
    if (!twilioClient) {
      return res.status(501).json({ message: "SMS service not configured" });
    }

    const { phoneNumber } = req.body;
    if (!phoneNumber) {
      return res.status(400).json({ message: "Phone number required" });
    }

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

    // Store OTP and phone number
    user.phoneNumber = phoneNumber;
    user.twoFA = user.twoFA || {};
    user.twoFA.otpHash = otpHash;
    user.twoFA.otpExpires = Date.now() + 600000; // 10 minutes
    user.twoFA.otpMethod = "sms";
    await user.save();

    // Send SMS
    await twilioClient.messages.create({
      body: `Your WildTrack verification code is: ${otp}. Valid for 10 minutes.`,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: phoneNumber,
    });

    res.json({ message: "✅ OTP sent to your phone" });
  } catch (err) {
    console.error("SMS OTP error:", err);
    res.status(500).json({ error: "Failed to send SMS" });
  }
});

/* 6) Verify OTP (Email or SMS) */
router.post("/verify-otp", authRequired, async (req, res) => {
  try {
    const { otp } = req.body;
    if (!otp) return res.status(400).json({ message: "OTP required" });

    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    // Check if OTP exists and not expired
    if (!user.twoFA?.otpHash || !user.twoFA?.otpExpires) {
      return res.status(400).json({ message: "No OTP found. Please request a new one." });
    }

    if (Date.now() > user.twoFA.otpExpires) {
      return res.status(400).json({ message: "OTP expired. Please request a new one." });
    }

    // Verify OTP
    const otpHash = crypto.createHash("sha256").update(otp.toString()).digest("hex");
    if (otpHash !== user.twoFA.otpHash) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    // Enable 2FA with this method
    user.twoFA.enabled = true;
    user.twoFA.method = user.twoFA.otpMethod; // "email" or "sms"
    user.twoFA.otpHash = undefined;
    user.twoFA.otpExpires = undefined;
    user.twoFA.otpMethod = undefined;
    await user.save();

    res.json({ 
      message: `✅ 2FA enabled via ${user.twoFA.method}`,
      method: user.twoFA.method 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* 7) Check 2FA status */
router.get("/status", authRequired, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      enabled: !!user.twoFA?.enabled,
      method: user.twoFA?.method || null,
      hasPhoneNumber: !!user.phoneNumber,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;