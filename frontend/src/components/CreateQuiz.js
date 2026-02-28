import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './CreateQuiz.css';

const CreateQuiz = () => {
  const [title, setTitle] = useState('');
  const [timeLimit, setTimeLimit] = useState(10);
  const [questions, setQuestions] = useState([{ type: 'mcq', question: '', options: ['', '', '', ''], correctAnswer: '' }]);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const addQuestion = () => {
    setQuestions([...questions, { type: 'mcq', question: '', options: ['', '', '', ''], correctAnswer: '' }]);
  };

  const removeQuestion = (index) => {
    if (questions.length > 1) {
      const updated = [...questions];
      updated.splice(index, 1);
      setQuestions(updated);
    }
  };

  const updateQuestion = (index, field, value, optionIndex = null) => {
    const updated = [...questions];
    if (field === 'options') {
      updated[index].options[optionIndex] = value;
    } else {
      updated[index][field] = value;
    }
    setQuestions(updated);
  };

  const validateQuiz = () => {
    if (!title.trim()) {
      setMessage('Quiz title is required');
      return false;
    }
    
    if (timeLimit < 1) {
      setMessage('Time limit must be at least 1 minute');
      return false;
    }
    
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      
      if (!q.question.trim()) {
        setMessage(`Question ${i + 1}: Question text is required`);
        return false;
      }
      
      if (q.type === 'mcq') {
        // Check if all options are filled
        for (let j = 0; j < q.options.length; j++) {
          if (!q.options[j].trim()) {
            setMessage(`Question ${i + 1}: Option ${j + 1} is required`);
            return false;
          }
        }
        
        if (!q.correctAnswer.trim()) {
          setMessage(`Question ${i + 1}: Correct answer is required`);
          return false;
        }
        
        // Validate that correct answer matches one of the options
        const validOptions = ['A', 'B', 'C', 'D'];
        if (!validOptions.includes(q.correctAnswer.toUpperCase())) {
          setMessage(`Question ${i + 1}: Correct answer must be A, B, C, or D`);
          return false;
        }
      }
      
      if (q.type === 'blank' && !q.correctAnswer.trim()) {
        setMessage(`Question ${i + 1}: Correct answer is required`);
        return false;
      }
    }
    
    return true;
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    
    if (!validateQuiz()) {
      return;
    }
    
    setLoading(true);
    setMessage('');
    
    try {
      const token = localStorage.getItem('token');
      
      // Format the questions properly
      const formattedQuestions = questions.map(q => {
        if (q.type === 'mcq') {
          return {
            ...q,
            correctAnswer: q.correctAnswer.toUpperCase() // Normalize to uppercase
          };
        }
        return q;
      });
      
      const response = await axios.post(
        'http://localhost:5000/api/quizzes/create', 
        { 
          title: title.trim(), 
          questions: formattedQuestions, 
          timeLimit: parseInt(timeLimit) 
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      
      setMessage('Quiz created successfully! Notifications sent to students.');
      
      // FIXED: Navigate to teacher dashboard instead of my-quizzes
      setTimeout(() => {
        navigate('/teacher/dashboard');
      }, 2000);
      
    } catch (error) {
      console.error('Create quiz error:', error);
      setMessage(error.response?.data?.message || 'Failed to create quiz. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="create-quiz-container">
      <h2>Create New Quiz</h2>
      
      {message && (
        <div className={message.includes('success') ? 'success-message' : 'error-message'}>
          {message}
        </div>
      )}
      
      <form onSubmit={handleCreate}>
        <div className="form-group">
          <label>Quiz Title</label>
          <input 
            type="text" 
            placeholder="e.g., Mathematics Quiz - Chapter 1" 
            value={title} 
            onChange={(e) => setTitle(e.target.value)} 
            required 
          />
        </div>
        
        <div className="form-group">
          <label>Time Limit (minutes)</label>
          <input 
            type="number" 
            placeholder="Time Limit (minutes)" 
            value={timeLimit} 
            onChange={(e) => setTimeLimit(Math.max(1, parseInt(e.target.value) || 1))} 
            min="1"
            max="180"
            required 
          />
          <small>Students must complete the quiz within this time</small>
        </div>

        <h3>Questions</h3>
        
        {questions.map((q, i) => (
          <div key={i} className="question-card">
            <div className="question-header">
              <h4>Question {i + 1}</h4>
              {questions.length > 1 && (
                <button 
                  type="button" 
                  className="remove-btn"
                  onClick={() => removeQuestion(i)}
                >
                  ✕ Remove
                </button>
              )}
            </div>
            
            <div className="form-group">
              <label>Question Type</label>
              <select 
                value={q.type} 
                onChange={(e) => updateQuestion(i, 'type', e.target.value)}
              >
                <option value="mcq">Multiple Choice</option>
                <option value="blank">Fill in the Blank</option>
              </select>
            </div>
            
            <div className="form-group">
              <label>Question Text</label>
              <input 
                type="text" 
                placeholder="Enter your question here" 
                value={q.question} 
                onChange={(e) => updateQuestion(i, 'question', e.target.value)} 
                required 
              />
            </div>
            
            {q.type === 'mcq' && (
              <>
                <div className="options-grid">
                  {q.options.map((opt, j) => (
                    <div key={j} className="option-input">
                      <label>Option {String.fromCharCode(65 + j)}</label>
                      <input 
                        type="text" 
                        placeholder={`Option ${j + 1}`} 
                        value={opt} 
                        onChange={(e) => updateQuestion(i, 'options', e.target.value, j)} 
                        required 
                      />
                    </div>
                  ))}
                </div>
                
                <div className="form-group">
                  <label>Correct Answer</label>
                  <select
                    value={q.correctAnswer}
                    onChange={(e) => updateQuestion(i, 'correctAnswer', e.target.value)}
                    required
                  >
                    <option value="">Select correct answer</option>
                    {q.options.map((_, j) => {
                      const letter = String.fromCharCode(65 + j);
                      return (
                        <option key={j} value={letter}>
                          Option {letter}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </>
            )}
            
            {q.type === 'blank' && (
              <div className="form-group">
                <label>Correct Answer (exact text)</label>
                <input 
                  type="text" 
                  placeholder="Enter the exact correct answer" 
                  value={q.correctAnswer} 
                  onChange={(e) => updateQuestion(i, 'correctAnswer', e.target.value)} 
                  required 
                />
                <small>Student's answer must match exactly (case-sensitive)</small>
              </div>
            )}
          </div>
        ))}
        
        <div className="button-group">
          <button 
            type="button" 
            onClick={addQuestion} 
            className="add-btn"
          >
            + Add Question
          </button>
          <button 
            type="submit" 
            className="submit-btn"
            disabled={loading}
          >
            {loading ? 'Creating Quiz...' : 'Create Quiz'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateQuiz;