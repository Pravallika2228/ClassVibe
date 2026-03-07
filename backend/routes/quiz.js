// backend/routes/quiz.js
// Complete API for AI Quiz feature with Analytics & Notifications

const express = require('express');
const router = express.Router();
const Quiz = require('../models/Quiz');
const QuizSession = require('../models/QuizSession');
const QuizResult = require('../models/QuizResult');
const Group = require('../models/Group');
const User = require('../models/User');
const Analytics = require('../models/Analytics');           // ⭐ NEW - Analytics tracking
const Notification = require('../models/Notification');     // ⭐ NEW - Notifications
const { generator } = require('../services/aiQuizGenerator');
const jwt = require('jsonwebtoken');

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
// QUIZ CREATION ROUTES (TEACHER)
// ========================================

// Generate quiz using AI
router.post('/generate', authenticateToken, async (req, res) => {
  try {
    const { topic, questionCount, groupId } = req.body;
    
    if (!topic || !groupId) {
      return res.status(400).json({ error: 'Topic and groupId required' });
    }
    
    const user = await User.findById(req.userId);
    if (user.role !== 'teacher') {
      return res.status(403).json({ error: 'Only teachers can generate quizzes' });
    }
    
    const group = await Group.findById(groupId);
    if (!group || !group.isAdmin(req.userId)) {
      return res.status(403).json({ error: 'You are not admin of this group' });
    }
    
    console.log('🤖 Generating quiz with AI:', topic);
    
    const questions = await generator.generateFromText(topic, questionCount || 10);
    
    const quiz = new Quiz({
      title: `${topic} Quiz`,
      description: `Auto-generated quiz about ${topic}`,
      creator: req.userId,
      group: groupId,
      source: 'ai',
      aiSource: {
        type: 'text',
        content: topic
      },
      questions,
      status: 'draft'
    });
    
    await quiz.save();
    
    console.log('✅ Quiz generated:', quiz._id);
    
    res.json({
      message: 'Quiz generated successfully',
      quiz
    });
    
  } catch (error) {
    console.error('Generate quiz error:', error);
    res.status(500).json({ 
      error: 'Failed to generate quiz',
      details: error.message 
    });
  }
});

// Create/Update quiz manually
router.post('/create', authenticateToken, async (req, res) => {
  try {
    const { title, description, groupId, questions, settings } = req.body;
    
    if (!title || !groupId || !questions || questions.length === 0) {
      return res.status(400).json({ error: 'Title, groupId, and questions required' });
    }
    
    const user = await User.findById(req.userId);
    if (user.role !== 'teacher') {
      return res.status(403).json({ error: 'Only teachers can create quizzes' });
    }
    
    const group = await Group.findById(groupId);
    if (!group || !group.isAdmin(req.userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const quiz = new Quiz({
      title,
      description,
      creator: req.userId,
      group: groupId,
      source: 'manual',
      questions,
      settings: settings || {},
      status: 'ready'
    });
    
    await quiz.save();
    
    res.status(201).json({
      message: 'Quiz created successfully',
      quiz
    });
    
  } catch (error) {
    console.error('Create quiz error:', error);
    res.status(500).json({ error: 'Failed to create quiz' });
  }
});

// Update quiz
router.put('/:quizId', authenticateToken, async (req, res) => {
  try {
    const { quizId } = req.params;
    const updates = req.body;
    
    const quiz = await Quiz.findById(quizId);
    
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }
    
    if (quiz.creator.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const allowedFields = ['title', 'description', 'questions', 'settings', 'status'];
    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        quiz[field] = updates[field];
      }
    });
    
    await quiz.save();
    
    res.json({
      message: 'Quiz updated successfully',
      quiz
    });
    
  } catch (error) {
    console.error('Update quiz error:', error);
    res.status(500).json({ error: 'Failed to update quiz' });
  }
});

// Get teacher's quizzes
router.get('/my-quizzes', authenticateToken, async (req, res) => {
  try {
    const { groupId, status } = req.query;
    
    const query = { creator: req.userId };
    if (groupId) query.group = groupId;
    if (status) query.status = status;
    
    const quizzes = await Quiz.find(query)
      .populate('group', 'groupName')
      .sort({ createdAt: -1 });
    
    res.json({ quizzes });
    
  } catch (error) {
    console.error('Get quizzes error:', error);
    res.status(500).json({ error: 'Failed to fetch quizzes' });
  }
});

// Get quiz details
router.get('/:quizId', authenticateToken, async (req, res) => {
  try {
    const { quizId } = req.params;
    
    const quiz = await Quiz.findById(quizId)
      .populate('creator', 'name username')
      .populate('group', 'groupName');
    
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }
    
    const group = await Group.findById(quiz.group);
    if (!group || !group.isMember(req.userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    res.json({ quiz });
    
  } catch (error) {
    console.error('Get quiz error:', error);
    res.status(500).json({ error: 'Failed to fetch quiz' });
  }
});

// ========================================
// QUIZ SESSION ROUTES (LIVE QUIZ)
// ========================================

// Start quiz session
router.post('/:quizId/start', authenticateToken, async (req, res) => {
  try {
    const { quizId } = req.params;
    
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }
    
    if (quiz.creator.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Only quiz creator can start' });
    }
    
    const existingSession = await QuizSession.findActiveSession(quiz.group);
    if (existingSession) {
      return res.status(400).json({ error: 'Another quiz is already active' });
    }
    
    const session = new QuizSession({
      quiz: quizId,
      group: quiz.group,
      host: req.userId,
      status: 'waiting',
      sessionSettings: {
        totalTimeLimit: quiz.settings.totalTimeLimit,
        showCorrectAnswer: quiz.settings.showCorrectAnswer,
        showLeaderboard: quiz.settings.showLeaderboard,
        allowLateJoin: quiz.settings.allowLateJoin
      }
    });
    
    await session.save();
    
    // ⭐ NEW - Send notifications to all students
    try {
      const group = await Group.findById(quiz.group).populate('members.user');
      const studentIds = group.members
        .filter(m => m.user._id.toString() !== req.userId.toString())
        .map(m => m.user._id);
      
      if (studentIds.length > 0) {
        await Notification.notifyQuizStarted(quiz, quiz.group, studentIds);
        console.log(`📬 Notifications sent to ${studentIds.length} students`);
      }
    } catch (notifError) {
      console.error('Notification error (non-critical):', notifError);
    }
    
    // Broadcast to group via socket.io
    const io = req.app.get('io');
    io.to(quiz.group.toString()).emit('quizStarted', {
      sessionId: session._id,
      quizTitle: quiz.title,
      questionCount: quiz.questions.length
    });
    
    console.log('✅ Quiz session started:', session._id);
    
    res.json({
      message: 'Quiz session started',
      session
    });
    
  } catch (error) {
    console.error('Start quiz error:', error);
    res.status(500).json({ error: 'Failed to start quiz' });
  }
});

// Join quiz session (student)
router.post('/session/:sessionId/join', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = await QuizSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    if (session.status === 'completed') {
      return res.status(400).json({ error: 'Quiz already completed' });
    }
    
    if (session.status !== 'waiting' && !session.sessionSettings.allowLateJoin) {
      return res.status(400).json({ error: 'Late join not allowed' });
    }
    
    const group = await Group.findById(session.group);
    if (!group || !group.isMember(req.userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    session.addParticipant(req.userId);
    await session.save();
    
    res.json({
      message: 'Joined quiz successfully',
      session
    });
    
  } catch (error) {
    console.error('Join quiz error:', error);
    res.status(500).json({ error: 'Failed to join quiz' });
  }
});

// Begin quiz (move from waiting to active)
router.post('/session/:sessionId/begin', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = await QuizSession.findById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    if (session.host.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Only host can begin quiz' });
    }
    
    await session.start();
    
    const io = req.app.get('io');
    io.to(session.group.toString()).emit('quizBegan', {
      sessionId: session._id,
      currentQuestionIndex: 0
    });
    
    res.json({
      message: 'Quiz began',
      session
    });
    
  } catch (error) {
    console.error('Begin quiz error:', error);
    res.status(500).json({ error: 'Failed to begin quiz' });
  }
});

// Submit answer
router.post('/session/:sessionId/answer', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { questionIndex, selectedAnswer, timeTaken } = req.body;
    
    const session = await QuizSession.findById(sessionId).populate('quiz');
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const quiz = session.quiz;
    const question = quiz.questions[questionIndex];
    
    if (!question) {
      return res.status(400).json({ error: 'Invalid question index' });
    }
    
    const isCorrect = selectedAnswer === question.correctAnswer;
    const points = question.points || 10;
    
    const participant = await session.submitAnswer(
      req.userId,
      questionIndex,
      selectedAnswer,
      isCorrect,
      points,
      timeTaken
    );
    
    const io = req.app.get('io');
    io.to(session.group.toString()).emit('answerSubmitted', {
      userId: req.userId,
      questionIndex,
      isCorrect
    });
    
    const leaderboard = session.getLeaderboard();
    io.to(session.group.toString()).emit('leaderboardUpdate', leaderboard);
    
    res.json({
      message: 'Answer submitted',
      isCorrect,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      points: isCorrect ? points : 0,
      currentScore: participant.score
    });
    
  } catch (error) {
    console.error('Submit answer error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to submit answer' 
    });
  }
});

// Next question
router.post('/session/:sessionId/next', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = await QuizSession.findById(sessionId).populate('quiz');
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    if (session.host.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Only host can control quiz' });
    }
    
    const quiz = session.quiz;
    
    if (session.currentQuestionIndex >= quiz.questions.length - 1) {
      return res.status(400).json({ error: 'No more questions' });
    }
    
    await session.nextQuestion();
    
    const io = req.app.get('io');
    io.to(session.group.toString()).emit('nextQuestion', {
      questionIndex: session.currentQuestionIndex
    });
    
    res.json({
      message: 'Moved to next question',
      currentQuestionIndex: session.currentQuestionIndex
    });
    
  } catch (error) {
    console.error('Next question error:', error);
    res.status(500).json({ error: 'Failed to move to next question' });
  }
});

// End quiz session
router.post('/session/:sessionId/end', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = await QuizSession.findById(sessionId).populate('quiz');
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    if (session.host.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Only host can end quiz' });
    }
    
    await session.complete();
    
    const quiz = session.quiz;
    const leaderboard = session.getLeaderboard();
    
    // Save results for each participant
    for (let i = 0; i < session.participants.length; i++) {
      const participant = session.participants[i];
      
      const result = new QuizResult({
        quiz: quiz._id,
        session: session._id,
        student: participant.user,
        group: session.group,
        score: participant.score,
        maxScore: quiz.getTotalPoints(),
        percentage: Math.round((participant.score / quiz.getTotalPoints()) * 100),
        correctAnswers: participant.answers.filter(a => a.isCorrect).length,
        totalQuestions: quiz.questions.length,
        answers: participant.answers.map((a, idx) => ({
          questionIndex: a.questionIndex,
          questionText: quiz.questions[a.questionIndex].questionText,
          selectedAnswer: a.selectedAnswer,
          correctAnswer: quiz.questions[a.questionIndex].correctAnswer,
          isCorrect: a.isCorrect,
          points: a.points,
          timeTaken: a.timeTaken,
          answeredAt: a.answeredAt
        })),
        startedAt: participant.joinedAt,
        completedAt: new Date(),
        rank: leaderboard.findIndex(l => l.userId.toString() === participant.user.toString()) + 1
      });
      
      result.calculateMetrics();
      result.assignBadge(session.participants.length);
      
      await result.save();
      
      // ⭐ NEW - Track analytics for this student
      try {
        let analytics = await Analytics.getOrCreate(participant.user, session.group);
        analytics.recordQuizResult(result);
        await analytics.save();
        console.log(`📊 Analytics updated for student ${participant.user}`);
      } catch (analyticsError) {
        console.error('Analytics tracking error (non-critical):', analyticsError);
      }
      
      // ⭐ NEW - Send result notification to student
      try {
        await Notification.notifyQuizResult(
          participant.user,
          quiz,
          result.score,
          result.rank
        );
        console.log(`📬 Result notification sent to student ${participant.user}`);
      } catch (notifError) {
        console.error('Notification error (non-critical):', notifError);
      }
    }
    
    // Broadcast quiz ended
    const io = req.app.get('io');
    io.to(session.group.toString()).emit('quizEnded', {
      sessionId: session._id,
      leaderboard
    });
    
    console.log('✅ Quiz completed:', session._id);
    
    res.json({
      message: 'Quiz ended',
      summary: session.getSummary(),
      leaderboard
    });
    
  } catch (error) {
    console.error('End quiz error:', error);
    res.status(500).json({ error: 'Failed to end quiz' });
  }
});

// Get active session for group
router.get('/group/:groupId/active', authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    
    const session = await QuizSession.findActiveSession(groupId);
    
    if (!session) {
      return res.json({ session: null });
    }
    
    res.json({ session });
    
  } catch (error) {
    console.error('Get active session error:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// Get session leaderboard
router.get('/session/:sessionId/leaderboard', authenticateToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    const session = await QuizSession.findById(sessionId)
      .populate('participants.user', 'name username');
    
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    const leaderboard = session.getLeaderboard();
    
    res.json({ leaderboard });
    
  } catch (error) {
    console.error('Get leaderboard error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// ========================================
// RESULTS & ANALYTICS ROUTES
// ========================================

// Get student's quiz results
router.get('/results/my-results', authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.query;
    
    const query = { student: req.userId };
    if (groupId) query.group = groupId;
    
    const results = await QuizResult.find(query)
      .populate('quiz', 'title')
      .sort({ createdAt: -1 })
      .limit(20);
    
    res.json({ results });
    
  } catch (error) {
    console.error('Get results error:', error);
    res.status(500).json({ error: 'Failed to fetch results' });
  }
});

// Get quiz analytics (teacher)
router.get('/:quizId/analytics', authenticateToken, async (req, res) => {
  try {
    const { quizId } = req.params;
    
    const quiz = await Quiz.findById(quizId);
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }
    
    if (quiz.creator.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const analytics = await QuizResult.getQuizAnalytics(quizId);
    
    res.json({ analytics });
    
  } catch (error) {
    console.error('Get analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get group performance (teacher)
router.get('/group/:groupId/performance', authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    
    const group = await Group.findById(groupId);
    if (!group || !group.isAdmin(req.userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const performance = await QuizResult.getGroupPerformance(groupId);
    
    res.json({ performance });
    
  } catch (error) {
    console.error('Get performance error:', error);
    res.status(500).json({ error: 'Failed to fetch performance' });
  }
});

module.exports = router;