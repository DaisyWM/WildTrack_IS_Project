import React, { useState } from "react";
import { API_BASE, getHeaders } from '../config/pushConfig';
import SafeImage from '../components/SafeImage';
import "../styles/Upload.css";

const UploadScreen = () => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

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
    if (!file) return alert("Please select a file first.");

    setUploading(true);
    setError(null);
    setResult(null);
    setProgress(0);

    const formData = new FormData();
    formData.append("video", file);

    try {
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener("progress", (e) => {
        if (e && e.lengthComputable && e.total) {
          const percent = Math.round((e.loaded / e.total) * 100);
          setProgress(percent);
        }
      });

      xhr.addEventListener("load", () => {
        setUploading(false);
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status === 200) {
            setResult(data);
            console.log("Detection results:", data);
          } else {
            setError(data.message || data.error || `Upload failed (${xhr.status})`);
          }
        } catch (parseErr) {
          console.error("Failed to parse response:", xhr.responseText);
          setError("Server returned an unexpected response. Check the backend is running.");
        }
      });

      xhr.addEventListener("error", () => {
        setUploading(false);
        setError("Network error. Please check your connection and that the backend is running on port 5001.");
      });

      xhr.open("POST", `${API_BASE}/api/uploads`);

      const headers = getHeaders();
      Object.keys(headers).forEach(key => {
        if (key !== 'Content-Type') xhr.setRequestHeader(key, headers[key]);
      });

      xhr.send(formData);
    } catch (err) {
      console.error("Upload error:", err);
      setError(err.message || "Upload failed");
      setUploading(false);
    }
  };

  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy'; };
  const handleDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); };
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation();
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

  // ── Snapshots come directly from result.snapshots (not result.detections.snapshots)
  const snapshots = result?.snapshots ?? [];
  const totalDetections = result?.detections?.total ?? result?.alerts?.length ?? 0;

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
              setFile(null); setResult(null); setError(null); setProgress(0);
              const fileInput = document.getElementById("fileInput");
              if (fileInput) fileInput.value = "";
            }}
            disabled={uploading}
          >
            ✖ Remove
          </button>
        </div>
      )}

      {uploading && (
        <div className="progress-container">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }}></div>
          </div>
          <p className="progress-text">
            {progress < 100 ? `Uploading... ${progress}%` : "Analysing video... this may take a minute ⏳"}
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

      {error && (
        <div className="error-message">
          <p>❌ Error: {error}</p>
        </div>
      )}

      <div className="results">
        <h3>Detection Results</h3>
        {!result && !error && !uploading && (
          <p className="no-results">No results yet. Upload a video to see detections.</p>
        )}

        {result && result.success && (
          <div className="results-content">
            <div className="success-message">
              ✅ Video processed successfully! Found {totalDetections} detection(s)
            </div>

            {/* Video Info */}
            {result.video && (
              <div className="info-card">
                <h4>📹 Video Information</h4>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="info-label">Duration:</span>
                    <span className="info-value">{result.video?.duration?.toFixed(1) ?? "N/A"}s</span>
                  </div>
                  <div className="info-item">
                    <span className="info-label">File:</span>
                    <span className="info-value">{result.video?.originalName ?? file?.name}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Species Summary */}
            {result.detections?.speciesSummary && Object.keys(result.detections.speciesSummary).length > 0 && (
              <div className="info-card">
                <h4>🦁 Species Detected</h4>
                <div className="species-tags">
                  {Object.entries(result.detections.speciesSummary).map(([species, count]) => (
                    <span key={species} className="species-tag">{species}: {count}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Alerts */}
            {result.alerts && result.alerts.length > 0 && (
              <div className="alert-card">
                <h4>⚠️ Alerts</h4>
                <div className="alerts-list">
                  {result.alerts.map((alert, idx) => (
                    <div key={idx} className={`alert-item priority-${alert.priority}`}>
                      <strong>{alert.species}</strong> — {alert.priority?.toUpperCase()} priority
                      {" "}at {alert.timestamp?.toFixed(1)}s (Frame {alert.frame})
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Snapshots — uses result.snapshots directly (Cloudinary URLs) */}
            {snapshots.length > 0 ? (
              <div className="snapshots-section">
                <h4>📸 Detection Snapshots ({snapshots.length})</h4>
                <div className="snapshots-grid">
                  {snapshots.map((snapshot, idx) => {
                    // If Cloudinary migration is done, snapshot.path is already https://
                    // If not, fall back to building the local URL
                    const src = snapshot.path?.startsWith('http')
                      ? snapshot.path
                      : `${API_BASE}${snapshot.path?.startsWith('/') ? '' : '/'}${snapshot.path}`;

                    return (
                      <div key={idx} className="snapshot-card">
                        <SafeImage
                          src={src}
                          alt={`Detection ${idx + 1}`}
                          style={{ width: '100%', height: '200px', objectFit: 'cover' }}
                        />
                        <div className="snapshot-info">
                          <div className="snapshot-meta">
                            Frame {snapshot.frame} • {snapshot.timestamp?.toFixed(1)}s
                          </div>
                          <div className="detection-tags">
                            {snapshot.detections?.map((det, i) => (
                              <span key={i} className="detection-tag">
                                {det.species} ({(det.confidence * 100).toFixed(0)}%)
                              </span>
                            ))}
                          </div>
                          {/* Show Cloudinary badge if image is from cloud */}
                          {snapshot.path?.startsWith('http') && (
                            <span className="cloud-badge">☁️ Cloud</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <p className="no-results">No snapshots available for this detection.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadScreen;