// frontend/src/components/QuizHost.jsx
// Teacher's live quiz control panel

import React, { useState, useEffect } from 'react';
import Leaderboard from './Leaderboard';

const QuizHost = ({ quiz, session, onClose, socket }) => {
  const [currentView, setCurrentView] = useState('preview'); // preview, active, leaderboard, finished
  const [participants, setParticipants] = useState(session?.participants || []);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!socket) return;

    // Listen for participants joining
    socket.on('participantJoined', (data) => {
      console.log('👤 Participant joined:', data);
      setParticipants(prev => {
        if (prev.find(p => p.userId === data.userId)) return prev;
        return [...prev, data];
      });
    });

    // Listen for answers submitted
    socket.on('answerSubmitted', (data) => {
      console.log('✅ Answer submitted:', data);
    });

    return () => {
      socket.off('participantJoined');
      socket.off('answerSubmitted');
    };
  }, [socket]);

  // Start quiz
  const handleStartQuiz = async () => {
    if (participants.length === 0) {
      if (!window.confirm('No students have joined yet. Start anyway?')) {
        return;
      }
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.REACT_APP_API_URL || "https://classvibe-backend.onrender.com"}/api/quiz/session/${session._id}/begin`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        setCurrentView('active');
        setCurrentQuestionIndex(0);
      } else {
        alert('Failed to start quiz');
      }
    } catch (error) {
      console.error('Start quiz error:', error);
      alert('Failed to start quiz');
    } finally {
      setLoading(false);
    }
  };

  // Next question
  const handleNextQuestion = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.REACT_APP_API_URL || "https://classvibe-backend.onrender.com"}/api/quiz/session/${session._id}/next`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setCurrentQuestionIndex(data.currentQuestionIndex);
        setShowLeaderboard(true);
        
        // Hide leaderboard after 5 seconds
        setTimeout(() => {
          setShowLeaderboard(false);
        }, 5000);
      }
    } catch (error) {
      console.error('Next question error:', error);
    } finally {
      setLoading(false);
    }
  };

  // End quiz
  const handleEndQuiz = async () => {
    if (!window.confirm('End quiz and show final results?')) return;

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.REACT_APP_API_URL || "https://classvibe-backend.onrender.com"}/api/quiz/session/${session._id}/end`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.ok) {
        setCurrentView('finished');
        setShowLeaderboard(true);
      }
    } catch (error) {
      console.error('End quiz error:', error);
      alert('Failed to end quiz');
    } finally {
      setLoading(false);
    }
  };

  const currentQuestion = quiz?.questions[currentQuestionIndex];

  // PREVIEW MODE - Before starting
  if (currentView === 'preview') {
    return (
      <div style={styles.overlay}>
        <div style={styles.modal}>
          {/* Header */}
          <div style={styles.header}>
            <h2 style={styles.title}>🎮 Quiz Control Panel</h2>
            <button onClick={onClose} style={styles.closeBtn}>✕</button>
          </div>

          {/* Quiz Info */}
          <div style={styles.quizInfo}>
            <h3 style={styles.quizTitle}>{quiz?.title}</h3>
            <p style={styles.quizMeta}>
              {quiz?.questions.length} questions • {participants.length} students waiting
            </p>
          </div>

          {/* Waiting Students */}
          <div style={styles.participantsList}>
            <h4 style={styles.sectionTitle}>👥 Waiting Students ({participants.length})</h4>
            {participants.length === 0 ? (
              <p style={styles.emptyText}>No students yet. Share quiz with your class!</p>
            ) : (
              <div style={styles.participantsGrid}>
                {participants.map((p, index) => (
                  <div key={index} style={styles.participantChip}>
                    <div style={styles.participantAvatar}>{p.user?.name?.charAt(0) || '?'}</div>
                    <span style={styles.participantName}>{p.user?.name || 'Student'}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Question Preview */}
          <div style={styles.questionsPreview}>
            <h4 style={styles.sectionTitle}>📝 Questions Preview</h4>
            <div style={styles.questionsList}>
              {quiz?.questions.map((q, index) => (
                <div key={index} style={styles.questionPreviewItem}>
                  <div style={styles.questionNumber}>Q{index + 1}</div>
                  <div style={styles.questionPreviewText}>{q.questionText}</div>
                  <div style={styles.questionPoints}>{q.points || 10} pts</div>
                </div>
              ))}
            </div>
          </div>

          {/* Start Button */}
          <div style={styles.footer}>
            <button onClick={onClose} style={styles.cancelBtn}>
              Cancel
            </button>
            <button 
              onClick={handleStartQuiz} 
              disabled={loading}
              style={styles.startBtn}
            >
              {loading ? 'Starting...' : '🚀 Start Quiz Now'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ACTIVE MODE - During quiz
  if (currentView === 'active') {
    if (showLeaderboard) {
      return (
        <Leaderboard
          sessionId={session._id}
          myScore={0}
          onClose={() => setShowLeaderboard(false)}
        />
      );
    }

    return (
      <div style={styles.overlay}>
        <div style={styles.modal}>
          {/* Header */}
          <div style={styles.header}>
            <div>
              <h2 style={styles.title}>🎮 Live Quiz</h2>
              <p style={styles.headerSubtext}>
                Question {currentQuestionIndex + 1} of {quiz?.questions.length}
              </p>
            </div>
            <button onClick={handleEndQuiz} style={styles.endQuizBtn}>
              End Quiz
            </button>
          </div>

          {/* Current Question Display */}
          <div style={styles.currentQuestion}>
            <div style={styles.questionHeader}>
              <span style={styles.questionBadge}>Question {currentQuestionIndex + 1}</span>
              <span style={styles.questionTimer}>{currentQuestion?.timeLimit}s</span>
            </div>
            
            <h3 style={styles.questionText}>{currentQuestion?.questionText}</h3>

            <div style={styles.options}>
              {currentQuestion?.options.map((option, index) => (
                <div 
                  key={index} 
                  style={{
                    ...styles.option,
                    backgroundColor: index === currentQuestion.correctAnswer ? '#D7F0DD' : '#f5f5f5',
                    border: index === currentQuestion.correctAnswer ? '2px solid #25D366' : '1px solid #e0e0e0'
                  }}
                >
                  <span style={styles.optionLetter}>{String.fromCharCode(65 + index)}</span>
                  <span style={styles.optionText}>{option}</span>
                  {index === currentQuestion.correctAnswer && (
                    <span style={styles.correctBadge}>✓ Correct</span>
                  )}
                </div>
              ))}
            </div>

            {currentQuestion?.explanation && (
              <div style={styles.explanation}>
                <strong>Explanation:</strong> {currentQuestion.explanation}
              </div>
            )}
          </div>

          {/* Participant Status */}
          <div style={styles.participantStatus}>
            <h4 style={styles.sectionTitle}>
              📊 Students Progress ({participants.length} joined)
            </h4>
            <div style={styles.statusGrid}>
              {participants.map((p, index) => {
                const hasAnswered = p.answers?.find(a => a.questionIndex === currentQuestionIndex);
                return (
                  <div key={index} style={styles.statusChip}>
                    <div style={{
                      ...styles.statusIndicator,
                      backgroundColor: hasAnswered ? '#25D366' : '#ff9800'
                    }} />
                    <span style={styles.statusName}>
                      {p.user?.name || 'Student'} 
                      {hasAnswered && ' ✓'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Control Buttons */}
          <div style={styles.footer}>
            <button 
              onClick={() => setShowLeaderboard(true)} 
              style={styles.leaderboardBtn}
            >
              📊 Show Leaderboard
            </button>
            
            {currentQuestionIndex < quiz.questions.length - 1 ? (
              <button 
                onClick={handleNextQuestion} 
                disabled={loading}
                style={styles.nextBtn}
              >
                {loading ? 'Loading...' : 'Next Question →'}
              </button>
            ) : (
              <button 
                onClick={handleEndQuiz} 
                disabled={loading}
                style={styles.finishBtn}
              >
                {loading ? 'Finishing...' : '🏁 Finish Quiz'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // FINISHED MODE - Show final leaderboard
  if (currentView === 'finished') {
    return (
      <Leaderboard
        sessionId={session._id}
        myScore={0}
        onClose={onClose}
      />
    );
  }

  return null;
};

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.9)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '12px',
    width: '90%',
    maxWidth: '900px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    borderBottom: '2px solid #e0e0e0',
    backgroundColor: '#075E54'
  },
  title: {
    margin: 0,
    fontSize: '22px',
    fontWeight: '700',
    color: 'white'
  },
  headerSubtext: {
    margin: '5px 0 0 0',
    fontSize: '13px',
    color: '#DCF8C6'
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '28px',
    cursor: 'pointer',
    color: 'white',
    padding: '0 8px'
  },
  endQuizBtn: {
    padding: '8px 16px',
    fontSize: '14px',
    fontWeight: '600',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer'
  },
  quizInfo: {
    padding: '20px',
    backgroundColor: '#D7F0DD',
    borderBottom: '1px solid #e0e0e0'
  },
  quizTitle: {
    margin: '0 0 8px 0',
    fontSize: '20px',
    fontWeight: '600',
    color: '#075E54'
  },
  quizMeta: {
    margin: 0,
    fontSize: '14px',
    color: '#128C7E'
  },
  participantsList: {
    padding: '20px',
    borderBottom: '1px solid #e0e0e0'
  },
  sectionTitle: {
    margin: '0 0 15px 0',
    fontSize: '16px',
    fontWeight: '600',
    color: '#333'
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: '14px',
    padding: '20px'
  },
  participantsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
    gap: '10px'
  },
  participantChip: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
    border: '1px solid #e0e0e0'
  },
  participantAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: '#075E54',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: '600'
  },
  participantName: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#333'
  },
  questionsPreview: {
    flex: 1,
    padding: '20px',
    overflowY: 'auto'
  },
  questionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  questionPreviewItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
    border: '1px solid #e0e0e0'
  },
  questionNumber: {
    padding: '6px 12px',
    backgroundColor: '#075E54',
    color: 'white',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    flexShrink: 0
  },
  questionPreviewText: {
    flex: 1,
    fontSize: '14px',
    color: '#333'
  },
  questionPoints: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#25D366',
    flexShrink: 0
  },
  currentQuestion: {
    flex: 1,
    padding: '20px',
    overflowY: 'auto'
  },
  questionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '20px'
  },
  questionBadge: {
    padding: '8px 16px',
    backgroundColor: '#075E54',
    color: 'white',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: '600'
  },
  questionTimer: {
    padding: '8px 16px',
    backgroundColor: '#ff9800',
    color: 'white',
    borderRadius: '20px',
    fontSize: '14px',
    fontWeight: '600'
  },
  questionText: {
    fontSize: '22px',
    fontWeight: '600',
    color: '#333',
    marginBottom: '25px'
  },
  options: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '20px'
  },
  option: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    padding: '15px',
    borderRadius: '10px'
  },
  optionLetter: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: '#075E54',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    fontWeight: '600',
    flexShrink: 0
  },
  optionText: {
    flex: 1,
    fontSize: '16px',
    color: '#333'
  },
  correctBadge: {
    padding: '4px 12px',
    backgroundColor: '#25D366',
    color: 'white',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: '600'
  },
  explanation: {
    padding: '15px',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#666',
    border: '1px solid #e0e0e0'
  },
  participantStatus: {
    padding: '20px',
    borderTop: '1px solid #e0e0e0',
    backgroundColor: '#f8f9fa'
  },
  statusGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '8px'
  },
  statusChip: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 12px',
    backgroundColor: 'white',
    borderRadius: '6px',
    border: '1px solid #e0e0e0'
  },
  statusIndicator: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    flexShrink: 0
  },
  statusName: {
    fontSize: '12px',
    color: '#333',
    fontWeight: '500'
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '10px',
    padding: '20px',
    borderTop: '1px solid #e0e0e0'
  },
  cancelBtn: {
    padding: '12px 24px',
    fontSize: '14px',
    fontWeight: '600',
    backgroundColor: '#f0f0f0',
    color: '#333',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer'
  },
  startBtn: {
    padding: '12px 24px',
    fontSize: '14px',
    fontWeight: '600',
    backgroundColor: '#25D366',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer'
  },
  leaderboardBtn: {
    padding: '12px 24px',
    fontSize: '14px',
    fontWeight: '600',
    backgroundColor: '#FFA500',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer'
  },
  nextBtn: {
    padding: '12px 24px',
    fontSize: '14px',
    fontWeight: '600',
    backgroundColor: '#075E54',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer'
  },
  finishBtn: {
    padding: '12px 24px',
    fontSize: '14px',
    fontWeight: '600',
    backgroundColor: '#dc3545',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer'
  }
};

export default QuizHost;