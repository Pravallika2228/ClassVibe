// frontend/src/components/ScheduleSession.jsx
// Teacher creates a scheduled session

import React, { useState, useEffect } from 'react';
import ManageStudents from './ManageStudents';

const ScheduleSession = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    sessionName: '',
    subject: '',
    description: '',
    scheduledDate: '',
    scheduledTime: '',
    duration: 60,
    maxStudents: 100
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdSession, setCreatedSession] = useState(null);
  const [showManageStudents, setShowManageStudents] = useState(false);
  
  // ⭐ Email suggestions from previous sessions
  const [suggestedEmails, setSuggestedEmails] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Load suggested emails from previous sessions
  useEffect(() => {
    fetchSuggestedEmails();
  }, []);

  const fetchSuggestedEmails = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/schedule/my-sessions?status=all`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Extract unique emails from all previous sessions
        const allEmails = new Set();
        data.sessions.forEach(session => {
          if (session.allowedEmails) {
            session.allowedEmails.forEach(email => allEmails.add(email));
          }
        });
        setSuggestedEmails(Array.from(allEmails));
      }
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Validation
    if (!formData.sessionName || !formData.subject || !formData.scheduledDate || !formData.scheduledTime) {
      setError('Please fill all required fields');
      return;
    }

    // Check if date is in future
    const selectedDateTime = new Date(`${formData.scheduledDate}T${formData.scheduledTime}`);
    if (selectedDateTime <= new Date()) {
      setError('Scheduled time must be in the future');
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/schedule/create`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(formData)
        }
      );

      const data = await response.json();

      if (response.ok) {
        setCreatedSession(data.session);
        alert('Session scheduled successfully!');
        if (onSuccess) onSuccess(data.session);
      } else {
        setError(data.error || 'Failed to schedule session');
      }
    } catch (error) {
      console.error('Schedule error:', error);
      setError('Failed to schedule session');
    } finally {
      setLoading(false);
    }
  };

  // If session created, show option to manage students
  if (createdSession && !showManageStudents) {
    return (
      <div style={styles.overlay}>
        <div style={styles.successModal}>
          <h2 style={styles.successTitle}>✅ Session Scheduled!</h2>
          <div style={styles.sessionDetails}>
            <p><strong>{createdSession.sessionName}</strong></p>
            <p>{createdSession.subject}</p>
            <p>📅 {new Date(createdSession.scheduledDate).toLocaleDateString()}</p>
            <p>🕒 {createdSession.scheduledTime}</p>
          </div>
          <div style={styles.buttonGroup}>
            <button
              onClick={() => setShowManageStudents(true)}
              style={styles.manageBtn}
            >
              Manage Allowed Students
            </button>
            <button
              onClick={onClose}
              style={styles.doneBtn}
            >
              Done
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showManageStudents) {
    return (
      <ManageStudents
        session={createdSession}
        onUpdate={(emails) => {
          setCreatedSession({
            ...createdSession,
            allowedEmails: emails
          });
        }}
        onClose={onClose}
      />
    );
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.header}>
          <h2 style={styles.title}>📅 Schedule New Session</h2>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          {error && <div style={styles.error}>{error}</div>}

          <div style={styles.formGroup}>
            <label style={styles.label}>Session Name *</label>
            <input
              type="text"
              name="sessionName"
              value={formData.sessionName}
              onChange={handleChange}
              placeholder="e.g., Math Class - Algebra"
              style={styles.input}
              required
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Subject *</label>
            <input
              type="text"
              name="subject"
              value={formData.subject}
              onChange={handleChange}
              placeholder="e.g., Mathematics, Science"
              style={styles.input}
              required
            />
          </div>

          <div style={styles.formGroup}>
            <label style={styles.label}>Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Optional: Add session details"
              style={{ ...styles.input, minHeight: '80px', resize: 'vertical' }}
            />
          </div>

          <div style={styles.row}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Date *</label>
              <input
                type="date"
                name="scheduledDate"
                value={formData.scheduledDate}
                onChange={handleChange}
                min={new Date().toISOString().split('T')[0]}
                style={styles.input}
                required
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Time *</label>
              <input
                type="time"
                name="scheduledTime"
                value={formData.scheduledTime}
                onChange={handleChange}
                style={styles.input}
                required
              />
            </div>
          </div>

          <div style={styles.row}>
            <div style={styles.formGroup}>
              <label style={styles.label}>Duration (minutes)</label>
              <input
                type="number"
                name="duration"
                value={formData.duration}
                onChange={handleChange}
                min="15"
                max="480"
                style={styles.input}
              />
            </div>

            <div style={styles.formGroup}>
              <label style={styles.label}>Max Students</label>
              <input
                type="number"
                name="maxStudents"
                value={formData.maxStudents}
                onChange={handleChange}
                min="1"
                max="500"
                style={styles.input}
              />
            </div>
          </div>

          {/* ⭐ Email Suggestions */}
          {suggestedEmails.length > 0 && (
            <div style={styles.suggestionsBox}>
              <button
                type="button"
                onClick={() => setShowSuggestions(!showSuggestions)}
                style={styles.suggestionsToggle}
              >
                💡 Use emails from previous sessions ({suggestedEmails.length})
              </button>
              {showSuggestions && (
                <div style={styles.suggestionsList}>
                  {suggestedEmails.map((email, index) => (
                    <div key={index} style={styles.suggestionItem}>
                      {email}
                    </div>
                  ))}
                  <p style={styles.suggestionNote}>
                    You can add these students after creating the session
                  </p>
                </div>
              )}
            </div>
          )}

          <div style={styles.footer}>
            <button
              type="button"
              onClick={onClose}
              style={styles.cancelBtn}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              style={styles.submitBtn}
            >
              {loading ? 'Scheduling...' : 'Schedule Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '12px',
    width: '90%',
    maxWidth: '600px',
    maxHeight: '90vh',
    overflowY: 'auto',
    boxShadow: '0 8px 32px rgba(0,0,0,0.3)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px',
    borderBottom: '1px solid #e0e0e0',
    backgroundColor: '#075E54'
  },
  title: {
    margin: 0,
    fontSize: '20px',
    fontWeight: '600',
    color: 'white'
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '24px',
    cursor: 'pointer',
    color: 'white'
  },
  form: {
    padding: '20px'
  },
  error: {
    padding: '12px',
    backgroundColor: '#fee',
    color: '#c33',
    borderRadius: '6px',
    marginBottom: '15px',
    fontSize: '14px'
  },
  formGroup: {
    marginBottom: '15px',
    flex: 1
  },
  label: {
    display: 'block',
    marginBottom: '6px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#333'
  },
  input: {
    width: '100%',
    padding: '10px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    outline: 'none',
    fontFamily: 'inherit'
  },
  row: {
    display: 'flex',
    gap: '15px'
  },
  suggestionsBox: {
    marginTop: '15px',
    padding: '12px',
    backgroundColor: '#D7F0DD',
    borderRadius: '8px'
  },
  suggestionsToggle: {
    background: 'none',
    border: 'none',
    color: '#075E54',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    textAlign: 'left',
    width: '100%'
  },
  suggestionsList: {
    marginTop: '10px',
    maxHeight: '150px',
    overflowY: 'auto'
  },
  suggestionItem: {
    padding: '8px',
    fontSize: '13px',
    backgroundColor: 'white',
    borderRadius: '4px',
    marginBottom: '4px',
    color: '#333'
  },
  suggestionNote: {
    fontSize: '12px',
    color: '#666',
    fontStyle: 'italic',
    marginTop: '8px'
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '10px',
    marginTop: '20px',
    paddingTop: '15px',
    borderTop: '1px solid #e0e0e0'
  },
  cancelBtn: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: '600',
    backgroundColor: '#f0f0f0',
    color: '#333',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer'
  },
  submitBtn: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: '600',
    backgroundColor: '#25D366',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer'
  },
  successModal: {
    backgroundColor: 'white',
    borderRadius: '12px',
    padding: '30px',
    maxWidth: '400px',
    textAlign: 'center'
  },
  successTitle: {
    color: '#25D366',
    marginBottom: '20px'
  },
  sessionDetails: {
    backgroundColor: '#f8f9fa',
    padding: '15px',
    borderRadius: '8px',
    marginBottom: '20px',
    textAlign: 'left'
  },
  buttonGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  manageBtn: {
    padding: '12px',
    fontSize: '14px',
    fontWeight: '600',
    backgroundColor: '#075E54',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer'
  },
  doneBtn: {
    padding: '12px',
    fontSize: '14px',
    fontWeight: '600',
    backgroundColor: '#25D366',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer'
  }
};

export default ScheduleSession;