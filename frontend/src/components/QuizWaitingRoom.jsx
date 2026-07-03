// frontend/src/components/QuizWaitingRoom.jsx
// Student waiting lobby before quiz starts

import React, { useState, useEffect } from 'react';

const QuizWaitingRoom = ({ session, onClose, socket }) => {
  const [participants, setParticipants] = useState(session?.participants || []);
  const [status, setStatus] = useState(session?.status || 'waiting');

  useEffect(() => {
    if (!socket) return;

    // Listen for other students joining (backend emits 'student:joined')
    socket.on('student:joined', (data) => {
      console.log('👤 New participant:', data);
      setParticipants(prev => {
        if (prev.find(p => p.userId === data.userId)) return prev;
        return [...prev, data];
      });
    });

    // Listen for quiz starting
    socket.on('quiz:started', (data) => {
      console.log('🚀 Quiz started!');
      setStatus('active');
      // Auto-close waiting room and open quiz player
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('startQuiz', { detail: data }));
      }, 500);
    });

    return () => {
      socket.off('student:joined');
      socket.off('quiz:started');
    };
  }, [socket]);

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>
            {status === 'waiting' ? '⏳ Waiting for Quiz to Start' : '🎮 Quiz Starting!'}
          </h2>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        {/* Status Message */}
        <div style={styles.statusSection}>
          {status === 'waiting' ? (
            <>
              <div style={styles.statusIcon}>⏳</div>
              <h3 style={styles.statusTitle}>Get Ready!</h3>
              <p style={styles.statusText}>
                Your teacher is preparing the quiz. Stay on this page.
              </p>
            </>
          ) : (
            <>
              <div style={styles.statusIcon}>🚀</div>
              <h3 style={styles.statusTitle}>Quiz is Starting!</h3>
              <p style={styles.statusText}>
                Get ready to answer questions...
              </p>
            </>
          )}
        </div>

        {/* Participants List */}
        <div style={styles.participantsSection}>
          <h4 style={styles.sectionTitle}>
            👥 Participants ({participants.length})
          </h4>
          
          {participants.length === 0 ? (
            <p style={styles.emptyText}>You're the first one here!</p>
          ) : (
            <div style={styles.participantsGrid}>
              {participants.map((p, index) => (
                <div key={index} style={styles.participantChip}>
                  <div style={styles.participantAvatar}>
                    {p.user?.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <span style={styles.participantName}>
                    {p.user?.name || 'Student'}
                  </span>
                  {index === 0 && (
                    <span style={styles.firstBadge}>1st</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tips Section */}
        <div style={styles.tipsSection}>
          <h4 style={styles.tipsTitle}>💡 Quick Tips</h4>
          <ul style={styles.tipsList}>
            <li style={styles.tipItem}>Read each question carefully</li>
            <li style={styles.tipItem}>Faster correct answers = more points</li>
            <li style={styles.tipItem}>You can't change answers after submitting</li>
            <li style={styles.tipItem}>Stay focused and have fun! 🎯</li>
          </ul>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <div style={styles.waitingIndicator}>
            <div style={styles.pulsingDot} />
            <span style={styles.waitingText}>Waiting for teacher to start...</span>
          </div>
        </div>

        <style>{`
          @keyframes pulse {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.5; transform: scale(1.2); }
          }
        `}</style>
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
  modal: {
    backgroundColor: 'white',
    borderRadius: '12px',
    width: '90%',
    maxWidth: '600px',
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
    fontSize: '20px',
    fontWeight: '600',
    color: 'white'
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: 'white'
  },
  statusSection: {
    padding: '40px 20px',
    textAlign: 'center',
    backgroundColor: '#f8f9fa',
    borderBottom: '1px solid #e0e0e0'
  },
  statusIcon: {
    fontSize: '64px',
    marginBottom: '15px'
  },
  statusTitle: {
    margin: '0 0 10px 0',
    fontSize: '24px',
    fontWeight: '600',
    color: '#075E54'
  },
  statusText: {
    margin: 0,
    fontSize: '14px',
    color: '#666'
  },
  participantsSection: {
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
    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
    gap: '10px',
    maxHeight: '200px',
    overflowY: 'auto'
  },
  participantChip: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px',
    backgroundColor: '#D7F0DD',
    borderRadius: '8px',
    border: '1px solid #25D366'
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
    fontWeight: '600',
    flexShrink: 0
  },
  participantName: {
    flex: 1,
    fontSize: '13px',
    fontWeight: '500',
    color: '#333'
  },
  firstBadge: {
    padding: '3px 8px',
    backgroundColor: '#FFD700',
    color: '#333',
    borderRadius: '10px',
    fontSize: '10px',
    fontWeight: '700'
  },
  tipsSection: {
    padding: '20px',
    backgroundColor: '#fff9e6',
    flex: 1,
    overflowY: 'auto'
  },
  tipsTitle: {
    margin: '0 0 15px 0',
    fontSize: '16px',
    fontWeight: '600',
    color: '#FFA500'
  },
  tipsList: {
    margin: 0,
    paddingLeft: '20px'
  },
  tipItem: {
    fontSize: '14px',
    color: '#666',
    marginBottom: '8px'
  },
  footer: {
    padding: '15px 20px',
    borderTop: '1px solid #e0e0e0',
    backgroundColor: '#f8f9fa'
  },
  waitingIndicator: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px'
  },
  pulsingDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    backgroundColor: '#25D366',
    animation: 'pulse 2s ease-in-out infinite'
  },
  waitingText: {
    fontSize: '14px',
    color: '#666',
    fontWeight: '500'
  }
};

export default QuizWaitingRoom;