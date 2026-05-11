// src/components/ChatArea.js
// ✅ UI REDESIGN — Visily-style classroom chat
// Changes from previous version:
//   1. All messages left-aligned (teacher + student feed style, not WhatsApp style)
//   2. Message meta (name + Teacher/Student badge + timestamp) displayed ABOVE the bubble
//   3. Own messages get a light-blue tinted bubble; others get white
//   4. Clean white background — removed WhatsApp green bar and tile pattern
//   5. Teacher badge shown on all messages from users with role 'teacher'
//   6. Leaderboard collapsible bar — UNCHANGED (already working)
//   7. ALL existing logic (polls, quiz, files, context menu, fullscreen, PDF) — UNTOUCHED

import React, { useRef, useEffect, useState } from 'react';
import socket from '../socket';

const ChatArea = ({
  messages,
  currentUserId,
  currentGroup,
  typingUsers,
  onMessageEdited,
  onMessageDeleted
}) => {
  const messagesEndRef          = useRef(null);
  const messagesContainerRef    = useRef(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [contextMenu,       setContextMenu]     = useState(null);
  const [searchQuery,       setSearchQuery]     = useState('');
  const [editingMessageId,  setEditingMessageId] = useState(null);
  const [editText,          setEditText]         = useState('');
  const [fullscreenMedia,   setFullscreenMedia]  = useState(null);
  const [zoomLevel,         setZoomLevel]        = useState(1);
  const [pdfViewer,         setPdfViewer]        = useState(null);

  // Leaderboard bar state — UNCHANGED
  const [leaderboardBar, setLeaderboardBar] = useState(null);
  const [lbCollapsed,    setLbCollapsed]    = useState(false);

  // ── Leaderboard socket listeners — UNCHANGED ──
  useEffect(() => {
    const handleLeaderboard = (data) => {
      if (data?.leaderboard && data.leaderboard.length > 0) {
        setLeaderboardBar(data.leaderboard.slice(0, 3));
        setLbCollapsed(false);
      }
    };
    socket.on('leaderboard:show', handleLeaderboard);
    socket.on('quiz:finished',    handleLeaderboard);
    return () => {
      socket.off('leaderboard:show', handleLeaderboard);
      socket.off('quiz:finished',    handleLeaderboard);
    };
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages]);

  useEffect(() => {
    const handleMessageEdited = (editedMessage) => {
      if (typeof onMessageEdited === 'function') onMessageEdited(editedMessage);
      if (editingMessageId === editedMessage._id) { setEditingMessageId(null); setEditText(''); }
    };
    const handleMessageDeleted = (data) => {
      if (typeof onMessageDeleted === 'function') onMessageDeleted(data.messageId);
    };
    socket.on('messageEdited',  handleMessageEdited);
    socket.on('messageDeleted', handleMessageDeleted);
    return () => {
      socket.off('messageEdited',  handleMessageEdited);
      socket.off('messageDeleted', handleMessageDeleted);
    };
  }, [onMessageEdited, onMessageDeleted, editingMessageId]);

  const handleScroll = () => {
    const container = messagesContainerRef.current;
    if (container) {
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100;
      setShowScrollButton(!isNearBottom);
    }
  };

  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now  = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getDateSeparator = (timestamp) => {
    const date      = new Date(timestamp);
    const now       = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === now.toDateString())       return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  };

  const needsDateSeparator = (currentMsg, previousMsg) => {
    if (!previousMsg) return true;
    return new Date(currentMsg.createdAt).toDateString() !== new Date(previousMsg.createdAt).toDateString();
  };

  const getInitials    = (u) => u?.substring(0, 2).toUpperCase() || '??';
  const getAvatarColor = (u) => {
    const colors = ['#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ef4444','#14b8a6'];
    return colors[(u?.charCodeAt(0) || 0) % colors.length];
  };

  const handleContextMenu = (e, message) => {
    e.preventDefault();
    if (message.isDeleted) return;
    setContextMenu({ x: e.clientX, y: e.clientY, message, isOwn: message.sender?._id === currentUserId });
  };

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const copyMessage = (text) => {
    if (!text) { alert('No text to copy'); return; }
    navigator.clipboard.writeText(text)
      .then(() => { setContextMenu(null); alert('Message copied!'); })
      .catch(() => alert('Failed to copy'));
  };

  const startEditMessage = (message) => { setEditingMessageId(message._id); setEditText(message.content); setContextMenu(null); };
  const saveEditMessage  = () => {
    if (!editText.trim()) { alert('Message cannot be empty'); return; }
    socket.emit('editMessage', { messageId: editingMessageId, newContent: editText.trim() });
  };
  const cancelEdit = () => { setEditingMessageId(null); setEditText(''); };
  const deleteMessage = (messageId) => {
    if (window.confirm('Delete this message?')) { socket.emit('deleteMessage', { messageId }); setContextMenu(null); }
  };

  // ── Poll rendering — UNCHANGED ──
  const handlePollVote = (messageId, optionIndex) => {
    socket.emit('votePoll', { messageId, optionIndex, groupId: currentGroup?._id || currentGroup?.id });
  };

  const renderPoll = (message) => {
    if (!message.pollOptions || message.pollOptions.length === 0)
      return <div style={styles.pollError}>Poll data unavailable</div>;
    const totalVotes    = message.pollOptions.reduce((sum, opt) => sum + (opt.votes?.length || 0), 0);
    const userVoteIndex = message.pollOptions.findIndex(opt => opt.votes?.some(v => String(v) === String(currentUserId)));
    const userHasVoted  = userVoteIndex !== -1;
    return (
      <div style={styles.pollContainer}>
        <div style={styles.pollHeader}>
          <span style={styles.pollIcon}>📊</span>
          <span style={styles.pollQuestion}>{message.content}</span>
        </div>
        <div style={styles.pollOptions}>
          {message.pollOptions.map((option, index) => {
            const votes      = option.votes?.length || 0;
            const percentage = totalVotes > 0 ? Math.round((votes / totalVotes) * 100) : 0;
            const isUserVote = index === userVoteIndex;
            return (
              <div key={index} style={styles.pollOptionWrapper}>
                {userHasVoted ? (
                  <div style={{ ...styles.pollResult, borderColor: isUserVote ? '#6366f1' : '#e2e8f0', borderWidth: isUserVote ? '2px' : '1px' }}>
                    <div style={styles.pollResultTop}>
                      <span style={styles.pollOptionText}>{option.text || option}</span>
                      <span style={styles.pollPercentage}>{percentage}%</span>
                    </div>
                    <div style={styles.pollProgressBar}>
                      <div style={{ ...styles.pollProgressFill, width: `${percentage}%`, backgroundColor: isUserVote ? '#6366f1' : '#94a3b8' }} />
                    </div>
                    <div style={styles.pollVoteCount}>{votes} {votes === 1 ? 'vote' : 'votes'}{isUserVote && <span style={styles.checkmark}> ✓</span>}</div>
                  </div>
                ) : (
                  <button onClick={() => handlePollVote(message._id, index)} style={styles.pollButton}>
                    {option.text || option}
                  </button>
                )}
              </div>
            );
          })}
        </div>
        <div style={styles.pollFooter}>{totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}</div>
      </div>
    );
  };

  // ── Quiz notification rendering — UNCHANGED ──
  const handleJoinQuiz = (sessionId) => {
    socket.emit('student:joinQuiz', { sessionId });
    window.dispatchEvent(new CustomEvent('openWaitingRoom', { detail: { sessionId } }));
  };

  const renderQuizNotification = (message) => {
    const isQuizStarted = message.messageType === 'quiz_started';
    const isQuizEnded   = message.messageType === 'quiz_ended';
    if (!isQuizStarted && !isQuizEnded) return null;
    const { sessionId, quizTitle, winnerName, winnerScore } = message.metadata || {};
    return (
      <div style={additionalStyles.quizNotificationContainer}>
        {isQuizStarted && (
          <>
            <div style={styles.quizNotificationHeader}>
              <span style={styles.quizIcon}>📝</span>
              <span style={styles.quizNotificationTitle}>Quiz Started!</span>
            </div>
            <div style={styles.quizNotificationContent}>
              <div style={styles.quizTitle}>{quizTitle || 'New Quiz'}</div>
              <div style={styles.quizMessage}>Join now to participate! 🎮</div>
            </div>
            <button onClick={() => sessionId && handleJoinQuiz(sessionId)} style={styles.joinQuizBtn}>
              Join Quiz
            </button>
          </>
        )}
        {isQuizEnded && (
          <>
            <div style={styles.quizNotificationHeader}>
              <span style={styles.quizIcon}>🎉</span>
              <span style={styles.quizNotificationTitle}>Quiz Completed!</span>
            </div>
            <div style={styles.quizNotificationContent}>
              <div style={styles.quizTitle}>{quizTitle || 'Quiz'}</div>
              {winnerName && (
                <div style={styles.winnerInfo}>
                  <div style={styles.winnerBadge}>🏆</div>
                  <div>
                    <div style={styles.winnerName}>Top Scorer: {winnerName}</div>
                    <div style={styles.winnerScore}>{winnerScore} points</div>
                  </div>
                </div>
              )}
              <div style={styles.quizMessage}>Check your results in the quiz section</div>
            </div>
          </>
        )}
      </div>
    );
  };

  // ── File attachment rendering — UNCHANGED ──
  const openFullscreen  = (fileUrl, fileType, fileName) => { setFullscreenMedia({ fileUrl, fileType, fileName }); setZoomLevel(1); };
  const closeFullscreen = () => { setFullscreenMedia(null); setZoomLevel(1); };
  const downloadFile    = (fileUrl, fileName) => { const a = document.createElement('a'); a.href = fileUrl; a.download = fileName || 'download'; a.click(); };
  const zoomIn  = () => setZoomLevel(p => Math.min(p + 0.25, 3));
  const zoomOut = () => setZoomLevel(p => Math.max(p - 0.25, 0.5));
  const openPdfViewer  = (fileUrl, fileName) => setPdfViewer({ fileUrl, fileName });
  const closePdfViewer = () => setPdfViewer(null);

  const renderFileAttachment = (message) => {
    if (message.messageType !== 'file' || !message.fileUrl) return null;
    const fileType = message.fileType || '';
    const fileUrl  = message.fileUrl.startsWith('http') ? message.fileUrl : `https://classvibe-backend.onrender.com${message.fileUrl}`;
    if (fileType.startsWith('image/'))
      return <img src={fileUrl} alt={message.fileName || 'Image'} style={styles.imageAttachment} onClick={() => openFullscreen(fileUrl, fileType, message.fileName)} />;
    if (fileType.startsWith('video/'))
      return <div style={styles.videoWrapper}><video src={fileUrl} controls style={styles.videoAttachment} onClick={e => { e.stopPropagation(); openFullscreen(fileUrl, fileType, message.fileName); }} /></div>;
    if (fileType.startsWith('audio/'))
      return <div style={styles.audioContainer}><div style={styles.audioIcon}>🎵</div><audio src={fileUrl} controls style={styles.audioPlayer} /></div>;
    if (fileType === 'application/pdf' || message.fileName?.endsWith('.pdf'))
      return (
        <div style={styles.documentContainer}>
          <div style={styles.pdfPreview}>
            <span style={styles.pdfIcon}>📄</span>
            <div style={styles.pdfInfo}>
              <span style={styles.pdfName}>{message.fileName || 'Document.pdf'}</span>
              <span style={styles.pdfSize}>{Math.round((message.fileSize || 0) / 1024)} KB</span>
            </div>
          </div>
          <div style={styles.pdfActions}>
            <button style={styles.pdfButton} onClick={() => openPdfViewer(fileUrl, message.fileName)}>View</button>
            <button style={styles.pdfButton} onClick={() => downloadFile(fileUrl, message.fileName)}>Download</button>
          </div>
        </div>
      );
    return (
      <a href={fileUrl} target="_blank" rel="noopener noreferrer" style={styles.documentAttachment} onClick={e => e.stopPropagation()}>
        <span style={styles.documentIcon}>📄</span>
        <span>{message.fileName || 'Download File'}</span>
        <span style={styles.fileSize}>({Math.round((message.fileSize || 0) / 1024)} KB)</span>
      </a>
    );
  };

  const filteredMessages = searchQuery.trim()
    ? messages.filter(msg =>
        msg.content?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        msg.sender?.username?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        msg.sender?.name?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : messages;

  // ── Leaderboard bar renderer — UNCHANGED logic, same dark style ──
  const renderLeaderboardBar = () => {
    if (!leaderboardBar || leaderboardBar.length === 0) return null;
    return (
      <div style={{ ...lb.bar, maxHeight: lbCollapsed ? '42px' : '200px', overflow: 'hidden', transition: 'max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1)' }}>
        {/* Header row — always visible */}
        <div style={lb.headerRow}>
          <span style={lb.trophy}>🏆</span>
          <span style={lb.title}>Leaderboard of recent quiz</span>
          <button
            style={lb.arrowBtn}
            onClick={() => setLbCollapsed(v => !v)}
            title={lbCollapsed ? 'Show leaderboard' : 'Hide leaderboard'}
          >
            {lbCollapsed ? '▲' : '▼'}
          </button>
        </div>
        {/* Entries — hidden when collapsed */}
        {!lbCollapsed && (
          <div style={lb.entries}>
            {leaderboardBar.map((entry, i) => (
              <div key={i} style={{ ...lb.entry, backgroundColor: i === 0 ? 'rgba(255,215,0,0.12)' : 'transparent' }}>
                <span style={lb.rank}>{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                <span style={lb.name}>{entry.name || entry.username || `Player ${i + 1}`}</span>
                <span style={lb.score}>+{entry.score} Points</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ── NEW: Render message meta row (name + role badge + time) ──
  const renderMsgMeta = (message, isOwnMessage) => {
    const isTeacher  = message.sender?.role === 'teacher';
    const isStudent  = message.sender?.role === 'student';
    const senderName = message.sender?.name || message.sender?.username || 'Unknown';
    return (
      <div style={styles.msgMeta}>
        <span style={{ ...styles.senderName, color: isOwnMessage ? '#4f46e5' : getAvatarColor(message.sender?.username) }}>
          {senderName}
        </span>
        {isTeacher && (
          <span style={styles.teacherBadge}>Teacher</span>
        )}
        {isStudent && !isOwnMessage && (
          <span style={styles.studentBadge}>Student</span>
        )}
        <span style={styles.metaTime}>{formatTime(message.createdAt)}</span>
        {message.isEdited && !message.isDeleted && (
          <span style={styles.editedMeta}>(edited)</span>
        )}
      </div>
    );
  };

  return (
    <div style={styles.chatArea}>

      {/* ── Search bar — updated to clean light style ── */}
      <div style={styles.searchBar}>
        <div style={styles.searchInputWrapper}>
          <span style={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Search messages..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={styles.searchInput}
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} style={styles.clearSearch}>✕</button>
          )}
        </div>
        {searchQuery && (
          <span style={styles.searchResults}>{filteredMessages.length} result{filteredMessages.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* ── Collapsible leaderboard bar — UNCHANGED ── */}
      {renderLeaderboardBar()}

      {/* ── Messages container ── */}
      <div style={styles.messagesContainer} ref={messagesContainerRef} onScroll={handleScroll}>

        {filteredMessages.length === 0 && !searchQuery && (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>💬</div>
            <p style={styles.emptyText}>No messages yet</p>
            <p style={styles.emptySubtext}>Start the conversation! 👋</p>
          </div>
        )}
        {filteredMessages.length === 0 && searchQuery && (
          <div style={styles.emptyState}>
            <div style={styles.emptyIcon}>🔍</div>
            <p style={styles.emptyText}>No messages found</p>
            <p style={styles.emptySubtext}>Try a different search</p>
          </div>
        )}

        {filteredMessages.map((message, index) => {
          const isOwnMessage    = message.sender && message.sender._id === currentUserId;
          const isSystemMessage = message.messageType === 'system';
          const showDateSep     = needsDateSeparator(message, filteredMessages[index - 1]);
          const isEditing       = editingMessageId === message._id;
          const isPoll          = message.messageType === 'poll';

          return (
            <React.Fragment key={message._id || `${index}-${message.createdAt}`}>

              {/* ── Date separator ── */}
              {showDateSep && (
                <div style={styles.dateSeparator}>
                  <span style={styles.dateSeparatorText}>{getDateSeparator(message.createdAt)}</span>
                </div>
              )}

              {/* ── Message row ── */}
              <div
                style={styles.messageWrapper}
                onContextMenu={e => !isSystemMessage && !isPoll && handleContextMenu(e, message)}
              >
                {/* System messages — centered pill */}
                {isSystemMessage ? (
                  <div style={styles.systemMessage}>{message.content}</div>

                ) : (
                  /* ── Normal message: ALL left-aligned ── */
                  <div style={styles.messageRow}>

                    {/* Avatar */}
                    <div style={{
                      ...styles.avatar,
                      backgroundColor: isOwnMessage ? '#4f46e5' : getAvatarColor(message.sender?.username),
                    }}>
                      {getInitials(message.sender?.username)}
                      {/* Online dot — shown if sender is in onlineUsers */}
                    </div>

                    {/* Message column: meta + bubble */}
                    <div style={styles.messageColumn}>

                      {/* Meta: name + badge + time */}
                      {renderMsgMeta(message, isOwnMessage)}

                      {/* Bubble */}
                      <div style={{
                        ...styles.messageBubble,
                        backgroundColor: message.isDeleted
                          ? '#f1f5f9'
                          : isOwnMessage
                            ? '#eff6ff'   /* own: light indigo-blue */
                            : '#ffffff',  /* others: white */
                        borderColor: message.isDeleted
                          ? '#e2e8f0'
                          : isOwnMessage
                            ? '#c7d2fe'
                            : '#e2e8f0',
                        opacity: message.isDeleted ? 0.65 : 1,
                      }}>

                        {isEditing ? (
                          /* ── Edit mode ── */
                          <div style={styles.editContainer}>
                            <input
                              type="text"
                              value={editText}
                              onChange={e => setEditText(e.target.value)}
                              onKeyPress={e => { if (e.key === 'Enter') saveEditMessage(); if (e.key === 'Escape') cancelEdit(); }}
                              style={styles.editInput}
                              autoFocus
                            />
                            <div style={styles.editButtons}>
                              <button onClick={saveEditMessage} style={styles.saveBtn}>Save</button>
                              <button onClick={cancelEdit}      style={styles.cancelBtn}>Cancel</button>
                            </div>
                          </div>

                        ) : (
                          <>
                            {/* Quiz notification */}
                            {(message.messageType === 'quiz_started' || message.messageType === 'quiz_ended') && !message.isDeleted && renderQuizNotification(message)}

                            {/* Poll */}
                            {isPoll && !message.isDeleted && renderPoll(message)}

                            {/* File attachment */}
                            {message.messageType === 'file' && !message.isDeleted && renderFileAttachment(message)}

                            {/* Text content */}
                            {message.content && !isPoll && message.messageType !== 'quiz_started' && message.messageType !== 'quiz_ended' && (
                              <div style={styles.messageContent}>{message.content}</div>
                            )}

                            {/* Deleted placeholder */}
                            {message.isDeleted && (
                              <div style={styles.deletedText}>🚫 This message was deleted</div>
                            )}
                          </>
                        )}

                        {/* Read receipt for own messages */}
                        {!isEditing && isOwnMessage && !message.isDeleted && (
                          <div style={styles.readReceipt}>✓✓</div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </React.Fragment>
          );
        })}

        {/* Typing indicator */}
        {typingUsers && typingUsers.length > 0 && typingUsers.some(u => u && u.trim()) && (
          <div style={styles.typingWrapper}>
            <div style={styles.typingBubble}>
              <span style={styles.typingText}>
                {typingUsers.length === 1
                  ? `${typingUsers[0]} is typing`
                  : `${typingUsers.length} people are typing`}
              </span>
              <div style={styles.typingDots}>
                <span style={styles.dot} />
                <span style={styles.dot} />
                <span style={styles.dot} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Scroll-to-bottom button */}
      {showScrollButton && (
        <button style={styles.scrollButton} onClick={() => scrollToBottom()}>↓</button>
      )}

      {/* ── Context menu — UNCHANGED ── */}
      {contextMenu && (
        <div style={{ ...styles.contextMenu, top: contextMenu.y, left: contextMenu.x }}>
          <div style={styles.contextMenuItem} onClick={() => copyMessage(contextMenu.message.content)}>
            📋 Copy
          </div>
          {contextMenu.isOwn && !contextMenu.message.isDeleted && (
            <>
              <div style={styles.contextMenuItem} onClick={() => startEditMessage(contextMenu.message)}>✏️ Edit</div>
              <div style={{ ...styles.contextMenuItem, color: '#ef4444' }} onClick={() => deleteMessage(contextMenu.message._id)}>🗑️ Delete</div>
            </>
          )}
        </div>
      )}

      {/* ── Full-screen media viewer — UNCHANGED ── */}
      {fullscreenMedia && (
        <div style={styles.fullscreenOverlay}>
          <div style={styles.fullscreenHeader}>
            <button style={styles.fullscreenBtn} onClick={closeFullscreen}>✕ Close</button>
            <span style={styles.fullscreenTitle}>{fullscreenMedia.fileName}</span>
            <div style={styles.fullscreenActions}>
              {fullscreenMedia.fileType?.startsWith('image/') && (
                <>
                  <button style={styles.fullscreenBtn} onClick={zoomOut}>-</button>
                  <span style={styles.zoomLevel}>{Math.round(zoomLevel * 100)}%</span>
                  <button style={styles.fullscreenBtn} onClick={zoomIn}>+</button>
                </>
              )}
              <button style={styles.fullscreenBtn} onClick={() => downloadFile(fullscreenMedia.fileUrl, fullscreenMedia.fileName)}>⬇ Download</button>
            </div>
          </div>
          <div style={styles.fullscreenContent}>
            {fullscreenMedia.fileType?.startsWith('image/')
              ? <img src={fullscreenMedia.fileUrl} alt={fullscreenMedia.fileName} style={{ ...styles.fullscreenImage, transform: `scale(${zoomLevel})` }} />
              : fullscreenMedia.fileType?.startsWith('video/')
                ? <video src={fullscreenMedia.fileUrl} controls autoPlay style={styles.fullscreenVideo} />
                : null}
          </div>
        </div>
      )}

      {/* ── PDF viewer — UNCHANGED ── */}
      {pdfViewer && (
        <div style={styles.pdfViewerOverlay}>
          <div style={styles.pdfViewerHeader}>
            <span style={styles.pdfViewerTitle}>{pdfViewer.fileName}</span>
            <div>
              <button style={styles.fullscreenBtn} onClick={() => downloadFile(pdfViewer.fileUrl, pdfViewer.fileName)}>⬇ Download</button>
              <button style={styles.fullscreenBtn} onClick={closePdfViewer}>✕ Close</button>
            </div>
          </div>
          <iframe src={pdfViewer.fileUrl} style={styles.pdfIframe} title={pdfViewer.fileName} />
        </div>
      )}
    </div>
  );
};

// ══════════════════════════════════════════════
//  LEADERBOARD BAR STYLES — dark card, unchanged
// ══════════════════════════════════════════════
const lb = {
  bar: {
    backgroundColor: '#0f172a',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
    flexShrink: 0,
  },
  headerRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 16px',
    height: '42px',
  },
  trophy: { fontSize: '16px' },
  title: {
    flex: 1,
    fontSize: '12px',
    fontWeight: '600',
    color: '#cbd5e1',
    letterSpacing: '0.4px',
    textTransform: 'uppercase',
  },
  arrowBtn: {
    background: 'none',
    border: 'none',
    color: '#64748b',
    cursor: 'pointer',
    fontSize: '11px',
    padding: '4px 8px',
    borderRadius: '4px',
    transition: 'color 0.2s',
    lineHeight: 1,
  },
  entries: {
    padding: '4px 16px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  entry: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '6px 10px',
    borderRadius: '6px',
  },
  rank:  { fontSize: '16px', flexShrink: 0, width: '24px' },
  name:  { flex: 1, fontSize: '13px', fontWeight: '600', color: '#e2e8f0' },
  score: { fontSize: '12px', fontWeight: '700', color: '#22c55e', whiteSpace: 'nowrap' },
};

// ══════════════════════════════════════════════
//  MAIN STYLES — Visily-style clean classroom chat
// ══════════════════════════════════════════════
const styles = {

  // ── Layout ──
  chatArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    backgroundColor: '#f8fafc',
    position: 'relative',
  },

  // ── Search bar — clean light style ──
  searchBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 16px',
    backgroundColor: '#ffffff',
    borderBottom: '1px solid #e2e8f0',
    flexShrink: 0,
  },
  searchInputWrapper: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    backgroundColor: '#f1f5f9',
    borderRadius: '8px',
    padding: '0 12px',
    border: '1px solid #e2e8f0',
    transition: 'border-color 0.2s',
  },
  searchIcon: { fontSize: '13px', opacity: 0.5 },
  searchInput: {
    flex: 1,
    padding: '8px 0',
    fontSize: '13px',
    border: 'none',
    outline: 'none',
    backgroundColor: 'transparent',
    color: '#1e293b',
  },
  clearSearch: {
    background: 'none',
    border: 'none',
    fontSize: '14px',
    cursor: 'pointer',
    color: '#94a3b8',
    padding: '2px 4px',
    lineHeight: 1,
  },
  searchResults: {
    fontSize: '12px',
    color: '#64748b',
    whiteSpace: 'nowrap',
    fontWeight: '500',
  },

  // ── Messages container ──
  messagesContainer: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px 24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },

  // ── Empty state ──
  emptyState:   { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' },
  emptyIcon:    { fontSize: '56px', marginBottom: '16px', opacity: 0.4 },
  emptyText:    { fontSize: '17px', fontWeight: '600', margin: '0 0 6px', color: '#64748b' },
  emptySubtext: { fontSize: '13px', margin: 0, color: '#94a3b8' },

  // ── Date separator ──
  dateSeparator: {
    display: 'flex',
    justifyContent: 'center',
    margin: '20px 0 12px',
  },
  dateSeparatorText: {
    backgroundColor: '#e2e8f0',
    color: '#64748b',
    padding: '4px 12px',
    borderRadius: '20px',
    fontSize: '11px',
    fontWeight: '600',
    letterSpacing: '0.3px',
  },

  // ── Message wrapper (outer row) ──
  // ALL messages are left-aligned (no flex-end for own)
  messageWrapper: {
    display: 'flex',
    width: '100%',
    justifyContent: 'flex-start',
    marginBottom: '10px',
  },

  // ── System message ──
  systemMessage: {
    padding: '6px 16px',
    backgroundColor: '#e2e8f0',
    color: '#475569',
    borderRadius: '20px',
    fontSize: '12px',
    fontStyle: 'italic',
    textAlign: 'center',
    margin: '0 auto',
    maxWidth: '70%',
  },

  // ── Message row: avatar + column ──
  messageRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '10px',
    maxWidth: '75%',
  },

  // ── Avatar ──
  avatar: {
    width: '34px',
    height: '34px',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontSize: '12px',
    fontWeight: '700',
    flexShrink: 0,
    marginTop: '2px',
    position: 'relative',
  },

  // ── Message column: meta + bubble ──
  messageColumn: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    flex: 1,
  },

  // ── Message meta: name + badge + time ──
  msgMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    flexWrap: 'wrap',
  },
  senderName: {
    fontSize: '13px',
    fontWeight: '700',
    lineHeight: 1,
  },
  teacherBadge: {
    fontSize: '10px',
    fontWeight: '600',
    color: '#92400e',
    backgroundColor: '#fef3c7',
    border: '1px solid #fcd34d',
    borderRadius: '4px',
    padding: '1px 6px',
    lineHeight: '16px',
    letterSpacing: '0.2px',
  },
  studentBadge: {
    fontSize: '10px',
    fontWeight: '600',
    color: '#1e40af',
    backgroundColor: '#dbeafe',
    border: '1px solid #93c5fd',
    borderRadius: '4px',
    padding: '1px 6px',
    lineHeight: '16px',
    letterSpacing: '0.2px',
  },
  metaTime: {
    fontSize: '11px',
    color: '#94a3b8',
    fontWeight: '400',
  },
  editedMeta: {
    fontSize: '11px',
    color: '#94a3b8',
    fontStyle: 'italic',
  },

  // ── Message bubble ──
  messageBubble: {
    padding: '10px 14px',
    borderRadius: '4px 12px 12px 12px',
    border: '1px solid',
    wordWrap: 'break-word',
    position: 'relative',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    transition: 'opacity 0.2s',
  },
  messageContent: {
    fontSize: '14px',
    lineHeight: '21px',
    color: '#1e293b',
    wordBreak: 'break-word',
  },
  deletedText: {
    fontSize: '13px',
    color: '#94a3b8',
    fontStyle: 'italic',
  },

  // ── Own message read receipt ──
  readReceipt: {
    fontSize: '11px',
    color: '#6366f1',
    textAlign: 'right',
    marginTop: '4px',
    opacity: 0.8,
  },

  // ── Edit mode ──
  editContainer: { width: '100%' },
  editInput: {
    width: '100%',
    padding: '8px 10px',
    fontSize: '14px',
    border: '1px solid #c7d2fe',
    borderRadius: '6px',
    marginBottom: '8px',
    outline: 'none',
    backgroundColor: '#fafafa',
  },
  editButtons: { display: 'flex', gap: '8px' },
  saveBtn:   { padding: '5px 14px', fontSize: '12px', fontWeight: '600', backgroundColor: '#6366f1', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' },
  cancelBtn: { padding: '5px 14px', fontSize: '12px', fontWeight: '600', backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0', borderRadius: '5px', cursor: 'pointer' },

  // ── Typing indicator ──
  typingWrapper: { display: 'flex', justifyContent: 'flex-start', marginTop: '4px' },
  typingBubble: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '8px 14px',
    backgroundColor: '#ffffff',
    border: '1px solid #e2e8f0',
    borderRadius: '4px 12px 12px 12px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  typingText: { fontSize: '13px', color: '#64748b', fontStyle: 'italic' },
  typingDots: { display: 'flex', gap: '3px', alignItems: 'center' },
  dot: { width: '5px', height: '5px', backgroundColor: '#94a3b8', borderRadius: '50%', animation: 'bounce 1.4s infinite ease-in-out both' },

  // ── Scroll button ──
  scrollButton: {
    position: 'absolute',
    bottom: '20px',
    right: '20px',
    width: '38px',
    height: '38px',
    borderRadius: '50%',
    backgroundColor: '#6366f1',
    color: 'white',
    border: 'none',
    fontSize: '18px',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(99,102,241,0.35)',
    zIndex: 10,
  },

  // ── Context menu ──
  contextMenu: {
    position: 'fixed',
    backgroundColor: 'white',
    borderRadius: '10px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
    padding: '6px 0',
    zIndex: 1000,
    minWidth: '150px',
    border: '1px solid #f1f5f9',
  },
  contextMenuItem: {
    padding: '10px 16px',
    fontSize: '13px',
    cursor: 'pointer',
    color: '#374151',
    transition: 'background-color 0.15s',
  },

  // ── Poll styles ──
  pollContainer: { padding: '4px 0' },
  pollHeader: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' },
  pollIcon: { fontSize: '18px' },
  pollQuestion: { fontSize: '14px', fontWeight: '600', color: '#1e293b' },
  pollOptions: { display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' },
  pollOptionWrapper: { width: '100%' },
  pollButton: { width: '100%', padding: '10px 14px', fontSize: '13px', backgroundColor: '#f1f5f9', color: '#1e293b', border: '1px solid #e2e8f0', borderRadius: '7px', cursor: 'pointer', fontWeight: '500', textAlign: 'left', transition: 'all 0.2s' },
  pollResult: { padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: '7px', backgroundColor: 'white' },
  pollResultTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' },
  pollOptionText: { fontSize: '13px', color: '#1e293b', fontWeight: '500' },
  pollPercentage: { fontSize: '12px', fontWeight: '700', color: '#6366f1' },
  pollProgressBar: { width: '100%', height: '5px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden', marginBottom: '4px' },
  pollProgressFill: { height: '100%', transition: 'width 0.3s' },
  pollVoteCount: { fontSize: '11px', color: '#64748b' },
  checkmark: { color: '#6366f1', fontWeight: 'bold' },
  pollFooter: { fontSize: '11px', color: '#94a3b8', fontStyle: 'italic', marginTop: '4px' },
  pollError: { padding: '8px', fontSize: '12px', color: '#ef4444', fontStyle: 'italic' },

  // ── Quiz notification styles ──
  quizNotificationHeader: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' },
  quizIcon: { fontSize: '26px' },
  quizNotificationTitle: { fontSize: '16px', fontWeight: '700', color: '#4f46e5' },
  quizNotificationContent: { marginBottom: '12px' },
  quizTitle: { fontSize: '15px', fontWeight: '600', color: '#1e293b', marginBottom: '6px' },
  quizMessage: { fontSize: '13px', color: '#64748b' },
  joinQuizBtn: { width: '100%', padding: '10px', fontSize: '14px', fontWeight: '700', backgroundColor: '#4f46e5', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(79,70,229,0.25)' },
  winnerInfo: { display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', backgroundColor: 'rgba(255,215,0,0.1)', borderRadius: '8px', marginBottom: '10px', border: '1px solid rgba(255,215,0,0.25)' },
  winnerBadge: { fontSize: '32px' },
  winnerName: { fontSize: '14px', fontWeight: '600', color: '#1e293b', marginBottom: '3px' },
  winnerScore: { fontSize: '12px', color: '#64748b', fontWeight: '500' },

  // ── File attachment styles ──
  imageAttachment: { maxWidth: '100%', maxHeight: '280px', borderRadius: '8px', cursor: 'pointer', marginBottom: '4px', display: 'block' },
  videoWrapper: { maxWidth: '100%', marginBottom: '4px' },
  videoAttachment: { maxWidth: '100%', maxHeight: '280px', borderRadius: '8px', cursor: 'pointer' },
  audioContainer: { display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', backgroundColor: 'rgba(0,0,0,0.03)', borderRadius: '20px', marginBottom: '4px' },
  audioIcon: { fontSize: '18px' },
  audioPlayer: { flex: 1, height: '32px' },
  documentContainer: { marginBottom: '4px' },
  pdfPreview: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', backgroundColor: '#f8fafc', borderRadius: '8px', marginBottom: '8px', border: '1px solid #e2e8f0' },
  pdfIcon: { fontSize: '28px' },
  pdfInfo: { flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' },
  pdfName: { fontSize: '13px', fontWeight: '600', color: '#1e293b' },
  pdfSize: { fontSize: '11px', color: '#64748b' },
  pdfActions: { display: 'flex', gap: '8px' },
  pdfButton: { flex: 1, padding: '7px', fontSize: '12px', fontWeight: '600', backgroundColor: '#6366f1', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer' },
  documentAttachment: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', backgroundColor: '#f8fafc', borderRadius: '8px', textDecoration: 'none', color: '#1e293b', marginBottom: '4px', border: '1px solid #e2e8f0' },
  documentIcon: { fontSize: '18px' },
  fileSize: { fontSize: '11px', color: '#94a3b8' },

  // ── Fullscreen overlay ──
  fullscreenOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 2000, display: 'flex', flexDirection: 'column' },
  fullscreenHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', backgroundColor: 'rgba(0,0,0,0.7)', color: 'white' },
  fullscreenTitle: { fontSize: '14px', fontWeight: '500' },
  fullscreenActions: { display: 'flex', gap: '10px', alignItems: 'center' },
  fullscreenBtn: { padding: '7px 12px', fontSize: '13px', backgroundColor: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '6px', cursor: 'pointer' },
  zoomLevel: { fontSize: '13px', color: 'white', minWidth: '46px', textAlign: 'center' },
  fullscreenContent: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', padding: '20px' },
  fullscreenImage: { maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', transition: 'transform 0.2s' },
  fullscreenVideo: { maxWidth: '100%', maxHeight: '100%' },

  // ── PDF viewer overlay ──
  pdfViewerOverlay: { position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.95)', zIndex: 2000, display: 'flex', flexDirection: 'column' },
  pdfViewerHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', backgroundColor: 'rgba(0,0,0,0.7)', color: 'white' },
  pdfViewerTitle: { fontSize: '14px', fontWeight: '500' },
  pdfIframe: { flex: 1, width: '100%', border: 'none' },
};

const additionalStyles = {
  quizNotificationContainer: {
    padding: '14px 16px',
    backgroundColor: 'rgba(79,70,229,0.06)',
    borderRadius: '10px',
    border: '1.5px solid #c7d2fe',
  },
};

if (typeof document !== 'undefined') {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes bounce {
      0%, 60%, 100% { transform: translateY(0); }
      30%            { transform: translateY(-6px); }
    }
  `;
  document.head.appendChild(style);
}

export default ChatArea;