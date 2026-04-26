// frontend/src/App.js
// CHANGES FROM ORIGINAL:
// 1. handleCreateGroup now opens ScheduleSession instead of prompt+createGroup
// 2. Teacher dashboard redesigned as Instructor Hub (sidebar + stats + session cards)
// 3. Added loadScheduledSessions for dashboard stats
// 4. ALL socket events, quiz features, student dashboard — IDENTICAL to original

import React, { useState, useEffect, useCallback } from 'react';
import { getMyGroups, getGroupDetails, getMessages, endSession } from './api';
// ✅ Removed createGroup from import — "Create" now opens ScheduleSession
import socket from './socket';
import Home from './pages/Home';
import Login from './components/Login';
import TeacherLogin from './pages/TeacherLogin';
import StudentJoin from './pages/StudentJoin';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import MessageInput from './components/MessageInput';
import ScheduleSession from './components/ScheduleSession';
import FloatingQuizButton from './components/FloatingQuizButton';
import QuizCreator from './components/QuizCreator';
import StudentAnalytics from './components/StudentAnalytics';
import './App.css';
import QuizHost from './components/QuizHost';
import QuizWaitingRoom from './components/QuizWaitingRoom';
import QuizPlayer from './components/QuizPlayer';

function App() {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authScreen, setAuthScreen] = useState('home');
  const [groups, setGroups] = useState([]);
  const [currentGroup, setCurrentGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Quiz & Analytics state — IDENTICAL to original
  const [showQuizCreator, setShowQuizCreator] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [activeQuizSession, setActiveQuizSession] = useState(null);

  // Quiz waiting room — IDENTICAL to original
  const [showWaitingRoom, setShowWaitingRoom] = useState(false);
  const [quizSessionId, setQuizSessionId] = useState(null);
  const [showQuizPlayer, setShowQuizPlayer] = useState(false);

  // ✅ NEW: Scheduled sessions for Instructor Hub stats
  const [scheduledSessions, setScheduledSessions] = useState([]);

  const getUserId = (u) => u?.id ?? u?._id ?? u?.userId ?? null;

  // IDENTICAL to original
  useEffect(() => {
    const openWaitingRoom = (e) => {
      setQuizSessionId(e.detail.sessionId);
      setShowWaitingRoom(true);
    };
    const startQuiz = () => {
      setShowWaitingRoom(false);
      setShowQuizPlayer(true);
    };
    window.addEventListener('openWaitingRoom', openWaitingRoom);
    window.addEventListener('startQuiz', startQuiz);
    return () => {
      window.removeEventListener('openWaitingRoom', openWaitingRoom);
      window.removeEventListener('startQuiz', startQuiz);
    };
  }, []);

  // IDENTICAL to original
  const loadGroups = useCallback(async (autoSelect = false) => {
    try {
      const response = await getMyGroups();
      setGroups(response.groups || []);
      if (autoSelect && (response.groups || []).length > 0 && !currentGroup) {
        const first = response.groups[0];
        selectGroup(first._id ?? first.id);
      }
    } catch (err) {
      console.error('Error loading groups:', err);
    }
  }, [currentGroup]);

  // ✅ NEW: Load scheduled sessions for dashboard stats
  const loadScheduledSessions = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${process.env.REACT_APP_API_URL || 'https://classvibe-backend.onrender.com'}/api/schedule/my-sessions?status=all`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = await res.json();
        setScheduledSessions(data.sessions || []);
      }
    } catch (e) { console.error('Load scheduled sessions error', e); }
  }, []);

  // IDENTICAL to original
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    const urlParams = new URLSearchParams(window.location.search);
    const pinFromUrl = urlParams.get('pin');

    if (savedToken) {
      try {
        const parsedUser = savedUser ? JSON.parse(savedUser) : null;
        if (parsedUser) setUser(parsedUser);
        setIsAuthenticated(true);
        socket.connect();
        socket.emit('authenticate', savedToken);
        loadGroups(true);
      } catch (err) {
        console.error('Error restoring session:', err);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    } else {
      if (pinFromUrl) {
        setAuthScreen('student');
      } else {
        setAuthScreen('home');
      }
    }
  }, [loadGroups]);

  // Load scheduled sessions when authenticated as teacher
  useEffect(() => {
    if (isAuthenticated && user?.role === 'teacher') {
      loadScheduledSessions();
    }
  }, [isAuthenticated, user, loadScheduledSessions]);

  // IDENTICAL to original — all socket events preserved
  useEffect(() => {
    if (!isAuthenticated) return;

    socket.on('newMessage', (message) => {
      setMessages(prevMessages => [...prevMessages, message]);
    });

    socket.on('userJoined', (data) => {
      if (currentGroup) {
        loadGroupDetails(currentGroup._id ?? currentGroup.id);
      }
    });

    socket.on('userTyping', (data) => {
      if (!data || !data.username) return;
      setTypingUsers(prev => {
        if (data.userId === getUserId(user)) return prev;
        if (!prev.includes(data.username)) {
          return [...prev, data.username];
        }
        return prev;
      });
    });

    socket.on('userStopTyping', (data) => {
      if (!data || !data.username) return;
      setTypingUsers(prev => prev.filter(u => u !== data.username));
    });

    socket.on('onlineUsersUpdate', (data) => {
      if (currentGroup) {
        setCurrentGroup(prev => ({ ...prev, onlineUsers: data.onlineUsers }));
      }
    });

    socket.on('sessionEnded', (data) => {
      alert('The admin has ended this session');
      loadGroups(false);
      setCurrentGroup(null);
      setMessages([]);
    });

    socket.on('messageEdited', (editedMessage) => {
      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg._id === editedMessage._id ? editedMessage : msg
        )
      );
    });

    socket.on('messageDeleted', (data) => {
      setMessages(prevMessages =>
        prevMessages.map(msg =>
          msg._id === data.messageId
            ? { ...msg, isDeleted: true, content: 'This message was deleted' }
            : msg
        )
      );
    });

    // Quiz socket events — IDENTICAL to original
    socket.on('quizStarted', (data) => {
      console.log('🎮 Quiz started:', data);
      alert(`Quiz started: ${data.quizTitle}!\nJoin now to participate!`);
    });

    socket.on('nextQuestion', (data) => {
      console.log('➡️ Next question:', data);
    });

    socket.on('quizEnded', (data) => {
      console.log('🏁 Quiz ended:', data);
      alert('Quiz has ended! Check your results.');
    });

    socket.on('leaderboardUpdate', (data) => {
      console.log('📊 Leaderboard updated:', data);
    });

    return () => {
      socket.off('newMessage');
      socket.off('userJoined');
      socket.off('userTyping');
      socket.off('userStopTyping');
      socket.off('onlineUsersUpdate');
      socket.off('sessionEnded');
      socket.off('messageEdited');
      socket.off('messageDeleted');
      socket.off('quizStarted');
      socket.off('nextQuestion');
      socket.off('quizEnded');
      socket.off('leaderboardUpdate');
    };
  }, [isAuthenticated, currentGroup, loadGroups, user]);

  // IDENTICAL to original
  const loadGroupDetails = async (groupId) => {
    try {
      const response = await getGroupDetails(groupId);
      setCurrentGroup(response.group);
    } catch (err) {
      console.error('Error loading group details:', err);
    }
  };

  // IDENTICAL to original
  const selectGroup = async (groupId) => {
    try {
      console.log('📂 Selecting group:', groupId);
      const groupResponse = await getGroupDetails(groupId);
      setCurrentGroup(groupResponse.group);
      const messagesResponse = await getMessages(groupId);
      setMessages(messagesResponse.messages || []);
      socket.emit('joinGroup', groupId);
      console.log('✅ Group selected successfully');
    } catch (err) {
      console.error('Error selecting group:', err);
      alert('Failed to join classroom: ' + (err.response?.data?.error || err.message));
    }
  };

  // ✅ CHANGED: Opens ScheduleSession instead of prompt+createGroup
  // (Groups are now created when a scheduled session starts)
  const handleCreateGroup = () => {
    setShowSchedule(true);
  };

  // IDENTICAL to original
  const handleSendMessage = (messageData) => {
    if (!currentGroup) return;
    const payload = {
      groupId: currentGroup._id ?? currentGroup.id,
      content: messageData.content,
      messageType: messageData.messageType,
      recipientId: messageData.recipientId,
      fileUrl: messageData.fileUrl || null,
      fileName: messageData.fileName || null,
      fileSize: messageData.fileSize || null,
      fileType: messageData.fileType || null
    };
    if (messageData.messageType === 'poll' && messageData.pollOptions) {
      payload.pollOptions = messageData.pollOptions;
    }
    socket.emit('sendMessage', payload);
  };

  // IDENTICAL to original
  const handleTyping = () => {
    if (!currentGroup) return;
    socket.emit('typing', { groupId: currentGroup._id ?? currentGroup.id });
  };

  const handleStopTyping = () => {
    if (!currentGroup) return;
    socket.emit('stopTyping', { groupId: currentGroup._id ?? currentGroup.id });
  };

  // IDENTICAL to original
  const handleEndSession = async () => {
    if (!currentGroup) return;
    const confirmed = window.confirm('Are you sure you want to end this session?');
    if (!confirmed) return;
    const groupId = currentGroup._id ?? currentGroup.id;
    try {
      console.log('🔴 Ending session:', groupId);
      await endSession(groupId);
      setCurrentGroup(null);
      setMessages([]);
      console.log('✅ Session ended, returned to dashboard');
      setTimeout(() => { loadGroups(false); }, 100);
    } catch (err) {
      console.error('❌ Error ending session:', err);
      alert('Failed to end session: ' + (err.response?.data?.error || err.message));
    }
  };

  // IDENTICAL to original
  const handleLeaveMeeting = () => {
    const confirmed = window.confirm('Are you sure you want to leave this session?');
    if (!confirmed) return;
    try {
      socket.emit('leaveGroup', currentGroup._id ?? currentGroup.id);
      setCurrentGroup(null);
      setMessages([]);
      console.log('✅ Left session successfully');
    } catch (err) {
      console.error('Error leaving session:', err);
    }
  };

  // IDENTICAL to original
  const handleMessageEdited = (editedMessage) => {
    setMessages(prevMessages =>
      prevMessages.map(msg =>
        msg._id === editedMessage._id ? editedMessage : msg
      )
    );
  };

  const handleMessageDeleted = (messageId) => {
    setMessages(prevMessages =>
      prevMessages.map(msg =>
        msg._id === messageId
          ? { ...msg, isDeleted: true, content: 'This message was deleted' }
          : msg
      )
    );
  };

  // IDENTICAL to original
  const handleLogout = () => {
    try { socket.disconnect(); } catch (e) { console.warn('Socket disconnect error', e); }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setIsAuthenticated(false);
    setGroups([]);
    setCurrentGroup(null);
    setMessages([]);
    setAuthScreen('home');
  };

  // IDENTICAL to original
  const handleLoginSuccess = (loggedInUser, token) => {
    if (token) localStorage.setItem('token', token);
    if (loggedInUser) {
      localStorage.setItem('user', JSON.stringify(loggedInUser));
      setUser(loggedInUser);
    } else {
      const savedUser = localStorage.getItem('user');
      if (savedUser) setUser(JSON.parse(savedUser));
    }
    const savedToken = token ?? localStorage.getItem('token');
    if (savedToken) {
      try {
        socket.connect();
        socket.emit('authenticate', savedToken);
      } catch (e) { console.warn('Socket auth failed at login:', e); }
    }
    setIsAuthenticated(true);
    loadGroups(false);
  };

  // IDENTICAL to original
  const handleGroupJoined = (group, returnedUser, token) => {
    console.log('👥 Group joined:', {
      groupName: group?.groupName,
      userName: returnedUser?.name,
      hasToken: !!token
    });
    if (token) localStorage.setItem('token', token);
    if (returnedUser) {
      localStorage.setItem('user', JSON.stringify(returnedUser));
      setUser(returnedUser);
    } else {
      const savedUser = localStorage.getItem('user');
      if (savedUser) setUser(JSON.parse(savedUser));
    }
    setIsAuthenticated(true);
    const savedToken = token ?? localStorage.getItem('token');
    if (savedToken) {
      console.log('🔌 Connecting socket...');
      socket.connect();
      socket.emit('authenticate', savedToken);
      socket.once('authenticated', (response) => {
        console.log('✅ Socket authenticated');
        loadGroups(false);
        const gid = group?._id ?? group?.id;
        if (gid) {
          setTimeout(() => { selectGroup(gid); }, 500);
        }
      });
      setTimeout(() => {
        loadGroups(false);
        const gid = group?._id ?? group?.id;
        if (gid) { selectGroup(gid); }
      }, 1000);
    }
  };

  // IDENTICAL to original
  const isAdmin = !!(
    currentGroup &&
    user &&
    currentGroup.admin &&
    (getUserId(user) && (
      currentGroup.admin._id === getUserId(user) ||
      currentGroup.admin._id === user?.id ||
      currentGroup.admin._id === user?._id
    ))
  );

  const displayName = user?.name ?? user?.username ?? 'User';

  // IDENTICAL to original
  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const timeStr = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    return { date: dateStr, time: timeStr };
  };

  // ── Dashboard stats ──
  const liveGroups    = groups.filter(g => g.isActive);
  const endedGroups   = groups.filter(g => !g.isActive);
  const totalStudents = [...new Set(groups.flatMap(g =>
    (g.members || []).map(m => m.user?._id || m.user)
  ))].length;
  const upcomingCount = scheduledSessions.filter(s => s.status === 'scheduled').length;

  // ─────────────────────────────────────────
  // NOT AUTHENTICATED — IDENTICAL to original
  // ─────────────────────────────────────────
  if (!isAuthenticated) {
    if (authScreen === 'home') {
      return (
        <Home
          onTeacher={() => setAuthScreen('teacher')}
          onStudent={() => setAuthScreen('student')}
        />
      );
    }
    if (authScreen === 'teacher') {
      return (
        <TeacherLogin
          onAuthSuccess={(loggedUser, token) => { handleLoginSuccess(loggedUser, token); }}
          onBack={() => setAuthScreen('home')}
        />
      );
    }
    if (authScreen === 'student') {
      return (
        <StudentJoin
          onJoinSuccess={(group, returnedUser, token) => {
            handleGroupJoined(group, returnedUser, token);
          }}
          onBack={() => setAuthScreen('home')}
        />
      );
    }
    return (
      <div>
        <Login onLoginSuccess={(userObj, token) => handleLoginSuccess(userObj, token)} />
        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <button
            onClick={() => setAuthScreen('teacher')}
            style={{ padding: '8px 12px', cursor: 'pointer' }}
          >
            Teacher Login / Create Class
          </button>
        </div>
      </div>
    );
  }

  // ─────────────────────────────────────────
  // AUTHENTICATED
  // ─────────────────────────────────────────
  return (
    <div className="App">
      <Header
        onEndSession={handleEndSession}
        onLeaveMeeting={handleLeaveMeeting}
        onCreateGroup={handleCreateGroup}          // ✅ Now opens ScheduleSession
        onOpenSchedule={() => setShowSchedule(true)}
        onOpenQuiz={() => setShowQuizCreator(true)}
        onOpenAnalytics={() => setShowAnalytics(true)}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        isAdmin={isAdmin}
        groupName={currentGroup ? currentGroup.groupName : ''}
        userRole={user?.role}
        socket={socket}
      />

      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        group={currentGroup}
        messages={messages}
        currentUserId={getUserId(user)}
        onGroupJoined={(g) => handleGroupJoined(g)}
      />

      {/* Quiz Creator Modal — IDENTICAL to original */}
      {showQuizCreator && (
        <QuizCreator
          groupId={currentGroup?._id}
          onClose={() => setShowQuizCreator(false)}
          onSuccess={(session) => {
            setShowQuizCreator(false);
            if (session) setActiveQuizSession(session);
            else alert('✅ Quiz created successfully!');
          }}
        />
      )}

      {/* Analytics Modal — IDENTICAL to original */}
      {showAnalytics && (
        <StudentAnalytics
          groupId={currentGroup?._id}
          onClose={() => setShowAnalytics(false)}
        />
      )}

      {/* Schedule Modal — now passes loadScheduledSessions as onSuccess callback */}
      {showSchedule && (
        <ScheduleSession
          onClose={() => setShowSchedule(false)}
          onSuccess={() => {
            setShowSchedule(false);
            loadScheduledSessions();
            loadGroups(false);
          }}
        />
      )}

      {/* Floating Quiz Button — IDENTICAL to original */}
      {currentGroup && currentGroup.isActive && (
        <FloatingQuizButton
          groupId={currentGroup._id}
          isTeacher={user?.role === 'teacher'}
          onCreateQuiz={(session) => {
            if (session) {
              setActiveQuizSession(session);
            } else {
              setShowQuizCreator(true);
            }
          }}
          onJoinQuiz={(session) => { setActiveQuizSession(session); }}
          socket={socket}
        />
      )}

      {/* Quiz Host Panel — IDENTICAL to original */}
      {activeQuizSession && user?.role === 'teacher' && (
        <QuizHost
          quiz={activeQuizSession.quiz}
          sessionId={activeQuizSession._id}
          onClose={() => setActiveQuizSession(null)}
          socket={socket}
        />
      )}

      {/* Quiz Waiting Room — IDENTICAL to original */}
      {activeQuizSession && user?.role === 'student' && activeQuizSession.status === 'waiting' && (
        <QuizWaitingRoom
          session={activeQuizSession}
          onClose={() => setActiveQuizSession(null)}
          socket={socket}
        />
      )}

      {showWaitingRoom && (
        <QuizWaitingRoom
          session={{ _id: quizSessionId }}
          socket={socket}
          onClose={() => setShowWaitingRoom(false)}
        />
      )}

      {showQuizPlayer && (
        <QuizPlayer
          sessionId={quizSessionId}
          onClose={() => setShowQuizPlayer(false)}
        />
      )}

      {/* Quiz Player — IDENTICAL to original */}
      {activeQuizSession && user?.role === 'student' && activeQuizSession.status === 'active' && (
        <QuizPlayer
          sessionId={activeQuizSession._id}
          onClose={() => setActiveQuizSession(null)}
        />
      )}

      <div className="main-content">
        {!currentGroup ? (

          /* ══════════════════════════════════════
             TEACHER DASHBOARD — Instructor Hub
             ══════════════════════════════════════ */
          user?.role === 'teacher' ? (
            <div style={D.shell}>

              {/* LEFT SIDEBAR */}
              <div style={D.sidebar}>
                <div style={D.sidebarLogo}>ClassVibe</div>

                {[
                  { icon: '📊', label: 'Dashboard',   action: () => {} },
                  { icon: '📅', label: 'Schedule',    action: () => setShowSchedule(true) },
                  { icon: '📖', label: 'Quiz History', action: () => {} },
                  { icon: '📈', label: 'Analytics',   action: () => setShowAnalytics(true) },
                  { icon: '⚙️', label: 'Settings',    action: () => {} },
                ].map((item, i) => (
                  <button key={i} style={D.navItem} onClick={item.action}>
                    <span style={D.navIcon}>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}

                <div style={D.sidebarSpacer} />
                <div style={D.sidebarUser}>
                  <div style={D.userAvatar}>👨‍🏫</div>
                  <div>
                    <div style={D.userName}>{displayName}</div>
                    <div style={D.userRole}>Admin Instructor</div>
                  </div>
                </div>
              </div>

              {/* MAIN AREA */}
              <div style={D.main}>

                {/* Top bar */}
                <div style={D.topBar}>
                  <h1 style={D.pageTitle}>Instructor Hub</h1>
                  <div style={D.topActions}>
                    {/* ✅ Both buttons open ScheduleSession */}
                    <button style={D.planBtn} onClick={() => setShowSchedule(true)}>
                      📅 Plan Session
                    </button>
                    <button style={D.createBtn} onClick={() => setShowSchedule(true)}>
                      + Create Instant
                    </button>
                  </div>
                </div>

                {/* Stats row */}
                <div style={D.statsRow}>
                  {[
                    { label:'Total Students',    value: totalStudents,  sub:`Across ${groups.length} classes`, trend:'+12%', icon:'👥' },
                    { label:'Engagement Rate',   value: '88%',          sub:'Avg. participation score',        trend:'+3.2%', icon:'⚡' },
                    { label:'Active Sessions',   value: liveGroups.length, sub:'Ongoing live classrooms',      icon:'🎯' },
                    { label:'Upcoming Quizzes',  value: upcomingCount,  sub:'Scheduled for next 48h',          icon:'📝' },
                  ].map((s, i) => (
                    <div key={i} style={D.statCard}>
                      <div style={D.statIcon}>{s.icon}</div>
                      {s.trend && <div style={D.statTrend}>{s.trend}</div>}
                      <div style={D.statLabel}>{s.label}</div>
                      <div style={D.statValue}>{s.value}</div>
                      <div style={D.statSub}>{s.sub}</div>
                    </div>
                  ))}
                </div>

                {/* Sessions + Quick Tools */}
                <div style={D.contentRow}>

                  {/* Sessions column */}
                  <div style={D.sessionsCol}>
                    <div style={D.sectionBar}>
                      <h2 style={D.sectionTitle}>Active & Upcoming Sessions</h2>
                      <button style={D.viewAllBtn}>View All</button>
                    </div>

                    <div style={D.sessionGrid}>

                      {/* LIVE sessions */}
                      {liveGroups.map(group => (
                        <div key={group._id} style={D.sessionCard}>
                          <div style={D.cardTopRow}>
                            <span style={D.liveBadge}>● Live Now</span>
                            <button style={D.moreBtn}>⋮</button>
                          </div>
                          <div style={D.sessionName}>{group.groupName}</div>
                          <div style={D.sessionMeta}>
                            Started {formatDateTime(group.createdAt).time}
                          </div>
                          <div style={D.pinBox}>
                            <div style={D.pinLabel}>ACCESS PIN</div>
                            <div style={D.pinValue}>
                              {group.pin?.replace(/(\d{3})(\d{3})/, '$1-$2')}
                            </div>
                          </div>
                          <div style={D.cardStats}>
                            <span>👥 {(group.members || []).length} Students</span>
                            <span style={D.modBadge}>🛡 Moderation On</span>
                          </div>
                          {/* Teacher can join any active session without ending it */}
                          <button
                            style={D.joinBtn}
                            onClick={() => selectGroup(group._id ?? group.id)}
                          >
                            Join Session
                          </button>
                        </div>
                      ))}

                      {/* SCHEDULED sessions */}
                      {scheduledSessions.filter(s => s.status === 'scheduled').slice(0, 2).map(session => (
                        <div key={session._id} style={D.sessionCard}>
                          <div style={D.cardTopRow}>
                            <span style={D.scheduledBadge}>● Scheduled</span>
                            <button style={D.moreBtn}>⋮</button>
                          </div>
                          <div style={D.sessionName}>{session.sessionName}</div>
                          <div style={D.sessionMeta}>
                            {session.scheduledDate
                              ? new Date(session.scheduledDate).toLocaleDateString('en-US', { weekday:'long' }) + ' at ' + session.scheduledTime
                              : 'Time not set'}
                          </div>
                          <div style={D.pinBox}>
                            <div style={D.pinLabel}>ACCESS PIN</div>
                            <div style={D.pinValue}>{session.customPin || '------'}</div>
                          </div>
                          <div style={D.cardStats}>
                            <span>👥 {(session.registeredStudents || []).length} Students</span>
                            <span style={D.modBadge}>
                              {session.accessType === 'private' ? '🔒 Private' : '🌐 Public'}
                            </span>
                          </div>
                          <button style={D.manageBtn}>Manage Session</button>
                        </div>
                      ))}

                      {/* ENDED sessions */}
                      {endedGroups.slice(0, 2).map(group => (
                        <div key={group._id} style={{ ...D.sessionCard, opacity: 0.8 }}>
                          <div style={D.cardTopRow}>
                            <span style={D.endedBadge}>● Ended</span>
                            <button style={D.moreBtn}>⋮</button>
                          </div>
                          <div style={D.sessionName}>{group.groupName}</div>
                          <div style={D.sessionMeta}>
                            {formatDateTime(group.endedAt || group.createdAt).date}
                          </div>
                          <div style={D.pinBox}>
                            <div style={D.pinLabel}>ACCESS PIN</div>
                            <div style={D.pinValue}>
                              {group.pin?.replace(/(\d{3})(\d{3})/, '$1-$2')}
                            </div>
                          </div>
                          <div style={D.cardStats}>
                            <span>👥 {(group.members || []).length} Students attended</span>
                          </div>
                          {/* Session details: full info about ended session */}
                          <button
                            style={D.detailsBtn}
                            onClick={() => selectGroup(group._id ?? group.id)}
                          >
                            Session Details
                          </button>
                        </div>
                      ))}

                      {/* Empty state */}
                      {groups.length === 0 && scheduledSessions.length === 0 && (
                        <div style={D.emptyState}>
                          <div style={D.emptyIcon}>📚</div>
                          <p style={D.emptyTitle}>No sessions yet</p>
                          <p style={D.emptyText}>
                            Click "Plan Session" or "Create Instant" to get started
                          </p>
                          <button style={D.createBtn} onClick={() => setShowSchedule(true)}>
                            + Create Session
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Quick tools + activity */}
                  <div style={D.rightCol}>
                    <h3 style={D.rightTitle}>Quick Resource Tools</h3>

                    <div style={D.toolCard} onClick={() => setShowQuizCreator(true)}>
                      <span style={D.toolIconBox}>📝</span>
                      <div style={D.toolInfo}>
                        <div style={D.toolName}>Create New Quiz</div>
                        <div style={D.toolDesc}>Build questions & assign to classes</div>
                      </div>
                      <span style={D.toolArrow}>↗</span>
                    </div>

                    <div style={D.toolCard} onClick={() => setShowSchedule(true)}>
                      <span style={D.toolIconBox}>📅</span>
                      <div style={D.toolInfo}>
                        <div style={D.toolName}>Schedule Class</div>
                        <div style={D.toolDesc}>Pre-plan future sessions & PINs</div>
                      </div>
                      <span style={D.toolArrow}>↗</span>
                    </div>

                    <h3 style={{ ...D.rightTitle, marginTop: 20 }}>🛡 Classroom Vibe Control</h3>
                    <div style={D.vibeCard}>
                      <div style={D.vibeRow}>
                        <span>💬 Chat Moderation</span>
                        <span style={D.strictBadge}>Strict</span>
                      </div>
                      <div style={D.vibeRow}>
                        <span>⏱ Session starting and Ending</span>
                        <span style={{ color: '#9ca3af' }}>-- min</span>
                      </div>
                      <button style={D.rulesBtn}>Manage Global Rules</button>
                    </div>

                    <h3 style={{ ...D.rightTitle, marginTop: 20 }}>Recent Activity</h3>
                    {groups.slice(0, 4).map((g, i) => (
                      <div key={i} style={D.activityItem}>
                        <div style={D.actAvatar}>👤</div>
                        <div style={D.actText}>
                          <span style={D.actName}>{g.groupName}</span>
                          <span style={D.actDesc}> · {(g.members || []).length} members</span>
                        </div>
                        <div style={D.actTime}>{formatDateTime(g.createdAt).time}</div>
                      </div>
                    ))}

                    {/* Logout */}
                    <button onClick={handleLogout} style={D.logoutBtn}>Logout</button>
                  </div>

                </div>
              </div>
            </div>

          ) : (
            /* ══════════════════════════════════════
               STUDENT DASHBOARD — IDENTICAL to original
               ══════════════════════════════════════ */
            <div className="group-selector">
              <div className="dashboard-welcome">
                <h2>Welcome, {displayName}! 👋</h2>
                <p className="dashboard-subtitle">Your joined classrooms</p>
              </div>

              <div style={{ textAlign: 'center', margin: '20px 0' }}>
                <button
                  onClick={() => alert('Upcoming sessions feature - coming soon!')}
                  style={{
                    padding: '12px 24px', fontSize: '16px', fontWeight: '600',
                    backgroundColor: '#128C7E', color: 'white',
                    border: 'none', borderRadius: '8px', cursor: 'pointer'
                  }}
                >
                  📅 View Scheduled Sessions
                </button>
              </div>

              {groups.length > 0 ? (
                <div className="dashboard-content">
                  <div className="section-header">
                    <h3>My Classrooms</h3>
                    <span className="count-badge">{groups.length}</span>
                  </div>
                  <div className="classroom-grid">
                    {groups.map((group) => {
                      const { date, time } = formatDateTime(group.createdAt);
                      const teacherName = group.admin?.name || group.admin?.username || 'Unknown Teacher';
                      return (
                        <div
                          key={group._id ?? group.id}
                          className={`classroom-card ${!group.isActive ? 'inactive' : ''}`}
                        >
                          <div className="card-header">
                            <h4 className="classroom-name">{group.groupName}</h4>
                            <span className={group.isActive ? "badge-active" : "badge-ended"}>
                              {group.isActive ? 'Active' : 'Ended'}
                            </span>
                          </div>
                          <div className="card-body">
                            <div className="info-row teacher-info">
                              <span className="info-icon">👨‍🏫</span>
                              <span className="info-label">Teacher:</span>
                              <span className="info-value teacher-name">{teacherName}</span>
                            </div>
                            <div className="info-row">
                              <span className="info-icon">👥</span>
                              <span className="info-label">Students:</span>
                              <span className="info-value">{(group.members || []).length}</span>
                            </div>
                            {group.userJoinedAt ? (
                              <>
                                <div className="info-row">
                                  <span className="info-icon">📅</span>
                                  <span className="info-label">Joined:</span>
                                  <span className="info-value">{formatDateTime(group.userJoinedAt).date}</span>
                                </div>
                                <div className="info-row">
                                  <span className="info-icon">🕐</span>
                                  <span className="info-label">Time:</span>
                                  <span className="info-value">{formatDateTime(group.userJoinedAt).time}</span>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="info-row">
                                  <span className="info-icon">📅</span>
                                  <span className="info-label">Started:</span>
                                  <span className="info-value">{date}</span>
                                </div>
                                <div className="info-row">
                                  <span className="info-icon">🕐</span>
                                  <span className="info-label">Time:</span>
                                  <span className="info-value">{time}</span>
                                </div>
                              </>
                            )}
                          </div>
                          {group.isActive && (
                            <button
                              onClick={() => selectGroup(group._id ?? group.id)}
                              className="card-action-btn"
                            >
                              Join Classroom →
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="empty-state">
                  <div className="empty-icon">🎒</div>
                  <p className="empty-title">No classrooms joined</p>
                  <p className="empty-text">
                    Ask your teacher for a PIN or scan a QR code to join!
                  </p>
                </div>
              )}

              <button onClick={handleLogout} className="logout-btn">Logout</button>
            </div>
          )

        ) : (
          /* ══════════════════════════════════════
             CHAT VIEW — IDENTICAL to original
             ══════════════════════════════════════ */
          <>
            <ChatArea
              messages={messages}
              currentUserId={getUserId(user)}
              currentGroup={currentGroup}
              typingUsers={typingUsers}
              onMessageEdited={handleMessageEdited}
              onMessageDeleted={handleMessageDeleted}
            />
            <MessageInput
              onSendMessage={handleSendMessage}
              onTyping={handleTyping}
              onStopTyping={handleStopTyping}
              disabled={!currentGroup || !currentGroup.isActive}
              isAdmin={isAdmin}
              members={currentGroup.members || []}
            />
          </>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// INSTRUCTOR HUB STYLES
// ─────────────────────────────────────────
const D = {
  shell: { display:'flex', height:'100%', backgroundColor:'#f9fafb', overflow:'hidden' },

  sidebar: {
    width:220, flexShrink:0, backgroundColor:'white',
    borderRight:'1px solid #e5e7eb', display:'flex', flexDirection:'column',
    padding:'20px 0', overflowY:'auto'
  },
  sidebarLogo: { fontSize:'20px', fontWeight:'900', color:'#4F46E5', padding:'0 20px 24px', letterSpacing:'-0.5px' },
  navItem: {
    display:'flex', alignItems:'center', gap:'10px', padding:'10px 20px',
    border:'none', background:'none', fontSize:'14px', fontWeight:'500',
    color:'#6b7280', cursor:'pointer', width:'100%', textAlign:'left', transition:'all 0.15s'
  },
  navIcon: { fontSize:'16px', width:20, textAlign:'center' },
  sidebarSpacer: { flex:1 },
  sidebarUser: { display:'flex', alignItems:'center', gap:'10px', padding:'16px 20px', borderTop:'1px solid #e5e7eb' },
  userAvatar: {
    width:36, height:36, borderRadius:'50%', backgroundColor:'#EEF2FF',
    display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', flexShrink:0
  },
  userName: { fontSize:'13px', fontWeight:'700', color:'#111827' },
  userRole: { fontSize:'11px', color:'#9ca3af' },

  main: { flex:1, overflowY:'auto', padding:'28px' },
  topBar: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px' },
  pageTitle: { fontSize:'24px', fontWeight:'800', color:'#111827' },
  topActions: { display:'flex', gap:'10px' },
  planBtn: {
    padding:'10px 18px', border:'1.5px solid #e5e7eb', borderRadius:'8px',
    background:'white', fontSize:'14px', fontWeight:'600', color:'#374151', cursor:'pointer'
  },
  createBtn: {
    padding:'10px 18px', border:'none', borderRadius:'8px',
    backgroundColor:'#4F46E5', color:'white', fontSize:'14px', fontWeight:'700', cursor:'pointer'
  },

  statsRow: { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'16px', marginBottom:'28px' },
  statCard: {
    backgroundColor:'white', borderRadius:'12px', padding:'20px',
    border:'1px solid #e5e7eb', position:'relative', overflow:'hidden'
  },
  statIcon: { fontSize:'24px', marginBottom:'8px' },
  statTrend: { position:'absolute', top:16, right:16, fontSize:'12px', fontWeight:'600', color:'#10B981' },
  statLabel: { fontSize:'13px', color:'#6b7280', fontWeight:'500', marginBottom:'4px' },
  statValue: { fontSize:'28px', fontWeight:'800', color:'#111827' },
  statSub: { fontSize:'12px', color:'#9ca3af', marginTop:'2px' },

  contentRow: { display:'flex', gap:'24px', alignItems:'flex-start' },
  sessionsCol: { flex:1, minWidth:0 },
  sectionBar: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' },
  sectionTitle: { fontSize:'18px', fontWeight:'700', color:'#111827' },
  viewAllBtn: { background:'none', border:'none', color:'#4F46E5', fontSize:'13px', fontWeight:'600', cursor:'pointer' },

  sessionGrid: { display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:'16px' },
  sessionCard: {
    backgroundColor:'white', borderRadius:'12px', padding:'18px',
    border:'1px solid #e5e7eb', boxShadow:'0 1px 4px rgba(0,0,0,0.05)'
  },
  cardTopRow: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' },
  liveBadge: { fontSize:'12px', fontWeight:'700', color:'#DC2626', backgroundColor:'#FEE2E2', padding:'4px 10px', borderRadius:'20px' },
  scheduledBadge: { fontSize:'12px', fontWeight:'700', color:'#D97706', backgroundColor:'#FEF3C7', padding:'4px 10px', borderRadius:'20px' },
  endedBadge: { fontSize:'12px', fontWeight:'700', color:'#6b7280', backgroundColor:'#F3F4F6', padding:'4px 10px', borderRadius:'20px' },
  moreBtn: { background:'none', border:'none', color:'#9ca3af', cursor:'pointer', fontSize:'18px' },
  sessionName: { fontSize:'15px', fontWeight:'700', color:'#111827', marginBottom:'4px' },
  sessionMeta: { fontSize:'12px', color:'#6b7280', marginBottom:'12px' },
  pinBox: { backgroundColor:'#f9fafb', borderRadius:'8px', padding:'12px', textAlign:'center', marginBottom:'12px' },
  pinLabel: { fontSize:'10px', fontWeight:'700', color:'#9ca3af', letterSpacing:'1px' },
  pinValue: { fontSize:'22px', fontWeight:'900', color:'#111827', letterSpacing:'3px', marginTop:'4px' },
  cardStats: { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px', fontSize:'12px', color:'#6b7280' },
  modBadge: { fontSize:'11px', color:'#6b7280' },
  joinBtn: { width:'100%', padding:'10px', backgroundColor:'#4F46E5', color:'white', border:'none', borderRadius:'8px', fontSize:'13px', fontWeight:'700', cursor:'pointer' },
  manageBtn: { width:'100%', padding:'10px', backgroundColor:'white', color:'#374151', border:'1.5px solid #e5e7eb', borderRadius:'8px', fontSize:'13px', fontWeight:'600', cursor:'pointer' },
  detailsBtn: { width:'100%', padding:'10px', backgroundColor:'white', color:'#374151', border:'1.5px solid #e5e7eb', borderRadius:'8px', fontSize:'13px', fontWeight:'600', cursor:'pointer' },
  emptyState: { gridColumn:'1/-1', textAlign:'center', padding:'60px 20px' },
  emptyIcon: { fontSize:'48px', marginBottom:'12px' },
  emptyTitle: { fontSize:'18px', fontWeight:'600', color:'#374151', marginBottom:'8px' },
  emptyText: { fontSize:'14px', color:'#6b7280', marginBottom:'16px' },

  rightCol: { width:280, flexShrink:0 },
  rightTitle: { fontSize:'15px', fontWeight:'700', color:'#111827', marginBottom:'12px' },
  toolCard: {
    display:'flex', alignItems:'center', gap:'12px', padding:'14px',
    backgroundColor:'white', borderRadius:'10px', border:'1px solid #e5e7eb',
    marginBottom:'10px', cursor:'pointer', transition:'all 0.2s'
  },
  toolIconBox: {
    fontSize:'18px', width:36, height:36, backgroundColor:'#EEF2FF',
    borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center'
  },
  toolInfo: { flex:1 },
  toolName: { fontSize:'14px', fontWeight:'600', color:'#111827' },
  toolDesc: { fontSize:'12px', color:'#6b7280', marginTop:'2px' },
  toolArrow: { fontSize:'14px', color:'#9ca3af' },

  vibeCard: { backgroundColor:'white', borderRadius:'10px', border:'1px solid #e5e7eb', padding:'14px', marginBottom:'10px' },
  vibeRow: { display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'13px', color:'#374151', marginBottom:'10px' },
  strictBadge: { fontSize:'11px', fontWeight:'700', backgroundColor:'#FEF3C7', color:'#92400E', padding:'3px 8px', borderRadius:'6px' },
  rulesBtn: { width:'100%', padding:'8px', border:'1.5px solid #e5e7eb', borderRadius:'8px', background:'white', fontSize:'13px', fontWeight:'600', color:'#374151', cursor:'pointer', marginTop:'4px' },

  activityItem: { display:'flex', alignItems:'center', gap:'10px', padding:'10px 0', borderBottom:'1px solid #f3f4f6' },
  actAvatar: { width:32, height:32, borderRadius:'50%', backgroundColor:'#e5e7eb', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px', flexShrink:0 },
  actText: { flex:1, fontSize:'13px' },
  actName: { fontWeight:'600', color:'#111827' },
  actDesc: { color:'#6b7280' },
  actTime: { fontSize:'11px', color:'#9ca3af' },

  logoutBtn: {
    marginTop:24, width:'100%', padding:'10px', border:'1.5px solid #e5e7eb',
    borderRadius:'8px', background:'white', fontSize:'13px', fontWeight:'600',
    color:'#6b7280', cursor:'pointer'
  }
};

export default App;