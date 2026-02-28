// src/components/AttendancePage.js
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, Users, Download, ArrowLeft, Video, CheckCircle, XCircle } from 'lucide-react';
import './AttendancePage.css';

const AttendancePage = ({ role = 'student' }) => {
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [meetingDetails, setMeetingDetails] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadAttendanceRecords();
  }, [role]);

  const loadAttendanceRecords = () => {
    setLoading(true);
    try {
      // Get all attendance records from localStorage
      const allRecords = [];
      
      // Iterate through all localStorage keys
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('attendance_')) {
          try {
            const meetingId = key.replace('attendance_', '');
            const records = JSON.parse(localStorage.getItem(key));
            
            // Filter records based on role
            if (role === 'student') {
              // Student sees only their own attendance
              const studentId = localStorage.getItem('userId') || localStorage.getItem('currentStudentId');
              const myRecords = records.filter(r => 
                r.userId === studentId || 
                (r.userName === localStorage.getItem('currentStudentName'))
              );
              
              if (myRecords.length > 0) {
                allRecords.push({
                  meetingId,
                  records: myRecords,
                  allParticipants: records.length
                });
              }
            } else {
              // Teacher sees all attendance for their meetings
              allRecords.push({
                meetingId,
                records,
                allParticipants: records.length
              });
            }
          } catch (e) {
            console.error('Error parsing attendance record:', e);
          }
        }
      }

      // Sort by date (newest first)
      allRecords.sort((a, b) => {
        const dateA = new Date(a.records[0]?.joinedAt || 0);
        const dateB = new Date(b.records[0]?.joinedAt || 0);
        return dateB - dateA;
      });

      setAttendanceRecords(allRecords);
    } catch (error) {
      console.error('Error loading attendance records:', error);
    } finally {
      setLoading(false);
    }
  };

  const viewMeetingDetails = (meetingId, records) => {
    setSelectedMeeting(meetingId);
    setMeetingDetails(records);
  };

  const calculateMeetingDuration = (records) => {
    if (!records || records.length === 0) return '00:00:00';
    
    const startTimes = records.map(r => new Date(r.joinedAt).getTime());
    const endTimes = records.map(r => r.leftAt ? new Date(r.leftAt).getTime() : Date.now());
    
    const earliestStart = Math.min(...startTimes);
    const latestEnd = Math.max(...endTimes);
    
    const durationMs = latestEnd - earliestStart;
    const hours = Math.floor(durationMs / 3600000);
    const minutes = Math.floor((durationMs % 3600000) / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatDateTime = (dateString) => {
    if (!dateString) return 'Present';
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const exportAttendanceCSV = (meetingId, records) => {
    const csvHeaders = ['Name', 'Role', 'Joined At', 'Left At', 'Duration', 'Status'];
    
    const csvRows = records.map(record => [
      record.userName,
      record.role,
      formatDateTime(record.joinedAt),
      record.leftAt ? formatDateTime(record.leftAt) : 'Still Present',
      record.duration,
      record.leftAt ? 'Left' : 'Present'
    ]);
    
    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance_${meetingId}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const exportAllAttendance = () => {
    const allData = [];
    
    attendanceRecords.forEach(({ meetingId, records }) => {
      records.forEach(record => {
        allData.push({
          meetingId,
          ...record
        });
      });
    });

    const csvHeaders = ['Meeting ID', 'Name', 'Role', 'Joined At', 'Left At', 'Duration', 'Status'];
    
    const csvRows = allData.map(record => [
      record.meetingId,
      record.userName,
      record.role,
      formatDateTime(record.joinedAt),
      record.leftAt ? formatDateTime(record.leftAt) : 'Still Present',
      record.duration,
      record.leftAt ? 'Left' : 'Present'
    ]);
    
    const csvContent = [
      csvHeaders.join(','),
      ...csvRows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `all_attendance_records_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="attendance-page">
      <div className="attendance-header">
        <div className="header-left">
          <button className="back-btn" onClick={() => navigate(`/${role}/dashboard`)}>
            <ArrowLeft size={20} />
            Back to Dashboard
          </button>
          <h1>
            <Calendar size={24} />
            {role === 'teacher' ? 'Meeting Attendance Records' : 'My Attendance History'}
          </h1>
        </div>
        {attendanceRecords.length > 0 && (
          <button className="export-all-btn" onClick={exportAllAttendance}>
            <Download size={18} />
            Export All Records
          </button>
        )}
      </div>

      {loading ? (
        <div className="attendance-loading">
          <div className="spinner"></div>
          <p>Loading attendance records...</p>
        </div>
      ) : attendanceRecords.length === 0 ? (
        <div className="no-records">
          <Calendar size={64} />
          <h3>No Attendance Records Found</h3>
          <p>
            {role === 'teacher' 
              ? "You haven't conducted any meetings yet. Create a meeting to start tracking attendance."
              : "You haven't joined any meetings yet. Join a meeting to track your attendance."}
          </p>
          <button 
            className="primary-btn"
            onClick={() => navigate(`/${role}/dashboard`)}
          >
            Go to Dashboard
          </button>
        </div>
      ) : (
        <div className="attendance-content">
          {selectedMeeting ? (
            // Meeting Details View
            <div className="meeting-details-view">
              <div className="details-header">
                <button 
                  className="back-to-list-btn"
                  onClick={() => {
                    setSelectedMeeting(null);
                    setMeetingDetails(null);
                  }}
                >
                  ← Back to Meetings
                </button>
                <h2>Meeting Details: {selectedMeeting.slice(-6)}</h2>
              </div>

              {meetingDetails && (
                <>
                  {/* Meeting Summary */}
                  <div className="meeting-summary-cards">
                    <div className="summary-card">
                      <Clock size={24} />
                      <div>
                        <span className="label">Total Duration</span>
                        <span className="value">{calculateMeetingDuration(meetingDetails)}</span>
                      </div>
                    </div>
                    <div className="summary-card">
                      <Users size={24} />
                      <div>
                        <span className="label">Total Participants</span>
                        <span className="value">{meetingDetails.length}</span>
                      </div>
                    </div>
                    <div className="summary-card">
                      <Video size={24} />
                      <div>
                        <span className="label">Meeting ID</span>
                        <span className="value">{selectedMeeting.slice(-8)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Attendance Table */}
                  <div className="attendance-table-container">
                    <div className="table-header-actions">
                      <h3>Participant Attendance</h3>
                      <button 
                        className="export-btn"
                        onClick={() => exportAttendanceCSV(selectedMeeting, meetingDetails)}
                      >
                        <Download size={16} />
                        Export CSV
                      </button>
                    </div>
                    
                    <div className="attendance-table">
                      <div className="table-header">
                        <div className="table-cell">Name</div>
                        <div className="table-cell">Role</div>
                        <div className="table-cell">Start Time</div>
                        <div className="table-cell">End Time</div>
                        <div className="table-cell">Duration</div>
                        <div className="table-cell">Status</div>
                      </div>
                      
                      {meetingDetails.map((record, index) => (
                        <div key={index} className="table-row">
                          <div className="table-cell">
                            <span className="user-name">{record.userName}</span>
                            {record.userId === localStorage.getItem('userId') && 
                             <span className="you-badge">You</span>}
                          </div>
                          <div className="table-cell">
                            <span className={`role-badge ${record.role}`}>
                              {record.role === 'teacher' ? 'Host' : 'Student'}
                            </span>
                          </div>
                          <div className="table-cell">
                            {formatDateTime(record.joinedAt)}
                          </div>
                          <div className="table-cell">
                            {record.leftAt ? formatDateTime(record.leftAt) : 
                             <span className="present-badge">Present</span>}
                          </div>
                          <div className="table-cell">
                            <span className="duration-badge">{record.duration}</span>
                          </div>
                          <div className="table-cell">
                            <span className={`status-badge ${record.leftAt ? 'left' : 'present'}`}>
                              {record.leftAt ? 'Left' : 'Active'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            // Meetings List View
            <div className="meetings-list-view">
              <div className="meetings-grid">
                {attendanceRecords.map(({ meetingId, records, allParticipants }) => {
                  const meetingStart = records[0]?.joinedAt;
                  const meetingEnd = records[records.length - 1]?.leftAt;
                  const duration = calculateMeetingDuration(records);
                  const participantCount = role === 'teacher' ? allParticipants : 1;
                  
                  return (
                    <div key={meetingId} className="meeting-card">
                      <div className="meeting-card-header">
                        <div className="meeting-id-badge">
                          <Video size={14} />
                          Meeting #{meetingId.slice(-6)}
                        </div>
                        <span className="participant-count">
                          <Users size={14} />
                          {participantCount} {participantCount === 1 ? 'Participant' : 'Participants'}
                        </span>
                      </div>
                      
                      <div className="meeting-times">
                        <div className="time-row">
                          <Calendar size={14} />
                          <div className="time-detail">
                            <span className="time-label">Start:</span>
                            <span className="time-value">{formatDateTime(meetingStart)}</span>
                          </div>
                        </div>
                        
                        {meetingEnd && (
                          <div className="time-row">
                            <XCircle size={14} />
                            <div className="time-detail">
                              <span className="time-label">End:</span>
                              <span className="time-value">{formatDateTime(meetingEnd)}</span>
                            </div>
                          </div>
                        )}
                        
                        <div className="time-row duration">
                          <Clock size={14} />
                          <div className="time-detail">
                            <span className="time-label">Duration:</span>
                            <span className="time-value highlight">{duration}</span>
                          </div>
                        </div>
                      </div>
                      
                      {role === 'student' && records[0] && (
                        <div className="my-attendance-summary">
                          <div className="my-duration">
                            <Clock size={12} />
                            My attendance: <strong>{records[0].duration}</strong>
                          </div>
                          <div className={`my-status ${records[0].leftAt ? 'left' : 'present'}`}>
                            {records[0].leftAt ? 'Left meeting' : 'Still in meeting'}
                          </div>
                        </div>
                      )}
                      
                      <div className="meeting-card-footer">
                        <button 
                          className="view-details-btn"
                          onClick={() => viewMeetingDetails(meetingId, records)}
                        >
                          View Details
                        </button>
                        {role === 'teacher' && (
                          <button 
                            className="export-btn small"
                            onClick={() => exportAttendanceCSV(meetingId, records)}
                          >
                            <Download size={14} />
                            Export
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AttendancePage;