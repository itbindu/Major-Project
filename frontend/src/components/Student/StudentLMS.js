// src/components/Student/StudentLMS.js
import React, { useState, useEffect } from 'react';
import api from '../../api/config';
import { useNavigate } from 'react-router-dom';
import './StudentLMS.css';

const StudentLMS = () => {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchLMSFiles();
  }, []);

  const fetchLMSFiles = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        navigate('/student/login');
        return;
      }

      const response = await api.get('/api/students/lms-files');

      setFiles(response.data.files || []);
    } catch (err) {
      console.error('LMS files error:', err);
      setError('Failed to load learning materials. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return '🖼️';
    if (['mp4', 'webm', 'mov', 'avi'].includes(ext)) return '🎬';
    if (['pdf'].includes(ext)) return '📄';
    if (['doc', 'docx'].includes(ext)) return '📝';
    if (['xls', 'xlsx'].includes(ext)) return '📊';
    if (['ppt', 'pptx'].includes(ext)) return '📽️';
    if (['zip', 'rar', '7z'].includes(ext)) return '🗜️';
    return '📁';
  };

  return (
    <div className="student-lms-container">
      <div className="lms-header">
        <h1>Learning Materials (LMS)</h1>
        <button className="back-btn" onClick={() => navigate('/student/dashboard')}>
          ← Back to Dashboard
        </button>
      </div>

      {error && <p className="error-message">{error}</p>}

      {loading ? (
        <div className="loading">Loading your course materials...</div>
      ) : files.length === 0 ? (
        <div className="no-files">
          <p>No materials available yet from your assigned teachers.</p>
          <small>Contact your teacher to upload notes, PDFs, or other resources.</small>
        </div>
      ) : (
        <div className="files-grid">
          {files.map((file, index) => (
            <div key={index} className="file-card">
              <div className="file-icon">{getFileIcon(file.filename)}</div>
              <div className="file-info">
                <h3 className="file-name" title={file.filename}>
                  {file.filename.length > 40 
                    ? file.filename.substring(0, 40) + '...' 
                    : file.filename}
                </h3>
                
                {file.description && (
                  <p className="file-description">{file.description}</p>
                )}
                
                <p className="file-teacher">
                  <span className="label">Teacher:</span> {file.teacherName}
                </p>
                
                <p className="file-date">
                  <span className="label">Uploaded:</span>{' '}
                  {new Date(file.uploadedAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                  })}
                </p>
                
                {file.fileSize && (
                  <p className="file-size">
                    <span className="label">Size:</span>{' '}
                    {(file.fileSize / 1024 / 1024).toFixed(2)} MB
                  </p>
                )}
              </div>

              <a
                href={`${api.defaults.baseURL}${file.path}`}
                target="_blank"
                rel="noopener noreferrer"
                download={file.filename}
                className="download-btn"
              >
                ⬇️ Download
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default StudentLMS;