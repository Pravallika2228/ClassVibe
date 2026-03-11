// frontend/src/components/FloatingQuizButton.jsx
// Floating round button visible during session

import React, { useState, useEffect } from 'react';

const FloatingQuizButton = ({ 
  groupId, 
  isTeacher, 
  onCreateQuiz,    // Teacher: Opens QuizHost
  onJoinQuiz,      // Student: Opens QuizPlayer/WaitingRoom
  socket 
}) => {
  const [quizSession, setQuizSession] = useState(null);
  const [pulse, setPulse] = useState(false);

  useEffect(() => {
    if (!socket || !groupId) return;

    // Listen for quiz events
    socket.on('quizStarted', (data) => {
      console.log('🎮 Quiz started event:', data);
      setQuizSession({ status: 'waiting', ...data });
      setPulse(true);
      setTimeout(() => setPulse(false), 2000);
    });

    socket.on('quizBegan', (data) => {
      console.log('▶️ Quiz began event:', data);
      setQuizSession(prev => ({ ...prev, status: 'active' }));
    });

    socket.on('quizEnded', (data) => {
      console.log('🏁 Quiz ended event:', data);
      setQuizSession(null);
    });

    // Check for active quiz on mount
    checkActiveQuiz();

    return () => {
      socket.off('quizStarted');
      socket.off('quizBegan');
      socket.off('quizEnded');
    };
  }, [socket, groupId]);

  const checkActiveQuiz = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/quiz/group/${groupId}/active`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      const data = await response.json();
      
      if (data.session) {
        setQuizSession(data.session);
      }
    } catch (error) {
      console.error('Check active quiz error:', error);
    }
  };

  const handleClick = () => {
    if (isTeacher) {
      if (quizSession) {
        // Open host control panel
        onCreateQuiz(quizSession);
      } else {
        // Open quiz creator
        onCreateQuiz(null);
      }
    } else {
      if (quizSession) {
        // Join quiz
        onJoinQuiz(quizSession);
      } else {
        // No quiz available
        alert('No quiz available. Wait for your teacher to create one!');
      }
    }
  };

  const getButtonContent = () => {
    if (!quizSession) {
      return {
        emoji: '🎮',
        text: isTeacher ? 'Create' : 'Quiz',
        color: '#9C27B0',
        subtext: isTeacher ? 'AI Quiz' : 'Ready?',
        shadowColor: 'rgba(156, 39, 176, 0.6)'
      };
    }

    if (quizSession.status === 'active') {
      return {
        emoji: '🔥',
        text: 'LIVE',
        color: '#FF4444',
        subtext: isTeacher ? 'Control' : 'Join Now!',
        shadowColor: 'rgba(255, 68, 68, 0.6)'
      };
    }

    if (quizSession.status === 'waiting') {
      return {
        emoji: '⏳',
        text: 'Waiting',
        color: '#FFA500',
        subtext: isTeacher ? `${quizSession.participants?.length || 0} joined` : 'Join Now',
        shadowColor: 'rgba(255, 165, 0, 0.6)'
      };
    }

    return {
      emoji: '🎮',
      text: 'Quiz',
      color: '#9C27B0',
      subtext: 'Ready',
      shadowColor: 'rgba(156, 39, 176, 0.6)'
    };
  };

  const content = getButtonContent();

  return (
    <>
      <div
        onClick={handleClick}
        style={{
          ...styles.button,
          backgroundColor: content.color,
          boxShadow: pulse 
            ? `0 0 30px ${content.shadowColor}` 
            : `0 4px 20px ${content.shadowColor}`,
          animation: pulse ? 'pulse 1.5s ease-in-out' : 'float 3s ease-in-out infinite'
        }}
        title={isTeacher ? 'Manage Quiz' : 'Join Quiz'}
      >
        <div style={styles.emoji}>{content.emoji}</div>
        <div style={styles.text}>{content.text}</div>
        <div style={styles.subtext}>{content.subtext}</div>
        
        {quizSession?.participants?.length > 0 && (
          <div style={styles.badge}>{quizSession.participants.length}</div>
        )}
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { 
            transform: scale(1); 
            box-shadow: 0 4px 20px ${content.shadowColor};
          }
          50% { 
            transform: scale(1.15); 
            box-shadow: 0 0 40px ${content.shadowColor};
          }
        }

        @keyframes float {
          0%, 100% { 
            transform: translateY(0px); 
          }
          50% { 
            transform: translateY(-10px); 
          }
        }
      `}</style>
    </>
  );
};

const styles = {
  button: {
    position: 'fixed',
    bottom: '100px',
    right: '30px',
    width: '90px',
    height: '90px',
    borderRadius: '50%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: 999,
    transition: 'all 0.3s ease',
    border: '4px solid white',
    userSelect: 'none'
  },
  emoji: {
    fontSize: '32px',
    marginBottom: '2px'
  },
  text: {
    fontSize: '12px',
    fontWeight: '800',
    color: 'white',
    textTransform: 'uppercase',
    letterSpacing: '1px',
    textShadow: '0 2px 4px rgba(0,0,0,0.3)'
  },
  subtext: {
    fontSize: '9px',
    color: 'rgba(255,255,255,0.95)',
    marginTop: '2px',
    fontWeight: '600'
  },
  badge: {
    position: 'absolute',
    top: '-5px',
    right: '-5px',
    backgroundColor: '#FF4444',
    color: 'white',
    borderRadius: '50%',
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '13px',
    fontWeight: '800',
    border: '3px solid white',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
  }
};

export default FloatingQuizButton;