// src/components/MeetingRoom.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import {
  Mic, MicOff, Video, VideoOff, Users, MessageSquare, Grid, PenTool,
  ScreenShare, LogOut, Copy, Check, Clock, X, VolumeX, Share2,
  Maximize, Minimize, PlayCircle, StopCircle, User, ChevronLeft, ChevronRight,
  Volume2, LayoutGrid, LayoutList
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
  
  // Participants state - stores all participants info
  const [participants, setParticipants] = useState([]);
  
  // UI states
  const [showParticipants, setShowParticipants] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showBreakoutRooms, setShowBreakoutRooms] = useState(false);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [layoutMode, setLayoutMode] = useState('grid');
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Chat states
  const [chatMessage, setChatMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const chatEndRef = useRef(null);
  
  // Recording states
  const [recordingTime, setRecordingTime] = useState('00:00');
  const recordingTimerRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  
  // Breakout Room states
  const [breakoutRooms, setBreakoutRooms] = useState([]);
  const [showBreakoutModal, setShowBreakoutModal] = useState(false);
  const [breakoutRoomName, setBreakoutRoomName] = useState('');
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [assignedTeacher, setAssignedTeacher] = useState('');
  const [inBreakoutRoom, setInBreakoutRoom] = useState(false);
  const [currentBreakoutRoom, setCurrentBreakoutRoom] = useState(null);
  
  // Whiteboard states
  const [whiteboardData, setWhiteboardData] = useState([]);
  const [currentTool, setCurrentTool] = useState('pen');
  const [currentColor, setCurrentColor] = useState('#000000');
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  
  // Leave options
  const [showLeaveOptions, setShowLeaveOptions] = useState(false);
  
  // Link sharing
  const [linkCopied, setLinkCopied] = useState(false);
  const meetingLink = `${window.location.origin}/meeting/${meetingId}`;
  
  // Refs for WebRTC
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

    // Initialize socket connection
    const socket = io('http://localhost:5000', {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });
    socketRef.current = socket;

    // Join meeting room
    socket.emit('join-meeting', {
      meetingId,
      userId: newUserId,
      userName: userName || (role === 'teacher' ? 'Teacher' : 'Student'),
      role
    });

    // Socket event listeners for WebRTC signaling
    socket.on('user-joined', handleUserJoined);
    socket.on('receive-offer', handleReceiveOffer);
    socket.on('receive-answer', handleReceiveAnswer);
    socket.on('receive-ice-candidate', handleReceiveICECandidate);
    socket.on('user-left', handleUserLeft);
    socket.on('all-users', handleAllUsers);
    socket.on('meeting-ended', handleMeetingEnded);

    // Chat events
    socket.on('chat-message', (message) => {
      setMessages(prev => [...prev, message]);
      if (!showChat) setUnreadMessages(prev => prev + 1);
    });

    // Media state events
    socket.on('media-state-changed', ({ userId, audioEnabled, videoEnabled }) => {
      setParticipants(prev => prev.map(p => 
        p.userId === userId ? { ...p, audioEnabled, videoEnabled } : p
      ));
    });

    // Screen share events
    socket.on('screen-share-started', ({ userId }) => {
      setParticipants(prev => prev.map(p => 
        p.userId === userId ? { ...p, isScreenSharing: true } : p
      ));
      if (userId !== newUserId) setLayoutMode('speaker');
    });

    socket.on('screen-share-stopped', ({ userId }) => {
      setParticipants(prev => prev.map(p => 
        p.userId === userId ? { ...p, isScreenSharing: false } : p
      ));
    });

    // Breakout room events
    socket.on('breakout-room-created', setBreakoutRooms);
    socket.on('assigned-to-breakout', ({ roomId, roomName }) => {
      setInBreakoutRoom(true);
      setCurrentBreakoutRoom({ id: roomId, name: roomName });
    });
    socket.on('return-to-main', () => {
      setInBreakoutRoom(false);
      setCurrentBreakoutRoom(null);
    });

    // Whiteboard events
    socket.on('whiteboard-update', (data) => {
      setWhiteboardData(prev => [...prev, data]);
      drawOnCanvas(data);
    });
    socket.on('whiteboard-clear', clearCanvas);

    // Track attendance
    trackAttendance(newUserId);

    return () => {
      // Clean up all peer connections
      Object.values(peerConnections.current).forEach(pc => {
        if (pc) pc.close();
      });
      
      // Stop all media tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      // Leave meeting
      if (socketRef.current) {
        socketRef.current.emit('leave-meeting', { meetingId, userId: newUserId });
        socketRef.current.disconnect();
      }
      
      // Clear recording timer
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
      meetingId
    };
    
    const existingAttendance = JSON.parse(localStorage.getItem(`attendance_${meetingId}`) || '[]');
    localStorage.setItem(`attendance_${meetingId}`, JSON.stringify([...existingAttendance, attendanceRecord]));
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
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        
        localStreamRef.current = stream;
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // After getting local stream, create connections for all existing participants
        setTimeout(() => {
          participants.forEach(participant => {
            if (participant.userId !== userId && !peerConnections.current[participant.userId]) {
              createPeerConnection(participant.userId);
            }
          });
        }, 1000);

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

  // ============ WEBRTC HANDLERS ============
  const handleAllUsers = (users) => {
    console.log('All users in meeting:', users);
    setParticipants(users.filter(u => u.userId !== userId));
    setParticipantCount(users.length);
    
    // Create peer connections for all existing users
    users.forEach(user => {
      if (user.userId !== userId && !peerConnections.current[user.userId]) {
        createPeerConnection(user.userId);
      }
    });
  };

  const handleUserJoined = async (user) => {
    if (user.userId === userId) return;
    
    console.log('User joined:', user);
    setParticipants(prev => [...prev, user]);
    setParticipantCount(prev => prev + 1);

    // Create peer connection for new user
    if (!peerConnections.current[user.userId]) {
      createPeerConnection(user.userId);
    }
  };

  const createPeerConnection = (targetUserId) => {
    console.log('Creating peer connection for:', targetUserId);
    
    const pc = new RTCPeerConnection(configuration);
    peerConnections.current[targetUserId] = pc;

    // Add local stream tracks to peer connection
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
      
      // Create or update video element for this peer
      if (!remoteVideoRefs.current[targetUserId]) {
        const videoContainer = document.createElement('div');
        videoContainer.id = `remote-video-${targetUserId}`;
        videoContainer.className = 'remote-video-container';
        
        const videoElement = document.createElement('video');
        videoElement.id = `video-${targetUserId}`;
        videoElement.autoplay = true;
        videoElement.playsInline = true;
        videoElement.className = 'remote-video';
        
        videoContainer.appendChild(videoElement);
        remoteVideoRefs.current[targetUserId] = videoElement;
        
        // Find the video tile and append video
        const tile = document.getElementById(`tile-${targetUserId}`);
        if (tile) {
          tile.appendChild(videoContainer);
        }
      }
      
      remoteVideoRefs.current[targetUserId].srcObject = remoteStream;
    };

    // Handle connection state changes
    pc.oniceconnectionstatechange = () => {
      console.log('ICE connection state for', targetUserId, ':', pc.iceConnectionState);
    };

    pc.onconnectionstatechange = () => {
      console.log('Connection state for', targetUserId, ':', pc.connectionState);
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
    
    // Create peer connection if doesn't exist
    if (!peerConnections.current[fromUserId]) {
      const pc = new RTCPeerConnection(configuration);
      peerConnections.current[fromUserId] = pc;

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
            targetUserId: fromUserId,
            candidate: event.candidate
          });
        }
      };

      // Handle incoming tracks
      pc.ontrack = (event) => {
        console.log('Received track from:', fromUserId);
        const [remoteStream] = event.streams;
        
        if (!remoteVideoRefs.current[fromUserId]) {
          const videoContainer = document.createElement('div');
          videoContainer.id = `remote-video-${fromUserId}`;
          videoContainer.className = 'remote-video-container';
          
          const videoElement = document.createElement('video');
          videoElement.id = `video-${fromUserId}`;
          videoElement.autoplay = true;
          videoElement.playsInline = true;
          videoElement.className = 'remote-video';
          
          videoContainer.appendChild(videoElement);
          remoteVideoRefs.current[fromUserId] = videoElement;
          
          const tile = document.getElementById(`tile-${fromUserId}`);
          if (tile) {
            tile.appendChild(videoContainer);
          }
        }
        
        remoteVideoRefs.current[fromUserId].srcObject = remoteStream;
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

  const handleUserLeft = (leftUserId) => {
    console.log('User left:', leftUserId);
    
    // Close and remove peer connection
    if (peerConnections.current[leftUserId]) {
      peerConnections.current[leftUserId].close();
      delete peerConnections.current[leftUserId];
    }
    
    // Remove remote video element
    if (remoteVideoRefs.current[leftUserId]) {
      delete remoteVideoRefs.current[leftUserId];
    }
    
    // Remove from participants list
    setParticipants(prev => prev.filter(p => p.userId !== leftUserId));
    setParticipantCount(prev => prev - 1);
    
    // Update attendance
    updateAttendanceOnLeave(leftUserId);
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
        
        // Update local video
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        
        setIsScreenSharing(true);
        setLayoutMode('speaker');
        
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
    
    // Restore camera video track
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

  // ============ WHITEBOARD FUNCTIONS ============
  useEffect(() => {
    if (showWhiteboard && canvasRef.current) {
      initCanvas();
    }
  }, [showWhiteboard]);

  const initCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2;
    ctx.strokeStyle = currentColor;
  };

  const startDrawing = (e) => {
    isDrawingRef.current = true;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
    
    const drawData = {
      type: 'start',
      x, y,
      tool: currentTool,
      color: currentColor,
      userId,
      timestamp: Date.now()
    };
    
    socketRef.current?.emit('whiteboard-draw', { meetingId, data: drawData });
  };

  const draw = (e) => {
    if (!isDrawingRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const ctx = canvas.getContext('2d');
    ctx.lineTo(x, y);
    ctx.stroke();
    
    const drawData = {
      type: 'draw',
      x, y,
      tool: currentTool,
      color: currentColor,
      userId,
      timestamp: Date.now()
    };
    
    socketRef.current?.emit('whiteboard-draw', { meetingId, data: drawData });
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const drawOnCanvas = (data) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = data.color;
    
    if (data.type === 'start') {
      ctx.beginPath();
      ctx.moveTo(data.x, data.y);
    } else if (data.type === 'draw') {
      ctx.lineTo(data.x, data.y);
      ctx.stroke();
    }
  };

  const clearWhiteboard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setWhiteboardData([]);
    socketRef.current?.emit('whiteboard-clear', { meetingId });
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  // ============ RECORDING FUNCTIONS ============
  const startRecording = () => {
    if (role !== 'teacher') return;
    
    const stream = isScreenSharing && screenStreamRef.current 
      ? screenStreamRef.current 
      : localStreamRef.current;
      
    if (!stream) return;
    
    recordedChunksRef.current = [];
    
    try {
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9,opus'
      });
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Meeting_${meetingTopic}_${new Date().toISOString()}.webm`;
        a.click();
      };
      
      mediaRecorder.start(1000);
      setIsRecording(true);
      
      const startTime = Date.now();
      recordingTimerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const minutes = Math.floor(elapsed / 60000);
        const seconds = Math.floor((elapsed % 60000) / 1000);
        setRecordingTime(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }, 1000);
      
    } catch (error) {
      console.error('Recording error:', error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      setRecordingTime('00:00');
    }
  };

  // ============ BREAKOUT ROOM FUNCTIONS ============
  const createBreakoutRoom = () => {
    if (!breakoutRoomName.trim() || role !== 'teacher') return;
    
    const newRoom = {
      id: `room_${Date.now()}`,
      name: breakoutRoomName,
      teacher: assignedTeacher || userName,
      students: selectedStudents,
      createdAt: new Date().toISOString()
    };
    
    setBreakoutRooms([...breakoutRooms, newRoom]);
    setShowBreakoutModal(false);
    setBreakoutRoomName('');
    setSelectedStudents([]);
    setAssignedTeacher('');
    
    socketRef.current?.emit('create-breakout-room', {
      meetingId,
      room: newRoom
    });
  };

  const joinBreakoutRoom = (roomId) => {
    const room = breakoutRooms.find(r => r.id === roomId);
    if (room) {
      socketRef.current?.emit('join-breakout-room', {
        meetingId,
        roomId,
        userId,
        userName,
        role
      });
    }
  };

  const leaveBreakoutRoom = () => {
    socketRef.current?.emit('leave-breakout-room', {
      meetingId,
      userId,
      roomId: currentBreakoutRoom?.id
    });
    setInBreakoutRoom(false);
    setCurrentBreakoutRoom(null);
  };

  const endBreakoutRooms = () => {
    socketRef.current?.emit('end-breakout-rooms', { meetingId });
    setBreakoutRooms([]);
    setShowBreakoutRooms(false);
  };

  // ============ LEAVE MEETING FUNCTIONS ============
  const handleMeetingEnded = () => {
    alert('The meeting has been ended by the host.');
    navigate(role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard');
  };

  const leaveMeetingOnly = () => {
    // Update attendance
    updateAttendanceOnLeave(userId);
    
    // Clean up
    if (isRecording && role === 'teacher') stopRecording();
    if (isScreenSharing) stopScreenShare();
    
    navigate(role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard');
  };

  const endMeetingForAll = () => {
    if (role !== 'teacher') return;
    
    socketRef.current?.emit('end-meeting', { meetingId });
    
    if (isRecording) stopRecording();
    
    navigate('/teacher/dashboard');
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
    navigator.clipboard.writeText(meetingLink);
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

  // ============ RENDER ============
  const totalParticipants = participants.length + 1;

  return (
    <div className={`meeting-room ${inBreakoutRoom ? 'in-breakout' : ''}`}>
      {/* ============ HEADER ============ */}
      <header className="meeting-header">
        <div className="header-left">
          <div className="meeting-info">
            <h2 className="meeting-title">
              {inBreakoutRoom ? currentBreakoutRoom?.name : meetingTopic}
            </h2>
            <div className="meeting-details">
              <span className="meeting-time">
                <Clock size={14} />
                {meetingTime}
              </span>
              {isRecording && (
                <span className="recording-status">
                  <span className="recording-dot"></span>
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
        <div className={`video-grid-area ${
          showParticipants || showChat || showBreakoutRooms || showWhiteboard 
            ? 'sidebar-open' 
            : 'sidebar-closed'
        }`}>
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
                      {userName} {!inBreakoutRoom ? '(You)' : ''}
                    </span>
                    <div className="media-status">
                      {!micOn && <MicOff size={14} />}
                      {role === 'teacher' && <span className="role-badge">Host</span>}
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

              {/* Remote Participants - Each gets a video tile */}
              {participants.map((participant) => (
                <div 
                  key={participant.userId}
                  id={`tile-${participant.userId}`}
                  className={`video-tile remote ${participant.isScreenSharing ? 'screen-sharing-active' : ''}`}
                >
                  {/* Video will be inserted here by WebRTC */}
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
                        {participant.role === 'teacher' && <span className="role-badge">Host</span>}
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

        {/* ============ PARTICIPANTS SIDEBAR ============ */}
        {showParticipants && (
          <div className="sidebar participants-sidebar">
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
                      {role === 'teacher' && <span className="role-tag">Host</span>}
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
                        {participant.role === 'teacher' && <span className="role-tag">Host</span>}
                      </span>
                      <span className="participant-status">
                        {participant.audioEnabled ? 'Mic on' : 'Muted'}
                      </span>
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

              {role === 'teacher' && participants.length > 0 && (
                <div className="participant-controls-section">
                  <button className="mute-all-btn" onClick={muteAllParticipants}>
                    <VolumeX size={14} />
                    Mute All
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============ CHAT SIDEBAR ============ */}
        {showChat && (
          <div className="sidebar chat-sidebar">
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
            </div>
            
            <div className="chat-input-area">
              <form onSubmit={sendChatMessage} className="chat-input-form">
                <input
                  type="text"
                  value={chatMessage}
                  onChange={(e) => setChatMessage(e.target.value)}
                  placeholder="Type a message..."
                />
                <button type="submit" className="send-btn" disabled={!chatMessage.trim()}>
                  Send
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ============ BREAKOUT ROOMS SIDEBAR ============ */}
        {showBreakoutRooms && role === 'teacher' && (
          <div className="sidebar breakout-sidebar">
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
              <button 
                className="create-breakout-btn"
                onClick={() => setShowBreakoutModal(true)}
              >
                + Create Breakout Room
              </button>
              
              <div className="breakout-rooms-list">
                {breakoutRooms.map(room => (
                  <div key={room.id} className="breakout-room-item">
                    <div className="breakout-room-info">
                      <h4>{room.name}</h4>
                      <p>Teacher: {room.teacher}</p>
                      <p>Students: {room.students.length}</p>
                    </div>
                    <button 
                      className="join-breakout-btn"
                      onClick={() => joinBreakoutRoom(room.id)}
                    >
                      Join
                    </button>
                  </div>
                ))}
              </div>
              
              {breakoutRooms.length > 0 && (
                <button className="end-breakout-btn" onClick={endBreakoutRooms}>
                  Close All Rooms
                </button>
              )}
            </div>
          </div>
        )}

        {/* ============ WHITEBOARD SIDEBAR ============ */}
        {showWhiteboard && (
          <div className="sidebar whiteboard-sidebar">
            <div className="sidebar-header">
              <h3>
                <PenTool size={18} />
                Whiteboard
              </h3>
              <button className="close-sidebar-btn" onClick={toggleWhiteboard}>
                <X size={16} />
              </button>
            </div>
            
            <div className="whiteboard-toolbar">
              <button 
                className={`tool-btn ${currentTool === 'pen' ? 'active' : ''}`}
                onClick={() => setCurrentTool('pen')}
              >
                Pen
              </button>
              <button 
                className={`tool-btn ${currentTool === 'eraser' ? 'active' : ''}`}
                onClick={() => setCurrentTool('eraser')}
              >
                Eraser
              </button>
              <input
                type="color"
                value={currentColor}
                onChange={(e) => setCurrentColor(e.target.value)}
                className="color-picker"
              />
              <button className="tool-btn clear-btn" onClick={clearWhiteboard}>
                Clear
              </button>
            </div>
            
            <div className="whiteboard-container">
              <canvas
                ref={canvasRef}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                className="whiteboard-canvas"
              />
            </div>
          </div>
        )}

        {/* ============ BREAKOUT ROOM CREATION MODAL ============ */}
        {showBreakoutModal && role === 'teacher' && (
          <div className="modal-overlay">
            <div className="modal">
              <h3>Create Breakout Room</h3>
              
              <div className="modal-form">
                <div className="form-group">
                  <label>Room Name</label>
                  <input
                    type="text"
                    value={breakoutRoomName}
                    onChange={(e) => setBreakoutRoomName(e.target.value)}
                    placeholder="Enter room name"
                  />
                </div>
                
                <div className="form-group">
                  <label>Assign Teacher</label>
                  <select 
                    value={assignedTeacher}
                    onChange={(e) => setAssignedTeacher(e.target.value)}
                  >
                    <option value="">Select teacher</option>
                    <option value={userName}>{userName} (You)</option>
                    {participants
                      .filter(p => p.role === 'teacher')
                      .map(p => (
                        <option key={p.userId} value={p.userName}>
                          {p.userName}
                        </option>
                      ))
                    }
                  </select>
                </div>
                
                <div className="form-group">
                  <label>Select Students</label>
                  <div className="student-checkboxes">
                    {participants
                      .filter(p => p.role === 'student')
                      .map(student => (
                        <label key={student.userId} className="checkbox-label">
                          <input
                            type="checkbox"
                            value={student.userId}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedStudents([...selectedStudents, student.userName]);
                              } else {
                                setSelectedStudents(selectedStudents.filter(s => s !== student.userName));
                              }
                            }}
                          />
                          {student.userName}
                        </label>
                      ))
                    }
                  </div>
                </div>
              </div>
              
              <div className="modal-actions">
                <button className="cancel-btn" onClick={() => setShowBreakoutModal(false)}>
                  Cancel
                </button>
                <button 
                  className="create-btn"
                  onClick={createBreakoutRoom}
                  disabled={!breakoutRoomName.trim()}
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ============ BREAKOUT ROOM NOTIFICATION ============ */}
        {!inBreakoutRoom && breakoutRooms.length > 0 && role === 'student' && (
          <div className="breakout-notification">
            <p>A breakout room has been created!</p>
            <div className="breakout-rooms-list">
              {breakoutRooms.map(room => (
                <button 
                  key={room.id}
                  className="join-breakout-btn"
                  onClick={() => joinBreakoutRoom(room.id)}
                >
                  Join {room.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ============ BREAKOUT ROOM CONTROLS ============ */}
        {inBreakoutRoom && (
          <div className="breakout-controls">
            <button className="leave-breakout-btn" onClick={leaveBreakoutRoom}>
              Leave Breakout Room
            </button>
            {role === 'teacher' && (
              <button className="end-breakout-btn" onClick={endBreakoutRooms}>
                End All Rooms
              </button>
            )}
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
                {isRecording ? <StopCircle size={22} /> : <PlayCircle size={22} />}
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