// backend/models/Notification.js
// Stores user notifications

const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  // Who receives this notification
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Who triggered this notification (optional)
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  
  // Notification type
  type: {
    type: String,
    enum: [
      'session_scheduled',    // New session scheduled
      'session_starting',     // Session starting in 15 min
      'session_started',      // Session just started
      'quiz_started',         // Quiz started
      'quiz_result',          // Quiz result posted
      'message',              // New message in group
      'poll_created',         // New poll
      'session_ended',        // Session ended
      'session_cancelled',    // Session cancelled
      'attention_needed',     // Teacher flagged student
      'achievement'           // Badge/achievement earned
    ],
    required: true
  },
  
  // Notification title
  title: {
    type: String,
    required: true
  },
  
  // Notification message
  message: {
    type: String,
    required: true
  },
  
  // Related entities
  relatedGroup: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group'
  },
  
  relatedQuiz: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz'
  },
  
  relatedSession: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ScheduledSession'
  },
  
  // Action URL (where to navigate when clicked)
  actionUrl: String,
  
  // Read status
  isRead: {
    type: Boolean,
    default: false
  },
  
  readAt: Date,
  
  // Priority
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  
  // Icon/emoji for notification
  icon: String,
  
  // Expiry (notifications can expire)
  expiresAt: Date,

  // Extra data (groupId, pin, sessionId etc.)
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }

}, {
  timestamps: true
});

// ========================================
// METHODS
// ========================================

// Mark as read
notificationSchema.methods.markAsRead = async function() {
  this.isRead = true;
  this.readAt = new Date();
  await this.save();
};

// Check if expired
notificationSchema.methods.isExpired = function() {
  if (!this.expiresAt) return false;
  return new Date() > this.expiresAt;
};

// ========================================
// STATICS
// ========================================

// Get unread count for user
notificationSchema.statics.getUnreadCount = function(userId) {
  return this.countDocuments({ recipient: userId, isRead: false });
};

// Get recent notifications
notificationSchema.statics.getRecent = function(userId, limit = 20) {
  return this.find({ recipient: userId })
    .populate('sender', 'name username')
    .populate('relatedGroup', 'groupName')
    .sort({ createdAt: -1 })
    .limit(limit);
};

// Mark all as read
notificationSchema.statics.markAllAsRead = async function(userId) {
  return this.updateMany(
    { recipient: userId, isRead: false },
    { isRead: true, readAt: new Date() }
  );
};

// Delete old read notifications (cleanup)
notificationSchema.statics.deleteOldRead = async function(daysOld = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  return this.deleteMany({
    isRead: true,
    readAt: { $lt: cutoffDate }
  });
};

// Create notification (helper)
notificationSchema.statics.createNotification = async function(data) {
  const notification = new this(data);
  await notification.save();
  
  // Emit socket event
  const io = global.io;
  if (io) {
    io.to(data.recipient.toString()).emit('newNotification', notification);
  }
  
  return notification;
};

// Bulk create notifications
notificationSchema.statics.createBulkNotifications = async function(recipients, data) {
  const notifications = recipients.map(recipientId => ({
    ...data,
    recipient: recipientId
  }));
  
  const created = await this.insertMany(notifications);
  
  // Emit socket events
  const io = global.io;
  if (io) {
    recipients.forEach((recipientId, index) => {
      io.to(recipientId.toString()).emit('newNotification', created[index]);
    });
  }
  
  return created;
};

// ========================================
// HELPER FUNCTIONS (NOTIFICATION TEMPLATES)
// ========================================

// Session scheduled notification
notificationSchema.statics.notifySessionScheduled = async function(session, studentIds) {
  const scheduledDate = new Date(session.scheduledDate);
  const formattedDate = scheduledDate.toLocaleDateString();
  
  return this.createBulkNotifications(studentIds, {
    type: 'session_scheduled',
    title: '📅 New Session Scheduled',
    message: `${session.sessionName} scheduled for ${formattedDate} at ${session.scheduledTime}`,
    relatedGroup: session.group,
    relatedSession: session._id,
    actionUrl: `/schedule`,
    priority: 'medium',
    icon: '📅'
  });
};

// Quiz started notification
notificationSchema.statics.notifyQuizStarted = async function(quiz, groupId, studentIds) {
  return this.createBulkNotifications(studentIds, {
    type: 'quiz_started',
    title: '🎮 Quiz Started!',
    message: `${quiz.title} has started. Join now!`,
    relatedGroup: groupId,
    relatedQuiz: quiz._id,
    actionUrl: `/group/${groupId}`,
    priority: 'high',
    icon: '🎮'
  });
};

// Quiz result notification
notificationSchema.statics.notifyQuizResult = async function(studentId, quiz, score, rank) {
  const emoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '🎖️';
  
  return this.createNotification({
    recipient: studentId,
    type: 'quiz_result',
    title: `${emoji} Quiz Result`,
    message: `${quiz.title}: ${score} points! You ranked #${rank}`,
    relatedQuiz: quiz._id,
    priority: 'medium',
    icon: emoji
  });
};

// Session starting soon notification
notificationSchema.statics.notifySessionStartingSoon = async function(session, studentIds) {
  return this.createBulkNotifications(studentIds, {
    type: 'session_starting',
    title: '⏰ Session Starting Soon',
    message: `${session.sessionName} starts in 15 minutes!`,
    relatedGroup: session.group,
    relatedSession: session._id,
    actionUrl: `/schedule`,
    priority: 'high',
    icon: '⏰'
  });
};

// Achievement notification
notificationSchema.statics.notifyAchievement = async function(studentId, achievement) {
  return this.createNotification({
    recipient: studentId,
    type: 'achievement',
    title: '🏆 Achievement Unlocked!',
    message: achievement,
    priority: 'low',
    icon: '🏆'
  });
};

// ========================================
// INDEXES
// ========================================

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ type: 1 });
notificationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);