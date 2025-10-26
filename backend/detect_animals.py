#!/usr/bin/env python3
"""
Wildlife Detection System
Processes video, detects animals, saves snapshots with bounding boxes
(Phone-friendly snapshots: resized + compressed)
🆕 Sends push notifications when animals are detected
"""

import os
import sys
import json
import cv2
import subprocess
from datetime import datetime
from pathlib import Path
from ultralytics import YOLO

# --- Configuration ---
if len(sys.argv) < 2:
    print(json.dumps({"error": "Usage: python detect_animals.py <video_path>"}))
    sys.exit(1)

video_path = sys.argv[1]
model_path = os.path.join("..", "model_training", "models", "my_trained_wildlife_model.pt")
output_folder = "snapshots"

# Detection
CONFIDENCE_THRESHOLD = 0.50
FRAME_SKIP = 5  # process every 5th frame for speed

# Snapshot sizing & compression (tweak if needed)
MAX_SNAPSHOT_WIDTH = 480
MAX_SNAPSHOT_HEIGHT = 480
JPEG_QUALITY = 70  # 0-100 (lower = smaller file)

# Cooldown (seconds) to avoid spamming same-species snapshots
COOLDOWN_SECONDS = 180

# Create output folder if it doesn't exist
os.makedirs(output_folder, exist_ok=True)


# 🆕 PUSH NOTIFICATION FUNCTION
def send_push_notification(species, snapshot_path, alert_level):
    """
    Trigger push notification via Node.js helper script
    """
    try:
        result = subprocess.run(
            ['node', 'sendNotification.js', species, snapshot_path, alert_level],
            capture_output=True,
            text=True,
            timeout=5
        )
        if result.returncode == 0:
            print(f"📲 Push notification sent for {species}", file=sys.stderr)
        else:
            print(f"⚠️ Failed to send push notification: {result.stderr}", file=sys.stderr)
    except Exception as e:
        print(f"⚠️ Error sending push notification: {e}", file=sys.stderr)


try:
    # Validate video file exists
    if not os.path.exists(video_path):
        raise FileNotFoundError(f"Video file not found: {video_path}")

    # Validate model exists
    if not os.path.exists(model_path):
        raise FileNotFoundError(f"Model not found: {model_path}")

    # Load YOLO model
    print(f"Loading model from {model_path}...", file=sys.stderr)
    model = YOLO(model_path)

    # Open video
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise ValueError(f"Could not open video: {video_path}")

    # Get video properties
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 0.0

    print(f"Processing video: {total_frames} frames at {fps} FPS", file=sys.stderr)

    frame_number = 0
    processed_frames = 0
    saved_snapshots = []
    last_snapshot_time = {}  # Track last snapshot time per species

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        frame_number += 1

        # Skip frames for faster processing
        if FRAME_SKIP > 1 and frame_number % FRAME_SKIP != 0:
            continue

        processed_frames += 1

        # Run YOLO inference on the frame
        results = model(frame, conf=CONFIDENCE_THRESHOLD, verbose=False)

        boxes = results[0].boxes

        # Extract detections with confidence scores
        detections = []
        for box in boxes:
            cls_id = int(box.cls[0])
            confidence = float(box.conf[0])
            animal_name = model.names[cls_id]
            x1, y1, x2, y2 = box.xyxy[0].tolist()

            detections.append({
                "species": animal_name,
                "confidence": round(confidence, 3),
                "bbox": {
                    "x1": int(x1),
                    "y1": int(y1),
                    "x2": int(x2),
                    "y2": int(y2)
                }
            })

        # Check if we should save snapshots
        if detections:
            current_time = (frame_number / fps) if fps > 0 else 0.0

            # Unique species in this frame
            species_in_frame = set(d["species"] for d in detections)

            for species in species_in_frame:
                time_since_last = current_time - last_snapshot_time.get(species, -999999.0)

                if time_since_last >= COOLDOWN_SECONDS:
                    # SAVE SNAPSHOT!
                    last_snapshot_time[species] = current_time

                    # Detections for this species only
                    species_detections = [d for d in detections if d["species"] == species]

                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    snapshot_name = f"{species}_{timestamp}_frame{frame_number}.jpg"
                    snapshot_path = os.path.join(output_folder, snapshot_name)

                    # Annotate frame with bounding boxes at original resolution
                    annotated_frame = results[0].plot()

                    # --- Resize to fit phone (keep aspect ratio, cap both width & height) ---
                    h, w = annotated_frame.shape[:2]
                    scale_w = (MAX_SNAPSHOT_WIDTH / w) if w > 0 else 1.0
                    scale_h = (MAX_SNAPSHOT_HEIGHT / h) if h > 0 else 1.0
                    scale = min(scale_w, scale_h, 1.0)  # never upscale

                    if scale < 1.0:
                        new_w = int(w * scale)
                        new_h = int(h * scale)
                        annotated_frame = cv2.resize(
                            annotated_frame, (new_w, new_h), interpolation=cv2.INTER_AREA
                        )

                    # --- Save (compressed JPEG) ---
                    cv2.imwrite(
                        snapshot_path,
                        annotated_frame,
                        [int(cv2.IMWRITE_JPEG_QUALITY), int(JPEG_QUALITY)]
                    )

                    time_in_video = (frame_number / fps) if fps > 0 else 0.0

                    snapshot_info = {
                        "file": snapshot_name,
                        "path": f"/snapshots/{snapshot_name}",
                        "frame": frame_number,
                        "timestamp": time_in_video,
                        "detections": species_detections,
                        "alert_level": "high" if species in ["lion", "elephant", "buffalo"] else "medium"
                    }

                    saved_snapshots.append(snapshot_info)
                    
                    # 🆕 SEND PUSH NOTIFICATION
                    send_push_notification(
                        species=species,
                        snapshot_path=snapshot_info["path"],
                        alert_level=snapshot_info["alert_level"]
                    )

                    print(
                        f"📸 Snapshot saved: {species} at {time_in_video:.1f}s "
                        f"(conf: {species_detections[0]['confidence']})",
                        file=sys.stderr
                    )

    cap.release()

    # Prepare output JSON
    output = {
        "success": True,
        "message": "Video processing complete",
        "video": {
            "path": video_path,
            "total_frames": total_frames,
            "processed_frames": processed_frames,
            "fps": fps,
            "duration": (total_frames / fps) if fps > 0 else 0.0
        },
        "snapshots_folder": output_folder,
        "total_detections": len(saved_snapshots),
        "snapshots": saved_snapshots,
        "species_summary": {
            species: sum(1 for s in saved_snapshots if species in [d["species"] for d in s["detections"]])
            for species in set(d["species"] for s in saved_snapshots for d in s["detections"])
        }
    }

    # SAVE detection history to a file
    history_file = "detection_history.json"

    # Load existing history if it exists
    if os.path.exists(history_file):
        with open(history_file, 'r') as f:
            try:
                history = json.load(f)
            except Exception:
                history = []
    else:
        history = []

    # Add new detections to history (only if there were snapshots)
    if len(saved_snapshots) > 0:
        for snapshot in saved_snapshots:
            history.append({
                "id": len(history) + 1,
                "video": os.path.basename(video_path),
                "timestamp": datetime.now().isoformat(),
                "snapshot": snapshot,
                "detected_at": snapshot["timestamp"]
            })

        # Keep only last 50 detections (don't let file get too big)
        history = history[-50:]

        # Save updated history
        with open(history_file, 'w') as f:
            json.dump(history, f, indent=2)

        print(f"💾 Saved {len(saved_snapshots)} detections to history", file=sys.stderr)

    # Print JSON output for Node.js to parse
    print(json.dumps(output, indent=2))
    sys.exit(0)

except Exception as e:
    error_output = {
        "success": False,
        "error": str(e),
        "snapshots": []
    }
    print(json.dumps(error_output), file=sys.stderr)
    sys.exit(1)