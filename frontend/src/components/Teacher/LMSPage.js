// src/components/Teacher/LMSPage.js
import React, { useState, useEffect, useRef } from "react";
import api from "../../api/config";
import { useNavigate } from "react-router-dom";
import "./LMSPage.css";

const LMSPage = () => {
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploadMessage, setUploadMessage] = useState("");
  const [files, setFiles] = useState([]);
  const [description, setDescription] = useState("");

  const fileInputRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchUploadedFiles();
  }, []);

  const fetchUploadedFiles = async () => {
    try {
      setLoading(true);
      const res = await api.get("/api/teachers/my-files");
      console.log("Fetched files from server:", res.data);
      
      if (res.data.success) {
        setUploadedFiles(res.data.files || []);
      }
    } catch (err) {
      console.error("Error fetching files:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e) => {
    setFiles(Array.from(e.target.files));
    setUploadMessage("");
  };

  const removeSelectedFile = (index) => {
    setFiles(files.filter((_, i) => i !== index));
    if (fileInputRef.current) fileInputRef.current.value = "";
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
      console.log("Uploading files:", files.map(f => f.name));
      
      const res = await api.post("/api/teachers/upload-file", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      console.log("Upload response:", res.data);
      
      setUploadMessage(res.data.message || "Upload successful");
      setFiles([]);
      setDescription("");
      if (fileInputRef.current) fileInputRef.current.value = "";
      fetchUploadedFiles();
    } catch (error) {
      console.error("Upload error:", error);
      setUploadMessage(error.response?.data?.message || "Upload failed");
    }
  };

  const openFile = (file) => {
    // For Cloudinary, the path is already a full URL
    const url = file.path;
    console.log("Opening file URL:", url);
    window.open(url, '_blank');
  };

  const downloadFile = (file) => {
    const url = file.path;
    console.log("Downloading file from:", url);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = file.filename;
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return 'Unknown size';
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(2)} MB`;
  };

  return (
    <div className="lms-container">
      {/* HEADER */}
      <div className="lms-header">
        <h1>LMS – Learning Materials</h1>
        <button
          type="button"
          className="back-btn"
          onClick={() => navigate("/teacher/dashboard")}
        >
          ← Back to Dashboard
        </button>
      </div>

      {/* UPLOAD SECTION */}
      <div className="upload-section">
        <h2>Upload New File</h2>

        <form onSubmit={handleUpload} className="upload-form">
          <textarea
            className="description-input"
            placeholder="Enter description (optional) – e.g. Unit 1 Notes"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
          />

          <div className="file-picker">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileChange}
              hidden
            />
            <button
              type="button"
              className="choose-btn"
              onClick={() => fileInputRef.current.click()}
            >
              Choose Files
            </button>
            <span className="file-count">
              {files.length > 0 ? `${files.length} file(s) selected` : 'No files selected'}
            </span>
          </div>

          {files.length > 0 && (
            <div className="selected-files">
              {files.map((file, index) => (
                <div key={index} className="selected-file">
                  <span className="file-name">{file.name}</span>
                  <span className="file-size">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </span>
                  <button
                    type="button"
                    className="remove-file-btn"
                    onClick={() => removeSelectedFile(index)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          <button
            type="submit"
            className="upload-button"
            disabled={files.length === 0}
          >
            Upload {files.length > 0 ? `(${files.length} files)` : ''}
          </button>
        </form>

        {uploadMessage && (
          <p
            className={`upload-status ${
              uploadMessage.includes("success") || uploadMessage.includes("Successful")
                ? "success"
                : "error"
            }`}
          >
            {uploadMessage}
          </p>
        )}
      </div>

      {/* FILE LIST */}
      <div className="files-section">
        <h2>Your Uploaded Files ({uploadedFiles.length})</h2>

        {loading ? (
          <p className="loading">Loading...</p>
        ) : uploadedFiles.length === 0 ? (
          <p className="no-files">
            No files uploaded yet. Upload notes or materials to share with students.
          </p>
        ) : (
          <div className="file-list">
            {uploadedFiles.map((file, index) => (
              <div key={file._id || index} className="file-card">
                <div className="file-header">
                  <h3 className="file-name" title={file.filename}>
                    {file.filename.length > 40 
                      ? file.filename.substring(0, 40) + '...' 
                      : file.filename}
                  </h3>
                </div>
                
                <p className="file-description">
                  {file.description || "No description"}
                </p>
                
                <div className="file-meta">
                  <span className="file-date">
                    📅 {new Date(file.uploadedAt).toLocaleDateString()}
                  </span>
                  {file.fileSize && (
                    <span className="file-size-badge">
                      💾 {formatFileSize(file.fileSize)}
                    </span>
                  )}
                </div>

                <div className="file-actions">
                  <button
                    onClick={() => openFile(file)}
                    className="file-action-btn view-btn"
                    title="Open in browser"
                  >
                    👁️ View
                  </button>
                  <button
                    onClick={() => downloadFile(file)}
                    className="file-action-btn download-btn"
                    title="Download file"
                  >
                    ⬇️ Download
                  </button>
                </div>

                {file.path && (
                  <div className="file-url" style={{ display: 'none' }}>
                    {file.path}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default LMSPage;