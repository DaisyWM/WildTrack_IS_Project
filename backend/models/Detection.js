// backend/models/Detection.js
const mongoose = require("mongoose");

const detectionSchema = new mongoose.Schema(
  {
    // User who uploaded
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false, // Optional if you want to allow anonymous uploads
    },
    username: {
      type: String,
      required: false,
    },

    // Video information
    video: {
      filename: { type: String, required: true },
      originalName: String,
      path: String,
      size: Number,
      duration: Number,
      fps: Number,
      totalFrames: Number,
      processedFrames: Number,
    },

    // Processing results
    detections: {
      total: { type: Number, default: 0 },
      speciesSummary: {
        type: Map,
        of: Number, // e.g., { "lion": 3, "zebra": 2 }
      },
    },

    // Alerts
    alerts: [
      {
        type: { type: String, default: "wildlife_detected" },
        priority: { type: String, enum: ["low", "medium", "high"] },
        species: String,
        timestamp: Number,
        frame: Number,
        image: String,
      },
    ],

    // Snapshots
    snapshots: [
      {
        file: String,
        path: String,
        frame: Number,
        timestamp: Number,
        alertLevel: { type: String, enum: ["low", "medium", "high"] },
        detections: [
          {
            species: String,
            confidence: Number,
            bbox: {
              x1: Number,
              y1: Number,
              x2: Number,
              y2: Number,
            },
          },
        ],
      },
    ],

    // Status
    status: {
      type: String,
      enum: ["processing", "completed", "failed"],
      default: "processing",
    },

    // Error info (if failed)
    error: String,
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

// Indexes for faster queries
detectionSchema.index({ userId: 1, createdAt: -1 });
detectionSchema.index({ "detections.speciesSummary": 1 });
detectionSchema.index({ status: 1 });

module.exports = mongoose.model("Detection", detectionSchema);