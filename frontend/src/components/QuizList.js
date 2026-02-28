import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Link } from 'react-router-dom';
import './QuizList.css';

const QuizList = () => {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [debug, setDebug] = useState(null);

  useEffect(() => {
    const fetchQuizzes = async () => {
      try {
        const token = localStorage.getItem('token');
        
        // Debug: Check if token exists
        if (!token) {
          setError('No authentication token found. Please login again.');
          setLoading(false);
          return;
        }

        console.log('Fetching quizzes with token:', token.substring(0, 20) + '...');
        
        const response = await axios.get('http://localhost:5000/api/quizzes/list', {
          headers: { Authorization: `Bearer ${token}` },
        });

        console.log('Quiz list response:', response.data);
        
        if (response.data.success) {
          setQuizzes(response.data.quizzes || []);
          setDebug({ status: 'success', count: response.data.quizzes?.length });
        } else {
          setError(response.data.message || 'Failed to load quizzes.');
        }
      } catch (err) {
        console.error('Fetch quizzes error details:', {
          message: err.message,
          response: err.response?.data,
          status: err.response?.status,
          headers: err.response?.headers
        });
        
        // Handle specific error cases
        if (err.response?.status === 401) {
          setError('Your session has expired. Please login again.');
          localStorage.removeItem('token');
          setTimeout(() => {
            window.location.href = '/student/login';
          }, 2000);
        } else if (err.response?.status === 403) {
          setError('Your account is not approved yet. Please wait for teacher approval.');
        } else if (err.response?.status === 404) {
          setError('No quizzes found for your teachers.');
          setQuizzes([]); // Set empty array, not error
        } else {
          setError(err.response?.data?.message || 'Failed to load quizzes. Please try again.');
        }
        
        setDebug({ 
          status: 'error', 
          message: err.message,
          responseData: err.response?.data,
          statusCode: err.response?.status
        });
      } finally {
        setLoading(false);
      }
    };
    
    fetchQuizzes();
  }, []);

  if (loading) {
    return (
      <div className="quiz-list-container">
        <div className="loading-spinner">Loading quizzes...</div>
      </div>
    );
  }

  return (
    <div className="quiz-list-container">
      <h2>Available Quizzes</h2>
      
      {error && (
        <div className="error-message">
          <p>{error}</p>
          {debug && process.env.NODE_ENV === 'development' && (
            <pre className="debug-info">
              Debug: {JSON.stringify(debug, null, 2)}
            </pre>
          )}
          <button 
            onClick={() => window.location.reload()} 
            className="retry-btn"
          >
            Try Again
          </button>
        </div>
      )}
      
      {!error && quizzes.length === 0 ? (
        <div className="no-quizzes">
          <div className="empty-state-icon">📝</div>
          <h3>No Quizzes Available</h3>
          <p>There are no quizzes available for you at the moment.</p>
          <p className="small-text">Once your teacher creates a quiz, it will appear here.</p>
        </div>
      ) : (
        <div className="quizzes-grid">
          {quizzes.map((quiz) => (
            <div
              key={quiz._id}
              className={`quiz-card ${quiz.submitted ? 'submitted' : ''}`}
            >
              <h3>{quiz.title}</h3>
              <div className="quiz-meta">
                <span className="time-badge">⏱️ {quiz.timeLimit} minutes</span>
                <span className="questions-badge">📋 {quiz.questions?.length || 0} questions</span>
              </div>
              <p className="created-date">
                Created: {new Date(quiz.createdAt).toLocaleDateString()}
              </p>
              {quiz.submitted ? (
                <div className="completed-container">
                  <span className="completed-label">✓ Completed</span>
                  <Link to={`/quiz-result/${quiz._id}`} className="view-result-btn">
                    View Result
                  </Link>
                </div>
              ) : (
                <Link to={`/take-quiz/${quiz._id}`} className="take-quiz-btn">
                  Start Quiz
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default QuizList;