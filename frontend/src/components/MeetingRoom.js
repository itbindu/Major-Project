// src/components/MeetingRoom.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import {
  Mic, MicOff, Video, VideoOff, X, Send, Users, LogOut,
  Hand, ScreenShare, LayoutGrid, LayoutList, Copy,
  Hash, Clock, Circle, Grid, UserPlus,
  PenTool, PlayCircle, StopCircle, Download, Eraser, Save,
  VolumeX, Volume2, User, ChevronLeft, ChevronRight,
  CameraOff, ThumbsUp, MessageSquare, Calendar, Check,
  Share2, Maximize, Minimize, DoorOpen, Home
} from 'lucide-react';
import AttendanceTracker from './AttendanceTracker';
import BreakoutRoom from './BreakoutRoom';
import Whiteboard from './Whiteboard';
import './MeetingRoom.css';

const MeetingRoom = ({ role = 'student' }) => {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  
  // ============ BASIC STATES ============
  const [userName, setUserName] = useState('');
  const [userId, setUserId] = useState('');
  const [meetingTopic, setMeetingTopic] = useState('Virtual Classroom');
  const [meetingTime, setMeetingTime] = useState('00:00');
  const [meetingStartTime] = useState(new Date());
  const [participantCount, setParticipantCount] = useState(1);
  
  // Media states
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [streamError, setStreamError] = useState('');
  
  // Peer states
  const [peers, setPeers] = useState([]);
  const [participants, setParticipants] = useState([]);
  
  // UI states
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showBreakoutRooms, setShowBreakoutRooms] = useState(false);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [layoutMode, setLayoutMode] = useState('grid'); // 'grid' or 'speaker'
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFooter, setShowFooter] = useState(true);
  const [showLeaveOptions, setShowLeaveOptions] = useState(false);
  
  // Chat states
  const [chatMessage, setChatMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  
  // Recording states
  const [recordingTime, setRecordingTime] = useState('00:00');
  const [isRecordingActive, setIsRecordingActive] = useState(false);
  const [showRecordingComplete, setShowRecordingComplete] = useState(false);
  
  // Link sharing
  const [linkCopied, setLinkCopied] = useState(false);
  const [meetingLink, setMeetingLink] = useState('');
  
  // Refs
  const socketRef = useRef(null);
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const chatEndRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  // ============ INITIALIZE USER ============
  useEffect(() => {
    // Get API URL for socket
    const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    const SOCKET_URL = API_URL.replace(/^https?:\/\//, '');
    
    // Initialize socket
    const socket = io(SOCKET_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });
    
    socketRef.current = socket;

    // Set meeting link
    const link = `${window.location.origin}/meeting/${meetingId}`;
    setMeetingLink(link);

    // Initialize user
    if (role === 'teacher') {
      const teacherData = JSON.parse(localStorage.getItem('teacherUser') || '{}');
      const fullName = `${teacherData.firstName || ''} ${teacherData.lastName || ''}`.trim();
      setUserName(fullName || 'Teacher');
      setUserId(`teacher_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
      
      const storedTopic = localStorage.getItem(`meetingTopic_${meetingId}`) || 'Virtual Classroom';
      setMeetingTopic(storedTopic);
    } else {
      const studentName = localStorage.getItem('currentStudentName') || 'Student';
      setUserName(studentName);
      setUserId(`student_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
    }

    // Socket event listeners
    socket.on('connect', () => {
      console.log('Socket connected');
      socket.emit('join-meeting', {
        meetingId,
        userId,
        userName,
        role
      });
    });

    socket.on('user-joined', (user) => {
      if (user.userId !== userId) {
        setParticipants(prev => [...prev, user]);
        setParticipantCount(prev => prev + 1);
        
        setMessages(prev => [...prev, {
          id: `join-${Date.now()}`,
          type: 'system',
          text: `${user.userName} joined the meeting`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
      }
    });

    socket.on('user-left', (leftUserId) => {
      setParticipants(prev => prev.filter(p => p.userId !== leftUserId));
      setParticipantCount(prev => prev - 1);
      
      setMessages(prev => [...prev, {
        id: `leave-${Date.now()}`,
        type: 'system',
        text: 'A participant left the meeting',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    });

    socket.on('chat-message', (message) => {
      setMessages(prev => [...prev, message]);
      if (!showChat) {
        setUnreadMessages(prev => prev + 1);
      }
    });

    socket.on('media-state-changed', (data) => {
      setParticipants(prev => prev.map(p => 
        p.userId === data.userId 
          ? { ...p, audioEnabled: data.audioEnabled, videoEnabled: data.videoEnabled }
          : p
      ));
    });

    socket.on('screen-share-started', (data) => {
      setParticipants(prev => prev.map(p => 
        p.userId === data.userId 
          ? { ...p, isScreenSharing: true }
          : p
      ));
      if (data.userId !== userId) {
        setLayoutMode('speaker');
      }
    });

    socket.on('screen-share-stopped', (data) => {
      setParticipants(prev => prev.map(p => 
        p.userId === data.userId 
          ? { ...p, isScreenSharing: false }
          : p
      ));
    });

    socket.on('meeting-ended', () => {
      alert('The meeting has been ended by the host.');
      if (role === 'teacher') {
        navigate('/teacher/dashboard');
      } else {
        navigate('/student/dashboard');
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave-meeting', { meetingId, userId });
        socketRef.current.disconnect();
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [meetingId, userId, userName, role, navigate]);

  // ============ INITIALIZE LOCAL MEDIA ============
  useEffect(() => {
    const initLocalStream = async () => {
      try {
        setStreamError('');
        
        const constraints = {
          video: cameraOn ? {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
          } : false,
          audio: micOn ? {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } : false
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        
        localStreamRef.current = stream;
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.muted = true;
        }

      } catch (error) {
        console.error('Error accessing media devices:', error);
        setStreamError('Could not access camera/microphone. Please check permissions.');
        setCameraOn(false);
        setMicOn(false);
      }
    };

    initLocalStream();
  }, []);

  // ============ MEETING TIMER ============
  useEffect(() => {
    const timer = setInterval(() => {
      const elapsed = Date.now() - meetingStartTime;
      const hours = Math.floor(elapsed / 3600000);
      const minutes = Math.floor((elapsed % 3600000) / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      
      setMeetingTime(
        hours > 0 
          ? `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
          : `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      );
    }, 1000);

    return () => clearInterval(timer);
  }, [meetingStartTime]);

  // ============ AUTO SCROLL CHAT ============
  useEffect(() => {
    if (chatEndRef.current && showChat) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, showChat]);

  // ============ TOGGLE MEDIA FUNCTIONS ============
  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicOn(audioTrack.enabled);
        
        socketRef.current?.emit('media-state-changed', {
          meetingId,
          userId,
          audioEnabled: audioTrack.enabled,
          videoEnabled: cameraOn
        });
      }
    }
  };

  const toggleCamera = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setCameraOn(videoTrack.enabled);
        
        socketRef.current?.emit('media-state-changed', {
          meetingId,
          userId,
          audioEnabled: micOn,
          videoEnabled: videoTrack.enabled
        });
      }
    }
  };

  // ============ SCREEN SHARING ============
  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            cursor: 'always',
            displaySurface: 'monitor'
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true
          }
        });
        
        screenStreamRef.current = stream;
        
        // Replace video track with screen share
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        
        setIsScreenSharing(true);
        setLayoutMode('speaker');
        
        stream.getVideoTracks()[0].onended = () => {
          stopScreenShare();
        };
        
        socketRef.current?.emit('screen-share-started', {
          meetingId,
          userId
        });
      } else {
        stopScreenShare();
      }
    } catch (error) {
      console.error('Screen sharing error:', error);
    }
  };

  const stopScreenShare = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
      screenStreamRef.current = null;
    }
    
    if (localStreamRef.current && localVideoRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
    
    setIsScreenSharing(false);
    
    socketRef.current?.emit('screen-share-stopped', {
      meetingId,
      userId
    });
  };

  // ============ CHAT FUNCTIONS ============
  const sendChatMessage = (e) => {
    e.preventDefault();
    if (!chatMessage.trim()) return;

    const message = {
      id: Date.now().toString(),
      userId,
      userName,
      text: chatMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: 'chat'
    };

    socketRef.current?.emit('chat-message', {
      meetingId,
      message
    });

    setMessages(prev => [...prev, message]);
    setChatMessage('');
  };

  // ============ COPY MEETING LINK ============
  const copyMeetingLink = () => {
    navigator.clipboard.writeText(meetingLink);
    setLinkCopied(true);
    
    setMessages(prev => [...prev, {
      id: `link-copied-${Date.now()}`,
      type: 'system',
      text: 'Meeting link copied to clipboard!',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
    
    setTimeout(() => setLinkCopied(false), 3000);
  };

  // ============ FULLSCREEN TOGGLE ============
  const toggleFullscreen = () => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
    setIsFullscreen(!isFullscreen);
  };

  // ============ RECORDING FUNCTIONS (Teacher only) ============
  const startRecording = () => {
    if (role !== 'teacher') return;
    
    const stream = isScreenSharing && screenStreamRef.current 
      ? screenStreamRef.current 
      : localStreamRef.current;
      
    if (!stream) return;
    
    recordedChunksRef.current = [];
    
    try {
      const options = { mimeType: 'video/webm;codecs=vp9,opus' };
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const fileName = `Meeting_${meetingTopic}_${new Date().toISOString().replace(/[:.]/g, '-')}.webm`;
        
        // Auto download
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        
        setShowRecordingComplete(true);
        setTimeout(() => setShowRecordingComplete(false), 5000);
      };
      
      mediaRecorder.start(1000);
      setIsRecordingActive(true);
      
      const startTime = Date.now();
      recordingTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        setRecordingTime(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }, 1000);
      
    } catch (error) {
      console.error('Recording error:', error);
      alert('Failed to start recording. Please try again.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecordingActive) {
      mediaRecorderRef.current.stop();
      setIsRecordingActive(false);
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      setRecordingTime('00:00');
    }
  };

  // ============ LEAVE MEETING OPTIONS ============
  const leaveMeetingOnly = () => {
    if (isRecordingActive && role === 'teacher') {
      stopRecording();
    }
    
    // Record leave time for attendance
    const attendance = JSON.parse(localStorage.getItem(`attendance_${meetingId}`) || '[]');
    const updatedAttendance = attendance.map(record => 
      record.userId === userId && !record.leftAt
        ? { ...record, leftAt: new Date().toISOString() }
        : record
    );
    localStorage.setItem(`attendance_${meetingId}`, JSON.stringify(updatedAttendance));
    
    if (role === 'teacher') {
      navigate('/teacher/dashboard');
    } else {
      navigate('/student/dashboard');
    }
  };

  const endMeetingForAll = () => {
    if (role !== 'teacher') return;
    
    socketRef.current?.emit('end-meeting', { meetingId });
    
    if (isRecordingActive) {
      stopRecording();
    }
    
    navigate('/teacher/dashboard');
  };

  // ============ SIDEBAR TOGGLE FUNCTIONS ============
  const toggleParticipants = () => {
    setShowParticipants(!showParticipants);
    setShowChat(false);
    setShowBreakoutRooms(false);
    setShowWhiteboard(false);
  };

  const toggleChat = () => {
    setShowChat(!showChat);
    setShowParticipants(false);
    setShowBreakoutRooms(false);
    setShowWhiteboard(false);
    if (!showChat) setUnreadMessages(0);
  };

  const toggleBreakoutRooms = () => {
    setShowBreakoutRooms(!showBreakoutRooms);
    setShowParticipants(false);
    setShowChat(false);
    setShowWhiteboard(false);
  };

  const toggleWhiteboard = () => {
    setShowWhiteboard(!showWhiteboard);
    setShowParticipants(false);
    setShowChat(false);
    setShowBreakoutRooms(false);
  };

  // ============ MUTE PARTICIPANT (Teacher only) ============
  const muteParticipant = (participantId) => {
    if (role !== 'teacher') return;
    
    socketRef.current?.emit('mute-participant', {
      meetingId,
      userId: participantId
    });
  };

  const muteAllParticipants = () => {
    if (role !== 'teacher') return;
    
    participants.forEach(participant => {
      if (participant.role !== 'teacher') {
        muteParticipant(participant.userId);
      }
    });
  };

  // ============ RENDER ============
  const totalParticipants = participants.length + 1;

  return (
    <div className="meeting-room">
      {/* ============ HEADER ============ */}
      <header className="meeting-header">
        <div className="header-left">
          <div className="meeting-info">
            <h2 className="meeting-title">{meetingTopic}</h2>
            <div className="meeting-details">
              <span className="meeting-time">
                <Clock size={14} />
                {meetingTime}
              </span>
              {isRecordingActive && (
                <span className="recording-status">
                  <Circle size={8} fill="#ea4335" color="#ea4335" />
                  REC {recordingTime}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="header-center">
          <div className="participant-count-badge">
            <Users size={16} />
            <span>{totalParticipants}</span>
          </div>
        </div>

        <div className="header-right">
          <button 
            className={`icon-btn ${linkCopied ? 'active' : ''}`}
            onClick={copyMeetingLink} 
            title="Copy meeting link"
          >
            <Share2 size={18} />
          </button>
          <button 
            className="icon-btn" 
            onClick={toggleFullscreen} 
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        </div>
      </header>

      {/* ============ MAIN CONTENT ============ */}
      <main className="meeting-main">
        <div className={`video-grid-area ${showParticipants || showChat || showBreakoutRooms || showWhiteboard ? 'sidebar-open' : 'sidebar-closed'}`}>
          <div className="video-grid-container">
            <div className={`video-grid ${layoutMode} ${isScreenSharing ? 'screen-sharing' : ''}`}>
              {/* Local Video */}
              <div className={`video-tile local ${isScreenSharing ? 'screen-sharing-active' : ''}`}>
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="video-element"
                />
                {!cameraOn && (
                  <div className="video-placeholder">
                    <div className="avatar-large">
                      {userName?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  </div>
                )}
                <div className="video-overlay">
                  <div className="video-info">
                    <span className="user-name">
                      {userName} (You)
                    </span>
                    <div className="media-status">
                      {!micOn && <MicOff size={14} />}
                      {!cameraOn && <VideoOff size={14} />}
                      {role === 'teacher' && <span className="role-badge teacher">Host</span>}
                    </div>
                  </div>
                  {isScreenSharing && (
                    <div className="screen-sharing-label">
                      <ScreenShare size={12} />
                      Sharing Screen
                    </div>
                  )}
                </div>
              </div>

              {/* Remote Participants */}
              {participants.map((participant) => (
                <div 
                  key={participant.userId} 
                  className={`video-tile remote ${participant.isScreenSharing ? 'screen-sharing-active' : ''}`}
                >
                  <div className={`video-placeholder ${!participant.videoEnabled ? 'visible' : 'hidden'}`}>
                    <div className="avatar-large">
                      {participant.userName?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  </div>
                  <div className="video-overlay">
                    <div className="video-info">
                      <span className="user-name">
                        {participant.userName}
                      </span>
                      <div className="media-status">
                        {!participant.audioEnabled && <MicOff size={14} />}
                        {participant.role === 'teacher' && <span className="role-badge teacher">Host</span>}
                      </div>
                    </div>
                    {participant.isScreenSharing && (
                      <div className="screen-sharing-label">
                        <ScreenShare size={12} />
                        Sharing
                      </div>
                    )}
                  </div>
                  {role === 'teacher' && participant.role !== 'teacher' && (
                    <button 
                      className="mute-participant-btn"
                      onClick={() => muteParticipant(participant.userId)}
                      title="Mute participant"
                    >
                      <VolumeX size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ============ PARTICIPANTS SIDEBAR (1/4 Screen) ============ */}
        {showParticipants && (
          <div className="participants-sidebar">
            <div className="sidebar-header">
              <h3>
                <Users size={18} />
                Participants ({totalParticipants})
              </h3>
              <button className="close-sidebar-btn" onClick={toggleParticipants}>
                <X size={16} />
              </button>
            </div>
            
            <div className="sidebar-content">
              <div className="participants-list">
                {/* Current User */}
                <div className="participant-item current">
                  <div className="participant-avatar">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                  <div className="participant-info">
                    <span className="participant-name">
                      {userName} (You)
                      {role === 'teacher' && <span className="role-tag host">Host</span>}
                    </span>
                    <span className="participant-status">
                      {micOn ? 'Mic on' : 'Muted'} • {cameraOn ? 'Camera on' : 'Camera off'}
                    </span>
                  </div>
                  <div className="participant-icons">
                    {micOn ? <Mic size={14} /> : <MicOff size={14} />}
                    {cameraOn ? <Video size={14} /> : <VideoOff size={14} />}
                  </div>
                </div>
                
                {/* Other Participants */}
                {participants.map(participant => (
                  <div key={participant.userId} className="participant-item">
                    <div className="participant-avatar">
                      {participant.userName?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div className="participant-info">
                      <span className="participant-name">
                        {participant.userName}
                        {participant.role === 'teacher' && <span className="role-tag host">Host</span>}
                      </span>
                      <span className="participant-status">
                        {participant.audioEnabled ? 'Mic on' : 'Muted'}
                      </span>
                    </div>
                    <div className="participant-icons">
                      {participant.audioEnabled ? <Mic size={14} /> : <MicOff size={14} />}
                      {participant.videoEnabled ? <Video size={14} /> : <VideoOff size={14} />}
                    </div>
                    {role === 'teacher' && participant.role !== 'teacher' && (
                      <button 
                        className="mute-btn-small"
                        onClick={() => muteParticipant(participant.userId)}
                        title="Mute"
                      >
                        <VolumeX size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Teacher Controls in Participants Sidebar */}
              {role === 'teacher' && participants.length > 0 && (
                <div className="participant-controls-section">
                  <button className="mute-all-btn" onClick={muteAllParticipants}>
                    <VolumeX size={14} />
                    Mute All
                  </button>
                </div>
              )}

              {/* Attendance Tracker */}
              <div className="attendance-mini">
                <AttendanceTracker 
                  meetingId={meetingId}
                  userId={userId}
                  userName={userName}
                  role={role}
                  participants={participants}
                />
              </div>
            </div>
          </div>
        )}

        {/* ============ CHAT SIDEBAR (1/4 Screen) ============ */}
        {showChat && (
          <div className="chat-sidebar">
            <div className="sidebar-header">
              <h3>
                <MessageSquare size={18} />
                Chat
              </h3>
              <button className="close-sidebar-btn" onClick={toggleChat}>
                <X size={16} />
              </button>
            </div>
            
            <div className="chat-messages-container">
              <div className="chat-messages">
                {messages.map((message) => (
                  <div 
                    key={message.id} 
                    className={`message ${message.type} ${message.userId === userId ? 'sent' : ''}`}
                  >
                    {message.type === 'chat' && message.userId !== userId && (
                      <div className="message-sender">{message.userName}</div>
                    )}
                    <div className="message-content">{message.text}</div>
                    <div className="message-time">{message.timestamp}</div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
            </div>
            
            <div className="chat-input-area">
              <form onSubmit={sendChatMessage} className="chat-input-form">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  placeholder="Type a message..."
                  autoComplete="off"
                />
                <button type="submit" className="send-btn" disabled={!chatMessage.trim()}>
                  <Send size={16} />
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ============ BREAKOUT ROOMS SIDEBAR ============ */}
        {showBreakoutRooms && (
          <div className="breakout-sidebar">
            <div className="sidebar-header">
              <h3>
                <Grid size={18} />
                Breakout Rooms
              </h3>
              <button className="close-sidebar-btn" onClick={toggleBreakoutRooms}>
                <X size={16} />
              </button>
            </div>
            <div className="sidebar-content">
              <BreakoutRoom 
                meetingId={meetingId}
                userId={userId}
                userName={userName}
                role={role}
                participants={participants}
                socket={socketRef.current}
              />
            </div>
          </div>
        )}

        {/* ============ WHITEBOARD SIDEBAR ============ */}
        {showWhiteboard && (
          <div className="whiteboard-sidebar">
            <div className="sidebar-header">
              <h3>
                <PenTool size={18} />
                Whiteboard
              </h3>
              <button className="close-sidebar-btn" onClick={toggleWhiteboard}>
                <X size={16} />
              </button>
            </div>
            <div className="sidebar-content whiteboard-content">
              <Whiteboard 
                meetingId={meetingId}
                userId={userId}
                userName={userName}
                role={role}
                socket={socketRef.current}
              />
            </div>
          </div>
        )}

        {/* ============ LAYOUT CONTROLS ============ */}
        <div className="layout-controls">
          <button 
            className={`layout-btn ${layoutMode === 'grid' ? 'active' : ''}`}
            onClick={() => setLayoutMode('grid')}
            title="Grid View"
          >
            <LayoutGrid size={20} />
          </button>
          <button 
            className={`layout-btn ${layoutMode === 'speaker' ? 'active' : ''}`}
            onClick={() => setLayoutMode('speaker')}
            title="Speaker View"
          >
            <LayoutList size={20} />
          </button>
        </div>

        {/* ============ LEAVE MEETING MODAL ============ */}
        {showLeaveOptions && (
          <div className="modal-overlay">
            <div className="leave-modal">
              <h3>Leave Meeting</h3>
              <p className="leave-question">What would you like to do?</p>
              
              <div className="leave-options">
                <button className="leave-option" onClick={leaveMeetingOnly}>
                  <LogOut size={24} />
                  <div className="leave-option-text">
                    <strong>Leave meeting</strong>
                    <span>You can rejoin later</span>
                  </div>
                </button>
                
                {role === 'teacher' && (
                  <button className="leave-option end" onClick={endMeetingForAll}>
                    <X size={24} />
                    <div className="leave-option-text">
                      <strong>End meeting for all</strong>
                      <span>This will close the meeting for everyone</span>
                    </div>
                  </button>
                )}
              </div>
              
              <button className="cancel-btn" onClick={() => setShowLeaveOptions(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ============ RECORDING COMPLETE NOTIFICATION ============ */}
        {showRecordingComplete && (
          <div className="notification success">
            <Check size={16} />
            <span>Recording saved and downloaded!</span>
          </div>
        )}
      </main>

      {/* ============ FOOTER CONTROLS ============ */}
      <footer className="meeting-footer">
        <div className="footer-left">
          <div className="control-group">
            <button 
              className={`control-btn ${!micOn ? 'off' : ''}`}
              onClick={toggleMic}
              title={micOn ? 'Mute microphone' : 'Unmute microphone'}
            >
              {micOn ? <Mic size={22} /> : <MicOff size={22} />}
            </button>
            
            <button 
              className={`control-btn ${!cameraOn ? 'off' : ''}`}
              onClick={toggleCamera}
              title={cameraOn ? 'Turn off camera' : 'Turn on camera'}
            >
              {cameraOn ? <Video size={22} /> : <VideoOff size={22} />}
            </button>
            
            <button 
              className={`control-btn ${isScreenSharing ? 'active sharing' : ''}`}
              onClick={toggleScreenShare}
              title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
            >
              <ScreenShare size={22} />
            </button>
            
            <button 
              className={`control-btn ${showParticipants ? 'active' : ''}`}
              onClick={toggleParticipants}
              title="Participants"
            >
              <Users size={22} />
              {totalParticipants > 0 && (
                <span className="control-badge">{totalParticipants}</span>
              )}
            </button>
          </div>
        </div>

        <div className="footer-center">
          <div className="control-group">
            <button 
              className={`control-btn ${showChat ? 'active' : ''}`}
              onClick={toggleChat}
              title="Chat"
            >
              <MessageSquare size={22} />
              {unreadMessages > 0 && (
                <span className="control-badge">{unreadMessages}</span>
              )}
            </button>
            
            <button 
              className={`control-btn ${showBreakoutRooms ? 'active' : ''}`}
              onClick={toggleBreakoutRooms}
              title="Breakout Rooms"
              disabled={role !== 'teacher' && !showBreakoutRooms}
            >
              <Grid size={22} />
            </button>
            
            {role === 'teacher' && (
              <button 
                className={`control-btn ${isRecordingActive ? 'recording' : ''}`}
                onClick={isRecordingActive ? stopRecording : startRecording}
                title={isRecordingActive ? 'Stop Recording' : 'Start Recording'}
              >
                {isRecordingActive ? <StopCircle size={22} /> : <PlayCircle size={22} />}
                {isRecordingActive && <span className="recording-dot"></span>}
              </button>
            )}
            
            <button 
              className={`control-btn ${showWhiteboard ? 'active' : ''}`}
              onClick={toggleWhiteboard}
              title="Whiteboard"
            >
              <PenTool size={22} />
            </button>
          </div>
        </div>

        <div className="footer-right">
          <button 
            className="leave-btn"
            onClick={() => setShowLeaveOptions(true)}
          >
            <LogOut size={20} />
            <span>Leave</span>
          </button>
        </div>
      </footer>
    </div>
  );
};

export default MeetingRoom;