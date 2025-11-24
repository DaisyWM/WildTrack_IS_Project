// backend/routes/stats.js
const express = require("express");
const Detection = require("../models/Detection");

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

// Try to require a Mongoose model if it exists.
// If you use a different model name/path, adjust this.
let DetectionModel = null;
try {
  DetectionModel = require("../models/Detection"); // optional - adjust if you named it differently
} catch (err) {
  // no model available — we'll fallback to reading detection_history.json
  DetectionModel = null;
}

/**
 * Helper to get records, using Mongo if available, otherwise file fallback.
 * Returns a Promise resolving to array of history entries.
 */
async function getAllRecords() {
  if (DetectionModel) {
    // Assume DetectionModel schema contains at least: snapshot, detected_at or createdAt
    // Adjust fields if your model is different.
    const docs = await DetectionModel.find({}).lean().exec();
    return docs;
  } else {
    return loadHistoryFromFile();
  }
}

/**
 * Utility: load history from disk if Mongo model not available.
 * Returns an array of "history entries" with the structure we expect from the python script:
 * {
 *   id, video, timestamp, snapshot: { file, path, frame, timestamp, detections: [{species,confidence,bbox}], alertLevel }, detected_at
 * }
 */
function loadHistoryFromFile() {
  if (!fs.existsSync(HISTORY_FILE)) return [];
  try {
    const raw = fs.readFileSync(HISTORY_FILE, "utf8");
    const data = JSON.parse(raw);
    if (Array.isArray(data)) return data;
    return [];
  } catch (e) {
    console.error("Failed to parse detection history file:", e);
    return [];
  }
}

/**
 * GET /api/stats/detections-timeline
 * Get detections count over time for charts
 * Query params: timeframe (24h | 7d | 30d)
 */
router.get("/detections-timeline", async (req, res) => {
  try {
    const { timeframe = "7d" } = req.query;
    const userId = req.user?._id; // Filter by user if logged in

    // Calculate date range
    const now = new Date();
    let startDate;
    let groupBy;

    if (timeframe === "24h") {
      startDate = new Date(now - 24 * 60 * 60 * 1000);
      groupBy = "hour";
    } else if (timeframe === "7d") {
      startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
      groupBy = "day";
    } else if (timeframe === "30d") {
      startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
      groupBy = "day";
    }

    const query = {
      createdAt: { $gte: startDate },
      status: "completed",
    };
    if (userId) query.userId = userId;

    // Aggregate detections by time period
    const pipeline = [
      { $match: query },
      {
        $group: {
          _id: {
            $dateToString: {
              format: groupBy === "hour" ? "%Y-%m-%d %H:00" : "%Y-%m-%d",
              date: "$createdAt",
            },
          },
          detections: { $sum: "$detections.total" },
          alerts: { $sum: { $size: "$alerts" } },
        },
      },
      { $sort: { _id: 1 } },
    ];

    const results = await Detection.aggregate(pipeline);

    // Format response
    const data = results.map((r) => ({
      label: r._id,
      detections: r.detections,
      alerts: r.alerts,
    }));

    res.json({
      success: true,
      timeframe,
      data,
    });
  } catch (error) {
    console.error("[STATS ERROR]", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/stats/species-breakdown
 * Get top species detected
 * Query params: dangerOnly (true/false)
 */
router.get("/species-breakdown", async (req, res) => {
  try {
    const userId = req.user?._id;
    const dangerOnly = req.query.dangerOnly === "true";
    
    const query = { status: "completed" };
    if (userId) query.userId = userId;

    const detections = await Detection.find(query).select("detections.speciesSummary");

    // Combine all species counts
    const speciesCounts = {};
    detections.forEach((det) => {
      if (det.detections?.speciesSummary) {
        for (const [species, count] of det.detections.speciesSummary) {
          // Filter dangerous species only if requested
          if (!dangerOnly || isDangerous(species)) {
            speciesCounts[species] = (speciesCounts[species] || 0) + count;
          }
        }
      }
    });

    // Convert to array and sort by count
    const data = Object.entries(speciesCounts)
      .map(([species, count]) => ({ species, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10); // Top 10

    res.json({
      success: true,
      dangerOnly,
      data,
    });
  } catch (error) {
    console.error("[SPECIES STATS ERROR]", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/stats/alert-outcomes
 * Returns counts by alert priority from the alerts array
 */
router.get("/alert-outcomes", async (req, res) => {
  try {
    const userId = req.user?._id;
    const query = { status: "completed" };
    if (userId) query.userId = userId;

    const detections = await Detection.find(query);
    
    const counts = { high: 0, medium: 0, low: 0 };
    
    detections.forEach((detection) => {
      // Count alerts by priority
      if (detection.alerts && Array.isArray(detection.alerts)) {
        detection.alerts.forEach(alert => {
          const priority = (alert.priority || 'medium').toLowerCase();
          if (counts.hasOwnProperty(priority)) {
            counts[priority]++;
          }
        });
      }
    });

    // Convert to array format for charts
    const data = Object.entries(counts)
      .filter(([priority, count]) => count > 0) // Only include priorities that have data
      .map(([priority, count]) => ({
        name: `${priority.charAt(0).toUpperCase() + priority.slice(1)} Priority`,
        value: count,
      }));

    console.log(`[ALERT OUTCOMES] Found ${data.length} priority levels:`, counts);

    res.json({ 
      success: true, 
      data,
      debug: {
        totalDetections: detections.length,
        priorityCounts: counts
      }
    });
  } catch (err) {
    console.error("alert-outcomes error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/stats/summary
 * Get overall summary stats
 * Query params: timeframe, dangerOnly
 */
router.get("/summary", async (req, res) => {
  try {
    const { timeframe = "7d", dangerOnly = "false" } = req.query;
    const userId = req.user?._id;
    const filterDanger = dangerOnly === "true";

    const now = new Date();
    let startDate;

    if (timeframe === "24h") {
      startDate = new Date(now - 24 * 60 * 60 * 1000);
    } else if (timeframe === "7d") {
      startDate = new Date(now - 7 * 24 * 60 * 60 * 1000);
    } else if (timeframe === "30d") {
      startDate = new Date(now - 30 * 24 * 60 * 60 * 1000);
    }

    const query = {
      createdAt: { $gte: startDate },
      status: "completed",
    };
    if (userId) query.userId = userId;

    const detections = await Detection.find(query);

    let totalDetections = 0;
    let totalAlerts = 0;

    detections.forEach(det => {
      if (filterDanger) {
        // Count only dangerous species
        if (det.detections?.speciesSummary) {
          for (const [species, count] of det.detections.speciesSummary) {
            if (isDangerous(species)) {
              totalDetections += count;
            }
          }
        }
        // Count only high-priority alerts
        totalAlerts += det.alerts.filter(a => a.priority === "high").length;
      } else {
        // Count all detections and alerts
        totalDetections += det.detections?.total || 0;
        totalAlerts += det.alerts?.length || 0;
      }
    });

    res.json({
      success: true,
      timeframe,
      dangerOnly: filterDanger,
      data: {
        totalDetections,
        totalAlerts,
        uploadsProcessed: detections.length,
      },
    });
  } catch (error) {
    console.error("[SUMMARY STATS ERROR]", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/stats/recent-detections
 * Get recent detection snapshots for preview
 */
router.get("/recent-detections", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const userId = req.user?._id;

    const query = { status: "completed" };
    if (userId) query.userId = userId;

    const detections = await Detection.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      // .select("snapshots createdAt");

    // Extract first snapshot from each detection
    const data = detections
      .filter((d) => d.snapshots && d.snapshots.length > 0)
      .map((d) => {
        const snapshot = d.snapshots[0];
        console.log("Snapshot:", snapshot); 
        return {
          image: snapshot.path,
          species: snapshot.detections.map((det) => det.species).join(", "),
          time: d.createdAt,
          alert: snapshot.alertLevel,
          confidence: snapshot.detections?.[0]?.confidence || 0,
          frame: snapshot.frame,
          confidenceLevel: snapshot.confidenceLevel,
          detectionType: snapshot.detectionType,
          notified: snapshot.notified
        };
      });

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("[RECENT DETECTIONS ERROR]", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;