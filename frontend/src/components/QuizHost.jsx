// frontend/src/components/QuizHost.jsx
// Teacher's Quiz Control Panel - Server-Synchronized

import React, { useState, useEffect } from 'react';
import socket from '../socket';

const QuizHost = ({ quiz, sessionId, onClose }) => {
  const [currentView, setCurrentView] = useState('preview'); // preview, active, finished
  const [students, setStudents] = useState([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [answeredCount, setAnsweredCount] = useState(0);

  // ========================================
  // SOCKET EVENT LISTENERS
  // ========================================

  useEffect(() => {
    if (!socket.connected) {
      socket.connect();
    }

    // Listen for student joined
    socket.on('student:joined', (data) => {
      console.log('👤 Student joined');
      setStudents(prev => {
        if (prev.find(s => s.userId === data.userId)) return prev;
        return [...prev, { userId: data.userId, answered: false }];
      });
    });

    // Listen for student answered
    socket.on('student:answered', (data) => {
      console.log('✅ Student answered');
      setAnsweredCount(data.answeredCount);
      setStudents(prev => prev.map(s => 
        s.userId === data.userId ? { ...s, answered: true } : s
      ));
    });

    // Listen for timer updates from server
    socket.on('timer:update', (data) => {
      setTimeRemaining(data.timeRemaining);
    });

    // Listen for quiz started confirmation
    socket.on('quiz:started', (data) => {
      console.log('🚀 Quiz started');
      setCurrentView('active');
      setCurrentQuestionIndex(0);
      setTimeRemaining(data.question.timeLimit);
      setAnsweredCount(0);
    });

    // Listen for next question
    socket.on('quiz:nextQuestion', (data) => {
      console.log('➡️ Next question');
      setCurrentQuestionIndex(data.questionIndex);
      setTimeRemaining(data.question.timeLimit);
      setAnsweredCount(0);
      // Reset answered status
      setStudents(prev => prev.map(s => ({ ...s, answered: false })));
    });

    // Listen for quiz finished
    socket.on('quiz:finished', () => {
      console.log('🏁 Quiz finished');
      setCurrentView('finished');
    });

    // Error handling
    socket.on('error', (data) => {
      console.error('❌ Error:', data.message);
      alert(data.message);
    });

    // Cleanup
    return () => {
      socket.off('student:joined');
      socket.off('student:answered');
      socket.off('timer:update');
      socket.off('quiz:started');
      socket.off('quiz:nextQuestion');
      socket.off('quiz:finished');
      socket.off('error');
    };
  }, [sessionId]);

  // ========================================
  // HANDLERS
  // ========================================

  const handleStartQuiz = () => {
    if (students.length === 0) {
      if (!window.confirm('No students have joined yet. Start anyway?')) {
        return;
      }
    }

    // Tell server to start quiz
    socket.emit('teacher:startQuiz', { sessionId });
  };

  const handleNextQuestion = () => {
    // Tell server to advance to next question
    socket.emit('teacher:nextQuestion', { sessionId });
  };

  const handleEndQuiz = () => {
    if (!window.confirm('End the quiz and show final results?')) {
      return;
    }

    // Tell server to end quiz
    socket.emit('teacher:endQuiz', { sessionId });
  };

  // ========================================
  // VIEW RENDERERS
  // ========================================

  const currentQuestion = quiz?.questions[currentQuestionIndex];
  const totalQuestions = quiz?.questions.length || 0;

  // PREVIEW VIEW - Before starting
  if (currentView === 'preview') {
    return (
      <div style={styles.overlay}>
        <div style={styles.modal}>
          {/* Header */}
          <div style={styles.header}>
            <div>
              <h2 style={styles.title}>🎮 Quiz Control Panel</h2>
              <p style={styles.subtitle}>{quiz?.title}</p>
            </div>
            <button onClick={onClose} style={styles.closeBtn}>✕</button>
          </div>

          {/* Quiz Info */}
          <div style={styles.content}>
            <div style={styles.infoCard}>
              <div style={styles.infoItem}>
                <div style={styles.infoNumber}>{totalQuestions}</div>
                <div style={styles.infoLabel}>Questions</div>
              </div>
              <div style={styles.infoItem}>
                <div style={styles.infoNumber}>{students.length}</div>
                <div style={styles.infoLabel}>Students Waiting</div>
              </div>
              <div style={styles.infoItem}>
                <div style={styles.infoNumber}>
                  {quiz?.questions.reduce((sum, q) => sum + (q.points || 10), 0)}
                </div>
                <div style={styles.infoLabel}>Total Points</div>
              </div>
            </div>

            {/* Waiting Students */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>
                👥 Waiting Students ({students.length})
              </h3>
              {students.length === 0 ? (
                <div style={styles.emptyState}>
                  <div style={styles.emptyIcon}>🎯</div>
                  <p style={styles.emptyText}>No students yet</p>
                  <p style={styles.emptySubtext}>
                    Students can join using the FloatingQuizButton
                  </p>
                </div>
              ) : (
                <div style={styles.studentGrid}>
                  {students.map((student, index) => (
                    <div key={index} style={styles.studentChip}>
                      <div style={styles.studentAvatar}>
                        {student.userId.substring(0, 2).toUpperCase()}
                      </div>
                      <span style={styles.studentName}>
                        Student {student.userId.substring(0, 6)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Questions Preview */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>📝 Questions Preview</h3>
              <div style={styles.questionsList}>
                {quiz?.questions.map((q, index) => (
                  <div key={index} style={styles.questionPreview}>
                    <div style={styles.questionPreviewNumber}>Q{index + 1}</div>
                    <div style={styles.questionPreviewText}>
                      {q.questionText.substring(0, 60)}...
                    </div>
                    <div style={styles.questionPreviewMeta}>
                      <span style={styles.questionPreviewTime}>⏱️ {q.timeLimit || 45}s</span>
                      <span style={styles.questionPreviewPoints}>{q.points || 10} pts</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={styles.footer}>
            <button onClick={onClose} style={styles.cancelBtn}>
              Cancel
            </button>
            <button onClick={handleStartQuiz} style={styles.startBtn}>
              🚀 Start Quiz Now
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ACTIVE VIEW - During quiz
  if (currentView === 'active') {
    const progressPercent = ((currentQuestionIndex + 1) / totalQuestions) * 100;

    return (
      <div style={styles.overlay}>
        <div style={styles.modalActive}>
          {/* Header */}
          <div style={styles.headerActive}>
            <div>
              <h2 style={styles.titleActive}>🎮 Live Quiz</h2>
              <div style={styles.progressBar}>
                <div style={{
                  ...styles.progressFill,
                  width: `${progressPercent}%`
                }}></div>
              </div>
              <p style={styles.progressText}>
                Question {currentQuestionIndex + 1} of {totalQuestions}
              </p>
            </div>
            <div style={styles.headerControls}>
              <div style={styles.timerDisplay}>
                <div style={styles.timerIcon}>⏱️</div>
                <div style={styles.timerText}>{timeRemaining}s</div>
              </div>
              <button onClick={handleEndQuiz} style={styles.endBtn}>
                End Quiz
              </button>
            </div>
          </div>

          {/* Main Content */}
          <div style={styles.contentActive}>
            {/* Left: Current Question */}
            <div style={styles.leftPanel}>
              <div style={styles.currentQuestionCard}>
                <div style={styles.currentQuestionHeader}>
                  <span style={styles.currentQuestionBadge}>
                    Question {currentQuestionIndex + 1}
                  </span>
                  <span style={styles.currentQuestionPoints}>
                    {currentQuestion?.points || 10} points
                  </span>
                </div>

                <h3 style={styles.currentQuestionText}>
                  {currentQuestion?.questionText}
                </h3>

                <div style={styles.currentOptions}>
                  {currentQuestion?.options.map((option, index) => {
                    const isCorrect = index === currentQuestion.correctAnswer;
                    
                    return (
                      <div
                        key={index}
                        style={{
                          ...styles.currentOption,
                          backgroundColor: isCorrect ? '#E8F5E9' : '#f9f9f9',
                          border: isCorrect ? '3px solid #4CAF50' : '2px solid #e0e0e0'
                        }}
                      >
                        <div style={styles.currentOptionLetter}>
                          {String.fromCharCode(65 + index)}
                        </div>
                        <div style={styles.currentOptionText}>{option}</div>
                        {isCorrect && (
                          <div style={styles.correctIndicator}>✓ Correct</div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {currentQuestion?.explanation && (
                  <div style={styles.explanationCard}>
                    <div style={styles.explanationTitle}>💡 Explanation:</div>
                    <p style={styles.explanationText}>
                      {currentQuestion.explanation}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Right: Student Progress */}
            <div style={styles.rightPanel}>
              <div style={styles.progressCard}>
                <h3 style={styles.progressTitle}>📊 Student Progress</h3>
                
                <div style={styles.statsRow}>
                  <div style={styles.statBox}>
                    <div style={styles.statNumber}>{students.length}</div>
                    <div style={styles.statLabel}>Total Students</div>
                  </div>
                  <div style={styles.statBox}>
                    <div style={styles.statNumber}>{answeredCount}</div>
                    <div style={styles.statLabel}>Answered</div>
                  </div>
                  <div style={styles.statBox}>
                    <div style={styles.statNumber}>
                      {students.length - answeredCount}
                    </div>
                    <div style={styles.statLabel}>Pending</div>
                  </div>
                </div>

                {/* Progress Bar */}
                <div style={styles.answerProgress}>
                  <div style={{
                    ...styles.answerProgressFill,
                    width: students.length > 0 
                      ? `${(answeredCount / students.length) * 100}%`
                      : '0%'
                  }}></div>
                </div>
                <p style={styles.answerProgressText}>
                  {students.length > 0
                    ? Math.round((answeredCount / students.length) * 100)
                    : 0}% completed
                </p>

                {/* Student List */}
                <div style={styles.studentListActive}>
                  {students.map((student, index) => (
                    <div key={index} style={styles.studentItemActive}>
                      <div style={{
                        ...styles.studentStatusDot,
                        backgroundColor: student.answered ? '#4CAF50' : '#FF9800'
                      }}></div>
                      <span style={styles.studentNameActive}>
                        Student {student.userId.substring(0, 6)}
                      </span>
                      {student.answered && (
                        <span style={styles.studentAnsweredBadge}>✓</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Footer Controls */}
          <div style={styles.footerActive}>
            <button onClick={onClose} style={styles.minimizeBtn}>
              Minimize
            </button>
            
            {currentQuestionIndex < totalQuestions - 1 ? (
              <button onClick={handleNextQuestion} style={styles.nextBtn}>
                Next Question →
              </button>
            ) : (
              <button onClick={handleEndQuiz} style={styles.finishBtn}>
                🏁 Finish Quiz
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // FINISHED VIEW
  if (currentView === 'finished') {
    return (
      <div style={styles.overlay}>
        <div style={styles.modal}>
          <div style={styles.finishedCard}>
            <div style={styles.finishedIcon}>🎉</div>
            <h2 style={styles.finishedTitle}>Quiz Complete!</h2>
            <p style={styles.finishedText}>
              Results have been shown to all students
            </p>
            <button onClick={onClose} style={styles.doneBtn}>
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};

// ========================================
// STYLES
// ========================================

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.9)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3000,
    padding: '20px'
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '900px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
  },
  modalActive: {
    backgroundColor: 'white',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '1200px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '25px 30px',
    borderBottom: '2px solid #f0f0f0',
    backgroundColor: '#4F46E5'
  },
  title: {
    fontSize: '24px',
    fontWeight: '700',
    color: 'white',
    margin: 0
  },
  subtitle: {
    fontSize: '14px',
    color: '#E0E7FF',
    margin: '5px 0 0 0'
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '28px',
    color: 'white',
    cursor: 'pointer',
    padding: '0 10px'
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '30px'
  },
  infoCard: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '20px',
    marginBottom: '30px'
  },
  infoItem: {
    textAlign: 'center',
    padding: '25px',
    backgroundColor: '#F9FAFB',
    borderRadius: '12px',
    border: '2px solid #E5E7EB'
  },
  infoNumber: {
    fontSize: '36px',
    fontWeight: '700',
    color: '#4F46E5',
    marginBottom: '8px'
  },
  infoLabel: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#6B7280'
  },
  section: {
    marginBottom: '30px'
  },
  sectionTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: '15px'
  },
  emptyState: {
    textAlign: 'center',
    padding: '50px 20px',
    backgroundColor: '#F9FAFB',
    borderRadius: '12px',
    border: '2px dashed #E5E7EB'
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: '15px'
  },
  emptyText: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#374151',
    marginBottom: '8px'
  },
  emptySubtext: {
    fontSize: '14px',
    color: '#6B7280',
    margin: 0
  },
  studentGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '12px'
  },
  studentChip: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    backgroundColor: '#F9FAFB',
    borderRadius: '10px',
    border: '2px solid #E5E7EB'
  },
  studentAvatar: {
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    backgroundColor: '#4F46E5',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: '700'
  },
  studentName: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151'
  },
  questionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    maxHeight: '300px',
    overflowY: 'auto'
  },
  questionPreview: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    padding: '15px',
    backgroundColor: '#F9FAFB',
    borderRadius: '10px',
    border: '1px solid #E5E7EB'
  },
  questionPreviewNumber: {
    padding: '8px 14px',
    backgroundColor: '#4F46E5',
    color: 'white',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: '700',
    flexShrink: 0
  },
  questionPreviewText: {
    flex: 1,
    fontSize: '14px',
    color: '#374151',
    fontWeight: '500'
  },
  questionPreviewMeta: {
    display: 'flex',
    gap: '10px',
    flexShrink: 0
  },
  questionPreviewTime: {
    fontSize: '12px',
    color: '#6B7280',
    fontWeight: '600'
  },
  questionPreviewPoints: {
    fontSize: '12px',
    color: '#10B981',
    fontWeight: '700'
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '25px 30px',
    borderTop: '2px solid #f0f0f0'
  },
  cancelBtn: {
    padding: '14px 28px',
    fontSize: '15px',
    fontWeight: '600',
    backgroundColor: '#F3F4F6',
    color: '#374151',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  startBtn: {
    padding: '14px 32px',
    fontSize: '15px',
    fontWeight: '700',
    backgroundColor: '#10B981',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
    transition: 'all 0.2s'
  },
  
  // Active View Styles
  headerActive: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 30px',
    borderBottom: '2px solid #f0f0f0',
    backgroundColor: '#4F46E5'
  },
  titleActive: {
    fontSize: '22px',
    fontWeight: '700',
    color: 'white',
    margin: '0 0 10px 0'
  },
  progressBar: {
    width: '300px',
    height: '8px',
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: '10px',
    overflow: 'hidden',
    marginBottom: '5px'
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    transition: 'width 0.3s ease'
  },
  progressText: {
    fontSize: '13px',
    color: '#E0E7FF',
    margin: 0
  },
  headerControls: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px'
  },
  timerDisplay: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 20px',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: '25px'
  },
  timerIcon: {
    fontSize: '20px'
  },
  timerText: {
    fontSize: '20px',
    fontWeight: '700',
    color: 'white'
  },
  endBtn: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: '600',
    backgroundColor: '#EF4444',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer'
  },
  contentActive: {
    flex: 1,
    display: 'grid',
    gridTemplateColumns: '1.5fr 1fr',
    gap: '20px',
    padding: '25px',
    overflowY: 'auto'
  },
  leftPanel: {
    display: 'flex',
    flexDirection: 'column'
  },
  currentQuestionCard: {
    backgroundColor: '#F9FAFB',
    padding: '25px',
    borderRadius: '12px',
    border: '2px solid #E5E7EB'
  },
  currentQuestionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px'
  },
  currentQuestionBadge: {
    padding: '8px 16px',
    backgroundColor: '#4F46E5',
    color: 'white',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: '700'
  },
  currentQuestionPoints: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#10B981'
  },
  currentQuestionText: {
    fontSize: '22px',
    fontWeight: '600',
    color: '#1F2937',
    lineHeight: '1.4',
    marginBottom: '20px'
  },
  currentOptions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '20px'
  },
  currentOption: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    padding: '15px',
    borderRadius: '10px'
  },
  currentOptionLetter: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: '#4F46E5',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    fontWeight: '700',
    flexShrink: 0
  },
  currentOptionText: {
    flex: 1,
    fontSize: '16px',
    color: '#374151',
    fontWeight: '500'
  },
  correctIndicator: {
    padding: '5px 12px',
    backgroundColor: '#10B981',
    color: 'white',
    borderRadius: '15px',
    fontSize: '12px',
    fontWeight: '700'
  },
  explanationCard: {
    padding: '18px',
    backgroundColor: 'white',
    borderRadius: '10px',
    border: '1px solid #E5E7EB'
  },
  explanationTitle: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#4F46E5',
    marginBottom: '8px'
  },
  explanationText: {
    fontSize: '15px',
    color: '#374151',
    lineHeight: '1.5',
    margin: 0
  },
  rightPanel: {},
  progressCard: {
    backgroundColor: '#F9FAFB',
    padding: '25px',
    borderRadius: '12px',
    border: '2px solid #E5E7EB',
    height: 'fit-content'
  },
  progressTitle: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: '20px'
  },
  statsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
    marginBottom: '20px'
  },
  statBox: {
    textAlign: 'center',
    padding: '15px',
    backgroundColor: 'white',
    borderRadius: '10px',
    border: '1px solid #E5E7EB'
  },
  statNumber: {
    fontSize: '24px',
    fontWeight: '700',
    color: '#4F46E5',
    marginBottom: '5px'
  },
  statLabel: {
    fontSize: '11px',
    color: '#6B7280',
    fontWeight: '600'
  },
  answerProgress: {
    width: '100%',
    height: '12px',
    backgroundColor: 'white',
    borderRadius: '10px',
    overflow: 'hidden',
    marginBottom: '8px'
  },
  answerProgressFill: {
    height: '100%',
    backgroundColor: '#10B981',
    transition: 'width 0.3s ease'
  },
  answerProgressText: {
    fontSize: '13px',
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: '20px'
  },
  studentListActive: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxHeight: '400px',
    overflowY: 'auto'
  },
  studentItemActive: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '12px',
    backgroundColor: 'white',
    borderRadius: '8px',
    border: '1px solid #E5E7EB'
  },
  studentStatusDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    flexShrink: 0
  },
  studentNameActive: {
    flex: 1,
    fontSize: '13px',
    fontWeight: '600',
    color: '#374151'
  },
  studentAnsweredBadge: {
    fontSize: '16px',
    color: '#10B981'
  },
  footerActive: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '20px 30px',
    borderTop: '2px solid #f0f0f0'
  },
  minimizeBtn: {
    padding: '12px 24px',
    fontSize: '14px',
    fontWeight: '600',
    backgroundColor: '#F3F4F6',
    color: '#374151',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer'
  },
  nextBtn: {
    padding: '12px 28px',
    fontSize: '14px',
    fontWeight: '700',
    backgroundColor: '#4F46E5',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
  },
  finishBtn: {
    padding: '12px 28px',
    fontSize: '14px',
    fontWeight: '700',
    backgroundColor: '#10B981',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
  },
  
  // Finished View Styles
  finishedCard: {
    textAlign: 'center',
    padding: '60px 40px'
  },
  finishedIcon: {
    fontSize: '80px',
    marginBottom: '20px'
  },
  finishedTitle: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: '15px'
  },
  finishedText: {
    fontSize: '16px',
    color: '#6B7280',
    marginBottom: '30px'
  },
  doneBtn: {
    padding: '16px 40px',
    fontSize: '16px',
    fontWeight: '700',
    backgroundColor: '#4F46E5',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
  }
};

export default QuizHost;