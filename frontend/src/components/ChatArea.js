// src/components/ChatArea.js
// ✅ CORRECTED v3 — All issues fixed
//
// FIXES vs previous version:
//   1. Own messages  → RIGHT-aligned (flex-end), indigo bubble, no name shown, ✓✓ + time in footer
//   2. Other messages→ LEFT-aligned (flex-start), avatar + name/badge/time ABOVE bubble
//   3. Leaderboard collapsed = ONLY the ▼ arrow row (no dark bar). Click → full bar slides in
//   4. userRole prop added ('teacher' | 'student') — teacher own bubble = indigo, student = teal
//   5. ALL existing logic preserved (polls, quiz, files, context menu, fullscreen, PDF)
//
// HOW TO USE IN App.js:
//   <ChatArea ... userRole={currentUser?.role} />

import React, { useRef, useEffect, useState } from 'react';
import socket from '../socket';

const ChatArea = ({
  messages,
  currentUserId,
  currentGroup,
  typingUsers,
  onMessageEdited,
  onMessageDeleted,
  userRole,          // 'teacher' | 'student'  ← pass from App.js
}) => {
  const messagesEndRef       = useRef(null);
  const messagesContainerRef = useRef(null);

  const [showScrollButton, setShowScrollButton] = useState(false);
  const [contextMenu,      setContextMenu]      = useState(null);
  const [searchQuery,      setSearchQuery]      = useState('');
  const [showSearch,       setShowSearch]       = useState(false);  // ← search bar hidden by default
  const [editingMessageId, setEditingMessageId] = useState(null);
  const [editText,         setEditText]         = useState('');
  const [fullscreenMedia,  setFullscreenMedia]  = useState(null);
  const [zoomLevel,        setZoomLevel]        = useState(1);
  const [pdfViewer,        setPdfViewer]        = useState(null);

  // ── Leaderboard ─────────────────────────────────────────────────────────
  // null       = no quiz yet  → render nothing
  // array data = quiz done    → collapsed=true shows ONLY arrow; false shows full bar
  const [leaderboardBar, setLeaderboardBar] = useState(null);
  const [lbCollapsed,    setLbCollapsed]    = useState(true); // start collapsed (arrow only)

  useEffect(() => {
    const onLeaderboard = (data) => {
      if (data?.leaderboard?.length > 0) {
        setLeaderboardBar(data.leaderboard.slice(0, 3));
        setLbCollapsed(false); // auto-expand when new data arrives
      }
    };
    socket.on('leaderboard:show', onLeaderboard);
    socket.on('quiz:finished',    onLeaderboard);
    return () => {
      socket.off('leaderboard:show', onLeaderboard);
      socket.off('quiz:finished',    onLeaderboard);
    };
  }, []);

  // ── Message edit / delete ────────────────────────────────────────────────
  useEffect(() => {
    const onEdited = (edited) => {
      if (typeof onMessageEdited === 'function') onMessageEdited(edited);
      if (editingMessageId === edited._id) { setEditingMessageId(null); setEditText(''); }
    };
    const onDeleted = (data) => {
      if (typeof onMessageDeleted === 'function') onMessageDeleted(data.messageId);
    };
    socket.on('messageEdited',  onEdited);
    socket.on('messageDeleted', onDeleted);
    return () => {
      socket.off('messageEdited',  onEdited);
      socket.off('messageDeleted', onDeleted);
    };
  }, [onMessageEdited, onMessageDeleted, editingMessageId]);

  useEffect(() => { scrollToBottom(); }, [messages]);

  // ── Helpers ──────────────────────────────────────────────────────────────
  const handleScroll = () => {
    const c = messagesContainerRef.current;
    if (c) setShowScrollButton(c.scrollHeight - c.scrollTop - c.clientHeight > 100);
  };

  const scrollToBottom = (smooth = true) =>
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });

  const formatTime = (ts) => {
    const d = new Date(ts), now = new Date();
    return d.toDateString() === now.toDateString()
      ? d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getDateLabel = (ts) => {
    const d = new Date(ts), now = new Date();
    const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === now.toDateString())       return 'Today';
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  };

  const needsDateSep = (cur, prev) =>
    !prev || new Date(cur.createdAt).toDateString() !== new Date(prev.createdAt).toDateString();

  const getInitials    = (u) => u?.substring(0, 2).toUpperCase() || '??';
  const getAvatarColor = (u) => {
    const c = ['#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ef4444','#14b8a6'];
    return c[(u?.charCodeAt(0) || 0) % c.length];
  };

  // Own bubble color differs by role (subtle but distinguishable)
  const ownBubbleColor = userRole === 'teacher'
    ? { bg: '#eef2ff', border: '#c7d2fe', tick: '#6366f1' }  // indigo tint for teacher
    : { bg: '#f0fdf4', border: '#bbf7d0', tick: '#10b981' }; // green tint for student

  // ── Context menu ──────────────────────────────────────────────────────────
  const handleContextMenu = (e, msg) => {
    e.preventDefault();
    if (msg.isDeleted) return;
    setContextMenu({ x: e.clientX, y: e.clientY, message: msg, isOwn: msg.sender?._id === currentUserId });
  };
  useEffect(() => {
    const dismiss = () => setContextMenu(null);
    document.addEventListener('click', dismiss);
    return () => document.removeEventListener('click', dismiss);
  }, []);

  const copyMsg   = (text) => {
    if (!text) { alert('Nothing to copy'); return; }
    navigator.clipboard.writeText(text).then(() => { setContextMenu(null); alert('Copied!'); }).catch(() => alert('Copy failed'));
  };
  const startEdit = (msg) => { setEditingMessageId(msg._id); setEditText(msg.content); setContextMenu(null); };
  const saveEdit  = ()    => {
    if (!editText.trim()) { alert('Cannot be empty'); return; }
    socket.emit('editMessage', { messageId: editingMessageId, newContent: editText.trim() });
  };
  const cancelEdit  = ()  => { setEditingMessageId(null); setEditText(''); };
  const deleteMsg   = (id) => {
    if (window.confirm('Delete this message?')) { socket.emit('deleteMessage', { messageId: id }); setContextMenu(null); }
  };

  // ── Poll — UNCHANGED ─────────────────────────────────────────────────────
  const handlePollVote = (messageId, optionIndex) =>
    socket.emit('votePoll', { messageId, optionIndex, groupId: currentGroup?._id || currentGroup?.id });

  const renderPoll = (message) => {
    if (!message.pollOptions?.length) return <div style={S.pollError}>Poll data unavailable</div>;
    const total     = message.pollOptions.reduce((s, o) => s + (o.votes?.length || 0), 0);
    const uvi       = message.pollOptions.findIndex(o => o.votes?.some(v => String(v) === String(currentUserId)));
    const voted     = uvi !== -1;
    return (
      <div style={S.pollContainer}>
        <div style={S.pollHeader}><span>📊</span><span style={S.pollQuestion}>{message.content}</span></div>
        <div style={S.pollOptions}>
          {message.pollOptions.map((opt, i) => {
            const votes = opt.votes?.length || 0;
            const pct   = total > 0 ? Math.round((votes / total) * 100) : 0;
            const mine  = i === uvi;
            return (
              <div key={i}>
                {voted ? (
                  <div style={{ ...S.pollResult, borderColor: mine ? '#6366f1' : '#e2e8f0', borderWidth: mine ? '2px' : '1px' }}>
                    <div style={S.pollResultTop}><span style={S.pollOptText}>{opt.text || opt}</span><span style={S.pollPct}>{pct}%</span></div>
                    <div style={S.pollBar}><div style={{ ...S.pollFill, width: `${pct}%`, backgroundColor: mine ? '#6366f1' : '#94a3b8' }} /></div>
                    <div style={S.pollVotes}>{votes} vote{votes !== 1 ? 's' : ''}{mine && <span style={{ color: '#6366f1', fontWeight: 'bold' }}> ✓</span>}</div>
                  </div>
                ) : (
                  <button onClick={() => handlePollVote(message._id, i)} style={S.pollBtn}>{opt.text || opt}</button>
                )}
              </div>
            );
          })}
        </div>
        <div style={S.pollFooter}>{total} vote{total !== 1 ? 's' : ''}</div>
      </div>
    );
  };

  // ── Quiz notification — UNCHANGED ────────────────────────────────────────
  const handleJoinQuiz = (sessionId) => {
    socket.emit('student:joinQuiz', { sessionId });
    window.dispatchEvent(new CustomEvent('openWaitingRoom', { detail: { sessionId } }));
  };

  const renderQuizNotification = (message) => {
    const started = message.messageType === 'quiz_started';
    const ended   = message.messageType === 'quiz_ended';
    if (!started && !ended) return null;
    const { sessionId, quizTitle, winnerName, winnerScore } = message.metadata || {};
    return (
      <div style={S.quizBox}>
        {started && (
          <>
            <div style={S.quizHeader}><span style={{ fontSize: 24 }}>📝</span><span style={S.quizHeadText}>Quiz Started!</span></div>
            <div style={S.quizBody}>
              <div style={S.quizName}>{quizTitle || 'New Quiz'}</div>
              <div style={S.quizMsg}>Join now to participate! 🎮</div>
            </div>
            <button onClick={() => sessionId && handleJoinQuiz(sessionId)} style={S.joinBtn}>Join Quiz</button>
          </>
        )}
        {ended && (
          <>
            <div style={S.quizHeader}><span style={{ fontSize: 24 }}>🎉</span><span style={S.quizHeadText}>Quiz Completed!</span></div>
            <div style={S.quizBody}>
              <div style={S.quizName}>{quizTitle || 'Quiz'}</div>
              {winnerName && (
                <div style={S.winnerRow}>
                  <span style={{ fontSize: 30 }}>🏆</span>
                  <div><div style={S.winnerName}>Top Scorer: {winnerName}</div><div style={S.winnerPts}>{winnerScore} points</div></div>
                </div>
              )}
              <div style={S.quizMsg}>Check your results in the quiz section</div>
            </div>
          </>
        )}
      </div>
    );
  };

  // ── File attachment — UNCHANGED ──────────────────────────────────────────
  const openFullscreen  = (u, t, n) => { setFullscreenMedia({ fileUrl: u, fileType: t, fileName: n }); setZoomLevel(1); };
  const closeFullscreen = ()         => { setFullscreenMedia(null); setZoomLevel(1); };
  const downloadFile    = (u, n)     => { const a = document.createElement('a'); a.href = u; a.download = n || 'download'; a.click(); };
  const zoomIn  = () => setZoomLevel(p => Math.min(p + 0.25, 3));
  const zoomOut = () => setZoomLevel(p => Math.max(p - 0.25, 0.5));
  const openPdf  = (u, n) => setPdfViewer({ fileUrl: u, fileName: n });
  const closePdf = ()     => setPdfViewer(null);

  const renderFile = (message) => {
    if (message.messageType !== 'file' || !message.fileUrl) return null;
    const ft  = message.fileType || '';
    const url = message.fileUrl.startsWith('http')
      ? message.fileUrl
      : `https://classvibe-backend.onrender.com${message.fileUrl}`;
    if (ft.startsWith('image/'))
      return <img src={url} alt={message.fileName || 'Image'} style={S.imgAttach} onClick={() => openFullscreen(url, ft, message.fileName)} />;
    if (ft.startsWith('video/'))
      return <div><video src={url} controls style={S.videoAttach} onClick={e => { e.stopPropagation(); openFullscreen(url, ft, message.fileName); }} /></div>;
    if (ft.startsWith('audio/'))
      return <div style={S.audioWrap}><span>🎵</span><audio src={url} controls style={{ flex: 1, height: 32 }} /></div>;
    if (ft === 'application/pdf' || message.fileName?.endsWith('.pdf'))
      return (
        <div>
          <div style={S.pdfPreview}>
            <span style={{ fontSize: 28 }}>📄</span>
            <div style={{ flex: 1 }}>
              <div style={S.pdfName}>{message.fileName || 'Document.pdf'}</div>
              <div style={S.pdfSize}>{Math.round((message.fileSize || 0) / 1024)} KB</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={S.pdfBtn} onClick={() => openPdf(url, message.fileName)}>View</button>
            <button style={S.pdfBtn} onClick={() => downloadFile(url, message.fileName)}>Download</button>
          </div>
        </div>
      );
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" style={S.docLink} onClick={e => e.stopPropagation()}>
        <span>📄</span><span>{message.fileName || 'Download File'}</span>
        <span style={{ fontSize: 11, color: '#94a3b8' }}>({Math.round((message.fileSize || 0) / 1024)} KB)</span>
      </a>
    );
  };

  // ── Filter ────────────────────────────────────────────────────────────────
  const filtered = searchQuery.trim()
    ? messages.filter(m =>
        m.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.sender?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.sender?.name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : messages;

  // ════════════════════════════════════════════════════════════════════════
  //  LEADERBOARD RENDERER
  //  collapsed  → only the ▼ arrow shown (no dark header bar at all)
  //  expanded   → full dark bar: title + entries + ▼ to collapse
  // ════════════════════════════════════════════════════════════════════════
  const renderLeaderboard = () => {
    if (!leaderboardBar || leaderboardBar.length === 0) return null;

    if (lbCollapsed) {
      // ── Collapsed state: ONLY the small arrow button, centered ──
      return (
        <div style={LB.arrowRow}>
          <button
            style={LB.arrowBtn}
            onClick={() => setLbCollapsed(false)}
            title="Show recent quiz leaderboard"
          >
            ▼
          </button>
        </div>
      );
    }

    // ── Expanded state: full dark leaderboard bar ──
    return (
      <div style={LB.bar}>
        <div style={LB.header}>
          <span style={{ fontSize: 15 }}>🏆</span>
          <span style={LB.title}>Leaderboard of recent quiz</span>
          <button
            style={LB.collapseBtn}
            onClick={() => setLbCollapsed(true)}
            title="Hide leaderboard"
          >
            ▼
          </button>
        </div>
        <div style={LB.entries}>
          {leaderboardBar.map((entry, i) => (
            <div key={i} style={{ ...LB.entry, backgroundColor: i === 0 ? 'rgba(255,215,0,0.12)' : 'transparent' }}>
              <span style={{ fontSize: 16, width: 24, flexShrink: 0 }}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
              </span>
              <span style={LB.entryName}>{entry.name || entry.username || `Player ${i + 1}`}</span>
              <span style={LB.entryScore}>+{entry.score} Points</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // ── Meta row for other-people's messages ────────────────────────────────
  const renderMeta = (message) => {
    const isTeacher = message.sender?.role === 'teacher';
    const name      = message.sender?.name || message.sender?.username || 'Unknown';
    return (
      <div style={S.meta}>
        <span style={{ ...S.metaName, color: getAvatarColor(message.sender?.username) }}>{name}</span>
        {isTeacher && <span style={S.teacherBadge}>Teacher</span>}
        <span style={S.metaTime}>{formatTime(message.createdAt)}</span>
        {message.isEdited && !message.isDeleted && <span style={S.editedLabel}>(edited)</span>}
      </div>
    );
  };

  // ── Inline edit UI (shared for own and others if teacher allows) ─────────
  const renderEditUI = () => (
    <div>
      <input
        style={S.editInput}
        value={editText}
        onChange={e => setEditText(e.target.value)}
        onKeyPress={e => { if (e.key === 'Enter') saveEdit(); }}
        onKeyDown={e => { if (e.key === 'Escape') cancelEdit(); }}
        autoFocus
      />
      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        <button onClick={saveEdit}   style={S.saveBtn}>Save</button>
        <button onClick={cancelEdit} style={S.cancelBtn}>Cancel</button>
      </div>
    </div>
  );

  // ── Message content (shared) ─────────────────────────────────────────────
  const renderContent = (message) => (
    <>
      {(message.messageType === 'quiz_started' || message.messageType === 'quiz_ended') && !message.isDeleted && renderQuizNotification(message)}
      {message.messageType === 'poll' && !message.isDeleted && renderPoll(message)}
      {message.messageType === 'file' && !message.isDeleted && renderFile(message)}
      {message.content && message.messageType !== 'poll' && message.messageType !== 'quiz_started' && message.messageType !== 'quiz_ended' && (
        <div style={S.msgText}>{message.isDeleted ? '🚫 This message was deleted' : message.content}</div>
      )}
    </>
  );

  // ════════════════════════════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════════════════════════════
  return (
    <div style={S.chatArea}>

      {/* ── Search: collapsed icon strip (default) ── */}
      {!showSearch && (
        <div style={S.chatTopStrip}>
          <button
            style={S.searchIconBtn}
            onClick={() => setShowSearch(true)}
            title="Search messages"
          >
            <span style={{ fontSize: 14 }}>🔍</span>
            <span style={{ fontSize: 12, color: '#94a3b8' }}>Search</span>
          </button>
        </div>
      )}

      {/* ── Search: expanded full bar (visible after click) ── */}
      {showSearch && (
        <div style={S.searchBar}>
          <div style={S.searchWrap}>
            <span style={{ fontSize: 13, opacity: 0.45 }}>🔍</span>
            <input
              type="text"
              placeholder="Search messages..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={S.searchInput}
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Escape') { setShowSearch(false); setSearchQuery(''); }
              }}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} style={S.clearBtn}>✕</button>
            )}
          </div>
          {searchQuery && (
            <span style={S.searchCount}>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
          )}
          <button
            style={S.closeSearchBtn}
            onClick={() => { setShowSearch(false); setSearchQuery(''); }}
            title="Close search"
          >
            Close
          </button>
        </div>
      )}

      {/* ── Leaderboard (arrow or full bar) ── */}
      {renderLeaderboard()}

      {/* ── Messages ── */}
      <div style={S.msgContainer} ref={messagesContainerRef} onScroll={handleScroll}>

        {/* Empty states */}
        {filtered.length === 0 && !searchQuery && (
          <div style={S.empty}>
            <div style={{ fontSize: 52, marginBottom: 14, opacity: 0.35 }}>💬</div>
            <p style={{ fontSize: 16, fontWeight: '600', margin: '0 0 6px', color: '#64748b' }}>No messages yet</p>
            <p style={{ fontSize: 13, margin: 0, color: '#94a3b8' }}>Start the conversation! 👋</p>
          </div>
        )}
        {filtered.length === 0 && searchQuery && (
          <div style={S.empty}>
            <div style={{ fontSize: 52, marginBottom: 14, opacity: 0.35 }}>🔍</div>
            <p style={{ fontSize: 16, fontWeight: '600', margin: '0 0 6px', color: '#64748b' }}>No results</p>
            <p style={{ fontSize: 13, margin: 0, color: '#94a3b8' }}>Try a different search</p>
          </div>
        )}

        {filtered.map((message, index) => {
          const isOwn    = message.sender?._id === currentUserId;
          const isSys    = message.messageType === 'system';
          const showDate = needsDateSep(message, filtered[index - 1]);
          const editing  = editingMessageId === message._id;
          const isPoll   = message.messageType === 'poll';

          return (
            <React.Fragment key={message._id || `${index}-${message.createdAt}`}>

              {/* Date separator */}
              {showDate && (
                <div style={S.dateSep}>
                  <span style={S.dateSepText}>{getDateLabel(message.createdAt)}</span>
                </div>
              )}

              {/* Message row */}
              <div
                style={{
                  ...S.msgRow,
                  justifyContent: isSys ? 'center' : isOwn ? 'flex-end' : 'flex-start',
                }}
                onContextMenu={e => !isSys && !isPoll && handleContextMenu(e, message)}
              >

                {/* ── System message ── */}
                {isSys && (
                  <div style={S.sysMsg}>{message.content}</div>
                )}

                {/* ══════════════════════════════════════════
                    OWN MESSAGE — right side
                    No avatar shown on left, small avatar on right
                    No name/badge shown (it's your own message)
                    Light-colored bubble (role-based tint)
                    Timestamp + ✓✓ at bottom-right inside bubble
                    ══════════════════════════════════════════ */}
                {!isSys && isOwn && (
                  <div style={S.ownRow}>
                    {/* Bubble */}
                    <div style={{
                      ...S.bubble,
                      backgroundColor: message.isDeleted ? '#f1f5f9' : ownBubbleColor.bg,
                      borderColor:      message.isDeleted ? '#e2e8f0' : ownBubbleColor.border,
                      borderRadius:     '12px 3px 12px 12px',
                      opacity: message.isDeleted ? 0.65 : 1,
                    }}>
                      {editing ? renderEditUI() : renderContent(message)}
                      {/* Footer: time + ticks */}
                      {!editing && (
                        <div style={S.ownFooter}>
                          {message.isEdited && !message.isDeleted && (
                            <span style={{ fontSize: 10, color: '#94a3b8', fontStyle: 'italic' }}>(edited)</span>
                          )}
                          <span style={S.ownTime}>{formatTime(message.createdAt)}</span>
                          <span style={{ ...S.readTick, color: ownBubbleColor.tick }}>✓✓</span>
                        </div>
                      )}
                    </div>
                    {/* Own avatar — right side */}
                    <div style={{ ...S.avatar, backgroundColor: ownBubbleColor.tick, flexShrink: 0, alignSelf: 'flex-end' }}>
                      {getInitials(message.sender?.username)}
                    </div>
                  </div>
                )}

                {/* ══════════════════════════════════════════
                    OTHER'S MESSAGE — left side
                    Avatar on left (colored by username)
                    Meta row: name + [Teacher badge] + time
                    White bubble below meta
                    ══════════════════════════════════════════ */}
                {!isSys && !isOwn && (
                  <div style={S.otherRow}>
                    {/* Avatar */}
                    <div style={{
                      ...S.avatar,
                      backgroundColor: getAvatarColor(message.sender?.username),
                      flexShrink: 0,
                      alignSelf: 'flex-start',
                      marginTop: 20, // aligns with bubble, below meta row
                    }}>
                      {getInitials(message.sender?.username)}
                    </div>

                    {/* Column: meta + bubble */}
                    <div style={S.otherCol}>
                      {/* Meta row above bubble */}
                      {renderMeta(message)}

                      {/* Bubble */}
                      <div style={{
                        ...S.bubble,
                        backgroundColor: message.isDeleted ? '#f1f5f9' : '#ffffff',
                        borderColor:      message.isDeleted ? '#e2e8f0' : '#e2e8f0',
                        borderRadius:     '3px 12px 12px 12px',
                        opacity: message.isDeleted ? 0.65 : 1,
                      }}>
                        {editing ? renderEditUI() : renderContent(message)}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </React.Fragment>
          );
        })}

        {/* Typing indicator */}
        {typingUsers?.length > 0 && typingUsers.some(u => u?.trim()) && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: 4, paddingLeft: 8 }}>
            <div style={S.typingBubble}>
              <span style={{ fontSize: 13, color: '#64748b', fontStyle: 'italic' }}>
                {typingUsers.length === 1 ? `${typingUsers[0]} is typing` : `${typingUsers.length} people are typing`}
              </span>
              <div style={{ display: 'flex', gap: 3, marginLeft: 8, alignItems: 'center' }}>
                <span style={S.dot}/><span style={S.dot}/><span style={S.dot}/>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Scroll-to-bottom button */}
      {showScrollButton && (
        <button style={S.scrollBtn} onClick={() => scrollToBottom()}>↓</button>
      )}

      {/* ── Context menu ── */}
      {contextMenu && (
        <div style={{ ...S.ctxMenu, top: contextMenu.y, left: contextMenu.x }}>
          <div style={S.ctxItem} onClick={() => copyMsg(contextMenu.message.content)}>📋 Copy</div>
          {contextMenu.isOwn && !contextMenu.message.isDeleted && (
            <>
              <div style={S.ctxItem} onClick={() => startEdit(contextMenu.message)}>✏️ Edit</div>
              <div style={{ ...S.ctxItem, color: '#ef4444' }} onClick={() => deleteMsg(contextMenu.message._id)}>🗑️ Delete</div>
            </>
          )}
        </div>
      )}

      {/* ── Fullscreen media viewer — UNCHANGED ── */}
      {fullscreenMedia && (
        <div style={S.fsOverlay}>
          <div style={S.fsHeader}>
            <button style={S.fsBtn} onClick={closeFullscreen}>✕ Close</button>
            <span style={{ fontSize: 14, fontWeight: '500', color: 'white' }}>{fullscreenMedia.fileName}</span>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {fullscreenMedia.fileType?.startsWith('image/') && (
                <>
                  <button style={S.fsBtn} onClick={zoomOut}>−</button>
                  <span style={{ fontSize: 13, color: 'white', minWidth: 46, textAlign: 'center' }}>
                    {Math.round(zoomLevel * 100)}%
                  </span>
                  <button style={S.fsBtn} onClick={zoomIn}>+</button>
                </>
              )}
              <button style={S.fsBtn} onClick={() => downloadFile(fullscreenMedia.fileUrl, fullscreenMedia.fileName)}>⬇ Download</button>
            </div>
          </div>
          <div style={S.fsContent}>
            {fullscreenMedia.fileType?.startsWith('image/')
              ? <img src={fullscreenMedia.fileUrl} alt="" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', transform: `scale(${zoomLevel})`, transition: 'transform 0.2s' }} />
              : fullscreenMedia.fileType?.startsWith('video/')
                ? <video src={fullscreenMedia.fileUrl} controls autoPlay style={{ maxWidth: '100%', maxHeight: '100%' }} />
                : null}
          </div>
        </div>
      )}

      {/* ── PDF viewer — UNCHANGED ── */}
      {pdfViewer && (
        <div style={S.fsOverlay}>
          <div style={S.fsHeader}>
            <span style={{ fontSize: 14, fontWeight: '500', color: 'white' }}>{pdfViewer.fileName}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button style={S.fsBtn} onClick={() => downloadFile(pdfViewer.fileUrl, pdfViewer.fileName)}>⬇ Download</button>
              <button style={S.fsBtn} onClick={closePdf}>✕ Close</button>
            </div>
          </div>
          <iframe src={pdfViewer.fileUrl} style={{ flex: 1, width: '100%', border: 'none' }} title={pdfViewer.fileName} />
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════════════════════════════════
//  LEADERBOARD STYLES
// ══════════════════════════════════════════════════════════════════════════
const LB = {
  // Collapsed: only arrow row
  arrowRow: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    padding: '4px 0 2px',
    backgroundColor: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
    flexShrink: 0,
  },
  arrowBtn: {
    background: 'none',
    border: '1px solid #cbd5e1',
    borderRadius: '4px',
    padding: '2px 22px',
    cursor: 'pointer',
    color: '#64748b',
    fontSize: '12px',
    lineHeight: 1.6,
    transition: 'background 0.15s, color 0.15s',
  },
  // Expanded: dark bar
  bar: {
    backgroundColor: '#0f172a',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    flexShrink: 0,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '8px 16px',
    minHeight: 42,
  },
  title: {
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: '0.6px',
    textTransform: 'uppercase',
  },
  collapseBtn: {
    background: 'none',
    border: 'none',
    color: '#475569',
    cursor: 'pointer',
    fontSize: 11,
    padding: '4px 8px',
    borderRadius: 4,
    lineHeight: 1,
  },
  entries: {
    padding: '2px 16px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  entry: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '6px 10px',
    borderRadius: 6,
  },
  entryName:  { flex: 1, fontSize: 13, fontWeight: '600', color: '#e2e8f0' },
  entryScore: { fontSize: 12, fontWeight: '700', color: '#22c55e', whiteSpace: 'nowrap' },
};

// ══════════════════════════════════════════════════════════════════════════
//  MAIN STYLES
// ══════════════════════════════════════════════════════════════════════════
const S = {
  // Layout
  chatArea:    { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', backgroundColor: '#f8fafc', position: 'relative' },

  // ── Search icon strip (collapsed — default state) ──
  chatTopStrip: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    padding: '5px 14px',
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #f1f5f9',
    flexShrink: 0,
    minHeight: 36,
  },
  searchIconBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'none',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    padding: '4px 10px',
    cursor: 'pointer',
    color: '#64748b',
    transition: 'background 0.15s',
    fontSize: 13,
  },

  // ── Search bar (expanded state) ──
  searchBar:   { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', backgroundColor: '#fff', borderBottom: '1px solid #e2e8f0', flexShrink: 0 },
  searchWrap:  { flex: 1, display: 'flex', alignItems: 'center', gap: 8, backgroundColor: '#f1f5f9', borderRadius: 8, padding: '0 12px', border: '1px solid #e2e8f0' },
  searchInput: { flex: 1, padding: '8px 0', fontSize: 13, border: 'none', outline: 'none', backgroundColor: 'transparent', color: '#1e293b' },
  clearBtn:    { background: 'none', border: 'none', fontSize: 14, cursor: 'pointer', color: '#94a3b8', padding: '2px 4px' },
  searchCount: { fontSize: 12, color: '#64748b', whiteSpace: 'nowrap', fontWeight: '500' },
  closeSearchBtn: {
    padding: '6px 12px',
    fontSize: 12,
    fontWeight: '600',
    backgroundColor: '#f1f5f9',
    color: '#475569',
    border: '1px solid #e2e8f0',
    borderRadius: 6,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },

  // Messages container
  msgContainer: { flex: 1, overflowY: 'auto', padding: '20px 20px', display: 'flex', flexDirection: 'column', gap: 2 },

  // Empty state
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' },

  // Date separator
  dateSep:     { display: 'flex', justifyContent: 'center', margin: '16px 0 10px' },
  dateSepText: { backgroundColor: '#e2e8f0', color: '#64748b', padding: '3px 12px', borderRadius: 20, fontSize: 11, fontWeight: '600' },

  // Message row wrapper — justifyContent set inline per message
  msgRow: { display: 'flex', width: '100%', marginBottom: 8 },

  // System message
  sysMsg: { padding: '5px 16px', backgroundColor: '#e2e8f0', color: '#475569', borderRadius: 20, fontSize: 12, fontStyle: 'italic', textAlign: 'center', margin: '0 auto', maxWidth: '70%' },

  // ── OWN message row (right side) ──
  ownRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 8,
    maxWidth: '70%',
  },

  // ── OTHER message row (left side) ──
  otherRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    maxWidth: '70%',
  },
  otherCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    flex: 1,
  },

  // Avatar (shared)
  avatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontSize: 11,
    fontWeight: '700',
  },

  // Meta row (others only)
  meta:         { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingLeft: 2 },
  metaName:     { fontSize: 13, fontWeight: '700', lineHeight: 1 },
  teacherBadge: { fontSize: 10, fontWeight: '600', color: '#92400e', backgroundColor: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 4, padding: '1px 6px' },
  metaTime:     { fontSize: 11, color: '#94a3b8' },
  editedLabel:  { fontSize: 11, color: '#94a3b8', fontStyle: 'italic' },

  // Bubble (shared — borderColor and borderRadius set inline)
  bubble: {
    padding: '10px 13px',
    border: '1px solid',
    wordWrap: 'break-word',
    position: 'relative',
    boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    maxWidth: '100%',
  },

  // Own footer inside bubble
  ownFooter: { display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4, marginTop: 5 },
  ownTime:   { fontSize: 11, color: '#94a3b8' },
  readTick:  { fontSize: 11 },

  // Edit UI
  editInput: { width: '100%', padding: '7px 10px', fontSize: 14, border: '1px solid #c7d2fe', borderRadius: 6, marginBottom: 0, outline: 'none', backgroundColor: '#fff', boxSizing: 'border-box' },
  saveBtn:   { padding: '5px 14px', fontSize: 12, fontWeight: '600', backgroundColor: '#6366f1', color: 'white', border: 'none', borderRadius: 5, cursor: 'pointer' },
  cancelBtn: { padding: '5px 14px', fontSize: 12, fontWeight: '600', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: 5, cursor: 'pointer' },

  // Message text
  msgText: { fontSize: 14, lineHeight: '21px', color: '#1e293b', wordBreak: 'break-word' },

  // Typing
  typingBubble: { display: 'flex', alignItems: 'center', padding: '8px 14px', backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '3px 12px 12px 12px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
  dot:          { display: 'inline-block', width: 5, height: 5, backgroundColor: '#94a3b8', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both' },

  // Scroll button
  scrollBtn: { position: 'absolute', bottom: 16, right: 16, width: 36, height: 36, borderRadius: '50%', backgroundColor: '#6366f1', color: 'white', border: 'none', fontSize: 18, cursor: 'pointer', boxShadow: '0 4px 12px rgba(99,102,241,0.3)', zIndex: 10 },

  // Context menu
  ctxMenu: { position: 'fixed', backgroundColor: 'white', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', padding: '6px 0', zIndex: 1000, minWidth: 150, border: '1px solid #f1f5f9' },
  ctxItem: { padding: '10px 16px', fontSize: 13, cursor: 'pointer', color: '#374151' },

  // ── Poll ──
  pollContainer: { padding: '2px 0' },
  pollHeader:    { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 18 },
  pollQuestion:  { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  pollOptions:   { display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 8 },
  pollBtn:       { width: '100%', padding: '9px 13px', fontSize: 13, backgroundColor: '#f1f5f9', color: '#1e293b', border: '1px solid #e2e8f0', borderRadius: 7, cursor: 'pointer', fontWeight: '500', textAlign: 'left' },
  pollResult:    { padding: '9px 12px', borderRadius: 7, backgroundColor: 'white' },
  pollResultTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 },
  pollOptText:   { fontSize: 13, color: '#1e293b', fontWeight: '500' },
  pollPct:       { fontSize: 12, fontWeight: '700', color: '#6366f1' },
  pollBar:       { width: '100%', height: 4, backgroundColor: '#e2e8f0', borderRadius: 2, overflow: 'hidden', marginBottom: 4 },
  pollFill:      { height: '100%', transition: 'width 0.3s' },
  pollVotes:     { fontSize: 11, color: '#64748b' },
  pollFooter:    { fontSize: 11, color: '#94a3b8', fontStyle: 'italic', marginTop: 4 },
  pollError:     { fontSize: 12, color: '#ef4444', fontStyle: 'italic' },

  // ── Quiz notification ──
  quizBox:      { padding: '12px 14px', backgroundColor: 'rgba(79,70,229,0.06)', borderRadius: 10, border: '1.5px solid #c7d2fe' },
  quizHeader:   { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 },
  quizHeadText: { fontSize: 15, fontWeight: '700', color: '#4f46e5' },
  quizBody:     { marginBottom: 10 },
  quizName:     { fontSize: 14, fontWeight: '600', color: '#1e293b', marginBottom: 5 },
  quizMsg:      { fontSize: 13, color: '#64748b' },
  joinBtn:      { width: '100%', padding: 10, fontSize: 14, fontWeight: '700', backgroundColor: '#4f46e5', color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer' },
  winnerRow:    { display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', backgroundColor: 'rgba(255,215,0,0.1)', borderRadius: 8, marginBottom: 8, border: '1px solid rgba(255,215,0,0.25)' },
  winnerName:   { fontSize: 13, fontWeight: '600', color: '#1e293b', marginBottom: 3 },
  winnerPts:    { fontSize: 12, color: '#64748b' },

  // ── Files ──
  imgAttach:  { maxWidth: '100%', maxHeight: 260, borderRadius: 8, cursor: 'pointer', display: 'block', marginBottom: 4 },
  videoAttach:{ maxWidth: '100%', maxHeight: 260, borderRadius: 8 },
  audioWrap:  { display: 'flex', alignItems: 'center', gap: 10, padding: 8, backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: 20 },
  pdfPreview: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', backgroundColor: '#f8fafc', borderRadius: 8, marginBottom: 6, border: '1px solid #e2e8f0' },
  pdfName:    { fontSize: 13, fontWeight: '600', color: '#1e293b' },
  pdfSize:    { fontSize: 11, color: '#64748b' },
  pdfBtn:     { flex: 1, padding: 7, fontSize: 12, fontWeight: '600', backgroundColor: '#6366f1', color: 'white', border: 'none', borderRadius: 6, cursor: 'pointer' },
  docLink:    { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: 8, textDecoration: 'none', color: '#1e293b', border: '1px solid #e2e8f0' },

  // Fullscreen overlay
  fsOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 2000, display: 'flex', flexDirection: 'column' },
  fsHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', backgroundColor: 'rgba(0,0,0,0.7)' },
  fsBtn:     { padding: '7px 12px', fontSize: 13, backgroundColor: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 6, cursor: 'pointer' },
  fsContent: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', padding: 20 },
};

// CSS animation for typing dots
if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes bounce {
      0%, 60%, 100% { transform: translateY(0); }
      30%            { transform: translateY(-5px); }
    }
  `;
  document.head.appendChild(style);
}

export default ChatArea;