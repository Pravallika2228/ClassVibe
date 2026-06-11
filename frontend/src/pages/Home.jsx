import React, { useState,useEffect } from "react";
import "./Home.css";
import teacherImg from "../assets/teacher.png";
import studentImg from "../assets/student.png";
import Footer from "../pages/Footer";

export default function Home({ onTeacher, onStudent }) {
  const [darkMode, setDarkMode] = useState(
    localStorage.getItem("theme") === "dark"
  );
  useEffect(() => {
    localStorage.setItem(
      "theme",
      darkMode ? "dark" : "light"
    );
  }, [darkMode]);
  return (
    <div className={`home ${darkMode ? "dark-mode" : ""}`}>
      <header>
        <div className="header-container">
          <h2>ClassVibe</h2>
          <nav>
            <a href="#features">Features</a>
            <a href="#how-it-works">How it works</a>
            <a href="#roles">Roles</a>
            <a href="#faq">FAQ</a>

            <span
              className="theme-toggle"
              onClick={() => setDarkMode(!darkMode)}
              >
              {darkMode ? "☀️" : "🌙"}
            </span>
          </nav>
        </div>
      </header>

      <main>
        <div className="home-inner">
          <h1>
            Welcome to <span id="name">ClassVibe</span>
          </h1>
          <p className="sub1">
            Interactive classroom engagement made simple. Connect with <br />
            your students in real-time and create an engaging learning environment.
          </p>
          <div className="hero">
            <div className="hero-text">
              <h2>
                Bridging the Gap Between
                <span className="blue"> Teaching</span> and 
                <span className="pink"> Learning.</span>
              </h2>
              <p>
                Interactive classroom engagement made simple. Connect with your students
                in real-time and create an engaging learning environment that students love.
              </p>
            </div>
            <div className="hero-image">
              <img src="/css/demo.png" alt="demo" />
            </div>
          </div> 
          <section id ="features" className="features-section">
            <h2 className="section-title">Features</h2>
            <div className="subtitle">
              <h2>Powerful Tools for <span>Modern Education</span></h2>
              <p >
                We’ve built ClassConnect from the ground up to solve the challenges of real-time digital interaction
              </p>
            </div>

            <div className="feature-row">
              <div className="col-1">
                <div className="feature-card">
                  <img src="/css/instant.png" alt="qr code" className="big-icon"/>
                  <h3>Instant Access</h3>
                  <p>
                    Students join sessions instantly with QR codes or PIN numbers.
                    No accounts needed.
                  </p>
                </div>
              </div>
              <div className="col-1">
                <div className="feature-card">
                  <img src="/css/real.png" alt="chat" className="big-icon"/>
                  <h3>Real-time Chat</h3>
                  <p>Engage students with live messaging, polls, and interactive activities.</p>
                </div>
              </div>
              <div className="col-1">
                <div className="feature-card">
                  <img src="/css/class.png" alt="Management" className="big-icon"/>
                  <h3>Classroom Management</h3>
                  <p>Manage sessions, moderate content, and track participation effortlessly.</p>
                </div>
              </div>
            </div>
          </section>
          <section id ="how-it-works" className="how-it-works">
            <h2 className="section-title">HOW IT WORKS</h2>
            <h2 className="section-title1">From zero to <span>engaged <br/>classroom</span> in 30 seconds.</h2>
            <div className="steps-row">
              <div className="col-3">
                <h3>01</h3>
                <h4>Create a session</h4>
                <p>Teachers spin up a live room in one click.
                  Add polls, slides, or just go.
                </p>
              </div>
              <div className="col-3">
                <h3>02</h3>
                <h4>Students join instantly</h4>
                <p>
                  Scan the QR or enter the PIN.
                  They're in — on any device, no installs.
                </p>
              </div>
              <div className="col-3">
                <h3>03</h3>
                <h4>Engage in real-time</h4>
                <p>
                  Chat, vote, react.
                  Watch the room come alive with live analytics.
                </p>
              </div>
            </div>
          </section>
          <section id="roles" className="roles-section">
            <h2 className="section-title">PICK YOUR SIDE</h2>
            <h2 className="mid">Two roles.<span className="one-vibe"> One vibe.</span> </h2>
            <p className="sub2">Are you a teacher starting a session or a student joining one?</p>
            <div className="role-row">
              <div className="col-2">
                <div className="role-card"
                  style={{ backgroundImage: `url(${teacherImg})` }}>
                  <div className="overlay"></div>
                  <img src="/css/user.png" alt="Teacher" className="icon-top" />
                  <h2>Teacher</h2>
                  <p>Create a virtual classroom, prepare interactive polls, and lead your students in real-time engagement.</p>
                  <button className="btn" onClick={onTeacher}>Start as Teacher</button>
                </div>
              </div>
              <div className="col-2">
                <div className="role-card"
                  style={{ backgroundImage: `url(${studentImg})` }}>
                  <div className="overlay"></div>
                  <img src="/css/qr.png" alt="student" className="icon-top" />
                  <h2>Student</h2>
                  <p>Enter a session PIN or scan a QR code to instantly join your teacher's live interactive classroom.</p>
                  <button className="btn-1" onClick={onStudent}>Join as Student</button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}