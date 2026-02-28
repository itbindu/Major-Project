// src/components/Teacher/LMSPage.js
import React, { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./LMSPage.css";

const LMSPage = () => {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadMessage, setUploadMessage] = useState("");
  const [files, setFiles] = useState([]);           // ← array now
  const [description, setDescription] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    fetchUploadedFiles();
  }, []);

  const fetchUploadedFiles = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get("http://localhost:5000/api/teachers/my-files", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUploadedFiles(res.data.files || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    setFiles(Array.from(e.target.files));   // ← store ALL selected files
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (files.length === 0) {
      setUploadMessage("Please select at least one file");
      return;
    }

    const formData = new FormData();
    files.forEach((f) => formData.append("file", f));
    formData.append("description", description);

    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
        "http://localhost:5000/api/teachers/upload-file",
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setUploadMessage(res.data.message);
      setFiles([]);
      setDescription("");
      fetchUploadedFiles();
    } catch (error) {
      setUploadMessage(error.response?.data?.message || "Upload failed");
    }
  };

  return (
    <div className="lms-container">
      <div className="lms-header">
        <h1>LMS – Learning Materials</h1>
        <button className="back-btn" onClick={() => navigate("/teacher/dashboard")}>
          ← Back to Dashboard
        </button>
      </div>

      <div className="upload-section">
        <h2>Upload New File</h2>
        <form onSubmit={handleUpload} className="upload-form">
          <textarea
            placeholder="Enter description (optional) – e.g. Unit 1 Notes"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="description-input"
            rows={3}
          />

          <input
            type="file"
            onChange={handleFileChange}
            multiple
            className="file-input"
          />

          <button type="submit" disabled={files.length === 0} className="upload-button">
            Upload {files.length > 0 ? `(${files.length} files)` : "File"}
          </button>
        </form>

        {uploadMessage && (
          <p className={`upload-status ${uploadMessage.includes("success") ? "success" : "error"}`}>
            {uploadMessage}
          </p>
        )}
      </div>

      <div className="files-section">
        <h2>Your Uploaded Files</h2>
        {loading ? (
          <p className="loading">Loading...</p>
        ) : uploadedFiles.length === 0 ? (
          <p className="no-files">No files uploaded yet.</p>
        ) : (
          <div className="file-list">
            {uploadedFiles.map((f, i) => (
              <div key={i} className="file-card">
                <a
                  href={`http://localhost:5000${f.path}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={f.filename}
                  className="file-name"
                >
                  {f.filename}
                </a>
                <p className="file-description">
                  {f.description || "No description"}
                </p>
                <div className="file-meta">
                  {new Date(f.uploadedAt).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LMSPage;