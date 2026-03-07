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
      { urls: 'stun:stun4.l.google.com:19302' },
      {
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      },
      {
        urls: 'turn:openrelay.metered.ca:443',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ],
    iceCandidatePoolSize: 10
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
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
      withCredentials: true,
      secure: true,
      rejectUnauthorized: false,
      path: '/socket.io/'
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
      
      if (error.message.includes('websocket')) {
        console.log('⚠️ WebSocket failed, trying polling...');
        socket.io.opts.transports = ['polling'];
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ Disconnected:', reason);
      setConnectionStatus('connecting');
    });

    socket.on('all-users', (users) => {
      console.log('👥 All users:', users);
      setParticipants(users);
      setParticipantCount(users.length + 1);
      
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
      console.log('👤 User joined:', user);
      if (user.userId === newUserId) return;
      
      setParticipants(prev => [...prev, user]);
      setParticipantCount(prev => prev + 1);
      
      // Create peer connection for new user
      if (!peerConnections.current[user.userId]) {
        createPeerConnection(user.userId);
      }

      // If we are currently screen sharing, send screen share to new participant
      if (isScreenSharing && screenStreamRef.current) {
        console.log('New user joined while screen sharing, sending screen stream to:', user.userId);
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
      console.log('📺 Screen sharing started by:', sharerName || 'Someone');
      
      // Update state
      setScreenShareParticipant({ userId: sharerId, userName: sharerName || 'Someone' });
      setHasScreenShare(true);
      
      // Add screen share class to video grid
      const videoGrid = document.querySelector('.video-grid');
      if (videoGrid) {
        videoGrid.classList.add('screen-share-active');
      }
      
      // Create container immediately
      ensureScreenShareContainer(sharerName || 'Someone');
      
      // If we are not the sharer, create a peer connection to receive the screen
      if (sharerId !== userId) {
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
        const screenContainer = document.getElementById('screen-share-container');
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
        const screenContainer = document.getElementById('screen-share-container');
        if (screenContainer) {
          screenContainer.remove();
        }
        
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
      Object.values(peerConnections.current).forEach(pc => {
        try { pc.close(); } catch (e) {}
      });
      Object.values(screenPeerConnections.current).forEach(pc => {
        try { pc.close(); } catch (e) {}
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
          const placeholder = tile.querySelector('.video-placeholder');
          if (placeholder) {
            placeholder.classList.add('hidden');
          }
          tile.appendChild(videoElement);
        }
      }
      
      videoElement.srcObject = remoteStream;
    };

    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state for', targetUserId, ':', pc.iceConnectionState);
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
    let screenContainer = document.getElementById('screen-share-container');
    
    if (!screenContainer) {
      console.log('Creating screen share container for:', sharerName);
      screenContainer = document.createElement('div');
      screenContainer.id = 'screen-share-container';
      screenContainer.className = 'screen-share-container';
      
      const header = document.createElement('div');
      header.className = 'screen-share-header';
      
      const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      icon.setAttribute('width', '20');
      icon.setAttribute('height', '20');
      icon.setAttribute('viewBox', '0 0 24 24');
      icon.setAttribute('fill', 'none');
      icon.setAttribute('stroke', 'currentColor');
      icon.setAttribute('stroke-width', '2');
      icon.innerHTML = '<rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>';
      
      const span = document.createElement('span');
      span.id = 'screen-share-header-text';
      span.textContent = `${sharerName || 'Someone'} is sharing their screen`;
      span.style.fontWeight = '500';
      
      header.appendChild(icon);
      header.appendChild(span);
      
      const videoWrapper = document.createElement('div');
      videoWrapper.className = 'screen-share-video-wrapper';
      
      const screenVideo = document.createElement('video');
      screenVideo.id = 'screen-share-video';
      screenVideo.className = 'screen-share-video';
      screenVideo.autoplay = true;
      screenVideo.playsInline = true;
      screenVideo.controls = false;
      
      videoWrapper.appendChild(screenVideo);
      screenContainer.appendChild(header);
      screenContainer.appendChild(videoWrapper);
      
      const videoContainer = document.querySelector('.video-container');
      if (videoContainer) {
        videoContainer.insertBefore(screenContainer, videoContainer.firstChild);
        console.log('Screen share container added to DOM');
      } else {
        console.error('Video container not found!');
      }
    } else {
      const headerText = document.getElementById('screen-share-header-text');
      if (headerText) {
        headerText.textContent = `${sharerName || 'Someone'} is sharing their screen`;
      }
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
        console.log('Screen sharing stopped by browser');
        stopScreenSharing();
      };

      setIsScreenSharing(true);
      setScreenShareParticipant({ userId, userName });
      setHasScreenShare(true);
      
      // Create local preview
      ensureScreenShareContainer(userName);
      const previewVideo = document.getElementById('screen-share-video');
      if (previewVideo) {
        previewVideo.srcObject = screenStream;
        previewVideo.play().catch(e => console.log('Error playing preview:', e));
      }

      // Emit screen share started event to all participants
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

      // Wait a moment for the stream to be ready
      await new Promise(resolve => setTimeout(resolve, 500));

      // Create screen share connections for all existing participants
      console.log('Creating screen connections for participants:', participants);
      
      if (participants.length === 0) {
        console.log('No participants yet, waiting for participants list...');
        
        // Try again after 2 seconds
        setTimeout(() => {
          console.log('Retrying with participants:', participants);
          for (const participant of participants) {
            if (participant.userId !== userId) {
              console.log('Creating screen connection for:', participant.userId);
              createScreenPeerConnection(participant.userId, screenStream);
            }
          }
        }, 2000);
      } else {
        // Create connections for existing participants
        for (const participant of participants) {
          if (participant.userId !== userId) {
            console.log('Creating screen connection for:', participant.userId);
            createScreenPeerConnection(participant.userId, screenStream);
          }
        }
      }

    } catch (error) {
      console.error('Screen sharing error:', error);
      setScreenShareAvailable(true);
    }
  };

  const stopScreenSharing = () => {
    console.log('Stopping screen share');
    
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      screenStreamRef.current = null;
    }

    setIsScreenSharing(false);
    setScreenShareParticipant(null);
    setHasScreenShare(false);

    const screenContainer = document.getElementById('screen-share-container');
    if (screenContainer) {
      screenContainer.remove();
    }

    const videoGrid = document.querySelector('.video-grid');
    if (videoGrid) {
      videoGrid.classList.remove('screen-share-active');
    }

    socketRef.current.emit('screen-share-stopped', {
      meetingId,
      userId
    });

    Object.values(screenPeerConnections.current).forEach(pc => {
      try {
        pc.close();
      } catch (e) {
        console.error('Error closing peer connection:', e);
      }
    });
    screenPeerConnections.current = {};
  };

  const createScreenPeerConnection = (targetUserId, stream) => {
    const screenStream = stream || screenStreamRef.current;
    
    console.log('Creating screen share connection for:', targetUserId);
    
    const pc = new RTCPeerConnection(configuration);
    screenPeerConnections.current[targetUserId] = pc;

    // Add tracks if stream is available
    if (screenStream) {
      screenStream.getTracks().forEach(track => {
        console.log('Adding screen track to peer connection:', track.kind, 'for user:', targetUserId);
        pc.addTrack(track, screenStream);
      });
    } else {
      console.log('No screen stream available yet for:', targetUserId, '- will add tracks later');
    }

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

    // IMPORTANT FIX: Handle incoming screen track
    pc.ontrack = (event) => {
      console.log('📺 Received screen track from:', fromUserId);
      console.log('Track kind:', event.track.kind);
      console.log('Streams:', event.streams);
      
      const [remoteStream] = event.streams;
      
      if (!remoteStream) {
        console.error('No remote stream received!');
        return;
      }

      // Get the screen video element
      let screenVideo = document.getElementById('screen-share-video');
      
      if (!screenVideo) {
        console.log('Creating screen share container for:', fromUserId);
        const sharer = participants.find(p => p.userId === fromUserId);
        const sharerName = sharer?.userName || 'Someone';
        
        ensureScreenShareContainer(sharerName);
        screenVideo = document.getElementById('screen-share-video');
      }
      
      if (screenVideo) {
        console.log('Setting screen video source with stream');
        screenVideo.srcObject = remoteStream;
        
        // Force play
        screenVideo.play()
          .then(() => console.log('Screen video playing'))
          .catch(e => console.error('Error playing screen video:', e));
        
        // Make sure video is visible
        screenVideo.style.display = 'block';
        
        // Update state
        setHasScreenShare(true);
      } else {
        console.error('Screen video element not found after creation!');
      }
    };
    
    pc.oniceconnectionstatechange = () => {
      console.log('Screen receiver ICE state for', fromUserId, ':', pc.iceConnectionState);
      
      // If connection is complete, make sure video is playing
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        console.log('Screen connection established with:', fromUserId);
        const screenVideo = document.getElementById('screen-share-video');
        if (screenVideo && screenVideo.srcObject) {
          screenVideo.play().catch(e => console.log('Error playing video after connection:', e));
        }
      }
    };
  }

  const pc = screenPeerConnections.current[fromUserId];

  try {
    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    console.log('Remote description set for screen from:', fromUserId);
    
    const answer = await pc.createAnswer();
    console.log('Created screen answer for:', fromUserId);
    
    await pc.setLocalDescription(answer);
    console.log('Local description set for screen answer');

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

      {/* Screen Share Banner - Only for viewers */}
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
          {/* Screen share container will be inserted here dynamically */}
          
          {/* Video Grid */}
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

            {/* Remote Videos */}
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