// backend/routes/stats.js
const express = require("express");
const Detection = require("../models/Detection");

const router = express.Router();

// List of dangerous species that require immediate ranger attention
const DANGEROUS_SPECIES = [
  "elephant",  // High: Property damage + human danger
  "lion",      // High: Livestock attacks + human danger
  "baboon",    // High: Crop raids (in groups)
  "warthog"    // Medium: Crop damage
];

function isDangerous(species) {
  return DANGEROUS_SPECIES.some(danger =>
    species.toLowerCase().includes(danger.toLowerCase())
  );
}

/**
 * Helper: calculate startDate from timeframe string
 */
function getStartDate(timeframe) {
  const now = new Date();
  if (timeframe === "24h") return new Date(now - 24 * 60 * 60 * 1000);
  if (timeframe === "30d") return new Date(now - 30 * 24 * 60 * 60 * 1000);
  return new Date(now - 7 * 24 * 60 * 60 * 1000); // default 7d
}

/**
 * GET /api/stats/detections-timeline
 * Get detections count over time for charts
 * Query params: timeframe (24h | 7d | 30d)
 */
router.get("/detections-timeline", async (req, res) => {
  try {
    const { timeframe = "7d" } = req.query;
    const userId = req.user?._id;
    const startDate = getStartDate(timeframe);
    const groupBy = timeframe === "24h" ? "hour" : "day";

    const query = {
      createdAt: { $gte: startDate },
      status: "completed",
    };
    if (userId) query.userId = userId;

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

    const data = results.map((r) => ({
      label: r._id,
      detections: r.detections,
      alerts: r.alerts,
    }));

    res.json({ success: true, timeframe, data });
  } catch (error) {
    console.error("[STATS ERROR]", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/stats/species-breakdown
 * Get top species detected — now respects timeframe
 * Query params: timeframe (24h | 7d | 30d), dangerOnly (true/false)
 */
router.get("/species-breakdown", async (req, res) => {
  try {
    const { timeframe = "7d", dangerOnly } = req.query;
    const userId = req.user?._id;
    const filterDanger = dangerOnly === "true";
    const startDate = getStartDate(timeframe);

    const query = {
      status: "completed",
      createdAt: { $gte: startDate },
    };
    if (userId) query.userId = userId;

    const detections = await Detection.find(query).select("detections.speciesSummary");

    const speciesCounts = {};
    detections.forEach((det) => {
      if (det.detections?.speciesSummary) {
        for (const [species, count] of det.detections.speciesSummary) {
          if (!filterDanger || isDangerous(species)) {
            speciesCounts[species] = (speciesCounts[species] || 0) + count;
          }
        }
      }
    });

    const data = Object.entries(speciesCounts)
      .map(([species, count]) => ({ species, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    res.json({ success: true, timeframe, dangerOnly: filterDanger, data });
  } catch (error) {
    console.error("[SPECIES STATS ERROR]", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/stats/alert-outcomes
 * Returns counts by alert priority — now respects timeframe
 * Query params: timeframe (24h | 7d | 30d)
 */
router.get("/alert-outcomes", async (req, res) => {
  try {
    const { timeframe = "7d" } = req.query;
    const userId = req.user?._id;
    const startDate = getStartDate(timeframe);

    const query = {
      status: "completed",
      createdAt: { $gte: startDate },
    };
    if (userId) query.userId = userId;

    const detections = await Detection.find(query);

    const counts = { high: 0, medium: 0, low: 0 };

    detections.forEach((detection) => {
      if (detection.alerts && Array.isArray(detection.alerts)) {
        detection.alerts.forEach(alert => {
          const priority = (alert.priority || "medium").toLowerCase();
          if (counts.hasOwnProperty(priority)) {
            counts[priority]++;
          }
        });
      }
    });

    const data = Object.entries(counts)
      .filter(([, count]) => count > 0)
      .map(([priority, count]) => ({
        name: `${priority.charAt(0).toUpperCase() + priority.slice(1)} Priority`,
        value: count,
      }));

    console.log(`[ALERT OUTCOMES] Found ${data.length} priority levels:`, counts);

    res.json({
      success: true,
      timeframe,
      data,
      debug: { totalDetections: detections.length, priorityCounts: counts }
    });
  } catch (err) {
    console.error("alert-outcomes error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/stats/summary
 * Get overall summary stats
 * Query params: timeframe (24h | 7d | 30d), dangerOnly (true/false)
 */
router.get("/summary", async (req, res) => {
  try {
    const { timeframe = "7d", dangerOnly = "false" } = req.query;
    const userId = req.user?._id;
    const filterDanger = dangerOnly === "true";
    const startDate = getStartDate(timeframe);

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
        if (det.detections?.speciesSummary) {
          for (const [species, count] of det.detections.speciesSummary) {
            if (isDangerous(species)) totalDetections += count;
          }
        }
        totalAlerts += det.alerts.filter(a => a.priority === "high").length;
      } else {
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
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/stats/recent-detections
 * Get recent detection snapshots for preview
 * Query params: limit (default 5)
 */
router.get("/recent-detections", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    const userId = req.user?._id;

    const query = { status: "completed" };
    if (userId) query.userId = userId;

    const detections = await Detection.find(query)
      .sort({ createdAt: -1 })
      .limit(limit);

    const data = detections
      .filter((d) => d.snapshots && d.snapshots.length > 0)
      .map((d) => {
        const snapshot = d.snapshots[0];
        return {
          image: snapshot.path,
          species: snapshot.detections.map((det) => det.species).join(", "),
          time: d.createdAt,
          alert: snapshot.alertLevel,
          confidence: snapshot.detections?.[0]?.confidence || 0,
          frame: snapshot.frame,
        };
      });

    res.json({ success: true, data });
  } catch (error) {
    console.error("[RECENT DETECTIONS ERROR]", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;