const express = require("express");
const multer = require("multer");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const Detection = require("../models/Detection");

const router = express.Router();

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = "uploads/";
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const sanitized = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
    cb(null, `${timestamp}_${sanitized}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /mp4|avi|mov|mkv|webm/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Only video files (mp4, avi, mov, mkv, webm) are allowed"));
  },
});

/**
 * POST /api/uploads
 * Upload video and run wildlife detection
 */
router.post("/", upload.single("video"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ 
      success: false, 
      message: "No video uploaded" 
    });
  }

  const videoPath = path.join(__dirname, "../uploads", req.file.filename);
  const pythonScript = path.join(__dirname, "../detect_animals.py");

  console.log(`[UPLOAD] Processing video: ${req.file.filename}`);

  // Spawn Python process
  const python = spawn("python", [pythonScript, videoPath]);

  let dataString = "";
  let errorString = "";

  python.stdout.on("data", (data) => {
    dataString += data.toString();
    console.log(`[PYTHON STDOUT] ${data.toString()}`);
  });

  python.stderr.on("data", (data) => {
    const msg = data.toString();
      console.log(`[PYTHON STDERR] ${msg}`);
    errorString += msg;
  });

  python.on("close", async (code) => {
    console.log(`[PYTHON] Process exited with code ${code}`);

    if (code !== 0) {
      console.error("[ERROR]", errorString);
      
      // Save failed detection to database
      try {
        await Detection.create({
          userId: req.user?._id,
          username: req.user?.username,
          video: {
            filename: req.file.filename,
            originalName: req.file.originalname,
            size: req.file.size,
          },
          status: "failed",
          error: errorString,
        });
      } catch (dbErr) {
        console.error("[DB ERROR]", dbErr);
      }

      return res.status(500).json({
        success: false,
        message: "Detection failed",
        error: errorString,
        video: req.file.filename,
      });
    }

    try {
      // Clean the data string - remove any non-JSON lines at the beginning
      const lines = dataString.trim().split('\n');
      let jsonStart = -1;
      
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith('{')) {
          jsonStart = i;
          break;
        }
      }
      
      if (jsonStart === -1) {
        throw new Error('No JSON output found');
      }
      
      const jsonString = lines.slice(jsonStart).join('\n');
      const result = JSON.parse(jsonString);

      if (!result.success) {
        return res.status(500).json({
          success: false,
          message: result.error || "Detection failed",
          video: req.file.filename,
        });
      }

      // Generate alerts for high-priority detections
      const alerts = result.snapshots
        .map(s => ({
          type: "wildlife_detected",
          priority: s.alertLevel,
          species: s.detections.map(d => d.species).join(", "),
          timestamp: s.timestamp,
          image: s.path,
          frame: s.frame,
        }));

      // Save detection to database
      const savedDetection = await Detection.create({
        userId: req.user?._id,
        username: req.user?.username,
        video: {
          filename: req.file.filename,
          originalName: req.file.originalname,
          path: `/uploads/${req.file.filename}`,
          size: req.file.size,
          duration: result.video.duration,
          fps: result.video.fps,
          totalFrames: result.video.total_frames,
          processedFrames: result.video.processed_frames,
        },
        detections: {
          total: result.total_detections,
          speciesSummary: result.species_summary,
        },
        alerts: alerts,
        snapshots: result.snapshots,
        status: "completed",
      });

      // Return enhanced response
      res.json({
        success: true,
        message: "Video processed successfully",
        detectionId: savedDetection._id, // NEW: Return database ID
        video: {
          filename: req.file.filename,
          path: `/uploads/${req.file.filename}`,
          size: req.file.size,
        },
        processing: {
          total_frames: result.video.total_frames,
          processed_frames: result.video.processed_frames,
          duration: result.video.duration,
          fps: result.video.fps,
        },
        detections: {
          total: result.total_detections,
          species_summary: result.species_summary,
          snapshots: result.snapshots,
        },
        alerts: alerts,
        snapshots_folder: result.snapshots_folder,
      });

      // Log alerts (for testing - replace with real alert system later)
      if (alerts.length > 0) {
        console.log(`[ALERT] ${alerts.length} high-priority detection(s):`);
        alerts.forEach(alert => {
          console.log(`  - ${alert.species} at ${alert.timestamp.toFixed(2)}s`);
        });
      }

    } catch (parseError) {
      console.error("[PARSE ERROR]", parseError);
      console.error("[RAW OUTPUT]", dataString);
      return res.status(500).json({
        success: false,
        message: "Failed to parse detection results",
        error: parseError.message,
        raw_output: dataString,
      });
    }
  });

  python.on("error", (err) => {
    console.error("[SPAWN ERROR]", err);
    res.status(500).json({
      success: false,
      message: "Failed to start detection process",
      error: err.message,
    });
  });
});

/**
 * GET /api/uploads/snapshots
 * List all saved snapshots
 */
router.get("/snapshots", (req, res) => {
  const snapshotsDir = path.join(__dirname, "../snapshots");
  
  if (!fs.existsSync(snapshotsDir)) {
    return res.json({ snapshots: [] });
  }

  const files = fs.readdirSync(snapshotsDir)
    .filter(file => file.match(/\.(jpg|jpeg|png)$/i))
    .map(file => ({
      name: file,
      path: `/snapshots/${file}`,
      created: fs.statSync(path.join(snapshotsDir, file)).mtime,
    }))
    .sort((a, b) => b.created - a.created);

  res.json({ snapshots: files });
});

/**
 * DELETE /api/uploads/snapshots/:filename
 * Delete a specific snapshot
 */
router.delete("/snapshots/:filename", (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(__dirname, "../snapshots", filename);

  if (!fs.existsSync(filepath)) {
    return res.status(404).json({ 
      success: false, 
      message: "Snapshot not found" 
    });
  }

  fs.unlinkSync(filepath);
  res.json({ 
    success: true, 
    message: "Snapshot deleted" 
  });
});

/**
 * GET /api/uploads/detections
 * Get all saved detections (with pagination)
 */
router.get("/detections", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = req.user?._id ? { userId: req.user._id } : {};

    const detections = await Detection.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("-__v");

    const total = await Detection.countDocuments(query);

    res.json({
      success: true,
      detections,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[GET DETECTIONS ERROR]", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/uploads/detections/:id
 * Get a specific detection by ID
 */
router.get("/detections/:id", async (req, res) => {
  try {
    const detection = await Detection.findById(req.params.id);

    if (!detection) {
      return res.status(404).json({
        success: false,
        message: "Detection not found",
      });
    }

    res.json({
      success: true,
      detection,
    });
  } catch (error) {
    console.error("[GET DETECTION ERROR]", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DELETE /api/uploads/detections/:id
 * Delete a detection record
 */
router.delete("/detections/:id", async (req, res) => {
  try {
    const detection = await Detection.findByIdAndDelete(req.params.id);

    if (!detection) {
      return res.status(404).json({
        success: false,
        message: "Detection not found",
      });
    }

    // Optionally delete the video and snapshot files
    // (commented out for safety - enable if needed)
    /*
    try {
      const videoPath = path.join(__dirname, "..", detection.video.path);
      if (fs.existsSync(videoPath)) {
        fs.unlinkSync(videoPath);
      }
    } catch (err) {
      console.error("Error deleting video file:", err);
    }
    */

    res.json({
      success: true,
      message: "Detection deleted",
    });
  } catch (error) {
    console.error("[DELETE DETECTION ERROR]", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/uploads/debug-db
 * Debug database contents
 */
router.get("/debug-db", async (req, res) => {
  try {
    const totalDetections = await Detection.countDocuments();
    const completedDetections = await Detection.countDocuments({ status: "completed" });
    
    // Get a sample detection to see the structure
    const sampleDetection = await Detection.findOne({ status: "completed" });
    
    // Get all detection statuses
    const statuses = await Detection.distinct("status");
    
    res.json({
      success: true,
      stats: {
        total: totalDetections,
        completed: completedDetections,
        statuses: statuses
      },
      sampleDetection: sampleDetection ? {
        id: sampleDetection._id,
        status: sampleDetection.status,
        hasAlerts: !!sampleDetection.alerts,
        alertsCount: sampleDetection.alerts?.length || 0,
        alertsStructure: sampleDetection.alerts,
        hasSnapshots: !!sampleDetection.snapshots,
        snapshotsCount: sampleDetection.snapshots?.length || 0,
        createdAt: sampleDetection.createdAt
      } : null,
      allFields: sampleDetection ? Object.keys(sampleDetection.toObject()) : []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/uploads/inspect-alerts
 * Inspect alerts structure specifically
 */
router.get("/inspect-alerts", async (req, res) => {
  try {
    const detections = await Detection.find({ status: "completed" }).limit(5);
    
    const inspection = detections.map(det => ({
      id: det._id,
      hasAlerts: !!det.alerts,
      alertsType: Array.isArray(det.alerts) ? 'array' : typeof det.alerts,
      alertsLength: det.alerts?.length || 0,
      alertsContent: det.alerts,
      hasSnapshots: !!det.snapshots,
      snapshotsWithAlertLevel: det.snapshots?.filter(s => s.alertLevel).length || 0,
      createdAt: det.createdAt
    }));
    
    res.json({
      success: true,
      inspection
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;