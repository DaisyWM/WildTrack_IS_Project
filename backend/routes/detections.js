const express = require("express");
const router = express.Router();
const Detection = require("../models/Detection");

// GET /api/detections/history - Get recent detections
router.get("/history", async (req, res) => {
  try {
    // Get last 50 detections, sorted by most recent first
    const detections = await Detection.find()
      .sort({ createdAt: -1 })
      .limit(50)
      .select("video detections alerts snapshots status createdAt updatedAt username")
      .lean();

    res.json(detections);
  } catch (error) {
    console.error("Error fetching detections:", error);
    res.status(500).json({ error: "Failed to load detections" });
  }
});

// GET /api/detections/:id - Get single detection details
router.get("/:id", async (req, res) => {
  try {
    const detection = await Detection.findById(req.params.id).lean();
    
    if (!detection) {
      return res.status(404).json({ error: "Detection not found" });
    }
    
    res.json(detection);
  } catch (error) {
    console.error("Error fetching detection:", error);
    res.status(500).json({ error: "Failed to load detection" });
  }
});

module.exports = router;