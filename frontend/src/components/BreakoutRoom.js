// src/components/BreakoutRoom.js - COMPLETE FIXED VERSION
import React, { useState, useEffect } from 'react';
import { 
  Users, LogOut, UserPlus, Settings, CheckCircle, 
  DoorOpen, ArrowLeft, Home, Video, Mic, MicOff, VideoOff,
  Bell, RefreshCw
} from 'lucide-react';
import './BreakoutRoom.css';

const BreakoutRoom = ({ meetingId, userId, userName, role, participants, socket }) => {
  const [breakoutRooms, setBreakoutRooms] = useState([]);
  const [showCreationModal, setShowCreationModal] = useState(false);
  const [assignmentMethod, setAssignmentMethod] = useState('auto');
  const [roomCount, setRoomCount] = useState(2);
  const [selectedParticipants, setSelectedParticipants] = useState({});
  const [selectedTeachers, setSelectedTeachers] = useState({});
  const [currentRoom, setCurrentRoom] = useState(null);
  const [roomParticipants, setRoomParticipants] = useState({});
  const [showLeaveRoomOptions, setShowLeaveRoomOptions] = useState(false);
  const [miniMeetingActive, setMiniMeetingActive] = useState(false);
  const [assignmentNotification, setAssignmentNotification] = useState(null);
  const [loading, setLoading] = useState(false);
  
  // Mini meeting states for breakout room
  const [roomMicOn, setRoomMicOn] = useState(true);
  const [roomCameraOn, setRoomCameraOn] = useState(false);

  // Load saved breakout rooms from localStorage
  useEffect(() => {
    const savedRooms = localStorage.getItem(`breakout_${meetingId}`);
    if (savedRooms) {
      try {
        const parsedRooms = JSON.parse(savedRooms);
        setBreakoutRooms(parsedRooms);
        console.log('Loaded breakout rooms from localStorage:', parsedRooms);
      } catch (e) {
        console.error('Error parsing breakout rooms:', e);
      }
    }
  }, [meetingId]);

  // Save breakout rooms to localStorage
  useEffect(() => {
    if (breakoutRooms.length > 0) {
      localStorage.setItem(`breakout_${meetingId}`, JSON.stringify(breakoutRooms));
    }
  }, [breakoutRooms, meetingId]);

  // ============ ASSIGN PARTICIPANT TO ROOM ============
  const assignParticipant = (roomId, participantId) => {
    if (role !== 'teacher') return;
    
    const room = breakoutRooms.find(r => r.id === roomId);
    if (!room) {
      alert('Room not found');
      return;
    }

    // Check if participant exists
    const participant = participants.find(p => p.userId === participantId);
    if (!participant) {
      alert('Participant not found');
      return;
    }

    console.log(`Assigning participant ${participant.userName} to room ${room.name}`);

    setBreakoutRooms(prev => {
      // First, remove participant from all rooms
      let updatedRooms = prev.map(r => ({
        ...r,
        participants: r.participants.filter(id => id !== participantId),
        teachers: r.teachers.filter(id => id !== participantId)
      }));

      // Then add to selected room
      updatedRooms = updatedRooms.map(r => {
        if (r.id === roomId) {
          if (participant.role === 'teacher') {
            return {
              ...r,
              teachers: [...r.teachers, participantId]
            };
          } else {
            return {
              ...r,
              participants: [...r.participants, participantId]
            };
          }
        }
        return r;
      });

      // Save to localStorage
      localStorage.setItem(`breakout_${meetingId}`, JSON.stringify(updatedRooms));
      return updatedRooms;
    });

    // Show notification to the assigned participant via socket
    if (socket) {
      socket.emit('assign-to-breakout-room', {
        meetingId,
        roomId,
        roomName: room.name,
        participantId,
        assignedBy: userId,
        assignedByName: userName
      });

      // Also emit manual assignment event for the participant
      socket.emit('manual-assignment', {
        meetingId,
        roomId,
        roomName: room.name,
        participantId,
        assignedBy: userId,
        assignedByName: userName
      });
    }

    // Show success message
    alert(`${participant.userName} assigned to ${room.name}`);
  };

  // ============ REMOVE PARTICIPANT FROM ROOM ============
  const removeParticipant = (roomId, participantId) => {
    if (role !== 'teacher') return;
    
    setBreakoutRooms(prev => {
      const updatedRooms = prev.map(room => {
        if (room.id === roomId) {
          return {
            ...room,
            participants: room.participants.filter(id => id !== participantId),
            teachers: room.teachers.filter(id => id !== participantId)
          };
        }
        return room;
      });
      
      localStorage.setItem(`breakout_${meetingId}`, JSON.stringify(updatedRooms));
      return updatedRooms;
    });

    if (socket) {
      socket.emit('remove-from-breakout-room', {
        meetingId,
        roomId,
        participantId,
        removedBy: userName
      });
    }
  };

  // Listen for socket events
  useEffect(() => {
    if (!socket) {
      console.log('No socket connection available');
      return;
    }

    console.log('Setting up breakout room socket listeners for:', role, userId);

    // Listen for when breakout rooms are created
    socket.on('breakout-rooms-created', (data) => {
      console.log('Breakout rooms created event received:', data);
      const { rooms, assignmentMethod } = data;
      
      setBreakoutRooms(rooms);
      localStorage.setItem(`breakout_${meetingId}`, JSON.stringify(rooms));
      
      // If auto-assign and student is assigned, auto-join
      if (assignmentMethod === 'auto' && role === 'student') {
        const assignedRoom = rooms.find(room => 
          room.participants.includes(userId) || room.teachers.includes(userId)
        );
        
        if (assignedRoom) {
          console.log('Student auto-assigned to room:', assignedRoom);
          setAssignmentNotification({
            roomId: assignedRoom.id,
            roomName: assignedRoom.name,
            assignedBy: 'Teacher',
            timestamp: new Date().toISOString()
          });
          
          setTimeout(() => {
            autoJoinBreakoutRoom(assignedRoom.id);
            setAssignmentNotification(null);
          }, 2000);
        }
      }
    });

    // Listen for when student is assigned to a breakout room (manual assignment)
    socket.on('assigned-to-breakout-room', (data) => {
      console.log('Assigned to breakout room event received:', data);
      const { roomId, roomName, assignedBy } = data;
      
      // Update breakout rooms with assignment
      setBreakoutRooms(prevRooms => {
        const updatedRooms = prevRooms.map(room => {
          if (room.id === roomId) {
            return {
              ...room,
              participants: [...room.participants, userId]
            };
          }
          return room;
        });
        localStorage.setItem(`breakout_${meetingId}`, JSON.stringify(updatedRooms));
        return updatedRooms;
      });

      // Show notification
      setAssignmentNotification({
        roomId,
        roomName,
        assignedBy,
        timestamp: new Date().toISOString()
      });

      // Automatically join the breakout room
      setTimeout(() => {
        autoJoinBreakoutRoom(roomId);
        setAssignmentNotification(null);
      }, 2000);
    });

    // Listen for manual assignment from teacher
    socket.on('manual-assignment', (data) => {
      console.log('Manual assignment event received:', data);
      const { participantId, roomId, roomName } = data;
      
      if (participantId === userId) {
        // Update breakout rooms with assignment
        setBreakoutRooms(prevRooms => {
          const updatedRooms = prevRooms.map(room => {
            if (room.id === roomId) {
              return {
                ...room,
                participants: [...room.participants, userId]
              };
            }
            return room;
          });
          localStorage.setItem(`breakout_${meetingId}`, JSON.stringify(updatedRooms));
          return updatedRooms;
        });

        setAssignmentNotification({
          roomId,
          roomName,
          assignedBy: 'Teacher',
          timestamp: new Date().toISOString()
        });
        
        setTimeout(() => {
          autoJoinBreakoutRoom(roomId);
          setAssignmentNotification(null);
        }, 2000);
      }
    });

    // Listen for breakout rooms update
    socket.on('breakout-rooms-updated', (rooms) => {
      console.log('Breakout rooms updated:', rooms);
      setBreakoutRooms(rooms);
      localStorage.setItem(`breakout_${meetingId}`, JSON.stringify(rooms));
    });

    // Listen for all breakout rooms closed
    socket.on('breakout-rooms-closed', () => {
      console.log('Breakout rooms closed');
      setBreakoutRooms([]);
      setCurrentRoom(null);
      setMiniMeetingActive(false);
      localStorage.removeItem(`breakout_${meetingId}`);
    });

    return () => {
      socket.off('breakout-rooms-created');
      socket.off('assigned-to-breakout-room');
      socket.off('manual-assignment');
      socket.off('breakout-rooms-updated');
      socket.off('breakout-rooms-closed');
    };
  }, [socket, userId, role, meetingId]);

  // Request current breakout rooms on mount
  useEffect(() => {
    if (socket && meetingId) {
      // Request current breakout rooms
      socket.emit('get-breakout-rooms', { meetingId });
      
      // Also check localStorage
      const savedRooms = localStorage.getItem(`breakout_${meetingId}`);
      if (savedRooms) {
        try {
          const parsedRooms = JSON.parse(savedRooms);
          setBreakoutRooms(parsedRooms);
        } catch (e) {
          console.error('Error parsing saved rooms:', e);
        }
      }
    }
  }, [socket, meetingId]);

  // Auto join breakout room and leave main meeting
  const autoJoinBreakoutRoom = (roomId) => {
    console.log('Auto-joining breakout room:', roomId);
    const room = breakoutRooms.find(r => r.id === roomId);
    
    if (room) {
      // Set current room
      setCurrentRoom(roomId);
      setMiniMeetingActive(true);
      
      // Add user to room participants if not already
      const updatedRooms = breakoutRooms.map(r => {
        if (r.id === roomId) {
          if (!r.participants.includes(userId) && !r.teachers.includes(userId)) {
            if (role === 'teacher') {
              return { ...r, teachers: [...r.teachers, userId] };
            } else {
              return { ...r, participants: [...r.participants, userId] };
            }
          }
        }
        return r;
      });
      
      setBreakoutRooms(updatedRooms);
      localStorage.setItem(`breakout_${meetingId}`, JSON.stringify(updatedRooms));
      
      // Update room participants for mini meeting
      setRoomParticipants(prev => ({
        ...prev,
        [roomId]: [...(prev[roomId] || []), userId]
      }));
      
      // Emit socket event to notify others
      if (socket) {
        socket.emit('join-breakout-room', {
          meetingId,
          roomId,
          userId,
          userName,
          role,
          autoJoined: true
        });
        
        // Notify main meeting to hide main video/audio
        socket.emit('user-left-main-meeting', {
          meetingId,
          userId,
          userName,
          reason: 'joined_breakout'
        });
      }

      // Dispatch custom event for MeetingRoom component
      const event = new CustomEvent('breakoutRoomJoined', {
        detail: { roomId, userId, autoJoined: true }
      });
      window.dispatchEvent(event);
    }
  };

  // Manual join breakout room
  const joinBreakoutRoom = (roomId) => {
    console.log('Manually joining breakout room:', roomId);
    const room = breakoutRooms.find(r => r.id === roomId);
    
    if (room) {
      // Check if user is allowed to join
      const isTeacher = role === 'teacher';
      const isAssigned = room.participants.includes(userId) || room.teachers.includes(userId);
      
      // FOR DEBUG: Log the conditions
      console.log('Join conditions:', {
        isTeacher,
        isAssigned,
        assignmentMethod: room.assignmentMethod,
        userId,
        roomParticipants: room.participants,
        roomTeachers: room.teachers
      });

      // STUDENTS SHOULD ALWAYS BE ABLE TO JOIN IF:
      // 1. It's auto-assign mode, OR
      // 2. They are assigned to this room, OR
      // 3. They are a teacher
      const canJoin = room.assignmentMethod === 'auto' || isTeacher || isAssigned;
      
      if (canJoin) {
        setCurrentRoom(roomId);
        setMiniMeetingActive(true);
        
        // Add user to room participants if not already
        if (!room.participants.includes(userId) && !room.teachers.includes(userId)) {
          const updatedRooms = breakoutRooms.map(r => {
            if (r.id === roomId) {
              if (role === 'teacher') {
                return { ...r, teachers: [...r.teachers, userId] };
              } else {
                return { ...r, participants: [...r.participants, userId] };
              }
            }
            return r;
          });
          setBreakoutRooms(updatedRooms);
          localStorage.setItem(`breakout_${meetingId}`, JSON.stringify(updatedRooms));
        }
        
        // Update room participants for mini meeting
        setRoomParticipants(prev => ({
          ...prev,
          [roomId]: [...(prev[roomId] || []), userId]
        }));
        
        if (socket) {
          socket.emit('join-breakout-room', {
            meetingId,
            roomId,
            userId,
            userName,
            role
          });
          
          // Notify main meeting to hide main video/audio
          socket.emit('user-left-main-meeting', {
            meetingId,
            userId,
            userName,
            reason: 'joined_breakout'
          });
        }

        // Dispatch custom event for MeetingRoom component
        const event = new CustomEvent('breakoutRoomJoined', {
          detail: { roomId, userId }
        });
        window.dispatchEvent(event);
      } else {
        alert('You have not been assigned to this breakout room yet. Please wait for the teacher to assign you.');
      }
    }
  };

  // Leave breakout room only and return to main meeting
  const leaveBreakoutRoomOnly = () => {
    if (currentRoom) {
      // Remove user from room
      const updatedRooms = breakoutRooms.map(room => {
        if (room.id === currentRoom) {
          return {
            ...room,
            participants: room.participants.filter(id => id !== userId),
            teachers: room.teachers.filter(id => id !== userId)
          };
        }
        return room;
      });
      
      setBreakoutRooms(updatedRooms);
      localStorage.setItem(`breakout_${meetingId}`, JSON.stringify(updatedRooms));
      setCurrentRoom(null);
      setMiniMeetingActive(false);
      setShowLeaveRoomOptions(false);
      
      if (socket) {
        socket.emit('leave-breakout-room', {
          meetingId,
          roomId: currentRoom,
          userId,
          userName
        });
        
        // Notify main meeting to show main video/audio again
        socket.emit('user-returned-to-main-meeting', {
          meetingId,
          userId,
          userName
        });
      }

      // Dispatch custom event for MeetingRoom component
      const event = new CustomEvent('breakoutRoomLeft', {
        detail: { roomId: currentRoom, userId }
      });
      window.dispatchEvent(event);
    }
  };

  // Leave overall meeting
  const leaveOverallMeeting = () => {
    setShowLeaveRoomOptions(false);
    document.querySelector('.leave-btn')?.click();
  };

  // Create breakout rooms (teacher only)
  const createBreakoutRooms = () => {
    setLoading(true);
    const rooms = [];
    for (let i = 1; i <= roomCount; i++) {
      rooms.push({
        id: `room_${Date.now()}_${i}`,
        name: `Breakout Room ${i}`,
        number: i,
        participants: [],
        teachers: [],
        assignmentMethod: assignmentMethod,
        createdAt: new Date().toISOString(),
        active: true
      });
    }
    
    if (assignmentMethod === 'auto') {
      // Auto assign participants evenly
      const studentParticipants = participants.filter(p => p.role !== 'teacher');
      studentParticipants.forEach((participant, index) => {
        const roomIndex = index % roomCount;
        rooms[roomIndex].participants.push(participant.userId);
      });
      
      // Auto assign teachers
      const teacherParticipants = participants.filter(p => p.role === 'teacher');
      teacherParticipants.forEach((teacher, index) => {
        const roomIndex = index % roomCount;
        rooms[roomIndex].teachers.push(teacher.userId);
      });
    } else if (assignmentMethod === 'manual') {
      // Manual assignment
      rooms.forEach(room => {
        Object.keys(selectedParticipants).forEach(participantId => {
          if (selectedParticipants[participantId] === room.id) {
            room.participants.push(participantId);
          }
        });
        
        Object.keys(selectedTeachers).forEach(teacherId => {
          if (selectedTeachers[teacherId] === room.id) {
            room.teachers.push(teacherId);
          }
        });
      });
    }
    
    setBreakoutRooms(rooms);
    localStorage.setItem(`breakout_${meetingId}`, JSON.stringify(rooms));
    setShowCreationModal(false);
    setLoading(false);
    
    // Reset selections
    setSelectedParticipants({});
    setSelectedTeachers({});
    
    // Notify via socket
    if (socket) {
      socket.emit('breakout-rooms-created', {
        meetingId,
        rooms,
        assignmentMethod
      });
      
      // Send individual assignments to students for manual mode
      if (assignmentMethod === 'manual') {
        rooms.forEach(room => {
          room.participants.forEach(participantId => {
            setTimeout(() => {
              socket.emit('assign-to-breakout-room', {
                meetingId,
                roomId: room.id,
                roomName: room.name,
                participantId,
                assignedBy: userId,
                assignedByName: userName
              });
            }, 500);
          });
        });
      }
    }
  };

  // Refresh breakout rooms
  const refreshBreakoutRooms = () => {
    if (socket) {
      socket.emit('get-breakout-rooms', { meetingId });
    }
  };

  // Get participant name by ID
  const getParticipantName = (participantId) => {
    if (participantId === userId) return userName;
    const participant = participants.find(p => p.userId === participantId);
    return participant ? participant.userName : 'Unknown';
  };

  // Check if user is in any room
  const isInAnyRoom = currentRoom !== null;

  return (
    <div className="breakout-room-panel">
      {/* Assignment Notification */}
      {assignmentNotification && (
        <div className="assignment-notification">
          <Bell size={20} />
          <div className="notification-content">
            <strong>You've been assigned to {assignmentNotification.roomName}</strong>
            <span>Automatically joining in 2 seconds...</span>
          </div>
        </div>
      )}

      <div className="panel-header">
        <h3>
          <Users size={18} />
          Breakout Rooms
          {breakoutRooms.length > 0 && (
            <span className="room-count-badge">{breakoutRooms.length}</span>
          )}
        </h3>
        
        <div className="header-actions">
          {breakoutRooms.length > 0 && (
            <button 
              className="refresh-btn"
              onClick={refreshBreakoutRooms}
              title="Refresh rooms"
            >
              <RefreshCw size={14} />
            </button>
          )}
          
          {role === 'teacher' && !currentRoom && (
            <button 
              className="create-room-btn"
              onClick={() => setShowCreationModal(true)}
              disabled={loading}
            >
              <UserPlus size={16} />
              Create Rooms
            </button>
          )}
          
          {breakoutRooms.length > 0 && role === 'teacher' && !currentRoom && (
            <button 
              className="close-all-btn"
              onClick={() => {
                setBreakoutRooms([]);
                localStorage.removeItem(`breakout_${meetingId}`);
                if (socket) {
                  socket.emit('close-breakout-rooms', { meetingId });
                }
              }}
              title="Close all rooms"
            >
              <DoorOpen size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="breakout-content">
        {currentRoom && miniMeetingActive ? (
          <div className="current-room-meeting">
            <div className="room-meeting-header">
              <div className="room-meeting-info">
                <h4>{breakoutRooms.find(r => r.id === currentRoom)?.name}</h4>
                <span className="room-badge">Breakout Room</span>
              </div>
              <button 
                className="leave-room-btn"
                onClick={() => setShowLeaveRoomOptions(true)}
              >
                <LogOut size={16} />
                Leave Room
              </button>
            </div>
            
            {/* Mini Meeting Interface */}
            <div className="mini-meeting-container">
              <div className="mini-video-grid">
                <div className="mini-video-tile local">
                  <div className="mini-video-placeholder">
                    <div className="avatar-small">
                      {userName.charAt(0).toUpperCase()}
                    </div>
                  </div>
                  <div className="mini-video-overlay">
                    <span className="user-name-small">{userName} (You)</span>
                    <div className="mini-media-icons">
                      {roomMicOn ? <Mic size={12} /> : <MicOff size={12} />}
                      {roomCameraOn ? <Video size={12} /> : <VideoOff size={12} />}
                    </div>
                  </div>
                </div>
                
                {/* Room Participants */}
                {breakoutRooms.find(r => r.id === currentRoom)?.participants.map(pid => (
                  pid !== userId && (
                    <div key={pid} className="mini-video-tile">
                      <div className="mini-video-placeholder">
                        <div className="avatar-small">
                          {getParticipantName(pid).charAt(0).toUpperCase()}
                        </div>
                      </div>
                      <div className="mini-video-overlay">
                        <span className="user-name-small">{getParticipantName(pid)}</span>
                      </div>
                    </div>
                  )
                ))}
                
                {breakoutRooms.find(r => r.id === currentRoom)?.teachers.map(tid => (
                  tid !== userId && (
                    <div key={tid} className="mini-video-tile">
                      <div className="mini-video-placeholder">
                        <div className="avatar-small">
                          {getParticipantName(tid).charAt(0).toUpperCase()}
                        </div>
                      </div>
                      <div className="mini-video-overlay">
                        <span className="user-name-small">{getParticipantName(tid)} (Host)</span>
                      </div>
                    </div>
                  )
                ))}
              </div>
              
              <div className="mini-meeting-controls">
                <button 
                  className={`mini-control-btn ${!roomMicOn ? 'off' : ''}`}
                  onClick={() => setRoomMicOn(!roomMicOn)}
                >
                  {roomMicOn ? <Mic size={14} /> : <MicOff size={14} />}
                </button>
                <button 
                  className={`mini-control-btn ${!roomCameraOn ? 'off' : ''}`}
                  onClick={() => setRoomCameraOn(!roomCameraOn)}
                >
                  {roomCameraOn ? <Video size={14} /> : <VideoOff size={14} />}
                </button>
                <span className="room-chat-badge">Group Discussion</span>
              </div>
            </div>
            
            {/* Leave Room Options Modal */}
            {showLeaveRoomOptions && (
              <div className="modal-overlay small">
                <div className="modal-content small">
                  <div className="modal-header">
                    <h3>Leave Breakout Room</h3>
                    <button 
                      className="close-btn"
                      onClick={() => setShowLeaveRoomOptions(false)}
                    >
                      ×
                    </button>
                  </div>
                  <div className="modal-body">
                    <div className="leave-options-vertical">
                      <button 
                        className="leave-option-btn"
                        onClick={leaveBreakoutRoomOnly}
                      >
                        <ArrowLeft size={20} />
                        <div>
                          <strong>Leave breakout room</strong>
                          <span>Return to main meeting</span>
                        </div>
                      </button>
                      
                      <button 
                        className="leave-option-btn end"
                        onClick={leaveOverallMeeting}
                      >
                        <Home size={20} />
                        <div>
                          <strong>Leave overall meeting</strong>
                          <span>Exit the entire meeting</span>
                        </div>
                      </button>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button 
                      className="btn secondary"
                      onClick={() => setShowLeaveRoomOptions(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : breakoutRooms.length > 0 ? (
          <div className="rooms-list">
            {breakoutRooms.map(room => {
              // Check if user is in this room
              const isUserInRoom = room.participants.includes(userId) || room.teachers.includes(userId);
              
              return (
                <div key={room.id} className={`room-card ${isUserInRoom ? 'user-in-room' : ''}`}>
                  <div className="room-header">
                    <h4>{room.name}</h4>
                    <span className="room-count">
                      {room.participants.length + room.teachers.length} participants
                    </span>
                  </div>
                  
                  <div className="room-participants-preview">
                    {/* Show teachers in room */}
                    {room.teachers.map(teacherId => {
                      const teacher = participants.find(p => p.userId === teacherId);
                      return teacher ? (
                        <div key={teacherId} className="participant-preview teacher">
                          <div className="avatar-xs teacher">
                            {teacher.userName.charAt(0)}
                          </div>
                          <span>{teacher.userName} {teacherId === userId && '(You)'}</span>
                        </div>
                      ) : null;
                    })}
                    
                    {/* Show participants in room */}
                    {room.participants.slice(0, 3).map(participantId => {
                      const participant = participants.find(p => p.userId === participantId);
                      return participant ? (
                        <div key={participantId} className="participant-preview">
                          <div className="avatar-xs">
                            {participant.userName.charAt(0)}
                          </div>
                          <span>{participant.userName} {participantId === userId && '(You)'}</span>
                        </div>
                      ) : null;
                    })}
                    
                    {room.participants.length > 3 && (
                      <div className="more-participants">
                        +{room.participants.length - 3} more
                      </div>
                    )}
                  </div>
                  
                  <div className="room-actions">
                    {/* SHOW JOIN BUTTON FOR STUDENTS */}
                    {!currentRoom ? (
                      // Not in any breakout room
                      <>
                        {room.assignmentMethod === 'auto' ? (
                          // Auto mode - anyone can join
                          <button 
                            className="join-btn"
                            onClick={() => joinBreakoutRoom(room.id)}
                          >
                            Join Room
                          </button>
                        ) : (
                          // Manual mode - only if assigned
                          (room.participants.includes(userId) || 
                           room.teachers.includes(userId) || 
                           role === 'teacher') ? (
                            <button 
                              className="join-btn"
                              onClick={() => joinBreakoutRoom(room.id)}
                            >
                              Join Room
                            </button>
                          ) : (
                            <span className="waiting-message">
                              ⏳ Waiting for teacher to assign you...
                            </span>
                          )
                        )}
                      </>
                    ) : (
                      // Already in a breakout room
                      <span className="in-room-message">
                        ✅ You're in another room
                      </span>
                    )}
                    
                    {role === 'teacher' && (
                      <button 
                        className="assign-btn"
                        onClick={() => {
                          // Create a custom assignment prompt
                          const participantOptions = participants
                            .filter(p => p.userId !== userId)
                            .map(p => `${p.userName} (${p.userId})`)
                            .join('\n');
                          
                          const selected = prompt(
                            `Assign participant to ${room.name}:\n\nAvailable participants:\n${participantOptions}\n\nEnter participant ID:`,
                            ''
                          );
                          
                          if (selected && selected.trim()) {
                            let participantId = selected.trim();
                            // Extract ID if in format "Name (userId)"
                            const match = selected.match(/\(([^)]+)\)/);
                            if (match) {
                              participantId = match[1];
                            }
                            assignParticipant(room.id, participantId);
                          }
                        }}
                      >
                        <Settings size={14} />
                        Assign
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="empty-state">
            <Users size={48} />
            <h4>No Breakout Rooms</h4>
            <p>Create breakout rooms for group discussions</p>
            {role === 'teacher' && (
              <button 
                className="create-btn"
                onClick={() => setShowCreationModal(true)}
              >
                Create Breakout Rooms
              </button>
            )}
            {role === 'student' && (
              <p className="waiting-teacher-message">
                Waiting for teacher to create breakout rooms...
              </p>
            )}
          </div>
        )}
      </div>

      {/* Creation Modal - Teacher Only */}
      {showCreationModal && role === 'teacher' && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Create Breakout Rooms</h3>
              <button 
                className="close-btn"
                onClick={() => setShowCreationModal(false)}
              >
                ×
              </button>
            </div>
            
            <div className="modal-body">
              <div className="form-group">
                <label>Number of Rooms</label>
                <div className="room-count-selector">
                  {[2, 3, 4, 5, 6].map(num => (
                    <button
                      key={num}
                      className={`count-btn ${roomCount === num ? 'active' : ''}`}
                      onClick={() => setRoomCount(num)}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>
              
              <div className="form-group">
                <label>Assignment Method</label>
                <div className="radio-group">
                  <label className="radio-label">
                    <input
                      type="radio"
                      value="auto"
                      checked={assignmentMethod === 'auto'}
                      onChange={(e) => setAssignmentMethod(e.target.value)}
                    />
                    <div>
                      <strong>Option 1: Auto-assign participants</strong>
                      <span>Students can join any room freely</span>
                    </div>
                  </label>
                  <label className="radio-label">
                    <input
                      type="radio"
                      value="manual"
                      checked={assignmentMethod === 'manual'}
                      onChange={(e) => setAssignmentMethod(e.target.value)}
                    />
                    <div>
                      <strong>Option 2: Manual assignment</strong>
                      <span>Students are assigned to specific rooms</span>
                    </div>
                  </label>
                </div>
              </div>
              
              {assignmentMethod === 'manual' && (
                <>
                  <div className="form-group">
                    <label>Assign Students to Rooms</label>
                    <div className="participants-assignment">
                      {participants.filter(p => p.role !== 'teacher').map(participant => (
                        <div key={participant.userId} className="assignable-participant">
                          <span>{participant.userName}</span>
                          <select
                            value={selectedParticipants[participant.userId] || ''}
                            onChange={(e) => {
                              setSelectedParticipants(prev => ({
                                ...prev,
                                [participant.userId]: e.target.value
                              }));
                            }}
                          >
                            <option value="">Select Room</option>
                            {Array.from({ length: roomCount }, (_, i) => i + 1).map(num => (
                              <option key={num} value={`room_${Date.now()}_${num}`}>
                                Room {num}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label>Assign Teachers to Rooms (Optional)</label>
                    <div className="participants-assignment">
                      {participants.filter(p => p.role === 'teacher' && p.userId !== userId).map(teacher => (
                        <div key={teacher.userId} className="assignable-participant">
                          <span>{teacher.userName}</span>
                          <select
                            value={selectedTeachers[teacher.userId] || ''}
                            onChange={(e) => {
                              setSelectedTeachers(prev => ({
                                ...prev,
                                [teacher.userId]: e.target.value
                              }));
                            }}
                          >
                            <option value="">Select Room</option>
                            {Array.from({ length: roomCount }, (_, i) => i + 1).map(num => (
                              <option key={num} value={`room_${Date.now()}_${num}`}>
                                Room {num}
                              </option>
                            ))}
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
              
              <div className="info-box">
                <p><CheckCircle size={14} /> Teachers can access and join any breakout room</p>
                <p><CheckCircle size={14} /> Students see Join button when rooms are created</p>
                <p><CheckCircle size={14} /> Manual assignment sends automatic join notification</p>
              </div>
            </div>
            
            <div className="modal-footer">
              <button 
                className="btn secondary"
                onClick={() => setShowCreationModal(false)}
              >
                Cancel
              </button>
              <button 
                className="btn primary"
                onClick={createBreakoutRooms}
                disabled={loading}
              >
                {loading ? 'Creating...' : `Create ${roomCount} Rooms`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BreakoutRoom;