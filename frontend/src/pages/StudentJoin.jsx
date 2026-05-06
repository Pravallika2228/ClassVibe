// frontend/src/pages/StudentJoin.jsx
// ✅ CHANGES:
// 1. Added password field (after email) — optional for public sessions, used for private
// 2. PIN validation: accept 4–6 digits (live groups = 6 digits, scheduled sessions = 4 digits)
// 3. Field order: Nickname → PIN → Email Address → Session Password
// 4. QR camera logic, URL PIN detection, all other logic — IDENTICAL

import React, { useState, useRef, useEffect } from "react";
import "./StudentJoin.css";
import { joinGroup } from "../api";

export default function StudentJoin({ onJoinSuccess, onBack }) {
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

  const videoRef       = useRef(null);
  const canvasRef      = useRef(null);
  const streamRef      = useRef(null);
  const scanIntervalRef = useRef(null);

  // ✅ Check URL for PIN (from QR code)
  useEffect(() => {
    const urlParams  = new URLSearchParams(window.location.search);
    const pinFromUrl = urlParams.get('pin');
    // ✅ CHANGED: accept 4–6 digit PIN from URL
    if (pinFromUrl && /^\d{4,6}$/.test(pinFromUrl)) {
      setPin(pinFromUrl);
      setShowPinForm(true);
      setMessageType("success");
      setMessage("QR code detected! Fill in your details below to join.");
    }
  }, []);

  const resetMessages = () => { setMessage(""); setMessageType("error"); };

  const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v).toLowerCase());

  const parsePinFromQr = (raw) => {
    if (!raw) return "";
    try {
      const url = new URL(raw);
      const p = url.searchParams.get("pin");
      // ✅ CHANGED: 4–6 digits
      if (p && /^\d{4,6}$/.test(p)) return p;
    } catch {}
    const digits = (raw.match(/\d+/g) || []).join("");
    if (digits.length >= 4) return digits.slice(0, 6);
    const m = raw.match(/\d{4,6}/);
    return m ? m[0] : "";
  };

  const handleSubmitPin = async (e) => {
    e && e.preventDefault();
    resetMessages();

    const p = (pin || "").trim();

    if (!name.trim())          { setMessage("Please enter your nickname"); setMessageType("error"); return; }
    // ✅ CHANGED: accept 4–6 digit PIN
    if (!/^\d{4,6}$/.test(p)) { setMessage("Please enter a valid 4–6 digit PIN"); setMessageType("error"); return; }
    if (!email.trim())         { setMessage("Please enter your email address"); setMessageType("error"); return; }
    if (!isValidEmail(email.trim())) { setMessage("Please enter a valid email address"); setMessageType("error"); return; }
    // password is optional — only required if the session is private (backend will reject if wrong)

    setLoading(true);
    try {
      const resp = await joinGroup({
        pin:      p,
        name:     name.trim(),
        email:    email.trim(),
        password: password.trim() || undefined, // ✅ NEW: send password if provided
      });

      const token = resp?.token ?? resp?.data?.token ?? null;
      const user  = resp?.user  ?? resp?.data?.user  ?? null;
      const group = resp?.group ?? resp?.data?.group ?? null;

      if (token) localStorage.setItem("token", token);
      if (user)  localStorage.setItem("user",  JSON.stringify(user));

      setMessageType("success");
      setMessage(group ? `Joined "${group.groupName}" successfully!` : "Joined classroom successfully!");

      if (onJoinSuccess) onJoinSuccess(group ?? { pin: p }, user, token);
    } catch (err) {
      console.error("Join failed:", err);
      const serverMsg = err?.response?.data?.error || err?.response?.data?.message || err?.message
        || "Failed to join. Please check your PIN, email and password.";
      setMessage(serverMsg);
      setMessageType("error");
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
          if (parsedPin && /^\d{4,6}$/.test(parsedPin)) {
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
    <div className="student-page">
      <header className="student-header">
        <h2 className="header-bar">
          ClassVibe
          <button className="back-link" onClick={() => onBack && onBack()}>Back to Home</button>
        </h2>
      </header>

      <main className="student-main">
        <div className="container1">
          <img src="/css/all.min.css/student (1).png" alt="student" className="big-icon" />

          <h2 className="para">
            <b>Join a classroom</b>
            <p>Choose how you'd like to join your classroom</p>
          </h2>

          {!showPinForm && (
            <div className="row1">
              <div className="col-2">
                <div className="role-card" onClick={() => { resetMessages(); setShowPinForm(true); setShowQRHelp(false); }}>
                  <img src="/css/all.min.css/hashtag-lock.png" alt="PIN" className="big-icon" />
                  <h2>Enter PIN</h2>
                  <p>Ask your teacher for the session PIN</p>
                  <button className="card-btn" onClick={e => { e.stopPropagation(); resetMessages(); setShowPinForm(true); setShowQRHelp(false); }}>Enter PIN</button>
                </div>
              </div>
              <div className="col-2">
                <div className="role-card" onClick={() => { resetMessages(); startCameraScan(); }}>
                  <img src="/css/all.min.css/qr (1).png" alt="qr code" className="big-icon" />
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
                  autoFocus
                  required
                />

                {/* 2. Session PIN */}
                <label>Session PIN *</label>
                <input
                  value={pin}
                  onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="4–6 digit PIN"
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

          {message && <div className={`msg ${messageType === "success" ? "success" : "error"}`}>{message}</div>}
        </div>
      </main>

      <footer className="student-footer">
        <div className="social-links">
          <img src="/css/all.min.css/instagram.png" alt="instagram" />
          <img src="/css/all.min.css/linkedin.png" alt="linkedin" />
          <img src="/css/all.min.css/telegram.png" alt="telegram" />
        </div>
        <div className="copyright">© 2024 ClassVibe. Connecting classrooms worldwide.</div>
      </footer>
    </div>
  );
}