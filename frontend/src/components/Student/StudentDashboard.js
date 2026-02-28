// src/components/Student/StudentDashboard.js
import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { Calendar, Clock, Video, BookOpen, Award, Bell, Users, Trophy } from 'lucide-react';
import "./StudentDashboard.css";
import studentImage from "../../assets/student.png";

function StudentDashboard() {
  const [approved, setApproved] = useState(false);
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [recentAttendance, setRecentAttendance] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem("token");
      if (!token) {
        navigate("/student/login");
        return;
      }

      try {
        // Check approval status
        const approvalRes = await axios.get("http://localhost:5000/api/students/check-approval", {
          headers: { Authorization: `Bearer ${token}` },
        });

        setApproved(approvalRes.data.isApproved);

        if (approvalRes.data.isApproved) {
          // Get profile
          const profileRes = await axios.get("http://localhost:5000/api/students/profile", {
            headers: { Authorization: `Bearer ${token}` },
          });
          
          const fullName = `${profileRes.data.firstName || ''} ${profileRes.data.lastName || ''}`.trim() || 'Student';
          const email = profileRes.data.email || '';
          
          setStudentName(fullName);
          setStudentEmail(email);
          
          // Store in localStorage for other components
          localStorage.setItem('currentStudentName', fullName);
          localStorage.setItem('currentStudentEmail', email);
          localStorage.setItem('userId', profileRes.data._id || `student_${Date.now()}`);
          
          // Get notifications
          setNotifications(profileRes.data.notifications || []);
          
          // Load recent attendance
          loadRecentAttendance(fullName);
        }
      } catch (err) {
        console.error('Dashboard init error:', err);
        if (err.response?.status === 403) {
          alert("Account not approved yet.");
        } else {
          navigate("/student/login");
        }
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [navigate]);

  const loadRecentAttendance = (studentName) => {
    try {
      const attendance = [];
      // Iterate through all localStorage keys
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('attendance_')) {
          try {
            const records = JSON.parse(localStorage.getItem(key));
            // Find records matching this student
            const myRecords = records.filter(r => 
              r.userName === studentName || 
              r.userId === localStorage.getItem('userId')
            );
            if (myRecords.length > 0) {
              attendance.push({
                meetingId: key.replace('attendance_', ''),
                ...myRecords[0]
              });
            }
          } catch (e) {
            console.error('Error parsing attendance:', e);
          }
        }
      }
      // Sort by date (newest first) and take last 3
      attendance.sort((a, b) => new Date(b.joinedAt) - new Date(a.joinedAt));
      setRecentAttendance(attendance.slice(0, 3));
    } catch (error) {
      console.error('Error loading attendance:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("currentStudentName");
    localStorage.removeItem("currentStudentEmail");
    localStorage.removeItem("userId");
    navigate("/student/login");
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Present';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) return <div className="loading-screen">Loading dashboard...</div>;

  if (!approved) {
    return (
      <div className="awaiting-approval">
        <h2>Awaiting Teacher Approval</h2>
        <p>Your account is waiting for teacher approval. You will be notified via email once approved.</p>
        <button onClick={handleLogout} className="logout-btn">Logout</button>
      </div>
    );
  }

  return (
    <div className="student-dashboard">
      <header className="dashboard-header">
        <div>
          <h1>Welcome back, {studentName}! 👋</h1>
          {notifications.length > 0 && (
            <div className="notification-badge">
              <Bell size={16} />
              {notifications.filter(n => !n.read).length} new notifications
            </div>
          )}
        </div>
        <button onClick={handleLogout} className="logout-button">Logout</button>
      </header>

      {/* ATTENDANCE BUTTON - Moved ABOVE the dashboard grid */}
      <div className="dashboard-actions">
        <button 
          className="dashboard-btn attendance-btn"
          onClick={() => navigate('/student/attendance')}
        >
          <Calendar size={20} />
          My Attendance
        </button>
      </div>

      {/* Dashboard Cards Grid */}
      <div className="dashboard-grid">
        <Link to="/student/quizzes" className="dashboard-card primary">
          <span className="icon">📝</span>
          <span className="card-title">Quizzes & Assignments</span>
          <span className="card-desc">Take quizzes and view results</span>
          <span className="card-badge">3 New</span>
        </Link>
        
        <Link to="/student/lms" className="dashboard-card">
          <span className="icon">📚</span>
          <span className="card-title">Learning Materials</span>
          <span className="card-desc">Access course files and resources</span>
        </Link>
        
        <Link to="/student/leaderboard" className="dashboard-card">
          <span className="icon">🏆</span>
          <span className="card-title">Leaderboard</span>
          <span className="card-desc">See your rankings and progress</span>
        </Link>
        
        <Link to="/meeting-links" className="dashboard-card">
          <span className="icon">📹</span>
          <span className="card-title">Live Meetings</span>
          <span className="card-desc">Join scheduled meetings</span>
          {recentAttendance.length > 0 && (
            <span className="card-stats">
              <Clock size={12} />
              Last: {formatDate(recentAttendance[0]?.joinedAt)}
            </span>
          )}
        </Link>
        
        {/* ATTENDANCE CARD */}
        <div 
          className="dashboard-card attendance-card" 
          onClick={() => navigate('/student/attendance')}
          style={{ cursor: 'pointer' }}
        >
          <span className="icon">📊</span>
          <span className="card-title">Attendance</span>
          <span className="card-desc">View your attendance history</span>
          {recentAttendance.length > 0 ? (
            <div className="attendance-summary">
              <span className="attendance-stat">
                <Clock size={12} />
                Last: {formatDate(recentAttendance[0]?.joinedAt)}
              </span>
              <span className="attendance-duration">
                Duration: {recentAttendance[0]?.duration}
              </span>
            </div>
          ) : (
            <span className="card-desc-small">No attendance records yet</span>
          )}
        </div>
      </div>

      {/* Recent Attendance Section */}
      {recentAttendance.length > 0 && (
        <div className="recent-attendance-section">
          <div className="section-header">
            <h2>Recent Attendance</h2>
            <button 
              className="view-all-btn"
              onClick={() => navigate('/student/attendance')}
            >
              View All Attendance
            </button>
          </div>
          
          <div className="attendance-preview-list">
            {recentAttendance.map((record, index) => (
              <div key={index} className="attendance-preview-item">
                <div className="meeting-info">
                  <span className="meeting-id">Meeting #{record.meetingId?.slice(-6)}</span>
                  <span className="meeting-date">{formatDate(record.joinedAt)}</span>
                </div>
                <div className="attendance-details">
                  <div className="attendance-duration">
                    <Clock size={14} />
                    <span>{record.duration}</span>
                  </div>
                  <span className={`status-badge ${record.leftAt ? 'left' : 'present'}`}>
                    {record.leftAt ? 'Left' : 'Present'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Illustration */}
      <div className="illustration-container">
        <img src={studentImage} alt="Student learning" className="student-illustration" />
      </div>
    </div>
  );
}

export default StudentDashboard;