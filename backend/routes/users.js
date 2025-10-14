const express = require("express");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const router = express.Router();

/* -------- Inline middleware (no separate folder needed) -------- */

// Require a valid JWT in Authorization: Bearer <token>
function authRequired(req, res, next) {
  const h = req.headers.authorization || "";
  const token = h.startsWith("Bearer ") ? h.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Missing token" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.id || payload.sub, role: payload.role };
    next();
  } catch {
    return res.status(401).json({ message: "Invalid/expired token" });
  }
}

// Require one of the allowed roles
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user?.role || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
}

/* ---------------------- Admin user endpoints -------------------- */

// GET /api/users  (admin only) — list users
router.get("/", authRequired, requireRole("admin"), async (req, res) => {
  try {
    // Added profilePicture and isGoogleAccount to the select
    const users = await User
      .find({}, "username email role status createdAt profilePicture isGoogleAccount")
      .sort({ createdAt: -1 });
    res.json({ users });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load users" });
  }
});

// PATCH /api/users/:id  (admin only) — edit user fields
router.patch("/:id", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const { username, email, role, status } = req.body;

    const update = {};
    if (username !== undefined) update.username = username;
    if (email !== undefined)    update.email = email;
    if (role !== undefined)     update.role = role;
    if (status !== undefined)   update.status = status;

    const updated = await User.findByIdAndUpdate(
      id,
      update,
      { new: true, runValidators: true, select: "username email role status profilePicture isGoogleAccount" }
    );
    if (!updated) return res.status(404).json({ message: "User not found" });

    res.json({
      user: {
        id: updated._id,
        username: updated.username,
        email: updated.email,
        role: updated.role,
        status: updated.status,
        profilePicture: updated.profilePicture,
        isGoogleAccount: updated.isGoogleAccount,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to update user" });
  }
});

// DELETE /api/users/:id  (admin only) — remove user
router.delete("/:id", authRequired, requireRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await User.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: "User not found" });
    res.json({ message: "User deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to delete user" });
  }
});

// 🆕 GET /api/users/me  — get current user's profile
router.get("/me", authRequired, async (req, res) => {
  try {
    const user = await User.findById(
      req.user.id, 
      "username email role status profilePicture isGoogleAccount phoneNumber twoFA.enabled twoFA.method"
    );
    
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      status: user.status,
      profilePicture: user.profilePicture,
      isGoogleAccount: user.isGoogleAccount,
      phoneNumber: user.phoneNumber,
      twoFA: {
        enabled: user.twoFA?.enabled || false,
        method: user.twoFA?.method || null,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message || "Failed to load profile" });
  }
});

module.exports = router;