// frontend/src/components/FloatingQuizButton.jsx
// Fixed version with proper error handling and authentication

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

  // ✅ FIX: Better error handling and authentication
  const checkActiveQuiz = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');

      if (!token) {
        console.warn('⚠️ No auth token found');
        return;
      }

      const response = await fetch(
        `${process.env.REACT_APP_API_URL || "https://classvibe-backend.onrender.com"}/api/quiz/group/${groupId}/active`,
        {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // ✅ FIX: Check if response is JSON before parsing
      const contentType = response.headers.get('content-type');
      
      if (!contentType || !contentType.includes('application/json')) {
        console.warn(`⚠️ API returned non-JSON response (${response.status})`);
        return;
      }

      // ✅ FIX: Handle non-200 responses gracefully
      if (!response.ok) {
        if (response.status === 403) {
          console.error('🚫 Access forbidden - authentication failed');
        } else if (response.status === 404) {
          console.log('ℹ️ No active quiz found');
        } else if (response.status === 401) {
          console.error('🔐 Unauthorized - please log in again');
        } else {
          console.warn(`⚠️ Unexpected response: ${response.status}`);
        }
        return;
      }

      const data = await response.json();

      if (data.session) {
        console.log('✅ Active quiz found:', data.session._id);
        setQuizSession(data.session);
      } else {
        console.log('ℹ️ No active quiz session');
        setQuizSession(null);
      }
    } catch (error) {
      // ✅ FIX: Better error categorization
      if (error.name === 'SyntaxError') {
        console.error('❌ Invalid JSON response from server (possible HTML error page)');
      } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
        console.error('❌ Network error - cannot reach server');
      } else {
        console.error('❌ Check active quiz error:', error.message);
      }
    }
  }, [groupId]);

  useEffect(() => {
    if (!socket || !groupId) return;

    // Listen for quiz started (teacher published)
    socket.on('quizStarted', (data) => {
      console.log('🎮 Quiz started event received');
      setQuizSession({ status: 'waiting', ...data });
      setPulse(true);
      setTimeout(() => setPulse(false), 2000);
    });

    // Listen for quiz began (teacher clicked "Start Quiz")
    socket.on('quizBegan', () => {
      console.log('🚀 Quiz began event received');
      setQuizSession(prev => ({ ...prev, status: 'active' }));
    });

    // Listen for quiz ended
    socket.on('quizEnded', () => {
      console.log('🏁 Quiz ended event received');
      setQuizSession(null);
    });

    // Initial check for active quiz
    checkActiveQuiz();

    return () => {
      socket.off('quizStarted');
      socket.off('quizBegan');
      socket.off('quizEnded');
    };
  }, [socket, groupId, checkActiveQuiz]);

  const handleClick = () => {
    if (isTeacher) {
      // Teacher always opens quiz creator
      onCreateQuiz(quizSession || null);
    } else {
      // Student checks if quiz is available
      if (quizSession) {
        handleJoinQuiz(quizSession._id);
      }
      else {
        alert('📝 No quiz available right now!\n\nWait for your teacher to create and publish a quiz.');
      }
    }
  };
  // In ChatArea.jsx
const handleJoinQuiz = (sessionId) => {
  socket.emit('student:joinQuiz', { sessionId });

  if (onJoinQuiz) {
    onJoinQuiz(sessionId);
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
          ? `0 0 30px ${content.shadowColor}, 0 0 50px ${content.shadowColor}` 
          : `0 4px 20px ${content.shadowColor}`,
        transform: pulse ? 'scale(1.1)' : 'scale(1)',
        transition: 'all 0.3s ease'
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
    border: '4px solid white',
    userSelect: 'none'
  },
  emoji: { 
    fontSize: '32px',
    marginBottom: '2px'
  },
  text: { 
    fontSize: '12px', 
    color: 'white', 
    fontWeight: '800',
    letterSpacing: '0.5px'
  },
  subtext: { 
    fontSize: '9px', 
    color: 'white',
    fontWeight: '600',
    opacity: 0.95
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
    fontSize: '12px',
    fontWeight: '700',
    border: '2px solid white',
    boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
  }
};

export default FloatingQuizButton;