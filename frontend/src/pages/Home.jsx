import React from "react";
import "./Home.css";
import teacherImg from "../assets/teacher.png";
import studentImg from "../assets/student.png";

export default function Home({ onTeacher, onStudent }) {
  return (
    <div className="home">
      <header>
        <h2>ClassVibe</h2>
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
                Bridging the Gap Between <br />
                <span className="blue">Teaching</span> and <br />
                <span className="pink">Learning.</span>
              </h2>
              <p>
                Interactive classroom engagement made simple. Connect with<br /> your students
                in real-time and create an engaging learning<br /> environment that students love.
              </p>
            </div>
            <div className="hero-image">
              <img src="/css/demo.png" alt="demo" />
            </div>
          </div> 

          <div className="subtitle">
            <h2>Powerful Tools for Modern Education</h2>
              <p >
                We’ve built ClassConnect from the ground up to solve the challenges of real-time digital interaction
              </p>
          </div>

          <div className="feature-row">
            <div className="col-1">
              <div className="feature-card">
                <img
                  src="/css/instant.png"
                  alt="qr code"
                  className="big-icon"
                />
                <h3>Instant Access</h3>
                <p>
                  Students join sessions instantly with QR codes or PIN numbers.
                  No accounts needed.
                </p>
              </div>
            </div>

            <div className="col-1">
              <div className="feature-card">
                <img
                  src="/css/real.png"
                  alt="chat"
                  className="big-icon"
                />
                <h3>Real-time Chat</h3>
                <p>Engage students with live messaging, polls, and interactive activities.</p>
              </div>
            </div>

            <div className="col-1">
              <div className="feature-card">
                <img
                  src="/css/class.png"
                  alt="Management"
                  className="big-icon"
                />
                <h3>Classroom Management</h3>
                <p>Manage sessions, moderate content, and track participation effortlessly.</p>
              </div>
            </div>
          </div>

          <h2 className="mid">Choose Your Role</h2>
          <p className="sub2">Are you a teacher starting a session or a student joining one?</p>

          <div className="role-row">
            <div className="col-2">
              <div
                  className="role-card"
                  style={{ backgroundImage: `url(${teacherImg})` }}
                >
                <div className="overlay"></div>

                <img src="/css/user.png" alt="Teacher" className="icon-top" />

                <h2>Teacher</h2>
                <p>Create a virtual classroom, prepare interactive polls, and lead your students in real-time engagement.</p>

                <button className="btn" onClick={onTeacher}>Start as Teacher</button>
              </div>
            </div>

            <div className="col-2">
              <div
                  className="role-card"
                  style={{ backgroundImage: `url(${studentImg})` }}
                >
                <div className="overlay"></div>

                <img src="/css/qr.png" alt="student" className="icon-top" />

                <h2>Student</h2>
                <p>Enter a session PIN or scan a QR code to instantly join your teacher's live interactive classroom.</p>

                <button className="btn-1" onClick={onStudent}>Join as Student</button>
              </div>
            </div>
            
          </div>
        </div>
      </main>

      <footer>
        <div className="social-links">
          <ul>
            <li><img src="/css/instagram.png" alt="instagram" /></li>
            <li><img src="/css/linkedin.png" alt="linkedin" /></li>
            <li><img src="/css/telegram.png" alt="telegram" /></li>
          </ul>
        </div>
        © ClassVibe. Connecting classrooms worldwide.
      </footer>
    </div>
  );
}
