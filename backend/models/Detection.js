const mongoose = require("mongoose");

const detectionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: false,
    },
    username: { type: String, required: false },

    video: {
      filename: { type: String, required: true },
      originalName: String,
      path: String, // Local path for the video file
      size: Number,
      duration: Number,
      fps: Number,
      totalFrames: Number,
      processedFrames: Number,
    },

    detections: {
      total: { type: Number, default: 0 },
      speciesSummary: {
        type: Map,
        of: Number,
      },
    },

    alerts: [
      {
        type: { type: String, default: "wildlife_detected" },
        priority: { type: String, enum: ["low", "medium", "high"] },
        species: String,
        timestamp: Number,
        frame: Number,
        image: String, // NOTE: This will now store the Cloudinary HTTPS URL
      },
    ],

    snapshots: [
      {
        file: String,
        path: String, // NOTE: This will now store the Cloudinary HTTPS URL
        cloudinaryId: String, // NEW: Stores the ID for easier management/deletion
        frame: Number,
        timestamp: Number, //record date and time
        alertLevel: { type: String, enum: ["low", "medium", "high"] },
        detections: [
          {
            species: String,
            confidence: Number,
            bbox: { x1: Number, y1: Number, x2: Number, y2: Number },
          },
        ],
      },
    ],

    status: {
      type: String,
      enum: ["processing", "completed", "failed"],
      default: "processing",
    },

    error: String,
  },
  {
    timestamps: true,
  }
);

detectionSchema.index({ userId: 1, createdAt: -1 });
detectionSchema.index({ status: 1 });

module.exports = mongoose.model("Detection", detectionSchema);