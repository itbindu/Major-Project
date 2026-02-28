// src/App.js  — updated version with dedicated student management route

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';

// Public / Auth
import HomePage from './components/HomePage';
import TeacherRegister from './components/Teacher/TeacherRegister';
import TeacherLogin from './components/Teacher/TeacherLogin';
import StudentRegister from './components/Student/StudentRegister';
import StudentLogin from './components/Student/StudentLogin';
import ForgotPassword from './components/ForgotPassword';

// Protected / Functional
import TeacherDashboard from './components/Teacher/TeacherDashboard';
import CreateMeeting from './components/CreateMeeting';
import StudentDashboard from './components/Student/StudentDashboard';
import JoinMeeting from './components/JoinMeeting';
import MeetingRoom from './components/MeetingRoom';
import MeetingHistory from './components/MeetingHistory';

// NEW: Student management page
import ManageStudents from './components/Teacher/StudentApprovalSection';   // ← or rename to ManageStudents.js
import LMSPage from './components/Teacher/LMSPage';
import StudentLMS from './components/Student/StudentLMS';

import QuizList from './components/QuizList';
import TakeQuiz from './components/TakeQuiz';
import TeacherQuizList from './components/TeacherQuizList';
import Leaderboard from './components/Leaderboard';
import CreateQuiz from './components/CreateQuiz';

import TeacherLeaderboardSelection from './components/Teacher/TeacherLeaderboardSelection';
import StudentLeaderboard from './components/Student/StudentLeaderboard';

import ProctoredQuiz from './components/Student/ProctoredQuiz';
import AttendancePage from './components/AttendancePage';
// Protected Route wrapper
const ProtectedRoute = ({ children, redirectTo }) => {
  const token = localStorage.getItem('token');
  return token ? children : <Navigate to={redirectTo} replace />;
};

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>

          {/* Public */}
          <Route path="/" element={<HomePage />} />
          <Route path="/teacher/register" element={<TeacherRegister />} />
          <Route path="/teacher/login" element={<TeacherLogin />} />
          <Route path="/student/register" element={<StudentRegister />} />
          <Route path="/student/login" element={<StudentLogin />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/meeting/:meetingId" element={<JoinMeeting />} />
          <Route path="/teacher/lms" element={<LMSPage />} />
          <Route path="/student/lms" element={<StudentLMS />} />
          <Route path="/teacher/quizzes" element={<TeacherQuizList />} />
        <Route path="/teacher/leaderboard/:quizId" element={<Leaderboard />} />
        <Route path="/student/quizzes" element={<QuizList />} />
        <Route path="/take-quiz/:quizId" element={<TakeQuiz />} />
        <Route path="/teacher/create-quiz" element={<CreateQuiz />} />
        <Route path="/teacher/leaderboard" element={<TeacherLeaderboardSelection />} />
        <Route path="/teacher/attendance" element={<AttendancePage role="teacher" />} />
<Route path="/student/attendance" element={<AttendancePage role="student" />} />
        <Route path="/student/leaderboard" element={<StudentLeaderboard />} />
        <Route path="/proctored-quiz/:quizId" element={<ProctoredQuiz />} />
          {/* Teacher Protected */}
          <Route
            path="/teacher/dashboard"
            element={
              <ProtectedRoute redirectTo="/teacher/login">
                <TeacherDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/teacher/create-meeting"
            element={
              <ProtectedRoute redirectTo="/teacher/login">
                <CreateMeeting />
              </ProtectedRoute>
            }
          />

          {/* ──── NEW: Dedicated student management page ──── */}
          <Route
            path="/teacher/students"
            element={
              <ProtectedRoute redirectTo="/teacher/login">
                <ManageStudents />
              </ProtectedRoute>
            }
          />

          <Route
            path="/teacher/my-meetings"
            element={
              <ProtectedRoute redirectTo="/teacher/login">
                <MeetingHistory role="teacher" />
              </ProtectedRoute>
            }
          />

          <Route
            path="/teacher/meeting/:meetingId"
            element={
              <ProtectedRoute redirectTo="/teacher/login">
                <MeetingRoom role="teacher" />
              </ProtectedRoute>
            }
          />

          {/* Student Protected */}
          <Route
            path="/student/dashboard"
            element={
              <ProtectedRoute redirectTo="/student/login">
                <StudentDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/meeting-links"
            element={
              <ProtectedRoute redirectTo="/student/login">
                <MeetingHistory role="student" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/student/meeting-room/:meetingId"
            element={
              <ProtectedRoute redirectTo="/student/login">
                <MeetingRoom role="student" />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </div>
    </Router>
  );
}

export default App;