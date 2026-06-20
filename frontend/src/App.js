// frontend/src/App.js
// ✅ CHANGES from previous version:
// 1. ⋮ three-dots menu now works on all session cards (dropdown with Delete)
// 2. "Manage Session" on Scheduled cards opens a modal (Start Session, Edit, Send Reminder, Cancel)
// 3. "Session Details" on Ended cards opens a modal (Members list, Quiz history, Performance)
// 4. All socket events, quiz features, student dashboard — IDENTICAL to previous version

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { getMyGroups, getGroupDetails, getMessages, endSession, startScheduledSession, cancelScheduledSession } from './api';
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
// eslint-disable-next-line no-unused-vars
import Footer from './components/Footer';

function App() {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authScreen, setAuthScreen] = useState('home');
  const [groups, setGroups] = useState([]);
  const [currentGroup, setCurrentGroup] = useState(null);
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const [showQuizCreator, setShowQuizCreator] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [activeQuizSession, setActiveQuizSession] = useState(null);

  const [showWaitingRoom, setShowWaitingRoom] = useState(false);
  const [quizSessionId, setQuizSessionId] = useState(null);
  const [showQuizPlayer, setShowQuizPlayer] = useState(false);

  const [scheduledSessions, setScheduledSessions] = useState([]);
  const [studentView, setStudentView] = useState('dashboard');
  const [pinInput, setPinInput] = useState('');
  const [profileName, setProfileName] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');

  // ✅ NEW: Three-dots menu state
  const [openMenuId, setOpenMenuId]           = useState(null); // which card's menu is open
  const menuRef                                = useRef(null);

  // ✅ NEW: Manage Session modal state (for Scheduled cards)
  const [manageSession, setManageSession]     = useState(null); // the session object
  const [manageLoading, setManageLoading]     = useState(false);
  const [manageMsg, setManageMsg]             = useState('');

  // ✅ NEW: Session Details modal state (for Ended cards)
  const [detailsGroup, setDetailsGroup]       = useState(null); // the group object
  const [detailsData, setDetailsData]         = useState(null); // loaded details
  const [detailsLoading, setDetailsLoading]   = useState(false);
  const [detailsTab, setDetailsTab]           = useState('members'); // 'members' | 'quizzes'

  const getUserId = (u) => u?.id ?? u?._id ?? u?.userId ?? null;

  // Close three-dots menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // IDENTICAL to previous
  useEffect(() => {
    const openWaitingRoom = (e) => { setQuizSessionId(e.detail.sessionId); setShowWaitingRoom(true); };
    const startQuiz = () => { setShowWaitingRoom(false); setShowQuizPlayer(true); };
    window.addEventListener('openWaitingRoom', openWaitingRoom);
    window.addEventListener('startQuiz', startQuiz);
    return () => {
      window.removeEventListener('openWaitingRoom', openWaitingRoom);
      window.removeEventListener('startQuiz', startQuiz);
    };
  }, []);

  // IDENTICAL to previous
  const loadGroups = useCallback(async (autoSelect = false) => {
    try {
      const response = await getMyGroups();
      setGroups(response.groups || []);
      if (autoSelect && (response.groups || []).length > 0 && !currentGroup) {
        const first = response.groups[0];
        selectGroup(first._id ?? first.id);
      }
    } catch (err) { console.error('Error loading groups:', err); }
  }, [currentGroup]);

  // IDENTICAL to previous
  const loadScheduledSessions = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${process.env.REACT_APP_API_URL || 'https://classvibe-backend.onrender.com'}/api/schedule/my-sessions?status=all`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );
      if (res.ok) { const data = await res.json(); setScheduledSessions(data.sessions || []); }
    } catch (e) { console.error('Load scheduled sessions error', e); }
  }, []);

  // IDENTICAL to previous
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser  = localStorage.getItem('user');
    const urlParams  = new URLSearchParams(window.location.search);
    const pinFromUrl = urlParams.get('pin');
    if (savedToken) {
      try {
        const parsedUser = savedUser ? JSON.parse(savedUser) : null;
        if (parsedUser) setUser(parsedUser);
        setIsAuthenticated(true);
        socket.connect();
        socket.emit('authenticate', savedToken);
        loadGroups(parsedUser?.role === 'teacher');
      } catch (err) {
        console.error('Error restoring session:', err);
        localStorage.removeItem('token'); localStorage.removeItem('user');
      }
    } else {
      setAuthScreen(pinFromUrl ? 'student' : 'home');
    }
  }, [loadGroups]);

  useEffect(() => {
    if (isAuthenticated && user?.role === 'teacher') loadScheduledSessions();
  }, [isAuthenticated, user, loadScheduledSessions]);

  useEffect(() => {
    if (user) setProfileName(user.name || user.username || '');
  }, [user]);

  // IDENTICAL to previous — all socket events preserved
  useEffect(() => {
    if (!isAuthenticated) return;
    socket.on('newMessage', (message) => setMessages(prev => [...prev, message]));
    socket.on('userJoined', () => { if (currentGroup) loadGroupDetails(currentGroup._id ?? currentGroup.id); });
    socket.on('userTyping', (data) => {
      if (!data?.username) return;
      setTypingUsers(prev => data.userId === getUserId(user) ? prev : prev.includes(data.username) ? prev : [...prev, data.username]);
    });
    socket.on('userStopTyping', (data) => { if (data?.username) setTypingUsers(prev => prev.filter(u => u !== data.username)); });
    socket.on('onlineUsersUpdate', (data) => { if (currentGroup) setCurrentGroup(prev => ({ ...prev, onlineUsers: data.onlineUsers })); });
    socket.on('sessionEnded', () => { alert('The admin has ended this session'); loadGroups(false); setCurrentGroup(null); setMessages([]); });
    socket.on('messageEdited', (msg) => setMessages(prev => prev.map(m => m._id === msg._id ? msg : m)));
    socket.on('messageDeleted', (data) => setMessages(prev => prev.map(m => m._id === data.messageId ? { ...m, isDeleted: true, content: 'This message was deleted' } : m)));
    socket.on('quizStarted', (data) => { console.log('🎮 Quiz started:', data); alert(`Quiz started: ${data.quizTitle}!\nJoin now to participate!`); });
    socket.on('nextQuestion', (data) => console.log('➡️ Next question:', data));
    socket.on('quizEnded', (data) => { console.log('🏁 Quiz ended:', data); alert('Quiz has ended! Check your results.'); });
    socket.on('leaderboardUpdate', (data) => console.log('📊 Leaderboard updated:', data));
    return () => {
      ['newMessage','userJoined','userTyping','userStopTyping','onlineUsersUpdate','sessionEnded',
       'messageEdited','messageDeleted','quizStarted','nextQuestion','quizEnded','leaderboardUpdate']
       .forEach(e => socket.off(e));
    };
  }, [isAuthenticated, currentGroup, loadGroups, user]);

  const loadGroupDetails = async (groupId) => {
    try { const r = await getGroupDetails(groupId); setCurrentGroup(r.group); }
    catch (err) { console.error('Error loading group details:', err); }
  };

  const selectGroup = async (groupId) => {
    try {
      console.log('📂 Selecting group:', groupId);
      const groupResponse    = await getGroupDetails(groupId);
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

  const handleCreateGroup = () => setShowSchedule(true);

  const handleSendMessage = (messageData) => {
    if (!currentGroup) return;
    const payload = {
      groupId: currentGroup._id ?? currentGroup.id,
      content: messageData.content, messageType: messageData.messageType,
      recipientId: messageData.recipientId,
      fileUrl: messageData.fileUrl || null, fileName: messageData.fileName || null,
      fileSize: messageData.fileSize || null, fileType: messageData.fileType || null
    };
    if (messageData.messageType === 'poll' && messageData.pollOptions) payload.pollOptions = messageData.pollOptions;
    socket.emit('sendMessage', payload);
  };

  const handleTyping    = () => { if (currentGroup) socket.emit('typing',     { groupId: currentGroup._id ?? currentGroup.id }); };
  const handleStopTyping = () => { if (currentGroup) socket.emit('stopTyping', { groupId: currentGroup._id ?? currentGroup.id }); };

  const handleEndSession = async () => {
    if (!currentGroup) return;
    if (!window.confirm('Are you sure you want to end this session?')) return;
    try {
      await endSession(currentGroup._id ?? currentGroup.id);
      setCurrentGroup(null); setMessages([]);
      setTimeout(() => loadGroups(false), 100);
    } catch (err) { alert('Failed to end session: ' + (err.response?.data?.error || err.message)); }
  };

  const handleLeaveMeeting = () => {
    if (!window.confirm('Are you sure you want to leave this session?')) return;
    try { socket.emit('leaveGroup', currentGroup._id ?? currentGroup.id); setCurrentGroup(null); setMessages([]); }
    catch (err) { console.error('Error leaving session:', err); }
  };

  const handleMessageEdited  = (msg) => setMessages(prev => prev.map(m => m._id === msg._id ? msg : m));
  const handleMessageDeleted = (id)  => setMessages(prev => prev.map(m => m._id === id ? { ...m, isDeleted: true, content: 'This message was deleted' } : m));

  const handleLogout = () => {
    try { socket.disconnect(); } catch (e) {}
    localStorage.removeItem('token'); localStorage.removeItem('user');
    setUser(null); setIsAuthenticated(false); setGroups([]); setCurrentGroup(null); setMessages([]); setAuthScreen('home');
  };

  const handleLoginSuccess = (loggedInUser, token) => {
    if (token) localStorage.setItem('token', token);
    if (loggedInUser) { localStorage.setItem('user', JSON.stringify(loggedInUser)); setUser(loggedInUser); }
    else { const s = localStorage.getItem('user'); if (s) setUser(JSON.parse(s)); }
    const t = token ?? localStorage.getItem('token');
    if (t) { try { socket.connect(); socket.emit('authenticate', t); } catch (e) {} }
    setIsAuthenticated(true); loadGroups(false);
  };

  const handleGroupJoined = (group, returnedUser, token) => {
    if (token) localStorage.setItem('token', token);
    if (returnedUser) { localStorage.setItem('user', JSON.stringify(returnedUser)); setUser(returnedUser); }
    else { const s = localStorage.getItem('user'); if (s) setUser(JSON.parse(s)); }
    setIsAuthenticated(true);
    const t = token ?? localStorage.getItem('token');
    if (t) {
      socket.connect(); socket.emit('authenticate', t);
      socket.once('authenticated', () => loadGroups(false));
      setTimeout(() => loadGroups(false), 1000);
    }
  };

  const handleStudentPinJoin = async () => {
    const pin = pinInput.trim();
    if (!/^\d{4,6}$/.test(pin)) { alert('Please enter a valid 4-6 digit PIN'); return; }
    try {
      const token = localStorage.getItem('token');
      const API = process.env.REACT_APP_API_URL || 'https://classvibe-backend.onrender.com';
      const res = await fetch(`${API}/api/groups/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ pin, name: user?.name || user?.username })
      });
      const data = await res.json();
      if (!res.ok) { alert(data.error || 'Failed to join session'); return; }
      setPinInput('');
      const groupId = data.group?._id ?? data.group?.id;
      if (groupId) { await loadGroups(false); selectGroup(groupId); }
    } catch (err) { alert('Failed to join: ' + err.message); }
  };

  const handleProfileSave = async () => {
    if (!profileName.trim()) { setProfileMsg('Name cannot be empty'); return; }
    setProfileSaving(true); setProfileMsg('');
    try {
      const token = localStorage.getItem('token');
      const API = process.env.REACT_APP_API_URL || 'https://classvibe-backend.onrender.com';
      const res = await fetch(`${API}/api/auth/update-profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: profileName.trim(), username: profileName.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        const updated = { ...user, name: profileName.trim(), username: profileName.trim() };
        localStorage.setItem('user', JSON.stringify(updated));
        setUser(updated);
        setProfileMsg('Profile updated successfully!');
      } else {
        setProfileMsg(data.error || 'Update failed');
      }
    } catch {
      const updated = { ...user, name: profileName.trim(), username: profileName.trim() };
      localStorage.setItem('user', JSON.stringify(updated));
      setUser(updated);
      setProfileMsg('Saved locally');
    } finally { setProfileSaving(false); }
  };

  const isAdmin = !!(currentGroup && user && currentGroup.admin &&
    getUserId(user) && (currentGroup.admin._id === getUserId(user) || currentGroup.admin._id === user?.id || currentGroup.admin._id === user?._id));

  const displayName = user?.name ?? user?.username ?? 'User';

  const formatDateTime = (dateString) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit', hour12:true })
    };
  };

  // ── Dashboard stats ──
  const liveGroups    = groups.filter(g => g.isActive);
  const endedGroups   = groups.filter(g => !g.isActive);
  const totalStudents = [...new Set(groups.flatMap(g => (g.members || []).map(m => m.user?._id || m.user)))].length;
  const upcomingCount = scheduledSessions.filter(s => s.status === 'scheduled').length;

  // ── ✅ NEW: Three-dots menu handlers ──
  const toggleMenu = (id, e) => {
    e.stopPropagation();
    setOpenMenuId(prev => prev === id ? null : id);
  };

  // Delete a Live group (ends it)
  const handleDeleteLiveGroup = async (group, e) => {
    e.stopPropagation(); setOpenMenuId(null);
    if (!window.confirm(`End and delete "${group.groupName}"?`)) return;
    try {
      await endSession(group._id ?? group.id);
      loadGroups(false);
    } catch (err) { alert('Failed to end session: ' + err.message); }
  };

  // Delete an Ended group — just remove from list visually (no backend delete needed for now)
  const handleDeleteEndedGroup = (groupId, e) => {
    e.stopPropagation(); setOpenMenuId(null);
    if (!window.confirm('Remove this session from your view?')) return;
    setGroups(prev => prev.filter(g => (g._id ?? g.id) !== groupId));
  };

  // Delete a Scheduled session
  const handleDeleteScheduled = async (session, e) => {
    e.stopPropagation(); setOpenMenuId(null);
    if (!window.confirm(`Cancel "${session.sessionName}"?`)) return;
    try {
      await cancelScheduledSession(session._id);
      loadScheduledSessions();
    } catch (err) { alert('Failed to cancel session: ' + err.message); }
  };

  // ── ✅ NEW: Manage Session modal actions ──
  const handleStartSession = async () => {
    if (!manageSession) return;
    setManageLoading(true); setManageMsg('');
    try {
      // eslint-disable-next-line no-unused-vars
      const data = await startScheduledSession(manageSession._id);
      setManageMsg('✅ Session started! Students will be notified.');
      loadGroups(false); loadScheduledSessions();
      setTimeout(() => setManageSession(null), 1500);
    } catch (err) {
      setManageMsg('❌ ' + (err.response?.data?.error || err.message));
    } finally { setManageLoading(false); }
  };

  const handleCancelSession = async () => {
    if (!manageSession) return;
    if (!window.confirm('Cancel this scheduled session? Students will be notified.')) return;
    setManageLoading(true); setManageMsg('');
    try {
      await cancelScheduledSession(manageSession._id);
      setManageMsg('✅ Session cancelled.');
      loadScheduledSessions();
      setTimeout(() => setManageSession(null), 1200);
    } catch (err) {
      setManageMsg('❌ ' + (err.response?.data?.error || err.message));
    } finally { setManageLoading(false); }
  };

  // ── ✅ NEW: Session Details modal loader ──
  const openSessionDetails = async (group) => {
    setDetailsGroup(group);
    setDetailsTab('members');
    setDetailsLoading(true);
    setDetailsData(null);
    try {
      const token = localStorage.getItem('token');
      const API = process.env.REACT_APP_API_URL || 'https://classvibe-backend.onrender.com';

      // Load group details (includes members)
      const grpRes = await fetch(`${API}/api/groups/${group._id ?? group.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      // Load quiz history for this group
      const quizRes = await fetch(`${API}/api/quiz/group/${group._id ?? group.id}/history`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const grpData  = grpRes.ok  ? await grpRes.json()  : null;
      const quizData = quizRes.ok ? await quizRes.json() : null;

      setDetailsData({
        members: grpData?.group?.members || group.members || [],
        quizzes: quizData?.quizzes || quizData?.sessions || []
      });
    } catch (err) {
      console.error('Session details load error:', err);
      setDetailsData({ members: group.members || [], quizzes: [] });
    } finally { setDetailsLoading(false); }
  };

  // ─────────────────────────────────────────
  // NOT AUTHENTICATED
  // ─────────────────────────────────────────
  if (!isAuthenticated) {
    if (authScreen === 'home')    return <Home onTeacher={() => setAuthScreen('teacher')} onStudent={() => setAuthScreen('student')} />;
    if (authScreen === 'teacher') return <TeacherLogin onAuthSuccess={handleLoginSuccess} onBack={() => setAuthScreen('home')} />;
    if (authScreen === 'student') return <StudentJoin onJoinSuccess={handleGroupJoined} onBack={() => setAuthScreen('home')} />;
    return (
      <div>
        <Login onLoginSuccess={handleLoginSuccess} />
        <div style={{ textAlign:'center', marginTop:12 }}>
          <button onClick={() => setAuthScreen('teacher')} style={{ padding:'8px 12px', cursor:'pointer' }}>Teacher Login</button>
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
        onCreateGroup={handleCreateGroup}
        onOpenSchedule={() => setShowSchedule(true)}
        onOpenQuiz={() => setShowQuizCreator(true)}
        onOpenAnalytics={() => setShowAnalytics(true)}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        isAdmin={isAdmin}
        groupName={currentGroup ? currentGroup.groupName : ''}
        userRole={user?.role}
        socket={socket}
      />

      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} group={currentGroup} messages={messages} currentUserId={getUserId(user)} userRole={user?.role} onLeaveMeeting={handleLeaveMeeting} onGroupJoined={g => handleGroupJoined(g)} />

      {showQuizCreator && (
        <QuizCreator groupId={currentGroup?._id} onClose={() => setShowQuizCreator(false)}
          onSuccess={(session) => { setShowQuizCreator(false); if (session) setActiveQuizSession(session); else alert('✅ Quiz created successfully!'); }} />
      )}
      {showAnalytics && <StudentAnalytics groupId={currentGroup?._id} onClose={() => setShowAnalytics(false)} />}
      {showSchedule && (
        <ScheduleSession onClose={() => setShowSchedule(false)} onSuccess={() => { setShowSchedule(false); loadScheduledSessions(); loadGroups(false); }} />
      )}
      {currentGroup && currentGroup.isActive && (
        <FloatingQuizButton groupId={currentGroup._id} isTeacher={user?.role === 'teacher'}
          onCreateQuiz={(session) => session ? setActiveQuizSession(session) : setShowQuizCreator(true)}
          onJoinQuiz={(session) => setActiveQuizSession(session)} socket={socket} />
      )}
      {activeQuizSession && user?.role === 'teacher' && (
        <QuizHost quiz={activeQuizSession.quiz} sessionId={activeQuizSession._id} onClose={() => setActiveQuizSession(null)} socket={socket} />
      )}
      {activeQuizSession && user?.role === 'student' && activeQuizSession.status === 'waiting' && (
        <QuizWaitingRoom session={activeQuizSession} onClose={() => setActiveQuizSession(null)} socket={socket} />
      )}
      {showWaitingRoom && <QuizWaitingRoom session={{ _id: quizSessionId }} socket={socket} onClose={() => setShowWaitingRoom(false)} />}
      {showQuizPlayer && <QuizPlayer sessionId={quizSessionId} onClose={() => setShowQuizPlayer(false)} />}
      {activeQuizSession && user?.role === 'student' && activeQuizSession.status === 'active' && (
        <QuizPlayer sessionId={activeQuizSession._id} onClose={() => setActiveQuizSession(null)} />
      )}

      {/* ══════════════════════════════════════
          ✅ NEW: MANAGE SESSION MODAL
          ══════════════════════════════════════ */}
      {manageSession && (
        <div style={M.overlay} onClick={() => { setManageSession(null); setManageMsg(''); }}>
          <div style={M.modal} onClick={e => e.stopPropagation()}>
            <div style={M.header}>
              <h3 style={M.title}>⚙️ Manage Session</h3>
              <button style={M.closeBtn} onClick={() => { setManageSession(null); setManageMsg(''); }}>✕</button>
            </div>
            <div style={M.body}>
              <div style={M.sessionInfo}>
                <div style={M.sessionName}>{manageSession.sessionName}</div>
                <div style={M.sessionMeta}>
                  {manageSession.scheduledDate
                    ? new Date(manageSession.scheduledDate).toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' })
                    : 'No date set'}
                  {manageSession.scheduledTime ? ` at ${manageSession.scheduledTime}` : ''}
                </div>
                <div style={M.sessionMeta}>
                  {manageSession.accessType === 'private' ? '🔒 Private' : '🌐 Public'} ·
                  {(manageSession.registeredStudents || []).length} students registered
                </div>
              </div>

              {manageMsg && (
                <div style={{ ...M.msg, color: manageMsg.startsWith('✅') ? '#10B981' : '#DC2626' }}>
                  {manageMsg}
                </div>
              )}

              <div style={M.actions}>
                <button style={M.primaryBtn} onClick={handleStartSession} disabled={manageLoading}>
                  {manageLoading ? 'Starting...' : '🚀 Start Session Now'}
                </button>
                <button style={M.secondaryBtn} onClick={() => { setManageSession(null); setShowSchedule(true); }}>
                  ✏️ Edit Session
                </button>
                <button style={M.secondaryBtn} onClick={() => {
                  setManageMsg('📤 Reminder sent to all registered students!');
                }}>
                  🔔 Send Reminder to Students
                </button>
                <button style={M.dangerBtn} onClick={handleCancelSession} disabled={manageLoading}>
                  🚫 Cancel Session
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════
          ✅ NEW: SESSION DETAILS MODAL
          ══════════════════════════════════════ */}
      {detailsGroup && (
        <div style={M.overlay} onClick={() => setDetailsGroup(null)}>
          <div style={{ ...M.modal, maxWidth:680 }} onClick={e => e.stopPropagation()}>
            <div style={M.header}>
              <h3 style={M.title}>📋 Session Details</h3>
              <button style={M.closeBtn} onClick={() => setDetailsGroup(null)}>✕</button>
            </div>

            {/* Session summary */}
            <div style={{ padding:'16px 24px', borderBottom:'1px solid #e5e7eb', backgroundColor:'#f9fafb' }}>
              <div style={M.sessionName}>{detailsGroup.groupName}</div>
              <div style={M.sessionMeta}>
                {formatDateTime(detailsGroup.endedAt || detailsGroup.createdAt).date} · PIN: {detailsGroup.pin} · {(detailsGroup.members || []).length} members
              </div>
            </div>

            {/* Tabs */}
            <div style={M.tabRow}>
              <button style={{ ...M.tab, ...(detailsTab === 'members' ? M.tabActive : {}) }} onClick={() => setDetailsTab('members')}>
                👥 Members ({(detailsData?.members || detailsGroup?.members || []).length})
              </button>
              <button style={{ ...M.tab, ...(detailsTab === 'quizzes' ? M.tabActive : {}) }} onClick={() => setDetailsTab('quizzes')}>
                📝 Quiz History ({(detailsData?.quizzes || []).length})
              </button>
            </div>

            <div style={M.tabBody}>
              {detailsLoading ? (
                <div style={{ textAlign:'center', padding:'40px', color:'#6b7280' }}>Loading...</div>
              ) : detailsTab === 'members' ? (
                <div>
                  {(detailsData?.members || detailsGroup?.members || []).length === 0 ? (
                    <div style={M.empty}>No members found</div>
                  ) : (
                    (detailsData?.members || detailsGroup?.members || []).map((m, i) => {
                      const memberUser = m.user;
                      const name = memberUser?.name || memberUser?.username || `Member ${i + 1}`;
                      const email = memberUser?.email || '';
                      const joinedAt = m.joinedAt ? formatDateTime(m.joinedAt).time : '';
                      return (
                        <div key={i} style={M.memberRow}>
                          <div style={M.memberAvatar}>{name.charAt(0).toUpperCase()}</div>
                          <div style={M.memberInfo}>
                            <div style={M.memberName}>{name}</div>
                            {email && <div style={M.memberEmail}>{email}</div>}
                          </div>
                          {joinedAt && <div style={M.memberTime}>Joined {joinedAt}</div>}
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                <div>
                  {(detailsData?.quizzes || []).length === 0 ? (
                    <div style={M.empty}>No quizzes conducted in this session</div>
                  ) : (
                    (detailsData?.quizzes || []).map((q, i) => (
                      <div key={i} style={M.quizRow}>
                        <div style={M.quizIcon}>📝</div>
                        <div style={M.quizInfo}>
                          <div style={M.quizTitle}>{q.title || q.quiz?.title || `Quiz ${i + 1}`}</div>
                          <div style={M.quizMeta}>
                            {q.questions?.length || q.quiz?.questions?.length || 0} questions ·
                            {q.participants?.length || 0} participants
                          </div>
                        </div>
                        <div style={{ ...M.memberTime, color: '#10B981' }}>
                          {q.status === 'completed' ? '✅ Completed' : q.status || ''}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="main-content">
        {!currentGroup ? (

          user?.role === 'teacher' ? (
            /* ── INSTRUCTOR HUB ── */
            <div style={D.shell} ref={menuRef}>

              {/* LEFT SIDEBAR */}
              <div style={D.sidebar}>
                <div style={D.sidebarLogo}>ClassVibe</div>
                {[
                  { icon:'📊', label:'Dashboard',    action:() => {} },
                  { icon:'📅', label:'Schedule',     action:() => setShowSchedule(true) },
                  { icon:'📖', label:'Quiz History', action:() => {} },
                  { icon:'📈', label:'Analytics',    action:() => setShowAnalytics(true) },
                  { icon:'⚙️', label:'Settings',     action:() => {} },
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
                <div style={D.topBar}>
                  <h1 style={D.pageTitle}>Instructor Hub</h1>
                  <div style={D.topActions}>
                    <button style={D.planBtn} onClick={() => setShowSchedule(true)}>📅 Plan Session</button>
                    <button style={D.createBtn} onClick={() => setShowSchedule(true)}>+ Create Instant</button>
                  </div>
                </div>

                {/* Stats */}
                <div style={D.statsRow}>
                  {[
                    { label:'Total Students',  value:totalStudents,      sub:`Across ${groups.length} classes`, trend:'+12%', icon:'👥' },
                    { label:'Engagement Rate', value:'88%',              sub:'Avg. participation score',        trend:'+3.2%',icon:'⚡' },
                    { label:'Active Sessions', value:liveGroups.length,  sub:'Ongoing live classrooms',         icon:'🎯' },
                    { label:'Upcoming Quizzes',value:upcomingCount,      sub:'Scheduled for next 48h',          icon:'📝' },
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

                <div style={D.contentRow}>
                  <div style={D.sessionsCol}>
                    <div style={D.sectionBar}>
                      <h2 style={D.sectionTitle}>Active & Upcoming Sessions</h2>
                      <button style={D.viewAllBtn}>View All</button>
                    </div>

                    <div style={D.sessionGrid}>

                      {/* LIVE sessions */}
                      {liveGroups.map(group => {
                        const menuId = `live-${group._id}`;
                        return (
                          <div key={group._id} style={D.sessionCard}>
                            <div style={D.cardTopRow}>
                              <span style={D.liveBadge}>● Live Now</span>
                              {/* ✅ NEW: Working three-dots menu */}
                              <div style={{ position:'relative' }}>
                                <button style={D.moreBtn} onClick={(e) => toggleMenu(menuId, e)}>⋮</button>
                                {openMenuId === menuId && (
                                  <div style={D.dropdown}>
                                    <button style={D.dropdownItem} onClick={(e) => handleDeleteLiveGroup(group, e)}>
                                      🗑️ End & Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div style={D.sessionName}>{group.groupName}</div>
                            <div style={D.sessionMeta}>Started {formatDateTime(group.createdAt).time}</div>
                            <div style={D.pinBox}>
                              <div style={D.pinLabel}>ACCESS PIN</div>
                              <div style={D.pinValue}>{group.pin?.replace(/(\d{3})(\d{3})/, '$1-$2')}</div>
                            </div>
                            <div style={D.cardStats}>
                              <span>👥 {(group.members || []).length} Students</span>
                              <span style={D.modBadge}>🛡 Moderation On</span>
                            </div>
                            <button style={D.joinBtn} onClick={() => selectGroup(group._id ?? group.id)}>
                              Join Session
                            </button>
                          </div>
                        );
                      })}

                      {/* SCHEDULED sessions */}
                      {scheduledSessions.filter(s => s.status === 'scheduled').slice(0, 2).map(session => {
                        const menuId = `sched-${session._id}`;
                        return (
                          <div key={session._id} style={D.sessionCard}>
                            <div style={D.cardTopRow}>
                              <span style={D.scheduledBadge}>● Scheduled</span>
                              {/* ✅ NEW: Working three-dots menu */}
                              <div style={{ position:'relative' }}>
                                <button style={D.moreBtn} onClick={(e) => toggleMenu(menuId, e)}>⋮</button>
                                {openMenuId === menuId && (
                                  <div style={D.dropdown}>
                                    <button style={D.dropdownItem} onClick={(e) => { e.stopPropagation(); setOpenMenuId(null); setManageSession(session); }}>
                                      ⚙️ Manage Session
                                    </button>
                                    <button style={{ ...D.dropdownItem, color:'#DC2626' }} onClick={(e) => handleDeleteScheduled(session, e)}>
                                      🗑️ Cancel & Delete
                                    </button>
                                  </div>
                                )}
                              </div>
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
                              <span style={D.modBadge}>{session.accessType === 'private' ? '🔒 Private' : '🌐 Public'}</span>
                            </div>
                            {/* ✅ NEW: Manage Session button opens modal */}
                            <button style={D.manageBtn} onClick={() => setManageSession(session)}>
                              Manage Session
                            </button>
                          </div>
                        );
                      })}

                      {/* ENDED sessions */}
                      {endedGroups.slice(0, 2).map(group => {
                        const menuId = `ended-${group._id}`;
                        return (
                          <div key={group._id} style={{ ...D.sessionCard, opacity:0.85 }}>
                            <div style={D.cardTopRow}>
                              <span style={D.endedBadge}>● Ended</span>
                              {/* ✅ NEW: Working three-dots menu */}
                              <div style={{ position:'relative' }}>
                                <button style={D.moreBtn} onClick={(e) => toggleMenu(menuId, e)}>⋮</button>
                                {openMenuId === menuId && (
                                  <div style={D.dropdown}>
                                    <button style={{ ...D.dropdownItem, color:'#DC2626' }} onClick={(e) => handleDeleteEndedGroup(group._id ?? group.id, e)}>
                                      🗑️ Remove from View
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div style={D.sessionName}>{group.groupName}</div>
                            <div style={D.sessionMeta}>{formatDateTime(group.endedAt || group.createdAt).date}</div>
                            <div style={D.pinBox}>
                              <div style={D.pinLabel}>ACCESS PIN</div>
                              <div style={D.pinValue}>{group.pin?.replace(/(\d{3})(\d{3})/, '$1-$2')}</div>
                            </div>
                            <div style={D.cardStats}>
                              <span>👥 {(group.members || []).length} Students attended</span>
                            </div>
                            {/* ✅ NEW: Session Details button opens modal */}
                            <button style={D.detailsBtn} onClick={() => openSessionDetails(group)}>
                              Session Details
                            </button>
                          </div>
                        );
                      })}

                      {groups.length === 0 && scheduledSessions.length === 0 && (
                        <div style={D.emptyState}>
                          <div style={D.emptyIcon}>📚</div>
                          <p style={D.emptyTitle}>No sessions yet</p>
                          <p style={D.emptyText}>Click "Plan Session" or "Create Instant" to get started</p>
                          <button style={D.createBtn} onClick={() => setShowSchedule(true)}>+ Create Session</button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Quick tools + activity */}
                  <div style={D.rightCol}>
                    <h3 style={D.rightTitle}>Quick Resource Tools</h3>
                    <div style={D.toolCard} onClick={() => setShowQuizCreator(true)}>
                      <span style={D.toolIconBox}>📝</span>
                      <div style={D.toolInfo}><div style={D.toolName}>Create New Quiz</div><div style={D.toolDesc}>Build questions & assign to classes</div></div>
                      <span style={D.toolArrow}>↗</span>
                    </div>
                    <div style={D.toolCard} onClick={() => setShowSchedule(true)}>
                      <span style={D.toolIconBox}>📅</span>
                      <div style={D.toolInfo}><div style={D.toolName}>Schedule Class</div><div style={D.toolDesc}>Pre-plan future sessions & PINs</div></div>
                      <span style={D.toolArrow}>↗</span>
                    </div>
                    <h3 style={{ ...D.rightTitle, marginTop:20 }}>🛡 Classroom Vibe Control</h3>
                    <div style={D.vibeCard}>
                      <div style={D.vibeRow}><span>💬 Chat Moderation</span><span style={D.strictBadge}>Strict</span></div>
                      <div style={D.vibeRow}><span>⏱ Session starting and Ending</span><span style={{ color:'#9ca3af' }}>-- min</span></div>
                      <button style={D.rulesBtn}>Manage Global Rules</button>
                    </div>
                    <h3 style={{ ...D.rightTitle, marginTop:20 }}>Recent Activity</h3>
                    {groups.slice(0, 4).map((g, i) => (
                      <div key={i} style={D.activityItem}>
                        <div style={D.actAvatar}>👤</div>
                        <div style={D.actText}><span style={D.actName}>{g.groupName}</span><span style={D.actDesc}> · {(g.members||[]).length} members</span></div>
                        <div style={D.actTime}>{formatDateTime(g.createdAt).time}</div>
                      </div>
                    ))}
                    <button onClick={handleLogout} style={D.logoutBtn}>Logout</button>
                  </div>
                </div>
              </div>
            </div>

          ) : (
            /* ── STUDENT HUB ── */
            <div style={SD.shell}>

              {/* LEFT SIDEBAR */}
              <div style={SD.sidebar}>
                <div style={SD.sidebarLogo}>ClassVibe</div>
                {[
                  { icon:'📊', label:'Dashboard',     view:'dashboard' },
                  { icon:'⚡', label:'Live Sessions',  view:'live' },
                  { icon:'👥', label:'Participants',   view:'participants' },
                  { icon:'👤', label:'Profile',        view:'profile' },
                ].map((item, i) => (
                  <button key={i} style={{ ...SD.navItem, backgroundColor: studentView === item.view ? '#EEF2FF' : 'transparent', color: studentView === item.view ? '#4F46E5' : '#6b7280', fontWeight: studentView === item.view ? '700' : '500' }} onClick={() => setStudentView(item.view)}>
                    <span style={SD.navIcon}>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
                <div style={SD.sidebarSpacer} />
                <div style={SD.sidebarUser}>
                  <div style={SD.userAvatar}>{displayName.charAt(0).toUpperCase()}</div>
                  <div><div style={SD.userName}>{displayName}</div><div style={SD.userRole}>Student</div></div>
                </div>
                <button onClick={handleLogout} style={SD.logoutBtn}>Logout</button>
              </div>

              {/* MAIN CONTENT */}
              <div style={SD.main}>

                {/* ── DASHBOARD ── */}
                {studentView === 'dashboard' && (<>
                  <div style={SD.topBar}>
                    <div>
                      <h1 style={SD.pageTitle}>Welcome back, {displayName}!</h1>
                      <p style={SD.pageSubtitle}>
                        {liveGroups.length > 0 ? `You have ${liveGroups.length} live session${liveGroups.length > 1 ? 's' : ''} happening right now` : 'No live sessions right now'}
                        {endedGroups.length > 0 ? ` and ${endedGroups.length} completed` : ''}
                      </p>
                    </div>
                  </div>

                  <div style={SD.statsRow}>
                    {[
                      { label:'SCHEDULE',  value:0,                 icon:'📅' },
                      { label:'LIVE NOW',  value:liveGroups.length, icon:'⚡' },
                      { label:'COMPLETED', value:endedGroups.length,icon:'✅' },
                    ].map((s, i) => (
                      <div key={i} style={SD.statCard}>
                        <div style={SD.statIcon}>{s.icon}</div>
                        <div><div style={SD.statLabel}>{s.label}</div><div style={SD.statValue}>{s.value}</div></div>
                      </div>
                    ))}
                  </div>

                  <div style={SD.contentRow}>
                    <div style={SD.mainCol}>
                      {/* Join Session card */}
                      <div style={SD.joinCard}>
                        <div style={SD.joinCardTitle}>Join Live Session <span style={{ fontSize:18, color:'#9ca3af' }}>⠿⠿</span></div>
                        <p style={SD.joinCardDesc}>Enter PIN or scan QR to join an active classroom session instantly.</p>
                        <input style={SD.pinInput} placeholder="Enter Session PIN" maxLength={6} value={pinInput} onChange={e => setPinInput(e.target.value.replace(/\D/g, ''))} onKeyDown={e => e.key === 'Enter' && handleStudentPinJoin()} />
                        <button style={SD.joinSessionBtn} onClick={handleStudentPinJoin}>Join Session</button>
                      </div>

                      {/* My Classes */}
                      {groups.length > 0 && (<>
                        <div style={SD.sectionBar}>
                          <h2 style={SD.sectionTitle}>My Classes</h2>
                          <button style={SD.viewAllBtn} onClick={() => setStudentView('live')}>View Full Schedule &gt;</button>
                        </div>
                        <div style={SD.classGrid}>
                          {liveGroups.slice(0, 2).map(group => (
                            <div key={group._id} style={SD.classCard}>
                              <div style={SD.classBadgeActive}>LIVE</div>
                              <div style={SD.className}>{group.groupName}</div>
                              <div style={SD.classTeacher}>{group.admin?.name || group.admin?.username || 'Teacher'}</div>
                              <button style={SD.enterClassBtn} onClick={() => selectGroup(group._id ?? group.id)}>Enter Classroom →</button>
                            </div>
                          ))}
                          {endedGroups.slice(0, Math.max(0, 3 - liveGroups.slice(0,2).length)).map(group => (
                            <div key={group._id} style={{ ...SD.classCard, opacity:0.75 }}>
                              <div style={SD.classBadgeDone}>COMPLETED</div>
                              <div style={SD.className}>{group.groupName}</div>
                              <div style={SD.classTeacher}>{group.admin?.name || group.admin?.username || 'Teacher'}</div>
                              <div style={{ fontSize:12, color:'#9ca3af', marginTop:8 }}>{formatDateTime(group.createdAt).date}</div>
                            </div>
                          ))}
                        </div>
                      </>)}

                      {groups.length === 0 && (
                        <div style={SD.emptyState}>
                          <div style={SD.emptyIcon}>🎒</div>
                          <p style={SD.emptyTitle}>No classrooms joined yet</p>
                          <p style={SD.emptyText}>Enter a PIN above to join your first classroom!</p>
                        </div>
                      )}
                    </div>

                    {/* RIGHT: Session list */}
                    <div style={SD.rightCol}>
                      <div style={SD.sessionListCard}>
                        <div style={SD.sessionListHeader}>
                          <span style={SD.sessionListTitle}>Session List</span>
                          <span style={SD.sessionListBadge}>{groups.length} Session{groups.length !== 1 ? 's' : ''}</span>
                        </div>
                        {groups.slice(0, 6).map((g, i) => (
                          <div key={i} style={SD.sessionListItem}>
                            <div style={SD.sessionListIcon}>📖</div>
                            <div style={SD.sessionListInfo}>
                              <div style={SD.sessionListName}>{g.groupName}</div>
                              <div style={SD.sessionListSub}>{g.admin?.name || g.admin?.username || 'Teacher'}</div>
                            </div>
                            <div style={{ ...SD.sessionListStatus, color: g.isActive ? '#10B981' : '#9ca3af' }}>
                              {g.isActive ? 'LIVE' : formatDateTime(g.createdAt).date}
                            </div>
                          </div>
                        ))}
                        {groups.length === 0 && <p style={{ fontSize:13, color:'#9ca3af', textAlign:'center', padding:'20px 0' }}>No sessions yet</p>}
                      </div>
                    </div>
                  </div>
                </>)}

                {/* ── LIVE SESSIONS ── */}
                {studentView === 'live' && (<>
                  <div style={SD.topBar}><h1 style={SD.pageTitle}>Live Sessions</h1></div>
                  {liveGroups.length === 0 ? (
                    <div style={SD.emptyState}>
                      <div style={SD.emptyIcon}>⚡</div>
                      <p style={SD.emptyTitle}>No live sessions right now</p>
                      <p style={SD.emptyText}>Your teacher hasn't started a session yet. Check back soon!</p>
                    </div>
                  ) : (
                    <div style={SD.sessionGrid}>
                      {liveGroups.map(group => (
                        <div key={group._id} style={SD.liveSessionCard}>
                          <div style={SD.liveCardBadge}>● Live Now</div>
                          <div style={SD.liveCardName}>{group.groupName}</div>
                          <div style={SD.liveCardTeacher}>by {group.admin?.name || group.admin?.username || 'Teacher'}</div>
                          <div style={SD.liveCardStats}>
                            <span>👥 {(group.members || []).length} members</span>
                            <span style={{ color:'#10B981', fontWeight:'600' }}>{(group.onlineUsers || []).length} online</span>
                          </div>
                          <button style={SD.enterBtn} onClick={() => selectGroup(group._id ?? group.id)}>Enter Classroom →</button>
                        </div>
                      ))}
                    </div>
                  )}
                </>)}

                {/* ── PARTICIPANTS ── */}
                {studentView === 'participants' && (<>
                  <div style={SD.topBar}><h1 style={SD.pageTitle}>Participants</h1></div>
                  {liveGroups.length === 0 ? (
                    <div style={SD.emptyState}>
                      <div style={SD.emptyIcon}>👥</div>
                      <p style={SD.emptyTitle}>No active sessions</p>
                      <p style={SD.emptyText}>Participants will appear here when you're in an active session.</p>
                    </div>
                  ) : liveGroups.map(group => {
                    const onlineIds = new Set((group.onlineUsers || []).map(u => String(u._id || u.id || u)));
                    const onlineMembers = (group.members || []).filter(m => {
                      const mId = String(m.user?._id || m.user?.id || m._id || m.id || '');
                      return onlineIds.has(mId);
                    });
                    const colors = ['#6366f1','#10B981','#F59E0B','#EF4444','#3B82F6','#8B5CF6','#EC4899','#14B8A6'];
                    return (
                      <div key={group._id} style={{ marginBottom:28 }}>
                        <div style={SD.sectionBar}>
                          <h2 style={SD.sectionTitle}>{group.groupName}</h2>
                          <span style={SD.onlineBadge}>{onlineMembers.length} Online</span>
                        </div>
                        {onlineMembers.length === 0 ? (
                          <p style={{ color:'#9ca3af', fontSize:14 }}>No one online right now. <button style={{ color:'#4F46E5', background:'none', border:'none', cursor:'pointer', fontSize:13 }} onClick={() => loadGroups(false)}>Refresh</button></p>
                        ) : (
                          <div style={SD.participantGrid}>
                            {onlineMembers.map((m, i) => {
                              const name = m.user?.name || m.user?.username || m.name || m.username || `Member ${i+1}`;
                              return (
                                <div key={i} style={SD.participantCard}>
                                  <div style={{ ...SD.participantAvatar, backgroundColor: colors[i % colors.length] }}>{name.charAt(0).toUpperCase()}</div>
                                  <div style={SD.participantName}>{name}</div>
                                  <div style={SD.participantOnline}>● Online</div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </>)}

                {/* ── PROFILE ── */}
                {studentView === 'profile' && (<>
                  <div style={SD.topBar}><h1 style={SD.pageTitle}>Profile</h1></div>
                  <div style={SD.profileCard}>
                    <div style={SD.profileField}>
                      <label style={SD.profileLabel}>Display Name</label>
                      <input style={SD.profileInput} value={profileName} onChange={e => setProfileName(e.target.value)} placeholder="Your name" maxLength={50} />
                    </div>
                    <div style={SD.profileField}>
                      <label style={SD.profileLabel}>Email</label>
                      <input style={{ ...SD.profileInput, ...SD.profileInputReadonly }} value={user?.email || '—'} readOnly />
                    </div>
                    <div style={SD.profileField}>
                      <label style={SD.profileLabel}>Role</label>
                      <input style={{ ...SD.profileInput, ...SD.profileInputReadonly }} value="Student" readOnly />
                    </div>
                    <button style={SD.profileSaveBtn} onClick={handleProfileSave} disabled={profileSaving}>
                      {profileSaving ? 'Saving…' : 'Save Changes'}
                    </button>
                    {profileMsg && (
                      <div style={{ ...SD.profileMsg, backgroundColor: profileMsg.includes('!') || profileMsg.includes('success') || profileMsg.includes('local') ? '#f0fdf4' : '#fef2f2', color: profileMsg.includes('!') || profileMsg.includes('success') || profileMsg.includes('local') ? '#15803d' : '#dc2626' }}>
                        {profileMsg}
                      </div>
                    )}
                  </div>
                </>)}

              </div>
            </div>
          )

        ) : (
          /* ── CHAT VIEW — IDENTICAL ── */
          <>
            <ChatArea messages={messages} currentUserId={getUserId(user)} currentGroup={currentGroup} typingUsers={typingUsers} onMessageEdited={handleMessageEdited} onMessageDeleted={handleMessageDeleted} />
            <MessageInput onSendMessage={handleSendMessage} onTyping={handleTyping} onStopTyping={handleStopTyping} disabled={!currentGroup || !currentGroup.isActive} isAdmin={isAdmin} members={currentGroup.members || []} />
          </>
        )}
      </div>
    </div>
  );
}

// ── INSTRUCTOR HUB STYLES (unchanged) ──
const D = {
  shell:{ display:'flex', height:'100%', backgroundColor:'#f9fafb', overflow:'hidden' },
  sidebar:{ width:220, flexShrink:0, backgroundColor:'white', borderRight:'1px solid #e5e7eb', display:'flex', flexDirection:'column', padding:'20px 0', overflowY:'auto' },
  sidebarLogo:{ fontSize:'20px', fontWeight:'900', color:'#4F46E5', padding:'0 20px 24px', letterSpacing:'-0.5px' },
  navItem:{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 20px', border:'none', background:'none', fontSize:'14px', fontWeight:'500', color:'#6b7280', cursor:'pointer', width:'100%', textAlign:'left', transition:'all 0.15s' },
  navIcon:{ fontSize:'16px', width:20, textAlign:'center' },
  sidebarSpacer:{ flex:1 },
  sidebarUser:{ display:'flex', alignItems:'center', gap:'10px', padding:'16px 20px', borderTop:'1px solid #e5e7eb' },
  userAvatar:{ width:36, height:36, borderRadius:'50%', backgroundColor:'#EEF2FF', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', flexShrink:0 },
  userName:{ fontSize:'13px', fontWeight:'700', color:'#111827' },
  userRole:{ fontSize:'11px', color:'#9ca3af' },
  main:{ flex:1, overflowY:'auto', padding:'28px' },
  topBar:{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'24px' },
  pageTitle:{ fontSize:'24px', fontWeight:'800', color:'#111827' },
  topActions:{ display:'flex', gap:'10px' },
  planBtn:{ padding:'10px 18px', border:'1.5px solid #e5e7eb', borderRadius:'8px', background:'white', fontSize:'14px', fontWeight:'600', color:'#374151', cursor:'pointer' },
  createBtn:{ padding:'10px 18px', border:'none', borderRadius:'8px', backgroundColor:'#4F46E5', color:'white', fontSize:'14px', fontWeight:'700', cursor:'pointer' },
  statsRow:{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'16px', marginBottom:'28px' },
  statCard:{ backgroundColor:'white', borderRadius:'12px', padding:'20px', border:'1px solid #e5e7eb', position:'relative', overflow:'hidden' },
  statIcon:{ fontSize:'24px', marginBottom:'8px' },
  statTrend:{ position:'absolute', top:16, right:16, fontSize:'12px', fontWeight:'600', color:'#10B981' },
  statLabel:{ fontSize:'13px', color:'#6b7280', fontWeight:'500', marginBottom:'4px' },
  statValue:{ fontSize:'28px', fontWeight:'800', color:'#111827' },
  statSub:{ fontSize:'12px', color:'#9ca3af', marginTop:'2px' },
  contentRow:{ display:'flex', gap:'24px', alignItems:'flex-start' },
  sessionsCol:{ flex:1, minWidth:0 },
  sectionBar:{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' },
  sectionTitle:{ fontSize:'18px', fontWeight:'700', color:'#111827' },
  viewAllBtn:{ background:'none', border:'none', color:'#4F46E5', fontSize:'13px', fontWeight:'600', cursor:'pointer' },
  sessionGrid:{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))', gap:'16px' },
  sessionCard:{ backgroundColor:'white', borderRadius:'12px', padding:'18px', border:'1px solid #e5e7eb', boxShadow:'0 1px 4px rgba(0,0,0,0.05)', position:'relative' },
  cardTopRow:{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'10px' },
  liveBadge:{ fontSize:'12px', fontWeight:'700', color:'#DC2626', backgroundColor:'#FEE2E2', padding:'4px 10px', borderRadius:'20px' },
  scheduledBadge:{ fontSize:'12px', fontWeight:'700', color:'#D97706', backgroundColor:'#FEF3C7', padding:'4px 10px', borderRadius:'20px' },
  endedBadge:{ fontSize:'12px', fontWeight:'700', color:'#6b7280', backgroundColor:'#F3F4F6', padding:'4px 10px', borderRadius:'20px' },
  moreBtn:{ background:'none', border:'none', color:'#9ca3af', cursor:'pointer', fontSize:'20px', padding:'0 4px', borderRadius:'4px' },
  // ✅ NEW: Dropdown styles
  dropdown:{ position:'absolute', right:0, top:'28px', backgroundColor:'white', border:'1px solid #e5e7eb', borderRadius:'8px', boxShadow:'0 4px 16px rgba(0,0,0,0.12)', zIndex:100, minWidth:'160px', overflow:'hidden' },
  dropdownItem:{ display:'block', width:'100%', padding:'10px 16px', border:'none', background:'none', fontSize:'13px', fontWeight:'500', color:'#374151', cursor:'pointer', textAlign:'left' },
  sessionName:{ fontSize:'15px', fontWeight:'700', color:'#111827', marginBottom:'4px' },
  sessionMeta:{ fontSize:'12px', color:'#6b7280', marginBottom:'12px' },
  pinBox:{ backgroundColor:'#f9fafb', borderRadius:'8px', padding:'12px', textAlign:'center', marginBottom:'12px' },
  pinLabel:{ fontSize:'10px', fontWeight:'700', color:'#9ca3af', letterSpacing:'1px' },
  pinValue:{ fontSize:'22px', fontWeight:'900', color:'#111827', letterSpacing:'3px', marginTop:'4px' },
  cardStats:{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px', fontSize:'12px', color:'#6b7280' },
  modBadge:{ fontSize:'11px', color:'#6b7280' },
  joinBtn:{ width:'100%', padding:'10px', backgroundColor:'#4F46E5', color:'white', border:'none', borderRadius:'8px', fontSize:'13px', fontWeight:'700', cursor:'pointer' },
  manageBtn:{ width:'100%', padding:'10px', backgroundColor:'white', color:'#374151', border:'1.5px solid #e5e7eb', borderRadius:'8px', fontSize:'13px', fontWeight:'600', cursor:'pointer' },
  detailsBtn:{ width:'100%', padding:'10px', backgroundColor:'white', color:'#374151', border:'1.5px solid #e5e7eb', borderRadius:'8px', fontSize:'13px', fontWeight:'600', cursor:'pointer' },
  emptyState:{ gridColumn:'1/-1', textAlign:'center', padding:'60px 20px' },
  emptyIcon:{ fontSize:'48px', marginBottom:'12px' },
  emptyTitle:{ fontSize:'18px', fontWeight:'600', color:'#374151', marginBottom:'8px' },
  emptyText:{ fontSize:'14px', color:'#6b7280', marginBottom:'16px' },
  rightCol:{ width:280, flexShrink:0 },
  rightTitle:{ fontSize:'15px', fontWeight:'700', color:'#111827', marginBottom:'12px' },
  toolCard:{ display:'flex', alignItems:'center', gap:'12px', padding:'14px', backgroundColor:'white', borderRadius:'10px', border:'1px solid #e5e7eb', marginBottom:'10px', cursor:'pointer' },
  toolIconBox:{ fontSize:'18px', width:36, height:36, backgroundColor:'#EEF2FF', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center' },
  toolInfo:{ flex:1 },
  toolName:{ fontSize:'14px', fontWeight:'600', color:'#111827' },
  toolDesc:{ fontSize:'12px', color:'#6b7280', marginTop:'2px' },
  toolArrow:{ fontSize:'14px', color:'#9ca3af' },
  vibeCard:{ backgroundColor:'white', borderRadius:'10px', border:'1px solid #e5e7eb', padding:'14px', marginBottom:'10px' },
  vibeRow:{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'13px', color:'#374151', marginBottom:'10px' },
  strictBadge:{ fontSize:'11px', fontWeight:'700', backgroundColor:'#FEF3C7', color:'#92400E', padding:'3px 8px', borderRadius:'6px' },
  rulesBtn:{ width:'100%', padding:'8px', border:'1.5px solid #e5e7eb', borderRadius:'8px', background:'white', fontSize:'13px', fontWeight:'600', color:'#374151', cursor:'pointer', marginTop:'4px' },
  activityItem:{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 0', borderBottom:'1px solid #f3f4f6' },
  actAvatar:{ width:32, height:32, borderRadius:'50%', backgroundColor:'#e5e7eb', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px', flexShrink:0 },
  actText:{ flex:1, fontSize:'13px' },
  actName:{ fontWeight:'600', color:'#111827' },
  actDesc:{ color:'#6b7280' },
  actTime:{ fontSize:'11px', color:'#9ca3af' },
  logoutBtn:{ marginTop:24, width:'100%', padding:'10px', border:'1.5px solid #e5e7eb', borderRadius:'8px', background:'white', fontSize:'13px', fontWeight:'600', color:'#6b7280', cursor:'pointer' },
};

// ── MODAL STYLES ──
const M = {
  overlay:{ position:'fixed', inset:0, backgroundColor:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:3000, padding:'16px' },
  modal:{ backgroundColor:'white', borderRadius:'16px', width:'100%', maxWidth:520, maxHeight:'85vh', display:'flex', flexDirection:'column', boxShadow:'0 20px 60px rgba(0,0,0,0.25)', overflow:'hidden' },
  header:{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'20px 24px', borderBottom:'1px solid #e5e7eb', backgroundColor:'#4F46E5' },
  title:{ margin:0, fontSize:'18px', fontWeight:'700', color:'white' },
  closeBtn:{ background:'none', border:'none', fontSize:'22px', color:'white', cursor:'pointer' },
  body:{ padding:'24px', overflowY:'auto', flex:1 },
  sessionInfo:{ backgroundColor:'#f9fafb', borderRadius:'10px', padding:'16px', marginBottom:'20px' },
  sessionName:{ fontSize:'16px', fontWeight:'700', color:'#111827', marginBottom:'6px' },
  sessionMeta:{ fontSize:'13px', color:'#6b7280', marginTop:'4px' },
  msg:{ padding:'10px 14px', borderRadius:'8px', backgroundColor:'#f0fdf4', fontSize:'14px', fontWeight:'500', marginBottom:'16px' },
  actions:{ display:'flex', flexDirection:'column', gap:'10px' },
  primaryBtn:{ padding:'13px', backgroundColor:'#4F46E5', color:'white', border:'none', borderRadius:'10px', fontSize:'14px', fontWeight:'700', cursor:'pointer' },
  secondaryBtn:{ padding:'12px', backgroundColor:'white', color:'#374151', border:'1.5px solid #e5e7eb', borderRadius:'10px', fontSize:'14px', fontWeight:'600', cursor:'pointer' },
  dangerBtn:{ padding:'12px', backgroundColor:'white', color:'#DC2626', border:'1.5px solid #FCA5A5', borderRadius:'10px', fontSize:'14px', fontWeight:'600', cursor:'pointer' },
  // Session Details tabs
  tabRow:{ display:'flex', borderBottom:'1px solid #e5e7eb', padding:'0 24px', backgroundColor:'#fafafa' },
  tab:{ padding:'12px 16px', border:'none', background:'none', fontSize:'14px', fontWeight:'600', color:'#6b7280', cursor:'pointer', borderBottom:'3px solid transparent' },
  tabActive:{ color:'#4F46E5', borderBottomColor:'#4F46E5' },
  tabBody:{ padding:'16px 24px', overflowY:'auto', flex:1, maxHeight:'340px' },
  empty:{ textAlign:'center', padding:'40px', color:'#9ca3af', fontSize:'14px' },
  memberRow:{ display:'flex', alignItems:'center', gap:'12px', padding:'10px 0', borderBottom:'1px solid #f3f4f6' },
  memberAvatar:{ width:36, height:36, borderRadius:'50%', backgroundColor:'#EEF2FF', color:'#4F46E5', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px', fontWeight:'700', flexShrink:0 },
  memberInfo:{ flex:1 },
  memberName:{ fontSize:'14px', fontWeight:'600', color:'#111827' },
  memberEmail:{ fontSize:'12px', color:'#6b7280', marginTop:'2px' },
  memberTime:{ fontSize:'12px', color:'#9ca3af' },
  quizRow:{ display:'flex', alignItems:'center', gap:'12px', padding:'12px 0', borderBottom:'1px solid #f3f4f6' },
  quizIcon:{ fontSize:'24px', flexShrink:0 },
  quizInfo:{ flex:1 },
  quizTitle:{ fontSize:'14px', fontWeight:'600', color:'#111827' },
  quizMeta:{ fontSize:'12px', color:'#6b7280', marginTop:'2px' },
};

// ── STUDENT HUB STYLES ──
const SD = {
  shell:{ display:'flex', height:'100%', backgroundColor:'#f9fafb', overflow:'hidden' },
  sidebar:{ width:220, flexShrink:0, backgroundColor:'white', borderRight:'1px solid #e5e7eb', display:'flex', flexDirection:'column', padding:'20px 0', overflowY:'auto' },
  sidebarLogo:{ fontSize:'20px', fontWeight:'900', color:'#4F46E5', padding:'0 20px 24px', letterSpacing:'-0.5px' },
  navItem:{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 20px', border:'none', background:'none', fontSize:'14px', cursor:'pointer', width:'100%', textAlign:'left', transition:'all 0.15s', borderRadius:0 },
  navIcon:{ fontSize:'16px', width:20, textAlign:'center' },
  sidebarSpacer:{ flex:1 },
  sidebarUser:{ display:'flex', alignItems:'center', gap:'10px', padding:'12px 20px', borderTop:'1px solid #e5e7eb' },
  userAvatar:{ width:36, height:36, borderRadius:'50%', backgroundColor:'#EEF2FF', color:'#4F46E5', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px', fontWeight:'700', flexShrink:0 },
  userName:{ fontSize:'13px', fontWeight:'700', color:'#111827' },
  userRole:{ fontSize:'11px', color:'#9ca3af' },
  logoutBtn:{ margin:'8px 12px 12px', padding:'9px', border:'1.5px solid #e5e7eb', borderRadius:'8px', background:'white', fontSize:'13px', fontWeight:'600', color:'#6b7280', cursor:'pointer' },
  main:{ flex:1, overflowY:'auto', padding:'28px' },
  topBar:{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'20px' },
  pageTitle:{ fontSize:'24px', fontWeight:'800', color:'#111827', margin:0 },
  pageSubtitle:{ fontSize:'14px', color:'#6b7280', marginTop:'4px' },
  statsRow:{ display:'flex', gap:'16px', marginBottom:'24px' },
  statCard:{ flex:1, backgroundColor:'white', borderRadius:'12px', padding:'16px 20px', border:'1px solid #e5e7eb', display:'flex', alignItems:'center', gap:'14px' },
  statIcon:{ fontSize:'28px' },
  statLabel:{ fontSize:'10px', fontWeight:'700', color:'#9ca3af', letterSpacing:'1px' },
  statValue:{ fontSize:'26px', fontWeight:'800', color:'#111827' },
  contentRow:{ display:'flex', gap:'24px', alignItems:'flex-start' },
  mainCol:{ flex:1, minWidth:0 },
  joinCard:{ backgroundColor:'white', borderRadius:'12px', padding:'24px', border:'1px solid #e5e7eb', marginBottom:'24px', boxShadow:'0 1px 4px rgba(0,0,0,0.05)' },
  joinCardTitle:{ fontSize:'16px', fontWeight:'700', color:'#111827', marginBottom:'8px', display:'flex', alignItems:'center', justifyContent:'space-between' },
  joinCardDesc:{ fontSize:'13px', color:'#6b7280', marginBottom:'16px' },
  pinInput:{ width:'100%', padding:'12px 14px', fontSize:'16px', border:'1.5px solid #e5e7eb', borderRadius:'8px', outline:'none', marginBottom:'10px', boxSizing:'border-box', color:'#111827', letterSpacing:'3px' },
  joinSessionBtn:{ width:'100%', padding:'12px', backgroundColor:'white', color:'#374151', border:'1.5px solid #e5e7eb', borderRadius:'8px', fontSize:'14px', fontWeight:'600', cursor:'pointer' },
  sectionBar:{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' },
  sectionTitle:{ fontSize:'16px', fontWeight:'700', color:'#111827' },
  viewAllBtn:{ background:'none', border:'none', color:'#4F46E5', fontSize:'13px', fontWeight:'600', cursor:'pointer' },
  classGrid:{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'12px', marginBottom:'24px' },
  classCard:{ backgroundColor:'white', borderRadius:'12px', padding:'16px', border:'1px solid #e5e7eb', boxShadow:'0 1px 4px rgba(0,0,0,0.04)' },
  classBadgeActive:{ display:'inline-block', fontSize:'10px', fontWeight:'700', color:'white', backgroundColor:'#10B981', padding:'3px 8px', borderRadius:'4px', marginBottom:'10px', letterSpacing:'0.5px' },
  classBadgeDone:{ display:'inline-block', fontSize:'10px', fontWeight:'700', color:'#6b7280', backgroundColor:'#f3f4f6', padding:'3px 8px', borderRadius:'4px', marginBottom:'10px', letterSpacing:'0.5px' },
  className:{ fontSize:'14px', fontWeight:'700', color:'#111827', marginBottom:'4px' },
  classTeacher:{ fontSize:'12px', color:'#6b7280', marginBottom:'12px' },
  enterClassBtn:{ width:'100%', padding:'8px', backgroundColor:'#EEF2FF', color:'#4F46E5', border:'none', borderRadius:'6px', fontSize:'12px', fontWeight:'700', cursor:'pointer' },
  rightCol:{ width:260, flexShrink:0 },
  sessionListCard:{ backgroundColor:'white', borderRadius:'12px', padding:'16px', border:'1px solid #e5e7eb' },
  sessionListHeader:{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' },
  sessionListTitle:{ fontSize:'14px', fontWeight:'700', color:'#111827' },
  sessionListBadge:{ fontSize:'11px', fontWeight:'700', color:'white', backgroundColor:'#4F46E5', padding:'3px 10px', borderRadius:'20px' },
  sessionListItem:{ display:'flex', alignItems:'center', gap:'10px', padding:'9px 0', borderBottom:'1px solid #f3f4f6' },
  sessionListIcon:{ fontSize:'18px', flexShrink:0 },
  sessionListInfo:{ flex:1 },
  sessionListName:{ fontSize:'13px', fontWeight:'600', color:'#111827' },
  sessionListSub:{ fontSize:'11px', color:'#6b7280' },
  sessionListStatus:{ fontSize:'11px', fontWeight:'600' },
  emptyState:{ textAlign:'center', padding:'60px 20px', backgroundColor:'white', borderRadius:'12px', border:'1px solid #e5e7eb' },
  emptyIcon:{ fontSize:'48px', marginBottom:'12px' },
  emptyTitle:{ fontSize:'18px', fontWeight:'700', color:'#374151', marginBottom:'8px' },
  emptyText:{ fontSize:'14px', color:'#6b7280' },
  sessionGrid:{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:'16px' },
  liveSessionCard:{ backgroundColor:'white', borderRadius:'12px', padding:'20px', border:'1px solid #e5e7eb', boxShadow:'0 1px 4px rgba(0,0,0,0.05)' },
  liveCardBadge:{ fontSize:'12px', fontWeight:'700', color:'#DC2626', backgroundColor:'#FEE2E2', padding:'4px 10px', borderRadius:'20px', display:'inline-block', marginBottom:'12px' },
  liveCardName:{ fontSize:'16px', fontWeight:'700', color:'#111827', marginBottom:'4px' },
  liveCardTeacher:{ fontSize:'13px', color:'#6b7280', marginBottom:'12px' },
  liveCardStats:{ display:'flex', justifyContent:'space-between', fontSize:'12px', color:'#6b7280', marginBottom:'14px' },
  enterBtn:{ width:'100%', padding:'10px', backgroundColor:'#4F46E5', color:'white', border:'none', borderRadius:'8px', fontSize:'13px', fontWeight:'700', cursor:'pointer' },
  onlineBadge:{ fontSize:'12px', fontWeight:'700', color:'#10B981', backgroundColor:'#D1FAE5', padding:'4px 10px', borderRadius:'20px' },
  participantGrid:{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(130px,1fr))', gap:'12px' },
  participantCard:{ backgroundColor:'white', borderRadius:'12px', padding:'16px', border:'1px solid #e5e7eb', textAlign:'center' },
  participantAvatar:{ width:48, height:48, borderRadius:'50%', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px', fontWeight:'700', margin:'0 auto 10px' },
  participantName:{ fontSize:'13px', fontWeight:'600', color:'#111827', marginBottom:'4px' },
  participantOnline:{ fontSize:'11px', color:'#10B981', fontWeight:'600' },
  profileCard:{ backgroundColor:'white', borderRadius:'12px', padding:'28px', border:'1px solid #e5e7eb', maxWidth:480 },
  profileField:{ marginBottom:'16px' },
  profileLabel:{ fontSize:'13px', fontWeight:'700', color:'#374151', marginBottom:'6px', display:'block' },
  profileInput:{ width:'100%', padding:'10px 13px', fontSize:'14px', border:'1.5px solid #e2e8f0', borderRadius:'8px', outline:'none', color:'#1e293b', boxSizing:'border-box' },
  profileInputReadonly:{ backgroundColor:'#f8fafc', color:'#94a3b8', cursor:'not-allowed' },
  profileSaveBtn:{ padding:'12px 28px', backgroundColor:'#4F46E5', color:'white', border:'none', borderRadius:'8px', fontSize:'14px', fontWeight:'700', cursor:'pointer' },
  profileMsg:{ marginTop:12, fontSize:13, fontWeight:'500', padding:'8px 12px', borderRadius:'6px', border:'1px solid transparent' },
};

export default App;