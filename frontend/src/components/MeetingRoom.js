// src/components/MeetingRoom.js
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import {
  Mic, MicOff, Video, VideoOff, Monitor, Users, MessageSquare,
  ScreenShare, LogOut, Copy, Check, Clock, X, VolumeX, Share2,
  Maximize, Minimize, StopCircle
} from 'lucide-react';
import './MeetingRoom.css';

const MeetingRoom = ({ role = 'student' }) => {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  
  // ============ USE ENVIRONMENT VARIABLE ============
  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://major-project-1-ngux.onrender.com';
  
  // ============ STATES ============
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
  const [screenShareAvailable, setScreenShareAvailable] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  
  // Participants
  const [participants, setParticipants] = useState([]);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  
  // UI states
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showLeaveOptions, setShowLeaveOptions] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [screenShareParticipant, setScreenShareParticipant] = useState(null);
  
  // Refs
  const socketRef = useRef(null);
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const screenVideoRef = useRef(null);
  const chatEndRef = useRef(null);
  const peerConnections = useRef({});
  const screenPeerConnections = useRef({});

  // STUN Servers
  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' }
    ]
  };

  // ============ INITIALIZE ============
  useEffect(() => {
    const newUserId = `${role}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    setUserId(newUserId);
    
    if (role === 'teacher') {
      const teacherData = JSON.parse(localStorage.getItem('teacherUser') || '{}');
      const fullName = `${teacherData.firstName || ''} ${teacherData.lastName || ''}`.trim();
      setUserName(fullName || 'Teacher');
    } else {
      const studentName = localStorage.getItem('currentStudentName') || 'Student';
      setUserName(studentName);
    }

    const storedTopic = localStorage.getItem(`meetingTopic_${meetingId}`) || 'Virtual Classroom';
    setMeetingTopic(storedTopic);

    console.log('🔄 Connecting to:', BACKEND_URL);
    
    const socket = io(BACKEND_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      timeout: 20000,
      withCredentials: true
    });
    
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('✅ Connected to server');
      setConnectionStatus('connected');
      
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

    socket.on('all-users', (users) => {
      console.log('👥 All users:', users);
      setParticipants(users);
      setParticipantCount(users.length + 1);
      
      setTimeout(() => {
        users.forEach(user => {
          if (user.userId !== newUserId && !peerConnections.current[user.userId]) {
            createPeerConnection(user.userId);
          }
        });
      }, 1000);
    });

    socket.on('user-joined', (user) => {
      console.log('👤 User joined:', user);
      if (user.userId === newUserId) return;
      
      setParticipants(prev => [...prev, user]);
      setParticipantCount(prev => prev + 1);
      
      if (!peerConnections.current[user.userId]) {
        createPeerConnection(user.userId);
      }
    });

    socket.on('receive-offer', handleReceiveOffer);
    socket.on('receive-answer', handleReceiveAnswer);
    socket.on('receive-ice-candidate', handleReceiveICECandidate);
    
    // Screen sharing socket events
    socket.on('screen-share-started', ({ userId, userName }) => {
      console.log('📺 Screen sharing started by:', userName);
      setScreenShareParticipant({ userId, userName });
      if (userId !== newUserId) {
        createScreenPeerConnection(userId);
      }
    });

    socket.on('screen-share-stopped', ({ userId }) => {
      console.log('📺 Screen sharing stopped by:', userId);
      if (screenShareParticipant?.userId === userId) {
        setScreenShareParticipant(null);
      }
      if (screenPeerConnections.current[userId]) {
        screenPeerConnections.current[userId].close();
        delete screenPeerConnections.current[userId];
      }
      // Remove screen share video element
      const screenElement = document.getElementById('screen-share-video');
      if (screenElement) {
        screenElement.srcObject = null;
      }
    });

    socket.on('receive-screen-offer', handleReceiveScreenOffer);
    socket.on('receive-screen-answer', handleReceiveScreenAnswer);
    socket.on('receive-screen-ice-candidate', handleReceiveScreenICECandidate);
    
    socket.on('user-left', (leftUserId) => {
      console.log('👋 User left:', leftUserId);
      
      if (peerConnections.current[leftUserId]) {
        peerConnections.current[leftUserId].close();
        delete peerConnections.current[leftUserId];
      }
      
      if (screenPeerConnections.current[leftUserId]) {
        screenPeerConnections.current[leftUserId].close();
        delete screenPeerConnections.current[leftUserId];
      }

      if (screenShareParticipant?.userId === leftUserId) {
        setScreenShareParticipant(null);
      }
      
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
      alert('Meeting ended by host');
      navigate(role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard');
    });

    trackAttendance(newUserId);

    return () => {
      // Clean up all peer connections
      Object.values(peerConnections.current).forEach(pc => pc.close());
      Object.values(screenPeerConnections.current).forEach(pc => pc.close());
      
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
    };
  }, [meetingId, role]);

  // ============ WEBRTC FUNCTIONS ============
  const createPeerConnection = (targetUserId) => {
    console.log('Creating peer connection for:', targetUserId);
    
    const pc = new RTCPeerConnection(configuration);
    peerConnections.current[targetUserId] = pc;

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit('send-ice-candidate', {
          meetingId,
          targetUserId,
          candidate: event.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      console.log('Received track from:', targetUserId);
      const [remoteStream] = event.streams;
      
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
          tile.innerHTML = '';
          tile.appendChild(videoElement);
        }
      }
      
      videoElement.srcObject = remoteStream;
    };

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
            tile.innerHTML = '';
            tile.appendChild(videoElement);
          }
        }
        
        videoElement.srcObject = remoteStream;
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

  // ============ SCREEN SHARING FUNCTIONS ============
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      stopScreenSharing();
    } else {
      try {
        await startScreenSharing();
      } catch (error) {
        console.error('Error starting screen share:', error);
        alert('Could not start screen sharing. Please check permissions.');
      }
    }
  };

  const startScreenSharing = async () => {
    try {
      // Check if screen sharing is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        alert('Screen sharing is not supported in this browser');
        return;
      }

      // Get screen stream
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor'
        },
        audio: false
      });
      
      screenStreamRef.current = screenStream;
      
      // Handle when user stops sharing via browser UI
      screenStream.getVideoTracks()[0].onended = () => {
        stopScreenSharing();
      };

      // Update UI state
      setIsScreenSharing(true);
      setScreenShareParticipant({ userId, userName });
      
      // Notify others that screen sharing started
      socketRef.current.emit('screen-share-started', {
        meetingId,
        userId,
        userName
      });

      // Create screen share peer connections for all existing participants
      participants.forEach(participant => {
        if (participant.userId !== userId) {
          createScreenPeerConnection(participant.userId, screenStream);
        }
      });

      // Display local screen preview
      const screenPreview = document.getElementById('screen-share-preview');
      if (screenPreview) {
        screenPreview.srcObject = screenStream;
      }

      // Listen for track ended (when user stops sharing)
      screenStream.getTracks().forEach(track => {
        track.onended = () => {
          stopScreenSharing();
        };
      });

    } catch (error) {
      console.error('Screen sharing error:', error);
      setScreenShareAvailable(true);
    }
  };

  const stopScreenSharing = () => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      screenStreamRef.current = null;
    }

    setIsScreenSharing(false);
    setScreenShareParticipant(null);

    // Notify others that screen sharing stopped
    socketRef.current.emit('screen-share-stopped', {
      meetingId,
      userId
    });

    // Close all screen share peer connections
    Object.values(screenPeerConnections.current).forEach(pc => pc.close());
    screenPeerConnections.current = {};

    // Clear screen preview
    const screenPreview = document.getElementById('screen-share-preview');
    if (screenPreview) {
      screenPreview.srcObject = null;
    }
  };

  const createScreenPeerConnection = (targetUserId, stream = screenStreamRef.current) => {
    if (!stream) return;

    console.log('Creating screen share connection for:', targetUserId);
    
    const pc = new RTCPeerConnection(configuration);
    screenPeerConnections.current[targetUserId] = pc;

    // Add screen track
    stream.getTracks().forEach(track => {
      pc.addTrack(track, stream);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit('send-screen-ice-candidate', {
          meetingId,
          targetUserId,
          candidate: event.candidate
        });
      }
    };

    pc.createOffer()
      .then(offer => pc.setLocalDescription(offer))
      .then(() => {
        socketRef.current.emit('send-screen-offer', {
          meetingId,
          targetUserId,
          offer: pc.localDescription
        });
      })
      .catch(error => console.error('Error creating screen offer:', error));

    return pc;
  };

  const handleReceiveScreenOffer = async ({ fromUserId, offer }) => {
    console.log('Received screen offer from:', fromUserId);
    
    if (!screenPeerConnections.current[fromUserId]) {
      const pc = new RTCPeerConnection(configuration);
      screenPeerConnections.current[fromUserId] = pc;

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          socketRef.current.emit('send-screen-ice-candidate', {
            meetingId,
            targetUserId: fromUserId,
            candidate: event.candidate
          });
        }
      };

      pc.ontrack = (event) => {
        console.log('Received screen track from:', fromUserId);
        const [remoteStream] = event.streams;
        
        const screenElement = document.getElementById('screen-share-video');
        if (screenElement) {
          screenElement.srcObject = remoteStream;
        }
      };
    }

    const pc = screenPeerConnections.current[fromUserId];

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      socketRef.current.emit('send-screen-answer', {
        meetingId,
        targetUserId: fromUserId,
        answer: pc.localDescription
      });
    } catch (error) {
      console.error('Error handling screen offer:', error);
    }
  };

  const handleReceiveScreenAnswer = async ({ fromUserId, answer }) => {
    console.log('Received screen answer from:', fromUserId);
    
    const pc = screenPeerConnections.current[fromUserId];
    if (pc) {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      } catch (error) {
        console.error('Error handling screen answer:', error);
      }
    }
  };

  const handleReceiveScreenICECandidate = async ({ fromUserId, candidate }) => {
    console.log('Received screen ICE candidate from:', fromUserId);
    
    const pc = screenPeerConnections.current[fromUserId];
    if (pc) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (error) {
        console.error('Error adding screen ICE candidate:', error);
      }
    }
  };

  // ============ MEDIA FUNCTIONS ============
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
        console.error('Error accessing media:', error);
        setCameraOn(false);
        setMicOn(false);
      }
    };

    initLocalStream();
  }, []);

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

  // ============ TIMER ============
  useEffect(() => {
    const timer = setInterval(() => {
      const elapsed = Date.now() - meetingStartTime;
      const minutes = Math.floor(elapsed / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      setMeetingTime(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(timer);
  }, [meetingStartTime]);

  // ============ CHAT ============
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

  useEffect(() => {
    if (chatEndRef.current && showChat) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, showChat]);

  // ============ ATTENDANCE ============
  const trackAttendance = (uid) => {
    const attendanceRecord = {
      userId: uid,
      userName: userName || (role === 'teacher' ? 'Teacher' : 'Student'),
      role,
      joinTime: new Date().toISOString(),
      meetingId,
      meetingTopic
    };
    
    const existing = JSON.parse(localStorage.getItem(`attendance_${meetingId}`) || '[]');
    localStorage.setItem(`attendance_${meetingId}`, JSON.stringify([...existing, attendanceRecord]));
  };

  // ============ UI FUNCTIONS ============
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

  const leaveMeetingOnly = () => {
    // Stop screen sharing if active
    if (isScreenSharing) {
      stopScreenSharing();
    }
    navigate(role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard');
  };

  const endMeetingForAll = () => {
    if (role !== 'teacher') return;
    // Stop screen sharing if active
    if (isScreenSharing) {
      stopScreenSharing();
    }
    socketRef.current?.emit('end-meeting', { meetingId });
    navigate('/teacher/dashboard');
  };

  // ============ RENDER ============
  const totalParticipants = participants.length + 1;

  return (
    <div className="meeting-room">
      {/* Connection Banner */}
      {connectionStatus !== 'connected' && (
        <div className={`connection-banner ${connectionStatus}`}>
          {connectionStatus === 'connecting' && '🔄 Connecting to server...'}
          {connectionStatus === 'error' && '❌ Connection failed. Retrying...'}
        </div>
      )}

      {/* Screen Share Banner */}
      {screenShareParticipant && screenShareParticipant.userId !== userId && (
        <div className="screen-share-banner">
          <Monitor size={16} />
          <span>{screenShareParticipant.userName} is sharing their screen</span>
        </div>
      )}

      {/* Header */}
      <header className="meeting-header">
        <div className="header-left">
          <span className="meeting-time">
            <Clock size={16} />
            {meetingTime}
          </span>
        </div>

        <div className="header-center">
          <div className="meeting-title">{meetingTopic}</div>
          <div className="participant-count">
            <Users size={16} />
            <span>{totalParticipants}</span>
          </div>
        </div>

        <div className="header-right">
          <button className="icon-btn" onClick={copyMeetingLink}>
            {linkCopied ? <Check size={18} /> : <Share2 size={18} />}
          </button>
          <button className="icon-btn" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="meeting-main">
        <div className={`video-container ${showParticipants || showChat ? 'with-sidebar' : ''}`}>
          {/* Screen Share View */}
          {(screenShareParticipant || isScreenSharing) && (
            <div className="screen-share-container">
              <div className="screen-share-header">
                <Monitor size={16} />
                <span>
                  {isScreenSharing 
                    ? 'You are sharing your screen' 
                    : `${screenShareParticipant?.userName} is sharing their screen`}
                </span>
                {isScreenSharing && (
                  <button 
                    className="stop-screen-share-btn"
                    onClick={stopScreenSharing}
                  >
                    <StopCircle size={16} />
                    Stop Sharing
                  </button>
                )}
              </div>
              <div className="screen-share-video-wrapper">
                <video
                  id={isScreenSharing ? 'screen-share-preview' : 'screen-share-video'}
                  ref={isScreenSharing ? screenVideoRef : null}
                  autoPlay
                  playsInline
                  className="screen-share-video"
                />
              </div>
            </div>
          )}

          {/* Video Grid */}
          <div className={`video-grid ${screenShareParticipant || isScreenSharing ? 'with-screen-share' : ''}`}>
            {/* Local Video */}
            <div className="video-tile local" id="local-tile">
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
                    {userName?.charAt(0).toUpperCase()}
                  </div>
                </div>
              )}
              <div className="video-label">
                <span className="name">{userName} (You)</span>
                {role === 'teacher' && <span className="host-badge">HOST</span>}
                {!micOn && <MicOff size={14} />}
              </div>
            </div>

            {/* Remote Videos */}
            {participants.map((participant) => (
              <div 
                key={participant.userId}
                id={`tile-${participant.userId}`}
                className="video-tile remote"
              >
                <div className={`video-placeholder ${!participant.videoEnabled ? 'visible' : 'hidden'}`}>
                  <div className="avatar">
                    {participant.userName?.charAt(0).toUpperCase()}
                  </div>
                </div>
                <div className="video-label">
                  <span className="name">{participant.userName}</span>
                  {participant.role === 'teacher' && <span className="host-badge">HOST</span>}
                  {!participant.audioEnabled && <MicOff size={14} />}
                  {participant.userId === screenShareParticipant?.userId && (
                    <span className="screen-share-badge">
                      <Monitor size={12} />
                      Sharing
                    </span>
                  )}
                </div>
                {role === 'teacher' && participant.role !== 'teacher' && (
                  <button 
                    className="mute-overlay"
                    onClick={() => muteParticipant(participant.userId)}
                  >
                    <VolumeX size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Participants Sidebar */}
        {showParticipants && (
          <div className="sidebar participants-sidebar">
            <div className="sidebar-header">
              <h3>Participants ({totalParticipants})</h3>
              <button className="close-btn" onClick={toggleParticipants}>
                <X size={18} />
              </button>
            </div>
            <div className="participants-list">
              <div className="participant-item current">
                <div className="avatar-small">
                  {userName.charAt(0).toUpperCase()}
                </div>
                <div className="participant-info">
                  <span className="name">{userName} (You)</span>
                  <span className="status">
                    {micOn ? 'Mic on' : 'Muted'} • {cameraOn ? 'Camera on' : 'Camera off'}
                    {isScreenSharing && ' • Sharing screen'}
                  </span>
                </div>
              </div>
              {participants.map(p => (
                <div key={p.userId} className="participant-item">
                  <div className="avatar-small">
                    {p.userName?.charAt(0).toUpperCase()}
                  </div>
                  <div className="participant-info">
                    <span className="name">
                      {p.userName}
                      {p.role === 'teacher' && <span className="host-tag">HOST</span>}
                    </span>
                    <span className="status">
                      {p.audioEnabled ? 'Mic on' : 'Muted'}
                      {p.userId === screenShareParticipant?.userId && ' • Sharing screen'}
                    </span>
                  </div>
                  {role === 'teacher' && p.role !== 'teacher' && (
                    <button 
                      className="mute-small"
                      onClick={() => muteParticipant(p.userId)}
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
          <div className="sidebar chat-sidebar">
            <div className="sidebar-header">
              <h3>Chat</h3>
              <button className="close-btn" onClick={toggleChat}>
                <X size={18} />
              </button>
            </div>
            <div className="chat-messages">
              {messages.map(msg => (
                <div key={msg.id} className={`chat-message ${msg.userId === userId ? 'own' : ''} ${msg.type === 'system' ? 'system' : ''}`}>
                  {msg.type !== 'system' && msg.userId !== userId && (
                    <div className="message-sender">{msg.userName}</div>
                  )}
                  <div className="message-text">{msg.text}</div>
                  <div className="message-time">{msg.timestamp}</div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <form className="chat-input" onSubmit={sendChatMessage}>
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder="Type a message..."
                disabled={connectionStatus !== 'connected'}
              />
              <button type="submit" disabled={!chatMessage.trim()}>Send</button>
            </form>
          </div>
        )}

        {/* Leave Modal */}
        {showLeaveOptions && (
          <div className="modal-overlay">
            <div className="leave-modal">
              <h2>Leave Meeting</h2>
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
                    <span>Everyone will be removed</span>
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
          <button className={`control-btn ${!micOn ? 'off' : ''}`} onClick={toggleMic}>
            {micOn ? <Mic size={22} /> : <MicOff size={22} />}
          </button>
          <button className={`control-btn ${!cameraOn ? 'off' : ''}`} onClick={toggleCamera}>
            {cameraOn ? <Video size={22} /> : <VideoOff size={22} />}
          </button>
          <button 
            className={`control-btn ${showParticipants ? 'active' : ''}`} 
            onClick={toggleParticipants}
          >
            <Users size={22} />
            {totalParticipants > 0 && <span className="badge">{totalParticipants}</span>}
          </button>
        </div>

        <div className="footer-center">
          <button 
            className={`control-btn screen-share ${isScreenSharing ? 'active' : ''}`} 
            onClick={toggleScreenShare}
            disabled={!screenShareAvailable || (screenShareParticipant && screenShareParticipant.userId !== userId)}
            title={!screenShareAvailable ? 'Screen sharing not available' : 
                   (screenShareParticipant && screenShareParticipant.userId !== userId) ? 'Someone else is sharing' : 
                   'Share screen'}
          >
            {isScreenSharing ? <StopCircle size={22} /> : <Monitor size={22} />}
          </button>
          <button className={`control-btn ${showChat ? 'active' : ''}`} onClick={toggleChat}>
            <MessageSquare size={22} />
            {unreadMessages > 0 && <span className="badge">{unreadMessages}</span>}
          </button>
        </div>

        <div className="footer-right">
          <button className="leave-btn" onClick={() => setShowLeaveOptions(true)}>
            <LogOut size={20} />
            <span>Leave</span>
          </button>
        </div>
      </footer>
    </div>
  );
};

export default MeetingRoom;