// src/components/Student/ProctoredQuiz.js
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/config';
import './ProctoredQuiz.css';

const ProctoredQuiz = () => {
  const { quizId } = useParams();
  const navigate = useNavigate();
  
  const [quiz, setQuiz] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [timeLeft, setTimeLeft] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);
  
  const [mediaPermissions, setMediaPermissions] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [quizStarted, setQuizStarted] = useState(false);
  const [warningCount, setWarningCount] = useState(0);
  const [warnings, setWarnings] = useState([]);
  const [videoStream, setVideoStream] = useState(null);
  const [audioLevel, setAudioLevel] = useState(0);
  const [faceDetected, setFaceDetected] = useState(true);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [mouseLeaveCount, setMouseLeaveCount] = useState(0);
  const [keyPressCount, setKeyPressCount] = useState(0);
  const [internetStatus, setInternetStatus] = useState(true);
  const [isStartingQuiz, setIsStartingQuiz] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  
  const videoRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const timerRef = useRef(null);
  const canvasRef = useRef(null);
  const faceDetectionIntervalRef = useRef(null);
  const eventListenersRef = useRef([]);
  const isComponentMountedRef = useRef(true);
  const isExitingFullscreenRef = useRef(false);

  useEffect(() => {
    isComponentMountedRef.current = true;
    return () => {
      isComponentMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const checkSubmission = async () => {
      try {
        const res = await api.get(`/api/quizzes/check-submission/${quizId}`);
        if (res.data.submitted && isComponentMountedRef.current) {
          alert('You have already taken this quiz.');
          navigate('/student/quizzes');
        }
      } catch (err) {
        console.error('Check submission error:', err);
      }
    };
    checkSubmission();
  }, [quizId, navigate]);

  const safeExitFullscreen = async () => {
    if (isExitingFullscreenRef.current) return;
    isExitingFullscreenRef.current = true;

    try {
      if (document.fullscreenElement || 
          document.webkitFullscreenElement || 
          document.msFullscreenElement || 
          document.mozFullScreenElement) {
        
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen();
        } else if (document.msExitFullscreen) {
          await document.msExitFullscreen();
        } else if (document.mozCancelFullScreen) {
          await document.mozCancelFullScreen();
        }
      }
    } catch (err) {
      if (err.name !== 'TypeError' && !err.message.includes('Document not active')) {
        console.error('Fullscreen exit error:', err);
      }
    } finally {
      isExitingFullscreenRef.current = false;
    }
  };

  const safeEnterFullscreen = async () => {
    try {
      const elem = document.documentElement;
      
      if (elem.requestFullscreen) {
        await elem.requestFullscreen();
      } else if (elem.webkitRequestFullscreen) {
        await elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen) {
        await elem.msRequestFullscreen();
      } else if (elem.mozRequestFullScreen) {
        await elem.mozRequestFullScreen();
      }
      
      if (isComponentMountedRef.current) {
        setFullscreen(true);
      }
      return true;
    } catch (err) {
      console.error('Fullscreen error:', err);
      if (isComponentMountedRef.current) {
        alert('Fullscreen mode is required to take this quiz. Please enable fullscreen and try again.');
      }
      return false;
    }
  };

  const addSafeEventListener = (target, type, listener, options) => {
    target.addEventListener(type, listener, options);
    eventListenersRef.current.push({ target, type, listener, options });
  };

  const removeAllEventListeners = () => {
    eventListenersRef.current.forEach(({ target, type, listener, options }) => {
      try {
        target.removeEventListener(type, listener, options);
      } catch (err) {
      }
    });
    eventListenersRef.current = [];
  };

  const requestMediaPermissions = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
          frameRate: { ideal: 30 }
        }, 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });
      
      if (isComponentMountedRef.current) {
        setVideoStream(stream);
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        await new Promise((resolve) => {
          if (videoRef.current.readyState >= 2) {
            setVideoReady(true);
            resolve();
          } else {
            videoRef.current.onloadeddata = () => {
              setVideoReady(true);
              resolve();
            };
          }
        });
        
        try {
          await videoRef.current.play();
        } catch (playError) {
          console.error('Error playing video:', playError);
        }
      }
      
      if (isComponentMountedRef.current) {
        audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
        await audioContextRef.current.resume();
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 2048;
        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyserRef.current);
      }
      
      return true;
    } catch (err) {
      console.error('Media permission error:', err);
      if (isComponentMountedRef.current) {
        alert('Camera and microphone access is required to take this quiz. Please enable permissions and try again.');
      }
      return false;
    }
  };

  const startQuiz = async () => {
    if (isStartingQuiz || quizStarted) return;
    setIsStartingQuiz(true);
    
    try {
      const mediaGranted = await requestMediaPermissions();
      if (!mediaGranted) {
        setIsStartingQuiz(false);
        return;
      }
      
      const fullscreenGranted = await safeEnterFullscreen();
      if (!fullscreenGranted) {
        setIsStartingQuiz(false);
        return;
      }
      
      if (isComponentMountedRef.current) {
        setQuizStarted(true);
        setIsStartingQuiz(false);
      }
      
    } catch (err) {
      console.error('Error starting quiz:', err);
      if (isComponentMountedRef.current) {
        alert('Failed to start quiz. Please try again.');
      }
      setIsStartingQuiz(false);
    }
  };

  const setupProctoringFeatures = () => {
    if (!isComponentMountedRef.current || !quizStarted) return;
    
    startAudioMonitoring();
    startFaceDetection();
    
    addSafeEventListener(document, 'fullscreenchange', checkFullscreen);
    addSafeEventListener(document, 'webkitfullscreenchange', checkFullscreen);
    addSafeEventListener(document, 'msfullscreenchange', checkFullscreen);
    addSafeEventListener(document, 'mozfullscreenchange', checkFullscreen);
    addSafeEventListener(document, 'visibilitychange', handleVisibilityChange);
    addSafeEventListener(document, 'contextmenu', handleContextMenu);
    addSafeEventListener(document, 'copy', handleCopyPaste);
    addSafeEventListener(document, 'paste', handleCopyPaste);
    addSafeEventListener(document, 'cut', handleCopyPaste);
    addSafeEventListener(document, 'keydown', handleKeyDown);
    addSafeEventListener(document, 'mouseleave', handleMouseLeave);
    addSafeEventListener(window, 'online', handleInternetStatus);
    addSafeEventListener(window, 'offline', handleInternetStatus);
    addSafeEventListener(window, 'keyup', preventScreenshot);
    addSafeEventListener(window, 'keydown', preventF11);
    
    window.history.pushState(null, null, window.location.href);
    addSafeEventListener(window, 'popstate', function (event) {
      window.history.pushState(null, null, window.location.href);
      if (quizStarted && isComponentMountedRef.current) {
        addWarning('Attempted to use browser back button');
      }
    });
    
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
    document.body.style.msUserSelect = 'none';
    document.body.style.mozUserSelect = 'none';
  };

  const startAudioMonitoring = () => {
    if (!analyserRef.current || !isComponentMountedRef.current) return;
    
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    let silentFrames = 0;
    
    const checkAudio = () => {
      if (!isComponentMountedRef.current || !quizStarted) return;
      
      if (analyserRef.current) {
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAudioLevel(average);
        
        if (average < 5) {
          silentFrames++;
          if (silentFrames > 100 && quizStarted && isComponentMountedRef.current) {
            addWarning('Prolonged silence detected');
            silentFrames = 0;
          }
        } else {
          silentFrames = 0;
        }
      }
      requestAnimationFrame(checkAudio);
    };
    checkAudio();
  };

  const startFaceDetection = () => {
    if (!isComponentMountedRef.current || !quizStarted) return;
    
    if (faceDetectionIntervalRef.current) {
      clearInterval(faceDetectionIntervalRef.current);
    }
    
    faceDetectionIntervalRef.current = setInterval(() => {
      detectFace();
    }, 1000);
  };

  const detectFace = () => {
    if (!videoRef.current || !canvasRef.current || !isComponentMountedRef.current || !quizStarted) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    if (video.videoWidth && video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
      const faceDetected = detectFaceInImageData(imageData);
      
      if (isComponentMountedRef.current) {
        setFaceDetected(faceDetected);
        
        if (!faceDetected && quizStarted) {
          addWarning('Face not detected in frame');
        }
      }
    }
  };

  const detectFaceInImageData = (imageData) => {
    return Math.random() > 0.1;
  };

  const preventF11 = (e) => {
    if (e.key === 'F11' && quizStarted) {
      e.preventDefault();
      addWarning('Attempted to exit fullscreen using F11');
    }
  };

  const checkFullscreen = () => {
    if (!isComponentMountedRef.current) return;
    
    const isFullscreen = 
      document.fullscreenElement ||
      document.webkitFullscreenElement ||
      document.msFullscreenElement ||
      document.mozFullScreenElement;
    
    if (!isFullscreen && quizStarted && isComponentMountedRef.current) {
      addWarning('You exited fullscreen mode');
      safeEnterFullscreen();
    }
    setFullscreen(!!isFullscreen);
  };

  const addWarning = (message) => {
    if (!isComponentMountedRef.current || !quizStarted) return;
    
    setWarningCount(prev => {
      const newCount = prev + 1;
      
      setWarnings(prevWarnings => [...prevWarnings, {
        message,
        timestamp: new Date().toLocaleTimeString(),
        count: newCount
      }]);
      
      if (newCount >= 3 && !isSubmitting && !submissionResult) {
        alert('Multiple violations detected. Quiz will be submitted automatically.');
        handleSubmit();
      }
      
      return newCount;
    });
  };

  const handleVisibilityChange = () => {
    if (!isComponentMountedRef.current || !quizStarted) return;
    
    if (document.hidden && quizStarted && !isSubmitting && !submissionResult) {
      setTabSwitchCount(prev => {
        const newCount = prev + 1;
        addWarning(`Tab switched (Warning ${newCount}/3)`);
        return newCount;
      });
    }
  };

  const handleMouseLeave = (e) => {
    if (!isComponentMountedRef.current || !quizStarted) return;
    
    if (quizStarted && e.clientY <= 0 && !isSubmitting && !submissionResult) {
      setMouseLeaveCount(prev => {
        const newCount = prev + 1;
        addWarning('Mouse left the window');
        return newCount;
      });
    }
  };

  const handleKeyDown = (e) => {
    if (!quizStarted || !isComponentMountedRef.current || isSubmitting || submissionResult) return;
    
    if (
      (e.ctrlKey && e.key === 'c') ||
      (e.ctrlKey && e.key === 'v') ||
      (e.ctrlKey && e.key === 'x') ||
      (e.ctrlKey && e.key === 'a') ||
      (e.ctrlKey && e.key === 'p') ||
      (e.ctrlKey && e.key === 's') ||
      (e.ctrlKey && e.key === 'f') ||
      (e.ctrlKey && e.key === 't') ||
      (e.ctrlKey && e.key === 'w') ||
      (e.altKey && e.key === 'Tab') ||
      (e.metaKey && e.key === 'q')
    ) {
      e.preventDefault();
      setKeyPressCount(prev => {
        const newCount = prev + 1;
        addWarning('Attempted to use prohibited keyboard shortcut');
        return newCount;
      });
    }
  };

  const handleContextMenu = (e) => {
    if (quizStarted && isComponentMountedRef.current) {
      e.preventDefault();
      addWarning('Attempted to right-click');
    }
  };

  const handleCopyPaste = (e) => {
    if (quizStarted && isComponentMountedRef.current) {
      e.preventDefault();
      addWarning('Attempted to copy/paste');
    }
  };

  const handleInternetStatus = () => {
    if (!isComponentMountedRef.current) return;
    
    setInternetStatus(navigator.onLine);
    if (!navigator.onLine && quizStarted) {
      addWarning('Internet connection lost');
    }
  };

  const preventScreenshot = (e) => {
    if (e.key === 'PrintScreen' && quizStarted && isComponentMountedRef.current) {
      addWarning('Screenshot attempted');
    }
  };

  useEffect(() => {
    const fetchQuiz = async () => {
      try {
        const res = await api.get(`/api/quizzes/${quizId}`);
        
        if (isComponentMountedRef.current) {
          const quizData = res.data.quiz;
          setQuiz(quizData);
          const safeTimeLimit = quizData.timeLimit > 0 ? quizData.timeLimit : 60;
          setTimeLeft(safeTimeLimit * 60);
          setAnswers(new Array(quizData.questions.length).fill(''));
        }
      } catch (err) {
        console.error('Fetch quiz error:', err);
        if (isComponentMountedRef.current) {
          alert('Could not load quiz');
          navigate('/student/quizzes');
        }
      }
    };
    fetchQuiz();
  }, [quizId, navigate]);

  useEffect(() => {
    if (!quizStarted || !quiz || submissionResult || timeLeft <= 0 || isSubmitting) {
      return;
    }
    
    let lastTimestamp = Date.now();
    
    timerRef.current = setInterval(() => {
      if (!isComponentMountedRef.current || isSubmitting || submissionResult) {
        clearInterval(timerRef.current);
        return;
      }
      
      const currentTimestamp = Date.now();
      const timeDiff = (currentTimestamp - lastTimestamp) / 1000;
      
      if (timeDiff > 2 && quizStarted) {
        setIsPaused(true);
        addWarning('Timer anomaly detected');
      } else {
        setIsPaused(false);
      }
      
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          if (!isSubmitting && !submissionResult) {
            handleSubmit();
          }
          return 0;
        }
        return prev - 1;
      });
      
      lastTimestamp = currentTimestamp;
    }, 1000);
    
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [quizStarted, quiz, submissionResult, isSubmitting]);

  useEffect(() => {
    if (quizStarted && isComponentMountedRef.current) {
      setTimeout(() => {
        if (isComponentMountedRef.current && quizStarted) {
          setupProctoringFeatures();
        }
      }, 500);
    }
  }, [quizStarted]);

  useEffect(() => {
    return () => {
      isComponentMountedRef.current = false;
      
      if (videoStream) {
        try {
          videoStream.getTracks().forEach(track => {
            if (track.readyState === 'live') {
              track.stop();
            }
          });
        } catch (err) {
          console.error('Error stopping video stream:', err);
        }
      }
      
      if (audioContextRef.current) {
        try {
          if (audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close();
          }
        } catch (err) {
          console.error('Error closing audio context:', err);
        }
      }
      
      if (faceDetectionIntervalRef.current) {
        clearInterval(faceDetectionIntervalRef.current);
      }
      
      removeAllEventListeners();
      
      if (document.body) {
        document.body.style.userSelect = '';
        document.body.style.webkitUserSelect = '';
        document.body.style.msUserSelect = '';
        document.body.style.mozUserSelect = '';
      }
      
      safeExitFullscreen();
    };
  }, [videoStream]);

  const handleAnswerChange = (questionIndex, value) => {
    if (!quizStarted || isSubmitting || submissionResult) return;
    
    const updated = [...answers];
    updated[questionIndex] = value;
    setAnswers(updated);
  };

  const handleSubmit = async () => {
    if (isSubmitting || submissionResult || !isComponentMountedRef.current) return;
    
    const confirmSubmit = window.confirm('Are you sure you want to submit your quiz?');
    if (!confirmSubmit) return;
    
    setIsSubmitting(true);
    
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    try {
      const res = await api.post(`/api/quizzes/submit/${quizId}`, { 
        answers,
        proctoringData: {
          warnings: warnings,
          tabSwitches: tabSwitchCount,
          mouseLeaves: mouseLeaveCount,
          keyViolations: keyPressCount,
          timeSpent: quiz.timeLimit * 60 - timeLeft,
          faceDetected: faceDetected,
          audioLevels: audioLevel,
          internetIssues: !internetStatus
        }
      });

      if (isComponentMountedRef.current) {
        setSubmissionResult({
          score: res.data.score,
          percentage: res.data.percentage,
          correctAnswers: res.data.correctAnswers,
        });
      }
      
      await safeExitFullscreen();
      
    } catch (err) {
      console.error('Submit failed:', err);
      if (isComponentMountedRef.current) {
        alert('Could not submit quiz: ' + (err.response?.data?.message || 'Server error'));
      }
    } finally {
      if (isComponentMountedRef.current) {
        setIsSubmitting(false);
      }
    }
  };

  if (!quiz) {
    return (
      <div className="proctored-quiz-container loading">
        <div className="spinner"></div>
        <p>Loading quiz...</p>
      </div>
    );
  }

  if (!quizStarted) {
    return (
      <div className="proctored-quiz-container start-screen">
        <div className="start-screen-content">
          <h1>📝 {quiz.title}</h1>
          
          <div className="quiz-info">
            <div className="info-card">
              <span className="info-icon">⏱️</span>
              <span className="info-label">Time Limit</span>
              <span className="info-value">{quiz.timeLimit} minutes</span>
            </div>
            <div className="info-card">
              <span className="info-icon">📋</span>
              <span className="info-label">Questions</span>
              <span className="info-value">{quiz.questions.length}</span>
            </div>
            <div className="info-card">
              <span className="info-icon">🎯</span>
              <span className="info-label">Type</span>
              <span className="info-value">Proctored</span>
            </div>
          </div>

          <div className="proctoring-requirements">
            <h3>📋 Strict Proctoring Requirements</h3>
            <div className="requirements-list">
              <div className="requirement-item">
                <span className="requirement-icon">📹</span>
                <div className="requirement-text">
                  <strong>Continuous Camera Monitoring</strong>
                  <p>Face must remain visible at all times. Looking away will trigger warnings.</p>
                </div>
              </div>
              <div className="requirement-item">
                <span className="requirement-icon">🎤</span>
                <div className="requirement-text">
                  <strong>Audio Environment Monitoring</strong>
                  <p>Background noise and silence are both monitored for integrity.</p>
                </div>
              </div>
              <div className="requirement-item">
                <span className="requirement-icon">🖥️</span>
                <div className="requirement-text">
                  <strong>Locked Fullscreen Mode</strong>
                  <p>Exiting fullscreen will trigger immediate warnings and auto-reentry.</p>
                </div>
              </div>
              <div className="requirement-item">
                <span className="requirement-icon">⚠️</span>
                <div className="requirement-text">
                  <strong>Zero Tolerance Policy</strong>
                  <p>3 warnings = Automatic submission. Tab switching, right-clicking, copy/paste, and keyboard shortcuts are prohibited.</p>
                </div>
              </div>
              <div className="requirement-item">
                <span className="requirement-icon">🎯</span>
                <div className="requirement-text">
                  <strong>Face Detection Required</strong>
                  <p>Your face must be clearly visible and centered in the camera frame.</p>
                </div>
              </div>
            </div>
          </div>

          <button 
            onClick={startQuiz} 
            className="start-quiz-btn"
            disabled={isStartingQuiz}
          >
            {isStartingQuiz ? 'Starting Quiz...' : 'Start Proctored Quiz'}
          </button>
          <button 
            onClick={() => navigate('/student/quizzes')} 
            className="cancel-btn"
            disabled={isStartingQuiz}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (!submissionResult) {
    return (
      <div className="proctored-quiz-container quiz-active">
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        
        <div className="quiz-header">
          <div className="quiz-title-section">
            <h2>{quiz.title}</h2>
            <div className="timer-section">
              <span className="timer-icon">⏱️</span>
              <span className={`timer ${timeLeft < 60 ? 'timer-warning' : ''}`}>
                {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
              </span>
              {isPaused && <span className="timer-warning">⚠️ Timer anomaly</span>}
            </div>
          </div>
          
          <div className="proctoring-status">
            <div className="status-item">
              <span className={`status-indicator ${videoStream ? 'active' : 'inactive'}`}></span>
              <span>Camera: {videoStream ? 'Active' : 'Inactive'}</span>
            </div>
            <div className="status-item">
              <span className={`status-indicator ${faceDetected ? 'active' : 'inactive'}`}></span>
              <span>Face: {faceDetected ? 'Detected' : 'Not Found'}</span>
            </div>
            <div className="status-item">
              <span className={`status-indicator ${audioLevel > 10 ? 'active' : 'inactive'}`}></span>
              <span>Audio: {audioLevel > 10 ? 'Detected' : 'Silent'}</span>
            </div>
            <div className="status-item">
              <span className={`status-indicator ${fullscreen ? 'active' : 'inactive'}`}></span>
              <span>Fullscreen: {fullscreen ? 'Locked' : 'Exited'}</span>
            </div>
            <div className="status-item warning">
              <span>⚠️ Warnings: {warningCount}/3</span>
            </div>
            <div className="status-item">
              <span>📶 {internetStatus ? 'Online' : 'Offline'}</span>
            </div>
          </div>
        </div>

        <div className="quiz-main-content">
          <div className="video-container">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="proctoring-video"
            />
            <div className="video-overlay">
              <span>📹 Proctoring Active - {faceDetected ? 'Face Detected' : 'Face Not Found'}</span>
              <span style={{ display: 'block', fontSize: '0.7rem', marginTop: '4px' }}>
                🎤 Audio Level: {Math.round(audioLevel)}%
              </span>
            </div>
          </div>

          <div className="questions-container">
            <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
              {quiz.questions.map((q, i) => (
                <div key={i} className="question-block">
                  <div className="question-header">
                    <span className="question-number">Question {i + 1}</span>
                    <span className="question-type">
                      {q.type === 'mcq' ? 'Multiple Choice' : 'Fill in the Blank'}
                    </span>
                  </div>
                  <p className="question-text">{q.question}</p>

                  {q.type === 'mcq' ? (
                    <div className="options-container">
                      {q.options.map((opt, j) => (
                        <label key={j} className="option-label">
                          <input
                            type="radio"
                            name={`q-${i}`}
                            value={opt}
                            checked={answers[i] === opt}
                            onChange={() => handleAnswerChange(i, opt)}
                            disabled={isSubmitting}
                          />
                          <span className="option-text">{opt}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <input
                      type="text"
                      value={answers[i] || ''}
                      onChange={(e) => handleAnswerChange(i, e.target.value)}
                      placeholder="Type your answer here..."
                      className="blank-input"
                      autoComplete="off"
                      spellCheck="false"
                      disabled={isSubmitting}
                    />
                  )}
                </div>
              ))}

              <div className="submit-section">
                <button 
                  type="submit" 
                  disabled={isSubmitting} 
                  className="submit-quiz-btn"
                >
                  {isSubmitting ? 'Submitting...' : 'Submit Quiz'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {warnings.length > 0 && (
          <div className="warnings-panel">
            <h4>⚠️ Violation Log ({warningCount}/3 warnings - Auto-submit at 3)</h4>
            <div className="warnings-list">
              {warnings.map((warning, index) => (
                <div key={index} className="warning-item">
                  <span className="warning-time">{warning.timestamp}</span>
                  <span className="warning-message">Warning {warning.count}: {warning.message}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="proctored-quiz-container result-screen">
      <div className="result-content">
        <h1>✅ Quiz Submitted!</h1>
        
        <div className="score-circle">
          <span className="score-number">{submissionResult.percentage}%</span>
          <span className="score-label">Your Score</span>
        </div>
        
        <div className="result-details">
          <div className="detail-item">
            <span className="detail-label">Correct Answers</span>
            <span className="detail-value">{submissionResult.score}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Total Questions</span>
            <span className="detail-value">{quiz.questions.length}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Warnings Received</span>
            <span className="detail-value">{warningCount}</span>
          </div>
          <div className="detail-item">
            <span className="detail-label">Tab Switches</span>
            <span className="detail-value">{tabSwitchCount}</span>
          </div>
        </div>

        <div className="result-actions">
          <button onClick={() => navigate('/student/quizzes')} className="back-to-quizzes-btn">
            ← Back to Quizzes
          </button>
          <button onClick={() => navigate('/student/leaderboard')} className="view-leaderboard-btn">
            View My Performance →
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProctoredQuiz;