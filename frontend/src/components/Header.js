// frontend/src/components/Header.js
// ✅ UI UPDATE v2
//
// CHANGES:
//   1. Brand row: ClassVibe logo (left) + user profile (right) — name, role, avatar
//      → Matches Image 1 reference ("Teacher Username / Teacher" + avatar circle)
//      → Pass `currentUser` prop from App.js (optional, degrades gracefully)
//   2. Search icon 🔍 added to session bar between End/Leave button and ⋮
//      → Teacher bar: LIVE | name | View PIN & QR | Live Analytics | End Session | 🔍 | ⋮
//      → Student bar: 💬 | name | SESSION ACTIVE | View PIN | 🔍 | ⋮
//      → Clicking 🔍 dispatches window.CustomEvent('toggleChatSearch')
//         ChatArea listens for this — no App.js prop drilling needed
//   3. All existing props/logic unchanged

import React, { useState, useEffect } from "react";
import NotificationBell from './NotificationBell';

const Header = ({
  // ── Existing props — all kept ──
  onEndSession,
  onLeaveMeeting,
  onCreateGroup,        // backward compat
  onOpenSchedule,       // backward compat
  onOpenQuiz,           // backward compat
  onOpenAnalytics,
  onToggleSidebar,
  isAdmin,
  groupName,
  userRole,
  onBack,
  socket,
  // ── Existing new optional props ──
  participantCount,     // student bar "• N PARTICIPANTS"
  sessionStartedAt,     // teacher bar "Session started X ago"
  onViewPin,            // open PIN/QR modal
  // ── NEW optional prop ──
  currentUser,          // { name, username, role, profilePhoto } — shows top-right profile
}) => {

  const [timeAgo, setTimeAgo] = useState('');

  useEffect(() => {
    if (!sessionStartedAt) return;
    const calc = () => {
      const mins = Math.floor((Date.now() - new Date(sessionStartedAt)) / 60000);
      if (mins < 1)  return setTimeAgo('just now');
      if (mins < 60) return setTimeAgo(`${mins} minute${mins !== 1 ? 's' : ''} ago`);
      const hrs = Math.floor(mins / 60);
      setTimeAgo(`${hrs} hour${hrs !== 1 ? 's' : ''} ago`);
    };
    calc();
    const id = setInterval(calc, 60000);
    return () => clearInterval(id);
  }, [sessionStartedAt]);

  const isTeacher = userRole === 'teacher';

  // Avatar initials fallback
  const getInitials = (name) => (name || '??').substring(0, 2).toUpperCase();

  // Dispatch search toggle to ChatArea (no prop drilling needed)
  const toggleSearch = () =>
    window.dispatchEvent(new CustomEvent('toggleChatSearch'));

  // ════════════════════════════════════════════════════════════════════════
  return (
    <header style={S.header}>

      {/* ═══ ROW 1 — BRAND BAR ═══════════════════════════════════════════
          Left:  ClassVibe wordmark (+ Back button if outside session)
          Right: User profile (name / role / avatar)  ← NEW
                 + Bell + hamburger only when NOT in a session
      ═══════════════════════════════════════════════════════════════════ */}
      <div style={S.brandRow}>

        {/* Left: logo */}
        <div style={S.brandLeft}>
          <span style={S.logo}>ClassVibe</span>
          {onBack && !groupName && (
            <button onClick={onBack} style={S.backBtn}>← Back</button>
          )}
        </div>

        {/* Right: user profile + optional bell/menu */}
        <div style={S.brandRight}>

          {/* User profile block — shown when currentUser prop is provided */}
          {currentUser && (
            <div style={S.userProfile}>
              <div style={S.userTextBlock}>
                <span style={S.userName}>
                  {currentUser.name || currentUser.username || 'User'}
                </span>
                <span style={S.userRoleLabel}>
                  {currentUser.role || userRole || ''}
                </span>
              </div>
              {/* Avatar: photo if available, else initials circle with online dot */}
              {currentUser.profilePhoto ? (
                <div style={S.avatarWrap}>
                  <img
                    src={currentUser.profilePhoto}
                    alt="profile"
                    style={S.avatarImg}
                  />
                  <div style={S.onlineDot} />
                </div>
              ) : (
                <div style={S.avatarWrap}>
                  <div style={S.avatarFallback}>
                    {getInitials(currentUser.name || currentUser.username)}
                  </div>
                  <div style={S.onlineDot} />
                </div>
              )}
            </div>
          )}

          {/* Bell + hamburger — only when NOT inside a session */}
          {!groupName && (
            <>
              {socket && <NotificationBell socket={socket} />}
              <button
                onClick={onToggleSidebar}
                style={S.hamburgerBtn}
                aria-label="Menu"
              >
                <span style={S.hLine} />
                <span style={S.hLine} />
                <span style={S.hLine} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* ═══ ROW 2 — SESSION SUB-HEADER ══════════════════════════════════
          Only shown when inside a session (groupName exists)
          Teacher: LIVE | name | View PIN & QR | Live Analytics | End | 🔍 | ⋮
          Student: 💬   | name | SESSION ACTIVE | View PIN       | 🔍 | ⋮
      ═══════════════════════════════════════════════════════════════════ */}
      {groupName && (
        <div style={S.sessionBar}>

          {/* ── LEFT: session identity ── */}
          <div style={S.sessionLeft}>
            {isTeacher ? (
              /* Teacher identity */
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
              /* Student identity */
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

            {/* View PIN & QR / View PIN */}
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

            {/* End Session — teacher/admin only */}
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

            {/* Leave — student only */}
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

            {/* 🔍 Search — dispatches event; ChatArea listens and toggles its search bar */}
            <button
              onClick={toggleSearch}
              style={S.searchBtn}
              title="Search messages"
              aria-label="Search messages"
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f1f5f9'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              🔍
            </button>

            {/* Notification Bell */}
            {socket && <NotificationBell socket={socket} />}

            {/* ⋮ Three-dot menu */}
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

  // Outer wrapper
  header: {
    position: 'sticky',
    top: 0,
    zIndex: 1000,
    backgroundColor: '#ffffff',
    boxShadow: '0 1px 0 #e2e8f0, 0 2px 8px rgba(0,0,0,0.04)',
  },

  // ── Brand row ─────────────────────────────────────────────────────────
  brandRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 20px',
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
    gap: 12,
  },

  // ── User profile block (brand row right) ─────────────────────────────
  userProfile: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  userTextBlock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 1,
  },
  userName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0f172a',
    lineHeight: 1.2,
  },
  userRoleLabel: {
    fontSize: 11,
    color: '#64748b',
    textTransform: 'capitalize',
  },
  avatarWrap: {
    position: 'relative',
    flexShrink: 0,
  },
  avatarImg: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    objectFit: 'cover',
    border: '2px solid #e2e8f0',
    display: 'block',
  },
  avatarFallback: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    backgroundColor: '#6366f1',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: '700',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 10,
    height: 10,
    backgroundColor: '#22c55e',
    borderRadius: '50%',
    border: '2px solid white',
  },

  // Hamburger (not-in-session only)
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

  // ── Session sub-header ────────────────────────────────────────────────
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
  sessionLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
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

  // Right action buttons
  sessionRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0,
    flexWrap: 'wrap',
  },
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

  // 🔍 Search button — NEW
  searchBtn: {
    width: 34,
    height: 34,
    fontSize: 16,
    color: '#475569',
    backgroundColor: 'transparent',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.15s',
    flexShrink: 0,
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