// src/components/Teacher/TeacherDashboard.js
import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../../api/config"; // Import the configured API instance
import './TeacherDashboard.css';
import { Calendar } from 'lucide-react';

const TeacherDashboard = () => {
  const [registeredStudents, setRegisteredStudents] = useState([]);
  const [showApprovalPage, setShowApprovalPage] = useState(false);
  const [message, setMessage] = useState('');
  const [teacherName, setTeacherName] = useState('Teacher');
  const navigate = useNavigate();

  useEffect(() => {
    fetchTeacherProfile();
    fetchRegisteredStudents();
  }, []);

  const fetchTeacherProfile = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;
      
      const response = await api.get("/api/teachers/profile");
      const fullName = `${response.data.firstName || ''} ${response.data.lastName || ''}`.trim();
      setTeacherName(fullName || 'Teacher');
      
      // Store teacherId for later use
      if (response.data._id) {
        localStorage.setItem('teacherId', response.data._id);
      }
    } catch (error) {
      console.error("Error fetching teacher profile:", error.response?.data || error.message);
      const stored = JSON.parse(localStorage.getItem('teacherUser') || '{}');
      const fullName = `${stored.firstName || ''} ${stored.lastName || ''}`.trim();
      setTeacherName(fullName || 'Teacher');
    }
  };

  const fetchRegisteredStudents = async () => {
    try {
      const response = await api.get("/api/teachers/registered-students");
      if (response.data.success) {
        setRegisteredStudents(response.data.students);
      } else {
        setRegisteredStudents(response.data || []);
      }
    } catch (error) {
      console.error("Error fetching students:", error.response?.data || error.message);
      setMessage('Failed to load students');
    }
  };

  const handleApproveStudent = async (studentId) => {
    try {
      const response = await api.post("/api/teachers/approve-student", { studentId });
      setMessage(response.data.message || 'Student assigned successfully');
      fetchRegisteredStudents(); // Refresh the list
    } catch (error) {
      console.error("Error approving student:", error.response?.data || error.message);
      setMessage(error.response?.data?.message || 'Failed to assign student');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem('teacherUser');
    localStorage.removeItem('teacherId');
    navigate("/teacher/login");
  };

  return (
    <div className="teacher-dashboard">
      <header className="dashboard-header">
        <h1>Welcome, {teacherName}!</h1>
        <button onClick={handleLogout} className="logout-button">Logout</button>
      </header>

      <div className="quick-actions">
        <Link to="/teacher/create-meeting" className="action-card primary">
          <span className="icon">📹</span>
          <span>Create Meeting</span>
        </Link>
        <Link to="/teacher/my-meetings" className="action-card">
          <span className="icon">🗓️</span>
          <span>My Meetings</span>
        </Link>
        <Link to="/teacher/create-quiz" className="action-card">
          <span className="icon">📝</span>
          <span>Create Quiz</span>
        </Link>
        
        <Link to="/teacher/leaderboard" className="action-card">
          <span className="icon">🏆</span>
          <span>Leaderboard</span>
        </Link>
        
        <Link to="/teacher/lms" className="action-card">
          <span className="icon">📚</span>
          <span>LMS – Upload & Manage Files</span>
        </Link>
      </div>
      
      <div className="dashboard-actions">
        <button 
          className="dashboard-btn attendance-btn"
          onClick={() => navigate('/teacher/attendance')}
        >
          <Calendar size={20} />
          Attendance Records
        </button>
      </div>

      <button 
        className="toggle-students-btn"
        onClick={() => setShowApprovalPage(!showApprovalPage)}
      >
        {showApprovalPage ? "Hide" : "Manage"} Student Access
      </button>

      {showApprovalPage && (
        <div className="students-section">
          <h2>Student Management</h2>
          {message && <p className="status-message">{message}</p>}
          {registeredStudents.length === 0 ? (
            <p>No students registered yet.</p>
          ) : (
            <ul className="students-list">
              {registeredStudents.map(student => {
                const teacherId = localStorage.getItem('teacherId');
                const isMine = student.teachers?.some(t => t._id === teacherId);
                
                return (
                  <li key={student._id} className="student-row">
                    <div className="student-info">
                      <strong>{student.firstName} {student.lastName}</strong>
                      <span>{student.email}</span>
                      <span className="teachers-list">
                        Teachers: {student.teachers?.map(t => `${t.firstName} ${t.lastName}`).join(', ') || 'None'}
                      </span>
                    </div>
                    {!isMine && (
                      <button 
                        onClick={() => handleApproveStudent(student._id)}
                        className="assign-button"
                      >
                        Assign to Me
                      </button>
                    )}
                    {isMine && <span className="already-assigned">✓ Assigned</span>}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default TeacherDashboard;