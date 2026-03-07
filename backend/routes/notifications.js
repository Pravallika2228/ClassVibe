// backend/routes/notifications.js
// Notification management API

const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const jwt = require('jsonwebtoken');

// ========================================
// MIDDLEWARE
// ========================================

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Access denied' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid token' });
  }
};

// ========================================
// ROUTES
// ========================================

// Get my notifications
router.get('/my-notifications', authenticateToken, async (req, res) => {
  try {
    const { limit, unreadOnly } = req.query;
    
    let query = { recipient: req.userId };
    if (unreadOnly === 'true') {
      query.isRead = false;
    }
    
    const notifications = await Notification.find(query)
      .populate('sender', 'name username')
      .populate('relatedGroup', 'groupName')
      .sort({ createdAt: -1 })
      .limit(parseInt(limit) || 50);
    
    res.json({ notifications });
    
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Get unread count
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const count = await Notification.getUnreadCount(req.userId);
    res.json({ count });
    
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ error: 'Failed to fetch count' });
  }
});

// Mark notification as read
router.put('/:notificationId/read', authenticateToken, async (req, res) => {
  try {
    const { notificationId } = req.params;
    
    const notification = await Notification.findById(notificationId);
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    if (notification.recipient.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await notification.markAsRead();
    
    res.json({ message: 'Notification marked as read', notification });
    
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// Mark all as read
router.put('/mark-all-read', authenticateToken, async (req, res) => {
  try {
    await Notification.markAllAsRead(req.userId);
    
    res.json({ message: 'All notifications marked as read' });
    
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

// Delete notification
router.delete('/:notificationId', authenticateToken, async (req, res) => {
  try {
    const { notificationId } = req.params;
    
    const notification = await Notification.findById(notificationId);
    
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }
    
    if (notification.recipient.toString() !== req.userId.toString()) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    await notification.deleteOne();
    
    res.json({ message: 'Notification deleted' });
    
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// Delete all read notifications
router.delete('/clear-read', authenticateToken, async (req, res) => {
  try {
    await Notification.deleteMany({
      recipient: req.userId,
      isRead: true
    });
    
    res.json({ message: 'Read notifications cleared' });
    
  } catch (error) {
    console.error('Clear notifications error:', error);
    res.status(500).json({ error: 'Failed to clear notifications' });
  }
});

// Get notification settings (for future use)
router.get('/settings', authenticateToken, async (req, res) => {
  try {
    // In future, store user notification preferences
    res.json({
      settings: {
        emailNotifications: true,
        pushNotifications: true,
        quizNotifications: true,
        messageNotifications: true,
        sessionNotifications: true
      }
    });
    
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

module.exports = router;