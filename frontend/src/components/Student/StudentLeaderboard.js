// src/components/Student/StudentLeaderboard.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate, Link } from 'react-router-dom';
import './StudentLeaderboard.css';

const StudentLeaderboard = () => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    totalQuizzes: 0,
    averageScore: 0,
    passedQuizzes: 0
  });
  const navigate = useNavigate();

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(
          'http://localhost:5000/api/quizzes/student/leaderboard',
          { headers: { Authorization: `Bearer ${token}` } }
        );

        if (response.data.success) {
          const data = response.data.leaderboard || [];
          setLeaderboard(data);
          
          // Calculate stats
          if (data.length > 0) {
            const avgScore = Math.round(
              data.reduce((acc, curr) => acc + curr.percentage, 0) / data.length
            );
            const passed = data.filter(q => q.percentage >= 70).length;
            
            setStats({
              totalQuizzes: data.length,
              averageScore: avgScore,
              passedQuizzes: passed
            });
          }
        }
      } catch (error) {
        console.error('Fetch leaderboard error:', error);
        setError('Failed to load leaderboard. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  if (loading) {
    return (
      <div className="student-leaderboard-container">
        <div className="loading-spinner">Loading your performance...</div>
      </div>
    );
  }

  return (
    <div className="student-leaderboard-container">
      <div className="leaderboard-header">
        <h2>📊 My Performance</h2>
        <p>Track your quiz scores and progress</p>
      </div>

      {error && <div className="error-message">{error}</div>}

      {leaderboard.length === 0 ? (
        <div className="no-results">
          <div className="empty-icon">📝</div>
          <h3>No Quiz Results Yet</h3>
          <p>You haven't taken any quizzes yet.</p>
          <Link to="/student/quizzes" className="take-quiz-btn">
            Browse Available Quizzes
          </Link>
        </div>
      ) : (
        <>
          <div className="stats-summary">
            <div className="stat-card">
              <span className="stat-value">{stats.totalQuizzes}</span>
              <span className="stat-label">Quizzes Taken</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{stats.averageScore}%</span>
              <span className="stat-label">Average Score</span>
            </div>
            <div className="stat-card">
              <span className="stat-value">{stats.passedQuizzes}</span>
              <span className="stat-label">Passed (≥70%)</span>
            </div>
          </div>

          <div className="leaderboard-table-container">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Quiz Title</th>
                  <th>Score</th>
                  <th>Percentage</th>
                  <th>Submitted</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((entry, index) => (
                  <tr key={index} className={entry.percentage >= 70 ? 'passed-row' : 'failed-row'}>
                    <td className="rank-cell">
                      {index === 0 && '🥇'}
                      {index === 1 && '🥈'}
                      {index === 2 && '🥉'}
                      {index > 2 && `#${index + 1}`}
                    </td>
                    <td className="quiz-title">{entry.quizTitle || 'Unknown Quiz'}</td>
                    <td>
                      <strong>{entry.score}</strong> / {entry.total}
                    </td>
                    <td>
                      <span className={`percentage-badge ${entry.percentage >= 70 ? 'success' : 'warning'}`}>
                        {entry.percentage}%
                      </span>
                    </td>
                    <td>{new Date(entry.submittedAt).toLocaleDateString()}</td>
                    <td>
                      <span className={`status-badge ${entry.percentage >= 70 ? 'passed' : 'failed'}`}>
                        {entry.percentage >= 70 ? '✓ Passed' : '✗ Failed'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="action-buttons">
        <button onClick={() => navigate('/student/dashboard')} className="back-btn">
          ← Back to Dashboard
        </button>
        <Link to="/student/quizzes" className="view-quizzes-btn">
          Take More Quizzes
        </Link>
      </div>
    </div>
  );
};

export default StudentLeaderboard;