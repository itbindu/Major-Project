// src/components/MeetingRoom.js
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import {
  Mic, MicOff, Video, VideoOff, Monitor, Users, MessageSquare,
  ScreenShare, LogOut, Copy, Check, Clock, X, VolumeX, Share2,
  Maximize, Minimize, Play, Square
} from 'lucide-react';
import './MeetingRoom.css';

const MeetingRoom = ({ role = 'student' }) => {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  
  // ============ IMPORTANT: YOUR BACKEND URL ON RENDER ============
  const BACKEND_URL = 'https://major-project-1-ngux.onrender.com';
  
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
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  
  // Participants
  const [participants, setParticipants] = useState([]);
  const [showParticipants, setShowParticipants] = useState(false);
  
  // Chat states
  const [showChat, setShowChat] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const chatEndRef = useRef(null);
  
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState('00:00');
  const recordingTimerRef = useRef(null);
  
  // Leave options
  const [showLeaveOptions, setShowLeaveOptions] = useState(false);
  
  // Link sharing
  const [linkCopied, setLinkCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Refs
  const socketRef = useRef(null);
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);

  // ============ INITIALIZE USER ============
  useEffect(() => {
    // Generate unique user ID
    const newUserId = `${role}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setUserId(newUserId);
    
    // Get user name
    if (role === 'teacher') {
      const teacherData = JSON.parse(localStorage.getItem('teacherUser') || '{}');
      const fullName = `${teacherData.firstName || ''} ${teacherData.lastName || ''}`.trim();
      setUserName(fullName || 'Teacher');
    } else {
      const studentName = localStorage.getItem('currentStudentName') || 'Student';
      setUserName(studentName);
    }

    // Set meeting topic
    const storedTopic = localStorage.getItem(`meetingTopic_${meetingId}`) || 'Virtual Classroom';
    setMeetingTopic(storedTopic);

    console.log('Connecting to backend:', BACKEND_URL);
    
    // Initialize socket connection to Render backend
    const socket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 20000,
      withCredentials: true
    });
    
    socketRef.current = socket;

    // Connection event handlers
    socket.on('connect', () => {
      console.log('✅ Connected to server successfully!');
      setConnectionStatus('connected');
      
      // Join meeting room
      socket.emit('join-meeting', {
        meetingId,
        userId: newUserId,
        userName: userName || (role === 'teacher' ? 'Teacher' : 'Student'),
        role
      });
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error);
      setConnectionStatus('error');
    });

    socket.on('disconnect', () => {
      console.log('Disconnected from server');
      setConnectionStatus('disconnected');
    });

    // Get all existing users
    socket.on('all-users', (users) => {
      console.log('All users in meeting:', users);
      setParticipants(users.filter(u => u.userId !== newUserId));
      setParticipantCount(users.length);
    });

    socket.on('user-joined', (user) => {
      console.log('User joined:', user);
      if (user.userId === newUserId) return;
      
      setParticipants(prev => [...prev, user]);
      setParticipantCount(prev => prev + 1);
      
      setMessages(prev => [...prev, {
        id: `system-${Date.now()}`,
        type: 'system',
        text: `${user.userName} joined the meeting`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    });

    socket.on('user-left', (leftUserId) => {
      console.log('User left:', leftUserId);
      setParticipants(prev => prev.filter(p => p.userId !== leftUserId));
      setParticipantCount(prev => prev - 1);
    });

    socket.on('chat-message', (message) => {
      setMessages(prev => [...prev, message]);
      if (!showChat) setUnreadMessages(prev => prev + 1);
    });

    socket.on('media-state-changed', (data) => {
      setParticipants(prev => prev.map(p => 
        p.userId === data.userId 
          ? { ...p, audioEnabled: data.audioEnabled, videoEnabled: data.videoEnabled }
          : p
      ));
    });

    socket.on('meeting-ended', () => {
      alert('The meeting has been ended by the host.');
      navigate(role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard');
    });

    // Track attendance
    trackAttendance(newUserId);

    return () => {
      if (socketRef.current) {
        socketRef.current.emit('leave-meeting', { meetingId, userId: newUserId });
        socketRef.current.disconnect();
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [meetingId, role]);

  // ============ TRACK ATTENDANCE ============
  const trackAttendance = (uid) => {
    const attendanceRecord = {
      userId: uid,
      userName: userName || (role === 'teacher' ? 'Teacher' : 'Student'),
      role,
      joinTime: new Date().toISOString(),
      meetingId,
      meetingTopic
    };
    
    const existingAttendance = JSON.parse(localStorage.getItem(`attendance_${meetingId}`) || '[]');
    localStorage.setItem(`attendance_${meetingId}`, JSON.stringify([...existingAttendance, attendanceRecord]));
  };

  // ============ INITIALIZE LOCAL MEDIA ============
  useEffect(() => {
    const initLocalStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        
        localStreamRef.current = stream;
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing media devices:', error);
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
      const minutes = Math.floor(elapsed / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      setMeetingTime(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(timer);
  }, [meetingStartTime]);

  // ============ MEDIA CONTROLS ============
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
          video: true,
          audio: true
        });
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        
        setIsScreenSharing(true);
        
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
    if (!chatMessage.trim() || connectionStatus !== 'connected') return;

    const message = {
      id: Date.now().toString(),
      userId,
      userName,
      text: chatMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    socketRef.current?.emit('chat-message', { meetingId, message });
    setMessages(prev => [...prev, message]);
    setChatMessage('');
  };

  // ============ AUTO SCROLL CHAT ============
  useEffect(() => {
    if (chatEndRef.current && showChat) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, showChat]);

  // ============ RECORDING FUNCTIONS ============
  const startRecording = () => {
    if (role !== 'teacher') return;
    
    setIsRecording(true);
    const startTime = Date.now();
    
    recordingTimerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const minutes = Math.floor(elapsed / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      setRecordingTime(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);
  };

  const stopRecording = () => {
    if (role !== 'teacher') return;
    
    setIsRecording(false);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
    setRecordingTime('00:00');
  };

  // ============ UI TOGGLE FUNCTIONS ============
  const toggleParticipants = () => {
    setShowParticipants(!showParticipants);
    setShowChat(false);
  };

  const toggleChat = () => {
    setShowChat(!showChat);
    setShowParticipants(false);
    if (!showChat) setUnreadMessages(0);
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
    setIsFullscreen(!isFullscreen);
  };

  const copyMeetingLink = () => {
    const link = `${window.location.origin}/meeting/${meetingId}`;
    navigator.clipboard.writeText(link);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 3000);
  };

  const muteParticipant = (participantId) => {
    if (role !== 'teacher') return;
    socketRef.current?.emit('mute-participant', { meetingId, userId: participantId });
  };

  // ============ LEAVE MEETING FUNCTIONS ============
  const leaveMeetingOnly = () => {
    navigate(role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard');
  };

  const endMeetingForAll = () => {
    if (role !== 'teacher') return;
    socketRef.current?.emit('end-meeting', { meetingId });
    navigate('/teacher/dashboard');
  };

  // ============ RENDER ============
  const totalParticipants = participants.length + 1;

  return (
    <div className="meeting-room">
      {/* Connection Status Banner */}
      {connectionStatus !== 'connected' && (
        <div className={`connection-banner ${connectionStatus}`}>
          {connectionStatus === 'connecting' && '🔄 Connecting to meeting server...'}
          {connectionStatus === 'error' && '❌ Connection failed. Retrying...'}
          {connectionStatus === 'disconnected' && '🔄 Disconnected. Reconnecting...'}
        </div>
      )}

      {/* Header */}
      <header className="meeting-header">
        <div className="header-left">
          <div className="meeting-info">
            <h2 className="meeting-title">{meetingTopic}</h2>
            <span className="meeting-time">
              <Clock size={16} />
              {meetingTime}
            </span>
          </div>
        </div>

        <div className="header-center">
          <div className="participant-count">
            <Users size={18} />
            <span>{totalParticipants}</span>
          </div>
        </div>

        <div className="header-right">
          <button 
            className={`icon-btn ${linkCopied ? 'active' : ''}`}
            onClick={copyMeetingLink}
            title="Copy meeting link"
          >
            {linkCopied ? <Check size={18} /> : <Share2 size={18} />}
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

      {/* Main Content */}
      <main className="meeting-main">
        <div className={`video-section ${showParticipants || showChat ? 'with-sidebar' : 'full-width'}`}>
          <div className="video-grid">
            {/* Local Video */}
            <div className="video-tile local">
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="video-element"
              />
              {!cameraOn && (
                <div className="video-placeholder">
                  <div className="avatar">
                    {userName?.charAt(0).toUpperCase() || 'U'}
                  </div>
                </div>
              )}
              <div className="video-label">
                <span>{userName} {role === 'teacher' ? '(Host)' : ''} (You)</span>
                {!micOn && <MicOff size={14} />}
              </div>
              {isScreenSharing && (
                <div className="sharing-badge">
                  <ScreenShare size={12} />
                  Sharing Screen
                </div>
              )}
            </div>

            {/* Remote Participants */}
            {participants.map((participant) => (
              <div key={participant.userId} className="video-tile remote">
                <div className={`video-placeholder ${!participant.videoEnabled ? 'visible' : 'hidden'}`}>
                  <div className="avatar">
                    {participant.userName?.charAt(0).toUpperCase() || 'U'}
                  </div>
                </div>
                <div className="video-label">
                  <span>{participant.userName}</span>
                  {!participant.audioEnabled && <MicOff size={14} />}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Participants Sidebar */}
        {showParticipants && (
          <div className="sidebar">
            <div className="sidebar-header">
              <h3>
                <Users size={18} />
                Participants ({totalParticipants})
              </h3>
              <button className="close-btn" onClick={toggleParticipants}>
                <X size={16} />
              </button>
            </div>
            
            <div className="participants-list">
              {/* Current User */}
              <div className="participant-item current">
                <div className="participant-avatar">
                  {userName.charAt(0).toUpperCase()}
                </div>
                <div className="participant-info">
                  <span className="participant-name">
                    {userName} (You)
                    {role === 'teacher' && <span className="host-badge">Host</span>}
                  </span>
                  <span className="participant-status">
                    {micOn ? 'Mic on' : 'Muted'} • {cameraOn ? 'Camera on' : 'Camera off'}
                  </span>
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
                      {participant.role === 'teacher' && <span className="host-badge">Host</span>}
                    </span>
                    <span className="participant-status">
                      {participant.audioEnabled ? 'Mic on' : 'Muted'}
                    </span>
                  </div>
                  {role === 'teacher' && participant.role !== 'teacher' && (
                    <button 
                      className="mute-btn"
                      onClick={() => muteParticipant(participant.userId)}
                      title="Mute"
                    >
                      <VolumeX size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Chat Sidebar */}
        {showChat && (
          <div className="sidebar">
            <div className="sidebar-header">
              <h3>
                <MessageSquare size={18} />
                Chat
              </h3>
              <button className="close-btn" onClick={toggleChat}>
                <X size={16} />
              </button>
            </div>
            
            <div className="chat-messages">
              {messages.map((message) => (
                <div 
                  key={message.id} 
                  className={`message ${message.userId === userId ? 'sent' : 'received'} ${message.type === 'system' ? 'system' : ''}`}
                >
                  {message.type !== 'system' && message.userId !== userId && (
                    <div className="message-sender">{message.userName}</div>
                  )}
                  <div className="message-content">{message.text}</div>
                  <div className="message-time">{message.timestamp}</div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            
            <form onSubmit={sendChatMessage} className="chat-input">
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder={connectionStatus === 'connected' ? "Type a message..." : "Connecting..."}
                disabled={connectionStatus !== 'connected'}
              />
              <button 
                type="submit" 
                disabled={!chatMessage.trim() || connectionStatus !== 'connected'}
              >
                Send
              </button>
            </form>
          </div>
        )}

        {/* Leave Meeting Modal */}
        {showLeaveOptions && (
          <div className="modal-overlay">
            <div className="leave-modal">
              <h3>Leave Meeting</h3>
              
              <button className="leave-option" onClick={leaveMeetingOnly}>
                <LogOut size={20} />
                <div>
                  <strong>Leave meeting</strong>
                  <span>You can rejoin later</span>
                </div>
              </button>
              
              {role === 'teacher' && (
                <button className="leave-option end" onClick={endMeetingForAll}>
                  <X size={20} />
                  <div>
                    <strong>End meeting for all</strong>
                    <span>This will close the meeting for everyone</span>
                  </div>
                </button>
              )}
              
              <button className="cancel-btn" onClick={() => setShowLeaveOptions(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="meeting-footer">
        <div className="footer-left">
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
            className={`control-btn ${isScreenSharing ? 'active' : ''}`}
            onClick={toggleScreenShare}
            title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
          >
            <Monitor size={22} />
          </button>
          
          <button 
            className={`control-btn ${showParticipants ? 'active' : ''}`}
            onClick={toggleParticipants}
            title="Participants"
          >
            <Users size={22} />
            {totalParticipants > 0 && (
              <span className="badge">{totalParticipants}</span>
            )}
          </button>
        </div>

        <div className="footer-center">
          <button 
            className={`control-btn ${showChat ? 'active' : ''}`}
            onClick={toggleChat}
            title="Chat"
          >
            <MessageSquare size={22} />
            {unreadMessages > 0 && (
              <span className="badge">{unreadMessages}</span>
            )}
          </button>
          
          {role === 'teacher' && (
            <button 
              className={`control-btn ${isRecording ? 'recording' : ''}`}
              onClick={isRecording ? stopRecording : startRecording}
              title={isRecording ? 'Stop Recording' : 'Start Recording'}
            >
              {isRecording ? <Square size={22} /> : <Play size={22} />}
            </button>
          )}
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