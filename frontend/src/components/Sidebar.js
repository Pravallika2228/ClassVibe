// src/components/Sidebar.jsx
// ✅ CHANGES from previous version:
// 1. Added props: userRole, onLeaveMeeting (passed from App.js)
// 2. When in a session (group exists): shows Visily-style role-based nav panel at top
//    Teacher: Dashboard, Live Session, Participants, Settings, Whiteboard
//            + Participants list (showing online count) + Live Reactions/Engagement widget
//    Student: Dashboard, Live Session, Participants, Settings
//            + Support section + Leave Session button at bottom
// 3. All existing sections (Rejoin, Active Students, Participation, Statistics) preserved below nav

import React, { useState, useEffect } from 'react';

const Sidebar = ({ isOpen, onClose, group, messages = [], currentUserId, userRole, onLeaveMeeting }) => {
  const [expandedSection, setExpandedSection] = useState(null);
  const [error,           setError]           = useState('');
  const [success,         setSuccess]         = useState('');
  const [activeNavItem,   setActiveNavItem]   = useState('Dashboard');

  const getCurrentUser = () => {
    try { const raw = localStorage.getItem('user'); return raw ? JSON.parse(raw) : null; }
    catch { return null; }
  };
  const currentUser = getCurrentUser();
  const resolvedRole = userRole || currentUser?.role || 'student';

  const isAdmin = (() => {
    if (!group || !currentUser) return false;
    const admin   = group.admin;
    if (!admin) return false;
    const adminId = typeof admin === 'string' ? admin : (admin._id ?? admin.id ?? admin);
    const userId  = currentUser._id ?? currentUser.id ?? currentUser.userId ?? currentUser.uid;
    return String(adminId) === String(userId);
  })();

  useEffect(() => {
    const urlParams  = new URLSearchParams(window.location.search);
    const pinFromUrl = urlParams.get('pin');
    if (pinFromUrl) setExpandedSection('rejoin');
  }, []);

  const getMessageCounts = () => {
    const counts = {};
    if (!messages || messages.length === 0) return counts;
    messages.forEach(msg => {
      if (msg.sender?._id) counts[msg.sender._id] = (counts[msg.sender._id] || 0) + 1;
    });
    return counts;
  };
  const messageCounts = getMessageCounts();

  const toggleSection = (section) => {
    setExpandedSection(prev => prev === section ? null : section);
    setError(''); setSuccess('');
  };

  const copyText = async (text) => {
    try { await navigator.clipboard.writeText(text || ''); setSuccess('Copied!'); setTimeout(() => setSuccess(''), 1800); }
    catch { setError('Unable to copy'); setTimeout(() => setError(''), 1800); }
  };
  const openQrInNewTab = (qrData) => {
    if (!qrData) return;
    try { const w = window.open(); w.document.write(`<img src="${qrData}" style="max-width:100%"/>`); w.document.title='QR Code'; }
    catch (e) { console.warn('QR tab failed', e); }
  };
  const openStudentJoinWithPin = (pin) => {
    if (!pin) return;
    const base = window.location.origin + window.location.pathname;
    window.location.href = `${base}?pin=${encodeURIComponent(pin)}`;
  };

  // Engagement score — derived from message activity vs total members
  const engagementScore = (() => {
    if (!group?.members?.length || !messages?.length) return 0;
    const activeSenders = new Set(messages.map(m => m.sender?._id).filter(Boolean));
    return Math.min(100, Math.round((activeSenders.size / group.members.length) * 100));
  })();

  const onlineCount  = group?.onlineUsers?.length || 0;
  const memberCount  = group?.members?.length     || 0;

  // ── Teacher nav items
  const teacherNav = [
    { icon:'📊', label:'Dashboard'    },
    { icon:'💬', label:'Live Session' },
    { icon:'👥', label:'Participants' },
    { icon:'⚙️', label:'Settings'     },
    { icon:'✏️', label:'Whiteboard', sub:'Collaborative drawing space' },
  ];

  // ── Student nav items
  const studentNav = [
    { icon:'📊', label:'Dashboard'    },
    { icon:'💬', label:'Live Session' },
    { icon:'👥', label:'Participants' },
    { icon:'⚙️', label:'Settings'     },
  ];

  const navItems = resolvedRole === 'teacher' ? teacherNav : studentNav;

  return (
    <>
      {isOpen && <div style={styles.backdrop} onClick={onClose} />}
      <div style={{ ...styles.sidebar, right: isOpen ? '0' : '-400px' }}>

        {/* ── HEADER ── */}
        <div style={styles.sidebarHeader}>
          <span style={styles.sidebarBrand}>ClassVibe</span>
          <button onClick={onClose} style={styles.closeButton}>✕</button>
        </div>

        {/* ══════════════════════════════════════
            VISILY-STYLE SESSION PANEL
            (only shown when in a session)
            ══════════════════════════════════════ */}
        {group && (
          <>
            {/* ── NAV ITEMS ── */}
            <div style={styles.navSection}>
              {navItems.map((item, i) => (
                <button
                  key={i}
                  style={{
                    ...styles.navItem,
                    backgroundColor: activeNavItem === item.label ? '#EEF2FF' : 'transparent',
                    color: activeNavItem === item.label ? '#4F46E5' : '#374151',
                  }}
                  onClick={() => setActiveNavItem(item.label)}
                >
                  <span style={styles.navIcon}>{item.icon}</span>
                  <div style={styles.navTextWrap}>
                    <span style={styles.navLabel}>{item.label}</span>
                    {item.sub && <span style={styles.navSub}>{item.sub}</span>}
                  </div>
                  {activeNavItem === item.label && <span style={styles.navActive} />}
                </button>
              ))}
            </div>

            {/* ── PARTICIPANTS PANEL ── */}
            <div style={styles.participantsPanel}>
              <div style={styles.participantsHeader}>
                <span style={styles.participantsTitle}>
                  Participants ({memberCount})
                </span>
                <span style={styles.onlinePill}>{onlineCount} Online</span>
              </div>
              <div style={styles.participantsList}>
                {(group.members || []).slice(0, 6).map((member, i) => {
                  const name      = member.username ?? member.name ?? `Student ${i+1}`;
                  const memberId  = member._id ?? member.id;
                  const isOnline  = group.onlineUsers?.some(u => (u._id||u.id||u) === memberId);
                  const initial   = name.charAt(0).toUpperCase();
                  const colors    = ['#FF6B6B','#4ECDC4','#45B7D1','#FFA07A','#BB8FCE','#98D8C8'];
                  const bgColor   = colors[i % colors.length];
                  return (
                    <div key={memberId || i} style={styles.participantRow}>
                      <div style={{ ...styles.participantAvatar, backgroundColor: bgColor }}>
                        {initial}
                        {isOnline && <div style={styles.onlineDot} />}
                      </div>
                      <span style={styles.participantName}>{name}</span>
                    </div>
                  );
                })}
                {memberCount > 6 && (
                  <div style={styles.moreParticipants}>+{memberCount - 6} more</div>
                )}
              </div>
            </div>

            {/* ── LIVE REACTIONS / ENGAGEMENT (teacher only) ── */}
            {resolvedRole === 'teacher' && (
              <div style={styles.engagementPanel}>
                <div style={styles.engagementTitle}>LIVE REACTIONS</div>
                <div style={styles.engagementContent}>
                  <span style={styles.engagementIcon}>⚡</span>
                  <div>
                    <div style={styles.engagementScore}>{engagementScore}%</div>
                    <div style={styles.engagementLabel}>Engagement</div>
                  </div>
                </div>
                {/* Progress bar */}
                <div style={styles.engagementBar}>
                  <div style={{ ...styles.engagementFill, width: `${engagementScore}%` }} />
                </div>
              </div>
            )}

            {/* ── SUPPORT + LEAVE SESSION (student only) ── */}
            {resolvedRole === 'student' && (
              <div style={styles.studentActionsPanel}>
                <button style={styles.supportBtn} onClick={() => window.open('mailto:support@classvibe.app', '_blank')}>
                  <span>❓</span> Support
                </button>
                <button
                  style={styles.leaveSessionBtn}
                  onClick={() => {
                    onClose();
                    onLeaveMeeting && onLeaveMeeting();
                  }}
                >
                  <span>→</span> Leave session
                </button>
              </div>
            )}

            <div style={styles.divider} />
          </>
        )}

        {/* ══════════════════════════════════════
            EXISTING FUNCTIONAL SECTIONS
            (unchanged from before)
            ══════════════════════════════════════ */}
        <div style={styles.sectionsTitle}>Session Tools</div>

        {/* REJOIN SECTION */}
        <div style={styles.section}>
          <div style={styles.sectionHeader} onClick={() => toggleSection('rejoin')}>
            <span style={styles.sectionTitle}>🔗 {isAdmin ? 'Share PIN & QR' : 'Rejoin Section'}</span>
            <span style={styles.arrow}>{expandedSection === 'rejoin' ? '▼' : '▶'}</span>
          </div>
          {expandedSection === 'rejoin' && (
            <div style={styles.sectionContent}>
              {isAdmin ? (
                <>
                  <p style={styles.description}>Share the classroom PIN / QR code with students.</p>
                  {group && (
                    <div style={styles.qrSection}>
                      {group.qrCode ? (
                        <>
                          <img src={group.qrCode} alt="QR Code" style={styles.qrCode} />
                          <div style={{ marginTop:8 }}>
                            <button style={styles.smallBtn} onClick={() => copyText(group.pin)}>Copy PIN</button>
                            <button style={styles.smallBtn} onClick={() => copyText(group.qrCode)}>Copy QR</button>
                            <button style={styles.smallBtn} onClick={() => openQrInNewTab(group.qrCode)}>Open QR</button>
                          </div>
                        </>
                      ) : <p style={{ color:'#666' }}>No QR code generated yet.</p>}
                      <p style={styles.pinDisplay}>PIN: {group?.pin ?? '—'}</p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p style={styles.description}>Use the PIN or QR below to rejoin.</p>
                  {group && (
                    <div style={styles.qrSection}>
                      {group.qrCode ? (
                        <>
                          <img src={group.qrCode} alt="QR Code" style={styles.qrCode} />
                          <div style={{ marginTop:8 }}>
                            <button style={styles.smallBtn} onClick={() => openQrInNewTab(group.qrCode)}>Open QR</button>
                            <button style={styles.smallBtn} onClick={() => copyText(group.qrCode)}>Copy QR</button>
                          </div>
                        </>
                      ) : <p style={{ color:'#666' }}>QR code not available.</p>}
                      <p style={styles.pinDisplay}>PIN: {group?.pin ?? '—'}</p>
                      <div style={{ marginTop:10 }}>
                        <button style={styles.button} onClick={() => openStudentJoinWithPin(group?.pin)}>Join this class (use PIN)</button>
                      </div>
                    </div>
                  )}
                </>
              )}
              {error   && <div style={styles.errorText}>{error}</div>}
              {success && <div style={styles.successText}>{success}</div>}
            </div>
          )}
        </div>

        {/* ACTIVE STUDENTS SECTION */}
        <div style={styles.section}>
          <div style={styles.sectionHeader} onClick={() => toggleSection('activeUsers')}>
            <span style={styles.sectionTitle}>👤 Active Students</span>
            <span style={styles.arrow}>{expandedSection === 'activeUsers' ? '▼' : '▶'}</span>
          </div>
          {expandedSection === 'activeUsers' && (
            <div style={styles.sectionContent}>
              {group && group.onlineUsers && group.onlineUsers.length > 0 ? (
                <>
                  <p style={styles.description}>Students who have sent at least one message</p>
                  <div style={styles.activeUsersList}>
                    {(() => {
                      const teacherId = group.admin?._id || group.admin?.id || group.admin;
                      const activeStudents = group.onlineUsers.filter(user => {
                        const uid  = user._id || user.id;
                        const isT  = String(uid) === String(teacherId);
                        return !isT && (messageCounts[uid] || 0) > 0;
                      });
                      if (activeStudents.length === 0) return <p style={styles.noUsers}>No active students yet.</p>;
                      return activeStudents.map(user => {
                        const uid      = user._id || user.id;
                        const username = user.username || user.name || 'Unknown';
                        const msgCount = messageCounts[uid] || 0;
                        return (
                          <div key={uid} style={styles.activeUserItem}>
                            <div style={styles.activeUserLeft}>
                              <div style={styles.activeStatusDot} />
                              <span style={styles.activeUserName}>{username}</span>
                            </div>
                            <span style={styles.messageCount}>{msgCount} {msgCount===1?'msg':'msgs'}</span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </>
              ) : <p style={styles.noUsers}>No users currently online</p>}
            </div>
          )}
        </div>

        {/* PARTICIPATION SECTION */}
        <div style={styles.section}>
          <div style={styles.sectionHeader} onClick={() => toggleSection('participation')}>
            <span style={styles.sectionTitle}>👥 Participation</span>
            <span style={styles.arrow}>{expandedSection === 'participation' ? '▼' : '▶'}</span>
          </div>
          {expandedSection === 'participation' && (
            <div style={styles.sectionContent}>
              {group ? (
                <>
                  <p style={styles.memberCount}>Total Members: {group.members ? group.members.length : 0}</p>
                  <div style={styles.memberList}>
                    {(group.members || []).map(member => {
                      const memberId = member._id ?? member.id;
                      const isOnline = group.onlineUsers?.some(u => (u._id||u.id||u) === memberId);
                      return (
                        <div key={memberId} style={styles.memberItem}>
                          <div style={{ ...styles.statusDot, backgroundColor: isOnline ? '#28a745' : '#999' }} />
                          <span style={styles.memberName}>{member.username ?? member.name ?? 'Unknown'}</span>
                          {group.admin && String(memberId) === String(group.admin._id ?? group.admin) && (
                            <span style={styles.adminBadge}>Admin</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : <p style={styles.noGroup}>No group selected</p>}
            </div>
          )}
        </div>

        {/* STATISTICS SECTION */}
        <div style={styles.section}>
          <div style={styles.sectionHeader} onClick={() => toggleSection('stats')}>
            <span style={styles.sectionTitle}>📊 Statistics</span>
            <span style={styles.arrow}>{expandedSection === 'stats' ? '▼' : '▶'}</span>
          </div>
          {expandedSection === 'stats' && (
            <div style={styles.sectionContent}>
              {[
                { label:'Total Messages:', value: messages?.length || 0 },
                { label:'Online Members:', value: group?.onlineUsers?.length || 0 },
                { label:'Total Members:',  value: group?.members?.length || 0 },
              ].map((s, i) => (
                <div key={i} style={styles.statItem}>
                  <span style={styles.statLabel}>{s.label}</span>
                  <span style={styles.statValue}>{s.value}</span>
                </div>
              ))}
              {group?.createdAt && (
                <div style={styles.statItem}>
                  <span style={styles.statLabel}>Session Started:</span>
                  <span style={styles.statValue}>{new Date(group.createdAt).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </>
  );
};

const styles = {
  backdrop:{ position:'fixed', top:0, left:0, right:0, bottom:0, backgroundColor:'rgba(0,0,0,0.5)', zIndex:999 },
  sidebar:{ position:'fixed', top:0, right:0, width:'360px', height:'100vh', backgroundColor:'white', boxShadow:'-2px 0 12px rgba(0,0,0,0.15)', transition:'right 0.28s ease', zIndex:1000, overflowY:'auto', display:'flex', flexDirection:'column' },

  // Header
  sidebarHeader:{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'16px 20px', backgroundColor:'#f9fafb', borderBottom:'1px solid #e5e7eb', flexShrink:0 },
  sidebarBrand:{ fontSize:'16px', fontWeight:'800', color:'#4F46E5', letterSpacing:'-0.3px' },
  closeButton:{ background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:'#6b7280', padding:'4px' },

  // Nav section
  navSection:{ padding:'8px 0', borderBottom:'1px solid #f3f4f6' },
  navItem:{ display:'flex', alignItems:'center', gap:'12px', padding:'10px 20px', border:'none', width:'100%', textAlign:'left', cursor:'pointer', fontSize:'14px', fontWeight:'500', transition:'all 0.15s', position:'relative', borderRadius:0 },
  navIcon:{ fontSize:'16px', width:'20px', textAlign:'center', flexShrink:0 },
  navTextWrap:{ display:'flex', flexDirection:'column', flex:1 },
  navLabel:{ fontSize:'14px', fontWeight:'500' },
  navSub:{ fontSize:'11px', color:'#9ca3af', marginTop:'1px' },
  navActive:{ position:'absolute', left:0, top:0, bottom:0, width:'3px', backgroundColor:'#4F46E5', borderRadius:'0 3px 3px 0' },

  // Participants panel
  participantsPanel:{ padding:'16px 20px', borderBottom:'1px solid #f3f4f6', backgroundColor:'#fafafa' },
  participantsHeader:{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' },
  participantsTitle:{ fontSize:'13px', fontWeight:'700', color:'#374151' },
  onlinePill:{ fontSize:'11px', fontWeight:'600', color:'#10B981', backgroundColor:'#D1FAE5', padding:'3px 8px', borderRadius:'10px' },
  participantsList:{ display:'flex', flexDirection:'column', gap:'8px' },
  participantRow:{ display:'flex', alignItems:'center', gap:'10px' },
  participantAvatar:{ width:'32px', height:'32px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:'13px', fontWeight:'600', flexShrink:0, position:'relative' },
  onlineDot:{ position:'absolute', bottom:0, right:0, width:'9px', height:'9px', backgroundColor:'#10B981', borderRadius:'50%', border:'2px solid white' },
  participantName:{ fontSize:'13px', color:'#374151', fontWeight:'500', flex:1 },
  moreParticipants:{ fontSize:'12px', color:'#9ca3af', paddingLeft:'42px', marginTop:'4px' },

  // Engagement panel (teacher)
  engagementPanel:{ padding:'14px 20px', borderBottom:'1px solid #f3f4f6', backgroundColor:'#fafafa' },
  engagementTitle:{ fontSize:'10px', fontWeight:'700', color:'#9ca3af', letterSpacing:'1px', marginBottom:'8px' },
  engagementContent:{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'8px' },
  engagementIcon:{ fontSize:'28px' },
  engagementScore:{ fontSize:'24px', fontWeight:'800', color:'#111827' },
  engagementLabel:{ fontSize:'11px', color:'#6b7280' },
  engagementBar:{ height:'4px', backgroundColor:'#e5e7eb', borderRadius:'2px', overflow:'hidden' },
  engagementFill:{ height:'100%', backgroundColor:'#4F46E5', borderRadius:'2px', transition:'width 0.5s' },

  // Student actions panel
  studentActionsPanel:{ padding:'12px 20px', borderBottom:'1px solid #f3f4f6' },
  supportBtn:{ display:'flex', alignItems:'center', gap:'8px', width:'100%', padding:'10px 16px', border:'none', background:'none', fontSize:'14px', fontWeight:'500', color:'#374151', cursor:'pointer', borderRadius:'8px', textAlign:'left', marginBottom:'4px' },
  leaveSessionBtn:{ display:'flex', alignItems:'center', gap:'8px', width:'100%', padding:'10px 16px', border:'none', background:'none', fontSize:'14px', fontWeight:'600', color:'#DC2626', cursor:'pointer', borderRadius:'8px', textAlign:'left' },

  divider:{ height:'1px', backgroundColor:'#e5e7eb', margin:'8px 0' },
  sectionsTitle:{ padding:'10px 20px 4px', fontSize:'11px', fontWeight:'700', color:'#9ca3af', letterSpacing:'0.5px' },

  // Existing sections
  section:{ marginBottom:'2px', borderBottom:'1px solid #f3f4f6' },
  sectionHeader:{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 20px', cursor:'pointer', backgroundColor:'white' },
  sectionTitle:{ fontSize:'14px', fontWeight:'600', color:'#333' },
  arrow:{ fontSize:'12px', color:'#9ca3af' },
  sectionContent:{ padding:'12px 20px', backgroundColor:'#fafafa' },
  description:{ fontSize:'13px', color:'#666', marginBottom:'10px' },
  qrSection:{ textAlign:'center', paddingTop:6 },
  qrCode:{ width:'180px', height:'180px', border:'2px solid #ddd', borderRadius:'8px', padding:'6px', objectFit:'contain', backgroundColor:'white' },
  pinDisplay:{ fontSize:'16px', fontWeight:'700', color:'#25D366', marginTop:'8px' },
  button:{ padding:'10px 14px', fontSize:'14px', fontWeight:'600', backgroundColor:'#25D366', color:'white', border:'none', borderRadius:'6px', cursor:'pointer' },
  smallBtn:{ padding:'5px 8px', marginRight:6, marginTop:6, fontSize:12, borderRadius:5, border:'1px solid #ddd', cursor:'pointer', background:'#fff' },
  errorText:{ fontSize:'12px', color:'#dc3545', padding:'6px 8px', backgroundColor:'#fee', borderRadius:'4px', marginTop:8 },
  successText:{ fontSize:'12px', color:'#28a745', padding:'6px 8px', backgroundColor:'#efe', borderRadius:'4px', marginTop:8 },
  activeUsersList:{ display:'flex', flexDirection:'column', gap:'6px', marginBottom:'8px' },
  activeUserItem:{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', backgroundColor:'#D7F0DD', borderRadius:'6px' },
  activeUserLeft:{ display:'flex', alignItems:'center', gap:'8px' },
  activeStatusDot:{ width:'8px', height:'8px', borderRadius:'50%', backgroundColor:'#25D366', flexShrink:0 },
  activeUserName:{ fontSize:'13px', color:'#333', fontWeight:'500' },
  messageCount:{ fontSize:'11px', color:'#075E54', backgroundColor:'white', padding:'2px 7px', borderRadius:'10px', fontWeight:'600' },
  noUsers:{ fontSize:'13px', color:'#999', textAlign:'center', padding:'12px' },
  memberCount:{ fontSize:'13px', fontWeight:'600', color:'#333', marginBottom:'10px' },
  memberList:{ display:'flex', flexDirection:'column', gap:'6px' },
  memberItem:{ display:'flex', alignItems:'center', gap:'8px', padding:'8px 10px', backgroundColor:'white', borderRadius:'6px', border:'1px solid #f0f0f0' },
  statusDot:{ width:'8px', height:'8px', borderRadius:'50%', flexShrink:0 },
  memberName:{ fontSize:'13px', color:'#333', flex:1 },
  adminBadge:{ fontSize:'10px', padding:'2px 7px', backgroundColor:'#075E54', color:'white', borderRadius:'10px', fontWeight:'600' },
  noGroup:{ fontSize:'13px', color:'#999', textAlign:'center', padding:'12px' },
  statItem:{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid #f0f0f0' },
  statLabel:{ fontSize:'13px', color:'#666' },
  statValue:{ fontSize:'15px', fontWeight:'600', color:'#25D366' },
};

export default Sidebar;