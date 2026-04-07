// frontend/src/components/QuizPlayer.jsx
// Complete Quiz Player with ALL Question Types Support

import React, { useState, useEffect, useRef } from 'react';
import socket from '../socket';

const QuizPlayer = ({ sessionId, onClose }) => {
  // Core state
  const [currentView, setCurrentView] = useState('loading');
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  
  // Answer state
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [selectedAnswers, setSelectedAnswers] = useState([]); // For multiple_select
  const [textAnswer, setTextAnswer] = useState(''); // For fill_in_blank
  const [hasAnswered, setHasAnswered] = useState(false);
  const [answerSummary, setAnswerSummary] = useState(null);
  
  // Timer state
  const [timeRemaining, setTimeRemaining] = useState(0);
  
  // Score & streak tracking
  const [myScore, setMyScore] = useState(0);
  const [myStreak, setMyStreak] = useState(0);
  const [speedMultiplier, setSpeedMultiplier] = useState(1.0);
  const [myAnswers, setMyAnswers] = useState([]);
  
  // Leaderboard state
  const [leaderboard, setLeaderboard] = useState([]);
  const [myRank, setMyRank] = useState(null);
  
  // Final view tabs
  const [finalTab, setFinalTab] = useState('leaderboard');
  
  const userId = JSON.parse(localStorage.getItem('user'))?.id;
  const autoSubmitRef = useRef(null);

  // Auto-submit handler
  const handleAutoSubmit = () => {
    if (hasAnswered) return;

    setHasAnswered(true);

    let finalAnswer;
    const questionType = currentQuestion?.questionType || 'multiple_choice';

    if (questionType === 'fill_in_blank') {
      finalAnswer = textAnswer.trim();
    } else if (questionType === 'multiple_select') {
      finalAnswer = selectedAnswers.length > 0 ? selectedAnswers : [];
    } else {
      finalAnswer = selectedAnswer !== null ? selectedAnswer : -1;
    }

    socket.emit('student:submitAnswer', {
      sessionId,
      questionIndex,
      selectedAnswer: finalAnswer,
      timeTaken: currentQuestion?.timeLimit || 45
    });

    console.log('⏰ Auto-submitted:', finalAnswer);
  };

  // Store latest function in ref
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

    socket.emit('student:joinQuiz', { sessionId });

    socket.on('quiz:joined', (data) => {
      console.log('✅ Joined quiz:', data);
      setTotalQuestions(data.totalQuestions);
      
      if (data.status === 'active' && data.currentQuestion) {
        setCurrentQuestion(data.currentQuestion.question || data.currentQuestion);
        setQuestionIndex(data.currentQuestion.questionIndex);
        setTimeRemaining(data.timeRemaining);
        setCurrentView('question');
      } else {
        setCurrentView('waiting');
      }
    });

    socket.on('quiz:started', (data) => {
      console.log('🚀 Quiz started');
      setCurrentQuestion(data.question);
      setQuestionIndex(data.questionIndex);
      setTimeRemaining(data.question.timeLimit);
      setTotalQuestions(data.totalQuestions);
      setCurrentView('question');
      resetAnswerState();
    });

    socket.on('timer:update', (data) => {
      setTimeRemaining(data.timeRemaining);
      
      if (data.timeRemaining === 0 && !hasAnswered) {
        autoSubmitRef.current && autoSubmitRef.current();
      }
    });

    socket.on('answer:summary', (data) => {
      console.log('📊 Answer summary received');
      setAnswerSummary(data);
      setMyScore(data.currentScore);
      setMyStreak(data.streak || 0); // ✅ Update streak
      setSpeedMultiplier(data.speedMultiplier || 1.0); // ✅ Update speed multiplier
      setMyAnswers(prev => [...prev, {
        questionIndex: data.questionIndex,
        questionText: data.questionText,
        questionType: data.questionType,
        options: data.options,
        selectedAnswer: data.selectedAnswer,
        correctAnswer: data.correctAnswer,
        isCorrect: data.isCorrect,
        points: data.points,
        explanation: data.explanation
      }]);
      setCurrentView('answerSummary');
    });

    socket.on('question:complete', (data) => {
      console.log('✅ Question complete');
      
      if (!hasAnswered) {
        setAnswerSummary({
          questionIndex: data.questionIndex,
          questionText: data.questionText,
          questionType: data.questionType,
          options: data.options,
          selectedAnswer: null,
          correctAnswer: data.correctAnswer,
          isCorrect: false,
          points: 0,
          explanation: data.explanation,
          currentScore: myScore,
          streak: 0
        });
        setMyStreak(0);
        setMyAnswers(prev => [...prev, {
          questionIndex: data.questionIndex,
          questionText: data.questionText,
          questionType: data.questionType,
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

    socket.on('leaderboard:show', (data) => {
      console.log('🏆 Leaderboard');
      setLeaderboard(data.leaderboard);
      
      const myRankData = data.leaderboard.find(
        entry => entry.userId.toString() === userId
      );
      setMyRank(myRankData ? myRankData.rank : null);
      
      setCurrentView('leaderboard');
    });

    socket.on('quiz:nextQuestion', (data) => {
      console.log('➡️ Next question');
      setCurrentQuestion(data.question);
      setQuestionIndex(data.questionIndex);
      setTimeRemaining(data.question.timeLimit);
      resetAnswerState();
      setCurrentView('question');
    });

    socket.on('quiz:finished', (data) => {
      console.log('🏁 Quiz finished');
      setLeaderboard(data.leaderboard);
      const myRankData = data.leaderboard.find(
        entry => entry.userId.toString() === userId
      );
      setMyRank(myRankData ? myRankData.rank : null);
      setCurrentView('finished');
    });

    socket.on('error', (data) => {
      console.error('❌ Socket error:', data.message);
      alert(data.message);
    });

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
  // HELPER FUNCTIONS
  // ========================================

  const resetAnswerState = () => {
    setSelectedAnswer(null);
    setSelectedAnswers([]);
    setTextAnswer('');
    setHasAnswered(false);
    setAnswerSummary(null);
  };

  const handleSubmit = () => {
    const questionType = currentQuestion?.questionType || 'multiple_choice';
    let finalAnswer;

    // Validate based on question type
    if (questionType === 'fill_in_blank') {
      if (!textAnswer.trim()) {
        alert('Please type your answer!');
        return;
      }
      finalAnswer = textAnswer.trim();
    } else if (questionType === 'multiple_select') {
      if (selectedAnswers.length === 0) {
        alert('Please select at least one answer!');
        return;
      }
      finalAnswer = selectedAnswers;
    } else {
      if (selectedAnswer === null) {
        alert('Please select an answer!');
        return;
      }
      finalAnswer = selectedAnswer;
    }

    setHasAnswered(true);
    const timeTaken = (currentQuestion.timeLimit || 45) - timeRemaining;

    socket.emit('student:submitAnswer', {
      sessionId,
      questionIndex,
      selectedAnswer: finalAnswer,
      timeTaken
    });

    console.log('📤 Answer submitted:', finalAnswer);
  };

  const handleMultipleSelectToggle = (index) => {
    if (hasAnswered) return;
    
    setSelectedAnswers(prev => {
      if (prev.includes(index)) {
        return prev.filter(i => i !== index);
      } else {
        return [...prev, index];
      }
    });
  };

  // ========================================
  // RENDER FUNCTIONS
  // ========================================

  const renderQuestionInput = () => {
    const questionType = currentQuestion?.questionType || 'multiple_choice';

    // ✅ FILL IN THE BLANK - Text Input
    if (questionType === 'fill_in_blank') {
      return (
        <div style={styles.fillInBlankContainer}>
          <input
            type="text"
            value={textAnswer}
            onChange={(e) => !hasAnswered && setTextAnswer(e.target.value)}
            placeholder="Type your answer here..."
            disabled={hasAnswered}
            style={{
              ...styles.fillInBlankInput,
              opacity: hasAnswered ? 0.6 : 1,
              cursor: hasAnswered ? 'not-allowed' : 'text'
            }}
            autoFocus
          />
          {textAnswer && (
            <div style={styles.characterCount}>
              {textAnswer.length} characters
            </div>
          )}
        </div>
      );
    }

    // ✅ MULTIPLE SELECT - Checkboxes
    if (questionType === 'multiple_select') {
      return (
        <div style={styles.optionsGrid}>
          <div style={styles.multiSelectHint}>
            ℹ️ Select all correct answers
          </div>
          {currentQuestion?.options.map((option, index) => {
            const isSelected = selectedAnswers.includes(index);
            
            return (
              <div
                key={index}
                onClick={() => handleMultipleSelectToggle(index)}
                style={{
                  ...styles.option,
                  backgroundColor: isSelected ? '#E3F2FD' : '#fff',
                  border: isSelected ? '3px solid #2196F3' : '2px solid #e0e0e0',
                  cursor: hasAnswered ? 'not-allowed' : 'pointer',
                  opacity: hasAnswered ? 0.6 : 1
                }}
              >
                <div style={{
                  ...styles.checkbox,
                  backgroundColor: isSelected ? '#2196F3' : 'white',
                  border: isSelected ? '2px solid #2196F3' : '2px solid #999'
                }}>
                  {isSelected && <span style={styles.checkmark}>✓</span>}
                </div>
                <div style={styles.optionLetter}>
                  {String.fromCharCode(65 + index)}
                </div>
                <div style={styles.optionText}>{option}</div>
              </div>
            );
          })}
        </div>
      );
    }

    // ✅ TRUE/FALSE or MULTIPLE CHOICE - Radio Buttons
    return (
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
    );
  };

  // ========================================
  // VIEW RENDERERS
  // ========================================

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

  if (currentView === 'question') {
    const questionType = currentQuestion?.questionType || 'multiple_choice';
    const questionTypeLabel = {
      'multiple_choice': 'Multiple Choice',
      'fill_in_blank': 'Fill in the Blank',
      'true_false': 'True/False',
      'multiple_select': 'Multiple Select'
    }[questionType];

    return (
      <div style={styles.overlay}>
        <div style={styles.container}>
          {/* Header with timer and streak */}
          <div style={styles.header}>
            <div style={styles.headerLeft}>
              <div style={styles.progressText}>
                Question {questionIndex + 1} of {totalQuestions}
              </div>
              <div style={styles.questionTypeBadge}>
                {questionTypeLabel}
              </div>
            </div>
            <div style={styles.headerRight}>
              {/* ✅ Streak Display */}
              {myStreak > 0 && (
                <div style={styles.streakDisplay}>
                  🔥 {myStreak}
                </div>
              )}
              {/* Timer */}
              <div style={{
                ...styles.timer,
                backgroundColor: timeRemaining <= 10 ? '#dc3545' : '#ff9800',
                animation: timeRemaining <= 10 ? 'pulse 1s infinite' : 'none'
              }}>
                ⏱️ {timeRemaining}s
              </div>
            </div>
          </div>

          {/* Question */}
          <div style={styles.questionBox}>
            <h2 style={styles.questionText}>{currentQuestion?.questionText}</h2>
            <div style={styles.questionPoints}>{currentQuestion?.points || 10} points</div>
          </div>

          {/* Render appropriate input based on question type */}
          {renderQuestionInput()}

          {/* Submit Button */}
          {!hasAnswered && (
            <button
              onClick={handleSubmit}
              style={styles.submitBtn}
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

          {/* Current Score and Streak */}
          <div style={styles.scoreDisplay}>
            <div>Score: {myScore} points</div>
            {myStreak > 0 && (
              <div style={styles.streakText}>🔥 {myStreak} streak!</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Answer Summary View
  if (currentView === 'answerSummary') {
    const isCorrect = answerSummary?.isCorrect;
    const questionType = answerSummary?.questionType || 'multiple_choice';
    
    return (
      <div style={styles.overlay}>
        <div style={styles.container}>
          {/* Result Badge with Speed Multiplier */}
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
                {isCorrect && speedMultiplier > 1 && (
                  <span style={styles.multiplierBadge}>⚡ {speedMultiplier}x</span>
                )}
              </p>
              {/* ✅ Streak Display */}
              {myStreak > 0 && (
                <p style={styles.streakBadge}>🔥 {myStreak} streak!</p>
              )}
            </div>
          </div>

          {/* Question Review */}
          <div style={styles.reviewBox}>
            <h3 style={styles.reviewTitle}>Question {questionIndex + 1}</h3>
            <p style={styles.reviewQuestion}>{answerSummary?.questionText}</p>

            {/* Render answer review based on question type */}
            {questionType === 'fill_in_blank' ? (
              <div style={styles.fillInBlankReview}>
                <div style={styles.reviewLabel}>Your Answer:</div>
                <div style={{
                  ...styles.fillInBlankAnswer,
                  backgroundColor: isCorrect ? '#E8F5E9' : '#FFEBEE',
                  color: isCorrect ? '#1B5E20' : '#C62828'
                }}>
                  {answerSummary?.selectedAnswer || '(No answer)'}
                </div>
                <div style={styles.reviewLabel}>Correct Answer:</div>
                <div style={styles.fillInBlankAnswer}>
                  {answerSummary?.correctAnswer}
                </div>
              </div>
            ) : questionType === 'multiple_select' ? (
              <div style={styles.reviewOptions}>
                {answerSummary?.options.map((option, index) => {
                  const isThisCorrect = Array.isArray(answerSummary.correctAnswer) && 
                                       answerSummary.correctAnswer.includes(index);
                  const isThisSelected = Array.isArray(answerSummary.selectedAnswer) && 
                                        answerSummary.selectedAnswer.includes(index);
                  
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
                        <div style={styles.correctBadge}>✓ Correct</div>
                      )}
                      {isThisSelected && !isThisCorrect && (
                        <div style={styles.wrongBadge}>Your Choice</div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
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
            )}

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

          <div style={styles.waitNextMessage}>
            <div style={styles.waitSpinner}></div>
            Showing leaderboard next...
          </div>
        </div>
      </div>
    );
  }

  // Leaderboard and Finished views remain the same as before...
  // (I'll skip these for brevity, but they should be included from the original file)

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
  headerLeft: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  progressText: {
    fontSize: '15px',
    fontWeight: '600',
    color: '#4F46E5'
  },
  questionTypeBadge: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#666',
    backgroundColor: '#f0f0f0',
    padding: '4px 10px',
    borderRadius: '12px',
    display: 'inline-block'
  },
  streakDisplay: {
    padding: '8px 16px',
    borderRadius: '20px',
    fontSize: '16px',
    fontWeight: '700',
    backgroundColor: '#FFA500',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
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
  
  // ✅ Fill in Blank Styles
  fillInBlankContainer: {
    marginBottom: '25px'
  },
  fillInBlankInput: {
    width: '100%',
    padding: '18px 20px',
    fontSize: '18px',
    border: '3px solid #4F46E5',
    borderRadius: '12px',
    outline: 'none',
    fontFamily: 'inherit'
  },
  characterCount: {
    marginTop: '8px',
    fontSize: '12px',
    color: '#666',
    textAlign: 'right'
  },
  
  // ✅ Multiple Select Styles
  multiSelectHint: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#4F46E5',
    marginBottom: '12px',
    padding: '10px',
    backgroundColor: '#E3F2FD',
    borderRadius: '8px',
    textAlign: 'center'
  },
  checkbox: {
    width: '28px',
    height: '28px',
    borderRadius: '6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'all 0.2s'
  },
  checkmark: {
    color: 'white',
    fontSize: '18px',
    fontWeight: '700'
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
    cursor: 'pointer',
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
    color: '#1a1a1a',
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center'
  },
  streakText: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#FFA500'
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
  multiplierBadge: {
    marginLeft: '10px',
    padding: '4px 12px',
    backgroundColor: '#FFA500',
    color: 'white',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: '700'
  },
  streakBadge: {
    fontSize: '16px',
    fontWeight: '700',
    color: '#FFA500',
    marginTop: '8px'
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
  
  // Fill in Blank Review
  fillInBlankReview: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '20px'
  },
  reviewLabel: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#666'
  },
  fillInBlankAnswer: {
    padding: '15px 20px',
    borderRadius: '10px',
    fontSize: '18px',
    fontWeight: '600',
    border: '2px solid #e0e0e0'
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
  }
};

// Add keyframe animations
const styleSheet = document.styleSheets[0];
if (styleSheet) {
  try {
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
  } catch (e) {
    console.log('Animations already defined');
  }
}

export default QuizPlayer;