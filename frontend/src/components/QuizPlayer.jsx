// frontend/src/components/QuizPlayer.jsx
import React, { useState, useEffect, useCallback } from 'react';
import Leaderboard from './Leaderboard';

const QuizPlayer = ({ sessionId, onClose }) => {
  const [session, setSession] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [timeLeft, setTimeLeft] = useState(30);
  const [hasAnswered, setHasAnswered] = useState(false);
  const [result, setResult] = useState(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [myStats, setMyStats] = useState({ score: 0, rank: null });
  const [loading, setLoading] = useState(true);


const joinQuiz = useCallback(async () => {
  try {
    const token = localStorage.getItem('token');
    const response = await fetch(
      `${process.env.REACT_APP_API_URL}/api/quiz/session/${sessionId}/join`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      }
    );

    if (response.ok) {
      const data = await response.json();
      setSession(data.session);
      setQuiz(data.session.quiz);
      setCurrentQuestion(data.session.quiz.questions[data.session.currentQuestionIndex]);
      setLoading(false);
    }
  } catch (error) {
    console.error('Join error:', error);
  }
}, [sessionId]);

useEffect(() => {
  joinQuiz();
  setupSocketListeners();

  return () => {
    // cleanup if needed
  };
}, [joinQuiz]);

  const setupSocketListeners = () => {
    // Listen for next question
    // Listen for quiz ended
    // Listen for leaderboard updates
  };


const handleSubmit = useCallback(async () => {
  if (selectedAnswer === null) {
    alert('Please select an answer');
    return;
  }

  setHasAnswered(true);
  const timeTaken = 30 - timeLeft;

  try {
    const token = localStorage.getItem('token');
    const response = await fetch(
      `${process.env.REACT_APP_API_URL}/api/quiz/session/${sessionId}/answer`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          questionIndex: session.currentQuestionIndex,
          selectedAnswer,
          timeTaken
        })
      }
    );

    const data = await response.json();
    setResult(data);
    setMyStats(prev => ({ ...prev, score: data.currentScore }));

    setTimeout(() => {
      setShowLeaderboard(true);
    }, 3000);

  } catch (error) {
    console.error('Submit error:', error);
  }
}, [selectedAnswer, timeLeft, session, sessionId]);

useEffect(() => {
  if (timeLeft > 0 && !hasAnswered) {
    const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
    return () => clearTimeout(timer);
  } else if (timeLeft === 0 && !hasAnswered) {
    handleSubmit();
  }
}, [timeLeft, hasAnswered, handleSubmit]); // ✅ FIXED

  if (loading) return <div style={styles.loading}>Loading quiz...</div>;

  if (showLeaderboard) {
    return (
      <Leaderboard
        sessionId={sessionId}
        myScore={myStats.score}
        onClose={onClose}
      />
    );
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.progress}>
            Question {session.currentQuestionIndex + 1} of {quiz.questions.length}
          </div>
          <div style={styles.timer}>
            ⏱️ {timeLeft}s
          </div>
        </div>

        {/* Question */}
        <div style={styles.question}>
          <h2 style={styles.questionText}>{currentQuestion.questionText}</h2>
        </div>

        {/* Options */}
        <div style={styles.options}>
          {currentQuestion.options.map((option, index) => {
            const isSelected = selectedAnswer === index;
            const isCorrect = result && index === result.correctAnswer;
            const isWrong = result && isSelected && !result.isCorrect;

            let bgColor = '#f5f5f5';
            if (hasAnswered) {
              if (isCorrect) bgColor = '#D7F0DD';
              if (isWrong) bgColor = '#ffebee';
            } else if (isSelected) {
              bgColor = '#e3f2fd';
            }

            return (
              <button
                key={index}
                onClick={() => !hasAnswered && setSelectedAnswer(index)}
                disabled={hasAnswered}
                style={{
                  ...styles.option,
                  backgroundColor: bgColor,
                  border: isSelected ? '2px solid #25D366' : '1px solid #ddd',
                  cursor: hasAnswered ? 'default' : 'pointer'
                }}
              >
                <span style={styles.optionLetter}>
                  {String.fromCharCode(65 + index)}
                </span>
                <span style={styles.optionText}>{option}</span>
                {hasAnswered && isCorrect && <span style={styles.checkmark}>✓</span>}
                {hasAnswered && isWrong && <span style={styles.cross}>✗</span>}
              </button>
            );
          })}
        </div>

        {/* Result */}
        {result && (
          <div style={styles.resultBox}>
            <div style={{
              ...styles.resultHeader,
              backgroundColor: result.isCorrect ? '#D7F0DD' : '#ffebee'
            }}>
              {result.isCorrect ? '✅ Correct!' : '❌ Incorrect'}
              {result.isCorrect && ` +${result.points} points`}
            </div>
            <div style={styles.explanation}>
              <strong>Explanation:</strong> {result.explanation}
            </div>
            <div style={styles.score}>
              Your Score: {result.currentScore} points
            </div>
          </div>
        )}

        {/* Submit Button */}
        {!hasAnswered && (
          <button
            onClick={handleSubmit}
            disabled={selectedAnswer === null}
            style={{
              ...styles.submitBtn,
              opacity: selectedAnswer === null ? 0.5 : 1
            }}
          >
            Submit Answer
          </button>
        )}
      </div>
    </div>
  );
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
  container: {
    backgroundColor: 'white',
    borderRadius: '12px',
    width: '90%',
    maxWidth: '700px',
    padding: '30px',
    maxHeight: '90vh',
    overflowY: 'auto'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '30px',
    paddingBottom: '15px',
    borderBottom: '2px solid #e0e0e0'
  },
  progress: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#075E54'
  },
  timer: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#ff9800'
  },
  question: {
    marginBottom: '30px'
  },
  questionText: {
    fontSize: '22px',
    fontWeight: '600',
    color: '#333',
    lineHeight: 1.4
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
    fontSize: '16px',
    borderRadius: '10px',
    transition: 'all 0.2s',
    textAlign: 'left'
  },
  optionLetter: {
    width: '35px',
    height: '35px',
    borderRadius: '50%',
    backgroundColor: '#075E54',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '600',
    flexShrink: 0
  },
  optionText: {
    flex: 1
  },
  checkmark: {
    fontSize: '24px',
    color: '#25D366'
  },
  cross: {
    fontSize: '24px',
    color: '#f44336'
  },
  resultBox: {
    marginTop: '20px',
    borderRadius: '10px',
    overflow: 'hidden',
    border: '1px solid #e0e0e0'
  },
  resultHeader: {
    padding: '15px',
    fontSize: '18px',
    fontWeight: '600',
    textAlign: 'center'
  },
  explanation: {
    padding: '15px',
    fontSize: '14px',
    backgroundColor: '#f8f9fa'
  },
  score: {
    padding: '15px',
    fontSize: '16px',
    fontWeight: '600',
    textAlign: 'center',
    color: '#075E54'
  },
  submitBtn: {
    width: '100%',
    padding: '15px',
    fontSize: '16px',
    fontWeight: '600',
    backgroundColor: '#25D366',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    marginTop: '20px'
  },
  loading: {
    position: 'fixed',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    backgroundColor: 'rgba(0,0,0,0.5)',
    color: 'white'
  }
};

export default QuizPlayer;