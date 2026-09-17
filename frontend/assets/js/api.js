// Centralized API helper. Every backend call in the app goes through this file.
const API_BASE = 'http://localhost:5000/api';

function getToken() {
  return localStorage.getItem('spd_token');
}

function setToken(token) {
  if (token) localStorage.setItem('spd_token', token);
}

function clearToken() {
  localStorage.removeItem('spd_token');
  localStorage.removeItem('spd_user');
}

function getStoredUser() {
  try {
    const raw = localStorage.getItem('spd_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setStoredUser(user) {
  localStorage.setItem('spd_user', JSON.stringify(user));
}

async function apiRequest(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  } catch (networkErr) {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }

  let json = null;
  try {
    json = await res.json();
  } catch {
    // no JSON body
  }

  if (res.status === 401) {
    // Session expired or invalid -- force re-login
    clearToken();
    if (!location.pathname.endsWith('login.html') && !location.pathname.endsWith('register.html')) {
      location.href = 'login.html';
    }
  }

  if (!res.ok) {
    const message = (json && json.message) || `Request failed with status ${res.status}`;
    throw new Error(message);
  }

  return json;
}

const API = {
  // Auth
  register: (data) => apiRequest('/auth/register', { method: 'POST', body: data, auth: false }),
  login: (data) => apiRequest('/auth/login', { method: 'POST', body: data, auth: false }),
  me: () => apiRequest('/auth/me'),
  updateSettings: (data) => apiRequest('/auth/settings', { method: 'PATCH', body: data }),
  deleteAccount: () => apiRequest('/users/me', { method: 'DELETE' }),

  // Subjects
  listSubjects: () => apiRequest('/subjects'),
  createSubject: (data) => apiRequest('/subjects', { method: 'POST', body: data }),
  updateSubject: (id, data) => apiRequest(`/subjects/${id}`, { method: 'PATCH', body: data }),
  deleteSubject: (id) => apiRequest(`/subjects/${id}`, { method: 'DELETE' }),

  // Tasks
  listTasks: (query = '') => apiRequest(`/tasks${query}`),
  getTask: (id) => apiRequest(`/tasks/${id}`),
  createTask: (data) => apiRequest('/tasks', { method: 'POST', body: data }),
  updateTask: (id, data) => apiRequest(`/tasks/${id}`, { method: 'PATCH', body: data }),
  deleteTask: (id) => apiRequest(`/tasks/${id}`, { method: 'DELETE' }),
  addSubtask: (id, title) => apiRequest(`/tasks/${id}/subtasks`, { method: 'POST', body: { title } }),
  updateSubtask: (id, subtaskId, data) =>
    apiRequest(`/tasks/${id}/subtasks/${subtaskId}`, { method: 'PATCH', body: data }),
  deleteSubtask: (id, subtaskId) => apiRequest(`/tasks/${id}/subtasks/${subtaskId}`, { method: 'DELETE' }),

  // Attendance
  listAttendance: () => apiRequest('/attendance'),
  markAttendance: (subjectId, status) =>
    apiRequest('/attendance/mark', { method: 'POST', body: { subjectId, status } }),
  deleteAttendance: (id) => apiRequest(`/attendance/${id}`, { method: 'DELETE' }),

  // Study sessions
  listSessions: (query = '') => apiRequest(`/study-sessions${query}`),
  createSession: (data) => apiRequest('/study-sessions', { method: 'POST', body: data }),

  // Notes
  listNotes: (query = '') => apiRequest(`/notes${query}`),
  createNote: (data) => apiRequest('/notes', { method: 'POST', body: data }),
  updateNote: (id, data) => apiRequest(`/notes/${id}`, { method: 'PATCH', body: data }),
  deleteNote: (id) => apiRequest(`/notes/${id}`, { method: 'DELETE' }),

  // Exams
  listExams: () => apiRequest('/exams'),
  createExam: (data) => apiRequest('/exams', { method: 'POST', body: data }),
  updateExam: (id, data) => apiRequest(`/exams/${id}`, { method: 'PATCH', body: data }),
  deleteExam: (id) => apiRequest(`/exams/${id}`, { method: 'DELETE' }),

  // Analytics
  getDashboardAnalytics: () => apiRequest('/analytics/dashboard')
};
