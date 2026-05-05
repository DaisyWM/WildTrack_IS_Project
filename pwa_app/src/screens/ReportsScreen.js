import React, { useEffect, useState } from "react";
import { API_BASE, getHeaders } from "../config/pushConfig";
import SafeImage from "../components/SafeImage";

// PROFESSIONAL CSS remains the same
const reportsStyles = `
  .reports-container { padding: 20px 30px; }
  .reports-header { display: flex; align-items: center; margin-bottom: 25px; }
  .reports-title { font-size: 26px; font-weight: 700; margin-left: 10px; }
  .reports-table-wrapper { background: #ffffff; padding: 20px; border-radius: 14px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); overflow-x: auto; }
  .reports-table { width: 100%; border-collapse: separate; border-spacing: 0 10px; }
  .reports-table thead th { text-transform: uppercase; font-size: 13px; color: #555; padding-bottom: 8px; text-align: left; }
  .reports-row { background: #fafafa; transition: 0.2s ease; }
  .reports-row:hover { background: #eef6ff; transform: scale(1.005); }
  .reports-row td { padding: 12px 10px; font-size: 14px; }
  .snapshot-img { width: 65px; height: 45px; border-radius: 6px; object-fit: cover; border: 1px solid #ddd; }
  .alert-chip { padding: 5px 12px; border-radius: 25px; color: #fff; font-weight: bold; text-transform: capitalize; font-size: 12px; }
  .alert-high { background: #e63946; }
  .alert-medium { background: #ffb703; }
  .alert-low { background: #2a9d8f; }
  .reports-back-btn { background: #eeeeee; border: none; padding: 8px 14px; border-radius: 8px; cursor: pointer; margin-right: 10px; }
`;

export default function ReportsScreen({ goBack }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Using the same endpoint as your working Dashboard for consistency
    fetch(`${API_BASE}/api/newstats/recent-detections?limit=200`, {
      headers: getHeaders(),
    })
      .then((res) => res.json())
      .then((data) => {
        setReports(data.data || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching reports:", err);
        setLoading(false);
      });
  }, []);

  return (
    <div className="reports-container">
      <style>{reportsStyles}</style>

      <div className="reports-header">
        <button className="reports-back-btn" onClick={goBack}>← Back</button>
        <h2 className="reports-title">Detection Reports</h2>
      </div>

      {loading ? (
        <p>Loading reports...</p>
      ) : reports.length === 0 ? (
        <p>No detection history found.</p>
      ) : (
        <div className="reports-table-wrapper">
          <table className="reports-table">
            <thead>
              <tr>
                <th>Time (EAT)</th>
                <th>Species</th>
                <th>Alert Level</th>
                <th>Snapshot</th>
                <th>Video Source</th>
              </tr>
            </thead>

            <tbody>
              {reports.map((r, index) => {
                // FIXED: Use r.createdAt if r.time is 1970 or missing
                const dateObj = r.time && new Date(r.time).getFullYear() > 1970 
                  ? new Date(r.time) 
                  : (r.createdAt ? new Date(r.createdAt) : new Date());

                return (
                  <tr key={index} className="reports-row">
                    <td>
                      {dateObj.toLocaleString("en-KE", {
                        timeZone: "Africa/Nairobi",
                        dateStyle: "medium",
                        timeStyle: "short"
                      })}
                    </td>
                    <td style={{ textTransform: "capitalize" }}>
                      {r.species || "Unknown"}
                    </td>
                    <td>
                      <span className={`alert-chip alert-${r.alertLevel?.toLowerCase() || "medium"}`}>
                        {r.alertLevel || "Medium"}
                      </span>
                    </td>

                    <td>
                      {/* FIXED: SafeImage handles Cloudinary URL logic */}
                      <SafeImage
                        src={r.image || r.snapshot}
                        alt="detection snapshot"
                        className="snapshot-img"
                      />
                    </td>

                    <td style={{ maxWidth: "200px", overflowWrap: "break-word", fontSize: "12px", color: "#666" }}>
                      {r.video || "System Upload"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}