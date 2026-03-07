// backend/models/ScheduledSession.js
// ⭐ NEW MODEL - Doesn't affect existing Group model

const mongoose = require('mongoose');

const scheduledSessionSchema = new mongoose.Schema({
  // Basic Info
  sessionName: {
    type: String,
    required: true,
    trim: true
  },
  
  subject: {
    type: String,
    required: true,
    trim: true
  },
  
  description: {
    type: String,
    trim: true
  },
  
  // Teacher who created this
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // ✅ Scheduled Time
  scheduledDate: {
    type: Date,
    required: true
  },
  
  scheduledTime: {
    type: String, // Format: "10:00 AM"
    required: true
  },
  
  duration: {
    type: Number, // in minutes
    default: 60
  },
  
  // ✅ ALLOWED STUDENTS (Email Whitelist)
  allowedEmails: [{
    type: String,
    lowercase: true,
    trim: true
  }],
  
  // Students who registered for this session
  registeredStudents: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    email: String,
    registeredAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // ✅ Session Status
  status: {
    type: String,
    enum: ['scheduled', 'live', 'completed', 'cancelled'],
    default: 'scheduled'
  },
  
  // When session actually started (becomes a Group)
  liveGroupId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group'
  },
  
  // Notifications
  reminderSent: {
    type: Boolean,
    default: false
  },
  
  // Settings
  autoStartEnabled: {
    type: Boolean,
    default: true // Auto-start at scheduled time
  },
  
  requireApproval: {
    type: Boolean,
    default: false // If true, students must request to join
  },
  
  maxStudents: {
    type: Number,
    default: 100
  },
  
  // ✅ Join Link
  joinCode: {
    type: String,
    unique: true,
    sparse: true
  }
}, {
  timestamps: true
});

// ========================================
// METHODS
// ========================================

// Check if email is allowed
scheduledSessionSchema.methods.isEmailAllowed = function(email) {
  if (this.allowedEmails.length === 0) {
    return true; // If no restrictions, anyone can join
  }
  return this.allowedEmails.includes(email.toLowerCase());
};

// Check if session should start now
scheduledSessionSchema.methods.shouldStartNow = function() {
  const now = new Date();
  const scheduledDateTime = new Date(this.scheduledDate);
  
  // Extract time from scheduledTime (e.g., "10:00 AM")
  const timeParts = this.scheduledTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (timeParts) {
    let hours = parseInt(timeParts[1]);
    const minutes = parseInt(timeParts[2]);
    const meridiem = timeParts[3].toUpperCase();
    
    if (meridiem === 'PM' && hours !== 12) hours += 12;
    if (meridiem === 'AM' && hours === 12) hours = 0;
    
    scheduledDateTime.setHours(hours, minutes, 0, 0);
  }
  
  // Start if within 5 minutes of scheduled time
  const diff = scheduledDateTime - now;
  return diff <= 5 * 60 * 1000 && diff >= -5 * 60 * 1000;
};

// Register a student for this session
scheduledSessionSchema.methods.registerStudent = async function(userId, email) {
  // Check if already registered
  const alreadyRegistered = this.registeredStudents.some(
    s => s.user.toString() === userId.toString()
  );
  
  if (alreadyRegistered) {
    return { success: false, message: 'Already registered' };
  }
  
  // Check if email is allowed
  if (!this.isEmailAllowed(email)) {
    return { success: false, message: 'Your email is not authorized for this session' };
  }
  
  // Check max capacity
  if (this.registeredStudents.length >= this.maxStudents) {
    return { success: false, message: 'Session is full' };
  }
  
  this.registeredStudents.push({
    user: userId,
    email: email
  });
  
  await this.save();
  
  return { success: true, message: 'Registered successfully' };
};

// Add allowed email
scheduledSessionSchema.methods.addAllowedEmail = function(email) {
  const normalizedEmail = email.toLowerCase().trim();
  if (!this.allowedEmails.includes(normalizedEmail)) {
    this.allowedEmails.push(normalizedEmail);
  }
};

// Remove allowed email
scheduledSessionSchema.methods.removeAllowedEmail = function(email) {
  this.allowedEmails = this.allowedEmails.filter(
    e => e !== email.toLowerCase().trim()
  );
};

// ========================================
// STATIC METHODS
// ========================================

// Get upcoming sessions for a teacher
scheduledSessionSchema.statics.getTeacherSessions = function(teacherId, status = 'scheduled') {
  return this.find({ teacher: teacherId, status })
    .populate('registeredStudents.user', 'name email')
    .sort({ scheduledDate: 1 });
};

// Get sessions a student can join
scheduledSessionSchema.statics.getAvailableSessions = async function(userEmail) {
  return this.find({
    status: 'scheduled',
    $or: [
      { allowedEmails: { $size: 0 } }, // No restrictions
      { allowedEmails: userEmail.toLowerCase() } // Email in whitelist
    ]
  })
  .populate('teacher', 'name email')
  .sort({ scheduledDate: 1 });
};

// Find sessions that should start now
scheduledSessionSchema.statics.findSessionsToStart = function() {
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
  const fiveMinutesLater = new Date(now.getTime() + 5 * 60 * 1000);
  
  return this.find({
    status: 'scheduled',
    autoStartEnabled: true,
    scheduledDate: {
      $gte: fiveMinutesAgo,
      $lte: fiveMinutesLater
    }
  }).populate('teacher');
};

// Add this field to your schema
const scheduledSessionSchema = new mongoose.Schema({
  // ... existing fields ...
  
  reminderSent: {
    type: Boolean,
    default: false,
    description: 'Whether 15-min reminder was sent'
  }
  
  // ... rest of schema ...
});

// ========================================
// INDEXES
// ========================================

scheduledSessionSchema.index({ teacher: 1, scheduledDate: 1 });
scheduledSessionSchema.index({ status: 1, scheduledDate: 1 });
scheduledSessionSchema.index({ joinCode: 1 });
scheduledSessionSchema.index({ 'allowedEmails': 1 });

module.exports = mongoose.model('ScheduledSession', scheduledSessionSchema);