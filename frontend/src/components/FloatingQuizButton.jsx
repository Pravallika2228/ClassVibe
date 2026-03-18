import React, { useState, useEffect, useCallback } from 'react';

const FloatingQuizButton = ({ 
  groupId, 
  isTeacher, 
  onCreateQuiz,
  onJoinQuiz,
  socket 
}) => {
  const [quizSession, setQuizSession] = useState(null);
  const [pulse, setPulse] = useState(false);

  // ✅ FIX: useCallback added
  const checkActiveQuiz = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');

      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/quiz/group/${groupId}/active`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      const data = await response.json();

      if (data.session) {
        setQuizSession(data.session);
      }
    } catch (error) {
      console.error('Check active quiz error:', error);
    }
  }, [groupId]);

  useEffect(() => {
    if (!socket || !groupId) return;

    socket.on('quizStarted', (data) => {
      setQuizSession({ status: 'waiting', ...data });
      setPulse(true);
      setTimeout(() => setPulse(false), 2000);
    });

    socket.on('quizBegan', () => {
      setQuizSession(prev => ({ ...prev, status: 'active' }));
    });

    socket.on('quizEnded', () => {
      setQuizSession(null);
    });

    // ✅ FIX: now safe
    checkActiveQuiz();

    return () => {
      socket.off('quizStarted');
      socket.off('quizBegan');
      socket.off('quizEnded');
    };
  }, [socket, groupId, checkActiveQuiz]); // ✅ added dependency

  const handleClick = () => {
    if (isTeacher) {
      onCreateQuiz(quizSession || null);
    } else {
      if (quizSession) {
        onJoinQuiz(quizSession);
      } else {
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
        subtext: isTeacher 
          ? `${quizSession.participants?.length || 0} joined` 
          : 'Join Now',
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
    <div
      onClick={handleClick}
      style={{
        ...styles.button,
        backgroundColor: content.color,
        boxShadow: pulse 
          ? `0 0 30px ${content.shadowColor}` 
          : `0 4px 20px ${content.shadowColor}`
      }}
    >
      <div style={styles.emoji}>{content.emoji}</div>
      <div style={styles.text}>{content.text}</div>
      <div style={styles.subtext}>{content.subtext}</div>

      {quizSession?.participants?.length > 0 && (
        <div style={styles.badge}>
          {quizSession.participants.length}
        </div>
      )}
    </div>
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
    border: '4px solid white'
  },
  emoji: { fontSize: '32px' },
  text: { fontSize: '12px', color: 'white', fontWeight: '800' },
  subtext: { fontSize: '9px', color: 'white' },
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
    justifyContent: 'center'
  }
};

export default FloatingQuizButton;