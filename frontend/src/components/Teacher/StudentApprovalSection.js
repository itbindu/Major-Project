// src/components/Teacher/StudentApprovalSection.js
import React, { useState, useEffect } from "react";
import api from "../../api/config";
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
      
      const studentsRes = await api.get("/api/teachers/registered-students");
      
      const teachersRes = await api.get("/api/teachers/all-teachers");

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
    const assignTeacherId = teacherId || localStorage.getItem("teacherId");
    
    try {
      await api.post("/api/teachers/approve-student", { studentId });
      
      setMessage("Student assigned successfully!");
      fetchData();
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
      await api.post("/api/teachers/remove-assignment", { studentId, teacherId });
      
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