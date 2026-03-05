// ================== IMPORTS ==================
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

dotenv.config();

const app = express();
const server = http.createServer(app);

// ================== CORS CONFIG ==================
const allowedOrigins = [
  "https://major-project-silk-pi.vercel.app",
  "http://localhost:3000"
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      return callback(new Error('CORS not allowed'), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ================== STATIC FILES ==================
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(__dirname));

// ================== ROUTES ==================
const teacherRoutes = require('./routes/teacherRoutes');
const studentRoutes = require('./routes/studentRoutes');
const authRoutes = require('./routes/authRoutes');
const quizRoutes = require('./routes/quizRoutes');

app.use('/api/teachers', teacherRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/quizzes', quizRoutes);

app.get('/', (req, res) => {
  res.send('🚀 Virtual Classroom Server Running');
});

// ================== SOCKET.IO with WebRTC Support ==================
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Store active meetings
const meetings = new Map();
const users = new Map(); // socketId -> user info

io.on('connection', (socket) => {
  console.log('🔵 User connected:', socket.id);

  // ============ MEETING EVENTS ============
  socket.on('join-meeting', ({ meetingId, userId, userName, role }) => {
    console.log(`👤 ${userName} (${role}) joining meeting: ${meetingId}`);
    
    socket.join(meetingId);
    
    // Store user info
    const userInfo = {
      socketId: socket.id,
      userId,
      userName,
      role,
      meetingId,
      audioEnabled: true,
      videoEnabled: true,
      joinedAt: new Date()
    };
    
    users.set(socket.id, userInfo);
    
    // Store in meetings map
    if (!meetings.has(meetingId)) {
      meetings.set(meetingId, new Map());
    }
    meetings.get(meetingId).set(socket.id, userInfo);
    
    // Get all users in this meeting except current user
    const meetingUsers = Array.from(meetings.get(meetingId).values())
      .filter(u => u.userId !== userId);
    
    // Send all existing users to the new user
    socket.emit('all-users', meetingUsers);
    
    // Notify others about new user
    socket.to(meetingId).emit('user-joined', userInfo);
    
    console.log(`✅ Total users in meeting ${meetingId}: ${meetings.get(meetingId).size}`);
  });

  // ============ WEBRTC SIGNALING ============
  socket.on('send-offer', ({ meetingId, targetUserId, offer }) => {
    console.log(`📤 Offer from ${socket.id} to ${targetUserId}`);
    
    // Find target socket
    let targetSocketId = null;
    const meeting = meetings.get(meetingId);
    if (meeting) {
      for (const [sid, user] of meeting) {
        if (user.userId === targetUserId) {
          targetSocketId = sid;
          break;
        }
      }
    }
    
    if (targetSocketId) {
      io.to(targetSocketId).emit('receive-offer', {
        fromUserId: users.get(socket.id)?.userId,
        offer
      });
    }
  });

  socket.on('send-answer', ({ meetingId, targetUserId, answer }) => {
    console.log(`📥 Answer from ${socket.id} to ${targetUserId}`);
    
    let targetSocketId = null;
    const meeting = meetings.get(meetingId);
    if (meeting) {
      for (const [sid, user] of meeting) {
        if (user.userId === targetUserId) {
          targetSocketId = sid;
          break;
        }
      }
    }
    
    if (targetSocketId) {
      io.to(targetSocketId).emit('receive-answer', {
        fromUserId: users.get(socket.id)?.userId,
        answer
      });
    }
  });

  socket.on('send-ice-candidate', ({ meetingId, targetUserId, candidate }) => {
    console.log(`🧊 ICE candidate from ${socket.id} to ${targetUserId}`);
    
    let targetSocketId = null;
    const meeting = meetings.get(meetingId);
    if (meeting) {
      for (const [sid, user] of meeting) {
        if (user.userId === targetUserId) {
          targetSocketId = sid;
          break;
        }
      }
    }
    
    if (targetSocketId) {
      io.to(targetSocketId).emit('receive-ice-candidate', {
        fromUserId: users.get(socket.id)?.userId,
        candidate
      });
    }
  });

  // ============ MEDIA STATE EVENTS ============
  socket.on('media-state-changed', ({ meetingId, userId, audioEnabled, videoEnabled }) => {
    console.log(`📹 Media state changed for ${userId}: audio=${audioEnabled}, video=${videoEnabled}`);
    
    // Update user info
    const user = users.get(socket.id);
    if (user) {
      user.audioEnabled = audioEnabled;
      user.videoEnabled = videoEnabled;
    }
    
    // Broadcast to meeting
    socket.to(meetingId).emit('media-state-changed', {
      userId,
      audioEnabled,
      videoEnabled
    });
  });

  // ============ SCREEN SHARE EVENTS ============
  socket.on('screen-share-started', ({ meetingId, userId }) => {
    console.log(`🖥️ Screen share started by ${userId}`);
    
    // Update user info
    const user = users.get(socket.id);
    if (user) {
      user.isScreenSharing = true;
    }
    
    socket.to(meetingId).emit('screen-share-started', { userId });
  });

  socket.on('screen-share-stopped', ({ meetingId, userId }) => {
    console.log(`🖥️ Screen share stopped by ${userId}`);
    
    // Update user info
    const user = users.get(socket.id);
    if (user) {
      user.isScreenSharing = false;
    }
    
    socket.to(meetingId).emit('screen-share-stopped', { userId });
  });

  // ============ CHAT EVENTS ============
  socket.on('chat-message', ({ meetingId, message }) => {
    console.log(`💬 Chat message in ${meetingId} from ${message.userName}`);
    io.to(meetingId).emit('chat-message', message);
  });

  // ============ MUTE EVENTS ============
  socket.on('mute-participant', ({ meetingId, userId }) => {
    console.log(`🔇 Mute request for ${userId} from ${socket.id}`);
    
    let targetSocketId = null;
    const meeting = meetings.get(meetingId);
    if (meeting) {
      for (const [sid, user] of meeting) {
        if (user.userId === userId) {
          targetSocketId = sid;
          break;
        }
      }
    }
    
    if (targetSocketId) {
      io.to(targetSocketId).emit('force-mute');
    }
  });

  // ============ MEETING END ============
  socket.on('end-meeting', ({ meetingId }) => {
    console.log(`⛔ Meeting ended: ${meetingId}`);
    io.to(meetingId).emit('meeting-ended');
    
    // Clean up meeting
    meetings.delete(meetingId);
  });

  // ============ LEAVE MEETING ============
  socket.on('leave-meeting', ({ meetingId, userId }) => {
    console.log(`👋 User ${userId} leaving meeting ${meetingId}`);
    
    // Remove from meetings
    const meeting = meetings.get(meetingId);
    if (meeting) {
      meeting.delete(socket.id);
      if (meeting.size === 0) {
        meetings.delete(meetingId);
      }
    }
    
    // Remove from users
    users.delete(socket.id);
    
    // Notify others
    socket.to(meetingId).emit('user-left', userId);
    socket.leave(meetingId);
  });

  // ============ DISCONNECT ============
  socket.on('disconnect', () => {
    console.log('🔴 User disconnected:', socket.id);
    
    const user = users.get(socket.id);
    if (user) {
      const { meetingId, userId } = user;
      
      // Remove from meetings
      const meeting = meetings.get(meetingId);
      if (meeting) {
        meeting.delete(socket.id);
        if (meeting.size === 0) {
          meetings.delete(meetingId);
        }
      }
      
      // Notify others
      socket.to(meetingId).emit('user-left', userId);
      
      // Remove from users
      users.delete(socket.id);
    }
  });
});

// ================== DATABASE ==================
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/virtual-classroom')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// ================== SERVER START ==================
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log('✅ CORS enabled for origins:', allowedOrigins);
});