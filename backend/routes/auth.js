const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");
const nodemailer = require("nodemailer");
const User = require("../models/User");

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// Email transporter setup (configure with your email service)
const transporter = nodemailer.createTransport({
  service: "gmail", // or your email service
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD, // Use app password for Gmail
  },
});

// ✅ Signup
router.post("/signup", async (req, res) => {
  try {
    const { username, email, password, role } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await User.create({ username, email, password: hashedPassword, role });

    const token = jwt.sign(
      { id: newUser._id, role: newUser.role },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.status(201).json({
      message: "✅ Signup successful!",
      token,
      user: {
        id: newUser._id,
        name: newUser.username,
        email: newUser.email,
        role: newUser.role,
        status: newUser.status,
        mfaEnabled: !!newUser.twoFA?.enabled,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ✅ Login with optional MFA step
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "❌ User not found" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ message: "❌ Invalid credentials" });

    // If 2FA enabled: return a temporary token for OTP verification
    if (user.twoFA?.enabled && user.twoFA?.secret) {
      const tempToken = jwt.sign(
        { id: user._id, role: user.role, mfa: true },
        JWT_SECRET,
        { expiresIn: "10m" } // short-lived challenge token
      );

      return res.json({
        message: "🔐 MFA required",
        mfaRequired: true,
        tempToken,
        user: {
          id: user._id,
          name: user.username,
          email: user.email,
          role: user.role,
        },
      });
    }

    // Otherwise, issue the final session token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({
      message: "✅ Login successful",
      token,
      user: {
        id: user._id,
        name: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🆕 Google OAuth Sign-In (WITH ROLE SELECTION)
router.post("/google", async (req, res) => {
  console.log("📥 Google route hit!");
  console.log("📦 Request body:", req.body);
  console.log("🔑 GOOGLE_CLIENT_ID:", GOOGLE_CLIENT_ID ? "Set" : "MISSING");
  
  try {
    const { token: googleToken, idToken } = req.body;
    const actualToken = googleToken || idToken;
    
    console.log("🎫 Token received:", actualToken ? "Yes" : "NO!");

    if (!actualToken) {
      console.log("❌ No token in request");
      return res.status(400).json({ error: "No token provided" });
    }

    console.log("✅ Verifying token with Google...");
    
    // Verify Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: actualToken,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    console.log("✅ Google verified! Email:", payload.email);
    
    const { email, name, sub: googleId, picture } = payload;

    // Check if user exists
    let user = await User.findOne({ email });
    let needsRoleSelection = false;

    if (!user) {
      console.log("📝 Creating new user...");
      // Create new user with Google account - needs role selection
      user = await User.create({
        username: name,
        email,
        googleId,
        profilePicture: picture,
        role: "farmer", // Temporary default
        password: await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10),
        isGoogleAccount: true,
        roleSelected: false, // Flag that role needs to be selected
      });
      console.log("✅ New user created:", user._id);
      needsRoleSelection = true;
    } else if (!user.googleId) {
      console.log("🔗 Linking Google to existing user...");
      // Link Google account to existing user
      user.googleId = googleId;
      user.isGoogleAccount = true;
      if (picture) user.profilePicture = picture;
      await user.save();
    } else {
      console.log("✅ Existing Google user found");
      // Check if existing user still needs to select role
      if (!user.roleSelected) {
        needsRoleSelection = true;
      }
    }

    // Generate JWT
    const jwtToken = jwt.sign(
      { id: user._id, role: user.role },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    console.log("✅ Sending success response");
    
    res.json({
      message: "✅ Google sign-in successful",
      token: jwtToken,
      needsRoleSelection, // NEW: Tell frontend if role selection is needed
      user: {
        id: user._id,
        name: user.username,
        email: user.email,
        role: user.role,
        profilePicture: user.profilePicture,
        roleSelected: user.roleSelected,
      },
    });
  } catch (err) {
    console.error("❌ Google auth error:", err.message);
    console.error("Full error:", err);
    res.status(500).json({ 
      error: "Google authentication failed", 
      details: err.message 
    });
  }
});
// 🆕 Update User Role After Google Sign-In
router.post("/select-role", async (req, res) => {
  try {
    const { role } = req.body;
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.slice(7);
    const payload = jwt.verify(token, JWT_SECRET);
    
    const user = await User.findById(payload.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Validate role
    if (!["farmer", "ranger"].includes(role)) {
      return res.status(400).json({ message: "Invalid role. Choose 'farmer' or 'ranger'" });
    }

    // Update role
    user.role = role;
    user.roleSelected = true;
    await user.save();

    // Generate new JWT with updated role
    const newToken = jwt.sign(
      { id: user._id, role: user.role },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    res.json({
      message: "✅ Role selected successfully",
      token: newToken,
      user: {
        id: user._id,
        name: user.username,
        email: user.email,
        role: user.role,
        profilePicture: user.profilePicture,
      },
    });
  } catch (err) {
    console.error("Role selection error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Verify MFA code to finish login
router.post("/mfa/verify", async (req, res) => {
  try {
    const { code, tempToken } = req.body;
    if (!code || !tempToken) return res.status(400).json({ message: "Missing code or tempToken" });

    // Verify temp token and mfa flag
    let payload;
    try {
      payload = jwt.verify(tempToken, JWT_SECRET);
    } catch {
      return res.status(401).json({ message: "MFA token expired/invalid" });
    }
    if (!payload.mfa || !payload.id) return res.status(400).json({ message: "Invalid MFA flow" });

    const user = await User.findById(payload.id);
    if (!user || !user.twoFA?.enabled || !user.twoFA?.secret) {
      return res.status(400).json({ message: "MFA not enabled for this account" });
    }

    // Verify TOTP
    const speakeasy = require("speakeasy");
    const ok = speakeasy.totp.verify({
      secret: user.twoFA.secret,
      encoding: "base32",
      token: String(code).trim(),
      window: 1
    });
    if (!ok) return res.status(400).json({ message: "Invalid code" });

    // Issue final session token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    return res.json({
      message: "✅ MFA verified",
      token,
      user: {
        id: user._id,
        name: user.username,
        email: user.email,
        role: user.role,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 🆕 Request Password Reset (Issue #3)
router.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists
      return res.json({ message: "If that email exists, a reset link has been sent" });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");

    user.passwordResetToken = resetTokenHash;
    user.passwordResetExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    // Send email
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: user.email,
      subject: "Password Reset - WildTrack",
      html: `
        <h2>Password Reset Request</h2>
        <p>You requested a password reset. Click the link below to reset your password:</p>
        <a href="${resetUrl}">${resetUrl}</a>
        <p>This link expires in 1 hour.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
    });

    res.json({ message: "If that email exists, a reset link has been sent" });
  } catch (err) {
    console.error("Password reset error:", err);
    res.status(500).json({ error: "Failed to send reset email" });
  }
});

// 🆕 Reset Password (Issue #3)
router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ message: "Token and new password required" });
    }

    // Hash the token to compare with stored hash
    const resetTokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      passwordResetToken: resetTokenHash,
      passwordResetExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired reset token" });
    }

    // Update password
    user.password = await bcrypt.hash(newPassword, 10);
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    res.json({ message: "✅ Password reset successful" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;