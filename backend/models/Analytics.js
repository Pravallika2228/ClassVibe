// backend/models/Analytics.js
// Tracks student activities for teacher insights

const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema({
  // Student being tracked
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // Group/classroom
  group: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Group',
    required: true
  },
  
  // Session attendance
  sessionAttendance: [{
    sessionDate: Date,
    joinedAt: Date,
    leftAt: Date,
    duration: Number, // minutes
    wasPresent: Boolean
  }],
  
  // Message activity
  messageStats: {
    totalMessages: { type: Number, default: 0 },
    textMessages: { type: Number, default: 0 },
    fileUploads: { type: Number, default: 0 },
    pollsCreated: { type: Number, default: 0 },
    pollsParticipated: { type: Number, default: 0 },
    lastMessageAt: Date
  },
  
  // Quiz performance
  quizStats: {
    totalQuizzesTaken: { type: Number, default: 0 },
    averageScore: { type: Number, default: 0 },
    highestScore: { type: Number, default: 0 },
    lowestScore: { type: Number, default: 0 },
    totalPoints: { type: Number, default: 0 },
    correctAnswers: { type: Number, default: 0 },
    totalQuestions: { type: Number, default: 0 },
    averageTimePerQuestion: { type: Number, default: 0 }, // seconds
    badges: {
      gold: { type: Number, default: 0 },
      silver: { type: Number, default: 0 },
      bronze: { type: Number, default: 0 }
    }
  },
  
  // Engagement metrics
  engagement: {
    participationRate: { type: Number, default: 0 }, // 0-100%
    consistencyScore: { type: Number, default: 0 }, // 0-100%
    responseTime: { type: Number, default: 0 }, // average minutes
    lastActive: Date
  },
  
  // Trends (last 7 days)
  weeklyTrends: {
    messagesThisWeek: { type: Number, default: 0 },
    quizzesThisWeek: { type: Number, default: 0 },
    attendanceThisWeek: { type: Number, default: 0 }
  },
  
  // Performance level
  performanceLevel: {
    type: String,
    enum: ['Excellent', 'Good', 'Average', 'Below Average', 'Needs Attention'],
    default: 'Average'
  },
  
  // Flags
  needsAttention: {
    type: Boolean,
    default: false
  },
  
  attentionReasons: [String]
  
}, {
  timestamps: true
});

// ========================================
// METHODS
// ========================================

// Record session attendance
analyticsSchema.methods.recordAttendance = function(joinedAt, leftAt) {
  const duration = leftAt ? (leftAt - joinedAt) / 1000 / 60 : 0; // minutes
  
  this.sessionAttendance.push({
    sessionDate: new Date(),
    joinedAt,
    leftAt,
    duration,
    wasPresent: true
  });
  
  this.engagement.lastActive = new Date();
};

// Update message stats
analyticsSchema.methods.recordMessage = function(messageType = 'text') {
  this.messageStats.totalMessages += 1;
  
  if (messageType === 'text') {
    this.messageStats.textMessages += 1;
  } else if (messageType === 'file') {
    this.messageStats.fileUploads += 1;
  }
  
  this.messageStats.lastMessageAt = new Date();
  this.engagement.lastActive = new Date();
  
  // Update weekly trend
  this.weeklyTrends.messagesThisWeek += 1;
};

// Update quiz stats
analyticsSchema.methods.recordQuizResult = function(result) {
  this.quizStats.totalQuizzesTaken += 1;
  this.quizStats.totalPoints += result.score;
  this.quizStats.correctAnswers += result.correctAnswers;
  this.quizStats.totalQuestions += result.totalQuestions;
  
  // Update average score
  this.quizStats.averageScore = 
    this.quizStats.totalPoints / this.quizStats.totalQuizzesTaken;
  
  // Update highest/lowest
  if (result.score > this.quizStats.highestScore) {
    this.quizStats.highestScore = result.score;
  }
  if (this.quizStats.lowestScore === 0 || result.score < this.quizStats.lowestScore) {
    this.quizStats.lowestScore = result.score;
  }
  
  // Update badges
  if (result.badge === 'gold') this.quizStats.badges.gold += 1;
  if (result.badge === 'silver') this.quizStats.badges.silver += 1;
  if (result.badge === 'bronze') this.quizStats.badges.bronze += 1;
  
  // Update time
  if (result.averageTimePerQuestion) {
    const totalTime = this.quizStats.averageTimePerQuestion * (this.quizStats.totalQuizzesTaken - 1);
    this.quizStats.averageTimePerQuestion = 
      (totalTime + result.averageTimePerQuestion) / this.quizStats.totalQuizzesTaken;
  }
  
  this.weeklyTrends.quizzesThisWeek += 1;
};

// Calculate participation rate
analyticsSchema.methods.calculateParticipation = async function() {
  const Group = mongoose.model('Group');
  const group = await Group.findById(this.group);
  
  if (!group) return;
  
  // Get total sessions in group
  const totalSessions = this.sessionAttendance.length;
  const attendedSessions = this.sessionAttendance.filter(s => s.wasPresent).length;
  
  this.engagement.participationRate = totalSessions > 0 
    ? Math.round((attendedSessions / totalSessions) * 100)
    : 0;
};

// Determine performance level
analyticsSchema.methods.evaluatePerformance = function() {
  const avgScore = this.quizStats.averageScore;
  const participation = this.engagement.participationRate;
  const messages = this.messageStats.totalMessages;
  
  // Calculate overall score (0-100)
  const quizWeight = 0.5;
  const participationWeight = 0.3;
  const engagementWeight = 0.2;
  
  const normalizedMessages = Math.min(messages / 50, 1) * 100; // 50+ messages = 100%
  
  const overallScore = 
    (avgScore * quizWeight) +
    (participation * participationWeight) +
    (normalizedMessages * engagementWeight);
  
  // Determine level
  if (overallScore >= 85) {
    this.performanceLevel = 'Excellent';
  } else if (overallScore >= 70) {
    this.performanceLevel = 'Good';
  } else if (overallScore >= 55) {
    this.performanceLevel = 'Average';
  } else if (overallScore >= 40) {
    this.performanceLevel = 'Below Average';
  } else {
    this.performanceLevel = 'Needs Attention';
  }
  
  // Check if needs attention
  this.checkAttentionFlags();
};

// Check if student needs attention
analyticsSchema.methods.checkAttentionFlags = function() {
  const reasons = [];
  
  // Low participation
  if (this.engagement.participationRate < 50) {
    reasons.push('Low attendance rate');
  }
  
  // Poor quiz performance
  if (this.quizStats.averageScore < 50 && this.quizStats.totalQuizzesTaken > 0) {
    reasons.push('Low quiz scores');
  }
  
  // Inactive
  const daysSinceActive = this.engagement.lastActive 
    ? (Date.now() - this.engagement.lastActive) / 1000 / 60 / 60 / 24
    : 999;
  
  if (daysSinceActive > 7) {
    reasons.push('Inactive for 7+ days');
  }
  
  // Low engagement
  if (this.messageStats.totalMessages < 5 && this.sessionAttendance.length > 3) {
    reasons.push('Low engagement');
  }
  
  this.needsAttention = reasons.length > 0;
  this.attentionReasons = reasons;
};

// Reset weekly trends (call this weekly via cron job)
analyticsSchema.methods.resetWeeklyTrends = function() {
  this.weeklyTrends = {
    messagesThisWeek: 0,
    quizzesThisWeek: 0,
    attendanceThisWeek: 0
  };
};

// ========================================
// STATICS
// ========================================

// Get or create analytics for student
analyticsSchema.statics.getOrCreate = async function(studentId, groupId) {
  let analytics = await this.findOne({ student: studentId, group: groupId });
  
  if (!analytics) {
    analytics = new this({ student: studentId, group: groupId });
    await analytics.save();
  }
  
  return analytics;
};

// Get group analytics summary
analyticsSchema.statics.getGroupSummary = async function(groupId) {
  const analytics = await this.find({ group: groupId })
    .populate('student', 'name username email');
  
  const summary = {
    totalStudents: analytics.length,
    activeStudents: analytics.filter(a => 
      a.engagement.lastActive && 
      (Date.now() - a.engagement.lastActive) / 1000 / 60 / 60 / 24 < 7
    ).length,
    needsAttention: analytics.filter(a => a.needsAttention).length,
    averageParticipation: analytics.length > 0
      ? analytics.reduce((sum, a) => sum + a.engagement.participationRate, 0) / analytics.length
      : 0,
    averageQuizScore: analytics.length > 0
      ? analytics.reduce((sum, a) => sum + a.quizStats.averageScore, 0) / analytics.length
      : 0,
    performanceDistribution: {
      excellent: analytics.filter(a => a.performanceLevel === 'Excellent').length,
      good: analytics.filter(a => a.performanceLevel === 'Good').length,
      average: analytics.filter(a => a.performanceLevel === 'Average').length,
      belowAverage: analytics.filter(a => a.performanceLevel === 'Below Average').length,
      needsAttention: analytics.filter(a => a.performanceLevel === 'Needs Attention').length
    }
  };
  
  return summary;
};

// Get top performers
analyticsSchema.statics.getTopPerformers = async function(groupId, limit = 5) {
  return this.find({ group: groupId })
    .populate('student', 'name username')
    .sort({ 'quizStats.averageScore': -1 })
    .limit(limit);
};

// Get students needing attention
analyticsSchema.statics.getNeedsAttention = async function(groupId) {
  return this.find({ group: groupId, needsAttention: true })
    .populate('student', 'name username email');
};

// ========================================
// INDEXES
// ========================================

analyticsSchema.index({ student: 1, group: 1 }, { unique: true });
analyticsSchema.index({ group: 1, needsAttention: 1 });
analyticsSchema.index({ performanceLevel: 1 });

module.exports = mongoose.model('Analytics', analyticsSchema);