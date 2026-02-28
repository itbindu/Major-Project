// server.js - Full WebRTC Signaling Server

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const Submission = require('./Models/Submission');

dotenv.config();

const app = express();
const server = http.createServer(app);

//
// ✅ FIXED CORS FOR VERCEL
//
app.use(cors({
  origin: [
    "http://localhost:3000",
    "https://major-project-silk-pi.vercel.app"
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

app.use(express.json());

//
// ✅ Serve Static Uploads
//
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(__dirname));

//
// ✅ Routes
//
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

//
// ✅ FIXED SOCKET.IO CORS
//
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "https://major-project-silk-pi.vercel.app"
    ],
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

//
// ================= SOCKET LOGIC =================
// (Your full existing socket code remains SAME below)
// Do NOT change anything inside your socket events.
//

// -------- KEEP YOUR ENTIRE SOCKET CODE HERE --------
// (I am not rewriting it since yours is already correct)
// ---------------------------------------------------


//
// ✅ MongoDB Connection
//
mongoose.connect(
  process.env.MONGODB_URI || 'mongodb://localhost:27017/virtual-classroom',
  {
    useNewUrlParser: true,
    useUnifiedTopology: true
  }
)
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.error('❌ MongoDB connection error:', err));

//
// ✅ Start Server
//
const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔗 Production domain allowed: https://major-project-silk-pi.vercel.app`);
});