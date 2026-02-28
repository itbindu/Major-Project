/// src/components/MeetingRoom.js - FIXED WEBRTC VERSION
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import {
  Mic, MicOff, Video, VideoOff, X, Send, Users, LogOut,
  Hand, ScreenShare, LayoutGrid, LayoutList, Lock, Unlock,
  Copy, Hash, Clock, Circle, Grid, UserPlus,
  PenTool, PlayCircle, StopCircle, Download, Eraser, Save,
  Film, VolumeX, Volume2, User, ChevronLeft, ChevronRight,
  CameraOff, ThumbsUp, MessageSquare, Calendar, Check
} from 'lucide-react';
import {
  createPeerConnection,
  addLocalStream,
  createOffer,
  handleOffer,
  handleAnswer,
  addIceCandidate
} from '../utils/webrtc';
import AttendanceTracker from './AttendanceTracker';
import BreakoutRoom from './BreakoutRoom';
import Whiteboard from './Whiteboard';
import './MeetingRoom.css';

const MeetingRoom = ({ role = 'student' }) => {
  const { meetingId } = useParams();
  const navigate = useNavigate();
  
  // ============ STATES ============
  const [userName, setUserName] = useState('');
  const [userId, setUserId] = useState('');
  const [meetingTopic, setMeetingTopic] = useState('Virtual Classroom');
  const [meetingTime, setMeetingTime] = useState('00:00');
  const [meetingStartTime] = useState(new Date());
  
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
  const [showRecordings, setShowRecordings] = useState(false);
  const [showAttendance, setShowAttendance] = useState(false);
  const [layoutMode, setLayoutMode] = useState('grid');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFooter, setShowFooter] = useState(true);
  const [showLeaveOptions, setShowLeaveOptions] = useState(false);
  const [meetingLocked, setMeetingLocked] = useState(false);
  const [activeSidebar, setActiveSidebar] = useState(null);
  
  // Chat states
  const [chatMessage, setChatMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [unreadMessages, setUnreadMessages] = useState(0);
  
  // Recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState('00:00');
  const [recordings, setRecordings] = useState([]);
  const [showRecordingComplete, setShowRecordingComplete] = useState(false);
  const [lastRecordingUrl, setLastRecordingUrl] = useState('');
  
  // Reactions
  const [reactions, setReactions] = useState([]);
  const [showReactions, setShowReactions] = useState(false);
  const [raisedHands, setRaisedHands] = useState([]);
  
  // Link sharing
  const [linkCopied, setLinkCopied] = useState(false);
  
  // ============ REFS ============
  const socketRef = useRef(null);
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const peerConnectionsRef = useRef({});
  const chatEndRef = useRef(null);
  const mouseActivityTimerRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const videoElementsRef = useRef({});
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);

  // ============ INITIALIZE USER ============
  useEffect(() => {
    const initializeUser = () => {
      if (role === 'teacher') {
        const teacherData = JSON.parse(localStorage.getItem('teacherUser') || '{}');
        const fullName = `${teacherData.firstName || ''} ${teacherData.lastName || ''}`.trim();
        setUserName(fullName || 'Teacher');
        setUserId(`teacher_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
        
        const savedRecordings = JSON.parse(localStorage.getItem('teacherRecordings') || '[]');
        setRecordings(savedRecordings);
        
        const storedTopic = localStorage.getItem(`meetingTopic_${meetingId}`) || 'Virtual Classroom';
        setMeetingTopic(storedTopic);
      } else {
        const studentName = localStorage.getItem('currentStudentName') || 'Student';
        setUserName(studentName);
        setUserId(`student_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
      }
    };
    
    initializeUser();
  }, [role, meetingId]);

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

        Object.values(peerConnectionsRef.current).forEach(pc => {
          addLocalStream(pc, stream);
        });

      } catch (error) {
        console.error('Error accessing media devices:', error);
        setStreamError('Could not access camera/microphone. Please check permissions.');
        setCameraOn(false);
        setMicOn(false);
      }
    };

    initLocalStream();

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          track.stop();
        });
      }
    };
  }, [cameraOn, micOn]);

  // ============ INITIALIZE SOCKET ============
  useEffect(() => {
    const socket = io('http://localhost:5000', {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket connected');
      
      socket.emit('join-meeting', {
        meetingId,
        userId,
        userName,
        role
      });
    });

    socket.on('all-users', (users) => {
      console.log('All users in room:', users);
      users.forEach(user => {
        if (user.userId !== userId) {
          createPeerConnectionToUser(user);
        }
      });
    });

    socket.on('user-joined', (user) => {
      console.log('User joined:', user);
      if (user.userId !== userId) {
        setParticipants(prev => [...prev, { 
          ...user, 
          audioEnabled: true, 
          videoEnabled: true,
          isScreenSharing: false,
          joinedAt: new Date().toISOString()
        }]);
        
        createPeerConnectionToUser(user);
        
        setMessages(prev => [...prev, {
          id: `join-${Date.now()}`,
          type: 'system',
          text: `${user.userName} joined the meeting`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
      }
    });

    socket.on('user-left', (leftUserId) => {
      console.log('User left:', leftUserId);
      
      // Update participant left time for attendance
      setParticipants(prev => {
        const updatedParticipants = prev.filter(p => p.userId !== leftUserId);
        
        // Update attendance record
        const attendance = JSON.parse(localStorage.getItem(`attendance_${meetingId}`) || '[]');
        const updatedAttendance = attendance.map(record => 
          record.userId === leftUserId && !record.leftAt
            ? { ...record, leftAt: new Date().toISOString(), duration: calculateDuration(record.joinedAt) }
            : record
        );
        localStorage.setItem(`attendance_${meetingId}`, JSON.stringify(updatedAttendance));
        
        return updatedParticipants;
      });
      
      if (peerConnectionsRef.current[leftUserId]) {
        peerConnectionsRef.current[leftUserId].close();
        delete peerConnectionsRef.current[leftUserId];
      }
      
      if (videoElementsRef.current[leftUserId]) {
        videoElementsRef.current[leftUserId].remove();
        delete videoElementsRef.current[leftUserId];
      }
      
      setMessages(prev => [...prev, {
        id: `leave-${Date.now()}`,
        type: 'system',
        text: 'A participant left the meeting',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    });

    socket.on('offer', async (data) => {
      const { offer, from, userName: remoteUserName } = data;
      console.log('Received offer from:', from);
      
      if (!peerConnectionsRef.current[from]) {
        await createPeerConnectionToUser({ userId: from, userName: remoteUserName }, false);
      }
      
      const pc = peerConnectionsRef.current[from];
      const answer = await handleOffer(pc, offer);
      
      socket.emit('answer', {
        answer,
        to: from,
        from: userId,
        meetingId
      });
    });

    socket.on('answer', async (data) => {
      const { answer, from } = data;
      console.log('Received answer from:', from);
      
      const pc = peerConnectionsRef.current[from];
      if (pc) {
        await handleAnswer(pc, answer);
      }
    });

    socket.on('ice-candidate', async (data) => {
      const { candidate, from } = data;
      
      const pc = peerConnectionsRef.current[from];
      if (pc) {
        await addIceCandidate(pc, candidate);
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
    });

    socket.on('screen-share-stopped', (data) => {
      setParticipants(prev => prev.map(p => 
        p.userId === data.userId 
          ? { ...p, isScreenSharing: false }
          : p
      ));
    });

    socket.on('chat-message', (message) => {
      setMessages(prev => [...prev, message]);
      if (!showChat) {
        setUnreadMessages(prev => prev + 1);
      }
    });

    socket.on('raise-hand', (data) => {
      setRaisedHands(prev => [...prev, data.userId]);
      setTimeout(() => {
        setRaisedHands(prev => prev.filter(id => id !== data.userId));
      }, 5000);
      
      setMessages(prev => [...prev, {
        id: `hand-${Date.now()}`,
        type: 'system',
        text: `${data.userName} raised hand`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    });

    socket.on('reaction', (data) => {
      setReactions(prev => [...prev, {
        id: Date.now(),
        ...data
      }]);
      setTimeout(() => {
        setReactions(prev => prev.filter(r => r.id !== Date.now()));
      }, 3000);
    });

    socket.on('meeting-joined', (data) => {
      if (data.participants) {
        setParticipants(data.participants.filter(p => p.userId !== userId));
      }
      if (data.meetingTopic) {
        setMeetingTopic(data.meetingTopic);
      }
      
      setMessages(prev => [...prev, {
        id: 'welcome',
        type: 'system',
        text: `Welcome to the meeting, ${userName}!`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }]);
    });

    socket.on('force-mute', () => {
      if (localStreamRef.current) {
        const audioTrack = localStreamRef.current.getAudioTracks()[0];
        if (audioTrack && audioTrack.enabled) {
          audioTrack.enabled = false;
          setMicOn(false);
        }
      }
    });

    socket.on('breakout-rooms-created', (rooms) => {
      // Handle breakout rooms creation
      console.log('Breakout rooms created:', rooms);
    });

    socket.on('breakout-room-assigned', (data) => {
      // Handle breakout room assignment
      console.log('Assigned to breakout room:', data);
    });

    socket.on('meeting-ended', () => {
      alert('The meeting has been ended by the host.');
      
      // Record end time for attendance
      const attendance = JSON.parse(localStorage.getItem(`attendance_${meetingId}`) || '[]');
      const updatedAttendance = attendance.map(record => 
        !record.leftAt
          ? { ...record, leftAt: new Date().toISOString(), duration: calculateDuration(record.joinedAt) }
          : record
      );
      localStorage.setItem(`attendance_${meetingId}`, JSON.stringify(updatedAttendance));
      
      if (role === 'teacher') {
        navigate('/teacher/dashboard');
      } else {
        navigate('/student/dashboard');
      }
    });

    return () => {
      Object.values(peerConnectionsRef.current).forEach(pc => {
        pc.close();
      });
      
      if (socketRef.current) {
        socketRef.current.emit('leave-meeting', { meetingId, userId });
        socketRef.current.disconnect();
      }
    };
  }, [meetingId, userId, userName, role, navigate]);

  // ============ CALCULATE DURATION ============
  const calculateDuration = (joinedAt) => {
    const start = new Date(joinedAt);
    const end = new Date();
    const diffMs = end - start;
    const minutes = Math.floor(diffMs / 60000);
    const seconds = Math.floor((diffMs % 60000) / 1000);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // ============ CREATE PEER CONNECTION ============
  const createPeerConnectionToUser = async (user, initiator = true) => {
    const { userId: remoteUserId, userName: remoteUserName } = user;
    
    if (peerConnectionsRef.current[remoteUserId] || remoteUserId === userId) {
      console.log('Peer connection already exists or self:', remoteUserId);
      return;
    }

    console.log(`Creating peer connection to ${remoteUserName} (${remoteUserId})`, initiator ? 'as initiator' : 'as receiver');
    
    const videoContainer = document.createElement('div');
    videoContainer.id = `peer-${remoteUserId}`;
    videoContainer.className = 'peer-video-container';
    
    const videoElement = document.createElement('video');
    videoElement.autoplay = true;
    videoElement.playsInline = true;
    videoElement.className = 'video-element';
    
    videoContainer.appendChild(videoElement);
    
    const peerContainer = document.getElementById(`peer-${remoteUserId}-container`);
    if (peerContainer) {
      peerContainer.appendChild(videoContainer);
    }
    
    videoElementsRef.current[remoteUserId] = videoContainer;

    const onTrack = (event) => {
      console.log(`Received track from ${remoteUserName}:`, event.track.kind);
      
      if (videoElement) {
        if (!videoElement.srcObject) {
          videoElement.srcObject = new MediaStream();
        }
        videoElement.srcObject.addTrack(event.track);
        videoElement.play().catch(e => console.log('Video play error:', e));
      }
    };

    const onIceCandidate = (candidate) => {
      socketRef.current.emit('ice-candidate', {
        candidate,
        to: remoteUserId,
        from: userId,
        meetingId
      });
    };

    const pc = createPeerConnection(onTrack, onIceCandidate);
    
    if (localStreamRef.current) {
      addLocalStream(pc, localStreamRef.current);
    }
    
    peerConnectionsRef.current[remoteUserId] = pc;

    if (initiator) {
      const offer = await createOffer(pc);
      socketRef.current.emit('offer', {
        offer,
        to: remoteUserId,
        from: userId,
        userName,
        meetingId
      });
    }
  };

  // ============ TOGGLE MEDIA ============
  const toggleMic = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setMicOn(audioTrack.enabled);
        
        socketRef.current.emit('media-state-changed', {
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
        
        socketRef.current.emit('media-state-changed', {
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
        
        const videoTrack = stream.getVideoTracks()[0];
        
        Object.values(peerConnectionsRef.current).forEach(pc => {
          const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
          if (sender) {
            sender.replaceTrack(videoTrack);
          }
        });
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        
        setIsScreenSharing(true);
        
        // Auto switch layout to speaker view when screen sharing
        setLayoutMode('speaker');
        
        stream.getVideoTracks()[0].onended = () => {
          toggleScreenShare();
        };
        
        socketRef.current.emit('screen-share-started', {
          meetingId,
          userId
        });
      } else {
        if (screenStreamRef.current) {
          screenStreamRef.current.getTracks().forEach(track => track.stop());
          screenStreamRef.current = null;
        }
        
        if (localStreamRef.current) {
          const videoTrack = localStreamRef.current.getVideoTracks()[0];
          
          Object.values(peerConnectionsRef.current).forEach(pc => {
            const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
            if (sender && videoTrack) {
              sender.replaceTrack(videoTrack);
            }
          });
          
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
          }
        }
        
        setIsScreenSharing(false);
        
        socketRef.current.emit('screen-share-stopped', {
          meetingId,
          userId
        });
      }
    } catch (error) {
      console.error('Screen sharing error:', error);
    }
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

    socketRef.current.emit('chat-message', {
      meetingId,
      message
    });

    setMessages(prev => [...prev, message]);
    setChatMessage('');
  };

  // ============ RAISE HAND ============
  const raiseHand = () => {
    socketRef.current.emit('raise-hand', {
      meetingId,
      userId,
      userName
    });
  };

  // ============ REACTIONS ============
  const sendReaction = (reaction) => {
    socketRef.current.emit('send-reaction', {
      meetingId,
      userId,
      userName,
      reaction
    });
    
    setReactions(prev => [...prev, {
      id: Date.now(),
      userId,
      userName,
      reaction,
      timestamp: new Date()
    }]);
    
    setTimeout(() => {
      setReactions(prev => prev.filter(r => r.id !== Date.now()));
    }, 3000);
    
    setShowReactions(false);
  };

  // ============ RECORDING ============
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
        
        const recording = {
          id: Date.now().toString(),
          name: fileName,
          url,
          date: new Date().toLocaleDateString(),
          duration: recordingTime,
          meetingId,
          meetingTopic
        };
        
        setRecordings(prev => [recording, ...prev]);
        setLastRecordingUrl(url);
        setShowRecordingComplete(true);
        
        const saved = JSON.parse(localStorage.getItem('teacherRecordings') || '[]');
        localStorage.setItem('teacherRecordings', JSON.stringify([recording, ...saved]));
        
        // Auto download
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        
        setTimeout(() => {
          setShowRecordingComplete(false);
        }, 5000);
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
      
      socketRef.current.emit('recording-started', { meetingId });
      
    } catch (error) {
      console.error('Recording error:', error);
      alert('Failed to start recording. Please try again.');
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
      socketRef.current.emit('recording-stopped', { meetingId });
    }
  };

  // ============ COPY MEETING LINK ============
  const copyMeetingLink = () => {
    const link = `${window.location.origin}/meeting/${meetingId}`;
    navigator.clipboard.writeText(link);
    setLinkCopied(true);
    
    setMessages(prev => [...prev, {
      id: `link-copied-${Date.now()}`,
      type: 'system',
      text: 'Meeting link copied to clipboard!',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }]);
    
    setTimeout(() => setLinkCopied(false), 3000);
  };

  // ============ LEAVE MEETING OPTIONS ============
  const leaveMeetingOnly = () => {
    if (isRecording && role === 'teacher') {
      stopRecording();
    }
    
    // Record leave time
    const attendance = JSON.parse(localStorage.getItem(`attendance_${meetingId}`) || '[]');
    const updatedAttendance = attendance.map(record => 
      record.userId === userId && !record.leftAt
        ? { ...record, leftAt: new Date().toISOString(), duration: calculateDuration(record.joinedAt) }
        : record
    );
    localStorage.setItem(`attendance_${meetingId}`, JSON.stringify(updatedAttendance));
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop());
    }
    
    if (role === 'teacher') {
      navigate('/teacher/dashboard');
    } else {
      navigate('/student/dashboard');
    }
  };

  const endMeetingForAll = () => {
    if (role !== 'teacher') return;
    
    // Record end time for all participants
    const attendance = JSON.parse(localStorage.getItem(`attendance_${meetingId}`) || '[]');
    const updatedAttendance = attendance.map(record => 
      !record.leftAt
        ? { ...record, leftAt: new Date().toISOString(), duration: calculateDuration(record.joinedAt) }
        : record
    );
    localStorage.setItem(`attendance_${meetingId}`, JSON.stringify(updatedAttendance));
    
    socketRef.current.emit('end-meeting', { meetingId });
    
    if (isRecording) {
      stopRecording();
    }
    
    navigate('/teacher/dashboard');
  };

  // ============ SIDEBAR TOGGLE ============
  const toggleSidebar = (type) => {
    if (activeSidebar === type) {
      setActiveSidebar(null);
      setShowChat(false);
      setShowParticipants(false);
      setShowBreakoutRooms(false);
      setShowWhiteboard(false);
    } else {
      setActiveSidebar(type);
      setShowChat(type === 'chat');
      setShowParticipants(type === 'participants');
      setShowBreakoutRooms(type === 'breakout');
      setShowWhiteboard(type === 'whiteboard');
      if (type === 'chat') setUnreadMessages(0);
    }
  };

  // ============ MUTE PARTICIPANT ============
  const muteParticipant = (participantId) => {
    if (role !== 'teacher') return;
    
    socketRef.current.emit('mute-participant', {
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

  // ============ MOUSE ACTIVITY ============
  useEffect(() => {
    const handleMouseMove = (e) => {
      const screenHeight = window.innerHeight;
      const mouseY = e.clientY;
      
      if (screenHeight - mouseY < 100) {
        setShowFooter(true);
      }
      
      if (mouseActivityTimerRef.current) {
        clearTimeout(mouseActivityTimerRef.current);
      }
      
      mouseActivityTimerRef.current = setTimeout(() => {
        if (screenHeight - mouseY >= 100) {
          setShowFooter(false);
        }
      }, 3000);
    };

    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (mouseActivityTimerRef.current) {
        clearTimeout(mouseActivityTimerRef.current);
      }
    };
  }, []);

  // ============ AUTO SCROLL CHAT ============
  useEffect(() => {
    if (chatEndRef.current && showChat) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, showChat]);

  // ============ FULLSCREEN ============
  const toggleFullscreen = () => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
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
              <span className="meeting-id">
                <Hash size={12} />
                {meetingId.slice(-6)}
              </span>
              <span className="meeting-time">
                <Clock size={12} />
                {meetingTime}
              </span>
              {isRecording && (
                <span className="recording-status">
                  <Circle size={8} fill="#ea4335" color="#ea4335" />
                  REC {recordingTime}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="header-center">
          <div className="participant-count">
            <Users size={14} />
            <span>{totalParticipants}</span>
            {raisedHands.length > 0 && (
              <span className="hand-raise-indicator">
                <Hand size={12} />
                {raisedHands.length}
              </span>
            )}
          </div>
        </div>

        <div className="header-right">
          <button 
            className={`icon-btn ${linkCopied ? 'active' : ''}`}
            onClick={copyMeetingLink} 
            title="Copy meeting link"
          >
            <Copy size={16} />
          </button>
          <button 
            className="icon-btn" 
            onClick={toggleFullscreen} 
            title="Fullscreen"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          </button>
        </div>
      </header>

      {/* ============ MAIN CONTENT ============ */}
      <main className="meeting-main">
        <div className={`video-grid-area ${activeSidebar ? 'sidebar-open' : 'sidebar-closed'}`}>
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
                    <div className="avatar">
                      {userName?.charAt(0).toUpperCase() || 'U'}
                    </div>
                  </div>
                )}
                <div className="video-overlay">
                  <div className="video-info">
                    <span className="user-name">
                      {userName} (You)
                      {!cameraOn && <CameraOff size={12} className="status-icon" />}
                      {!micOn && <MicOff size={12} className="status-icon" />}
                      {role === 'teacher' && (
                        <span className="role-badge teacher">Teacher</span>
                      )}
                    </span>
                    {isScreenSharing && (
                      <span className="screen-sharing-label">
                        <ScreenShare size={12} />
                        Sharing Screen
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Remote Participants */}
              {participants.map((participant) => (
                <div 
                  key={participant.userId} 
                  id={`peer-${participant.userId}-container`}
                  className={`video-tile remote ${participant.isScreenSharing ? 'screen-sharing-active' : ''}`}
                >
                  {/* Video will be inserted here by WebRTC */}
                  {!participant.videoEnabled && (
                    <div className="video-placeholder">
                      <div className="avatar">
                        {participant.userName?.charAt(0).toUpperCase() || 'U'}
                      </div>
                    </div>
                  )}
                  <div className="video-overlay">
                    <div className="video-info">
                      <span className="user-name">
                        {participant.userName}
                        {participant.role === 'teacher' && (
                          <span className="role-badge teacher">Teacher</span>
                        )}
                        {raisedHands.includes(participant.userId) && (
                          <span className="hand-raise-icon">
                            <Hand size={12} />
                          </span>
                        )}
                        {!participant.audioEnabled && (
                          <MicOff size={12} className="status-icon" />
                        )}
                      </span>
                      {participant.isScreenSharing && (
                        <span className="screen-sharing-label">
                          <ScreenShare size={12} />
                          Sharing
                        </span>
                      )}
                    </div>
                  </div>
                  {role === 'teacher' && participant.role !== 'teacher' && (
                    <div className="participant-controls">
                      <button 
                        className="control-btn-small"
                        onClick={() => muteParticipant(participant.userId)}
                        title="Mute participant"
                      >
                        <VolumeX size={12} />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ============ SIDEBAR - CHAT ============ */}
        {showChat && (
          <div className="chat-sidebar">
            <div className="chat-header">
              <h3>
                <MessageSquare size={16} />
                Chat
              </h3>
              <div className="chat-actions">
                <button 
                  className="icon-btn close"
                  onClick={() => toggleSidebar('chat')}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            
            <div className="chat-content">
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
          </div>
        )}

        {/* ============ SIDEBAR - PARTICIPANTS ============ */}
        {showParticipants && (
          <div className="participants-sidebar">
            <div className="participants-header">
              <h3>
                <Users size={16} />
                Participants ({totalParticipants})
              </h3>
              <div className="participants-actions">
                {role === 'teacher' && (
                  <button 
                    className="icon-btn small"
                    onClick={muteAllParticipants}
                    title="Mute all"
                  >
                    <VolumeX size={14} />
                  </button>
                )}
                <button 
                  className="icon-btn close"
                  onClick={() => toggleSidebar('participants')}
                >
                  <X size={16} />
                </button>
              </div>
            </div>
            
            <div className="participants-content">
              <div className="participants-list">
                {/* Current User */}
                <div className="participant-item local">
                  <div className="participant-avatar">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                  <div className="participant-info">
                    <span className="participant-name">
                      {userName} (You)
                      {role === 'teacher' && (
                        <span className="role-tag host">Host</span>
                      )}
                    </span>
                    <span className="participant-status">
                      {micOn ? 'Mic on' : 'Muted'} • {cameraOn ? 'Camera on' : 'Camera off'}
                    </span>
                  </div>
                  <div className="participant-status-icons">
                    {micOn ? <Mic size={12} /> : <MicOff size={12} />}
                    {cameraOn ? <Video size={12} /> : <VideoOff size={12} />}
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
                        {participant.role === 'teacher' && (
                          <span className="role-tag host">Host</span>
                        )}
                        {raisedHands.includes(participant.userId) && (
                          <span className="hand-raise-tag">
                            <Hand size={10} />
                            Hand raised
                          </span>
                        )}
                      </span>
                      <span className="participant-status">
                        {participant.audioEnabled ? 'Mic on' : 'Muted'}
                        {participant.isScreenSharing && ' • Sharing screen'}
                      </span>
                    </div>
                    <div className="participant-status-icons">
                      {participant.audioEnabled ? <Mic size={12} /> : <MicOff size={12} />}
                      {participant.videoEnabled ? <Video size={12} /> : <VideoOff size={12} />}
                    </div>
                    {role === 'teacher' && participant.role !== 'teacher' && (
                      <button 
                        className="mute-btn-small"
                        onClick={() => muteParticipant(participant.userId)}
                        title="Mute"
                      >
                        <VolumeX size={10} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Attendance Tracker for Teacher */}
              {role === 'teacher' && (
                <div className="attendance-section">
                  <AttendanceTracker 
                    meetingId={meetingId}
                    userId={userId}
                    userName={userName}
                    role={role}
                    participants={participants}
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============ SIDEBAR - BREAKOUT ROOMS ============ */}
        {showBreakoutRooms && (
          <div className="breakout-sidebar">
            <BreakoutRoom 
              meetingId={meetingId}
              userId={userId}
              userName={userName}
              role={role}
              participants={participants}
              socket={socketRef.current}
            />
          </div>
        )}

        {/* ============ SIDEBAR - WHITEBOARD ============ */}
        {showWhiteboard && (
          <div className="whiteboard-sidebar">
            <Whiteboard 
              meetingId={meetingId}
              userId={userId}
              userName={userName}
              role={role}
              socket={socketRef.current}
            />
          </div>
        )}

        {/* ============ LAYOUT CONTROLS ============ */}
        <div className="layout-controls">
          <button 
            className={`layout-btn ${layoutMode === 'grid' ? 'active' : ''}`}
            onClick={() => setLayoutMode('grid')}
            title="Grid View"
          >
            <LayoutGrid size={18} />
          </button>
          <button 
            className={`layout-btn ${layoutMode === 'speaker' ? 'active' : ''}`}
            onClick={() => setLayoutMode('speaker')}
            title="Speaker View"
          >
            <LayoutList size={18} />
          </button>
        </div>

        {/* ============ LEAVE MEETING MODAL ============ */}
        {showLeaveOptions && (
          <div className="modal-overlay">
            <div className="modal">
              <div className="modal-header">
                <h3>Leave Meeting</h3>
                <button 
                  className="icon-btn close"
                  onClick={() => setShowLeaveOptions(false)}
                >
                  <X size={16} />
                </button>
              </div>
              <div className="modal-content">
                <p className="leave-message">What would you like to do?</p>
                <div className="leave-options">
                  <button 
                    className="leave-option"
                    onClick={leaveMeetingOnly}
                  >
                    <LogOut size={20} />
                    <div>
                      <strong>Leave meeting</strong>
                      <span>You can rejoin later</span>
                    </div>
                  </button>
                  
                  {role === 'teacher' && (
                    <button 
                      className="leave-option end"
                      onClick={endMeetingForAll}
                    >
                      <X size={20} />
                      <div>
                        <strong>End meeting for all</strong>
                        <span>This will close the meeting for everyone</span>
                      </div>
                    </button>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button 
                  className="btn secondary"
                  onClick={() => setShowLeaveOptions(false)}
                >
                  Cancel
                </button>
              </div>
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
      <footer className={`controls-bar ${showFooter ? 'visible' : 'hidden'}`}>
        <div className="controls-left">
          <div className="control-group">
            <button 
              className={`control-btn ${!micOn ? 'off' : ''}`}
              onClick={toggleMic}
              title={micOn ? 'Mute microphone' : 'Unmute microphone'}
            >
              {micOn ? <Mic size={20} /> : <MicOff size={20} />}
            </button>
            
            <button 
              className={`control-btn ${!cameraOn ? 'off' : ''}`}
              onClick={toggleCamera}
              title={cameraOn ? 'Turn off camera' : 'Turn on camera'}
            >
              {cameraOn ? <Video size={20} /> : <VideoOff size={20} />}
            </button>
            
            <button 
              className={`control-btn ${isScreenSharing ? 'sharing' : ''}`}
              onClick={toggleScreenShare}
              title={isScreenSharing ? 'Stop sharing' : 'Share screen'}
            >
              <ScreenShare size={20} />
            </button>
            
            <button 
              className={`control-btn ${showParticipants ? 'active' : ''}`}
              onClick={() => toggleSidebar('participants')}
              title="Participants"
            >
              <Users size={20} />
            </button>
          </div>
        </div>

        <div className="controls-center">
          <div className="control-group">
            {role === 'student' && (
              <button 
                className="control-btn"
                onClick={raiseHand}
                title="Raise hand"
              >
                <Hand size={20} />
              </button>
            )}
            
            <button 
              className={`control-btn ${showChat ? 'active' : ''}`}
              onClick={() => toggleSidebar('chat')}
              title="Chat"
            >
              <MessageSquare size={20} />
              {unreadMessages > 0 && (
                <span className="badge">{unreadMessages}</span>
              )}
            </button>
            
            <button 
              className={`control-btn ${showBreakoutRooms ? 'active' : ''}`}
              onClick={() => toggleSidebar('breakout')}
              title="Breakout Rooms"
            >
              <Grid size={20} />
            </button>
            
            <button 
              className={`control-btn ${showWhiteboard ? 'active' : ''}`}
              onClick={() => toggleSidebar('whiteboard')}
              title="Whiteboard"
            >
              <PenTool size={20} />
            </button>
            
            {role === 'teacher' && (
              <>
                <button 
                  className={`control-btn ${isRecording ? 'recording' : ''}`}
                  onClick={isRecording ? stopRecording : startRecording}
                  title={isRecording ? 'Stop Recording' : 'Start Recording'}
                >
                  {isRecording ? <StopCircle size={20} /> : <PlayCircle size={20} />}
                </button>
                
                <button 
                  className={`control-btn ${showAttendance ? 'active' : ''}`}
                  onClick={() => setShowAttendance(!showAttendance)}
                  title="Attendance"
                >
                  <Calendar size={20} />
                </button>
              </>
            )}
          </div>
        </div>

        <div className="controls-right">
          <button 
            className="leave-btn"
            onClick={() => setShowLeaveOptions(true)}
          >
            <LogOut size={16} />
            Leave
          </button>
        </div>
      </footer>

      {/* ============ REACTIONS DISPLAY ============ */}
      {reactions.length > 0 && (
        <div className="reactions-display">
          {reactions.map(reaction => (
            <div key={reaction.id} className="reaction-bubble">
              <span className="reaction-emoji">{reaction.reaction}</span>
              <span className="reaction-name">{reaction.userName}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MeetingRoom;