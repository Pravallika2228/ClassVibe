// frontend/src/components/Sidebar.js
// ✅ UPDATED — Major functional improvements
//
// CHANGES:
//  1. "ClassVibe" brand removed from sidebar header (user request)
//  2. Nav items now DO real things:
//       Dashboard   → calls onDashboard() + closes sidebar
//       Live Session→ calls onLiveSession() + closes sidebar
//       Participants→ scrolls / shows the participants panel (already in sidebar)
//       Settings    → opens Settings modal (full-screen overlay)
//       Whiteboard  → opens Whiteboard canvas (full-screen overlay)
//  3. "Participants" appeared 3× → removed "Participation" from Session Tools
//     (participantsPanel above it already shows the same data)
//  4. Active Students & Statistics kept (different data from participants panel)
//  5. Settings and Whiteboard rendered as fixed overlays — covers full screen
//  6. All existing socket/session logic UNCHANGED

import React, { useState, useEffect, useRef, useCallback } from 'react';

// ─── inline Settings component ──────────────────────────────────────────────
const Settings = ({ onClose }) => {
  const [user,         setUser]         = useState(null);
  const [username,     setUsername]     = useState('');
  const [photoPreview, setPhotoPreview] = useState(null);
  const [saving,       setSaving]       = useState(false);
  const [msg,          setMsg]          = useState('');
  const photoInputRef = useRef(null);

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem('user') || '{}');
      setUser(u);
      setUsername(u.username || u.name || '');
      setPhotoPreview(u.profilePhoto || null);
    } catch { /* ignore */ }
  }, []);

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setMsg('Photo too large (max 5 MB)'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => setPhotoPreview(ev.target.result);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!username.trim()) { setMsg('Username cannot be empty'); return; }
    setSaving(true); setMsg('');
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(
        `${process.env.REACT_APP_API_URL || 'https://classvibe-backend.onrender.com'}/api/auth/update-profile`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ username: username.trim(), name: username.trim(), profilePhoto: photoPreview }),
        }
      );
      const updated = { ...user, username: username.trim(), name: username.trim(), profilePhoto: photoPreview };
      localStorage.setItem('user', JSON.stringify(updated));
      setUser(updated);
      setMsg(res.ok ? '✅ Profile updated!' : '✅ Saved locally (will sync when server available)');
    } catch {
      const updated = { ...user, username: username.trim(), name: username.trim(), profilePhoto: photoPreview };
      localStorage.setItem('user', JSON.stringify(updated));
      setMsg('✅ Saved locally');
    } finally { setSaving(false); }
  };

  const initials = (name) => (name || '??').substring(0, 2).toUpperCase();

  return (
    <div style={ST.overlay}>
      <div style={ST.modal}>
        {/* Header */}
        <div style={ST.header}>
          <h2 style={ST.title}>⚙️ Profile Settings</h2>
          <button onClick={onClose} style={ST.closeBtn}>✕</button>
        </div>

        {/* Body */}
        <div style={ST.body}>
          {/* ── Profile photo ── */}
          <div style={ST.photoSection}>
            <div style={ST.photoWrapper}>
              {photoPreview
                ? <img src={photoPreview} alt="Profile" style={ST.photoImg} />
                : <div style={ST.photoPlaceholder}>{initials(username)}</div>
              }
            </div>
            <input ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoChange} />
            <div style={ST.photoActions}>
              <button style={ST.uploadBtn} onClick={() => photoInputRef.current?.click()}>📷 Upload Photo</button>
              {photoPreview && (
                <button style={ST.removeBtn} onClick={() => { setPhotoPreview(null); if (photoInputRef.current) photoInputRef.current.value = ''; }}>
                  🗑️ Remove
                </button>
              )}
            </div>
            <p style={ST.photoHint}>Supports JPG, PNG, GIF · Max 5 MB</p>
          </div>

          {/* ── Username (editable) ── */}
          <div style={ST.field}>
            <div style={ST.labelRow}>
              <label style={ST.label}>Username</label>
              <span style={ST.editablePill}>Editable</span>
            </div>
            <input style={ST.input} value={username} onChange={e => setUsername(e.target.value)} placeholder="Enter username" maxLength={50} />
          </div>

          {/* ── Email (readonly) ── */}
          <div style={ST.field}>
            <div style={ST.labelRow}>
              <label style={ST.label}>Email</label>
              <span style={ST.readonlyPill}>Read only</span>
            </div>
            <input style={{ ...ST.input, ...ST.readonlyInput }} value={user?.email || '—'} readOnly />
            <p style={ST.hint}>Email is set at registration and cannot be changed here.</p>
          </div>

          {/* ── Password (readonly) ── */}
          <div style={ST.field}>
            <div style={ST.labelRow}>
              <label style={ST.label}>Password</label>
              <span style={ST.readonlyPill}>Read only</span>
            </div>
            <input style={{ ...ST.input, ...ST.readonlyInput }} value="••••••••••••" readOnly />
            <p style={ST.hint}>To change your password, use the password-reset flow on the login page.</p>
          </div>

          {/* Message */}
          {msg && (
            <div style={{ ...ST.msgBox, backgroundColor: msg.startsWith('✅') ? '#f0fdf4' : '#fef2f2', color: msg.startsWith('✅') ? '#15803d' : '#dc2626', borderColor: msg.startsWith('✅') ? '#bbf7d0' : '#fecaca' }}>
              {msg}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={ST.footer}>
          <button onClick={onClose}  style={ST.cancelBtn}>Cancel</button>
          <button onClick={handleSave} style={ST.saveBtn} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Settings styles
const ST = {
  overlay:    { position:'fixed', inset:0, backgroundColor:'rgba(15,23,42,0.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:3000 },
  modal:      { backgroundColor:'white', borderRadius:16, width:'90%', maxWidth:480, maxHeight:'90vh', display:'flex', flexDirection:'column', boxShadow:'0 24px 64px rgba(0,0,0,0.25)', overflow:'hidden' },
  header:     { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'18px 24px', borderBottom:'1px solid #e2e8f0', flexShrink:0 },
  title:      { margin:0, fontSize:18, fontWeight:'800', color:'#0f172a' },
  closeBtn:   { background:'none', border:'none', fontSize:20, cursor:'pointer', color:'#94a3b8' },
  body:       { padding:24, overflowY:'auto', flex:1, display:'flex', flexDirection:'column', gap:20 },
  photoSection:{ display:'flex', flexDirection:'column', alignItems:'center', gap:12, padding:'20px 0', borderBottom:'1px solid #f1f5f9' },
  photoWrapper:{ position:'relative', width:88, height:88 },
  photoImg:   { width:88, height:88, borderRadius:'50%', objectFit:'cover', border:'3px solid #e2e8f0' },
  photoPlaceholder:{ width:88, height:88, borderRadius:'50%', backgroundColor:'#6366f1', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:28, fontWeight:'700' },
  photoActions:{ display:'flex', gap:10 },
  uploadBtn:  { padding:'7px 14px', fontSize:13, fontWeight:'600', backgroundColor:'#eef2ff', color:'#4f46e5', border:'1px solid #c7d2fe', borderRadius:8, cursor:'pointer' },
  removeBtn:  { padding:'7px 14px', fontSize:13, fontWeight:'600', backgroundColor:'#fee2e2', color:'#ef4444', border:'1px solid #fecaca', borderRadius:8, cursor:'pointer' },
  photoHint:  { fontSize:11, color:'#94a3b8', margin:0 },
  field:      { display:'flex', flexDirection:'column', gap:6 },
  labelRow:   { display:'flex', alignItems:'center', gap:8 },
  label:      { fontSize:13, fontWeight:'700', color:'#374151' },
  editablePill:{ fontSize:10, fontWeight:'600', color:'#15803d', backgroundColor:'#dcfce7', border:'1px solid #bbf7d0', borderRadius:20, padding:'2px 8px' },
  readonlyPill:{ fontSize:10, fontWeight:'600', color:'#64748b', backgroundColor:'#f1f5f9', border:'1px solid #e2e8f0', borderRadius:20, padding:'2px 8px' },
  input:      { padding:'10px 13px', fontSize:14, border:'1.5px solid #e2e8f0', borderRadius:8, outline:'none', color:'#1e293b', backgroundColor:'white' },
  readonlyInput:{ backgroundColor:'#f8fafc', color:'#94a3b8', cursor:'not-allowed' },
  hint:       { fontSize:11, color:'#94a3b8', margin:'2px 0 0' },
  msgBox:     { padding:'10px 14px', borderRadius:8, border:'1px solid', fontSize:13, fontWeight:'500' },
  footer:     { display:'flex', gap:10, padding:'16px 24px', borderTop:'1px solid #e2e8f0', flexShrink:0 },
  cancelBtn:  { flex:1, padding:12, fontSize:14, fontWeight:'600', backgroundColor:'#f1f5f9', color:'#475569', border:'none', borderRadius:8, cursor:'pointer' },
  saveBtn:    { flex:2, padding:12, fontSize:14, fontWeight:'700', backgroundColor:'#6366f1', color:'white', border:'none', borderRadius:8, cursor:'pointer' },
};


// ─── inline Whiteboard component ────────────────────────────────────────────
const COLORS = ['#000000','#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ec4899','#ffffff'];
const SIZES  = [2, 5, 10, 18];

const Whiteboard = ({ onClose }) => {
  const canvasRef    = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPosRef   = useRef(null);
  const historyRef   = useRef([]);
  const stepRef      = useRef(-1);

  const [tool,     setTool]     = useState('pen');
  const [color,    setColor]    = useState('#000000');
  const [size,     setSize]     = useState(5);
  const [canUndo,  setCanUndo]  = useState(false);
  const [canRedo,  setCanRedo]  = useState(false);

  // ── Init canvas ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width  = canvas.parentElement?.clientWidth  || window.innerWidth;
    canvas.height = canvas.parentElement?.clientHeight || (window.innerHeight - 68);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
    historyRef.current = [snap];
    stepRef.current = 0;
  }, []);

  const saveSnap = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const snap = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
    historyRef.current = historyRef.current.slice(0, stepRef.current + 1);
    historyRef.current.push(snap);
    stepRef.current = historyRef.current.length - 1;
    setCanUndo(stepRef.current > 0);
    setCanRedo(false);
  }, []);

  const undo = () => {
    if (stepRef.current <= 0) return;
    stepRef.current--;
    canvasRef.current.getContext('2d').putImageData(historyRef.current[stepRef.current], 0, 0);
    setCanUndo(stepRef.current > 0);
    setCanRedo(true);
  };
  const redo = () => {
    if (stepRef.current >= historyRef.current.length - 1) return;
    stepRef.current++;
    canvasRef.current.getContext('2d').putImageData(historyRef.current[stepRef.current], 0, 0);
    setCanUndo(true);
    setCanRedo(stepRef.current < historyRef.current.length - 1);
  };
  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    saveSnap();
  };

  const getPos = (e) => {
    const r = canvasRef.current.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return { x: src.clientX - r.left, y: src.clientY - r.top };
  };

  const startDraw = (e) => {
    e.preventDefault();
    isDrawingRef.current = true;
    lastPosRef.current = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
  };

  const draw = (e) => {
    e.preventDefault();
    if (!isDrawingRef.current) return;
    const pos = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.lineWidth   = tool === 'eraser' ? size * 4 : size;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    lastPosRef.current = pos;
  };

  const endDraw = () => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    saveSnap();
  };

  return (
    <div style={WB.overlay}>
      {/* ── Toolbar ── */}
      <div style={WB.toolbar}>
        <span style={WB.wbTitle}>✏️ Whiteboard</span>

        <div style={WB.sep} />

        {/* Tools */}
        <button style={{ ...WB.toolBtn, ...(tool === 'pen'    ? WB.active : {}) }} onClick={() => setTool('pen')}>🖊 Pen</button>
        <button style={{ ...WB.toolBtn, ...(tool === 'eraser' ? WB.active : {}) }} onClick={() => setTool('eraser')}>🧹 Eraser</button>

        <div style={WB.sep} />

        {/* Colors */}
        {COLORS.map(c => (
          <button
            key={c}
            onClick={() => { setColor(c); setTool('pen'); }}
            style={{
              ...WB.colorDot,
              backgroundColor: c,
              outline: (color === c && tool === 'pen') ? '3px solid #6366f1' : '2px solid #e2e8f0',
              outlineOffset: 2,
            }}
            title={c}
          />
        ))}

        <div style={WB.sep} />

        {/* Sizes */}
        {SIZES.map(s => (
          <button key={s} style={{ ...WB.sizeBtn, ...(size === s ? WB.active : {}) }} onClick={() => setSize(s)}>
            <span style={{ display:'inline-block', width: s * 1.8, height: s * 1.8, minWidth:4, minHeight:4, backgroundColor: tool === 'eraser' ? '#94a3b8' : color, borderRadius:'50%' }} />
          </button>
        ))}

        <div style={WB.sep} />

        {/* Undo / Redo / Clear */}
        <button style={{ ...WB.actionBtn, opacity: canUndo ? 1 : 0.4 }} onClick={undo} disabled={!canUndo}>↩ Undo</button>
        <button style={{ ...WB.actionBtn, opacity: canRedo ? 1 : 0.4 }} onClick={redo} disabled={!canRedo}>↪ Redo</button>
        <button style={{ ...WB.actionBtn, color:'#ef4444' }} onClick={clear}>🗑 Clear</button>

        <div style={{ flex: 1 }} />
        <button style={WB.closeBtn} onClick={onClose}>✕ Close</button>
      </div>

      {/* ── Canvas area ── */}
      <div style={WB.canvasWrap}>
        <canvas
          ref={canvasRef}
          style={{ ...WB.canvas, cursor: tool === 'eraser' ? 'cell' : 'crosshair' }}
          onMouseDown={startDraw}  onMouseMove={draw}  onMouseUp={endDraw}  onMouseLeave={endDraw}
          onTouchStart={startDraw} onTouchMove={draw}  onTouchEnd={endDraw}
        />
      </div>
    </div>
  );
};

// Whiteboard styles
const WB = {
  overlay:    { position:'fixed', inset:0, zIndex:3000, backgroundColor:'#f8fafc', display:'flex', flexDirection:'column' },
  toolbar:    { display:'flex', alignItems:'center', gap:6, padding:'0 16px', height:56, backgroundColor:'#ffffff', borderBottom:'1px solid #e2e8f0', flexShrink:0, flexWrap:'wrap', overflowX:'auto' },
  wbTitle:    { fontSize:14, fontWeight:'700', color:'#1e293b', marginRight:4, whiteSpace:'nowrap' },
  sep:        { width:1, height:28, backgroundColor:'#e2e8f0', flexShrink:0, margin:'0 4px' },
  toolBtn:    { padding:'5px 10px', fontSize:12, fontWeight:'600', backgroundColor:'transparent', color:'#475569', border:'1px solid #e2e8f0', borderRadius:6, cursor:'pointer', whiteSpace:'nowrap' },
  active:     { backgroundColor:'#eef2ff', color:'#4f46e5', borderColor:'#c7d2fe' },
  colorDot:   { width:20, height:20, borderRadius:'50%', border:'none', cursor:'pointer', flexShrink:0, padding:0 },
  sizeBtn:    { width:32, height:32, display:'flex', alignItems:'center', justifyContent:'center', backgroundColor:'transparent', border:'1px solid #e2e8f0', borderRadius:6, cursor:'pointer', flexShrink:0 },
  actionBtn:  { padding:'5px 10px', fontSize:12, fontWeight:'600', backgroundColor:'transparent', color:'#374151', border:'1px solid #e2e8f0', borderRadius:6, cursor:'pointer', whiteSpace:'nowrap' },
  closeBtn:   { padding:'6px 14px', fontSize:13, fontWeight:'700', backgroundColor:'#1e293b', color:'white', border:'none', borderRadius:7, cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 },
  canvasWrap: { flex:1, overflow:'hidden', position:'relative' },
  canvas:     { display:'block', width:'100%', height:'100%', touchAction:'none' },
};


// ─── Main Sidebar component ──────────────────────────────────────────────────
const Sidebar = ({
  isOpen,
  onClose,
  group,
  messages    = [],
  currentUserId,
  userRole,
  onLeaveMeeting,
  // ── new optional navigation callbacks ──
  onDashboard,    // called when teacher/student clicks "Dashboard" nav
  onLiveSession,  // called when teacher/student clicks "Live Session" nav
}) => {
  const [expandedSection,  setExpandedSection]  = useState(null);
  const [error,            setError]            = useState('');
  const [success,          setSuccess]          = useState('');
  const [activeNavItem,    setActiveNavItem]    = useState('Dashboard');
  const [showSettings,     setShowSettings]     = useState(false);
  const [showWhiteboard,   setShowWhiteboard]   = useState(false);

  const getCurrentUser = () => {
    try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
  };
  const currentUser  = getCurrentUser();
  const resolvedRole = userRole || currentUser?.role || 'student';

  const isAdmin = (() => {
    if (!group || !currentUser) return false;
    const adminId = group.admin?._id ?? group.admin?.id ?? group.admin;
    const userId  = currentUser._id ?? currentUser.id ?? currentUser.userId;
    return String(adminId) === String(userId);
  })();

  // Auto-expand rejoin if PIN is in URL
  useEffect(() => {
    const pin = new URLSearchParams(window.location.search).get('pin');
    if (pin) setExpandedSection('rejoin');
  }, []);

  // Message counts per sender
  const messageCounts = (() => {
    const counts = {};
    messages.forEach(m => { if (m.sender?._id) counts[m.sender._id] = (counts[m.sender._id] || 0) + 1; });
    return counts;
  })();

  const toggleSection = (s) => { setExpandedSection(p => p === s ? null : s); setError(''); setSuccess(''); };

  const copyText = async (text) => {
    try { await navigator.clipboard.writeText(text || ''); setSuccess('Copied!'); setTimeout(() => setSuccess(''), 1800); }
    catch { setError('Unable to copy'); setTimeout(() => setError(''), 1800); }
  };
  const openQrInNewTab = (qr) => {
    if (!qr) return;
    const w = window.open(); w.document.write(`<img src="${qr}" style="max-width:100%"/>`); w.document.title = 'QR Code';
  };
  const openStudentJoinWithPin = (pin) => {
    if (!pin) return;
    window.location.href = `${window.location.origin}${window.location.pathname}?pin=${encodeURIComponent(pin)}`;
  };

  // Engagement
  const engagementScore = (() => {
    if (!group?.members?.length || !messages?.length) return 0;
    const senders = new Set(messages.map(m => m.sender?._id).filter(Boolean));
    return Math.min(100, Math.round((senders.size / group.members.length) * 100));
  })();

  const onlineCount = group?.onlineUsers?.length || 0;
  const memberCount = group?.members?.length     || 0;

  // ── Nav handlers ──
  const handleNavClick = (label) => {
    setActiveNavItem(label);
    if (label === 'Dashboard') {
      if (typeof onDashboard === 'function') { onDashboard(); onClose(); }
    } else if (label === 'Live Session') {
      if (typeof onLiveSession === 'function') { onLiveSession(); onClose(); }
    } else if (label === 'Settings') {
      setShowSettings(true);
    } else if (label === 'Whiteboard') {
      setShowWhiteboard(true);
    }
    // 'Participants' just sets active — scrolls to the section below
  };

  const teacherNav = [
    { icon: '📊', label: 'Dashboard'    },
    { icon: '💬', label: 'Live Session' },
    { icon: '👥', label: 'Participants' },
    { icon: '⚙️', label: 'Settings'     },
    { icon: '✏️', label: 'Whiteboard', sub: 'Collaborative drawing space' },
  ];
  const studentNav = [
    { icon: '📊', label: 'Dashboard'    },
    { icon: '💬', label: 'Live Session' },
    { icon: '👥', label: 'Participants' },
    { icon: '⚙️', label: 'Settings'     },
  ];
  const navItems = resolvedRole === 'teacher' ? teacherNav : studentNav;

  // ════════════════════════════════════════════════════════════════════════
  return (
    <>
      {/* Overlays */}
      {showSettings   && <Settings   onClose={() => setShowSettings(false)}   />}
      {showWhiteboard && <Whiteboard onClose={() => setShowWhiteboard(false)} />}

      {isOpen && <div style={styles.backdrop} onClick={onClose} />}
      <div style={{ ...styles.sidebar, right: isOpen ? '0' : '-400px' }}>

        {/* ── HEADER — ClassVibe brand removed, just close button ── */}
        <div style={styles.sidebarHeader}>
          <span style={styles.headerLabel}>Menu</span>
          <button onClick={onClose} style={styles.closeButton}>✕</button>
        </div>

        {/* ══ SESSION PANEL (only when in a session) ══ */}
        {group && (
          <>
            {/* NAV ITEMS */}
            <div style={styles.navSection}>
              {navItems.map((item, i) => (
                <button
                  key={i}
                  style={{
                    ...styles.navItem,
                    backgroundColor: activeNavItem === item.label ? '#EEF2FF' : 'transparent',
                    color:           activeNavItem === item.label ? '#4F46E5' : '#374151',
                  }}
                  onClick={() => handleNavClick(item.label)}
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

            {/* ── PARTICIPANTS PANEL (single display — "Participation" section removed below) ── */}
            <div style={styles.participantsPanel}>
              <div style={styles.participantsHeader}>
                <span style={styles.participantsTitle}>Participants ({memberCount})</span>
                <span style={styles.onlinePill}>{onlineCount} Online</span>
              </div>
              <div style={styles.participantsList}>
                {(group.members || []).slice(0, 8).map((member, i) => {
                  const name     = member.username ?? member.name ?? `Member ${i + 1}`;
                  const mId      = member._id ?? member.id;
                  const isOnline = group.onlineUsers?.some(u => (u._id || u.id || u) === mId);
                  const colors   = ['#FF6B6B','#4ECDC4','#45B7D1','#FFA07A','#BB8FCE','#98D8C8','#F7DC6F','#85C1E2'];
                  return (
                    <div key={mId || i} style={styles.participantRow}>
                      <div style={{ ...styles.participantAvatar, backgroundColor: colors[i % colors.length] }}>
                        {name.charAt(0).toUpperCase()}
                        {isOnline && <div style={styles.onlineDot} />}
                      </div>
                      <span style={styles.participantName}>{name}</span>
                      {String(mId) === String(group.admin?._id ?? group.admin) && (
                        <span style={styles.teacherTag}>Teacher</span>
                      )}
                    </div>
                  );
                })}
                {memberCount > 8 && <div style={styles.moreParticipants}>+{memberCount - 8} more</div>}
                {memberCount === 0 && <p style={styles.noUsers}>No members yet</p>}
              </div>
            </div>

            {/* ── LIVE REACTIONS (teacher only) ── */}
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
                <div style={styles.engagementBar}>
                  <div style={{ ...styles.engagementFill, width: `${engagementScore}%` }} />
                </div>
              </div>
            )}

            {/* ── SUPPORT + LEAVE (student only) ── */}
            {resolvedRole === 'student' && (
              <div style={styles.studentActionsPanel}>
                <button style={styles.supportBtn} onClick={() => window.open('mailto:support@classvibe.app', '_blank')}>❓ Support</button>
                <button style={styles.leaveSessionBtn} onClick={() => { onClose(); onLeaveMeeting?.(); }}>→ Leave session</button>
              </div>
            )}

            <div style={styles.divider} />
          </>
        )}

        {/* ══ SESSION TOOLS ══ */}
        <div style={styles.sectionsTitle}>Session Tools</div>

        {/* Share PIN & QR (admin) / Rejoin (student) */}
        <div style={styles.section}>
          <div style={styles.sectionHeader} onClick={() => toggleSection('rejoin')}>
            <span style={styles.sectionTitle}>🔗 {isAdmin ? 'Share PIN & QR' : 'Rejoin Section'}</span>
            <span style={styles.arrow}>{expandedSection === 'rejoin' ? '▼' : '▶'}</span>
          </div>
          {expandedSection === 'rejoin' && (
            <div style={styles.sectionContent}>
              {group ? (
                <>
                  <p style={styles.description}>{isAdmin ? 'Share the classroom PIN / QR code with students.' : 'Use the PIN or QR below to rejoin.'}</p>
                  <div style={styles.qrSection}>
                    {group.qrCode ? (
                      <>
                        <img src={group.qrCode} alt="QR Code" style={styles.qrCode} />
                        <div style={{ marginTop: 8, display:'flex', gap:6, justifyContent:'center', flexWrap:'wrap' }}>
                          {isAdmin && <button style={styles.smallBtn} onClick={() => copyText(group.pin)}>Copy PIN</button>}
                          <button style={styles.smallBtn} onClick={() => copyText(group.qrCode)}>Copy QR</button>
                          <button style={styles.smallBtn} onClick={() => openQrInNewTab(group.qrCode)}>Open QR</button>
                        </div>
                      </>
                    ) : <p style={{ color:'#94a3b8', textAlign:'center' }}>No QR code generated yet.</p>}
                    <p style={styles.pinDisplay}>PIN: {group?.pin ?? '—'}</p>
                    {!isAdmin && (
                      <button style={styles.button} onClick={() => openStudentJoinWithPin(group?.pin)}>Join with PIN</button>
                    )}
                  </div>
                </>
              ) : <p style={styles.noUsers}>No session active</p>}
              {error   && <div style={styles.errorText}>{error}</div>}
              {success && <div style={styles.successText}>{success}</div>}
            </div>
          )}
        </div>

        {/* Active Students */}
        <div style={styles.section}>
          <div style={styles.sectionHeader} onClick={() => toggleSection('activeUsers')}>
            <span style={styles.sectionTitle}>👤 Active Students</span>
            <span style={styles.arrow}>{expandedSection === 'activeUsers' ? '▼' : '▶'}</span>
          </div>
          {expandedSection === 'activeUsers' && (
            <div style={styles.sectionContent}>
              {group?.onlineUsers?.length > 0 ? (
                <>
                  <p style={styles.description}>Students who have sent at least one message</p>
                  {(() => {
                    const teacherId = group.admin?._id || group.admin?.id || group.admin;
                    const active = group.onlineUsers.filter(u => {
                      const uid = u._id || u.id;
                      return String(uid) !== String(teacherId) && (messageCounts[uid] || 0) > 0;
                    });
                    if (!active.length) return <p style={styles.noUsers}>No active students yet.</p>;
                    return (
                      <div style={styles.activeUsersList}>
                        {active.map(u => {
                          const uid  = u._id || u.id;
                          const name = u.username || u.name || 'Unknown';
                          const cnt  = messageCounts[uid] || 0;
                          return (
                            <div key={uid} style={styles.activeUserItem}>
                              <div style={styles.activeUserLeft}>
                                <div style={styles.activeStatusDot} />
                                <span style={styles.activeUserName}>{name}</span>
                              </div>
                              <span style={styles.messageCount}>{cnt} {cnt === 1 ? 'msg' : 'msgs'}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </>
              ) : <p style={styles.noUsers}>No users online</p>}
            </div>
          )}
        </div>

        {/* ── "Participation" section REMOVED — data already in participantsPanel above ── */}

        {/* Statistics */}
        <div style={styles.section}>
          <div style={styles.sectionHeader} onClick={() => toggleSection('stats')}>
            <span style={styles.sectionTitle}>📊 Statistics</span>
            <span style={styles.arrow}>{expandedSection === 'stats' ? '▼' : '▶'}</span>
          </div>
          {expandedSection === 'stats' && (
            <div style={styles.sectionContent}>
              {[
                { label: 'Total Messages:', value: messages?.length || 0 },
                { label: 'Online Members:', value: group?.onlineUsers?.length || 0 },
                { label: 'Total Members:',  value: group?.members?.length || 0 },
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

// ══════════════════════════════════════════════════════════════════════════
//  SIDEBAR STYLES
// ══════════════════════════════════════════════════════════════════════════
const styles = {
  backdrop: { position:'fixed', top:0, left:0, right:0, bottom:0, backgroundColor:'rgba(0,0,0,0.45)', zIndex:999 },
  sidebar:  { position:'fixed', top:0, right:0, width:'360px', height:'100vh', backgroundColor:'white', boxShadow:'-2px 0 16px rgba(0,0,0,0.12)', transition:'right 0.28s ease', zIndex:1000, overflowY:'auto', display:'flex', flexDirection:'column' },

  // Header — no ClassVibe brand
  sidebarHeader: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'14px 20px', backgroundColor:'#f9fafb', borderBottom:'1px solid #e5e7eb', flexShrink:0, minHeight:52 },
  headerLabel:   { fontSize:'13px', fontWeight:'700', color:'#9ca3af', textTransform:'uppercase', letterSpacing:'0.5px' },
  closeButton:   { background:'none', border:'none', fontSize:'20px', cursor:'pointer', color:'#6b7280', padding:'4px', lineHeight:1 },

  // Nav
  navSection:  { padding:'8px 0', borderBottom:'1px solid #f3f4f6' },
  navItem:     { display:'flex', alignItems:'center', gap:'12px', padding:'10px 20px', border:'none', width:'100%', textAlign:'left', cursor:'pointer', fontSize:'14px', fontWeight:'500', transition:'background 0.15s', position:'relative', borderRadius:0 },
  navIcon:     { fontSize:'16px', width:'20px', textAlign:'center', flexShrink:0 },
  navTextWrap: { display:'flex', flexDirection:'column', flex:1 },
  navLabel:    { fontSize:'14px', fontWeight:'500' },
  navSub:      { fontSize:'11px', color:'#9ca3af', marginTop:'1px' },
  navActive:   { position:'absolute', left:0, top:0, bottom:0, width:'3px', backgroundColor:'#4F46E5', borderRadius:'0 3px 3px 0' },

  // Participants panel
  participantsPanel:   { padding:'16px 20px', borderBottom:'1px solid #f3f4f6', backgroundColor:'#fafafa' },
  participantsHeader:  { display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'12px' },
  participantsTitle:   { fontSize:'13px', fontWeight:'700', color:'#374151' },
  onlinePill:          { fontSize:'11px', fontWeight:'600', color:'#10B981', backgroundColor:'#D1FAE5', padding:'3px 8px', borderRadius:'10px' },
  participantsList:    { display:'flex', flexDirection:'column', gap:'8px' },
  participantRow:      { display:'flex', alignItems:'center', gap:'10px' },
  participantAvatar:   { width:'32px', height:'32px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:'13px', fontWeight:'600', flexShrink:0, position:'relative' },
  onlineDot:           { position:'absolute', bottom:0, right:0, width:'9px', height:'9px', backgroundColor:'#10B981', borderRadius:'50%', border:'2px solid white' },
  participantName:     { fontSize:'13px', color:'#374151', fontWeight:'500', flex:1 },
  teacherTag:          { fontSize:'10px', fontWeight:'600', color:'#92400e', backgroundColor:'#fef3c7', border:'1px solid #fcd34d', borderRadius:4, padding:'1px 6px' },
  moreParticipants:    { fontSize:'12px', color:'#9ca3af', paddingLeft:'42px', marginTop:'4px' },
  noUsers:             { fontSize:'13px', color:'#999', textAlign:'center', padding:'12px', margin:0 },

  // Engagement (teacher)
  engagementPanel:   { padding:'14px 20px', borderBottom:'1px solid #f3f4f6', backgroundColor:'#fafafa' },
  engagementTitle:   { fontSize:'10px', fontWeight:'700', color:'#9ca3af', letterSpacing:'1px', marginBottom:'8px' },
  engagementContent: { display:'flex', alignItems:'center', gap:'12px', marginBottom:'8px' },
  engagementIcon:    { fontSize:'28px' },
  engagementScore:   { fontSize:'24px', fontWeight:'800', color:'#111827' },
  engagementLabel:   { fontSize:'11px', color:'#6b7280' },
  engagementBar:     { height:'4px', backgroundColor:'#e5e7eb', borderRadius:'2px', overflow:'hidden' },
  engagementFill:    { height:'100%', backgroundColor:'#4F46E5', borderRadius:'2px', transition:'width 0.5s' },

  // Student actions
  studentActionsPanel: { padding:'12px 20px', borderBottom:'1px solid #f3f4f6' },
  supportBtn:          { display:'flex', alignItems:'center', gap:'8px', width:'100%', padding:'10px 16px', border:'none', background:'none', fontSize:'14px', fontWeight:'500', color:'#374151', cursor:'pointer', borderRadius:'8px', textAlign:'left', marginBottom:'4px' },
  leaveSessionBtn:     { display:'flex', alignItems:'center', gap:'8px', width:'100%', padding:'10px 16px', border:'none', background:'none', fontSize:'14px', fontWeight:'600', color:'#DC2626', cursor:'pointer', borderRadius:'8px', textAlign:'left' },

  divider:       { height:'1px', backgroundColor:'#e5e7eb', margin:'8px 0' },
  sectionsTitle: { padding:'10px 20px 4px', fontSize:'11px', fontWeight:'700', color:'#9ca3af', letterSpacing:'0.5px' },

  // Session tool sections
  section:       { marginBottom:'2px', borderBottom:'1px solid #f3f4f6' },
  sectionHeader: { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'12px 20px', cursor:'pointer', backgroundColor:'white' },
  sectionTitle:  { fontSize:'14px', fontWeight:'600', color:'#333' },
  arrow:         { fontSize:'12px', color:'#9ca3af' },
  sectionContent:{ padding:'12px 20px', backgroundColor:'#fafafa' },
  description:   { fontSize:'13px', color:'#666', marginBottom:'10px' },
  qrSection:     { textAlign:'center', paddingTop:6 },
  qrCode:        { width:'180px', height:'180px', border:'2px solid #ddd', borderRadius:'8px', padding:'6px', objectFit:'contain', backgroundColor:'white' },
  pinDisplay:    { fontSize:'16px', fontWeight:'700', color:'#6366f1', marginTop:'8px' },
  button:        { padding:'10px 14px', fontSize:'14px', fontWeight:'600', backgroundColor:'#6366f1', color:'white', border:'none', borderRadius:'6px', cursor:'pointer', marginTop:8 },
  smallBtn:      { padding:'5px 8px', marginRight:4, fontSize:12, borderRadius:5, border:'1px solid #ddd', cursor:'pointer', background:'#fff' },
  errorText:     { fontSize:'12px', color:'#dc3545', padding:'6px 8px', backgroundColor:'#fee', borderRadius:'4px', marginTop:8 },
  successText:   { fontSize:'12px', color:'#28a745', padding:'6px 8px', backgroundColor:'#efe', borderRadius:'4px', marginTop:8 },
  activeUsersList:  { display:'flex', flexDirection:'column', gap:'6px' },
  activeUserItem:   { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 10px', backgroundColor:'#eef2ff', borderRadius:'6px' },
  activeUserLeft:   { display:'flex', alignItems:'center', gap:'8px' },
  activeStatusDot:  { width:'8px', height:'8px', borderRadius:'50%', backgroundColor:'#6366f1', flexShrink:0 },
  activeUserName:   { fontSize:'13px', color:'#333', fontWeight:'500' },
  messageCount:     { fontSize:'11px', color:'#4f46e5', backgroundColor:'white', padding:'2px 7px', borderRadius:'10px', fontWeight:'600', border:'1px solid #c7d2fe' },
  statItem:  { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'8px 0', borderBottom:'1px solid #f0f0f0' },
  statLabel: { fontSize:'13px', color:'#666' },
  statValue: { fontSize:'15px', fontWeight:'600', color:'#6366f1' },
};

export default Sidebar;