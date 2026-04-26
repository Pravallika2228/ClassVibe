// frontend/src/api.js
import axios from 'axios';

// ✅ Backend API URL
const API_URL = 'https://classvibe-backend.onrender.com';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true // ✅ REQUIRED for CORS + auth
});

// Add token to every request — UNCHANGED
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor — UNCHANGED
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 403 || error.response?.status === 401) {
      console.warn('Token expired or invalid - clearing session');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

// ============================================
// AUTH API CALLS — UNCHANGED
// ============================================
export const register = async (email, password, name = '', role = 'student') => {
  try {
    const response = await api.post('/auth/register', {
      email,
      password,
      name: name || email.split('@')[0],
      username: email.split('@')[0],
      role
    });
    return response.data;
  } catch (error) {
    console.error('Register API error:', error);
    throw error;
  }
};

export const login = async (email, password) => {
  try {
    const response = await api.post('/auth/login', {
      email,
      password
    });
    return response.data;
  } catch (error) {
    console.error('Login API error:', error);
    throw error;
  }
};

// ============================================
// SESSION/GROUP API CALLS — UNCHANGED
// ============================================
export const createGroup = async (groupName) => {
  try {
    const response = await api.post('/groups/create', {
      groupName
    });
    return response.data;
  } catch (error) {
    console.error('Create group API error:', error);
    throw error;
  }
};

export const joinGroup = async (data) => {
  try {
    const response = await api.post('/groups/join', data);
    return response.data;
  } catch (error) {
    console.error('Join group API error:', error);
    throw error;
  }
};

export const getMyGroups = async () => {
  try {
    const response = await api.get('/groups/my-groups');
    return response.data;
  } catch (error) {
    console.error('Get groups API error:', error);
    throw error;
  }
};

export const getGroupDetails = async (groupId) => {
  try {
    const response = await api.get(`/groups/${groupId}`);
    return response.data;
  } catch (error) {
    console.error('Get group details API error:', error);
    throw error;
  }
};

export const endSession = async (groupId) => {
  try {
    const response = await api.post(`/groups/${groupId}/end`);
    return response.data;
  } catch (error) {
    console.error('End session API error:', error);
    throw error;
  }
};

export const getMessages = async (groupId) => {
  try {
    const response = await api.get(`/groups/${groupId}/messages`);
    return response.data;
  } catch (error) {
    console.error('Get messages API error:', error);
    throw error;
  }
};

// ============================================
// FILE UPLOAD — UNCHANGED
// ============================================
export const uploadFile = async (file) => {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const token = localStorage.getItem('token');
    const response = await fetch(`${API_URL}/api/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Upload error:', error);
    throw error;
  }
};

// ============================================
// ✅ NEW: SCHEDULE API CALLS
// These are convenience wrappers used by
// ScheduleSession.jsx and the Instructor Hub.
// ScheduleSession.jsx also uses fetch() directly
// for cases that need FormData — both work fine.
// ============================================

/**
 * Create a scheduled session
 */
export const createScheduledSession = async (payload) => {
  try {
    const response = await api.post('/schedule/create', payload);
    return response.data;
  } catch (error) {
    console.error('Create scheduled session error:', error);
    throw error;
  }
};

/**
 * Save a draft session
 */
export const saveSessionDraft = async (payload) => {
  try {
    const response = await api.post('/schedule/draft', payload);
    return response.data;
  } catch (error) {
    console.error('Save draft error:', error);
    throw error;
  }
};

/**
 * Get all drafts for the current teacher
 */
export const getSessionDrafts = async () => {
  try {
    const response = await api.get('/schedule/drafts');
    return response.data;
  } catch (error) {
    console.error('Get drafts error:', error);
    throw error;
  }
};

/**
 * Delete a draft
 */
export const deleteSessionDraft = async (draftId) => {
  try {
    const response = await api.delete(`/schedule/draft/${draftId}`);
    return response.data;
  } catch (error) {
    console.error('Delete draft error:', error);
    throw error;
  }
};

/**
 * Get teacher's scheduled sessions
 * @param {string} status - 'scheduled' | 'live' | 'completed' | 'all'
 */
export const getMySessions = async (status = 'all') => {
  try {
    const response = await api.get(`/schedule/my-sessions?status=${status}`);
    return response.data;
  } catch (error) {
    console.error('Get my sessions error:', error);
    throw error;
  }
};

/**
 * Start a scheduled session (converts it to a live Group)
 */
export const startScheduledSession = async (sessionId) => {
  try {
    const response = await api.post(`/schedule/${sessionId}/start`);
    return response.data;
  } catch (error) {
    console.error('Start session error:', error);
    throw error;
  }
};

/**
 * Cancel a scheduled session
 */
export const cancelScheduledSession = async (sessionId) => {
  try {
    const response = await api.post(`/schedule/${sessionId}/cancel`);
    return response.data;
  } catch (error) {
    console.error('Cancel session error:', error);
    throw error;
  }
};

/**
 * Verify student access to a private session (email + password)
 */
export const verifySessionAccess = async (sessionId, password) => {
  try {
    const response = await api.post(`/schedule/${sessionId}/verify-access`, { password });
    return response.data;
  } catch (error) {
    console.error('Verify access error:', error);
    throw error;
  }
};

/**
 * Get available sessions for student
 */
export const getAvailableSessions = async () => {
  try {
    const response = await api.get('/schedule/available');
    return response.data;
  } catch (error) {
    console.error('Get available sessions error:', error);
    throw error;
  }
};

/**
 * Get unauthorized join attempts for a session (teacher use)
 */
export const getUnauthorizedAttempts = async (sessionId) => {
  try {
    const response = await api.get(`/schedule/${sessionId}/unauthorized-attempts`);
    return response.data;
  } catch (error) {
    console.error('Get unauthorized attempts error:', error);
    throw error;
  }
};

export default api;