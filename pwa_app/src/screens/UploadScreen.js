import React, { useState } from "react";
import "../styles/Upload.css";

const UploadScreen = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  // Get API URL from environment or default to localhost
  const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setResult(null);
      setError(null);
      setProgress(0);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      alert("Please select a file first.");
      return;
    }

    setUploading(true);
    setError(null);
    setResult(null);
    setProgress(0);

    const formData = new FormData();
    formData.append("video", file);

    try {
      // Create XMLHttpRequest to track upload progress
      const xhr = new XMLHttpRequest();

      // Track upload progress
      xhr.upload.addEventListener("progress", (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 100);
          setProgress(percentComplete);
        }
      });

      // Handle response
      xhr.addEventListener("load", () => {
        setUploading(false);
        if (xhr.status === 200) {
          const data = JSON.parse(xhr.responseText);
          setResult(data);
          console.log("Detection results:", data);
        } else {
          const errorData = JSON.parse(xhr.responseText);
          setError(errorData.message || "Upload failed");
        }
      });

      // Handle errors
      xhr.addEventListener("error", () => {
        setUploading(false);
        setError("Network error. Please check your connection.");
      });

      // Send request
      xhr.open("POST", `${API_URL}/api/uploads`);
      xhr.send(formData);

    } catch (err) {
      console.error("Upload error:", err);
      setError(err.message || "Upload failed");
      setUploading(false);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const droppedFiles = e.dataTransfer.files;
    if (droppedFiles && droppedFiles.length > 0) {
      const droppedFile = droppedFiles[0];
      if (droppedFile.type.startsWith("video/") || droppedFile.name.match(/\.(mp4|avi|mov|mkv|webm)$/i)) {
        setFile(droppedFile);
        setResult(null);
        setError(null);
        setProgress(0);
      } else {
        alert("Please drop a valid video file (mp4, avi, mov, mkv, webm)");
      }
    }
  };

  return (
    <div className="upload-container">
      <h2 className="upload-title">Upload Wildlife Videos</h2>

      <div
        className="dropzone"
        onClick={() => !uploading && document.getElementById("fileInput").click()}
        onDragOver={handleDragOver}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <p>📂 Drag & Drop a video here or click to select</p>
        <input
          type="file"
          id="fileInput"
          className="file-input"
          accept="video/mp4,video/avi,video/mov,video/mkv,video/webm,video/*"
          onChange={handleFileChange}
          disabled={uploading}
        />
      </div>

      {file && (
        <div className="file-selected">
          <p className="file-name">
            Selected: {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
          </p>
          <button 
            className="clear-btn" 
            onClick={() => {
              setFile(null);
              setResult(null);
              setError(null);
              setProgress(0);
              // Reset the file input
              const fileInput = document.getElementById("fileInput");
              if (fileInput) fileInput.value = "";
            }}
            disabled={uploading}
          >
            ✖ Remove
          </button>
        </div>
      )}

      {/* Upload Progress */}
      {uploading && (
        <div className="progress-container">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <p className="progress-text">
            {progress < 100 ? `Uploading... ${progress}%` : "Processing video..."}
          </p>
        </div>
      )}

      <button 
        className="upload-btn" 
        onClick={handleUpload}
        disabled={!file || uploading}
      >
        {uploading ? "⏳ Processing..." : "🚀 Upload Video"}
      </button>

      {/* Error Display */}
      {error && (
        <div className="error-message">
          <p>❌ Error: {error}</p>
        </div>
      )}

      {/* Results section */}
      <div className="results">
        <h3>Detection Results</h3>
        
        {!result && !error && !uploading && (
          <p className="no-results">No results yet. Upload a video to see detections.</p>
        )}

        {result && result.success && (
          <div className="results-content">
            {/* Success Message */}
            <div className="success-message">
              ✅ Video processed successfully! Found {result.detections.total} detection(s)
            </div>

            {/* Video Info */}
            <div className="info-card">
              <h4>📹 Video Information</h4>
              <div className="info-grid">
                <div className="info-item">
                  <span className="info-label">Duration:</span>
                  <span className="info-value">{result.processing.duration.toFixed(1)}s</span>
                </div>
                <div className="info-item">
                  <span className="info-label">FPS:</span>
                  <span className="info-value">{result.processing.fps.toFixed(1)}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Frames Processed:</span>
                  <span className="info-value">
                    {result.processing.processed_frames} / {result.processing.total_frames}
                  </span>
                </div>
              </div>
            </div>

            {/* Species Summary */}
            {result.detections.species_summary && 
             Object.keys(result.detections.species_summary).length > 0 && (
              <div className="info-card">
                <h4>🦁 Species Detected</h4>
                <div className="species-tags">
                  {Object.entries(result.detections.species_summary).map(([species, count]) => (
                    <span key={species} className="species-tag">
                      {species}: {count}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* High Priority Alerts */}
            {result.alerts && result.alerts.length > 0 && (
              <div className="alert-card">
                <h4>⚠️ High Priority Alerts</h4>
                <div className="alerts-list">
                  {result.alerts.map((alert, idx) => (
                    <div key={idx} className="alert-item">
                      <strong>{alert.species}</strong> detected at {alert.timestamp.toFixed(1)}s 
                      (Frame {alert.frame})
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Snapshots Gallery */}
            {result.detections.snapshots && result.detections.snapshots.length > 0 && (
              <div className="snapshots-section">
                <h4>📸 Detection Snapshots ({result.detections.snapshots.length})</h4>
                <div className="snapshots-grid">
                  {result.detections.snapshots.map((snapshot, idx) => (
                    <div key={idx} className="snapshot-card">
                      <img
                        src={`${API_URL}${snapshot.path}`}
                        alt={`Detection ${idx + 1}`}
                        className="snapshot-image"
                        onError={(e) => {
                          e.target.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='150'%3E%3Crect fill='%23ddd' width='200' height='150'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' fill='%23999'%3EImage not found%3C/text%3E%3C/svg%3E";
                        }}
                      />
                      <div className="snapshot-info">
                        <div className="snapshot-meta">
                          Frame {snapshot.frame} • {snapshot.timestamp.toFixed(1)}s
                        </div>
                        <div className="detection-tags">
                          {snapshot.detections.map((det, i) => (
                            <span key={i} className="detection-tag">
                              {det.species} ({(det.confidence * 100).toFixed(0)}%)
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadScreen;