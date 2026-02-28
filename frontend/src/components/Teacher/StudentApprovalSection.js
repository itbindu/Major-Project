// src/components/Teacher/StudentApprovalSection.js
import React, { useState, useEffect } from "react";
import axios from "axios";
import "./StudentApprovalSection.css";

const StudentApprovalSection = () => {
  const [students, setStudents] = useState([]);
  const [allTeachers, setAllTeachers] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("token");
      
      // Fetch students
      const studentsRes = await axios.get(
        "http://localhost:5000/api/teachers/registered-students",
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      // Fetch all teachers for dropdown
      const teachersRes = await axios.get(
        "http://localhost:5000/api/teachers/all-teachers",
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (studentsRes.data.success) {
        setStudents(studentsRes.data.students || []);
      }
      
      if (teachersRes.data.success) {
        setAllTeachers(teachersRes.data.teachers || []);
      }
    } catch (error) {
      setMessage("Failed to load data");
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignStudent = async (studentId, teacherId = null) => {
    // If no teacherId provided, assign to current teacher
    const assignTeacherId = teacherId || localStorage.getItem("teacherId");
    
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        "http://localhost:5000/api/teachers/assign-student",
        { studentId, teacherId: assignTeacherId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setMessage("Student assigned successfully!");
      fetchData(); // Refresh data
      setShowAssignModal(false);
      
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      setMessage("Failed to assign student");
      console.error(error);
    }
  };

  const handleRemoveAssignment = async (studentId, teacherId) => {
    if (!window.confirm("Remove this assignment?")) return;

    try {
      const token = localStorage.getItem("token");
      await axios.post(
        "http://localhost:5000/api/teachers/remove-assignment",
        { studentId, teacherId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      setMessage("Assignment removed!");
      fetchData();
      
      setTimeout(() => setMessage(""), 3000);
    } catch (error) {
      setMessage("Failed to remove assignment");
      console.error(error);
    }
  };

  const openAssignModal = (student) => {
    setSelectedStudent(student);
    setShowAssignModal(true);
  };

  const currentTeacherId = localStorage.getItem("teacherId");
  const currentTeacherName = localStorage.getItem("teacherName") || "You";

  return (
    <div className="students-section">
      <h2>Student Management</h2>
      
      {message && (
        <div className={`status-message ${message.includes("Failed") ? "error" : "success"}`}>
          {message}
        </div>
      )}

      {loading ? (
        <p className="loading">Loading students...</p>
      ) : students.length === 0 ? (
        <p className="empty-list">No students registered yet.</p>
      ) : (
        <ul className="students-list">
          {students.map(student => {
            const studentTeachers = student.teachers || [];
            const isAssignedToMe = studentTeachers.some(t => t._id === currentTeacherId);

            return (
              <li key={student._id} className="student-row">
                <div className="student-info">
                  <strong>{student.firstName} {student.lastName}</strong>
                  <span>{student.email}</span>
                  <span className="teachers-list">
                    {studentTeachers.length > 0 ? (
                      <span>
                        Teachers: {studentTeachers.map(teacher => (
                          <span key={teacher._id} className="teacher-tag">
                            {teacher.firstName} {teacher.lastName}
                            {teacher._id === currentTeacherId && " (You)"}
                            {teacher._id !== currentTeacherId && (
                              <button
                                className="remove-btn"
                                onClick={() => handleRemoveAssignment(student._id, teacher._id)}
                                title="Remove"
                              >
                                ×
                              </button>
                            )}
                          </span>
                        ))}
                      </span>
                    ) : (
                      "No teachers assigned"
                    )}
                  </span>
                </div>
                
                <div className="student-actions">
                  {!isAssignedToMe && (
                    <button
                      onClick={() => handleAssignStudent(student._id)}
                      className="assign-button"
                    >
                      Assign to Me
                    </button>
                  )}
                  <button
                    onClick={() => openAssignModal(student)}
                    className="assign-other-btn"
                  >
                    Assign to Other
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Modal for assigning to other teachers */}
      {showAssignModal && selectedStudent && (
        <div className="modal-overlay">
          <div className="assign-modal">
            <h3>Assign {selectedStudent.firstName} to Teacher</h3>
            
            <div className="teacher-list">
              {allTeachers
                .filter(teacher => 
                  !selectedStudent.teachers?.some(t => t._id === teacher._id)
                )
                .map(teacher => (
                  <div key={teacher._id} className="teacher-option">
                    <span>
                      {teacher.firstName} {teacher.lastName}
                      {teacher._id === currentTeacherId && " (You)"}
                    </span>
                    <button
                      onClick={() => handleAssignStudent(selectedStudent._id, teacher._id)}
                      className="assign-btn"
                    >
                      Assign
                    </button>
                  </div>
                ))}
            </div>
            
            <button
              className="close-modal"
              onClick={() => setShowAssignModal(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentApprovalSection;