// frontend/src/pages/TeacherLogin.jsx
// ✅ FIX: Added correct autoComplete attributes to all inputs so browser
//         doesn't autofill the previous email into the username field.
//         username → autoComplete="username"
//         email    → autoComplete="email"
//         password → autoComplete="new-password" (register) / "current-password" (sign in)
// All other logic — validation, socket auth, register/login flow — IDENTICAL

import React, { useState } from "react";
import "./TeacherLogin.css";
import { register, login } from "../api";
import socket from "../socket";

export default function TeacherLogin({ onAuthSuccess, onBack }) {
  const [username, setUsername] = useState("");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading]         = useState(false);
  const [message, setMessage]         = useState("");
  const [messageType, setMessageType] = useState("error");
  const [isRegisterMode, setIsRegisterMode] = useState(true);

  const isValidEmail = (value) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(value).toLowerCase());
  };

  const isValidUsername = (value) => /^[a-zA-Z0-9_]{3,20}$/.test(value);

  const parseJwt = (token) => {
    try {
      const payload = token.split(".")[1];
      const base64  = payload.replace(/-/g, "+").replace(/_/g, "/");
      const json    = decodeURIComponent(
        atob(base64).split("").map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2)).join("")
      );
      return JSON.parse(json);
    } catch (e) { return null; }
  };

  const extractAuth = (resp) => {
    if (!resp) return {};
    const maybe = resp.data ?? resp;
    const token = maybe.token ?? maybe.accessToken ?? null;
    const user  = maybe.user ?? maybe;
    return { token, user };
  };

  const finishAuth = async (userObj, token) => {
    if (token) localStorage.setItem("token", token);
    if (userObj) localStorage.setItem("user", JSON.stringify(userObj));
    if (!userObj && token) {
      const parsed = parseJwt(token);
      if (parsed) {
        const derived = { id: parsed.userId ?? parsed.sub, email: parsed.email ?? email, role: parsed.role ?? "teacher" };
        localStorage.setItem("user", JSON.stringify(derived));
        userObj = derived;
      }
    }
    try { socket.connect(); if (token) socket.emit("authenticate", token); }
    catch (e) { console.warn("Socket connect/emit issue:", e?.message ?? e); }
  };

  const waitForSocketAuth = (timeoutMs = 3000) =>
    new Promise((resolve) => {
      let resolved = false;
      const onAuth  = () => { if (resolved) return; resolved = true; cleanup(); resolve({ ok: true }); };
      const onError = (data) => { if (resolved) return; resolved = true; cleanup(); resolve({ ok: false, data }); };
      const cleanup = () => { socket.off("authenticated", onAuth); socket.off("authError", onError); };
      socket.once("authenticated", onAuth);
      socket.once("authError", onError);
      setTimeout(() => { if (resolved) return; resolved = true; cleanup(); resolve({ ok: true, timeout: true }); }, timeoutMs);
    });

  const handleSubmit = async (e) => {
    e && e.preventDefault();
    setMessage(""); setMessageType("error");

    // ── REGISTER ──
    if (isRegisterMode) {
      if (!username.trim())                   { setMessage("Enter a username"); return; }
      if (!isValidUsername(username.trim()))  { setMessage("Username: 3–20 chars, letters/numbers/underscores only"); return; }
      if (!email.trim())                      { setMessage("Enter email id"); return; }
      if (!isValidEmail(email.trim()))        { setMessage("Invalid email id"); return; }
      if (!password.trim() || password.length < 6) { setMessage("Password must be at least 6 characters"); return; }

      setLoading(true);
      try {
        await register(email.trim(), password, username.trim(), 'teacher');
        setMessageType("success");
        setMessage("Account created! Please sign in.");
        setIsRegisterMode(false);
        setUsername("");
      } catch (err) {
        const serverMsg = err?.response?.data?.error || err?.response?.data?.message || err?.message || "Registration failed";
        setMessage(serverMsg); setMessageType("error");
      } finally { setLoading(false); }
      return;
    }

    // ── SIGN IN ──
    if (!email.trim() || !password.trim()) { setMessage("Please fill Email and Password."); return; }
    if (!isValidEmail(email.trim()))       { setMessage("Invalid email id"); return; }

    setLoading(true);
    try {
      const loginResp = await login(email.trim(), password);
      let { token, user } = extractAuth(loginResp);
      if (!token) throw new Error("Authentication failed (no token).");

      await finishAuth(user, token);
      await waitForSocketAuth(3000);

      setMessageType("success"); setMessage("Signed in! Loading dashboard...");

      setTimeout(() => {
        const savedUser = JSON.parse(localStorage.getItem("user") || "null");
        onAuthSuccess && onAuthSuccess(savedUser ?? user, token);
      }, 400);
    } catch (err) {
      const errMsg = err?.response?.data?.error || err?.response?.data?.message || err?.message || "Failed to sign in";
      setMessage(errMsg); setMessageType("error");
    } finally { setLoading(false); }
  };

  const toggleMode = () => {
    setIsRegisterMode((s) => !s);
    setMessage(""); setMessageType("error"); setUsername("");
  };

  return (
    <div className="teacher-page">
      <header className="teacher-header">
        <h2>ClassVibe <span className="owner">- sai</span></h2>
        <div className="header-actions">
          <button className="link-btn" onClick={() => onBack && onBack()}>Back to Home</button>
        </div>
      </header>

      <main className="teacher-main">
        <div className="teacher-container">
          <div className="icon">🎓</div>

          <h2 className="teacher-title">
            {isRegisterMode ? "Create Teacher Account" : "Teacher Sign In"}
          </h2>
          <p className="teacher-para">
            {isRegisterMode
              ? "Register to start managing your virtual classrooms"
              : "Sign in to access your Instructor Hub"}
          </p>

          <div className="card">
            <h3>{isRegisterMode ? "Sign Up" : "Sign In"}</h3>
            <p className="hint">Enter your credentials</p>

            {/*
              ✅ FIX: autoComplete="off" on the form prevents browser from
              autofilling all fields based on previous form submissions.
              Individual fields have explicit autoComplete values.
            */}
            <form onSubmit={handleSubmit} autoComplete="off">

              {/* Username — only in Register mode */}
              {isRegisterMode && (
                <>
                  <label>Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g., mrsmith_teacher"
                    // ✅ FIX: explicit autoComplete="username" stops browser
                    //         from autofilling this with a remembered email address
                    autoComplete="username"
                    required
                  />
                </>
              )}

              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teacher@school.edu"
                // ✅ FIX: explicit autoComplete="email" so browser fills
                //         the EMAIL field (not the username field) with saved email
                autoComplete="email"
                required
              />

              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isRegisterMode ? "Choose a password (min. 6 chars)" : "Your password"}
                // ✅ FIX: "new-password" in register mode prevents browser from
                //         suggesting saved passwords; "current-password" in sign-in mode
                autoComplete={isRegisterMode ? "new-password" : "current-password"}
                required
              />

              <button type="submit" className="create-btn" disabled={loading}>
                {loading ? "Please wait..." : isRegisterMode ? "Sign Up" : "Sign In"}
              </button>
            </form>

            <div className="small-row">
              <span>{isRegisterMode ? "Already have an account?" : "Don't have an account?"}</span>
              <button className="toggle-link" onClick={toggleMode}>
                {isRegisterMode ? " Sign In" : " Sign Up"}
              </button>
            </div>

            {message && (
              <div className={`msg ${messageType === "success" ? "success" : "error"}`} role="status">
                {message}
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="teacher-footer">
        <div className="social-links">
          <img src="/css/instagram.png" alt="ig" />
          <img src="/css/linkedin.png" alt="in" />
          <img src="/css/telegram.png" alt="tg" />
        </div>
        <div className="copyright">© 2024 ClassVibe. Connecting classrooms worldwide.</div>
      </footer>
    </div>
  );
}