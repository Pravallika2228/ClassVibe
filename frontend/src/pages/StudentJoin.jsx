// frontend/src/pages/StudentJoin.jsx
// ✅ CHANGES:
// 1. Added password field (after email) — optional for public sessions, used for private
// 2. PIN validation: accept 4–6 digits (live groups = 6 digits, scheduled sessions = 4 digits)
// 3. Field order: Nickname → PIN → Email Address → Session Password
// 4. QR camera logic, URL PIN detection, all other logic — IDENTICAL

import React, { useState, useRef, useEffect } from "react";
import "./StudentJoin.css";
import { joinGroup, studentGuestAuth } from "../api";
import Footer from "../pages/Footer";
import {FaUserGraduate, FaHashtag, FaQrcode} from "react-icons/fa"

export default function StudentJoin({ onJoinSuccess, onBack }) {
  const [darkMode] = useState(
    localStorage.getItem("theme") === "dark"
  );
  const [showPinForm, setShowPinForm] = useState(false);
  const [showQRHelp,  setShowQRHelp]  = useState(false);
  const [scanning,    setScanning]    = useState(false);

  const [name,     setName]     = useState("");
  const [pin,      setPin]      = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState(""); // ✅ NEW: session password for private sessions

  const [loading,     setLoading]     = useState(false);
  const [message,     setMessage]     = useState("");
  const [messageType, setMessageType] = useState("error");

  // "Continue without joining" secondary path
  const [showGuestForm,    setShowGuestForm]    = useState(false);
  const [guestName,        setGuestName]        = useState("");
  const [guestEmail,       setGuestEmail]       = useState("");
  const [guestPassword,    setGuestPassword]    = useState("");
  const [guestLoading,     setGuestLoading]     = useState(false);
  const [guestMessage,     setGuestMessage]     = useState("");
  const [guestMessageType, setGuestMessageType] = useState("error");

  const videoRef       = useRef(null);
  const canvasRef      = useRef(null);
  const streamRef      = useRef(null);
  const scanIntervalRef = useRef(null);

  // ✅ Check URL for PIN (from QR code)
  useEffect(() => {
     window.scrollTo(0, 0);
    const urlParams  = new URLSearchParams(window.location.search);
    const pinFromUrl = urlParams.get('pin');
    // ✅ CHANGED: accept 6-digit PIN from URL
    if (pinFromUrl && /^\d{6}$/.test(pinFromUrl)) {
      setPin(pinFromUrl);
      setShowPinForm(true);
      setMessageType("success");
      setMessage("QR code detected! Fill in your details below to join.");
    }
  }, []);

  const resetMessages = () => { setMessage(""); setMessageType("error"); };

  const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).toLowerCase());

  // ── "Continue without joining" handler ─────────────────────────────────
  const handleGuestLogin = async (e) => {
    e.preventDefault();
    setGuestMessage(""); setGuestMessageType("error");

    if (!guestName.trim())                { setGuestMessage("Enter your name.");             return; }
    if (!guestEmail.trim())               { setGuestMessage("Enter your email.");            return; }
    if (!isValidEmail(guestEmail.trim())) { setGuestMessage("Enter a valid email.");         return; }
    if (guestPassword.length < 6)         { setGuestMessage("Password must be ≥ 6 chars."); return; }

    setGuestLoading(true);
    try {
      // Single endpoint: registers if email is new, signs in if email already exists.
      const result = await studentGuestAuth(guestEmail.trim(), guestPassword, guestName.trim());

      const token = result?.token ?? null;
      const user  = result?.user  ?? null;

      if (!token) throw new Error("Authentication failed — no token received.");

      localStorage.setItem("token", token);
      if (user) localStorage.setItem("user", JSON.stringify(user));

      onJoinSuccess(null, user, token);
    } catch (err) {
      const errMsg = err?.response?.data?.error || err?.response?.data?.message || err?.message || "Authentication failed.";
      setGuestMessage(errMsg); setGuestMessageType("error");
    } finally {
      setGuestLoading(false);
    }
  };

  const parsePinFromQr = (raw) => {
    if (!raw) return "";
    try {
      const url = new URL(raw);
      const p = url.searchParams.get("pin");
      // ✅ CHANGED: 4–6 digits
      if (p && /^\d{6}$/.test(p)) return p;
    } catch {}
    const digits = (raw.match(/\d+/g) || []).join("");
    if (digits.length === 6) return digits;
    const m = raw.match(/\d{6}/);
    return m ? m[0] : "";
  };

  const handleSubmitPin = async (e) => {
    e && e.preventDefault();
    resetMessages();

    const p = (pin || "").trim();

    if (!name.trim())          { setMessage("Please enter your nickname"); setMessageType("error"); return; }
    // ✅ CHANGED: accept 6-digit PIN
    if (!/^\d{6}$/.test(p)) { setMessage("Please enter a valid 6-digit PIN"); setMessageType("error"); return; }
    if (!email.trim())         { setMessage("Please enter your email address"); setMessageType("error"); return; }
    if (!isValidEmail(email.trim())) { setMessage("Please enter a valid email address"); setMessageType("error"); return; }
    // password is optional — only required if the session is private (backend will reject if wrong)

    setLoading(true);
    const attemptJoin = async () => {
      const resp = await joinGroup({
        pin:      p,
        name:     name.trim(),
        email:    email.trim(),
        password: password.trim() || undefined,
      });
      const token = resp?.token ?? resp?.data?.token ?? null;
      const user  = resp?.user  ?? resp?.data?.user  ?? null;
      const group = resp?.group ?? resp?.data?.group ?? null;
      if (token) localStorage.setItem("token", token);
      if (user)  localStorage.setItem("user",  JSON.stringify(user));
      setMessageType("success");
      setMessage(group ? `Joined "${group.groupName}" successfully!` : "Joined classroom successfully!");
      if (onJoinSuccess) onJoinSuccess(group ?? { pin: p }, user, token);
    };
    try {
      await attemptJoin();
    } catch (err) {
      console.error("Join failed:", err);
      // Network error = Render cold start. Retry once after 12s automatically.
      const isNetworkErr = !err.response;
      if (isNetworkErr) {
        setMessageType("error");
        setMessage("Server is starting up (Render free tier). Retrying in 12 seconds…");
        await new Promise(r => setTimeout(r, 12000));
        try {
          await attemptJoin();
        } catch (retryErr) {
          const retryMsg = retryErr?.response?.data?.error || retryErr?.response?.data?.message || "Server took too long. Please try again.";
          setMessage(retryMsg); setMessageType("error");
        }
      } else {
        const serverMsg = err?.response?.data?.error || err?.response?.data?.message || err?.message
          || "Failed to join. Please check your PIN, email and password.";
        setMessage(serverMsg); setMessageType("error");
      }
    } finally { setLoading(false); }
  };

  // ── QR Camera (all unchanged) ──
  const startCameraScan = async () => {
    resetMessages();
    if (!navigator.mediaDevices?.getUserMedia) { setMessage("Camera not available on this device"); setMessageType("error"); return; }
    if (typeof window.BarcodeDetector !== "function") { setMessage("QR scanning not supported in this browser. Use Enter PIN instead."); setMessageType("error"); setShowQRHelp(true); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode:"environment", width:{ideal:1280}, height:{ideal:720} }, audio:false });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      setScanning(true); setShowPinForm(false); setShowQRHelp(false); setMessage("");
      startScanLoop();
    } catch (err) { setMessage("Unable to access camera. Please allow camera permissions."); setMessageType("error"); }
  };

  const stopCameraScan = () => {
    setScanning(false);
    if (scanIntervalRef.current) { clearInterval(scanIntervalRef.current); scanIntervalRef.current = null; }
    if (videoRef.current) { try { videoRef.current.pause(); } catch {} videoRef.current.srcObject = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
  };

  const startScanLoop = () => {
    const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
    scanIntervalRef.current = setInterval(async () => {
      try {
        if (!videoRef.current || videoRef.current.readyState < 2) return;
        const w = videoRef.current.videoWidth; const h = videoRef.current.videoHeight;
        if (!w || !h) return;
        const canvas = canvasRef.current; if (!canvas) return;
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(videoRef.current, 0, 0, w, h);
        const codes = await detector.detect(canvas);
        if (codes && codes.length > 0) {
          const raw       = codes[0].rawValue ?? codes[0].rawData ?? "";
          const parsedPin = parsePinFromQr(raw);
          stopCameraScan();
          if (parsedPin && /^\d{6}$/.test(parsedPin)) {
            setPin(parsedPin); setShowPinForm(true); setMessageType("success");
            setMessage("QR scanned! Fill in your details to join.");
          } else {
            setMessage("QR scanned but couldn't extract a PIN. Enter it manually."); setMessageType("error"); setShowPinForm(true);
          }
        }
      } catch (err) { console.warn("scan error:", err); }
    }, 500);
  };

  useEffect(() => { return () => stopCameraScan(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─────────────────────────────────────────
  return (
    <div className={`student-page ${darkMode ? "dark-mode" : ""}`}>
      <header className="student-header">
        <h2>ClassVibe</h2>
        <button className="back-link" onClick={() => onBack && onBack()}>Back to Home</button>
      </header>

      <main className="student-main">
        <div className="container1">
          <FaUserGraduate className="big-icon" />

          <h2 className="para">
            <b>Join a classroom</b>
            <p>Choose how you'd like to join your classroom</p>
          </h2>

          {!showPinForm && (
            <div className="row1">
              <div className="col-2">
                <div className="role-card" onClick={() => { resetMessages(); setShowPinForm(true); setShowQRHelp(false); }}>
                  <FaHashtag  className="card-icon" />
                  <h2>Enter PIN</h2>
                  <p>Ask your teacher for the session PIN</p>
                  <button className="card-btn" onClick={e => { e.stopPropagation(); resetMessages(); setShowPinForm(true); setShowQRHelp(false); }}>Enter PIN</button>
                </div>
              </div>
              <div className="col-2">
                <div className="role-card" onClick={() => { resetMessages(); startCameraScan(); }}>
                  <FaQrcode className="card-icon" />
                  <h2>Scan QR Code</h2>
                  <p>Point your camera at the teacher's screen</p>
                  <button className="card-btn" onClick={e => { e.stopPropagation(); resetMessages(); startCameraScan(); }}>Scan QR Code</button>
                </div>
              </div>
            </div>
          )}

          {scanning && (
            <div className="scanner card">
              <div className="scanner-top">
                <strong>Scanning for QR…</strong>
                <button className="card-btn small" onClick={stopCameraScan}>Stop</button>
              </div>
              <video ref={videoRef} className="scanner-video" playsInline muted />
              <canvas ref={canvasRef} style={{ display:"none" }} />
            </div>
          )}

          {showPinForm && (
            <div className="pin-form card">
              <h3>Join Classroom</h3>
              <form onSubmit={handleSubmitPin} autoComplete="off">

                {/* 1. Nickname */}
                <label>Nickname *</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Enter your name or nickname"
                  autoComplete="name"
                  required
                />

                {/* 2. Session PIN */}
                <label>Session PIN *</label>
                <input
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="6-digit PIN"
                  inputMode="numeric"
                  maxLength={6}
                  autoComplete="off"
                  required
                />

                {/* 3. Email */}
                <label>Email Address *</label>
                <input
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  type="email"
                  autoComplete="email"
                  required
                />

                {/* ✅ 4. Session Password (optional — required only for private sessions) */}
                <label>
                  Session Password
                  <span style={{ fontWeight:'400', color:'#9ca3af', marginLeft:6, fontSize:'12px' }}>
                    (required for private sessions only)
                  </span>
                </label>
                <input
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Leave blank if public session"
                  type="password"
                  autoComplete="off"
                />

                <button type="submit" className="create-btn" disabled={loading}>
                  {loading ? "Joining..." : "Join Classroom"}
                </button>

                <button
                  type="button"
                  style={{ background:'none', border:'none', color:'#6b7280', fontSize:'13px', cursor:'pointer', marginTop:'8px', textDecoration:'underline' }}
                  onClick={() => { resetMessages(); setShowPinForm(false); }}
                >
                  ← Choose different method
                </button>
              </form>
            </div>
          )}

          {showQRHelp && (
            <div className="pin-form card">
              <h3>QR Help</h3>
              <p>Your browser doesn't support the native QR scanner. Use the PIN option, or try Chrome on Android / Safari on iOS.</p>
            </div>
          )}

          {/* ── "Continue without joining" section ── */}
          {!showPinForm && !scanning && !showGuestForm && (
            <div style={{ textAlign:'center', marginTop:'24px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'16px' }}>
                <div style={{ flex:1, height:'1px', backgroundColor: darkMode?'#334155':'#e5e7eb' }} />
                <span style={{ fontSize:'12px', color: darkMode?'#64748b':'#9ca3af', fontWeight:'600', letterSpacing:'0.5px' }}>OR</span>
                <div style={{ flex:1, height:'1px', backgroundColor: darkMode?'#334155':'#e5e7eb' }} />
              </div>
              <button
                type="button"
                onClick={() => { resetMessages(); setShowGuestForm(true); }}
                style={{
                  background:'none',
                  border: `1.5px dashed ${darkMode?'#475569':'#d1d5db'}`,
                  borderRadius:'10px',
                  color: darkMode?'#94a3b8':'#6b7280',
                  fontSize:'13px',
                  fontWeight:'600',
                  cursor:'pointer',
                  padding:'12px 24px',
                  width:'100%',
                  transition:'all 0.2s',
                }}
              >
                Continue without joining a classroom →
              </button>
            </div>
          )}

          {/* ── Guest login form ── */}
          {showGuestForm && (
            <div className="pin-form card" style={{
              backgroundColor: darkMode?'#1e293b':'#ffffff',
              color: darkMode?'#f1f5f9':'#111827',
              border: darkMode?'1px solid #334155':'undefined',
            }}>
              <h3 style={{ color: darkMode?'#f1f5f9':'#111827' }}>Enter Student Dashboard</h3>
              <p className="hint" style={{ marginBottom:'16px', color: darkMode?'#94a3b8':'#6b7280' }}>
                Create an account or sign in. You can join a classroom later.
              </p>

              <form onSubmit={handleGuestLogin} autoComplete="off">
                <label style={{ color: darkMode?'#e2e8f0':'#374151' }}>Your Name *</label>
                <input
                  value={guestName}
                  onChange={e => setGuestName(e.target.value)}
                  placeholder="e.g., Priya"
                  autoComplete="name"
                  required
                />

                <label style={{ color: darkMode?'#e2e8f0':'#374151' }}>Email Address *</label>
                <input
                  value={guestEmail}
                  onChange={e => setGuestEmail(e.target.value)}
                  placeholder="you@example.com"
                  type="email"
                  autoComplete="email"
                  required
                />

                <label style={{ color: darkMode?'#e2e8f0':'#374151' }}>Password *
                  <span style={{ fontWeight:'400', color:'#9ca3af', marginLeft:6, fontSize:'12px' }}>
                    (min. 6 characters — used to sign in again later)
                  </span>
                </label>
                <input
                  value={guestPassword}
                  onChange={e => setGuestPassword(e.target.value)}
                  placeholder="Choose a password"
                  type="password"
                  autoComplete="new-password"
                  required
                />

                <button type="submit" className="create-btn" disabled={guestLoading}>
                  {guestLoading ? "Please wait…" : "Open Student Dashboard"}
                </button>

                <button
                  type="button"
                  style={{ background:'none', border:'none', color: darkMode?'#94a3b8':'#6b7280', fontSize:'13px', cursor:'pointer', marginTop:'8px', textDecoration:'underline' }}
                  onClick={() => { setGuestMessage(""); setShowGuestForm(false); }}
                >
                  ← Back
                </button>

                {guestMessage && (
                  <div className={`msg ${guestMessageType === "success" ? "success" : "error"}`} style={{ marginTop:'12px' }}>
                    {guestMessage}
                  </div>
                )}
              </form>
            </div>
          )}

          {message && <div className={`msg ${messageType === "success" ? "success" : "error"}`}>{message}</div>}
        </div>
      </main>
      <Footer />
    </div>
  );
}