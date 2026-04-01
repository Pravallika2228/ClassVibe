// backend/socket-handlers/quiz-socket-handlers.js
// Server-Side Synchronized Quiz Timer Management

const QuizSession = require('../models/QuizSession');
const Quiz = require('../models/Quiz');

// Store active quiz timers
const activeQuizTimers = new Map();

/**
 * Setup quiz-related socket event handlers
 */
function setupQuizSocketHandlers(io, socket) {
  console.log('🎮 Setting up quiz socket handlers for:', socket.id);

  // ========================================
  // TEACHER CONTROLS
  // ========================================

  /**
   * Teacher starts quiz (begins Question 1)
   */
  socket.on('teacher:startQuiz', async (data) => {
    try {
      const { sessionId } = data;
      
      console.log('🚀 Teacher starting quiz:', sessionId);
      
      const session = await QuizSession.findById(sessionId).populate('quiz');
      if (!session) {
        return socket.emit('error', { message: 'Session not found' });
      }

      // Verify teacher is host
      if (session.host.toString() !== socket.userId.toString()) {
        return socket.emit('error', { message: 'Only host can start quiz' });
      }

      // Update session status
      session.status = 'active';
      session.currentQuestionIndex = 0;
      await session.save();

      const firstQuestion = session.quiz.questions[0];
      const questionTimeLimit = firstQuestion.timeLimit || 45;

      // Start server-side timer
      startQuestionTimer(io, session, 0, questionTimeLimit);

      // Broadcast to all participants
      io.to(sessionId).emit('quiz:started', {
        sessionId,
        questionIndex: 0,
        question: {
          questionText: firstQuestion.questionText,
          options: firstQuestion.options,
          timeLimit: questionTimeLimit,
          points: firstQuestion.points || 10
        },
        totalQuestions: session.quiz.questions.length
      });

      console.log('✅ Quiz started successfully');

    } catch (error) {
      console.error('❌ Start quiz error:', error);
      socket.emit('error', { message: 'Failed to start quiz' });
    }
  });

  /**
   * Teacher manually advances to next question
   */
  socket.on('teacher:nextQuestion', async (data) => {
    try {
      const { sessionId } = data;
      
      const session = await QuizSession.findById(sessionId).populate('quiz');
      if (!session) return;

      // Verify teacher is host
      if (session.host.toString() !== socket.userId.toString()) {
        return socket.emit('error', { message: 'Only host can control quiz' });
      }

      // Stop current timer
      stopQuestionTimer(sessionId);

      // Move to next question
      const nextIndex = session.currentQuestionIndex + 1;

      if (nextIndex >= session.quiz.questions.length) {
        // Quiz complete
        return socket.emit('error', { message: 'No more questions' });
      }

      session.currentQuestionIndex = nextIndex;
      await session.save();

      const nextQuestion = session.quiz.questions[nextIndex];
      const questionTimeLimit = nextQuestion.timeLimit || 45;

      // Start new timer
      startQuestionTimer(io, session, nextIndex, questionTimeLimit);

      // Broadcast next question
      io.to(sessionId).emit('quiz:nextQuestion', {
        questionIndex: nextIndex,
        question: {
          questionText: nextQuestion.questionText,
          options: nextQuestion.options,
          timeLimit: questionTimeLimit,
          points: nextQuestion.points || 10
        },
        totalQuestions: session.quiz.questions.length
      });

      console.log(`✅ Advanced to question ${nextIndex + 1}`);

    } catch (error) {
      console.error('❌ Next question error:', error);
    }
  });

  /**
   * Teacher ends quiz
   */
  socket.on('teacher:endQuiz', async (data) => {
    try {
      const { sessionId } = data;
      
      const session = await QuizSession.findById(sessionId);
      if (!session) return;

      // Verify teacher is host
      if (session.host.toString() !== socket.userId.toString()) {
        return socket.emit('error', { message: 'Only host can end quiz' });
      }

      // Stop timer
      stopQuestionTimer(sessionId);

      // Update session
      session.status = 'completed';
      await session.save();

      // Broadcast quiz ended
      io.to(sessionId).emit('quiz:ended', {
        sessionId,
        message: 'Quiz has ended'
      });

      console.log('🏁 Quiz ended:', sessionId);

    } catch (error) {
      console.error('❌ End quiz error:', error);
    }
  });

  // ========================================
  // STUDENT ACTIONS
  // ========================================

  /**
   * Student joins quiz session
   */
  socket.on('student:joinQuiz', async (data) => {
    try {
      const { sessionId } = data;
      
      console.log(`👤 Student ${socket.userId} joining quiz ${sessionId}`);

      const session = await QuizSession.findById(sessionId).populate('quiz');
      if (!session) {
        return socket.emit('error', { message: 'Session not found' });
      }

      // Add student to session room
      socket.join(sessionId);

      // Check if student already in participants
      let participant = session.participants.find(
        p => p.user.toString() === socket.userId.toString()
      );

      if (!participant) {
        // Add new participant
        session.participants.push({
          user: socket.userId,
          joinedAt: new Date(),
          answers: [],
          score: 0
        });
        await session.save();
      }

      // Get current question and timer info
      let currentQuestionData = null;
      let timeRemaining = 0;

      if (session.status === 'active') {
        const currentQuestion = session.quiz.questions[session.currentQuestionIndex];
        const timerInfo = activeQuizTimers.get(sessionId);

        currentQuestionData = {
          questionIndex: session.currentQuestionIndex,
          questionText: currentQuestion.questionText,
          options: currentQuestion.options,
          timeLimit: currentQuestion.timeLimit || 45,
          points: currentQuestion.points || 10
        };

        timeRemaining = timerInfo ? timerInfo.timeRemaining : currentQuestion.timeLimit;
      }

      // Send current state to student
      socket.emit('quiz:joined', {
        sessionId,
        status: session.status,
        currentQuestion: currentQuestionData,
        timeRemaining,
        totalQuestions: session.quiz.questions.length,
        quizTitle: session.quiz.title
      });

      // Notify teacher
      io.to(sessionId).emit('student:joined', {
        userId: socket.userId,
        studentCount: session.participants.length
      });

      console.log('✅ Student joined successfully');

    } catch (error) {
      console.error('❌ Join quiz error:', error);
      socket.emit('error', { message: 'Failed to join quiz' });
    }
  });

  /**
   * Student submits answer
   */
  socket.on('student:submitAnswer', async (data) => {
    try {
      const { sessionId, questionIndex, selectedAnswer, timeTaken } = data;

      console.log(`📝 Student ${socket.userId} submitted answer for Q${questionIndex + 1}`);

      const session = await QuizSession.findById(sessionId).populate('quiz');
      if (!session) return;

      const question = session.quiz.questions[questionIndex];
      const isCorrect = selectedAnswer === question.correctAnswer;
      const points = isCorrect ? (question.points || 10) : 0;

      // Find participant and update
      const participantIndex = session.participants.findIndex(
        p => p.user.toString() === socket.userId.toString()
      );

      if (participantIndex !== -1) {
        // Check if already answered this question
        const alreadyAnswered = session.participants[participantIndex].answers.some(
          a => a.questionIndex === questionIndex
        );

        if (!alreadyAnswered) {
          // Add answer
          session.participants[participantIndex].answers.push({
            questionIndex,
            selectedAnswer,
            isCorrect,
            points,
            timeTaken,
            answeredAt: new Date()
          });

          // Update score
          session.participants[participantIndex].score += points;

          await session.save();

          // Send answer summary to this student
          socket.emit('answer:summary', {
            questionIndex,
            selectedAnswer,
            correctAnswer: question.correctAnswer,
            isCorrect,
            points,
            explanation: question.explanation,
            currentScore: session.participants[participantIndex].score,
            questionText: question.questionText,
            options: question.options
          });

          // Notify teacher/other students that this student answered
          socket.to(sessionId).emit('student:answered', {
            userId: socket.userId,
            questionIndex,
            answeredCount: session.participants.filter(
              p => p.answers.some(a => a.questionIndex === questionIndex)
            ).length
          });

          console.log(`✅ Answer recorded: ${isCorrect ? 'Correct' : 'Wrong'} (+${points} points)`);
        }
      }

    } catch (error) {
      console.error('❌ Submit answer error:', error);
      socket.emit('error', { message: 'Failed to submit answer' });
    }
  });

  // ========================================
  // SOCKET DISCONNECT
  // ========================================

  socket.on('disconnect', () => {
    console.log('👋 Socket disconnected:', socket.id);
  });
}

// ========================================
// SERVER-SIDE TIMER FUNCTIONS
// ========================================

/**
 * Start a question timer (server-controlled)
 */
function startQuestionTimer(io, session, questionIndex, timeLimit) {
  const sessionId = session._id.toString();

  // Clear any existing timer
  stopQuestionTimer(sessionId);

  console.log(`⏱️ Starting timer for Q${questionIndex + 1}: ${timeLimit}s`);

  let timeRemaining = timeLimit;

  const timerInterval = setInterval(() => {
    timeRemaining--;

    // Broadcast timer update every second
    io.to(sessionId).emit('timer:update', {
      questionIndex,
      timeRemaining
    });

    // When time expires
    if (timeRemaining <= 0) {
      clearInterval(timerInterval);
      activeQuizTimers.delete(sessionId);

      console.log(`⏰ Time expired for Q${questionIndex + 1}`);

      // Auto-advance to answer summary
      handleQuestionComplete(io, session, questionIndex);
    }
  }, 1000);

  // Store timer reference
  activeQuizTimers.set(sessionId, {
    interval: timerInterval,
    timeRemaining,
    questionIndex
  });
}

/**
 * Stop a question timer
 */
function stopQuestionTimer(sessionId) {
  const timerInfo = activeQuizTimers.get(sessionId);
  
  if (timerInfo) {
    clearInterval(timerInfo.interval);
    activeQuizTimers.delete(sessionId);
    console.log('⏹️ Timer stopped for session:', sessionId);
  }
}

/**
 * Handle question completion (time expired or teacher advanced)
 */
async function handleQuestionComplete(io, session, questionIndex) {
  const sessionId = session._id.toString();
  
  try {
    // Reload session to get latest data
    const updatedSession = await QuizSession.findById(sessionId).populate('quiz');
    const question = updatedSession.quiz.questions[questionIndex];

    // Get all participants who answered
    const participantsWhoAnswered = updatedSession.participants.filter(
      p => p.answers.some(a => a.questionIndex === questionIndex)
    );

    // Send answer summary to ALL students (even those who didn't answer)
    io.to(sessionId).emit('question:complete', {
      questionIndex,
      correctAnswer: question.correctAnswer,
      explanation: question.explanation,
      questionText: question.questionText,
      options: question.options,
      answeredCount: participantsWhoAnswered.length,
      totalStudents: updatedSession.participants.length
    });

    // Wait 5 seconds for students to review
    setTimeout(() => {
      // Show leaderboard
      const leaderboard = getLeaderboard(updatedSession);
      
      io.to(sessionId).emit('leaderboard:show', {
        leaderboard,
        questionIndex,
        isLastQuestion: questionIndex >= updatedSession.quiz.questions.length - 1
      });

      // If not last question, wait 8 seconds then auto-advance
      if (questionIndex < updatedSession.quiz.questions.length - 1) {
        setTimeout(async () => {
          const nextIndex = questionIndex + 1;
          
          // Update session
          updatedSession.currentQuestionIndex = nextIndex;
          await updatedSession.save();

          const nextQuestion = updatedSession.quiz.questions[nextIndex];
          const questionTimeLimit = nextQuestion.timeLimit || 45;

          // Start new timer
          startQuestionTimer(io, updatedSession, nextIndex, questionTimeLimit);

          // Broadcast next question
          io.to(sessionId).emit('quiz:nextQuestion', {
            questionIndex: nextIndex,
            question: {
              questionText: nextQuestion.questionText,
              options: nextQuestion.options,
              timeLimit: questionTimeLimit,
              points: nextQuestion.points || 10
            },
            totalQuestions: updatedSession.quiz.questions.length
          });

          console.log(`➡️ Auto-advanced to question ${nextIndex + 1}`);
        }, 8000); // 8 seconds to view leaderboard
      } else {
        // Quiz complete
        setTimeout(() => {
          io.to(sessionId).emit('quiz:finished', {
            leaderboard,
            message: 'Quiz completed!'
          });
          console.log('🏁 Quiz finished');
        }, 8000);
      }
    }, 5000); // 5 seconds to review answer

  } catch (error) {
    console.error('❌ Question complete handler error:', error);
  }
}

/**
 * Generate leaderboard from session
 */
function getLeaderboard(session) {
  const leaderboard = session.participants
    .map(p => ({
      userId: p.user,
      score: p.score,
      correctAnswers: p.answers.filter(a => a.isCorrect).length,
      totalAnswers: p.answers.length
    }))
    .sort((a, b) => {
      // Sort by score (descending), then by correct answers
      if (b.score !== a.score) return b.score - a.score;
      return b.correctAnswers - a.correctAnswers;
    })
    .map((entry, index) => ({
      ...entry,
      rank: index + 1
    }));

  return leaderboard;
}

// ========================================
// CLEANUP ON SERVER SHUTDOWN
// ========================================

function cleanupQuizTimers() {
  console.log('🧹 Cleaning up all quiz timers...');
  
  for (const [sessionId, timerInfo] of activeQuizTimers.entries()) {
    clearInterval(timerInfo.interval);
    console.log(`⏹️ Stopped timer for session: ${sessionId}`);
  }
  
  activeQuizTimers.clear();
  console.log('✅ All timers cleaned up');
}

// ========================================
// EXPORTS
// ========================================

module.exports = {
  setupQuizSocketHandlers,
  cleanupQuizTimers,
  stopQuestionTimer
};