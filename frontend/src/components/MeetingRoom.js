// src/components/MeetingRoom.js
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import io from 'socket.io-client';
import {
  Mic, MicOff, Video, VideoOff, Users, MessageSquare, Grid, PenTool,
  ScreenShare, LogOut, Copy, Check, Clock, X, VolumeX, Share2,
  Maximize, Minimize, PlayCircle, StopCircle, User, ChevronLeft, ChevronRight
} from 'lucide-react';
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
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  
  // Breakout Room states
  const [showBreakoutRooms, setShowBreakoutRooms] = useState(false);
  const [breakoutRooms, setBreakoutRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [showBreakoutModal, setShowBreakoutModal] = useState(false);
  const [breakoutRoomName, setBreakoutRoomName] = useState('');
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [assignedTeacher, setAssignedTeacher] = useState('');
  const [inBreakoutRoom, setInBreakoutRoom] = useState(false);
  const [currentBreakoutRoom, setCurrentBreakoutRoom] = useState(null);
  
  // Whiteboard states
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [whiteboardData, setWhiteboardData] = useState([]);
  const [currentTool, setCurrentTool] = useState('pen');
  const [currentColor, setCurrentColor] = useState('#000000');
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  
  // Leave options
  const [showLeaveOptions, setShowLeaveOptions] = useState(false);
  
  // Link sharing
  const [linkCopied, setLinkCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Attendance tracking
  const [attendance, setAttendance] = useState([]);
  const [joinTime] = useState(new Date());
  
  // Refs
  const socketRef = useRef(null);
  const localVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);

  // ============ INITIALIZE ============
  useEffect(() => {
    // Initialize user
    const storedName = localStorage.getItem(`${role}Name`) || 
                      (role === 'teacher' ? 'Teacher' : 'Student');
    setUserName(storedName);
    setUserId(`${role}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

    // Initialize socket
    const socket = io('http://localhost:5000', {
      transports: ['websocket']
    });
    socketRef.current = socket;

    socket.emit('join-meeting', {
      meetingId,
      userId: `${role}_${Date.now()}`,
      userName: storedName,
      role
    });

    // Track attendance
    const attendanceRecord = {
      userId: `${role}_${Date.now()}`,
      userName: storedName,
      role,
      joinTime: new Date().toISOString(),
      meetingId
    };
    setAttendance([attendanceRecord]);
    
    const existingAttendance = JSON.parse(localStorage.getItem(`attendance_${meetingId}`) || '[]');
    localStorage.setItem(`attendance_${meetingId}`, JSON.stringify([...existingAttendance, attendanceRecord]));

    // Socket listeners
    socket.on('user-joined', (user) => {
      setParticipants(prev => [...prev, user]);
      setParticipantCount(prev => prev + 1);
      
      // Track attendance for new user
      const newAttendance = {
        userId: user.userId,
        userName: user.userName,
        role: user.role,
        joinTime: new Date().toISOString(),
        meetingId
      };
      setAttendance(prev => [...prev, newAttendance]);
      
      const updatedAttendance = JSON.parse(localStorage.getItem(`attendance_${meetingId}`) || '[]');
      updatedAttendance.push(newAttendance);
      localStorage.setItem(`attendance_${meetingId}`, JSON.stringify(updatedAttendance));
    });

    socket.on('user-left', (leftUserId) => {
      setParticipants(prev => prev.filter(p => p.userId !== leftUserId));
      setParticipantCount(prev => prev - 1);
      
      // Update leave time in attendance
      const updatedAttendance = JSON.parse(localStorage.getItem(`attendance_${meetingId}`) || '[]');
      const updated = updatedAttendance.map(record => 
        record.userId === leftUserId && !record.leaveTime
          ? { ...record, leaveTime: new Date().toISOString() }
          : record
      );
      localStorage.setItem(`attendance_${meetingId}`, JSON.stringify(updated));
    });

    socket.on('chat-message', (message) => {
      setMessages(prev => [...prev, message]);
      if (!showChat) {
        setUnreadMessages(prev => prev + 1);
      }
    });

    socket.on('breakout-room-created', (rooms) => {
      setBreakoutRooms(rooms);
    });

    socket.on('assigned-to-breakout', ({ roomId, roomName }) => {
      setInBreakoutRoom(true);
      setCurrentBreakoutRoom({ id: roomId, name: roomName });
      setShowBreakoutModal(false);
    });

    socket.on('breakout-room-joined', ({ roomId, roomName }) => {
      setInBreakoutRoom(true);
      setCurrentBreakoutRoom({ id: roomId, name: roomName });
    });

    socket.on('return-to-main', () => {
      setInBreakoutRoom(false);
      setCurrentBreakoutRoom(null);
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

    socket.on('whiteboard-update', (data) => {
      setWhiteboardData(prev => [...prev, data]);
      drawOnCanvas(data);
    });

    socket.on('whiteboard-clear', () => {
      setWhiteboardData([]);
      clearCanvas();
    });

    socket.on('meeting-ended', () => {
      handleMeetingEnd();
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
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [meetingId, role]);

  // ============ INITIALIZE MEDIA ============
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

  // ============ MEDIA FUNCTIONS ============
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

  // ============ PARTICIPANTS FUNCTIONS ============
  const toggleParticipants = () => {
    setShowParticipants(!showParticipants);
    setShowChat(false);
    setShowBreakoutRooms(false);
    setShowWhiteboard(false);
  };

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

  // ============ CHAT FUNCTIONS ============
  const toggleChat = () => {
    setShowChat(!showChat);
    setShowParticipants(false);
    setShowBreakoutRooms(false);
    setShowWhiteboard(false);
    if (!showChat) setUnreadMessages(0);
  };

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

    socketRef.current?.emit('chat-message', {
      meetingId,
      message
    });

    setMessages(prev => [...prev, message]);
    setChatMessage('');
  };

  // ============ BREAKOUT ROOM FUNCTIONS (Teacher only) ============
  const toggleBreakoutRooms = () => {
    if (role === 'teacher') {
      setShowBreakoutRooms(!showBreakoutRooms);
      setShowParticipants(false);
      setShowChat(false);
      setShowWhiteboard(false);
    }
  };

  const createBreakoutRoom = () => {
    if (!breakoutRoomName.trim()) return;
    
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
    socketRef.current?.emit('end-breakout-rooms', {
      meetingId
    });
    setBreakoutRooms([]);
    setShowBreakoutRooms(false);
  };

  // ============ WHITEBOARD FUNCTIONS ============
  const toggleWhiteboard = () => {
    setShowWhiteboard(!showWhiteboard);
    setShowParticipants(false);
    setShowChat(false);
    setShowBreakoutRooms(false);
    
    if (!showWhiteboard && canvasRef.current) {
      initCanvas();
    }
  };

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
    
    // Load existing whiteboard data
    whiteboardData.forEach(data => drawOnCanvas(data));
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
      x,
      y,
      tool: currentTool,
      color: currentColor,
      userId,
      timestamp: Date.now()
    };
    
    socketRef.current?.emit('whiteboard-draw', {
      meetingId,
      data: drawData
    });
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
      x,
      y,
      tool: currentTool,
      color: currentColor,
      userId,
      timestamp: Date.now()
    };
    
    socketRef.current?.emit('whiteboard-draw', {
      meetingId,
      data: drawData
    });
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
    
    socketRef.current?.emit('whiteboard-clear', {
      meetingId
    });
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
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
        const fileName = `Meeting_${meetingTopic}_${new Date().toISOString()}.webm`;
        
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
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

  // ============ LINK SHARING ============
  const copyMeetingLink = () => {
    const link = `${window.location.origin}/meeting/${meetingId}`;
    navigator.clipboard.writeText(link);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 3000);
  };

  // ============ FULLSCREEN ============
  const toggleFullscreen = () => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
    setIsFullscreen(!isFullscreen);
  };

  // ============ LEAVE MEETING FUNCTIONS ============
  const handleLeaveMeeting = () => {
    // Update attendance with leave time
    const attendanceData = JSON.parse(localStorage.getItem(`attendance_${meetingId}`) || '[]');
    const updatedAttendance = attendanceData.map(record => 
      record.userId === userId && !record.leaveTime
        ? { 
            ...record, 
            leaveTime: new Date().toISOString(),
            duration: calculateDuration(record.joinTime, new Date().toISOString())
          }
        : record
    );
    localStorage.setItem(`attendance_${meetingId}`, JSON.stringify(updatedAttendance));
    
    if (role === 'teacher') {
      navigate('/teacher/dashboard');
    } else {
      navigate('/student/dashboard');
    }
  };

  const handleEndMeeting = () => {
    if (role !== 'teacher') return;
    
    // Update all participants' leave time
    const attendanceData = JSON.parse(localStorage.getItem(`attendance_${meetingId}`) || '[]');
    const now = new Date().toISOString();
    const updatedAttendance = attendanceData.map(record => {
      if (!record.leaveTime) {
        return {
          ...record,
          leaveTime: now,
          duration: calculateDuration(record.joinTime, now)
        };
      }
      return record;
    });
    localStorage.setItem(`attendance_${meetingId}`, JSON.stringify(updatedAttendance));
    
    socketRef.current?.emit('end-meeting', { meetingId });
    
    if (role === 'teacher') {
      navigate('/teacher/dashboard');
    }
  };

  const handleMeetingEnd = () => {
    alert('The meeting has been ended by the host.');
    if (role === 'teacher') {
      navigate('/teacher/dashboard');
    } else {
      navigate('/student/dashboard');
    }
  };

  const calculateDuration = (start, end) => {
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();
    const durationMs = endTime - startTime;
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);
    return `${minutes}m ${seconds}s`;
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
            <div className={`video-grid ${isScreenSharing ? 'screen-sharing' : ''}`}>
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

        {/* ============ PARTICIPANTS SIDEBAR (1/4 Screen) ============ */}
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

              {/* Teacher Controls */}
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

        {/* ============ CHAT SIDEBAR (1/4 Screen) ============ */}
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

        {/* ============ BREAKOUT ROOMS SIDEBAR (Teacher only) ============ */}
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

        {/* ============ WHITEBOARD SIDEBAR (1/4 Screen) ============ */}
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

        {/* ============ BREAKOUT ROOM JOIN NOTIFICATION (Students) ============ */}
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

        {/* ============ BREAKOUT ROOM LEAVE OPTIONS ============ */}
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

        {/* ============ LEAVE MEETING MODAL ============ */}
        {showLeaveOptions && (
          <div className="modal-overlay">
            <div className="leave-modal">
              <h3>Leave Meeting</h3>
              <p className="leave-question">What would you like to do?</p>
              
              <div className="leave-options">
                <button className="leave-option" onClick={handleLeaveMeeting}>
                  <LogOut size={24} />
                  <div className="leave-option-text">
                    <strong>Leave meeting</strong>
                    <span>You can rejoin later</span>
                  </div>
                </button>
                
                {role === 'teacher' && (
                  <button className="leave-option end" onClick={handleEndMeeting}>
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