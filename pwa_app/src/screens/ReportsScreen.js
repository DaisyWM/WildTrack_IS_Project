import React, { useEffect, useState } from "react";
import { API_BASE, getHeaders } from "../config/pushConfig";
import SafeImage from "../components/SafeImage";

// 🔥 INLINE PROFESSIONAL CSS — no external file required
const reportsStyles = `
  .reports-container {
    padding: 20px 30px;
  }

  .reports-header {
    display: flex;
    align-items: center;
    margin-bottom: 25px;
  }

  .reports-title {
    font-size: 26px;
    font-weight: 700;
    margin-left: 10px;
  }

  .reports-table-wrapper {
    background: #ffffff;
    padding: 20px;
    border-radius: 14px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.08);
  }

  .reports-table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0 10px;
  }

  .reports-table thead th {
    text-transform: uppercase;
    font-size: 13px;
    color: #555;
    padding-bottom: 8px;
  }

  .reports-row {
    background: #fafafa;
    transition: 0.2s ease;
  }

  .reports-row:hover {
    background: #eef6ff;
    transform: scale(1.005);
  }

  .reports-row td {
    padding: 12px 10px;
    font-size: 15px;
  }

  .snapshot-img {
    width: 65px;
    height: 45px;
    border-radius: 6px;
    object-fit: cover;
    border: 1px solid #ddd;
  }

  .alert-chip {
    padding: 5px 12px;
    border-radius: 25px;
    color: #fff;
    font-weight: bold;
    text-transform: capitalize;
    font-size: 13px;
  }

  .alert-high { background: #e63946; }
  .alert-medium { background: #ffb703; }
  .alert-low { background: #2a9d8f; }

  .reports-back-btn {
    background: #eeeeee;
    border: none;
    padding: 8px 14px;
    border-radius: 8px;
    cursor: pointer;
    margin-right: 10px;
  }
`;

export default function ReportsScreen({ goBack }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
      {/* Inject inline CSS */}
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
                <th>Time</th>
                <th>Species</th>
                <th>Alert Level</th>
                <th>Snapshot</th>
                <th>Video</th>
              </tr>
            </thead>

            <tbody>
              {reports.map((r, index) => (
                <tr key={index} className="reports-row">
                  <td>{new Date(r.time).toLocaleString()}</td>
                  <td>{r.species}</td>
                  <td>
                    <span className={`alert-chip alert-${r.alertLevel || "medium"}`}>
                      {r.alertLevel}
                    </span>
                  </td>

                  <td>
                    <SafeImage
                      src={r.image}
                      alt="snapshot"
                      className="snapshot-img"
                    />
                  </td>

                  <td style={{ maxWidth: "250px", overflowWrap: "break-word" }}>
                    {r.video}
                  </td>
                </tr>
              ))}
            </tbody>

          </table>
        </div>
      )}
    </div>
  );
}
