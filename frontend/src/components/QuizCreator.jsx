// frontend/src/components/QuizCreator.jsx
// Teacher creates quiz using AI

import React, { useState } from 'react';

const QuizCreator = ({ groupId, onClose, onSuccess }) => {
  const [step, setStep] = useState(1); // 1=input, 2=review, 3=settings
  const [topic, setTopic] = useState('');
  const [questionCount, setQuestionCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedQuiz, setGeneratedQuiz] = useState(null);
  
  // Quiz settings
  const [settings, setSettings] = useState({
    showCorrectAnswer: true,
    showLeaderboard: true,
    allowLateJoin: true,
    shuffleQuestions: false,
    shuffleOptions: true
  });

  // Generate quiz with AI
  const handleGenerate = async () => {
    if (!topic.trim()) {
      setError('Please enter a topic');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/quiz/generate`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            topic,
            questionCount,
            groupId
          })
        }
      );

      const data = await response.json();

      if (response.ok) {
        setGeneratedQuiz(data.quiz);
        setStep(2);
      } else {
        setError(data.error || 'Failed to generate quiz');
      }
    } catch (error) {
      console.error('Generate error:', error);
      setError('Failed to generate quiz. Check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  // Edit question
  const handleEditQuestion = (index, field, value) => {
    const updatedQuiz = { ...generatedQuiz };
    updatedQuiz.questions[index][field] = value;
    setGeneratedQuiz(updatedQuiz);
  };

  // Edit option
  const handleEditOption = (qIndex, oIndex, value) => {
    const updatedQuiz = { ...generatedQuiz };
    updatedQuiz.questions[qIndex].options[oIndex] = value;
    setGeneratedQuiz(updatedQuiz);
  };

  // Save and finalize quiz
  const handleSaveQuiz = async () => {
    setLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/quiz/${generatedQuiz._id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            questions: generatedQuiz.questions,
            settings,
            status: 'ready'
          })
        }
      );

      const data = await response.json();

      if (response.ok) {
        alert('✅ Quiz saved successfully!');
        if (onSuccess) onSuccess(data.quiz);
        onClose();
      } else {
        setError(data.error || 'Failed to save quiz');
      }
    } catch (error) {
      console.error('Save error:', error);
      setError('Failed to save quiz');
    } finally {
      setLoading(false);
    }
  };

  // Start quiz immediately
  const handleStartQuiz = async () => {
    setLoading(true);
    
    try {
      // First save the quiz
      const token = localStorage.getItem('token');
      await fetch(
        `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/quiz/${generatedQuiz._id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            questions: generatedQuiz.questions,
            settings,
            status: 'ready'
          })
        }
      );

      // Then start the session
      const startResponse = await fetch(
        `${process.env.REACT_APP_API_URL || 'http://localhost:5000'}/api/quiz/${generatedQuiz._id}/start`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }
      );

      const startData = await startResponse.json();

      if (startResponse.ok) {
        alert('✅ Quiz started! Students can now join.');
        if (onSuccess) onSuccess(startData.session);
        onClose();
      } else {
        setError(startData.error || 'Failed to start quiz');
      }
    } catch (error) {
      console.error('Start error:', error);
      setError('Failed to start quiz');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>
            {step === 1 && '🤖 Create AI Quiz'}
            {step === 2 && '📝 Review Questions'}
            {step === 3 && '⚙️ Quiz Settings'}
          </h2>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        {/* Content */}
        <div style={styles.content}>
          {error && <div style={styles.error}>{error}</div>}

          {/* STEP 1: Input Topic */}
          {step === 1 && (
            <div style={styles.step1}>
              <div style={styles.aiIcon}>🤖</div>
              <h3 style={styles.stepTitle}>Let AI Generate Your Quiz!</h3>
              <p style={styles.stepSubtitle}>
                Enter any topic and AI will create quiz questions in seconds
              </p>

              <div style={styles.formGroup}>
                <label style={styles.label}>Topic *</label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="e.g., Photosynthesis, World War 2, JavaScript..."
                  style={styles.input}
                  autoFocus
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Number of Questions</label>
                <select
                  value={questionCount}
                  onChange={(e) => setQuestionCount(Number(e.target.value))}
                  style={styles.select}
                >
                  <option value={5}>5 questions</option>
                  <option value={10}>10 questions</option>
                  <option value={15}>15 questions</option>
                  <option value={20}>20 questions</option>
                </select>
              </div>

              <button
                onClick={handleGenerate}
                disabled={loading || !topic.trim()}
                style={{
                  ...styles.generateBtn,
                  opacity: loading || !topic.trim() ? 0.5 : 1
                }}
              >
                {loading ? '🤖 Generating Quiz...' : '🚀 Generate Quiz with AI'}
              </button>

              <div style={styles.note}>
                <strong>💡 Tip:</strong> Be specific! "Photosynthesis in plants" is better than just "biology"
              </div>
            </div>
          )}

          {/* STEP 2: Review Questions */}
          {step === 2 && generatedQuiz && (
            <div style={styles.step2}>
              <div style={styles.quizInfo}>
                <h3 style={styles.quizTitle}>{generatedQuiz.title}</h3>
                <p style={styles.quizMeta}>
                  {generatedQuiz.questions.length} questions • {generatedQuiz.getTotalPoints()} total points
                </p>
              </div>

              <div style={styles.questionsList}>
                {generatedQuiz.questions.map((q, qIndex) => (
                  <div key={qIndex} style={styles.questionCard}>
                    <div style={styles.questionHeader}>
                      <span style={styles.questionNumber}>Q{qIndex + 1}</span>
                      <input
                        type="text"
                        value={q.questionText}
                        onChange={(e) => handleEditQuestion(qIndex, 'questionText', e.target.value)}
                        style={styles.questionInput}
                      />
                    </div>

                    <div style={styles.optionsList}>
                      {q.options.map((option, oIndex) => (
                        <div key={oIndex} style={styles.optionRow}>
                          <span style={{
                            ...styles.optionLabel,
                            backgroundColor: oIndex === q.correctAnswer ? '#D7F0DD' : '#f5f5f5',
                            color: oIndex === q.correctAnswer ? '#075E54' : '#333'
                          }}>
                            {String.fromCharCode(65 + oIndex)}
                            {oIndex === q.correctAnswer && ' ✓'}
                          </span>
                          <input
                            type="text"
                            value={option}
                            onChange={(e) => handleEditOption(qIndex, oIndex, e.target.value)}
                            style={styles.optionInput}
                          />
                        </div>
                      ))}
                    </div>

                    <div style={styles.questionFooter}>
                      <span style={styles.pointsLabel}>{q.points} points</span>
                      <span style={styles.timeLabel}>⏱️ {q.timeLimit}s</span>
                    </div>
                  </div>
                ))}
              </div>

              <div style={styles.actions}>
                <button onClick={() => setStep(1)} style={styles.backBtn}>
                  ← Back
                </button>
                <button onClick={() => setStep(3)} style={styles.nextBtn}>
                  Next: Settings →
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Settings */}
          {step === 3 && (
            <div style={styles.step3}>
              <h3 style={styles.settingsTitle}>Quiz Settings</h3>

              <div style={styles.settingsList}>
                <div style={styles.settingItem}>
                  <label style={styles.settingLabel}>
                    <input
                      type="checkbox"
                      checked={settings.showCorrectAnswer}
                      onChange={(e) => setSettings({ ...settings, showCorrectAnswer: e.target.checked })}
                      style={styles.checkbox}
                    />
                    Show correct answer after each question
                  </label>
                </div>

                <div style={styles.settingItem}>
                  <label style={styles.settingLabel}>
                    <input
                      type="checkbox"
                      checked={settings.showLeaderboard}
                      onChange={(e) => setSettings({ ...settings, showLeaderboard: e.target.checked })}
                      style={styles.checkbox}
                    />
                    Show leaderboard after each question
                  </label>
                </div>

                <div style={styles.settingItem}>
                  <label style={styles.settingLabel}>
                    <input
                      type="checkbox"
                      checked={settings.allowLateJoin}
                      onChange={(e) => setSettings({ ...settings, allowLateJoin: e.target.checked })}
                      style={styles.checkbox}
                    />
                    Allow students to join after quiz starts
                  </label>
                </div>

                <div style={styles.settingItem}>
                  <label style={styles.settingLabel}>
                    <input
                      type="checkbox"
                      checked={settings.shuffleOptions}
                      onChange={(e) => setSettings({ ...settings, shuffleOptions: e.target.checked })}
                      style={styles.checkbox}
                    />
                    Shuffle answer options (prevent cheating)
                  </label>
                </div>
              </div>

              <div style={styles.finalActions}>
                <button onClick={() => setStep(2)} style={styles.backBtn}>
                  ← Back
                </button>
                <div style={styles.rightActions}>
                  <button 
                    onClick={handleSaveQuiz} 
                    disabled={loading}
                    style={styles.saveBtn}
                  >
                    {loading ? 'Saving...' : 'Save for Later'}
                  </button>
                  <button 
                    onClick={handleStartQuiz} 
                    disabled={loading}
                    style={styles.startBtn}
                  >
                    {loading ? 'Starting...' : '🚀 Start Quiz Now'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
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
    maxWidth: '800px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
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
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '30px'
  },
  error: {
    padding: '12px',
    backgroundColor: '#fee',
    color: '#c33',
    borderRadius: '8px',
    marginBottom: '20px',
    fontSize: '14px'
  },
  // Step 1 styles
  step1: {
    textAlign: 'center'
  },
  aiIcon: {
    fontSize: '64px',
    marginBottom: '20px'
  },
  stepTitle: {
    fontSize: '24px',
    fontWeight: '600',
    marginBottom: '10px',
    color: '#075E54'
  },
  stepSubtitle: {
    fontSize: '14px',
    color: '#666',
    marginBottom: '30px'
  },
  formGroup: {
    marginBottom: '20px',
    textAlign: 'left'
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#333'
  },
  input: {
    width: '100%',
    padding: '12px',
    fontSize: '16px',
    border: '2px solid #ddd',
    borderRadius: '8px',
    outline: 'none'
  },
  select: {
    width: '100%',
    padding: '12px',
    fontSize: '14px',
    border: '2px solid #ddd',
    borderRadius: '8px',
    outline: 'none'
  },
  generateBtn: {
    width: '100%',
    padding: '16px',
    fontSize: '16px',
    fontWeight: '600',
    backgroundColor: '#25D366',
    color: 'white',
    border: 'none',
    borderRadius: '10px',
    cursor: 'pointer',
    marginTop: '20px',
    marginBottom: '20px',
    transition: 'all 0.2s'
  },
  note: {
    padding: '12px',
    backgroundColor: '#D7F0DD',
    borderRadius: '8px',
    fontSize: '13px',
    color: '#075E54',
    textAlign: 'left'
  },
  // Step 2 styles
  step2: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  quizInfo: {
    padding: '15px',
    backgroundColor: '#D7F0DD',
    borderRadius: '8px'
  },
  quizTitle: {
    margin: '0 0 5px 0',
    fontSize: '18px',
    fontWeight: '600',
    color: '#075E54'
  },
  quizMeta: {
    margin: 0,
    fontSize: '13px',
    color: '#128C7E'
  },
  questionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
    maxHeight: '400px',
    overflowY: 'auto'
  },
  questionCard: {
    padding: '15px',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    backgroundColor: '#f8f9fa'
  },
  questionHeader: {
    display: 'flex',
    gap: '10px',
    marginBottom: '15px'
  },
  questionNumber: {
    padding: '6px 12px',
    backgroundColor: '#075E54',
    color: 'white',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    flexShrink: 0
  },
  questionInput: {
    flex: 1,
    padding: '8px',
    fontSize: '14px',
    border: '1px solid #ddd',
    borderRadius: '6px',
    fontWeight: '500'
  },
  optionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  optionRow: {
    display: 'flex',
    gap: '10px',
    alignItems: 'center'
  },
  optionLabel: {
    padding: '6px 12px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '600',
    flexShrink: 0
  },
  optionInput: {
    flex: 1,
    padding: '8px',
    fontSize: '13px',
    border: '1px solid #ddd',
    borderRadius: '6px'
  },
  questionFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    marginTop: '10px',
    fontSize: '12px',
    color: '#666'
  },
  pointsLabel: {
    fontWeight: '600'
  },
  timeLabel: {},
  actions: {
    display: 'flex',
    justifyContent: 'space-between',
    paddingTop: '20px',
    borderTop: '1px solid #e0e0e0'
  },
  backBtn: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: '600',
    backgroundColor: '#f0f0f0',
    color: '#333',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer'
  },
  nextBtn: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: '600',
    backgroundColor: '#25D366',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer'
  },
  // Step 3 styles
  step3: {},
  settingsTitle: {
    fontSize: '18px',
    fontWeight: '600',
    marginBottom: '20px',
    color: '#075E54'
  },
  settingsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
    marginBottom: '30px'
  },
  settingItem: {
    padding: '15px',
    backgroundColor: '#f8f9fa',
    borderRadius: '8px',
    border: '1px solid #e0e0e0'
  },
  settingLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    fontSize: '14px',
    cursor: 'pointer',
    userSelect: 'none'
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer'
  },
  finalActions: {
    display: 'flex',
    justifyContent: 'space-between',
    paddingTop: '20px',
    borderTop: '1px solid #e0e0e0'
  },
  rightActions: {
    display: 'flex',
    gap: '10px'
  },
  saveBtn: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: '600',
    backgroundColor: '#128C7E',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer'
  },
  startBtn: {
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: '600',
    backgroundColor: '#25D366',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer'
  }
};

export default QuizCreator;