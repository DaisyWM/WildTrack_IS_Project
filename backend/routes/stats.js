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
 * Get alert statistics
 */
router.get("/alert-outcomes", async (req, res) => {
  try {
    const userId = req.user?._id;
    
    const query = { status: "completed" };
    if (userId) query.userId = userId;

    const pipeline = [
      { $match: query },
      { $unwind: "$alerts" },
      {
        $group: {
          _id: "$alerts.priority",
          count: { $sum: 1 },
        },
      },
    ];

    const results = await Detection.aggregate(pipeline);

    // Format for pie chart
    const data = results.map((r) => ({
      name: `${r._id.charAt(0).toUpperCase() + r._id.slice(1)} Priority`,
      value: r.count,
    }));

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error("[ALERT STATS ERROR]", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
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
      .select("snapshots createdAt");

    // Extract first snapshot from each detection
    const data = detections
      .filter((d) => d.snapshots && d.snapshots.length > 0)
      .map((d) => {
        const snapshot = d.snapshots[0];
        return {
          image: snapshot.path,
          species: snapshot.detections.map((det) => det.species).join(", "),
          time: d.createdAt,
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