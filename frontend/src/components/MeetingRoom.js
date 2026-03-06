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
  const [hasScreenShare, setHasScreenShare] = useState(false);
  
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

  // Add CSS styles for screen share
  useEffect(() => {
    const screenShareStyles = `
      .meeting-room {
        display: flex;
        flex-direction: column;
        height: 100vh;
        background: #0a0a0a;
        color: white;
      }

      .meeting-main {
        flex: 1;
        display: flex;
        overflow: hidden;
        position: relative;
      }

      .video-container {
        flex: 1;
        display: flex;
        flex-direction: column;
        padding: 20px;
        transition: all 0.3s ease;
        overflow-y: auto;
      }

      .video-container.with-sidebar {
        width: calc(100% - 300px);
      }

      /* Screen share container */
      .screen-share-container {
        width: 100%;
        margin-bottom: 20px;
        background: #1a1a1a;
        border-radius: 12px;
        overflow: hidden;
        border: 2px solid #3b82f6;
        box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);
      }

      .screen-share-header {
        padding: 12px 16px;
        background: #2d2d2d;
        color: white;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        border-bottom: 1px solid #404040;
      }

      .screen-share-video-wrapper {
        position: relative;
        width: 100%;
        background: #000;
        min-height: 200px;
        max-height: 50vh;
      }

      .screen-share-video {
        width: 100%;
        height: 100%;
        max-height: 50vh;
        object-fit: contain;
        background: #000;
        display: block;
      }

      /* Video grid - always visible */
      .video-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 15px;
        width: 100%;
        min-height: 200px;
      }

      .video-grid.screen-share-active {
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      }

      /* Video tiles */
      .video-tile {
        position: relative;
        aspect-ratio: 16/9;
        background: #1a1a1a;
        border-radius: 12px;
        overflow: hidden;
        border: 1px solid #333;
        transition: all 0.2s;
      }

      .video-tile:hover {
        border-color: #3b82f6;
      }

      .video-element {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .video-placeholder {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        background: linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%);
      }

      .video-placeholder.hidden {
        display: none;
      }

      .avatar {
        width: 80px;
        height: 80px;
        border-radius: 50%;
        background: #3b82f6;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 32px;
        font-weight: bold;
        color: white;
      }

      .video-label {
        position: absolute;
        bottom: 8px;
        left: 8px;
        right: 8px;
        padding: 4px 8px;
        background: rgba(0, 0, 0, 0.6);
        border-radius: 6px;
        font-size: 12px;
        display: flex;
        align-items: center;
        gap: 4px;
        backdrop-filter: blur(4px);
      }

      .name {
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .host-badge {
        background: #fbbf24;
        color: #000;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 10px;
        font-weight: bold;
      }

      .screen-share-badge {
        background: #3b82f6;
        color: white;
        padding: 2px 6px;
        border-radius: 4px;
        font-size: 10px;
        display: inline-flex;
        align-items: center;
        gap: 2px;
      }

      .mute-overlay {
        position: absolute;
        top: 8px;
        right: 8px;
        background: rgba(239, 68, 68, 0.9);
        border: none;
        color: white;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.2s;
      }

      .mute-overlay:hover {
        background: #dc2626;
      }

      /* Screen share banner */
      .screen-share-banner {
        position: fixed;
        top: 60px;
        left: 50%;
        transform: translateX(-50%);
        background: rgba(0, 0, 0, 0.8);
        color: white;
        padding: 8px 16px;
        border-radius: 20px;
        display: flex;
        align-items: center;
        gap: 8px;
        z-index: 100;
        font-size: 14px;
        backdrop-filter: blur(4px);
        border: 1px solid #3b82f6;
      }

      .stop-screen-share-btn {
        margin-left: auto;
        background: #dc2626;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 6px;
        font-size: 13px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 4px;
        transition: background 0.2s;
      }

      .stop-screen-share-btn:hover {
        background: #b91c1c;
      }

      /* Hide browser's native screen sharing indicator */
      #screen-share-indicator {
        display: none !important;
      }

      /* Responsive */
      @media (max-width: 768px) {
        .video-grid {
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        }

        .avatar {
          width: 50px;
          height: 50px;
          font-size: 24px;
        }

        .screen-share-banner {
          top: 70px;
          font-size: 12px;
          padding: 6px 12px;
        }
      }
    `;

    const styleSheet = document.createElement("style");
    styleSheet.textContent = screenShareStyles;
    document.head.appendChild(styleSheet);

    return () => {
      styleSheet.remove();
    };
  }, []);

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

      // If we are currently screen sharing, send screen share to new participant
      if (isScreenSharing && screenStreamRef.current) {
        setTimeout(() => {
          createScreenPeerConnection(user.userId, screenStreamRef.current);
        }, 1000);
      }
    });

    socket.on('receive-offer', handleReceiveOffer);
    socket.on('receive-answer', handleReceiveAnswer);
    socket.on('receive-ice-candidate', handleReceiveICECandidate);
    
    // Screen sharing socket events
    socket.on('screen-share-started', ({ userId: sharerId, userName: sharerName }) => {
      console.log('📺 Screen sharing started by:', sharerName);
      setScreenShareParticipant({ userId: sharerId, userName: sharerName });
      setHasScreenShare(true);
      
      // Create screen share container for viewers with the correct name
      ensureScreenShareContainer(sharerName);
      
      // Add screen share class to video grid
      const videoGrid = document.querySelector('.video-grid');
      if (videoGrid) {
        videoGrid.classList.add('screen-share-active');
      }
      
      // If we are not the sharer, create a peer connection to receive the screen
      if (sharerId !== newUserId) {
        console.log('Creating screen peer connection for sharer:', sharerId);
        createScreenPeerConnection(sharerId);
      }
    });

    socket.on('screen-share-stopped', ({ userId: sharerId }) => {
      console.log('📺 Screen sharing stopped by:', sharerId);
      if (screenShareParticipant?.userId === sharerId) {
        setScreenShareParticipant(null);
        setHasScreenShare(false);
        
        // Remove screen share container
        const screenContainer = document.querySelector('.screen-share-container');
        if (screenContainer) {
          screenContainer.remove();
        }
        
        // Remove screen share class from video grid
        const videoGrid = document.querySelector('.video-grid');
        if (videoGrid) {
          videoGrid.classList.remove('screen-share-active');
        }
      }
      
      // Close screen peer connection
      if (screenPeerConnections.current[sharerId]) {
        screenPeerConnections.current[sharerId].close();
        delete screenPeerConnections.current[sharerId];
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
        setHasScreenShare(false);
        const screenContainer = document.querySelector('.screen-share-container');
        if (screenContainer) {
          screenContainer.remove();
        }
        
        // Remove screen share class from video grid
        const videoGrid = document.querySelector('.video-grid');
        if (videoGrid) {
          videoGrid.classList.remove('screen-share-active');
        }
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
        videoElement.className = 'video-element';
        
        const tile = document.getElementById(`tile-${targetUserId}`);
        if (tile) {
          // Clear placeholder and add video
          const placeholder = tile.querySelector('.video-placeholder');
          if (placeholder) {
            placeholder.classList.add('hidden');
          }
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
          videoElement.className = 'video-element';
          
          const tile = document.getElementById(`tile-${fromUserId}`);
          if (tile) {
            const placeholder = tile.querySelector('.video-placeholder');
            if (placeholder) {
              placeholder.classList.add('hidden');
            }
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
  const ensureScreenShareContainer = (sharerName) => {
    // Remove existing container if any
    const existingContainer = document.querySelector('.screen-share-container');
    if (existingContainer) {
      existingContainer.remove();
    }
    
    // Create new container
    const screenContainer = document.createElement('div');
    screenContainer.className = 'screen-share-container';
    
    const header = document.createElement('div');
    header.className = 'screen-share-header';
    
    // Create monitor icon
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('width', '20');
    icon.setAttribute('height', '20');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('stroke', 'currentColor');
    icon.setAttribute('stroke-width', '2');
    
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', '2');
    rect.setAttribute('y', '3');
    rect.setAttribute('width', '20');
    rect.setAttribute('height', '14');
    rect.setAttribute('rx', '2');
    rect.setAttribute('ry', '2');
    
    const line1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line1.setAttribute('x1', '8');
    line1.setAttribute('y1', '21');
    line1.setAttribute('x2', '16');
    line1.setAttribute('y2', '21');
    
    const line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line2.setAttribute('x1', '12');
    line2.setAttribute('y1', '17');
    line2.setAttribute('x2', '12');
    line2.setAttribute('y2', '21');
    
    icon.appendChild(rect);
    icon.appendChild(line1);
    icon.appendChild(line2);
    
    const span = document.createElement('span');
    span.textContent = `${sharerName || 'Someone'} is sharing their screen`;
    span.style.fontWeight = '500';
    
    header.appendChild(icon);
    header.appendChild(span);
    
    // Add stop button only for the sharer
    if (sharerName === userName) {
      const stopBtn = document.createElement('button');
      stopBtn.className = 'stop-screen-share-btn';
      stopBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><rect x="8" y="8" width="8" height="8"/></svg> Stop Sharing';
      stopBtn.onclick = stopScreenSharing;
      header.appendChild(stopBtn);
    }
    
    const videoWrapper = document.createElement('div');
    videoWrapper.className = 'screen-share-video-wrapper';
    
    const screenVideo = document.createElement('video');
    screenVideo.id = 'screen-share-video';
    screenVideo.className = 'screen-share-video';
    screenVideo.autoplay = true;
    screenVideo.playsInline = true;
    
    videoWrapper.appendChild(screenVideo);
    screenContainer.appendChild(header);
    screenContainer.appendChild(videoWrapper);
    
    const videoContainer = document.querySelector('.video-container');
    if (videoContainer) {
      videoContainer.insertBefore(screenContainer, videoContainer.firstChild);
    }
    
    return screenContainer;
  };

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
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        alert('Screen sharing is not supported in this browser');
        return;
      }

      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
          displaySurface: 'monitor'
        },
        audio: false
      });
      
      screenStreamRef.current = screenStream;
      
      screenStream.getVideoTracks()[0].onended = () => {
        stopScreenSharing();
      };

      setIsScreenSharing(true);
      setScreenShareParticipant({ userId, userName });
      setHasScreenShare(true);
      
      // Create local preview with correct name
      ensureScreenShareContainer(userName);
      const previewVideo = document.getElementById('screen-share-video');
      if (previewVideo) {
        previewVideo.srcObject = screenStream;
        previewVideo.play().catch(e => console.log('Error playing preview:', e));
      }

      socketRef.current.emit('screen-share-started', {
        meetingId,
        userId,
        userName
      });

      // Add screen share class to video grid
      const videoGrid = document.querySelector('.video-grid');
      if (videoGrid) {
        videoGrid.classList.add('screen-share-active');
      }

      // Create screen share connections for all participants
      console.log('Creating screen connections for participants:', participants);
      participants.forEach(participant => {
        if (participant.userId !== userId) {
          console.log('Creating screen connection for:', participant.userId);
          createScreenPeerConnection(participant.userId, screenStream);
        }
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
    setHasScreenShare(false);

    // Remove screen share container
    const screenContainer = document.querySelector('.screen-share-container');
    if (screenContainer) {
      screenContainer.remove();
    }

    // Remove screen share class from video grid
    const videoGrid = document.querySelector('.video-grid');
    if (videoGrid) {
      videoGrid.classList.remove('screen-share-active');
    }

    socketRef.current.emit('screen-share-stopped', {
      meetingId,
      userId
    });

    // Close all screen peer connections
    Object.values(screenPeerConnections.current).forEach(pc => pc.close());
    screenPeerConnections.current = {};
  };

  const createScreenPeerConnection = (targetUserId, stream = screenStreamRef.current) => {
    if (!stream) {
      console.log('No screen stream available for:', targetUserId);
      return;
    }

    console.log('Creating screen share connection for:', targetUserId);
    
    const pc = new RTCPeerConnection(configuration);
    screenPeerConnections.current[targetUserId] = pc;

    stream.getTracks().forEach(track => {
      console.log('Adding screen track to peer connection:', track.kind, 'for user:', targetUserId);
      pc.addTrack(track, stream);
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Sending screen ICE candidate to:', targetUserId);
        socketRef.current.emit('send-screen-ice-candidate', {
          meetingId,
          targetUserId,
          candidate: event.candidate
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('Screen PC ICE connection state for', targetUserId, ':', pc.iceConnectionState);
    };

    pc.onconnectionstatechange = () => {
      console.log('Screen PC connection state for', targetUserId, ':', pc.connectionState);
    };

    pc.createOffer()
      .then(offer => pc.setLocalDescription(offer))
      .then(() => {
        console.log('Sending screen offer to:', targetUserId);
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
      console.log('Creating screen peer connection for receiver:', fromUserId);
      const pc = new RTCPeerConnection(configuration);
      screenPeerConnections.current[fromUserId] = pc;

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          console.log('Sending screen ICE candidate back to:', fromUserId);
          socketRef.current.emit('send-screen-ice-candidate', {
            meetingId,
            targetUserId: fromUserId,
            candidate: event.candidate
          });
        }
      };

      pc.ontrack = (event) => {
        console.log('📺 Received screen track from:', fromUserId);
        const [remoteStream] = event.streams;
        
        let screenVideo = document.getElementById('screen-share-video');
        
        if (!screenVideo) {
          // Get the sharer's name from participants list
          const sharer = participants.find(p => p.userId === fromUserId);
          const sharerName = sharer?.userName || 'Someone';
          
          // Create container if it doesn't exist with correct name
          ensureScreenShareContainer(sharerName);
          screenVideo = document.getElementById('screen-share-video');
        }
        
        if (screenVideo) {
          screenVideo.srcObject = remoteStream;
          screenVideo.play().catch(e => console.log('Error playing screen video:', e));
        }
      };
    }

    const pc = screenPeerConnections.current[fromUserId];

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      console.log('Sending screen answer to:', fromUserId);
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
        console.log('Screen answer set successfully for:', fromUserId);
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
        console.log('Screen ICE candidate added for:', fromUserId);
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
    if (isScreenSharing) {
      stopScreenSharing();
    }
    navigate(role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard');
  };

  const endMeetingForAll = () => {
    if (role !== 'teacher') return;
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

      {/* Screen Share Banner - Only for viewers, not for sharer */}
      {hasScreenShare && screenShareParticipant && screenShareParticipant.userId !== userId && !isScreenSharing && (
        <div className="screen-share-banner">
          <Monitor size={16} />
          <span>{screenShareParticipant.userName || 'Someone'} is sharing their screen</span>
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
          {/* Screen share container will be inserted here dynamically when someone shares */}
          
          {/* Video Grid - Always visible with all participants */}
          <div className={`video-grid ${hasScreenShare ? 'screen-share-active' : ''}`}>
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
                {isScreenSharing && (
                  <span className="screen-share-badge">
                    <Monitor size={12} />
                    Sharing
                  </span>
                )}
              </div>
            </div>

            {/* Remote Videos - ALL participants appear here, including screen sharer */}
            {participants.map((participant) => (
              <div 
                key={participant.userId}
                id={`tile-${participant.userId}`}
                className="video-tile remote"
              >
                <div className={`video-placeholder ${!participant.videoEnabled ? '' : 'hidden'}`}>
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
            disabled={!screenShareAvailable || (hasScreenShare && !isScreenSharing)}
            title={!screenShareAvailable ? 'Screen sharing not available' : 
                   (hasScreenShare && !isScreenSharing) ? `${screenShareParticipant?.userName || 'Someone'} is sharing` : 
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