import React from 'react';
import { Link } from 'react-router-dom';
import './HomePage.css';

const HomePage = () => {
  return (
    <div className="homepage">
      <div className="hero">
        <h1>Welcome to Virtual Classroom Platform</h1>
      </div>

      <div className="cards">
        {/* Teacher Card */}
        <div className="card">
          <h2>Teachers</h2>
          <p>
            Create engaging quizzes, monitor student progress, manage classes and view detailed analytics.
          </p>
          <div className="buttons">
            <Link to="/teacher/register" className="btn primary">
              Teacher Register
            </Link>
            <Link to="/teacher/login" className="btn secondary">
              Teacher Login
            </Link>
          </div>
        </div>

        {/* Student Card */}
        <div className="card">
          <h2>Students</h2>
          <p>
            Join live quizzes, test your knowledge,
            see instant results and track your learning progress.
          </p>
          <div className="buttons">
            <Link to="/student/register" className="btn primary">
              Student Register
            </Link>
            <Link to="/student/login" className="btn secondary">
              Student Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;