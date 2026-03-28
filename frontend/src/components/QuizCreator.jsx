// frontend/src/components/QuizCreator.jsx
// Enhanced Quiz Creator - Matches Professional UI Design

import React, { useState, useEffect } from 'react';

const QuizCreator = ({ groupId, onClose, onSuccess }) => {
  // Navigation steps
  const [currentStep, setCurrentStep] = useState('essentials'); // essentials, questions, settings, assign
  
  // Step 1: Essentials
  const [inputMethod, setInputMethod] = useState('topic'); // topic, file, paste
  const [topic, setTopic] = useState('');
  const [pastedContent, setPastedContent] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [questionCount, setQuestionCount] = useState(10);
  const [difficulty, setDifficulty] = useState('medium');
  const [recentTopics, setRecentTopics] = useState([]);
  
  // Step 2: Questions
  const [questions, setQuestions] = useState([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  
  // Step 3: Settings
  const [settings, setSettings] = useState({
    showCorrectAnswer: true,
    showLeaderboard: true,
    allowLateJoin: true,
    shuffleQuestions: false,
    shuffleOptions: true
  });
  
  // UI State
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [generatedQuizId, setGeneratedQuizId] = useState(null);

  // Load recent topics on mount
  useEffect(() => {
    fetchRecentTopics();
  }, []);

  const fetchRecentTopics = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.REACT_APP_API_URL || 'https://classvibe-backend.onrender.com'}/api/quiz/recent-topics`,
        {
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        setRecentTopics(data.topics || []);
      }
    } catch (error) {
      console.error('Failed to load recent topics:', error);
    }
  };

  // Generate quiz
  const handleGenerate = async () => {
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');

      if (inputMethod === 'file' && selectedFile) {
        // Generate from file
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('questionCount', questionCount);
        formData.append('groupId', groupId);
        formData.append('difficulty', difficulty);

        const response = await fetch(
          `${process.env.REACT_APP_API_URL || 'https://classvibe-backend.onrender.com'}/api/quiz/generate-from-file`,
          {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}` },
            body: formData
          }
        );

        const data = await response.json();

        if (response.ok) {
          setQuestions(data.quiz.questions);
          setGeneratedQuizId(data.quiz._id);
          setCurrentStep('questions');
        } else {
          setError(data.error || 'Failed to generate quiz');
        }
      } else {
        // Generate from topic or pasted content
        const contentToUse = inputMethod === 'paste' ? pastedContent : topic;
        
        if (!contentToUse.trim()) {
          setError('Please enter a topic or paste content');
          return;
        }

        const response = await fetch(
          `${process.env.REACT_APP_API_URL || 'https://classvibe-backend.onrender.com'}/api/quiz/generate`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              topic: contentToUse,
              questionCount,
              groupId,
              difficulty
            })
          }
        );

        const data = await response.json();

        if (response.ok) {
          setQuestions(data.quiz.questions);
          setGeneratedQuizId(data.quiz._id);
          setCurrentStep('questions');
        } else {
          setError(data.error || data.details || 'Failed to generate quiz');
        }
      }
    } catch (error) {
      console.error('Generate error:', error);
      setError('Failed to generate quiz. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  // Update quiz
  const handleSaveChanges = async () => {
    if (!generatedQuizId) return;

    setLoading(true);
    
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${process.env.REACT_APP_API_URL || 'https://classvibe-backend.onrender.com'}/api/quiz/${generatedQuizId}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            questions,
            settings,
            status: 'ready'
          })
        }
      );

      const data = await response.json();

      if (response.ok) {
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

  // Add new question
  const handleAddQuestion = () => {
    const newQuestion = {
      questionText: 'New question',
      options: ['Option 1', 'Option 2', 'Option 3', 'Option 4'],
      correctAnswer: 0,
      explanation: 'Explanation here',
      points: 10,
      timeLimit: 45,
      difficulty: 'medium'
    };
    setQuestions([...questions, newQuestion]);
  };

  // Update question
  const handleUpdateQuestion = (index, field, value) => {
    const updated = [...questions];
    updated[index][field] = value;
    setQuestions(updated);
  };

  // Update option
  const handleUpdateOption = (qIndex, oIndex, value) => {
    const updated = [...questions];
    updated[qIndex].options[oIndex] = value;
    setQuestions(updated);
  };

  // Delete question
  const handleDeleteQuestion = (index) => {
    if (questions.length === 1) {
      alert('Cannot delete the last question!');
      return;
    }
    setQuestions(questions.filter((_, i) => i !== index));
    if (previewIndex >= questions.length - 1) {
      setPreviewIndex(Math.max(0, previewIndex - 1));
    }
  };

  // Set correct answer
  const handleSetCorrectAnswer = (qIndex, oIndex) => {
    const updated = [...questions];
    updated[qIndex].correctAnswer = oIndex;
    setQuestions(updated);
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.title}>Quiz Builder</h2>
          <button onClick={onClose} style={styles.closeBtn}>✕</button>
        </div>

        {/* Navigation Tabs */}
        <div style={styles.tabs}>
          <button 
            style={{...styles.tab, ...(currentStep === 'essentials' ? styles.tabActive : {})}}
            onClick={() => setCurrentStep('essentials')}
          >
            <span style={styles.tabIcon}>✓</span>
            Essentials
          </button>
          <button 
            style={{...styles.tab, ...(currentStep === 'questions' ? styles.tabActive : {})}}
            onClick={() => questions.length > 0 && setCurrentStep('questions')}
            disabled={questions.length === 0}
          >
            <span style={styles.tabIcon}>📋</span>
            Questions
          </button>
          <button 
            style={{...styles.tab, ...(currentStep === 'settings' ? styles.tabActive : {})}}
            onClick={() => questions.length > 0 && setCurrentStep('settings')}
            disabled={questions.length === 0}
          >
            <span style={styles.tabIcon}>⚙️</span>
            Settings
          </button>
          <button 
            style={{...styles.tab, ...(currentStep === 'assign' ? styles.tabActive : {})}}
            disabled
          >
            <span style={styles.tabIcon}>✈️</span>
            Assign
          </button>
        </div>

        {/* Content */}
        <div style={styles.content}>
          {error && <div style={styles.error}>{error}</div>}

          {/* STEP 1: ESSENTIALS */}
          {currentStep === 'essentials' && (
            <div style={styles.essentialsContainer}>
              <h3 style={styles.sectionTitle}>Create Your Quiz</h3>
              
              {/* Input Method Selection */}
              <div style={styles.inputMethodGroup}>
                <button
                  style={{...styles.inputMethodBtn, ...(inputMethod === 'topic' ? styles.inputMethodBtnActive : {})}}
                  onClick={() => setInputMethod('topic')}
                >
                  📝 Enter Topic
                </button>
                <button
                  style={{...styles.inputMethodBtn, ...(inputMethod === 'file' ? styles.inputMethodBtnActive : {})}}
                  onClick={() => setInputMethod('file')}
                >
                  📤 Upload File
                </button>
                <button
                  style={{...styles.inputMethodBtn, ...(inputMethod === 'paste' ? styles.inputMethodBtnActive : {})}}
                  onClick={() => setInputMethod('paste')}
                >
                  📋 Paste Content
                </button>
              </div>

              {/* Topic Input */}
              {inputMethod === 'topic' && (
                <>
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Quiz Topic *</label>
                    <input
                      type="text"
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="e.g., Machine Learning Algorithms, Data Structures..."
                      style={styles.input}
                      autoFocus
                    />
                  </div>

                  {/* Recent Topics Suggestions */}
                  {recentTopics.length > 0 && (
                    <div style={styles.suggestionsBox}>
                      <div style={styles.suggestionsTitle}>💡 Suggested Topics:</div>
                      <div style={styles.suggestionsList}>
                        {recentTopics.slice(0, 6).map((t, i) => (
                          <button
                            key={i}
                            onClick={() => setTopic(t)}
                            style={styles.suggestionChip}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* File Upload */}
              {inputMethod === 'file' && (
                <div style={styles.formGroup}>
                  <label style={styles.label}>Upload Document *</label>
                  <div style={styles.fileUpload}>
                    <input
                      type="file"
                      accept=".pdf,.docx,.doc,.txt"
                      onChange={(e) => setSelectedFile(e.target.files[0])}
                      style={styles.fileInput}
                      id="quiz-file-upload"
                    />
                    <label htmlFor="quiz-file-upload" style={styles.fileLabel}>
                      {selectedFile ? (
                        <span>📄 {selectedFile.name}</span>
                      ) : (
                        <span>📤 Choose PDF, DOCX, or TXT file</span>
                      )}
                    </label>
                  </div>
                  <div style={styles.fileHint}>
                    AI will analyze the document and generate questions based on the content
                  </div>
                </div>
              )}

              {/* Paste Content */}
              {inputMethod === 'paste' && (
                <div style={styles.formGroup}>
                  <label style={styles.label}>Paste Your Content *</label>
                  <textarea
                    value={pastedContent}
                    onChange={(e) => setPastedContent(e.target.value)}
                    placeholder="Paste notes, articles, or any educational content here..."
                    style={styles.textarea}
                    rows={8}
                  />
                </div>
              )}

              {/* Quiz Options */}
              <div style={styles.optionsRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Number of Questions</label>
                  <select value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))} style={styles.select}>
                    <option value={5}>5 questions</option>
                    <option value={10}>10 questions</option>
                    <option value={15}>15 questions</option>
                    <option value={20}>20 questions</option>
                  </select>
                </div>

                <div style={styles.formGroup}>
                  <label style={styles.label}>Difficulty Level</label>
                  <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)} style={styles.select}>
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                    <option value="expert">Expert</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleGenerate}
                disabled={loading || (inputMethod === 'topic' && !topic.trim()) || (inputMethod === 'file' && !selectedFile) || (inputMethod === 'paste' && !pastedContent.trim())}
                style={styles.generateBtn}
              >
                {loading ? '🤖 Generating Quiz...' : '🚀 Generate Quiz with AI'}
              </button>
            </div>
          )}

          {/* STEP 2: QUESTIONS (EXACT UI MATCH) */}
          {currentStep === 'questions' && (
            <div style={styles.questionsContainer}>
              {/* Left Panel: Question Bank */}
              <div style={styles.questionBank}>
                <div style={styles.questionBankHeader}>
                  <h3 style={styles.questionBankTitle}>Question Bank</h3>
                  <button onClick={handleAddQuestion} style={styles.addQuestionBtn}>
                    + Add Question
                  </button>
                </div>
                <div style={styles.questionBankSubtitle}>
                  {questions.length} question{questions.length !== 1 ? 's' : ''} added so far
                </div>

                <div style={styles.questionsList}>
                  {questions.map((q, qIndex) => (
                    <div key={qIndex} style={styles.questionCard}>
                      <div style={styles.questionCardHeader}>
                        <div style={styles.questionTypeRow}>
                          <span style={styles.questionNumber}>{qIndex + 1}</span>
                          <span style={styles.questionType}>Multiple Choice</span>
                          <span style={styles.questionTime}>⏱️ ~{q.timeLimit}s</span>
                        </div>
                        <button 
                          onClick={() => handleDeleteQuestion(qIndex)}
                          style={styles.deleteBtn}
                        >
                          🗑️
                        </button>
                      </div>

                      <input
                        type="text"
                        value={q.questionText}
                        onChange={(e) => handleUpdateQuestion(qIndex, 'questionText', e.target.value)}
                        style={styles.questionInput}
                        placeholder="Enter question text..."
                      />

                      <div style={styles.optionsList}>
                        {q.options.map((opt, oIndex) => (
                          <div key={oIndex} style={styles.optionRow}>
                            <input
                              type="checkbox"
                              checked={q.correctAnswer === oIndex}
                              onChange={() => handleSetCorrectAnswer(qIndex, oIndex)}
                              style={styles.optionCheckbox}
                            />
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) => handleUpdateOption(qIndex, oIndex, e.target.value)}
                              style={{
                                ...styles.optionInput,
                                backgroundColor: q.correctAnswer === oIndex ? '#E8F5E9' : '#fff'
                              }}
                            />
                          </div>
                        ))}
                      </div>

                      <button onClick={() => setPreviewIndex(qIndex)} style={styles.previewThisBtn}>
                        👁️ Preview
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Panel: Live Preview */}
              <div style={styles.livePreview}>
                <div style={styles.previewHeader}>LIVE PREVIEW</div>
                <div style={styles.previewSubtitle}>Student View Experience</div>

                <div style={styles.phoneFrame}>
                  <div style={styles.phoneNotch}></div>
                  
                  <div style={styles.phoneContent}>
                    {questions[previewIndex] && (
                      <>
                        <div style={styles.previewQuestionNumber}>
                          QUESTION {previewIndex + 1} OF {questions.length}
                        </div>
                        <div style={styles.previewQuestionText}>
                          {questions[previewIndex].questionText}
                        </div>

                        <div style={styles.previewOptions}>
                          {questions[previewIndex].options.map((opt, i) => (
                            <div key={i} style={styles.previewOption}>
                              <span style={styles.previewOptionLabel}>
                                {String.fromCharCode(65 + i)}
                              </span>
                              <span style={styles.previewOptionText}>{opt}</span>
                            </div>
                          ))}
                        </div>

                        <button style={styles.previewNextBtn}>Next Question</button>
                      </>
                    )}
                  </div>
                </div>

                <div style={styles.previewNavigation}>
                  <button 
                    onClick={() => setPreviewIndex(Math.max(0, previewIndex - 1))}
                    disabled={previewIndex === 0}
                    style={styles.navBtn}
                  >
                    ← Previous
                  </button>
                  <span style={styles.navIndicator}>
                    {previewIndex + 1} / {questions.length}
                  </span>
                  <button 
                    onClick={() => setPreviewIndex(Math.min(questions.length - 1, previewIndex + 1))}
                    disabled={previewIndex === questions.length - 1}
                    style={styles.navBtn}
                  >
                    Next →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: SETTINGS */}
          {currentStep === 'settings' && (
            <div style={styles.settingsContainer}>
              <h3 style={styles.sectionTitle}>Quiz Settings</h3>

              <div style={styles.settingsList}>
                {[
                  { key: 'showCorrectAnswer', label: 'Show correct answer after each question' },
                  { key: 'showLeaderboard', label: 'Display leaderboard after each question' },
                  { key: 'allowLateJoin', label: 'Allow students to join after quiz starts' },
                  { key: 'shuffleQuestions', label: 'Randomize question order for each student' },
                  { key: 'shuffleOptions', label: 'Shuffle answer options (prevents cheating)' }
                ].map(setting => (
                  <div key={setting.key} style={styles.settingItem}>
                    <label style={styles.settingLabel}>
                      <input
                        type="checkbox"
                        checked={settings[setting.key]}
                        onChange={(e) => setSettings({...settings, [setting.key]: e.target.checked})}
                        style={styles.settingCheckbox}
                      />
                      {setting.label}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div style={styles.footer}>
          {currentStep === 'essentials' && (
            <button onClick={onClose} style={styles.cancelBtn}>Cancel</button>
          )}
          
          {currentStep === 'questions' && (
            <>
              <button onClick={() => setCurrentStep('essentials')} style={styles.backBtn}>
                ← Back to Essentials
              </button>
              <button onClick={() => setCurrentStep('settings')} style={styles.nextBtn}>
                Configure Rules →
              </button>
            </>
          )}

          {currentStep === 'settings' && (
            <>
              <button onClick={() => setCurrentStep('questions')} style={styles.backBtn}>
                ← Back
              </button>
              <div style={styles.footerActions}>
                <button onClick={handleSaveChanges} disabled={loading} style={styles.saveBtn}>
                  {loading ? 'Saving...' : 'Save Draft'}
                </button>
                <button onClick={handleSaveChanges} disabled={loading} style={styles.publishBtn}>
                  {loading ? 'Publishing...' : '🚀 Start Quiz Now'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ========================================
// STYLES (MATCHING PROFESSIONAL UI DESIGN)
// ========================================

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2000,
    backdropFilter: 'blur(4px)'
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: '16px',
    width: '95%',
    maxWidth: '1400px',
    maxHeight: '95vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
    overflow: 'hidden'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '24px 32px',
    borderBottom: '2px solid #f0f0f0',
    backgroundColor: '#fff'
  },
  title: {
    margin: 0,
    fontSize: '24px',
    fontWeight: '700',
    color: '#1a1a1a'
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: '28px',
    cursor: 'pointer',
    color: '#666',
    padding: '4px 12px',
    borderRadius: '8px',
    transition: 'all 0.2s'
  },
  tabs: {
    display: 'flex',
    borderBottom: '2px solid #f0f0f0',
    backgroundColor: '#fafafa',
    padding: '0 32px'
  },
  tab: {
    padding: '16px 32px',
    border: 'none',
    background: 'none',
    fontSize: '15px',
    fontWeight: '600',
    color: '#666',
    cursor: 'pointer',
    borderBottom: '3px solid transparent',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  tabActive: {
    color: '#4F46E5',
    borderBottomColor: '#4F46E5',
    backgroundColor: '#fff'
  },
  tabIcon: {
    fontSize: '18px'
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '32px',
    backgroundColor: '#fafafa'
  },
  error: {
    padding: '16px',
    backgroundColor: '#FEE2E2',
    color: '#DC2626',
    borderRadius: '12px',
    marginBottom: '24px',
    fontSize: '14px',
    fontWeight: '500',
    border: '1px solid #FCA5A5'
  },

  // Essentials styles
  essentialsContainer: {
    maxWidth: '800px',
    margin: '0 auto'
  },
  sectionTitle: {
    fontSize: '22px',
    fontWeight: '700',
    marginBottom: '24px',
    color: '#1a1a1a'
  },
  inputMethodGroup: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '12px',
    marginBottom: '32px'
  },
  inputMethodBtn: {
    padding: '16px',
    border: '2px solid #e0e0e0',
    borderRadius: '12px',
    background: '#fff',
    fontSize: '15px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
    color: '#666'
  },
  inputMethodBtnActive: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
    color: '#4F46E5'
  },
  formGroup: {
    marginBottom: '24px'
  },
  label: {
    display: 'block',
    marginBottom: '8px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151'
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    fontSize: '15px',
    border: '2px solid #e0e0e0',
    borderRadius: '10px',
    outline: 'none',
    transition: 'all 0.2s',
    fontFamily: 'inherit'
  },
  select: {
    width: '100%',
    padding: '14px 16px',
    fontSize: '15px',
    border: '2px solid #e0e0e0',
    borderRadius: '10px',
    outline: 'none',
    backgroundColor: '#fff',
    cursor: 'pointer'
  },
  textarea: {
    width: '100%',
    padding: '14px 16px',
    fontSize: '15px',
    border: '2px solid #e0e0e0',
    borderRadius: '10px',
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit'
  },
  fileUpload: {
    position: 'relative'
  },
  fileInput: {
    position: 'absolute',
    opacity: 0,
    width: '100%',
    height: '100%',
    cursor: 'pointer'
  },
  fileLabel: {
    display: 'block',
    padding: '20px',
    border: '2px dashed #cbd5e0',
    borderRadius: '12px',
    textAlign: 'center',
    cursor: 'pointer',
    backgroundColor: '#fff',
    transition: 'all 0.2s',
    fontSize: '15px',
    fontWeight: '500',
    color: '#4b5563'
  },
  fileHint: {
    marginTop: '8px',
    fontSize: '13px',
    color: '#6b7280',
    fontStyle: 'italic'
  },
  suggestionsBox: {
    padding: '20px',
    backgroundColor: '#FEF3C7',
    borderRadius: '12px',
    marginBottom: '24px',
    border: '1px solid #FDE68A'
  },
  suggestionsTitle: {
    fontSize: '14px',
    fontWeight: '600',
    marginBottom: '12px',
    color: '#92400E'
  },
  suggestionsList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px'
  },
  suggestionChip: {
    padding: '8px 16px',
    border: '1px solid #FCD34D',
    borderRadius: '20px',
    background: '#fff',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
    color: '#92400E'
  },
  optionsRow: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '20px',
    marginBottom: '32px'
  },
  generateBtn: {
    width: '100%',
    padding: '18px',
    fontSize: '16px',
    fontWeight: '700',
    backgroundColor: '#4F46E5',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    transition: 'all 0.2s',
    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
  },

  // Questions (Main UI) styles
  questionsContainer: {
    display: 'grid',
    gridTemplateColumns: '1.5fr 1fr',
    gap: '32px',
    height: 'calc(95vh - 300px)'
  },
  questionBank: {
    display: 'flex',
    flexDirection: 'column'
  },
  questionBankHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px'
  },
  questionBankTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#1a1a1a',
    margin: 0
  },
  addQuestionBtn: {
    padding: '10px 20px',
    border: '2px solid #4F46E5',
    borderRadius: '10px',
    background: '#fff',
    color: '#4F46E5',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  questionBankSubtitle: {
    fontSize: '13px',
    color: '#6b7280',
    marginBottom: '20px'
  },
  questionsList: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    paddingRight: '8px'
  },
  questionCard: {
    backgroundColor: '#fff',
    border: '2px solid #e5e7eb',
    borderRadius: '12px',
    padding: '20px',
    transition: 'all 0.2s'
  },
  questionCardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px'
  },
  questionTypeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  questionNumber: {
    backgroundColor: '#4F46E5',
    color: '#fff',
    padding: '4px 10px',
    borderRadius: '6px',
    fontSize: '12px',
    fontWeight: '700'
  },
  questionType: {
    fontSize: '12px',
    color: '#6b7280',
    fontWeight: '600'
  },
  questionTime: {
    fontSize: '12px',
    color: '#9ca3af'
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    fontSize: '18px',
    cursor: 'pointer',
    padding: '4px 8px',
    borderRadius: '6px',
    transition: 'all 0.2s'
  },
  questionInput: {
    width: '100%',
    padding: '12px',
    fontSize: '15px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    marginBottom: '16px',
    fontWeight: '500',
    outline: 'none'
  },
  optionsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    marginBottom: '12px'
  },
  optionRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  optionCheckbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
    accentColor: '#10B981'
  },
  optionInput: {
    flex: 1,
    padding: '10px 12px',
    fontSize: '14px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    outline: 'none'
  },
  previewThisBtn: {
    padding: '8px 16px',
    border: '1px solid #e5e7eb',
    borderRadius: '8px',
    background: '#fff',
    fontSize: '13px',
    fontWeight: '600',
    color: '#4b5563',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },

  // Live Preview styles
  livePreview: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  previewHeader: {
    fontSize: '12px',
    fontWeight: '700',
    color: '#6b7280',
    letterSpacing: '1px',
    marginBottom: '4px'
  },
  previewSubtitle: {
    fontSize: '13px',
    color: '#9ca3af',
    marginBottom: '24px'
  },
  phoneFrame: {
    width: '320px',
    height: '640px',
    border: '12px solid #1f2937',
    borderRadius: '36px',
    backgroundColor: '#fff',
    boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
    position: 'relative',
    overflow: 'hidden'
  },
  phoneNotch: {
    width: '140px',
    height: '28px',
    backgroundColor: '#1f2937',
    borderRadius: '0 0 20px 20px',
    position: 'absolute',
    top: 0,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 1
  },
  phoneContent: {
    padding: '50px 24px 24px',
    height: '100%',
    overflowY: 'auto'
  },
  previewQuestionNumber: {
    fontSize: '11px',
    fontWeight: '700',
    color: '#4F46E5',
    letterSpacing: '0.5px',
    marginBottom: '12px'
  },
  previewQuestionText: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: '24px',
    lineHeight: '1.5'
  },
  previewOptions: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    marginBottom: '24px'
  },
  previewOption: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '14px',
    border: '2px solid #e5e7eb',
    borderRadius: '10px',
    backgroundColor: '#fff',
    transition: 'all 0.2s'
  },
  previewOptionLabel: {
    width: '28px',
    height: '28px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: '6px',
    fontSize: '14px',
    fontWeight: '700',
    color: '#4b5563',
    flexShrink: 0
  },
  previewOptionText: {
    fontSize: '14px',
    color: '#374151',
    lineHeight: '1.4'
  },
  previewNextBtn: {
    width: '100%',
    padding: '14px',
    backgroundColor: '#4F46E5',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    fontSize: '15px',
    fontWeight: '700',
    cursor: 'pointer'
  },
  previewNavigation: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    marginTop: '20px',
    width: '320px'
  },
  navBtn: {
    padding: '10px 20px',
    border: '2px solid #e5e7eb',
    borderRadius: '8px',
    background: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    color: '#4b5563',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  navIndicator: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#6b7280'
  },

  // Settings styles
  settingsContainer: {
    maxWidth: '800px',
    margin: '0 auto'
  },
  settingsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  settingItem: {
    padding: '20px',
    backgroundColor: '#fff',
    border: '2px solid #e5e7eb',
    borderRadius: '12px'
  },
  settingLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    fontSize: '15px',
    fontWeight: '500',
    color: '#374151',
    cursor: 'pointer',
    userSelect: 'none'
  },
  settingCheckbox: {
    width: '20px',
    height: '20px',
    cursor: 'pointer',
    accentColor: '#4F46E5'
  },

  // Footer styles
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '24px 32px',
    borderTop: '2px solid #f0f0f0',
    backgroundColor: '#fff'
  },
  cancelBtn: {
    padding: '12px 24px',
    border: '2px solid #e5e7eb',
    borderRadius: '10px',
    background: '#fff',
    fontSize: '15px',
    fontWeight: '600',
    color: '#6b7280',
    cursor: 'pointer'
  },
  backBtn: {
    padding: '12px 24px',
    border: '2px solid #e5e7eb',
    borderRadius: '10px',
    background: '#fff',
    fontSize: '15px',
    fontWeight: '600',
    color: '#4b5563',
    cursor: 'pointer'
  },
  nextBtn: {
    padding: '12px 32px',
    border: 'none',
    borderRadius: '10px',
    background: '#4F46E5',
    fontSize: '15px',
    fontWeight: '700',
    color: '#fff',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(79, 70, 229, 0.3)'
  },
  footerActions: {
    display: 'flex',
    gap: '12px'
  },
  saveBtn: {
    padding: '12px 24px',
    border: '2px solid #4F46E5',
    borderRadius: '10px',
    background: '#fff',
    fontSize: '15px',
    fontWeight: '600',
    color: '#4F46E5',
    cursor: 'pointer'
  },
  publishBtn: {
    padding: '12px 32px',
    border: 'none',
    borderRadius: '10px',
    background: '#10B981',
    fontSize: '15px',
    fontWeight: '700',
    color: '#fff',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)'
  }
};

export default QuizCreator;