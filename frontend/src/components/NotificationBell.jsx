// frontend/src/components/NotificationBell.jsx
// Notification bell icon with unread badge

import React, { useState, useEffect, useRef } from 'react';
import NotificationCenter from './NotificationCenter';

const NotificationBell = ({ socket }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [showCenter, setShowCenter] = useState(false);
  const bellRef = useRef(null);

  useEffect(() => {
    fetchUnreadCount();
    
    // Listen for new notifications via socket
    if (socket) {
      socket.on('newNotification', (notification) => {
        setUnreadCount(prev => prev + 1);
        // Show toast notification
        showToast(notification);
      });
    }
    
    return () => {
      if (socket) {
        socket.off('newNotification');
      }
    };
  }, [socket]);

  const fetchUnreadCount = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.REACT_APP_API_URL || "https://classvibe-backend.onrender.com"}/api/notifications/unread-count`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setUnreadCount(data.count);
      }
    } catch (error) {
      console.error('Fetch unread count error:', error);
    }
  };

  const showToast = (notification) => {
    // Create toast element
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      top: 80px;
      right: 20px;
      background: white;
      padding: 15px 20px;
      border-radius: 10px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      min-width: 300px;
      max-width: 400px;
      animation: slideIn 0.3s ease;
      cursor: pointer;
    `;
    
    toast.innerHTML = `
      <div style="display: flex; align-items: start; gap: 12px;">
        <span style="font-size: 24px;">${notification.icon || '🔔'}</span>
        <div style="flex: 1;">
          <div style="font-weight: 600; color: #075E54; margin-bottom: 4px;">
            ${notification.title}
          </div>
          <div style="font-size: 13px; color: #666;">
            ${notification.message}
          </div>
        </div>
      </div>
    `;
    
    // Add animation
    const style = document.createElement('style');
    style.textContent = `
      @keyframes slideIn {
        from {
          transform: translateX(400px);
          opacity: 0;
        }
        to {
          transform: translateX(0);
          opacity: 1;
        }
      }
    `;
    document.head.appendChild(style);
    
    // Click to open notification center
    toast.onclick = () => {
      setShowCenter(true);
      document.body.removeChild(toast);
    };
    
    document.body.appendChild(toast);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      if (document.body.contains(toast)) {
        toast.style.animation = 'slideIn 0.3s ease reverse';
        setTimeout(() => {
          if (document.body.contains(toast)) {
            document.body.removeChild(toast);
          }
        }, 300);
      }
    }, 5000);
  };

  const handleBellClick = () => {
    setShowCenter(!showCenter);
  };

  const handleNotificationRead = () => {
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const handleMarkAllRead = () => {
    setUnreadCount(0);
  };

  return (
    <>
      <div ref={bellRef} style={styles.container} onClick={handleBellClick}>
        <div style={styles.bell}>
          <span style={styles.bellIcon}>🔔</span>
          {unreadCount > 0 && (
            <div style={styles.badge}>
              {unreadCount > 99 ? '99+' : unreadCount}
            </div>
          )}
        </div>
      </div>

      {showCenter && (
        <NotificationCenter
          onClose={() => setShowCenter(false)}
          onNotificationRead={handleNotificationRead}
          onMarkAllRead={handleMarkAllRead}
        />
      )}
    </>
  );
};

const styles = {
  container: {
    position: 'relative',
    cursor: 'pointer',
    marginRight: '10px'
  },
  bell: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: 'rgba(255,255,255,0.1)',
    transition: 'all 0.2s'
  },
  bellIcon: {
    fontSize: '20px',
    filter: 'grayscale(100%) brightness(200%)'
  },
  badge: {
    position: 'absolute',
    top: '-5px',
    right: '-5px',
    background: '#DC3545',
    color: 'white',
    fontSize: '11px',
    fontWeight: '700',
    padding: '2px 6px',
    borderRadius: '10px',
    minWidth: '18px',
    textAlign: 'center',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
  }
};

export default NotificationBell;