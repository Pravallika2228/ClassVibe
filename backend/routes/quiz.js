// backend/routes/quiz.js
// Fixed Quiz API with File Upload Support

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const Quiz = require('../models/Quiz');
const QuizSession = require('../models/QuizSession');
const QuizResult = require('../models/QuizResult');
const Group = require('../models/Group');
const User = require('../models/User');
const { generator } = require('../services/aiQuizGenerator');
const jwt = require('jsonwebtoken');

// ========================================
// FILE UPLOAD SETUP
// ========================================

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/quiz-files');
    fs.mkdir(uploadDir, { recursive: true })
      .then(() => cb(null, uploadDir))
      .catch(err => cb(err));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'quiz-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = /pdf|docx|doc|txt/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  
  if (extname) {
    cb(null, true);
  } else {
    cb(new Error('Only PDF, DOCX, and TXT files are allowed'));
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: fileFilter
});

// ========================================
// MIDDLEWARE
// ========================================

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied - no token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId || decoded.id;
    next();
  } catch (error) {
    console.error('Token verification error:', error.message);
    res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// ========================================
// QUIZ GENERATION ROUTES
// ========================================

// Generate quiz from text topic
router.post('/generate', authenticateToken, async (req, res) => {
  try {
    console.log("📥 REQUEST BODY:", req.body);
    console.log("🔑 GEMINI KEY:", process.env.GEMINI_API_KEY ? "FOUND" : "MISSING");
    console.log('📥 Generate quiz request:', {
      userId: req.userId,
      body: req.body,
      headers: req.headers['content-type']
    });

    // ✅ FIX: Explicit body validation
    if (!req.body) {
      return res.status(400).json({ 
        error: 'Request body is missing',
        details: 'Make sure Content-Type is application/json'
      });
    }

    const { topic, questionCount, groupId, difficulty } = req.body;
    
    if (!topic) {
      return res.status(400).json({ error: 'Topic is required' });
    }
    
    if (!groupId) {
      return res.status(400).json({ error: 'Group ID is required' });
    }
    
    // Verify user is teacher
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    if (user.role !== 'teacher') {
      return res.status(403).json({ error: 'Only teachers can generate quizzes' });
    }
    
    // Verify group access
    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }
    
    if (!group.isAdmin(req.userId)) {
      return res.status(403).json({ error: 'You are not the admin of this group' });
    }
    
    console.log('🤖 Generating quiz with AI:', { topic, questionCount, difficulty });
    
    // Generate questions with AI
    const questions = await generator.generateFromText(
      topic, 
      questionCount || 10,
      difficulty || 'medium'
    );
    
    // Create quiz in database
    const quiz = new Quiz({
      title: `${topic} Quiz`,
      description: `AI-generated quiz about ${topic}`,
      creator: req.userId,
      group: groupId,
      source: 'ai',
      aiSource: {
        type: 'text',
        content: topic
      },
      questions,
      settings: {
        showCorrectAnswer: true,
        showLeaderboard: true,
        allowLateJoin: true,
        shuffleQuestions: false,
        shuffleOptions: true
      },
      status: 'draft'
    });
    
    await quiz.save();
    
    console.log('✅ Quiz generated successfully:', quiz._id);
    
    res.json({
      success: true,
      message: 'Quiz generated successfully',
      quiz: {
        _id: quiz._id,
        title: quiz.title,
        description: quiz.description,
        questions: quiz.questions,
        status: quiz.status,
        createdAt: quiz.createdAt
      }
    });
    
  } catch (error) {
    console.error('❌ FULL ERROR:', error);

    res.status(500).json({ 
      error: 'Failed to generate quiz',
      details: error.message,
      stack: error.stack   // ⭐ VERY IMPORTANT (temporary)
    });
  }
});

// Generate quiz from uploaded file
router.post('/generate-from-file', authenticateToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { questionCount, groupId, difficulty } = req.body;
    
    if (!groupId) {
      return res.status(400).json({ error: 'Group ID is required' });
    }
    
    // Verify user is teacher
    const user = await User.findById(req.userId);
    if (user.role !== 'teacher') {
      // Clean up uploaded file
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(403).json({ error: 'Only teachers can generate quizzes' });
    }
    
    // Verify group access
    const group = await Group.findById(groupId);
    if (!group || !group.isAdmin(req.userId)) {
      await fs.unlink(req.file.path).catch(() => {});
      return res.status(403).json({ error: 'Access denied' });
    }
    
    console.log('📄 Generating quiz from file:', req.file.originalname);
    
    // Generate questions from file
    const questions = await generator.generateFromFile(
      req.file.path,
      parseInt(questionCount) || 10,
      difficulty || 'medium'
    );
    
    // Create quiz
    const quiz = new Quiz({
      title: `Quiz from ${req.file.originalname}`,
      description: `AI-generated quiz from uploaded file`,
      creator: req.userId,
      group: groupId,
      source: 'ai',
      aiSource: {
        type: 'file',
        fileName: req.file.originalname,
        content: `Uploaded file: ${req.file.originalname}`
      },
      questions,
      settings: {
        showCorrectAnswer: true,
        showLeaderboard: true,
        allowLateJoin: true,
        shuffleQuestions: false,
        shuffleOptions: true
      },
      status: 'draft'
    });
    
    await quiz.save();
    
    // Clean up uploaded file
    await fs.unlink(req.file.path).catch(err => 
      console.warn('Could not delete temp file:', err.message)
    );
    
    console.log('✅ Quiz generated from file:', quiz._id);
    
    res.json({
      success: true,
      message: 'Quiz generated successfully from file',
      quiz: {
        _id: quiz._id,
        title: quiz.title,
        description: quiz.description,
        questions: quiz.questions,
        status: quiz.status,
        createdAt: quiz.createdAt
      }
    });
    
  } catch (error) {
    console.error('❌ Generate from file error:', error);
    
    // Clean up file on error
    if (req.file) {
      await fs.unlink(req.file.path).catch(() => {});
    }
    
    res.status(500).json({ 
      error: 'Failed to generate quiz from file',
      details: error.message
    });
  }
});

// Update quiz (save edits)
router.put('/:quizId', authenticateToken, async (req, res) => {
  try {
    const { quizId } = req.params;
    const updates = req.body;
    
    const quiz = await Quiz.findById(quizId);
    
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }
    
    if (quiz.creator.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Only quiz creator can edit' });
    }
    
    // Update allowed fields
    const allowedFields = ['title', 'description', 'questions', 'settings', 'status'];
    allowedFields.forEach(field => {
      if (updates[field] !== undefined) {
        quiz[field] = updates[field];
      }
    });
    
    await quiz.save();
    
    console.log('✅ Quiz updated:', quizId);
    
    res.json({
      success: true,
      message: 'Quiz updated successfully',
      quiz
    });
    
  } catch (error) {
    console.error('Update quiz error:', error);
    res.status(500).json({ error: 'Failed to update quiz' });
  }
});

// Delete quiz
router.delete('/:quizId', authenticateToken, async (req, res) => {
  try {
    const { quizId } = req.params;
    
    const quiz = await Quiz.findById(quizId);
    
    if (!quiz) {
      return res.status(404).json({ error: 'Quiz not found' });
    }
    
    if (quiz.creator.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Only quiz creator can delete' });
    }
    
    await quiz.deleteOne();
    
    console.log('🗑️ Quiz deleted:', quizId);
    
    res.json({ success: true, message: 'Quiz deleted successfully' });
    
  } catch (error) {
    console.error('Delete quiz error:', error);
    res.status(500).json({ error: 'Failed to delete quiz' });
  }
});

// Get teacher's recent topics (for suggestions)
router.get('/recent-topics', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (user.role !== 'teacher') {
      return res.status(403).json({ error: 'Only teachers can access this' });
    }
    
    // Get last 10 quiz topics
    const recentQuizzes = await Quiz.find({ creator: req.userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('aiSource.content title');
    
    const topics = recentQuizzes
      .map(q => q.aiSource?.content || q.title)
      .filter(Boolean);
    
    // Default professional topics for college students
    const professionalTopics = [
      'Machine Learning Algorithms',
      'Data Structures and Algorithms',
      'Database Normalization',
      'Neural Networks and Deep Learning',
      'Cloud Computing Architecture',
      'Software Design Patterns',
      'Computer Networks and Protocols',
      'Operating Systems Concepts',
      'Web Development Best Practices',
      'Cybersecurity Fundamentals'
    ];
    
    // Combine recent topics with professional suggestions
    const allTopics = [...new Set([...topics, ...professionalTopics])].slice(0, 10);
    
    res.json({ topics: allTopics });
    
  } catch (error) {
    console.error('Get recent topics error:', error);
    res.status(500).json({ error: 'Failed to fetch topics' });
  }
});

// Start a quiz session (Teacher clicks "Start Quiz Now")
router.post('/:quizId/start-session', authenticateToken, async (req, res) => {
  try {
    const { quizId } = req.params;
 
    const quiz = await Quiz.findById(quizId);
    if (!quiz) return res.status(404).json({ error: 'Quiz not found' });
 
    if (quiz.creator.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Only quiz creator can start session' });
    }
 
    // Check if session already exists for this group
    const existing = await QuizSession.findActiveSession(quiz.group);
    if (existing) {
      return res.json({ success: true, session: existing });
    }
 
    // Create new session
    const session = new QuizSession({
      quiz: quizId,
      group: quiz.group,
      host: req.userId,
      status: 'waiting',
      participants: []
    });
 
    await session.save();
    await session.populate('quiz');
 
    // Notify all students in this group via socket
    const io = req.app.get('io');
    if (io) {
      io.to(quiz.group.toString()).emit('quizStarted', {
        sessionId: session._id,
        quizTitle: quiz.title,
        quizId: quiz._id,
        session: session
      });
    }
 
    console.log('✅ Quiz session created:', session._id);
 
    res.json({ success: true, session });
 
  } catch (error) {
    console.error('Start session error:', error);
    res.status(500).json({ error: 'Failed to start quiz session' });
  }
});
 
// Get active quiz session for a group (used by FloatingQuizButton)
router.get('/group/:groupId/active', authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;
 
    const session = await QuizSession.findActiveSession(groupId);
 
    res.json({ session: session || null });
 
  } catch (error) {
    console.error('Get active session error:', error);
    res.status(500).json({ error: 'Failed to get active session' });
  }
});
// ... Keep all other existing routes (start session, join, etc.) from previous quiz.js ...
// (I'm shortening this for space, but include ALL the session management routes from your original file)

module.exports = router;