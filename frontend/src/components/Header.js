// frontend/src/components/Header.js
// ✅ UI REDESIGN — Visily-style clean two-row header
//
// WHY this structure:
//   Teacher needs: LIVE badge, session name, start-time, View PIN & QR,
//                  Live Analytics, End Session, bell, ⋮
//   Student needs: chat icon, session name, SESSION ACTIVE • N, View PIN,
//                  bell, ⋮ (no analytics, no end session)
//   Both roles look different at a glance → no confusion about who has control
//
// STRUCTURE:
//   Row 1 — brand bar:  ClassVibe logo  |  [bell + ⋮ when NOT in session]
//   Row 2 — session bar (only when groupName exists):
//            LEFT  → role-specific session identity
//            RIGHT → role-specific action buttons
//
// ALL EXISTING PROPS UNCHANGED — new optional props gracefully degrade:
//   participantCount  (student sub-header "• N PARTICIPANTS")
//   sessionStartedAt  (teacher sub-header "Session started X ago")
//   onViewPin         (open PIN/QR modal — pass from App.js)
//
// NOTE: api.js needs NO changes — getGroupDetails already returns pin, qrCode, createdAt

import React, { useState, useEffect } from "react";
import NotificationBell from './NotificationBell';

const Header = ({
  // ── Existing props (all kept, nothing removed) ──
  onEndSession,
  onLeaveMeeting,
  onCreateGroup,      // kept for backward compat, not shown in header
  onOpenSchedule,     // kept for backward compat, not shown in header
  onOpenQuiz,         // kept for backward compat, not shown in header
  onOpenAnalytics,
  onToggleSidebar,
  isAdmin,
  groupName,
  userRole,
  onBack,
  socket,
  // ── New optional props ──
  participantCount,   // number  — student row shows "• N PARTICIPANTS"
  sessionStartedAt,   // Date    — teacher row shows "Session started X ago"
  onViewPin,          // fn      — opens PIN / QR modal; if omitted, button hidden
}) => {

  // ── "Session started X ago" — updates every 60 s ──────────────────────
  const [timeAgo, setTimeAgo] = useState('');

  useEffect(() => {
    if (!sessionStartedAt) return;
    const calc = () => {
      const mins = Math.floor((Date.now() - new Date(sessionStartedAt)) / 60000);
      if (mins < 1)   return setTimeAgo('just now');
      if (mins < 60)  return setTimeAgo(`${mins} minute${mins !== 1 ? 's' : ''} ago`);
      const hrs = Math.floor(mins / 60);
      setTimeAgo(`${hrs} hour${hrs !== 1 ? 's' : ''} ago`);
    };
    calc();
    const id = setInterval(calc, 60000);
    return () => clearInterval(id);
  }, [sessionStartedAt]);

  const isTeacher = userRole === 'teacher';

  // ════════════════════════════════════════════════════════════════════════
  return (
    <header style={S.header}>

      {/* ═══ ROW 1 — BRAND BAR ════════════════════════════════════════════ */}
      <div style={S.brandRow}>
        <div style={S.brandLeft}>

          {/* ClassVibe wordmark */}
          <span style={S.logo}>ClassVibe</span>

          {/* Back button — only when explicitly provided */}
          {onBack && !groupName && (
            <button onClick={onBack} style={S.backBtn}>← Back</button>
          )}
        </div>

        <div style={S.brandRight}>
          {/* Bell + hamburger only when NOT in a session (in-session controls
              move to the session bar below for cleaner separation) */}
          {!groupName && (
            <>
              {socket && <NotificationBell socket={socket} />}
              <button onClick={onToggleSidebar} style={S.hamburgerBtn} aria-label="Menu">
                <span style={S.hLine} />
                <span style={S.hLine} />
                <span style={S.hLine} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* ═══ ROW 2 — SESSION SUB-HEADER (only when in a session) ══════════ */}
      {groupName && (
        <div style={S.sessionBar}>

          {/* ── LEFT: session identity ── */}
          <div style={S.sessionLeft}>
            {isTeacher ? (
              /* TEACHER: LIVE badge + name + started-ago */
              <>
                <span style={S.liveBadge}>LIVE</span>
                <div style={S.sessionInfo}>
                  <span style={S.sessionName}>{groupName}</span>
                  {timeAgo && (
                    <span style={S.sessionMeta}>Session started {timeAgo}</span>
                  )}
                </div>
              </>
            ) : (
              /* STUDENT: chat icon + name + SESSION ACTIVE line */
              <>
                <div style={S.chatIconBox}>
                  <span style={{ fontSize: 15 }}>💬</span>
                </div>
                <div style={S.sessionInfo}>
                  <span style={S.sessionName}>{groupName}</span>
                  <span style={S.sessionMeta}>
                    SESSION ACTIVE
                    {participantCount ? ` • ${participantCount} PARTICIPANTS` : ''}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* ── RIGHT: action buttons ── */}
          <div style={S.sessionRight}>

            {/* View Session PIN & QR  (teacher) / View Session PIN (student) */}
            {onViewPin && (
              <button
                onClick={onViewPin}
                style={S.pinBtn}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#ffffff'}
              >
                {isTeacher ? 'View Session PIN & QR' : 'View Session PIN'}
              </button>
            )}

            {/* Live Analytics — teacher only */}
            {isTeacher && onOpenAnalytics && (
              <button
                onClick={onOpenAnalytics}
                style={S.analyticsBtn}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#ffffff'}
              >
                📊 Live Analytics
              </button>
            )}

            {/* End Session — admin/teacher only */}
            {isAdmin && onEndSession && (
              <button
                onClick={onEndSession}
                style={S.endBtn}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#dc2626'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#ef4444'}
              >
                🔴 End Session
              </button>
            )}

            {/* Leave Meeting — student only */}
            {!isAdmin && onLeaveMeeting && groupName && (
              <button
                onClick={onLeaveMeeting}
                style={S.leaveBtn}
                onMouseEnter={e => e.currentTarget.style.backgroundColor = '#ea580c'}
                onMouseLeave={e => e.currentTarget.style.backgroundColor = '#f97316'}
              >
                Leave
              </button>
            )}

            {/* Notification Bell */}
            {socket && <NotificationBell socket={socket} />}

            {/* Three-dot menu — opens Sidebar */}
            <button
              onClick={onToggleSidebar}
              style={S.moreBtn}
              aria-label="More options"
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              ⋮
            </button>

          </div>
        </div>
      )}
    </header>
  );
};

// ══════════════════════════════════════════════════════════════════════════
//  STYLES
// ══════════════════════════════════════════════════════════════════════════
const S = {

  // Outer header wrapper
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 1000,
    backgroundColor: '#ffffff',
    boxShadow: '0 1px 0 #e2e8f0, 0 2px 8px rgba(0,0,0,0.04)',
  },

  // ── Brand row ──────────────────────────────────────────────────────────
  brandRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 20px',
    borderBottom: '1px solid #f1f5f9',
    minHeight: 52,
  },
  brandLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: '-0.5px',
    userSelect: 'none',
  },
  backBtn: {
    padding: '5px 12px',
    fontSize: 13,
    fontWeight: '600',
    backgroundColor: '#f1f5f9',
    color: '#475569',
    border: '1px solid #e2e8f0',
    borderRadius: 6,
    cursor: 'pointer',
  },
  brandRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  // Hamburger (shown only when not in session)
  hamburgerBtn: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-around',
    width: 32,
    height: 28,
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: 2,
    gap: 4,
  },
  hLine: {
    display: 'block',
    width: '100%',
    height: 2,
    backgroundColor: '#64748b',
    borderRadius: 1,
  },

  // ── Session sub-header ─────────────────────────────────────────────────
  sessionBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 20px',
    borderBottom: '1px solid #e2e8f0',
    backgroundColor: '#ffffff',
    flexWrap: 'wrap',
    gap: '8px 12px',
    minHeight: 52,
  },

  // Left: identity block
  sessionLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0, // prevent flex overflow
  },

  // LIVE badge (teacher)
  liveBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 8px',
    backgroundColor: '#22c55e',
    color: '#ffffff',
    borderRadius: 5,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: '0.8px',
    flexShrink: 0,
    lineHeight: 1.6,
  },

  // Chat icon box (student)
  chatIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    border: '1px solid #e2e8f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },

  // Session name + meta
  sessionInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    minWidth: 0,
    overflow: 'hidden',
  },
  sessionName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0f172a',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  sessionMeta: {
    fontSize: 10,
    fontWeight: '600',
    color: '#64748b',
    letterSpacing: '0.3px',
    textTransform: 'uppercase',
  },

  // Right: action buttons
  sessionRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
    flexWrap: 'wrap',
  },

  // View PIN button (outlined, both roles)
  pinBtn: {
    padding: '7px 13px',
    fontSize: 12,
    fontWeight: '500',
    backgroundColor: '#ffffff',
    color: '#374151',
    border: '1px solid #e2e8f0',
    borderRadius: 7,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'background 0.15s',
  },

  // Live Analytics button (teacher only, outlined)
  analyticsBtn: {
    padding: '7px 13px',
    fontSize: 12,
    fontWeight: '500',
    backgroundColor: '#ffffff',
    color: '#374151',
    border: '1px solid #e2e8f0',
    borderRadius: 7,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'background 0.15s',
  },

  // End Session button (red solid, teacher/admin)
  endBtn: {
    padding: '7px 13px',
    fontSize: 12,
    fontWeight: '700',
    backgroundColor: '#ef4444',
    color: '#ffffff',
    border: 'none',
    borderRadius: 7,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'background 0.15s',
  },

  // Leave Meeting button (orange, student)
  leaveBtn: {
    padding: '7px 13px',
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: '#f97316',
    color: '#ffffff',
    border: 'none',
    borderRadius: 7,
    cursor: 'pointer',
    transition: 'background 0.15s',
  },

  // ⋮ Three-dot menu
  moreBtn: {
    width: 34,
    height: 34,
    fontSize: 22,
    fontWeight: '700',
    color: '#475569',
    backgroundColor: 'transparent',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
    transition: 'background 0.15s',
    flexShrink: 0,
  },
};

export default Header;