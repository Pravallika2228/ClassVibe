// frontend/src/components/QuizPlayer.jsx
// Student Quiz Player with Synchronized Timer and Review Tabs

import React, { useState, useEffect, useRef } from 'react';
import socket from '../socket';

const QuizPlayer = ({ sessionId, onClose }) => {
  // Core state
  const [currentView, setCurrentView] = useState('loading'); // loading, question, answerSummary, leaderboard, finished
  // const [quizData, setQuizData] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  
  // Answer state
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [answerSummary, setAnswerSummary] = useState(null);
  
  // Timer state (synchronized from server)
  const [timeRemaining, setTimeRemaining] = useState(0);
  
  // Score tracking
  const [myScore, setMyScore] = useState(0);
  const [myAnswers, setMyAnswers] = useState([]);
  
  // Leaderboard state
  const [leaderboard, setLeaderboard] = useState([]);
  const [myRank, setMyRank] = useState(null);
  
  // Final view tabs
  const [finalTab, setFinalTab] = useState('leaderboard'); // leaderboard, review
  
  const userId = JSON.parse(localStorage.getItem('user'))?.id;

const autoSubmitRef = useRef(null);

const handleAutoSubmit = () => {
  if (hasAnswered) return;

  setHasAnswered(true);

  socket.emit('student:submitAnswer', {
    sessionId,
    questionIndex,
    selectedAnswer: selectedAnswer !== null ? selectedAnswer : -1,
    timeTaken: currentQuestion?.timeLimit || 45
  });

  console.log('⏰ Auto-submitted');
};

// store latest function in ref
useEffect(() => {
  autoSubmitRef.current = handleAutoSubmit;
});

  // ========================================
  // SOCKET EVENT LISTENERS
  // ========================================

  useEffect(() => {
    if (!socket.connected) {
      socket.connect();
    }

    // Join quiz
    socket.emit('student:joinQuiz', { sessionId });

    // Listen for quiz joined
    socket.on('quiz:joined', (data) => {
      console.log('✅ Joined quiz:', data);
      
      setTotalQuestions(data.totalQuestions);
      
      if (data.status === 'active' && data.currentQuestion) {
        // Quiz already in progress - sync with current question
        setCurrentQuestion(data.currentQuestion.question || data.currentQuestion);
        setQuestionIndex(data.currentQuestion.questionIndex);
        setTimeRemaining(data.timeRemaining);
        setCurrentView('question');
      } else {
        // Waiting for quiz to start
        setCurrentView('waiting');
      }
    });

    // Listen for quiz started
    socket.on('quiz:started', (data) => {
      console.log('🚀 Quiz started');
      setCurrentQuestion(data.question);
      setQuestionIndex(data.questionIndex);
      setTimeRemaining(data.question.timeLimit);
      setTotalQuestions(data.totalQuestions);
      setCurrentView('question');
      setSelectedAnswer(null);
      setHasAnswered(false);
    });

    // Listen for timer updates (every second from server)
    socket.on('timer:update', (data) => {
      setTimeRemaining(data.timeRemaining);
      
      // Auto-submit when time expires
      if (data.timeRemaining === 0 && !hasAnswered) {
        autoSubmitRef.current && autoSubmitRef.current();
      }
    });

    // Listen for answer summary (personal feedback)
    socket.on('answer:summary', (data) => {
      console.log('📊 Answer summary received');
      setAnswerSummary(data);
      setMyScore(data.currentScore);
      setMyAnswers(prev => [...prev, {
        questionIndex: data.questionIndex,
        questionText: data.questionText,
        options: data.options,
        selectedAnswer: data.selectedAnswer,
        correctAnswer: data.correctAnswer,
        isCorrect: data.isCorrect,
        points: data.points,
        explanation: data.explanation
      }]);
      setCurrentView('answerSummary');
    });

    // Listen for question complete (everyone's answer review)
    socket.on('question:complete', (data) => {
      console.log('✅ Question complete');
      
      // If student didn't answer, show them what they missed
      if (!hasAnswered) {
        setAnswerSummary({
          questionIndex: data.questionIndex,
          questionText: data.questionText,
          options: data.options,
          selectedAnswer: null,
          correctAnswer: data.correctAnswer,
          isCorrect: false,
          points: 0,
          explanation: data.explanation,
          currentScore: myScore
        });
        setMyAnswers(prev => [...prev, {
          questionIndex: data.questionIndex,
          questionText: data.questionText,
          options: data.options,
          selectedAnswer: null,
          correctAnswer: data.correctAnswer,
          isCorrect: false,
          points: 0,
          explanation: data.explanation
        }]);
        setCurrentView('answerSummary');
      }
    });

    // Listen for leaderboard
    socket.on('leaderboard:show', (data) => {
      console.log('🏆 Leaderboard');
      setLeaderboard(data.leaderboard);
      
      // Find my rank
      const myRankData = data.leaderboard.find(
        entry => entry.userId.toString() === userId
      );
      setMyRank(myRankData ? myRankData.rank : null);
      
      setCurrentView('leaderboard');
    });

    // Listen for next question
    socket.on('quiz:nextQuestion', (data) => {
      console.log('➡️ Next question');
      setCurrentQuestion(data.question);
      setQuestionIndex(data.questionIndex);
      setTimeRemaining(data.question.timeLimit);
      setSelectedAnswer(null);
      setHasAnswered(false);
      setAnswerSummary(null);
      setCurrentView('question');
    });

    // Listen for quiz finished
    socket.on('quiz:finished', (data) => {
      console.log('🏁 Quiz finished');
      setLeaderboard(data.leaderboard);
      const myRankData = data.leaderboard.find(
        entry => entry.userId.toString() === userId
      );
      setMyRank(myRankData ? myRankData.rank : null);
      setCurrentView('finished');
    });

    // Error handling
    socket.on('error', (data) => {
      console.error('❌ Socket error:', data.message);
      alert(data.message);
    });

    // Cleanup
    return () => {
      socket.off('quiz:joined');
      socket.off('quiz:started');
      socket.off('timer:update');
      socket.off('answer:summary');
      socket.off('question:complete');
      socket.off('leaderboard:show');
      socket.off('quiz:nextQuestion');
      socket.off('quiz:finished');
      socket.off('error');
    };
  });


  // ========================================
  // HANDLERS
  // ========================================

  const handleSubmit = () => {
    if (selectedAnswer === null) {
      alert('Please select an answer!');
      return;
    }

    setHasAnswered(true);
    const timeTaken = (currentQuestion.timeLimit || 45) - timeRemaining;

    // Submit to server
    socket.emit('student:submitAnswer', {
      sessionId,
      questionIndex,
      selectedAnswer,
      timeTaken
    });

    console.log('📤 Answer submitted');
  };



  // ========================================
  // VIEW RENDERERS
  // ========================================

  // LOADING VIEW
  if (currentView === 'loading') {
    return (
      <div style={styles.overlay}>
        <div style={styles.loadingBox}>
          <div style={styles.loadingSpinner}></div>
          <p style={styles.loadingText}>Joining quiz...</p>
        </div>
      </div>
    );
  }

  // WAITING VIEW
  if (currentView === 'waiting') {
    return (
      <div style={styles.overlay}>
        <div style={styles.container}>
          <div style={styles.waitingBox}>
            <div style={styles.waitingIcon}>⏳</div>
            <h2 style={styles.waitingTitle}>Waiting for Quiz to Start</h2>
            <p style={styles.waitingText}>
              The teacher will start the quiz soon. Stay ready!
            </p>
            <div style={styles.waitingPulse}></div>
          </div>
          <button onClick={onClose} style={styles.closeWaitingBtn}>
            Leave Quiz
          </button>
        </div>
      </div>
    );
  }

  // QUESTION VIEW
  if (currentView === 'question') {
    return (
      <div style={styles.overlay}>
        <div style={styles.container}>
          {/* Header with timer */}
          <div style={styles.header}>
            <div style={styles.progressText}>
              Question {questionIndex + 1} of {totalQuestions}
            </div>
            <div style={{
              ...styles.timer,
              backgroundColor: timeRemaining <= 10 ? '#dc3545' : '#ff9800',
              animation: timeRemaining <= 10 ? 'pulse 1s infinite' : 'none'
            }}>
              ⏱️ {timeRemaining}s
            </div>
          </div>

          {/* Question */}
          <div style={styles.questionBox}>
            <h2 style={styles.questionText}>{currentQuestion?.questionText}</h2>
            <div style={styles.questionPoints}>{currentQuestion?.points || 10} points</div>
          </div>

          {/* Options */}
          <div style={styles.optionsGrid}>
            {currentQuestion?.options.map((option, index) => {
              const isSelected = selectedAnswer === index;
              
              return (
                <button
                  key={index}
                  onClick={() => !hasAnswered && setSelectedAnswer(index)}
                  disabled={hasAnswered}
                  style={{
                    ...styles.option,
                    backgroundColor: isSelected ? '#E3F2FD' : '#fff',
                    border: isSelected ? '3px solid #2196F3' : '2px solid #e0e0e0',
                    cursor: hasAnswered ? 'not-allowed' : 'pointer',
                    opacity: hasAnswered ? 0.6 : 1
                  }}
                >
                  <div style={styles.optionLetter}>
                    {String.fromCharCode(65 + index)}
                  </div>
                  <div style={styles.optionText}>{option}</div>
                  {isSelected && (
                    <div style={styles.selectedBadge}>✓</div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Submit Button */}
          {!hasAnswered && (
            <button
              onClick={handleSubmit}
              disabled={selectedAnswer === null}
              style={{
                ...styles.submitBtn,
                opacity: selectedAnswer === null ? 0.5 : 1,
                cursor: selectedAnswer === null ? 'not-allowed' : 'pointer'
              }}
            >
              Submit Answer
            </button>
          )}

          {/* Waiting message after submit */}
          {hasAnswered && (
            <div style={styles.waitingMessage}>
              <div style={styles.waitingSpinner}></div>
              Waiting for other students...
            </div>
          )}

          {/* Current Score */}
          <div style={styles.scoreDisplay}>
            Your Score: {myScore} points
          </div>
        </div>
      </div>
    );
  }

  // ANSWER SUMMARY VIEW
  if (currentView === 'answerSummary') {
    const isCorrect = answerSummary?.isCorrect;
    
    return (
      <div style={styles.overlay}>
        <div style={styles.container}>
          {/* Result Badge */}
          <div style={{
            ...styles.resultBadge,
            backgroundColor: isCorrect ? '#D7F0DD' : '#FFEBEE',
            borderColor: isCorrect ? '#25D366' : '#F44336'
          }}>
            <div style={styles.resultIcon}>
              {isCorrect ? '✅' : '❌'}
            </div>
            <div style={styles.resultText}>
              <h2 style={{
                ...styles.resultTitle,
                color: isCorrect ? '#1B5E20' : '#C62828'
              }}>
                {isCorrect ? 'Correct!' : answerSummary?.selectedAnswer === null ? 'Time Expired!' : 'Incorrect'}
              </h2>
              <p style={styles.resultPoints}>
                {isCorrect ? `+${answerSummary?.points} points` : '+0 points'}
              </p>
            </div>
          </div>

          {/* Question Review */}
          <div style={styles.reviewBox}>
            <h3 style={styles.reviewTitle}>Question {questionIndex + 1}</h3>
            <p style={styles.reviewQuestion}>{answerSummary?.questionText}</p>

            {/* Options with correct/wrong indicators */}
            <div style={styles.reviewOptions}>
              {answerSummary?.options.map((option, index) => {
                const isThisCorrect = index === answerSummary.correctAnswer;
                const isThisSelected = index === answerSummary.selectedAnswer;
                
                return (
                  <div
                    key={index}
                    style={{
                      ...styles.reviewOption,
                      backgroundColor: isThisCorrect ? '#E8F5E9' : isThisSelected ? '#FFEBEE' : '#f5f5f5',
                      border: isThisCorrect ? '2px solid #4CAF50' : isThisSelected ? '2px solid #F44336' : '1px solid #ddd'
                    }}
                  >
                    <div style={styles.reviewOptionLetter}>
                      {String.fromCharCode(65 + index)}
                    </div>
                    <div style={styles.reviewOptionText}>{option}</div>
                    {isThisCorrect && (
                      <div style={styles.correctBadge}>✓ Correct Answer</div>
                    )}
                    {isThisSelected && !isThisCorrect && (
                      <div style={styles.wrongBadge}>Your Answer</div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Explanation */}
            <div style={styles.explanationBox}>
              <div style={styles.explanationTitle}>💡 Explanation:</div>
              <p style={styles.explanationText}>{answerSummary?.explanation}</p>
            </div>

            {/* Score Update */}
            <div style={styles.scoreUpdate}>
              Your Total Score: <strong>{answerSummary?.currentScore} points</strong>
            </div>
          </div>

          {/* Wait message */}
          <div style={styles.waitNextMessage}>
            <div style={styles.waitSpinner}></div>
            Showing leaderboard next...
          </div>
        </div>
      </div>
    );
  }

  // LEADERBOARD VIEW (between questions)
  if (currentView === 'leaderboard') {
    return (
      <div style={styles.overlay}>
        <div style={styles.container}>
          <div style={styles.leaderboardHeader}>
            <h2 style={styles.leaderboardTitle}>🏆 Leaderboard</h2>
            <p style={styles.leaderboardSubtitle}>
              After Question {questionIndex + 1} of {totalQuestions}
            </p>
          </div>

          <div style={styles.leaderboardList}>
            {leaderboard.slice(0, 10).map((entry, index) => {
              const isMe = entry.userId.toString() === userId;
              
              return (
                <div
                  key={index}
                  style={{
                    ...styles.leaderboardItem,
                    backgroundColor: isMe ? '#FFF9C4' : '#fff',
                    border: isMe ? '2px solid #FBC02D' : '1px solid #e0e0e0'
                  }}
                >
                  <div style={styles.leaderboardRank}>
                    {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`}
                  </div>
                  <div style={styles.leaderboardName}>
                    {isMe ? 'You' : `Student ${entry.userId.substring(0, 6)}`}
                  </div>
                  <div style={styles.leaderboardStats}>
                    <span style={styles.leaderboardScore}>{entry.score} pts</span>
                    <span style={styles.leaderboardCorrect}>
                      {entry.correctAnswers}/{entry.totalAnswers} correct
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={styles.waitNextMessage}>
            <div style={styles.waitSpinner}></div>
            {questionIndex < totalQuestions - 1 ? 'Next question coming up...' : 'Calculating final results...'}
          </div>
        </div>
      </div>
    );
  }

  // FINISHED VIEW (Two Tabs: Leaderboard + My Review)
  if (currentView === 'finished') {
    return (
      <div style={styles.overlay}>
        <div style={styles.finishedContainer}>
          {/* Header */}
          <div style={styles.finishedHeader}>
            <h2 style={styles.finishedTitle}>🎉 Quiz Complete!</h2>
            <button onClick={onClose} style={styles.finishedCloseBtn}>✕</button>
          </div>

          {/* Tabs */}
          <div style={styles.tabsContainer}>
            <button
              onClick={() => setFinalTab('leaderboard')}
              style={{
                ...styles.tab,
                ...(finalTab === 'leaderboard' ? styles.tabActive : {})
              }}
            >
              🏆 Final Leaderboard
            </button>
            <button
              onClick={() => setFinalTab('review')}
              style={{
                ...styles.tab,
                ...(finalTab === 'review' ? styles.tabActive : {})
              }}
            >
              📊 My Review
            </button>
          </div>

          {/* Tab Content */}
          <div style={styles.tabContent}>
            {finalTab === 'leaderboard' && (
              <div style={styles.leaderboardTab}>
                {/* My Position Card */}
                {myRank && (
                  <div style={styles.myPositionCard}>
                    <div style={styles.myPositionRank}>
                      {myRank === 1 ? '🥇' : myRank === 2 ? '🥈' : myRank === 3 ? '🥉' : `#${myRank}`}
                    </div>
                    <div style={styles.myPositionInfo}>
                      <div style={styles.myPositionTitle}>Your Rank</div>
                      <div style={styles.myPositionScore}>{myScore} points</div>
                      <div style={styles.myPositionStats}>
                        {myAnswers.filter(a => a.isCorrect).length}/{myAnswers.length} correct
                      </div>
                    </div>
                  </div>
                )}

                {/* Full Leaderboard */}
                <div style={styles.finalLeaderboardList}>
                  {leaderboard.map((entry, index) => {
                    const isMe = entry.userId.toString() === userId;
                    
                    return (
                      <div
                        key={index}
                        style={{
                          ...styles.finalLeaderboardItem,
                          backgroundColor: isMe ? '#FFF9C4' : '#fff',
                          border: isMe ? '2px solid #FBC02D' : '1px solid #e0e0e0'
                        }}
                      >
                        <div style={styles.finalRank}>
                          {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : `#${entry.rank}`}
                        </div>
                        <div style={styles.finalName}>
                          {isMe ? 'You' : `Student ${entry.userId.substring(0, 6)}`}
                        </div>
                        <div style={styles.finalStats}>
                          <div style={styles.finalScore}>{entry.score} pts</div>
                          <div style={styles.finalCorrect}>
                            {entry.correctAnswers}/{entry.totalAnswers} correct
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {finalTab === 'review' && (
              <div style={styles.reviewTab}>
                {/* Summary Stats */}
                <div style={styles.reviewSummary}>
                  <div style={styles.summaryCard}>
                    <div style={styles.summaryNumber}>{myScore}</div>
                    <div style={styles.summaryLabel}>Total Points</div>
                  </div>
                  <div style={styles.summaryCard}>
                    <div style={styles.summaryNumber}>
                      {myAnswers.filter(a => a.isCorrect).length}
                    </div>
                    <div style={styles.summaryLabel}>Correct Answers</div>
                  </div>
                  <div style={styles.summaryCard}>
                    <div style={styles.summaryNumber}>
                      {Math.round((myAnswers.filter(a => a.isCorrect).length / myAnswers.length) * 100)}%
                    </div>
                    <div style={styles.summaryLabel}>Accuracy</div>
                  </div>
                </div>

                {/* Question-by-Question Review */}
                <div style={styles.questionReviewList}>
                  {myAnswers.map((answer, index) => (
                    <div key={index} style={styles.questionReviewCard}>
                      <div style={styles.questionReviewHeader}>
                        <span style={styles.questionReviewNumber}>Q{answer.questionIndex + 1}</span>
                        <span style={{
                          ...styles.questionReviewBadge,
                          backgroundColor: answer.isCorrect ? '#D7F0DD' : '#FFEBEE',
                          color: answer.isCorrect ? '#1B5E20' : '#C62828'
                        }}>
                          {answer.isCorrect ? '✓ Correct' : '✗ Wrong'}
                        </span>
                        <span style={styles.questionReviewPoints}>
                          {answer.points} pts
                        </span>
                      </div>

                      <p style={styles.questionReviewText}>{answer.questionText}</p>

                      <div style={styles.questionReviewOptions}>
                        {answer.options.map((option, optIndex) => {
                          const isCorrect = optIndex === answer.correctAnswer;
                          const isSelected = optIndex === answer.selectedAnswer;
                          
                          return (
                            <div
                              key={optIndex}
                              style={{
                                ...styles.questionReviewOption,
                                backgroundColor: isCorrect ? '#E8F5E9' : isSelected ? '#FFEBEE' : '#f9f9f9',
                                border: isCorrect ? '2px solid #4CAF50' : isSelected ? '2px solid #F44336' : '1px solid #e0e0e0'
                              }}
                            >
                              <span style={styles.questionReviewOptionLetter}>
                                {String.fromCharCode(65 + optIndex)}
                              </span>
                              <span style={styles.questionReviewOptionText}>{option}</span>
                              {isCorrect && <span style={styles.correctTag}>✓</span>}
                              {isSelected && !isCorrect && <span style={styles.wrongTag}>✗</span>}
                            </div>
                          );
                        })}
                      </div>

                      <div style={styles.questionReviewExplanation}>
                        <strong>Explanation:</strong> {answer.explanation}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={styles.finishedFooter}>
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
    backgroundColor: 'rgba(0,0,0,0.95)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3000,
    padding: '20px'
  },
  loadingBox: {
    textAlign: 'center',
    color: 'white'
  },
  loadingSpinner: {
    width: '50px',
    height: '50px',
    border: '4px solid rgba(255,255,255,0.3)',
    borderTop: '4px solid white',
    borderRadius: '50%',
    margin: '0 auto 20px',
    animation: 'spin 1s linear infinite'
  },
  loadingText: {
    fontSize: '18px'
  },
  container: {
    backgroundColor: 'white',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '700px',
    maxHeight: '90vh',
    overflow: 'auto',
    padding: '30px',
    position: 'relative'
  },
  waitingBox: {
    textAlign: 'center',
    padding: '60px 20px'
  },
  waitingIcon: {
    fontSize: '80px',
    marginBottom: '20px',
    animation: 'bounce 2s infinite'
  },
  waitingTitle: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: '15px'
  },
  waitingText: {
    fontSize: '16px',
    color: '#666',
    marginBottom: '30px'
  },
  waitingPulse: {
    width: '60px',
    height: '60px',
    borderRadius: '50%',
    backgroundColor: '#4F46E5',
    margin: '0 auto',
    animation: 'pulse 2s infinite'
  },
  closeWaitingBtn: {
    padding: '12px 32px',
    fontSize: '15px',
    fontWeight: '600',
    backgroundColor: '#f0f0f0',
    color: '#333',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    marginTop: '20px'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '25px',
    paddingBottom: '20px',
    borderBottom: '2px solid #f0f0f0'
  },
  progressText: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#4F46E5'
  },
  timer: {
    padding: '10px 20px',
    borderRadius: '25px',
    fontSize: '20px',
    fontWeight: '700',
    color: 'white',
    minWidth: '100px',
    textAlign: 'center'
  },
  questionBox: {
    marginBottom: '30px'
  },
  questionText: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#1a1a1a',
    lineHeight: '1.4',
    marginBottom: '12px'
  },
  questionPoints: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#25D366'
  },
  optionsGrid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
    marginBottom: '25px'
  },
  option: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    padding: '18px',
    borderRadius: '12px',
    transition: 'all 0.2s',
    position: 'relative'
  },
  optionLetter: {
    width: '45px',
    height: '45px',
    borderRadius: '50%',
    backgroundColor: '#4F46E5',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '20px',
    fontWeight: '700',
    flexShrink: 0
  },
  optionText: {
    flex: 1,
    fontSize: '17px',
    color: '#333',
    fontWeight: '500'
  },
  selectedBadge: {
    width: '30px',
    height: '30px',
    borderRadius: '50%',
    backgroundColor: '#4CAF50',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    fontWeight: '700'
  },
  submitBtn: {
    width: '100%',
    padding: '18px',
    fontSize: '18px',
    fontWeight: '700',
    backgroundColor: '#25D366',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    transition: 'all 0.2s',
    boxShadow: '0 4px 12px rgba(37, 211, 102, 0.3)'
  },
  waitingMessage: {
    textAlign: 'center',
    padding: '20px',
    fontSize: '16px',
    color: '#666',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px'
  },
  waitingSpinner: {
    width: '20px',
    height: '20px',
    border: '3px solid #f0f0f0',
    borderTop: '3px solid #4F46E5',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  scoreDisplay: {
    textAlign: 'center',
    marginTop: '20px',
    padding: '15px',
    backgroundColor: '#F3F4F6',
    borderRadius: '10px',
    fontSize: '16px',
    fontWeight: '600',
    color: '#1a1a1a'
  },
  
  // Answer Summary Styles
  resultBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    padding: '25px',
    borderRadius: '16px',
    marginBottom: '25px',
    border: '3px solid'
  },
  resultIcon: {
    fontSize: '60px'
  },
  resultText: {
    flex: 1
  },
  resultTitle: {
    fontSize: '28px',
    fontWeight: '700',
    margin: '0 0 8px 0'
  },
  resultPoints: {
    fontSize: '18px',
    fontWeight: '600',
    margin: 0
  },
  reviewBox: {
    backgroundColor: '#f9f9f9',
    padding: '25px',
    borderRadius: '12px',
    marginBottom: '20px'
  },
  reviewTitle: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#4F46E5',
    marginBottom: '10px'
  },
  reviewQuestion: {
    fontSize: '20px',
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: '20px',
    lineHeight: '1.4'
  },
  reviewOptions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '20px'
  },
  reviewOption: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    padding: '15px',
    borderRadius: '10px',
    position: 'relative'
  },
  reviewOptionLetter: {
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
  reviewOptionText: {
    flex: 1,
    fontSize: '16px',
    color: '#333',
    fontWeight: '500'
  },
  correctBadge: {
    padding: '5px 12px',
    backgroundColor: '#4CAF50',
    color: 'white',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '700'
  },
  wrongBadge: {
    padding: '5px 12px',
    backgroundColor: '#F44336',
    color: 'white',
    borderRadius: '20px',
    fontSize: '12px',
    fontWeight: '700'
  },
  explanationBox: {
    padding: '18px',
    backgroundColor: 'white',
    borderRadius: '10px',
    border: '1px solid #e0e0e0',
    marginBottom: '15px'
  },
  explanationTitle: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#4F46E5',
    marginBottom: '8px'
  },
  explanationText: {
    fontSize: '15px',
    color: '#333',
    lineHeight: '1.5',
    margin: 0
  },
  scoreUpdate: {
    textAlign: 'center',
    fontSize: '18px',
    fontWeight: '600',
    color: '#1a1a1a'
  },
  waitNextMessage: {
    textAlign: 'center',
    padding: '20px',
    fontSize: '15px',
    color: '#666',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px'
  },
  waitSpinner: {
    width: '16px',
    height: '16px',
    border: '2px solid #f0f0f0',
    borderTop: '2px solid #4F46E5',
    borderRadius: '50%',
    animation: 'spin 1s linear infinite'
  },
  
  // Leaderboard Styles
  leaderboardHeader: {
    textAlign: 'center',
    marginBottom: '25px'
  },
  leaderboardTitle: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: '8px'
  },
  leaderboardSubtitle: {
    fontSize: '14px',
    color: '#666',
    margin: 0
  },
  leaderboardList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '25px'
  },
  leaderboardItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    padding: '15px',
    borderRadius: '10px'
  },
  leaderboardRank: {
    fontSize: '24px',
    fontWeight: '700',
    minWidth: '50px',
    textAlign: 'center'
  },
  leaderboardName: {
    flex: 1,
    fontSize: '16px',
    fontWeight: '600',
    color: '#333'
  },
  leaderboardStats: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '4px'
  },
  leaderboardScore: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#4F46E5'
  },
  leaderboardCorrect: {
    fontSize: '12px',
    color: '#666'
  },
  
  // Finished View Styles
  finishedContainer: {
    backgroundColor: 'white',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '900px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  finishedHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '25px 30px',
    borderBottom: '2px solid #f0f0f0',
    backgroundColor: '#4F46E5'
  },
  finishedTitle: {
    fontSize: '24px',
    fontWeight: '700',
    color: 'white',
    margin: 0
  },
  finishedCloseBtn: {
    background: 'none',
    border: 'none',
    fontSize: '28px',
    color: 'white',
    cursor: 'pointer',
    padding: '0 10px'
  },
  tabsContainer: {
    display: 'flex',
    borderBottom: '2px solid #f0f0f0',
    backgroundColor: '#fafafa'
  },
  tab: {
    flex: 1,
    padding: '18px',
    border: 'none',
    background: 'none',
    fontSize: '16px',
    fontWeight: '600',
    color: '#666',
    cursor: 'pointer',
    borderBottom: '3px solid transparent',
    transition: 'all 0.2s'
  },
  tabActive: {
    color: '#4F46E5',
    borderBottomColor: '#4F46E5',
    backgroundColor: 'white'
  },
  tabContent: {
    flex: 1,
    overflowY: 'auto',
    padding: '30px'
  },
  leaderboardTab: {
    display: 'flex',
    flexDirection: 'column',
    gap: '25px'
  },
  myPositionCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    padding: '25px',
    backgroundColor: '#FFF9C4',
    borderRadius: '12px',
    border: '3px solid #FBC02D'
  },
  myPositionRank: {
    fontSize: '48px',
    fontWeight: '700'
  },
  myPositionInfo: {
    flex: 1
  },
  myPositionTitle: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#666',
    marginBottom: '5px'
  },
  myPositionScore: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: '5px'
  },
  myPositionStats: {
    fontSize: '14px',
    color: '#666'
  },
  finalLeaderboardList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px'
  },
  finalLeaderboardItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    padding: '18px',
    borderRadius: '10px'
  },
  finalRank: {
    fontSize: '28px',
    fontWeight: '700',
    minWidth: '60px',
    textAlign: 'center'
  },
  finalName: {
    flex: 1,
    fontSize: '17px',
    fontWeight: '600',
    color: '#333'
  },
  finalStats: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: '5px'
  },
  finalScore: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#4F46E5'
  },
  finalCorrect: {
    fontSize: '13px',
    color: '#666'
  },
  reviewTab: {},
  reviewSummary: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '20px',
    marginBottom: '30px'
  },
  summaryCard: {
    textAlign: 'center',
    padding: '25px',
    backgroundColor: '#f9f9f9',
    borderRadius: '12px',
    border: '2px solid #e0e0e0'
  },
  summaryNumber: {
    fontSize: '36px',
    fontWeight: '700',
    color: '#4F46E5',
    marginBottom: '8px'
  },
  summaryLabel: {
    fontSize: '14px',
    color: '#666',
    fontWeight: '600'
  },
  questionReviewList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  questionReviewCard: {
    backgroundColor: '#f9f9f9',
    padding: '20px',
    borderRadius: '12px',
    border: '1px solid #e0e0e0'
  },
  questionReviewHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '15px'
  },
  questionReviewNumber: {
    padding: '6px 14px',
    backgroundColor: '#4F46E5',
    color: 'white',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: '700'
  },
  questionReviewBadge: {
    padding: '6px 14px',
    borderRadius: '20px',
    fontSize: '13px',
    fontWeight: '700'
  },
  questionReviewPoints: {
    marginLeft: 'auto',
    fontSize: '14px',
    fontWeight: '700',
    color: '#25D366'
  },
  questionReviewText: {
    fontSize: '17px',
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: '15px',
    lineHeight: '1.4'
  },
  questionReviewOptions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginBottom: '15px'
  },
  questionReviewOption: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px',
    borderRadius: '8px'
  },
  questionReviewOptionLetter: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: '#4F46E5',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px',
    fontWeight: '700',
    flexShrink: 0
  },
  questionReviewOptionText: {
    flex: 1,
    fontSize: '15px',
    color: '#333'
  },
  correctTag: {
    fontSize: '20px',
    color: '#4CAF50'
  },
  wrongTag: {
    fontSize: '20px',
    color: '#F44336'
  },
  questionReviewExplanation: {
    padding: '15px',
    backgroundColor: 'white',
    borderRadius: '8px',
    fontSize: '14px',
    color: '#333',
    lineHeight: '1.5',
    border: '1px solid #e0e0e0'
  },
  finishedFooter: {
    padding: '25px 30px',
    borderTop: '2px solid #f0f0f0',
    textAlign: 'center'
  },
  doneBtn: {
    padding: '15px 50px',
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

// Add keyframe animations
const styleSheet = document.styleSheets[0];
styleSheet.insertRule(`
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`, styleSheet.cssRules.length);

styleSheet.insertRule(`
  @keyframes pulse {
    0%, 100% { transform: scale(1); opacity: 1; }
    50% { transform: scale(1.05); opacity: 0.8; }
  }
`, styleSheet.cssRules.length);

styleSheet.insertRule(`
  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-20px); }
  }
`, styleSheet.cssRules.length);

export default QuizPlayer;