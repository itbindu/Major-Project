// server.js - Full WebRTC Signaling Server
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path'); // ✅ ADD THIS - Required for path handling
const Submission = require('./Models/Submission');
dotenv.config();

const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors({
  origin: ["http://localhost:3000", "https://major-project-phase-2-avcq9u5z8-gugulothu-bindus-projects.vercel.app"],
  credentials: true
}));
app.use(express.json());

// ✅ IMPORTANT: Serve static files from uploads directory
// Add this BEFORE your routes
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Also serve static files from the current directory
app.use(express.static(__dirname));

// Routes
const teacherRoutes = require('./routes/teacherRoutes');
const studentRoutes = require('./routes/studentRoutes');
const authRoutes = require('./routes/authRoutes');
const quizRoutes = require('./routes/quizRoutes');
app.use('/api/teachers', teacherRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/quizzes', quizRoutes);

app.get('/', (req, res) => {
  res.send('Virtual Classroom Server Running');
});

// Socket.IO with WebRTC signaling
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Store active meetings
const meetings = new Map();
const userSockets = new Map();

io.on('connection', (socket) => {
  console.log('🔵 User connected:', socket.id);

  // ============ MEETING MANAGEMENT ============
  socket.on('join-meeting', (data) => {
    const { meetingId, userId, userName, role } = data;
    
    // Join socket room
    socket.join(meetingId);
    
    // Store user data
    socket.data = { meetingId, userId, userName, role };
    userSockets.set(socket.id, { meetingId, userId, userName, role });
    
    // Initialize meeting if not exists
    if (!meetings.has(meetingId)) {
      meetings.set(meetingId, {
        id: meetingId,
        participants: [],
        createdAt: new Date(),
        isRecording: false,
        isLocked: false
      });
    }
    
    const meeting = meetings.get(meetingId);
    
    // Check if user already exists
    const existingParticipant = meeting.participants.find(p => p.userId === userId);
    
    if (!existingParticipant) {
      const participant = {
        socketId: socket.id,
        userId,
        userName,
        role,
        joinedAt: new Date(),
        audioEnabled: true,
        videoEnabled: true,
        isScreenSharing: false,
        isHandRaised: false
      };
      
      meeting.participants.push(participant);
      
      // Notify existing users about new user
      socket.to(meetingId).emit('user-joined', {
        userId,
        userName,
        role,
        socketId: socket.id,
        audioEnabled: true,
        videoEnabled: true
      });
      
      // Send list of existing users to new user
      const otherParticipants = meeting.participants
        .filter(p => p.userId !== userId)
        .map(p => ({
          userId: p.userId,
          userName: p.userName,
          role: p.role,
          socketId: p.socketId,
          audioEnabled: p.audioEnabled,
          videoEnabled: p.videoEnabled,
          isScreenSharing: p.isScreenSharing
        }));
      
      socket.emit('all-users', otherParticipants);
    }
    
    socket.emit('meeting-joined', {
      meetingId,
      participants: meeting.participants.filter(p => p.userId !== userId)
    });
    
    console.log(`✅ ${userName} (${role}) joined meeting ${meetingId}`);
    console.log(`   Participants: ${meeting.participants.length}`);
  });

  // ============ WEBRTC SIGNALING ============
  socket.on('signal', (data) => {
    const { userToSignal, callerId, signal } = data;
    
    io.to(userToSignal).emit('signal', {
      from: callerId,
      signal
    });
    
    console.log(`📡 Signal from ${callerId} to ${userToSignal}`);
  });

  // ============ MEDIA STATE ============
  socket.on('media-state-changed', (data) => {
    const { meetingId, userId, audioEnabled, videoEnabled } = data;
    
    const meeting = meetings.get(meetingId);
    if (meeting) {
      const participant = meeting.participants.find(p => p.userId === userId);
      if (participant) {
        participant.audioEnabled = audioEnabled;
        participant.videoEnabled = videoEnabled;
      }
    }
    
    socket.to(meetingId).emit('media-state-changed', {
      userId,
      audioEnabled,
      videoEnabled
    });
  });

  socket.on('media-stream-ready', (data) => {
    const { meetingId, userId } = data;
    console.log(`📹 Media stream ready for ${userId} in ${meetingId}`);
  });

  // ============ SCREEN SHARING ============
  socket.on('screen-share-started', (data) => {
    const { meetingId, userId } = data;
    
    const meeting = meetings.get(meetingId);
    if (meeting) {
      const participant = meeting.participants.find(p => p.userId === userId);
      if (participant) {
        participant.isScreenSharing = true;
      }
    }
    
    socket.to(meetingId).emit('screen-share-started', { userId });
    console.log(`🖥️ ${userId} started screen sharing`);
  });

  socket.on('screen-share-stopped', (data) => {
    const { meetingId, userId } = data;
    
    const meeting = meetings.get(meetingId);
    if (meeting) {
      const participant = meeting.participants.find(p => p.userId === userId);
      if (participant) {
        participant.isScreenSharing = false;
      }
    }
    
    socket.to(meetingId).emit('screen-share-stopped', { userId });
    console.log(`🖥️ ${userId} stopped screen sharing`);
  });

  // ============ CHAT ============
  socket.on('chat-message', (data) => {
    const { meetingId, message } = data;
    
    const chatMessage = {
      ...message,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    
    io.to(meetingId).emit('chat-message', chatMessage);
    console.log(`💬 Message in ${meetingId} from ${message.userName}`);
  });

  socket.on('pin-message', (data) => {
    const { meetingId, message } = data;
    io.to(meetingId).emit('message-pinned', message);
  });

  // ============ RAISE HAND ============
  socket.on('raise-hand', (data) => {
    const { meetingId, userId, userName } = data;
    
    const meeting = meetings.get(meetingId);
    if (meeting) {
      const participant = meeting.participants.find(p => p.userId === userId);
      if (participant) {
        participant.isHandRaised = true;
        setTimeout(() => {
          if (participant) participant.isHandRaised = false;
        }, 5000);
      }
    }
    
    io.to(meetingId).emit('raise-hand', { userId, userName });
    console.log(`✋ ${userName} raised hand`);
  });

  // ============ REACTIONS ============
  socket.on('send-reaction', (data) => {
    const { meetingId, userId, userName, reaction } = data;
    io.to(meetingId).emit('reaction', { userId, userName, reaction });
  });

  // ============ MUTE PARTICIPANT (Teacher only) ============
  socket.on('mute-participant', (data) => {
    const { meetingId, userId } = data;
    
    // Find the participant's socket
    const meeting = meetings.get(meetingId);
    if (meeting) {
      const participant = meeting.participants.find(p => p.userId === userId);
      if (participant) {
        io.to(participant.socketId).emit('force-mute');
        participant.audioEnabled = false;
      }
    }
  });

  // ============ RECORDING ============
  socket.on('recording-started', (data) => {
    const { meetingId } = data;
    
    const meeting = meetings.get(meetingId);
    if (meeting) {
      meeting.isRecording = true;
    }
    
    socket.to(meetingId).emit('recording-started');
    console.log(`🔴 Recording started in ${meetingId}`);
  });

  socket.on('recording-stopped', (data) => {
    const { meetingId } = data;
    
    const meeting = meetings.get(meetingId);
    if (meeting) {
      meeting.isRecording = false;
    }
    
    socket.to(meetingId).emit('recording-stopped');
    console.log(`⏹️ Recording stopped in ${meetingId}`);
  });

  // ============ LEAVE MEETING ============
  socket.on('leave-meeting', (data) => {
    const { meetingId, userId } = data;
    
    const meeting = meetings.get(meetingId);
    if (meeting) {
      meeting.participants = meeting.participants.filter(p => p.userId !== userId);
      
      // Notify others
      socket.to(meetingId).emit('user-left', userId);
      
      // Clean up empty meetings
      if (meeting.participants.length === 0) {
        meetings.delete(meetingId);
        console.log(`🗑️ Meeting ${meetingId} ended (no participants)`);
      }
    }
    
    socket.leave(meetingId);
    userSockets.delete(socket.id);
    console.log(`👋 User ${userId} left meeting ${meetingId}`);
  });

  socket.on('end-meeting', (data) => {
    const { meetingId } = data;
    
    const meeting = meetings.get(meetingId);
    if (meeting) {
      // Notify all participants
      io.to(meetingId).emit('meeting-ended');
      
      // Remove all participants
      meeting.participants.forEach(participant => {
        const participantSocket = userSockets.get(participant.socketId);
        if (participantSocket) {
          io.to(participant.socketId).emit('meeting-ended');
        }
      });
      
      // Clean up
      meetings.delete(meetingId);
      console.log(`🏁 Meeting ${meetingId} ended by host`);
    }
  });

  // ============ DISCONNECT ============
  socket.on('disconnect', () => {
    const { meetingId, userId } = socket.data;
    
    if (meetingId && userId) {
      const meeting = meetings.get(meetingId);
      if (meeting) {
        meeting.participants = meeting.participants.filter(p => p.userId !== userId);
        
        // Notify others
        socket.to(meetingId).emit('user-left', userId);
        
        if (meeting.participants.length === 0) {
          meetings.delete(meetingId);
          console.log(`🗑️ Meeting ${meetingId} ended (no participants)`);
        }
      }
    }
    
    userSockets.delete(socket.id);
    console.log('🔴 User disconnected:', socket.id);
  });
});

// ✅ Add this debug endpoint to check if uploads directory exists and files are there
app.get('/debug-uploads', (req, res) => {
  const fs = require('fs');
  const uploadsPath = path.join(__dirname, 'uploads');
  
  try {
    if (fs.existsSync(uploadsPath)) {
      const files = fs.readdirSync(uploadsPath);
      res.json({
        success: true,
        uploadsDirectory: uploadsPath,
        files: files,
        staticUrl: 'http://localhost:5000/uploads/',
        staticMiddleware: 'app.use("/uploads", express.static("uploads")) is active'
      });
    } else {
      res.json({
        success: false,
        error: 'Uploads directory does not exist',
        path: uploadsPath,
        suggestion: 'Run: mkdir -p uploads'
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Database connection
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/virtual-classroom', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📁 Uploads directory: ${path.join(__dirname, 'uploads')}`);
  console.log(`🔗 Static files served at: http://localhost:${PORT}/uploads/`);
  console.log(`🔍 Debug uploads at: http://localhost:${PORT}/debug-uploads`);
});