// src/components/MeetingRoom.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import {
  Mic, MicOff, Video, VideoOff, Monitor, Users, MessageSquare, Grid,
  PenTool, ScreenShare, LogOut, Copy, Check, Clock, X, VolumeX, Share2,
  Maximize, Minimize, Play, Square, User
} from 'lucide-react';
import './MeetingRoom.css';

// STUN servers for WebRTC
const configuration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' }
  ]
};

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
  
  // Breakout Room states
  const [showBreakoutRooms, setShowBreakoutRooms] = useState(false);
  const [breakoutRooms, setBreakoutRooms] = useState([]);
  const [inBreakoutRoom, setInBreakoutRoom] = useState(false);
  const [currentBreakoutRoom, setCurrentBreakoutRoom] = useState(null);
  
  // Whiteboard states
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  
  // Leave options
  const [showLeaveOptions, setShowLeaveOptions] = useState(false);
  
  // Link sharing
  const [linkCopied, setLinkCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // WebRTC Refs
  const socketRef = useRef(null);
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const peerConnections = useRef({});
  const remoteVideoRefs = useRef({});

  // ============ INITIALIZE USER ============
  useEffect(() => {
    // Generate unique user ID
    const newUserId = `${role}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setUserId(newUserId);
    
    // Get user name from localStorage
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

    // Initialize socket connection
    const socket = io('http://localhost:5000', {
      transports: ['websocket'],
      reconnection: true
    });
    socketRef.current = socket;

    // Join meeting room
    socket.emit('join-meeting', {
      meetingId,
      userId: newUserId,
      userName: userName || (role === 'teacher' ? 'Teacher' : 'Student'),
      role
    });

    // Socket event listeners
    socket.on('all-users', (users) => {
      console.log('All users in meeting:', users);
      setParticipants(users.filter(u => u.userId !== newUserId));
      setParticipantCount(users.length);
      
      // Create peer connections for all existing users
      setTimeout(() => {
        users.forEach(user => {
          if (user.userId !== newUserId && !peerConnections.current[user.userId]) {
            createPeerConnection(user.userId);
          }
        });
      }, 1000);
    });

    socket.on('user-joined', (user) => {
      console.log('User joined:', user);
      if (user.userId === newUserId) return;
      
      setParticipants(prev => [...prev, user]);
      setParticipantCount(prev => prev + 1);

      // Create peer connection for new user
      if (!peerConnections.current[user.userId]) {
        createPeerConnection(user.userId);
      }
    });

    socket.on('receive-offer', handleReceiveOffer);
    socket.on('receive-answer', handleReceiveAnswer);
    socket.on('receive-ice-candidate', handleReceiveICECandidate);
    
    socket.on('user-left', (leftUserId) => {
      console.log('User left:', leftUserId);
      
      if (peerConnections.current[leftUserId]) {
        peerConnections.current[leftUserId].close();
        delete peerConnections.current[leftUserId];
      }
      
      if (remoteVideoRefs.current[leftUserId]) {
        delete remoteVideoRefs.current[leftUserId];
      }
      
      setParticipants(prev => prev.filter(p => p.userId !== leftUserId));
      setParticipantCount(prev => prev - 1);
      
      updateAttendanceOnLeave(leftUserId);
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

    socket.on('screen-share-started', (data) => {
      setParticipants(prev => prev.map(p => 
        p.userId === data.userId ? { ...p, isScreenSharing: true } : p
      ));
    });

    socket.on('screen-share-stopped', (data) => {
      setParticipants(prev => prev.map(p => 
        p.userId === data.userId ? { ...p, isScreenSharing: false } : p
      ));
    });

    socket.on('meeting-ended', () => {
      alert('The meeting has been ended by the host.');
      navigate(role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard');
    });

    // Track attendance
    trackAttendance(newUserId);

    return () => {
      // Clean up all peer connections
      Object.values(peerConnections.current).forEach(pc => {
        if (pc) pc.close();
      });
      
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      if (socketRef.current) {
        socketRef.current.emit('leave-meeting', { meetingId, userId: newUserId });
        socketRef.current.disconnect();
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

  const updateAttendanceOnLeave = (leftUserId) => {
    const attendance = JSON.parse(localStorage.getItem(`attendance_${meetingId}`) || '[]');
    const updated = attendance.map(record => 
      record.userId === leftUserId && !record.leaveTime
        ? { ...record, leaveTime: new Date().toISOString() }
        : record
    );
    localStorage.setItem(`attendance_${meetingId}`, JSON.stringify(updated));
  };

  // ============ INITIALIZE LOCAL MEDIA ============
  useEffect(() => {
    const initLocalStream = async () => {
      try {
        setStreamError('');
        
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true
          }
        });
        
        localStreamRef.current = stream;
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

      } catch (error) {
        console.error('Error accessing media devices:', error);
        setStreamError('Could not access camera/microphone');
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

  // ============ WEBRTC FUNCTIONS ============
  const createPeerConnection = (targetUserId) => {
    console.log('Creating peer connection for:', targetUserId);
    
    const pc = new RTCPeerConnection(configuration);
    peerConnections.current[targetUserId] = pc;

    // Add local stream tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit('send-ice-candidate', {
          meetingId,
          targetUserId,
          candidate: event.candidate
        });
      }
    };

    // Handle incoming tracks
    pc.ontrack = (event) => {
      console.log('Received track from:', targetUserId);
      const [remoteStream] = event.streams;
      
      // Create video element for this peer
      const videoId = `remote-video-${targetUserId}`;
      let videoElement = document.getElementById(videoId);
      
      if (!videoElement) {
        videoElement = document.createElement('video');
        videoElement.id = videoId;
        videoElement.autoplay = true;
        videoElement.playsInline = true;
        videoElement.className = 'remote-video';
        
        const tile = document.getElementById(`tile-${targetUserId}`);
        if (tile) {
          tile.appendChild(videoElement);
        }
      }
      
      videoElement.srcObject = remoteStream;
      remoteVideoRefs.current[targetUserId] = videoElement;
    };

    // Create and send offer
    pc.createOffer()
      .then(offer => pc.setLocalDescription(offer))
      .then(() => {
        socketRef.current.emit('send-offer', {
          meetingId,
          targetUserId,
          offer: pc.localDescription
        });
      })
      .catch(error => console.error('Error creating offer:', error));

    return pc;
  };

  const handleReceiveOffer = async ({ fromUserId, offer }) => {
    console.log('Received offer from:', fromUserId);
    
    if (!peerConnections.current[fromUserId]) {
      const pc = new RTCPeerConnection(configuration);
      peerConnections.current[fromUserId] = pc;

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          pc.addTrack(track, localStreamRef.current);
        });
      }

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socketRef.current.emit('send-ice-candidate', {
            meetingId,
            targetUserId: fromUserId,
            candidate: event.candidate
          });
        }
      };

      pc.ontrack = (event) => {
        console.log('Received track from:', fromUserId);
        const [remoteStream] = event.streams;
        
        const videoId = `remote-video-${fromUserId}`;
        let videoElement = document.getElementById(videoId);
        
        if (!videoElement) {
          videoElement = document.createElement('video');
          videoElement.id = videoId;
          videoElement.autoplay = true;
          videoElement.playsInline = true;
          videoElement.className = 'remote-video';
          
          const tile = document.getElementById(`tile-${fromUserId}`);
          if (tile) {
            tile.appendChild(videoElement);
          }
        }
        
        videoElement.srcObject = remoteStream;
        remoteVideoRefs.current[fromUserId] = videoElement;
      };
    }

    const pc = peerConnections.current[fromUserId];

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socketRef.current.emit('send-answer', {
        meetingId,
        targetUserId: fromUserId,
        answer: pc.localDescription
      });
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  };

  const handleReceiveAnswer = async ({ fromUserId, answer }) => {
    console.log('Received answer from:', fromUserId);
    
    const pc = peerConnections.current[fromUserId];
    if (pc) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (error) {
        console.error('Error handling answer:', error);
      }
    }
  };

  const handleReceiveICECandidate = async ({ fromUserId, candidate }) => {
    console.log('Received ICE candidate from:', fromUserId);
    
    const pc = peerConnections.current[fromUserId];
    if (pc) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    }
  };

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
        
        screenStreamRef.current = stream;
        
        // Replace video track in all peer connections
        const videoTrack = stream.getVideoTracks()[0];
        
        Object.values(peerConnections.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(videoTrack);
          }
        });
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        
        setIsScreenSharing(true);
        
        videoTrack.onended = stopScreenShare;
        
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
    
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      
      Object.values(peerConnections.current).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender && videoTrack) {
          sender.replaceTrack(videoTrack);
        }
      });
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current;
      }
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
    if (role === 'teacher') {
      setShowBreakoutRooms(!showBreakoutRooms);
      setShowParticipants(false);
      setShowChat(false);
      setShowWhiteboard(false);
    }
  };

  const toggleWhiteboard = () => {
    setShowWhiteboard(!showWhiteboard);
    setShowParticipants(false);
    setShowChat(false);
    setShowBreakoutRooms(false);
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

  const muteAllParticipants = () => {
    if (role !== 'teacher') return;
    participants.forEach(p => {
      if (p.role !== 'teacher') muteParticipant(p.userId);
    });
  };

  // ============ LEAVE MEETING FUNCTIONS ============
  const leaveMeetingOnly = () => {
    updateAttendanceOnLeave(userId);
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
      {/* ============ HEADER ============ */}
      <header className="meeting-header">
        <div className="header-left">
          <div className="meeting-info">
            <h2 className="meeting-title">
              {inBreakoutRoom ? currentBreakoutRoom?.name : meetingTopic}
            </h2>
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

      {/* ============ MAIN CONTENT ============ */}
      <main className="meeting-main">
        <div className={`video-section ${
          showParticipants || showChat || showBreakoutRooms || showWhiteboard 
            ? 'with-sidebar' 
            : 'full-width'
        }`}>
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
                <span>{userName} {role === 'teacher' ? '(Host)' : ''}</span>
                {!micOn && <MicOff size={14} />}
              </div>
              {isScreenSharing && (
                <div className="sharing-badge">
                  <ScreenShare size={12} />
                  Sharing
                </div>
              )}
            </div>

            {/* Remote Participants */}
            {participants.map((participant) => (
              <div 
                key={participant.userId}
                id={`tile-${participant.userId}`}
                className="video-tile remote"
              >
                <div className={`video-placeholder ${!participant.videoEnabled ? 'visible' : 'hidden'}`}>
                  <div className="avatar">
                    {participant.userName?.charAt(0).toUpperCase() || 'U'}
                  </div>
                </div>
                <div className="video-label">
                  <span>{participant.userName}</span>
                  {!participant.audioEnabled && <MicOff size={14} />}
                </div>
                {participant.isScreenSharing && (
                  <div className="sharing-badge">
                    <ScreenShare size={12} />
                    Sharing
                  </div>
                )}
                {role === 'teacher' && participant.role !== 'teacher' && (
                  <button 
                    className="mute-btn-overlay"
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

        {/* ============ PARTICIPANTS SIDEBAR ============ */}
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

            {role === 'teacher' && participants.length > 0 && (
              <button className="mute-all-btn" onClick={muteAllParticipants}>
                <VolumeX size={14} />
                Mute All
              </button>
            )}
          </div>
        )}

        {/* ============ CHAT SIDEBAR ============ */}
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
                  className={`message ${message.userId === userId ? 'sent' : 'received'}`}
                >
                  {message.userId !== userId && (
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
                placeholder="Type a message..."
              />
              <button type="submit" disabled={!chatMessage.trim()}>
                Send
              </button>
            </form>
          </div>
        )}

        {/* ============ BREAKOUT ROOMS SIDEBAR ============ */}
        {showBreakoutRooms && role === 'teacher' && (
          <div className="sidebar">
            <div className="sidebar-header">
              <h3>
                <Grid size={18} />
                Breakout Rooms
              </h3>
              <button className="close-btn" onClick={toggleBreakoutRooms}>
                <X size={16} />
              </button>
            </div>
            
            <div className="breakout-content">
              <button className="create-room-btn" onClick={() => {
                const name = prompt('Enter room name:');
                if (name) {
                  const newRoom = {
                    id: `room_${Date.now()}`,
                    name,
                    teacher: userName,
                    students: []
                  };
                  setBreakoutRooms([...breakoutRooms, newRoom]);
                  socketRef.current?.emit('create-breakout-room', { meetingId, room: newRoom });
                }
              }}>
                + Create Room
              </button>
              
              <div className="rooms-list">
                {breakoutRooms.map(room => (
                  <div key={room.id} className="room-item">
                    <div>
                      <h4>{room.name}</h4>
                      <p>Teacher: {room.teacher}</p>
                    </div>
                    <button onClick={() => {
                      socketRef.current?.emit('join-breakout-room', {
                        meetingId,
                        roomId: room.id,
                        userId,
                        userName,
                        role
                      });
                      setInBreakoutRoom(true);
                      setCurrentBreakoutRoom(room);
                    }}>
                      Join
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ============ WHITEBOARD SIDEBAR ============ */}
        {showWhiteboard && (
          <div className="sidebar whiteboard">
            <div className="sidebar-header">
              <h3>
                <PenTool size={18} />
                Whiteboard
              </h3>
              <button className="close-btn" onClick={toggleWhiteboard}>
                <X size={16} />
              </button>
            </div>
            
            <div className="whiteboard-toolbar">
              <button className="tool-btn active">Pen</button>
              <button className="tool-btn">Eraser</button>
              <input type="color" defaultValue="#000000" />
              <button className="tool-btn">Clear</button>
            </div>
            
            <div className="whiteboard-canvas">
              <canvas />
            </div>
          </div>
        )}

        {/* ============ BREAKOUT ROOM CONTROLS ============ */}
        {inBreakoutRoom && (
          <div className="breakout-controls">
            <button className="leave-breakout-btn" onClick={() => {
              socketRef.current?.emit('leave-breakout-room', {
                meetingId,
                userId,
                roomId: currentBreakoutRoom?.id
              });
              setInBreakoutRoom(false);
              setCurrentBreakoutRoom(null);
            }}>
              Leave Breakout Room
            </button>
          </div>
        )}

        {/* ============ LEAVE MEETING MODAL ============ */}
        {showLeaveOptions && (
          <div className="modal-overlay">
            <div className="leave-modal">
              <h3>Leave Meeting</h3>
              
              <button className="leave-option" onClick={leaveMeetingOnly}>
                <LogOut size={20} />
                Leave meeting
                <span>You can rejoin later</span>
              </button>
              
              {role === 'teacher' && (
                <button className="leave-option end" onClick={endMeetingForAll}>
                  <X size={20} />
                  End meeting for all
                  <span>This will close the meeting for everyone</span>
                </button>
              )}
              
              <button className="cancel-btn" onClick={() => setShowLeaveOptions(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </main>

      {/* ============ FOOTER CONTROLS ============ */}
      <footer className="meeting-footer">
        <div className="footer-left">
          <button 
            className={`control-btn ${!micOn ? 'off' : ''}`}
            onClick={toggleMic}
            title={micOn ? 'Mute' : 'Unmute'}
          >
            {micOn ? <Mic size={22} /> : <MicOff size={22} />}
          </button>
          
          <button 
            className={`control-btn ${!cameraOn ? 'off' : ''}`}
            onClick={toggleCamera}
            title={cameraOn ? 'Stop video' : 'Start video'}
          >
            {cameraOn ? <Video size={22} /> : <VideoOff size={22} />}
          </button>
          
          <button 
            className={`control-btn ${isScreenSharing ? 'active' : ''}`}
            onClick={toggleScreenShare}
            title="Share screen"
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
              className={`control-btn ${showBreakoutRooms ? 'active' : ''}`}
              onClick={toggleBreakoutRooms}
              title="Breakout Rooms"
            >
              <Grid size={22} />
            </button>
          )}
          
          {role === 'teacher' && (
            <button 
              className={`control-btn ${isRecording ? 'recording' : ''}`}
              onClick={isRecording ? stopRecording : startRecording}
              title={isRecording ? 'Stop Recording' : 'Start Recording'}
            >
              {isRecording ? <Square size={22} /> : <Play size={22} />}
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