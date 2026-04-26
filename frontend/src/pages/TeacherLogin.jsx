// frontend/src/pages/TeacherLogin.jsx
import React, { useState } from "react";
import "./TeacherLogin.css";
import { register, login } from "../api"; // ✅ CHANGED: removed createGroup — no auto-classroom
import socket from "../socket";

export default function TeacherLogin({ onAuthSuccess, onBack }) {
  // ✅ REMOVED: name state — was only used to create classroom name
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("error");
  const [isRegisterMode, setIsRegisterMode] = useState(true);

  const isValidEmail = (value) => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(value).toLowerCase());
  };

  const parseJwt = (token) => {
    try {
      const payload = token.split(".")[1];
      const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
      const json = decodeURIComponent(
        atob(base64)
          .split("")
          .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
          .join("")
      );
      return JSON.parse(json);
    } catch (e) {
      return null;
    }
  };

  const extractAuth = (resp) => {
    if (!resp) return {};
    const maybe = resp.data ?? resp;
    const token = maybe.token ?? maybe.accessToken ?? null;
    const user = maybe.user ?? maybe;
    return { token, user };
  };

  // ✅ Identical to original — socket connect logic unchanged
  const finishAuth = async (userObj, token) => {
    if (token) localStorage.setItem("token", token);
    if (userObj) localStorage.setItem("user", JSON.stringify(userObj));
    if (!userObj && token) {
      const parsed = parseJwt(token);
      if (parsed) {
        const derived = {
          id: parsed.userId ?? parsed.sub,
          email: parsed.email ?? email,
          role: parsed.role ?? "teacher"
        };
        localStorage.setItem("user", JSON.stringify(derived));
        userObj = derived;
      }
    }
    try {
      socket.connect();
      if (token) socket.emit("authenticate", token);
    } catch (e) {
      console.warn("Socket connect/emit issue:", e?.message ?? e);
    }
  };

  // ✅ Identical to original
  const waitForSocketAuth = (timeoutMs = 3000) =>
    new Promise((resolve) => {
      let resolved = false;
      const onAuth = () => {
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve({ ok: true });
      };
      const onError = (data) => {
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve({ ok: false, data });
      };
      const cleanup = () => {
        socket.off("authenticated", onAuth);
        socket.off("authError", onError);
      };
      socket.once("authenticated", onAuth);
      socket.once("authError", onError);
      setTimeout(() => {
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve({ ok: true, timeout: true });
      }, timeoutMs);
    });

  const handleSubmit = async (e) => {
    e && e.preventDefault();
    setMessage("");
    setMessageType("error");

    // --- REGISTER ---
    if (isRegisterMode) {
      if (!email.trim()) { setMessage("Enter email id"); return; }
      if (!isValidEmail(email.trim())) { setMessage("Invalid email id"); return; }
      if (!password.trim() || password.length < 6) {
        setMessage("Password must be at least 6 characters");
        return;
      }
      setLoading(true);
      try {
        await register(email.trim(), password, email.split('@')[0], 'teacher');
        setMessageType("success");
        setMessage("Account created. Please sign in.");
        setIsRegisterMode(false);
      } catch (err) {
        console.error("Register error:", err);
        const serverMsg = err?.response?.data?.error || err?.response?.data?.message || err?.message || "Registration failed";
        setMessage(serverMsg);
        setMessageType("error");
      } finally {
        setLoading(false);
      }
      return;
    }

    // --- SIGN IN ---
    // ✅ CHANGED: Removed name requirement, removed createGroup call
    if (!email.trim() || !password.trim()) {
      setMessage("Please fill Email and Password.");
      return;
    }
    if (!isValidEmail(email.trim())) {
      setMessage("Invalid email id");
      return;
    }

    setLoading(true);
    try {
      const loginResp = await login(email.trim(), password);
      let { token, user } = extractAuth(loginResp);

      if (!token) throw new Error("Authentication failed (no token).");

      await finishAuth(user, token);
      await waitForSocketAuth(3000);

      // ✅ CHANGED: No createGroup here — teacher goes straight to dashboard
      setMessageType("success");
      setMessage("Signed in! Loading dashboard...");

      setTimeout(() => {
        const savedUser = JSON.parse(localStorage.getItem("user") || "null");
        onAuthSuccess && onAuthSuccess(savedUser ?? user, token);
      }, 400);

    } catch (err) {
      console.error("Sign-in error:", err);
      const errMsg = err?.response?.data?.error || err?.response?.data?.message || err?.message || "Failed to sign in";
      setMessage(errMsg);
      setMessageType("error");
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsRegisterMode((s) => !s);
    setMessage("");
    setMessageType("error");
  };

  return (
    <div className="teacher-page">
      <header className="teacher-header">
        <h2>
          ClassVibe <span className="owner">- sai</span>
        </h2>
        <div className="header-actions">
          <button className="link-btn" onClick={() => onBack && onBack()}>
            Back to Home
          </button>
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

            <form onSubmit={handleSubmit}>
              {/* ✅ REMOVED: Teacher Name field — no longer needed since we don't auto-create classroom */}

              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="teacher@school.edu"
                required
              />

              <label>Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={isRegisterMode ? "Choose a password" : "Your password"}
                required
              />

              {/* ✅ CHANGED: Button no longer says "Sign In & Create Classroom" */}
              <button type="submit" className="create-btn" disabled={loading}>
                {loading
                  ? "Please wait..."
                  : isRegisterMode
                  ? "Sign Up"
                  : "Sign In"}
              </button>
            </form>

            <div className="small-row">
              <span>{isRegisterMode ? "Already have an account?" : "Don't have an account?"}</span>
              <button className="toggle-link" onClick={toggleMode}>
                {isRegisterMode ? " Sign In" : " Sign Up"}
              </button>
            </div>

            {message && (
              <div
                className={`msg ${messageType === "success" ? "success" : "error"}`}
                role="status"
              >
                {message}
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="teacher-footer">
        {/* ✅ Fixed broken image paths from original */}
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