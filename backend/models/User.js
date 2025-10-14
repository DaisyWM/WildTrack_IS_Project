const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  email:    { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  role:     { type: String, enum: ["farmer", "ranger", "admin"], default: "farmer" },
  status:   { type: String, enum: ["active", "disabled"], default: "active" }, 

   // 2FA (TOTP)
  twoFA: {
    enabled: { type: Boolean, default: false },
    secret: { type: String, default: null },      // base32 secret (store encrypted later)
    // optional: backup codes later
  }
}, { timestamps: true });

module.exports = mongoose.model("User", UserSchema);
