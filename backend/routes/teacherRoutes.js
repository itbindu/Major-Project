// Updated file: backend/routes/teacherRoutes.js - Complete fixed version
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Teacher = require('../Models/Teacher');
const Student = require('../Models/Student');
const Meeting = require('../Models/Meeting');
const nodemailer = require('nodemailer');
const multer = require('multer');
const fs = require('fs');
const { generateAndSendOtp } = require('../services/otpService');
const authenticateToken = require('../middleware/auth');

const router = express.Router();

// ============ MULTER CONFIGURATION FOR FILE UPLOADS ============
// Create uploads directory if it doesn't exist
const uploadDir = 'uploads/';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Clean filename and add timestamp to prevent duplicates
    const timestamp = Date.now();
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.]/g, '_');
    cb(null, `${timestamp}-${sanitizedName}`);
  }
});

// File filter - accept all common file types
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    // Images
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    // Documents
    'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain', 'text/csv', 'text/markdown',
    // Videos
    'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
    // Archives
    'application/zip', 'application/x-zip-compressed', 'application/x-rar-compressed',
    // Audio
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3'
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('File type not supported. Please upload images, PDFs, documents, videos, or audio files.'), false);
  }
};

// Configure multer upload
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 200 * 1024 * 1024 // 200MB max file size
  },
  fileFilter: fileFilter
});

// ============ EMAIL TRANSPORTER ============
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ============ OTP ROUTES ============
// Send OTP for teacher registration
router.post('/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email is required' });
  const otpResult = await generateAndSendOtp(email);
  res.status(otpResult.success ? 200 : 500).json(otpResult);
});

// Verify OTP for teacher
router.post('/verify-otp', async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ message: 'Email and OTP are required' });
  const { verifyOtp } = require('../services/otpService');
  const otpResult = verifyOtp(email, otp);
  res.status(otpResult.success ? 200 : 400).json(otpResult);
});

// ============ AUTH ROUTES ============
// Signup teacher after OTP verification
router.post('/signup', async (req, res) => {
  const { firstName, lastName, email, phoneNumber, password } = req.body;
  if (!firstName || !lastName || !email || !phoneNumber || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const existingTeacher = await Teacher.findOne({ $or: [{ email }, { phoneNumber }] });
    if (existingTeacher) {
      return res.status(400).json({ message: 'Email or phone number already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newTeacher = new Teacher({
      firstName,
      lastName,
      email,
      phoneNumber,
      password: hashedPassword,
      isEmailVerified: true,
      students: [],
      files: []
    });

    await newTeacher.save();
    res.status(200).json({ message: 'Teacher account created successfully!' });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ message: `Signup failed. Try again. Error: ${error.message}` });
  }
});

// Login teacher
router.post('/login', async (req, res) => {
  const { emailOrPhone, password } = req.body;
  if (!emailOrPhone || !password) return res.status(400).json({ message: 'Email/Phone and password are required' });

  try {
    const user = await Teacher.findOne({
      $or: [{ email: emailOrPhone }, { phoneNumber: emailOrPhone }],
    });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    if (!user.isEmailVerified) return res.status(400).json({ message: 'Please verify your email' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user._id, email: user.email, role: 'teacher' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    const userData = {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      id: user._id
    };
    
    res.status(200).json({ 
      token, 
      userId: user._id, 
      user: userData,
      role: 'teacher'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get teacher profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.user.id)
      .select('firstName lastName email phoneNumber students files')
      .populate('students', 'firstName lastName email');
      
    if (!teacher) return res.status(404).json({ message: 'Teacher not found' });
    res.status(200).json(teacher);
  } catch (error) {
    console.error('Fetch teacher profile error:', error);
    res.status(500).json({ message: 'Failed to fetch profile' });
  }
});

// ============ STUDENT MANAGEMENT ROUTES ============
// Fetch ALL students with populated teachers info
router.get('/registered-students', authenticateToken, async (req, res) => {
  try {
    const students = await Student.find()
      .populate('teachers', 'firstName lastName email')
      .select('firstName lastName email phoneNumber isApproved teachers');
    res.status(200).json({ success: true, students });
  } catch (error) {
    console.error('Fetch students error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch registered students' });
  }
});

// Assign/Approve student - add current teacher to array if not already
router.post('/approve-student', authenticateToken, async (req, res) => {
  const { studentId } = req.body;
  if (!studentId) return res.status(400).json({ message: 'Student ID is required' });
  
  try {
    const student = await Student.findById(studentId);
    if (!student) return res.status(404).json({ message: 'Student not found' });
    
    // Ensure teachers array exists
    if (!student.teachers) {
      student.teachers = [];
    }
    
    // Check if current teacher already assigned
    if (student.teachers.includes(req.user.id)) {
      return res.status(400).json({ message: 'You are already assigned to this student.' });
    }
    
    // Add current teacher to array
    student.teachers.push(req.user.id);
    
    // Set isApproved true if first assignment
    if (student.teachers.length === 1) {
      student.isApproved = true;
    }
    
    // Add student to teacher's students array
    await Teacher.findByIdAndUpdate(req.user.id, { 
      $addToSet: { students: studentId } 
    });
    
    await student.save();
    
    // Notify student via email
    const teacher = await Teacher.findById(req.user.id);
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: student.email,
      subject: `You've been assigned to teacher ${teacher.firstName} ${teacher.lastName}!`,
      html: `
        <h2>Dear ${student.firstName} ${student.lastName},</h2>
        <p>You have been assigned to teacher <strong>${teacher.firstName} ${teacher.lastName}</strong>.</p>
        <p>You can now access their meetings and learning materials.</p>
        <p>Total teachers assigned to you: ${student.teachers.length}</p>
        <p>Login to your dashboard to view new content: <a href="http://localhost:3000/student/login">Student Dashboard</a></p>
        <p>Best regards,<br>Virtual Classroom Team</p>
      `
    };
    
    await transporter.sendMail(mailOptions);
    console.log(`✅ Assignment email sent to ${student.email}`);

    res.status(200).json({ 
      success: true,
      message: `Student assigned successfully. Total teachers: ${student.teachers.length}` 
    });
  } catch (error) {
    console.error('Assign error:', error);
    res.status(500).json({ message: 'Failed to assign student' });
  }
});

// ============ MEETING ROUTES ============
// Create meeting - notify all assigned students
router.post('/create-meeting', authenticateToken, async (req, res) => {
  const { title, description, scheduledTime } = req.body;
  if (!title) return res.status(400).json({ message: 'Meeting title is required' });

  try {
    const meetingId = 'meeting_' + Math.random().toString(36).substr(2, 9).toUpperCase();

    const newMeeting = new Meeting({
      title,
      description: description || '',
      teacherId: req.user.id,
      meetingId,
      scheduledTime: scheduledTime || new Date(),
      isActive: true
    });

    await newMeeting.save();

    // Fetch students assigned to this teacher
    const assignedStudents = await Student.find({ teachers: req.user.id });
    const meetingLink = `http://localhost:3000/meeting/${meetingId}`;
    const teacher = await Teacher.findById(req.user.id);

    let notifiedCount = 0;
    if (assignedStudents.length > 0) {
      for (const student of assignedStudents) {
        try {
          const mailOptions = {
            from: process.env.EMAIL_USER,
            to: student.email,
            subject: `📅 New Meeting: ${title} from ${teacher.firstName} ${teacher.lastName}`,
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #1a73e8;">New Virtual Classroom Meeting</h2>
                <p><strong>Dear ${student.firstName} ${student.lastName},</strong></p>
                <p>Your teacher <strong>${teacher.firstName} ${teacher.lastName}</strong> has created a new meeting:</p>
                
                <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="margin-top: 0; color: #333;">${title}</h3>
                  ${description ? `<p><strong>Description:</strong> ${description}</p>` : ''}
                  <p><strong>Meeting ID:</strong> ${meetingId}</p>
                  <p><strong>Scheduled:</strong> ${new Date(scheduledTime).toLocaleString()}</p>
                </div>
                
                <a href="${meetingLink}" 
                   style="display: inline-block; background: #1a73e8; color: white; padding: 12px 30px; 
                          text-decoration: none; border-radius: 5px; font-weight: bold; margin: 10px 0;">
                  ➤ Join Meeting
                </a>
                
                <p style="margin-top: 20px; color: #666;">
                  <small>Link will expire when meeting ends.</small>
                </p>
              </div>
            `
          };

          await transporter.sendMail(mailOptions);
          console.log(`📧 Email sent to ${student.email}`);
          notifiedCount++;
        } catch (emailError) {
          console.error(`Failed to send email to ${student.email}:`, emailError);
        }
      }
    }

    res.status(200).json({ 
      success: true, 
      message: `✅ Meeting created! ${notifiedCount} assigned students notified.`,
      meetingId,
      link: meetingLink 
    });
  } catch (error) {
    console.error('Create meeting error:', error);
    res.status(500).json({ message: 'Failed to create meeting' });
  }
});

// Get teacher's meetings
router.get('/meetings', authenticateToken, async (req, res) => {
  try {
    const meetings = await Meeting.find({ teacherId: req.user.id })
      .sort({ createdAt: -1 })
      .select('title meetingId createdAt isActive description scheduledTime participants');
    res.status(200).json({ success: true, meetings });
  } catch (error) {
    console.error('Fetch meetings error:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch meetings' });
  }
});

// Get meeting details
router.get('/meeting/:meetingId', async (req, res) => {
  const { meetingId } = req.params;
  try {
    const meeting = await Meeting.findOne({ meetingId })
      .populate('teacherId', 'firstName lastName email');
      
    if (!meeting || !meeting.isActive) {
      return res.status(404).json({ message: 'Meeting not found or inactive' });
    }
    
    res.status(200).json({ success: true, meeting });
  } catch (error) {
    console.error('Get meeting error:', error);
    res.status(500).json({ message: 'Failed to get meeting details' });
  }
});

// Get meeting history with logs
router.get('/meeting-history/:meetingId', authenticateToken, async (req, res) => {
  try {
    const { meetingId } = req.params;
    const meeting = await Meeting.findOne({ meetingId })
      .populate('teacherId', 'firstName lastName')
      .populate('logs.userId', 'firstName lastName email');
      
    if (!meeting || meeting.teacherId._id.toString() !== req.user.id) {
      return res.status(404).json({ message: 'Meeting not found' });
    }
    
    res.status(200).json({ 
      success: true, 
      meeting, 
      logs: meeting.logs || [] 
    });
  } catch (error) {
    console.error('Fetch history error:', error);
    res.status(500).json({ message: 'Failed to fetch history' });
  }
});

// End meeting
router.post('/end-meeting/:meetingId', authenticateToken, async (req, res) => {
  try {
    const { meetingId } = req.params;
    const meeting = await Meeting.findOne({ meetingId });
    
    if (!meeting) {
      return res.status(404).json({ message: 'Meeting not found' });
    }
    
    if (meeting.teacherId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the host can end this meeting' });
    }
    
    meeting.isActive = false;
    await meeting.save();
    
    res.status(200).json({ success: true, message: 'Meeting ended successfully' });
  } catch (error) {
    console.error('End meeting error:', error);
    res.status(500).json({ message: 'Failed to end meeting' });
  }
});

// ============ FILE MANAGEMENT ROUTES ============
// Upload multiple files with description
router.post('/upload-file', authenticateToken, upload.array('file', 20), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'No files uploaded' });
    }

    const description = req.body.description || '';
    const teacher = await Teacher.findById(req.user.id);
    
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }

    // Initialize files array if it doesn't exist
    if (!teacher.files) {
      teacher.files = [];
    }

    // Process each uploaded file
    const uploadedFiles = [];
    
    for (const file of req.files) {
      const filePath = `/uploads/${file.filename}`;
      
      // Get file extension
      const fileExt = file.originalname.split('.').pop().toLowerCase();
      
      // Determine file category
      let category = 'other';
      if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(fileExt)) category = 'image';
      else if (['mp4', 'webm', 'mov', 'avi', 'mkv'].includes(fileExt)) category = 'video';
      else if (['pdf'].includes(fileExt)) category = 'pdf';
      else if (['doc', 'docx'].includes(fileExt)) category = 'document';
      else if (['xls', 'xlsx', 'csv'].includes(fileExt)) category = 'spreadsheet';
      else if (['ppt', 'pptx'].includes(fileExt)) category = 'presentation';
      else if (['zip', 'rar', '7z'].includes(fileExt)) category = 'archive';
      else if (['mp3', 'wav', 'ogg', 'm4a'].includes(fileExt)) category = 'audio';
      
      const fileData = {
        filename: file.originalname,
        path: filePath,
        uploadedAt: new Date(),
        description: description.trim(),
        fileType: file.mimetype,
        fileSize: file.size,
        category: category
      };
      
      teacher.files.push(fileData);
      uploadedFiles.push({
        ...fileData,
        id: teacher.files[teacher.files.length - 1]._id
      });
    }

    await teacher.save();

    res.status(200).json({
      success: true,
      message: `${uploadedFiles.length} file(s) uploaded successfully`,
      files: uploadedFiles
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({ 
      message: error.message || 'Failed to upload files'
    });
  }
});

// Get teacher's uploaded files
router.get('/my-files', authenticateToken, async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.user.id).select('files');
    
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }
    
    // Sort files by upload date (newest first)
    const files = teacher.files ? teacher.files.sort((a, b) => b.uploadedAt - a.uploadedAt) : [];
    
    res.status(200).json({ 
      success: true, 
      files: files 
    });
  } catch (error) {
    console.error('Fetch files error:', error);
    res.status(500).json({ message: 'Failed to fetch uploaded files' });
  }
});

// Delete a file
router.delete('/file/:fileId', authenticateToken, async (req, res) => {
  try {
    const { fileId } = req.params;
    const teacher = await Teacher.findById(req.user.id);
    
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }
    
    // Find and remove the file
    const fileIndex = teacher.files.findIndex(f => f._id.toString() === fileId);
    
    if (fileIndex === -1) {
      return res.status(404).json({ message: 'File not found' });
    }
    
    // Get file path to delete from filesystem
    const filePath = teacher.files[fileIndex].path.replace('/uploads/', 'uploads/');
    
    // Remove from database
    teacher.files.splice(fileIndex, 1);
    await teacher.save();
    
    // Try to delete from filesystem
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (fsError) {
      console.error('Error deleting file from filesystem:', fsError);
    }
    
    res.status(200).json({ 
      success: true, 
      message: 'File deleted successfully' 
    });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({ message: 'Failed to delete file' });
  }
});

// Update file description
router.patch('/file/:fileId', authenticateToken, async (req, res) => {
  try {
    const { fileId } = req.params;
    const { description } = req.body;
    
    const teacher = await Teacher.findById(req.user.id);
    
    if (!teacher) {
      return res.status(404).json({ message: 'Teacher not found' });
    }
    
    const file = teacher.files.id(fileId);
    
    if (!file) {
      return res.status(404).json({ message: 'File not found' });
    }
    
    file.description = description || '';
    await teacher.save();
    
    res.status(200).json({ 
      success: true, 
      message: 'File description updated successfully',
      file
    });
  } catch (error) {
    console.error('Update file error:', error);
    res.status(500).json({ message: 'Failed to update file description' });
  }
});

// ============ DASHBOARD STATS ============
// Get teacher dashboard statistics
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const teacher = await Teacher.findById(req.user.id);
    
    const totalStudents = teacher.students ? teacher.students.length : 0;
    const totalMeetings = await Meeting.countDocuments({ teacherId: req.user.id });
    const totalFiles = teacher.files ? teacher.files.length : 0;
    const activeMeetings = await Meeting.countDocuments({ 
      teacherId: req.user.id, 
      isActive: true 
    });
    
    res.status(200).json({
      success: true,
      stats: {
        totalStudents,
        totalMeetings,
        totalFiles,
        activeMeetings
      }
    });
  } catch (error) {
    console.error('Fetch stats error:', error);
    res.status(500).json({ message: 'Failed to fetch dashboard statistics' });
  }
});

module.exports = router;