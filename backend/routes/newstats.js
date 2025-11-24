// backend/routes/newstats.js
const express = require("express");
const fs = require("fs");
const path = require("path");

const router = express.Router();

// List of dangerous species that require immediate ranger attention
// Based on wildlife corridor threats to farms
const DANGEROUS_SPECIES = [
  "elephant",  // High: Property damage + human danger
  "lion",      // High: Livestock attacks + human danger  
  "baboon",    // High: Crop raids (in groups)
  "warthog"    // Medium: Crop damage
];
// Note: Zebras are tracked but not considered "dangerous" for ranger alerts

// Helper function to check if species is dangerous
function isDangerous(species) {
  return DANGEROUS_SPECIES.some(danger => 
    species.toLowerCase().includes(danger.toLowerCase())
  );
}

const HISTORY_FILE = path.join(__dirname, "..", "detection_history.json");

/**
 * Load detection history from JSON file
 */
function loadHistoryFromFile() {
  if (!fs.existsSync(HISTORY_FILE)) {
    console.warn(`Detection history file not found: ${HISTORY_FILE}`);
    return [];
  }
  try {
    const raw = fs.readFileSync(HISTORY_FILE, "utf8");
    const data = JSON.parse(raw);
    if (Array.isArray(data)) {
      console.log(`[NEWSTATS] Loaded ${data.length} records from detection_history.json`);
      return data;
    }
    return [];
  } catch (e) {
    console.error("Failed to parse detection history file:", e);
    return [];
  }
}

/**
 * Get all records from JSON file only
 */
async function getAllRecords() {
  return loadHistoryFromFile();
}

/**
 * Utility: convert timeframe param to cutoff Date
 */
function timeframeToCutoff(timeframe) {
  const now = Date.now();
  if (!timeframe) return new Date(0);
  if (timeframe === "24h") return new Date(now - 24 * 3600 * 1000);
  if (timeframe === "7d") return new Date(now - 7 * 24 * 3600 * 1000);
  if (timeframe === "30d") return new Date(now - 30 * 24 * 3600 * 1000);

  // allow numeric days: e.g. ?timeframe=14 => last 14 days
  const asNum = parseInt(timeframe, 10);
  if (!isNaN(asNum)) return new Date(now - asNum * 24 * 3600 * 1000);
  return new Date(0);
}

/**
 * GET /api/newstats/summary
 * Get overall summary stats from JSON file
 * Query params: timeframe
 */
router.get("/summary", async (req, res) => {
  try {
    const tf = req.query.timeframe || "7d";
    const cutoff = timeframeToCutoff(tf);
    const records = await getAllRecords();

    const filtered = records.filter((r) => {
      const t = new Date(r.detected_at || r.timestamp || 0);
      return t >= cutoff;
    });

    const totalDetections = filtered.length;
    
    // Count high alerts from snapshot alertLevel
    const totalAlerts = filtered.reduce((acc, r) => {
      const lvl = r.snapshot?.alertLevel || "medium";
      return acc + (lvl === "high" ? 1 : 0);
    }, 0);

    // Count unique video files
    const uploadsProcessed = new Set(
      filtered.map((r) => r.video || "unknown")
    ).size;

    console.log(`[NEWSTATS SUMMARY] Found ${totalDetections} detections, ${totalAlerts} high alerts, ${uploadsProcessed} videos`);

    res.json({
      success: true,
      data: {
        totalDetections,
        totalAlerts,
        uploadsProcessed,
      },
    });
  } catch (err) {
    console.error("newstats summary error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/newstats/alert-outcomes
 * Returns counts by alertLevel from JSON file
 */
router.get("/alert-outcomes", async (req, res) => {
  try {
    const records = await getAllRecords();
    const counts = { high: 0, medium: 0, low: 0 };
    
    records.forEach((r) => {
      const lvl = (r.snapshot?.alertLevel || "medium").toLowerCase();
      if (counts.hasOwnProperty(lvl)) {
        counts[lvl]++;
      }
    });

    // Convert to array format for charts
    const data = Object.entries(counts)
      .filter(([priority, count]) => count > 0)
      .map(([priority, count]) => ({
        name: `${priority.charAt(0).toUpperCase() + priority.slice(1)} Priority`,
        value: count,
      }));

    console.log(`[NEWSTATS ALERT OUTCOMES] Found ${data.length} priority levels:`, counts);

    res.json({ 
      success: true, 
      data,
      debug: {
        totalRecords: records.length,
        priorityCounts: counts
      }
    });
  } catch (err) {
    console.error("newstats alert-outcomes error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/newstats/species-breakdown
 * Returns species breakdown from JSON file
 */
router.get("/species-breakdown", async (req, res) => {
  try {
    const records = await getAllRecords();
    const counts = {};
    
    records.forEach((r) => {
      const detections = r.snapshot?.detections || [];
      detections.forEach((d) => {
        const s = (d.species || "unknown").toLowerCase();
        counts[s] = (counts[s] || 0) + 1;
      });
    });

    const arr = Object.keys(counts)
      .map((s) => ({ species: s, count: counts[s] }))
      .sort((a, b) => b.count - a.count);

    res.json({ success: true, data: arr });
  } catch (err) {
    console.error("newstats species error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/newstats/recent-detections
 * Get recent detection snapshots from JSON file
 */
router.get("/recent-detections", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || "10", 10);
    const records = await getAllRecords();

    // Sort by detected_at (descending)
    const sorted = records
      .slice()
      .sort((a, b) => {
        const ta = new Date(a.detected_at || a.timestamp || 0).getTime();
        const tb = new Date(b.detected_at || b.timestamp || 0).getTime();
        return tb - ta;
      })
      .slice(0, limit);

    // Transform to expected format
    const data = sorted
      .filter((r) => r.snapshot)
      .map((r) => {
        const snapshot = r.snapshot;
        
        return {
          id: r.id,
          image: snapshot.path,
          species: snapshot.detections?.map((det) => det.species).join(", ") || "Unknown",
          time: r.detected_at,
          alertLevel: snapshot.alertLevel || 'medium',
          confidence: snapshot.detections?.[0]?.confidence || 0,
          frame: snapshot.frame || 0,
          video: r.video
        };
      });

    console.log(`[NEWSTATS RECENT DETECTIONS] Processed ${data.length} snapshots from ${records.length} records`);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("[NEWSTATS RECENT DETECTIONS ERROR]", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;