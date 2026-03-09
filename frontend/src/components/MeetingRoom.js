// src/components/MeetingRoom.js
import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import {
  Mic, MicOff, Video, VideoOff, Monitor, Users, MessageSquare,
  ScreenShare, LogOut, Copy, Check, Clock, X, VolumeX, Share2,
  Maximize, Minimize, StopCircle, UserPlus, Calendar, Download,
  Play, Pause, DownloadCloud, Grid, Layout, User, Bell,
  Settings, MoreVertical, Paperclip, ThumbsUp, Smile,
  Edit, PenTool, Columns, Minimize2, Maximize2, Radio,
  UserMinus, UserCheck, Video as VideoIcon, Wifi, WifiOff,
  Activity, Download as DownloadIcon, Trash2, Save,
  BookOpen, Users as UsersIcon, MessageCircle, Film,
  Award, PieChart, BarChart, TrendingUp, Clock as ClockIcon,
  DoorOpen, DoorClosed, Users2, ArrowLeft, ArrowRight,
  Plus, Minus, RefreshCw, Home, Settings as SettingsIcon,
  Palette, Eraser, Bold, Italic, Underline, Type,
  Circle, Square, Triangle, Move, Pen, Highlighter
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
  const [layout, setLayout] = useState('grid');
  
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState('00:00');
  const [showRecordingOptions, setShowRecordingOptions] = useState(false);
  
  // ============ BREAKOUT ROOM STATES ============
  const [showBreakoutRooms, setShowBreakoutRooms] = useState(false);
  const [breakoutRooms, setBreakoutRooms] = useState([]);
  const [currentBreakoutRoom, setCurrentBreakoutRoom] = useState(null);
  const [showCreateBreakout, setShowCreateBreakout] = useState(false);
  const [breakoutRoomName, setBreakoutRoomName] = useState('');
  const [selectedParticipants, setSelectedParticipants] = useState([]);
  const [assignedTeachers, setAssignedTeachers] = useState([]);
  const [invitedToBreakout, setInvitedToBreakout] = useState(null);
  const [breakoutCreationStep, setBreakoutCreationStep] = useState(1);
  const [selectedRoomForParticipants, setSelectedRoomForParticipants] = useState(null);
  const [participantAssignment, setParticipantAssignment] = useState({});
  const [showJoinBreakoutPrompt, setShowJoinBreakoutPrompt] = useState(false);
  const [pendingBreakoutInvite, setPendingBreakoutInvite] = useState(null);
  const [breakoutHistory, setBreakoutHistory] = useState([]);
  
  // ============ WHITEBOARD STATES ============
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [whiteboardNotes, setWhiteboardNotes] = useState([]);
  const [currentNote, setCurrentNote] = useState('');
  const [whiteboardMode, setWhiteboardMode] = useState('draw');
  const [whiteboardColor, setWhiteboardColor] = useState('#3b82f6');
  const [whiteboardStrokeWidth, setWhiteboardStrokeWidth] = useState(2);
  const [whiteboardHistory, setWhiteboardHistory] = useState([]);
  const [whiteboardRedoHistory, setWhiteboardRedoHistory] = useState([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPoint, setLastPoint] = useState(null);
  const [canvasContext, setCanvasContext] = useState(null);
  const [canvasElements, setCanvasElements] = useState([]);
  const [selectedElement, setSelectedElement] = useState(null);
  const [showWhiteboardTools, setShowWhiteboardTools] = useState(true);
  const [whiteboardPages, setWhiteboardPages] = useState([{ id: 1, elements: [] }]);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Attendance tracking
  const [attendance, setAttendance] = useState([]);
  const [showAttendance, setShowAttendance] = useState(false);
  const [attendanceStats, setAttendanceStats] = useState({
    totalParticipants: 0,
    averageAttendance: 0,
    peakParticipants: 0,
    duration: '00:00'
  });
  
  // Refs
  const socketRef = useRef(null);
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const chatEndRef = useRef(null);
  const peerConnections = useRef({});
  const screenPeerConnections = useRef({});
  const recordingMediaRecorder = useRef(null);
  const recordedChunks = useRef([]);
  const recordingStartTime = useRef(null);
  const recordingTimer = useRef(null);
  
  // Whiteboard Refs
  const whiteboardCanvasRef = useRef(null);
  const whiteboardContainerRef = useRef(null);
  const textInputRef = useRef(null);

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
      },
      {
        urls: 'turn:openrelay.metered.ca:443?transport=tcp',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ],
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require'
  };

  // ============ SCREEN SHARING FUNCTIONS ============
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

    socketRef.current?.emit('screen-share-stopped', {
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

    if (screenStream) {
      screenStream.getTracks().forEach(track => {
        console.log('Adding screen track to peer connection:', track.kind, 'for user:', targetUserId);
        pc.addTrack(track, screenStream);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('Sending screen ICE candidate to:', targetUserId);
        socketRef.current?.emit('send-screen-ice-candidate', {
          meetingId,
          targetUserId,
          candidate: event.candidate
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('Screen PC ICE connection state for', targetUserId, ':', pc.iceConnectionState);
      
      if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'disconnected') {
        console.log('Screen connection failed for', targetUserId, '- attempting to reconnect');
        setTimeout(() => {
          if (screenStreamRef.current && isScreenSharing) {
            createScreenPeerConnection(targetUserId, screenStreamRef.current);
          }
        }, 2000);
      }
    };

    pc.createOffer()
      .then(offer => pc.setLocalDescription(offer))
      .then(() => {
        console.log('Sending screen offer to:', targetUserId);
        socketRef.current?.emit('send-screen-offer', {
          meetingId,
          targetUserId,
          offer: pc.localDescription
        });
      })
      .catch(error => console.error('Error creating screen offer:', error));

    return pc;
  };

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
      
      if (role === 'teacher' || userId === screenShareParticipant?.userId) {
        const stopBtn = document.createElement('button');
        stopBtn.className = 'stop-screen-share-btn';
        stopBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="8" y1="12" x2="16" y2="12"/></svg> Stop';
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
      
      ensureScreenShareContainer(userName);
      const previewVideo = document.getElementById('screen-share-video');
      if (previewVideo) {
        previewVideo.srcObject = screenStream;
        previewVideo.play().catch(e => console.log('Error playing preview:', e));
      }

      socketRef.current?.emit('screen-share-started', {
        meetingId,
        userId,
        userName
      });

      const videoGrid = document.querySelector('.video-grid');
      if (videoGrid) {
        videoGrid.classList.add('screen-share-active');
      }

      await new Promise(resolve => setTimeout(resolve, 500));

      for (const participant of participants) {
        if (participant.userId !== userId) {
          console.log('Creating screen connection for:', participant.userId);
          createScreenPeerConnection(participant.userId, screenStream);
        }
      }

    } catch (error) {
      console.error('Screen sharing error:', error);
      setScreenShareAvailable(true);
    }
  };

  const handleReceiveScreenOffer = async ({ fromUserId, offer }) => {
    console.log('📥 Received screen offer from:', fromUserId);
    
    try {
      if (!screenPeerConnections.current[fromUserId]) {
        console.log('Creating screen peer connection for receiver:', fromUserId);
        const pc = new RTCPeerConnection(configuration);
        screenPeerConnections.current[fromUserId] = pc;

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            console.log('📤 Sending screen ICE candidate back to:', fromUserId);
            socketRef.current?.emit('send-screen-ice-candidate', {
              meetingId,
              targetUserId: fromUserId,
              candidate: event.candidate
            });
          }
        };

        pc.ontrack = (event) => {
          console.log('📺 Received screen track from:', fromUserId);
          
          const [remoteStream] = event.streams;
          
          if (!remoteStream) {
            console.error('No remote stream received!');
            return;
          }

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
            
            screenVideo.play()
              .then(() => console.log('Screen video playing'))
              .catch(e => console.error('Error playing screen video:', e));
            
            screenVideo.style.display = 'block';
            
            setHasScreenShare(true);
            setScreenShareParticipant({ 
              userId: fromUserId, 
              userName: participants.find(p => p.userId === fromUserId)?.userName || 'Someone' 
            });
          } else {
            console.error('Screen video element not found after creation!');
          }
        };
        
        pc.oniceconnectionstatechange = () => {
          console.log('Screen receiver ICE state for', fromUserId, ':', pc.iceConnectionState);
        };
      }

      const pc = screenPeerConnections.current[fromUserId];

      if (pc.signalingState === 'stable') {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        console.log('Remote description set for screen from:', fromUserId);
        
        const answer = await pc.createAnswer();
        console.log('Created screen answer for:', fromUserId);
        
        await pc.setLocalDescription(answer);
        console.log('Local description set for screen answer');

        console.log('Sending screen answer to:', fromUserId);
        socketRef.current?.emit('send-screen-answer', {
          meetingId,
          targetUserId: fromUserId,
          answer: pc.localDescription
        });
      } else {
        console.log('Peer connection not in stable state, current state:', pc.signalingState);
      }
    } catch (error) {
      console.error('Error handling screen offer:', error);
      
      if (error.name === 'InvalidStateError') {
        console.log('Invalid state error, resetting connection for:', fromUserId);
        if (screenPeerConnections.current[fromUserId]) {
          screenPeerConnections.current[fromUserId].close();
          delete screenPeerConnections.current[fromUserId];
        }
        setTimeout(() => {
          handleReceiveScreenOffer({ fromUserId, offer });
        }, 500);
      }
    }
  };

  const handleReceiveScreenAnswer = async ({ fromUserId, answer }) => {
    console.log('📥 Received screen answer from:', fromUserId);
    
    const pc = screenPeerConnections.current[fromUserId];
    if (pc) {
      try {
        if (pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          console.log('Screen answer set successfully for:', fromUserId);
        } else {
          console.log('Cannot set answer in state:', pc.signalingState);
        }
      } catch (error) {
        console.error('Error handling screen answer:', error);
      }
    }
  };

  const handleReceiveScreenICECandidate = async ({ fromUserId, candidate }) => {
    console.log('📥 Received screen ICE candidate from:', fromUserId);
    
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

  // ============ RECORDING FUNCTIONS ============
  const stopRecording = () => {
    if (recordingMediaRecorder.current && isRecording) {
      recordingMediaRecorder.current.stop();
      setIsRecording(false);
      
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
      }
      
      setRecordingTime('00:00');
      console.log('Recording stopped');
    }
  };

  const saveRecordingInfo = (fileSize) => {
    const recordingInfo = {
      meetingId,
      meetingTopic,
      date: new Date().toISOString(),
      duration: recordingTime,
      fileSize,
      participants: participantCount
    };
    
    const existing = JSON.parse(localStorage.getItem('recordings') || '[]');
    localStorage.setItem('recordings', JSON.stringify([...existing, recordingInfo]));
  };

  const startRecording = async () => {
    if (role !== 'teacher') return;
    
    try {
      setShowRecordingOptions(false);
      
      const streamsToRecord = [];
      
      if (localStreamRef.current) {
        streamsToRecord.push(localStreamRef.current);
      }
      
      if (screenStreamRef.current && isScreenSharing) {
        streamsToRecord.push(screenStreamRef.current);
      }
      
      if (streamsToRecord.length === 0) {
        alert('No streams to record');
        return;
      }
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      canvas.width = 1280;
      canvas.height = 720;
      
      const videoElements = [];
      if (localVideoRef.current) {
        videoElements.push(localVideoRef.current);
      }
      
      const drawCanvas = () => {
        ctx.fillStyle = '#1e1e1e';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        let x = 0;
        let y = 0;
        const width = canvas.width / Math.min(videoElements.length, 2);
        const height = canvas.height / Math.ceil(videoElements.length / 2);
        
        videoElements.forEach((video, index) => {
          if (video.videoWidth) {
            ctx.drawImage(video, x, y, width, height);
          }
          
          x += width;
          if (x >= canvas.width) {
            x = 0;
            y += height;
          }
        });
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, canvas.height - 40, canvas.width, 40);
        
        ctx.fillStyle = 'white';
        ctx.font = '16px Arial';
        ctx.fillText(`${meetingTopic} - ${meetingTime}`, 20, canvas.height - 15);
        ctx.fillText(`Participants: ${participantCount}`, canvas.width - 200, canvas.height - 15);
        
        requestAnimationFrame(drawCanvas);
      };
      
      drawCanvas();
      
      const canvasStream = canvas.captureStream(30);
      
      streamsToRecord.forEach(stream => {
        stream.getAudioTracks().forEach(track => {
          canvasStream.addTrack(track);
        });
      });
      
      const mediaRecorder = new MediaRecorder(canvasStream, {
        mimeType: 'video/webm;codecs=vp9,opus'
      });
      
      recordingMediaRecorder.current = mediaRecorder;
      recordedChunks.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunks.current.push(event.data);
        }
      };
      
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${meetingTopic}_${new Date().toISOString()}.webm`;
        a.click();
        
        saveRecordingInfo(blob.size);
      };
      
      mediaRecorder.start(1000);
      setIsRecording(true);
      recordingStartTime.current = Date.now();
      
      recordingTimer.current = setInterval(() => {
        if (recordingStartTime.current) {
          const elapsed = Date.now() - recordingStartTime.current;
          const minutes = Math.floor(elapsed / 60000);
          const seconds = Math.floor((elapsed % 60000) / 1000);
          setRecordingTime(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
        }
      }, 1000);
      
      console.log('Recording started');
      
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Could not start recording');
    }
  };

  // ============ WHITEBOARD FUNCTIONS ============
  const clearCanvas = () => {
    if (!canvasContext || !whiteboardCanvasRef.current) return;
    
    const canvas = whiteboardCanvasRef.current;
    canvasContext.clearRect(0, 0, canvas.width, canvas.height);
  };

  const redrawCanvas = (elements = canvasElements) => {
    if (!canvasContext || !whiteboardCanvasRef.current) return;
    
    const canvas = whiteboardCanvasRef.current;
    canvasContext.clearRect(0, 0, canvas.width, canvas.height);
    
    elements.forEach(element => {
      if (element.type === 'path' && element.points) {
        canvasContext.beginPath();
        canvasContext.strokeStyle = element.color || whiteboardColor;
        canvasContext.lineWidth = element.width || whiteboardStrokeWidth;
        
        canvasContext.moveTo(element.points[0].x, element.points[0].y);
        for (let i = 1; i < element.points.length; i++) {
          canvasContext.lineTo(element.points[i].x, element.points[i].y);
        }
        canvasContext.stroke();
      }
    });
  };

  const addToCanvas = (element) => {
    if (!canvasContext) return;
    
    if (element.type === 'path' && element.points) {
      canvasContext.beginPath();
      canvasContext.strokeStyle = element.color || whiteboardColor;
      canvasContext.lineWidth = element.width || whiteboardStrokeWidth;
      
      canvasContext.moveTo(element.points[0].x, element.points[0].y);
      for (let i = 1; i < element.points.length; i++) {
        canvasContext.lineTo(element.points[i].x, element.points[i].y);
      }
      canvasContext.stroke();
    }
  };

  const startDrawing = (e) => {
    if (!showWhiteboard || !canvasContext) return;
    
    const rect = whiteboardCanvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setIsDrawing(true);
    setLastPoint({ x, y });
    
    canvasContext.beginPath();
    canvasContext.moveTo(x, y);
    
    if (whiteboardMode === 'draw') {
      canvasContext.strokeStyle = whiteboardColor;
      canvasContext.lineWidth = whiteboardStrokeWidth;
    }
  };

  const draw = (e) => {
    if (!isDrawing || !lastPoint || !canvasContext) return;
    
    e.preventDefault();
    
    const rect = whiteboardCanvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (whiteboardMode === 'draw') {
      canvasContext.lineTo(x, y);
      canvasContext.stroke();
      
      const element = {
        id: Date.now() + Math.random(),
        type: 'path',
        points: [{ x: lastPoint.x, y: lastPoint.y }, { x, y }],
        color: whiteboardColor,
        width: whiteboardStrokeWidth,
        timestamp: Date.now()
      };
      
      setCanvasElements(prev => [...prev, element]);
      setWhiteboardHistory(prev => [...prev, element]);
      
      socketRef.current?.emit('whiteboard-element-added', {
        meetingId,
        element,
        page: currentPage
      });
    }
    
    setLastPoint({ x, y });
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    setLastPoint(null);
  };

  const clearWhiteboard = () => {
    if (!canvasContext) return;
    
    const canvas = whiteboardCanvasRef.current;
    canvasContext.clearRect(0, 0, canvas.width, canvas.height);
    setCanvasElements([]);
    setWhiteboardHistory([]);
    setWhiteboardRedoHistory([]);
    
    socketRef.current?.emit('whiteboard-cleared', {
      meetingId,
      page: currentPage
    });
  };

  const undoWhiteboard = () => {
    if (whiteboardHistory.length === 0) return;
    
    const lastElement = whiteboardHistory[whiteboardHistory.length - 1];
    setWhiteboardRedoHistory(prev => [...prev, lastElement]);
    
    const newHistory = whiteboardHistory.slice(0, -1);
    setWhiteboardHistory(newHistory);
    setCanvasElements(newHistory);
    redrawCanvas(newHistory);
    
    socketRef.current?.emit('whiteboard-update', {
      meetingId,
      elements: newHistory,
      page: currentPage
    });
  };

  const redoWhiteboard = () => {
    if (whiteboardRedoHistory.length === 0) return;
    
    const nextElement = whiteboardRedoHistory[whiteboardRedoHistory.length - 1];
    setWhiteboardHistory(prev => [...prev, nextElement]);
    setWhiteboardRedoHistory(prev => prev.slice(0, -1));
    setCanvasElements(prev => [...prev, nextElement]);
    addToCanvas(nextElement);
    
    socketRef.current?.emit('whiteboard-element-added', {
      meetingId,
      element: nextElement,
      page: currentPage
    });
  };

  const saveWhiteboardNote = () => {
    if (!currentNote.trim()) return;
    
    const note = {
      id: Date.now().toString(),
      content: currentNote,
      author: userName,
      role,
      timestamp: new Date().toISOString(),
      page: currentPage,
      elements: canvasElements
    };
    
    setWhiteboardNotes(prev => [...prev, note]);
    setCurrentNote('');
    
    const existing = JSON.parse(localStorage.getItem(`whiteboard_${meetingId}`) || '[]');
    localStorage.setItem(`whiteboard_${meetingId}`, JSON.stringify([...existing, note]));
  };

  const loadWhiteboardNote = (note) => {
    setCanvasElements(note.elements || []);
    redrawCanvas(note.elements);
    
    const message = {
      id: Date.now().toString(),
      type: 'system',
      text: `Loaded whiteboard note from ${note.author}`,
      timestamp: new Date().toLocaleTimeString()
    };
    setMessages(prev => [...prev, message]);
  };

  const deleteWhiteboardNote = (noteId) => {
    if (role !== 'teacher') return;
    
    setWhiteboardNotes(prev => prev.filter(n => n.id !== noteId));
    
    const existing = JSON.parse(localStorage.getItem(`whiteboard_${meetingId}`) || '[]');
    localStorage.setItem(`whiteboard_${meetingId}`, JSON.stringify(existing.filter(n => n.id !== noteId)));
  };

  const addWhiteboardPage = () => {
    const newPage = {
      id: whiteboardPages.length + 1,
      elements: []
    };
    setWhiteboardPages(prev => [...prev, newPage]);
    setCurrentPage(newPage.id);
    setCanvasElements([]);
    clearWhiteboard();
  };

  const switchWhiteboardPage = (pageId) => {
    const page = whiteboardPages.find(p => p.id === pageId);
    if (page) {
      setCurrentPage(pageId);
      setCanvasElements(page.elements);
      redrawCanvas(page.elements);
      
      socketRef.current?.emit('whiteboard-page-changed', {
        meetingId,
        page
      });
    }
  };

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
        socketRef.current?.emit('send-ice-candidate', {
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
        socketRef.current?.emit('send-offer', {
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
          socketRef.current?.emit('send-ice-candidate', {
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

      socketRef.current?.emit('send-answer', {
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
      
      setAttendanceStats(prev => ({
        ...prev,
        duration: `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
      }));
    }, 1000);

    return () => clearInterval(timer);
  }, [meetingStartTime]);

  // ============ BREAKOUT ROOM FUNCTIONS ============
  const startBreakoutCreation = () => {
    setBreakoutCreationStep(1);
    setShowCreateBreakout(true);
    setBreakoutRoomName('');
    setSelectedParticipants([]);
    setAssignedTeachers([]);
    setSelectedRoomForParticipants(null);
    setParticipantAssignment({});
  };

  const createBreakoutRooms = (assignmentType) => {
    if (role !== 'teacher') return;
    
    if (assignmentType === 'automatic') {
      const numRooms = parseInt(breakoutRoomName) || 2;
      const rooms = [];
      const participantsPerRoom = Math.ceil(participants.length / numRooms);
      
      for (let i = 0; i < numRooms; i++) {
        const roomParticipants = participants.slice(
          i * participantsPerRoom, 
          (i + 1) * participantsPerRoom
        ).map(p => p.userId);
        
        rooms.push({
          id: `room_${Date.now()}_${i}`,
          name: `Room ${i + 1}`,
          participants: roomParticipants,
          teachers: role === 'teacher' ? [userId] : [],
          createdAt: new Date().toISOString()
        });
      }
      
      setBreakoutRooms(rooms);
      
      socketRef.current?.emit('create-breakout-rooms', {
        meetingId,
        rooms,
        assignmentType: 'automatic'
      });
      
      rooms.forEach(room => {
        room.participants.forEach(participantId => {
          socketRef.current?.emit('invite-to-breakout', {
            meetingId,
            userId: participantId,
            roomId: room.id,
            roomName: room.name,
            assignedBy: userName
          });
        });
      });
      
    } else {
      setBreakoutCreationStep(2);
    }
    
    setShowCreateBreakout(false);
    setBreakoutHistory(prev => [...prev, { 
      action: 'rooms_created', 
      type: assignmentType,
      timestamp: new Date() 
    }]);
  };

  const createCustomBreakoutRoom = () => {
    if (role !== 'teacher') return;
    
    const newRoom = {
      id: `room_${Date.now()}`,
      name: breakoutRoomName || `Room ${breakoutRooms.length + 1}`,
      participants: selectedParticipants,
      teachers: assignedTeachers.length > 0 ? assignedTeachers : [userId],
      createdAt: new Date().toISOString(),
      createdBy: userName
    };
    
    const updatedRooms = [...breakoutRooms, newRoom];
    setBreakoutRooms(updatedRooms);
    
    socketRef.current?.emit('create-breakout-room', {
      meetingId,
      room: newRoom,
      allRooms: updatedRooms
    });
    
    selectedParticipants.forEach(participantId => {
      socketRef.current?.emit('invite-to-breakout', {
        meetingId,
        userId: participantId,
        roomId: newRoom.id,
        roomName: newRoom.name,
        assignedBy: userName
      });
    });
    
    setShowCreateBreakout(false);
    setBreakoutRoomName('');
    setSelectedParticipants([]);
    setAssignedTeachers([]);
    setBreakoutCreationStep(1);
  };

  const assignParticipantToRoom = (participantId, roomId) => {
    if (role !== 'teacher') return;
    
    setParticipantAssignment(prev => ({
      ...prev,
      [participantId]: roomId
    }));
    
    setBreakoutRooms(prev => prev.map(room => {
      if (room.id === roomId) {
        return {
          ...room,
          participants: [...(room.participants || []), participantId]
        };
      }
      if (room.participants?.includes(participantId)) {
        return {
          ...room,
          participants: room.participants.filter(id => id !== participantId)
        };
      }
      return room;
    }));
    
    const participant = participants.find(p => p.userId === participantId);
    const room = breakoutRooms.find(r => r.id === roomId);
    
    if (participant && room) {
      socketRef.current?.emit('assign-to-breakout', {
        meetingId,
        userId: participantId,
        roomId,
        roomName: room.name,
        assignedBy: userName
      });
    }
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
      
      setInvitedToBreakout(null);
      setPendingBreakoutInvite(null);
      setShowJoinBreakoutPrompt(false);
    }
  };

  const leaveBreakoutRoom = () => {
    if (currentBreakoutRoom) {
      socketRef.current?.emit('leave-breakout-room', {
        meetingId,
        roomId: currentBreakoutRoom.id,
        userId,
        userName
      });
      
      setCurrentBreakoutRoom(null);
    }
  };

  const closeBreakoutRoom = (roomId) => {
    if (role !== 'teacher') return;
    
    const updatedRooms = breakoutRooms.filter(r => r.id !== roomId);
    setBreakoutRooms(updatedRooms);
    
    socketRef.current?.emit('close-breakout-room', {
      meetingId,
      roomId,
      allRooms: updatedRooms
    });
    
    if (currentBreakoutRoom?.id === roomId) {
      setCurrentBreakoutRoom(null);
    }
  };

  const broadcastToBreakoutRooms = (message) => {
    if (role !== 'teacher') return;
    
    socketRef.current?.emit('broadcast-to-breakout-rooms', {
      meetingId,
      message,
      from: userName
    });
    
    const systemMessage = {
      id: Date.now().toString(),
      type: 'system',
      text: `📢 Broadcast: ${message}`,
      timestamp: new Date().toLocaleTimeString()
    };
    setMessages(prev => [...prev, systemMessage]);
  };

  const closeAllBreakoutRooms = () => {
    if (role !== 'teacher') return;
    
    setBreakoutRooms([]);
    setCurrentBreakoutRoom(null);
    
    socketRef.current?.emit('close-all-breakout-rooms', {
      meetingId
    });
    
    const systemMessage = {
      id: Date.now().toString(),
      type: 'system',
      text: 'All breakout rooms have been closed. Everyone is back in the main meeting.',
      timestamp: new Date().toLocaleTimeString()
    };
    setMessages(prev => [...prev, systemMessage]);
  };

  // ============ ATTENDANCE TRACKING ============
  const trackAttendance = (action, uid, name = null) => {
    const timestamp = new Date().toISOString();
    const participantName = name || (uid === userId ? userName : participants.find(p => p.userId === uid)?.userName || 'Unknown');
    
    const record = {
      userId: uid,
      userName: participantName,
      action,
      timestamp,
      meetingId,
      meetingTopic,
      role: uid === userId ? role : (participants.find(p => p.userId === uid)?.role || 'unknown'),
      breakoutRoom: currentBreakoutRoom?.name || null
    };
    
    setAttendance(prev => [...prev, record]);
    
    const existing = JSON.parse(localStorage.getItem(`attendance_${meetingId}`) || '[]');
    localStorage.setItem(`attendance_${meetingId}`, JSON.stringify([...existing, record]));
  };

  const updateAttendanceStats = (currentCount) => {
    setAttendanceStats(prev => ({
      ...prev,
      totalParticipants: Math.max(prev.totalParticipants, currentCount),
      peakParticipants: Math.max(prev.peakParticipants, currentCount),
      averageAttendance: prev.averageAttendance ? 
        (prev.averageAttendance + currentCount) / 2 : currentCount
    }));
  };

  const saveAttendanceReport = () => {
    const participantDurations = {};
    
    attendance.forEach(record => {
      if (!participantDurations[record.userId]) {
        participantDurations[record.userId] = {
          name: record.userName,
          role: record.role,
          joinTime: null,
          leaveTime: null,
          totalDuration: 0,
          breakoutRooms: []
        };
      }
      
      if (record.action === 'join') {
        participantDurations[record.userId].joinTime = new Date(record.timestamp);
      } else if (record.action === 'leave' || record.action === 'disconnect' || record.action === 'meeting_end') {
        participantDurations[record.userId].leaveTime = new Date(record.timestamp);
        
        if (participantDurations[record.userId].joinTime) {
          const duration = participantDurations[record.userId].leaveTime - participantDurations[record.userId].joinTime;
          participantDurations[record.userId].totalDuration += duration;
        }
      }
      
      if (record.breakoutRoom) {
        participantDurations[record.userId].breakoutRooms.push({
          room: record.breakoutRoom,
          time: record.timestamp
        });
      }
    });
    
    const report = {
      meetingId,
      meetingTopic,
      startTime: meetingStartTime.toISOString(),
      endTime: new Date().toISOString(),
      totalDuration: meetingTime,
      peakParticipants: attendanceStats.peakParticipants,
      totalUniqueParticipants: Object.keys(participantDurations).length,
      breakoutRooms: breakoutRooms.map(room => ({
        name: room.name,
        participants: room.participants?.length || 0,
        duration: meetingTime
      })),
      participants: Object.values(participantDurations).map(p => ({
        ...p,
        joinTime: p.joinTime?.toISOString(),
        leaveTime: p.leaveTime?.toISOString(),
        durationMinutes: Math.round(p.totalDuration / 60000)
      }))
    };
    
    localStorage.setItem(`attendance_report_${meetingId}`, JSON.stringify(report));
    
    if (role === 'teacher') {
      const teacherReports = JSON.parse(localStorage.getItem('teacherAttendanceReports') || '[]');
      teacherReports.push(report);
      localStorage.setItem('teacherAttendanceReports', JSON.stringify(teacherReports));
    }
  };

  const downloadAttendanceReport = () => {
    const report = JSON.parse(localStorage.getItem(`attendance_report_${meetingId}`) || '{}');
    
    const csv = [
      ['User ID', 'Name', 'Role', 'Join Time', 'Leave Time', 'Duration (minutes)'],
      ...report.participants?.map(p => [
        p.userId,
        p.name,
        p.role,
        p.joinTime ? new Date(p.joinTime).toLocaleString() : '',
        p.leaveTime ? new Date(p.leaveTime).toLocaleString() : '',
        p.durationMinutes
      ]) || []
    ].map(row => row.join(',')).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendance_${meetingTopic}_${new Date().toISOString()}.csv`;
    a.click();
  };

  // ============ CHAT ============
  const sendChatMessage = (e) => {
    e.preventDefault();
    if (!chatMessage.trim() || connectionStatus !== 'connected') return;

    const message = {
      id: Date.now().toString(),
      userId,
      userName,
      text: chatMessage,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      breakoutRoom: currentBreakoutRoom?.name || null
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

  // ============ UI FUNCTIONS ============
  const toggleParticipants = () => {
    setShowParticipants(!showParticipants);
    setShowChat(false);
    setShowWhiteboard(false);
    setShowAttendance(false);
  };

  const toggleChat = () => {
    setShowChat(!showChat);
    setShowParticipants(false);
    setShowWhiteboard(false);
    setShowAttendance(false);
    if (!showChat) setUnreadMessages(0);
  };

  const toggleWhiteboard = () => {
    setShowWhiteboard(!showWhiteboard);
    setShowParticipants(false);
    setShowChat(false);
    setShowAttendance(false);
    
    if (!showWhiteboard) {
      const notes = JSON.parse(localStorage.getItem(`whiteboard_${meetingId}`) || '[]');
      setWhiteboardNotes(notes);
    }
  };

  const toggleAttendance = () => {
    setShowAttendance(!showAttendance);
    setShowParticipants(false);
    setShowChat(false);
    setShowWhiteboard(false);
    
    if (!showAttendance) {
      const report = JSON.parse(localStorage.getItem(`attendance_report_${meetingId}`) || '{}');
      if (report.participants) {
        setAttendance(report.participants);
      }
    }
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
      if (p.role !== 'teacher') {
        socketRef.current?.emit('mute-participant', { meetingId, userId: p.userId });
      }
    });
  };

  const leaveMeetingOnly = () => {
    trackAttendance('leave', userId);
    saveAttendanceReport();
    
    if (isScreenSharing) {
      stopScreenSharing();
    }
    
    if (isRecording) {
      stopRecording();
    }
    
    if (currentBreakoutRoom) {
      leaveBreakoutRoom();
    }
    
    navigate(role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard');
  };

  const endMeetingForAll = () => {
    if (role !== 'teacher') return;
    
    trackAttendance('meeting_end', userId);
    saveAttendanceReport();
    
    if (isScreenSharing) {
      stopScreenSharing();
    }
    
    if (isRecording) {
      stopRecording();
    }
    
    socketRef.current?.emit('end-meeting', { meetingId });
    navigate('/teacher/dashboard');
  };

  // ============ WHITEBOARD INITIALIZATION ============
  useEffect(() => {
    if (showWhiteboard && whiteboardCanvasRef.current) {
      const canvas = whiteboardCanvasRef.current;
      const ctx = canvas.getContext('2d');
      
      const container = whiteboardContainerRef.current;
      if (container) {
        canvas.width = container.clientWidth - 40;
        canvas.height = container.clientHeight - 100;
      }
      
      ctx.strokeStyle = whiteboardColor;
      ctx.lineWidth = whiteboardStrokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      setCanvasContext(ctx);
      
      redrawCanvas();
    }
  }, [showWhiteboard, whiteboardColor, whiteboardStrokeWidth]);

  // ============ SOCKET EVENT HANDLERS ============
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
      
      trackAttendance('join', newUserId);
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
      
      trackAttendance('disconnect', newUserId);
    });

    socket.on('all-users', (users) => {
      console.log('👥 All users:', users);
      setParticipants(users);
      setParticipantCount(users.length + 1);
      
      updateAttendanceStats(users.length + 1);
      
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
      
      updateAttendanceStats(participantCount + 1);
      
      trackAttendance('join', user.userId, user.userName);
      
      if (!peerConnections.current[user.userId]) {
        createPeerConnection(user.userId);
      }

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
    
    socket.on('screen-share-started', ({ userId: sharerId, userName: sharerName }) => {
      console.log('📺 Screen sharing started by:', sharerName || 'Someone');
      
      setScreenShareParticipant({ userId: sharerId, userName: sharerName || 'Someone' });
      setHasScreenShare(true);
      
      const videoGrid = document.querySelector('.video-grid');
      if (videoGrid) {
        videoGrid.classList.add('screen-share-active');
      }
      
      ensureScreenShareContainer(sharerName || 'Someone');
    });

    socket.on('screen-share-stopped', ({ userId: sharerId }) => {
      console.log('📺 Screen sharing stopped by:', sharerId);
      
      if (screenShareParticipant?.userId === sharerId) {
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
      
      if (screenPeerConnections.current[sharerId]) {
        screenPeerConnections.current[sharerId].close();
        delete screenPeerConnections.current[sharerId];
      }
    });

    socket.on('receive-screen-offer', handleReceiveScreenOffer);
    socket.on('receive-screen-answer', handleReceiveScreenAnswer);
    socket.on('receive-screen-ice-candidate', handleReceiveScreenICECandidate);
    
    socket.on('breakout-room-created', ({ rooms }) => {
      setBreakoutRooms(rooms);
      setBreakoutHistory(prev => [...prev, { action: 'created', rooms, timestamp: new Date() }]);
    });
    
    socket.on('invited-to-breakout', ({ roomId, roomName, assignedBy }) => {
      setPendingBreakoutInvite({ roomId, roomName, assignedBy });
      setShowJoinBreakoutPrompt(true);
    });
    
    socket.on('joined-breakout', ({ roomId, roomName, participants, allRooms }) => {
      setCurrentBreakoutRoom({ id: roomId, name: roomName, participants });
      setBreakoutRooms(allRooms);
      setShowBreakoutRooms(false);
      setShowJoinBreakoutPrompt(false);
      setPendingBreakoutInvite(null);
      
      const message = {
        id: Date.now().toString(),
        type: 'system',
        text: `You joined breakout room: ${roomName}`,
        timestamp: new Date().toLocaleTimeString()
      };
      setMessages(prev => [...prev, message]);
    });
    
    socket.on('left-breakout', ({ allRooms }) => {
      setCurrentBreakoutRoom(null);
      setBreakoutRooms(allRooms);
      
      const message = {
        id: Date.now().toString(),
        type: 'system',
        text: 'You returned to the main meeting',
        timestamp: new Date().toLocaleTimeString()
      };
      setMessages(prev => [...prev, message]);
    });
    
    socket.on('breakout-room-updated', ({ roomId, participants, allRooms }) => {
      setBreakoutRooms(allRooms);
      
      if (currentBreakoutRoom?.id === roomId) {
        setCurrentBreakoutRoom(prev => ({ ...prev, participants }));
      }
    });
    
    socket.on('participant-assigned-to-room', ({ userId, roomId, roomName }) => {
      if (userId === newUserId) {
        setInvitedToBreakout({ roomId, roomName });
      }
    });
    
    socket.on('breakout-room-closed', ({ roomId, allRooms }) => {
      setBreakoutRooms(allRooms);
      
      if (currentBreakoutRoom?.id === roomId) {
        setCurrentBreakoutRoom(null);
        
        const message = {
          id: Date.now().toString(),
          type: 'system',
          text: 'The breakout room was closed by the teacher',
          timestamp: new Date().toLocaleTimeString()
        };
        setMessages(prev => [...prev, message]);
      }
    });

    socket.on('whiteboard-update', ({ elements, page }) => {
      setCanvasElements(elements);
      if (page) {
        setWhiteboardPages(prev => prev.map(p => 
          p.id === page.id ? page : p
        ));
      }
      redrawCanvas(elements);
    });
    
    socket.on('whiteboard-element-added', ({ element }) => {
      setCanvasElements(prev => [...prev, element]);
      addToCanvas(element);
    });
    
    socket.on('whiteboard-element-updated', ({ elementId, updates }) => {
      setCanvasElements(prev => prev.map(el => 
        el.id === elementId ? { ...el, ...updates } : el
      ));
      redrawCanvas();
    });
    
    socket.on('whiteboard-element-deleted', ({ elementId }) => {
      setCanvasElements(prev => prev.filter(el => el.id !== elementId));
      redrawCanvas();
    });
    
    socket.on('whiteboard-cleared', () => {
      setCanvasElements([]);
      clearCanvas();
    });
    
    socket.on('whiteboard-page-changed', ({ page }) => {
      setCurrentPage(page.id);
      setCanvasElements(page.elements);
      redrawCanvas(page.elements);
    });

    socket.on('user-left', (leftUserId) => {
      console.log('👋 User left:', leftUserId);
      
      trackAttendance('leave', leftUserId);
      
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
      
      updateAttendanceStats(participantCount - 1);
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
      trackAttendance('meeting_end', newUserId);
      saveAttendanceReport();
      
      alert('Meeting ended by host');
      navigate(role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard');
    });

    trackAttendance('join', newUserId);

    return () => {
      trackAttendance('leave', newUserId);
      saveAttendanceReport();
      
      if (isRecording) {
        stopRecording();
      }
      
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
        if (currentBreakoutRoom) {
          socketRef.current.emit('leave-breakout-room', { 
            meetingId, 
            roomId: currentBreakoutRoom.id, 
            userId: newUserId 
          });
        }
        socketRef.current.emit('leave-meeting', { meetingId, userId: newUserId });
        socketRef.current.disconnect();
      }
      
      if (recordingTimer.current) {
        clearInterval(recordingTimer.current);
      }
    };
  }, [meetingId, role]);

  // ============ RENDER ============
  const totalParticipants = participants.length + 1;

  return (
    <div className="meeting-room">
      {/* Connection Banner */}
      {connectionStatus !== 'connected' && (
        <div className={`connection-banner ${connectionStatus}`}>
          {connectionStatus === 'connecting' && (
            <>
              <WifiOff size={16} />
              Connecting to server...
            </>
          )}
          {connectionStatus === 'error' && (
            <>
              <WifiOff size={16} />
              Connection failed. Retrying...
            </>
          )}
        </div>
      )}

      {/* Recording Indicator */}
      {isRecording && (
        <div className="recording-indicator">
          <div className="recording-dot"></div>
          <span>Recording {recordingTime}</span>
          <button className="stop-recording-btn" onClick={stopRecording}>
            <StopCircle size={16} />
          </button>
        </div>
      )}

      {/* Screen Share Banner */}
      {hasScreenShare && screenShareParticipant && screenShareParticipant.userId !== userId && !isScreenSharing && (
        <div className="screen-share-banner">
          <Monitor size={16} />
          <span>{screenShareParticipant.userName || 'Someone'} is sharing their screen</span>
          <button className="view-fullscreen-btn" onClick={toggleFullscreen}>
            <Maximize2 size={14} />
          </button>
        </div>
      )}

      {/* Breakout Room Join Prompt */}
      {showJoinBreakoutPrompt && pendingBreakoutInvite && (
        <div className="breakout-join-prompt">
          <div className="prompt-content">
            <DoorOpen size={24} />
            <div className="prompt-text">
              <h4>Join Breakout Room</h4>
              <p>{pendingBreakoutInvite.assignedBy} invited you to: <strong>{pendingBreakoutInvite.roomName}</strong></p>
            </div>
            <div className="prompt-actions">
              <button 
                className="join-btn"
                onClick={() => joinBreakoutRoom(pendingBreakoutInvite.roomId)}
              >
                Join Now
              </button>
              <button 
                className="later-btn"
                onClick={() => setShowJoinBreakoutPrompt(false)}
              >
                Later
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="meeting-header">
        <div className="header-left">
          <span className="meeting-time">
            <Clock size={16} />
            {meetingTime}
          </span>
          {currentBreakoutRoom && (
            <span className="breakout-badge">
              <DoorOpen size={14} />
              {currentBreakoutRoom.name}
              <button 
                className="leave-breakout-btn"
                onClick={leaveBreakoutRoom}
                title="Return to main meeting"
              >
                <ArrowLeft size={14} />
              </button>
            </span>
          )}
        </div>

        <div className="header-center">
          <div className="meeting-title">{meetingTopic}</div>
          <div className="participant-count" onClick={toggleParticipants}>
            <Users size={16} />
            <span>{totalParticipants}</span>
          </div>
        </div>

        <div className="header-right">
          <button className="icon-btn" onClick={copyMeetingLink} title="Copy meeting link">
            {linkCopied ? <Check size={18} /> : <Share2 size={18} />}
          </button>
          <button className="icon-btn" onClick={toggleFullscreen} title="Toggle fullscreen">
            {isFullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
          <button className="icon-btn" title="More options">
            <MoreVertical size={18} />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="meeting-main">
        <div className={`video-container ${showParticipants || showChat || showWhiteboard || showAttendance ? 'with-sidebar' : ''}`}>
          
          {/* Video Grid */}
          <div className={`video-grid ${layout} ${hasScreenShare ? 'screen-share-active' : ''}`}>
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
                <div className="video-placeholder visible">
                  <div className="avatar">
                    {userName?.charAt(0).toUpperCase()}
                  </div>
                </div>
              )}
              <div className="video-label">
                <span className="name">{userName} (You)</span>
                {role === 'teacher' && <span className="host-badge">HOST</span>}
                {!micOn && <MicOff size={14} />}
                {currentBreakoutRoom && (
                  <span className="breakout-badge-small">
                    <DoorOpen size={10} />
                    {currentBreakoutRoom.name}
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
                <div className={`video-placeholder ${!participant.videoEnabled ? 'visible' : 'hidden'}`}>
                  <div className="avatar">
                    {participant.userName?.charAt(0).toUpperCase()}
                  </div>
                </div>
                <div className="video-label">
                  <span className="name">{participant.userName}</span>
                  {participant.role === 'teacher' && <span className="host-badge">HOST</span>}
                  {!participant.audioEnabled && <MicOff size={14} />}
                </div>
                {role === 'teacher' && participant.role !== 'teacher' && (
                  <button 
                    className="mute-overlay"
                    onClick={() => muteParticipant(participant.userId)}
                    title="Mute participant"
                  >
                    <VolumeX size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Layout Controls */}
          <div className="layout-controls">
            <button 
              className={`layout-btn ${layout === 'grid' ? 'active' : ''}`}
              onClick={() => setLayout('grid')}
              title="Grid view"
            >
              <Grid size={18} />
            </button>
            <button 
              className={`layout-btn ${layout === 'speaker' ? 'active' : ''}`}
              onClick={() => setLayout('speaker')}
              title="Speaker view"
            >
              <Layout size={18} />
            </button>
            <button 
              className={`layout-btn ${layout === 'sidebar' ? 'active' : ''}`}
              onClick={() => setLayout('sidebar')}
              title="Sidebar view"
            >
              <Columns size={18} />
            </button>
          </div>
        </div>

        {/* Participants Sidebar */}
        {showParticipants && (
          <div className="sidebar participants-sidebar">
            <div className="sidebar-header">
              <h3>
                <Users size={16} />
                Participants ({totalParticipants})
              </h3>
              <div className="sidebar-actions">
                {role === 'teacher' && (
                  <button className="sidebar-action" onClick={muteAllParticipants} title="Mute all">
                    <VolumeX size={16} />
                  </button>
                )}
                <button className="close-btn" onClick={toggleParticipants}>
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="participants-list scrollable">
              <div className="participant-item current">
                <div className="avatar-small">
                  {userName.charAt(0).toUpperCase()}
                </div>
                <div className="participant-info">
                  <span className="name">{userName} (You)</span>
                  <span className="status">
                    {micOn ? 'Mic on' : 'Muted'} • {cameraOn ? 'Camera on' : 'Camera off'}
                    {currentBreakoutRoom && ` • In: ${currentBreakoutRoom.name}`}
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
                    </span>
                  </div>
                  {role === 'teacher' && p.role !== 'teacher' && (
                    <button 
                      className="mute-small"
                      onClick={() => muteParticipant(p.userId)}
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
          <div className="sidebar chat-sidebar">
            <div className="sidebar-header">
              <h3>
                <MessageSquare size={16} />
                Chat
                {currentBreakoutRoom && (
                  <span className="room-indicator">{currentBreakoutRoom.name}</span>
                )}
              </h3>
              <button className="close-btn" onClick={toggleChat}>
                <X size={18} />
              </button>
            </div>
            <div className="chat-messages scrollable">
              {messages.map(msg => (
                <div key={msg.id} className={`chat-message ${msg.userId === userId ? 'own' : ''} ${msg.type === 'system' ? 'system' : ''}`}>
                  {msg.type !== 'system' && msg.userId !== userId && (
                    <div className="message-sender">{msg.userName}</div>
                  )}
                  <div className="message-text">{msg.text}</div>
                  <div className="message-time">{msg.timestamp}</div>
                  {msg.breakoutRoom && (
                    <div className="message-room">{msg.breakoutRoom}</div>
                  )}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <form className="chat-input" onSubmit={sendChatMessage}>
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder={`Type a message${currentBreakoutRoom ? ` in ${currentBreakoutRoom.name}` : ''}...`}
                disabled={connectionStatus !== 'connected'}
              />
              <button type="submit" disabled={!chatMessage.trim()}>
                Send
              </button>
            </form>
          </div>
        )}

        {/* Whiteboard Sidebar */}
        {showWhiteboard && (
          <div className="sidebar whiteboard-sidebar">
            <div className="sidebar-header">
              <h3>
                <PenTool size={16} />
                Whiteboard
                {currentBreakoutRoom && (
                  <span className="room-indicator">{currentBreakoutRoom.name}</span>
                )}
              </h3>
              <div className="sidebar-actions">
                <button 
                  className={`tool-btn ${whiteboardMode === 'draw' ? 'active' : ''}`}
                  onClick={() => setWhiteboardMode('draw')}
                  title="Draw"
                >
                  <Pen size={16} />
                </button>
                <button 
                  className={`tool-btn ${whiteboardMode === 'text' ? 'active' : ''}`}
                  onClick={() => setWhiteboardMode('text')}
                  title="Text"
                >
                  <Type size={16} />
                </button>
                <button 
                  className="tool-btn"
                  onClick={undoWhiteboard}
                  title="Undo"
                  disabled={whiteboardHistory.length === 0}
                >
                  <ArrowLeft size={16} />
                </button>
                <button 
                  className="tool-btn"
                  onClick={redoWhiteboard}
                  title="Redo"
                  disabled={whiteboardRedoHistory.length === 0}
                >
                  <ArrowRight size={16} />
                </button>
                <button 
                  className="tool-btn"
                  onClick={clearWhiteboard}
                  title="Clear all"
                >
                  <Eraser size={16} />
                </button>
                <button className="close-btn" onClick={toggleWhiteboard}>
                  <X size={18} />
                </button>
              </div>
            </div>
            
            <div className="whiteboard-tools">
              <div className="color-picker">
                <input
                  type="color"
                  value={whiteboardColor}
                  onChange={(e) => setWhiteboardColor(e.target.value)}
                  title="Color"
                />
              </div>
              <div className="stroke-width">
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={whiteboardStrokeWidth}
                  onChange={(e) => setWhiteboardStrokeWidth(parseInt(e.target.value))}
                  title="Stroke width"
                />
                <span>{whiteboardStrokeWidth}px</span>
              </div>
              <div className="page-controls">
                <button 
                  className="page-btn"
                  onClick={() => switchWhiteboardPage(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  <ArrowLeft size={14} />
                </button>
                <span>Page {currentPage} / {whiteboardPages.length}</span>
                <button 
                  className="page-btn"
                  onClick={() => switchWhiteboardPage(currentPage + 1)}
                  disabled={currentPage === whiteboardPages.length}
                >
                  <ArrowRight size={14} />
                </button>
                {role === 'teacher' && (
                  <button 
                    className="page-btn add-page"
                    onClick={addWhiteboardPage}
                    title="Add page"
                  >
                    <Plus size={14} />
                  </button>
                )}
              </div>
            </div>

            <div 
              className="whiteboard-canvas-container" 
              ref={whiteboardContainerRef}
            >
              <canvas
                ref={whiteboardCanvasRef}
                className="whiteboard-canvas"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
              />
            </div>

            <div className="whiteboard-notes-section">
              <h4>
                <BookOpen size={14} />
                Notes
              </h4>
              <textarea
                className="note-input"
                value={currentNote}
                onChange={(e) => setCurrentNote(e.target.value)}
                placeholder="Add a note..."
                rows={2}
              />
              <button className="save-note-btn" onClick={saveWhiteboardNote}>
                <Save size={14} />
                Save Note
              </button>
              
              <div className="notes-list scrollable">
                {whiteboardNotes.map(note => (
                  <div key={note.id} className="note-item">
                    <div className="note-header">
                      <span className="note-author">{note.author}</span>
                      <span className="note-time">
                        {new Date(note.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="note-content">{note.content}</div>
                    <div className="note-actions">
                      <button 
                        className="load-note-btn"
                        onClick={() => loadWhiteboardNote(note)}
                      >
                        Load
                      </button>
                      {role === 'teacher' && (
                        <button 
                          className="delete-note-btn"
                          onClick={() => deleteWhiteboardNote(note.id)}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Attendance Sidebar */}
        {showAttendance && (
          <div className="sidebar attendance-sidebar">
            <div className="sidebar-header">
              <h3>
                <Calendar size={16} />
                Attendance Report
              </h3>
              <div className="sidebar-actions">
                <button className="sidebar-action" onClick={downloadAttendanceReport} title="Download CSV">
                  <Download size={16} />
                </button>
                <button className="close-btn" onClick={toggleAttendance}>
                  <X size={18} />
                </button>
              </div>
            </div>
            <div className="attendance-stats">
              <div className="stat-item">
                <span className="stat-label">Total Participants</span>
                <span className="stat-value">{attendanceStats.totalParticipants}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Peak</span>
                <span className="stat-value">{attendanceStats.peakParticipants}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Duration</span>
                <span className="stat-value">{attendanceStats.duration}</span>
              </div>
            </div>
            
            {breakoutRooms.length > 0 && (
              <div className="breakout-summary">
                <h4>
                  <DoorOpen size={14} />
                  Breakout Rooms
                </h4>
                {breakoutRooms.map(room => (
                  <div key={room.id} className="breakout-stat">
                    <span>{room.name}</span>
                    <span>{room.participants?.length || 0} participants</span>
                  </div>
                ))}
              </div>
            )}
            
            <div className="attendance-list scrollable">
              {attendance.map((record, index) => (
                <div key={index} className="attendance-record">
                  <div className="record-user">
                    <span className="record-name">{record.userName}</span>
                    {record.role === 'teacher' && <span className="host-tag">HOST</span>}
                  </div>
                  <div className="record-details">
                    <span className="record-action">{record.action}</span>
                    <span className="record-time">
                      {new Date(record.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  {record.breakoutRoom && (
                    <div className="record-room">
                      <DoorOpen size={10} />
                      {record.breakoutRoom}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Breakout Rooms Modal */}
        {showBreakoutRooms && (
          <div className="modal-overlay">
            <div className="breakout-modal">
              <div className="modal-header">
                <h2>
                  <DoorOpen size={20} />
                  Breakout Rooms
                </h2>
                <button className="close-btn" onClick={() => setShowBreakoutRooms(false)}>
                  <X size={18} />
                </button>
              </div>
              
              {role === 'teacher' && (
                <div className="teacher-breakout-controls">
                  {!showCreateBreakout ? (
                    <div className="breakout-actions">
                      <button 
                        className="action-btn primary"
                        onClick={startBreakoutCreation}
                      >
                        <Plus size={16} />
                        Create Breakout Rooms
                      </button>
                      
                      {breakoutRooms.length > 0 && (
                        <>
                          <button 
                            className="action-btn"
                            onClick={closeAllBreakoutRooms}
                          >
                            <DoorClosed size={16} />
                            Close All Rooms
                          </button>
                          
                          <div className="broadcast-section">
                            <input
                              type="text"
                              placeholder="Broadcast message to all rooms..."
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') {
                                  broadcastToBreakoutRooms(e.target.value);
                                  e.target.value = '';
                                }
                              }}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  ) : (
                    <div className="create-breakout-wizard">
                      {breakoutCreationStep === 1 && (
                        <>
                          <h3>How would you like to create rooms?</h3>
                          <div className="wizard-options">
                            <button 
                              className="wizard-option"
                              onClick={() => createBreakoutRooms('automatic')}
                            >
                              <Users2 size={24} />
                              <div>
                                <strong>Automatic</strong>
                                <span>Let us split participants evenly</span>
                              </div>
                              <ArrowRight size={20} />
                            </button>
                            
                            <button 
                              className="wizard-option"
                              onClick={() => setBreakoutCreationStep(2)}
                            >
                              <UserPlus size={24} />
                              <div>
                                <strong>Manual</strong>
                                <span>Choose participants for each room</span>
                              </div>
                              <ArrowRight size={20} />
                            </button>
                            
                            <button 
                              className="wizard-option"
                              onClick={() => setBreakoutCreationStep(3)}
                            >
                              <PenTool size={24} />
                              <div>
                                <strong>Custom</strong>
                                <span>Create a single custom room</span>
                              </div>
                              <ArrowRight size={20} />
                            </button>
                          </div>
                        </>
                      )}
                      
                      {breakoutCreationStep === 2 && (
                        <>
                          <h3>Assign Participants to Rooms</h3>
                          <div className="manual-assignment">
                            <div className="participants-list-scrollable">
                              {participants.map(p => (
                                <div key={p.userId} className="assignment-row">
                                  <span>{p.userName} ({p.role})</span>
                                  <select
                                    value={participantAssignment[p.userId] || ''}
                                    onChange={(e) => assignParticipantToRoom(p.userId, e.target.value)}
                                  >
                                    <option value="">Select room</option>
                                    {breakoutRooms.map(room => (
                                      <option key={room.id} value={room.id}>
                                        {room.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              ))}
                            </div>
                            
                            <button 
                              className="create-room-btn"
                              onClick={() => {
                                setBreakoutCreationStep(1);
                                setShowCreateBreakout(false);
                              }}
                            >
                              Done Assigning
                            </button>
                          </div>
                        </>
                      )}
                      
                      {breakoutCreationStep === 3 && (
                        <>
                          <h3>Create Custom Room</h3>
                          <div className="custom-room-form">
                            <input
                              type="text"
                              placeholder="Room name"
                              value={breakoutRoomName}
                              onChange={(e) => setBreakoutRoomName(e.target.value)}
                            />
                            
                            <h4>Select Participants</h4>
                            <div className="participants-list-scrollable">
                              {participants.map(p => (
                                <label key={p.userId} className="checkbox-label">
                                  <input
                                    type="checkbox"
                                    checked={selectedParticipants.includes(p.userId)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setSelectedParticipants([...selectedParticipants, p.userId]);
                                      } else {
                                        setSelectedParticipants(selectedParticipants.filter(id => id !== p.userId));
                                      }
                                    }}
                                  />
                                  {p.userName} ({p.role})
                                </label>
                              ))}
                            </div>
                            
                            <h4>Assign Teachers (Optional)</h4>
                            <div className="participants-list-scrollable">
                              {participants.filter(p => p.role === 'teacher').map(p => (
                                <label key={p.userId} className="checkbox-label">
                                  <input
                                    type="checkbox"
                                    checked={assignedTeachers.includes(p.userId)}
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setAssignedTeachers([...assignedTeachers, p.userId]);
                                      } else {
                                        setAssignedTeachers(assignedTeachers.filter(id => id !== p.userId));
                                      }
                                    }}
                                  />
                                  {p.userName}
                                </label>
                              ))}
                            </div>
                            
                            <div className="form-actions">
                              <button 
                                className="cancel-btn"
                                onClick={() => setBreakoutCreationStep(1)}
                              >
                                Back
                              </button>
                              <button 
                                className="create-btn"
                                onClick={createCustomBreakoutRoom}
                                disabled={!breakoutRoomName || selectedParticipants.length === 0}
                              >
                                Create Room
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
              
              <div className="rooms-list scrollable">
                <h3>Active Rooms</h3>
                {breakoutRooms.length === 0 ? (
                  <p className="no-rooms">No breakout rooms created yet</p>
                ) : (
                  breakoutRooms.map(room => (
                    <div key={room.id} className="room-card">
                      <div className="room-header">
                        <h4>{room.name}</h4>
                        <span className="participant-count">
                          <Users size={14} />
                          {room.participants?.length || 0}
                        </span>
                      </div>
                      
                      <div className="room-participants-list">
                        {room.participants?.map(pid => {
                          const p = participants.find(part => part.userId === pid);
                          return p ? (
                            <div key={pid} className="room-participant">
                              <span>{p.userName}</span>
                              {p.role === 'teacher' && <span className="host-tag">HOST</span>}
                            </div>
                          ) : null;
                        })}
                      </div>
                      
                      <div className="room-actions">
                        {!currentBreakoutRoom && (
                          <button 
                            className="join-room-btn"
                            onClick={() => joinBreakoutRoom(room.id)}
                          >
                            Join Room
                          </button>
                        )}
                        
                        {role === 'teacher' && (
                          <>
                            <button 
                              className="icon-btn small"
                              onClick={() => assignParticipantToRoom(null, room.id)}
                              title="Add participants"
                            >
                              <UserPlus size={14} />
                            </button>
                            <button 
                              className="icon-btn small danger"
                              onClick={() => closeBreakoutRoom(room.id)}
                              title="Close room"
                            >
                              <X size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              {breakoutHistory.length > 0 && (
                <div className="breakout-history">
                  <h4>Recent Activity</h4>
                  <div className="history-list scrollable">
                    {breakoutHistory.slice(-5).map((item, idx) => (
                      <div key={idx} className="history-item">
                        <span className="history-action">{item.action}</span>
                        <span className="history-time">
                          {new Date(item.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recording Options Modal */}
        {showRecordingOptions && (
          <div className="modal-overlay">
            <div className="recording-modal">
              <div className="modal-header">
                <h2>
                  <Film size={20} />
                  Recording Options
                </h2>
                <button className="close-btn" onClick={() => setShowRecordingOptions(false)}>
                  <X size={18} />
                </button>
              </div>
              
              <div className="recording-options">
                <button className="recording-option" onClick={startRecording}>
                  <Radio size={20} />
                  <div>
                    <strong>Record Meeting</strong>
                    <span>Record video, audio and screen</span>
                  </div>
                </button>
                
                <button className="recording-option" onClick={() => {
                  setShowRecordingOptions(false);
                }}>
                  <ClockIcon size={20} />
                  <div>
                    <strong>Schedule Recording</strong>
                    <span>Set a time to start recording</span>
                  </div>
                </button>
                
                <button className="recording-option" onClick={() => {
                  setShowRecordingOptions(false);
                }}>
                  <DownloadCloud size={20} />
                  <div>
                    <strong>Cloud Recording</strong>
                    <span>Save to cloud storage</span>
                  </div>
                </button>
              </div>
            </div>
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
              
              {currentBreakoutRoom && (
                <button className="leave-option" onClick={leaveBreakoutRoom}>
                  <DoorOpen size={20} />
                  <div>
                    <strong>Leave breakout room</strong>
                    <span>Return to main meeting</span>
                  </div>
                </button>
              )}
              
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
            className={`control-btn ${showParticipants ? 'active' : ''}`} 
            onClick={toggleParticipants}
            title="Participants"
          >
            <Users size={22} />
            {totalParticipants > 0 && <span className="badge">{totalParticipants}</span>}
          </button>
        </div>

        <div className="footer-center">
          {role === 'teacher' && (
            <>
              <button 
                className={`control-btn ${showBreakoutRooms ? 'active' : ''}`}
                onClick={() => setShowBreakoutRooms(true)}
                title="Breakout rooms"
              >
                <DoorOpen size={22} />
                {breakoutRooms.length > 0 && (
                  <span className="badge">{breakoutRooms.length}</span>
                )}
              </button>
              
              <button 
                className={`control-btn ${isRecording ? 'recording' : ''}`}
                onClick={isRecording ? stopRecording : () => setShowRecordingOptions(true)}
                title={isRecording ? 'Stop recording' : 'Record'}
              >
                {isRecording ? <StopCircle size={22} /> : <Film size={22} />}
              </button>
            </>
          )}
          
          <button 
            className={`control-btn ${showWhiteboard ? 'active' : ''}`}
            onClick={toggleWhiteboard}
            title="Whiteboard"
          >
            <PenTool size={22} />
          </button>
          
          <button 
            className={`control-btn ${showChat ? 'active' : ''}`} 
            onClick={toggleChat}
            title="Chat"
          >
            <MessageSquare size={22} />
            {unreadMessages > 0 && <span className="badge">{unreadMessages}</span>}
          </button>
          
          {role === 'teacher' && (
            <button 
              className={`control-btn ${showAttendance ? 'active' : ''}`}
              onClick={toggleAttendance}
              title="Attendance"
            >
              <Calendar size={22} />
            </button>
          )}
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