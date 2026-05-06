const express = require("express");
const multer = require("multer");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const cloudinary = require("cloudinary").v2; // NEW: Cloudinary import
const Detection = require("../models/Detection");

const router = express.Router();

// ---------- Cloudinary Configuration ----------
// Pulls keys from your .env file for security
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ---------- Multer Local Storage (for the Video) ----------
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
  limits: { fileSize: 300 * 1024 * 1024 }, // 300MB limit
  fileFilter: (req, file, cb) => {
    // 1. Define allowed patterns
    const allowedExtensions = /mp4|avi|mov|mkv|webm/;
    // 2. Added 'octet-stream' to handle cases where the browser doesn't identify the video correctly
    const allowedMimeTypes = /video\/(mp4|x-msvideo|quicktime|x-matroska|webm)|application\/octet-stream/;

    // 3. Test both
    const extname = allowedExtensions.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedMimeTypes.test(file.mimetype);
    
    // 4. CHANGE: Use || (OR) so if either matches, the file is accepted
    if (mimetype || extname) {
      return cb(null, true);
    }
    
    cb(new Error("Only video files (mp4, avi, mov, mkv, webm) are allowed"));
  },
});

/**
 * POST /api/uploads
 * Upload video and run wildlife detection
 */

// This route handles the video upload and starts the ML process

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

  const python = spawn("python3", [pythonScript, videoPath]); //start the ml

  let dataString = "";
  let errorString = "";

  python.stdout.on("data", (data) => {
    dataString += data.toString();
  });

  python.stderr.on("data", (data) => {
    errorString += data.toString();
  });

  python.on("close", async (code) => {
    if (code !== 0) {
      console.error("[PYTHON ERROR]", errorString);
      try {
        await Detection.create({
          userId: req.user?._id,
          username: req.user?.username,
          video: { filename: req.file.filename },
          status: "failed",
          error: errorString,
        });
      } catch (dbErr) { console.error(dbErr); }

      return res.status(500).json({ success: false, message: "Detection failed" });
    }

    try {
      const lines = dataString.trim().split('\n');
      let jsonStart = lines.findIndex(line => line.trim().startsWith('{'));
      
      if (jsonStart === -1) throw new Error('No JSON output found');
      
      const jsonString = lines.slice(jsonStart).join('\n');
      const result = JSON.parse(jsonString);

      // ---------- CLOUD UPLOAD LOGIC ----------
      // We map through the snapshots found by Python and upload them to Cloudinary
      const cloudSnapshots = await Promise.all(
        result.snapshots.map(async (snapshot) => {
          const uploadResult = await cloudinary.uploader.upload(snapshot.path, {
            folder: "wildtrack_snapshots",
          });
          return {
            ...snapshot,
            path: uploadResult.secure_url, // This replaces the local path with a web link!
          };
        })
      );

      // Generate alerts using the new Cloud URLs
      const alerts = cloudSnapshots.map(s => ({
        type: "wildlife_detected",
        priority: s.alertLevel,
        species: s.detections.map(d => d.species).join(", "),
        timestamp: s.timestamp,
        image: s.path, // Secure URL from Cloudinary
        frame: s.frame,
      }));

      // Save record to MongoDB Atlas with the Cloud links
      const savedDetection = await Detection.create({
        userId: req.user?._id,
        username: req.user?.username,
        video: {
          filename: req.file.filename,
          originalName: req.file.originalname,
          path: `/uploads/${req.file.filename}`,
          size: req.file.size,
          duration: result.video.duration,
        },
        detections: {
          total: result.total_detections,
          speciesSummary: result.species_summary,
        },
        alerts: alerts,
        snapshots: cloudSnapshots,
        status: "completed",
      });

      res.json({
        success: true,
        message: "Video processed and images synced to cloud",
        detectionId: savedDetection._id,
        alerts: alerts,
        snapshots: cloudSnapshots
      });

    } catch (parseError) {
      console.error("[PARSE ERROR]", parseError);
      res.status(500).json({ success: false, error: parseError.message });
    }
  });
});

/**
 * GET /api/uploads/detections
 * Get history from MongoDB
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
      .limit(limit);

    const total = await Detection.countDocuments(query);

    res.json({
      success: true,
      detections,
      pagination: { total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;