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
  "https://major-project-silk-pi.vercel.app", // Your Vercel frontend
  "http://localhost:3000" // For local development
];

// CORS middleware for Express routes
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
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

// Test endpoint for CORS
app.get('/test-cors', (req, res) => {
  res.json({ 
    message: 'CORS is working!', 
    origin: req.headers.origin 
  });
});

// ================== SOCKET.IO ==================
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization"]
  },
  transports: ['websocket', 'polling'],
  allowEIO3: true
});

const meetings = new Map();
const userSockets = new Map();

io.on('connection', (socket) => {
  console.log('🔵 User connected:', socket.id);

  socket.on('join-meeting', ({ meetingId, userId, userName, role }) => {
    socket.join(meetingId);
    socket.data = { meetingId, userId };
    userSockets.set(socket.id, { meetingId, userId });

    if (!meetings.has(meetingId)) {
      meetings.set(meetingId, { participants: [] });
    }

    const meeting = meetings.get(meetingId);

    const participant = {
      socketId: socket.id,
      userId,
      userName,
      role,
      audioEnabled: true,
      videoEnabled: true
    };

    meeting.participants.push(participant);

    socket.to(meetingId).emit('user-joined', participant);

    socket.emit('all-users',
      meeting.participants.filter(p => p.userId !== userId)
    );

    console.log(`✅ ${userName} joined meeting ${meetingId}`);
  });

  socket.on('signal', ({ userToSignal, callerId, signal }) => {
    io.to(userToSignal).emit('signal', {
      from: callerId,
      signal
    });
  });

  socket.on('chat-message', ({ meetingId, message }) => {
    io.to(meetingId).emit('chat-message', {
      ...message,
      timestamp: new Date().toLocaleTimeString()
    });
  });

  socket.on('leave-meeting', ({ meetingId, userId }) => {
    const meeting = meetings.get(meetingId);
    if (meeting) {
      meeting.participants = meeting.participants.filter(p => p.userId !== userId);
      socket.to(meetingId).emit('user-left', userId);

      if (meeting.participants.length === 0) {
        meetings.delete(meetingId);
      }
    }
    socket.leave(meetingId);
  });

  socket.on('disconnect', () => {
    const { meetingId, userId } = socket.data || {};
    if (meetingId && userId) {
      const meeting = meetings.get(meetingId);
      if (meeting) {
        meeting.participants = meeting.participants.filter(p => p.userId !== userId);
        socket.to(meetingId).emit('user-left', userId);

        if (meeting.participants.length === 0) {
          meetings.delete(meetingId);
        }
      }
    }
    userSockets.delete(socket.id);
    console.log('🔴 User disconnected:', socket.id);
  });
});

// ================== DEBUG UPLOADS ==================
app.get('/debug-uploads', (req, res) => {
  const uploadsPath = path.join(__dirname, 'uploads');

  if (fs.existsSync(uploadsPath)) {
    const files = fs.readdirSync(uploadsPath);
    res.json({ success: true, files });
  } else {
    res.json({ success: false, message: "Uploads folder not found" });
  }
});

// ================== ERROR HANDLING MIDDLEWARE ==================
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  
  // Handle CORS errors specifically
  if (err.message.includes('CORS')) {
    return res.status(403).json({ 
      error: 'CORS error', 
      message: 'Origin not allowed',
      allowedOrigins: allowedOrigins
    });
  }
  
  res.status(500).json({ 
    error: 'Server error', 
    message: err.message 
  });
});

// ================== DATABASE ==================
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// ================== SERVER START ==================
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log('✅ CORS enabled for origins:', allowedOrigins);
});