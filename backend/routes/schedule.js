// backend/routes/schedule.js
// ⭐ NEW ROUTES - Completely separate from existing routes

const express = require('express');
const router = express.Router();
const ScheduledSession = require('../models/ScheduledSession');
const Group = require('../models/Group');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// ========================================
// MIDDLEWARE
// ========================================

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid token' });
  }
};

// ========================================
// TEACHER ROUTES
// ========================================

// CREATE SCHEDULED SESSION
router.post('/create', authenticateToken, async (req, res) => {
  try {
    const {
      sessionName,
      subject,
      description,
      scheduledDate,
      scheduledTime,
      duration,
      allowedEmails,
      maxStudents,
      requireApproval
    } = req.body;
    
    // Validate required fields
    if (!sessionName || !subject || !scheduledDate || !scheduledTime) {
      return res.status(400).json({
        error: 'Session name, subject, date, and time are required'
      });
    }
    
    // Check if user is teacher
    const user = await User.findById(req.userId);
    if (user.role !== 'teacher') {
      return res.status(403).json({ error: 'Only teachers can create scheduled sessions' });
    }
    
    // Validate date is in future
    const scheduledDateTime = new Date(scheduledDate);
    if (scheduledDateTime < new Date()) {
      return res.status(400).json({ error: 'Cannot schedule session in the past' });
    }
    
    // Generate unique join code
    const joinCode = crypto.randomBytes(4).toString('hex').toUpperCase();
    
    // Create scheduled session
    const session = new ScheduledSession({
      sessionName,
      subject,
      description,
      teacher: req.userId,
      scheduledDate,
      scheduledTime,
      duration: duration || 60,
      allowedEmails: allowedEmails || [],
      maxStudents: maxStudents || 100,
      requireApproval: requireApproval || false,
      joinCode,
      status: 'scheduled'
    });
    
    await session.save();
    await session.populate('teacher', 'name email');
    
    console.log('✅ Scheduled session created:', session.sessionName);
    
    res.status(201).json({
      message: 'Session scheduled successfully',
      session
    });
    
  } catch (error) {
    console.error('Create scheduled session error:', error);
    res.status(500).json({ error: 'Failed to schedule session' });
  }
});

// GET TEACHER'S SCHEDULED SESSIONS
router.get('/my-sessions', authenticateToken, async (req, res) => {
  try {
    const { status } = req.query; // 'scheduled', 'live', 'completed', 'all'
    
    const user = await User.findById(req.userId);
    if (user.role !== 'teacher') {
      return res.status(403).json({ error: 'Only teachers can view their sessions' });
    }
    
    let query = { teacher: req.userId };
    if (status && status !== 'all') {
      query.status = status;
    }
    
    const sessions = await ScheduledSession.find(query)
      .populate('teacher', 'name email')
      .populate('registeredStudents.user', 'name email')
      .sort({ scheduledDate: 1 });
    
    res.json({ sessions });
    
  } catch (error) {
    console.error('Get teacher sessions error:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// UPDATE SCHEDULED SESSION
router.put('/:sessionId', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const updates = req.body;
    
    const session = await ScheduledSession.findById(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    // Check if user is the teacher
    if (session.teacher.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Only the teacher can update this session' });
    }
    
    // Don't allow updating if already live or completed
    if (session.status !== 'scheduled') {
      return res.status(400).json({ error: 'Cannot update session that is already started or completed' });
    }
    
    // Update allowed fields
    const allowedUpdates = [
      'sessionName', 'subject', 'description', 
      'scheduledDate', 'scheduledTime', 'duration',
      'maxStudents', 'requireApproval'
    ];
    
    allowedUpdates.forEach(field => {
      if (updates[field] !== undefined) {
        session[field] = updates[field];
      }
    });
    
    await session.save();
    await session.populate('teacher', 'name email');
    
    res.json({
      message: 'Session updated successfully',
      session
    });
    
  } catch (error) {
    console.error('Update session error:', error);
    res.status(500).json({ error: 'Failed to update session' });
  }
});

// MANAGE ALLOWED EMAILS
router.post('/:sessionId/emails', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { action, emails } = req.body; // action: 'add' or 'remove'
    
    const session = await ScheduledSession.findById(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    if (session.teacher.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: 'Emails array required' });
    }
    
    if (action === 'add') {
      emails.forEach(email => session.addAllowedEmail(email));
      await session.save();
      res.json({ 
        message: `${emails.length} email(s) added`,
        allowedEmails: session.allowedEmails
      });
    } else if (action === 'remove') {
      emails.forEach(email => session.removeAllowedEmail(email));
      await session.save();
      res.json({ 
        message: `${emails.length} email(s) removed`,
        allowedEmails: session.allowedEmails
      });
    } else {
      res.status(400).json({ error: 'Invalid action. Use "add" or "remove"' });
    }
    
  } catch (error) {
    console.error('Manage emails error:', error);
    res.status(500).json({ error: 'Failed to manage emails' });
  }
});

// START SESSION MANUALLY (Convert scheduled → live)
router.post('/:sessionId/start', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = await ScheduledSession.findById(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    if (session.teacher.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Only the teacher can start this session' });
    }
    
    if (session.status !== 'scheduled') {
      return res.status(400).json({ error: 'Session already started or completed' });
    }
    
    // Create actual Group from scheduled session
    const Group = require('../models/Group');
    const QRCode = require('qrcode');
    
    // Generate PIN
    let pin;
    let pinExists = true;
    while (pinExists) {
      pin = Math.floor(100000 + Math.random() * 900000).toString();
      pinExists = await Group.findOne({ pin });
    }
    
    const joinUrl = `${process.env.FRONTEND_URL}?pin=${pin}`;
    const qrCode = await QRCode.toDataURL(joinUrl);
    
    // Create group
    const group = new Group({
      groupName: session.sessionName,
      admin: session.teacher,
      members: [{
        user: session.teacher,
        joinedAt: new Date()
      }],
      pin,
      qrCode,
      onlineUsers: [],
      allowedEmails: session.allowedEmails // ✅ Transfer email restrictions
    });
    
    await group.save();
    
    // Update scheduled session
    session.status = 'live';
    session.liveGroupId = group._id;
    await session.save();
    
    await group.populate('admin', 'username name');
    
    console.log('✅ Scheduled session started:', session.sessionName);
    
    // Notify registered students via socket.io
    const io = req.app.get('io');
    session.registeredStudents.forEach(student => {
      io.to(student.user.toString()).emit('sessionStarted', {
        sessionName: session.sessionName,
        groupId: group._id,
        pin: group.pin
      });
    });
    
    res.json({
      message: 'Session started successfully',
      group: {
        id: group._id,
        groupName: group.groupName,
        pin: group.pin,
        qrCode: group.qrCode
      },
      session
    });
    
  } catch (error) {
    console.error('Start session error:', error);
    res.status(500).json({ error: 'Failed to start session' });
  }
});

// CANCEL SCHEDULED SESSION
router.post('/:sessionId/cancel', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = await ScheduledSession.findById(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    if (session.teacher.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    session.status = 'cancelled';
    await session.save();
    
    // Notify registered students
    const io = req.app.get('io');
    session.registeredStudents.forEach(student => {
      io.to(student.user.toString()).emit('sessionCancelled', {
        sessionName: session.sessionName,
        message: 'This session has been cancelled by the teacher'
      });
    });
    
    res.json({ message: 'Session cancelled successfully' });
    
  } catch (error) {
    console.error('Cancel session error:', error);
    res.status(500).json({ error: 'Failed to cancel session' });
  }
});

// ========================================
// STUDENT ROUTES
// ========================================

// GET AVAILABLE SESSIONS FOR STUDENT
router.get('/available', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Get sessions where:
    // 1. No email restrictions OR
    // 2. Student's email is in allowedEmails
    const sessions = await ScheduledSession.find({
      status: 'scheduled',
      scheduledDate: { $gte: new Date() }, // Only future sessions
      $or: [
        { allowedEmails: { $size: 0 } }, // No restrictions
        { allowedEmails: user.email.toLowerCase() } // Email allowed
      ]
    })
    .populate('teacher', 'name email')
    .sort({ scheduledDate: 1 });
    
    // Check if already registered
    const sessionsWithStatus = sessions.map(session => {
      const isRegistered = session.registeredStudents.some(
        s => s.user.toString() === req.userId.toString()
      );
      
      return {
        ...session.toObject(),
        isRegistered,
        spotsLeft: session.maxStudents - session.registeredStudents.length
      };
    });
    
    res.json({ sessions: sessionsWithStatus });
    
  } catch (error) {
    console.error('Get available sessions error:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// REGISTER FOR SESSION
router.post('/:sessionId/register', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = await ScheduledSession.findById(sessionId);
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    if (session.status !== 'scheduled') {
      return res.status(400).json({ error: 'Cannot register for this session' });
    }
    
    const user = await User.findById(req.userId);
    
    const result = await session.registerStudent(req.userId, user.email);
    
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }
    
    await session.populate('teacher', 'name email');
    
    res.json({
      message: result.message,
      session
    });
    
  } catch (error) {
    console.error('Register for session error:', error);
    res.status(500).json({ error: 'Failed to register' });
  }
});

// GET MY REGISTERED SESSIONS
router.get('/my-registrations', authenticateToken, async (req, res) => {
  try {
    const sessions = await ScheduledSession.find({
      'registeredStudents.user': req.userId,
      status: { $in: ['scheduled', 'live'] }
    })
    .populate('teacher', 'name email')
    .populate('liveGroupId', 'pin qrCode')
    .sort({ scheduledDate: 1 });
    
    res.json({ sessions });
    
  } catch (error) {
    console.error('Get registered sessions error:', error);
    res.status(500).json({ error: 'Failed to fetch registrations' });
  }
});

module.exports = router;