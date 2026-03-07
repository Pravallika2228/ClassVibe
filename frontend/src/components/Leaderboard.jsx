// frontend/src/components/Leaderboard.jsx
import React, { useState, useEffect } from 'react';

const Leaderboard = ({ sessionId, myScore, onClose }) => {
  const [rankings, setRankings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [myRank, setMyRank] = useState(null);

  useEffect(() => {
  fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.REACT_APP_API_URL}/api/quiz/session/${sessionId}/leaderboard`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setRankings(data.leaderboard);
        
        // Find my rank
        const userId = JSON.parse(localStorage.getItem('user'))._id;
        const myIndex = data.leaderboard.findIndex(r => r.userId === userId);
        setMyRank(myIndex + 1);
        
        setLoading(false);
      }
    } catch (error) {
      console.error('Leaderboard error:', error);
      setLoading(false);
    }
  };

  const getBadge = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return '🎖️';
  };

  if (loading) return <div style={styles.loading}>Loading rankings...</div>;

  return (
    <div style={styles.overlay}>
      <div style={styles.container}>
        <div style={styles.header}>
          <h2 style={styles.title}>🏆 Leaderboard</h2>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        {/* My Rank Card */}
        {myRank && (
          <div style={styles.myRankCard}>
            <div style={styles.myRankBadge}>{getBadge(myRank)}</div>
            <div>
              <div style={styles.myRankText}>Your Rank</div>
              <div style={styles.myRankNumber}>#{myRank}</div>
            </div>
            <div style={styles.myScore}>{myScore} pts</div>
          </div>
        )}

        {/* Rankings List */}
        <div style={styles.rankingsList}>
          {rankings.map((player, index) => (
            <div
              key={player.userId}
              style={{
                ...styles.rankItem,
                backgroundColor: index < 3 ? '#f8f9fa' : 'white',
                border: index < 3 ? '2px solid #25D366' : '1px solid #e0e0e0'
              }}
            >
              <div style={styles.rankLeft}>
                <span style={styles.badge}>{getBadge(index + 1)}</span>
                <div>
                  <div style={styles.playerName}>
                    {player.user?.name || 'Player'}
                  </div>
                  <div style={styles.playerStats}>
                    {player.correctAnswers}/{player.answersCount} correct
                  </div>
                </div>
              </div>
              <div style={styles.playerScore}>{player.score} pts</div>
            </div>
          ))}
        </div>

        {/* Continue Button */}
        <button onClick={onClose} style={styles.continueBtn}>
          Continue
        </button>
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
    zIndex: 2001
  },
  container: {
    backgroundColor: 'white',
    borderRadius: '12px',
    width: '90%',
    maxWidth: '600px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    borderBottom: '2px solid #e0e0e0'
  },
  title: {
    margin: 0,
    fontSize: '24px',
    fontWeight: '700',
    color: '#075E54'
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: '#666'
  },
  myRankCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px',
    padding: '20px',
    margin: '20px',
    backgroundColor: '#D7F0DD',
    borderRadius: '12px',
    border: '2px solid #25D366'
  },
  myRankBadge: {
    fontSize: '48px'
  },
  myRankText: {
    fontSize: '12px',
    color: '#666',
    fontWeight: '600'
  },
  myRankNumber: {
    fontSize: '32px',
    fontWeight: '700',
    color: '#075E54'
  },
  myScore: {
    marginLeft: 'auto',
    fontSize: '24px',
    fontWeight: '700',
    color: '#25D366'
  },
  rankingsList: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 20px'
  },
  rankItem: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '15px',
    marginBottom: '10px',
    borderRadius: '10px'
  },
  rankLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '15px'
  },
  badge: {
    fontSize: '32px'
  },
  playerName: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#333'
  },
  playerStats: {
    fontSize: '12px',
    color: '#666'
  },
  playerScore: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#25D366'
  },
  continueBtn: {
    margin: '20px',
    padding: '15px',
    fontSize: '16px',
    fontWeight: '600',
    backgroundColor: '#25D366',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer'
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

export default Leaderboard;